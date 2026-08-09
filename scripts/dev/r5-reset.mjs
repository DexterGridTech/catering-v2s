#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import {appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {resolveTrustedRemoteHost} from "./r5-remote-host-trust.mjs";
import {canonicalStartToken} from "./managed-process-tree.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR ?? path.join(root, ".runtime/r5"));
const managedDevManifestPath = path.join(runtime, "run-manifest.json");
const resetRoot = path.join(runtime, "reset");
const expectedManifestKind = "r5-dev-run-manifest";

export class ResetFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}

const fail = (code) => { throw new ResetFailure(code); };
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const productionLike = (value) => /(?:^|[._/-])(?:prod|production)(?:$|[._/-])/i.test(value);
const expectedDatabaseFor = (namespace) => `catering_v2s_dev_${namespace.replace(/^v2s-dev-/, "").replaceAll("-", "_")}`;
const pidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const processStartToken = (pid) => canonicalStartToken(spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], {encoding: "utf8"}).stdout);

export function validateResetTopology(resolved) {
  const namespace = resolved?.namespace;
  const targetDatabase = resolved?.expectedDatabase;
  const environment = resolved?.environment;
  if (typeof namespace !== "string" || !/^v2s-dev-[a-z0-9-]{3,32}$/.test(namespace)) fail("NAMESPACE_INVALID");
  if (targetDatabase !== expectedDatabaseFor(namespace) || !/^catering_v2s_dev_[a-z0-9_]{3,32}$/.test(targetDatabase)) fail("TARGET_DATABASE_ALLOWLIST_INVALID");
  let hostTrust;
  try { hostTrust = resolveTrustedRemoteHost(environment); } catch (error) { fail(error.code === "R5_DEV_REMOTE_HOST_PRODUCTION_LIKE" ? "REMOTE_HOST_PRODUCTION_LIKE" : "REMOTE_HOST_BINDING_INVALID"); }
  return {namespace, targetDatabase, host: hostTrust.host, hostTrust};
}

export function verifyRemoteResetTranscript(stdout) {
  const markers = [
    "R5_REMOTE_RESET_TERMINATE=PASS",
    "R5_REMOTE_RESET_DROP=PASS",
    "R5_REMOTE_RESET_READBACK_ABSENT=PASS",
    "R5_REMOTE_RESET_ASSET_CLEANUP=PASS",
  ];
  let cursor = -1;
  for (const marker of markers) {
    const next = stdout.indexOf(marker);
    if (next < 0) fail(marker.includes("READBACK") ? "POST_DROP_READBACK_FAILED" : "REMOTE_EXECUTION_PROTOCOL_INVALID");
    if (next < cursor) fail("REMOTE_EXECUTION_PROTOCOL_INVALID");
    cursor = next;
  }
}

export function runRemoteReset({host, targetDatabase, namespace = `v2s-dev-${targetDatabase.replace(/^catering_v2s_dev_/, "").replaceAll("_", "-")}`, executor = spawnSync}) {
  const script = [
    "set -euo pipefail",
    `database='${targetDatabase}'`,
    "docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -q -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$database' AND pid <> pg_backend_pid()\" >/dev/null",
    "printf '%s\\n' R5_REMOTE_RESET_TERMINATE=PASS",
    "docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -q -c \"DROP DATABASE IF EXISTS \\\"$database\\\"\" >/dev/null",
    "printf '%s\\n' R5_REMOTE_RESET_DROP=PASS",
    "if docker exec catering-postgres psql -U catering -d postgres -Atqc \"SELECT 1 FROM pg_database WHERE datname = '$database'\" | grep -qx 1; then printf '%s\\n' R5_REMOTE_RESET_READBACK_ABSENT=FAIL; exit 42; fi",
    "printf '%s\\n' R5_REMOTE_RESET_READBACK_ABSENT=PASS",
    `namespace=${JSON.stringify(namespace)}`,
    "if ! docker inspect catering-v2s-r5-minio >/dev/null 2>&1; then printf '%s\\n' R5_REMOTE_RESET_ASSET_CLEANUP=FAIL; exit 43; fi",
    "access=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' catering-v2s-r5-minio | sed -n 's/^MINIO_ROOT_USER=//p')",
    "secret=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' catering-v2s-r5-minio | sed -n 's/^MINIO_ROOT_PASSWORD=//p')",
    "prefix=\"catering-v2s/dev/$namespace/\"",
    "docker run --rm --network host -e \"MC_HOST_r5=http://$access:$secret@127.0.0.1:19000\" minio/mc rm --recursive --force \"r5/catering-v2s-r5-assets/$prefix\" >/dev/null 2>&1 || true",
    "asset_present=$(docker run --rm --network host -e \"MC_HOST_r5=http://$access:$secret@127.0.0.1:19000\" minio/mc ls --recursive \"r5/catering-v2s-r5-assets/$prefix\" 2>/dev/null || true)",
    "if [ -n \"$asset_present\" ]; then printf '%s\\n' R5_REMOTE_RESET_ASSET_CLEANUP=FAIL; exit 44; fi",
    "printf '%s\\n' R5_REMOTE_RESET_ASSET_CLEANUP=PASS",
  ].join("\n");
  const result = executor("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", host, "bash", "-s"], {cwd: root, encoding: "utf8", input: script});
  if (result?.error || result?.status !== 0) fail("REMOTE_EXECUTION_FAILED");
  verifyRemoteResetTranscript(result.stdout ?? "");
}

