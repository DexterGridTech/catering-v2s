#!/usr/bin/env node
/**
 * Package-owned HTTP workload for the remote 196-row technical lane.
 *
 * The application remains the only producer of final request/database evidence.  This file
 * prepares owner facts through the existing HTTP recipes, pauses for the Java owner-fixture
 * bridge where the current external-order ingress is intentionally not public, then runs the
 * catalog route shard and the terminal general-owner shard.  It never writes request events.
 */
import {randomUUID} from 'node:crypto';
import {chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {loadAuthoritativeContract} from './backend-performance-testcontainers-196.mjs';
import {loadGeneratedOperationRegistry} from './seed-report.mjs';
import {executeOperationsOrganization, requireOperationsStoreDataNode} from './rm1-http-diagnostic.mjs';
import {executeOperationsRecoveryWorkload, executePerformanceDenominatorCompletionWorkload, executePlatformAccountFinalization, executePlatformFinalization, executeRemainingDenominatorWorkload} from './http-diagnostic-workload.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const registryPath = path.join(root, 'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json');
const catalogRegistryPath = path.join(root, 'apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json');
const finalHmac = /^[A-Za-z0-9_-]{43}$/;
export const WORKLOAD_CLEANUP_STATUS = 'NOT_OWNED_BY_WORKLOAD';
export const WORKLOAD_CLEANUP_OWNER = 'TESTCONTAINERS_AND_MANAGED_RUNNER';
const required = (value, code) => {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(code);
  return value;
};
const SAFE_ERROR_CODE = /^(?:[A-Z][A-Z0-9_]*|ENOENT)(?::[A-Za-z0-9_-]+)*$/;
export const safeCode = (value) => {
  const candidate = value && typeof value === 'object' ? value.code ?? value.message : value;
  return typeof candidate === 'string' && SAFE_ERROR_CODE.test(candidate) ? candidate : 'BP_U06_REMOTE_WORKLOAD_UNCLASSIFIED_FAILURE';
};
export const validateCatalogChildReport = (report) => {
  if (!report || report.kind !== 'catalog-inventory-api-runtime-report' || !['PASS', 'FAIL'].includes(report.status) || !['PASS', 'FAIL'].includes(report.businessStatus)) throw new Error('BP_U06_REMOTE_WORKLOAD_CATALOG_REPORT_INVALID');
  if (report.status !== report.businessStatus || !Object.hasOwn(report, 'firstFailure')) throw new Error('BP_U06_REMOTE_WORKLOAD_CATALOG_REPORT_INVALID');
  if (report.status === 'PASS' && report.firstFailure !== null) throw new Error('BP_U06_REMOTE_WORKLOAD_CATALOG_REPORT_INVALID');
  if (report.status === 'FAIL' && safeCode(report.firstFailure) === 'BP_U06_REMOTE_WORKLOAD_UNCLASSIFIED_FAILURE') throw new Error('BP_U06_REMOTE_WORKLOAD_CATALOG_REPORT_FIRST_FAILURE_INVALID');
  return report;
};
const readCatalogChildReport = (reportPath) => {
  if (!existsSync(reportPath)) throw new Error('BP_U06_REMOTE_WORKLOAD_CATALOG_REPORT_MISSING');
  try { return validateCatalogChildReport(JSON.parse(readFileSync(reportPath, 'utf8'))); }
  catch (error) { if (error instanceof SyntaxError) throw new Error('BP_U06_REMOTE_WORKLOAD_CATALOG_REPORT_INVALID'); throw error; }
};
const env = (name) => required(process.env[name], `BP_U06_REMOTE_WORKLOAD_ENV_MISSING:${name}`);
const jsonWrite = (target, value, mode = 0o600) => {
  mkdirSync(path.dirname(target), {recursive: true, mode: 0o700});
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode});
  chmodSync(temporary, mode);
  renameSync(temporary, target);
};
const jsonl = (target) => {
  if (!existsSync(target)) throw new Error(`BP_U06_REMOTE_WORKLOAD_EVIDENCE_MISSING:${path.basename(target)}`);
  return readFileSync(target, 'utf8').split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); } catch { throw new Error(`BP_U06_REMOTE_WORKLOAD_EVIDENCE_INVALID:${path.basename(target)}:${index + 1}`); }
  });
};
const exact = (left, right) => left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function operationSets(contract) {
  const general = loadGeneratedOperationRegistry(registryPath);
  const catalog = JSON.parse(readFileSync(catalogRegistryPath, 'utf8')).operations;
  const catalogIds = new Set(catalog.map((row) => row.operationId));
  const generalIds = contract.rows.filter((row) => !catalogIds.has(row.operationId)).map((row) => row.operationId);
  if (general.length !== 154 || catalog.length !== 42 || generalIds.length !== 154 || new Set(generalIds).size !== 154) throw new Error('BP_U06_REMOTE_WORKLOAD_OPERATION_SET_INVALID');
  return {generalIds, catalogIds: [...catalogIds], allIds: [...generalIds, ...catalogIds]};
}

