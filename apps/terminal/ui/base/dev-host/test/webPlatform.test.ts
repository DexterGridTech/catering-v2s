import {describe, expect, it} from 'vitest';
import {createProcessMemoryStateStoragePort} from '@catering-v2s/kernel-base-platform-ports';
import {resolveSecondarySurfaceAvailable, readDisplayInfo} from '@catering-v2s/kernel-base-display-context';
import {createWebDevicePort, createWebPlatformPorts, type SurfaceMode} from '../src';

describe('ui.base.dev-host Web platform bindings', () => {
  it('maps host mode to display count through the DevicePort seam', async () => {
    let mode: SurfaceMode = 'single';
    const device = createWebDevicePort(() => mode);
    expect(resolveSecondarySurfaceAvailable(await readDisplayInfo(device))).toBe(false);
    mode = 'dual';
    expect(resolveSecondarySurfaceAvailable(await readDisplayInfo(device))).toBe(true);
  });

  it('keeps network observation unavailable in the Web host', async () => {
    const device = createWebDevicePort(() => 'single');
    await expect(device.getNetworkStatus({timeoutMs: 1_000})).resolves.toMatchObject({
      status: 'unavailable',
      capability: 'getNetworkStatus',
    });
    await expect(
      device.subscribeNetworkStatus({timeoutMs: 1_000, listener: () => {}, onError: () => {}}),
    ).resolves.toMatchObject({
      status: 'unavailable',
      capability: 'subscribeNetworkStatus',
    });
    await expect(device.unsubscribeNetworkStatus({timeoutMs: 1_000, subscriptionId: 'network'})).resolves.toMatchObject(
      {
        status: 'unavailable',
        capability: 'unsubscribeNetworkStatus',
      },
    );
  });

  it('keeps secure persistence unavailable in the Web host', async () => {
    const storage = {
      length: 0,
      clear: () => undefined,
      getItem: () => null,
      key: () => null,
      removeItem: () => undefined,
      setItem: () => undefined,
    } satisfies Storage;
    await expect(
      createWebPlatformPorts(() => 'single', {storage}).persistSecure.read({key: 'secret'}),
    ).resolves.toMatchObject({
      status: 'unavailable',
    });
  });

  it('allows a preview app to provide an explicit process-memory protected seam', async () => {
    const storage = {
      length: 0,
      clear: () => undefined,
      getItem: () => null,
      key: () => null,
      removeItem: () => undefined,
      setItem: () => undefined,
    } satisfies Storage;
    const protectedStorage = createProcessMemoryStateStoragePort();
    const result = await createWebPlatformPorts(() => 'single', {storage, protectedStorage}).persistSecure.read({
      key: 'secret',
    });
    expect(result).toMatchObject({status: 'succeeded', value: {state: 'missing'}});
  });
});
