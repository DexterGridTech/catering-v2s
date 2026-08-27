#!/usr/bin/env node
/** Runs one focused Testcontainers Gradle task on the approved remote host. */
import {createHash, randomUUID} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {resolveTrustedRemoteHost} from '../dev/r5-remote-host-trust.mjs';
import {
  resolveGradleHome as resolveSharedGradleHome,
  validateGradleHome as validateSharedGradleHome,
} from '../lib/gradle-runtime.mjs';
import {
  assertNoObservationErrors,
  assertUnclassifiedSqlRatio,
  parseHttpRequestEvents,
} from './backend-performance-event-verifier.mjs';
import {
  assertPerformanceConnectionBudgets,
  assertPerformanceConnectionBudgetsForIdentity,
  assertPerformanceOperationExactSet,
  assertPerformanceOperationBudgets,
  buildNormalSampleMatrix,
  buildNormalSampleMatrixForIdentity,
  loadPerformanceOperationRegistry,
  reconcilePerformanceOperationEvents,
} from './backend-performance-operation-reconciliation.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR ?? path.join(root, '.runtime/r5'));
const evidence = path.join(runtime, 'evidence', 'remote-testcontainers');
const remoteDependencyCache = '/tmp/catering-v2s-r5-gradle-cache';
const remoteGradleDistributionPrefix = '/tmp/catering-v2s-r5-gradle-distribution-';
const remoteHostTrust = resolveTrustedRemoteHost(process.env);
const remoteHost = remoteHostTrust.host;
const backendAcceptanceSelector = 'com.catering.v2s.app.acceptance.BackendAcceptanceTest';

const now = () => new Date().toISOString();
const sha256 = value => createHash('sha256').update(value).digest('hex');
const stableValue = value => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, stableValue(value[key])]),
  );
  return value;
};
const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
const compact = (value, limit = 240) =>
  String(value ?? 'FAILED')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, limit);
const script = (...lines) => lines.join('\n');
const runnerEvent = (event, fields = {}) =>
  process.stdout.write(
    `R5_TESTCONTAINERS_${event} ${Object.entries(fields)
      .map(([key, value]) => `${key}=${value}`)
      .join(' ')}\n`,
  );

const BACKEND_ACCEPTANCE_VERIFICATION_MODES = Object.freeze(['ACCEPTANCE', 'CALIBRATION']);
const ARCHIVED_EVIDENCE_ARTIFACTS = Object.freeze([
  'http-request-events.jsonl',
  'backend-acceptance-result.jsonl',
  'db-operation-events.jsonl',
  'statement-dictionary.json',
]);

export const fullPerformanceWorkload = ({task, operation, verificationMode, registry}) => {
  if (!Array.isArray(registry)) throw new Error('PERFORMANCE_WORKLOAD_REGISTRY_REQUIRED');
  const descriptor = {
    schemaVersion: 1,
    task,
    backendAcceptanceOperation: operation,
    verificationMode,
    normalRecipe: 'BackendPerformanceOperationCoverage.runNormalRecipes',
    coverageRecipe: 'BackendPerformanceOperationCoverage.runCoverageRecipes',
    p2ScopeRecipe: 'P2ReadConnectionScopeScenarios.run',
    operationIdentity: registry.map(({operationId, method, routeTemplate, owner, consumerFace}) => ({
      operationId,
      method,
      routeTemplate,
      owner,
      consumerFace,
    })),
  };
  return Object.freeze({
    schemaVersion: 1,
    descriptor: stableValue(descriptor),
    fingerprint: sha256(JSON.stringify(stableValue(descriptor))),
  });
};

export const backendAcceptanceEnvironment = (runId, operation = 'all', verificationMode = 'ACCEPTANCE') =>
  runId === null
    ? []
    : [
        'export V2S_RUNTIME_ENVIRONMENT=non-production',
        'export V2S_DEV_PROFILE=backend-acceptance',
        `export V2S_DEV_NAMESPACE=${quote(`v2s-backend-acceptance-${sha256(runId).slice(0, 16)}`)}`,
        `export V2S_BACKEND_ACCEPTANCE_RUN_ID=${quote(runId)}`,
        'export V2S_BACKEND_ACCEPTANCE_SECRET="$(od -An -N32 -tx1 /dev/urandom | tr -d \' \\n\')"',
        'export V2S_BACKEND_ACCEPTANCE_EVENTS="$root/results/http-request-events.jsonl"',
        'export V2S_BACKEND_ACCEPTANCE_RESULT="$root/results/backend-acceptance-result.jsonl"',
        'export V2S_DB_OPERATIONS_EVENTS="$root/results/db-operation-events.jsonl"',
        'export V2S_DB_OPERATIONS_HMAC_KEY="$(od -An -N32 -tx1 /dev/urandom | tr -d \' \\n\')"',
        'export V2S_DB_STATEMENT_DICTIONARY="$root/results/statement-dictionary.json"',
        `export V2S_BACKEND_ACCEPTANCE_OPERATION=${quote(operation)}`,
        `export V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=${quote(verificationMode)}`,
        // The complete exact-set workload needs the existing P2 normal recipes.
        // They cannot remain caller-selected diagnostics: coverage-only probes
        // deliberately do not satisfy the normal performance denominator.
        ...(operation === 'all' ? ['export V2S_BACKEND_P2_CONNECTION_SCOPE_PROOF=true'] : []),
        // A managed whole-suite run is the canonical 239-operation measurement workload.
        // Its non-scenario coverage fixture must therefore be enabled by the runner itself,
        // never by a caller-controlled diagnostic switch.
        ...(operation === 'all' ? ['export V2S_BACKEND_PERFORMANCE_OPERATION_COVERAGE=true'] : []),
        'export CATERING_OTP_DEBUG_CODE_EXPOSURE=true',
      ];

/**
 * A complete backend-acceptance run is the only run whose event denominator is the full generated operation set.
 * Its budgets are therefore an unconditional acceptance invariant, not an opt-in diagnostics switch.
 */
export const requiresFullPerformanceVerification = (backendAcceptanceRunId, backendAcceptanceOperation) =>
  backendAcceptanceRunId !== null && backendAcceptanceOperation === 'all';

export const requiresActiveBudgetVerification = (
  backendAcceptanceRunId,
  backendAcceptanceOperation,
  verificationMode,
) =>
  requiresFullPerformanceVerification(backendAcceptanceRunId, backendAcceptanceOperation) &&
  verificationMode === 'ACCEPTANCE';