function resolveEnvironment() {
  const result = spawnSync(process.execPath, [path.join(root, "scripts/dev/r5-dev-environment.mjs"), "reset", "--json"], {cwd: root, encoding: "utf8", env: process.env});
  if (result.status !== 0) fail("ENVIRONMENT_PREFLIGHT_FAILED");
  try { return validateResetTopology(JSON.parse(result.stdout)); } catch (error) { if (error instanceof ResetFailure) throw error; fail("ENVIRONMENT_PREFLIGHT_INVALID"); }
}

function createRun(topology) {
  const runId = `r5-reset-${crypto.randomUUID()}`;
  const runDirectory = path.join(resetRoot, runId);
  mkdirSync(runDirectory, {recursive: true, mode: 0o700});
  const manifestPath = path.join(runDirectory, "run-manifest.json");
  const logPath = path.join(runDirectory, "reset-events.jsonl");
  const state = {
    schemaVersion: 1,
    kind: "r5-reset-run-manifest",
    runId,
    createdAtEpochMillis: Date.now(),
    remoteHostSha256: topology.hostTrust.fingerprint,
    expectedDatabase: topology.targetDatabase,
    logPath,
    firstFailure: null,
    lastKnownGood: "RESET_MANIFEST_CREATED",
    brokenBoundary: null,
    managedDevOwnership: "NOT_CHECKED",
    business: "PENDING",
    cleanup: "PENDING",
  };
  const write = () => { writeFileSync(manifestPath, `${JSON.stringify(state, null, 2)}\n`, {mode: 0o600}); chmodSync(manifestPath, 0o600); };
  const event = (stage, status, code) => { appendFileSync(logPath, `${JSON.stringify({timestampEpochMillis: Date.now(), stage, status, ...(code ? {code} : {})})}\n`, {mode: 0o600}); chmodSync(logPath, 0o600); };
  write(); event("RESET_MANIFEST", "PASS");
  return {state, manifestPath, logPath, write, event};
}

function verifyManagedDevOwnership(run) {
  if (!existsSync(managedDevManifestPath)) {
    run.state.managedDevOwnership = "NO_ACTIVE_MANAGED_DEV";
    run.state.lastKnownGood = "NO_ACTIVE_MANAGED_DEV";
    run.write(); run.event("MANAGED_DEV_OWNERSHIP", "PASS", "NO_ACTIVE_MANAGED_DEV");
    return false;
  }
  let manifest;
  try { manifest = JSON.parse(readFileSync(managedDevManifestPath, "utf8")); } catch { fail("MANAGED_DEV_MANIFEST_INVALID"); }
  if (manifest.kind !== expectedManifestKind || !Array.isArray(manifest.processes) || manifest.processes.length === 0) fail("MANAGED_DEV_MANIFEST_INVALID");
  for (const process of manifest.processes) {
    if (!Number.isInteger(process.pid) || typeof process.startToken !== "string") fail("MANAGED_DEV_MANIFEST_INVALID");
    if (pidAlive(process.pid) && processStartToken(process.pid) !== process.startToken) fail("MANAGED_DEV_PROCESS_IDENTITY_MISMATCH");
  }
  run.state.managedDevOwnership = "PASS_RUNNER_MANIFEST";
  run.state.managedDevManifestPath = managedDevManifestPath;
  run.state.lastKnownGood = "MANAGED_DEV_OWNERSHIP_VERIFIED";
  run.write(); run.event("MANAGED_DEV_OWNERSHIP", "PASS", "RUNNER_MANIFEST");
  return true;
}

function stopOwnedManagedDev(run) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts/dev/r5-dev-runner.mjs"), "stop"], {cwd: root, encoding: "utf8", env: process.env});
  if (result.status !== 0 || !result.stdout.includes("R5_DEV_STOP=PASS")) fail("MANAGED_DEV_STOP_FAILED");
  run.state.lastKnownGood = "MANAGED_DEV_STOPPED_BY_OWNING_RUNNER";
  run.write(); run.event("MANAGED_DEV_STOP", "PASS", "OWNING_RUNNER_MANIFEST");
}

