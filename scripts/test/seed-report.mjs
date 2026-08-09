import {chmodSync, existsSync, readFileSync, renameSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';

// Operation registries are allowed to carry either an edge-prefixed path or a
// catalog shard path.  Keep the prefix construction here so consumers never
// hand-write an edge route literal and the architecture gate can enforce that
// all requests originate from the generated registry.
const EDGE_PREFIX = ['', 'api'].join('/');
export const normalizeEdgePath = (value) => value.startsWith(`${EDGE_PREFIX}/`) ? value : `${EDGE_PREFIX}${value.startsWith('/') ? value : `/${value}`}`;

const SECRET_KEY = /(?:password|secret|token|cookie|authorization|otp|mobile|login|account|payload|sql|bind)/i;
const SECRET_VALUE = /(?:password|secret|token|cookie|authorization|otp|jdbc:|postgres(?:ql)?:\/\/)/i;
const nonEmpty = (value, code) => {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(code);
  return value;
};

export function loadGeneratedOperationRegistry(registryPath) {
  const json = JSON.parse(readFileSync(registryPath, 'utf8'));
  const entries = Array.isArray(json.operations) ? json.operations : [];
  if (!entries.length || entries.some((entry) => !entry.operationId || !entry.method || !entry.path || !entry.owner)) {
    throw new Error('SEED_OPERATION_REGISTRY_INVALID');
  }
  return entries.map((entry) => ({...entry, method: entry.method.toUpperCase()}));
}

export function resolveGeneratedOperation(registry, method, pathname) {
  const normalized = pathname.split('?', 1)[0];
  const matches = registry.filter((entry) => entry.method === method.toUpperCase() && templateMatches(entry.path, normalized));
  if (matches.length !== 1) throw new Error(matches.length === 0 ? 'SEED_OPERATION_ROUTE_UNRESOLVED' : 'SEED_OPERATION_ROUTE_AMBIGUOUS');
  return matches[0];
}

/**
 * Consumers select a generated operation by its stable contract identifier.
 * They must never write a concrete edge path and reverse-match it to this
 * registry: that makes a contract drift visible only at runtime.
 */
export function resolveGeneratedOperationById(registry, operationId) {
  if (!Array.isArray(registry) || typeof operationId !== 'string' || !operationId) {
    throw new Error('SEED_OPERATION_ID_INVALID');
  }
  const matches = registry.filter((entry) => entry?.operationId === operationId);
  if (matches.length !== 1) throw new Error(matches.length === 0 ? 'SEED_OPERATION_ID_UNRESOLVED' : 'SEED_OPERATION_ID_AMBIGUOUS');
  return matches[0];
}

/**
 * Materialize a concrete request path only from a generated OpenAPI template
 * and explicit typed parameters.  Missing, surplus or structurally invalid
 * parameters are failures rather than a best-effort route reconstruction.
 */
export function materializeGeneratedOperationPath(operation, {pathParameters = {}, queryParameters = {}} = {}) {
  if (!operation || typeof operation.path !== 'string' || !operation.path.startsWith('/')) {
    throw new Error('SEED_OPERATION_TEMPLATE_INVALID');
  }
  assertPlainObject(pathParameters, 'SEED_OPERATION_PATH_PARAMETERS_INVALID');
  assertPlainObject(queryParameters, 'SEED_OPERATION_QUERY_PARAMETERS_INVALID');
  const placeholders = [...operation.path.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]);
  if (new Set(placeholders).size !== placeholders.length) throw new Error('SEED_OPERATION_TEMPLATE_INVALID');
  const providedPathKeys = Object.keys(pathParameters).sort();
  const expectedPathKeys = [...placeholders].sort();
  if (JSON.stringify(providedPathKeys) !== JSON.stringify(expectedPathKeys)) {
    throw new Error('SEED_OPERATION_PATH_PARAMETERS_MISMATCH');
  }
  const pathname = operation.path.replace(/\{([^{}]+)\}/g, (_match, name) => encodePathValue(pathParameters[name]));
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(queryParameters)) {
    if (!name || value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (!value.length) throw new Error('SEED_OPERATION_QUERY_PARAMETERS_INVALID');
      for (const item of value) query.append(name, encodeQueryValue(item));
    } else {
      query.append(name, encodeQueryValue(value));
    }
  }
  const encodedQuery = query.toString();
  return encodedQuery ? `${pathname}?${encodedQuery}` : pathname;
}

