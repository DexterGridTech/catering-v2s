import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const generator = fileURLToPath(new URL('../generate/terminal-remote-control-protocol.mjs', import.meta.url));
const repoRoot = path.resolve(path.dirname(generator), '../..');

test('remote control protocol generator output matches the six-message contract', () => {
  const check = spawnSync(process.execPath, [generator, '--check'], {encoding: 'utf8'});
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /TERMINAL_REMOTE_PROTOCOL_CHECK=PASS/);

  const selfTest = spawnSync(process.execPath, [generator, '--self-test'], {encoding: 'utf8'});
  assert.equal(selfTest.status, 0, selfTest.stderr);
  assert.match(selfTest.stdout, /MESSAGES=6 ADDITIVE_ENUMS=6 CONFIGURED_OUTPUTS=PASS ROOT_ESCAPE=PASS/);
});

test('remote protocol --check rejects an empty configured output set', () => {
  const tempRoot = fs.mkdtempSync(path.join(repoRoot, '.runtime', 'remote-protocol-empty-output-'));
  try {
    const scriptPath = path.join(tempRoot, 'scripts/generate/terminal-remote-control-protocol.mjs');
    const contractPath = path.join(tempRoot, 'contracts/protocol/terminal-remote-control-protocol.json');
    fs.mkdirSync(path.dirname(scriptPath), {recursive: true});
    fs.mkdirSync(path.dirname(contractPath), {recursive: true});

    const source = fs.readFileSync(generator, 'utf8');
    const emptyOutputs = source.replace(/const outputPaths = \[[\s\S]*?\];/, 'const outputPaths = [];');
    assert.notEqual(emptyOutputs, source, 'empty-output mutation anchor must exist');
    fs.writeFileSync(scriptPath, emptyOutputs);
    fs.copyFileSync(path.resolve(repoRoot, 'contracts/protocol/terminal-remote-control-protocol.json'), contractPath);

    const check = spawnSync(process.execPath, [scriptPath, '--check'], {encoding: 'utf8'});
    assert.notEqual(check.status, 0);
    assert.match(check.stderr, /TERMINAL_REMOTE_PROTOCOL_OUTPUT_PATHS_EMPTY/);
    assert.doesNotMatch(check.stdout, /TERMINAL_REMOTE_PROTOCOL_CHECK=PASS/);
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
});
