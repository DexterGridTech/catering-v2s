import {readFileSync} from 'node:fs';
import {normalizeEdgePath} from './seed-report.mjs';

const REPORT_KINDS = new Set(['SEED', 'REMOTE_TESTCONTAINERS']);
const diagnostics = ' WHY=the two immutable performance reports cannot be compared on the same evidence basis; BACKGROUND=BPF-U06 comparison is evidence reconciliation, not a performance success claim; PATTERN=cross-kind, coverage/basis/profile drift, malformed kindCounts, missing UPDATE or lower aggregate UPDATE must red';

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

function validateEndpoint(endpoint) {
  if (!endpoint || typeof endpoint.operationId !== 'string' || !endpoint.operationId
    || typeof endpoint.owner !== 'string' || typeof endpoint.method !== 'string' || typeof endpoint.routeTemplate !== 'string'
    || !endpoint.databaseOperationCount || typeof endpoint.databaseOperationCount !== 'object') fail('BP_U06_REPORT_ENDPOINT_MALFORMED');
  const counts = numberMap(endpoint.kindCounts, 'BP_U06_REPORT_KIND_COUNTS_MISSING');
  requireUpdate(counts);
  return {...endpoint, kindCounts: counts};
}

export function validatePerformanceReport(report) {
  if (!report || typeof report !== 'object' || !REPORT_KINDS.has(report.reportKind)) fail('BP_U06_REPORT_KIND_INVALID');
  if (report.status !== 'PASS') fail('BP_U06_REPORT_STATUS_NOT_PASS', report.status ?? 'UNSET');
  if (!report.measurement || !Number.isInteger(report.measurement.schemaVersion) || typeof report.measurement.basis !== 'string' || !report.measurement.basis) fail('BP_U06_REPORT_MEASUREMENT_INVALID');
  const endpoints = Array.isArray(report.apiEndpoints) ? report.apiEndpoints.map(validateEndpoint) : [];
  if (!endpoints.length) fail('BP_U06_REPORT_ENDPOINT_DENOMINATOR_INVALID');
  const operationIds = endpoints.map((endpoint) => endpoint.operationId);
  if (new Set(operationIds).size !== operationIds.length) fail('BP_U06_REPORT_ENDPOINT_DUPLICATE');
  const completeness = report.completeness;
  if (!completeness || !Array.isArray(completeness.unmatchedHttpEvents) || !Array.isArray(completeness.unmatchedDatabaseEvents)
    || completeness.unmatchedHttpEvents.length !== 0 || completeness.unmatchedDatabaseEvents.length !== 0) fail('BP_U06_REPORT_COMPLETENESS_INVALID');
  const aggregate = numberMap(report.kindCounts, 'BP_U06_REPORT_KIND_COUNTS_MISSING');
  const expectedAggregate = endpoints.reduce((result, endpoint) => addCounts(result, endpoint.kindCounts), {});
  const normalizedExpected = Object.fromEntries(Object.entries(expectedAggregate).sort(([left], [right]) => left.localeCompare(right)));
  requireUpdate(aggregate);
  if (!exact(aggregate, normalizedExpected)) fail('BP_U06_REPORT_KIND_COUNTS_AGGREGATE_DRIFT');
  return {reportKind: report.reportKind, profile: profileOf(report), measurement: report.measurement, endpoints, operationIds: [...operationIds].sort(), kindCounts: aggregate, update: aggregate.UPDATE};
}

export function comparePerformanceReports(baseline, candidate) {
  const left = validatePerformanceReport(baseline);
  const right = validatePerformanceReport(candidate);
  if (left.reportKind !== right.reportKind) fail('BP_U06_REPORT_KIND_MISMATCH', `${left.reportKind}:${right.reportKind}`);
  if (!exact(left.measurement, right.measurement)) fail('BP_U06_REPORT_MEASUREMENT_BASIS_MISMATCH');
  if (left.profile !== right.profile) fail('BP_U06_REPORT_PROFILE_MISMATCH', `${left.profile}:${right.profile}`);
  if (!exact(left.operationIds, right.operationIds)) fail('BP_U06_REPORT_OPERATION_COVERAGE_MISMATCH');
  if (right.update < left.update) fail('BP_U06_REPORT_UPDATE_TOTAL_LOWER', `${left.update}:${right.update}`);
  const baselineById = new Map(left.endpoints.map((endpoint) => [endpoint.operationId, endpoint]));
  const candidateById = new Map(right.endpoints.map((endpoint) => [endpoint.operationId, endpoint]));
  const operations = left.operationIds.map((operationId) => ({
    operationId,
    baselineKindCounts: baselineById.get(operationId).kindCounts,
    candidateKindCounts: candidateById.get(operationId).kindCounts,
    updateDelta: candidateById.get(operationId).kindCounts.UPDATE - baselineById.get(operationId).kindCounts.UPDATE,
  }));
  return Object.freeze({
    status: 'PASS', reportKind: left.reportKind, profile: left.profile, measurement: left.measurement,
    operationCount: operations.length, aggregate: {baseline: left.kindCounts, candidate: right.kindCounts, updateDelta: right.update - left.update}, operations,
  });
}