export const parseEvidenceArchiveIndex = source => {
  const rows = String(source)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => line.split('\t'));
  const seen = new Set();
  return rows.map(([name, rawBytes, rawSha256, archiveBytes, archiveSha256]) => {
    if (
      !ARCHIVED_EVIDENCE_ARTIFACTS.includes(name) ||
      !/^\d+$/.test(rawBytes) ||
      !/^[a-f0-9]{64}$/.test(rawSha256) ||
      !/^\d+$/.test(archiveBytes) ||
      !/^[a-f0-9]{64}$/.test(archiveSha256) ||
      seen.has(name)
    ) {
      throw new Error('EVIDENCE_ARCHIVE_INDEX_INVALID');
    }
    seen.add(name);
    return Object.freeze({
      name,
      rawBytes: Number(rawBytes),
      rawSha256,
      archiveBytes: Number(archiveBytes),
      archiveSha256,
    });
  });
};

export const readEvidenceArtifact = (directory, name, {requireArchive = false} = {}) => {
  const plainPath = path.join(directory, name);
  if (!requireArchive && existsSync(plainPath)) return readFileSync(plainPath, 'utf8');
  const indexPath = path.join(directory, 'evidence-artifacts.tsv');
  const archivePath = `${plainPath}.gz`;
  if (!existsSync(indexPath) || !existsSync(archivePath)) throw new Error(`EVIDENCE_ARTIFACT_REQUIRED:${name}`);
  const entry = parseEvidenceArchiveIndex(readFileSync(indexPath, 'utf8')).find(candidate => candidate.name === name);
  if (!entry) throw new Error(`EVIDENCE_ARCHIVE_ENTRY_REQUIRED:${name}`);
  const archive = readFileSync(archivePath);
  if (archive.length !== entry.archiveBytes || sha256(archive) !== entry.archiveSha256)
    throw new Error(`EVIDENCE_ARCHIVE_INTEGRITY_INVALID:${name}`);
  const raw = gunzipSync(archive);
  if (raw.length !== entry.rawBytes || sha256(raw) !== entry.rawSha256)
    throw new Error(`EVIDENCE_ARTIFACT_INTEGRITY_INVALID:${name}`);
  return raw.toString('utf8');
};

export const verifyFullBackendAcceptancePerformance = (registry, events) => {
  assertNoObservationErrors(events);
  const operationSet = reconcilePerformanceOperationEvents(registry, events);
  assertPerformanceOperationExactSet(operationSet);
  const budgetEvidence = assertPerformanceOperationBudgets(registry, events);
  const connectionBudgetEvidence = assertPerformanceConnectionBudgets(registry, events);
  const normalSampleMatrix = buildNormalSampleMatrix(registry, events);
  return {operationSet, budgetEvidence, connectionBudgetEvidence, normalSampleMatrix};
};

export const verifyFullBackendAcceptanceCalibration = (registry, events) => {
  assertNoObservationErrors(events);
  const operationSet = reconcilePerformanceOperationEvents(registry, events);
  assertPerformanceOperationExactSet(operationSet);
  const connectionBudgetEvidence = assertPerformanceConnectionBudgetsForIdentity(registry, events);
  const normalSampleMatrix = buildNormalSampleMatrixForIdentity(registry, events);
  return {operationSet, connectionBudgetEvidence, normalSampleMatrix};
};

export const parseBackendAcceptanceResult = contents => {
  const rows = String(contents ?? '')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  if (rows.length < 2) throw new Error('BACKEND_ACCEPTANCE_RESULT_CARDINALITY_INVALID');
  const parsed = rows.map(row => {
    try {
      return JSON.parse(row);
    } catch {
      throw new Error('BACKEND_ACCEPTANCE_RESULT_INVALID_JSON');
    }
  });
  const discovery = parsed.filter(row => row?.type === 'discovery');
  const scenarios = parsed.filter(row => row?.type !== 'discovery');
  if (discovery.length !== 1 || scenarios.length === 0)
    throw new Error('BACKEND_ACCEPTANCE_RESULT_CARDINALITY_INVALID');
  const [discoveryRow] = discovery;
  if (
    !Number.isInteger(discoveryRow.discovered) ||
    discoveryRow.discovered < 1 ||
    !Number.isInteger(discoveryRow.selected) ||
    discoveryRow.selected < 1 ||
    discoveryRow.selected > discoveryRow.discovered
  ) {
    throw new Error('BACKEND_ACCEPTANCE_DISCOVERY_INVALID');
  }
  for (const result of scenarios) {
    if (
      !result ||
      typeof result.operation !== 'string' ||
      typeof result.module !== 'string' ||
      !['PASS', 'FAIL'].includes(result.contract) ||
      !['PASS', 'FAIL'].includes(result.business) ||
      !['REAL', 'STUB'].includes(result.businessMode) ||
      !Number.isInteger(result.dbOperations) ||
      result.dbOperations < 0 ||
      !['PASS', 'FAIL'].includes(result.status)
    ) {
      throw new Error('BACKEND_ACCEPTANCE_RESULT_INVALID');
    }
    if (result.businessMode === 'STUB') throw new Error('BACKEND_ACCEPTANCE_RESULT_STUB_BUSINESS');
  }
  if (scenarios.length !== discoveryRow.selected) throw new Error('BACKEND_ACCEPTANCE_RESULT_SELECTION_MISMATCH');
  const failureCategories = Object.fromEntries(
    Object.entries(
      Object.groupBy(
        scenarios.filter(row => row.status === 'FAIL' || row.contract === 'FAIL' || row.business === 'FAIL'),
        row => row.failureCategory ?? 'UNKNOWN',
      ),
    ).map(([key, values]) => [key, values.length]),
  );
  const summary = {
    discovered: discoveryRow.discovered,
    selected: discoveryRow.selected,
    httpSuccess: scenarios.filter(row => row.contract === 'PASS').length,
    realBusinessAssertions: scenarios.filter(row => row.businessMode === 'REAL').length,
    stubOnly: scenarios.filter(row => row.businessMode === 'STUB').length,
    directFailures: scenarios.filter(row => row.status === 'FAIL' || row.contract === 'FAIL' || row.business === 'FAIL')
      .length,
    failureCategories,
  };
  return {rows: scenarios, discovery: discoveryRow, summary};
};

export const resolveGradleHome = (options = {}) => resolveSharedGradleHome({root, ...options});

export function validateGradleHome(value, distributionAvailable) {
  return validateSharedGradleHome(value, {distributionAvailable, exists: () => Boolean(distributionAvailable)});
}

export function remoteGradleDistributionPath(distributionSha256) {
  if (typeof distributionSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(distributionSha256))
    throw new Error('GRADLE_DISTRIBUTION_SHA256_INVALID');
  return `${remoteGradleDistributionPrefix}${distributionSha256}`;
}

