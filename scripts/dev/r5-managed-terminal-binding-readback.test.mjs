import assert from 'node:assert/strict';
import test from 'node:test';
import {parseManagedTerminalBindingReadback} from './r5-dev-runner.mjs';

const terminal = Object.freeze({
  name: '后厨多打印终端',
  terminal_ref: '123e4567-e89b-42d3-a456-426614174000',
  store_ref: '123e4567-e89b-42d3-a456-426614174001',
  terminal_status: 'ENABLED',
  binding_status: 'UNBOUND',
  generation: null,
  bound_device_id: null,
});

test('managed terminal binding readback returns scoped binding facts without a credential', () => {
  const result = parseManagedTerminalBindingReadback([terminal], [terminal.name]);
  assert.deepEqual(result, [{
    name: terminal.name,
    terminalRef: terminal.terminal_ref,
    storeRef: terminal.store_ref,
    terminalStatus: 'ENABLED',
    bindingStatus: 'UNBOUND',
    generation: null,
    boundDeviceId: null,
  }]);
  assert.equal(JSON.stringify(result).includes('credential'), false);
  assert.equal(JSON.stringify(result).includes('credential_digest'), false);
});

test('managed terminal binding readback keeps an active device id in memory and requires ended bindings to clear it', () => {
  const active = parseManagedTerminalBindingReadback([{
    ...terminal,
    binding_status: 'ACTIVE',
    generation: 3,
    bound_device_id: 'driver-device-1',
  }], [terminal.name]);
  assert.equal(active[0]?.boundDeviceId, 'driver-device-1');

  assert.throws(
    () => parseManagedTerminalBindingReadback([{
      ...terminal,
      binding_status: 'ENDED',
      generation: 4,
      bound_device_id: 'stale-device',
    }], [terminal.name]),
    /TERMINAL_ACCEPTANCE_BINDING_READBACK_INVALID/u,
  );
  assert.deepEqual(parseManagedTerminalBindingReadback([{
    ...terminal,
    binding_status: 'ENDED',
    generation: 4,
    bound_device_id: null,
  }], [terminal.name])[0], {
    name: terminal.name,
    terminalRef: terminal.terminal_ref,
    storeRef: terminal.store_ref,
    terminalStatus: 'ENABLED',
    bindingStatus: 'ENDED',
    generation: 4,
    boundDeviceId: null,
  });
});

test('managed terminal binding readback rejects absent, duplicate, active-shape, or unknown status facts', () => {
  const invalidRows = [
    [],
    [terminal, terminal],
    [{...terminal, binding_status: 'UNKNOWN'}],
    [{...terminal, binding_status: 'ACTIVE', generation: null}],
    [{...terminal, store_ref: 'not-a-uuid'}],
    [{...terminal, binding_status: 'ACTIVE', generation: 2, bound_device_id: null}],
    [{...terminal, binding_status: 'UNBOUND', generation: null, bound_device_id: 'unexpected'}],
  ];
  for (const rows of invalidRows) {
    assert.throws(
      () => parseManagedTerminalBindingReadback(rows, [terminal.name]),
      /TERMINAL_ACCEPTANCE_BINDING_READBACK_INVALID/u,
    );
  }
});