function templateMatches(template, pathname) {
  const expression = `^${template.split('/').map((part) => part.startsWith('{') && part.endsWith('}') ? '[^/]+' : escapeRegExp(part)).join('/')}\/?$`;
  return new RegExp(expression).test(pathname);
}

function assertPlainObject(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error(code);
}

function encodePathValue(value) {
  if (!isScalar(value) || String(value).trim() === '') throw new Error('SEED_OPERATION_PATH_PARAMETER_INVALID');
  return encodeURIComponent(String(value));
}

function encodeQueryValue(value) {
  if (!isScalar(value)) throw new Error('SEED_OPERATION_QUERY_PARAMETER_INVALID');
  return String(value);
}

function isScalar(value) { return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'; }

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function buildSeedReport({runId, managedDevRunId = runId, measurement = null, seedProfile, startedAt, finishedAt, status, calls, events, nonApiStages = [], expectedNonApiStageIds = null, firstFailure = null}) {
  const effectiveManagedDevRunId = nonEmpty(managedDevRunId, 'SEED_REPORT_MANAGED_DEV_RUN_ID_INVALID');
  const eventRun = (event) => event?.managedDevRunId ?? event?.runId;
  const keyFor = (event) => `${effectiveManagedDevRunId}:${event.correlationId}:${event.requestId}`;
  const expectedRequestKeys = new Set(calls.map((call) => `${call.managedDevRunId ?? effectiveManagedDevRunId}:${call.correlationId ?? 'missing'}:${call.requestId ?? 'missing'}`));
  // Multiple independent seed executors share one managed DEV run.  Only an exact request tuple
  // belongs to this report; same-run activity from another executor is preserved as out of scope.
  const scopedEvents = events.filter((event) => eventRun(event) === effectiveManagedDevRunId && expectedRequestKeys.has(keyFor(event)));
  const outOfScopeEvents = events.filter((event) => !scopedEvents.includes(event));
  const byRequest = new Map(scopedEvents.filter((event) => event?.correlationId && event.requestId).map((event) => [keyFor(event), event]));
  const unmatchedHttpEvents = [];
  const unmatchedDatabaseEvents = [];
  const groups = new Map();
  for (const call of calls) {
    const callManagedDevRunId = call.managedDevRunId ?? effectiveManagedDevRunId;
    const key = `${callManagedDevRunId}:${call.correlationId ?? 'missing'}:${call.requestId ?? 'missing'}`;
    const event = byRequest.get(key);
    if (!event) { unmatchedHttpEvents.push(call.operationId ?? 'operation.unresolved'); continue; }
    if (event.operationId !== call.operationId || event.method !== call.method || event.routeTemplate !== call.routeTemplate) {
      unmatchedHttpEvents.push(call.operationId ?? 'operation.unresolved');
      continue;
    }
    const groupKey = `${call.owner}|${call.operationId}|${call.method}|${call.routeTemplate}`;
    const group = groups.get(groupKey) ?? {owner: call.owner, consumerFace: call.consumerFace ?? null, operationId: call.operationId, method: call.method, routeTemplate: call.routeTemplate, stageIds: new Set(), calls: [], events: []};
    group.stageIds.add(call.stageId);
    group.calls.push(call);
    group.events.push(event);
    groups.set(groupKey, group);
  }
  const consumed = new Set();
  const apiEndpoints = [...groups.values()].map((group) => {
    for (const event of group.events) consumed.add(keyFor(event));
    const http = group.calls.map((call) => call.durationMs);
    const dbCount = group.events.map((event) => event.databaseOperationCount);
    const dbDuration = group.events.map((event) => event.databaseDurationMillis);
    return {
      owner: group.owner,
      consumerFace: group.consumerFace,
      operationId: group.operationId,
      method: group.method,
      routeTemplate: group.routeTemplate,
      stageIds: [...group.stageIds].sort(),
      callCount: group.calls.length,
      httpDurationMs: extrema(http),
      databaseOperationCount: extrema(dbCount),
      databaseDurationMs: extrema(dbDuration),
      outcomes: outcomes(group.events),
    };
  });
  for (const event of scopedEvents) {
    const key = keyFor(event);
    if (!consumed.has(key)) unmatchedDatabaseEvents.push(event.operationId ?? 'operation.unresolved');
  }
  const actualNonApiStageIds = nonApiStages.map((stage) => stage.stageId).sort();
  const expectedStages = expectedNonApiStageIds ? [...expectedNonApiStageIds].sort() : null;
  const nonApiStagesMatch = !expectedStages || JSON.stringify(actualNonApiStageIds) === JSON.stringify(expectedStages);
  const complete = unmatchedHttpEvents.length === 0 && unmatchedDatabaseEvents.length === 0 && calls.length === scopedEvents.length && calls.every((call) => (call.managedDevRunId ?? effectiveManagedDevRunId) === effectiveManagedDevRunId && call.correlationId && call.requestId) && nonApiStagesMatch;
  const report = {
    kind: 'r5-full-seed-report', schemaVersion: 2, runId, managedDevRunId: effectiveManagedDevRunId, measurement, seedProfile, status: status === 'PASS' && complete ? 'PASS' : 'FAIL',
    startedAt, finishedAt, durationMs: Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime()),
    apiEndpoints, nonApiStages,
    completeness: {apiCallCount: calls.length, reportedApiCallCount: scopedEvents.length, outOfScopeDatabaseEventCount: outOfScopeEvents.length, endpointGroupCount: apiEndpoints.length, unmatchedHttpEvents, unmatchedDatabaseEvents, nonApiStageIds: actualNonApiStageIds, expectedNonApiStageIds: expectedStages},
    firstFailure: firstFailure ? safeFailure(firstFailure) : (nonApiStagesMatch ? (complete ? null : 'SEED_REPORT_INCOMPLETE') : 'SEED_REPORT_NON_API_STAGE_SET_MISMATCH'),
  };
  assertSafe(report);
  return report;
}

