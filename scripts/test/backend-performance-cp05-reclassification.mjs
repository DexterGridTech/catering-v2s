#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  assertPerformanceOperationExactSet,
  loadPerformanceOperationRegistry,
  reconcilePerformanceOperationEvents,
} from './backend-performance-operation-reconciliation.mjs';
import {parseHttpRequestEvents} from './backend-performance-event-verifier.mjs';
import {
  LINEAR_REQUEST_CARDINALITY_BUDGET,
  validateLinearBudgetObservation,
} from '../generate/backend-performance-budget.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const DEFAULT_REGISTRY_PATHS = Object.freeze([
  'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json',
  'apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json',
]);

const CLASSIFICATION_THRESHOLDS = Object.freeze({
  P1_DATABASE_OPERATION_COUNT: 100,
  P2_CONNECTION_BORROW_COUNT: 1.5,
  P3_DATABASE_OPERATION_COUNT: 25,
  P4_UNCLASSIFIED_SQL_RATIO: 0.5,
  P4_DATABASE_OPERATION_COUNT: 10,
});

const OPERATION_DATABASE_CEILINGS = Object.freeze({
  executeOperationsBrandCatalogCopy: 35,
  executeOperationsLocalCatalogCopy: 35,
  saveOperationsCatalogItem: 45,
});

const requiredManifestStatus = (manifest, runDirectory) => {
  if (manifest?.status !== 'PASS') throw new Error(`CP05_RUN_MANIFEST_NOT_PASS:${runDirectory}`);
  if (manifest?.testExecution?.status !== 'PASS') throw new Error(`CP05_TEST_EXECUTION_NOT_PASS:${runDirectory}`);
  if (manifest?.measurementEvidence?.status !== 'PASS') throw new Error(`CP05_MEASUREMENT_NOT_PASS:${runDirectory}`);
  if (manifest?.cleanup?.status !== 'PASS') throw new Error(`CP05_CLEANUP_NOT_PASS:${runDirectory}`);
  const operationSet = manifest.measurementEvidence.operationSet;
  if (!operationSet || operationSet.expected !== 238 || operationSet.observed !== 238
    || operationSet.missing.length || operationSet.extra.length || operationSet.drift.length) {
    throw new Error(`CP05_OPERATION_SET_NOT_CLOSED:${runDirectory}`);
  }
};

const numericMax = (rows, field) => Math.max(...rows.map(row => row[field]));

const runMetric = (rows, field) => ({
  eventCount: rows.length,
  max: numericMax(rows, field),
  total: rows.reduce((sum, row) => sum + row[field], 0),
});

export const classifyCurrentTreeOperation = ({operationId, method, maxDatabaseOperationCount, maxConnectionBorrowCount, maxUnclassifiedSqlRatio}) => {
  if (maxDatabaseOperationCount >= CLASSIFICATION_THRESHOLDS.P1_DATABASE_OPERATION_COUNT) return 'P1';
  if (method === 'GET' && maxConnectionBorrowCount > CLASSIFICATION_THRESHOLDS.P2_CONNECTION_BORROW_COUNT) return 'P2';
  // CP-07/08 have explicit post-remediation ceilings. Once one of those bounded
  // paths is at or below its approved ceiling, it is no longer a generic P3
  // member; it remains budget-protected as a ready special path.
  if (operationId != null
    && Object.hasOwn(OPERATION_DATABASE_CEILINGS, operationId)
    && maxDatabaseOperationCount <= OPERATION_DATABASE_CEILINGS[operationId]) return 'P5';
  if (maxDatabaseOperationCount >= CLASSIFICATION_THRESHOLDS.P3_DATABASE_OPERATION_COUNT) return 'P3';
  if (maxUnclassifiedSqlRatio > CLASSIFICATION_THRESHOLDS.P4_UNCLASSIFIED_SQL_RATIO
    && maxDatabaseOperationCount >= CLASSIFICATION_THRESHOLDS.P4_DATABASE_OPERATION_COUNT) return 'P4';
  return 'P5';
};

