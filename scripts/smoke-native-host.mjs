import { spawn, execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { encodeNativeMessage, NativeMessageDecoder } from "../apps/native-host/dist/codec.js";

const child = spawn(process.execPath, [resolve("apps/native-host/dist/index.js")], {
  env: { ...process.env, WINDOW_CODEX_CODEX_BIN: execFileSync("which", ["codex"], { encoding: "utf8" }).trim() },
  stdio: ["pipe", "pipe", "pipe"]
});
const decoder = new NativeMessageDecoder();
const timeout = setTimeout(() => { child.kill(); console.error("Native bridge smoke test timed out"); process.exitCode = 1; }, 15_000);
child.stderr.on("data", chunk => process.stderr.write(chunk));
child.stdout.on("data", chunk => {
  for (const message of decoder.push(chunk)) {
    if (message?.id === "smoke" && message?.result?.ready) {
      clearTimeout(timeout); console.log("Native bridge reached Codex app-server"); child.kill();
    }
  }
});
child.stdin.write(encodeNativeMessage({ id: "smoke", origin: "https://smoke.window.codex", method: "provider.info", params: {} }));
