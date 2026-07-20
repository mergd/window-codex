import { cpSync, mkdirSync, readFileSync, renameSync, rmSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const assets = resolve("release-assets");
mkdirSync(assets, { recursive: true });
const stage = resolve(assets, "window-codex-bridge");
rmSync(stage, { recursive: true, force: true });
mkdirSync(resolve(stage, "bridge"), { recursive: true });
cpSync(resolve("apps/native-host/dist"), resolve(stage, "bridge"), { recursive: true });
cpSync(resolve("installer/macos/install.command"), resolve(stage, "install.command"));
chmodSync(resolve(stage, "install.command"), 0o755);
execFileSync("zip", ["-qry", "window-codex-bridge-macos.zip", "window-codex-bridge"], { cwd: assets });
rmSync(stage, { recursive: true, force: true });

const npmStage = resolve(assets, "codemask-bridge-package");
const npmPackage = JSON.parse(readFileSync(resolve("installer/npx/package.json"), "utf8"));
rmSync(npmStage, { recursive: true, force: true });
mkdirSync(resolve(npmStage, "bridge"), { recursive: true });
cpSync(resolve("installer/npx/package.json"), resolve(npmStage, "package.json"));
cpSync(resolve("installer/npx/install.mjs"), resolve(npmStage, "install.mjs"));
cpSync(resolve("apps/extension/public/manifest.json"), resolve(npmStage, "manifest.json"));
cpSync(resolve("apps/native-host/dist"), resolve(npmStage, "bridge"), { recursive: true });
chmodSync(resolve(npmStage, "install.mjs"), 0o755);
execFileSync("npm", ["pack", npmStage, "--pack-destination", assets], { stdio: "inherit" });
renameSync(resolve(assets, `codemask-bridge-${npmPackage.version}.tgz`), resolve(assets, "codemask-bridge.tgz"));
rmSync(npmStage, { recursive: true, force: true });
