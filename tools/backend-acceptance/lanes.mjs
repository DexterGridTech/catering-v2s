import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const TARGET_MILLIS = 600_000;
const NAMESPACE_PREFIX = /^[a-z][a-z0-9-]{2,48}$/;
const RUN_ID = /^[A-Za-z0-9._:-]{8,128}$/;
const POSITIVE_INTEGER = Number.isSafeInteger;

const fail = (code) => {
  const error = new Error(code);
  error.code = code;
  throw error;
};

const requiredPositiveInteger = (value, code) => {
  if (!POSITIVE_INTEGER(value) || value < 1) fail(code);
  return value;
};

const requiredToken = (value, pattern, code) => {
  if (typeof value !== 'string' || !pattern.test(value)) fail(code);
  return value;
};

const unique = (values, code) => {
  if (!Array.isArray(values) || values.length === 0 || new Set(values).size !== values.length) fail(code);
  return values;
};

/**
 * Reads the explicit resource boundary for one managed backend-acceptance run.
 * No default lane count is hidden here: the caller either supplies a lane count or
 * the resource manifest's maximum is selected by deriveLanePlan().
 */
export function readLaneConfig(environment = process.env) {
  const maximum = Number(environment.V2S_BACKEND_ACCEPTANCE_ISOLATED_RESOURCE_MAXIMUM);
  requiredPositiveInteger(maximum, 'BACKEND_ACCEPTANCE_RESOURCE_MAXIMUM_INVALID');
  const requestedValue = environment.V2S_BACKEND_ACCEPTANCE_LANE_COUNT;
  const requested = requestedValue === undefined ? null : Number(requestedValue);
  if (requested !== null) requiredPositiveInteger(requested, 'BACKEND_ACCEPTANCE_LANE_COUNT_INVALID');
  const namespacePrefix = requiredToken(
    environment.V2S_BACKEND_ACCEPTANCE_NAMESPACE_PREFIX,
    NAMESPACE_PREFIX,
    'BACKEND_ACCEPTANCE_NAMESPACE_PREFIX_INVALID',
  );
  return Object.freeze({
    isolatedResourceMaximum: maximum,
    requestedLaneCount: requested,
    namespacePrefix,
    perEditFullModeEngineeringTargetMillis: TARGET_MILLIS,
  });
}

function operationKey(operation) {
  if (typeof operation?.identityKey === 'string' && operation.identityKey.length > 0) return operation.identityKey;
  if (!operation?.identity || typeof operation.identity !== 'object') fail('BACKEND_ACCEPTANCE_OPERATION_IDENTITY_INVALID');
  return JSON.stringify([
    operation.identity.operationId,
    operation.identity.method,
    operation.identity.normalizedPath ?? operation.identity.path,
    operation.identity.consumerFace,
    operation.identity.owner,
  ]);
}

function schedulingWeights(operations, baseline) {
  const byKey = new Map((baseline?.operations ?? []).map((entry) => [
    entry.identityKey ?? operationKey(entry),
    entry,
  ]));
  const weights = operations.map((operation) => {
    const key = operationKey(operation);
    const entry = byKey.get(key);
    const value = entry?.latest?.schedulingWeightMillis;
    return {key, weightMillis: POSITIVE_INTEGER(value) && value > 0 ? value : null};
  });
  return weights;
}

/**
 * Derives full-mode capacity before any container is initialized.  With no fresh
 * scheduling history the contract deliberately uses the maximum isolated lane
 * count as the minimum safe capacity; it never guesses a smaller parallelism.
 */
