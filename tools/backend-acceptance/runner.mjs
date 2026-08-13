#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  deriveLanePlan,
  markAdmissionCompleted,
  markContainerInitializationStarted,
  materializeLaneRecords,
  partitionLaneTargets,
  readLaneConfig,
} from './lanes.mjs';
import {materializeBackendAcceptanceDaemonLanes} from '../../scripts/test/r5-testcontainers-daemon-lanes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const scenarioPath = path.join(root, 'contracts/registry/backend-acceptance-scenarios.json');
const baselinePath = path.join(root, 'contracts/registry/backend-acceptance-accepted-baseline.json');
const preflightCli = path.join(root, 'tools/backend-acceptance/cli.mjs');
const workloadPath = path.join(root, 'tools/backend-acceptance/workload.mjs');
const publicRemoteRunner = path.join(root, 'scripts/test/r5-remote-testcontainers.mjs');
const backendAcceptanceTask = ':apps:backend:catering-business-server:test';
const backendAcceptanceSelector = 'com.catering.v2s.app.acceptance.BackendAcceptanceTest';
const RUN_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

const fail = (code, detail = '') => {
  const error = new Error(`${code}${detail ? `:${detail}` : ''}`);
  error.code = code;
  throw error;
};

const json = (file, code) => {
  if (!fs.existsSync(file)) fail(code, file);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { fail(`${code}_INVALID_JSON`, error.message); }
};

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const identityKey = (operation) => JSON.stringify([
  operation.identity.operationId,
  operation.identity.method,
  operation.identity.normalizedPath ?? operation.identity.path,
  operation.identity.consumerFace,
  operation.identity.owner,
]);
const writeAtomic = (file, value) => {
  fs.mkdirSync(path.dirname(file), {recursive: true, mode: 0o700});
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  fs.renameSync(temporary, file);
};

function parseInvocation(argv) {
  const [mode, operationId] = argv;
  if (!['--per-edit', '--package-exit', '--operation'].includes(mode)) fail('BACKEND_ACCEPTANCE_ARGUMENT_INVALID');
  if (mode === '--operation' && (typeof operationId !== 'string' || !/^[A-Za-z][A-Za-z0-9._:-]{2,127}$/.test(operationId))) {
    fail('BACKEND_ACCEPTANCE_ARGUMENT_INVALID');
  }
  if (mode !== '--operation' && operationId !== undefined) fail('BACKEND_ACCEPTANCE_ARGUMENT_INVALID');
  return Object.freeze({mode, operationId: operationId ?? null});
}

function loadOperations() {
  const scenarios = json(scenarioPath, 'BACKEND_ACCEPTANCE_SCENARIOS_MISSING');
  if (!Array.isArray(scenarios.operations) || scenarios.operations.length === 0) fail('BACKEND_ACCEPTANCE_OPERATION_DENOMINATOR_EMPTY');
  return [...scenarios.operations].sort((left, right) => identityKey(left).localeCompare(identityKey(right)));
}

function selectTargets(mode, operationId, operations) {
  if (mode === '--operation') {
    const target = operations.find((entry) => entry.identity.operationId === operationId);
    if (!target) fail('BACKEND_ACCEPTANCE_OPERATION_NOT_FOUND', operationId);
    return [target];
  }
  // BA-U04 owns source-anchor impact derivation. Until its production owner is
  // active, per-edit conservatively executes the full current denominator rather
  // than inventing a subset. Package-exit is always full by contract.
  return operations;
}

function requireManagedPlane(environment) {
  if (environment.V2S_TESTCONTAINERS_EXECUTION_PLANE !== 'remote') {
    fail('V2S_TESTCONTAINERS_REMOTE_REQUIRED');
  }
}

function runStaticPreflight(environment) {
  const result = spawnSync(process.execPath, [preflightCli, 'preflight'], {
    cwd: root,
    env: {...environment, BACKEND_ACCEPTANCE_ROOT: environment.BACKEND_ACCEPTANCE_ROOT ?? root},
    stdio: 'inherit',
  });
  if (result.error) fail('BACKEND_ACCEPTANCE_PREFLIGHT_FAILED', result.error.code ?? result.error.message);
  if (result.status !== 0) fail('BACKEND_ACCEPTANCE_PREFLIGHT_FAILED', String(result.status ?? 'SIGNALLED'));
}

function createAdmission(mode, operationId, operations, plan, runtime) {
  const admission = {
    schemaVersion: 1,
    kind: 'backend-acceptance-run-manifest',
    machineId: 'backend-acceptance',
    runId: runtime.runId,
    mode,
    requestedOperationId: operationId,
    operationCount: operations.length,
    bootstrapOperation: operations[0].identity,
    operationIdentityDigest: hash(JSON.stringify(operations.map((entry) => entry.identity))),
    lanePlan: plan,
    admissionCompletedAt: null,
    containerInitializationStartedAt: null,
    business: {status: 'NOT_RUN'},
    cleanup: {status: 'NOT_RUN'},
    firstFailure: null,
    logPath: path.relative(root, runtime.logPath),
    eventPath: path.relative(root, runtime.eventsPath),
    databaseOperationsPath: path.relative(root, runtime.databaseOperationsPath),
    secretDigest: runtime.secretDigest,
  };
  const completed = markAdmissionCompleted(admission);
  writeAtomic(runtime.manifestPath, completed);
  return completed;
}

