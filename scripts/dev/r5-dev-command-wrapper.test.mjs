import assert from "node:assert/strict";
import childProcess from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
import test from "node:test";
import {buildManagedDevCleanupReceipt, canCleanupRemoteJavaRoot, cleanupManagedRemoteJavaRoot, cleanupManagedRemoteRootAfterStartFailure, collectStopDiagnostics, parseRemoteRootCleanupResult, stopAndCleanupStartedRemoteJava, validateManagedRemoteJavaBinding} from "./r5-dev-runner.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const start = path.join(root, "scripts/dev/start");
const runnerSource = readFileSync(path.join(root, "scripts/dev/r5-dev-runner.mjs"), "utf8");

test("DEV start rejects every argument before it can launch managed resources", () => {
  const result = childProcess.spawnSync(start, ["--help"], {
    cwd: root,
    encoding: "utf8",
    env: {...process.env},
  });

  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^R5_DEV_START=REFUSED; REASON=ARGUMENT_INVALID\n$/);
});

test("DEV start propagates authoritative existing MinIO credentials to Java", () => {
  assert.match(runnerSource, /credential\.values\.CATERING_ASSET_S3_ACCESS_KEY = objectStorage\.access/);
  assert.match(runnerSource, /credential\.values\.CATERING_ASSET_S3_SECRET_KEY = objectStorage\.secretKey/);
});

test("DEV start gives Java the selected local asset ingress for browser public URLs", () => {
  assert.match(runnerSource, /const tunnel = await openTunnel\(env, tunnelPorts\);[\s\S]*startRemoteJava/);
  assert.match(runnerSource, /assetPublicBaseUrl: `http:\/\/127\.0\.0\.1:\$\{tunnelPorts\.asset\}`/);
  assert.match(runnerSource, /CATERING_ASSET_PUBLIC_BASE_URL: assetPublicBaseUrl/);
  assert.doesNotMatch(runnerSource, /CATERING_ASSET_PUBLIC_BASE_URL: `http:\/\/127\.0\.0\.1:\$\{env\.environment\.V2S_DEV_REMOTE_ASSET_PORT\}`/);
});

test("DEV stop retains remote-log evidence for already-stopped Java", () => {
  let missingAttempts = 0;
  const missing = collectStopDiagnostics({
    remoteJavaStopStatus: "ALREADY_STOPPED",
    collectLog: () => { missingAttempts += 1; throw new Error("REMOTE_LOG_MISSING"); },
    refreshDiagnostics: () => {},
  });
  assert.equal(missingAttempts, 1);
  assert.equal(missing.status, "LOG_NOT_AVAILABLE");
  assert.equal(missing.failures.length, 1);

  let existingAttempts = 0;
  const existing = collectStopDiagnostics({
    remoteJavaStopStatus: "ALREADY_STOPPED",
    collectLog: () => { existingAttempts += 1; },
    refreshDiagnostics: () => {},
  });
  assert.equal(existingAttempts, 1);
  assert.equal(existing.status, "PASS");
  assert.equal(existing.failures.length, 0);
});

test("DEV stop refuses remote-root deletion without a bound control and successful stop", () => {
  let cleanupCalls = 0;
  assert.equal(canCleanupRemoteJavaRoot({controlValid: false, remoteJavaStopStatus: "STOPPED"}), false);
  assert.equal(canCleanupRemoteJavaRoot({controlValid: true, remoteJavaStopStatus: "NOT_RUN"}), false);
  assert.equal(cleanupManagedRemoteJavaRoot({
    controlValid: false,
    remoteJavaStopStatus: "STOPPED",
    cleanupRoot: () => { cleanupCalls += 1; },
  }), false);
  assert.equal(cleanupCalls, 0);

  const runId = "r5-dev-1789364564599-72246-1d53aa6c-cd00-444d-8f9a-125f6ee68081";
  const remoteRoot = `/tmp/${runId}`;
  const control = {
    schemaVersion: 1,
    kind: "r5-dev-remote-java-control",
    runId,
    remoteRoot,
    pid: 101,
    pgid: 101,
    bootId: "0123456789abcdef0123456789abcdef",
    processStartTicks: 2026,
    commandSha256: "a".repeat(64),
    phase: "STOPPED",
    logPath: `${remoteRoot}/results/business-server.log`,
    phasePath: `${remoteRoot}/results/phase.jsonl`,
  };
  assert.doesNotThrow(() => validateManagedRemoteJavaBinding({runId, remoteJava: control, remoteDiagnostic: {remoteRoot}}));
  assert.throws(
    () => validateManagedRemoteJavaBinding({runId, remoteJava: control, remoteDiagnostic: {remoteRoot: "/tmp/r5-dev-1789364564599-72246-1d53aa6c-cd00-444d-8f9a-125f6ee68080"}}),
    /R5_DEV_REMOTE_ROOT_BINDING_MISMATCH/,
  );
});