export function validateGradleDistribution(distribution) {
  if (
    !distribution ||
    typeof distribution !== 'object' ||
    typeof distribution.sha256 !== 'string' ||
    !['PENDING', 'SYNCED', 'REUSED', 'REUSED_AFTER_RACE'].includes(distribution.status)
  ) {
    throw new Error('GRADLE_DISTRIBUTION_RECORD_INVALID');
  }
  if (distribution.path !== remoteGradleDistributionPath(distribution.sha256))
    throw new Error('GRADLE_DISTRIBUTION_PATH_INVALID');
  return distribution;
}

export function validateInvocationArguments(argumentsList) {
  if (!Array.isArray(argumentsList) || argumentsList.length === 0) throw new Error('TASK_REQUIRED');
  const [task, ...extraArguments] = argumentsList;
  if (typeof task !== 'string' || !/^:[a-z0-9:-]+:test$/.test(task)) throw new Error('TASK_MUST_BE_A_SINGLE_TEST_TASK');
  for (let index = 0; index < extraArguments.length; index += 2) {
    if (
      extraArguments[index] !== '--tests' ||
      typeof extraArguments[index + 1] !== 'string' ||
      extraArguments[index + 1].trim() === ''
    ) {
      throw new Error('FOCUSED_TEST_SELECTOR_REQUIRED');
    }
  }
  return Object.freeze({task, extraArguments: Object.freeze([...extraArguments])});
}

/** A fresh remote Test task may never be accepted from Gradle's cache or skip markers. */
export function classifyGradleTestExecution(log, expectedTask) {
  if (typeof log !== 'string' || typeof expectedTask !== 'string' || expectedTask.trim() === '') {
    return {status: 'FAIL', reason: 'TESTCONTAINERS_TARGET_EXECUTION_LOG_INVALID'};
  }
  const taskPrefix = `> Task ${expectedTask}`;
  const taskLine = log
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line === taskPrefix || line.startsWith(`${taskPrefix} `));
  if (!taskLine) return {status: 'FAIL', reason: 'TESTCONTAINERS_TARGET_TASK_NOT_OBSERVED'};
  const skippedMarker = ['FROM-CACHE', 'UP-TO-DATE', 'NO-SOURCE', 'SKIPPED'].find(marker =>
    taskLine.endsWith(` ${marker}`),
  );
  if (skippedMarker) return {status: 'FAIL', reason: `TESTCONTAINERS_TARGET_NOT_EXECUTED:${skippedMarker}`, taskLine};
  return {status: 'PASS', taskLine};
}

export const validateCleanupReceipt = cleanup => {
  if (cleanup?.status !== 'PASS') throw new Error('RESOURCE_CLEANUP_NOT_PASS');
  for (const component of ['remoteProcess', 'remoteWorkspace', 'testcontainersContainers', 'testcontainersVolumes']) {
    if (cleanup[component] !== 'PASS') throw new Error(`RESOURCE_CLEANUP_COMPONENT_NOT_PASS:${component}`);
  }
  return cleanup;
};

const requireClosedPerformanceCount = (evidence, field, expected = 239) => {
  if (!evidence || evidence.declared !== expected || evidence.observed !== expected || evidence.exceeded !== 0) {
    throw new Error(`RUN_MANIFEST_${field}_NOT_CLOSED`);
  }
};

const requireClosedOperationSet = operationSet => {
  if (
    !operationSet ||
    operationSet.expected !== 239 ||
    operationSet.observed !== 239 ||
    !Array.isArray(operationSet.missing) ||
    !Array.isArray(operationSet.extra) ||
    !Array.isArray(operationSet.drift) ||
    operationSet.missing.length !== 0 ||
    operationSet.extra.length !== 0 ||
    operationSet.drift.length !== 0
  ) {
    throw new Error('RUN_MANIFEST_OPERATION_SET_NOT_CLOSED');
  }
};

const requireClosedNormalSampleMatrix = normalSampleMatrix => {
  if (
    !normalSampleMatrix ||
    normalSampleMatrix.expected !== 239 ||
    normalSampleMatrix.observed !== 239 ||
    typeof normalSampleMatrix.path !== 'string' ||
    normalSampleMatrix.path.trim() === ''
  ) {
    throw new Error('RUN_MANIFEST_NORMAL_SAMPLE_MATRIX_NOT_CLOSED');
  }
};

const validateFullBackendAcceptanceMeasurementEvidence = (measurementEvidence, verificationMode) => {
  if (measurementEvidence?.status !== 'PASS' || measurementEvidence.verificationMode !== verificationMode) {
    throw new Error('RUN_MANIFEST_FULL_MEASUREMENT_EVIDENCE_REQUIRED');
  }
  requireClosedOperationSet(measurementEvidence.operationSet);
  requireClosedPerformanceCount(measurementEvidence.connectionBudgetEvidence, 'CONNECTION_BUDGET');
  requireClosedNormalSampleMatrix(measurementEvidence.normalSampleMatrix);
  if (verificationMode === 'ACCEPTANCE') {
    requireClosedPerformanceCount(measurementEvidence.budgetEvidence, 'BUDGET');
    if (Object.hasOwn(measurementEvidence, 'calibrationEvidence')) {
      throw new Error('RUN_MANIFEST_ACCEPTANCE_CALIBRATION_EVIDENCE_FORBIDDEN');
    }
    return;
  }
  if (measurementEvidence?.calibrationEvidence?.status !== 'PASS') {
    throw new Error('RUN_MANIFEST_CALIBRATION_EVIDENCE_REQUIRED');
  }
  if (Object.hasOwn(measurementEvidence, 'budgetEvidence')) {
    throw new Error('RUN_MANIFEST_CALIBRATION_BUDGET_EVIDENCE_FORBIDDEN');
  }
};

