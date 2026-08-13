import {readFileSync} from 'node:fs';
import {normalizeEdgePath} from './seed-report.mjs';

const REPORT_KINDS = new Set(['SEED', 'REMOTE_TESTCONTAINERS']);
const REQUIRED_KIND_COUNTS = ['CONNECTION', 'TRANSACTION', 'QUERY', 'UPDATE'];
const diagnostics = ' WHY=the two immutable performance reports cannot be compared on the same evidence basis; BACKGROUND=DBCR-U05 comparison is evidence reconciliation, not a performance success claim; PATTERN=cross-kind, coverage/basis/profile/fixture/lifecycle drift, malformed operation identity, missing physical kind or forbidden direction must red';

const fail = (code, detail = '') => { throw new Error(`${code}${detail ? `:${detail}` : ''}${diagnostics}`); };
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function readReport(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch (error) { fail('BP_U06_REPORT_INPUT_INVALID', `${file}:${error.message}`); }
}

function numberMap(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const entries = Object.entries(value);
  if (entries.some(([kind, count]) => !/^[A-Z_]{1,48}$/.test(kind) || !Number.isInteger(count) || count < 0)) fail(code);
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

function requirePhysicalKindCounts(counts, code = 'BP_U06_REPORT_KIND_COUNTS_PHYSICAL_KIND_MISSING') {
  if (REQUIRED_KIND_COUNTS.some((kind) => !Object.hasOwn(counts, kind))) fail(code);
  return counts;
}

function requireUpdate(counts, code = 'BP_U06_REPORT_KIND_COUNTS_UPDATE_MISSING') {
  if (!Object.hasOwn(counts, 'UPDATE')) fail(code);
  return counts.UPDATE;
}

function addCounts(target, source) {
  for (const [kind, count] of Object.entries(source)) target[kind] = (target[kind] ?? 0) + count;
  return target;
}

function profileOf(report) {
  const profile = report.reportKind === 'SEED' ? report.seedProfile : report.testPlanId;
  if (typeof profile !== 'string' || profile.trim() === '') fail('BP_U06_REPORT_PROFILE_MISSING');
  return profile;
}

function fixtureIdentityOf(report) {
  const fixture = report.fixtureIdentity;
  if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)
    || typeof fixture.path !== 'string' || fixture.path.trim() === ''
    || !Number.isInteger(fixture.version) || fixture.version < 1
    || typeof fixture.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(fixture.sha256)) {
    fail('BP_U06_REPORT_FIXTURE_IDENTITY_INVALID');
  }
  return {path: fixture.path, version: fixture.version, sha256: fixture.sha256};
}

function lifecycleOf(report) {
  if (report.businessStatus !== 'PASS') fail('BP_U06_REPORT_BUSINESS_STATUS_NOT_PASS', report.businessStatus ?? 'UNSET');
  if (typeof report.cleanupStatus !== 'string' || !report.cleanupStatus.startsWith('PASS')) fail('BP_U06_REPORT_CLEANUP_STATUS_NOT_PASS', report.cleanupStatus ?? 'UNSET');
  return {businessStatus: report.businessStatus, cleanupStatus: report.cleanupStatus};
}

function validateEndpoint(endpoint) {
  if (!endpoint || typeof endpoint.operationId !== 'string' || !endpoint.operationId
    || typeof endpoint.owner !== 'string' || !endpoint.owner
    || typeof endpoint.method !== 'string' || !endpoint.method
    || typeof endpoint.routeTemplate !== 'string' || !endpoint.routeTemplate
    || !Number.isInteger(endpoint.callCount) || endpoint.callCount < 1
    || !Array.isArray(endpoint.stageIds) || endpoint.stageIds.length === 0
    || endpoint.stageIds.some((stageId) => typeof stageId !== 'string' || stageId.trim() === '')
    || new Set(endpoint.stageIds).size !== endpoint.stageIds.length
    || !endpoint.databaseOperationCount || typeof endpoint.databaseOperationCount !== 'object') {
    fail('BP_U06_REPORT_ENDPOINT_MALFORMED');
  }
  const counts = numberMap(endpoint.kindCounts, 'BP_U06_REPORT_KIND_COUNTS_MISSING');
  requireUpdate(counts);
  requirePhysicalKindCounts(counts);
  return {...endpoint, stageIds: [...endpoint.stageIds].sort(), kindCounts: counts};
}