test("DEV start failure refuses remote-root deletion when managed Java stop fails", async () => {
  const runId = "r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081";
  const remoteRoot = `/tmp/${runId}`;
  const remoteJava = {
    schemaVersion: 1,
    kind: "r5-dev-remote-java-control",
    runId,
    remoteRoot,
    pid: 101,
    pgid: 101,
    bootId: "0123456789abcdef0123456789abcdef",
    processStartTicks: 2026,
    commandSha256: "a".repeat(64),
    phase: "READY",
    logPath: `${remoteRoot}/results/business-server.log`,
    phasePath: `${remoteRoot}/results/phase.jsonl`,
  };
  let cleanupCalls = 0;
  const result = await stopAndCleanupStartedRemoteJava({
    host: "catering-remote-dev",
    runId,
    remoteRoot,
    remoteJava,
    stop: async () => { throw new Error("REMOTE_STOP_FAILED"); },
    cleanup: () => { cleanupCalls += 1; },
  });
  assert.equal(result.controlValid, true);
  assert.equal(result.stopStatus, "NOT_RUN");
  assert.equal(result.cleanupStatus, "FAIL");
  assert.equal(cleanupCalls, 0);
  assert.match(result.failures[0].message, /REMOTE_STOP_FAILED/);
});

test("DEV terminal cleanup receipt keeps local, remote Java, and remote-root statuses separate", () => {
  assert.deepEqual(buildManagedDevCleanupReceipt({
    cleanupStatus: "FAIL",
    localProcessStatus: "FAIL",
    remoteJavaControlStatus: "PASS",
    remoteJavaStopStatus: "STOPPED",
    remoteJavaRootCleanupStatus: "PASS",
    failedProcessCount: 1,
  }), {
    status: "FAIL",
    failedProcessCount: 1,
    localProcess: "FAIL",
    remoteJavaControl: "PASS",
    remoteJava: "PASS",
    remoteJavaStop: "STOPPED",
    remoteJavaRoot: "PASS",
  });
  assert.deepEqual(buildManagedDevCleanupReceipt({
    cleanupStatus: "FAIL",
    localProcessStatus: "PASS",
    remoteJavaControlStatus: "PASS",
    remoteJavaStopStatus: "STOPPED",
    remoteJavaRootCleanupStatus: "FAIL",
  }).remoteJava, "PASS");
  assert.equal(buildManagedDevCleanupReceipt({
    cleanupStatus: "PASS",
    localProcessStatus: "PASS",
    remoteJavaControlStatus: "NOT_APPLICABLE",
    remoteJavaStopStatus: "NOT_APPLICABLE",
    remoteJavaRootCleanupStatus: "PASS",
  }).remoteJava, "NOT_APPLICABLE");
});