export const parseAndValidateRunManifest = manifest => {
  if (!manifest || manifest.schemaVersion !== 1 || manifest.kind !== 'r5-managed-testcontainers-run')
    throw new Error('RUN_MANIFEST_INVALID');
  for (const key of [
    'runId',
    'task',
    'verificationMode',
    'startedAt',
    'remote',
    'sourceSync',
    'gradleDistribution',
    'logPath',
    'backendAcceptance',
    'workload',
    'testExecution',
    'cleanup',
    'status',
  ]) {
    if (!(key in manifest)) throw new Error(`RUN_MANIFEST_FIELD_MISSING:${key}`);
  }
  if (!BACKEND_ACCEPTANCE_VERIFICATION_MODES.includes(manifest.verificationMode)) {
    throw new Error('RUN_MANIFEST_VERIFICATION_MODE_INVALID');
  }
  if (!/^r5-tc-[0-9]+-[0-9]+$/.test(manifest.runId) || !/^:[a-z0-9:-]+:test$/.test(manifest.task))
    throw new Error('RUN_MANIFEST_IDENTITY_INVALID');
  if (!['PASS', 'FAIL'].includes(manifest.sourceSync.status)) throw new Error('RUN_MANIFEST_SOURCE_SYNC_INVALID');
  validateGradleDistribution(manifest.gradleDistribution);
  if (!['PASS', 'FAIL', 'NOT_RUN'].includes(manifest.testExecution.status))
    throw new Error('RUN_MANIFEST_TEST_EXECUTION_INVALID');
  const backendAcceptance = manifest.backendAcceptance;
  if (
    backendAcceptance !== null &&
    (!backendAcceptance ||
      typeof backendAcceptance.runId !== 'string' ||
      backendAcceptance.runId.trim() === '' ||
      typeof backendAcceptance.operation !== 'string' ||
      backendAcceptance.operation.trim() === '')
  ) {
    throw new Error('RUN_MANIFEST_BACKEND_ACCEPTANCE_IDENTITY_INVALID');
  }
  if (
    manifest.measurementEvidence !== undefined &&
    !['PASS', 'NOT_RUN'].includes(manifest.measurementEvidence.status)
  ) {
    throw new Error('RUN_MANIFEST_MEASUREMENT_EVIDENCE_INVALID');
  }
  if (backendAcceptance === null && manifest.measurementEvidence?.status === 'PASS') {
    throw new Error('RUN_MANIFEST_MEASUREMENT_WITHOUT_BACKEND_ACCEPTANCE');
  }
  if (backendAcceptance?.operation === 'all') {
    if (!manifest.workload || manifest.workload.schemaVersion !== 1
      || typeof manifest.workload.fingerprint !== 'string'
      || !/^[a-f0-9]{64}$/.test(manifest.workload.fingerprint)
      || !manifest.workload.descriptor) {
      throw new Error('RUN_MANIFEST_WORKLOAD_FINGERPRINT_REQUIRED');
    }
    validateFullBackendAcceptanceMeasurementEvidence(manifest.measurementEvidence, manifest.verificationMode);
  } else if (manifest.workload !== null) {
    throw new Error('RUN_MANIFEST_WORKLOAD_UNEXPECTED');
  } else if (manifest.verificationMode === 'CALIBRATION') {
    throw new Error('RUN_MANIFEST_CALIBRATION_REQUIRES_FULL_BACKEND_ACCEPTANCE');
  }
  validateCleanupReceipt(manifest.cleanup);
  if (!['PASS', 'FAIL'].includes(manifest.status)) throw new Error('RUN_MANIFEST_STATUS_INVALID');
  return manifest;
};

export const managedGradleHomeScript = () => 'export V2S_GRADLE_HOME="$gradle"';

const walkFiles = (directory, relative = '') =>
  readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const child = path.join(directory, entry.name);
    const childRelative = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) return walkFiles(child, childRelative);
    return entry.isFile() ? [childRelative] : [];
  });

const gradleDistributionSha256 = distributionHome => {
  const digest = createHash('sha256');
  for (const relativePath of walkFiles(distributionHome).sort()) {
    const file = path.join(distributionHome, relativePath);
    digest
      .update(relativePath)
      .update('\0')
      .update(String(statSync(file).mode & 0o777))
      .update('\0')
      .update(readFileSync(file))
      .update('\0');
  }
  return digest.digest('hex');
};

const commandResult = (binary, args, options = {}) =>
  spawnSync(binary, args, {cwd: root, encoding: 'utf8', ...options});

export const inspectManagedDevState = ({
  manifestPath = path.join(runtime, 'run-manifest.json'),
  exists = existsSync,
  read = readFileSync,
} = {}) => {
  if (!exists(manifestPath)) return Object.freeze({wasRunning: false, runId: null});
  let manifest;
  try {
    manifest = JSON.parse(read(manifestPath, 'utf8'));
  } catch {
    throw new Error('DEV_MANIFEST_INVALID');
  }
  if (
    manifest?.kind !== 'r5-dev-run-manifest' ||
    typeof manifest.runId !== 'string' ||
    !Array.isArray(manifest.processes) ||
    !manifest.remoteJava ||
    typeof manifest.remoteHostTrust?.host !== 'string'
  ) {
    throw new Error('DEV_MANIFEST_INVALID');
  }
  return Object.freeze({wasRunning: true, runId: manifest.runId});
};

export const classifyManagedDevLifecycleCommand = (result, marker) => {
  if (
    result?.status === 0 &&
    String(result.stdout ?? '')
      .split(/\r?\n/)
      .some(line => line.startsWith(marker))
  ) {
    return Object.freeze({status: 'PASS'});
  }
  return Object.freeze({status: 'FAIL', reason: `${marker}_NOT_CONFIRMED`});
};

const remoteResult = body =>
  commandResult('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', remoteHost, 'bash', '-s'], {input: body});
const remote = body => {
  const result = remoteResult(body);
  if (result.status !== 0) throw new Error(`SSH:${compact(result.stderr || result.stdout)}`);
  return result.stdout;
};
const atomicWrite = (target, value) => {
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, value);
  renameSync(temporary, target);
};

const remotePreflight = () => {
  const result = remoteResult(
    script(
      'set -euo pipefail',
      'docker ps -aq --filter label=org.testcontainers=true | sed "s/^/CONTAINER\\t/" || true',
      'docker volume ls -q --filter label=org.testcontainers=true | sed "s/^/VOLUME\\t/" || true',
    ),
  );
  if (result.status !== 0) throw new Error('REMOTE_RESOURCE_PREFLIGHT_UNAVAILABLE');
  const rows = String(result.stdout)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => line.split('\t'));
  const containers = rows.filter(([kind]) => kind === 'CONTAINER').map(([, value]) => value);
  const volumes = rows.filter(([kind]) => kind === 'VOLUME').map(([, value]) => value);
  if (containers.length || volumes.length) throw new Error('REMOTE_TESTCONTAINERS_STALE_RESOURCE');
  return {containers, volumes, observedAt: now()};
};

const waitForClose = child =>
  new Promise(resolve => {
    let settled = false;
    const settle = code => {
      if (!settled) {
        settled = true;
        resolve(code);
      }
    };
    child.once('error', () => settle(-1));
    child.once('close', settle);
  });

