#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {
  loadGeneratedOperationRegistry,
  materializeGeneratedOperationPath,
  normalizeEdgePath,
  resolveGeneratedOperationById,
} from './seed-report.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../..');
const catalogRegistryPath = path.join(repositoryRoot, 'apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json');
const fixtureCatalogPath = path.join(repositoryRoot, 'contracts/policy/catalog-inventory-fixture-catalog.json');

export const BROWSER_L2_CATALOG_FIXTURE_KIND = 'browser-l2-catalog-owner-http-fixture';
export const BROWSER_L2_CATALOG_RESULT_KIND = 'browser-l2-catalog-owner-http-fixture-result';

export const CATALOG_LIBRARY_FIXTURE_REFS = Object.freeze([
  'FIXTURE-CATALOG-LIBRARY-FIND',
  'FIXTURE-CATALOG-LIBRARY-VIEW',
  'FIXTURE-CATALOG-LIBRARY-CREATE',
  'FIXTURE-CATALOG-LIBRARY-EDIT',
  'FIXTURE-CATALOG-LIBRARY-CONFIG',
  'FIXTURE-CATALOG-LIBRARY-BATCH',
  'FIXTURE-CATALOG-LIBRARY-COPY',
  'FIXTURE-CATALOG-LIBRARY-GOVERNANCE',
]);

const OWNER_STAGE_GROUPS = Object.freeze(['setup', 'readback', 'cleanup']);
const TERMINAL_STATUSES = Object.freeze(['PASS', 'FAIL', 'NOT_RUN', 'NOT_APPLICABLE']);
const SENSITIVE_KEY = /(?:password|secret|token|cookie|authorization|otp|mobile|phone|login|account|credential|private.?key|signed.?url|raw.?payload|raw.?body|session|storage.?state|hash|sql|jdbc|postgres)/i;
const SENSITIVE_VALUE = /(?:Bearer\s+|Basic\s+|jdbc:|postgres(?:ql)?:\/\/|set-cookie|-----BEGIN [A-Z ]+PRIVATE KEY-----)/i;
const FORBIDDEN_RUNTIME_INPUT_KEY = /(?:^|_)(?:DEV|SEED|MANIFEST|REPORT|SESSION)(?:_|$)|SEED_REPORT|API_REPORT|DEV_MANIFEST|RUN_MANIFEST|STORAGE_STATE/i;

