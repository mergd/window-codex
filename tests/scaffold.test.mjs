import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

test("create-window-codex produces the opinionated starter", async () => {
  const cwd = await mkdtemp(resolve(tmpdir(), "create-window-codex-"));
  execFileSync(process.execPath, [resolve("packages/create-window-codex/dist/index.js"), "demo-integration"], { cwd });
  const root = resolve(cwd, "demo-integration");
  const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  assert.equal(pkg.name, "demo-integration");
  assert.equal(pkg.dependencies["@tanstack/react-query"].startsWith("^"), true);
  assert.equal(pkg.dependencies["@base-ui/react"].startsWith("^"), true);
  await stat(resolve(root, "src/main.tsx"));
  await stat(resolve(root, "wrangler.jsonc"));
});