const uploadSource = async remoteWorkspace => {
  const source = spawn(
    'tar',
    [
      '--exclude=.git',
      '--exclude=.runtime',
      '--exclude=.gradle',
      '--exclude=.yarn',
      '--exclude=node_modules',
      '--exclude=build',
      '--exclude=*/build',
      '-C',
      root,
      '-czf',
      '-',
      '.',
    ],
    {cwd: root, stdio: ['ignore', 'pipe', 'pipe']},
  );
  const upload = spawn(
    'ssh',
    ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', remoteHost, `tar -xzf - -C ${quote(remoteWorkspace)}`],
    {cwd: root, stdio: ['pipe', 'ignore', 'pipe']},
  );
  const sourceExit = waitForClose(source);
  const uploadExit = waitForClose(upload);
  let diagnostics = '';
  source.stderr.setEncoding('utf8').on('data', chunk => {
    diagnostics += chunk;
  });
  upload.stderr.setEncoding('utf8').on('data', chunk => {
    diagnostics += chunk;
  });
  source.stdout.pipe(upload.stdin);
  const [sourceStatus, uploadStatus] = await Promise.all([sourceExit, uploadExit]);
  if (sourceStatus !== 0 || uploadStatus !== 0) throw new Error(`SOURCE_UPLOAD_FAILED:${compact(diagnostics)}`);
};

const syncGradle = async ({directory, remoteRoot, distribution}) => {
  const syncLog = path.join(directory, 'gradle-sync.log');
  const reusable = remoteResult(
    script(
      'set -euo pipefail',
      `distribution=${quote(distribution.path)}`,
      `expected=${quote(distribution.sha256)}`,
      'marker="$distribution/.v2s-gradle-distribution.sha256"',
      'if test -x "$distribution/bin/gradle" && test -f "$marker" && test "$(cat \"$marker\")" = "$expected"; then printf REUSED; else printf SYNC_REQUIRED; fi',
    ),
  );
  if (reusable.status !== 0) throw new Error('GRADLE_DISTRIBUTION_CHECK_FAILED');
  if (reusable.stdout.trim() === 'REUSED') return {...distribution, status: 'REUSED'};
  if (reusable.stdout.trim() !== 'SYNC_REQUIRED') throw new Error('GRADLE_DISTRIBUTION_CHECK_INVALID');
  const staging = `${remoteRoot}/gradle-distribution-staging`;
  const transfer = spawn(
    'rsync',
    ['-a', '--delete', '--timeout=30', `${distribution.localHome}/`, `${remoteHost}:${staging}/`],
    {cwd: root, stdio: ['ignore', 'pipe', 'pipe']},
  );
  let diagnostics = '';
  const capture = chunk => {
    const text = String(chunk);
    diagnostics += text;
    appendFileSync(syncLog, text);
  };
  transfer.stdout.setEncoding('utf8').on('data', capture);
  transfer.stderr.setEncoding('utf8').on('data', capture);
  if ((await waitForClose(transfer)) !== 0) throw new Error(`GRADLE_SYNC_FAILED:${compact(diagnostics)}`);
  const published = remoteResult(
    script(
      'set -euo pipefail',
      `distribution=${quote(distribution.path)}`,
      `staging=${quote(staging)}`,
      `expected=${quote(distribution.sha256)}`,
      'test -x "$staging/bin/gradle"',
      'if test -x "$distribution/bin/gradle" && test -f "$distribution/.v2s-gradle-distribution.sha256" && test "$(cat \"$distribution/.v2s-gradle-distribution.sha256\")" = "$expected"; then rm -rf "$staging"; printf REUSED_AFTER_RACE; else test ! -e "$distribution"; printf "%s\\n" "$expected" > "$staging/.v2s-gradle-distribution.sha256"; mv "$staging" "$distribution"; printf SYNCED; fi',
    ),
  );
  if (published.status !== 0 || !['SYNCED', 'REUSED_AFTER_RACE'].includes(published.stdout.trim()))
    throw new Error('GRADLE_DISTRIBUTION_PUBLISH_FAILED');
  return {...distribution, status: published.stdout.trim()};
};

const streamRemoteRun = body =>
  new Promise(resolve => {
    const child = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', remoteHost, 'bash', '-s'], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdoutTail = '';
    let stderrTail = '';
    const appendTail = (prior, chunk) => `${prior}${chunk}`.slice(-32_768);
    child.stdout.setEncoding('utf8').on('data', chunk => {
      process.stdout.write(chunk);
      stdoutTail = appendTail(stdoutTail, chunk);
    });
    child.stderr.setEncoding('utf8').on('data', chunk => {
      process.stderr.write(chunk);
      stderrTail = appendTail(stderrTail, chunk);
    });
    child.stdin.end(body);
    child.once('error', error => resolve({status: -1, stdoutTail, stderrTail: appendTail(stderrTail, error.message)}));
    child.once('close', status => resolve({status, stdoutTail, stderrTail}));
  });

const collectArtifacts = (remoteResults, directory) => {
  const result = commandResult('scp', [
    '-o',
    'BatchMode=yes',
    '-o',
    'ConnectTimeout=10',
    '-r',
    `${remoteHost}:${remoteResults}/.`,
    directory,
  ]);
  if (result.status !== 0) throw new Error(`ARTIFACT_COLLECTION_FAILED:${compact(result.stderr || result.stdout)}`);
};

const cleanupRemoteWorkspace = remoteRoot => {
  const result = remoteResult(
    script(
      'set -euo pipefail',
      `root=${quote(remoteRoot)}`,
      'case "$root" in /tmp/r5-tc-[0-9]*-[0-9]*) ;; *) exit 64 ;; esac',
      'rm -rf -- "$root"',
      'test ! -e "$root"',
    ),
  );
  return result.status === 0 ? 'PASS' : 'FAIL';
};