function operationIdentity(endpoint) {
  return {
    owner: endpoint.owner,
    method: endpoint.method,
    routeTemplate: endpoint.routeTemplate,
    callCount: endpoint.callCount,
    stageIds: endpoint.stageIds,
  };
}

export function validatePerformanceReport(report) {
  if (!report || typeof report !== 'object' || !REPORT_KINDS.has(report.reportKind)) fail('BP_U06_REPORT_KIND_INVALID');
  if (report.schemaVersion !== 4) fail('BP_U06_REPORT_SCHEMA_INVALID', report.schemaVersion ?? 'UNSET');
  if (report.status !== 'PASS') fail('BP_U06_REPORT_STATUS_NOT_PASS', report.status ?? 'UNSET');
  if (!report.measurement || !Number.isInteger(report.measurement.schemaVersion) || typeof report.measurement.basis !== 'string' || !report.measurement.basis) fail('BP_U06_REPORT_MEASUREMENT_INVALID');
  const fixtureIdentity = fixtureIdentityOf(report);
  const lifecycle = lifecycleOf(report);
  const endpoints = Array.isArray(report.apiEndpoints) ? report.apiEndpoints.map(validateEndpoint) : [];
  if (!endpoints.length) fail('BP_U06_REPORT_ENDPOINT_DENOMINATOR_INVALID');
  const operationIds = endpoints.map((endpoint) => endpoint.operationId);
  if (new Set(operationIds).size !== operationIds.length) fail('BP_U06_REPORT_ENDPOINT_DUPLICATE');
  const completeness = report.completeness;
  if (!completeness || !Array.isArray(completeness.unmatchedHttpEvents) || !Array.isArray(completeness.unmatchedDatabaseEvents)
    || completeness.unmatchedHttpEvents.length !== 0 || completeness.unmatchedDatabaseEvents.length !== 0) fail('BP_U06_REPORT_COMPLETENESS_INVALID');
  const aggregate = numberMap(report.kindCounts, 'BP_U06_REPORT_KIND_COUNTS_MISSING');
  const expectedAggregate = endpoints.reduce((result, endpoint) => addCounts(result, endpoint.kindCounts), {});
  for (const kind of REQUIRED_KIND_COUNTS) expectedAggregate[kind] ??= 0;
  const normalizedExpected = Object.fromEntries(Object.entries(expectedAggregate).sort(([left], [right]) => left.localeCompare(right)));
  requireUpdate(aggregate);
  requirePhysicalKindCounts(aggregate);
  if (!exact(aggregate, normalizedExpected)) fail('BP_U06_REPORT_KIND_COUNTS_AGGREGATE_DRIFT');
  return {reportKind: report.reportKind, schemaVersion: report.schemaVersion, profile: profileOf(report), measurement: report.measurement, fixtureIdentity, lifecycle, endpoints, operationIds: [...operationIds].sort(), kindCounts: aggregate, connection: aggregate.CONNECTION, transaction: aggregate.TRANSACTION, query: aggregate.QUERY, update: aggregate.UPDATE};
}

