#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin" && process.env.CODEMASK_ALLOW_TEST_PLATFORM !== "1") {
  console.error("Codemask currently supports macOS only.");
  process.exit(1);
}

const packageRoot = dirname(fileURLToPath(import.meta.url));
const installHome = process.env.CODEMASK_INSTALL_HOME || homedir();
const manifest = JSON.parse(readFileSync(resolve(packageRoot, "manifest.json"), "utf8"));
const key = Buffer.from(manifest.key, "base64");
const extensionId = [...createHash("sha256").update(key).digest().subarray(0, 16)]
  .map(byte => `${String.fromCharCode(97 + (byte >> 4))}${String.fromCharCode(97 + (byte & 15))}`)
  .join("");
const codex = execFileSync("which", ["codex"], { encoding: "utf8" }).trim();
const support = resolve(installHome, ".codemask");
const bridge = resolve(support, "bridge");
const launcher = resolve(support, "native-host.sh");
const chromeDir = process.env.CODEMASK_CHROME_DIR || resolve(installHome, "Library/Application Support/Google/Chrome/NativeMessagingHosts");
const workspace = process.env.CODEMASK_DEFAULT_WORKSPACE || process.cwd();

mkdirSync(support, { recursive: true });
mkdirSync(chromeDir, { recursive: true });
cpSync(resolve(packageRoot, "bridge"), bridge, { recursive: true, force: true });
writeFileSync(launcher, `#!/bin/sh\nexport WINDOW_CODEX_CODEX_BIN=${JSON.stringify(codex)}\nexport WINDOW_CODEX_DEFAULT_WORKSPACE=${JSON.stringify(workspace)}\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(resolve(bridge, "index.js"))}\n`);
chmodSync(launcher, 0o755);
writeFileSync(resolve(chromeDir, "com.window.codex.json"), JSON.stringify({
  name: "com.window.codex",
  description: "Local Codex bridge for Codemask",
  path: launcher,
  type: "stdio",
  allowed_origins: [`chrome-extension://${extensionId}/`],
}, null, 2));

console.log(`\nCodemask bridge installed.\n\n  Codex:      ${codex}\n  Workspace:  ${workspace}\n  Extension:  ${extensionId}\n\nReload Codemask from chrome://extensions, then return to the setup screen.\n`);
