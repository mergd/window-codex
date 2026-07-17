import test from "node:test";
import assert from "node:assert/strict";
import { CodexError, PROTOCOL_VERSION, createMockCodexProvider, isCodexError } from "../packages/sdk/dist/index.js";

test("exports protocol 0.1 and stable errors", () => {
  assert.equal(PROTOCOL_VERSION, "0.1");
  const error = new CodexError("PERMISSION_REQUIRED", "metadata required");
  assert.equal(isCodexError(error), true);
  assert.equal(error.code, "PERMISSION_REQUIRED");
});

test("mock provider runs the reference flow", async () => {
  Object.defineProperty(globalThis, "location", { value: { origin: "https://example.test" }, configurable: true });
  const provider = createMockCodexProvider();
  const connected = await provider.request({ method: "connect", params: { protocolVersion: "0.1", scopes: ["threads:metadata"] } });
  assert.equal(connected.connected, true);
  const listed = await provider.request({ method: "threads.list", params: { limit: 3 } });
  assert.equal(listed.data.length, 3);
  const reflection = await provider.request({ method: "threads.analyze", params: { recipe: "reflection.v1", threadIds: listed.data.map(thread => thread.id) } });
  assert.equal(reflection.coverage.analyzedThreads, 3);
  assert.ok(reflection.suggestions[0].proposedPrompt.length > 20);
});