export function comparePerformanceReports(baseline, candidate) {
  const left = validatePerformanceReport(baseline);
  const right = validatePerformanceReport(candidate);
  if (left.reportKind !== right.reportKind) fail('BP_U06_REPORT_KIND_MISMATCH', `${left.reportKind}:${right.reportKind}`);
  if (left.schemaVersion !== right.schemaVersion) fail('BP_U06_REPORT_SCHEMA_MISMATCH');
  if (!exact(left.measurement, right.measurement)) fail('BP_U06_REPORT_MEASUREMENT_BASIS_MISMATCH');
  if (left.profile !== right.profile) fail('BP_U06_REPORT_PROFILE_MISMATCH', `${left.profile}:${right.profile}`);
  if (!exact(left.fixtureIdentity, right.fixtureIdentity)) fail('BP_U06_REPORT_FIXTURE_IDENTITY_MISMATCH');
  if (!exact(left.lifecycle, right.lifecycle)) fail('BP_U06_REPORT_LIFECYCLE_STATUS_MISMATCH');
  if (!exact(left.operationIds, right.operationIds)) fail('BP_U06_REPORT_OPERATION_COVERAGE_MISMATCH');
  const baselineById = new Map(left.endpoints.map((endpoint) => [endpoint.operationId, endpoint]));
  const candidateById = new Map(right.endpoints.map((endpoint) => [endpoint.operationId, endpoint]));
  const operations = left.operationIds.map((operationId) => {
    const baselineEndpoint = baselineById.get(operationId);
    const candidateEndpoint = candidateById.get(operationId);
    if (!exact(operationIdentity(baselineEndpoint), operationIdentity(candidateEndpoint))) fail('BP_U06_REPORT_OPERATION_IDENTITY_MISMATCH', operationId);
    return {
      operationId,
      baselineKindCounts: baselineEndpoint.kindCounts,
      candidateKindCounts: candidateEndpoint.kindCounts,
      connectionDelta: candidateEndpoint.kindCounts.CONNECTION - baselineEndpoint.kindCounts.CONNECTION,
      transactionDelta: candidateEndpoint.kindCounts.TRANSACTION - baselineEndpoint.kindCounts.TRANSACTION,
      queryDelta: candidateEndpoint.kindCounts.QUERY - baselineEndpoint.kindCounts.QUERY,
      updateDelta: candidateEndpoint.kindCounts.UPDATE - baselineEndpoint.kindCounts.UPDATE,
    };
  });
  if (right.connection >= left.connection) fail('BP_U06_REPORT_CONNECTION_TOTAL_NOT_LOWER', `${left.connection}:${right.connection}`);
  if (right.transaction >= left.transaction) fail('BP_U06_REPORT_TRANSACTION_TOTAL_NOT_LOWER', `${left.transaction}:${right.transaction}`);
  if (right.query > left.query) fail('BP_U06_REPORT_QUERY_TOTAL_HIGHER', `${left.query}:${right.query}`);
  if (right.update > left.update) fail('BP_U06_REPORT_UPDATE_TOTAL_HIGHER', `${left.update}:${right.update}`);
  return Object.freeze({
    status: 'PASS', reportKind: left.reportKind, profile: left.profile, measurement: left.measurement, fixtureIdentity: left.fixtureIdentity, lifecycle: left.lifecycle,
    operationCount: operations.length,
    aggregate: {
      baseline: left.kindCounts,
      candidate: right.kindCounts,
      connectionDelta: right.connection - left.connection,
      transactionDelta: right.transaction - left.transaction,
      queryDelta: right.query - left.query,
      updateDelta: right.update - left.update,
    },
    operations,
  });
}

function syntheticReport({reportKind = 'SEED', profile = 'r5-full', basis = 'JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH', operationIds = ['op-a', 'op-b'], counts = {CONNECTION: 2, TRANSACTION: 2, QUERY: 3, UPDATE: 1}, fixtureIdentity = {path: 'doc/fixture.json', version: 1, sha256: 'a'.repeat(64)}, businessStatus = 'PASS', cleanupStatus = 'PASS_NO_PERSISTENT_SEED_PROCESS'} = {}) {
  const endpoints = operationIds.map((operationId, index) => ({
    owner: 'owner', consumerFace: 'operations-admin', operationId, method: 'POST', routeTemplate: normalizeEdgePath(`/${operationId}`),
    stageIds: [`stage-${index}`], callCount: 1, httpDurationMs: {average: 1, min: 1, max: 1}, databaseOperationCount: {average: 2, min: 2, max: 2}, databaseDurationMs: {average: 1, min: 1, max: 1},
    kindCounts: index === 0 ? {...counts} : {CONNECTION: 0, TRANSACTION: 0, QUERY: 0, UPDATE: 0}, outcomes: {success: 1, rejected: 0, error: 0},
  }));
  return {kind: reportKind === 'SEED' ? 'r5-full-seed-report' : 'r5-managed-testcontainers-report', reportKind, schemaVersion: 4, status: 'PASS', businessStatus, cleanupStatus, fixtureIdentity, seedProfile: reportKind === 'SEED' ? profile : undefined, testPlanId: reportKind === 'REMOTE_TESTCONTAINERS' ? profile : undefined, measurement: {schemaVersion: 2, basis}, apiEndpoints: endpoints, kindCounts: {...counts}, completeness: {unmatchedHttpEvents: [], unmatchedDatabaseEvents: []}};
}

