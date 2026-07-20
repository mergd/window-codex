export const PROTOCOL_VERSION = "0.1" as const;

export type PermissionScope =
  | "threads:metadata"
  | "threads:analyze"
  | "workspace:select"
  | "tasks:create"
  | "tasks:control"
  | "events:subscribe";

export type GrantPersistence = "once" | "persistent" | "action";
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface Grant {
  id: string;
  origin: string;
  scopes: PermissionScope[];
  persistence: GrantPersistence;
  createdAt: number;
}

export interface ThreadMetadata {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  turnCount: number;
  workspaceLabel: string | null;
}

export interface ReflectionResult {
  coverage: {
    selectedThreads: number;
    analyzedThreads: number;
    truncatedThreads: number;
    from: string | null;
    to: string | null;
  };
  activity: { threadCount: number; turnCount: number; activeDays: number };
  themes: Array<{ label: string; count: number; threadIds: string[] }>;
  frictions: Array<{ label: string; description: string; threadIds: string[] }>;
  suggestions: Array<{ id: string; title: string; rationale: string; proposedPrompt: string }>;
}

export interface TaskSnapshot {
  id: string;
  status: TaskStatus;
  title: string;
  workspaceLabel: string;
  createdAt: number;
  updatedAt: number;
  lastMessage: string | null;
}

export interface CodexMethodParams {
  "provider.info": Record<string, never>;
  "capabilities.list": Record<string, never>;
  connect: { protocolVersion: typeof PROTOCOL_VERSION; scopes: PermissionScope[] };
  disconnect: Record<string, never>;
  "permissions.get": Record<string, never>;
  "permissions.request": { scopes: PermissionScope[]; persistence: GrantPersistence; selector?: { threadIds?: string[] } };
  "permissions.revoke": { grantId?: string };
  "workspace.select": { suggestedLabel?: string };
  "threads.list": { cursor?: string; limit?: number };
  "threads.analyze": { recipe: "reflection.v1"; threadIds: string[] };
  "tasks.start": { workspaceId: string; prompt: string; title?: string };
  "tasks.get": { taskId: string };
  "tasks.send": { taskId: string; message: string };
  "tasks.cancel": { taskId: string };
}

export interface CodexMethodResults {
  "provider.info": { name: "Codemask"; protocolVersion: typeof PROTOCOL_VERSION; providerVersion: string; connected: boolean };
  "capabilities.list": { methods: CodexMethod[]; recipes: ["reflection.v1"] };
  connect: { connected: true; grants: Grant[] };
  disconnect: { disconnected: true };
  "permissions.get": { grants: Grant[] };
  "permissions.request": { grant: Grant };
  "permissions.revoke": { revoked: true };
  "workspace.select": { id: string; label: string };
  "threads.list": { data: ThreadMetadata[]; nextCursor: string | null };
  "threads.analyze": ReflectionResult;
  "tasks.start": TaskSnapshot;
  "tasks.get": TaskSnapshot;
  "tasks.send": TaskSnapshot;
  "tasks.cancel": TaskSnapshot;
}

export type CodexMethod = keyof CodexMethodParams;

export interface CodexEventPayloads {
  "provider.connected": { origin: string };
  "provider.disconnected": { reason: string };
  "permissions.changed": { grants: Grant[] };
  "task.started": { task: TaskSnapshot };
  "task.event": { taskId: string; sequence: number; kind: "agentMessage" | "status"; text: string };
  "task.completed": { task: TaskSnapshot };
  "task.failed": { task: TaskSnapshot; message: string };
  "task.cancelled": { task: TaskSnapshot };
}

export type CodexEvent = keyof CodexEventPayloads;
export type CodexListener<E extends CodexEvent> = (payload: CodexEventPayloads[E]) => void;

export interface CodexProvider {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  request<M extends CodexMethod>(request: { method: M; params: CodexMethodParams[M] }, options?: { signal?: AbortSignal }): Promise<CodexMethodResults[M]>;
  on<E extends CodexEvent>(event: E, listener: CodexListener<E>): void;
  removeListener<E extends CodexEvent>(event: E, listener: CodexListener<E>): void;
}