function updateManifest(runtime, value) {
  writeAtomic(runtime.manifestPath, value);
}

function appendLog(runtime, line) {
  fs.appendFileSync(runtime.logPath, `${line}\n`, {mode: 0o600});
}

function writeJsonLinesAtomic(file, values) {
  fs.mkdirSync(path.dirname(file), {recursive: true, mode: 0o700});
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, values.map((value) => JSON.stringify(value)).join('\n') + (values.length ? '\n' : ''), {mode: 0o600});
  fs.renameSync(temporary, file);
}

function readJsonLines(file, missingCode, invalidCode) {
  if (!fs.existsSync(file)) fail(missingCode, file);
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      const value = JSON.parse(line);
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('OBJECT_REQUIRED');
      return value;
    } catch (error) {
      fail(`${invalidCode}:${index + 1}`, error.message);
    }
  });
}

function childEvidenceDirectory(childResult) {
  if (typeof childResult?.evidence !== 'string' || path.isAbsolute(childResult.evidence)) {
    fail('BACKEND_ACCEPTANCE_CHILD_EVIDENCE_PATH_INVALID');
  }
  const candidate = path.resolve(root, childResult.evidence);
  if (!candidate.startsWith(`${root}${path.sep}`) || !fs.existsSync(candidate)) {
    fail('BACKEND_ACCEPTANCE_CHILD_EVIDENCE_MISSING', childResult.evidence);
  }
  return candidate;
}

function parseChildProgress(text, lane, progress) {
  const matches = [...String(text).matchAll(/CURRENT=(\d+)\s+TOTAL=(\d+)/g)];
  const latest = matches.at(-1);
  if (latest) {
    const current = Number(latest[1]);
    const total = Number(latest[2]);
    if (Number.isSafeInteger(current) && Number.isSafeInteger(total) && total === lane.operationIds.length && current >= 0 && current <= total) {
      progress.current = current;
      progress.total = total;
      progress.firstFailure = String(text).match(/FIRST_FAILURE=([^\s]+)/)?.[1] ?? progress.firstFailure;
    }
  }
}

function appendStructuredLog(runtime, event) {
  appendLog(runtime, JSON.stringify({timestamp: now(), ...event}));
}

