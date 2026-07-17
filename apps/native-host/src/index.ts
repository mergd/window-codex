import { createHash, randomUUID } from "node:crypto";
import { basename } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { AppServer } from "./app-server.js";
import { encodeNativeMessage, NativeMessageDecoder } from "./codec.js";

type HostMessage = { id: string; origin: string; method: string; params: any } | { type: "approval.resolve"; id: string; decision?: string; result?: unknown };
type Task = { id: string; runtimeThreadId: string; runtimeTurnId: string; origin: string; status: "pending" | "running" | "completed" | "failed" | "cancelled"; title: string; workspaceLabel: string; createdAt: number; updatedAt: number; lastMessage: string | null; sequence: number };

const codexBin = process.env.WINDOW_CODEX_CODEX_BIN || "codex";
const defaultWorkspace = process.env.WINDOW_CODEX_DEFAULT_WORKSPACE || process.cwd();
const app = new AppServer(codexBin);
const decoder = new NativeMessageDecoder();
const aliases = new Map<string, string>();
const workspaces = new Map<string, string>();
const tasks = new Map<string, Task>();
const turnWaiters = new Map<string, { chunks: string[]; resolve: (text: string) => void; reject: (error: Error) => void }>();

function write(value: unknown) { process.stdout.write(encodeNativeMessage(value)); }
function fail(id: string, code: string, message: string, retryable = false) { write({ id, error: { code, message, data: { retryable } } }); }
function alias(origin: string, kind: string, runtimeId: string) { const value = createHash("sha256").update(`${origin}\0${kind}\0${runtimeId}`).digest("hex").slice(0, 32); aliases.set(`${origin}:${kind}:${value}`, runtimeId); return value; }
function resolveAlias(origin: string, kind: string, value: string) { return aliases.get(`${origin}:${kind}:${value}`); }
function snapshot(task: Task) { const { runtimeThreadId, runtimeTurnId, origin, sequence, ...safe } = task; return safe; }
function event(event: string, payload: unknown) { write({ type: "event", event, payload }); }

function input(text: string) { return [{ type: "text", text, textElements: [] }]; }
function findTaskByRuntime(threadId: string) { return [...tasks.values()].find(task => task.runtimeThreadId === threadId); }

app.on("notification", (message: any) => {
  const params = message.params ?? {};
  const threadId = params.threadId ?? params.thread?.id ?? params.turn?.threadId;
  const turnId = params.turnId ?? params.turn?.id;
  const waiter = threadId ? turnWaiters.get(threadId) : undefined;
  if (message.method === "item/agentMessage/delta" && waiter && typeof params.delta === "string") waiter.chunks.push(params.delta);
  if (message.method === "turn/completed" && waiter) { turnWaiters.delete(threadId); waiter.resolve(waiter.chunks.join("")); }
  const task = threadId ? findTaskByRuntime(threadId) : undefined;
  if (!task) return;
  if (message.method === "turn/started") { task.status = "running"; task.updatedAt = Date.now() / 1000; event("task.started", { task: snapshot(task) }); }
  if (message.method === "item/agentMessage/delta" && typeof params.delta === "string") { task.sequence += 1; task.lastMessage = `${task.lastMessage ?? ""}${params.delta}`.slice(-4000); task.updatedAt = Date.now() / 1000; event("task.event", { taskId: task.id, sequence: task.sequence, kind: "agentMessage", text: params.delta }); }
  if (message.method === "turn/completed") { const status = params.turn?.status; task.status = status === "interrupted" ? "cancelled" : status === "failed" ? "failed" : "completed"; task.updatedAt = Date.now() / 1000; event(task.status === "cancelled" ? "task.cancelled" : task.status === "failed" ? "task.failed" : "task.completed", task.status === "failed" ? { task: snapshot(task), message: "Codex task failed" } : { task: snapshot(task) }); }
});

app.on("request", (message: any) => {
  write({ type: "approval", id: String(message.id), method: message.method, params: sanitizeApproval(message.params) });
});

