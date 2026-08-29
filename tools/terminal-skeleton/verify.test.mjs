import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolsDirectory, '../..');
const verifyPath = path.join(toolsDirectory, 'verify.mjs');
const fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-verify-marker-'));

try {
  const fakeYarnPath = path.join(fixtureDirectory, 'yarn');
  fs.writeFileSync(fakeYarnPath, '#!/usr/bin/env node\nprocess.exit(17);\n');
  fs.chmodSync(fakeYarnPath, 0o755);

  const result = spawnSync(process.execPath, [verifyPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {...process.env, PATH: `${fixtureDirectory}:${process.env.PATH}`},
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  assert.equal(result.status, 1, output);
  assert.match(output, /TERMINAL_VERIFY_FIRST_FAILURE:turbo-dry-typecheck:exit=17/);
  assert.doesNotMatch(output, /TERMINAL_VERIFY=PASS/);
} finally {
  fs.rmSync(fixtureDirectory, {recursive: true, force: true});
}

console.log('TERMINAL_VERIFY_MARKER_MODEL_TEST=PASS');