export type CodexErrorCode =
  | "PROVIDER_UNAVAILABLE" | "UNSUPPORTED_METHOD" | "UNSUPPORTED_VERSION"
  | "PERMISSION_REQUIRED" | "PERMISSION_DENIED" | "GRANT_REVOKED"
  | "INVALID_SELECTOR" | "USER_CANCELLED" | "TASK_NOT_FOUND"
  | "RUNTIME_UNAVAILABLE" | "RUNTIME_ERROR";

export class CodexError extends Error {
  constructor(public readonly code: CodexErrorCode, message: string, public readonly data?: { retryable?: boolean }) {
    super(message);
    this.name = "CodexError";
  }
}

export function isCodexError(value: unknown): value is CodexError {
  return value instanceof CodexError || Boolean(value && typeof value === "object" && "code" in value && "message" in value);
}

declare global {
  interface Window { codex?: CodexProvider }
}

export async function getCodexProvider(options: { timeoutMs?: number } = {}): Promise<CodexProvider> {
  if (typeof window === "undefined") throw new CodexError("PROVIDER_UNAVAILABLE", "window.codex requires a browser");
  if (window.codex) return window.codex;
  const timeoutMs = options.timeoutMs ?? 1500;
  return new Promise((resolve, reject) => {
    const done = () => {
      window.removeEventListener("codex#initialized", done);
      clearTimeout(timer);
      if (window.codex) resolve(window.codex);
      else reject(new CodexError("PROVIDER_UNAVAILABLE", "The Codex provider did not initialize"));
    };
    const timer = window.setTimeout(() => {
      window.removeEventListener("codex#initialized", done);
      reject(new CodexError("PROVIDER_UNAVAILABLE", "Install or enable the Codemask extension"));
    }, timeoutMs);
    window.addEventListener("codex#initialized", done, { once: true });
  });
}

export async function requestCodex<M extends CodexMethod>(method: M, params: CodexMethodParams[M], options?: { signal?: AbortSignal }) {
  const provider = await getCodexProvider();
  return provider.request({ method, params }, options);
}