function expectRed(mutate, code, label) {
  const baseline = syntheticReport();
  const candidate = syntheticReport();
  mutate(baseline, candidate);
  try { comparePerformanceReports(baseline, candidate); throw new Error(`BP_U06_REPORT_SELF_TEST_RED_NOT_DETECTED:${label}`); }
  catch (error) { if (!String(error.message).startsWith(code)) throw error; }
}

export function selfTest() {
  const baseline = syntheticReport();
  const candidate = syntheticReport({counts: {CONNECTION: 1, TRANSACTION: 1, QUERY: 3, UPDATE: 1}});
  const result = comparePerformanceReports(baseline, candidate);
  if (result.status !== 'PASS' || result.operationCount !== 2 || result.aggregate.connectionDelta !== -1 || result.aggregate.transactionDelta !== -1 || result.aggregate.queryDelta !== 0 || result.aggregate.updateDelta !== 0) throw new Error('BP_U06_REPORT_SELF_TEST_VALID_COMPARISON_INVALID');
  expectRed((_baseline, candidateReport) => { candidateReport.reportKind = 'REMOTE_TESTCONTAINERS'; candidateReport.testPlanId = 'r5-full'; delete candidateReport.seedProfile; }, 'BP_U06_REPORT_KIND_MISMATCH', 'kind');
  expectRed((_baseline, candidateReport) => { candidateReport.measurement.basis = 'OTHER'; }, 'BP_U06_REPORT_MEASUREMENT_BASIS_MISMATCH', 'basis');
  expectRed((_baseline, candidateReport) => { candidateReport.seedProfile = 'other-profile'; }, 'BP_U06_REPORT_PROFILE_MISMATCH', 'profile');
  expectRed((_baseline, candidateReport) => { candidateReport.fixtureIdentity.sha256 = 'b'.repeat(64); }, 'BP_U06_REPORT_FIXTURE_IDENTITY_MISMATCH', 'fixture');
  expectRed((_baseline, candidateReport) => { candidateReport.businessStatus = 'FAIL'; }, 'BP_U06_REPORT_BUSINESS_STATUS_NOT_PASS', 'business');
  expectRed((_baseline, candidateReport) => { candidateReport.cleanupStatus = 'FAIL'; }, 'BP_U06_REPORT_CLEANUP_STATUS_NOT_PASS', 'cleanup');
  expectRed((_baseline, candidateReport) => { candidateReport.apiEndpoints[0].callCount = 2; }, 'BP_U06_REPORT_OPERATION_IDENTITY_MISMATCH', 'call-count');
  expectRed((_baseline, candidateReport) => { candidateReport.apiEndpoints[0].stageIds = ['different-stage']; }, 'BP_U06_REPORT_OPERATION_IDENTITY_MISMATCH', 'stage-ids');
  expectRed((_baseline, candidateReport) => { candidateReport.kindCounts.CONNECTION = 2; candidateReport.apiEndpoints[0].kindCounts.CONNECTION = 2; }, 'BP_U06_REPORT_CONNECTION_TOTAL_NOT_LOWER', 'connection');
  expectRed((_baseline, candidateReport) => { candidateReport.kindCounts.CONNECTION = 1; candidateReport.apiEndpoints[0].kindCounts.CONNECTION = 1; candidateReport.kindCounts.TRANSACTION = 2; candidateReport.apiEndpoints[0].kindCounts.TRANSACTION = 2; }, 'BP_U06_REPORT_TRANSACTION_TOTAL_NOT_LOWER', 'transaction');
  expectRed((_baseline, candidateReport) => { candidateReport.kindCounts.CONNECTION = 1; candidateReport.apiEndpoints[0].kindCounts.CONNECTION = 1; candidateReport.kindCounts.TRANSACTION = 1; candidateReport.apiEndpoints[0].kindCounts.TRANSACTION = 1; candidateReport.kindCounts.QUERY = 4; candidateReport.apiEndpoints[0].kindCounts.QUERY = 4; }, 'BP_U06_REPORT_QUERY_TOTAL_HIGHER', 'query');
  expectRed((_baseline, candidateReport) => { candidateReport.kindCounts.CONNECTION = 1; candidateReport.apiEndpoints[0].kindCounts.CONNECTION = 1; candidateReport.kindCounts.TRANSACTION = 1; candidateReport.apiEndpoints[0].kindCounts.TRANSACTION = 1; candidateReport.kindCounts.UPDATE = 2; candidateReport.apiEndpoints[0].kindCounts.UPDATE = 2; }, 'BP_U06_REPORT_UPDATE_TOTAL_HIGHER', 'update');
  expectRed((_baseline, candidateReport) => { candidateReport.apiEndpoints[0].kindCounts = {CONNECTION: 1, TRANSACTION: 1, QUERY: 2, UPDATE: 1}; candidateReport.apiEndpoints.pop(); candidateReport.kindCounts = {CONNECTION: 1, TRANSACTION: 1, QUERY: 2, UPDATE: 1}; }, 'BP_U06_REPORT_OPERATION_COVERAGE_MISMATCH', 'coverage');
  expectRed((_baseline, candidateReport) => { delete candidateReport.apiEndpoints[0].kindCounts.UPDATE; }, 'BP_U06_REPORT_KIND_COUNTS_UPDATE_MISSING', 'endpoint-update');
  expectRed((_baseline, candidateReport) => { delete candidateReport.kindCounts.CONNECTION; }, 'BP_U06_REPORT_KIND_COUNTS_PHYSICAL_KIND_MISSING', 'aggregate-physical-kind');
  return true;
}

