import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {storeTerminalL2AdmissionStrategy} from './store-terminal-l2-admission.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const readJson = relativePath => JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));

test('admission control plane includes the shared locator proof while runtime profile stays generated', () => {
  const policy = readJson('contracts/policy/store-terminal-l2-admission.json');
  const bindings = readJson('contracts/policy/store-terminal-l2-locator-bindings.json');
  const focusedProofs = new Set(
    Object.values(bindings.controls)
      .map(binding => binding.focusedStaticProof)
      .filter(Boolean),
  );
  for (const proof of focusedProofs) assert.ok(policy.controlPlaneFiles.includes(proof), `L2_ADMISSION_PROOF_NOT_IN_DENOMINATOR:${proof}`);
  assert.equal(
    policy.controlPlaneFiles.includes('contracts/policy/store-terminal-l2-execution.json'),
    false,
    'L2_ADMISSION_RUNTIME_PROFILE_MUST_BE_RUN_SCOPED',
  );
  assert.equal(policy.controlPlaneFiles.length, 36, 'L2_ADMISSION_CONTROL_PLANE_COUNT_MUST_MATCH_CP06');
  for (const path of [
    'doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md',
    'doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md',
    'doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md',
    'apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalDeviceTypeField.tsx',
    'apps/frontend/operations-admin/src/features/store-terminal/ui/TerminalEditDrawer.tsx',
  ]) {
    assert.ok(policy.controlPlaneFiles.includes(path), `L2_ADMISSION_TERMINAL_ACTIVATION_INPUT_MISSING:${path}`);
  }
  assert.equal(
    policy.designPath,
    'doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md',
    'L2_ADMISSION_DESIGN_PATH_MUST_BIND_CURRENT_BATCH',
  );
});

test('admission red examples reject missing, blocked, and stale records', () => {
  const snapshot = storeTerminalL2AdmissionStrategy.computeAdmissionSnapshot();
  assert.throws(() => storeTerminalL2AdmissionStrategy.validateAdmissionRecord({snapshot, reviewText: ''}), /L2_SCRIPT_ADMISSION_REVIEW_TARGET_INVALID/);
  assert.throws(
    () => storeTerminalL2AdmissionStrategy.validateAdmissionRecord({snapshot, reviewText: 'REVIEW_TARGET=L2_SCRIPT_ADMISSION\nREVIEWER_KIND=INDEPENDENT_SUBAGENT\nL2_ADMISSION_REVIEW_STATUS=BLOCKED'}),
    /L2_SCRIPT_ADMISSION_REVIEW_NOT_PASS/,
  );
  assert.throws(
    () => storeTerminalL2AdmissionStrategy.validateAdmissionRecord({snapshot, reviewText: `REVIEW_TARGET=L2_SCRIPT_ADMISSION\nREVIEWER_KIND=INDEPENDENT_SUBAGENT\nL2_ADMISSION_REVIEW_STATUS=PASS\nADMISSION_SOURCE_DIGEST=${'0'.repeat(64)}`}),
    /L2_SCRIPT_ADMISSION_SOURCE_DRIFT/,
  );
});

test('unchanged same failure family is blocked, changed admission bytes are not', () => {
  const runtimeRoot = mkdtempSync(path.join(os.tmpdir(), 'v2s-store-terminal-l2-failure-family-'));
  try {
    const runDirectory = path.join(runtimeRoot, 'l2-old-run');
    mkdirSync(runDirectory, {recursive: true});
    writeFileSync(path.join(runDirectory, 'l2-execution-manifest.json'), `${JSON.stringify({
      kind: 'store-terminal-l2-execution-manifest',
      runId: 'l2-old-run',
      admissionDigest: 'admission-a',
      firstFailedCaseId: 'terminal-create-configuration',
      failureCategory: 'PLAYWRIGHT_ASSERTION',
      business: 'FAIL',
      cleanup: 'PASS',
    })}\n`);
    assert.throws(
      () => storeTerminalL2AdmissionStrategy.assertFailureFamilyOpen({runtimeRoot, admissionDigest: 'admission-a', activeCaseIds: ['terminal-create-configuration']}),
      /L2_FAILURE_FAMILY_RETRY_BLOCKED:terminal-create-configuration:PLAYWRIGHT_ASSERTION:l2-old-run/,
    );
    assert.doesNotThrow(() => storeTerminalL2AdmissionStrategy.assertFailureFamilyOpen({runtimeRoot, admissionDigest: 'admission-b', activeCaseIds: ['terminal-create-configuration']}));
  } finally {
    rmSync(runtimeRoot, {recursive: true, force: true});
  }
});