export function createMockCodexProvider(): CodexProvider {
  const listeners = new Map<string, Set<(payload: any) => void>>();
  const now = Math.floor(Date.now() / 1000);
  const grants: Grant[] = [];
  const tasks = new Map<string, TaskSnapshot>();
  const threads: ThreadMetadata[] = Array.from({ length: 8 }, (_, index) => ({ id: `mock-thread-${index + 1}`, title: ["Ship the onboarding flow", "Debug Cloudflare deployment", "Refactor the provider contract", "Build a dashboard", "Tighten API permissions", "Fix CI failures", "Review the extension UX", "Create release notes"][index], createdAt: now - (index + 3) * 86400, updatedAt: now - index * 7200, turnCount: 3 + index, workspaceLabel: index % 2 ? "window.codex" : "product" }));
  const emit = (event: string, payload: any) => listeners.get(event)?.forEach(listener => listener(payload));
  const provider: CodexProvider = {
    protocolVersion: PROTOCOL_VERSION,
    async request({ method, params }: any): Promise<any> {
      if (method === "provider.info") return { name: "Codemask", protocolVersion: PROTOCOL_VERSION, providerVersion: "mock", connected: grants.length > 0 };
      if (method === "capabilities.list") return { methods: ["provider.info", "capabilities.list", "connect", "disconnect", "permissions.get", "permissions.request", "permissions.revoke", "workspace.select", "threads.list", "threads.analyze", "tasks.start", "tasks.get", "tasks.send", "tasks.cancel"], recipes: ["reflection.v1"] };
      if (method === "connect") { const grant: Grant = { id: crypto.randomUUID(), origin: location.origin, scopes: params.scopes, persistence: "persistent", createdAt: now }; grants.push(grant); emit("provider.connected", { origin: location.origin }); return { connected: true, grants }; }
      if (method === "disconnect") { grants.length = 0; emit("provider.disconnected", { reason: "Mock disconnected" }); return { disconnected: true }; }
      if (method === "permissions.get") return { grants };
      if (method === "permissions.request") { const grant: Grant = { id: crypto.randomUUID(), origin: location.origin, scopes: params.scopes, persistence: params.persistence, createdAt: now }; grants.push(grant); emit("permissions.changed", { grants }); return { grant }; }
      if (method === "permissions.revoke") { grants.splice(0, grants.length, ...grants.filter(grant => params.grantId && grant.id !== params.grantId)); return { revoked: true }; }
      if (method === "workspace.select") return { id: "mock-workspace", label: "my-project" };
      if (method === "threads.list") return { data: threads.slice(0, params.limit ?? 20), nextCursor: null };
      if (method === "threads.analyze") return { coverage: { selectedThreads: params.threadIds.length, analyzedThreads: params.threadIds.length, truncatedThreads: 0, from: new Date((now - 30 * 86400) * 1000).toISOString(), to: new Date().toISOString() }, activity: { threadCount: params.threadIds.length, turnCount: params.threadIds.length * 6, activeDays: Math.min(12, params.threadIds.length * 2) }, themes: [{ label: "Workflow automation", count: Math.max(2, params.threadIds.length - 1), threadIds: params.threadIds.slice(0, 3) }, { label: "Deployment confidence", count: 3, threadIds: params.threadIds.slice(1, 4) }, { label: "Clearer contracts", count: 2, threadIds: params.threadIds.slice(0, 2) }], frictions: [{ label: "Repeated environment setup", description: "Several tasks repeat the same local setup and deployment checks instead of reusing a verified workflow.", threadIds: params.threadIds.slice(0, 3) }, { label: "Late permission decisions", description: "Security boundaries are often settled after implementation has started, creating avoidable rework.", threadIds: params.threadIds.slice(1, 4) }], suggestions: [{ id: "workflow", title: "Create a reusable ship workflow", rationale: "A single verified workflow can remove repeated setup and validation work.", proposedPrompt: "Create a reusable project skill that handles setup, validation, and Cloudflare deployment for this repository. Document its safety boundaries and add a smoke test." }, { id: "contract", title: "Make permission checks executable", rationale: "Contract tests will keep the public provider boundary stable as the runtime changes.", proposedPrompt: "Add a provider conformance suite covering origin isolation, one-use grants, task confirmation, event filtering, and unknown method rejection." }] } satisfies ReflectionResult;
      if (method === "tasks.start") { const task: TaskSnapshot = { id: crypto.randomUUID(), status: "running", title: params.title ?? "Mock Codex task", workspaceLabel: "my-project", createdAt: now, updatedAt: now, lastMessage: "Codex is preparing the workspace…" }; tasks.set(task.id, task); setTimeout(() => emit("task.event", { taskId: task.id, sequence: 1, kind: "agentMessage", text: "I found the existing project structure and am adding the reusable workflow." }), 700); return task; }
      if (method === "tasks.get") { const task = tasks.get(params.taskId); if (!task) throw new CodexError("TASK_NOT_FOUND", "Mock task not found"); return task; }
      if (method === "tasks.send") { const task = tasks.get(params.taskId); if (!task) throw new CodexError("TASK_NOT_FOUND", "Mock task not found"); task.lastMessage = params.message; return task; }
      if (method === "tasks.cancel") { const task = tasks.get(params.taskId); if (!task) throw new CodexError("TASK_NOT_FOUND", "Mock task not found"); task.status = "cancelled"; emit("task.cancelled", { task }); return task; }
      throw new CodexError("UNSUPPORTED_METHOD", `Unsupported mock method: ${method}`);
    },
    on(event, listener) { const current = listeners.get(event) ?? new Set(); current.add(listener); listeners.set(event, current); },
    removeListener(event, listener) { listeners.get(event)?.delete(listener); }
  };
  return provider;
}