export function validateFinalCoverage(events, {runId, operationIds}) {
  if (!Array.isArray(events) || events.length !== operationIds.length) throw new Error('BP_U06_REMOTE_WORKLOAD_COMPLETION_DENOMINATOR_INVALID');
  const expected = new Set(operationIds);
  const seen = new Set();
  for (const event of events) {
    if (!event || event.runId !== runId || event.performanceArea !== 'U07_ROUTE' || !expected.has(event.operationId) || seen.has(event.operationId)) throw new Error(`BP_U06_REMOTE_WORKLOAD_COMPLETION_SET_INVALID:${event?.operationId ?? 'UNKNOWN'}`);
    if (event.outcome !== 'SUCCEEDED' || !Number.isSafeInteger(event.status) || event.status < 200 || event.status >= 400) throw new Error(`BP_U06_REMOTE_WORKLOAD_COMPLETION_NOT_SUCCESS:${event.operationId}`);
    if (typeof event.requestId !== 'string' || event.requestId === '' || typeof event.correlationId !== 'string' || event.correlationId === '') throw new Error(`BP_U06_REMOTE_WORKLOAD_COMPLETION_JOIN_INVALID:${event.operationId}`);
    if (!finalHmac.test(event.serverEvidenceHmac ?? '')) throw new Error(`BP_U06_REMOTE_WORKLOAD_COMPLETION_HMAC_INVALID:${event.operationId}`);
    seen.add(event.operationId);
  }
  if (!exact([...seen], operationIds)) throw new Error('BP_U06_REMOTE_WORKLOAD_COMPLETION_OPERATION_SET_INVALID');
  return {status: 'PASS', count: events.length, operationIds: [...seen].sort()};
}

function privateCredentials(runtime) {
  const credentialPath = path.join(runtime, 'credentials.env');
  const values = {
    V2S_HTTP_DIAGNOSTIC_SECRET: randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', ''),
    V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_LOGIN: env('V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_LOGIN'),
    V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_CREDENTIAL: env('V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_CREDENTIAL'),
    V2S_DEV_DATABASE_USERNAME: env('V2S_BPF_DB_USERNAME'),
    V2S_DEV_DATABASE_PASSWORD: env('V2S_BPF_DB_PASSWORD'),
    CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET: env('CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET'),
    CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET: env('CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET'),
    CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY: env('CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY'),
    CATERING_ASSET_OBJECT_STORAGE_SECRET_KEY: env('CATERING_ASSET_OBJECT_STORAGE_SECRET_KEY'),
  };
  writeFileSync(credentialPath, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', {mode: 0o600});
  chmodSync(credentialPath, 0o600);
  return {credentialPath, values};
}

function createManifest(runtime, credentials, runId, port) {
  const manifestPath = path.join(runtime, 'run-manifest.json');
  jsonWrite(manifestPath, {
    schemaVersion: 1,
    kind: 'rm1-http-diagnostic-local-runtime',
    runId,
    eventPath: env('V2S_BACKEND_PERFORMANCE_FINAL_EVENTS'),
    credentialPath: credentials.credentialPath,
    freshDatabase: true,
    executionPlane: 'REMOTE_JVM_AND_DOCKER',
    plan: {
      backendPort: port,
      tunnelPort: Number(env('V2S_BPF_DB_PORT')),
      database: env('V2S_BPF_DB_NAME'),
      namespace: env('V2S_DEV_NAMESPACE'),
    },
  });
  return manifestPath;
}

async function waitForOwnerFixture(requestPath, responsePath, expected) {
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    if (existsSync(responsePath)) {
      const response = JSON.parse(readFileSync(responsePath, 'utf8'));
      if (response.status !== 'PASS' || response.temporaryCode !== expected.temporaryCode || response.formalCode !== expected.formalCode) throw new Error('BP_U06_REMOTE_WORKLOAD_OWNER_FIXTURE_REJECTED');
      return response;
    }
    if (!existsSync(requestPath)) await wait(250);
    else await wait(250);
  }
  throw new Error('BP_U06_REMOTE_WORKLOAD_OWNER_FIXTURE_TIMEOUT');
}

