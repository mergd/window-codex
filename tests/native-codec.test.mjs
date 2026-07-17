import test from "node:test";
import assert from "node:assert/strict";
import { encodeNativeMessage, NativeMessageDecoder } from "../apps/native-host/dist/codec.js";

test("native framing handles partial and consecutive frames", () => {
  const first = encodeNativeMessage({ id: "one", value: "hello" });
  const second = encodeNativeMessage({ id: "two", value: "world" });
  const joined = Buffer.concat([first, second]);
  const decoder = new NativeMessageDecoder();
  assert.deepEqual(decoder.push(joined.subarray(0, 7)), []);
  assert.deepEqual(decoder.push(joined.subarray(7)), [{ id: "one", value: "hello" }, { id: "two", value: "world" }]);
});

test("native framing rejects oversized host messages", () => {
  assert.throws(() => encodeNativeMessage({ value: "x".repeat(1024 * 1024) }), /1 MB/);
});
