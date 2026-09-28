#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  assertPerformanceOperationExactSet,
  loadPerformanceOperationRegistry,
  normalMeasurementEventsForIdentity,
  reconcilePerformanceOperationEvents,
} from './backend-performance-operation-reconciliation.mjs';
import {parseHttpRequestEvents} from './backend-performance-event-verifier.mjs';
import {parseAndValidateRunManifest, readEvidenceArtifact} from './r5-remote-testcontainers.mjs';
import {
  BATCH_OPERATION_ID,
  CP05_CALIBRATION_REPORT_PATH,
  CONTROLLED_BUDGET_EXCEPTION_RECORDS,
  CURRENT_PROGRAM_RESULT_BUDGET_DECISION_REF,
  LINEAR_REQUEST_CARDINALITY_BUDGET,
  REQUIRED_BATCH_CARDINALITIES,
  batchCardinalityEvidence,
  calibrationReportDigest,
  controlledBudgetExceptionForOperation,
  validateLinearBudgetObservation,
} from '../generate/backend-performance-budget.mjs';
import {BACKEND_PERFORMANCE_OPERATION_COUNTS} from '../policy/backend-performance-operation-counts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXPECTED_OPERATION_COUNT = BACKEND_PERFORMANCE_OPERATION_COUNTS.operations;
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const requireThreeRunBaselineDecisionRef = value => {
  if (typeof value !== 'string' || value.trim() === '') throw new Error('CP05_BASELINE_DECISION_REF_REQUIRED');
  return value.trim();
};

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
  // The whole-copy command must re-read the locked target category hierarchy
  // before writing: reusing a same-code category must fail closed rather than
  // silently creating a fourth level.  The current managed program maximum is
  // therefore 48; lowering it would require removing that authoritative fact
  // check or duplicating the hierarchy lifecycle.
  executeOperationsBrandCatalogCopy: 48,
  executeOperationsLocalCatalogCopy: 35,
  saveOperationsCatalogItem: 45,
});

const requiredManifestStatus = (manifest, runDirectory) => {
  if (manifest?.status !== 'PASS') throw new Error(`CP05_RUN_MANIFEST_NOT_PASS:${runDirectory}`);
  if (manifest?.verificationMode !== 'CALIBRATION') throw new Error(`CP05_RUN_NOT_CALIBRATION:${runDirectory}`);
  if (manifest?.testExecution?.status !== 'PASS') throw new Error(`CP05_TEST_EXECUTION_NOT_PASS:${runDirectory}`);
  if (manifest?.measurementEvidence?.status !== 'PASS') throw new Error(`CP05_MEASUREMENT_NOT_PASS:${runDirectory}`);
  if (manifest?.measurementEvidence?.calibrationEvidence?.status !== 'PASS') {
    throw new Error(`CP05_CALIBRATION_EVIDENCE_NOT_PASS:${runDirectory}`);
  }
  if (manifest?.evidenceArchive?.status !== 'PASS') throw new Error(`CP05_EVIDENCE_ARCHIVE_NOT_PASS:${runDirectory}`);
  if (
    !manifest?.workload ||
    manifest.workload.schemaVersion !== 1 ||
    !/^[a-f0-9]{64}$/.test(manifest.workload.fingerprint)
  ) {
    throw new Error(`CP05_WORKLOAD_FINGERPRINT_INVALID:${runDirectory}`);
  }
  if (manifest?.cleanup?.status !== 'PASS') throw new Error(`CP05_CLEANUP_NOT_PASS:${runDirectory}`);
  const operationSet = manifest.measurementEvidence.operationSet;
  if (
    !operationSet ||
    operationSet.expected !== EXPECTED_OPERATION_COUNT ||
    operationSet.observed !== EXPECTED_OPERATION_COUNT ||
    operationSet.missing.length ||
    operationSet.extra.length ||
    operationSet.drift.length
  ) {
    throw new Error(`CP05_OPERATION_SET_NOT_CLOSED:${runDirectory}`);
  }
  const normalSampleMatrix = manifest.measurementEvidence.normalSampleMatrix;
  if (
    !normalSampleMatrix ||
    normalSampleMatrix.expected !== EXPECTED_OPERATION_COUNT ||
    normalSampleMatrix.observed !== EXPECTED_OPERATION_COUNT
  ) {
    throw new Error(`CP05_NORMAL_SAMPLE_MATRIX_NOT_CLOSED:${runDirectory}`);
  }
};

