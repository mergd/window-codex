#!/usr/bin/env node
import { cp, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

const cli = createInterface({ input: process.stdin, output: process.stdout });
const argument = process.argv[2];
const projectName = argument || await cli.question("Project name: ");
cli.close();
if (!/^[a-z0-9][a-z0-9-_]*$/i.test(projectName)) throw new Error("Use letters, numbers, hyphens, or underscores for the project name");
const target = resolve(process.cwd(), projectName);
if (existsSync(target)) throw new Error(`${target} already exists`);
const template = resolve(dirname(fileURLToPath(import.meta.url)), "../template");
await cp(template, target, { recursive: true });
const packagePath = resolve(target, "package.json");
const packageJson = await readFile(packagePath, "utf8");
await writeFile(packagePath, packageJson.replaceAll("{{PROJECT_NAME}}", projectName));
console.log(`\nCreated ${basename(target)}\n\n  cd ${projectName}\n  npm install\n  npm run dev\n`);