function catalogManifest(runtime, credentials, baseManifest, port) {
  const catalogRuntime = path.join(runtime, 'catalog-runtime');
  mkdirSync(catalogRuntime, {recursive: true, mode: 0o700});
  const manifestPath = path.join(catalogRuntime, 'run-manifest.json');
  jsonWrite(manifestPath, {
    schemaVersion: 1,
    kind: 'backend-performance-testcontainers-catalog-runtime',
    runId: `bpf-catalog-${randomUUID()}`,
    credentialsFile: credentials.credentialPath,
    freshDatabase: true,
    executionPlane: 'REMOTE_JVM_AND_DOCKER',
    eventPath: baseManifest.eventPath,
    plan: {backendPort: port, tunnelPort: baseManifest.plan.tunnelPort, database: baseManifest.plan.database, namespace: baseManifest.plan.namespace},
  });
  return {catalogRuntime, manifestPath};
}

function catalogEnvironment(base, catalog, state, userTargets, workspaceKey, fixture) {
  const user = (type) => userTargets.find((value) => value.targetType === type);
  const baseCredential = state.requirePrivate('OPERATIONS_CREDENTIAL');
  const store = user('STORE');
  const head = user('HEAD_COMPANY');
  const project = user('PROJECT');
  if (!store || !head || !project) throw new Error('BP_U06_REMOTE_WORKLOAD_CATALOG_USER_FACT_MISSING');
  return {
    ...base,
    V2S_RUNTIME_DIR: catalog.catalogRuntime,
    CATALOG_INVENTORY_MANIFEST_PATH: catalog.manifestPath,
    CATALOG_INVENTORY_PERFORMANCE_CANONICAL: 'true',
    CATALOG_INVENTORY_EDGE_BASE_URL: `http://127.0.0.1:${env('V2S_BPF_WORKLOAD_PORT')}`,
    CATALOG_INVENTORY_GROUP_WORKSPACE_KEY: workspaceKey,
    CATALOG_INVENTORY_OPERATIONS_LOGIN: store.loginName,
    CATALOG_INVENTORY_OPERATIONS_PASSWORD: store.password,
    CATALOG_INVENTORY_STORE_LOGIN: store.loginName,
    CATALOG_INVENTORY_STORE_PASSWORD: store.password,
    CATALOG_INVENTORY_GROUP_LOGIN: baseCredential.loginName,
    CATALOG_INVENTORY_GROUP_PASSWORD: baseCredential.password,
    CATALOG_INVENTORY_HEAD_COMPANY_LOGIN: head.loginName,
    CATALOG_INVENTORY_HEAD_COMPANY_PASSWORD: head.password,
    CATALOG_INVENTORY_PROJECT_LOGIN: project.loginName,
    CATALOG_INVENTORY_PROJECT_PASSWORD: project.password,
    CATALOG_INVENTORY_BRAND_REF: String(state.requirePrivate('BRAND').id),
    CATALOG_INVENTORY_STORE_REF: String(state.requirePrivate('STORE').id),
    CATALOG_INVENTORY_HEAD_COMPANY_REF: String(state.requirePrivate('HEAD_COMPANY').id),
    CATALOG_INVENTORY_PROJECT_REF: String(state.requirePrivate('PROJECT').id),
    CATALOG_INVENTORY_PERFORMANCE_TEMPORARY_ITEM_CODE: fixture.temporaryCode,
    CATALOG_INVENTORY_PERFORMANCE_TEMPORARY_FORMAL_CODE: fixture.formalCode,
  };
}