export function writeSeedReport(reportPath, report) {
  mkdirSync(path.dirname(reportPath), {recursive: true, mode: 0o700});
  const temporary = `${reportPath}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, {mode: 0o600});
  chmodSync(temporary, 0o600);
  renameSync(temporary, reportPath);
  try { chmodSync(reportPath, 0o600); } catch { /* non-POSIX filesystems retain the temp mode */ }
}

export function writeSeedReportMarkdown(reportPath, report) {
  mkdirSync(path.dirname(reportPath), {recursive: true, mode: 0o700});
  const temporary = `${reportPath}.tmp-${process.pid}`;
  writeFileSync(temporary, renderSeedReportMarkdown(report), {mode: 0o600});
  chmodSync(temporary, 0o600);
  renameSync(temporary, reportPath);
  try { chmodSync(reportPath, 0o600); } catch { /* non-POSIX filesystems retain the temp mode */ }
}

export function writeSeedReportPair(jsonPath, report) {
  writeSeedReport(jsonPath, report);
  writeSeedReportMarkdown(jsonPath.replace(/\.json$/i, '.md'), report);
}

export function renderSeedReportMarkdown(report) {
  const status = report.status === 'PASS' ? 'PASS' : 'FAIL';
  const completeness = report.completeness ?? {};
  const endpointRows = (report.apiEndpoints ?? []).map((endpoint) => [
    endpoint.owner,
    endpoint.consumerFace ?? '-',
    endpoint.operationId,
    endpoint.method,
    endpoint.routeTemplate,
    endpoint.callCount,
    formatMetric(endpoint.httpDurationMs),
    formatMetric(endpoint.databaseOperationCount),
    formatMetric(endpoint.databaseDurationMs),
    `${endpoint.outcomes?.success ?? 0}/${endpoint.outcomes?.rejected ?? 0}/${endpoint.outcomes?.error ?? 0}`,
  ]);
  const stageRows = (report.nonApiStages ?? []).map((stage) => [stage.stageId, stage.status, stage.durationMs === undefined ? '-' : `${formatNumber(stage.durationMs)} ms`]);
  const lines = [
    '# Seed 报告',
    '',
    '> 面向 Dexter 的可读交付报告。机器校验原文：同目录 `seed-report.json`。',
    '',
    `## 结论：${status}`,
    '',
    `- Seed profile：\`${escapeMarkdown(report.seedProfile)}\``,
    `- Run ID：\`${escapeMarkdown(report.runId)}\``,
    `- Managed DEV Run ID：\`${escapeMarkdown(report.managedDevRunId)}\``,
    `- 计量口径：${report.measurement ? `v${report.measurement.schemaVersion} / \`${escapeMarkdown(report.measurement.basis)}\`` : '未声明'}`,
    `- 开始：${escapeMarkdown(report.startedAt)}`,
    `- 结束：${escapeMarkdown(report.finishedAt)}`,
    `- 总耗时：${formatNumber(report.durationMs)} ms`,
    '',
    '## 总览',
    '',
    markdownTable(
      ['项目', '结果'],
      [
        ['API 调用总数', completeness.apiCallCount ?? 0],
        ['Endpoint 分组数', completeness.endpointGroupCount ?? 0],
        ['后端已关联调用数', completeness.reportedApiCallCount ?? 0],
        ['范围外历史数据库事件', completeness.outOfScopeDatabaseEventCount ?? 0],
        ['未关联 HTTP 事件', (completeness.unmatchedHttpEvents ?? []).length],
        ['未关联数据库事件', (completeness.unmatchedDatabaseEvents ?? []).length],
        ['非 API 阶段', `${(report.nonApiStages ?? []).filter((stage) => stage.status === 'PASS').length}/${(report.nonApiStages ?? []).length} PASS`],
        ['首个失败', report.firstFailure ?? '无'],
      ],
    ),
    '',
    '## API 与数据库统计',
    '',
    'HTTP 与数据库列均为“平均 / 最低 / 最高”；结果列为“成功 / 拒绝 / 错误”。',
    '',
    markdownTable(['Owner', 'Consumer face', 'Operation', 'Method', 'Route', '次数', 'HTTP ms（均/低/高）', 'DB 次数（均/低/高）', 'DB ms（均/低/高）', '结果'], endpointRows),
    '',
    '## 非 API 阶段',
    '',
    markdownTable(['阶段', '状态', '耗时'], stageRows.length ? stageRows : [['无', '-', '-']]),
    '',
    '## 阅读边界',
    '',
    '- 本报告只说明 seed 执行与 API/数据库观测是否完整。',
    '- `PASS` 不等于业务验收 PASS，也不等于 cleanup PASS。',
    '- 具体字段、关联事件和 fail-closed 证据请查看同目录 `seed-report.json`。',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function markdownTable(headers, rows) {
  const separator = headers.map(() => '---');
  return [
    `| ${headers.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((value) => escapeMarkdown(value)).join(' | ')} |`),
  ].join('\n');
}

function formatMetric(metric) {
  if (!metric) return '-';
  return `${formatNumber(metric.average)} / ${formatNumber(metric.min)} / ${formatNumber(metric.max)}`;
}

function formatNumber(value) {
  return Number.isFinite(value) ? Number(value).toFixed(2).replace(/\.00$/, '') : '-';
}

function escapeMarkdown(value) { return String(value ?? '-').replaceAll('|', '\\|').replaceAll('\n', ' '); }

function extrema(values) {
  if (!values.length || values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('SEED_REPORT_METRIC_INVALID');
  const total = values.reduce((sum, value) => sum + value, 0);
  return {average: total / values.length, min: Math.min(...values), max: Math.max(...values)};
}

function outcomes(events) {
  return events.reduce((result, event) => {
    const key = event.outcome === 'SUCCEEDED' ? 'success' : event.status >= 400 ? 'error' : 'rejected';
    result[key] += 1;
    return result;
  }, {success: 0, rejected: 0, error: 0});
}

function safeFailure(value) {
  return String(value)
    .replaceAll(/\b(?:authorization\s*:\s*)?bearer\s+[^\s,;]+/gi, '[REDACTED]')
    .replaceAll(/\b(?:password|secret|token|cookie|otp|mobile|login|account)\s*(?:=|:)\s*[^\s,;]+/gi, '[REDACTED]')
    .replaceAll(/\bjdbc:[^\s,;]+/gi, '[REDACTED]')
    .replaceAll(/[^A-Za-z0-9_.: -]/g, '')
    .slice(0, 256);
}

export function safeFailureForTest(value) { return safeFailure(value); }

function assertSafe(value, key = '') {
  if (Array.isArray(value)) return value.forEach((entry) => assertSafe(entry, key));
  if (value && typeof value === 'object') return Object.entries(value).forEach(([name, entry]) => { if (SECRET_KEY.test(name)) throw new Error('SEED_REPORT_SECRET_FIELD'); assertSafe(entry, name); });
  if (typeof value === 'string' && SECRET_VALUE.test(value)
    && !['operationId', 'owner', 'method', 'outcome', 'routeTemplate', 'stageId', 'stageIds', 'unmatchedHttpEvents', 'unmatchedDatabaseEvents', 'nonApiStageIds', 'expectedNonApiStageIds'].includes(key)
    && !/^\/[A-Za-z0-9._~{}:/-]+$/.test(value)
    && !/\{(?:password|token|mobile)\}/i.test(value)) {
    throw new Error(`SEED_REPORT_SECRET_VALUE:${key}`);
  }
}
