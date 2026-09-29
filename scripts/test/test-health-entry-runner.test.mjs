import assert from 'node:assert/strict';
import test from 'node:test';
import {runNodeTests} from './test-health-entry-runner.mjs';

test('Node test entry uses a bounded output buffer and reports the exact executed denominator', () => {
  let capturedOutput = '';
  let capturedArgs = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = chunk => {
    capturedOutput += String(chunk);
    return true;
  };

  try {
    const result = runNodeTests({
      spawnSyncImpl: (command, args, options) => {
        assert.equal(command, process.execPath);
        capturedArgs = args;
        assert.equal(options.maxBuffer, 64 * 1024 * 1024);
        return {status: 0, stdout: '', stderr: ''};
      },
    });
    assert.equal(result.status, 'PASS');
    assert.deepEqual(capturedArgs.slice(2), result.declared);
    assert.ok(result.declared.includes('scripts/test/test-health-entry-runner.test.mjs'));
    assert.match(capturedOutput, new RegExp(`EXECUTED_TEST_FILES=${result.declared.length}`));
  } finally {
    process.stdout.write = originalWrite;
  }
});

test('Node test entry does not convert a bounded-buffer overflow into success', () => {
  assert.throws(
    () =>
      runNodeTests({
        spawnSyncImpl: () => ({
          status: null,
          stdout: '',
          stderr: '',
          error: Object.assign(new Error('spawnSync maxBuffer exceeded'), {code: 'ENOBUFS'}),
        }),
      }),
    /THCL_NODE_TEST_ENTRY_SPAWN_FAILURE:ENOBUFS/,
  );
});
