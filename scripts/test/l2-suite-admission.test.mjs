import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {catalogInventoryL2AdmissionStrategy} from './catalog-inventory-l2-admission.mjs';

const validReview = digest => [
  'REVIEW_TARGET=L2_SCRIPT_ADMISSION',
  'REVIEWER_KIND=INDEPENDENT_SUBAGENT',
  'L2_ADMISSION_REVIEW_STATUS=PASS',
  `ADMISSION_SOURCE_DIGEST=${digest}`,
].join('\n');

test('every L2 suite uses the generic admission and failure-family boundary', () => {
  const source = readFileSync(new URL('./browser-l2-runtime.mjs', import.meta.url), 'utf8');
  assert.equal((source.match(/admissionStrategy:/g) ?? []).length, 3);
  assert.match(source, /suiteAdmissionStrategy\(suite\)/);
  assert.match(source, /\.assertFailureFamilyOpen\(/);
});

test('generic admission red cases reject missing, blocked, stale and unchanged failure reruns', () => {
  const strategy = catalogInventoryL2AdmissionStrategy;
  const snapshot = strategy.computeAdmissionSnapshot();
  assert.throws(
    () => strategy.validateAdmissionRecord({snapshot, reviewText: ''}),
    error => error.code === 'L2_SCRIPT_ADMISSION_REVIEW_TARGET_INVALID',
  );
  assert.throws(
    () => strategy.validateAdmissionRecord({snapshot, reviewText: 'REVIEW_TARGET=L2_SCRIPT_ADMISSION\nREVIEWER_KIND=INDEPENDENT_SUBAGENT\nADMISSION_SOURCE_DIGEST=old'}),
    error => error.code === 'L2_SCRIPT_ADMISSION_REVIEW_NOT_PASS',
  );
  assert.throws(
    () => strategy.validateAdmissionRecord({snapshot, reviewText: validReview('changed-bytes')}),
    error => error.code === 'L2_SCRIPT_ADMISSION_SOURCE_DRIFT',
  );

  const runtimeRoot = mkdtempSync(path.join(os.tmpdir(), 'v2s-l2-admission-'));
  try {
    const runDirectory = path.join(runtimeRoot, 'l2-catalog-failed');
    mkdirSync(runDirectory, {recursive: true});
    writeFileSync(path.join(runDirectory, 'l2-execution-manifest.json'), JSON.stringify({
      kind: 'catalog-inventory-l2-execution-manifest',
      runId: 'l2-catalog-failed',
      admissionDigest: snapshot.admissionDigest,
      firstFailedCaseId: snapshot.caseIds[0],
      failureCategory: 'UI_ASSERTION',
      business: 'FAIL',
      cleanup: 'PASS',
    }));
    assert.throws(
      () => strategy.assertFailureFamilyOpen({
        runtimeRoot,
        admissionDigest: snapshot.admissionDigest,
        focusedCaseId: snapshot.caseIds[0],
      }),
      error => error.code === 'L2_FAILURE_FAMILY_RETRY_BLOCKED',
    );

    writeFileSync(path.join(runDirectory, 'l2-execution-manifest.json'), JSON.stringify({
      kind: 'catalog-inventory-l2-execution-manifest',
      runId: 'l2-catalog-focused-failed',
      admissionDigest: snapshot.admissionDigest,
      firstFailedCaseId: snapshot.caseIds[0],
      failureCategory: 'UI_ASSERTION',
      status: 'FAIL',
      executionMode: 'FOCUSED_DIAGNOSTIC',
      business: 'NOT_RUN',
      cleanup: 'PASS',
    }));
    assert.throws(
      () => strategy.assertFailureFamilyOpen({
        runtimeRoot,
        admissionDigest: snapshot.admissionDigest,
        focusedCaseId: snapshot.caseIds[0],
      }),
      error => error.code === 'L2_FAILURE_FAMILY_RETRY_BLOCKED',
      'focused diagnostic failures must close the same failure family',
    );
  } finally {
    rmSync(runtimeRoot, {recursive: true, force: true});
  }
});
