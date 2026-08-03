import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const runner = readFileSync(new URL('./r5-dev-runner.mjs', import.meta.url), 'utf8');
const seed = readFileSync(new URL('./owner-command-seed-executor.mjs', import.meta.url), 'utf8');

test('managed r5 DEV and formal seed require the non-production debug readback', () => {
  assert.match(runner, /const otpDebugExposure = true/);
  assert.match(runner, /CATERING_OTP_DEBUG_CODE_EXPOSURE: 'true'/);
  assert.doesNotMatch(runner, /V2S_R5_L2_OTP_DEBUG_EXPOSURE/);
  assert.match(seed, /manifest\.otpDebugExposure !== true/);
});