async function runRemote(mode, operationId, runtime, manifest, parentEnvironment) {
  const started = Date.now();
  const startedManifest = markContainerInitializationStarted(manifest);
  updateManifest(runtime, startedManifest);
  appendStructuredLog(runtime, {kind: 'backend-acceptance-parent', phase: 'CONTAINER_INITIALIZATION_REQUESTED', mode, operationId});
  process.stdout.write(`BACKEND_ACCEPTANCE_STARTED RUN_ID=${runtime.runId} MODE=${mode} CURRENT=0 TOTAL=${manifest.operationCount} LANE=ALL OPERATION=${manifest.bootstrapOperation.operationId} BUSINESS=NOT_RUN CLEANUP=NOT_RUN\n`);

  const lanes = manifest.lanePlan.lanes;
  if (!Array.isArray(lanes) || lanes.length !== manifest.lanePlan.selectedLaneCount || lanes.length < 1) {
    fail('BACKEND_ACCEPTANCE_LANE_PLAN_INVALID');
  }
  const progressByLane = new Map(lanes.map((lane) => [lane.lane, {current: 0, total: lane.operationIds.length, firstFailure: null}]));
  const outcomes = [];
  const emitHeartbeat = () => {
    const current = [...progressByLane.values()].reduce((sum, progress) => sum + progress.current, 0);
    const failures = [...progressByLane.values()].map((progress) => progress.firstFailure).filter(Boolean);
    const firstFailure = failures[0] ?? 'NONE';
    const line = `BACKEND_ACCEPTANCE_HEARTBEAT RUN_ID=${runtime.runId} LANE=ALL CURRENT=${current} TOTAL=${manifest.operationCount} REMAINING=${Math.max(0, manifest.operationCount - current)} ELAPSED_MS=${Date.now() - started} FIRST_FAILURE=${firstFailure} BUSINESS=${manifest.business.status} CLEANUP=${manifest.cleanup.status}`;
    process.stdout.write(`${line}\n`);
    appendStructuredLog(runtime, {kind: 'backend-acceptance-parent-heartbeat', lane: 'ALL', current, total: manifest.operationCount, remaining: Math.max(0, manifest.operationCount - current), elapsedMillis: Date.now() - started, firstFailure, business: manifest.business.status, cleanup: manifest.cleanup.status});
  };
  const heartbeatTimer = setInterval(emitHeartbeat, 10_000);
  heartbeatTimer.unref?.();

  const runLane = async (lane) => {
    const laneDirectory = path.join(runtime.directory, 'lanes', `lane-${lane.lane}`);
    fs.mkdirSync(laneDirectory, {recursive: true, mode: 0o700});
    const progress = progressByLane.get(lane.lane);
    const laneRecord = manifest.lanePlan.lanes.find((entry) => entry.lane === lane.lane);
    laneRecord.initialized = true;
    laneRecord.status = 'RUNNING';
    laneRecord.currentOperation = lane.operationIds[0] ?? null;
    updateManifest(runtime, manifest);
    process.stdout.write(`BACKEND_ACCEPTANCE_LANE_STARTED RUN_ID=${runtime.runId} LANE=${lane.lane} CURRENT=0 TOTAL=${lane.operationIds.length} OPERATION=${lane.operationIds[0] ?? 'NONE'} OPERATION_SCOPE=${lane.operationIds.join(',')}\n`);
    appendStructuredLog(runtime, {kind: 'backend-acceptance-lane', phase: 'STARTED', lane: lane.lane, operationIds: lane.operationIds, databaseNamespace: lane.databaseOrSchemaNamespace, objectStorageNamespace: lane.objectStorageNamespace, dockerHost: lane.dockerHost, workspace: lane.workspace});

    const childEnvironment = {
      ...parentEnvironment,
      V2S_TESTCONTAINERS_EXECUTION_PLANE: 'remote',
      V2S_BACKEND_ACCEPTANCE_RUN_ID: runtime.runId,
      V2S_BACKEND_ACCEPTANCE_SECRET: runtime.secret,
      V2S_BACKEND_ACCEPTANCE_EVENTS: path.join(laneDirectory, 'events.jsonl'),
      V2S_BACKEND_ACCEPTANCE_RUNTIME_DIR: laneDirectory,
      V2S_BACKEND_ACCEPTANCE_OPERATION_ID: '',
      V2S_BACKEND_ACCEPTANCE_OPERATION_IDS: lane.operationIds.join(','),
      V2S_BACKEND_ACCEPTANCE_EXECUTION: 'true',
      V2S_BACKEND_ACCEPTANCE_MODE: mode,
      V2S_BACKEND_ACCEPTANCE_OPERATION_COUNT: String(lane.operationIds.length),
      V2S_BACKEND_ACCEPTANCE_PARENT_RUNTIME: laneDirectory,
      V2S_BACKEND_ACCEPTANCE_DATABASE_NAMESPACE: lane.databaseOrSchemaNamespace,
      V2S_BACKEND_ACCEPTANCE_OBJECT_STORAGE_NAMESPACE: lane.objectStorageNamespace,
      V2S_BACKEND_ACCEPTANCE_LANE_ID: String(lane.lane),
      V2S_BACKEND_ACCEPTANCE_LANE_COUNT: String(lanes.length),
      V2S_TESTCONTAINERS_DOCKER_HOST: lane.dockerHost,
      V2S_TESTCONTAINERS_LANE_WORKSPACE: lane.workspace,
      V2S_BACKEND_ACCEPTANCE_SUITE_ROOT: runtime.laneWorkspaceRoot,
      V2S_RUNTIME_DIR: laneDirectory,
      V2S_RUNTIME_ENVIRONMENT: 'non-production',
      V2S_DEV_PROFILE: 'backend-acceptance',
      V2S_DEV_NAMESPACE: `${runtime.applicationNamespace}-lane-${lane.lane}`,
      V2S_DB_OPERATIONS_EVENTS: path.join(laneDirectory, 'database-operations.jsonl'),
      V2S_DB_OPERATIONS_HMAC_KEY: runtime.databaseOperationsHmacKey,
      V2S_DB_STATEMENT_DICTIONARY: path.join(laneDirectory, 'statement-dictionary.json'),
    };
    const child = spawn(process.execPath, [publicRemoteRunner, backendAcceptanceTask, '--tests', backendAcceptanceSelector], {
      cwd: root,
      env: childEnvironment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const forward = (stream, target) => stream.on('data', (chunk) => {
      const text = String(chunk);
      target.write(text);
      appendLog(runtime, text.trimEnd());
      parseChildProgress(text, lane, progress);
      laneRecord.completed = progress.current;
      laneRecord.currentOperation = lane.operationIds[progress.current] ?? lane.operationIds.at(-1) ?? null;
      if (progress.firstFailure) laneRecord.firstFailure = progress.firstFailure;
      updateManifest(runtime, manifest);
    });
    forward(child.stdout, process.stdout);
    forward(child.stderr, process.stderr);
    let exitCode;
    let spawnFailure = null;
    try {
      exitCode = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code, signal) => resolve({code, signal}));
      });
    } catch (error) {
      spawnFailure = error instanceof Error ? error.message : String(error);
      exitCode = {code: null, signal: null};
    }
    let childResult = null;
    let resultFailure = spawnFailure;
    try {
      childResult = json(path.join(laneDirectory, 'managed-child-result.json'), 'BACKEND_ACCEPTANCE_MANAGED_CHILD_RESULT_MISSING');
      if (childResult.runId !== runtime.runId) fail('BACKEND_ACCEPTANCE_CHILD_RUN_ID_MISMATCH');
    } catch (error) {
      resultFailure = resultFailure ?? (error.code ?? error.message);
    }
    let evidenceDirectory = null;
    if (childResult) {
      try {
        evidenceDirectory = childEvidenceDirectory(childResult);
        const childManifest = json(path.join(evidenceDirectory, 'run-manifest.json'), 'BACKEND_ACCEPTANCE_CHILD_RUN_MANIFEST_MISSING');
        const engineId = childManifest.testcontainersLane?.engineId;
        if (typeof engineId !== 'string' || !/^[a-f0-9-]{32,128}$/i.test(engineId)) fail('BACKEND_ACCEPTANCE_CHILD_ENGINE_ID_MISSING');
        laneRecord.engineId = engineId;
      } catch (error) {
        resultFailure = resultFailure ?? (error.code ?? error.message);
      }
    }
    const pass = !resultFailure
      && exitCode.code === 0
      && childResult?.status === 'PASS'
      && childResult.contractStatus === 'PASS'
      && childResult.businessStatus === 'PASS'
      && childResult.performanceStatus === 'PASS'
      && childResult.cleanupStatus === 'PASS';
    progress.current = childResult?.completedOperations ?? progress.current;
    progress.firstFailure = childResult?.firstFailure ?? resultFailure ?? progress.firstFailure;
    laneRecord.completed = progress.current;
    laneRecord.status = pass ? 'PASS' : 'FAIL';
    laneRecord.firstFailure = pass ? null : progress.firstFailure ?? `BACKEND_ACCEPTANCE_LANE_EXIT:${exitCode.code ?? exitCode.signal ?? 'UNKNOWN'}`;
    laneRecord.evidence = childResult?.evidence ?? null;
    laneRecord.completedAt = now();
    updateManifest(runtime, manifest);
    process.stdout.write(`BACKEND_ACCEPTANCE_LANE_FINISHED RUN_ID=${runtime.runId} LANE=${lane.lane} CURRENT=${progress.current} TOTAL=${lane.operationIds.length} OPERATION=${lane.operationIds[Math.max(0, progress.current - 1)] ?? lane.operationIds[0] ?? 'NONE'} FIRST_FAILURE=${laneRecord.firstFailure ?? 'NONE'} BUSINESS=${childResult?.businessStatus ?? 'FAIL'} CLEANUP=${childResult?.cleanupStatus ?? 'FAIL'}\n`);
    appendStructuredLog(runtime, {kind: 'backend-acceptance-lane', phase: 'FINISHED', lane: lane.lane, current: progress.current, total: lane.operationIds.length, firstFailure: laneRecord.firstFailure, business: childResult?.businessStatus ?? 'FAIL', cleanup: childResult?.cleanupStatus ?? 'FAIL'});
    return {lane, laneDirectory, childResult, exitCode, evidenceDirectory, pass};
  };

  const runParentAggregation = async () => {
    const aggregateEnvironment = {
      ...parentEnvironment,
      V2S_TESTCONTAINERS_EXECUTION_PLANE: 'remote',
      V2S_BACKEND_ACCEPTANCE_RUN_ID: runtime.runId,
      V2S_BACKEND_ACCEPTANCE_SECRET: runtime.secret,
      V2S_BACKEND_ACCEPTANCE_MODE: mode,
      V2S_BACKEND_ACCEPTANCE_OPERATION_COUNT: String(manifest.operationCount),
      V2S_BACKEND_ACCEPTANCE_OPERATION_ID: '',
      V2S_BACKEND_ACCEPTANCE_OPERATION_IDS: '',
      V2S_BACKEND_ACCEPTANCE_WORKLOAD_PORT: '1',
      V2S_BACKEND_ACCEPTANCE_BOOTSTRAP_LOGIN: 'backend-acceptance-aggregate',
      V2S_BACKEND_ACCEPTANCE_BOOTSTRAP_CREDENTIAL: 'backend-acceptance-aggregate-credential',
      V2S_BACKEND_ACCEPTANCE_CATALOG_CLEANUP_STATUS: 'PASS',
      V2S_BACKEND_ACCEPTANCE_EVENTS: runtime.eventsPath,
      V2S_BACKEND_ACCEPTANCE_CALLS_FILE: runtime.callsPath,
      V2S_BACKEND_ACCEPTANCE_RUNTIME_DIR: runtime.directory,
      V2S_BACKEND_ACCEPTANCE_WORKLOAD_RESULT: runtime.workloadResultPath,
      V2S_RUNTIME_DIR: runtime.directory,
    };
    const child = spawn(process.execPath, [workloadPath, '--aggregate'], {cwd: root, env: aggregateEnvironment, stdio: ['ignore', 'pipe', 'pipe']});
    const forward = (stream, target) => stream.on('data', (chunk) => {
      const text = String(chunk);
      target.write(text);
      appendLog(runtime, text.trimEnd());
    });
    forward(child.stdout, process.stdout); forward(child.stderr, process.stderr);
    const exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve({code, signal}));
    });
    const result = json(runtime.workloadResultPath, 'BACKEND_ACCEPTANCE_AGGREGATION_RESULT_MISSING');
    if (exitCode.code !== 0 || result.status !== 'PASS' || result.contractStatus !== 'PASS' || result.businessStatus !== 'PASS' || result.performanceStatus !== 'PASS' || result.cleanupStatus !== 'PASS' || result.completedOperations !== manifest.operationCount) {
      fail('BACKEND_ACCEPTANCE_PARENT_AGGREGATION_NOT_FOUR_DIMENSION_PASS', result.firstFailure ?? `EXIT_${exitCode.code ?? exitCode.signal ?? 'UNKNOWN'}`);
    }
    return result;
  };

  const mergeLaneEvidence = () => {
    const calibrationEvents = [];
    const routeEvents = [];
    const calls = [];
    const calibrationReceipts = [];
    const eventCorrelations = new Set();
    const callCorrelations = new Set();
    const expectedLaneIds = new Set(lanes.flatMap((lane) => lane.operationIds));
    for (const outcome of outcomes) {
      if (!outcome.pass || !outcome.evidenceDirectory) fail('BACKEND_ACCEPTANCE_LANE_EVIDENCE_NOT_PASS', String(outcome.lane.lane));
      const events = readJsonLines(path.join(outcome.evidenceDirectory, 'http-request-events.jsonl'), 'BACKEND_ACCEPTANCE_LANE_EVENTS_MISSING', 'BACKEND_ACCEPTANCE_LANE_EVENTS_INVALID');
      const calibration = events.filter((event) => event.operationId === 'backendAcceptanceMeasurementSinkIntegrity');
      if (calibration.length !== 1) fail('BACKEND_ACCEPTANCE_LANE_CALIBRATION_EVENT_INVALID', String(outcome.lane.lane));
      calibrationEvents.push(calibration[0]);
      for (const event of events.filter((entry) => entry.operationId !== 'backendAcceptanceMeasurementSinkIntegrity')) {
        if (event.runId !== runtime.runId || eventCorrelations.has(event.correlationId)) fail('BACKEND_ACCEPTANCE_PARENT_EVENT_IDENTITY_DRIFT', String(outcome.lane.lane));
        eventCorrelations.add(event.correlationId);
        routeEvents.push(event);
      }
      const callsFile = path.join(outcome.evidenceDirectory, 'backend-acceptance', 'calls.json');
      const callPayload = json(callsFile, 'BACKEND_ACCEPTANCE_LANE_CALLS_MISSING');
      if (callPayload.runId !== runtime.runId || !Array.isArray(callPayload.calls)) fail('BACKEND_ACCEPTANCE_LANE_CALLS_IDENTITY_INVALID', String(outcome.lane.lane));
      const observed = new Set(callPayload.calls.map((call) => call.operationId));
      if (observed.size !== outcome.lane.operationIds.length || outcome.lane.operationIds.some((operationId) => !observed.has(operationId)) || [...observed].some((operationId) => !expectedLaneIds.has(operationId))) {
        fail('BACKEND_ACCEPTANCE_LANE_OPERATION_SET_DRIFT', String(outcome.lane.lane));
      }
      for (const call of callPayload.calls) {
        if (callCorrelations.has(call.correlationId)) fail('BACKEND_ACCEPTANCE_PARENT_CALL_CORRELATION_DUPLICATE', String(call.operationId));
        if (!eventCorrelations.has(call.correlationId)) fail('BACKEND_ACCEPTANCE_PARENT_CALL_EVENT_JOIN_INVALID', String(call.operationId));
        callCorrelations.add(call.correlationId);
        calls.push(call);
      }
      const receiptFile = path.join(outcome.evidenceDirectory, 'backend-acceptance', 'calibration-receipt.json');
      calibrationReceipts.push(json(receiptFile, 'BACKEND_ACCEPTANCE_LANE_CALIBRATION_RECEIPT_MISSING'));
    }
    if (calibrationEvents.length !== lanes.length || calibrationReceipts.length !== lanes.length) fail('BACKEND_ACCEPTANCE_PARENT_CALIBRATION_SET_INVALID');
    writeJsonLinesAtomic(runtime.eventsPath, [calibrationEvents[0], ...routeEvents]);
    writeAtomic(runtime.calibrationReceiptPath, calibrationReceipts[0]);
    writeAtomic(runtime.callsPath, {schemaVersion: 1, kind: 'backend-acceptance-call-observations', runId: runtime.runId, calls});
  };

  const cleanupSuiteWorkspace = async () => {
    const cleanupEnvironment = {...parentEnvironment, V2S_BACKEND_ACCEPTANCE_SUITE_CLEANUP: 'true', V2S_BACKEND_ACCEPTANCE_SUITE_ROOT: runtime.laneWorkspaceRoot};
    delete cleanupEnvironment.V2S_TESTCONTAINERS_DOCKER_HOST;
    delete cleanupEnvironment.V2S_TESTCONTAINERS_LANE_WORKSPACE;
    const child = spawn(process.execPath, [publicRemoteRunner, '--cleanup-suite'], {cwd: root, env: cleanupEnvironment, stdio: ['ignore', 'pipe', 'pipe']});
    const forward = (stream, target) => stream.on('data', (chunk) => { const text = String(chunk); target.write(text); appendLog(runtime, text.trimEnd()); });
    forward(child.stdout, process.stdout); forward(child.stderr, process.stderr);
    const exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve({code, signal}));
    });
    return {status: exitCode.code === 0 ? 'PASS' : 'FAIL', suiteRoot: runtime.laneWorkspaceRoot, exitCode: exitCode.code, signal: exitCode.signal};
  };

  let aggregation = null;
  let failure = null;
  let suiteCleanup = {status: 'FAIL', suiteRoot: runtime.laneWorkspaceRoot};
  try {
    outcomes.push(...await Promise.all(lanes.map((lane) => runLane(lane).catch((error) => {
      const laneRecord = manifest.lanePlan.lanes.find((entry) => entry.lane === lane.lane);
      const reason = error?.code ?? error?.message ?? 'BACKEND_ACCEPTANCE_LANE_UNCLASSIFIED_FAILURE';
      laneRecord.status = 'FAIL';
      laneRecord.firstFailure = reason;
      laneRecord.completedAt = now();
      updateManifest(runtime, manifest);
      process.stdout.write(`BACKEND_ACCEPTANCE_LANE_FINISHED RUN_ID=${runtime.runId} LANE=${lane.lane} CURRENT=${laneRecord.completed ?? 0} TOTAL=${lane.operationIds.length} OPERATION=${laneRecord.currentOperation ?? 'NONE'} FIRST_FAILURE=${reason} BUSINESS=FAIL CLEANUP=FAIL\n`);
      appendStructuredLog(runtime, {kind: 'backend-acceptance-lane', phase: 'FINISHED', lane: lane.lane, current: laneRecord.completed ?? 0, total: lane.operationIds.length, firstFailure: reason, business: 'FAIL', cleanup: 'FAIL'});
      return {lane, laneDirectory: path.join(runtime.directory, 'lanes', `lane-${lane.lane}`), childResult: null, exitCode: {code: null, signal: null}, evidenceDirectory: null, pass: false};
    }))));
    const failedLane = outcomes.find((outcome) => !outcome.pass);
    if (failedLane) failure = new Error(failedLane.childResult?.firstFailure ?? `BACKEND_ACCEPTANCE_LANE_${failedLane.lane.lane}_FAILED`);
    else {
      const engineIds = outcomes.map((outcome) => outcome.lane.engineId ?? manifest.lanePlan.lanes.find((lane) => lane.lane === outcome.lane.lane)?.engineId);
      if (engineIds.some((engineId) => typeof engineId !== 'string') || new Set(engineIds).size !== lanes.length) failure = new Error('BACKEND_ACCEPTANCE_LANE_ENGINE_ID_SET_INVALID');
    }
    if (!failure) {
      mergeLaneEvidence();
      aggregation = await runParentAggregation();
    }
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
  } finally {
    clearInterval(heartbeatTimer);
    emitHeartbeat();
    try { suiteCleanup = await cleanupSuiteWorkspace(); }
    catch (error) { suiteCleanup = {status: 'FAIL', suiteRoot: runtime.laneWorkspaceRoot, reason: error instanceof Error ? error.message : String(error)}; }
  }

  const laneCleanupPass = outcomes.length === lanes.length && outcomes.every((outcome) => outcome.childResult?.cleanupStatus === 'PASS');
  const cleanup = {
    status: laneCleanupPass && suiteCleanup.status === 'PASS' ? 'PASS' : 'FAIL',
    reaped: laneCleanupPass && suiteCleanup.status === 'PASS',
    process: laneCleanupPass && outcomes.every((outcome) => outcome.childResult?.cleanup?.process === 'PASS') ? 'PASS' : 'FAIL',
    scratch: laneCleanupPass && outcomes.every((outcome) => outcome.childResult?.cleanup?.scratch === 'PASS') ? 'PASS' : 'FAIL',
    containers: laneCleanupPass && outcomes.every((outcome) => outcome.childResult?.cleanup?.containers === 'PASS') ? 'PASS' : 'FAIL',
    volumes: laneCleanupPass && outcomes.every((outcome) => outcome.childResult?.cleanup?.volumes === 'PASS') ? 'PASS' : 'FAIL',
    workspace: suiteCleanup.status,
    lanes: outcomes.map((outcome) => ({lane: outcome.lane.lane, status: outcome.childResult?.cleanupStatus ?? 'FAIL', evidence: outcome.childResult?.evidence ?? null})),
    suiteRoot: runtime.laneWorkspaceRoot,
  };
  const businessPass = aggregation?.status === 'PASS' && aggregation.completedOperations === manifest.operationCount;
  const firstFailure = failure?.code ?? failure?.message ?? outcomes.find((outcome) => outcome.childResult?.firstFailure)?.childResult?.firstFailure ?? null;
  const parentChildResult = {
    schemaVersion: 1,
    kind: 'backend-acceptance-managed-child-result',
    runId: runtime.runId,
    status: businessPass && cleanup.status === 'PASS' ? 'PASS' : 'FAIL',
    contractStatus: businessPass ? 'PASS' : 'FAIL',
    businessStatus: businessPass ? 'PASS' : 'FAIL',
    performanceStatus: businessPass ? 'PASS' : 'FAIL',
    cleanupStatus: cleanup.status,
    completedOperations: aggregation?.completedOperations ?? outcomes.reduce((sum, outcome) => sum + (outcome.childResult?.completedOperations ?? 0), 0),
    business: {status: businessPass ? 'PASS' : 'FAIL', lanes: outcomes.map((outcome) => ({lane: outcome.lane.lane, status: outcome.childResult?.businessStatus ?? 'FAIL', evidence: outcome.childResult?.evidence ?? null}))},
    performance: {status: businessPass ? 'PASS' : 'FAIL', aggregation: aggregation ? 'PASS' : 'FAIL'},
    cleanup,
    firstFailure,
    evidence: path.relative(root, runtime.directory),
    lanes: outcomes.map((outcome) => ({lane: outcome.lane.lane, status: outcome.pass ? 'PASS' : 'FAIL', operationIds: outcome.lane.operationIds, evidence: outcome.childResult?.evidence ?? null, firstFailure: outcome.childResult?.firstFailure ?? null})),
  };
  writeAtomic(runtime.childResultPath, parentChildResult);
  const finished = {
    ...manifest,
    completedAt: now(),
    durationMillis: Date.now() - started,
    child: parentChildResult,
    dynamic: aggregation ? {status: 'PASS', resultPath: path.relative(root, runtime.workloadResultPath), operationCount: aggregation.completedOperations} : {status: 'FAIL'},
    business: {status: businessPass ? 'PASS' : 'FAIL', contract: parentChildResult.contractStatus, business: parentChildResult.businessStatus, performance: parentChildResult.performanceStatus},
    cleanup,
    firstFailure,
  };
  updateManifest(runtime, finished);
  process.stdout.write(`BACKEND_ACCEPTANCE_FINISHED RUN_ID=${runtime.runId} CURRENT=${parentChildResult.completedOperations} TOTAL=${manifest.operationCount} DURATION_MS=${finished.durationMillis} FIRST_FAILURE=${firstFailure ?? 'NONE'} BUSINESS=${finished.business.status} CLEANUP=${finished.cleanup.status} EVIDENCE=${path.relative(root, runtime.directory)}\n`);
  if (finished.business.status !== 'PASS' || finished.cleanup.status !== 'PASS') fail('BACKEND_ACCEPTANCE_BUSINESS_OR_CLEANUP_NOT_PASS', firstFailure ?? 'UNKNOWN');
  return finished;
}

