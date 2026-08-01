import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = () => readFile(new URL('./PlatformPasswordChangeDrawer.tsx', import.meta.url), 'utf8');

test('password drawer keeps its own controls usable and never renders diagnostics or retained secrets', async () => {
  const source = await read();
  assert.match(source, /useOverlayLock\(open\);/);
  assert.doesNotMatch(source, /const locked = useOverlayLock\(open\)/);
  assert.match(source, /headers: \{'Idempotency-Key': submission\.getIdempotencyKey\(\)\}/);
  assert.match(source, /onSuccessClosed: onChanged/);
  assert.match(source, /lifecycle\.closeAfterSuccess\(\)/);
  assert.match(source, /clearSecrets\(\);\n      submission\.reset\(\);\n      setProblem/);
  assert.doesNotMatch(source, /description=\{problem\.detail\}/);
  assert.match(source, />保存<\/Button>/);
  assert.doesNotMatch(source, />确认修改<\/Button>/);
});