// A managed Testcontainers run and the backend-acceptance process it launches
// deliberately have different identities. HTTP completion events are emitted
// by the latter, so CP-05 must bind them to that identity rather than loosening
// the event parser or comparing them to the outer managed-run id.
export const backendAcceptanceRunIdForCp05 = (manifest, runDirectory = '<manifest>') => {
  const runId = manifest?.backendAcceptance?.runId;
  if (typeof runId !== 'string' || runId.trim() === '') {
    throw new Error(`CP05_BACKEND_ACCEPTANCE_RUN_ID_INVALID:${runDirectory}`);
  }
  return runId;
};

const numericMax = (rows, field) => Math.max(...rows.map(row => row[field]));

const runMetric = (rows, field) => ({
  eventCount: rows.length,
  max: numericMax(rows, field),
  total: rows.reduce((sum, row) => sum + row[field], 0),
});

export const classifyCurrentTreeOperation = ({
  operationId,
  method,
  maxDatabaseOperationCount,
  maxConnectionBorrowCount,
  maxUnclassifiedSqlRatio,
}) => {
  if (maxDatabaseOperationCount >= CLASSIFICATION_THRESHOLDS.P1_DATABASE_OPERATION_COUNT) return 'P1';
  if (method === 'GET' && maxConnectionBorrowCount > CLASSIFICATION_THRESHOLDS.P2_CONNECTION_BORROW_COUNT) return 'P2';
  // CP-07/08 have explicit post-remediation ceilings. Once one of those bounded
  // paths is at or below its approved ceiling, it is no longer a generic P3
  // member; it remains budget-protected as a ready special path.
  if (
    operationId != null &&
    Object.hasOwn(OPERATION_DATABASE_CEILINGS, operationId) &&
    maxDatabaseOperationCount <= OPERATION_DATABASE_CEILINGS[operationId]
  )
    return 'P5';
  if (maxDatabaseOperationCount >= CLASSIFICATION_THRESHOLDS.P3_DATABASE_OPERATION_COUNT) return 'P3';
  if (
    maxUnclassifiedSqlRatio > CLASSIFICATION_THRESHOLDS.P4_UNCLASSIFIED_SQL_RATIO &&
    maxDatabaseOperationCount >= CLASSIFICATION_THRESHOLDS.P4_DATABASE_OPERATION_COUNT
  )
    return 'P4';
  return 'P5';
};

const fixedBudgetReadiness = ({
  operationId,
  maxDatabaseOperationCount,
  ceiling,
  blockedStatus,
  blockedReason,
  controlledExceptionRecords,
}) => {
  if (maxDatabaseOperationCount <= ceiling) {
    return Object.freeze({status: 'READY', databaseOperationBudget: {kind: 'FIXED', max: maxDatabaseOperationCount}});
  }
  const controlledBudgetException = controlledBudgetExceptionForOperation({
    operationId,
    fromMax: ceiling,
    toMax: maxDatabaseOperationCount,
    measuredMax: maxDatabaseOperationCount,
    records: controlledExceptionRecords,
  });
  if (controlledBudgetException) {
    return Object.freeze({
      status: 'READY',
      reason: 'SELF_DECIDED_IMPLEMENTATION_EXCEPTION',
      databaseOperationBudget: {kind: 'FIXED', max: maxDatabaseOperationCount},
      controlledBudgetException,
    });
  }
  return Object.freeze({
    status: blockedStatus,
    ceiling,
    measuredMax: maxDatabaseOperationCount,
    ...(blockedReason ? {reason: blockedReason} : {}),
  });
};

