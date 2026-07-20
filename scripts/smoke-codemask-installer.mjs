import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const fixture = mkdtempSync(resolve(tmpdir(), "codemask-installer-"));
const chromeDir = resolve(fixture, "chrome-hosts");
const archive = "./release-assets/codemask-bridge.tgz";

try {
  execFileSync("npx", ["--yes", archive], {
    env: {
      ...process.env,
      CODEMASK_ALLOW_TEST_PLATFORM: "1",
      CODEMASK_INSTALL_HOME: fixture,
      CODEMASK_CHROME_DIR: chromeDir,
      CODEMASK_DEFAULT_WORKSPACE: resolve(fixture, "workspace"),
    },
    stdio: "pipe",
  });
  const launcher = resolve(fixture, ".codemask/native-host.sh");
  const manifestPath = resolve(chromeDir, "com.window.codex.json");
  if (!existsSync(launcher) || !existsSync(resolve(fixture, ".codemask/bridge/index.js")) || !existsSync(manifestPath)) throw new Error("Installer output is incomplete");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.allowed_origins?.[0] !== "chrome-extension://ofkaofkclbhlbgfbmfnpdihgpcpofjkg/") throw new Error("Installer registered the wrong extension ID");
  console.log("Codemask npx installer smoke test passed");
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
