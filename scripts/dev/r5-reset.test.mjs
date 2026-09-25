import assert from 'node:assert/strict';
import test from 'node:test';
import {assertSeedDryRunPass} from './r5-reset.mjs';

test('reset refuses before destructive execution when the complete seed dry-run fails', () => {
  let destructiveCall = false;
  assert.throws(
    () => {
      assertSeedDryRunPass({
        executor: () => ({status: 2, stdout: '', stderr: 'R5_COMPLETE_SEED_DRY_RUN=FAIL; FIRST_FAILURE=STATIC_PLAN'}),
      });
      destructiveCall = true;
    },
    /SEED_DRY_RUN_REQUIRED_BEFORE_RESET:STATIC_PLAN/,
  );
  assert.equal(destructiveCall, false);
});
