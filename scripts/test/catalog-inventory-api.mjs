#!/usr/bin/env node
/**
 * HTTP/API acceptance runner for the catalog + light-inventory package.
 *
 * This runner intentionally lives beside the managed L2 runner. It consumes
 * the generated operation registry and canonical scenario catalog, but owns
 * its own API fixture graph through owner HTTP commands. It never reads the
 * DEV seed or the L2 fixture/report; reset/cleanup remains owned by the
 * managed runner.
 */
import {createHash, randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadGeneratedOperationRegistry, materializeGeneratedOperationPath, normalizeEdgePath, resolveGeneratedOperationById} from './seed-report.mjs';
import {catalogImageBindEvidenceInputs} from './catalog-image-bind-evidence-inputs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR || '');
const registryGeneralPath = path.join(root, 'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json');
const registryCatalogPath = path.join(root, 'apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json');
const scenarioPath = path.join(root, 'contracts/policy/catalog-inventory-api-scenarios.json');
const shapePath = path.join(root, 'contracts/catalog/catalog-inventory-read-models.json');
const fixturePath = path.join(root, 'contracts/policy/catalog-inventory-fixture-catalog.json');
const copyPolicyPath = path.join(root, 'contracts/policy/catalog-inventory-copy-policy.json');
const backendPerformanceFixturePath = path.join(root, 'contracts/policy/backend-performance-final-fixture-catalog.json');
const backendAcceptanceCatalogMode = process.env.V2S_BACKEND_ACCEPTANCE_CATALOG_MODE === 'true';
const backendAcceptanceRunId = process.env.V2S_BACKEND_ACCEPTANCE_RUN_ID || null;
const backendAcceptanceSecret = process.env.V2S_BACKEND_ACCEPTANCE_SECRET || null;
const CATALOG_CHILD_SIGNAL_NAMES = Object.freeze(['SIGTERM', 'SIGINT', 'SIGHUP']);

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const backendPerformanceFixtures = new Map(readJson(backendPerformanceFixturePath).rows.filter((row) => row.area === 'U07_ROUTE').map((row) => [row.operationId, row]));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const compact = (value, max = 240) => String(value ?? 'UNKNOWN').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').slice(0, max);
const fail = (code) => { const error = new Error(code); error.code = code; throw error; };
const required = (value, name) => { if (value === null || value === undefined || value === '') fail(name); return value; };
const versionValue = (value, fallback) => Number(value ?? fallback);
const catalogObjectVersion = (data, code, field, fallback = 1) => versionValue(data?.objectVersions?.find((entry) => entry.objectType === 'CATALOG_ITEM' && entry.code === code)?.[field], fallback);
const itemResult = (json) => json?.result ?? json?.data?.result ?? json?.data ?? json;
const envelopeData = (json) => json?.data ?? json;
const responseErrorCode = (json) => json?.errorCode ?? json?.code ?? json?.problemCode ?? json?.error?.code ?? null;
export const catalogRuntimeFailureCode = (error) => {
  const candidate = error?.code;
  if (typeof candidate === 'string' && /^[A-Z][A-Z0-9_]*$/.test(candidate)) return candidate;
  const responseCode = String(error?.message ?? '').match(/_HTTP_\d{3}_([A-Z][A-Z0-9_]*)$/)?.[1];
  return responseCode ?? 'CATALOG_INVENTORY_UNCLASSIFIED_FAILURE';
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requiredUuid = (value, label) => { if (typeof value !== 'string' || !uuidPattern.test(value)) fail(`API_OWNER_REF_MISSING:${label}`); return value; };
const normalizeBackendPerformanceRoute = normalizeEdgePath;
function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  return value;
}

function registry() {
  const general = loadGeneratedOperationRegistry(registryGeneralPath);
  const catalog = readJson(registryCatalogPath).operations.map((entry) => ({...entry, path: normalizeEdgePath(entry.path)}));
  const merged = [...general, ...catalog];
  const seen = new Set();
  for (const operation of merged) { if (seen.has(operation.operationId)) fail(`API_OPERATION_DUPLICATE:${operation.operationId}`); seen.add(operation.operationId); }
  return merged;
}

function validateBackendPerformanceCanonicalOperationIds(all, catalogOperationIds) {
  const expectedOperationIds = new Set(all
    .filter((operation) => catalogOperationIds.has(operation.operationId)
      && backendPerformanceFixtures.get(operation.operationId)?.area === 'U07_ROUTE')
    .map((operation) => operation.operationId));
  if (expectedOperationIds.size !== 42) fail('BP_U07_CANONICAL_OPERATION_DENOMINATOR');
  return expectedOperationIds;
}

function loadManagedRun() {
  const manifestPath = process.env.CATALOG_INVENTORY_MANIFEST_PATH || path.join(runtime, 'run-manifest.json');
  if (!runtime || !fs.existsSync(manifestPath)) fail('MANAGED_RUN_MANIFEST_REQUIRED');
  const manifest = readJson(manifestPath);
  const performanceCanonicalMode = process.env.CATALOG_INVENTORY_PERFORMANCE_CANONICAL === 'true';
  const validDevManifest = manifest.kind === 'r5-dev-run-manifest' && manifest.freshDatabase === true;
  const validPerformanceManifest = performanceCanonicalMode
    && manifest.kind === 'backend-performance-testcontainers-catalog-runtime'
    && manifest.freshDatabase === true
    && manifest.executionPlane === 'REMOTE_JVM_AND_DOCKER';
  const validBackendAcceptanceManifest = backendAcceptanceCatalogMode
    && manifest.kind === 'backend-acceptance-catalog-runtime'
    && manifest.freshDatabase === true
    && manifest.executionPlane === 'REMOTE_JVM_AND_DOCKER'
    && typeof backendAcceptanceRunId === 'string'
    && typeof backendAcceptanceSecret === 'string';
  if (!validDevManifest && !validPerformanceManifest && !validBackendAcceptanceManifest) fail('MANAGED_RUN_MANIFEST_INVALID');
  const credentialsFile = required(manifest.credentialsFile, 'MANAGED_CREDENTIALS_FILE');
  const credentials = Object.fromEntries(fs.readFileSync(credentialsFile, 'utf8').trim().split('\n').filter(Boolean).map((line) => line.split('=', 2)));
  return {manifest, credentials, performanceCanonicalMode, backendAcceptanceMode: validBackendAcceptanceManifest};
}

function backendPerformanceRequestMetadata(operationId, operation, environment = process.env) {
  const runId = required(environment.V2S_BACKEND_PERFORMANCE_FINAL_RUN_ID, 'BACKEND_PERFORMANCE_FINAL_RUN_ID');
  const secret = required(environment.V2S_BACKEND_PERFORMANCE_FINAL_SECRET, 'BACKEND_PERFORMANCE_FINAL_SECRET');
  const fixture = backendPerformanceFixtures.get(operationId);
  if (!fixture || fixture.area !== 'U07_ROUTE' || fixture.operationId !== operationId) fail(`BP_FINAL_FIXTURE_CATALOG_OPERATION_MISSING:${operationId}`);
  if (fixture.method !== operation.method || normalizeBackendPerformanceRoute(fixture.routeTemplate) !== normalizeBackendPerformanceRoute(operation.path)) fail(`BP_FINAL_FIXTURE_CATALOG_ROUTE_DRIFT:${operationId}`);
  return {
    'X-Backend-Performance-Run-Id': runId,
    'X-Backend-Performance-Secret': secret,
    'X-Backend-Performance-Operation-Id': operationId,
    'X-Backend-Performance-Route-Template': fixture.routeTemplate,
    'X-Backend-Performance-Fixture-Id': fixture.fixtureId,
    'X-Backend-Performance-Area': fixture.area,
  };
}

function scalarSessionNode(session, type, requested) {
  if (!requested) fail(`DATA_NODE_REF_REQUIRED:${type}`);
  const selected = type === 'STORE' ? session?.scopeContext?.store
    : type === 'HEAD_COMPANY' ? session?.scopeContext?.headCompany
      : type === 'PROJECT' ? session?.scopeContext?.project
        : type === 'REGION' ? session?.scopeContext?.region : null;
  if (selected?.dataNodeRef && (!requested || String(selected.dataNodeRef) === String(requested))) return {ref: String(selected.dataNodeRef), contextVersion: session.contextVersion};
  const candidates = (session?.dataNodeCandidates ?? []).filter((entry) => entry.dataNodeType === type);
  const candidate = candidates.find((entry) => String(entry.dataNodeRef) === String(requested));
  if (!candidate) fail(`DATA_NODE_NOT_VISIBLE:${type}`);
  return {candidate, contextVersion: session.contextVersion};
}

function assertThat(condition, code) { if (!condition) fail(code); }
export function validateScenarioCatalog(scenarios) {
  assertThat(scenarios && typeof scenarios === 'object' && Array.isArray(scenarios.scenarios), 'API_SCENARIO_CATALOG_INVALID');
  assertThat(Number.isSafeInteger(scenarios.scenarioCount) && scenarios.scenarioCount === scenarios.scenarios.length, 'API_SCENARIO_COUNT_DENOMINATOR_INVALID');
  const cases = [];
  const caseIds = new Set();
  for (const scenario of scenarios.scenarios) {
    assertThat(Number.isSafeInteger(scenario.caseCount) && scenario.caseCount >= 0 && Array.isArray(scenario.cases) && scenario.caseCount === scenario.cases.length, `API_SCENARIO_CASE_DENOMINATOR_INVALID:${scenario.scenarioId ?? 'UNKNOWN'}`);
    for (const entry of scenario.cases) {
      assertThat(typeof entry?.caseId === 'string' && entry.caseId !== '' && !caseIds.has(entry.caseId), `API_SCENARIO_CASE_SET_INVALID:${entry?.caseId ?? 'UNKNOWN'}`);
      caseIds.add(entry.caseId);
      cases.push(entry);
    }
  }
  assertThat(Number.isSafeInteger(scenarios.caseCount) && scenarios.caseCount === cases.length, 'API_CASE_DENOMINATOR_INVALID');
  return {scenarioCount: scenarios.scenarioCount, caseCount: scenarios.caseCount, cases};
}
export const caseLoopSkipReason = ({performanceCanonicalMode, sharedFixtureBarrier}) => {
  if (sharedFixtureBarrier?.status !== 'PASS') return 'SHARED_FIXTURE_BARRIER_FAILED';
  if (performanceCanonicalMode) return 'PERFORMANCE_CANONICAL_MODE';
  return null;
};
export const canonicalFailureResult = (operationIds, reason) => ({status: 'FAIL', operationIds: [...operationIds], reason});
function preserveFixtureWholeSaveImages(detail, draft) {
  const item = detail?.item || detail || {};
  return {...draft, images: Array.isArray(item.images) ? [...item.images] : []};
}
function assertFixtureWholeSaveImagesRetained(detail, draft) {
  const item = detail?.item || detail || {};
  const previous = Array.isArray(item.images) ? item.images : [];
  const submitted = Array.isArray(draft?.images) ? draft.images : [];
  assertThat(previous.every((assetRef) => submitted.includes(assetRef)), 'WHOLE_SAVE_IMAGE_REFERENCE_DROPPED');
}
function assertEnvelope(json, code = 'API_ENVELOPE_INVALID') {
  assertThat(typeof json === 'object' && json !== null, code);
  assertThat(typeof json.revision === 'string' && json.revision.length > 0, `${code}:REVISION`);
  assertThat(typeof json.requestId === 'string' && json.requestId.length > 0, `${code}:REQUEST_ID`);
}

function catalogChildSignalEvidencePath() {
  const runtimeDirectory = process.env.V2S_RUNTIME_DIR;
  return typeof runtimeDirectory === 'string' && runtimeDirectory.trim() !== ''
    ? path.join(path.resolve(runtimeDirectory), 'results/catalog-inventory-api/child-signal-events.jsonl')
    : null;
}

function probeProcessIdentity(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return {status: 'INVALID_PID', identity: null};
  if (process.platform !== 'linux') return {status: 'PLATFORM_UNSUPPORTED', identity: null, platform: process.platform};
  let raw;
  try { raw = fs.readFileSync(`/proc/${pid}/stat`, 'utf8'); }
  catch { return {status: 'PROC_STAT_UNAVAILABLE', identity: null}; }
  const closingParenthesis = raw.lastIndexOf(')');
  if (closingParenthesis < 0) return {status: 'PROC_STAT_FORMAT_INVALID', identity: null};
  const fields = raw.slice(closingParenthesis + 2).trim().split(/\s+/);
  if (fields.length < 20 || !/^\d+$/.test(fields[19])) return {status: 'PROC_STAT_FIELDS_INVALID', identity: null};
  let bootId;
  try { bootId = fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(); }
  catch { return {status: 'BOOT_ID_UNAVAILABLE', identity: null}; }
  if (!/^[0-9a-f-]{16,64}$/i.test(bootId)) return {status: 'BOOT_ID_INVALID', identity: null};
  const identity = {
    pid,
    state: fields[0],
    parentPid: Number(fields[1]),
    processGroupId: Number(fields[2]),
    sessionId: Number(fields[3]),
    terminalProcessGroupId: Number(fields[5]),
    startTimeTicks: fields[19],
    bootId,
  };
  if ([identity.parentPid, identity.processGroupId, identity.sessionId]
    .some((value) => !Number.isSafeInteger(value) || value < 0)
    || !Number.isSafeInteger(identity.terminalProcessGroupId) || identity.terminalProcessGroupId < -1) return {status: 'PROC_STAT_VALUES_INVALID', identity: null};
  return {status: 'PASS', identity};
}

function readProcessIdentity(pid) {
  return probeProcessIdentity(pid).identity;
}

function recordCatalogChildSignal(signal) {
  const target = catalogChildSignalEvidencePath();
  if (!target) return;
  const processIdentityProbe = probeProcessIdentity(process.pid);
  const parentIdentityProbe = probeProcessIdentity(process.ppid);
  fs.mkdirSync(path.dirname(target), {recursive: true, mode: 0o700});
  fs.appendFileSync(target, `${JSON.stringify({
    schemaVersion: 1,
    kind: 'backend-acceptance-catalog-child-signal',
    runId: backendAcceptanceRunId,
    signal,
    pid: process.pid,
    parentPid: process.ppid,
    processIdentity: processIdentityProbe.identity,
    processIdentityStatus: processIdentityProbe.status,
    parentIdentity: parentIdentityProbe.identity,
    parentIdentityStatus: parentIdentityProbe.status,
    at: new Date().toISOString(),
  })}\n`, {mode: 0o600});
}

for (const signal of CATALOG_CHILD_SIGNAL_NAMES) {
  const handler = () => {
    recordCatalogChildSignal(signal);
    process.removeListener(signal, handler);
    process.kill(process.pid, signal);
  };
  process.once(signal, handler);
}