test("DEV start failure tracks and cleans a possible exact root before Java control exists", () => {
  let cleanupCalls = 0;
  assert.equal(cleanupManagedRemoteRootAfterStartFailure({
    rootMayExist: false,
    cleanupRoot: () => { cleanupCalls += 1; },
  }), false);
  assert.equal(cleanupCalls, 0);
  assert.equal(cleanupManagedRemoteRootAfterStartFailure({
    rootMayExist: true,
    cleanupRoot: () => { cleanupCalls += 1; },
  }), true);
  assert.equal(cleanupCalls, 1);
  assert.match(runnerSource, /let remoteRootMayExist = false/);
  assert.match(runnerSource, /remoteRootMayExist = true/);
  assert.match(runnerSource, /cleanupRemoteRootWithoutJavaControl/);
  assert.match(runnerSource, /ps -eo pid=,args=/);
  assert.match(runnerSource, /R5_REMOTE_ROOT_ABSENT=true/);
  assert.deepEqual(parseRemoteRootCleanupResult("/tmp/r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081", {
    status: 45,
    stdout: "R5_REMOTE_ROOT_PRESENT=true\nREMOTE_ACTIVE_PROCESS_COUNT=1\nREMOTE_ACTIVE_PROCESS_PIDS=101\nREMOTE_UNKNOWN_PROCESS_COUNT=0\nREMOTE_UNKNOWN_PROCESS_PIDS=\n",
    stderr: "REMOTE_PROCESSES_REMAIN",
  }), {
    status: "FAIL",
    remoteRoot: "/tmp/r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081",
    remoteRootPresent: "true",
    remoteRootAbsent: false,
    activeProcessCount: "1",
    activeProcessPids: "101",
    unknownProcessCount: "0",
    unknownProcessPids: "",
    failure: "REMOTE_PROCESSES_REMAIN",
  });
  assert.deepEqual(parseRemoteRootCleanupResult("/tmp/r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081", {
    status: 46,
    stdout: "R5_REMOTE_ROOT_PRESENT=true\nREMOTE_ACTIVE_PROCESS_COUNT=0\nREMOTE_ACTIVE_PROCESS_PIDS=\nREMOTE_UNKNOWN_PROCESS_COUNT=1\nREMOTE_UNKNOWN_PROCESS_PIDS=202\n",
    stderr: "",
  }).failure, "REMOTE_PROCESS_INSPECTION_UNAVAILABLE");
  assert.deepEqual(parseRemoteRootCleanupResult("/tmp/r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081", {
    status: 0,
    stdout: "R5_REMOTE_ROOT_PRESENT=true\nREMOTE_ACTIVE_PROCESS_COUNT=0\nREMOTE_ACTIVE_PROCESS_PIDS=\nREMOTE_UNKNOWN_PROCESS_COUNT=0\nREMOTE_UNKNOWN_PROCESS_PIDS=\nR5_REMOTE_ROOT_ABSENT=true\n",
    stderr: "",
  }).status, "PASS");
});

test("DEV start terminal evidence uses explicit phase boundaries", () => {
  assert.match(runnerSource, /let lastKnownGood = 'REMOTE_RESOURCE_PREFLIGHT'/);
  assert.match(runnerSource, /lastKnownGood = 'REMOTE_SOURCE_SYNC'/);
  assert.match(runnerSource, /lastKnownGood = 'TUNNEL_READY'/);
  assert.match(runnerSource, /lastKnownGood = 'REMOTE_JAVA_CONTROL_READY'/);
  assert.match(runnerSource, /firstFailure: safeFailure\(error\), lastKnownGood, brokenBoundary/);
  assert.match(runnerSource, /cleanupEvidence: \{remoteRoot: remoteRootCleanupEvidence\}/);
});

test("remote Java binds the selected HTTP port instead of assuming one shared listener", () => {
  assert.match(runnerSource, /httpPort = env\.environment\.V2S_DEV_REMOTE_HTTP_PORT/);
  assert.match(runnerSource, /SERVER_PORT: String\(httpPort\)/);
  assert.match(runnerSource, /httpPort.*\$http_port/);
});

test("DEV start forwards only an explicit backend verification mode to remote Java", () => {
  assert.match(runnerSource, /const backendAcceptanceVerificationMode = env\.environment\.V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE/);
  assert.match(runnerSource, /V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE: backendAcceptanceVerificationMode/);
  assert.match(runnerSource, /!\['ACCEPTANCE', 'CALIBRATION'\]\.includes\(backendAcceptanceVerificationMode\)/);
});
