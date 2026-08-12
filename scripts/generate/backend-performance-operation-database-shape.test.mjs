#!/usr/bin/env node
import {spawnSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts/generate/backend-performance-operation-database-shape.mjs");
const result = spawnSync(process.execPath, [script, "--self-test"], {cwd: root, encoding: "utf8"});
if (result.status !== 0) {
  process.stderr.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  process.exit(result.status || 1);
}
if (!result.stdout.includes("BP_U01_DATABASE_SHAPE_SELF_TEST=PASS") || !result.stdout.includes("RED_MISSING_ROW=PASS") || !result.stdout.includes("RED_SOURCE_REF=PASS") || !result.stdout.includes("RED_FOLD_PROOF=PASS") || !result.stdout.includes("RED_BUDGET_FORMULA=PASS")) {
  throw new Error("BP_U01_DATABASE_SHAPE_TEST_OUTPUT_INVALID");
}
process.stdout.write("BP_U01_DATABASE_SHAPE_GENERATOR_TEST=PASS\n");
