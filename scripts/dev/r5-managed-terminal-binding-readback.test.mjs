import assert from 'node:assert/strict';
import test from 'node:test';
import {parseManagedTerminalBindingReadback} from './r5-dev-runner.mjs';

const terminal = Object.freeze({
  name: '后厨多打印终端',
  terminal_ref: '123e4567-e89b-42d3-a456-426614174000',
  terminal_status: 'ENABLED',
  binding_status: 'UNBOUND',
  generation: null,
});

test('managed terminal binding readback returns only terminal identity and binding facts', () => {
  const result = parseManagedTerminalBindingReadback([terminal], [terminal.name]);
  assert.deepEqual(result, [{
    name: terminal.name,
    terminalRef: terminal.terminal_ref,
    terminalStatus: 'ENABLED',
    bindingStatus: 'UNBOUND',
    generation: null,
  }]);
  assert.equal(JSON.stringify(result).includes('credential'), false);
  assert.equal(JSON.stringify(result).includes('device'), false);
});

test('managed terminal binding readback rejects absent, duplicate, active-shape, or unknown status facts', () => {
  const invalidRows = [
    [],
    [terminal, terminal],
    [{...terminal, binding_status: 'UNKNOWN'}],
    [{...terminal, binding_status: 'ACTIVE', generation: null}],
  ];
  for (const rows of invalidRows) {
    assert.throws(
      () => parseManagedTerminalBindingReadback(rows, [terminal.name]),
      /TERMINAL_ACCEPTANCE_BINDING_READBACK_INVALID/u,
    );
  }
});