export const budgetReadiness = ({
  operationId,
  category,
  maxDatabaseOperationCount,
  linearObservations = [],
  controlledExceptionRecords,
  requireBatchCardinalityEvidence = true,
}) => {
  // These two aggregate commands have approved operation-specific ceilings.
  // Classification remains P3 until their measured shape is repaired, but they
  // must be judged against their own ceilings rather than the generic P3 one.
  if (Object.hasOwn(OPERATION_DATABASE_CEILINGS, operationId)) {
    return fixedBudgetReadiness({
      operationId,
      maxDatabaseOperationCount,
      ceiling: OPERATION_DATABASE_CEILINGS[operationId],
      blockedStatus: 'BLOCKED_ABOVE_OPERATION_CEILING',
      controlledExceptionRecords,
    });
  }
  if (category === 'P5') {
    return Object.freeze({status: 'READY', databaseOperationBudget: {kind: 'FIXED', max: maxDatabaseOperationCount}});
  }
  if (category === 'P1' && operationId === 'batchTransitionOperationsCatalogItemStatus') {
    const observations = linearObservations.map(observation => {
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
    const invalidObservation = observations.find(observation => observation.error);
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
    if (requireBatchCardinalityEvidence) {
      const cardinalityEvidence = batchCardinalityEvidence(observations);
      if (!cardinalityEvidence.valid) {
        return Object.freeze({
          status: 'BLOCKED_REQUIRES_BATCH_CARDINALITY_EVIDENCE',
          reason: 'LINEAR_REQUEST_CARDINALITY_EVIDENCE_SET_INVALID',
          budget: LINEAR_REQUEST_CARDINALITY_BUDGET,
          requiredCardinalities: REQUIRED_BATCH_CARDINALITIES,
          ...cardinalityEvidence,
        });
      }
    }
    return Object.freeze({
      status: 'READY',
      databaseOperationBudget: LINEAR_REQUEST_CARDINALITY_BUDGET,
      observations,
    });
  }
  if (category === 'P2') {
    return Object.freeze({
      status: 'BLOCKED_REQUIRES_P2_RELATIVE_REDUCTION',
      reason: 'P2_REQUIRES_CURRENT_TREE_CONNECTION_SCOPE_AND_RELATIVE_BASELINE_PROOF',
    });
  }
  if (category === 'P3') {
    return fixedBudgetReadiness({
      operationId,
      maxDatabaseOperationCount,
      ceiling: 20,
      blockedStatus: 'BLOCKED_ABOVE_CLASS_CEILING',
      controlledExceptionRecords,
    });
  }
  return Object.freeze({status: 'BLOCKED_REQUIRES_RECLASSIFICATION_REVIEW'});
};

const batchObservationForRun = (events, runDirectory) => {
  const batchEvents = events.filter(event => event.operationId === BATCH_OPERATION_ID);
  if (batchEvents.length !== 1) throw new Error(`CP05_BATCH_CARDINALITY_EVENT_INVALID:${runDirectory}`);
  return validateLinearBudgetObservation({
    operationId: BATCH_OPERATION_ID,
    requestCardinality: batchEvents[0].requestCardinality,
    databaseOperationCount: batchEvents[0].databaseOperationCount,
  });
};

const readRun = ({repositoryRoot, runDirectory, registry}) => {
  const absoluteDirectory = path.resolve(repositoryRoot, runDirectory);
  const manifestPath = path.join(absoluteDirectory, 'run-manifest.json');
  const manifestSource = fs.readFileSync(manifestPath, 'utf8');
  const manifest = parseAndValidateRunManifest(JSON.parse(manifestSource));
  requiredManifestStatus(manifest, runDirectory);
  const backendAcceptanceRunId = backendAcceptanceRunIdForCp05(manifest, runDirectory);
  const archivedEvents = readEvidenceArtifact(absoluteDirectory, 'http-request-events.jsonl', {requireArchive: true});
  const parsed = parseHttpRequestEvents(archivedEvents, backendAcceptanceRunId);
  const reconciliation = reconcilePerformanceOperationEvents(registry, parsed.rows);
  assertPerformanceOperationExactSet(reconciliation);
  const normalEvents = normalMeasurementEventsForIdentity(
    new Map(registry.map(row => [row.operationId, row])),
    parsed.rows,
    {missingCode: 'CP05_NORMAL_SAMPLE_MISSING'},
  );
  const batchObservation = batchObservationForRun(normalEvents, runDirectory);
  return Object.freeze({
    runDirectory,
    manifestPath: path.relative(repositoryRoot, manifestPath),
    eventsPath: `${path.relative(repositoryRoot, absoluteDirectory)}/evidence-artifacts.tsv#http-request-events.jsonl`,
    manifestDigest: sha256(manifestSource),
    eventsDigest: sha256(archivedEvents),
    manifest,
    backendAcceptanceRunId,
    events: normalEvents,
    batchCardinality: batchObservation.requestCardinality,
    summary: parsed.summary,
    reconciliation,
  });
};

/**
 * Dexter's 2026-08-26 delivery decision permits the latest complete managed
 * ACCEPTANCE workload to establish the initial budget projection.  This is
 * deliberately a separate reader, rather than loosening the calibration
 * reader above: a three-run CALIBRATION report and a one-run current-program
 * report remain distinguishable in the canonical report and its digest.
 */
const readCurrentProgramRun = ({repositoryRoot, runDirectory, registry}) => {
  const absoluteDirectory = path.resolve(repositoryRoot, runDirectory);
  const manifestPath = path.join(absoluteDirectory, 'run-manifest.json');
  const manifestSource = fs.readFileSync(manifestPath, 'utf8');
  let manifest;
  try {
    manifest = JSON.parse(manifestSource);
  } catch {
    throw new Error(`CURRENT_PROGRAM_RUN_MANIFEST_INVALID:${runDirectory}`);
  }
  if (
    manifest?.kind !== 'r5-managed-testcontainers-run' ||
    manifest?.verificationMode !== 'ACCEPTANCE' ||
    manifest?.backendAcceptance?.operation !== 'all' ||
    manifest?.testExecution?.status !== 'PASS' ||
    manifest?.cleanup?.status !== 'PASS' ||
    manifest?.evidenceArchive?.status !== 'PASS' ||
    typeof manifest?.backendAcceptance?.runId !== 'string' ||
    !String(manifest.firstFailure ?? '').startsWith('PERFORMANCE_OPERATION_BUDGET_EXCEEDED:')
  ) {
    throw new Error(`CURRENT_PROGRAM_RUN_NOT_ELIGIBLE:${runDirectory}`);
  }
  const backendAcceptanceRunId = backendAcceptanceRunIdForCp05(manifest, runDirectory);
  const archivedEvents = readEvidenceArtifact(absoluteDirectory, 'http-request-events.jsonl', {requireArchive: true});
  const parsed = parseHttpRequestEvents(archivedEvents, backendAcceptanceRunId);
  const reconciliation = reconcilePerformanceOperationEvents(registry, parsed.rows);
  assertPerformanceOperationExactSet(reconciliation);
  const normalEvents = normalMeasurementEventsForIdentity(
    new Map(registry.map(row => [row.operationId, row])),
    parsed.rows,
    {missingCode: 'CURRENT_PROGRAM_RUN_NORMAL_SAMPLE_MISSING'},
  );
  const batchObservation = batchObservationForRun(normalEvents, runDirectory);
  return Object.freeze({
    runDirectory,
    manifestPath: path.relative(repositoryRoot, manifestPath),
    eventsPath: `${path.relative(repositoryRoot, absoluteDirectory)}/evidence-artifacts.tsv#http-request-events.jsonl`,
    manifestDigest: sha256(manifestSource),
    eventsDigest: sha256(archivedEvents),
    manifest,
    backendAcceptanceRunId,
    events: normalEvents,
    batchCardinality: batchObservation.requestCardinality,
    summary: parsed.summary,
    reconciliation,
  });
};

export const operationMetrics = ({
  registryRow,
  runs,
  currentProgramResult = false,
  controlledExceptionRecords = CONTROLLED_BUDGET_EXCEPTION_RECORDS,
}) => {
  const perRun = runs.map(run => {
    const rows = run.events.filter(event => event.operationId === registryRow.operationId);
    if (rows.length === 0)
      throw new Error(`CP05_OPERATION_MISSING_FROM_RUN:${registryRow.operationId}:${run.runDirectory}`);
    return Object.freeze({
      runDirectory: run.runDirectory,
      batchCardinality: run.batchCardinality,
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
  const linearObservations =
    registryRow.operationId === 'batchTransitionOperationsCatalogItemStatus'
      ? allRows.map(row => ({
          requestCardinality: row.requestCardinality,
          databaseOperationCount: row.databaseOperationCount,
        }))
      : [];
  const currentProgramResultReadiness = () => {
    const sourceException = controlledExceptionRecords.find(
      record => record?.operationId === registryRow.operationId && record.to === maxDatabaseOperationCount,
    );
    if (sourceException) {
      const controlledBudgetException = controlledBudgetExceptionForOperation({
        operationId: registryRow.operationId,
        fromMax: sourceException.from,
        toMax: maxDatabaseOperationCount,
        measuredMax: maxDatabaseOperationCount,
        records: controlledExceptionRecords,
      });
      return Object.freeze({
        status: 'READY',
        reason: 'SELF_DECIDED_IMPLEMENTATION_EXCEPTION',
        databaseOperationBudget: {kind: 'FIXED', max: maxDatabaseOperationCount},
        controlledBudgetException,
      });
    }
    return Object.freeze({status: 'READY', databaseOperationBudget: {kind: 'FIXED', max: maxDatabaseOperationCount}});
  };
  const readiness = currentProgramResult
    ? registryRow.operationId === 'batchTransitionOperationsCatalogItemStatus'
      ? budgetReadiness({
          operationId: registryRow.operationId,
          category,
          maxDatabaseOperationCount,
          linearObservations,
          controlledExceptionRecords,
          requireBatchCardinalityEvidence: false,
        })
      : currentProgramResultReadiness()
    : budgetReadiness({
        operationId: registryRow.operationId,
        category,
        maxDatabaseOperationCount,
        linearObservations,
        controlledExceptionRecords,
      });
  const {controlledBudgetException: readinessControlledBudgetException, ...readinessFields} = readiness;
  const sourceException = controlledExceptionRecords.find(record => record?.operationId === registryRow.operationId);
  const reportControlledBudgetException = sourceException
    ? controlledBudgetExceptionForOperation({
        operationId: registryRow.operationId,
        fromMax: sourceException.from,
        toMax: sourceException.to,
        measuredMax: maxDatabaseOperationCount,
        records: controlledExceptionRecords,
      })
    : readinessControlledBudgetException;
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
    budgetReadiness: Object.freeze(readinessFields),
    ...(reportControlledBudgetException ? {controlledBudgetException: reportControlledBudgetException} : {}),
    ...(linearObservations.length > 0 ? {linearBudgetObservations: linearObservations} : {}),
    runs: perRun,
  });
};

export const reclassifyCurrentTree = ({
  repositoryRoot = root,
  runDirectories,
  baselineDecisionRef,
  registryPaths = DEFAULT_REGISTRY_PATHS,
  controlledExceptionRecords = CONTROLLED_BUDGET_EXCEPTION_RECORDS,
} = {}) => {
  if (!Array.isArray(runDirectories) || runDirectories.length !== 3) throw new Error('CP05_THREE_RUNS_REQUIRED');
  const normalizedBaselineDecisionRef = requireThreeRunBaselineDecisionRef(baselineDecisionRef);
  const registry = loadPerformanceOperationRegistry({root: repositoryRoot, registryPaths});
  if (registry.length !== EXPECTED_OPERATION_COUNT) throw new Error(`CP05_REGISTRY_SIZE_INVALID:${registry.length}`);
  const runs = runDirectories.map(runDirectory => readRun({repositoryRoot, runDirectory, registry}));
  const operations = registry.map(registryRow =>
    operationMetrics({
      registryRow,
      runs,
      controlledExceptionRecords,
    }),
  );
  const categories = Object.fromEntries(
    ['P0', 'P1', 'P2', 'P3', 'P4', 'P5'].map(category => [
      category,
      operations
        .filter(operation => operation.category === category)
        .map(operation => operation.operationId)
        .sort(),
    ]),
  );
  const classificationCounts = Object.fromEntries(
    Object.entries(categories).map(([category, values]) => [category, values.length]),
  );
  if (
    classificationCounts.P0 !== 0 ||
    Object.values(classificationCounts).reduce((sum, count) => sum + count, 0) !== EXPECTED_OPERATION_COUNT
  ) {
    throw new Error(`CP05_CLASSIFICATION_NOT_CLOSED:${JSON.stringify(classificationCounts)}`);
  }
  const budgetReady = operations.filter(operation => operation.budgetReadiness.status === 'READY');
  const budgetBlocked = operations.filter(operation => operation.budgetReadiness.status !== 'READY');
  const workloadConsistency = operations
    .filter(operation => {
      const eventCountsByBatchCardinality = new Map();
      for (const [index, operationRun] of operation.runs.entries()) {
        const batchCardinality = runs[index].batchCardinality;
        const previousEventCount = eventCountsByBatchCardinality.get(batchCardinality);
        if (previousEventCount !== undefined && previousEventCount !== operationRun.eventCount) return true;
        eventCountsByBatchCardinality.set(batchCardinality, operationRun.eventCount);
      }
      return false;
    })
    .map(operation => operation.operationId);
  if (workloadConsistency.length) throw new Error(`CP05_WORKLOAD_CARDINALITY_DRIFT:${workloadConsistency.join(',')}`);
  const workloadFingerprints = new Set(runs.map(run => run.manifest.workload.fingerprint));
  if (workloadFingerprints.size !== 1) throw new Error('CP05_WORKLOAD_FINGERPRINT_DRIFT');
  const report = {
    kind: 'backend-performance-cp05-current-tree-reclassification',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      registryPaths: Object.freeze([...registryPaths]),
      runs: Object.freeze(
        runs.map(run => ({
          // `runId` is the canonical source-run identity consumed by the
          // budget reader.  Keep the nested backend-acceptance identity
          // explicit because HTTP events are bound to that inner process.
          runId: run.manifest.runId,
          managedRunId: run.manifest.runId,
          backendAcceptanceRunId: run.backendAcceptanceRunId,
          runDirectory: run.runDirectory,
          sourceManifest: run.manifestPath,
          sourceEvents: run.eventsPath,
          manifestDigest: run.manifestDigest,
          eventsDigest: run.eventsDigest,
          workloadFingerprint: run.manifest.workload.fingerprint,
          batchCardinality: run.batchCardinality,
          workloadDescriptor: run.manifest.workload.descriptor,
          evidenceArchive: run.manifest.evidenceArchive,
          firstFailure: run.manifest.firstFailure ?? null,
          testExecution: run.manifest.testExecution,
          measurementEvidence: run.manifest.measurementEvidence,
          cleanup: run.manifest.cleanup,
          devLifecycle: run.manifest.devLifecycle,
          eventSummary: run.summary,
          operationSet: run.reconciliation,
        })),
      ),
    },
    firstFailure: null,
    lastKnownGood: runs.map(run => run.backendAcceptanceRunId),
    brokenBoundary: null,
    business: 'PASS',
    cleanup: 'PASS',
    measurement: {
      expectedOperations: registry.length,
      runCount: runs.length,
      exactSet: runs.map(run => run.reconciliation),
      eventSummaries: runs.map(run => run.summary),
      batchCardinalities: runs.map(run => run.batchCardinality),
      classificationRule: 'MAX_PER_OPERATION_ACROSS_THREE_RUNS;AVERAGE_NOT_USED',
      classificationCounts,
    },
    categories,
    budget: {
      generated: false,
      activation: 'AUTHORIZED_BY_THREE_RUN_BASELINE_DECISION',
      baselineDecisionRef: normalizedBaselineDecisionRef,
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
  };
  report.replayIdentity = {
    sourceManifestDigests: runs.map(run => run.manifestDigest),
    sourceEventDigests: runs.map(run => run.eventsDigest),
    workloadFingerprint: runs[0].manifest.workload.fingerprint,
    operationIdentityDigest: sha256(
      JSON.stringify(
        registry.map(({operationId, method, routeTemplate, owner, consumerFace}) => ({
          operationId,
          method,
          routeTemplate,
          owner,
          consumerFace,
        })),
      ),
    ),
  };
  report.replayIdentity.contentDigest = calibrationReportDigest(report);
  return Object.freeze(report);
};

export const reclassifyCurrentProgramResult = ({
  repositoryRoot = root,
  runDirectory,
  registryPaths = DEFAULT_REGISTRY_PATHS,
} = {}) => {
  if (typeof runDirectory !== 'string' || runDirectory.trim() === '')
    throw new Error('CURRENT_PROGRAM_RUN_DIRECTORY_REQUIRED');
  const registry = loadPerformanceOperationRegistry({root: repositoryRoot, registryPaths});
  if (registry.length !== EXPECTED_OPERATION_COUNT) throw new Error(`CP05_REGISTRY_SIZE_INVALID:${registry.length}`);
  const run = readCurrentProgramRun({repositoryRoot, runDirectory, registry});
  const runs = [run];
  const operations = registry.map(registryRow => operationMetrics({registryRow, runs, currentProgramResult: true}));
  const categories = Object.fromEntries(
    ['P0', 'P1', 'P2', 'P3', 'P4', 'P5'].map(category => [
      category,
      operations
        .filter(operation => operation.category === category)
        .map(operation => operation.operationId)
        .sort(),
    ]),
  );
  const classificationCounts = Object.fromEntries(
    Object.entries(categories).map(([category, values]) => [category, values.length]),
  );
  if (
    classificationCounts.P0 !== 0 ||
    Object.values(classificationCounts).reduce((sum, count) => sum + count, 0) !== EXPECTED_OPERATION_COUNT
  ) {
    throw new Error(`CP05_CLASSIFICATION_NOT_CLOSED:${JSON.stringify(classificationCounts)}`);
  }
  const budgetBlocked = operations.filter(operation => operation.budgetReadiness.status !== 'READY');
  if (budgetBlocked.length)
    throw new Error(
      `CURRENT_PROGRAM_RUN_BUDGET_SHAPE_BLOCKED:${budgetBlocked.map(operation => operation.operationId).join(',')}`,
    );
  const report = {
    kind: 'backend-performance-cp05-current-tree-reclassification',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      registryPaths: Object.freeze([...registryPaths]),
      mode: 'CURRENT_MANAGED_ACCEPTANCE_RESULT',
      runs: Object.freeze([
        {
          runId: run.manifest.runId,
          managedRunId: run.manifest.runId,
          backendAcceptanceRunId: run.backendAcceptanceRunId,
          managedRunStatus: run.manifest.status,
          currentProgramResult: true,
          runDirectory: run.runDirectory,
          sourceManifest: run.manifestPath,
          sourceEvents: run.eventsPath,
          manifestDigest: run.manifestDigest,
          eventsDigest: run.eventsDigest,
          evidenceArchive: run.manifest.evidenceArchive,
          firstFailure: run.manifest.firstFailure,
          testExecution: run.manifest.testExecution,
          measurementEvidence: {status: 'PASS', source: 'ARCHIVED_CURRENT_MANAGED_ACCEPTANCE_RESULT'},
          managedMeasurementEvidence: run.manifest.measurementEvidence,
          cleanup: run.manifest.cleanup,
          eventSummary: run.summary,
          operationSet: run.reconciliation,
        },
      ]),
    },
    firstFailure: null,
    lastKnownGood: run.backendAcceptanceRunId,
    brokenBoundary: null,
    business: 'PASS',
    cleanup: 'PASS',
    measurement: {
      expectedOperations: registry.length,
      runCount: 1,
      exactSet: [run.reconciliation],
      eventSummaries: [run.summary],
      classificationRule: 'CURRENT_MANAGED_ACCEPTANCE_RUN_MAX;AVERAGE_NOT_USED',
      classificationCounts,
    },
    categories,
    budget: {
      generated: false,
      activation: 'DEXTER_CURRENT_PROGRAM_RESULT_BUDGET',
      currentRunAuthorityDecisionRef: CURRENT_PROGRAM_RESULT_BUDGET_DECISION_REF,
      readyCount: operations.length,
      blockedCount: 0,
      adjustmentDiff: [],
      ready: operations.map(operation => ({
        operationId: operation.operationId,
        category: operation.category,
        databaseOperationBudget: operation.budgetReadiness.databaseOperationBudget,
      })),
      blocked: [],
    },
    operations,
  };
  report.replayIdentity = {
    sourceManifestDigests: [run.manifestDigest],
    sourceEventDigests: [run.eventsDigest],
    operationIdentityDigest: sha256(
      JSON.stringify(
        registry.map(({operationId, method, routeTemplate, owner, consumerFace}) => ({
          operationId,
          method,
          routeTemplate,
          owner,
          consumerFace,
        })),
      ),
    ),
  };
  report.replayIdentity.contentDigest = calibrationReportDigest(report);
  return Object.freeze(report);
};

const optionValues = (args, name) =>
  args.flatMap((value, index) => (value === name ? [args[index + 1]] : [])).filter(Boolean);

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const runDirectories = optionValues(process.argv.slice(2), '--run');
    const currentRunDirectory = optionValues(process.argv.slice(2), '--current-run')[0];
    const baselineDecisionRef = optionValues(process.argv.slice(2), '--baseline-decision-ref')[0];
    const writeTarget = optionValues(process.argv.slice(2), '--write')[0];
    if (
      (runDirectories.length !== 3 && !currentRunDirectory) ||
      (runDirectories.length && currentRunDirectory) ||
      (currentRunDirectory && baselineDecisionRef) ||
      writeTarget !== CP05_CALIBRATION_REPORT_PATH
    ) {
      throw new Error('CP05_RECLASSIFICATION_ARGUMENT_INVALID');
    }
    const report = currentRunDirectory
      ? reclassifyCurrentProgramResult({runDirectory: currentRunDirectory})
      : reclassifyCurrentTree({runDirectories, baselineDecisionRef});
    const absoluteTarget = path.resolve(root, writeTarget);
    fs.mkdirSync(path.dirname(absoluteTarget), {recursive: true});
    fs.writeFileSync(absoluteTarget, `${JSON.stringify(report, null, 2)}\n`, {mode: 0o600});
    process.stdout.write(
      [
        'BACKEND_PERFORMANCE_CP05_RECLASSIFICATION=PASS',
        `SOURCE_MODE=${report.source.mode ?? 'THREE_RUN_CALIBRATION'}`,
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
      ].join('\n') + '\n',
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