function sanitizeApproval(params: any) {
  return { reason: params?.reason ?? null, command: Array.isArray(params?.command) ? params.command.join(" ") : params?.command ?? null, cwd: params?.cwd ? basename(params.cwd) : null, fileCount: Array.isArray(params?.fileChanges) ? params.fileChanges.length : null, questions: params?.questions ?? null };
}

async function waitForTurn(threadId: string) { return new Promise<string>((resolve, reject) => turnWaiters.set(threadId, { chunks: [], resolve, reject })); }

async function handle(message: HostMessage) {
  if ("type" in message) { app.respond(Number(message.id), message.result ?? { decision: message.decision ?? "decline" }); return; }
  const { id, origin, method, params } = message;
  try {
    if (method === "provider.info") { write({ id, result: { ready: true, runtime: "codex app-server" } }); return; }
    if (method === "workspace.select") { const workspaceId = alias(origin, "workspace", defaultWorkspace); workspaces.set(`${origin}:${workspaceId}`, defaultWorkspace); write({ id, result: { id: workspaceId, label: basename(defaultWorkspace) } }); return; }
    if (method === "threads.list") {
      const response = await app.request("thread/list", { cursor: params.cursor ?? null, limit: params.limit ?? 20, sortKey: "updatedAt" });
      const data = (response.data ?? []).map((thread: any) => ({ id: alias(origin, "thread", thread.id), title: thread.name || thread.preview || "Untitled Codex task", createdAt: thread.createdAt ?? 0, updatedAt: thread.updatedAt ?? thread.createdAt ?? 0, turnCount: Array.isArray(thread.turns) ? thread.turns.length : 0, workspaceLabel: thread.cwd ? basename(thread.cwd) : null }));
      write({ id, result: { data, nextCursor: response.nextCursor ?? null } }); return;
    }
    if (method === "threads.analyze") { write({ id, result: await analyze(origin, params.threadIds) }); return; }
    if (method === "tasks.start") { write({ id, result: await startTask(origin, params) }); return; }
    if (method === "tasks.get") { const task = tasks.get(params.taskId); if (!task || task.origin !== origin) throw Object.assign(new Error("Task not found"), { code: "TASK_NOT_FOUND" }); write({ id, result: snapshot(task) }); return; }
    if (method === "tasks.send") { const task = ownedTask(origin, params.taskId); const response = await app.request("turn/start", { threadId: task.runtimeThreadId, input: input(params.message) }); task.runtimeTurnId = response.turn?.id ?? task.runtimeTurnId; task.status = "pending"; task.updatedAt = Date.now() / 1000; write({ id, result: snapshot(task) }); return; }
    if (method === "tasks.cancel") { const task = ownedTask(origin, params.taskId); await app.request("turn/interrupt", { threadId: task.runtimeThreadId, turnId: task.runtimeTurnId }); task.status = "cancelled"; task.updatedAt = Date.now() / 1000; write({ id, result: snapshot(task) }); return; }
    throw Object.assign(new Error(`Unsupported native method: ${method}`), { code: "UNSUPPORTED_METHOD" });
  } catch (reason: any) { fail(id, reason.code ?? "RUNTIME_ERROR", reason.message ?? String(reason), reason.code === "RUNTIME_UNAVAILABLE"); }
}

function ownedTask(origin: string, taskId: string) { const task = tasks.get(taskId); if (!task || task.origin !== origin) throw Object.assign(new Error("Task not found"), { code: "TASK_NOT_FOUND" }); return task; }

async function startTask(origin: string, params: any) {
  const workspace = workspaces.get(`${origin}:${params.workspaceId}`); if (!workspace) throw Object.assign(new Error("Workspace grant is invalid"), { code: "GRANT_REVOKED" });
  const thread = await app.request("thread/start", { cwd: workspace, serviceName: "window_codex" });
  const now = Date.now() / 1000; const task: Task = { id: randomUUID(), runtimeThreadId: thread.thread.id, runtimeTurnId: "", origin, status: "pending", title: params.title || "Codex task", workspaceLabel: basename(workspace), createdAt: now, updatedAt: now, lastMessage: null, sequence: 0 }; tasks.set(task.id, task);
  const turn = await app.request("turn/start", { threadId: thread.thread.id, input: input(params.prompt) });
  task.runtimeTurnId = turn.turn.id; return snapshot(task);
}

