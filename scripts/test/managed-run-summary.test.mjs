import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readManagedRunSummary, summarizeManagedRuns} from './managed-run-summary.mjs';

const manifest = (startedAt, completedAt, operation, status = 'PASS', failureCategory) => ({
  startedAt,
  completedAt,
  verificationMode: 'ACCEPTANCE',
  backendAcceptance: {operation},
  status,
  business: status === 'PASS' ? 'PASS' : 'FAIL',
  cleanup: {status: 'PASS'},
  ...(failureCategory ? {failureCategory} : {}),
});

test('summarizes run duration, wall-clock gaps, statuses, failures, and operation phases', () => {
  const summary = summarizeManagedRuns([
    manifest('2026-09-01T00:00:00.000Z', '2026-09-01T00:00:01.000Z', 'first'),
    manifest('2026-09-01T00:00:04.000Z', '2026-09-01T00:00:07.000Z', 'second', 'FAIL', 'BUSINESS_ORACLE'),
  ]);
  assert.equal(summary.runCount, 2);
  assert.equal(summary.recordedDurationCount, 2);
  assert.equal(summary.totalRunDurationMs, 4000);
  assert.equal(summary.medianRunDurationMs, 2000);
  assert.equal(summary.maxRunDurationMs, 3000);
  assert.equal(summary.wallClockSpanMs, 7000);
  assert.equal(summary.interRunGapMs, 3000);
  assert.equal(summary.recordedRunSharePercent, 57.14);
  assert.deepEqual(summary.failureCategories, {BUSINESS_ORACLE: 1, NONE: 1});
  assert.equal(summary.phaseStats.first.count, 1);
  assert.equal(summary.phaseStats.second.statuses.FAIL, 1);
});

test('reads direct run manifests and reports malformed entries without hiding them', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'managed-run-summary-'));
  mkdirSync(path.join(root, 'run-a'));
  writeFileSync(
    path.join(root, 'run-a', 'run-manifest.json'),
    JSON.stringify(manifest('2026-09-01T00:00:00.000Z', '2026-09-01T00:00:02.000Z', 'readable')),
  );
  mkdirSync(path.join(root, 'run-b'));
  writeFileSync(path.join(root, 'run-b', 'run-manifest.json'), '{not-json');
  const summary = readManagedRunSummary(root);
  assert.equal(summary.status, 'INCOMPLETE');
  assert.equal(summary.runCount, 1);
  assert.equal(summary.invalidManifestCount, 1);
});
