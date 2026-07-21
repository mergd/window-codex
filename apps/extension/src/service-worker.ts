import { PROTOCOL_VERSION, type CodexMethod, type Grant, type PermissionScope } from "@window-codex/sdk";

const METHODS: CodexMethod[] = ["provider.info", "capabilities.list", "connect", "disconnect", "permissions.get", "permissions.request", "permissions.revoke", "workspace.select", "threads.list", "threads.analyze", "tasks.start", "tasks.get", "tasks.send", "tasks.cancel"];
const APPROVALS = new Set<CodexMethod>(["connect", "permissions.request", "workspace.select", "threads.analyze", "tasks.start", "tasks.send"]);
type ApprovalResult = { allowed: boolean; result?: unknown };
type Pending = { id: string; origin: string; method: string; params: unknown; tabId: number; resolve: (result: ApprovalResult) => void; createdAt: number };
type SiteAction = { method: string; label: string; at: number };
type SiteActivity = { origin: string; scopes: PermissionScope[]; actionCount: number; inputTokens: number; outputTokens: number; totalTokens: number; connectedAt: number; lastActiveAt: number; recentActions: SiteAction[] };
type TaskUsage = { origin: string; inputTokens: number; outputTokens: number; totalTokens: number };
const pending = new Map<string, Pending>();
const nativeRequests = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
let nativePort: chrome.runtime.Port | null = null;
let approvalWindowId: number | undefined;
let activityWrite: Promise<void> = Promise.resolve();

const ACTION_LABELS: Record<string, string> = {
  connect: "Connected to Codex",
  disconnect: "Disconnected",
  "permissions.request": "Granted additional access",
  "permissions.revoke": "Changed app access",
  "workspace.select": "Selected a project",
  "threads.list": "Viewed Codex history",
  "threads.analyze": "Analyzed selected tasks",
  "tasks.start": "Started a Codex task",
  "tasks.send": "Sent a task follow-up",
  "tasks.cancel": "Cancelled a Codex task",
};

async function openApprovalWindow() {
  if (approvalWindowId !== undefined) {
    try { await chrome.windows.update(approvalWindowId, { focused: true, drawAttention: true }); return; }
    catch { approvalWindowId = undefined; }
  }
  const current = await chrome.windows.getLastFocused();
  const width = 388;
  const height = 650;
  const created = await chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "popup",
    focused: true,
    width,
    height,
    left: typeof current.left === "number" && typeof current.width === "number" ? Math.max(0, current.left + current.width - width - 16) : undefined,
    top: typeof current.top === "number" ? current.top + 56 : undefined,
  });
  approvalWindowId = created?.id;
}

chrome.action.onClicked.addListener(() => { void openApprovalWindow(); });
chrome.windows.onRemoved.addListener(windowId => { if (windowId === approvalWindowId) approvalWindowId = undefined; });
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") void chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
});

function error(code: string, message: string, retryable = false) { return { code, message, data: { retryable } }; }
function exactOrigin(sender: chrome.runtime.MessageSender) { if (!sender.tab?.url) throw error("PERMISSION_DENIED", "Requests require a top-level web tab"); return new URL(sender.tab.url).origin; }
async function grantsFor(origin: string): Promise<Grant[]> { const stored = await chrome.storage.local.get("grants"); const byOrigin = (stored.grants ?? {}) as Record<string, Grant[]>; return byOrigin[origin] ?? []; }
async function storeGrants(origin: string, grants: Grant[]) { const stored = await chrome.storage.local.get("grants"); const byOrigin = (stored.grants ?? {}) as Record<string, Grant[]>; await chrome.storage.local.set({ grants: { ...byOrigin, [origin]: grants } }); await broadcast("permissions.changed", { grants }); }
function hasScope(grants: Grant[], scope: PermissionScope) { return grants.some(grant => grant.scopes.includes(scope)); }
function requiredScope(method: CodexMethod): PermissionScope | null { if (method === "threads.list") return "threads:metadata"; if (method === "threads.analyze") return "threads:analyze"; if (method === "tasks.start") return "tasks:create"; if (["tasks.get", "tasks.send", "tasks.cancel"].includes(method)) return "tasks:control"; return null; }