async function analyze(origin: string, threadIds: string[]) {
  const runtimeIds = threadIds.map(value => resolveAlias(origin, "thread", value)).filter(Boolean) as string[];
  if (runtimeIds.length !== threadIds.length) throw Object.assign(new Error("The thread selection is invalid or expired"), { code: "INVALID_SELECTOR" });
  const histories: Array<{ id: string; content: string }> = []; let truncatedThreads = 0; let total = 0;
  for (const [index, runtimeId] of runtimeIds.entries()) { const response = await app.request("thread/read", { threadId: runtimeId, includeTurns: true }); let encoded = JSON.stringify(response.thread); if (encoded.length > 80_000) { encoded = encoded.slice(-80_000); truncatedThreads += 1; } if (total + encoded.length > 300_000) { truncatedThreads += 1; continue; } total += encoded.length; histories.push({ id: threadIds[index], content: encoded }); }
  const cwd = await mkdtemp(`${tmpdir()}/window-codex-analysis-`);
  const thread = await app.request("thread/start", { cwd, ephemeral: true, approvalPolicy: "never", sandbox: "readOnly", serviceName: "window_codex_analysis", developerInstructions: "Analyze only the supplied JSON. Do not use tools or inspect the filesystem. Return only JSON matching the requested schema." });
  const outputSchema = reflectionSchema();
  const prompt = `Analyze these selected Codex thread histories. Identify recurring themes, friction, and actionable improvements. Never quote transcript text. Use only opaque thread IDs in evidence.\n\n${JSON.stringify(histories)}`;
  const completion = waitForTurn(thread.thread.id);
  await app.request("turn/start", { threadId: thread.thread.id, input: input(prompt), outputSchema });
  const text = await completion;
  const parsed = JSON.parse(text.trim().replace(/^```json\s*|\s*```$/g, ""));
  parsed.coverage = { ...(parsed.coverage ?? {}), selectedThreads: threadIds.length, analyzedThreads: histories.length, truncatedThreads };
  return parsed;
}

function reflectionSchema() {
  const threadIds = { type: "array", items: { type: "string" } };
  return {
    type: "object",
    additionalProperties: false,
    required: ["coverage", "activity", "themes", "frictions", "suggestions"],
    properties: {
      coverage: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to"],
        properties: { from: { type: ["string", "null"] }, to: { type: ["string", "null"] } }
      },
      activity: {
        type: "object",
        additionalProperties: false,
        required: ["threadCount", "turnCount", "activeDays"],
        properties: { threadCount: { type: "integer" }, turnCount: { type: "integer" }, activeDays: { type: "integer" } }
      },
      themes: {
        type: "array",
        items: { type: "object", additionalProperties: false, required: ["label", "count", "threadIds"], properties: { label: { type: "string" }, count: { type: "integer" }, threadIds } }
      },
      frictions: {
        type: "array",
        items: { type: "object", additionalProperties: false, required: ["label", "description", "threadIds"], properties: { label: { type: "string" }, description: { type: "string" }, threadIds } }
      },
      suggestions: {
        type: "array",
        items: { type: "object", additionalProperties: false, required: ["id", "title", "rationale", "proposedPrompt"], properties: { id: { type: "string" }, title: { type: "string" }, rationale: { type: "string" }, proposedPrompt: { type: "string" } } }
      }
    }
  };
}

process.on("uncaughtException", error => process.stderr.write(`[window.codex] ${error.stack ?? error.message}\n`));
await app.start();
process.stdin.on("data", chunk => { try { for (const message of decoder.push(chunk)) void handle(message as HostMessage); } catch (error) { process.stderr.write(`[window.codex] ${String(error)}\n`); } });