function runChild(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({code, signal}));
  });
}

function catalogChildTerminalFailure(result) {
  if (result?.signal && /^[A-Z0-9_]+$/.test(result.signal)) return `BP_U06_REMOTE_WORKLOAD_CATALOG_CHILD_SIGNAL_${result.signal}`;
  if (Number.isInteger(result?.code)) return `BP_U06_REMOTE_WORKLOAD_CATALOG_CHILD_EXIT_${result.code}`;
  return 'BP_U06_REMOTE_WORKLOAD_CATALOG_CHILD_TERMINAL_STATE_UNKNOWN';
}

async function run() {
  const contract = loadAuthoritativeContract(root);
  const sets = operationSets(contract);
  const runtime = env('V2S_RUNTIME_DIR');
  const port = Number(env('V2S_BPF_WORKLOAD_PORT'));
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('BP_U06_REMOTE_WORKLOAD_PORT_INVALID');
  const runId = env('V2S_BACKEND_PERFORMANCE_FINAL_RUN_ID');
  const eventsPath = env('V2S_BACKEND_PERFORMANCE_FINAL_EVENTS');
  const requestPath = env('V2S_BPF_OWNER_FIXTURE_REQUEST');
  const responsePath = env('V2S_BPF_OWNER_FIXTURE_RESPONSE');
  const resultPath = env('V2S_BPF_WORKLOAD_RESULT');
  mkdirSync(runtime, {recursive: true, mode: 0o700});
  rmSync(requestPath, {force: true}); rmSync(responsePath, {force: true}); rmSync(resultPath, {force: true});
  const credentials = privateCredentials(runtime);
  const manifestPath = createManifest(runtime, credentials, `bpf-http-${randomUUID()}`, port);
  const baseEnvironment = {...process.env, V2S_BPF_WORKLOAD_PORT: String(port)};
  const workload = await executeOperationsOrganization(manifestPath, {
    uniqueSuffix: `bpf${randomUUID().replaceAll('-', '').slice(0, 9)}`,
    stopBeforeTerminal: true,
    preserveCatalogUsers: true,
    performanceCanonicalOperationIds: sets.generalIds,
  });
  const flow = workload.operationsFlow;
  const state = flow.state;
  const dataNodeRef = requireOperationsStoreDataNode(state).dataNodeRef;
  const brandRef = state.requirePrivate('BRAND').id;
  if (!dataNodeRef || !brandRef) throw new Error('BP_U06_REMOTE_WORKLOAD_OWNER_FIXTURE_FACT_MISSING');
  const temporaryCode = `BPF-TEMP-${Date.now()}`;
  const formalCode = `BPF-FORMAL-${Date.now()}`;
  jsonWrite(requestPath, {schemaVersion: 1, status: 'PENDING', groupWorkspaceKey: flow.workspaceKey, dataNodeRef: String(dataNodeRef), brandRef: String(brandRef), temporaryCode, formalCode});
  const fixture = await waitForOwnerFixture(requestPath, responsePath, {temporaryCode, formalCode});

  const catalog = catalogManifest(runtime, credentials, JSON.parse(readFileSync(manifestPath, 'utf8')), port);
  const catalogLogPath = path.join(catalog.catalogRuntime, 'catalog-inventory-api.log');
  const catalogReportPath = path.join(catalog.catalogRuntime, 'results', 'catalog-inventory-api', 'catalog-inventory-api-runtime-report.json');
  writeFileSync(catalogLogPath, '', {mode: 0o600});
  const catalogLogFd = openSync(catalogLogPath, 'a');
  let catalogResult;
  try {
    catalogResult = await runChild(process.execPath, [path.join(root, 'scripts/test/catalog-inventory-api.mjs')], {
      cwd: root,
      env: catalogEnvironment(baseEnvironment, catalog, state, workload.userTargets, flow.workspaceKey, fixture),
      stdio: ['ignore', catalogLogFd, catalogLogFd],
    });
  } finally {
    closeSync(catalogLogFd);
  }
  // A signal can prevent the child process' top-level catch from writing its
  // own report.  The supervising workload owns the child lifecycle, so it
  // records the terminal classification instead of hiding it as a missing file.
  if (!existsSync(catalogReportPath) && catalogResult?.code !== 0) {
    const firstFailure = catalogChildTerminalFailure(catalogResult);
    jsonWrite(catalogReportPath, {
      schemaVersion: 1,
      kind: 'catalog-inventory-api-runtime-report',
      status: 'FAIL',
      businessStatus: 'FAIL',
      firstFailure,
      cleanupStatus: WORKLOAD_CLEANUP_STATUS,
      failureKind: 'SUPERVISOR_OBSERVED_CHILD_TERMINATION',
    });
  }
  const catalogReport = readCatalogChildReport(catalogReportPath);
  if (catalogResult.code !== 0 || catalogReport.status !== 'PASS') throw new Error(`BP_U06_REMOTE_WORKLOAD_CATALOG_HTTP_FAILED:${safeCode(catalogReport.firstFailure ?? 'BP_U06_REMOTE_WORKLOAD_CATALOG_CHILD_EXIT_NONZERO')}`);
  if (!existsSync(catalogLogPath)) throw new Error('BP_U06_REMOTE_WORKLOAD_CATALOG_LOG_MISSING');

  // The catalog child owns only catalog/inventory operations.  Complete the remaining
  // source-bound platform, organization and five-assignment revoke families while the
  // owner-created workspace/session facts are still enabled.
  await executePerformanceDenominatorCompletionWorkload({
    operationsFlow: flow,
    userTargets: workload.userTargets,
    uniqueSuffix: `bpf${randomUUID().replaceAll('-', '').slice(0, 9)}`,
  });

  // This contains the operations STORE audit read.  It must observe the enabled store
  // returned by the organization owner, and the status transitions must run before this
  // workload logs out the operations session and enters the terminal OTP/password flow.
  // The option keeps both facts in one ordered owner-session boundary.
  await executeRemainingDenominatorWorkload({operationsFlow: flow, uniqueSuffix: `bpf${randomUUID().replaceAll('-', '').slice(0, 9)}`, statusTerminalBeforeOperationsLogout: true});
  await executeOperationsRecoveryWorkload({operationsFlow: flow, uniqueSuffix: `bpf${randomUUID().replaceAll('-', '').slice(0, 9)}`});
  await executePlatformAccountFinalization({operationsFlow: flow, uniqueSuffix: `bpf${randomUUID().replaceAll('-', '').slice(0, 9)}`});
  await executePlatformFinalization({operationsFlow: flow, uniqueSuffix: `bpf${randomUUID().replaceAll('-', '').slice(0, 9)}`});

  const events = jsonl(eventsPath).filter((event) => event.runId === runId && event.performanceArea === 'U07_ROUTE');
  const coverage = validateFinalCoverage(events, {runId, operationIds: sets.allIds});
  jsonWrite(resultPath, {
    schemaVersion: 1,
    kind: 'backend-performance-testcontainers-196-workload-result',
    runId,
    status: 'PASS',
    businessStatus: 'PASS',
    cleanupStatus: WORKLOAD_CLEANUP_STATUS,
    cleanupOwner: WORKLOAD_CLEANUP_OWNER,
    generalOperations: sets.generalIds.length,
    catalogOperations: sets.catalogIds.length,
    completedOperations: coverage.count,
    catalogLogPath: path.relative(runtime, catalogLogPath),
    firstFailure: null,
  });
  process.stdout.write(`BP_U06_REMOTE_WORKLOAD=PASS; OPERATIONS=${coverage.count}; GENERAL=${sets.generalIds.length}; CATALOG=${sets.catalogIds.length}\n`);
}

