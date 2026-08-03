import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSeedReport, renderSeedReportMarkdown, writeSeedReport, writeSeedReportPair} from './seed-report.mjs';
import {mkdtempSync, readFileSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

const call = (durationMs, id = String(durationMs)) => ({stageId: 'stage-a', owner: 'organization', operationId: 'createThing', method: 'POST', routeTemplate: '/api/things/{id}', durationMs, correlationId: `corr-${id}`, requestId: `req-${id}`});
const event = (durationMs, id = String(durationMs), databaseOperationCount = 2) => ({runId: 'run-12345678', correlationId: `corr-${id}`, requestId: `req-${id}`, operationId: 'createThing', method: 'POST', routeTemplate: '/api/things/{id}', status: 201, outcome: 'SUCCEEDED', databaseOperationCount, databaseDurationMillis: durationMs});

test('aggregates one and many calls with min average max and DB metrics', () => {
  const report = buildSeedReport({runId: 'run-12345678', seedProfile: 'r5-full', startedAt: '2026-08-01T00:00:00Z', finishedAt: '2026-08-01T00:00:03Z', status: 'PASS', calls: [call(10, 'a'), call(30, 'b')], events: [event(10, 'a', 1), event(30, 'b', 3)]});
  assert.deepEqual(report.apiEndpoints[0].httpDurationMs, {average: 20, min: 10, max: 30});
  assert.deepEqual(report.apiEndpoints[0].databaseOperationCount, {average: 2, min: 1, max: 3});
  assert.equal(report.status, 'PASS');
});

test('missing completion event is fail-closed', () => {
  const report = buildSeedReport({runId: 'run-12345678', seedProfile: 'r5-full', startedAt: '2026-08-01T00:00:00Z', finishedAt: '2026-08-01T00:00:01Z', status: 'PASS', calls: [call(10)], events: []});
  assert.equal(report.status, 'FAIL');
  assert.equal(report.firstFailure, 'SEED_REPORT_INCOMPLETE');
});

test('server metadata drift is fail-closed without rejecting route placeholders', () => {
  const mismatched = {...event(10), operationId: 'differentOperation'};
  const report = buildSeedReport({runId: 'run-12345678', seedProfile: 'r5-full', startedAt: '2026-08-01T00:00:00Z', finishedAt: '2026-08-01T00:00:01Z', status: 'PASS', calls: [call(10)], events: [mismatched]});
  assert.equal(report.status, 'FAIL');
  assert.deepEqual(report.completeness.unmatchedHttpEvents, ['createThing']);
});

test('non-api stage set and atomic report permissions are fail-closed', () => {
  const report = buildSeedReport({runId: 'run-12345678', seedProfile: 'r5-full', startedAt: '2026-08-01T00:00:00Z', finishedAt: '2026-08-01T00:00:01Z', status: 'PASS', calls: [], events: [], nonApiStages: [{stageId: 'bootstrap', status: 'PASS', durationMs: 1}], expectedNonApiStageIds: ['bootstrap']});
  const directory = mkdtempSync(path.join(tmpdir(), 'seed-report-'));
  const reportPath = path.join(directory, 'seed-report.json');
  writeSeedReport(reportPath, report);
  assert.equal(statSync(reportPath).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(readFileSync(reportPath, 'utf8')), report);
  const mismatch = buildSeedReport({runId: 'run-12345678', seedProfile: 'r5-full', startedAt: '2026-08-01T00:00:00Z', finishedAt: '2026-08-01T00:00:01Z', status: 'PASS', calls: [], events: [], nonApiStages: [{stageId: 'unexpected', status: 'PASS', durationMs: 1}], expectedNonApiStageIds: ['bootstrap']});
  assert.equal(mismatch.status, 'FAIL');
  assert.equal(mismatch.firstFailure, 'SEED_REPORT_NON_API_STAGE_SET_MISMATCH');
});

test('human-readable markdown report is emitted beside machine JSON', () => {
  const report = buildSeedReport({runId: 'run-12345678', seedProfile: 'r5-full', startedAt: '2026-08-01T00:00:00Z', finishedAt: '2026-08-01T00:00:01Z', status: 'PASS', calls: [call(10)], events: [event(10, '10', 2)], nonApiStages: [{stageId: 'bootstrap', status: 'PASS', durationMs: 4}], expectedNonApiStageIds: ['bootstrap']});
  const directory = mkdtempSync(path.join(tmpdir(), 'seed-report-human-'));
  const jsonPath = path.join(directory, 'seed-report.json');
  writeSeedReportPair(jsonPath, report);
  const markdownPath = path.join(directory, 'seed-report.md');
  assert.equal(statSync(markdownPath).mode & 0o777, 0o600);
  const markdown = readFileSync(markdownPath, 'utf8');
  assert.match(markdown, /# Seed 报告/);
  assert.match(markdown, /结论：PASS/);
  assert.match(markdown, /createThing/);
  assert.match(markdown, /10 \/ 10 \/ 10/);
  assert.equal(renderSeedReportMarkdown(report), markdown);
  assert.deepEqual(JSON.parse(readFileSync(jsonPath, 'utf8')), report);
});

test('zero database operations remain valid when a completion event exists', () => {
  const report = buildSeedReport({runId: 'run-12345678', seedProfile: 'r5-full', startedAt: '2026-08-01T00:00:00Z', finishedAt: '2026-08-01T00:00:01Z', status: 'PASS', calls: [call(4)], events: [event(0, '4', 0)]});
  assert.equal(report.status, 'PASS');
  assert.deepEqual(report.apiEndpoints[0].databaseOperationCount, {average: 0, min: 0, max: 0});
});