export const budgetReadiness = ({operationId, category, maxDatabaseOperationCount, linearObservations = []}) => {
  if (category === 'P5') {
    return Object.freeze({status: 'READY', databaseOperationBudget: {kind: 'FIXED', max: maxDatabaseOperationCount}});
  }
  if (category === 'P1' && operationId === 'batchTransitionOperationsCatalogItemStatus') {
    const observations = linearObservations.map((observation) => {
      try {
        return validateLinearBudgetObservation({
          operationId,
          requestCardinality: observation.requestCardinality,
          databaseOperationCount: observation.databaseOperationCount,
        });
      } catch (error) {
        return {error: error.code || error.message};
      }
    });
    const invalidObservation = observations.find((observation) => observation.error);
    if (invalidObservation) {
      return Object.freeze({
        status: 'BLOCKED_ABOVE_LINEAR_CEILING',
        reason: invalidObservation.error,
        budget: LINEAR_REQUEST_CARDINALITY_BUDGET,
        observations,
      });
    }
    if (observations.length === 0) {
      return Object.freeze({
        status: 'BLOCKED_REQUIRES_BATCH_CARDINALITY_EVIDENCE',
        reason: 'LINEAR_REQUEST_CARDINALITY_EVIDENCE_MISSING',
        budget: LINEAR_REQUEST_CARDINALITY_BUDGET,
      });
    }
    return Object.freeze({
      status: 'READY',
      databaseOperationBudget: LINEAR_REQUEST_CARDINALITY_BUDGET,
      observations,
    });
  }
  if (category === 'P1' && Object.hasOwn(OPERATION_DATABASE_CEILINGS, operationId)) {
    const ceiling = OPERATION_DATABASE_CEILINGS[operationId];
    return Object.freeze(maxDatabaseOperationCount <= ceiling
      ? {status: 'READY', databaseOperationBudget: {kind: 'FIXED', max: maxDatabaseOperationCount}}
      : {status: 'BLOCKED_ABOVE_CLASS_CEILING', ceiling, measuredMax: maxDatabaseOperationCount});
  }
  if (category === 'P2') {
    return Object.freeze({
      status: 'BLOCKED_REQUIRES_P2_RELATIVE_REDUCTION',
      reason: 'P2_REQUIRES_CURRENT_TREE_CONNECTION_SCOPE_AND_RELATIVE_BASELINE_PROOF',
    });
  }
  if (category === 'P3') {
    return Object.freeze(maxDatabaseOperationCount <= 20
      ? {status: 'READY', databaseOperationBudget: {kind: 'FIXED', max: maxDatabaseOperationCount}}
      : {status: 'BLOCKED_ABOVE_CLASS_CEILING', ceiling: 20, measuredMax: maxDatabaseOperationCount});
  }
  return Object.freeze({status: 'BLOCKED_REQUIRES_RECLASSIFICATION_REVIEW'});
};

const readRun = ({repositoryRoot, runDirectory, registry}) => {
  const absoluteDirectory = path.resolve(repositoryRoot, runDirectory);
  const manifestPath = path.join(absoluteDirectory, 'run-manifest.json');
  const eventsPath = path.join(absoluteDirectory, 'http-request-events.jsonl');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  requiredManifestStatus(manifest, runDirectory);
  const parsed = parseHttpRequestEvents(fs.readFileSync(eventsPath, 'utf8'));
  const reconciliation = reconcilePerformanceOperationEvents(registry, parsed.rows);
  assertPerformanceOperationExactSet(reconciliation);
  for (const event of parsed.rows) {
    const expected = registry.find(row => row.operationId === event.operationId);
    if (event.method !== expected.method || event.routeTemplate !== expected.routeTemplate
      || event.owner !== expected.owner || event.consumerFace !== expected.consumerFace) {
      throw new Error(`CP05_EVENT_FACT_DRIFT:${event.operationId}`);
    }
  }
  return Object.freeze({
    runDirectory,
    manifestPath: path.relative(repositoryRoot, manifestPath),
    eventsPath: path.relative(repositoryRoot, eventsPath),
    manifest,
    events: parsed.rows,
    summary: parsed.summary,
    reconciliation,
  });
};

