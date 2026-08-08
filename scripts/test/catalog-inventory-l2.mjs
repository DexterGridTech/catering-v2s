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
const fixture = run([path.join(root, "scripts/test/catalog-inventory-l2-fixture.mjs")]);
if (fixture.status !== 0) { process.stderr.write(fixture.stderr || fixture.stdout); process.exitCode = fixture.status || 1; }
else if (process.argv.includes("--managed")) {
  const joint = spawnSync(process.execPath, [path.join(root, "scripts/test/r5-joint-remote-l2.mjs"), "--catalog-inventory"], {cwd: root, env: process.env, encoding: "utf8", stdio: "inherit"});
  process.exitCode = joint.status ?? 1;
} else {
  process.stdout.write("CATALOG_INVENTORY_L2_FIXTURE=PASS\nMANAGED_RUN_REQUIRED=true\n");
}
