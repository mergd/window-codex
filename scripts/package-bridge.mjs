import { cpSync, mkdirSync, rmSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const assets = resolve("release-assets");
const stage = resolve(assets, "window-codex-bridge");
rmSync(stage, { recursive: true, force: true });
mkdirSync(resolve(stage, "bridge"), { recursive: true });
cpSync(resolve("apps/native-host/dist"), resolve(stage, "bridge"), { recursive: true });
cpSync(resolve("installer/macos/install.command"), resolve(stage, "install.command"));
chmodSync(resolve(stage, "install.command"), 0o755);
execFileSync("zip", ["-qry", "window-codex-bridge-macos.zip", "window-codex-bridge"], { cwd: assets });
rmSync(stage, { recursive: true, force: true });
