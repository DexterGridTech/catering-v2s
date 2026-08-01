#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dryRun = process.argv.includes("--dry-run");

function fail(code) { process.stderr.write(`R5_DEV_RESET=REFUSED; REASON=${code}\n`); process.exit(2); }
function databaseFor(namespace) { return `catering_v2s_dev_${namespace.replace(/^v2s-dev-/, "").replaceAll("-", "_")}`; }
function psqlUrl(jdbcUrl) { return jdbcUrl.replace(/^jdbc:/, ""); }
function quotedDatabase(name) { return `"${name.replaceAll('"', '""')}"`; }
function execute(command, args, env = process.env) {
  const result = spawnSync(command, args, {cwd: root, encoding: "utf8", env});
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `R5_DEV_RESET_COMMAND_FAILED:${command}\n`);
    process.exit(result.status || 1);
  }
}

const environment = spawnSync(process.execPath, [path.join(root, "scripts/dev/r5-dev-environment.mjs"), "reset", "--json"], {cwd: root, encoding: "utf8", env: process.env});
if (environment.status !== 0) fail((environment.stderr || environment.stdout || "R5_DEV_ENVIRONMENT_INVALID").trim());
const resolved = JSON.parse(environment.stdout);

const namespace = resolved.namespace;
const targetDatabase = resolved.expectedDatabase;
const adminUrl = resolved.environment.V2S_DEV_DATABASE_ADMIN_URL ?? "";
if (!/^catering_v2s_dev_[a-z0-9_]{3,32}$/.test(targetDatabase) || !adminUrl) fail("R5_DEV_RESET_TARGET_INVALID");
if (dryRun) {
  process.stdout.write(`R5_DEV_RESET_DRY_RUN=PASS; DATABASE=${targetDatabase}; FOLLOW_UP=scripts/dev/start\n`);
  process.exit(0);
}
if (process.env.R5_RESET_CONFIRMATION !== "EXPLICIT_R5_RESET") fail("EXPLICIT_R5_RESET_CONFIRMATION_REQUIRED");

const environmentForPsql = {...process.env, ...resolved.environment};
if (process.env.V2S_DEV_DATABASE_ADMIN_PASSWORD) environmentForPsql.PGPASSWORD = process.env.V2S_DEV_DATABASE_ADMIN_PASSWORD;
execute("psql", [psqlUrl(adminUrl), "-v", "ON_ERROR_STOP=1", "-c", `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${targetDatabase}' AND pid <> pg_backend_pid()`], environmentForPsql);
execute("psql", [psqlUrl(adminUrl), "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS ${quotedDatabase(targetDatabase)}`], environmentForPsql);
execute("psql", [psqlUrl(adminUrl), "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE ${quotedDatabase(targetDatabase)}`], environmentForPsql);
process.stdout.write(`R5_DEV_RESET=PASS; DATABASE=${targetDatabase}; FOLLOW_UP=scripts/dev/start\n`);
