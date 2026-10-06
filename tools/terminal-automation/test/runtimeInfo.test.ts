import {describe, expect, it, vi} from 'vitest';
import type {AutomationDriverServer} from '../src/server.js';
import {readApplicationDeviceId} from '../src/runtimeInfo.js';

const serverWith = (response: unknown): AutomationDriverServer =>
  ({request: vi.fn(async () => response)}) as unknown as AutomationDriverServer;

describe('readApplicationDeviceId', () => {
  it('returns the identity reported by the app runtime', async () => {
    const server = serverWith({type: 'response', body: {result: {deviceIdentity: {available: true, deviceId: 'vm:01'}}}});
    await expect(readApplicationDeviceId(server, 'session-1')).resolves.toBe('vm:01');
    expect(server.request).toHaveBeenCalledWith('session-1', 'runtime.info', null);
  });

  it('rejects unavailable or malformed app identity without using host identity', async () => {
    await expect(
      readApplicationDeviceId(
        serverWith({type: 'response', body: {result: {deviceIdentity: {available: false, deviceId: null}}}}),
        'session-1',
      ),
    ).rejects.toThrow('TERMINAL_AUTOMATION_APPLICATION_DEVICE_ID_UNAVAILABLE');
  });

  it('preserves a typed runtime error as a safe error code', async () => {
    await expect(
      readApplicationDeviceId(serverWith({type: 'error', body: {code: 'RUNTIME_NOT_READY'}}), 'session-1'),
    ).rejects.toThrow('TERMINAL_AUTOMATION_RUNTIME_INFO_FAILED:RUNTIME_NOT_READY');
  });
});
