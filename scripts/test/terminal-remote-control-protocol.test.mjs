import {spawnSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const generator = fileURLToPath(new URL('../generate/terminal-remote-control-protocol.mjs', import.meta.url));

test('remote control protocol generator output matches the six-message contract', () => {
  const check = spawnSync(process.execPath, [generator, '--check'], {encoding: 'utf8'});
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /TERMINAL_REMOTE_PROTOCOL_CHECK=PASS/);

  const selfTest = spawnSync(process.execPath, [generator, '--self-test'], {encoding: 'utf8'});
  assert.equal(selfTest.status, 0, selfTest.stderr);
  assert.match(selfTest.stdout, /MESSAGES=6 ROOT_ESCAPE=PASS/);
});