export function deriveLanePlan({
  operations,
  baseline,
  runId,
  isolatedResourceMaximum,
  requestedLaneCount = null,
  namespacePrefix,
  perEditFullModeEngineeringTargetMillis = TARGET_MILLIS,
}) {
  requiredToken(runId, RUN_ID, 'BACKEND_ACCEPTANCE_RUN_ID_INVALID');
  if (!Array.isArray(operations) || operations.length === 0) fail('BACKEND_ACCEPTANCE_OPERATION_DENOMINATOR_EMPTY');
  requiredPositiveInteger(isolatedResourceMaximum, 'BACKEND_ACCEPTANCE_RESOURCE_MAXIMUM_INVALID');
  if (requestedLaneCount !== null) requiredPositiveInteger(requestedLaneCount, 'BACKEND_ACCEPTANCE_LANE_COUNT_INVALID');
  requiredPositiveInteger(perEditFullModeEngineeringTargetMillis, 'BACKEND_ACCEPTANCE_TARGET_MILLIS_INVALID');
  requiredToken(namespacePrefix, NAMESPACE_PREFIX, 'BACKEND_ACCEPTANCE_NAMESPACE_PREFIX_INVALID');

  const weights = schedulingWeights(operations, baseline);
  const allMeasured = weights.every(({weightMillis}) => weightMillis !== null);
  const totalSchedulingWeightMillis = allMeasured
    ? weights.reduce((sum, entry) => sum + entry.weightMillis, 0)
    : null;
  const derivedMinimumLaneCount = allMeasured
    ? Math.max(1, Math.ceil(totalSchedulingWeightMillis / perEditFullModeEngineeringTargetMillis))
    : isolatedResourceMaximum;
  const minimumLaneCount = Math.min(derivedMinimumLaneCount, operations.length);
  const selectedLaneCount = Math.min(operations.length, requestedLaneCount ?? (allMeasured ? derivedMinimumLaneCount : isolatedResourceMaximum));

  if (selectedLaneCount < minimumLaneCount || selectedLaneCount > isolatedResourceMaximum) {
    fail('BACKEND_ACCEPTANCE_FULL_MODE_CAPACITY_INSUFFICIENT');
  }

  const laneNumbers = Array.from({length: selectedLaneCount}, (_, index) => index + 1);
  const databaseOrSchemaNamespaces = laneNumbers.map((lane) => `${namespacePrefix}-db-${lane}`);
  const objectStorageNamespaces = laneNumbers.map((lane) => `${namespacePrefix}-asset-${lane}`);
  unique(databaseOrSchemaNamespaces, 'LANE_WRITABLE_NAMESPACE_COLLISION');
  unique(objectStorageNamespaces, 'LANE_WRITABLE_NAMESPACE_COLLISION');

  return Object.freeze({
    schemaVersion: 1,
    runId,
    targetMillis: perEditFullModeEngineeringTargetMillis,
    schedulingWeightSourceRunId: allMeasured ? runId : 'NO_FRESH_SCHEDULING_HISTORY',
    totalSchedulingWeightMillis,
    minimumLaneCount,
    isolatedResourceMaximum,
    selectedLaneCount,
    databaseOrSchemaNamespaces: Object.freeze(databaseOrSchemaNamespaces),
    objectStorageNamespaces: Object.freeze(objectStorageNamespaces),
    coverageNeverReducedForTime: true,
    operations: operations.length,
  });
}

export function materializeLaneRecords(plan, {engineIds = []} = {}) {
  if (!plan || !POSITIVE_INTEGER(plan.selectedLaneCount) || plan.selectedLaneCount < 1) fail('BACKEND_ACCEPTANCE_LANE_PLAN_INVALID');
  if (engineIds.length !== 0 && engineIds.length !== plan.selectedLaneCount) fail('BACKEND_ACCEPTANCE_LANE_ENGINE_SET_INVALID');
  const records = Array.from({length: plan.selectedLaneCount}, (_, index) => {
    const lane = index + 1;
    return {
      lane,
      engineId: engineIds[index] ?? null,
      databaseOrSchemaNamespace: plan.databaseOrSchemaNamespaces[index],
      objectStorageNamespace: plan.objectStorageNamespaces[index],
      initialized: false,
      status: 'NOT_STARTED',
      firstFailure: null,
      currentOperation: null,
      completed: 0,
      operationIds: [],
    };
  });
  assertLaneIsolation(records);
  return records;
}

/**
 * Partitions the already-derived operation denominator into disjoint lane units.
 * The parent owns this mapping; a child never invents or drops an operation id.
 */
export function partitionLaneTargets(operations, laneCount) {
  if (!Array.isArray(operations) || operations.length === 0) fail('BACKEND_ACCEPTANCE_OPERATION_DENOMINATOR_EMPTY');
  requiredPositiveInteger(laneCount, 'BACKEND_ACCEPTANCE_LANE_COUNT_INVALID');
  const effectiveLaneCount = Math.min(laneCount, operations.length);
  const operationIds = operations.map((operation) => operation.identity?.operationId);
  if (operationIds.some((operationId) => typeof operationId !== 'string' || operationId.length === 0)
      || new Set(operationIds).size !== operationIds.length) {
    fail('BACKEND_ACCEPTANCE_OPERATION_IDENTITY_PARTITION_INVALID');
  }
  const partitions = Array.from({length: effectiveLaneCount}, (_, index) => ({lane: index + 1, operations: []}));
  operations.forEach((operation, index) => partitions[index % effectiveLaneCount].operations.push(operation));
  const allKeys = operations.map(operationKey);
  const partitionKeys = partitions.flatMap(({operations: laneOperations}) => laneOperations.map(operationKey));
  if (new Set(allKeys).size !== allKeys.length
      || new Set(partitionKeys).size !== partitionKeys.length
      || allKeys.length !== partitionKeys.length
      || allKeys.some((key) => !partitionKeys.includes(key))) {
    fail('BACKEND_ACCEPTANCE_LANE_OPERATION_PARTITION_INVALID');
  }
  return Object.freeze(partitions.map(({lane, operations: laneOperations}) => Object.freeze({
    lane,
    operations: Object.freeze(laneOperations),
    operationIds: Object.freeze(laneOperations.map((operation) => operation.identity.operationId)),
  })));
}