const runScript = ({
  remoteRoot,
  remoteWorkspace,
  remoteResults,
  distribution,
  invocation,
  backendAcceptanceRunId,
  backendAcceptanceOperation,
  verificationMode,
}) => {
  const selectorArguments = invocation.extraArguments.map(quote).join(' ');
  const acceptanceEnvironment = backendAcceptanceEnvironment(
    backendAcceptanceRunId,
    backendAcceptanceOperation,
    verificationMode,
  );
  return script(
    '#!/usr/bin/env bash',
    'set -uo pipefail',
    `root=${quote(remoteRoot)}`,
    `workspace=${quote(remoteWorkspace)}`,
    `results=${quote(remoteResults)}`,
    `gradle=${quote(distribution.path)}`,
    `cache=${quote(remoteDependencyCache)}`,
    `task=${quote(invocation.task)}`,
    'log_file="$results/gradle.log"',
    'docker ps -aq --filter label=org.testcontainers=true | sort > "$root/before-container-ids"',
    'docker volume ls -q --filter label=org.testcontainers=true | sort > "$root/before-volume-ids"',
    'set +e',
    '(',
    '  set -euo pipefail',
    '  cd "$workspace"',
    '  export GRADLE_USER_HOME="$cache"',
    '  export V2S_TESTCONTAINERS_EXECUTION_PLANE=remote',
    `  export V2S_TESTCONTAINERS_REMOTE_HOST=${quote(remoteHost)}`,
    '  export TESTCONTAINERS_RYUK_DISABLED=true',
    '  export V2S_GRADLE_HOME="$gradle"',
    ...acceptanceEnvironment.map(line => `  ${line}`),
    // The managed artifact is the sole durable diagnostic after the remote
    // workspace is reclaimed. Keep the causal test stack in that artifact;
    // Gradle's default console summary otherwise reduces setup failures to a
    // class and line number, which is not enough to identify the boundary.
    `  "$gradle/bin/gradle" --no-daemon --rerun-tasks --stacktrace "$task" ${selectorArguments}`,
    ') 2>&1 | tee "$log_file"',
    'gradle_status=${PIPESTATUS[0]}',
    // The remote workspace is deliberately reclaimed below.  Preserve the
    // machine-readable JUnit failure detail before that happens: Gradle's
    // console summary often retains only an exception type and line number.
    'find "$workspace" -type f -path "*/build/test-results/test/*.xml" -print0 | while IFS= read -r -d "" file; do',
    '  relative="${file#"$workspace"/}"',
    '  target="$results/test-results/$relative"',
    '  mkdir -p "$(dirname "$target")"',
    '  cp "$file" "$target"',
    'done',
    'archive_index="$results/evidence-artifacts.tsv"',
    ': > "$archive_index"',
    'archive_evidence() {',
    '  file="$1"',
    '  test -f "$file" || return 0',
    '  name="$(basename "$file")"',
    '  raw_bytes="$(wc -c < "$file" | tr -d " ")"',
    "  raw_sha256=\"$(sha256sum \"$file\" | awk '{print $1}')\"",
    '  gzip -9 -- "$file"',
    '  archive="$file.gz"',
    '  archive_bytes="$(wc -c < "$archive" | tr -d " ")"',
    "  archive_sha256=\"$(sha256sum \"$archive\" | awk '{print $1}')\"",
    '  printf "%s\\t%s\\t%s\\t%s\\t%s\\n" "$name" "$raw_bytes" "$raw_sha256" "$archive_bytes" "$archive_sha256" >> "$archive_index"',
    '}',
    ...ARCHIVED_EVIDENCE_ARTIFACTS.map(name => `archive_evidence "$results/${name}"`),
    'docker ps -aq --filter label=org.testcontainers=true | sort > "$root/after-container-ids"',
    'docker volume ls -q --filter label=org.testcontainers=true | sort > "$root/after-volume-ids"',
    'container_cleanup=FAIL; cmp -s "$root/before-container-ids" "$root/after-container-ids" && container_cleanup=PASS',
    'volume_cleanup=FAIL; cmp -s "$root/before-volume-ids" "$root/after-volume-ids" && volume_cleanup=PASS',
    'printf "REMOTE_GRADLE_STATUS=%s\\n" "$gradle_status"',
    'printf "REMOTE_TESTCONTAINERS_CONTAINERS=%s\\n" "$container_cleanup"',
    'printf "REMOTE_TESTCONTAINERS_VOLUMES=%s\\n" "$volume_cleanup"',
    'exit 0',
  );
};

const marker = (output, name) => output.match(new RegExp(`(?:^|\\n)${name}=([^\\r\\n]+)`))?.[1]?.trim();

