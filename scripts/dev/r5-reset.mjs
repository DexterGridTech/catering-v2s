#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import {appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {resolveTrustedRemoteHost} from "./r5-remote-host-trust.mjs";
import {canonicalStartToken} from "./managed-process-tree.mjs";
import {readResidentManifest, renderResidentTruncateScript} from "./r5-doris-resident.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR ?? path.join(root, ".runtime/r5"));
const managedDevManifestPath = path.join(runtime, "run-manifest.json");
const dorisResidentManifestPath = path.join(runtime, "doris-resident-manifest.json");
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

function childFirstFailure(result) {
  const text = `${result?.stderr ?? ""}\n${result?.stdout ?? ""}`;
  return text.match(/(?:REASON|FIRST_FAILURE)=([A-Z0-9_:-]+)/)?.[1] ?? `EXIT_${result?.status ?? "UNKNOWN"}`;
}

export function assertSeedDryRunPass({executor = spawnSync} = {}) {
  const result = executor(process.execPath, [path.join(root, "scripts/dev/r5-complete-seed-executor.mjs"), "--dry-run"], {cwd: root, encoding: "utf8", env: process.env});
  if (result?.error || result?.status !== 0 || !String(result?.stdout ?? "").includes("R5_COMPLETE_SEED_DRY_RUN=PASS")) {
    fail(`SEED_DRY_RUN_REQUIRED_BEFORE_RESET:${childFirstFailure(result)}`);
  }
  return Object.freeze({status: "PASS", outputDigest: sha256(result.stdout ?? "")});
}

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
    "R5_REMOTE_RESET_DORIS_TRUNCATE=PASS",
    "R5_REMOTE_RESET_DORIS_READBACK=0",
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

