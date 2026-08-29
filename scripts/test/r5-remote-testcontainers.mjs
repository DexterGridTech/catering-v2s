#!/usr/bin/env node
/** Runs one focused Testcontainers Gradle task on the approved remote host. */
import {createHash, randomUUID} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
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
import {BACKEND_PERFORMANCE_OPERATION_COUNTS} from '../policy/backend-performance-operation-counts.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR ?? path.join(root, '.runtime/r5'));
const evidence = path.join(runtime, 'evidence', 'remote-testcontainers');
const remoteDependencyCache = '/tmp/catering-v2s-r5-gradle-cache';
const remoteGradleDistributionPrefix = '/tmp/catering-v2s-r5-gradle-distribution-';
const remoteHostTrust = resolveTrustedRemoteHost(process.env);
const remoteHost = remoteHostTrust.host;
const backendAcceptanceSelector = 'com.catering.v2s.app.acceptance.BackendAcceptanceTest';
const EXPECTED_OPERATION_COUNT = BACKEND_PERFORMANCE_OPERATION_COUNTS.operations;

const now = () => new Date().toISOString();
const sha256 = value => createHash('sha256').update(value).digest('hex');
const localRunLockPath = path.join(runtime, `remote-testcontainers.${sha256(remoteHost).slice(0, 16)}.lock`);
const stableValue = value => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, stableValue(value[key])]),
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

/**
 * A production mutation is applied only after the source has been copied to the
 * run-owned remote staging root.  The specification is intentionally closed:
 * this harness has one proof mutation, not a caller-controlled source editor.
 */
export const PRODUCTION_MUTATION_SPECS = Object.freeze({
  'extension-definition-second-field-status': Object.freeze({
    id: 'extension-definition-second-field-status',
    operationId: 'replaceExtensionDefinition',
    scenarioId: 'pagination.extension-definition-aggregate-closure',
    scenarioOperation: 'extensionDefinitionAggregateClosure',
    module: 'EXTENSION',
    pointer: '/definitions/1/status',
    file: 'apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/extension/ExtensionDefinitionWireMapper.java',
    symbol: 'field',
    anchor: 'private static ExtensionDefinitionDefinitionsItem field(ExtensionDefinitionReadback.Field value)',
    from: 'value.status()',
    to: 'value.displayOrder() == 1 ? "ENABLED" : value.status()',
    replaceCount: 1,
    expectedSignal: 'HTTP=200;CONTRACT=PASS;BUSINESS=FAIL;failureCategory=BUSINESS_ORACLE',
  }),
});

export function resolveProductionMutation(id) {
  if (typeof id !== 'string' || id.trim() === '') throw new Error('PRODUCTION_MUTATION_ID_REQUIRED');
  const mutation = PRODUCTION_MUTATION_SPECS[id];
  if (!mutation) throw new Error(`PRODUCTION_MUTATION_ID_UNKNOWN:${id}`);
  return mutation;
}

const literalOccurrenceCount = (source, literal) => {
  if (typeof source !== 'string' || typeof literal !== 'string' || literal === '') return 0;
  let count = 0;
  let offset = 0;
  while (true) {
    const index = source.indexOf(literal, offset);
    if (index < 0) return count;
    count += 1;
    offset = index + literal.length;
  }
};

const enclosedMethod = (source, anchor) => {
  const anchorIndex = source.indexOf(anchor);
  if (anchorIndex < 0) throw new Error(`PRODUCTION_MUTATION_ANCHOR_NOT_FOUND:${anchor}`);
  const openingBrace = source.indexOf('{', anchorIndex + anchor.length);
  if (openingBrace < 0) throw new Error(`PRODUCTION_MUTATION_METHOD_BODY_NOT_FOUND:${anchor}`);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return Object.freeze({start: openingBrace, end: index + 1});
    }
  }
  throw new Error(`PRODUCTION_MUTATION_METHOD_BODY_UNCLOSED:${anchor}`);
};

/**
 * Computes the exact source edit without writing it.  The returned hashes are
 * later checked against the copy in the remote staging root before Gradle is
 * started, so an upload/source drift cannot silently become mutation evidence.
 */
export function prepareProductionMutation({repositoryRoot = root, mutation}) {
  const spec = typeof mutation === 'string' ? resolveProductionMutation(mutation) : mutation;
  if (!spec || typeof spec !== 'object') throw new Error('PRODUCTION_MUTATION_SPEC_REQUIRED');
  const target = path.resolve(repositoryRoot, spec.file);
  const relativeTarget = path.relative(repositoryRoot, target);
  if (!relativeTarget || relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
    throw new Error(`PRODUCTION_MUTATION_FILE_OUTSIDE_REPOSITORY:${spec.id}`);
  }
  if (!existsSync(target)) throw new Error(`PRODUCTION_MUTATION_FILE_NOT_FOUND:${spec.file}`);
  const source = readFileSync(target, 'utf8');
  const method = enclosedMethod(source, spec.anchor);
  const methodSource = source.slice(method.start, method.end);
  const replaceCount = literalOccurrenceCount(methodSource, spec.from);
  if (replaceCount !== spec.replaceCount) {
    throw new Error(`PRODUCTION_MUTATION_REPLACE_COUNT_MISMATCH:${spec.id}:${replaceCount}!=${spec.replaceCount}`);
  }
  const index = method.start + methodSource.indexOf(spec.from);
  const mutatedSource = source.slice(0, index) + spec.to + source.slice(index + spec.from.length);
  if (mutatedSource === source) throw new Error(`PRODUCTION_MUTATION_NO_SOURCE_CHANGE:${spec.id}`);
  return Object.freeze({
    id: spec.id,
    file: spec.file,
    replaceCount,
    sourceBeforeSha256: sha256(source),
    sourceAfterSha256: sha256(mutatedSource),
  });
}

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