function syntheticReport({reportKind = 'SEED', profile = 'r5-full', basis = 'JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH', operationIds = ['op-a', 'op-b'], update = 1} = {}) {
  const endpoints = operationIds.map((operationId, index) => ({
    owner: 'owner', consumerFace: 'operations-admin', operationId, method: 'POST', routeTemplate: normalizeEdgePath(`/${operationId}`),
    callCount: 1, httpDurationMs: {average: 1, min: 1, max: 1}, databaseOperationCount: {average: 2, min: 2, max: 2}, databaseDurationMs: {average: 1, min: 1, max: 1},
    kindCounts: {QUERY: 1, UPDATE: index === 0 ? update : 0}, outcomes: {success: 1, rejected: 0, error: 0},
  }));
  const kindCounts = endpoints.reduce((result, endpoint) => addCounts(result, endpoint.kindCounts), {});
  return {kind: reportKind === 'SEED' ? 'r5-full-seed-report' : 'r5-managed-testcontainers-report', reportKind, schemaVersion: 3, status: 'PASS', seedProfile: reportKind === 'SEED' ? profile : undefined, testPlanId: reportKind === 'REMOTE_TESTCONTAINERS' ? profile : undefined, measurement: {schemaVersion: 2, basis}, apiEndpoints: endpoints, kindCounts, completeness: {unmatchedHttpEvents: [], unmatchedDatabaseEvents: []}};
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
  const candidate = syntheticReport({update: 2});
  const result = comparePerformanceReports(baseline, candidate);
  if (result.status !== 'PASS' || result.operationCount !== 2 || result.aggregate.updateDelta !== 1) throw new Error('BP_U06_REPORT_SELF_TEST_VALID_COMPARISON_INVALID');
  expectRed((_baseline, candidateReport) => { candidateReport.reportKind = 'REMOTE_TESTCONTAINERS'; candidateReport.testPlanId = 'r5-full'; delete candidateReport.seedProfile; }, 'BP_U06_REPORT_KIND_MISMATCH', 'kind');
  expectRed((_baseline, candidateReport) => { candidateReport.measurement.basis = 'OTHER'; }, 'BP_U06_REPORT_MEASUREMENT_BASIS_MISMATCH', 'basis');
  expectRed((_baseline, candidateReport) => { candidateReport.seedProfile = 'other-profile'; }, 'BP_U06_REPORT_PROFILE_MISMATCH', 'profile');
  expectRed((_baseline, candidateReport) => { candidateReport.apiEndpoints.pop(); candidateReport.kindCounts = {QUERY: 1, UPDATE: 1}; }, 'BP_U06_REPORT_OPERATION_COVERAGE_MISMATCH', 'coverage');
  expectRed((_baseline, candidateReport) => { delete candidateReport.apiEndpoints[0].kindCounts.UPDATE; }, 'BP_U06_REPORT_KIND_COUNTS_UPDATE_MISSING', 'endpoint-update');
  expectRed((_baseline, candidateReport) => { delete candidateReport.kindCounts.UPDATE; }, 'BP_U06_REPORT_KIND_COUNTS_UPDATE_MISSING', 'aggregate-update');
  expectRed((baselineReport, candidateReport) => { baselineReport.apiEndpoints[0].kindCounts.UPDATE = 3; baselineReport.kindCounts.UPDATE = 3; }, 'BP_U06_REPORT_UPDATE_TOTAL_LOWER', 'lower-update');
  return true;
}

if (process.argv[1]?.endsWith('/compare-backend-performance-seed-reports.mjs')) {
  const argument = process.argv[2];
  try {
    if (argument === '--self-test' && process.argv.length === 3) {
      selfTest();
      process.stdout.write('BP_U06_SEED_REPORT_COMPARATOR_SELF_TEST=PASS\nRED_CROSS_KIND=PASS\nRED_BASIS=PASS\nRED_PROFILE=PASS\nRED_COVERAGE=PASS\nRED_MISSING_UPDATE=PASS\nRED_LOWER_UPDATE=PASS\nCLEANUP=PASS\n');
    } else if (argument === '--check' && process.argv.length === 5) {
      const result = comparePerformanceReports(readReport(process.argv[3]), readReport(process.argv[4]));
      process.stdout.write(`BP_U06_SEED_REPORT_COMPARATOR=PASS\nREPORT_KIND=${result.reportKind}\nPROFILE=${result.profile}\nOPERATIONS=${result.operationCount}\nUPDATE_DELTA=${result.aggregate.updateDelta}\n`);
    } else {
      throw new Error('BP_U06_SEED_REPORT_COMPARATOR_ARGUMENT_INVALID');
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