export async function execute(argv = process.argv.slice(2), environment = process.env) {
  const invocation = parseInvocation(argv);
  requireManagedPlane(environment);
  runStaticPreflight(environment);
  const operations = loadOperations();
  const targets = selectTargets(invocation.mode, invocation.operationId, operations);
  const laneConfig = readLaneConfig(environment);
  const baseline = json(baselinePath, 'BACKEND_ACCEPTANCE_BASELINE_MISSING');
  const runId = environment.V2S_BACKEND_ACCEPTANCE_RUN_ID || `backend-acceptance-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  if (!RUN_ID_PATTERN.test(runId)) fail('BACKEND_ACCEPTANCE_RUN_ID_INVALID');
  const directory = path.join(root, '.runtime/backend-acceptance', runId);
  if (fs.existsSync(directory)) fail('BACKEND_ACCEPTANCE_RUN_DIRECTORY_ALREADY_EXISTS', directory);
  fs.mkdirSync(directory, {recursive: true, mode: 0o700});
  const runtime = {
    runId,
    directory,
    manifestPath: path.join(directory, 'run-manifest.json'),
    logPath: path.join(directory, 'runner.jsonl'),
    childResultPath: path.join(directory, 'managed-child-result.json'),
    eventsPath: path.join(directory, 'events.jsonl'),
    callsPath: path.join(directory, 'calls.json'),
    calibrationReceiptPath: path.join(directory, 'calibration-receipt.json'),
    databaseOperationsPath: path.join(directory, 'database-operations.jsonl'),
    statementDictionaryPath: path.join(directory, 'statement-dictionary.json'),
    workloadResultPath: path.join(directory, 'workload-result.json'),
    secret: environment.V2S_BACKEND_ACCEPTANCE_SECRET || crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', ''),
    databaseOperationsHmacKey: crypto.randomBytes(32).toString('base64url'),
  };
  runtime.applicationNamespace = `v2s-backend-acceptance-${hash(runId).slice(0, 16)}`;
  runtime.laneWorkspaceRoot = `/tmp/r5-tc-suite-${Date.now()}-${process.pid}`;
  runtime.secretDigest = hash(runtime.secret);
  fs.writeFileSync(runtime.logPath, '', {mode: 0o600});
  const plan = deriveLanePlan({
    operations: targets,
    baseline,
    runId,
    isolatedResourceMaximum: laneConfig.isolatedResourceMaximum,
    requestedLaneCount: laneConfig.requestedLaneCount,
    namespacePrefix: laneConfig.namespacePrefix,
    perEditFullModeEngineeringTargetMillis: laneConfig.perEditFullModeEngineeringTargetMillis,
  });
  const partitions = partitionLaneTargets(targets, plan.selectedLaneCount);
  const daemonLanes = materializeBackendAcceptanceDaemonLanes({laneCount: partitions.length});
  const lanes = materializeLaneRecords(plan).map((lane, index) => ({
    ...lane,
    operationIds: partitions[index].operationIds,
    dockerHost: `unix://${daemonLanes[index].socket}`,
    workspace: `${runtime.laneWorkspaceRoot}/lane-${lane.lane}/workspace`,
  }));
  const admission = createAdmission(invocation.mode, invocation.operationId, targets, {...plan, lanes}, runtime);
  process.stdout.write(`BACKEND_ACCEPTANCE_ADMISSION=PASS RUN_ID=${runId} MODE=${invocation.mode} OPERATIONS=${targets.length} BOOTSTRAP_OPERATION=${targets[0].identity.operationId}\n`);
  process.stdout.write(`ADMISSION_COMPLETED_AT=${admission.admissionCompletedAt}\n`);
  const result = await runRemote(invocation.mode, invocation.operationId, runtime, admission, environment);
  process.stdout.write(`BACKEND_ACCEPTANCE=PASS RUN_ID=${runId} OPERATIONS=${targets.length} BUSINESS=PASS CLEANUP=PASS EVIDENCE=${path.relative(root, runtime.directory)}\n`);
  return result;
}