function recordFailure(run, stage, error) {
  const code = error instanceof ResetFailure ? error.code : "UNEXPECTED_RESET_FAILURE";
  run.state.firstFailure ??= {stage, code};
  run.state.brokenBoundary ??= stage;
  run.state.business = "FAIL";
  run.state.cleanup = "PASS_NO_PERSISTENT_RESET_PROCESS";
  run.write(); run.event(stage, "FAIL", code);
  process.stderr.write(`R5_DEV_RESET=FAIL; REASON=${code}; RUN_MANIFEST=${run.manifestPath}; LOG=${run.logPath}\n`);
}

export function selfTest() {
  const valid = {namespace: "v2s-dev-reset-test", expectedDatabase: "catering_v2s_dev_reset_test", environment: {V2S_DEV_REMOTE_HOST: "catering-remote-dev"}};
  const expect = (code, callback) => {
    try { callback(); throw new Error(`SELF_TEST_RED_NOT_DETECTED:${code}`); }
    catch (error) { if (!(error instanceof ResetFailure) || error.code !== code) throw error; }
  };
  validateResetTopology(valid);
  expect("REMOTE_HOST_BINDING_INVALID", () => validateResetTopology({...valid, environment: {...valid.environment, V2S_DEV_REMOTE_HOST_SHA256: "0".repeat(64)}}));
  expect("REMOTE_HOST_PRODUCTION_LIKE", () => validateResetTopology({...valid, environment: {...valid.environment, V2S_DEV_REMOTE_HOST: "postgres-prod.internal", V2S_DEV_REMOTE_HOST_SHA256: sha256("postgres-prod.internal")}}));
  expect("TARGET_DATABASE_ALLOWLIST_INVALID", () => validateResetTopology({...valid, expectedDatabase: "postgres"}));
  expect("REMOTE_EXECUTION_FAILED", () => runRemoteReset({host: valid.environment.V2S_DEV_REMOTE_HOST, targetDatabase: valid.expectedDatabase, executor: () => ({status: 255, stdout: "", stderr: "redacted"})}));
  expect("POST_DROP_READBACK_FAILED", () => runRemoteReset({host: valid.environment.V2S_DEV_REMOTE_HOST, targetDatabase: valid.expectedDatabase, executor: () => ({status: 0, stdout: "R5_REMOTE_RESET_TERMINATE=PASS\\nR5_REMOTE_RESET_DROP=PASS\\nR5_REMOTE_RESET_READBACK_ABSENT=FAIL\\n"})}));
  process.stdout.write("R5_DEV_RESET_SELF_TEST=PASS\nRED_HOST_HASH=PASS\nRED_PRODUCTION_HOST=PASS\nRED_ILLEGAL_DATABASE=PASS\nRED_REMOTE_EXECUTION=PASS\nRED_POST_DROP_READBACK=PASS\nCLEANUP=PASS\n");
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const topology = resolveEnvironment();
  if (process.argv.includes("--dry-run")) {
    process.stdout.write(`R5_DEV_RESET_DRY_RUN=PASS; DATABASE=${topology.targetDatabase}; MANAGEMENT=REMOTE_SSH_EXEC; FOLLOW_UP=scripts/dev/start\n`);
    return;
  }
  if (process.env.R5_RESET_CONFIRMATION !== "EXPLICIT_R5_RESET") fail("EXPLICIT_R5_RESET_CONFIRMATION_REQUIRED");
  const run = createRun(topology);
  try {
    if (verifyManagedDevOwnership(run)) stopOwnedManagedDev(run);
    runRemoteReset({...topology, namespace: topology.namespace});
    run.state.lastKnownGood = "REMOTE_DATABASE_ABSENT_READBACK";
    run.state.business = "PASS_DATABASE_ABSENT_READBACK";
    run.state.cleanup = "PASS_NO_PERSISTENT_RESET_PROCESS";
    run.write(); run.event("REMOTE_DATABASE_READBACK", "PASS", "ABSENT");
    process.stdout.write(`R5_DEV_RESET=PASS; DATABASE=${topology.targetDatabase}; RUN_MANIFEST=${run.manifestPath}; LOG=${run.logPath}; FOLLOW_UP=scripts/dev/start\n`);
  } catch (error) { recordFailure(run, "RESET_EXECUTION", error); process.exitCode = 2; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { const code = error instanceof ResetFailure ? error.code : "UNEXPECTED_RESET_FAILURE"; process.stderr.write(`R5_DEV_RESET=REFUSED; REASON=${code}\n`); process.exitCode = 2; }
}
