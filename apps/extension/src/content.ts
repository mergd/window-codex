window.addEventListener("message", event => {
  if (event.source !== window || event.data?.type !== "window.codex:request") return;
  const { id, method, params } = event.data;
  void chrome.runtime.sendMessage({ type: "provider.request", id, method, params }).then(
    response => window.postMessage(response?.__error ? { type: "window.codex:response", id, error: response.__error } : { type: "window.codex:response", id, result: response }, "*"),
    error => window.postMessage({ type: "window.codex:response", id, error: error?.code ? error : { code: "RUNTIME_ERROR", message: error?.message ?? String(error) } }, "*")
  );
});

chrome.runtime.onMessage.addListener(message => {
  if (message?.type === "provider.event") window.postMessage({ type: "window.codex:event", event: message.event, payload: message.payload }, "*");
});
