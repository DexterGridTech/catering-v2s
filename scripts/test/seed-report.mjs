import {chmodSync, existsSync, readFileSync, renameSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';

const SECRET_KEY = /(?:password|secret|token|cookie|authorization|otp|mobile|login|account|payload|sql|bind)/i;
const SECRET_VALUE = /(?:password|secret|token|cookie|authorization|otp|jdbc:|postgres(?:ql)?:\/\/)/i;

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

function templateMatches(template, pathname) {
  const expression = `^${template.split('/').map((part) => part.startsWith('{') && part.endsWith('}') ? '[^/]+' : escapeRegExp(part)).join('/')}\/?$`;
  return new RegExp(expression).test(pathname);
}

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function buildSeedReport({runId, seedProfile, startedAt, finishedAt, status, calls, events, nonApiStages = [], expectedNonApiStageIds = null, firstFailure = null}) {
  const byRequest = new Map(events.filter((event) => event?.runId === runId && event.correlationId && event.requestId).map((event) => [`${event.correlationId}:${event.requestId}`, event]));
  const unmatchedHttpEvents = [];
  const unmatchedDatabaseEvents = [];
  const groups = new Map();
  for (const call of calls) {
    const key = `${call.correlationId ?? 'missing'}:${call.requestId ?? 'missing'}`;
    const event = byRequest.get(key);
    if (!event) { unmatchedHttpEvents.push(call.operationId ?? 'operation.unresolved'); continue; }
    if (event.operationId !== call.operationId || event.method !== call.method || event.routeTemplate !== call.routeTemplate) {
      unmatchedHttpEvents.push(call.operationId ?? 'operation.unresolved');
      continue;
    }
    const groupKey = `${call.owner}|${call.operationId}|${call.method}|${call.routeTemplate}`;
    const group = groups.get(groupKey) ?? {owner: call.owner, operationId: call.operationId, method: call.method, routeTemplate: call.routeTemplate, stageIds: new Set(), calls: [], events: []};
    group.stageIds.add(call.stageId);
    group.calls.push(call);
    group.events.push(event);
    groups.set(groupKey, group);
  }
  const consumed = new Set();
  const apiEndpoints = [...groups.values()].map((group) => {
    for (const event of group.events) consumed.add(`${event.correlationId}:${event.requestId}`);
    const http = group.calls.map((call) => call.durationMs);
    const dbCount = group.events.map((event) => event.databaseOperationCount);
    const dbDuration = group.events.map((event) => event.databaseDurationMillis);
    return {
      owner: group.owner,
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
  for (const event of events) {
    const key = `${event.correlationId}:${event.requestId}`;
    if (event.runId === runId && !consumed.has(key)) unmatchedDatabaseEvents.push(event.operationId ?? 'operation.unresolved');
  }
  const actualNonApiStageIds = nonApiStages.map((stage) => stage.stageId).sort();
  const expectedStages = expectedNonApiStageIds ? [...expectedNonApiStageIds].sort() : null;
  const nonApiStagesMatch = !expectedStages || JSON.stringify(actualNonApiStageIds) === JSON.stringify(expectedStages);
  const complete = unmatchedHttpEvents.length === 0 && unmatchedDatabaseEvents.length === 0 && calls.length === events.filter((event) => event?.runId === runId).length && calls.every((call) => call.correlationId && call.requestId) && nonApiStagesMatch;
  const report = {
    kind: 'r5-full-seed-report', schemaVersion: 1, runId, seedProfile, status: status === 'PASS' && complete ? 'PASS' : 'FAIL',
    startedAt, finishedAt, durationMs: Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime()),
    apiEndpoints, nonApiStages,
    completeness: {apiCallCount: calls.length, reportedApiCallCount: events.filter((event) => event?.runId === runId).length, endpointGroupCount: apiEndpoints.length, unmatchedHttpEvents, unmatchedDatabaseEvents, nonApiStageIds: actualNonApiStageIds, expectedNonApiStageIds: expectedStages},
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
    markdownTable(['Owner', 'Operation', 'Method', 'Route', '次数', 'HTTP ms（均/低/高）', 'DB 次数（均/低/高）', 'DB ms（均/低/高）', '结果'], endpointRows),
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

function safeFailure(value) { return String(value).replaceAll(/[^A-Z0-9_:. -]/g, '').slice(0, 256); }

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
