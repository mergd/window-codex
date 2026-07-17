import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const destination = resolve("release-assets");
rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });

for (const packagePath of ["./packages/sdk", "./packages/create-window-codex"]) {
  execFileSync("npm", ["pack", packagePath, "--pack-destination", destination], {
    stdio: "inherit",
  });
}