export class BrowserL2CatalogFixtureFailure extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}:${detail}` : code);
    this.name = 'BrowserL2CatalogFixtureFailure';
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail = '') {
  throw new BrowserL2CatalogFixtureFailure(code, detail);
}

function assert(condition, code, detail = '') {
  if (!condition) fail(code, detail);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function readJson(filePath, code) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    fail(code, path.relative(repositoryRoot, filePath));
  }
}

function validateRunId(value) {
  assert(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(value), 'L2_CATALOG_FIXTURE_RUN_BINDING_INVALID');
  return value;
}

function validateDatabaseNamespace(value) {
  assert(typeof value === 'string' && /^catering_v2s_l2_[a-z0-9_]{3,64}$/.test(value), 'L2_CATALOG_FIXTURE_NAMESPACE_BINDING_INVALID');
  return value;
}

function validateAssetPrefix(value, runId) {
  assert(typeof value === 'string'
    && /^[A-Za-z][A-Za-z0-9+.-]{1,31}:\/\/[^\s?#]+\/$/.test(value)
    && value.includes(runId), 'L2_CATALOG_FIXTURE_NAMESPACE_BINDING_INVALID');
  return value;
}

function validateStageId(value) {
  assert(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{1,160}$/.test(value), 'L2_CATALOG_FIXTURE_STAGE_INVALID');
  return value;
}

function validateExpectedStatuses(value) {
  const statuses = value ?? [200];
  assert(Array.isArray(statuses) && statuses.length > 0, 'L2_CATALOG_FIXTURE_STAGE_INVALID');
  for (const status of statuses) assert(Number.isInteger(status) && status >= 100 && status <= 599, 'L2_CATALOG_FIXTURE_STAGE_INVALID');
  return Object.freeze([...new Set(statuses)]);
}

function assertNoForbiddenRuntimeInputs(environment = {}) {
  const forbidden = Object.entries(environment)
    .filter(([key, value]) => FORBIDDEN_RUNTIME_INPUT_KEY.test(key) && value !== undefined && value !== null && value !== '');
  assert(forbidden.length === 0, 'L2_CATALOG_FIXTURE_FORBIDDEN_RUNTIME_INPUT', forbidden.map(([key]) => key).sort().join(','));
}

function assertNoSensitiveLeakInternal(value, location = '$', seen = new Set()) {
  if (typeof value === 'string') {
    assert(!SENSITIVE_VALUE.test(value), 'L2_CATALOG_FIXTURE_SECRET_LEAK', location);
    return;
  }
  if (!value || typeof value !== 'object') return;
  assert(!seen.has(value), 'L2_CATALOG_FIXTURE_SECRET_LEAK', location);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSensitiveLeakInternal(entry, `${location}[${index}]`, seen));
  } else {
    for (const [key, child] of Object.entries(value)) {
      assert(!SENSITIVE_KEY.test(key), 'L2_CATALOG_FIXTURE_SECRET_LEAK', `${location}.${key}`);
      assertNoSensitiveLeakInternal(child, `${location}.${key}`, seen);
    }
  }
  seen.delete(value);
}

export function assertNoSensitiveLeak(value) {
  assertNoSensitiveLeakInternal(value);
  return true;
}

export function redactSensitiveValue(value, location = '$', seen = new Set()) {
  if (typeof value === 'string') return SENSITIVE_VALUE.test(value) ? '[REDACTED]' : value;
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  const mapped = Array.isArray(value)
    ? value.map((entry, index) => redactSensitiveValue(entry, `${location}[${index}]`, seen))
    : Object.fromEntries(Object.entries(value).map(([key, child]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactSensitiveValue(child, `${location}.${key}`, seen),
      ]));
  seen.delete(value);
  return mapped;
}

export function createFactDigest(value, hmacSecret) {
  assert(typeof hmacSecret === 'string' && hmacSecret.length >= 16, 'L2_CATALOG_FIXTURE_HMAC_SECRET_REQUIRED');
  assertNoSensitiveLeak(value);
  return crypto.createHmac('sha256', hmacSecret).update(stableJson(value)).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function operationBudgetMax(operation) {
  const budget = operation?.databaseOperationBudget;
  if (budget?.kind === 'FIXED' && Number.isInteger(budget.max)) return budget.max;
  if (budget?.kind === 'LINEAR_REQUEST_CARDINALITY') return {kind: budget.kind, base: budget.base, perItem: budget.perItem, cardinalityPath: budget.cardinalityPath};
  return null;
}

export function loadGeneratedCatalogOperationRegistry(registryPath = catalogRegistryPath) {
  try {
    const registry = loadGeneratedOperationRegistry(registryPath);
    const catalogOperations = registry.filter((operation) =>
      operation.consumerFaces?.includes('operations-admin')
      && ['catalog', 'inventory', 'fulfillment-production', 'asset'].includes(operation.owner)
      && operation.path.startsWith('/operations/catalog-inventory/'));
    assert(catalogOperations.length > 0, 'L2_CATALOG_FIXTURE_OPERATION_REGISTRY_INVALID');
    return Object.freeze(catalogOperations);
  } catch (error) {
    if (error instanceof BrowserL2CatalogFixtureFailure) throw error;
    fail('L2_CATALOG_FIXTURE_OPERATION_REGISTRY_INVALID');
  }
}

function loadCatalogLibraryDatasets() {
  const catalog = readJson(fixtureCatalogPath, 'L2_CATALOG_FIXTURE_CATALOG_READ_FAILED');
  const testDatasets = Array.isArray(catalog.testDatasets) ? catalog.testDatasets : [];
  const byRef = new Map(testDatasets.map((entry) => [entry.fixtureId, entry]));
  const missing = CATALOG_LIBRARY_FIXTURE_REFS.filter((fixtureRef) => !byRef.has(fixtureRef));
  assert(missing.length === 0, 'L2_CATALOG_FIXTURE_EXACT_SET_MISSING', missing.join(','));
  for (const fixtureRef of CATALOG_LIBRARY_FIXTURE_REFS) {
    const dataset = byRef.get(fixtureRef);
    assert(dataset.class === 'TEST', 'L2_CATALOG_FIXTURE_CLASS_INVALID', fixtureRef);
    assert(dataset.generatorRecipe?.kind === 'OWNER_COMMAND_FIXTURE', 'L2_CATALOG_FIXTURE_RECIPE_INVALID', fixtureRef);
    for (const key of ['preState', 'actionInput', 'expectedReadback', 'unchangedReadback']) {
      assert(isPlainObject(dataset.expected?.[key]), 'L2_CATALOG_FIXTURE_EXPECTED_FACTS_MISSING', `${fixtureRef}:${key}`);
      assertNoSensitiveLeak(dataset.expected[key]);
    }
  }
  return Object.freeze(Object.fromEntries(CATALOG_LIBRARY_FIXTURE_REFS.map((fixtureRef) => [fixtureRef, byRef.get(fixtureRef)])));
}

function validateBinding(plan) {
  const runId = validateRunId(plan.runId);
  const databaseNamespace = validateDatabaseNamespace(plan.databaseNamespace);
  const assetPrefix = validateAssetPrefix(plan.assetPrefix, runId);
  if (plan.binding !== undefined) {
    assert(isPlainObject(plan.binding), 'L2_CATALOG_FIXTURE_RUN_BINDING_INVALID');
    if (plan.binding.runId !== undefined) assert(plan.binding.runId === runId, 'L2_CATALOG_FIXTURE_RUN_BINDING_MISMATCH');
    if (plan.binding.databaseNamespace !== undefined) assert(plan.binding.databaseNamespace === databaseNamespace, 'L2_CATALOG_FIXTURE_NAMESPACE_BINDING_MISMATCH');
    if (plan.binding.assetPrefix !== undefined) assert(plan.binding.assetPrefix === assetPrefix, 'L2_CATALOG_FIXTURE_NAMESPACE_BINDING_MISMATCH');
  }
  return Object.freeze({runId, databaseNamespace, assetPrefix});
}

function validateHeaders(headers) {
  if (headers === undefined) return Object.freeze({});
  assert(isPlainObject(headers), 'L2_CATALOG_FIXTURE_STAGE_INVALID');
  for (const [key, value] of Object.entries(headers)) {
    assert(/^[A-Za-z0-9-]{1,80}$/.test(key), 'L2_CATALOG_FIXTURE_STAGE_INVALID');
    assert(!/^(?:authorization|cookie|set-cookie)$/i.test(key), 'L2_CATALOG_FIXTURE_AUTH_VALUE_FORBIDDEN', key);
    assert(typeof value === 'string' && value.length > 0 && value.length <= 512 && !SENSITIVE_VALUE.test(value), 'L2_CATALOG_FIXTURE_STAGE_INVALID');
  }
  return Object.freeze({...headers});
}

function validateStage(stage, group, registry) {
  assert(isPlainObject(stage), 'L2_CATALOG_FIXTURE_STAGE_INVALID');
  const stageId = validateStageId(stage.stageId);
  assert(typeof stage.operationId === 'string' && stage.operationId.length > 0, 'L2_CATALOG_FIXTURE_OPERATION_REQUIRED', stageId);
  let operation;
  try {
    operation = resolveGeneratedOperationById(registry, stage.operationId);
  } catch {
    fail('L2_CATALOG_FIXTURE_OPERATION_UNRESOLVED', stage.operationId);
  }
  assert(['catalog', 'inventory', 'fulfillment-production', 'asset'].includes(operation.owner), 'L2_CATALOG_FIXTURE_OWNER_OPERATION_FORBIDDEN', stage.operationId);
  const pathParameters = stage.pathParameters ?? {};
  const queryParameters = stage.queryParameters ?? {};
  assert(isPlainObject(pathParameters), 'L2_CATALOG_FIXTURE_STAGE_INVALID', stageId);
  assert(isPlainObject(queryParameters), 'L2_CATALOG_FIXTURE_STAGE_INVALID', stageId);
  let pathname;
  try {
    pathname = normalizeEdgePath(materializeGeneratedOperationPath(operation, {pathParameters, queryParameters}));
  } catch (error) {
    fail('L2_CATALOG_FIXTURE_OPERATION_PATH_INVALID', `${stageId}:${error instanceof Error ? error.message : 'unknown'}`);
  }
  const body = stage.body;
  if (body !== undefined) {
    assert(isPlainObject(body) || Array.isArray(body), 'L2_CATALOG_FIXTURE_STAGE_INVALID', stageId);
    assertNoSensitiveLeak(body);
  }
  assert(stage.form === undefined, 'L2_CATALOG_FIXTURE_FORM_NOT_SUPPORTED', stageId);
  if (stage.publicFacts !== undefined) {
    assert(isPlainObject(stage.publicFacts), 'L2_CATALOG_FIXTURE_PUBLIC_FACTS_INVALID', stageId);
    assertNoSensitiveLeak(stage.publicFacts);
  }
  return Object.freeze({
    group,
    stageId,
    operationId: operation.operationId,
    owner: operation.owner,
    method: operation.method,
    routeTemplate: operation.path,
    path: pathname,
    headers: validateHeaders(stage.headers),
    body,
    expectedStatuses: validateExpectedStatuses(stage.expectedStatuses),
    publicFacts: stage.publicFacts ?? null,
    databaseOperationBudget: operationBudgetMax(operation),
  });
}

function validateFixturePlanEntry(entry, registry) {
  assert(isPlainObject(entry), 'L2_CATALOG_FIXTURE_PLAN_ENTRY_INVALID');
  assert(CATALOG_LIBRARY_FIXTURE_REFS.includes(entry.fixtureRef), 'L2_CATALOG_FIXTURE_REF_INVALID', String(entry.fixtureRef ?? 'missing'));
  const result = {fixtureRef: entry.fixtureRef};
  for (const group of OWNER_STAGE_GROUPS) {
    const stages = entry[group];
    assert(Array.isArray(stages), `L2_CATALOG_FIXTURE_${group.toUpperCase()}_STAGES_REQUIRED`, entry.fixtureRef);
    if (group !== 'cleanup') assert(stages.length > 0, `L2_CATALOG_FIXTURE_${group.toUpperCase()}_STAGES_REQUIRED`, entry.fixtureRef);
    result[group] = Object.freeze(stages.map((stage) => validateStage(stage, group, registry)));
  }
  if (entry.publicFacts !== undefined) {
    assert(isPlainObject(entry.publicFacts), 'L2_CATALOG_FIXTURE_PUBLIC_FACTS_INVALID', entry.fixtureRef);
    assertNoSensitiveLeak(entry.publicFacts);
    result.publicFacts = Object.freeze({...entry.publicFacts});
  } else {
    result.publicFacts = Object.freeze({});
  }
  return Object.freeze(result);
}

export function validateBrowserL2CatalogFixturePlan(plan, {
  registry = loadGeneratedCatalogOperationRegistry(),
  environment = process.env,
} = {}) {
  assertNoForbiddenRuntimeInputs(environment);
  assert(isPlainObject(plan), 'L2_CATALOG_FIXTURE_OWNER_PLAN_REQUIRED');
  assert(plan.schemaVersion === 1 && plan.kind === BROWSER_L2_CATALOG_FIXTURE_KIND, 'L2_CATALOG_FIXTURE_PLAN_KIND_INVALID');
  const binding = validateBinding(plan);
  assert(Array.isArray(plan.fixtures), 'L2_CATALOG_FIXTURE_OWNER_PLAN_REQUIRED');
  const fixtureRefs = plan.fixtures.map((entry) => entry?.fixtureRef);
  const uniqueFixtureRefs = new Set(fixtureRefs);
  assert(uniqueFixtureRefs.size === fixtureRefs.length, 'L2_CATALOG_FIXTURE_PLAN_DUPLICATE');
  const missing = CATALOG_LIBRARY_FIXTURE_REFS.filter((fixtureRef) => !uniqueFixtureRefs.has(fixtureRef));
  const extra = fixtureRefs.filter((fixtureRef) => !CATALOG_LIBRARY_FIXTURE_REFS.includes(fixtureRef));
  assert(missing.length === 0 && extra.length === 0, 'L2_CATALOG_FIXTURE_EXACT_SET_MISMATCH', `missing=${missing.join(',')};extra=${extra.join(',')}`);
  const datasets = loadCatalogLibraryDatasets();
  const fixtures = Object.freeze(plan.fixtures.map((entry) => validateFixturePlanEntry(entry, registry)));
  return Object.freeze({binding, fixtures, datasets});
}

function idempotencyKey(runId, stageId) {
  const digest = crypto.createHash('sha256').update(stageId).digest('hex').slice(0, 16);
  const key = `l2-catalog-${digest}-${runId}-${crypto.randomUUID()}`;
  assert(key.length <= 128, 'L2_CATALOG_FIXTURE_IDEMPOTENCY_KEY_TOO_LONG', stageId);
  return key;
}

export function materializeOwnerHttpRequest(stage, {runId}) {
  const headers = {
    Accept: 'application/json',
    ...stage.headers,
  };
  if (stage.method !== 'GET') headers['Idempotency-Key'] = idempotencyKey(runId, stage.stageId);
  const request = {
    stageId: stage.stageId,
    operationId: stage.operationId,
    owner: stage.owner,
    method: stage.method,
    path: stage.path,
    routeTemplate: stage.routeTemplate,
    headers,
    body: stage.body,
  };
  assertNoSensitiveLeak(redactSensitiveValue(request));
  return Object.freeze(request);
}

async function executeStage(stage, context) {
  const startedAtEpochMillis = Date.now();
  const request = materializeOwnerHttpRequest(stage, {runId: context.binding.runId});
  let response;
  try {
    response = await context.httpClient.request(request);
  } catch {
    fail('L2_CATALOG_FIXTURE_HTTP_REQUEST_FAILED', stage.stageId);
  }
  assert(isPlainObject(response), 'L2_CATALOG_FIXTURE_HTTP_RESPONSE_INVALID', stage.stageId);
  assert(Number.isInteger(response.status), 'L2_CATALOG_FIXTURE_HTTP_RESPONSE_INVALID', stage.stageId);
  const accepted = stage.expectedStatuses.includes(response.status);
  const publicFacts = stage.publicFacts ?? {};
  if (response.json !== undefined) {
    assert(response.json === null || isPlainObject(response.json) || Array.isArray(response.json), 'L2_CATALOG_FIXTURE_HTTP_RESPONSE_INVALID', stage.stageId);
  }
  const publicCall = {
    stageGroup: stage.group,
    stageId: stage.stageId,
    operationId: stage.operationId,
    owner: stage.owner,
    method: stage.method,
    routeTemplate: stage.routeTemplate,
    status: response.status,
    outcome: accepted ? 'PASS' : 'FAIL',
    durationMs: Date.now() - startedAtEpochMillis,
    requestId: typeof response.headers?.['x-request-id'] === 'string' ? response.headers['x-request-id'] : null,
    databaseOperationBudget: stage.databaseOperationBudget,
    bodyDigest: stage.body === undefined ? null : createFactDigest(stage.body, context.hmacSecret),
    responseDigest: response.json === undefined ? null : createFactDigest(response.json, context.hmacSecret),
    publicFacts,
  };
  assertNoSensitiveLeak(publicCall);
  if (!accepted) fail('L2_CATALOG_FIXTURE_HTTP_STATUS_UNEXPECTED', `${stage.stageId}:${response.status}`);
  return Object.freeze(publicCall);
}

function statusObject(status, code = null, reason = null) {
  assert(TERMINAL_STATUSES.includes(status), 'L2_CATALOG_FIXTURE_STATUS_INVALID');
  const result = {status};
  if (code) result.code = code;
  if (reason) result.reason = reason;
  assertNoSensitiveLeak(result);
  return Object.freeze(result);
}

function datasetExpectedFacts(dataset) {
  return Object.freeze({
    preState: dataset.expected.preState,
    actionInput: dataset.expected.actionInput,
    expectedReadback: dataset.expected.expectedReadback,
    unchangedReadback: dataset.expected.unchangedReadback,
  });
}

function fixturePublicResult({fixtureRef, dataset, entry, setupCalls = [], readbackCalls = [], cleanupCalls = [], hmacSecret, business, cleanup}) {
  const expectedFacts = datasetExpectedFacts(dataset);
  const publicFacts = {
    fixtureRef,
    purpose: dataset.purpose,
    scenarioIds: dataset.scenarioIds,
    ownerScopesCount: dataset.ownerScopes?.length ?? 0,
    objectsCount: dataset.objects?.length ?? 0,
    edgesCount: dataset.edges?.length ?? 0,
    expectedFacts,
    runnerPublicFacts: entry.publicFacts,
    setupFactDigests: Object.fromEntries(setupCalls.map((call) => [call.stageId, call.responseDigest])),
    readbackFactDigests: Object.fromEntries(readbackCalls.map((call) => [call.stageId, call.responseDigest])),
    cleanupFactDigests: Object.fromEntries(cleanupCalls.map((call) => [call.stageId, call.responseDigest])),
  };
  assertNoSensitiveLeak(publicFacts);
  return Object.freeze({
    fixtureRef,
    business,
    cleanup,
    preState: expectedFacts.preState,
    actionInput: expectedFacts.actionInput,
    expectedReadback: expectedFacts.expectedReadback,
    unchangedReadback: expectedFacts.unchangedReadback,
    factDigest: createFactDigest(publicFacts, hmacSecret),
    setupCalls,
    readbackCalls,
    cleanupCalls,
  });
}

async function runStageGroup(stages, context) {
  const calls = [];
  for (const stage of stages) calls.push(await executeStage(stage, context));
  return Object.freeze(calls);
}

function normalizeBuildOptions({plan, httpClient, hmacSecret, registry, environment} = {}) {
  assert(isPlainObject(httpClient) && typeof httpClient.request === 'function', 'L2_CATALOG_FIXTURE_HTTP_CLIENT_REQUIRED');
  assert(typeof hmacSecret === 'string' && hmacSecret.length >= 16, 'L2_CATALOG_FIXTURE_HMAC_SECRET_REQUIRED');
  const contract = validateBrowserL2CatalogFixturePlan(plan, {registry, environment});
  return Object.freeze({...contract, httpClient, hmacSecret});
}

export async function buildBrowserL2CatalogFixture(options = {}) {
  let context;
  try {
    context = normalizeBuildOptions(options);
  } catch (error) {
    return failureResult(error, 'setup');
  }
  const fixtures = {};
  const calls = [];
  let firstFailure = null;
  try {
    for (const entry of context.fixtures) {
      const setupCalls = await runStageGroup(entry.setup, context);
      const readbackCalls = await runStageGroup(entry.readback, context);
      calls.push(...setupCalls, ...readbackCalls);
      fixtures[entry.fixtureRef] = fixturePublicResult({
        fixtureRef: entry.fixtureRef,
        dataset: context.datasets[entry.fixtureRef],
        entry,
        setupCalls,
        readbackCalls,
        hmacSecret: context.hmacSecret,
        business: statusObject('PASS'),
        cleanup: statusObject('NOT_RUN'),
      });
    }
  } catch (error) {
    firstFailure = normalizeFailure(error);
  }
  return finalizeResult({context, fixtures, calls, business: firstFailure ? statusObject('FAIL', firstFailure.code, firstFailure.detail) : statusObject('PASS'), cleanup: statusObject('NOT_RUN'), firstFailure});
}

export async function readbackBrowserL2CatalogFixture(options = {}) {
  let context;
  try {
    context = normalizeBuildOptions(options);
  } catch (error) {
    return failureResult(error, 'readback');
  }
  const fixtures = {};
  const calls = [];
  let firstFailure = null;
  try {
    for (const entry of context.fixtures) {
      const readbackCalls = await runStageGroup(entry.readback, context);
      calls.push(...readbackCalls);
      fixtures[entry.fixtureRef] = fixturePublicResult({
        fixtureRef: entry.fixtureRef,
        dataset: context.datasets[entry.fixtureRef],
        entry,
        readbackCalls,
        hmacSecret: context.hmacSecret,
        business: statusObject('PASS'),
        cleanup: statusObject('NOT_RUN'),
      });
    }
  } catch (error) {
    firstFailure = normalizeFailure(error);
  }
  return finalizeResult({context, fixtures, calls, business: firstFailure ? statusObject('FAIL', firstFailure.code, firstFailure.detail) : statusObject('PASS'), cleanup: statusObject('NOT_RUN'), firstFailure});
}

export async function cleanupBrowserL2CatalogFixture(options = {}) {
  let context;
  try {
    context = normalizeBuildOptions(options);
  } catch (error) {
    return failureResult(error, 'cleanup');
  }
  const fixtures = {};
  const calls = [];
  let firstFailure = null;
  for (const entry of [...context.fixtures].reverse()) {
    try {
      const cleanupCalls = await runStageGroup(entry.cleanup, context);
      calls.push(...cleanupCalls);
      fixtures[entry.fixtureRef] = fixturePublicResult({
        fixtureRef: entry.fixtureRef,
        dataset: context.datasets[entry.fixtureRef],
        entry,
        cleanupCalls,
        hmacSecret: context.hmacSecret,
        business: statusObject('NOT_RUN'),
        cleanup: statusObject('PASS'),
      });
    } catch (error) {
      firstFailure = normalizeFailure(error);
      fixtures[entry.fixtureRef] = fixturePublicResult({
        fixtureRef: entry.fixtureRef,
        dataset: context.datasets[entry.fixtureRef],
        entry,
        hmacSecret: context.hmacSecret,
        business: statusObject('NOT_RUN'),
        cleanup: statusObject('FAIL', firstFailure.code, firstFailure.detail),
      });
      break;
    }
  }
  return finalizeResult({context, fixtures, calls, business: statusObject('NOT_RUN'), cleanup: firstFailure ? statusObject('FAIL', firstFailure.code, firstFailure.detail) : statusObject('PASS'), firstFailure});
}

function normalizeFailure(error) {
  if (error instanceof BrowserL2CatalogFixtureFailure) return error;
  return new BrowserL2CatalogFixtureFailure('L2_CATALOG_FIXTURE_FAILED');
}

function failureResult(error, phase) {
  const failure = normalizeFailure(error);
  return Object.freeze({
    schemaVersion: 1,
    kind: BROWSER_L2_CATALOG_RESULT_KIND,
    fixtureClass: 'TEST',
    setupChannel: 'OWNER_HTTP_COMMANDS',
    phase,
    business: phase === 'cleanup' ? statusObject('NOT_RUN') : statusObject('FAIL', failure.code, failure.detail),
    cleanup: phase === 'cleanup' ? statusObject('FAIL', failure.code, failure.detail) : statusObject('NOT_RUN'),
    firstFailure: {code: failure.code, detail: failure.detail || null},
    fixtures: {},
    calls: [],
  });
}

function finalizeResult({context, fixtures, calls, business, cleanup, firstFailure}) {
  const result = {
    schemaVersion: 1,
    kind: BROWSER_L2_CATALOG_RESULT_KIND,
    fixtureClass: 'TEST',
    setupChannel: 'OWNER_HTTP_COMMANDS',
    runId: context.binding.runId,
    binding: context.binding,
    business,
    cleanup,
    firstFailure: firstFailure ? {code: firstFailure.code, detail: firstFailure.detail || null} : null,
    fixtureRefs: CATALOG_LIBRARY_FIXTURE_REFS,
    fixtures,
    calls,
  };
  assertNoSensitiveLeak(result);
  return Object.freeze(result);
}

function makeSelfTestPlan(overrides = {}) {
  const stage = (fixtureRef, group) => ({
    stageId: `${fixtureRef}:${group}:workbench-context`,
    operationId: 'getOperationsCatalogWorkbenchContext',
    expectedStatuses: [200],
    publicFacts: {fixtureRef, group},
  });
  return {
    schemaVersion: 1,
    kind: BROWSER_L2_CATALOG_FIXTURE_KIND,
    runId: 'browser-l2-catalog-self-test',
    databaseNamespace: 'catering_v2s_l2_self_test',
    assetPrefix: 's3://l2-assets/browser-l2/browser-l2-catalog-self-test/',
    fixtures: CATALOG_LIBRARY_FIXTURE_REFS.map((fixtureRef) => ({
      fixtureRef,
      setup: [stage(fixtureRef, 'setup')],
      readback: [stage(fixtureRef, 'readback')],
      cleanup: [stage(fixtureRef, 'cleanup')],
      publicFacts: {fixtureRef, source: 'self-test'},
    })),
    ...overrides,
  };
}

async function selfTest() {
  const registry = loadGeneratedCatalogOperationRegistry();
  const hmacSecret = 'browser-l2-catalog-self-test-secret';
  const contextOperation = resolveGeneratedOperationById(registry, 'getOperationsCatalogWorkbenchContext');
  const contextPath = normalizeEdgePath(materializeGeneratedOperationPath(contextOperation, {pathParameters: {}, queryParameters: {}}));
  const httpClient = {
    async request(request) {
      assert(request.path === contextPath, 'L2_CATALOG_FIXTURE_SELF_TEST_REQUEST_PATH_INVALID');
      return {status: 200, json: {ok: true, operationId: request.operationId, stageId: request.stageId}, headers: {'x-request-id': `self-${request.stageId.length}`}};
    },
  };
  const pass = await buildBrowserL2CatalogFixture({plan: makeSelfTestPlan(), httpClient, hmacSecret, registry, environment: {}});
  assert(pass.business.status === 'PASS' && Object.keys(pass.fixtures).length === CATALOG_LIBRARY_FIXTURE_REFS.length, 'L2_CATALOG_FIXTURE_SELF_TEST_PASS_FAILED');

  const missingPlan = await buildBrowserL2CatalogFixture({httpClient, hmacSecret, registry, environment: {}});
  assert(missingPlan.business.code === 'L2_CATALOG_FIXTURE_OWNER_PLAN_REQUIRED', 'L2_CATALOG_FIXTURE_SELF_TEST_MISSING_PLAN_FAILED');

  const seedInput = await buildBrowserL2CatalogFixture({plan: makeSelfTestPlan(), httpClient, hmacSecret, registry, environment: {DEV_MANIFEST: '/tmp/dev.json'}});
  assert(seedInput.business.code === 'L2_CATALOG_FIXTURE_FORBIDDEN_RUNTIME_INPUT', 'L2_CATALOG_FIXTURE_SELF_TEST_SEED_INPUT_FAILED');

  const namespaceMismatch = await buildBrowserL2CatalogFixture({
    plan: makeSelfTestPlan({binding: {runId: 'browser-l2-catalog-self-test', databaseNamespace: 'catering_v2s_l2_other'}}),
    httpClient,
    hmacSecret,
    registry,
    environment: {},
  });
  assert(namespaceMismatch.business.code === 'L2_CATALOG_FIXTURE_NAMESPACE_BINDING_MISMATCH', 'L2_CATALOG_FIXTURE_SELF_TEST_NAMESPACE_FAILED');

  const secretPlan = makeSelfTestPlan();
  secretPlan.fixtures[0].setup[0].body = {password: 'never-log-this-secret'};
  const secretLeak = await buildBrowserL2CatalogFixture({plan: secretPlan, httpClient, hmacSecret, registry, environment: {}});
  assert(secretLeak.business.code === 'L2_CATALOG_FIXTURE_SECRET_LEAK', 'L2_CATALOG_FIXTURE_SELF_TEST_SECRET_FAILED');

  const badOperation = makeSelfTestPlan();
  badOperation.fixtures[0].setup[0].operationId = 'missingOperationsCatalogOwnerFixtureCommand';
  const missingOperation = await buildBrowserL2CatalogFixture({plan: badOperation, httpClient, hmacSecret, registry, environment: {}});
  assert(missingOperation.business.code === 'L2_CATALOG_FIXTURE_OPERATION_UNRESOLVED', 'L2_CATALOG_FIXTURE_SELF_TEST_OPERATION_FAILED');

  process.stdout.write(`BROWSER_L2_CATALOG_FIXTURE_SELF_TEST=PASS; FIXTURES=${CATALOG_LIBRARY_FIXTURE_REFS.length}; SETUP=OWNER_HTTP_COMMANDS; SEED_RUNTIME_INPUT=false\n`);
}

async function main() {
  const command = process.argv[2] ?? '--help';
  if (command === '--self-test') return selfTest();
  if (command === '--help') {
    process.stdout.write('Usage: node scripts/test/browser-l2-catalog-fixture.mjs --self-test\n');
    return;
  }
  fail('L2_CATALOG_FIXTURE_COMMAND_UNSUPPORTED', command);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    const failure = normalizeFailure(error);
    process.stderr.write(`BROWSER_L2_CATALOG_FIXTURE=FAIL; CODE=${failure.code}; REASON=${failure.detail || 'n/a'}\n`);
    process.exitCode = 1;
  });
}
