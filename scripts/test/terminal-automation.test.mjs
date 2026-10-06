import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('terminal automation entry rejects invalid arguments before starting a managed run', () => {
  const result = spawnSync(process.execPath, ['scripts/test/terminal-automation.mjs', '--phase', 'invalid'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 2, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /TERMINAL_AUTOMATION_PHASE_INVALID/u);
  assert.doesNotMatch(result.stdout, /TERMINAL_AUTOMATION_RUN /u);
});