const execute = async () => {
  const invocation = validateInvocationArguments(process.argv.slice(2));
  const gradleHomeResolution = resolveGradleHome();
  validateGradleHome(
    gradleHomeResolution.path,
    typeof gradleHomeResolution.path === 'string' && existsSync(path.join(gradleHomeResolution.path, 'bin', 'gradle')),
  );
  const gradleSha256 = gradleDistributionSha256(gradleHomeResolution.path);
  const distribution = {
    path: remoteGradleDistributionPath(gradleSha256),
    sha256: gradleSha256,
    localHome: gradleHomeResolution.path,
    localHomeSource: gradleHomeResolution.source,
    status: 'PENDING',
  };
  const runId = `r5-tc-${Date.now()}-${process.pid}`;
  const remoteRoot = `/tmp/${runId}`;
  const remoteWorkspace = `${remoteRoot}/workspace`;
  const remoteResults = `${remoteRoot}/results`;
  const directory = path.join(evidence, runId);
  const backendAcceptanceRunId =
    process.env.V2S_BACKEND_ACCEPTANCE_EXECUTION === 'true' &&
    invocation.extraArguments.includes(backendAcceptanceSelector)
      ? `backend-acceptance-${runId}`
      : null;
  const backendAcceptanceOperation = process.env.V2S_BACKEND_ACCEPTANCE_OPERATION ?? 'all';
  const verificationMode = process.env.V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE ?? 'ACCEPTANCE';
  if (!BACKEND_ACCEPTANCE_VERIFICATION_MODES.includes(verificationMode)) {
    throw new Error('BACKEND_ACCEPTANCE_VERIFICATION_MODE_INVALID');
  }
  if (verificationMode === 'CALIBRATION' && (backendAcceptanceRunId === null || backendAcceptanceOperation !== 'all')) {
    throw new Error('BACKEND_ACCEPTANCE_CALIBRATION_REQUIRES_FULL_RUN');
  }
  const exactSetRequired = requiresFullPerformanceVerification(backendAcceptanceRunId, backendAcceptanceOperation);
  const activeBudgetRequired = requiresActiveBudgetVerification(
    backendAcceptanceRunId,
    backendAcceptanceOperation,
    verificationMode,
  );
  const performanceOperationRegistry = exactSetRequired ? loadPerformanceOperationRegistry({root}) : null;
  const workload = exactSetRequired
    ? fullPerformanceWorkload({
      task: invocation.task,
      operation: backendAcceptanceOperation,
      verificationMode,
      registry: performanceOperationRegistry,
    })
    : null;
  mkdirSync(directory, {recursive: true});
  const manifestPath = path.join(directory, 'run-manifest.json');
  const manifest = {
    schemaVersion: 1,
    kind: 'r5-managed-testcontainers-run',
    runId,
    task: invocation.task,
    verificationMode,
    startedAt: now(),
    remote: {
      hostAlias: remoteHost,
      hostTrust: remoteHostTrust,
      root: remoteRoot,
      dependencyCache: remoteDependencyCache,
    },
    sourceSync: {status: 'FAIL', workspace: remoteWorkspace},
    gradleDistribution: distribution,
    logPath: `${remoteResults}/gradle.log`,
    testExecution: {status: 'NOT_RUN'},
    backendAcceptance:
      backendAcceptanceRunId === null ? null : {runId: backendAcceptanceRunId, operation: backendAcceptanceOperation},
    workload: workload === null ? null : workload,
    measurementEvidence: {status: 'NOT_RUN'},
    evidenceArchive: {status: 'NOT_RUN'},
    cleanup: {
      status: 'FAIL',
      remoteProcess: 'FAIL',
      remoteWorkspace: 'FAIL',
      testcontainersContainers: 'FAIL',
      testcontainersVolumes: 'FAIL',
    },
    status: 'FAIL',
    firstFailure: null,
    devLifecycle: {
      wasRunning: false,
      managedDevRunId: null,
      stop: {status: 'NOT_RUN'},
      restore: {status: 'NOT_APPLICABLE'},
      cleanup: 'NOT_APPLICABLE',
    },
  };
  const persist = () => atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  let remotePrepared = false;
  let remoteRun;
  let failure;
  let backendAcceptanceResult;
  let measurementEvidence;
  let devState;
  runnerEvent('STARTED', {RUN_ID: runId, TASK: invocation.task, MODE: 'FOCUSED'});
  try {
    devState = inspectManagedDevState();
    manifest.devLifecycle.wasRunning = devState.wasRunning;
    manifest.devLifecycle.managedDevRunId = devState.runId;
    if (devState.wasRunning) {
      const stopResult = commandResult(path.join(root, 'scripts/dev/stop'), [], {
        env: {...process.env, V2S_RUNTIME_DIR: runtime},
      });
      manifest.devLifecycle.stop = classifyManagedDevLifecycleCommand(stopResult, 'R5_DEV_STOP=PASS');
      if (manifest.devLifecycle.stop.status !== 'PASS') throw new Error('DEV_STOP_FAILED');
      manifest.devLifecycle.cleanup = 'PENDING';
    }
    persist();
    const localBudget = commandResult(path.join(root, 'scripts/env/check-runtime-resource-budget'), [
      path.join(root, '.runtime'),
    ]);
    if (localBudget.status !== 0) throw new Error('LOCAL_MANAGED_RESOURCE_BUDGET_EXCEEDED');
    manifest.resourcePreflight = remotePreflight();
    remote(
      script(
        'set -euo pipefail',
        `root=${quote(remoteRoot)}`,
        `workspace=${quote(remoteWorkspace)}`,
        `results=${quote(remoteResults)}`,
        `cache=${quote(remoteDependencyCache)}`,
        'case "$root" in /tmp/r5-tc-[0-9]*-[0-9]*) ;; *) exit 64 ;; esac',
        'case "$cache" in /tmp/catering-v2s-r5-gradle-cache) ;; *) exit 64 ;; esac',
        'mkdir -p "$workspace" "$results" "$cache"',
      ),
    );
    remotePrepared = true;
    await uploadSource(remoteWorkspace);
    manifest.sourceSync = {status: 'PASS', workspace: remoteWorkspace};
    manifest.gradleDistribution = await syncGradle({directory, remoteRoot, distribution});
    persist();
    remoteRun = await streamRemoteRun(
      runScript({
        remoteRoot,
        remoteWorkspace,
        remoteResults,
        distribution: manifest.gradleDistribution,
        invocation,
        backendAcceptanceRunId,
        backendAcceptanceOperation,
        verificationMode,
      }),
    );
    if (remoteRun.status !== 0)
      throw new Error(`REMOTE_RUNNER_UNAVAILABLE:${compact(remoteRun.stderrTail || remoteRun.stdoutTail)}`);
    collectArtifacts(remoteResults, directory);
    if (backendAcceptanceRunId !== null) {
      const archiveRows = parseEvidenceArchiveIndex(
        readFileSync(path.join(directory, 'evidence-artifacts.tsv'), 'utf8'),
      );
      for (const name of ARCHIVED_EVIDENCE_ARTIFACTS) readEvidenceArtifact(directory, name);
      manifest.evidenceArchive = {
        status: 'PASS',
        indexPath: path.relative(root, path.join(directory, 'evidence-artifacts.tsv')),
        artifacts: archiveRows.map(row => ({
          name: row.name,
          rawBytes: row.rawBytes,
          rawSha256: row.rawSha256,
          archiveBytes: row.archiveBytes,
          archiveSha256: row.archiveSha256,
        })),
      };
    }
    const gradleLog = readFileSync(path.join(directory, 'gradle.log'), 'utf8');
    const actualExecution = classifyGradleTestExecution(gradleLog, invocation.task);
    const remoteGradleStatus = marker(remoteRun.stdoutTail, 'REMOTE_GRADLE_STATUS');
    const containers = marker(remoteRun.stdoutTail, 'REMOTE_TESTCONTAINERS_CONTAINERS');
    const volumes = marker(remoteRun.stdoutTail, 'REMOTE_TESTCONTAINERS_VOLUMES');
    manifest.testExecution = {...actualExecution, remoteGradleStatus: remoteGradleStatus ?? 'UNAVAILABLE'};
    manifest.cleanup = {
      status: containers === 'PASS' && volumes === 'PASS' ? 'PASS' : 'FAIL',
      remoteProcess: remoteGradleStatus !== undefined ? 'PASS' : 'FAIL',
      remoteWorkspace: 'PENDING',
      testcontainersContainers: containers === 'PASS' ? 'PASS' : 'FAIL',
      testcontainersVolumes: volumes === 'PASS' ? 'PASS' : 'FAIL',
    };
    if (backendAcceptanceRunId !== null)
      backendAcceptanceResult = parseBackendAcceptanceResult(
        readEvidenceArtifact(directory, 'backend-acceptance-result.jsonl'),
      );
    if (actualExecution.status !== 'PASS') throw new Error(actualExecution.reason);
    if (remoteGradleStatus !== '0') throw new Error('REMOTE_GRADLE_EXIT_NONZERO');
    if (manifest.cleanup.status !== 'PASS') throw new Error('REMOTE_TESTCONTAINERS_RESOURCE_NOT_RECLAIMED');
    if (backendAcceptanceResult?.summary.stubOnly > 0) throw new Error('BACKEND_ACCEPTANCE_STUB_BUSINESS_NOT_ALLOWED');
    if (backendAcceptanceResult?.summary.directFailures > 0) throw new Error('BACKEND_ACCEPTANCE_SCENARIO_FAILURE');
    if (backendAcceptanceRunId !== null) {
      measurementEvidence = parseHttpRequestEvents(
        readEvidenceArtifact(directory, 'http-request-events.jsonl'),
        backendAcceptanceRunId,
      );
      assertUnclassifiedSqlRatio(measurementEvidence);
      const performanceEvidence = activeBudgetRequired
        ? verifyFullBackendAcceptancePerformance(performanceOperationRegistry, measurementEvidence.rows)
        : exactSetRequired
          ? verifyFullBackendAcceptanceCalibration(performanceOperationRegistry, measurementEvidence.rows)
          : null;
      const operationSet = performanceEvidence?.operationSet ?? null;
      const budgetEvidence = performanceEvidence?.budgetEvidence ?? null;
      const connectionBudgetEvidence = performanceEvidence?.connectionBudgetEvidence ?? null;
      const normalSampleMatrix = performanceEvidence?.normalSampleMatrix ?? null;
      const normalSampleMatrixPath = normalSampleMatrix ? path.join(directory, 'normal-sample-matrix.json') : null;
      if (normalSampleMatrixPath)
        writeFileSync(normalSampleMatrixPath, `${JSON.stringify(normalSampleMatrix, null, 2)}\n`);
      manifest.measurementEvidence = {
        status: 'PASS',
        verificationMode,
        ...measurementEvidence.summary,
        ...(operationSet ? {operationSet} : {}),
        ...(budgetEvidence ? {budgetEvidence} : {}),
        ...(verificationMode === 'CALIBRATION' ? {calibrationEvidence: {status: 'PASS'}} : {}),
        ...(connectionBudgetEvidence ? {connectionBudgetEvidence} : {}),
        ...(normalSampleMatrix
          ? {
              normalSampleMatrix: {
                expected: normalSampleMatrix.expected,
                observed: normalSampleMatrix.observed,
                path: path.relative(root, normalSampleMatrixPath),
              },
            }
          : {}),
      };
    }
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
    manifest.firstFailure = failure.message;
  } finally {
    if (remotePrepared) {
      if (!existsSync(path.join(directory, 'gradle.log'))) {
        try {
          collectArtifacts(remoteResults, directory);
        } catch (collectionError) {
          manifest.artifactCollection = {status: 'FAIL', reason: compact(collectionError.message)};
        }
      }
      manifest.cleanup.remoteWorkspace = cleanupRemoteWorkspace(remoteRoot);
    }
    if (manifest.cleanup.remoteWorkspace !== 'PASS') manifest.cleanup.status = 'FAIL';
    if (devState?.wasRunning) {
      if (!failure && manifest.testExecution.status === 'PASS' && manifest.cleanup.status === 'PASS') {
        const startResult = commandResult(path.join(root, 'scripts/dev/start'), [], {
          env: {...process.env, V2S_RUNTIME_DIR: runtime},
        });
        manifest.devLifecycle.restore = classifyManagedDevLifecycleCommand(startResult, 'R5_DEV_START=PASS');
        if (manifest.devLifecycle.restore.status === 'PASS') manifest.devLifecycle.cleanup = 'PASS';
        else {
          manifest.devLifecycle.cleanup = 'FAIL';
          failure = new Error('DEV_RESTART_FAILED');
          manifest.firstFailure ??= failure.message;
        }
      } else {
        manifest.devLifecycle.restore = {status: 'NOT_RUN', reason: 'TEST_NOT_PASS'};
        manifest.devLifecycle.cleanup = 'NOT_RUN';
      }
    }
    manifest.completedAt = now();
    manifest.status =
      !failure && manifest.testExecution.status === 'PASS' && manifest.cleanup.status === 'PASS' ? 'PASS' : 'FAIL';
    persist();
  }
  if (manifest.status === 'PASS') {
    parseAndValidateRunManifest(manifest);
    if (backendAcceptanceResult) {
      for (const row of backendAcceptanceResult.rows) {
        process.stdout.write(
          `BACKEND_ACCEPTANCE_RESULT SCENARIO=${row.operation} MODULE=${row.module} CONTRACT=${row.contract} BUSINESS=${row.business} DB_OPERATIONS=${row.dbOperations}\n`,
        );
      }
      process.stdout.write(
        `BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=${backendAcceptanceResult.summary.discovered} SELECTED=${backendAcceptanceResult.summary.selected} HTTP_SUCCESS=${backendAcceptanceResult.summary.httpSuccess} REAL_BUSINESS_ASSERTIONS=${backendAcceptanceResult.summary.realBusinessAssertions} STUB_ONLY=${backendAcceptanceResult.summary.stubOnly} DIRECT_FAILURES=${backendAcceptanceResult.summary.directFailures}\n`,
      );
    }
    if (measurementEvidence) {
      process.stdout.write(
        `BACKEND_PERFORMANCE_MEASUREMENT DISCOVERED=${measurementEvidence.summary.discovered} SQL_OPERATIONS=${measurementEvidence.summary.sqlOperations} UNCLASSIFIED_SQL=${measurementEvidence.summary.unclassifiedSqlOperations} UNCLASSIFIED_SQL_RATIO=${measurementEvidence.summary.unclassifiedSqlRatio}\n`,
      );
      if (manifest.measurementEvidence.operationSet) {
        process.stdout.write(
          `BACKEND_PERFORMANCE_OPERATION_SET EXPECTED=${manifest.measurementEvidence.operationSet.expected} OBSERVED=${manifest.measurementEvidence.operationSet.observed} MISSING=${manifest.measurementEvidence.operationSet.missing.length} EXTRA=${manifest.measurementEvidence.operationSet.extra.length} DRIFT=${manifest.measurementEvidence.operationSet.drift.length}\n`,
        );
      }
    }
    process.stdout.write(
      `R5_REMOTE_TESTCONTAINERS=PASS; TASK=${invocation.task}; EVIDENCE=${path.relative(root, directory)}; RESOURCE_CLEANUP=PASS\n`,
    );
  } else {
    process.stderr.write(
      `R5_REMOTE_TESTCONTAINERS=FAIL; REASON=${compact(failure?.message || manifest.firstFailure || 'TEST_OR_RESOURCE_CLEANUP_FAILED')}; EVIDENCE=${path.relative(root, directory)}; RESOURCE_CLEANUP=${manifest.cleanup.status}\n`,
    );
    process.exitCode = 2;
  }
  runnerEvent('FINISHED', {
    RUN_ID: runId,
    TASK: invocation.task,
    STATUS: manifest.status,
    EVIDENCE: path.relative(root, directory),
  });
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain)
  execute().catch(error => {
    process.stderr.write(`R5_REMOTE_TESTCONTAINERS=FAIL; REASON=${compact(error.message)}\n`);
    process.exitCode = 2;
  });