const operationMetrics = ({registryRow, runs}) => {
  const perRun = runs.map(run => {
    const rows = run.events.filter(event => event.operationId === registryRow.operationId);
    if (rows.length === 0) throw new Error(`CP05_OPERATION_MISSING_FROM_RUN:${registryRow.operationId}:${run.runDirectory}`);
    return Object.freeze({
      runDirectory: run.runDirectory,
      eventCount: rows.length,
      databaseOperationCount: runMetric(rows, 'databaseOperationCount'),
      // The historical aggregate includes SESSION/SCOPE resolution. P2 is a
      // connection-scope classification, so consume the same operation-boundary
      // metric as the L2 gate and keep the aggregate available only as evidence
      // context.
      connectionBorrowCount: runMetric(rows, 'operationConnectionBorrowCount'),
      rawConnectionBorrowCount: runMetric(rows, 'connectionBorrowCount'),
      transactionBeginCount: runMetric(rows, 'transactionBeginCount'),
      unclassifiedSqlRatio: {max: Math.max(...rows.map(row => row.unclassifiedSqlRatio))},
    });
  });
  const allRows = runs.flatMap(run => run.events.filter(event => event.operationId === registryRow.operationId));
  const maxDatabaseOperationCount = numericMax(allRows, 'databaseOperationCount');
  const maxConnectionBorrowCount = numericMax(allRows, 'operationConnectionBorrowCount');
  const maxRawConnectionBorrowCount = numericMax(allRows, 'connectionBorrowCount');
  const maxUnclassifiedSqlRatio = Math.max(...allRows.map(row => row.unclassifiedSqlRatio));
  const category = classifyCurrentTreeOperation({
    operationId: registryRow.operationId,
    method: registryRow.method,
    maxDatabaseOperationCount,
    maxConnectionBorrowCount,
    maxRawConnectionBorrowCount,
    maxUnclassifiedSqlRatio,
  });
  const linearObservations = registryRow.operationId === 'batchTransitionOperationsCatalogItemStatus'
    ? allRows.map((row) => ({
      requestCardinality: row.requestCardinality,
      databaseOperationCount: row.databaseOperationCount,
    }))
    : [];
  return Object.freeze({
    operationId: registryRow.operationId,
    method: registryRow.method,
    routeTemplate: registryRow.routeTemplate,
    owner: registryRow.owner,
    consumerFace: registryRow.consumerFace,
    eventCount: allRows.length,
    maxDatabaseOperationCount,
    maxConnectionBorrowCount,
    maxTransactionBeginCount: numericMax(allRows, 'transactionBeginCount'),
    maxUnclassifiedSqlRatio,
    category,
    budgetReadiness: budgetReadiness({
      operationId: registryRow.operationId,
      category,
      maxDatabaseOperationCount,
      linearObservations,
    }),
    ...(linearObservations.length > 0 ? {linearBudgetObservations: linearObservations} : {}),
    runs: perRun,
  });
};