export function runRemoteReset({host, fingerprint, residentDoris, targetDatabase, namespace = `v2s-dev-${targetDatabase.replace(/^catering_v2s_dev_/, "").replaceAll("_", "-")}`, executor = spawnSync}) {
  if (!residentDoris) fail("DORIS_RESIDENT_MANIFEST_REQUIRED_BEFORE_RESET");
  if (residentDoris.host !== host || residentDoris.hostFingerprint !== fingerprint) fail("DORIS_RESIDENT_HOST_BINDING_INVALID");
  const dorisResetScript = renderResidentTruncateScript(residentDoris);
  const script = [
    dorisResetScript,
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
  const output = String(result?.stdout ?? "");
  if (result?.error || result?.status !== 0) {
    if (output.includes("R5_REMOTE_RESET_READBACK_ABSENT=PASS")) {
      const error = new ResetFailure("ASSET_CLEANUP_FAILED_AFTER_POSTGRES_RESET");
      error.postgresResetCompleted = true;
      error.dorisHistoryCleared = true;
      throw error;
    }
    if (output.includes("R5_REMOTE_RESET_DORIS_TRUNCATE=PASS") && output.includes("R5_REMOTE_RESET_DORIS_READBACK=0")) {
      const error = new ResetFailure("POSTGRES_RESET_FAILED_AFTER_DORIS_CLEAR");
      error.dorisHistoryCleared = true;
      throw error;
    }
    if (output.includes("R5_REMOTE_RESET_DORIS_TRUNCATE=PASS")) fail("DORIS_RESET_READBACK_OR_IDENTITY_FAILED");
    fail("REMOTE_EXECUTION_FAILED");
  }
  verifyRemoteResetTranscript(output);
  return Object.freeze({dorisTruncate: "PASS", dorisReadback: "0", postgresReset: "PASS", transcript: output});
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
    dorisHistory: "NOT_RUN",
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
  run.state.business = error?.dorisHistoryCleared ? "PARTIAL_RESET_DORIS_CLEARED" : "FAIL";
  if (error?.postgresResetCompleted) run.state.business = "POSTGRES_RESET_PASS_ASSET_CLEANUP_FAIL";
  run.state.dorisHistory = error?.dorisHistoryCleared ? "CLEARED_READBACK_ZERO" : run.state.dorisHistory;
  const devWasOwned = run.state.managedDevOwnership === "PASS_RUNNER_MANIFEST";
  const devStopPassed = run.state.lastKnownGood === "MANAGED_DEV_STOPPED_BY_OWNING_RUNNER";
  run.state.cleanup = devWasOwned && !devStopPassed
    ? "FAIL_MANAGED_DEV_STOP_NOT_VERIFIED"
    : "PASS_DORIS_RESIDENT_RETAINED_DEV_STOPPED";
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
  const residentDoris = {
    schemaVersion: 1, kind: "r5-managed-doris-resident", host: "catering-remote-dev", hostFingerprint: sha256("catering-remote-dev"),
    bootId: "01234567-89ab-cdef-0123-456789abcdef", containerName: "catering-v2s-r5-doris-resident", containerId: "a".repeat(64),
    imageRef: "apache/doris:all-in-one-4.1.3", imageId: "sha256:82a5cabc7900ebcd3d080412d636c0cebd6602799fffe2605c652b2ea7d42609",
    repoDigest: "apache/doris@sha256:82a5cabc7900ebcd3d080412d636c0cebd6602799fffe2605c652b2ea7d42609", feVolumeId: "b".repeat(64), beVolumeId: "c".repeat(64),
    endpoint: "http://127.0.0.1:8040", database: "terminal_connection_history", table: "connection_history", username: "tds_history_writer",
    health: "healthy", ports: {mysql: "127.0.0.1:9030", http: "127.0.0.1:8030", load: "127.0.0.1:8040"},
  };
  expect("REMOTE_EXECUTION_FAILED", () => runRemoteReset({host: valid.environment.V2S_DEV_REMOTE_HOST, fingerprint: residentDoris.hostFingerprint, targetDatabase: valid.expectedDatabase, residentDoris, executor: () => ({status: 255, stdout: "", stderr: "redacted"})}));
  expect("POST_DROP_READBACK_FAILED", () => runRemoteReset({host: valid.environment.V2S_DEV_REMOTE_HOST, fingerprint: residentDoris.hostFingerprint, targetDatabase: valid.expectedDatabase, residentDoris, executor: () => ({status: 0, stdout: "R5_REMOTE_RESET_DORIS_TRUNCATE=PASS\\nR5_REMOTE_RESET_DORIS_READBACK=0\\nR5_REMOTE_RESET_TERMINATE=PASS\\nR5_REMOTE_RESET_DROP=PASS\\nR5_REMOTE_RESET_READBACK_ABSENT=FAIL\\n"})}));
  expect("SEED_DRY_RUN_REQUIRED_BEFORE_RESET:STATIC_PLAN", () => assertSeedDryRunPass({executor: () => ({status: 2, stdout: "", stderr: "R5_COMPLETE_SEED_DRY_RUN=FAIL; FIRST_FAILURE=STATIC_PLAN"})}));
  process.stdout.write("R5_DEV_RESET_SELF_TEST=PASS\nRED_HOST_HASH=PASS\nRED_PRODUCTION_HOST=PASS\nRED_ILLEGAL_DATABASE=PASS\nRED_REMOTE_EXECUTION=PASS\nRED_POST_DROP_READBACK=PASS\nRED_SEED_DRY_RUN=PASS\nCLEANUP=PASS\n");
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const topology = resolveEnvironment();
  if (process.argv.includes("--dry-run")) {
    const seed = assertSeedDryRunPass();
    process.stdout.write(`R5_DEV_RESET_DRY_RUN=PASS; DATABASE=${topology.targetDatabase}; MANAGEMENT=REMOTE_SSH_EXEC; SEED_DRY_RUN=PASS; SEED_DRY_RUN_DIGEST=${seed.outputDigest}; FOLLOW_UP=scripts/dev/start\n`);
    return;
  }
  if (process.env.R5_RESET_CONFIRMATION !== "EXPLICIT_R5_RESET") fail("EXPLICIT_R5_RESET_CONFIRMATION_REQUIRED");
  const run = createRun(topology);
  try {
    const seed = assertSeedDryRunPass();
    run.state.lastKnownGood = "SEED_DRY_RUN_PASS";
    run.state.seedDryRunDigest = seed.outputDigest;
    run.write(); run.event("SEED_DRY_RUN", "PASS", seed.outputDigest);
    if (verifyManagedDevOwnership(run)) stopOwnedManagedDev(run);
    const residentDoris = readResidentManifest(dorisResidentManifestPath, {host: topology.host, fingerprint: topology.hostTrust.fingerprint});
    if (!residentDoris) fail("DORIS_RESIDENT_MANIFEST_REQUIRED_BEFORE_RESET");
    run.state.dorisResident = {containerId: residentDoris.containerId, imageId: residentDoris.imageId, feVolumeId: residentDoris.feVolumeId, beVolumeId: residentDoris.beVolumeId, host: residentDoris.host};
    run.write(); run.event("DORIS_RESIDENT_MANIFEST", "PASS", "IDENTITY_BOUND");
    const reset = runRemoteReset({...topology, fingerprint: topology.hostTrust.fingerprint, namespace: topology.namespace, residentDoris});
    run.state.lastKnownGood = "DORIS_TRUNCATE_READBACK_AND_REMOTE_RESET";
    run.state.dorisHistory = "CLEARED_READBACK_ZERO";
    run.state.business = "PASS_DORIS_CLEARED_POSTGRES_ABSENT_READBACK";
    run.state.cleanup = "PASS_DORIS_RESIDENT_RETAINED_DEV_STOPPED";
    run.write(); run.event("DORIS_HISTORY_READBACK", "PASS", reset.dorisReadback);
    run.event("REMOTE_DATABASE_READBACK", "PASS", "ABSENT");
    process.stdout.write(`R5_DEV_RESET=PASS; DATABASE=${topology.targetDatabase}; RUN_MANIFEST=${run.manifestPath}; LOG=${run.logPath}; FOLLOW_UP=scripts/dev/start\n`);
  } catch (error) { recordFailure(run, "RESET_EXECUTION", error); process.exitCode = 2; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { const code = error instanceof ResetFailure ? error.code : "UNEXPECTED_RESET_FAILURE"; process.stderr.write(`R5_DEV_RESET=REFUSED; REASON=${code}\n`); process.exitCode = 2; }
}
