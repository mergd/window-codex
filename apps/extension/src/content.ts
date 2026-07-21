window.addEventListener("message", event => {
  if (event.source !== window || event.data?.type !== "window.codex:request") return;
  const { id, method, params } = event.data;
  const reject = (reason: unknown) => {
    const error = reason && typeof reason === "object" && "code" in reason
      ? reason
      : { code: "RUNTIME_UNAVAILABLE", message: reason instanceof Error ? reason.message : String(reason) };
    window.postMessage({ type: "window.codex:response", id, error }, "*");
  };
  try {
    void chrome.runtime.sendMessage({ type: "provider.request", id, method, params }).then(
      response => window.postMessage(response?.__error ? { type: "window.codex:response", id, error: response.__error } : { type: "window.codex:response", id, result: response }, "*"),
      reject,
    );
  } catch (error) {
    reject(error);
  }
});

chrome.runtime.onMessage.addListener(message => {
  if (message?.type === "provider.event") window.postMessage({ type: "window.codex:event", event: message.event, payload: message.payload }, "*");
});