export function assertLaneIsolation(lanes) {
  if (!Array.isArray(lanes) || lanes.length === 0) fail('BACKEND_ACCEPTANCE_LANE_SET_INVALID');
  unique(lanes.map((lane) => lane.lane), 'LANE_ID_COLLISION');
  unique(lanes.map((lane) => lane.databaseOrSchemaNamespace), 'LANE_WRITABLE_NAMESPACE_COLLISION');
  unique(lanes.map((lane) => lane.objectStorageNamespace), 'LANE_WRITABLE_NAMESPACE_COLLISION');
  const engines = lanes.map((lane) => lane.engineId).filter((value) => value !== null);
  if (engines.length > 0) unique(engines, 'LANE_ENGINE_ID_COLLISION');
  return true;
}

/**
 * Admission is a separate phase from container initialization.  The runner can
 * use this immutable transition helper to make the ordering mechanically visible.
 */
export function markAdmissionCompleted(manifest, at = new Date().toISOString()) {
  if (!manifest || manifest.admissionCompletedAt || manifest.containerInitializationStartedAt) fail('ADMISSION_AFTER_INITIALIZATION');
  return {...manifest, admissionCompletedAt: at};
}

export function markContainerInitializationStarted(manifest, at = new Date().toISOString()) {
  if (!manifest?.admissionCompletedAt || manifest.containerInitializationStartedAt) fail('ADMISSION_AFTER_INITIALIZATION');
  return {...manifest, containerInitializationStartedAt: at};
}

export function createLaneScheduler(targets, laneCount) {
  if (!Array.isArray(targets) || targets.length === 0) fail('BACKEND_ACCEPTANCE_OPERATION_DENOMINATOR_EMPTY');
  requiredPositiveInteger(laneCount, 'BACKEND_ACCEPTANCE_LANE_COUNT_INVALID');
  if (laneCount > targets.length) laneCount = targets.length;
  const queues = Array.from({length: laneCount}, () => []);
  targets.forEach((target, index) => queues[index % laneCount].push(target));
  const completed = new Set();
  return {
    next(laneIndex) {
      if (!POSITIVE_INTEGER(laneIndex) || laneIndex < 1 || laneIndex > queues.length) fail('BACKEND_ACCEPTANCE_LANE_INDEX_INVALID');
      const own = queues[laneIndex - 1];
      const donor = own.length > 0
        ? {index: laneIndex - 1, queue: own}
        : queues.map((queue, index) => ({index, queue}))
          .filter(({queue}) => queue.length > 0)
          .sort((left, right) => right.queue.length - left.queue.length || right.index - left.index)[0];
      if (!donor) return null;
      const target = donor.queue.shift();
      return {target, originLane: donor.index + 1};
    },
    complete(target) {
      if (target === undefined || target === null || completed.has(target)) fail('BACKEND_ACCEPTANCE_OPERATION_COMPLETION_INVALID');
      completed.add(target);
    },
    remaining() { return queues.reduce((sum, queue) => sum + queue.length, 0); },
    completed() { return completed.size; },
    laneCount: queues.length,
  };
}

export function progressEvent({runId, lane, current, total, startedAt, firstFailure = null, business = 'NOT_RUN', cleanup = 'NOT_RUN', operation = null, now = Date.now()}) {
  requiredToken(runId, RUN_ID, 'BACKEND_ACCEPTANCE_RUN_ID_INVALID');
  requiredPositiveInteger(lane, 'BACKEND_ACCEPTANCE_LANE_INDEX_INVALID');
  requiredPositiveInteger(total, 'BACKEND_ACCEPTANCE_OPERATION_DENOMINATOR_EMPTY');
  if (!POSITIVE_INTEGER(current) || current < 0 || current > total) fail('BACKEND_ACCEPTANCE_PROGRESS_INVALID');
  if (!POSITIVE_INTEGER(startedAt) || startedAt > now) fail('BACKEND_ACCEPTANCE_PROGRESS_INVALID');
  return {
    kind: 'backend-acceptance-progress',
    runId,
    lane,
    current,
    total,
    passed: current,
    failed: firstFailure ? 1 : 0,
    remaining: total - current,
    elapsedMillis: now - startedAt,
    operation,
    firstFailure,
    business,
    cleanup,
  };
}

