import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {check, selfTest} from '../generate/terminal-client-api.mjs';

test('terminal API generation closes the face/tag operation set and rejects policy drift', () => {
  const result = check();
  assert.deepEqual(result.operationIds, ['activateTerminal', 'cancelTerminalActivation']);
  assert.deepEqual(result.outputs.map(output => output.operationIds), [['activateTerminal', 'cancelTerminalActivation']]);
  for (const output of result.outputs) {
    const source = fs.readFileSync(output.output, 'utf8');
    assert.doesNotMatch(source, /^import\s/m);
    assert.match(source, /errorCodes:/);
    assert.match(source, /idempotencyRequired:/);
    assert.match(source, /readonly queryParameters:/);
    assert.match(source, /category: "unknown-business-rejection"/);
    assert.match(source, /TerminalOperationDescriptor/);
    assert.match(source, /createTerminalApiClient/);
  }
  assert.match(fs.readFileSync(result.outputs[0].output, 'utf8'), /readonly "Authorization": string/);
  assert.match(fs.readFileSync(result.outputs[0].output, 'utf8'), /isTerminalActivationResult/);
  selfTest();
});