if (process.argv[1]?.endsWith('/compare-backend-performance-seed-reports.mjs')) {
  const argument = process.argv[2];
  try {
    if (argument === '--self-test' && process.argv.length === 3) {
      selfTest();
      process.stdout.write('BP_U06_SEED_REPORT_COMPARATOR_SELF_TEST=PASS\nRED_CROSS_KIND=PASS\nRED_BASIS=PASS\nRED_PROFILE=PASS\nRED_FIXTURE_IDENTITY=PASS\nRED_LIFECYCLE=PASS\nRED_OPERATION_IDENTITY=PASS\nRED_CONNECTION_DIRECTION=PASS\nRED_TRANSACTION_DIRECTION=PASS\nRED_QUERY_DIRECTION=PASS\nRED_UPDATE_DIRECTION=PASS\nRED_COVERAGE=PASS\nRED_PHYSICAL_KIND=PASS\nCLEANUP=PASS\n');
    } else if (argument === '--check' && process.argv.length === 5) {
      const result = comparePerformanceReports(readReport(process.argv[3]), readReport(process.argv[4]));
      process.stdout.write(`BP_U06_SEED_REPORT_COMPARATOR=PASS\nREPORT_KIND=${result.reportKind}\nPROFILE=${result.profile}\nOPERATIONS=${result.operationCount}\nCONNECTION_DELTA=${result.aggregate.connectionDelta}\nTRANSACTION_DELTA=${result.aggregate.transactionDelta}\nQUERY_DELTA=${result.aggregate.queryDelta}\nUPDATE_DELTA=${result.aggregate.updateDelta}\n`);
    } else {
      throw new Error('BP_U06_SEED_REPORT_COMPARATOR_ARGUMENT_INVALID');
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
