import {readFileSync} from 'node:fs';

const FORBIDDEN = /(?:password|secret|token|cookie|authorization|otp|mobile|login|account|identity|payload|sql|bind)/i;
const SAFE_HANDLE = /^[A-Z][A-Z0-9_]{2,96}$/;

export function loadGeneratedDiagnosticRegistry(registryPath) {
  let registry;
  try { registry = JSON.parse(readFileSync(registryPath, 'utf8')); } catch { throw new Error('HTTP_DIAGNOSTIC_REGISTRY_INVALID'); }
  if (registry?.schemaVersion !== 2 || !Array.isArray(registry.operations) || !Number.isInteger(registry?.closure?.operations)) throw new Error('HTTP_DIAGNOSTIC_REGISTRY_INVALID');
  const operations = registry.operations.flatMap((operation) => {
    if (!operation?.operationId || !operation?.method || !operation?.path || !operation?.owner || !Array.isArray(operation.consumerFaces) || operation.consumerFaces.length === 0) throw new Error('HTTP_DIAGNOSTIC_REGISTRY_OPERATION_INVALID');
    return operation.consumerFaces.map((consumerFace) => ({operationId: operation.operationId, method: operation.method.toUpperCase(), path: operation.path, owner: operation.owner, consumerFace}));
  });
  if (operations.length !== registry.closure.operations || new Set(operations.map(diagnosticTuple)).size !== operations.length) throw new Error('HTTP_DIAGNOSTIC_REGISTRY_EXACT_SET_INVALID');
  return operations;
}

export function scenarioSkeleton(registryOperations) {
  return registryOperations.map((operation) => ({...operation, scenario: 'PENDING_EXPLICIT_SCENARIO'}));
}

export function validateDiagnosticScenarios(registryOperations, scenarios) {
  if (!Array.isArray(scenarios)) throw new Error('HTTP_DIAGNOSTIC_SCENARIOS_INVALID');
  const expected = new Set(registryOperations.map(diagnosticTuple));
  const actual = new Map();
  for (const scenario of scenarios) {
    const key = diagnosticTuple(scenario);
    if (!expected.has(key) || actual.has(key)) throw new Error('HTTP_DIAGNOSTIC_SCENARIO_SET_INVALID');
    if (!['positive', 'expectedRejected'].includes(scenario?.scenario) || !Array.isArray(scenario?.prerequisiteHandles) || !Array.isArray(scenario?.secretHandles) || !scenario?.requestShape || typeof scenario.requestShape !== 'object' || typeof scenario.oracle !== 'string' || typeof scenario.ownerReadback !== 'string') throw new Error('HTTP_DIAGNOSTIC_SCENARIO_SHAPE_INVALID');
    if (scenario.scenario === 'expectedRejected' && (!Number.isInteger(scenario.expectedStatus) || scenario.expectedStatus < 400 || scenario.expectedStatus > 499 || typeof scenario.typedRejection !== 'string' || !SAFE_HANDLE.test(scenario.typedRejection))) throw new Error('HTTP_DIAGNOSTIC_REJECTION_ASSERTION_INVALID');
    if (scenario.scenario === 'positive' && scenario.expectedStatus !== undefined) throw new Error('HTTP_DIAGNOSTIC_POSITIVE_STATUS_FORBIDDEN');
    for (const handle of [...scenario.prerequisiteHandles, ...scenario.secretHandles]) if (typeof handle !== 'string' || !SAFE_HANDLE.test(handle)) throw new Error('HTTP_DIAGNOSTIC_HANDLE_INVALID');
    assertSafe(scenario.requestShape);
    actual.set(key, scenario);
  }
  if (actual.size !== expected.size) throw new Error('HTTP_DIAGNOSTIC_SCENARIO_SET_INVALID');
  return [...actual.values()].sort((left, right) => diagnosticTuple(left).localeCompare(diagnosticTuple(right)));
}

export function diagnosticTuple(value) { return `${value?.operationId}|${value?.method}|${value?.path}|${value?.owner}|${value?.consumerFace}`; }
function assertSafe(value, key = '') {
  if (FORBIDDEN.test(key)) throw new Error('HTTP_DIAGNOSTIC_SECRET_FIELD');
  if (Array.isArray(value)) return value.forEach((entry) => assertSafe(entry, key));
  if (value && typeof value === 'object') return Object.entries(value).forEach(([name, entry]) => assertSafe(entry, name));
  if (typeof value === 'string' && FORBIDDEN.test(value)) throw new Error('HTTP_DIAGNOSTIC_SECRET_VALUE');
}
