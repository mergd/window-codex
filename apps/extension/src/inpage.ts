import type { CodexEvent, CodexListener, CodexMethod, CodexMethodParams, CodexMethodResults, CodexProvider } from "@window-codex/sdk";

const PROTOCOL_VERSION = "0.1" as const;
class ProviderError extends Error {
  constructor(public readonly code: string, message: string, public readonly data?: unknown) { super(message); this.name = "CodexError"; }
}

const REQUEST = "window.codex:request";
const RESPONSE = "window.codex:response";
const EVENT = "window.codex:event";
const listeners = new Map<string, Set<(payload: never) => void>>();
let nextId = 1;

const provider: CodexProvider = Object.freeze({
  protocolVersion: PROTOCOL_VERSION,
  request<M extends CodexMethod>({ method, params }: { method: M; params: CodexMethodParams[M] }, options?: { signal?: AbortSignal }) {
    const id = `${Date.now()}:${nextId++}`;
    return new Promise<CodexMethodResults[M]>((resolve, reject) => {
      const abort = () => { cleanup(); reject(new ProviderError("USER_CANCELLED", "Request cancelled")); };
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new ProviderError("RUNTIME_UNAVAILABLE", "Codemask stopped responding. Reload this page and try again."));
      }, 60_000);
      const receive = (event: MessageEvent) => {
        if (event.source !== window || event.data?.type !== RESPONSE || event.data.id !== id) return;
        cleanup();
        if (event.data.error) reject(new ProviderError(event.data.error.code, event.data.error.message, event.data.error.data));
        else resolve(event.data.result);
      };
      const cleanup = () => { clearTimeout(timeout); window.removeEventListener("message", receive); options?.signal?.removeEventListener("abort", abort); };
      if (options?.signal?.aborted) return abort();
      options?.signal?.addEventListener("abort", abort, { once: true });
      window.addEventListener("message", receive);
      window.postMessage({ type: REQUEST, id, method, params }, "*");
    });
  },
  on<E extends CodexEvent>(event: E, listener: CodexListener<E>) {
    const current = listeners.get(event) ?? new Set(); current.add(listener as (payload: never) => void); listeners.set(event, current);
  },
  removeListener<E extends CodexEvent>(event: E, listener: CodexListener<E>) { listeners.get(event)?.delete(listener as (payload: never) => void); }
});

window.addEventListener("message", event => {
  if (event.source !== window || event.data?.type !== EVENT) return;
  listeners.get(event.data.event)?.forEach(listener => (listener as (payload: unknown) => void)(event.data.payload));
});

Object.defineProperty(window, "codex", { value: provider, configurable: true, enumerable: false, writable: false });
window.dispatchEvent(new Event("codex#initialized"));