function loadSelfTestOperations() {
  const scenarioPath = path.join(root, 'contracts/registry/backend-acceptance-scenarios.json');
  const scenarios = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
  return scenarios.operations;
}

export function selfTest() {
  const operations = loadSelfTestOperations();
  const runId = 'backend-acceptance-lanes-selftest-20260813';
  const clean = deriveLanePlan({
    operations,
    baseline: {operations: []},
    runId,
    isolatedResourceMaximum: 4,
    namespacePrefix: 'backend-acceptance-selftest',
  });
  if (clean.selectedLaneCount !== 4 || clean.minimumLaneCount !== 4) fail('BACKEND_ACCEPTANCE_LANE_SELF_TEST_CLEAN_INVALID');
  const records = materializeLaneRecords(clean, {engineIds: ['engine-a', 'engine-b', 'engine-c', 'engine-d']});
  assertLaneIsolation(records);
  const admission = markAdmissionCompleted({kind: 'backend-acceptance-run'});
  markContainerInitializationStarted(admission);
  try { markContainerInitializationStarted({kind: 'backend-acceptance-run'}); fail('BACKEND_ACCEPTANCE_LANE_SELF_TEST_RED_ADMISSION_NOT_DETECTED'); }
  catch (error) { if (error.code !== 'ADMISSION_AFTER_INITIALIZATION') throw error; }
  try {
    materializeLaneRecords({...clean, databaseOrSchemaNamespaces: [...clean.databaseOrSchemaNamespaces.slice(0, -1), clean.databaseOrSchemaNamespaces[0]]});
    fail('BACKEND_ACCEPTANCE_LANE_SELF_TEST_RED_NAMESPACE_NOT_DETECTED');
  } catch (error) { if (error.code !== 'LANE_WRITABLE_NAMESPACE_COLLISION') throw error; }
  try {
    deriveLanePlan({operations, baseline: {operations: operations.map((operation) => ({identity: operation.identity, latest: {schedulingWeightMillis: 600_001}}))}, runId, isolatedResourceMaximum: 1, requestedLaneCount: 1, namespacePrefix: 'backend-acceptance-selftest'});
    fail('BACKEND_ACCEPTANCE_LANE_SELF_TEST_RED_CAPACITY_NOT_DETECTED');
  } catch (error) { if (error.code !== 'BACKEND_ACCEPTANCE_FULL_MODE_CAPACITY_INSUFFICIENT') throw error; }
  const scheduler = createLaneScheduler(['a', 'b', 'c', 'd'], 2);
  const first = scheduler.next(1);
  scheduler.complete(first.target);
  const second = scheduler.next(2);
  scheduler.complete(second.target);
  const sibling = scheduler.next(2);
  if (!sibling || sibling.target === first.target || scheduler.laneCount !== 2) fail('LANE_FAILURE_PROPAGATION_INVALID');
  const partitions = partitionLaneTargets(operations.slice(0, 5), 3);
  if (partitions.length !== 3 || new Set(partitions.flatMap((lane) => lane.operationIds)).size !== 5
      || partitions.flatMap((lane) => lane.operations).length !== 5) fail('BACKEND_ACCEPTANCE_LANE_PARTITION_INVALID');
  try {
    partitionLaneTargets([operations[0], {...operations[1], identity: {...operations[1].identity, operationId: operations[0].identity.operationId}}], 2);
    fail('BACKEND_ACCEPTANCE_LANE_SELF_TEST_RED_OPERATION_ID_COLLISION_NOT_DETECTED');
  } catch (error) { if (error.code !== 'BACKEND_ACCEPTANCE_OPERATION_IDENTITY_PARTITION_INVALID') throw error; }
  process.stdout.write('BACKEND_ACCEPTANCE_LANES_SELF_TEST=PASS\n');
  process.stdout.write('RED_ADMISSION_ORDER=PASS\nRED_NAMESPACE_COLLISION=PASS\nRED_CAPACITY=PASS\nLANE_FAILURE_INDEPENDENCE=PASS\nRED_OPERATION_ID_COLLISION=PASS\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname && process.argv[2] === '--self-test') {
  try { selfTest(); } catch (error) { process.stderr.write(`BACKEND_ACCEPTANCE_LANES_SELF_TEST=FAIL; REASON=${error.code ?? error.message}\n`); process.exitCode = 2; }
}
