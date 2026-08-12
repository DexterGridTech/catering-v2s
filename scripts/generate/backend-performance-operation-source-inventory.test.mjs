#!/usr/bin/env node
import childProcess from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const result = childProcess.spawnSync(process.execPath, ["scripts/generate/backend-performance-operation-source-inventory.mjs", "--self-test"], {cwd: root, encoding: "utf8"});
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
process.exitCode = result.status === null ? 1 : result.status;