export const backendAcceptanceEnvironment = (
  runId,
  operation = 'all',
  verificationMode = 'ACCEPTANCE',
  batchCardinality = null,
) =>
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
        ...(batchCardinality === null || batchCardinality === undefined || batchCardinality === ''
          ? []
          : [`export V2S_BACKEND_ACCEPTANCE_BATCH_CARDINALITY=${quote(batchCardinality)}`]),
        // The complete exact-set workload needs the existing P2 normal recipes.
        // They cannot remain caller-selected diagnostics: coverage-only probes
        // deliberately do not satisfy the normal performance denominator.
        ...(operation === 'all' ? ['export V2S_BACKEND_P2_CONNECTION_SCOPE_PROOF=true'] : []),
        // A managed whole-suite run is the canonical generated-operation measurement workload.
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

// A failed Gradle preflight may still leave an empty archive index behind.  An
// entry is the boundary that proves the acceptance process produced evidence;
// callers must not require the four archived artifacts before that boundary.
export const hasArchivedEvidenceIndexEntries = directory => {
  const indexPath = path.join(directory, 'evidence-artifacts.tsv');
  return existsSync(indexPath) && readFileSync(indexPath, 'utf8').trim().length > 0;
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

export const validateEvidenceArchiveReceipt = receipt => {
  if (!receipt || receipt.status !== 'PASS') throw new Error('RUN_MANIFEST_EVIDENCE_ARCHIVE_REQUIRED');
  if (typeof receipt.indexPath !== 'string' || receipt.indexPath.trim() === '') {
    throw new Error('RUN_MANIFEST_EVIDENCE_ARCHIVE_INDEX_REQUIRED');
  }
  if (!Array.isArray(receipt.artifacts)) throw new Error('RUN_MANIFEST_EVIDENCE_ARCHIVE_ARTIFACTS_REQUIRED');
  const names = new Set();
  for (const artifact of receipt.artifacts) {
    if (
      !artifact ||
      !ARCHIVED_EVIDENCE_ARTIFACTS.includes(artifact.name) ||
      !Number.isInteger(artifact.rawBytes) ||
      artifact.rawBytes < 0 ||
      !/^[a-f0-9]{64}$/.test(artifact.rawSha256 ?? '') ||
      !Number.isInteger(artifact.archiveBytes) ||
      artifact.archiveBytes < 0 ||
      !/^[a-f0-9]{64}$/.test(artifact.archiveSha256 ?? '') ||
      names.has(artifact.name)
    ) {
      throw new Error('RUN_MANIFEST_EVIDENCE_ARCHIVE_ARTIFACT_INVALID');
    }
    names.add(artifact.name);
  }
  const missing = ARCHIVED_EVIDENCE_ARTIFACTS.filter(name => !names.has(name));
  if (missing.length > 0) throw new Error(`RUN_MANIFEST_EVIDENCE_ARCHIVE_NOT_CLOSED:${missing.join(',')}`);
  return receipt;
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

/**
 * Confirms the one allowed production mutation was observed at the real HTTP
 * boundary.  A failing BUSINESS assertion is the expected red result here;
 * it is never converted into a normal acceptance PASS.
 */
export function verifyProductionMutationOutcome({mutation, backendAcceptanceResult, httpEvents}) {
  if (!mutation || !backendAcceptanceResult || !Array.isArray(httpEvents)) {
    throw new Error('PRODUCTION_MUTATION_OUTCOME_INPUT_INVALID');
  }
  const rows = backendAcceptanceResult.rows;
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error('PRODUCTION_MUTATION_SCENARIO_CARDINALITY_INVALID');
  }
  const [row] = rows;
  if (
    row.operation !== mutation.scenarioId ||
    row.module !== mutation.module ||
    row.contract !== 'PASS' ||
    row.business !== 'FAIL' ||
    row.businessMode !== 'REAL' ||
    row.status !== 'FAIL' ||
    row.failureCategory !== 'BUSINESS_ORACLE'
  ) {
    throw new Error('PRODUCTION_MUTATION_BUSINESS_SIGNAL_INVALID');
  }
  const operationEvents = httpEvents.filter(event => event.operationId === mutation.operationId);
  const matchingEvents = operationEvents.filter(event => event.status === 200 && event.outcome === 'SUCCEEDED');
  if (operationEvents.length !== 1 || matchingEvents.length !== 1) {
    throw new Error(`PRODUCTION_MUTATION_HTTP_SIGNAL_INVALID:${operationEvents.length}:${matchingEvents.length}`);
  }
  const [event] = matchingEvents;
  const signal = `HTTP=${event.status};CONTRACT=${row.contract};BUSINESS=${row.business};failureCategory=${row.failureCategory}`;
  if (signal !== mutation.expectedSignal) throw new Error('PRODUCTION_MUTATION_EXPECTED_SIGNAL_INVALID');
  return Object.freeze({
    signal,
    operationId: mutation.operationId,
    scenarioId: mutation.scenarioId,
    pointer: mutation.pointer,
    httpStatus: event.status,
    httpOutcome: event.outcome,
    httpEventCount: matchingEvents.length,
    failureCategory: row.failureCategory,
  });
}

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
  const gradleArguments = [];
  let productionMutationId;
  for (let index = 0; index < extraArguments.length; ) {
    if (extraArguments[index] === '--tests') {
      if (typeof extraArguments[index + 1] !== 'string' || extraArguments[index + 1].trim() === '') {
        throw new Error('FOCUSED_TEST_SELECTOR_REQUIRED');
      }
      gradleArguments.push(extraArguments[index], extraArguments[index + 1]);
      index += 2;
      continue;
    }
    if (extraArguments[index] === '--production-mutation') {
      if (productionMutationId !== undefined) throw new Error('PRODUCTION_MUTATION_DUPLICATE');
      productionMutationId = extraArguments[index + 1];
      resolveProductionMutation(productionMutationId);
      index += 2;
      continue;
    }
    throw new Error('FOCUSED_TEST_SELECTOR_REQUIRED');
  }
  const invocation = {task, extraArguments: Object.freeze(gradleArguments)};
  if (productionMutationId !== undefined) invocation.productionMutationId = productionMutationId;
  return Object.freeze(invocation);
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

export function firstGradleFailureCode(log) {
  if (typeof log !== 'string') return null;
  return log.match(/(?:^|\r?\n)Error:\s+([A-Z][A-Z0-9_]*(?::[A-Z0-9_.-]+)*)/)?.[1] ?? null;
}

export const requiresBackendAcceptanceEvidence = (backendAcceptanceRunId, targetTaskObserved) =>
  backendAcceptanceRunId !== null && targetTaskObserved;

export const validateCleanupReceipt = cleanup => {
  if (cleanup?.status !== 'PASS') throw new Error('RESOURCE_CLEANUP_NOT_PASS');
  for (const component of ['remoteProcess', 'remoteWorkspace', 'testcontainersContainers', 'testcontainersVolumes']) {
    if (cleanup[component] !== 'PASS') throw new Error(`RESOURCE_CLEANUP_COMPONENT_NOT_PASS:${component}`);
  }
  return cleanup;
};

export const validateProductionMutationReceipt = mutation => {
  const expected = resolveProductionMutation(mutation?.id);
  for (const field of [
    'operationId',
    'scenarioId',
    'scenarioOperation',
    'module',
    'pointer',
    'file',
    'symbol',
    'from',
    'to',
    'replaceCount',
    'expectedSignal',
  ]) {
    if (mutation[field] !== expected[field]) throw new Error(`PRODUCTION_MUTATION_RECEIPT_${field.toUpperCase()}_INVALID`);
  }
  if (mutation.status !== 'PASS' || mutation.verdict !== 'PASS' || mutation.business !== 'FAIL' || mutation.cleanup !== 'PASS') {
    throw new Error('PRODUCTION_MUTATION_RECEIPT_VERDICT_INVALID');
  }
  for (const field of ['sourceBeforeSha256', 'sourceAfterSha256', 'stagingSnapshotHash']) {
    if (!/^[a-f0-9]{64}$/.test(mutation[field] ?? '')) {
      throw new Error(`PRODUCTION_MUTATION_RECEIPT_${field.toUpperCase()}_INVALID`);
    }
  }
  const observed = mutation.observed;
  if (
    !observed ||
    observed.operationId !== expected.operationId ||
    observed.scenarioId !== expected.scenarioId ||
    observed.pointer !== expected.pointer ||
    observed.httpStatus !== 200 ||
    observed.httpOutcome !== 'SUCCEEDED' ||
    observed.httpEventCount !== 1 ||
    observed.failureCategory !== 'BUSINESS_ORACLE'
  ) {
    throw new Error('PRODUCTION_MUTATION_RECEIPT_OBSERVATION_INVALID');
  }
  return mutation;
};

const requireClosedPerformanceCount = (evidence, field, expected = EXPECTED_OPERATION_COUNT) => {
  if (!evidence || evidence.declared !== expected || evidence.observed !== expected || evidence.exceeded !== 0) {
    throw new Error(`RUN_MANIFEST_${field}_NOT_CLOSED`);
  }
};

const requireClosedOperationSet = operationSet => {
  if (
    !operationSet ||
    operationSet.expected !== EXPECTED_OPERATION_COUNT ||
    operationSet.observed !== EXPECTED_OPERATION_COUNT ||
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
    normalSampleMatrix.expected !== EXPECTED_OPERATION_COUNT ||
    normalSampleMatrix.observed !== EXPECTED_OPERATION_COUNT ||
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
  if (manifest.business !== undefined && !['PASS', 'FAIL', 'NOT_RUN', 'NOT_APPLICABLE'].includes(manifest.business)) {
    throw new Error('RUN_MANIFEST_BUSINESS_STATUS_INVALID');
  }
  if (manifest.productionMutation !== undefined && manifest.productionMutation !== null) {
    validateProductionMutationReceipt(manifest.productionMutation);
  }
  if (backendAcceptance?.operation === 'all') {
    if (
      !manifest.workload ||
      manifest.workload.schemaVersion !== 1 ||
      typeof manifest.workload.fingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(manifest.workload.fingerprint) ||
      !manifest.workload.descriptor
    ) {
      throw new Error('RUN_MANIFEST_WORKLOAD_FINGERPRINT_REQUIRED');
    }
    validateFullBackendAcceptanceMeasurementEvidence(manifest.measurementEvidence, manifest.verificationMode);
  } else if (manifest.workload !== null) {
    throw new Error('RUN_MANIFEST_WORKLOAD_UNEXPECTED');
  } else if (manifest.verificationMode === 'CALIBRATION') {
    throw new Error('RUN_MANIFEST_CALIBRATION_REQUIRES_FULL_BACKEND_ACCEPTANCE');
  }
  if (backendAcceptance !== null && manifest.status === 'PASS')
    validateEvidenceArchiveReceipt(manifest.evidenceArchive);
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

const canonicalStartToken = value =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const processStartToken = pid => {
  const result = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], {encoding: 'utf8'});
  const token = canonicalStartToken(result.stdout);
  return result.status === 0 && token ? token : null;
};

const processAlive = pid => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export const acquireLocalRunLock = (
  lockPath = localRunLockPath,
  {
    pid = process.pid,
    startToken = processStartToken(pid),
    alive = processAlive,
    startTokenForPid = processStartToken,
    nowValue = now(),
    ownerToken = randomUUID(),
    remoteHostValue = remoteHost,
  } = {},
) => {
  const ownerPath = path.join(lockPath, 'owner.json');
  const owner = {
    pid,
    startToken: canonicalStartToken(startToken),
    ownerToken,
    remoteHost: remoteHostValue,
    startedAt: nowValue,
  };
  if (!Number.isInteger(owner.pid) || owner.pid <= 0 || owner.startToken === '') {
    throw new Error('LOCAL_TESTCONTAINERS_RUN_LOCK_OWNER_INVALID');
  }
  const priorIsLive = prior =>
    Number.isInteger(prior?.pid) &&
    typeof prior.startToken === 'string' &&
    canonicalStartToken(prior.startToken) !== '' &&
    alive(prior.pid) &&
    canonicalStartToken(startTokenForPid(prior.pid)) === canonicalStartToken(prior.startToken);
  const write = () => {
    mkdirSync(lockPath, {mode: 0o700});
    const temporaryOwnerPath = path.join(lockPath, `owner.${ownerToken}.tmp`);
    const fd = openSync(temporaryOwnerPath, 'wx', 0o600);
    try {
      writeFileSync(fd, `${JSON.stringify(owner)}\n`);
    } finally {
      closeSync(fd);
    }
    renameSync(temporaryOwnerPath, ownerPath);
  };
  for (;;) {
    try {
      write();
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      let prior;
      try {
        prior = JSON.parse(readFileSync(ownerPath, 'utf8'));
      } catch {
        throw new Error('LOCAL_TESTCONTAINERS_RUN_LOCK_OWNER_UNAVAILABLE');
      }
      if (priorIsLive(prior)) {
        throw new Error(`LOCAL_TESTCONTAINERS_RUN_ALREADY_ACTIVE:${prior.pid}`);
      }
      throw new Error('STALE_LOCAL_TESTCONTAINERS_RUN_LOCK_REQUIRES_EXPLICIT_DIAGNOSIS');
    }
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      const current = JSON.parse(readFileSync(ownerPath, 'utf8'));
      if (current?.pid === owner.pid && current?.ownerToken === owner.ownerToken) {
        rmSync(lockPath, {recursive: true, force: true});
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  };
};

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

let activeRemoteSshChild = null;

const installInterruptionHandlers = onInterrupt => {
  const handler = signal => {
    onInterrupt(signal);
    if (activeRemoteSshChild && !activeRemoteSshChild.killed) activeRemoteSshChild.kill('SIGTERM');
  };
  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);
  return () => {
    process.off('SIGINT', handler);
    process.off('SIGTERM', handler);
  };
};

const streamRemoteRun = body =>
  new Promise(resolve => {
    const child = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', remoteHost, 'bash', '-s'], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    activeRemoteSshChild = child;
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
    child.once('error', error => {
      if (activeRemoteSshChild === child) activeRemoteSshChild = null;
      resolve({status: -1, stdoutTail, stderrTail: appendTail(stderrTail, error.message)});
    });
    child.once('close', (status, signal) => {
      if (activeRemoteSshChild === child) activeRemoteSshChild = null;
      resolve({status: status ?? -1, signal, stdoutTail, stderrTail});
    });
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

export const runScript = ({
  remoteRoot,
  remoteWorkspace,
  remoteResults,
  distribution,
  invocation,
  backendAcceptanceRunId,
  backendAcceptanceOperation,
  verificationMode,
  productionMutation = null,
  mutationPreflight = null,
}) => {
  if (productionMutation !== null && mutationPreflight === null) {
    throw new Error('PRODUCTION_MUTATION_PREFLIGHT_REQUIRED');
  }
  const selectorArguments = invocation.extraArguments.map(quote).join(' ');
  const acceptanceEnvironment = backendAcceptanceEnvironment(
    backendAcceptanceRunId,
    backendAcceptanceOperation,
    verificationMode,
    process.env.V2S_BACKEND_ACCEPTANCE_BATCH_CARDINALITY ?? null,
  );
  const mutationLines =
    productionMutation === null
      ? []
      : [
          `  mutation_relative=${quote(productionMutation.file)}`,
          '  mutation_file="$workspace/$mutation_relative"',
          `  mutation_anchor=${quote(productionMutation.anchor)}`,
          `  mutation_from=${quote(productionMutation.from)}`,
          `  mutation_to=${quote(productionMutation.to)}`,
          `  expected_replace_count=${quote(String(productionMutation.replaceCount))}`,
          `  expected_source_before=${quote(mutationPreflight.sourceBeforeSha256)}`,
          `  expected_source_after=${quote(mutationPreflight.sourceAfterSha256)}`,
          '  mutation_failure() {',
          '    printf "R5_TEST_MUTATION_STATUS=FAIL\\n"',
          '    printf "R5_TEST_MUTATION_FAILURE=%s\\n" "$1"',
          '    return 1',
          '  }',
          '  apply_production_mutation() {',
          '    if ! test -f "$mutation_file"; then mutation_failure SOURCE_FILE_MISSING; return 1; fi',
          '    scoped_mutation_count() {',
          `      V2S_TEST_MUTATION_ANCHOR="$mutation_anchor" V2S_TEST_MUTATION_FROM="$mutation_from" perl -0ne 'my $start = index($_, $ENV{V2S_TEST_MUTATION_ANCHOR}); die "anchor" if $start < 0; my $opening = index($_, "{", $start + length($ENV{V2S_TEST_MUTATION_ANCHOR})); die "body" if $opening < 0; my $depth = 0; my $end = -1; for (my $i = $opening; $i < length($_); $i++) { my $character = substr($_, $i, 1); if ($character eq "{") { $depth++; } elsif ($character eq "}") { $depth--; if ($depth == 0) { $end = $i; last; } } } die "unclosed" if $end < 0; my $body = substr($_, $opening, $end - $opening + 1); my @matches = ($body =~ /\\Q$ENV{V2S_TEST_MUTATION_FROM}\\E/g); print scalar @matches;' -- "$mutation_file"`,
          '    }',
          '    if ! replace_count="$(scoped_mutation_count)"; then',
          '      mutation_failure SOURCE_SCAN_FAILED',
          '      return 1',
          '    fi',
          '    if ! test "$replace_count" = "$expected_replace_count"; then',
          '      mutation_failure "REPLACE_COUNT_MISMATCH:$replace_count:$expected_replace_count"',
          '      return 1',
          '    fi',
          '    if ! source_before_sha256="$(sha256sum -- "$mutation_file" | awk \'{print $1}\')"; then',
          '      mutation_failure SOURCE_BEFORE_HASH_FAILED',
          '      return 1',
          '    fi',
          '    if ! test "$source_before_sha256" = "$expected_source_before"; then',
          '      mutation_failure SOURCE_BEFORE_HASH_MISMATCH',
          '      return 1',
          '    fi',
          `    if ! V2S_TEST_MUTATION_ANCHOR="$mutation_anchor" V2S_TEST_MUTATION_FROM="$mutation_from" V2S_TEST_MUTATION_TO="$mutation_to" perl -0pi -e 'my $start = index($_, $ENV{V2S_TEST_MUTATION_ANCHOR}); die "anchor" if $start < 0; my $opening = index($_, "{", $start + length($ENV{V2S_TEST_MUTATION_ANCHOR})); die "body" if $opening < 0; my $depth = 0; my $end = -1; for (my $i = $opening; $i < length($_); $i++) { my $character = substr($_, $i, 1); if ($character eq "{") { $depth++; } elsif ($character eq "}") { $depth--; if ($depth == 0) { $end = $i; last; } } } die "unclosed" if $end < 0; my $body = substr($_, $opening, $end - $opening + 1); my @matches = ($body =~ /\\Q$ENV{V2S_TEST_MUTATION_FROM}\\E/g); die "count" if scalar @matches != 1; my $offset = index($body, $ENV{V2S_TEST_MUTATION_FROM}); die "target" if $offset < 0; substr($body, $offset, length($ENV{V2S_TEST_MUTATION_FROM}), $ENV{V2S_TEST_MUTATION_TO}); substr($_, $opening, $end - $opening + 1, $body);' -- "$mutation_file"; then`,
          '      mutation_failure SOURCE_REPLACE_FAILED',
          '      return 1',
          '    fi',
          '    if ! source_after_sha256="$(sha256sum -- "$mutation_file" | awk \'{print $1}\')"; then',
          '      mutation_failure SOURCE_AFTER_HASH_FAILED',
          '      return 1',
          '    fi',
          '    if ! test "$source_after_sha256" = "$expected_source_after"; then',
          '      mutation_failure SOURCE_AFTER_HASH_MISMATCH',
          '      return 1',
          '    fi',
          '    if ! staging_snapshot_sha256="$( ',
          '      find "$workspace" -type f -print0 | LC_ALL=C sort -z |',
          '        while IFS= read -r -d "" file; do',
          '          relative="${file#"$workspace"/}"',
          '          printf "%s\\t" "$relative"',
          '          sha256sum -- "$file" | awk \'{print $1}\'',
          '        done | sha256sum | awk \'{print $1}\'',
          '    )"; then',
          '      mutation_failure STAGING_SNAPSHOT_HASH_FAILED',
          '      return 1',
          '    fi',
          '    printf "R5_TEST_MUTATION_STATUS=PASS\\n"',
          `    printf "R5_TEST_MUTATION_ID=%s\\n" ${quote(productionMutation.id)}`,
          '    printf "R5_TEST_MUTATION_REPLACE_COUNT=%s\\n" "$replace_count"',
          '    printf "R5_TEST_MUTATION_SOURCE_BEFORE_SHA256=%s\\n" "$source_before_sha256"',
          '    printf "R5_TEST_MUTATION_SOURCE_AFTER_SHA256=%s\\n" "$source_after_sha256"',
          '    printf "R5_TEST_MUTATION_STAGING_SNAPSHOT_SHA256=%s\\n" "$staging_snapshot_sha256"',
          '  }',
          '  if ! apply_production_mutation; then exit 65; fi',
        ];
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
    ...mutationLines,
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
    '  archive="$file.gz"',
    '  temporary_archive="$archive.$$"',
    '  rm -f -- "$temporary_archive"',
    '  if ! raw_bytes="$(wc -c < "$file" | tr -d " ")" || ! raw_sha256="$(sha256sum "$file" | awk \'{print $1}\')" || test -z "$raw_bytes" || test -z "$raw_sha256"; then',
    '    printf "REMOTE_EVIDENCE_ARCHIVE_FAILED=%s:raw-digest\\n" "$name"',
    '    return 1',
    '  fi',
    '  if ! gzip -9c -- "$file" > "$temporary_archive"; then',
    '    rm -f -- "$temporary_archive"',
    '    printf "REMOTE_EVIDENCE_ARCHIVE_FAILED=%s:gzip\\n" "$name"',
    '    return 1',
    '  fi',
    '  if ! mv "$temporary_archive" "$archive"; then',
    '    rm -f -- "$temporary_archive"',
    '    printf "REMOTE_EVIDENCE_ARCHIVE_FAILED=%s:publish\\n" "$name"',
    '    return 1',
    '  fi',
    '  if ! archive_bytes="$(wc -c < "$archive" | tr -d " ")" || ! archive_sha256="$(sha256sum "$archive" | awk \'{print $1}\')" || test -z "$archive_bytes" || test -z "$archive_sha256"; then',
    '    printf "REMOTE_EVIDENCE_ARCHIVE_FAILED=%s:archive-digest\\n" "$name"',
    '    return 1',
    '  fi',
    '  if ! printf "%s\\t%s\\t%s\\t%s\\t%s\\n" "$name" "$raw_bytes" "$raw_sha256" "$archive_bytes" "$archive_sha256" >> "$archive_index"; then',
    '    printf "REMOTE_EVIDENCE_ARCHIVE_FAILED=%s:index\\n" "$name"',
    '    return 1',
    '  fi',
    '  rm -f -- "$file"',
    '}',
    'archive_status=0',
    ...ARCHIVED_EVIDENCE_ARTIFACTS.map(name => `archive_evidence "$results/${name}" || archive_status=1`),
    'cleanup_attempts=0',
    'while :; do',
    '  cleanup_attempts=$((cleanup_attempts + 1))',
    '  docker ps -aq --filter label=org.testcontainers=true | sort > "$root/after-container-ids"',
    '  docker volume ls -q --filter label=org.testcontainers=true | sort > "$root/after-volume-ids"',
    '  if cmp -s "$root/before-container-ids" "$root/after-container-ids" && cmp -s "$root/before-volume-ids" "$root/after-volume-ids"; then',
    '    break',
    '  fi',
    '  if test "$cleanup_attempts" -ge 10; then',
    '    break',
    '  fi',
    '  sleep 1',
    'done',
    'container_cleanup=FAIL; cmp -s "$root/before-container-ids" "$root/after-container-ids" && container_cleanup=PASS',
    'volume_cleanup=FAIL; cmp -s "$root/before-volume-ids" "$root/after-volume-ids" && volume_cleanup=PASS',
    'printf "REMOTE_GRADLE_STATUS=%s\\n" "$gradle_status"',
    'printf "REMOTE_TESTCONTAINERS_CLEANUP_ATTEMPTS=%s\\n" "$cleanup_attempts"',
    'printf "REMOTE_TESTCONTAINERS_CONTAINERS=%s\\n" "$container_cleanup"',
    'printf "REMOTE_TESTCONTAINERS_VOLUMES=%s\\n" "$volume_cleanup"',
    'printf "REMOTE_EVIDENCE_ARCHIVE_STATUS=%s\\n" "$archive_status"',
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
  const requestedMutation =
    invocation.productionMutationId === undefined ? null : resolveProductionMutation(invocation.productionMutationId);
  if (!BACKEND_ACCEPTANCE_VERIFICATION_MODES.includes(verificationMode)) {
    throw new Error('BACKEND_ACCEPTANCE_VERIFICATION_MODE_INVALID');
  }
  if (verificationMode === 'CALIBRATION' && (backendAcceptanceRunId === null || backendAcceptanceOperation !== 'all')) {
    throw new Error('BACKEND_ACCEPTANCE_CALIBRATION_REQUIRES_FULL_RUN');
  }
  if (requestedMutation !== null) {
    if (backendAcceptanceRunId === null) throw new Error('PRODUCTION_MUTATION_REQUIRES_BACKEND_ACCEPTANCE');
    if (![requestedMutation.scenarioId, requestedMutation.scenarioOperation].includes(backendAcceptanceOperation)) {
      throw new Error('PRODUCTION_MUTATION_SCENARIO_REQUIRED');
    }
    if (verificationMode !== 'ACCEPTANCE') throw new Error('PRODUCTION_MUTATION_ACCEPTANCE_MODE_REQUIRED');
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
      stagingRoot: remoteWorkspace,
    },
    sourceSync: {status: 'FAIL', workspace: remoteWorkspace, stagingRoot: remoteWorkspace},
    gradleDistribution: distribution,
    logPath: `${remoteResults}/gradle.log`,
    testExecution: {status: 'NOT_RUN'},
    business: backendAcceptanceRunId === null ? 'NOT_APPLICABLE' : 'NOT_RUN',
    backendAcceptance:
      backendAcceptanceRunId === null ? null : {runId: backendAcceptanceRunId, operation: backendAcceptanceOperation},
    productionMutation:
      requestedMutation === null
        ? null
        : {
            ...requestedMutation,
            status: 'NOT_RUN',
            verdict: 'NOT_RUN',
            business: 'NOT_RUN',
            cleanup: 'NOT_RUN',
            sourceBeforeSha256: null,
            sourceAfterSha256: null,
            stagingSnapshotHash: null,
            observed: null,
          },
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
  let mutationPreflight;
  let backendAcceptanceResult;
  let measurementEvidence;
  let devState;
  let releaseLocalRunLock;
  let interruptionSignal = null;
  const uninstallInterruptionHandlers = installInterruptionHandlers(signal => {
    interruptionSignal ??= signal;
  });
  runnerEvent('STARTED', {RUN_ID: runId, TASK: invocation.task, MODE: 'FOCUSED'});
  try {
    releaseLocalRunLock = acquireLocalRunLock();
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
    if (requestedMutation !== null) {
      mutationPreflight = prepareProductionMutation({mutation: requestedMutation});
      manifest.productionMutation.sourceBeforeSha256 = mutationPreflight.sourceBeforeSha256;
      manifest.productionMutation.sourceAfterSha256 = mutationPreflight.sourceAfterSha256;
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
    if (interruptionSignal) throw new Error(`HARNESS_INTERRUPTED:${interruptionSignal}`);
    manifest.sourceSync = {status: 'PASS', workspace: remoteWorkspace, stagingRoot: remoteWorkspace};
    manifest.gradleDistribution = await syncGradle({directory, remoteRoot, distribution});
    if (interruptionSignal) throw new Error(`HARNESS_INTERRUPTED:${interruptionSignal}`);
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
        productionMutation: requestedMutation,
        mutationPreflight,
      }),
    );
    if (interruptionSignal) throw new Error(`HARNESS_INTERRUPTED:${interruptionSignal}`);
    if (remoteRun.status !== 0)
      throw new Error(`REMOTE_RUNNER_UNAVAILABLE:${compact(remoteRun.stderrTail || remoteRun.stdoutTail)}`);
    collectArtifacts(remoteResults, directory);
    const gradleLog = readFileSync(path.join(directory, 'gradle.log'), 'utf8');
    const actualExecution = classifyGradleTestExecution(gradleLog, invocation.task);
    const remoteGradleStatus = marker(remoteRun.stdoutTail, 'REMOTE_GRADLE_STATUS');
    const containers = marker(remoteRun.stdoutTail, 'REMOTE_TESTCONTAINERS_CONTAINERS');
    const volumes = marker(remoteRun.stdoutTail, 'REMOTE_TESTCONTAINERS_VOLUMES');
    const archiveStatus = marker(remoteRun.stdoutTail, 'REMOTE_EVIDENCE_ARCHIVE_STATUS');
    const gradleFailureCode = firstGradleFailureCode(gradleLog);
    const executionPass = actualExecution.status === 'PASS' && remoteGradleStatus === '0';
    const executionFailure =
      remoteGradleStatus !== undefined && remoteGradleStatus !== '0'
        ? (gradleFailureCode ?? 'REMOTE_GRADLE_EXIT_NONZERO')
        : (actualExecution.reason ?? 'REMOTE_GRADLE_STATUS_UNAVAILABLE');
    manifest.testExecution = {
      ...actualExecution,
      status: executionPass ? 'PASS' : 'FAIL',
      ...(executionPass ? {} : {reason: executionFailure}),
      remoteGradleStatus: remoteGradleStatus ?? 'UNAVAILABLE',
      ...(requestedMutation !== null ? {expectedFailure: true} : {}),
    };
    // Preserve the first real execution failure for expected-mutation runs as
    // well.  A pre-test gate (for example the CP-05 budget gate) can fail before
    // the acceptance process creates any archived artifacts; later artifact
    // handling must not replace that boundary with an artifact-missing error.
    if (!executionPass) manifest.firstFailure ??= executionFailure;
    manifest.cleanup = {
      status: remoteGradleStatus !== undefined && containers === 'PASS' && volumes === 'PASS' ? 'PASS' : 'FAIL',
      remoteProcess: remoteGradleStatus !== undefined ? 'PASS' : 'FAIL',
      remoteWorkspace: 'PENDING',
      testcontainersContainers: containers === 'PASS' ? 'PASS' : 'FAIL',
      testcontainersVolumes: volumes === 'PASS' ? 'PASS' : 'FAIL',
    };
    if (requestedMutation !== null) {
      const mutationStatus = marker(remoteRun.stdoutTail, 'R5_TEST_MUTATION_STATUS');
      const mutationId = marker(remoteRun.stdoutTail, 'R5_TEST_MUTATION_ID');
      const observedReplaceCount = marker(remoteRun.stdoutTail, 'R5_TEST_MUTATION_REPLACE_COUNT');
      const sourceBeforeSha256 = marker(remoteRun.stdoutTail, 'R5_TEST_MUTATION_SOURCE_BEFORE_SHA256');
      const sourceAfterSha256 = marker(remoteRun.stdoutTail, 'R5_TEST_MUTATION_SOURCE_AFTER_SHA256');
      const stagingSnapshotHash = marker(remoteRun.stdoutTail, 'R5_TEST_MUTATION_STAGING_SNAPSHOT_SHA256');
      manifest.productionMutation.status = mutationStatus === 'PASS' ? 'PASS' : 'FAIL';
      manifest.productionMutation.observedReplaceCount = observedReplaceCount ?? null;
      manifest.productionMutation.sourceBeforeSha256 = sourceBeforeSha256 ?? null;
      manifest.productionMutation.sourceAfterSha256 = sourceAfterSha256 ?? null;
      manifest.productionMutation.stagingSnapshotHash = stagingSnapshotHash ?? null;
      if (mutationStatus !== 'PASS') throw new Error(`PRODUCTION_MUTATION_NOT_APPLIED:${marker(remoteRun.stdoutTail, 'R5_TEST_MUTATION_FAILURE') ?? 'UNKNOWN'}`);
      if (
        mutationId !== requestedMutation.id ||
        observedReplaceCount !== String(requestedMutation.replaceCount) ||
        sourceBeforeSha256 !== mutationPreflight.sourceBeforeSha256 ||
        sourceAfterSha256 !== mutationPreflight.sourceAfterSha256 ||
        !/^[a-f0-9]{64}$/.test(stagingSnapshotHash ?? '')
      ) {
        throw new Error('PRODUCTION_MUTATION_RECEIPT_MISMATCH');
      }
      if (executionPass) throw new Error('PRODUCTION_MUTATION_NOT_CAUGHT');
    }
    const acceptanceArtifactsAvailable = hasArchivedEvidenceIndexEntries(directory);
    if (requestedMutation !== null && !executionPass && !acceptanceArtifactsAvailable) {
      throw new Error(executionFailure);
    }
    const requiresAcceptanceArtifacts =
      requiresBackendAcceptanceEvidence(backendAcceptanceRunId, actualExecution.status === 'PASS') ||
      (requestedMutation !== null && acceptanceArtifactsAvailable);
    if (requiresAcceptanceArtifacts) {
      const archiveRows = parseEvidenceArchiveIndex(
        readFileSync(path.join(directory, 'evidence-artifacts.tsv'), 'utf8'),
      );
      for (const name of ARCHIVED_EVIDENCE_ARTIFACTS) {
        readEvidenceArtifact(directory, name, {requireArchive: true});
        if (existsSync(path.join(directory, name))) throw new Error(`EVIDENCE_ARTIFACT_RAW_PRESENT:${name}`);
      }
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
      backendAcceptanceResult = parseBackendAcceptanceResult(
        readEvidenceArtifact(directory, 'backend-acceptance-result.jsonl', {requireArchive: true}),
      );
      manifest.business = backendAcceptanceResult.summary.directFailures === 0 ? 'PASS' : 'FAIL';
    }
    if (!executionPass && requestedMutation === null) throw new Error(executionFailure);
    if (remoteGradleStatus !== '0' && requestedMutation === null) throw new Error('REMOTE_GRADLE_EXIT_NONZERO');
    if (archiveStatus !== '0') throw new Error('REMOTE_EVIDENCE_ARCHIVE_FAILED');
    if (manifest.cleanup.status !== 'PASS') throw new Error('REMOTE_TESTCONTAINERS_RESOURCE_NOT_RECLAIMED');
    if (backendAcceptanceResult?.summary.stubOnly > 0) throw new Error('BACKEND_ACCEPTANCE_STUB_BUSINESS_NOT_ALLOWED');
    if (requestedMutation === null && backendAcceptanceResult?.summary.directFailures > 0) {
      throw new Error('BACKEND_ACCEPTANCE_SCENARIO_FAILURE');
    }
    if (backendAcceptanceRunId !== null) {
      measurementEvidence = parseHttpRequestEvents(
        readEvidenceArtifact(directory, 'http-request-events.jsonl', {requireArchive: true}),
        backendAcceptanceRunId,
      );
      assertUnclassifiedSqlRatio(measurementEvidence);
      if (requestedMutation !== null) {
        assertNoObservationErrors(measurementEvidence.rows);
        manifest.productionMutation.observed = verifyProductionMutationOutcome({
          mutation: requestedMutation,
          backendAcceptanceResult,
          httpEvents: measurementEvidence.rows,
        });
        manifest.productionMutation.verdict = 'PASS';
        manifest.productionMutation.business = 'FAIL';
      }
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
    manifest.firstFailure ??= failure.message;
  } finally {
    if (interruptionSignal && !failure) {
      failure = new Error(`HARNESS_INTERRUPTED:${interruptionSignal}`);
      manifest.firstFailure ??= failure.message;
    }
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
    if (manifest.cleanup.remoteWorkspace !== 'PASS') {
      manifest.cleanup.status = 'FAIL';
      if (!failure) {
        failure = new Error('REMOTE_WORKSPACE_CLEANUP_FAILED');
        manifest.firstFailure ??= failure.message;
      }
    }
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
    try {
      if (releaseLocalRunLock) releaseLocalRunLock();
    } catch (releaseError) {
      failure = releaseError instanceof Error ? releaseError : new Error(String(releaseError));
      manifest.firstFailure ??= failure.message;
    } finally {
      uninstallInterruptionHandlers();
    }
    if (manifest.productionMutation !== null) {
      manifest.productionMutation.cleanup = manifest.cleanup.status === 'PASS' ? 'PASS' : 'FAIL';
    }
    const executionAccepted =
      requestedMutation === null
        ? manifest.testExecution.status === 'PASS'
        : manifest.testExecution.status === 'FAIL' && manifest.productionMutation?.verdict === 'PASS';
    const candidateStatus = !failure && executionAccepted && manifest.cleanup.status === 'PASS' ? 'PASS' : 'FAIL';
    manifest.status = candidateStatus;
    if (candidateStatus === 'PASS') {
      try {
        parseAndValidateRunManifest(manifest);
      } catch (validationError) {
        failure = validationError instanceof Error ? validationError : new Error(String(validationError));
        manifest.firstFailure ??= failure.message;
        manifest.status = 'FAIL';
      }
    }
    persist();
  }
  if (manifest.status === 'PASS') {
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
    if (manifest.productionMutation !== null) {
      const observed = manifest.productionMutation.observed;
      process.stdout.write(
        `BACKEND_ACCEPTANCE_MUTATION_RESULT MUTATION_ID=${manifest.productionMutation.id} OPERATION=${observed.operationId} SCENARIO=${observed.scenarioId} POINTER=${manifest.productionMutation.pointer} HTTP=${observed.httpStatus} CONTRACT=PASS BUSINESS=${manifest.productionMutation.business} FAILURE_CATEGORY=${observed.failureCategory} VERDICT=${manifest.productionMutation.verdict} REPLACE_COUNT=${manifest.productionMutation.observedReplaceCount} SOURCE_BEFORE_SHA256=${manifest.productionMutation.sourceBeforeSha256} SOURCE_AFTER_SHA256=${manifest.productionMutation.sourceAfterSha256} STAGING_SNAPSHOT_SHA256=${manifest.productionMutation.stagingSnapshotHash} CLEANUP=${manifest.productionMutation.cleanup}\n`,
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
      `R5_REMOTE_TESTCONTAINERS=PASS; TASK=${invocation.task}; EVIDENCE=${path.relative(root, directory)}; BUSINESS=${manifest.business}; MUTATION_VERDICT=${manifest.productionMutation?.verdict ?? 'NOT_APPLICABLE'}; RESOURCE_CLEANUP=PASS\n`,
    );
  } else {
    process.stderr.write(
      `R5_REMOTE_TESTCONTAINERS=FAIL; REASON=${compact(failure?.message || manifest.firstFailure || 'TEST_OR_RESOURCE_CLEANUP_FAILED')}; EVIDENCE=${path.relative(root, directory)}; BUSINESS=${manifest.business}; MUTATION_VERDICT=${manifest.productionMutation?.verdict ?? 'NOT_APPLICABLE'}; RESOURCE_CLEANUP=${manifest.cleanup.status}\n`,
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