export function selfTest() {
  const contract = loadAuthoritativeContract(root);
  const sets = operationSets(contract);
  if (sets.generalIds.length !== 154 || sets.catalogIds.length !== 42 || sets.allIds.length !== 196) throw new Error('BP_U06_REMOTE_WORKLOAD_SELF_TEST_DENOMINATOR_INVALID');
  const sample = contract.rows.map((row, index) => ({runId: 'bpf-self-test-20260811', operationId: row.operationId, performanceArea: 'U07_ROUTE', outcome: 'SUCCEEDED', status: 200, requestId: `req-${index}`, correlationId: `corr-${index}`, serverEvidenceHmac: 'A'.repeat(43)}));
  validateFinalCoverage(sample, {runId: 'bpf-self-test-20260811', operationIds: contract.operationIds});
  const red = (mutate, reason) => {
    const candidate = structuredClone(sample); mutate(candidate);
    try { validateFinalCoverage(candidate, {runId: 'bpf-self-test-20260811', operationIds: contract.operationIds}); throw new Error(`BP_U06_REMOTE_WORKLOAD_SELF_TEST_RED_NOT_DETECTED:${reason}`); }
    catch (error) { if (error.message === `BP_U06_REMOTE_WORKLOAD_SELF_TEST_RED_NOT_DETECTED:${reason}` || !error.message.startsWith(reason)) throw error; }
  };
  red((candidate) => candidate.pop(), 'BP_U06_REMOTE_WORKLOAD_COMPLETION_DENOMINATOR_INVALID');
  red((candidate) => { candidate[0].operationId = 'unknown-operation'; }, 'BP_U06_REMOTE_WORKLOAD_COMPLETION_SET_INVALID');
  red((candidate) => { candidate[0].outcome = 'FAILED'; }, 'BP_U06_REMOTE_WORKLOAD_COMPLETION_NOT_SUCCESS');
  red((candidate) => { candidate[0].serverEvidenceHmac = 'invalid'; }, 'BP_U06_REMOTE_WORKLOAD_COMPLETION_HMAC_INVALID');
  process.stdout.write(`BP_U06_REMOTE_WORKLOAD_SELF_TEST=PASS\nOPERATIONS=196\nGENERAL=154\nCATALOG=42\nRED_MISSING_COMPLETION=PASS\nRED_UNKNOWN_OPERATION=PASS\nRED_FAILED_COMPLETION=PASS\nRED_INVALID_HMAC=PASS\nCLEANUP=${WORKLOAD_CLEANUP_STATUS}\nCLEANUP_OWNER=${WORKLOAD_CLEANUP_OWNER}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  if (process.argv[2] === '--self-test') {
    try { selfTest(); } catch (error) { process.stderr.write(`BP_U06_REMOTE_WORKLOAD_SELF_TEST=FAIL; REASON=${safeCode(error)}\n`); process.exitCode = 1; }
  } else {
    run().catch((error) => {
      const resultPath = process.env.V2S_BPF_WORKLOAD_RESULT;
      if (resultPath) jsonWrite(resultPath, {schemaVersion: 1, kind: 'backend-performance-testcontainers-196-workload-result', runId: process.env.V2S_BACKEND_PERFORMANCE_FINAL_RUN_ID || 'UNKNOWN', status: 'FAIL', businessStatus: 'FAIL', cleanupStatus: WORKLOAD_CLEANUP_STATUS, cleanupOwner: WORKLOAD_CLEANUP_OWNER, firstFailure: safeCode(error)});
      process.stderr.write(`BP_U06_REMOTE_WORKLOAD=FAIL; REASON=${safeCode(error)}\n`);
      process.exitCode = 2;
    });
  }
}
