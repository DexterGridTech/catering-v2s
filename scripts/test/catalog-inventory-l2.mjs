#!/usr/bin/env node
/**
 * P3 managed L2 entrypoint. The existing joint runner owns the local app and
 * remote middleware lifecycle; this command only validates the canonical
 * fixture, locator exact-set and invokes Playwright through that managed
 * runner when explicitly requested.
 */
import {spawnSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const run = (args, env = process.env) => spawnSync(process.execPath, args, {cwd: root, env, encoding: "utf8"});

export function parseInvocationArgs(args) {
  if (!Array.isArray(args)) throw new Error("CATALOG_INVENTORY_L2_ARGUMENT_INVALID");
  if (args.length === 0) return {mode: "FIXTURE_ONLY", stage: null};
  if (args.length === 1 && args[0] === "--managed") return {mode: "MANAGED", stage: "L2"};
  if (args.length === 1 && args[0] === "--self-test") return {mode: "SELF_TEST", stage: null};
  throw new Error("CATALOG_INVENTORY_L2_ARGUMENT_INVALID");
}

function main(invocation) {
  if (invocation.mode === "SELF_TEST") {
    const fixtureOnly = parseInvocationArgs([]);
    const managed = parseInvocationArgs(["--managed"]);
    if (fixtureOnly.mode !== "FIXTURE_ONLY" || managed.mode !== "MANAGED" || managed.stage !== "L2") {
      throw new Error("CATALOG_INVENTORY_L2_STAGE_MAPPING_INVALID");
    }
    for (const mutation of [["--catalog-inventory"], ["--managed", "--catalog-l2-only"], ["--unknown"]]) {
      try { parseInvocationArgs(mutation); throw new Error(`CATALOG_INVENTORY_L2_RED_NOT_DETECTED:${mutation.join(",")}`); }
      catch (error) { if (error.message.startsWith("CATALOG_INVENTORY_L2_RED_NOT_DETECTED")) throw error; }
    }
    process.stdout.write("CATALOG_INVENTORY_L2_SELF_TEST=PASS\nRED_UNKNOWN_ARGUMENT=PASS\nRED_STAGE_SUBSTITUTION=PASS\n");
    return;
  }
  const fixture = run([path.join(root, "scripts/test/catalog-inventory-l2-fixture.mjs")]);
  if (fixture.status !== 0) { process.stderr.write(fixture.stderr || fixture.stdout); process.exitCode = fixture.status || 1; return; }
  if (invocation.mode === "MANAGED") {
    const joint = spawnSync(process.execPath, [path.join(root, "scripts/test/r5-joint-remote-l2.mjs"), "--catalog-l2-only"], {cwd: root, env: process.env, encoding: "utf8", stdio: "inherit"});
    process.exitCode = joint.status ?? 1;
    return;
  }
  process.stdout.write("CATALOG_INVENTORY_L2_FIXTURE=PASS\nMANAGED_RUN_REQUIRED=true\n");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try { main(parseInvocationArgs(process.argv.slice(2))); }
  catch (error) { process.stderr.write(`${error?.message ?? "CATALOG_INVENTORY_L2_FAILED"}\n`); process.exitCode = 2; }
}