export function selfTest() {
  const valid = parseInvocation(['--operation', 'getOperationsCatalogItem']);
  if (valid.operationId !== 'getOperationsCatalogItem') fail('BACKEND_ACCEPTANCE_RUNNER_SELF_TEST_ARGUMENT_INVALID');
  for (const args of [[], ['--unknown'], ['--operation'], ['--operation', 'bad space'], ['--package-exit', 'extra']]) {
    try { parseInvocation(args); fail('BACKEND_ACCEPTANCE_RUNNER_SELF_TEST_RED_NOT_DETECTED'); }
    catch (error) { if (error.code !== 'BACKEND_ACCEPTANCE_ARGUMENT_INVALID') throw error; }
  }
  try { requireManagedPlane({V2S_TESTCONTAINERS_EXECUTION_PLANE: 'local'}); fail('BACKEND_ACCEPTANCE_RUNNER_SELF_TEST_REMOTE_GUARD_NOT_DETECTED'); }
  catch (error) { if (error.code !== 'V2S_TESTCONTAINERS_REMOTE_REQUIRED') throw error; }
  process.stdout.write('BACKEND_ACCEPTANCE_RUNNER_SELF_TEST=PASS\nRED_ARGUMENTS=PASS\nRED_LOCAL_EXECUTION=PASS\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv[2] === '--self-test') {
    try { selfTest(); } catch (error) { process.stderr.write(`BACKEND_ACCEPTANCE_RUNNER_SELF_TEST=FAIL; REASON=${error.code ?? error.message}\n`); process.exitCode = 2; }
  } else {
    execute().catch((error) => {
      process.stderr.write(`BACKEND_ACCEPTANCE=FAIL; REASON=${error.code ?? error.message}\n`);
      process.exitCode = 2;
    });
  }
}