async function execute() {
  if (process.argv.includes('--self-test')) {
    if (!process.env.V2S_RUNTIME_DIR) fail('V2S_RUNTIME_DIR_REQUIRED');
    if (!fs.existsSync(scenarioPath)) fail('API_SCENARIO_CATALOG_MISSING');
    const scenarios = readJson(scenarioPath);
    const scenarioCatalog = validateScenarioCatalog(scenarios);
    assertThat(scenarioCatalog.scenarioCount === 26 && scenarioCatalog.caseCount === 99, 'API_SCENARIO_DENOMINATOR_INVALID');
    const sourceOwnedScenario = scenarios.scenarios.find((entry) => entry.scenarioId === 'CI-API-007');
    assertThat(sourceOwnedScenario?.caseCount === 0 && sourceOwnedScenario.executionApplicability === 'NOT_APPLICABLE_WITH_REASON', 'API_SOURCE_OWNED_INGRESS_APPLICABILITY_INVALID');
    const sample = {scopeContext: {store: {dataNodeRef: 'store-ref'}}, dataNodeCandidates: [{dataNodeType: 'STORE', dataNodeRef: 'store-ref'}], contextVersion: 7};
    assertThat(scalarSessionNode(sample, 'STORE', 'store-ref').ref === 'store-ref', 'SESSION_WIRE_DATA_NODE_REF_REQUIRED');
    let codeRefRejected = false; try { requiredUuid('LATTE-001', 'PRODUCT_SKU'); } catch { codeRefRejected = true; }
    assertThat(codeRefRejected, 'API_CODE_TYPED_REF_MUST_REJECT');
    const prior = {item: {images: ['asset-ref']}};
    const retained = preserveFixtureWholeSaveImages(prior, {inventoryBom: []});
    assertFixtureWholeSaveImagesRetained(prior, retained);
    let droppedImageRejected = false; try { assertFixtureWholeSaveImagesRetained(prior, {inventoryBom: [], images: []}); } catch { droppedImageRejected = true; }
    assertThat(droppedImageRejected, 'WHOLE_SAVE_IMAGE_DROP_RED_MUTATION_REJECTED');
    const all = registry();
    const catalogOperationIds = new Set(readJson(registryCatalogPath).operations.map((operation) => operation.operationId));
    const canonicalOperationIds = validateBackendPerformanceCanonicalOperationIds(all, catalogOperationIds);
    assertThat(canonicalOperationIds.size === 42, 'BP_U07_CANONICAL_OPERATION_DENOMINATOR_SELF_TEST');
    let broadRegistryRejected = false;
    try { validateBackendPerformanceCanonicalOperationIds(all, new Set(all.map((operation) => operation.operationId))); } catch (error) { broadRegistryRejected = error.code === 'BP_U07_CANONICAL_OPERATION_DENOMINATOR'; }
    assertThat(broadRegistryRejected, 'BP_U07_CANONICAL_BROAD_REGISTRY_RED_MUTATION_REQUIRED');
    let incompleteCatalogRejected = false;
    const incompleteCatalog = new Set(catalogOperationIds);
    incompleteCatalog.delete(canonicalOperationIds.values().next().value);
    try { validateBackendPerformanceCanonicalOperationIds(all, incompleteCatalog); } catch (error) { incompleteCatalogRejected = error.code === 'BP_U07_CANONICAL_OPERATION_DENOMINATOR'; }
    assertThat(incompleteCatalogRejected, 'BP_U07_CANONICAL_MISSING_MEMBER_RED_MUTATION_REQUIRED');
    process.stdout.write(`CATALOG_INVENTORY_API_SELF_TEST=PASS\nAPI_CASE_DENOMINATOR=${scenarioCatalog.caseCount}\nHTTP_ONLY=true\n`);
    return;
  }

  const {manifest, credentials, performanceCanonicalMode, backendAcceptanceMode} = loadManagedRun();
  const imageBindEvidenceInputs = catalogImageBindEvidenceInputs(root);
  const all = registry();
  const scenarios = readJson(scenarioPath);
  const fixtures = readJson(fixturePath);
  const copyPolicy = readJson(copyPolicyPath);
  const base = (process.env.CATALOG_INVENTORY_EDGE_BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
  const workspaceKey = process.env.CATALOG_INVENTORY_GROUP_WORKSPACE_KEY || 'aurora';
  const password = required(process.env.CATALOG_INVENTORY_OPERATIONS_PASSWORD || credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD, 'OPERATIONS_PASSWORD');
  const passwords = {
    GROUP: process.env.CATALOG_INVENTORY_GROUP_PASSWORD || password,
    REGION: process.env.CATALOG_INVENTORY_REGION_PASSWORD || password,
    PROJECT: process.env.CATALOG_INVENTORY_PROJECT_PASSWORD || password,
    HEAD_COMPANY: process.env.CATALOG_INVENTORY_HEAD_COMPANY_PASSWORD || password,
    STORE: process.env.CATALOG_INVENTORY_STORE_PASSWORD || password,
  };
  const passwordFor = (scopeType) => required(passwords[scopeType] || password, `${scopeType}_PASSWORD`);
  const storeLogin = required(process.env.CATALOG_INVENTORY_OPERATIONS_LOGIN || process.env.CATALOG_INVENTORY_STORE_LOGIN, 'OPERATIONS_LOGIN');
  const groupLogin = required(process.env.CATALOG_INVENTORY_GROUP_LOGIN, 'GROUP_LOGIN');
  const headLogin = process.env.CATALOG_INVENTORY_HEAD_COMPANY_LOGIN || storeLogin;
  const projectLogin = required(process.env.CATALOG_INVENTORY_PROJECT_LOGIN, 'PROJECT_LOGIN');
  const brandRef = required(process.env.CATALOG_INVENTORY_BRAND_REF, 'BRAND_REF');
  const storeRef = required(process.env.CATALOG_INVENTORY_STORE_REF, 'STORE_REF');
  const headRef = required(process.env.CATALOG_INVENTORY_HEAD_COMPANY_REF, 'HEAD_COMPANY_REF');
  const projectRef = required(process.env.CATALOG_INVENTORY_PROJECT_REF, 'PROJECT_REF');
  const runId = `catalog-api-${randomUUID()}`;
  const executionStartedAt = new Date().toISOString();
  const outputDir = path.join(runtime, 'results', 'catalog-inventory-api');
  const reportPath = path.join(outputDir, 'catalog-inventory-api-runtime-report.json');
  const eventsPath = path.join(outputDir, 'events.jsonl');
  fs.mkdirSync(outputDir, {recursive: true, mode: 0o700});
  const calls = [];
  const events = [];
  const caseResults = [];
  const createdCodes = [];
  let firstFailure = null;

  const log = (phase, status, detail = {}) => {
    const event = {at: new Date().toISOString(), phase, status, ...detail};
    events.push(event);
    fs.appendFileSync(eventsPath, `${JSON.stringify(event)}\n`, {mode: 0o600});
  };

  const request = async (phase, operationId, pathParameters = {}, options = {}) => {
    const operation = resolveGeneratedOperationById(all, operationId);
    const pathname = materializeGeneratedOperationPath(operation, {pathParameters, queryParameters: options.queryParameters || {}});
    const correlationId = `catalog-api-${randomUUID()}`;
    const performanceMetadata = options.performanceCanonical && !backendAcceptanceMode ? backendPerformanceRequestMetadata(operationId, operation) : null;
    const backendAcceptanceMetadata = backendAcceptanceMode ? {
      'X-Backend-Acceptance-Run-Id': backendAcceptanceRunId,
      'X-Backend-Acceptance-Secret': backendAcceptanceSecret,
      'X-Backend-Acceptance-Operation-Id': operationId,
      'X-Backend-Acceptance-Route-Template': operation.path,
    } : null;
    const headers = {
      Accept: 'application/json',
      'X-Correlation-Id': correlationId,
      ...(backendAcceptanceMetadata || performanceMetadata || {'X-Seed-Operation-Id': operationId, 'X-Seed-Run-Id': manifest.runId}),
    };
    if (options.requestId) headers['X-Request-Id'] = options.requestId;
    if (options.testFailurePoint) headers['X-Catalog-Test-Failure-Point'] = options.testFailurePoint;
    if (options.cookie) headers.Cookie = options.cookie;
    if (options.brandRef) headers['X-Workspace-Brand-Ref'] = options.brandRef;
    Object.assign(headers, options.headers || {});
    let body;
    if (options.form) body = options.form;
    else if (options.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(options.body); }
    if (operation.method !== 'GET') headers['Idempotency-Key'] = options.idempotencyKey || `catalog-api-${sha256(`${runId}:${phase}`).slice(0, 48)}`;
    const began = Date.now();
    const timeoutMs = options.timeoutMs || 30_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(`${base}${pathname}`, {method: operation.method, headers, body, signal: controller.signal});
      log(`${phase}_RESPONSE_HEADERS`, 'RECEIVED', {operationId, status: response.status, correlationId});
    } catch (error) {
      clearTimeout(timeout);
      calls.push({phase, operationId, method: operation.method, routeTemplate: operation.path, status: 0, outcome: 'ERROR', durationMs: Date.now() - began, requestId: null, correlationId});
      log(phase, 'ERROR', {operationId, status: 0, correlationId});
      throw new Error(`${phase}_NETWORK_${compact(error.message)}`);
    }
    let text;
    try {
      text = await response.text();
    } catch (error) {
      clearTimeout(timeout);
      calls.push({phase, operationId, method: operation.method, routeTemplate: operation.path, status: response.status, outcome: 'ERROR', durationMs: Date.now() - began, requestId: null, correlationId});
      log(phase, 'ERROR', {operationId, status: response.status, correlationId, bodyRead: 'FAILED'});
      throw new Error(`${phase}_BODY_${compact(error.message)}`);
    }
    clearTimeout(timeout);
    log(`${phase}_RESPONSE_BODY`, 'RECEIVED', {operationId, status: response.status, bytes: text.length, correlationId});
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* the case assertion will report a shape failure */ }
    const requestId = response.headers.get('x-request-id');
    const responseCorrelationHeader = response.headers.get('x-correlation-id');
    const responseCorrelation = responseCorrelationHeader || correlationId;
    if (backendAcceptanceMode && (responseCorrelationHeader !== correlationId || !/^[A-Za-z0-9._:-]{8,256}$/.test(requestId || ''))) {
      throw new Error(`${phase}_BACKEND_ACCEPTANCE_RESPONSE_CORRELATION_INVALID`);
    }
    const accepted = (options.expected || [200]).includes(response.status);
    calls.push({phase, operationId, method: operation.method, routeTemplate: operation.path, status: response.status, outcome: accepted ? 'SUCCEEDED' : 'REJECTED', durationMs: Date.now() - began, requestId, correlationId: responseCorrelation, ...(options.performanceCanonical ? {performanceCanonical: true} : {})});
    log(phase, accepted ? 'PASS' : 'REJECTED', {operationId, status: response.status, requestId, correlationId: responseCorrelation, problemCode: accepted ? undefined : responseErrorCode(json)});
    if (!accepted && !options.allowRejected) throw new Error(`${phase}_HTTP_${response.status}_${responseErrorCode(json) || 'UNCLASSIFIED'}`);
    return {status: response.status, json, requestId, correlationId: responseCorrelation, cookie: response.headers.get('set-cookie')?.split(';', 1)[0] || null};
  };

  const expectedProblem = async (phase, operationId, pathParameters, options, problemCode, statuses = [400, 403, 404, 409, 422, 500]) => {
    const response = await request(phase, operationId, pathParameters, {...options, expected: statuses, allowRejected: true});
    assertThat(statuses.includes(response.status), `${phase}:STATUS`);
    assertThat(responseErrorCode(response.json) === problemCode, `${phase}:EXPECTED_${problemCode}_GOT_${responseErrorCode(response.json) || 'NONE'}`);
    return response;
  };

  const login = async (scopeType, loginName, requestedRef, options = {}) => {
    const logged = await request(`${scopeType}_LOGIN`, 'operationsWorkspacePasswordLogin', {groupWorkspaceKey: workspaceKey}, {body: {loginName, password: passwordFor(scopeType)}});
    const cookie = required(logged.cookie, `${scopeType}_COOKIE`);
    const entry = await request(`${scopeType}_SESSION`, 'getOperationsWorkspaceSessionEntry', {groupWorkspaceKey: workspaceKey}, {cookie});
    const node = scalarSessionNode(entry.json, scopeType, requestedRef);
    let session = entry.json;
    if (!node.ref) session = (await request(`${scopeType}_SELECT`, 'selectOperationsWorkspaceSessionDataNode', {groupWorkspaceKey: workspaceKey}, {cookie, body: {dataNodeRef: node.candidate.dataNodeRef, dataNodeType: scopeType, requiredContextVersion: node.contextVersion}})).json;
    const selected = scopeType === 'STORE' ? session?.scopeContext?.store
      : scopeType === 'HEAD_COMPANY' ? session?.scopeContext?.headCompany
        : scopeType === 'PROJECT' ? session?.scopeContext?.project
          : scopeType === 'REGION' ? session?.scopeContext?.region : null;
    const dataNodeRef = String(selected?.dataNodeRef || node.ref || node.candidate?.dataNodeRef);
    assertThat(dataNodeRef && dataNodeRef !== 'undefined', `${scopeType}_DATA_NODE_REF`);
    if (options.skipContext) return {scopeType, cookie, dataNodeRef, brandRef, session, context: null};
    const context = await request(`${scopeType}_CONTEXT`, 'getOperationsCatalogWorkbenchContext', {}, {cookie, brandRef, queryParameters: {dataNodeRef}});
    assertEnvelope(context.json);
    return {scopeType, cookie, dataNodeRef, brandRef, session, context: envelopeData(context.json)};
  };
  const loginGroup = async (loginName) => {
    const logged = await request('GROUP_LOGIN', 'operationsWorkspacePasswordLogin', {groupWorkspaceKey: workspaceKey}, {body: {loginName, password: passwordFor('GROUP')}});
    const cookie = required(logged.cookie, 'GROUP_COOKIE');
    const entry = await request('GROUP_SESSION', 'getOperationsWorkspaceSessionEntry', {groupWorkspaceKey: workspaceKey}, {cookie});
    return {scopeType: 'GROUP', cookie, dataNodeRef: null, brandRef, session: entry.json, context: null};
  };

  const store = await login('STORE', storeLogin, storeRef);
  const groupProbe = await loginGroup(groupLogin);
  const head = await login('HEAD_COMPANY', headLogin, headRef);
  const project = await login('PROJECT', projectLogin, projectRef, {skipContext: true});
  assertThat(store.brandRef === head.brandRef, 'BRAND_SCOPE_MISMATCH');
  const clientFor = (scope) => scope === 'HEAD_COMPANY' ? head : store;
  const selectedScopeNode = (session, scopeType) => scopeType === 'STORE' ? session?.scopeContext?.store
    : scopeType === 'HEAD_COMPANY' ? session?.scopeContext?.headCompany
      : scopeType === 'PROJECT' ? session?.scopeContext?.project
        : scopeType === 'REGION' ? session?.scopeContext?.region : null;
  const selectScope = async (client, scopeType, requestedRef, options = {}) => {
    const entry = await request(`${scopeType}_SCOPE_ENTRY`, 'getOperationsWorkspaceSessionEntry', {groupWorkspaceKey: workspaceKey}, {cookie: client.cookie});
    const node = scalarSessionNode(entry.json, scopeType, requestedRef);
    const candidate = node.candidate || selectedScopeNode(entry.json, scopeType);
    assertThat(candidate?.dataNodeRef, `${scopeType}_SCOPE_CANDIDATE`);
    const selectedResponse = await request(`${scopeType}_SCOPE_SELECT`, 'selectOperationsWorkspaceSessionDataNode', {groupWorkspaceKey: workspaceKey}, {
      cookie: client.cookie,
      body: {dataNodeRef: candidate.dataNodeRef, dataNodeType: scopeType, requiredContextVersion: node.contextVersion},
      // A scope switch is a command.  The same helper is used for the
      // headless-store probe and for restoration; key it by the requested
      // node so the two intentional writes cannot collide as an
      // IDEMPOTENCY_MISMATCH.  Callers may still provide an explicit key for
      // a deliberately replayed command.
      idempotencyKey: options.idempotencyKey || `catalog-api-scope-${runId}-${scopeType}-${candidate.dataNodeRef}`,
    });
    const session = selectedResponse.json;
    const selected = selectedScopeNode(session, scopeType);
    const dataNodeRef = String(selected?.dataNodeRef || candidate.dataNodeRef);
    let context = null;
    if (!options.skipContext) {
      const contextResponse = await request(`${scopeType}_SCOPE_CONTEXT`, 'getOperationsCatalogWorkbenchContext', {}, {
        cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef},
      });
      assertEnvelope(contextResponse.json);
      context = envelopeData(contextResponse.json);
    }
    client.scopeType = scopeType;
    client.dataNodeRef = dataNodeRef;
    client.session = session;
    client.context = context;
    return client;
  };
  const restoreStoreScope = async (client) => selectScope(client, 'STORE', storeRef);
  const getItems = async (client, phase, query = {}) => request(phase, 'getOperationsCatalogItems', {}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef, pageSize: 100, ...query}});
  const getDetail = async (client, phase, itemCode, query = {}) => request(phase, 'getOperationsCatalogItem', {itemCode}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef, ...query}});
  const getDetailAllowMissing = async (client, phase, itemCode) => request(phase, 'getOperationsCatalogItem', {itemCode}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef}, expected: [200, 404], allowRejected: true});
  const itemCodes = async (client, phase) => (envelopeData((await getItems(client, phase)).json)?.items || []).map((row) => row.code).filter(Boolean);
  const createItem = async (client, phase, code, shapeKey = 'STANDARD_SALE_COUNTED') => {
    createdCodes.push(`${client.scopeType}:${code}`);
    return request(phase, 'createOperationsCatalogItem', {}, {cookie: client.cookie, brandRef: client.brandRef, expected: [200], idempotencyKey: `catalog-api-create-${runId}-${client.scopeType}-${code}`, body: {dataNodeRef: client.dataNodeRef, name: code, code, shapeKey, attributes: {fixtureRef: 'P4_API_RUNTIME'}}});
  };
  const createItemsInBatches = async (client, phase, codes, batchSize = 8) => {
    for (let index = 0; index < codes.length; index += batchSize) {
      const batch = codes.slice(index, index + batchSize);
      await Promise.all(batch.map((code) => createItem(client, `${phase}_${index + 1}`, code)));
    }
  };
  const saveItem = async (client, phase, code, version, draft, inventoryConfiguration = {nodes: []}, expectedInventoryVersions = [], assetBindGrants = {}) => request(phase, 'saveOperationsCatalogItem', {itemCode: code}, {cookie: client.cookie, brandRef: client.brandRef, headers: Object.keys(assetBindGrants).length ? {'X-Catalog-Asset-Bind-Grants': JSON.stringify(assetBindGrants)} : {}, body: {dataNodeRef: client.dataNodeRef, itemCode: code, sections: {catalogDraft: draft, inventoryConfiguration, expectedCatalogVersion: version, expectedInventoryVersions}}});
  const refsByScope = new Map();
  const refsFor = (client) => {
    const key = `${client.scopeType}:${client.dataNodeRef}`;
    if (!refsByScope.has(key)) refsByScope.set(key, {dictionary: new Map(), item: new Map(), sku: new Map(), value: new Map(), local: new Map()});
    return refsByScope.get(key);
  };
  const dictionaryKey = (kind, code) => `${kind}:${code}`;
  const localRef = (refs, key) => { if (!refs.local.has(key)) refs.local.set(key, randomUUID()); return refs.local.get(key); };
  const dictionaryRef = (refs, kind, code) => requiredUuid(refs.dictionary.get(dictionaryKey(kind, code)), `${kind}:${code}`);
  const itemRef = (refs, code) => requiredUuid(refs.item.get(code), `CATALOG_ITEM:${code}`);
  const skuRef = (refs, code) => requiredUuid(refs.sku.get(code), `PRODUCT_SKU:${code}`);
  const valueRef = (refs, code) => requiredUuid(refs.value.get(code), `SKU_ATTRIBUTE_VALUE:${code}`);
  const recordItemRefs = async (client, phase, code) => {
    const detail = envelopeData((await getDetail(client, `${phase}_READBACK`, code)).json);
    const item = detail.item || detail;
    const refs = refsFor(client);
    refs.item.set(code, requiredUuid(item.itemRef, `CATALOG_ITEM:${code}:readback`));
    for (const sku of item.skus || []) refs.sku.set(sku.skuCode, requiredUuid(sku.productSkuRef, `PRODUCT_SKU:${sku.skuCode}:readback`));
    for (const dimension of item.skuVariantDimensions || []) for (const value of dimension.values || []) refs.value.set(value.valueCode, requiredUuid(value.valueRef, `SKU_ATTRIBUTE_VALUE:${value.valueCode}:readback`));
    for (const group of item.orderOptions || []) for (const value of group.values || []) if (value.code) refs.value.set(value.code, requiredUuid(value.attributeValueRef, `SKU_ATTRIBUTE_VALUE:${value.code}:readback`));
    return item;
  };
  const materializeDictionaryRefs = async (client) => {
    const refs = refsFor(client);
    const entries = [
      ['SKU_ATTRIBUTE', ['SIZE']],
      ['SKU_ATTRIBUTE_VALUE', ['S', 'M', 'L', 'DRESSING-DEFAULT', 'SIZE-DEFAULT', 'TOPPING-DEFAULT', 'SMALL', 'LARGE']],
    ];
    for (const [kind, codes] of entries) {
      for (const code of codes) await request(`API_${client.scopeType}_${kind}_${code}`, 'createOperationsCatalogDictionaryEntry', {dictionaryKind: kind}, {cookie: client.cookie, brandRef: client.brandRef, body: {dataNodeRef: client.dataNodeRef, dictionaryKind: kind, code, name: code}});
      const readback = envelopeData((await request(`API_${client.scopeType}_${kind}_READBACK`, 'getOperationsCatalogDictionary', {dictionaryKind: kind}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef}})).json);
      for (const entry of readback.entries || []) refs.dictionary.set(dictionaryKey(kind, entry.code), requiredUuid(entry.entryRef, `${kind}:${entry.code}:readback`));
      for (const code of codes) dictionaryRef(refs, kind, code);
    }
  };
  const compositeGroups = (client, components, groupCode, {allowMissing = false} = {}) => { const refs = refsFor(client); return {compositeGroups: [{groupCode: `API-GROUP-${groupCode}`, groupName: 'API fixture group', selectionRule: 'SINGLE', components: components.map((code) => ({itemCode: code, itemRef: refs.item.has(code) ? itemRef(refs, code) : (allowMissing ? randomUUID() : itemRef(refs, code)), skuCode: null, productSkuRef: null, quantity: '1', unit: 'EACH', default: true, extraPrice: null, status: 'ENABLED'}))}]}; };
  const apiCode = (code) => `API-${code}`;
  const apiFixtureDraft = (client, fixtureId, item) => {
    const refs = refsFor(client);
    const code = apiCode(item.code);
    const skus = item.code === 'LATTE-001' ? ['S', 'M', 'L'].map((size, index) => ({productSkuRef: localRef(refs, `SKU:${code}-SKU-${size}`), skuCode: `${code}-SKU-${size}`, skuName: `${size}杯`, attributeValueRefs: [{attributeRef: dictionaryRef(refs, 'SKU_ATTRIBUTE', 'SIZE'), attributeCode: 'SIZE', attributeName: '杯型', attributeValueRef: dictionaryRef(refs, 'SKU_ATTRIBUTE_VALUE', size), valueCode: size, valueLabel: size, displayOrder: index, status: index === 2 ? 'ARCHIVED' : (index === 1 ? 'DISABLED' : 'ENABLED')}], skuBarcode: `${code}-SKU-${size}-BARCODE`, standardSalePrice: 100 + index * 20, isDefault: index === 0, status: index === 2 ? 'ARCHIVED' : (index === 1 ? 'DISABLED' : 'ENABLED'), version: 1, mediaRefs: []})) : [];
    const draft = {name: item.name || code, shapeKey: item.shapeKey, attributes: {fixtureRef: fixtureId, apiFixture: true}, images: [], productionTagRefs: [], categoryRefs: [], ordering: {priceGranularity: item.shapeKey === 'SKU_VARIANT_SALE_COUNTED' ? 'SKU' : 'ITEM', standardSalePrice: item.shapeKey === 'MATERIAL' ? null : 100, listedSalePrice: item.shapeKey === 'MATERIAL' ? null : 100, missingPriceCount: item.shapeKey === 'MATERIAL' ? 1 : 0}, skus, skuVariantDimensions: skus.length ? [{attributeRef: dictionaryRef(refs, 'SKU_ATTRIBUTE', 'SIZE'), attributeCode: 'SIZE', attributeName: '杯型', values: ['S', 'M', 'L'].map((value, displayOrder) => ({valueRef: dictionaryRef(refs, 'SKU_ATTRIBUTE_VALUE', value), valueCode: value, valueLabel: value, displayOrder, status: displayOrder === 2 ? 'ARCHIVED' : (displayOrder === 1 ? 'DISABLED' : 'ENABLED')}))}] : [], orderOptions: item.code === 'CAESAR-001' ? ['DRESSING', 'SIZE', 'TOPPING'].map((groupCode) => ({groupCode: `API-${groupCode}`, groupName: groupCode, selectionMode: 'SINGLE', required: true, values: [{code: `${groupCode}-DEFAULT`, name: `${groupCode}-DEFAULT`, attributeValueRef: dictionaryRef(refs, 'SKU_ATTRIBUTE_VALUE', `${groupCode}-DEFAULT`), default: true, extraPrice: null, productionEffects: []}]})) : [], compositeGroups: item.code === 'DINNER-SET-001' ? [{groupCode: 'API-DINNER-COMPONENTS', groupName: '套餐组件', selectionRule: 'REQUIRED', components: [{itemCode: apiCode('LATTE-001'), itemRef: itemRef(refs, apiCode('LATTE-001')), skuCode: `${apiCode('LATTE-001')}-SKU-M`, productSkuRef: skuRef(refs, `${apiCode('LATTE-001')}-SKU-M`), quantity: '1', unit: 'EACH', default: true, extraPrice: null, status: 'ENABLED'}]}] : [], productionProfiles: {item: item.materialRole ? {materialRole: item.materialRole} : {}, sku: {}, optionValue: {}}};
    if (item.materialRole) draft.materialRole = item.materialRole;
    return draft;
  };
  const apiMaterialConfig = (client, itemCode) => {
    const gram = ['BEAN-001', 'LETTUCE-001', 'BACON-001', 'CHICKEN-001', 'DRESSING-001'].includes(itemCode);
    return {nodes: [{nodeType: 'ITEM', itemCode: apiCode(itemCode), itemRef: itemRef(refsFor(client), apiCode(itemCode)), productSkuRef: null, mode: 'INDEPENDENT_STOCK', consumptionUnit: gram ? 'GRAM' : 'EACH', configuration: {allowNegative: false, lowStockThreshold: '1', countingUnit: gram ? 'KILOGRAM' : 'BOX', conversionFactor: gram ? '1000' : '1'}}]};
  };
  const ensureApiBaseline = async () => {
    // These are static contract fixture definitions, not rows loaded by the
    // DEV seed profile.  The API stage creates its own run-scoped objects.
    const fixtureDatasets = fixtures.seedDatasets || [];
    const entries = fixtureDatasets.flatMap((dataset) => (dataset.entities?.catalogItems || []).map((item) => ({fixtureId: dataset.fixtureId, item})));
    const byCode = new Map(entries.map((entry) => [entry.item.code, entry]));
    for (const client of [head, store]) {
      await materializeDictionaryRefs(client);
      for (const {fixtureId, item} of entries) {
        const code = apiCode(item.code);
        const existing = await getDetailAllowMissing(client, `API_BASE_${fixtureId}_${client.scopeType}_${code}`, code);
        let version = 1;
        if (existing.status === 404) {
          const created = await createItem(client, `API_BASE_CREATE_${fixtureId}_${client.scopeType}_${code}`, code, item.shapeKey);
          version = versionValue(itemResult(created.json)?.version, 1);
        } else {
          const current = envelopeData(existing.json)?.item || envelopeData(existing.json);
          assertThat(current?.shapeKey === item.shapeKey, `API_BASE_SHAPE_${code}`);
          version = versionValue(current?.version, 1);
        }
        const saved = await saveItem(client, `API_BASE_SAVE_${fixtureId}_${client.scopeType}_${code}`, code, version, apiFixtureDraft(client, fixtureId, item));
        assertThat(itemResult(saved.json)?.version !== undefined, `API_BASE_SAVE_READBACK_${code}`);
        const stored = await recordItemRefs(client, `API_BASE_${fixtureId}_${client.scopeType}_${code}`, code);
        if (client.scopeType === 'STORE' && item.shapeKey === 'MATERIAL') {
          const configured = await saveItem(client, `API_BASE_CONFIG_${fixtureId}_${client.scopeType}_${code}`, code, versionValue(stored.version, 1), apiFixtureDraft(client, fixtureId, item), apiMaterialConfig(client, item.code));
          assertThat(itemResult(configured.json)?.version !== undefined, `API_BASE_CONFIG_READBACK_${code}`);
        }
      }
    }
    return byCode;
  };
  await ensureApiBaseline();
  const mutateItem = async (client, phase, code, marker) => {
    const detail = envelopeData((await getDetail(client, `${phase}_READ`, code)).json);
    const item = detail.item || detail;
    const saved = await saveItem(client, `${phase}_WRITE`, code, versionValue(item.version ?? detail.version, 1), {
      name: item.name || code,
      shapeKey: item.shapeKey || 'STANDARD_SALE_COUNTED',
      attributes: {...(item.attributes || {}), __apiMutation: marker},
      images: Array.isArray(item.images) ? item.images : [],
      productionTagRefs: Array.isArray(item.productionTagRefs) ? item.productionTagRefs : [],
      categoryRefs: Array.isArray(item.categoryRefs) ? item.categoryRefs : [],
    });
    const readback = envelopeData((await getDetail(client, `${phase}_READBACK`, code)).json);
    return {version: versionValue((readback.item || readback).version ?? readback.version ?? item.version, 1), response: saved};
  };
  const shape = envelopeData((await request('SHAPE_MANIFEST', 'getOperationsCatalogShapeManifest', {}, {cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef}})).json);
  const storePage = envelopeData((await getItems(store, 'STORE_ITEMS')).json);
  const headPage = envelopeData((await getItems(head, 'HEAD_ITEMS')).json);
  const storeCodes = (storePage.items || []).map((row) => row.code).filter(Boolean);
  const headCodes = (headPage.items || []).map((row) => row.code).filter(Boolean);
  assertThat(storeCodes.length >= 1 && headCodes.length >= 1, 'API_FIXTURE_READBACK_EMPTY');
  assertThat(storeCodes.includes(apiCode('LATTE-001')) && headCodes.includes(apiCode('LATTE-001')), 'API_BASE_LATTE_ITEM_REQUIRED');
  const sampleStoreCode = apiCode('LATTE-001');
  const sampleHeadCode = apiCode('LATTE-001');
  let sampleDetail = envelopeData((await getDetail(store, 'SAMPLE_DETAIL', sampleStoreCode)).json);
  const inventoryPage = envelopeData((await request('INVENTORY_PAGE', 'getOperationsInventoryTargets', {}, {cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef, pageSize: 100}})).json);
  const findInventoryTarget = async (productCode, phase = 'INVENTORY_TARGET_BINDING') => {
    const page = envelopeData((await request(`${phase}_${productCode}`, 'getOperationsInventoryTargets', {}, {cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef, keyword: productCode, pageSize: 100}})).json);
    const matches = (page.items || []).filter((row) => row.productCode === productCode && row.targetRef);
    assertThat(matches.length === 1, `${phase}_${productCode}_EXACT_TARGET_MATCH`);
    return matches[0];
  };
  // The full list remains the CI-API-010 read model under test, but fixture
  // binding never depends on its page order or page-size truncation.
  const targetRow = await findInventoryTarget(apiCode('BEAN-001'), 'API_BASE_BEAN_TARGET');
  assertThat(targetRow?.targetRef, 'API_BASE_BEAN_TARGET_REQUIRED');
  const targetRef = targetRow?.targetRef;
  const targetDetail = targetRef ? envelopeData((await request('TARGET_DETAIL', 'getOperationsInventoryTarget', {targetRef}, {cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef}})).json) : null;

  let inboundVoidFixture;
  let dependentVoidFixture;
  let selectedOverflowFixture;
  let closureOverflowFixture;
  let localCopyMappingFixture;
  let ownerFailureFixture;
  let dagFixture;
  let compatibilityFixture;
  let staleFixture;
  let productionTagFixture;
  let hasSkuFixture;
  let shapeMatrixFixture;
  const fixtureBindings = {};
  const bindFixture = (fixtureRef, binding) => {
    fixtureBindings[fixtureRef] = {...(fixtureBindings[fixtureRef] || {}), ...binding};
  };
  const primaryTargetRefFor = (fixtureRef) => {
    const value = fixtureBindings[fixtureRef]?.primaryTargetRef;
    assertThat(value, `${fixtureRef}_PRIMARY_TARGET_BINDING_REQUIRED`);
    return value;
  };
  const targetRowsByProductCode = new Map([[apiCode('BEAN-001'), targetRow]]);
  for (const fixture of fixtures.seedDatasets || []) {
    const catalogItemCodes = (fixture.entities?.catalogItems || []).map((row) => apiCode(row.code)).filter(Boolean);
    const targetProductCodes = (fixture.entities?.stockTargets || []).map((row) => apiCode(row.productCode)).filter(Boolean);
    for (const productCode of targetProductCodes) {
      if (!targetRowsByProductCode.has(productCode)) targetRowsByProductCode.set(productCode, await findInventoryTarget(productCode, `SEED_${fixture.fixtureId}_TARGET`));
    }
    bindFixture(fixture.fixtureId, {
      catalogItemCodes,
      primaryCatalogItemCode: catalogItemCodes[0],
      targetProductCodes,
      targetRefs: Object.fromEntries(targetProductCodes.filter((code) => targetRowsByProductCode.get(code)?.targetRef).map((code) => [code, targetRowsByProductCode.get(code).targetRef])),
      primaryTargetRef: targetProductCodes.map((code) => targetRowsByProductCode.get(code)?.targetRef).find(Boolean),
      primaryTargetProductCode: targetProductCodes.find((code) => targetRowsByProductCode.get(code)?.targetRef),
    });
  }
  for (const fixtureRef of ['FIXTURE-WORKBENCH-QUERY', 'FIXTURE-SURFACE-STATES', 'FIXTURE-ASSET-PROCESSING', 'FIXTURE-SCENARIO-CI-L2-004', 'FIXTURE-SCENARIO-CI-L2-008', 'FIXTURE-SCENARIO-CI-L2-018']) {
    bindFixture(fixtureRef, {catalogItemCodes: [sampleStoreCode], primaryCatalogItemCode: sampleStoreCode});
  }
  if (targetRef) {
    bindFixture('FIXTURE-INVENTORY-NEGATIVE', {targetRefs: {primary: targetRef}, primaryTargetRef: targetRef, primaryTargetProductCode: targetRow.productCode});
    bindFixture('FIXTURE-COUNT-INCREASE-ADJUST', {targetRefs: {primary: targetRef}, primaryTargetRef: targetRef, primaryTargetProductCode: targetRow.productCode});
    bindFixture('FIXTURE-CONFIG-ONLY', {targetRefs: {primary: targetRef}, primaryTargetRef: targetRef, primaryTargetProductCode: targetRow.productCode});
    bindFixture('FIXTURE-ADVANCED-DIAGNOSTICS', {targetRefs: {primary: targetRef}, primaryTargetRef: targetRef, primaryTargetProductCode: targetRow.productCode});
  }
  const fixtureReadbacks = new Map();
  const ensureInboundVoidFixture = async () => {
    if (inboundVoidFixture) return inboundVoidFixture;
    const targetCode = `API-VOID-TARGET-${Date.now()}`;
    const consumerCode = `API-VOID-CONSUMER-${Date.now()}`;
    const target = await createItem(store, 'VOID_INBOUND_TARGET_CREATE', targetCode);
    const consumer = await createItem(store, 'VOID_INBOUND_CONSUMER_CREATE', consumerCode);
    await recordItemRefs(store, 'VOID_INBOUND_TARGET', targetCode);
    await recordItemRefs(store, 'VOID_INBOUND_CONSUMER', consumerCode);
    const consumerVersion = versionValue(itemResult(consumer.json)?.version, 1);
    await saveItem(store, 'VOID_INBOUND_CONSUMER_SAVE', consumerCode, consumerVersion, {
      name: consumerCode,
      shapeKey: 'STANDARD_SALE_COUNTED',
      ...compositeGroups(store, [targetCode], consumerCode),
    });
    const targetDetail = envelopeData((await getDetail(store, 'VOID_INBOUND_TARGET_DETAIL', targetCode)).json);
    inboundVoidFixture = {targetCode, targetVersion: versionValue(targetDetail.item?.version ?? targetDetail.version ?? itemResult(target.json)?.version, 1)};
    bindFixture('FIXTURE-VOID-INBOUND-REFERENCE', {catalogItemCodes: [targetCode, consumerCode], primaryCatalogItemCode: targetCode});
    return inboundVoidFixture;
  };
  const ensureDependentVoidFixture = async () => {
    if (dependentVoidFixture) return dependentVoidFixture;
    const code = `API-VOID-DEPENDENT-${Date.now()}`;
    const created = await createItem(store, 'VOID_DEPENDENT_CREATE', code);
    await recordItemRefs(store, 'VOID_DEPENDENT', code);
    const version = versionValue(itemResult(created.json)?.version, 1);
    const saved = await saveItem(store, 'VOID_DEPENDENT_SAVE', code, version, {
      name: code,
      shapeKey: 'STANDARD_SALE_COUNTED',
    }, {
      nodes: [{nodeType: 'ITEM', itemCode: code, itemRef: itemRef(refsFor(store), code), productSkuRef: null, mode: 'INDEPENDENT_STOCK', consumptionUnit: 'EACH', configuration: {countingUnit: 'EACH', conversionFactor: '1', lowStockThreshold: '1', allowNegative: false}}],
    });
    const detail = envelopeData((await getDetail(store, 'VOID_DEPENDENT_DETAIL', code)).json);
    dependentVoidFixture = {code, version: versionValue(detail.item?.version ?? detail.version ?? itemResult(saved.json)?.version, version + 1)};
    bindFixture('FIXTURE-VOID-DEPENDENT-FACT', {catalogItemCodes: [code], primaryCatalogItemCode: code});
    return dependentVoidFixture;
  };
  const ensureClosureOverflowFixture = async (closureLimit) => {
    if (closureOverflowFixture) return closureOverflowFixture;
    const stamp = Date.now();
    const rootCode = `API-CLOSURE-ROOT-${stamp}`;
    // The root itself participates in the copy closure.  Start exactly on the
    // published boundary, then let CI-API-017-02 add one normal owner-managed
    // component to prove the one-over-limit rejection.
    const componentCodes = Array.from({length: closureLimit - 1}, (_, index) => `API-CLOSURE-COMP-${stamp}-${String(index + 1).padStart(3, '0')}`);
    const overflowCode = `API-CLOSURE-COMP-${stamp}-${String(closureLimit).padStart(3, '0')}`;
    await createItem(head, 'COPY_CLOSURE_CREATE_ROOT', rootCode);
    await createItemsInBatches(head, 'COPY_CLOSURE_CREATE', [...componentCodes, overflowCode]);
    for (const code of [rootCode, ...componentCodes, overflowCode]) await recordItemRefs(head, 'COPY_CLOSURE', code);
    const rootDetail = envelopeData((await getDetail(head, 'COPY_CLOSURE_ROOT_DETAIL', rootCode)).json);
    await saveItem(head, 'COPY_CLOSURE_ROOT_SAVE', rootCode, versionValue(rootDetail.item?.version ?? rootDetail.version, 1), {
      name: rootCode,
      shapeKey: 'STANDARD_SALE_COUNTED',
      ...compositeGroups(head, componentCodes, rootCode),
    });
    closureOverflowFixture = {rootCode, componentCodes, overflowCode, overflowApplied: false};
    bindFixture('FIXTURE-CLOSURE-LIMIT', {catalogItemCodes: [rootCode, ...componentCodes, overflowCode], primaryCatalogItemCode: rootCode});
    return closureOverflowFixture;
  };
  const addClosureOverflowComponent = async (fixture) => {
    if (fixture.overflowApplied) return fixture;
    const detail = envelopeData((await getDetail(head, 'COPY_CLOSURE_OVERFLOW_ROOT_DETAIL', fixture.rootCode)).json);
    await saveItem(head, 'COPY_CLOSURE_OVERFLOW_ROOT_SAVE', fixture.rootCode, versionValue(detail.item?.version ?? detail.version, 1), {
      name: fixture.rootCode,
      shapeKey: 'STANDARD_SALE_COUNTED',
      ...compositeGroups(head, [...fixture.componentCodes, fixture.overflowCode], fixture.rootCode),
    });
    fixture.overflowApplied = true;
    return fixture;
  };
  const ensureSelectedOverflowFixture = async (selectedLimit) => {
    if (selectedOverflowFixture) return selectedOverflowFixture;
    const stamp = Date.now();
    // This overflow fixture is intentionally self-contained.  Selecting the
    // first N seeded rows would make the case depend on catalog sort order and
    // let unrelated seed changes alter the closure under test.
    const selectedCodes = Array.from({length: selectedLimit + 1}, (_, index) => `API-SELECTED-COMP-${stamp}-${String(index + 1).padStart(3, '0')}`);
    await createItemsInBatches(head, 'COPY_SELECTED_CREATE', selectedCodes);
    selectedOverflowFixture = {selectedCodes};
    bindFixture('FIXTURE-SELECTED-LIMIT', {catalogItemCodes: selectedOverflowFixture.selectedCodes, primaryCatalogItemCode: selectedOverflowFixture.selectedCodes[0]});
    return selectedOverflowFixture;
  };
  const ensureLocalCopyMappingFixture = async () => {
    if (localCopyMappingFixture) return localCopyMappingFixture;
    const stamp = Date.now();
    const sourceCode = `API-LOCAL-SOURCE-${stamp}`;
    const targetCode = `API-LOCAL-TARGET-${stamp}`;
    await createItem(store, 'LOCAL_COPY_SOURCE_CREATE', sourceCode);
    await createItem(store, 'LOCAL_COPY_TARGET_CREATE', targetCode);
    await recordItemRefs(store, 'LOCAL_COPY_SOURCE', sourceCode);
    await recordItemRefs(store, 'LOCAL_COPY_TARGET', targetCode);
    localCopyMappingFixture = {sourceCode, targetCode};
    bindFixture('FIXTURE-LOCAL-COPY', {catalogItemCodes: [sourceCode, targetCode], primaryCatalogItemCode: sourceCode});
    return localCopyMappingFixture;
  };
  const ensureOwnerFailureFixture = async () => {
    if (ownerFailureFixture) return ownerFailureFixture;
    const code = `API-OWNER-FAILURE-${Date.now()}`;
    await createItem(head, 'OWNER_FAILURE_SOURCE_CREATE', code);
    ownerFailureFixture = {sourceCode: code};
    bindFixture('FIXTURE-REPLAY-ROLLBACK', {catalogItemCodes: [code], primaryCatalogItemCode: code});
    return ownerFailureFixture;
  };
  const ensureDagFixture = async () => {
    if (dagFixture) return dagFixture;
    const stamp = Date.now();
    const rootCode = `API-DAG-A-${stamp}`;
    const middleCode = `API-DAG-B-${stamp}`;
    const leafCode = `API-DAG-C-${stamp}`;
    const inboundOnlyCode = `API-DAG-INBOUND-${stamp}`;
    await createItem(head, 'DAG_SOURCE_CREATE', rootCode);
    await createItem(head, 'DAG_SOURCE_CREATE', middleCode);
    await createItem(head, 'DAG_SOURCE_CREATE', leafCode);
    await createItem(head, 'DAG_SOURCE_CREATE', inboundOnlyCode);
    for (const code of [rootCode, middleCode, leafCode, inboundOnlyCode]) await recordItemRefs(head, 'DAG_SOURCE', code);
    for (const [code, components] of [[rootCode, [middleCode]], [middleCode, [leafCode]], [leafCode, [rootCode]], [inboundOnlyCode, [rootCode]]]) {
      const detail = envelopeData((await getDetail(head, 'DAG_SOURCE_DETAIL', code)).json);
      // The request helper derives idempotency from phase.  Each node link is
      // a distinct command, so keep its phase/key distinct as well; reusing a
      // phase would correctly surface IDEMPOTENCY_MISMATCH on the second node.
      await saveItem(head, `DAG_SOURCE_LINK_${code}`, code, versionValue(detail.item?.version ?? detail.version, 1), {name: code, shapeKey: 'STANDARD_SALE_COUNTED', ...compositeGroups(head, components, code)});
    }
    dagFixture = {rootCode, middleCode, leafCode, inboundOnlyCode, targetConflictCode: rootCode};
    bindFixture('FIXTURE-DAG-CYCLE', {catalogItemCodes: [rootCode, middleCode, leafCode, inboundOnlyCode], primaryCatalogItemCode: rootCode});
    return dagFixture;
  };
  const ensureCompatibilityFixture = async () => {
    if (compatibilityFixture) return compatibilityFixture;
    const stamp = Date.now();
    const reuseCode = `API-COMPAT-REUSE-${stamp}`;
    const shapeCode = `API-COMPAT-SHAPE-${stamp}`;
    const skuCode = `API-COMPAT-SKU-${stamp}`;
    const unitCode = `API-COMPAT-UNIT-${stamp}`;
    const referenceCode = `API-COMPAT-REFERENCE-${stamp}`;
    const pairs = [reuseCode, shapeCode, skuCode, unitCode, referenceCode];
    await createItemsInBatches(head, 'COMPAT_SOURCE_CREATE', pairs);
    await createItemsInBatches(store, 'COMPAT_TARGET_CREATE', pairs.filter((code) => code !== shapeCode));
    await createItem(store, 'COMPAT_TARGET_SHAPE_CREATE', shapeCode, 'MATERIAL');
    for (const code of pairs) await recordItemRefs(head, 'COMPAT_SOURCE', code);
    for (const code of pairs) await recordItemRefs(store, 'COMPAT_TARGET', code);
    const productionTagCode = `API-COMPAT-PRODUCTION-TAG-${stamp}`;
    await request('COMPAT_SOURCE_PRODUCTION_TAG_CREATE', 'createOperationsProductionTag', {}, {
      cookie: head.cookie, brandRef: head.brandRef, expected: [200],
      idempotencyKey: `catalog-api-compat-production-tag-${runId}-head`,
      body: {dataNodeRef: head.dataNodeRef, code: productionTagCode, tagKind: 'PRODUCTION', name: `${productionTagCode}-SOURCE`},
    });
    await request('COMPAT_TARGET_PRODUCTION_TAG_CREATE', 'createOperationsProductionTag', {}, {
      cookie: store.cookie, brandRef: store.brandRef, expected: [200],
      idempotencyKey: `catalog-api-compat-production-tag-${runId}-store`,
      body: {dataNodeRef: store.dataNodeRef, code: productionTagCode, tagKind: 'PRODUCTION', name: `${productionTagCode}-TARGET`},
    });
    const sourceTags = envelopeData((await request('COMPAT_SOURCE_PRODUCTION_TAG_READBACK', 'getOperationsProductionTags', {}, {
      cookie: head.cookie, brandRef: head.brandRef, queryParameters: {dataNodeRef: head.dataNodeRef},
    })).json);
    const targetTags = envelopeData((await request('COMPAT_TARGET_PRODUCTION_TAG_READBACK', 'getOperationsProductionTags', {}, {
      cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef},
    })).json);
    const sourceProductionTag = (sourceTags.entries || sourceTags.items || []).find((entry) => entry.code === productionTagCode);
    const targetProductionTag = (targetTags.entries || targetTags.items || []).find((entry) => entry.code === productionTagCode);
    const sourceProductionTagRef = requiredUuid(sourceProductionTag?.tagRef, `PRODUCTION_TAG:${productionTagCode}:source`);
    requiredUuid(targetProductionTag?.tagRef, `PRODUCTION_TAG:${productionTagCode}:target`);
    const sourceShape = envelopeData((await getDetail(head, 'COMPAT_SOURCE_DETAIL', shapeCode)).json);
    const targetShape = envelopeData((await getDetail(store, 'COMPAT_TARGET_DETAIL', shapeCode)).json);
    const sourceSku = envelopeData((await getDetail(head, 'COMPAT_SOURCE_SKU_DETAIL', skuCode)).json);
    const targetSku = envelopeData((await getDetail(store, 'COMPAT_TARGET_SKU_DETAIL', skuCode)).json);
    const sourceUnit = envelopeData((await getDetail(head, 'COMPAT_SOURCE_UNIT_DETAIL', unitCode)).json);
    const targetUnit = envelopeData((await getDetail(store, 'COMPAT_TARGET_UNIT_DETAIL', unitCode)).json);
    const sourceReference = envelopeData((await getDetail(head, 'COMPAT_SOURCE_REFERENCE_DETAIL', referenceCode)).json);
    const targetReference = envelopeData((await getDetail(store, 'COMPAT_TARGET_REFERENCE_DETAIL', referenceCode)).json);
    await saveItem(head, 'COMPAT_SHAPE_SAVE', shapeCode, versionValue(sourceShape.item?.version ?? sourceShape.version, 1), {name: shapeCode, shapeKey: 'STANDARD_SALE_COUNTED'});
    await saveItem(store, 'COMPAT_SHAPE_SAVE_TARGET', shapeCode, versionValue(targetShape.item?.version ?? targetShape.version, 1), {name: shapeCode, shapeKey: 'MATERIAL'});
    // Row 14 is a production-tag owner conflict.  The catalog item stores the
    // opaque source tag ref; the target owner has the same code but a different
    // semantic name, so the public copy request remains contract-valid and the
    // owner preflight supplies the blocking fact.
    await saveItem(head, 'COMPAT_REFERENCE_SAVE', referenceCode, versionValue(sourceReference.item?.version ?? sourceReference.version, 1), {name: referenceCode, shapeKey: 'STANDARD_SALE_COUNTED', productionTagRefs: [sourceProductionTagRef]});
    await saveItem(store, 'COMPAT_REFERENCE_SAVE_TARGET', referenceCode, versionValue(targetReference.item?.version ?? targetReference.version, 1), {name: referenceCode, shapeKey: 'STANDARD_SALE_COUNTED', productionTagRefs: []});
    const skuDraft = (client, size, owner) => ({
      productSkuRef: localRef(refsFor(client), `COMPAT-SKU:${skuCode}:${owner}`),
      skuCode: 'SKU-001', skuName: `${skuCode}-${size}`,
      attributeValueRefs: [{attributeRef: dictionaryRef(refsFor(client), 'SKU_ATTRIBUTE', 'SIZE'), attributeCode: 'SIZE', attributeName: 'Size', attributeValueRef: dictionaryRef(refsFor(client), 'SKU_ATTRIBUTE_VALUE', size), valueCode: size, valueLabel: size, displayOrder: 0, status: 'ENABLED'}],
      skuBarcode: `API-${skuCode}-${owner}`, standardSalePrice: 100, isDefault: true, status: 'ENABLED', version: 1, mediaRefs: [],
    });
    await saveItem(head, 'COMPAT_SKU_SAVE', skuCode, versionValue(sourceSku.item?.version ?? sourceSku.version, 1), {name: skuCode, shapeKey: 'STANDARD_SALE_COUNTED', skus: [skuDraft(head, 'SMALL', 'HEAD')]});
    await saveItem(store, 'COMPAT_SKU_SAVE_TARGET', skuCode, versionValue(targetSku.item?.version ?? targetSku.version, 1), {name: skuCode, shapeKey: 'STANDARD_SALE_COUNTED', skus: [skuDraft(store, 'LARGE', 'STORE')]});
    // Consumption units belong to the inventory owner, not to the catalog
    // draft.  Keep the fixture contract-valid by creating the real stock
    // targets through the whole-save inventory configuration section; this is
    // also what makes the inventory owner's compatibility result observable
    // during brand-copy preflight.
    await saveItem(head, 'COMPAT_UNIT_SAVE', unitCode, versionValue(sourceUnit.item?.version ?? sourceUnit.version, 1), {name: unitCode, shapeKey: 'STANDARD_SALE_COUNTED'}, {
      nodes: [{nodeType: 'ITEM', itemCode: unitCode, itemRef: itemRef(refsFor(head), unitCode), productSkuRef: null, mode: 'INDEPENDENT_STOCK', consumptionUnit: 'GRAM', configuration: {countingUnit: 'GRAM', conversionFactor: '1', lowStockThreshold: '0', allowNegative: false}}],
    });
    await saveItem(store, 'COMPAT_UNIT_SAVE_TARGET', unitCode, versionValue(targetUnit.item?.version ?? targetUnit.version, 1), {name: unitCode, shapeKey: 'STANDARD_SALE_COUNTED'}, {
      nodes: [{nodeType: 'ITEM', itemCode: unitCode, itemRef: itemRef(refsFor(store), unitCode), productSkuRef: null, mode: 'INDEPENDENT_STOCK', consumptionUnit: 'EACH', configuration: {countingUnit: 'EACH', conversionFactor: '1', lowStockThreshold: '0', allowNegative: false}}],
    });
    compatibilityFixture = {reuseCode, shapeCode, skuCode, unitCode, referenceCode, productionTagCode};
    bindFixture('FIXTURE-COMPATIBILITY-MATRIX', {catalogItemCodes: pairs, primaryCatalogItemCode: reuseCode});
    bindFixture('FIXTURE-SKU-STRUCTURE-CONFLICT', {catalogItemCodes: [skuCode], primaryCatalogItemCode: skuCode});
    bindFixture('FIXTURE-UNIT-GRAM-EACH', {catalogItemCodes: [unitCode], primaryCatalogItemCode: unitCode});
    bindFixture('FIXTURE-REFERENCE-MAPPING-MISSING', {catalogItemCodes: [referenceCode, reuseCode], primaryCatalogItemCode: referenceCode});
    return compatibilityFixture;
  };
  const ensureStaleFixture = async () => {
    if (staleFixture) return staleFixture;
    const stamp = Date.now();
    const code = `API-STALE-${stamp}`;
    await createItem(head, 'STALE_SOURCE_CREATE', code);
    await createItem(store, 'STALE_TARGET_CREATE', code);
    staleFixture = {code};
    bindFixture('FIXTURE-STALE-SOURCE', {catalogItemCodes: [code], primaryCatalogItemCode: code});
    bindFixture('FIXTURE-STALE-TARGET', {catalogItemCodes: [code], primaryCatalogItemCode: code});
    return staleFixture;
  };
  const ensureProductionTagFixture = async () => {
    if (productionTagFixture) return productionTagFixture;
    const code = `API-TAG-${Date.now()}`;
    const body = (client) => ({dataNodeRef: client.dataNodeRef, code, tagKind: 'PRODUCTION', name: code});
    await request('TAG_HEAD_CREATE', 'createOperationsProductionTag', {}, {cookie: head.cookie, brandRef: head.brandRef, expected: [200], idempotencyKey: `catalog-api-tag-${runId}-head`, body: body(head)});
    await request('TAG_STORE_CREATE', 'createOperationsProductionTag', {}, {cookie: store.cookie, brandRef: store.brandRef, expected: [200], idempotencyKey: `catalog-api-tag-${runId}-store`, body: body(store)});
    const storeTags = envelopeData((await request('TAG_STORE_READBACK', 'getOperationsProductionTags', {}, {cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef}})).json);
    const storeTag = (storeTags.items || storeTags.entries || []).find((entry) => entry.code === code);
    productionTagFixture = {code, version: versionValue(storeTag?.version, 1)};
    bindFixture('FIXTURE-OWNER-SCOPE', {productionTagCodes: [code], primaryProductionTagCode: code});
    return productionTagFixture;
  };
  let voidObjectFactsPromise;
  const ensureVoidObjectFacts = () => {
    if (voidObjectFactsPromise) return voidObjectFactsPromise;
    voidObjectFactsPromise = (async () => {

    // CI-API-006 is a fact/readback scenario, not a request to reuse DEV seed
    // rows. Construct every object through its owning HTTP command in this
    // run so the API stage remains independently executable.
    const stamp = Date.now();
    const categoryCode = `API-CATEGORY-${stamp}`;
    await request('VOID_CATEGORY_CREATE', 'createOperationsCatalogCategory', {}, {
      cookie: store.cookie, brandRef: store.brandRef, expected: [200],
      idempotencyKey: `catalog-api-category-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, code: categoryCode, name: 'API void category', parentCategoryRef: null},
    });
    const dictionaryCode = `API-UNIT-${stamp}`;
    await request('VOID_DICTIONARY_CREATE', 'createOperationsCatalogDictionaryEntry', {dictionaryKind: 'SALES_UNIT'}, {
      cookie: store.cookie, brandRef: store.brandRef, expected: [200],
      idempotencyKey: `catalog-api-dictionary-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, dictionaryKind: 'SALES_UNIT', code: dictionaryCode, name: 'API unit'},
    });
    await ensureProductionTagFixture();

    const fileName = 'coffee.jpg';
    const bytes = fs.readFileSync(path.join(root, 'contracts/policy/catalog-inventory-p1-media', fileName));
    const form = new FormData();
    form.set('dataNodeRef', store.dataNodeRef);
    form.set('fileName', fileName);
    form.set('mediaType', 'image/jpeg');
    form.set('contentDigest', sha256(bytes));
    form.set('content', new Blob([bytes], {type: 'image/jpeg'}), fileName);
    const staged = await request('VOID_ASSET_STAGE', 'stageOperationsCatalogAsset', {}, {
      cookie: store.cookie, brandRef: store.brandRef, form,
      idempotencyKey: `catalog-api-void-asset-${runId}`,
    });
    const assetRef = itemResult(staged.json)?.assetRef;
    const bindGrant = itemResult(staged.json)?.bindGrant;
    assertThat(assetRef, 'VOID_ASSET_STAGE_READBACK');
    assertThat(bindGrant, 'VOID_ASSET_STAGE_BIND_GRANT_READBACK');
    const currentItem = sampleDetail.item || sampleDetail;
    const imageSaved = await saveItem(store, 'VOID_ASSET_CLAIM', sampleStoreCode, versionValue(currentItem.version ?? sampleDetail.version, 1), {
      name: currentItem.name || sampleStoreCode,
      shapeKey: currentItem.shapeKey || 'STANDARD_SALE_COUNTED',
      images: [assetRef],
    }, {nodes: []}, [], {[assetRef]: bindGrant});
    assertThat(itemResult(imageSaved.json)?.version !== undefined, 'VOID_ASSET_CLAIM_READBACK');

    const currentAfterAsset = envelopeData((await getDetail(store, 'VOID_BOM_PARENT_DETAIL', sampleStoreCode)).json);
    const parentVersion = versionValue(currentAfterAsset.item?.version ?? currentAfterAsset.version, 1);
    const bomDraft = preserveFixtureWholeSaveImages(currentAfterAsset, {
      name: currentAfterAsset.item?.name || sampleStoreCode,
      shapeKey: currentAfterAsset.item?.shapeKey || 'STANDARD_SALE_COUNTED',
      inventoryBom: [{
        nodeType: 'STOCK_TARGET', mode: 'BOM', targetRef,
        itemCode: sampleStoreCode, itemRef: itemRef(refsFor(store), sampleStoreCode), productSkuRef: null, optionValueCode: null, optionValueRef: null, quantity: '1', unit: 'GRAM', lineSign: 'POSITIVE', version: 0,
      }],
    });
    assertFixtureWholeSaveImagesRetained(currentAfterAsset, bomDraft);
    const bomSaved = await saveItem(store, 'VOID_BOM_PARENT_SAVE', sampleStoreCode, parentVersion, bomDraft);
    assertThat(itemResult(bomSaved.json)?.version !== undefined, 'VOID_BOM_SAVE_READBACK');
    sampleDetail = envelopeData((await getDetail(store, 'VOID_OBJECT_FACTS_READBACK', sampleStoreCode)).json);
    const sampleItem = sampleDetail.item || sampleDetail;
    assertThat(Array.isArray(sampleItem.images) && sampleItem.images.includes(assetRef), 'VOID_ASSET_FACT_READY');
    assertThat(Array.isArray(sampleDetail.inventoryBom) && sampleDetail.inventoryBom.length > 0, 'VOID_BOM_FACT_READY');

    // The owner identity is expression-indexed on nullable SKU/option values.
    // A second whole-save of the same BOM must update that row rather than
    // create a duplicate or escape through a PostgreSQL inference error.
    const repeatDetail = envelopeData((await getDetail(store, 'VOID_BOM_REPEAT_DETAIL', sampleStoreCode)).json);
    const repeatVersion = versionValue(repeatDetail.item?.version ?? repeatDetail.version, 1);
    // The detail row's itemCode is the BOM owner (the parent item), not the
    // component item code carried by the write draft.  Identity for this
    // focused proof is therefore the same owner identity used by the
    // inventory unique index: BOM mode plus targetRef in this fixture.
    const currentBom = (repeatDetail.inventoryBom || repeatDetail.item?.inventoryBom || [])
      .find((entry) => entry.mode === 'BOM' && entry.targetRef === targetRef);
    assertThat(currentBom?.version !== undefined, 'VOID_BOM_REPEAT_VERSION_READBACK');
    const repeatBomVersion = Number(currentBom.version);
    const repeatDraft = preserveFixtureWholeSaveImages(repeatDetail, {
      name: repeatDetail.item?.name || sampleStoreCode,
      shapeKey: repeatDetail.item?.shapeKey || 'STANDARD_SALE_COUNTED',
      inventoryBom: [{
        nodeType: 'STOCK_TARGET', mode: 'BOM', targetRef,
        itemCode: sampleStoreCode, itemRef: itemRef(refsFor(store), sampleStoreCode), productSkuRef: null, optionValueCode: null, optionValueRef: null, quantity: '1', unit: 'GRAM', lineSign: 'POSITIVE', version: repeatBomVersion,
      }],
    });
    assertFixtureWholeSaveImagesRetained(repeatDetail, repeatDraft);
    const repeatSaved = await saveItem(store, 'VOID_BOM_REPEAT_SAVE', sampleStoreCode, repeatVersion, repeatDraft);
    assertThat(itemResult(repeatSaved.json)?.version !== undefined, 'VOID_BOM_REPEAT_UPSERT_READBACK');
    const afterRepeat = envelopeData((await getDetail(store, 'VOID_BOM_REPEAT_READBACK', sampleStoreCode)).json);
    const repeatedBom = (afterRepeat.inventoryBom || afterRepeat.item?.inventoryBom || [])
      .filter((entry) => entry.mode === 'BOM' && entry.targetRef === targetRef);
    assertThat(repeatedBom.length === 1, 'VOID_BOM_REPEAT_SINGLE_IDENTITY');
    assertThat(Number(repeatedBom[0]?.version) === repeatBomVersion + 1, 'VOID_BOM_REPEAT_VERSION_INCREMENT');
  })();
    return voidObjectFactsPromise;
  };
  const ensureHasSkuFixture = async () => {
    if (hasSkuFixture) return hasSkuFixture;
    const stamp = Date.now();
    const archivedCode = `API-SKU-ARCHIVED-${stamp}`;
    const disabledCode = `API-SKU-DISABLED-${stamp}`;
    const saveSkuItem = async (code, status) => {
      const created = await createItem(store, `HAS_SKU_${status}_CREATE`, code, 'SKU_VARIANT_SALE_COUNTED');
      const version = versionValue(itemResult(created.json)?.version, 1);
      await saveItem(store, `HAS_SKU_${status}_SAVE`, code, version, {
        name: code,
        shapeKey: 'SKU_VARIANT_SALE_COUNTED',
        skus: [{
          productSkuRef: localRef(refsFor(store), `SKU:${code}`), skuCode: `${code}-SKU`, skuName: code,
          attributeValueRefs: [], skuBarcode: `${code}-BARCODE`, standardSalePrice: 100,
          isDefault: true, status, version: 1, mediaRefs: [],
        }],
      });
      const detail = envelopeData((await getDetail(store, `HAS_SKU_${status}_READBACK`, code)).json);
      const skus = detail.item?.skus || [];
      assertThat(skus.length === 1 && skus[0].status === status, `HAS_SKU_${status}_FIXTURE_READBACK`);
    };
    await saveSkuItem(archivedCode, 'ARCHIVED');
    await saveSkuItem(disabledCode, 'DISABLED');
    hasSkuFixture = {archivedCode, disabledCode};
    bindFixture('FIXTURE-ARCHIVED-ONLY-SKU', {catalogItemCodes: [archivedCode], primaryCatalogItemCode: archivedCode});
    bindFixture('FIXTURE-DISABLED-SKU', {catalogItemCodes: [disabledCode], primaryCatalogItemCode: disabledCode});
    return hasSkuFixture;
  };
  const ensureShapeMatrixFixture = async () => {
    if (shapeMatrixFixture) return shapeMatrixFixture;
    const shapeKeys = ['STANDARD_SALE_COUNTED', 'SKU_VARIANT_SALE_COUNTED', 'STANDARD_SALE_WEIGHED', 'MATERIAL', 'COMPOSITE', 'SERVICE'];
    const codes = [];
    for (const shapeKey of shapeKeys) {
      const code = `SHAPE-${shapeKey}`;
      const existing = await getDetailAllowMissing(store, `SHAPE_${shapeKey}_LOOKUP`, code);
      if (existing.status === 404) await createItem(store, `SHAPE_${shapeKey}_CREATE`, code, shapeKey);
      else {
        const existingData = envelopeData(existing.json);
        const existingItem = existingData?.item || existingData;
        assertThat(existingItem?.shapeKey === shapeKey, `SHAPE_${shapeKey}_READBACK`);
      }
      codes.push(code);
    }
    shapeMatrixFixture = {codes};
    bindFixture('FIXTURE-SHAPE-MATRIX', {catalogItemCodes: codes, primaryCatalogItemCode: codes[0]});
    bindFixture('FIXTURE-SHAPE-ADMISSION', {catalogItemCodes: ['SHAPE-SERVICE'], primaryCatalogItemCode: 'SHAPE-SERVICE'});
    bindFixture('FIXTURE-PRODUCIBLE-RETAINED', {catalogItemCodes: ['SHAPE-SERVICE'], primaryCatalogItemCode: 'SHAPE-SERVICE'});
    return shapeMatrixFixture;
  };
  const readApiFixture = async (fixtureId) => {
    if (fixtureReadbacks.has(fixtureId)) return fixtureReadbacks.get(fixtureId);
    const fixture = fixtures.seedDatasets.find((value) => value.fixtureId === fixtureId);
    assertThat(fixture && fixture.class === 'SEED', `SEED_FIXTURE_DECLARATION_${fixtureId}`);
    const catalogItems = fixture.entities?.catalogItems || [];
    assertThat(catalogItems.length > 0, `API_FIXTURE_ITEMS_${fixtureId}`);
    const scopeReadbacks = [];
    for (const client of [head, store]) {
      const details = [];
      for (const expected of catalogItems) {
        const apiExpectedCode = apiCode(expected.code);
        const detail = envelopeData((await getDetail(client, `API_${fixtureId}_${client.scopeType}_${apiExpectedCode}_DETAIL`, apiExpectedCode)).json);
        const item = detail.item || detail;
        assertThat(item.code === apiExpectedCode, `API_${fixtureId}_${client.scopeType}_${apiExpectedCode}_CODE`);
        assertThat(item.shapeKey === expected.shapeKey, `API_${fixtureId}_${client.scopeType}_${apiExpectedCode}_SHAPE`);
        const attributes = item.attributes || {};
        assertThat(attributes.fixtureRef === fixtureId, `API_${fixtureId}_${client.scopeType}_${apiExpectedCode}_FIXTURE_KEY`);
        const images = Array.isArray(item.images) ? item.images : [];
        if (fixtureId === 'SEED-LATTE' && expected.code === 'LATTE-001') {
          const expectedSkus = (fixture.entities?.skus || []).map((value) => apiCode(`${expected.code}-SKU-${value.code.endsWith('-S') ? 'S' : value.code.endsWith('-M') ? 'M' : 'L'}`)).sort();
          const actualSkuRows = item.skus || [];
          const actualSkus = actualSkuRows.map((value) => value.skuCode || value.code).filter(Boolean).sort();
          assertThat(JSON.stringify(actualSkus) === JSON.stringify(expectedSkus), `API_${fixtureId}_${client.scopeType}_SKU_SET`);
          for (const expectedSku of fixture.entities?.skus || []) {
            const size = expectedSku.code.endsWith('-S') ? 'S' : expectedSku.code.endsWith('-M') ? 'M' : 'L';
            const actualSku = actualSkuRows.find((value) => (value.skuCode || value.code) === apiCode(`${expected.code}-SKU-${size}`));
            assertThat(actualSku, `API_${fixtureId}_${client.scopeType}_${expectedSku.code}_READBACK`);
          }
        }
        if (fixtureId === 'SEED-DINNER-SET' && expected.code === 'DINNER-SET-001') {
          assertThat((item.compositeGroups || []).some((group) => (group.components || []).some((component) => component.itemCode === apiCode('LATTE-001'))), `API_${fixtureId}_${client.scopeType}_RELATION_LATTE`);
        }
        if (fixtureId === 'SEED-CAESAR' && expected.code === 'CAESAR-001') {
          const expectedGroups = (fixture.entities?.optionGroups || []).map((value) => `API-${value.code === 'CAESAR-DRESSING' ? 'DRESSING' : value.code === 'CAESAR-SIZE' ? 'SIZE' : 'TOPPING'}`).sort();
          const actualGroups = (item.orderOptions || []).map((value) => value.groupCode).sort();
          assertThat(JSON.stringify(actualGroups) === JSON.stringify(expectedGroups), `API_${fixtureId}_${client.scopeType}_OPTION_GROUPS`);
        }
        if (fixtureId === 'SEED-MATERIALS') {
          assertThat(expected.materialRole && item.materialRole === expected.materialRole, `API_${fixtureId}_${client.scopeType}_${apiExpectedCode}_MATERIAL_ROLE`);
        }
        details.push({code: item.code, shapeKey: item.shapeKey, imageCount: images.length});
      }
      scopeReadbacks.push({scopeType: client.scopeType, dataNodeRef: client.dataNodeRef, details});
    }
    assertThat(scopeReadbacks.length === 2 && new Set(scopeReadbacks.map((value) => value.scopeType)).size === 2, `API_${fixtureId}_OWNER_SCOPE_READBACK`);
    const storeDetails = scopeReadbacks.find((value) => value.scopeType === 'STORE')?.details || [];
    const result = {fixtureId, details: storeDetails, scopeReadbacks, expectedCount: catalogItems.length};
    bindFixture(fixtureId, {
      catalogItemCodes: storeDetails.map((entry) => entry.code),
      primaryCatalogItemCode: storeDetails[0]?.code,
    });
    fixtureReadbacks.set(fixtureId, result);
    return result;
  };

  const catalogRouteCoverageOperationIds = (catalogOperationIds) => new Set(all
    .filter((operation) => catalogOperationIds.has(operation.operationId)
      && backendPerformanceFixtures.get(operation.operationId)?.area === 'U07_ROUTE')
    .map((operation) => operation.operationId));

  /**
   * Final catalog route calls are deliberately issued one-by-one through the
   * generated operation registry.  The same source-informed recipe serves
   * backend-acceptance and the predecessor performance adapter; only the
   * latter adds performance metadata. Preparation calls above remain ordinary
   * owner HTTP calls.
   */
  const executeCatalogRouteCoverage = async ({onProgress = () => {}, performanceCanonical = false} = {}) => {
    const catalogOperationIds = new Set(readJson(registryCatalogPath).operations.map((operation) => operation.operationId));
    const expectedOperationIds = performanceCanonical
      ? validateBackendPerformanceCanonicalOperationIds(all, catalogOperationIds)
      : catalogRouteCoverageOperationIds(catalogOperationIds);
    const seen = [];
    const canonical = async (phase, operationId, pathParameters = {}, options = {}) => {
      if (seen.includes(operationId)) fail(`${performanceCanonical ? 'BP_U07_CANONICAL' : 'BACKEND_ACCEPTANCE_CATALOG_ROUTE'}_DUPLICATE:${operationId}`);
      seen.push(operationId);
      onProgress([...seen]);
      const routePhase = performanceCanonical ? phase : phase.replace(/^BP_U07_/, 'BA_CATALOG_');
      return request(routePhase, operationId, pathParameters, {...options, performanceCanonical});
    };
    const expectedProblemCanonical = async (phase, operationId, pathParameters, options, problemCode, statuses) => {
      if (seen.includes(operationId)) fail(`${performanceCanonical ? 'BP_U07_CANONICAL' : 'BACKEND_ACCEPTANCE_CATALOG_ROUTE'}_DUPLICATE:${operationId}`);
      seen.push(operationId);
      onProgress([...seen]);
      const routePhase = performanceCanonical ? phase : phase.replace(/^BP_U07_/, 'BA_CATALOG_');
      return expectedProblem(routePhase, operationId, pathParameters, {...options, performanceCanonical}, problemCode, statuses);
    };
    const resultOf = (response) => itemResult(response.json) || envelopeData(response.json);
    const versionOf = (response, fallback) => Number(resultOf(response)?.version ?? response.json?.version ?? fallback);
    const entriesOf = (response) => envelopeData(response.json)?.entries || envelopeData(response.json)?.items || [];

    const context = await canonical('BP_U07_CONTEXT', 'getOperationsCatalogWorkbenchContext', {}, {
      cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef},
    });
    assertEnvelope(context.json);

    const navigation = await canonical('BP_U07_NAVIGATION', 'getOperationsCatalogNavigation', {}, {
      cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef, viewKey: 'ALL'},
    });
    assertThat(Array.isArray(envelopeData(navigation.json)?.smartViews), 'BP_U07_NAVIGATION_READBACK');

    const itemCode = `BPF-U07-ITEM-${Date.now()}`;
    const created = await canonical('BP_U07_ITEM_CREATE', 'createOperationsCatalogItem', {}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-create-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, name: itemCode, code: itemCode, shapeKey: 'STANDARD_SALE_COUNTED', attributes: {fixtureRef: 'BPF-U07-CANONICAL'}},
    });
    let itemVersion = versionOf(created, 1);
    const saved = await canonical('BP_U07_ITEM_SAVE', 'saveOperationsCatalogItem', {itemCode}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-save-${runId}`,
      body: {
        dataNodeRef: store.dataNodeRef,
        itemCode,
        sections: {
          catalogDraft: {
            name: itemCode,
            shapeKey: 'STANDARD_SALE_COUNTED',
            attributes: {fixtureRef: 'BPF-U07-CANONICAL'},
            images: [],
            productionTagRefs: [],
            categoryRefs: [],
            ordering: {priceGranularity: 'ITEM', standardSalePrice: 100, listedSalePrice: 100, missingPriceCount: 0},
          },
          inventoryConfiguration: {nodes: []},
          expectedCatalogVersion: itemVersion,
          expectedInventoryVersions: [],
        },
      },
    });
    itemVersion = versionOf(saved, itemVersion + 1);
    await canonical('BP_U07_ITEM_TRANSITION', 'transitionOperationsCatalogItemStatus', {itemCode}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-transition-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, itemCode, expectedVersion: itemVersion, targetStatus: 'ENABLED'},
    });

    const items = await canonical('BP_U07_ITEMS', 'getOperationsCatalogItems', {}, {
      cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef, pageSize: 100},
    });
    assertThat((envelopeData(items.json)?.items || []).some((entry) => entry.code === itemCode), 'BP_U07_ITEMS_READBACK');
    const detail = await canonical('BP_U07_ITEM_DETAIL', 'getOperationsCatalogItem', {itemCode}, {
      cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef},
    });
    assertThat((envelopeData(detail.json)?.item || envelopeData(detail.json))?.code === itemCode, 'BP_U07_ITEM_DETAIL_READBACK');

    const parentSetup = await request('BP_U07_CATEGORY_PARENT_SETUP', 'createOperationsCatalogCategory', {}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-category-parent-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, code: `BPF-U07-PARENT-${Date.now()}`, name: 'BPF U07 parent', parentCategoryRef: null},
    });
    const parent = resultOf(parentSetup);
    const categoryCode = `BPF-U07-CATEGORY-${Date.now()}`;
    const category = await canonical('BP_U07_CATEGORY_CREATE', 'createOperationsCatalogCategory', {}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-category-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, code: categoryCode, name: 'BPF U07 category', parentCategoryRef: required(parent?.categoryRef, 'BP_U07_CATEGORY_PARENT_REF')},
    });
    const categoryResult = resultOf(category);
    const categoryRef = required(categoryResult?.categoryRef, 'BP_U07_CATEGORY_REF');
    let categoryVersion = versionValue(categoryResult?.version, 1);
    const categoryUpdated = await canonical('BP_U07_CATEGORY_UPDATE', 'updateOperationsCatalogCategory', {categoryRef}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-category-update-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, categoryRef, expectedVersion: categoryVersion, name: `${categoryCode}-UPDATED`},
    });
    categoryVersion = versionOf(categoryUpdated, categoryVersion + 1);
    const categoryMoved = await canonical('BP_U07_CATEGORY_MOVE', 'moveOperationsCatalogCategory', {categoryRef}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-category-move-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, categoryRef, expectedVersion: categoryVersion, action: 'REPARENT', parentCategoryRef: null},
    });
    categoryVersion = versionOf(categoryMoved, categoryVersion + 1);
    await canonical('BP_U07_CATEGORY_DELETE', 'deleteOperationsCatalogCategory', {categoryRef}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-category-delete-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, categoryRef, expectedVersion: categoryVersion},
    });

    const dictionaryKind = 'SKU_ATTRIBUTE';
    const dictionary = await canonical('BP_U07_DICTIONARY', 'getOperationsCatalogDictionary', {dictionaryKind}, {
      cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef},
    });
    const existingDictionaryCodes = entriesOf(dictionary).map((entry) => entry.code).filter(Boolean);
    const dictionaryCode = `BPF-U07-DICT-${Date.now()}`;
    const dictionaryCreated = await canonical('BP_U07_DICTIONARY_CREATE', 'createOperationsCatalogDictionaryEntry', {dictionaryKind}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-dictionary-create-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, dictionaryKind, code: dictionaryCode, name: 'BPF U07 dictionary'},
    });
    let dictionaryVersion = versionOf(dictionaryCreated, 1);
    const dictionaryUpdated = await canonical('BP_U07_DICTIONARY_UPDATE', 'updateOperationsCatalogDictionaryEntry', {dictionaryKind, entryCode: dictionaryCode}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-dictionary-update-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, dictionaryKind, entryCode: dictionaryCode, expectedVersion: dictionaryVersion, name: 'BPF U07 dictionary updated'},
    });
    dictionaryVersion = versionOf(dictionaryUpdated, dictionaryVersion + 1);
    const reordered = await canonical('BP_U07_DICTIONARY_REORDER', 'reorderOperationsCatalogDictionaryEntry', {dictionaryKind}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-dictionary-reorder-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, dictionaryKind, orderedCodes: [dictionaryCode, ...existingDictionaryCodes]},
    });
    const reorderedEntry = entriesOf(reordered).find((entry) => entry.code === dictionaryCode);
    dictionaryVersion = versionValue(reorderedEntry?.version, dictionaryVersion + 1);
    await canonical('BP_U07_DICTIONARY_TRANSITION', 'transitionOperationsCatalogDictionaryEntryStatus', {dictionaryKind, entryCode: dictionaryCode}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-dictionary-transition-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, dictionaryKind, entryCode: dictionaryCode, expectedVersion: dictionaryVersion, targetStatus: 'DISABLED'},
    });

    const productionTags = await canonical('BP_U07_PRODUCTION_TAGS', 'getOperationsProductionTags', {}, {
      cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef},
    });
    assertThat(Array.isArray(entriesOf(productionTags)), 'BP_U07_PRODUCTION_TAGS_READBACK');
    const tagCode = `BPF-U07-TAG-${Date.now()}`;
    const tagCreated = await canonical('BP_U07_PRODUCTION_TAG_CREATE', 'createOperationsProductionTag', {}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-tag-create-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, code: tagCode, tagKind: 'PRODUCTION', name: 'BPF U07 production tag'},
    });
    let tagVersion = versionOf(tagCreated, 1);
    const tagUpdated = await canonical('BP_U07_PRODUCTION_TAG_UPDATE', 'updateOperationsProductionTag', {tagCode}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-tag-update-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, tagCode, tagKind: 'PRODUCTION', expectedVersion: tagVersion, name: 'BPF U07 production tag updated'},
    });
    tagVersion = versionOf(tagUpdated, tagVersion + 1);
    await canonical('BP_U07_PRODUCTION_TAG_TRANSITION', 'transitionOperationsProductionTagStatus', {tagCode}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-tag-transition-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, tagCode, expectedVersion: tagVersion, targetStatus: 'DISABLED'},
    });

    const localCopy = await ensureLocalCopyMappingFixture();
    await canonical('BP_U07_LOCAL_COPY_CANDIDATES', 'getOperationsLocalCatalogCopyCandidates', {}, {
      cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef},
    });
    const localPreflight = await canonical('BP_U07_LOCAL_COPY_PREFLIGHT', 'preflightOperationsLocalCatalogCopy', {}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-local-preflight-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, sourceItemCode: localCopy.sourceCode, targetItemCode: localCopy.targetCode, selectedSections: ['BASIC_INFO']},
    });
    const localData = envelopeData(localPreflight.json);
    await canonical('BP_U07_LOCAL_COPY_EXECUTE', 'executeOperationsLocalCatalogCopy', {}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-local-execute-${runId}`,
      body: {
        dataNodeRef: store.dataNodeRef,
        sourceItemCode: localCopy.sourceCode,
        targetItemCode: localCopy.targetCode,
        selectedSections: ['BASIC_INFO'],
        preflightDigest: required(localData?.preflightDigest, 'BP_U07_LOCAL_PREFLIGHT_DIGEST'),
        expectedSourceVersion: catalogObjectVersion(localData, localCopy.sourceCode, 'sourceVersion'),
        expectedTargetVersion: catalogObjectVersion(localData, localCopy.sourceCode, 'targetVersion'),
      },
    });

    const brandCopy = await ensureOwnerFailureFixture();
    await canonical('BP_U07_BRAND_COPY_CANDIDATES', 'getOperationsBrandCatalogCopyCandidates', {}, {
      cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef},
    });
    const brandPreflight = await canonical('BP_U07_BRAND_COPY_PREFLIGHT', 'preflightOperationsBrandCatalogCopy', {}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-brand-preflight-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, selectedItemCodes: [brandCopy.sourceCode], targetDataNodeRef: store.dataNodeRef},
    });
    const brandData = envelopeData(brandPreflight.json);
    await canonical('BP_U07_BRAND_COPY_EXECUTE', 'executeOperationsBrandCatalogCopy', {}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-brand-execute-${runId}`,
      body: {
        dataNodeRef: store.dataNodeRef,
        selectedItemCodes: [brandCopy.sourceCode],
        targetDataNodeRef: store.dataNodeRef,
        preflightDigest: required(brandData?.preflightDigest, 'BP_U07_BRAND_PREFLIGHT_DIGEST'),
        expectedSourceVersion: catalogObjectVersion(brandData, brandCopy.sourceCode, 'sourceVersion'),
        expectedTargetVersion: catalogObjectVersion(brandData, brandCopy.sourceCode, 'targetVersion', 0),
      },
    });

    const targets = await canonical('BP_U07_INVENTORY_TARGETS', 'getOperationsInventoryTargets', {}, {
      cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef, pageSize: 100},
    });
    assertThat((envelopeData(targets.json)?.items || []).some((entry) => entry.targetRef === targetRef), 'BP_U07_INVENTORY_TARGET_LIST_READBACK');
    const target = await canonical('BP_U07_INVENTORY_TARGET', 'getOperationsInventoryTarget', {targetRef}, {
      cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef},
    });
    const targetData = envelopeData(target.json);
    let targetVersion = Number(targetData?.version ?? targetData?.target?.version);
    assertThat(Number.isSafeInteger(targetVersion) && targetVersion > 0, 'BP_U07_INVENTORY_TARGET_VERSION');
    const unit = targetData?.configuration?.countingUnit || targetData?.target?.consumptionUnit || 'EACH';
    await canonical('BP_U07_INVENTORY_CHANGE_SUMMARY', 'getOperationsInventoryTargetChangeSummary', {targetRef}, {
      cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef, period: '30D'},
    });
    await canonical('BP_U07_INVENTORY_HISTORY', 'getOperationsInventoryTargetBusinessHistory', {targetRef}, {
      cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef, pageSize: 100},
    });
    await canonical('BP_U07_INVENTORY_REFERENCES', 'getOperationsInventoryTargetConsumptionReferences', {targetRef}, {
      cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef, pageSize: 100},
    });
    await canonical('BP_U07_INVENTORY_LEDGER', 'getOperationsInventoryTargetLedger', {targetRef}, {
      cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef, pageSize: 100},
    });
    await canonical('BP_U07_INVENTORY_DIAGNOSTICS', 'getOperationsInventoryTargetDiagnostics', {targetRef}, {
      cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef},
    });
    const counted = await canonical('BP_U07_INVENTORY_COUNT', 'countOperationsInventoryTarget', {targetRef}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-inventory-count-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, targetRef, expectedVersion: targetVersion, countedQuantity: String(targetData?.balance ?? targetData?.target?.balance ?? '0'), unit, zeroConfirmation: true},
    });
    targetVersion = versionOf(counted, targetVersion + 1);
    const increased = await canonical('BP_U07_INVENTORY_INCREASE', 'increaseOperationsInventoryTarget', {targetRef}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-inventory-increase-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, targetRef, expectedVersion: targetVersion, quantity: '1', unit},
    });
    targetVersion = versionOf(increased, targetVersion + 1);
    const adjusted = await canonical('BP_U07_INVENTORY_ADJUST', 'adjustOperationsInventoryTarget', {targetRef}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-inventory-adjust-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, targetRef, expectedVersion: targetVersion, direction: 'INCREASE', quantity: '1', unit, reasonCode: 'RECOUNT'},
    });
    targetVersion = versionOf(adjusted, targetVersion + 1);
    await canonical('BP_U07_INVENTORY_CONFIGURATION', 'updateOperationsInventoryTargetConfiguration', {targetRef}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-inventory-config-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, targetRef, expectedVersion: targetVersion, configuration: {allowNegative: Boolean(targetData?.configuration?.allowNegative), lowStockThreshold: String(targetData?.configuration?.lowStockThreshold ?? '0'), countingUnit: unit, conversionFactor: String(targetData?.configuration?.conversionFactor ?? '1')}},
    });

    // The void/readback fixture owns coffee.jpg and keeps it actively bound.
    // This canonical pair instead proves the independent STAGED -> RELEASED
    // lifecycle, so it must use a valid asset not already referenced by that
    // fixture.
    const fileName = 'tiramisu.jpg';
    const bytes = fs.readFileSync(path.join(root, 'contracts/policy/catalog-inventory-p1-media', fileName));
    const form = new FormData();
    form.set('dataNodeRef', store.dataNodeRef);
    form.set('fileName', fileName);
    form.set('mediaType', 'image/jpeg');
    form.set('contentDigest', sha256(bytes));
    form.set('content', new Blob([bytes], {type: 'image/jpeg'}), fileName);
    const staged = await canonical('BP_U07_ASSET_STAGE', 'stageOperationsCatalogAsset', {}, {
      cookie: store.cookie, brandRef: store.brandRef, form,
      idempotencyKey: `bpf-u07-asset-stage-${runId}`,
    });
    const stagedResult = resultOf(staged);
    const assetRef = required(stagedResult?.assetRef, 'BP_U07_ASSET_REF');
    const assetVersion = versionValue(stagedResult?.version, 1);
    await canonical('BP_U07_ASSET_RELEASE', 'releaseOperationsCatalogStagedAsset', {assetRef}, {
      cookie: store.cookie, brandRef: store.brandRef,
      idempotencyKey: `bpf-u07-asset-release-${runId}`,
      body: {dataNodeRef: store.dataNodeRef, assetRef, expectedVersion: assetVersion},
    });

    if (backendAcceptanceMode) {
      // The approved catalog fixture generator explicitly excludes the
      // EXTERNAL_ORDER_TEMPORARY ingress chain in this phase.  Still execute
      // both semantic routes through their public HTTP boundary and prove the
      // owner-level NOT_FOUND contract for a run-scoped absent source item;
      // never fabricate an ingress fact or silently omit the operation.
      const temporaryCode = `BA-TEMPORARY-INGRESS-UNAVAILABLE-${Date.now()}`;
      const promotionBody = {
        dataNodeRef: store.dataNodeRef,
        itemCode: temporaryCode,
        formalCode: `BA-TEMPORARY-FORMAL-${Date.now()}`,
        shapeKey: 'STANDARD_SALE_COUNTED',
        name: temporaryCode,
        attributes: {fixtureRef: 'NO_APPROVED_INGRESS_THIS_PHASE'},
        expectedSourceVersion: 1,
      };
      await expectedProblemCanonical('BA_CATALOG_TEMPORARY_PREFLIGHT', 'preflightOperationsTemporaryCatalogItemPromotion', {itemCode: temporaryCode}, {
        cookie: store.cookie,
        brandRef: store.brandRef,
        idempotencyKey: `backend-acceptance-temporary-preflight-${runId}`,
        body: promotionBody,
      }, 'NOT_FOUND', [404]);
      await expectedProblemCanonical('BA_CATALOG_TEMPORARY_EXECUTE', 'executeOperationsTemporaryCatalogItemPromotion', {itemCode: temporaryCode}, {
        cookie: store.cookie,
        brandRef: store.brandRef,
        idempotencyKey: `backend-acceptance-temporary-execute-${runId}`,
        body: {...promotionBody, expectedVersion: 1, preflightDigest: 'NO_APPROVED_INGRESS_THIS_PHASE'},
      }, 'NOT_FOUND', [404]);
    } else {
      // The source-owned external-order item is intentionally not fabricated
      // by this predecessor performance adapter.  Missing state remains a
      // hard red there and never falls back to a normal catalog item.
      const temporaryCode = required(process.env.CATALOG_INVENTORY_PERFORMANCE_TEMPORARY_ITEM_CODE, 'BP_U07_TEMPORARY_OWNER_FIXTURE_REQUIRED');
      const temporaryDetail = envelopeData((await request('BP_U07_TEMPORARY_FIXTURE_READBACK', 'getOperationsCatalogItem', {itemCode: temporaryCode}, {cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef}})).json);
      const temporaryItem = temporaryDetail?.item || temporaryDetail;
      assertThat(temporaryItem?.source === 'TEMPORARY' || temporaryItem?.source === 'EXTERNAL_ORDER_TEMPORARY', 'BP_U07_TEMPORARY_OWNER_FACT_REQUIRED');
      const temporaryVersion = Number(temporaryItem.version);
      const formalCode = required(process.env.CATALOG_INVENTORY_PERFORMANCE_TEMPORARY_FORMAL_CODE, 'BP_U07_TEMPORARY_FORMAL_CODE_REQUIRED');
      const promotionBody = {dataNodeRef: store.dataNodeRef, itemCode: temporaryCode, formalCode, shapeKey: temporaryItem.shapeKey || 'STANDARD_SALE_COUNTED', name: temporaryItem.name || temporaryCode, shortName: temporaryItem.shortName || undefined, attributes: temporaryItem.attributes || {fixtureRef: 'BPF-U07-TEMPORARY'}, expectedSourceVersion: temporaryVersion};
      const promotionPreflight = await canonical('BP_U07_TEMPORARY_PREFLIGHT', 'preflightOperationsTemporaryCatalogItemPromotion', {itemCode: temporaryCode}, {
        cookie: store.cookie, brandRef: store.brandRef,
        idempotencyKey: `bpf-u07-temporary-preflight-${runId}`,
        body: promotionBody,
      });
      const promotionData = envelopeData(promotionPreflight.json);
      assertThat(promotionData?.canPromote === true, 'BP_U07_TEMPORARY_PROMOTION_NOT_READY');
      await canonical('BP_U07_TEMPORARY_EXECUTE', 'executeOperationsTemporaryCatalogItemPromotion', {itemCode: temporaryCode}, {
        cookie: store.cookie, brandRef: store.brandRef,
        idempotencyKey: `bpf-u07-temporary-execute-${runId}`,
        body: {...promotionBody, expectedVersion: temporaryVersion, preflightDigest: required(promotionData.preflightDigest, 'BP_U07_TEMPORARY_PREFLIGHT_DIGEST')},
      });
    }

    await canonical('BP_U07_SHAPE_MANIFEST', 'getOperationsCatalogShapeManifest', {}, {
      cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef},
    });

    const routeCode = (suffix) => `${performanceCanonical ? 'BP_U07_CANONICAL' : 'BACKEND_ACCEPTANCE_CATALOG_ROUTE'}_${suffix}`;
    assertThat(seen.length === expectedOperationIds.size, routeCode('OPERATION_COUNT'));
    assertThat(seen.every((operationId) => expectedOperationIds.has(operationId)), routeCode('UNKNOWN_OPERATION'));
    assertThat(expectedOperationIds.size === new Set(seen).size && [...expectedOperationIds].every((operationId) => seen.includes(operationId)), routeCode('OPERATION_SET'));
    return {status: 'PASS', operationIds: seen};
  };

  async function runCase(entry, assertion) {
    const before = calls.length;
    const started = Date.now();
    try {
      await assertion();
      caseResults.push({caseId: entry.caseId, scenarioId: entry.caseId.split('-').slice(0, 3).join('-'), fixtureRef: entry.fixtureRef, parameter: entry.parameter ?? {}, status: 'PASS', assertion: entry.expectedBusinessResult, callCount: calls.length - before, durationMs: Date.now() - started});
      log(entry.caseId, 'PASS', {callCount: calls.length - before});
    } catch (error) {
      const reason = error.code || compact(error.message);
      firstFailure ??= `${entry.caseId}:${reason}`;
      caseResults.push({caseId: entry.caseId, scenarioId: entry.caseId.split('-').slice(0, 3).join('-'), fixtureRef: entry.fixtureRef, parameter: entry.parameter ?? {}, status: 'FAIL', assertion: entry.expectedBusinessResult, reason, callCount: calls.length - before, durationMs: Date.now() - started});
      log(entry.caseId, 'FAIL', {reason, callCount: calls.length - before});
    }
  }

  const scenarioCatalog = validateScenarioCatalog(scenarios);
  const allCases = scenarioCatalog.cases;
  let sharedFixtureBarrier = {status: 'NOT_RUN'};
  try {
    await ensureVoidObjectFacts();
    sharedFixtureBarrier = {status: 'PASS'};
    log('SHARED_FIXTURE_BARRIER', 'PASS');
  } catch (error) {
    const reason = error.code || compact(error.message);
    firstFailure ??= `SHARED_FIXTURE_BARRIER:${reason}`;
    sharedFixtureBarrier = {status: 'FAIL', reason};
    log('SHARED_FIXTURE_BARRIER', 'FAIL', {reason});
  }
  let backendPerformanceCanonical = {status: 'NOT_RUN', operationIds: []};
  let backendAcceptanceRouteCoverage = {status: 'NOT_RUN', operationIds: []};
  let canonicalSeen = [];
  if (performanceCanonicalMode && sharedFixtureBarrier.status === 'PASS') {
    try {
      backendPerformanceCanonical = await executeCatalogRouteCoverage({onProgress: (operationIds) => { canonicalSeen = operationIds; }, performanceCanonical: true});
      log('BACKEND_PERFORMANCE_CANONICAL_42', 'PASS', {operationCount: backendPerformanceCanonical.operationIds.length});
    } catch (error) {
      const reason = error.code || compact(error.message);
      firstFailure ??= `BACKEND_PERFORMANCE_CANONICAL:${reason}`;
      backendPerformanceCanonical = canonicalFailureResult(canonicalSeen, reason);
      log('BACKEND_PERFORMANCE_CANONICAL_42', 'FAIL', {reason});
    }
  }
  if (backendAcceptanceMode && sharedFixtureBarrier.status === 'PASS') {
    try {
      backendAcceptanceRouteCoverage = await executeCatalogRouteCoverage({onProgress: (operationIds) => { canonicalSeen = operationIds; }, performanceCanonical: false});
      log('BACKEND_ACCEPTANCE_CATALOG_ROUTE_COVERAGE', 'PASS', {operationCount: backendAcceptanceRouteCoverage.operationIds.length});
    } catch (error) {
      const reason = error.code || compact(error.message);
      firstFailure ??= `BACKEND_ACCEPTANCE_CATALOG_ROUTE_COVERAGE:${reason}`;
      backendAcceptanceRouteCoverage = canonicalFailureResult(canonicalSeen, reason);
      log('BACKEND_ACCEPTANCE_CATALOG_ROUTE_COVERAGE', 'FAIL', {reason});
    }
  }
  if (!performanceCanonicalMode && sharedFixtureBarrier.status === 'PASS') {
    for (const entry of allCases) {
      const p = entry.parameter || {};
      await runCase(entry, async () => {
      const op = entry.caseId.split('-')[2];
      if (entry.caseId === 'CI-API-001-01') {
        assertThat(Array.isArray(shape.shapeKeys) && shape.shapeKeys.length === 7, 'SHAPE_KEY_COUNT');
        assertThat(shape.capabilityValues?.includes('PRODUCIBLE'), 'PRODUCIBLE_RETAINED');
        assertThat(Array.isArray(shape.modeRules) && shape.modeRules.length === 4, 'MODE_RULE_COUNT');
        assertThat(shape.shapeRules.every((rule) => !(rule.usageCapabilities || []).includes('PRODUCIBLE')), 'PRODUCIBLE_DERIVATION');
        return;
      }
      if (entry.caseId.startsWith('CI-API-002-')) {
        await ensureShapeMatrixFixture();
        const rule = shape.shapeRules.find((value) => value.shapeKey === p.shapeKey);
        assertThat(rule && typeof rule.createAllowed === 'boolean', `SHAPE_RULE_${p.shapeKey}`);
        if (p.shapeKey === 'BENEFIT_SHELL') assertThat(rule.createAllowed === false && rule.visibleButDisabled === true && rule.disabledReason === '权益域尚未开放', 'BENEFIT_SHAPE_ADMISSION');
        else assertThat(rule.createAllowed === true, `SHAPE_CREATABLE_${p.shapeKey}`);
        assertThat(Array.isArray(shape.tabRules?.[p.shapeKey]?.visible), `SHAPE_TABS_${p.shapeKey}`);
        return;
      }
      if (entry.caseId === 'CI-API-003-01') {
        const page = envelopeData((await getItems(store, 'WORKBENCH_QUERY', {keyword: '拿铁', queryGeneration: 'GEN-1', cursor: '0'})).json);
        assertThat(Array.isArray(page.items) && page.queryGeneration === 'GEN-1' && (typeof page.generation === 'string' || typeof page.generation === 'number'), 'WORKBENCH_QUERY_FACTS');
        return;
      }
      if (entry.caseId === 'CI-API-004-01') {
        const nav = envelopeData((await request('SMART_NAV', 'getOperationsCatalogNavigation', {}, {cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef, viewKey: 'ALL'}})).json);
        const keys = (nav.smartViews || []).map((value) => value.viewKey || value.key || value.code);
        // ALL is the tree root; the six smart views are the business views
        // defined by the requirements and v4 carry-over baseline.
        for (const key of ['GOVERNANCE_PENDING', 'EXTERNAL_ORDER_TEMP', 'INACTIVE', 'ARCHIVED', 'RECENTLY_UPDATED', 'AUTO_SYNC']) assertThat(keys.includes(key), `SMART_VIEW_${key}`);
        assertThat(keys.length === 6, 'SMART_VIEW_EXACT_SET');
        assertThat(!(nav.stockState || []).includes?.('NEEDS_ATTENTION'), 'NEEDS_ATTENTION_NOT_STOCK_STATE');
        return;
      }
      if (entry.caseId.startsWith('CI-API-005-')) {
        if (p.surfaceState === 'error') { await expectedProblem('SURFACE_ERROR', 'getOperationsCatalogItem', {itemCode: `NOT-FOUND-${runId}`}, {cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef}}, 'NOT_FOUND', [404]); return; }
        if (p.surfaceState === 'empty') { const empty = envelopeData((await getItems(store, 'SURFACE_EMPTY', {keyword: `__EMPTY_${runId}__`})).json); assertThat(empty.total === 0 && Array.isArray(empty.items), 'SURFACE_EMPTY_FACT'); return; }
        const data = envelopeData((await getDetail(store, `SURFACE_${p.surfaceState}`, sampleStoreCode)).json);
        assertThat(Array.isArray(data.tabs) || data.item, `SURFACE_${p.surfaceState}_FACT`);
        return;
      }
      if (entry.caseId.startsWith('CI-API-006-')) {
        await ensureVoidObjectFacts();
        const objectType = p.objectType;
        if (objectType === 'CatalogItem') assertThat(sampleDetail.actionAvailability?.voidAvailability, 'VOID_ITEM_FACT');
        else if (objectType === 'CatalogCategory') { const nav = envelopeData((await request('VOID_CATEGORY', 'getOperationsCatalogNavigation', {}, {cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef}})).json); assertThat((nav.tree || []).some((node) => node.deletionAvailability), 'VOID_CATEGORY_FACT'); }
        else if (objectType === 'CatalogDictionaryEntry') { const dict = envelopeData((await request('VOID_DICTIONARY', 'getOperationsCatalogDictionary', {dictionaryKind: 'SALES_UNIT'}, {cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef}})).json); const entries = dict.entries || []; assertThat(entries.length > 0 && entries.every((row) => row.voidAvailability), 'VOID_DICTIONARY_FACT'); }
        else if (objectType === 'ProductionTag') { const tags = envelopeData((await request('VOID_TAG', 'getOperationsProductionTags', {}, {cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef}})).json); const entries = tags.items || tags.entries || []; assertThat(entries.length > 0 && entries.every((row) => row.voidAvailability), 'VOID_TAG_FACT'); }
        else if (objectType === 'CatalogItemSku') assertThat(Array.isArray(sampleDetail.item?.skus) && sampleDetail.item.skus.length > 0, 'VOID_SKU_FACT');
        else if (objectType === 'CatalogAsset') assertThat(Array.isArray(sampleDetail.item?.images) && sampleDetail.item.images.length > 0, 'VOID_ASSET_FACT');
        else if (objectType === 'StockTarget') assertThat(targetDetail?.target?.targetRef === targetRef, 'VOID_TARGET_FACT');
        else if (objectType === 'ProductBom') assertThat(Array.isArray(sampleDetail.inventoryBom) && sampleDetail.inventoryBom.length > 0, 'VOID_BOM_FACT');
        else if (objectType === 'InboundReference') {
          const fixture = await ensureInboundVoidFixture();
          await expectedProblem('VOID_INBOUND', 'transitionOperationsCatalogItemStatus', {itemCode: fixture.targetCode}, {cookie: store.cookie, brandRef: store.brandRef, body: {dataNodeRef: store.dataNodeRef, itemCode: fixture.targetCode, expectedVersion: fixture.targetVersion, targetStatus: 'VOIDED'}, idempotencyKey: `api-void-inbound-${runId}`}, 'REFERENCE_BLOCKS_VOID', [422]);
        } else if (objectType === 'DependentFact') {
          const fixture = await ensureDependentVoidFixture();
          await expectedProblem('VOID_DEPENDENT', 'transitionOperationsCatalogItemStatus', {itemCode: fixture.code}, {cookie: store.cookie, brandRef: store.brandRef, body: {dataNodeRef: store.dataNodeRef, itemCode: fixture.code, expectedVersion: fixture.version, targetStatus: 'VOIDED'}, idempotencyKey: `api-void-dependent-${runId}`}, 'DEPENDENT_FACTS_BLOCK_VOID', [422]);
        }
        return;
      }
      if (entry.caseId.startsWith('CI-API-008-')) {
        const code = `API-LIFE-${entry.caseId.slice(-2)}-${Date.now()}`;
        const created = await createItem(store, `LIFECYCLE_CREATE_${entry.caseId}`, code);
        let version = versionValue(itemResult(created.json)?.version, 1);
        if (p.lifecycleCase === 'status-transition') {
          const saved = await saveItem(store, 'LIFECYCLE_SAVE', code, version, {name: code, shapeKey: 'STANDARD_SALE_COUNTED', ordering: {priceGranularity: 'ITEM', standardSalePrice: 100, listedSalePrice: 100, missingPriceCount: 0}}); version = versionValue(itemResult(saved.json)?.version, version + 1);
          const transitioned = await request('LIFECYCLE_ENABLE', 'transitionOperationsCatalogItemStatus', {itemCode: code}, {cookie: store.cookie, brandRef: store.brandRef, body: {dataNodeRef: store.dataNodeRef, itemCode: code, expectedVersion: version, targetStatus: 'ENABLED'}});
          assertThat(versionValue(itemResult(transitioned.json)?.version, 0) === version + 1, 'LIFECYCLE_TRANSITION_READBACK');
        } else if (p.lifecycleCase === 'version-conflict') {
          const saved = await saveItem(store, 'LIFECYCLE_CAS_SAVE', code, version, {name: code, shapeKey: 'STANDARD_SALE_COUNTED', ordering: {priceGranularity: 'ITEM', standardSalePrice: 100, listedSalePrice: 100, missingPriceCount: 0}});
          version = versionValue(itemResult(saved.json)?.version, version + 1);
          await expectedProblem('LIFECYCLE_CAS', 'transitionOperationsCatalogItemStatus', {itemCode: code}, {cookie: store.cookie, brandRef: store.brandRef, body: {dataNodeRef: store.dataNodeRef, itemCode: code, expectedVersion: version + 1, targetStatus: 'ENABLED'}}, 'VERSION_CONFLICT', [409]);
        } else {
          const key = `api-idempotency-${runId}-${entry.caseId}`;
          const first = await request('LIFECYCLE_REPLAY_A', 'createOperationsCatalogItem', {}, {cookie: store.cookie, brandRef: store.brandRef, expected: [200], idempotencyKey: key, requestId: key, body: {dataNodeRef: store.dataNodeRef, name: `REPLAY-${code}`, code: `REPLAY-${code}`, shapeKey: 'STANDARD_SALE_COUNTED', attributes: {fixtureRef: entry.fixtureRef}}});
          const second = await request('LIFECYCLE_REPLAY_B', 'createOperationsCatalogItem', {}, {cookie: store.cookie, brandRef: store.brandRef, expected: [200], idempotencyKey: key, requestId: key, body: {dataNodeRef: store.dataNodeRef, name: `REPLAY-${code}`, code: `REPLAY-${code}`, shapeKey: 'STANDARD_SALE_COUNTED', attributes: {fixtureRef: entry.fixtureRef}}});
          assertThat(JSON.stringify(canonicalJson(first.json)) === JSON.stringify(canonicalJson(second.json)), 'IDEMPOTENCY_REPLAY_RESULT');
        }
        return;
      }
      if (entry.caseId.startsWith('CI-API-009-')) {
        const fileName = 'coffee.jpg'; const file = path.join(root, 'contracts/policy/catalog-inventory-p1-media', fileName); const bytes = fs.readFileSync(file); const digest = sha256(bytes);
        const form = new FormData(); form.set('dataNodeRef', store.dataNodeRef); form.set('fileName', fileName); form.set('mediaType', 'image/jpeg'); form.set('contentDigest', digest); form.set('content', new Blob([bytes], {type: 'image/jpeg'}), fileName);
        if (p.variant === 1) {
          const failed = await request('ASSET_STAGE_FAILURE', 'stageOperationsCatalogAsset', {}, {cookie: store.cookie, brandRef: store.brandRef, form, testFailurePoint: 'asset-processing', expected: [422], allowRejected: true});
          assertThat(responseErrorCode(failed.json) === 'ASSET_PROCESSING_FAILED', 'ASSET_PROCESSING_FAILURE_CODE');
          return;
        }
        const staged = await request('ASSET_STAGE', 'stageOperationsCatalogAsset', {}, {cookie: store.cookie, brandRef: store.brandRef, form});
        const stagedResult = itemResult(staged.json);
        const assetRef = stagedResult?.assetRef; const bindGrant = stagedResult?.bindGrant; const assetVersion = versionValue(stagedResult?.version, 1);
        assertThat(assetRef, 'ASSET_STAGE_READBACK');
        assertThat(bindGrant, 'ASSET_STAGE_BIND_GRANT_READBACK');
        if (p.variant === 2) {
          const holderCode = `API-ASSET-HOLDER-${Date.now()}`;
          const holder = await createItem(store, 'ASSET_HOLDER_CREATE', holderCode);
          const holderVersion = versionValue(itemResult(holder.json)?.version, 1);
          await saveItem(store, 'ASSET_HOLDER_SAVE', holderCode, holderVersion, {name: holderCode, images: [assetRef]}, {nodes: []}, [], {[assetRef]: bindGrant});
          await expectedProblem('ASSET_REFERENCE_PROTECTED', 'releaseOperationsCatalogStagedAsset', {assetRef}, {cookie: store.cookie, brandRef: store.brandRef, body: {dataNodeRef: store.dataNodeRef, assetRef, expectedVersion: assetVersion}, idempotencyKey: `api-asset-release-${runId}`}, 'ASSET_REFERENCE_PROTECTED', [409]);
        }
        return;
      }
      if (entry.caseId === 'CI-API-010-01') {
        const materialTargetRef = primaryTargetRefFor('SEED-MATERIALS');
        assertThat(Array.isArray(inventoryPage.items) && inventoryPage.counts && inventoryPage.items.some((row) => row.targetRef === materialTargetRef && row.productCode === apiCode('BEAN-001')), 'INVENTORY_MATERIAL_TARGET_FACT');
        assertThat(inventoryPage.items.every((row) => row.stockState && row.balance !== undefined && row.changeToday !== undefined && row.change7d !== undefined && row.change30d !== undefined), 'INVENTORY_LIST_FACTS');
        return;
      }
      if (entry.caseId.startsWith('CI-API-011-')) {
        const detailFixture = p.detailZone === 'advancedDiagnostics' || p.detailZone === 'changeSummary' || p.detailZone === 'consumptionReferences' ? 'FIXTURE-ADVANCED-DIAGNOSTICS' : 'SEED-MATERIALS';
        const detailTargetRef = primaryTargetRefFor(detailFixture);
        assertThat(detailTargetRef, 'INVENTORY_TARGET_REQUIRED');
        const opByZone = {current: 'getOperationsInventoryTarget', changeSummary: 'getOperationsInventoryTargetChangeSummary', businessHistory: 'getOperationsInventoryTargetBusinessHistory', consumptionReferences: 'getOperationsInventoryTargetConsumptionReferences', ledger: 'getOperationsInventoryTargetLedger', advancedDiagnostics: 'getOperationsInventoryTargetDiagnostics'};
        const operationId = opByZone[p.detailZone];
        const result = await request(`INVENTORY_${p.detailZone}`, operationId, {targetRef: detailTargetRef}, {cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef, ...(p.detailZone === 'changeSummary' ? {period: p.period || '30D'} : {})}, expected: [200]});
        const data = envelopeData(result.json); const valid = p.detailZone === 'changeSummary' ? ['period', 'increase', 'decrease', 'netChange', 'entryCount'].every((field) => data?.[field] !== undefined) : (data?.target || data?.entries || data?.permission || data?.changeSummary); assertThat(data !== null && Boolean(valid), `INVENTORY_ZONE_${p.detailZone}`);
        return;
      }
      if (entry.caseId.startsWith('CI-API-012-')) {
        const commandFixture = p.command === 'configuration' ? 'FIXTURE-CONFIG-ONLY' : 'FIXTURE-COUNT-INCREASE-ADJUST';
        const commandTargetRef = primaryTargetRefFor(commandFixture);
        assertThat(commandTargetRef, 'INVENTORY_WRITE_TARGET');
        const freshTarget = envelopeData((await request('TARGET_DETAIL_REFRESH', 'getOperationsInventoryTarget', {targetRef: commandTargetRef}, {cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef}})).json);
        assertThat(freshTarget?.version !== undefined, 'INVENTORY_WRITE_TARGET_VERSION');
        const version = Number(freshTarget.version); const unit = freshTarget.configuration?.countingUnit || freshTarget.target?.consumptionUnit || 'EACH';
        if (p.command === 'count') {
          const response = await request('INVENTORY_COUNT', 'countOperationsInventoryTarget', {targetRef: commandTargetRef}, {cookie: store.cookie, brandRef: store.brandRef, body: {dataNodeRef: store.dataNodeRef, targetRef: commandTargetRef, expectedVersion: version, countedQuantity: String(freshTarget.balance ?? '0'), unit, zeroConfirmation: true}});
          const result = itemResult(response.json); assertThat(result?.targetRef === commandTargetRef && result?.before !== undefined && result?.change !== undefined && result?.after !== undefined && result?.ledgerEntryRef, 'COUNT_READBACK');
        } else if (p.command === 'increase') {
          const response = await request('INVENTORY_INCREASE', 'increaseOperationsInventoryTarget', {targetRef: commandTargetRef}, {cookie: store.cookie, brandRef: store.brandRef, body: {dataNodeRef: store.dataNodeRef, targetRef: commandTargetRef, expectedVersion: version, quantity: '1', unit}});
          const result = itemResult(response.json); assertThat(result?.targetRef === commandTargetRef && result?.before !== undefined && result?.change !== undefined && result?.after !== undefined && result?.ledgerEntryRef, 'INCREASE_READBACK');
        } else if (p.command === 'adjust') {
          const response = await request('INVENTORY_ADJUST', 'adjustOperationsInventoryTarget', {targetRef: commandTargetRef}, {cookie: store.cookie, brandRef: store.brandRef, body: {dataNodeRef: store.dataNodeRef, targetRef: commandTargetRef, expectedVersion: version, direction: 'INCREASE', quantity: '1', unit, reasonCode: 'RECOUNT'}});
          const result = itemResult(response.json); assertThat(result?.targetRef === commandTargetRef && result?.before !== undefined && result?.change !== undefined && result?.after !== undefined && result?.ledgerEntryRef, 'ADJUST_READBACK');
        } else {
          const response = await request('INVENTORY_CONFIG', 'updateOperationsInventoryTargetConfiguration', {targetRef: commandTargetRef}, {cookie: store.cookie, brandRef: store.brandRef, body: {dataNodeRef: store.dataNodeRef, targetRef: commandTargetRef, expectedVersion: version, configuration: {allowNegative: Boolean(freshTarget.configuration?.allowNegative), lowStockThreshold: String(freshTarget.configuration?.lowStockThreshold ?? '0'), countingUnit: unit, conversionFactor: String(freshTarget.configuration?.conversionFactor ?? '1')}}});
          const result = envelopeData(response.json); assertThat(result?.version !== undefined && result?.configuration && String(result.balance) === String(freshTarget.balance), 'CONFIG_READBACK');
        }
        return;
      }
      if (entry.caseId.startsWith('CI-API-013-')) {
        const fixture = await ensureHasSkuFixture();
        const skuItem = p.variant === 2 ? fixture.disabledCode : fixture.archivedCode;
        const detail = envelopeData((await getDetail(store, 'HAS_SKU_DETAIL', skuItem)).json);
        const skus = detail.item?.skus || [];
        const hasSku = skus.some((sku) => sku.status !== 'ARCHIVED');
        if (p.variant === 2) assertThat(hasSku === true && skus.some((sku) => sku.status === 'DISABLED'), 'DISABLED_SKU_FACT');
        else if (p.variant === 1 || p.variant === 3) assertThat(hasSku === false && skus.every((sku) => sku.status === 'ARCHIVED'), 'ARCHIVED_SKU_FACT');
        return;
      }
      if (entry.caseId.startsWith('CI-API-014-')) {
        if (p.variant === 1 || p.variant === 3 || p.variant === 5) {
          const service = shape.shapeRules.find((rule) => rule.shapeKey === 'SERVICE'); const benefit = shape.shapeRules.find((rule) => rule.shapeKey === 'BENEFIT_SHELL');
          assertThat(service?.createAllowed === true && shape.typeEffects?.modeEligibilityByShape?.SERVICE?.CATALOG_ITEM?.join(',') === 'NONE', 'SERVICE_MODE_ADMISSION');
          assertThat(benefit?.visibleButDisabled === true, 'BENEFIT_MODE_ADMISSION');
        } else assertThat(shape.modeRules.some((rule) => rule.nodeType === 'CATALOG_ITEM' && rule.allowedModes.includes('INDEPENDENT_STOCK')), 'NO_SKU_MODE_ADMISSION');
        return;
      }
      if (entry.caseId.startsWith('CI-API-015-')) {
        const fixture = await ensureDagFixture();
        if (p.variant === 2) {
          const target = await getDetailAllowMissing(store, 'DAG_TARGET_LOOKUP', fixture.targetConflictCode);
          if (target.status === 404) await createItem(store, 'DAG_TARGET_CONFLICT_CREATE', fixture.targetConflictCode, 'MATERIAL');
        }
        const preflight = await request('DAG_PREFLIGHT', 'preflightOperationsBrandCatalogCopy', {}, {cookie: store.cookie, brandRef: store.brandRef, idempotencyKey: `catalog-api-dag-preflight-${runId}-${p.variant}`, body: {dataNodeRef: store.dataNodeRef, selectedItemCodes: [fixture.rootCode], targetDataNodeRef: store.dataNodeRef}});
        const data = envelopeData(preflight.json);
        const closureCodes = (data.closureItems || []).map((item) => item.code);
        if (p.variant === 1) {
          assertThat(new Set(closureCodes).size === 3 && [fixture.rootCode, fixture.middleCode, fixture.leafCode].every((code) => closureCodes.includes(code)) && !closureCodes.includes(fixture.inboundOnlyCode), 'DAG_VISITED_FIXED_POINT');
          const publicItemMappings = (data.referenceMappings || []).filter((mapping) => mapping?.objectType === 'CATALOG_ITEM');
          assertThat(publicItemMappings.length >= 3
            && publicItemMappings.every((mapping) => typeof mapping.sourceRef === 'string' && mapping.sourceRef.length > 0
              && typeof mapping.targetRef === 'string' && mapping.targetRef.length > 0
              && typeof mapping.targetCode === 'string'
              && [fixture.rootCode, fixture.middleCode, fixture.leafCode].includes(mapping.targetCode)), 'DAG_REFERENCE_MAPPINGS_READBACK');
        } else {
          await expectedProblem('DAG_STRUCTURAL_BLOCK', 'executeOperationsBrandCatalogCopy', {}, {cookie: store.cookie, brandRef: store.brandRef, body: {
            dataNodeRef: store.dataNodeRef, selectedItemCodes: [fixture.rootCode], targetDataNodeRef: store.dataNodeRef, preflightDigest: data.preflightDigest,
            expectedSourceVersion: catalogObjectVersion(data, fixture.rootCode, 'sourceVersion'),
            expectedTargetVersion: catalogObjectVersion(data, fixture.rootCode, 'targetVersion', 0),
          }}, 'STRUCTURE_INCOMPATIBLE', [422]);
        }
        return;
      }
      if (entry.caseId.startsWith('CI-API-016-') || entry.caseId.startsWith('CI-API-017-')) {
        const limit = entry.caseId.startsWith('CI-API-016-') ? copyPolicy.limits.selectedItemCount : copyPolicy.limits.closureItemCount;
        assertThat(Number.isInteger(limit) && limit > 0, 'COPY_LIMIT_POLICY');
        if (p.variant === 2) {
          const selected = entry.caseId.startsWith('CI-API-016-')
            ? (await ensureSelectedOverflowFixture(limit)).selectedCodes.slice(0, limit + 1)
            : [(await addClosureOverflowComponent(await ensureClosureOverflowFixture(limit))).rootCode];
          await expectedProblem('COPY_LIMIT_OVERFLOW', 'preflightOperationsBrandCatalogCopy', {}, {cookie: store.cookie, brandRef: store.brandRef, idempotencyKey: `catalog-api-copy-limit-${runId}-${entry.caseId}`, body: {dataNodeRef: store.dataNodeRef, selectedItemCodes: selected, targetDataNodeRef: store.dataNodeRef}}, entry.caseId.startsWith('CI-API-016-') ? 'COPY_SELECTED_ITEMS_TOO_LARGE' : 'COPY_CLOSURE_TOO_LARGE', [422]);
        } else {
          const selected = entry.caseId.startsWith('CI-API-016-')
            ? (await ensureSelectedOverflowFixture(limit)).selectedCodes.slice(0, limit)
            : [(await ensureClosureOverflowFixture(limit)).rootCode];
          const preflight = await request('COPY_LIMIT_BOUNDARY', 'preflightOperationsBrandCatalogCopy', {}, {cookie: store.cookie, brandRef: store.brandRef, idempotencyKey: `catalog-api-copy-limit-${runId}-${entry.caseId}`, body: {dataNodeRef: store.dataNodeRef, selectedItemCodes: selected, targetDataNodeRef: store.dataNodeRef}}); const data = envelopeData(preflight.json); assertThat(Number(data.selectedLimit) === copyPolicy.limits.selectedItemCount && Number(data.closureLimit) === copyPolicy.limits.closureItemCount, 'COPY_LIMIT_READBACK');
        }
        return;
      }
      if (entry.caseId.startsWith('CI-API-018-')) {
        const fixture = await ensureCompatibilityFixture();
        const code = p.outcome === 'STRUCTURAL_BLOCK'
          ? ({10: fixture.shapeCode, 11: fixture.skuCode, 12: fixture.unitCode, 13: fixture.shapeCode, 14: fixture.referenceCode, 15: fixture.unitCode}[p.matrixRow] || fixture.shapeCode)
          : fixture.reuseCode;
        const expectedCode = ({10: 'STRUCTURE_INCOMPATIBLE', 11: 'STRUCTURE_INCOMPATIBLE', 12: 'CONSUMPTION_UNIT_INCOMPATIBLE', 13: 'STRUCTURE_INCOMPATIBLE', 14: 'STRUCTURE_INCOMPATIBLE', 15: 'CONSUMPTION_UNIT_INCOMPATIBLE'})[p.matrixRow] || 'STRUCTURE_INCOMPATIBLE';
        const body = {
          dataNodeRef: store.dataNodeRef,
          selectedItemCodes: [code],
          targetDataNodeRef: store.dataNodeRef,
        };
        const preflight = await request('COMPATIBILITY_PREFLIGHT', 'preflightOperationsBrandCatalogCopy', {}, {cookie: store.cookie, brandRef: store.brandRef, idempotencyKey: `catalog-api-compat-preflight-${runId}-${p.matrixRow}`, body});
        const data = envelopeData(preflight.json);
        assertThat(Array.isArray(data.compatibilityResults) && data.compatibilityResults.length >= 1, 'COMPATIBILITY_MATRIX_READBACK');
        // The frozen compatibility item deliberately has no code field; the
        // read model identifies each row by objectType and the closure graph
        // carries the code.  These fixtures each select one item without
        // dependent closure rows, so select the owner row by its exact type
        // rather than inventing an uncontracted code field.
        const result = Number(p.matrixRow) === 14
          ? data.compatibilityResults?.find((value) => value.objectType === 'PRODUCTION_TAG')
          : [12, 15].includes(Number(p.matrixRow))
          ? data.compatibilityResults?.find((value) => value.objectType === 'STOCK_TARGET')
          : data.compatibilityResults?.find((value) => value.objectType === 'CATALOG_ITEM');
        assertThat(result, `COMPATIBILITY_RESULT_ROW_${p.matrixRow}`);
        if (p.outcome === 'STRUCTURAL_BLOCK') {
          assertThat(data.blockingCount > 0 && result?.result === 'BLOCKED', `COMPATIBILITY_BLOCK_ROW_${p.matrixRow}`);
          await expectedProblem(`COMPATIBILITY_BLOCK_EXECUTE_${p.matrixRow}`, 'executeOperationsBrandCatalogCopy', {}, {cookie: store.cookie, brandRef: store.brandRef, body: {
            ...body,
            preflightDigest: data.preflightDigest,
            expectedSourceVersion: catalogObjectVersion(data, code, 'sourceVersion'),
            expectedTargetVersion: catalogObjectVersion(data, code, 'targetVersion', 0),
          }}, expectedCode, [422]);
        } else {
          assertThat(data.blockingCount === 0 && ['REUSE', 'REUSE_OR_CREATE', 'CREATE'].includes(result?.result), `COMPATIBILITY_REUSE_ROW_${p.matrixRow}`);
        }
        return;
      }
      if (entry.caseId.startsWith('CI-API-019-')) {
        const fixture = await ensureCompatibilityFixture();
        const preflight = await request('UNIT_CONFLICT_PREFLIGHT', 'preflightOperationsBrandCatalogCopy', {}, {cookie: store.cookie, brandRef: store.brandRef, idempotencyKey: `catalog-api-unit-preflight-${runId}-${p.variant}`, body: {dataNodeRef: store.dataNodeRef, selectedItemCodes: [fixture.unitCode], targetDataNodeRef: store.dataNodeRef}});
        const data = envelopeData(preflight.json);
        assertThat(data.blockingCount > 0, `UNIT_CONFLICT_PREFLIGHT_${p.variant}`);
        const result = data.compatibilityResults?.find((value) => value.objectType === 'STOCK_TARGET');
        assertThat(result, `UNIT_CONFLICT_RESULT_ROW_${p.variant}`);
        assertThat(result?.result === 'BLOCKED', `UNIT_CONFLICT_RESULT_${p.variant}`);
        assertThat(String(result?.reason || '').includes('消耗单位'), `UNIT_CONFLICT_REASON_${p.variant}`);
        await expectedProblem(`UNIT_CONFLICT_EXECUTE_${p.variant}`, 'executeOperationsBrandCatalogCopy', {}, {cookie: store.cookie, brandRef: store.brandRef, body: {dataNodeRef: store.dataNodeRef, selectedItemCodes: [fixture.unitCode], targetDataNodeRef: store.dataNodeRef, preflightDigest: data.preflightDigest, expectedSourceVersion: catalogObjectVersion(data, fixture.unitCode, 'sourceVersion'), expectedTargetVersion: catalogObjectVersion(data, fixture.unitCode, 'targetVersion', 0)}}, 'CONSUMPTION_UNIT_INCOMPATIBLE', [422]);
        return;
      }
      if (entry.caseId === 'CI-API-020-01') {
        const fixture = await ensureLocalCopyMappingFixture();
        const preflight = await request('LOCAL_COPY_MAPPING_PREFLIGHT', 'preflightOperationsLocalCatalogCopy', {}, {cookie: store.cookie, brandRef: store.brandRef, body: {dataNodeRef: store.dataNodeRef, sourceItemCode: fixture.sourceCode, targetItemCode: fixture.targetCode, selectedSections: ['BASIC_INFO']}});
        const data = envelopeData(preflight.json);
        const executed = await request('LOCAL_COPY_NORMAL_EXECUTE', 'executeOperationsLocalCatalogCopy', {}, {cookie: store.cookie, brandRef: store.brandRef, body: {dataNodeRef: store.dataNodeRef, sourceItemCode: fixture.sourceCode, targetItemCode: fixture.targetCode, selectedSections: ['BASIC_INFO'], preflightDigest: data.preflightDigest, expectedSourceVersion: catalogObjectVersion(data, fixture.sourceCode, 'sourceVersion'), expectedTargetVersion: catalogObjectVersion(data, fixture.sourceCode, 'targetVersion')}});
        assertThat(envelopeData(executed.json).ownerReadbacks?.some((readback) => readback.owner === 'catalog' && readback.status === 'COMMITTED'), 'LOCAL_COPY_OWNER_COMMITTED');
        return;
      }
      if (entry.caseId === 'CI-API-020-02') {
        const preflight = await request('BRAND_COPY_PREFLIGHT', 'preflightOperationsBrandCatalogCopy', {}, {cookie: store.cookie, brandRef: store.brandRef, body: {dataNodeRef: store.dataNodeRef, selectedItemCodes: [sampleHeadCode], targetDataNodeRef: store.dataNodeRef}});
        const data = envelopeData(preflight.json);
        const mappings = data.referenceMappings;
        assertThat(Array.isArray(mappings) && mappings.length > 0, 'REFERENCE_MAPPINGS_READBACK');
        assertThat(mappings.every((mapping) => mapping && typeof mapping.objectType === 'string' && mapping.objectType.length > 0
          && typeof mapping.sourceRef === 'string' && mapping.sourceRef.length > 0
          && typeof mapping.targetRef === 'string' && mapping.targetRef.length > 0
          && mapping.sourceRef !== mapping.targetRef), 'REFERENCE_MAPPING_ROWS_COMPLETE');
        return;
      }
      if (entry.caseId.startsWith('CI-API-021-')) {
        const fixture = await ensureStaleFixture();
        const preflight = await request('STALE_PREFLIGHT', 'preflightOperationsBrandCatalogCopy', {}, {cookie: store.cookie, brandRef: store.brandRef, idempotencyKey: `catalog-api-stale-preflight-${runId}-${p.variant}`, body: {dataNodeRef: store.dataNodeRef, selectedItemCodes: [fixture.code], targetDataNodeRef: store.dataNodeRef}});
        const data = envelopeData(preflight.json);
        const row = data.objectVersions?.find((v) => v.objectType === 'CATALOG_ITEM' && v.code === fixture.code);
        assertThat(row?.code === fixture.code, 'STALE_PREFLIGHT_EXACT_OBJECT_VERSION');
        const expectedSource = versionValue(row?.sourceVersion, 1);
        const expectedTarget = versionValue(row?.targetVersion, 0);
        if (p.variant === 1) await mutateItem(head, 'STALE_SOURCE_MUTATE', fixture.code, `source:${runId}`);
        else await mutateItem(store, 'STALE_TARGET_MUTATE', fixture.code, `target:${runId}`);
        await expectedProblem('STALE_EXECUTE', 'executeOperationsBrandCatalogCopy', {}, {cookie: store.cookie, brandRef: store.brandRef, body: {dataNodeRef: store.dataNodeRef, selectedItemCodes: [fixture.code], targetDataNodeRef: store.dataNodeRef, preflightDigest: data.preflightDigest, expectedSourceVersion: expectedSource, expectedTargetVersion: expectedTarget}}, 'STALE_COPY_PREFLIGHT', [409]); return;
      }
      if (entry.caseId === 'CI-API-022-01') {
        const code = `API-REPLAY-${Date.now()}`; const key = `api-replay-${runId}`; const body = {dataNodeRef: store.dataNodeRef, name: code, code, shapeKey: 'STANDARD_SALE_COUNTED', attributes: {fixtureRef: entry.fixtureRef}}; const first = await request('REPLAY_A', 'createOperationsCatalogItem', {}, {cookie: store.cookie, brandRef: store.brandRef, expected: [200], idempotencyKey: key, requestId: key, body}); const second = await request('REPLAY_B', 'createOperationsCatalogItem', {}, {cookie: store.cookie, brandRef: store.brandRef, expected: [200], idempotencyKey: key, requestId: key, body}); assertThat(JSON.stringify(canonicalJson(first.json)) === JSON.stringify(canonicalJson(second.json)), 'REPLAY_SAME_RESULT'); return;
      }
      if (entry.caseId === 'CI-API-022-02') {
        const fixture = await ensureOwnerFailureFixture();
        const preflight = await request('OWNER_FAILURE_PREFLIGHT', 'preflightOperationsBrandCatalogCopy', {}, {cookie: store.cookie, brandRef: store.brandRef, body: {dataNodeRef: store.dataNodeRef, selectedItemCodes: [fixture.sourceCode], targetDataNodeRef: store.dataNodeRef}});
        const data = envelopeData(preflight.json);
        await expectedProblem('OWNER_FAILURE', 'executeOperationsBrandCatalogCopy', {}, {cookie: store.cookie, brandRef: store.brandRef, testFailurePoint: 'owner-failure', body: {dataNodeRef: store.dataNodeRef, selectedItemCodes: [fixture.sourceCode], targetDataNodeRef: store.dataNodeRef, preflightDigest: data.preflightDigest, expectedSourceVersion: catalogObjectVersion(data, fixture.sourceCode, 'sourceVersion'), expectedTargetVersion: catalogObjectVersion(data, fixture.sourceCode, 'targetVersion', 0)}}, 'RESULT_UNKNOWN', [500]);
        return;
      }
      if (entry.caseId === 'CI-API-023-01') {
        const headless = (groupProbe.session?.dataNodeCandidates || []).find((candidate) => candidate.dataNodeType === 'STORE' && !candidate.headCompanyRef);
        assertThat(headless?.dataNodeRef, 'MISSING_HEAD_COMPANY_SCOPE_NOT_VISIBLE');
        const originalRef = store.dataNodeRef;
        try {
          await selectScope(groupProbe, 'STORE', headless.dataNodeRef);
          const context = groupProbe.context;
          assertThat(context.headCompanyRef === null && context.copySourceAvailable === false && context.actionAvailability?.canCopy === false, 'COPY_SOURCE_MUST_BE_UNAVAILABLE');
        } finally { await selectScope(groupProbe, 'STORE', originalRef); }
        return;
      }
      if (entry.caseId.startsWith('CI-API-024-')) {
        if (p.variant === 2 || p.variant === 4) {
          await expectedProblem('OWNER_SCOPE_VIOLATION', 'getOperationsBrandCatalogCopyCandidates', {}, {cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: head.dataNodeRef}}, 'SCOPE_FORBIDDEN', [403]);
        } else {
          const candidates = envelopeData((await request('COPY_CANDIDATES', 'getOperationsBrandCatalogCopyCandidates', {}, {cookie: store.cookie, brandRef: store.brandRef, queryParameters: {dataNodeRef: store.dataNodeRef}})).json);
          assertThat(candidates.copySourceAvailable === true, 'COPY_SOURCE_AVAILABLE');
          assertThat(candidates.sourceScope?.ownerType === 'HEAD_COMPANY' && candidates.sourceScope?.ownerRef === head.dataNodeRef && candidates.sourceScope?.brandRef === brandRef, 'OWNER_SCOPE_SOURCE_FACT');
          assertThat(candidates.targetScope?.ownerType === 'DATA_NODE' && candidates.targetScope?.ownerRef === store.dataNodeRef, 'OWNER_SCOPE_TARGET_FACT');
        }
        return;
      }
      if (entry.caseId.startsWith('CI-API-025-')) {
        if (p.variant === 3) {
          // The operation-level contract binds this case to the production-tag
          // transition command.  A real project-scoped principal is selected
          // against the fixture project, then the catalog edge must reject
          // the project data-node because this owner has no project execution
          // surface (typed SCOPE_FORBIDDEN, never a query/body workaround).
          const fixture = await ensureProductionTagFixture();
          await expectedProblem('PROJECT_TAG_SCOPE', 'transitionOperationsProductionTagStatus', {tagCode: fixture.code}, {
            cookie: project.cookie,
            brandRef: project.brandRef,
            body: {dataNodeRef: project.dataNodeRef, tagCode: fixture.code, expectedVersion: fixture.version, targetStatus: 'DISABLED'},
          }, 'SCOPE_FORBIDDEN', [403]);
        } else {
          await ensureProductionTagFixture();
          const client = p.variant === 1 ? head : store;
          const tags = envelopeData((await request('PRODUCTION_TAGS', 'getOperationsProductionTags', {}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef}})).json);
          const entries = tags.items || tags.entries;
          assertThat(Array.isArray(entries), 'PRODUCTION_TAG_SCOPE');
          for (const entry of entries) assertThat(entry.ownerRef === client.dataNodeRef && entry.brandRef === brandRef, 'PRODUCTION_TAG_OWNER_FACT');
        }
        return;
      }
      if (entry.caseId.startsWith('CI-API-026-')) {
        const fixture = fixtures.seedDatasets.find((value) => value.fixtureId === p.seedFixture);
        assertThat(fixture && fixture.class === 'SEED' && fixture.readbackSelectors.includes('entities'), 'API_FIXTURE_DECLARATION');
        const readback = await readApiFixture(p.seedFixture);
        assertThat(readback.expectedCount === (fixture.entities?.catalogItems || []).length && readback.details.length === readback.expectedCount, `API_${p.seedFixture}_READBACK`);
        return;
      }
      fail(`UNMAPPED_API_CASE:${entry.caseId}`);
      });
    }
  } else {
    log('API_CASE_LOOP_SKIPPED', 'SKIP', {reason: caseLoopSkipReason({performanceCanonicalMode, sharedFixtureBarrier})});
  }

  const passCount = caseResults.filter((result) => result.status === 'PASS').length;
  const failCount = caseResults.length - passCount;
  const catalogOperationIds = new Set(readJson(registryCatalogPath).operations.map((operation) => operation.operationId));
  const catalogRouteCoverageCount = catalogRouteCoverageOperationIds(catalogOperationIds).size;
  const businessPass = sharedFixtureBarrier.status === 'PASS'
    && (performanceCanonicalMode
      ? backendPerformanceCanonical.status === 'PASS' && backendPerformanceCanonical.operationIds.length === catalogRouteCoverageCount
      : backendAcceptanceMode
        ? backendAcceptanceRouteCoverage.status === 'PASS' && backendAcceptanceRouteCoverage.operationIds.length === catalogRouteCoverageCount
          && failCount === 0 && caseResults.length === scenarioCatalog.caseCount
        : failCount === 0 && caseResults.length === scenarioCatalog.caseCount);
  const report = {
    schemaVersion: 1,
    kind: 'catalog-inventory-api-runtime-report',
    status: businessPass ? 'PASS' : 'FAIL',
    runtimeAuthority: true,
    httpOnly: true,
    managedRunId: manifest.runId,
    apiRunId: runId,
    startedAt: executionStartedAt,
    finishedAt: new Date().toISOString(),
    imageBindEvidenceInputs,
    sourceBindings: {scenarioCatalog: {path: path.relative(root, scenarioPath), sha256: sha256(fs.readFileSync(scenarioPath))}, fixtureCatalog: {path: path.relative(root, fixturePath), sha256: sha256(fs.readFileSync(fixturePath))}, copyPolicy: {path: path.relative(root, copyPolicyPath), sha256: sha256(fs.readFileSync(copyPolicyPath))}, generatedShape: {path: path.relative(root, shapePath), sha256: sha256(fs.readFileSync(shapePath))}},
    denominator: {scenarioCount: scenarioCatalog.scenarioCount, caseCount: scenarioCatalog.caseCount, caseResults: caseResults.length, passed: passCount, failed: failCount, backendPerformanceCanonicalOperations: backendPerformanceCanonical.operationIds.length, backendAcceptanceRouteCoverageOperations: backendAcceptanceRouteCoverage.operationIds.length},
    caseResults,
    calls,
    events,
    createdCodes,
    fixtureBindings,
    fixtureSetup: 'OWNER_HTTP_ONLY',
    sharedFixtureBarrier,
    backendPerformanceCanonical,
    backendAcceptanceRouteCoverage,
    seedDependency: 'NONE',
    firstFailure,
    businessStatus: businessPass ? 'PASS' : 'FAIL',
    cleanupStatus: 'OWNED_BY_MANAGED_JOINT_RUNNER',
    noDirectDatabaseWrites: true,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, {mode: 0o600});
  process.stdout.write(`CATALOG_INVENTORY_API=${report.status}; CASES=${caseResults.length}; PASS=${passCount}; FAIL=${failCount}; REPORT=${reportPath}; CLEANUP=${report.cleanupStatus}\n`);
  if (report.status !== 'PASS') process.exitCode = 2;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) execute().catch((error) => {
  const runtimeDirectory = process.env.V2S_RUNTIME_DIR;
  if (typeof runtimeDirectory === 'string' && runtimeDirectory.trim() !== '') {
    const outputDir = path.join(runtimeDirectory, 'results', 'catalog-inventory-api');
    fs.mkdirSync(outputDir, {recursive: true, mode: 0o700});
    const firstFailure = `CATALOG_INVENTORY_CHILD_REFUSED:${catalogRuntimeFailureCode(error)}`;
    fs.writeFileSync(path.join(outputDir, 'catalog-inventory-api-runtime-report.json'), `${JSON.stringify({
      schemaVersion: 1,
      kind: 'catalog-inventory-api-runtime-report',
      status: 'FAIL',
      businessStatus: 'FAIL',
      firstFailure,
      cleanupStatus: 'OWNED_BY_MANAGED_JOINT_RUNNER',
      failureKind: 'UNCAUGHT_CHILD_FAILURE',
    }, null, 2)}\n`, {mode: 0o600});
  }
  process.stderr.write(`CATALOG_INVENTORY_API=REFUSED; REASON=${error.code || compact(error.message)}\n`);
  process.exitCode = 2;
});