export const reclassifyCurrentTree = ({repositoryRoot = root, runDirectories, registryPaths = DEFAULT_REGISTRY_PATHS} = {}) => {
  if (!Array.isArray(runDirectories) || runDirectories.length !== 3) throw new Error('CP05_THREE_RUNS_REQUIRED');
  const registry = loadPerformanceOperationRegistry({root: repositoryRoot, registryPaths});
  if (registry.length !== 238) throw new Error(`CP05_REGISTRY_SIZE_INVALID:${registry.length}`);
  const runs = runDirectories.map(runDirectory => readRun({repositoryRoot, runDirectory, registry}));
  const operations = registry.map(registryRow => operationMetrics({registryRow, runs}));
  const categories = Object.fromEntries(['P0', 'P1', 'P2', 'P3', 'P4', 'P5'].map(category => [
    category,
    operations.filter(operation => operation.category === category).map(operation => operation.operationId).sort(),
  ]));
  const classificationCounts = Object.fromEntries(Object.entries(categories).map(([category, values]) => [category, values.length]));
  if (classificationCounts.P0 !== 0 || Object.values(classificationCounts).reduce((sum, count) => sum + count, 0) !== 238) {
    throw new Error(`CP05_CLASSIFICATION_NOT_CLOSED:${JSON.stringify(classificationCounts)}`);
  }
  const budgetReady = operations.filter(operation => operation.budgetReadiness.status === 'READY');
  const budgetBlocked = operations.filter(operation => operation.budgetReadiness.status !== 'READY');
  const workloadConsistency = operations.filter(operation => new Set(operation.runs.map(run => run.eventCount)).size !== 1)
    .map(operation => operation.operationId);
  if (workloadConsistency.length) throw new Error(`CP05_WORKLOAD_CARDINALITY_DRIFT:${workloadConsistency.join(',')}`);
  return Object.freeze({
    kind: 'backend-performance-cp05-current-tree-reclassification',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      registryPaths: Object.freeze([...registryPaths]),
      runs: Object.freeze(runs.map(run => ({
        runId: run.manifest.runId,
        runDirectory: run.runDirectory,
        sourceManifest: run.manifestPath,
        sourceEvents: run.eventsPath,
        firstFailure: run.manifest.firstFailure ?? null,
        testExecution: run.manifest.testExecution,
        measurementEvidence: run.manifest.measurementEvidence,
        cleanup: run.manifest.cleanup,
        devLifecycle: run.manifest.devLifecycle,
        eventSummary: run.summary,
        operationSet: run.reconciliation,
      }))),
    },
    firstFailure: null,
    lastKnownGood: runs.map(run => run.manifest.runId),
    brokenBoundary: null,
    business: 'PASS',
    cleanup: 'PASS',
    measurement: {
      expectedOperations: registry.length,
      runCount: runs.length,
      exactSet: runs.map(run => run.reconciliation),
      eventSummaries: runs.map(run => run.summary),
      classificationRule: 'MAX_PER_OPERATION_ACROSS_THREE_RUNS;AVERAGE_NOT_USED',
      classificationCounts,
    },
    categories,
    budget: {
      generated: false,
      activation: 'NOT_YET_AUTHORIZED_BY_CP05;CP02_REQUIRES_REMEDIATED_SHAPE',
      readyCount: budgetReady.length,
      blockedCount: budgetBlocked.length,
      adjustmentDiff: [],
      ready: budgetReady.map(operation => ({
        operationId: operation.operationId,
        category: operation.category,
        databaseOperationBudget: operation.budgetReadiness.databaseOperationBudget,
      })),
      blocked: budgetBlocked.map(operation => ({
        operationId: operation.operationId,
        category: operation.category,
        measuredMax: operation.maxDatabaseOperationCount,
        ...operation.budgetReadiness,
      })),
    },
    operations,
  });
};

const optionValues = (args, name) => args.flatMap((value, index) => value === name ? [args[index + 1]] : []).filter(Boolean);

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const runDirectories = optionValues(process.argv.slice(2), '--run');
    const writeTarget = optionValues(process.argv.slice(2), '--write')[0];
    if (runDirectories.length !== 3 || !writeTarget) throw new Error('CP05_RECLASSIFICATION_ARGUMENT_INVALID');
    const report = reclassifyCurrentTree({runDirectories});
    const absoluteTarget = path.resolve(root, writeTarget);
    fs.mkdirSync(path.dirname(absoluteTarget), {recursive: true});
    fs.writeFileSync(absoluteTarget, `${JSON.stringify(report, null, 2)}\n`, {mode: 0o600});
    process.stdout.write([
      'BACKEND_PERFORMANCE_CP05_RECLASSIFICATION=PASS',
      `RUNS=${report.measurement.runCount}`,
      `EXPECTED_OPERATIONS=${report.measurement.expectedOperations}`,
      `P0=${report.measurement.classificationCounts.P0}`,
      `P1=${report.measurement.classificationCounts.P1}`,
      `P2=${report.measurement.classificationCounts.P2}`,
      `P3=${report.measurement.classificationCounts.P3}`,
      `P4=${report.measurement.classificationCounts.P4}`,
      `P5=${report.measurement.classificationCounts.P5}`,
      `BUDGET_GENERATED=${report.budget.generated}`,
      `BUDGET_READY=${report.budget.readyCount}`,
      `BUDGET_BLOCKED=${report.budget.blockedCount}`,
      `EVIDENCE=${path.relative(root, absoluteTarget)}`,
    ].join('\n') + '\n');
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