function queueActivity(work: () => Promise<void>) { activityWrite = activityWrite.then(work, work); return activityWrite; }
function recordActivity(origin: string, method: string, params: any) {
  const label = ACTION_LABELS[method]; if (!label) return Promise.resolve();
  return queueActivity(async () => {
    const stored = await chrome.storage.local.get("siteActivity");
    const sites = (stored.siteActivity ?? {}) as Record<string, SiteActivity>;
    const now = Math.floor(Date.now() / 1000);
    const current = sites[origin] ?? { origin, scopes: [], actionCount: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, connectedAt: now, lastActiveAt: now, recentActions: [] };
    const requestedScopes = Array.isArray(params?.scopes) ? params.scopes as PermissionScope[] : [];
    sites[origin] = { ...current, scopes: [...new Set([...current.scopes, ...requestedScopes])], actionCount: current.actionCount + 1, lastActiveAt: now, recentActions: [{ method, label, at: now }, ...current.recentActions].slice(0, 8) };
    await chrome.storage.local.set({ siteActivity: sites });
  });
}

function recordUsage(payload: TaskUsage & { taskId: string }) {
  return queueActivity(async () => {
    const stored = await chrome.storage.local.get(["siteActivity", "taskUsage"]);
    const sites = (stored.siteActivity ?? {}) as Record<string, SiteActivity>;
    const tasks = (stored.taskUsage ?? {}) as Record<string, TaskUsage>;
    const previous = tasks[payload.taskId] ?? { origin: payload.origin, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    const now = Math.floor(Date.now() / 1000);
    const current = sites[payload.origin] ?? { origin: payload.origin, scopes: [], actionCount: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, connectedAt: now, lastActiveAt: now, recentActions: [] };
    sites[payload.origin] = { ...current, inputTokens: current.inputTokens + Math.max(0, payload.inputTokens - previous.inputTokens), outputTokens: current.outputTokens + Math.max(0, payload.outputTokens - previous.outputTokens), totalTokens: current.totalTokens + Math.max(0, payload.totalTokens - previous.totalTokens), lastActiveAt: now };
    tasks[payload.taskId] = { origin: payload.origin, inputTokens: payload.inputTokens, outputTokens: payload.outputTokens, totalTokens: payload.totalTokens };
    await chrome.storage.local.set({ siteActivity: sites, taskUsage: tasks });
  });
}

async function listActivity() {
  await activityWrite;
  const stored = await chrome.storage.local.get(["siteActivity", "grants"]);
  const sites = { ...((stored.siteActivity ?? {}) as Record<string, SiteActivity>) };
  const grants = (stored.grants ?? {}) as Record<string, Grant[]>;
  for (const [origin, originGrants] of Object.entries(grants)) {
    if (!originGrants.length) continue;
    const createdAt = Math.min(...originGrants.map(grant => grant.createdAt));
    const current = sites[origin] ?? { origin, scopes: [], actionCount: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, connectedAt: createdAt, lastActiveAt: createdAt, recentActions: [] };
    sites[origin] = { ...current, scopes: [...new Set([...current.scopes, ...originGrants.flatMap(grant => grant.scopes)])] };
  }
  return Object.values(sites).map(site => ({ ...site, connected: Boolean(grants[site.origin]?.length) })).sort((a, b) => b.lastActiveAt - a.lastActiveAt);
}

async function approve(origin: string, method: string, params: unknown, tabId: number) {
  const id = crypto.randomUUID();
  const response = await new Promise<ApprovalResult>(resolve => { pending.set(id, { id, origin, method, params, tabId, resolve, createdAt: Date.now() }); void openApprovalWindow(); });
  pending.delete(id);
  if (!response.allowed) throw error("USER_CANCELLED", "The user rejected this request");
  return response.result;
}

function getNativePort() {
  if (nativePort) return nativePort;
  nativePort = chrome.runtime.connectNative("com.window.codex");
  nativePort.onMessage.addListener(message => {
    if (message.type === "event") { if (message.event === "internal.usage") void recordUsage(message.payload); else void broadcast(message.event, message.payload); return; }
    if (message.type === "approval") {
      void chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(tabs => {
        const tabId = tabs[0]?.id;
        if (!tabId) { nativePort?.postMessage({ type: "approval.resolve", id: message.id, decision: "decline" }); return; }
        return approve("Codex runtime", "runtime.approval", { runtimeMethod: message.method, ...message.params }, tabId).then(
          result => nativePort?.postMessage(result ? { type: "approval.resolve", id: message.id, result } : { type: "approval.resolve", id: message.id, decision: "accept" }),
          () => nativePort?.postMessage({ type: "approval.resolve", id: message.id, decision: "decline" })
        );
      });
      return;
    }
    const request = nativeRequests.get(message.id); if (!request) return; nativeRequests.delete(message.id);
    if (message.error) request.reject(Object.assign(new Error(message.error.message), message.error)); else request.resolve(message.result);
  });
  nativePort.onDisconnect.addListener(() => { const message = chrome.runtime.lastError?.message ?? "Native host disconnected"; nativePort = null; nativeRequests.forEach(request => request.reject(Object.assign(new Error(message), error("RUNTIME_UNAVAILABLE", message, true)))); nativeRequests.clear(); void broadcast("provider.disconnected", { reason: message }); });
  return nativePort;
}

function callNative(origin: string, method: CodexMethod, params: unknown) { const id = crypto.randomUUID(); return new Promise((resolve, reject) => { nativeRequests.set(id, { resolve, reject }); try { getNativePort().postMessage({ id, origin, method, params }); } catch (cause) { nativeRequests.delete(id); reject(Object.assign(new Error(String(cause)), error("RUNTIME_UNAVAILABLE", "Could not reach the local Codex bridge", true))); } }); }
async function broadcast(event: string, payload: unknown) { for (const tab of await chrome.tabs.query({})) if (tab.id) void chrome.tabs.sendMessage(tab.id, { type: "provider.event", event, payload }).catch(() => undefined); }

async function handleProvider(message: { method: CodexMethod; params: any }, sender: chrome.runtime.MessageSender) {
  if (!METHODS.includes(message.method)) throw error("UNSUPPORTED_METHOD", `Unsupported method: ${String(message.method)}`);
  const origin = exactOrigin(sender); const tabId = sender.tab!.id!; const current = await grantsFor(origin);
  if (message.method === "provider.info") return { name: "Codemask", protocolVersion: PROTOCOL_VERSION, providerVersion: chrome.runtime.getManifest().version, connected: current.length > 0 };
  if (message.method === "capabilities.list") return { methods: METHODS, recipes: ["reflection.v1"] };
  if (message.method === "permissions.get") return { grants: current };
  if (message.method === "disconnect") { await storeGrants(origin, []); await broadcast("provider.disconnected", { reason: "Disconnected by site" }); return { disconnected: true }; }
  if (message.method === "permissions.revoke") { const next = message.params.grantId ? current.filter(grant => grant.id !== message.params.grantId) : []; await storeGrants(origin, next); return { revoked: true }; }
  if (message.method === "connect") {
    if (message.params.protocolVersion !== PROTOCOL_VERSION) throw error("UNSUPPORTED_VERSION", "This provider supports protocol 0.1");
    await approve(origin, message.method, message.params, tabId);
    const scopes = [...new Set(message.params.scopes)] as PermissionScope[];
    const grant: Grant = { id: crypto.randomUUID(), origin, scopes, persistence: "persistent", createdAt: Math.floor(Date.now() / 1000) };
    const grants = [...current, grant]; await storeGrants(origin, grants); await broadcast("provider.connected", { origin }); return { connected: true, grants };
  }
  if (message.method === "permissions.request") {
    await approve(origin, message.method, message.params, tabId);
    const grant: Grant = { id: crypto.randomUUID(), origin, scopes: message.params.scopes, persistence: message.params.persistence, createdAt: Math.floor(Date.now() / 1000) };
    await storeGrants(origin, [...current, grant]); return { grant };
  }
  const scope = requiredScope(message.method);
  if (scope && !hasScope(current, scope) && !APPROVALS.has(message.method)) throw error("PERMISSION_REQUIRED", `${scope} is required`);
  if (APPROVALS.has(message.method)) await approve(origin, message.method, message.params, tabId);
  if (message.method === "threads.analyze") {
    if (!Array.isArray(message.params.threadIds) || message.params.threadIds.length < 1) throw error("INVALID_SELECTOR", "Select at least one thread");
  }
  return callNative(origin, message.method, message.params);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "provider.request") { handleProvider(message, sender).then(async value => { const origin = exactOrigin(sender); await recordActivity(origin, message.method, message.params); sendResponse(value); }, reason => sendResponse({ __error: { code: reason.code ?? "RUNTIME_ERROR", message: reason.message ?? String(reason), data: reason.data } })); return true; }
  if (message?.type === "ui.pending.list") { sendResponse([...pending.values()].map(({ resolve, ...item }) => item)); return false; }
  if (message?.type === "ui.activity.list") { listActivity().then(sendResponse); return true; }
  if (message?.type === "ui.pending.resolve") { pending.get(message.id)?.resolve({ allowed: Boolean(message.allowed), result: message.result }); sendResponse({ ok: true }); return false; }
  if (message?.type === "ui.runtime.check") { callNative("chrome-extension://self", "provider.info", {}).then(value => sendResponse({ ok: true, value }), reason => sendResponse({ ok: false, message: reason.message })); return true; }
  if (message?.type === "ui.onboarding.open") { void chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") }); sendResponse({ ok: true }); return false; }
  if (message?.type === "ui.sidepanel.open") { void chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([tab]) => tab?.id ? chrome.sidePanel.open({ tabId: tab.id }) : undefined); sendResponse({ ok: true }); return false; }
  return false;
});
