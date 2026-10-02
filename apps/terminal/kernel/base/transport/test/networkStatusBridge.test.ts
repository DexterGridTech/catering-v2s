import {describe, expect, it, vi} from 'vitest';
import type {DevicePort, NetworkStatusChanged, PortResult} from '@catering-v2s/kernel-base-platform-ports';
import {createTransportNetworkStatusBridge} from '../src/index';

const unavailable = (capability: string) =>
  ({
    status: 'unavailable',
    port: 'device',
    capability,
    reason: 'PLATFORM_UNSUPPORTED',
    message: `device.${capability} is unavailable`,
  }) as const;

const success = <T>(value: T): PortResult<T> => ({status: 'succeeded', value, completedAt: 1});
const unsuccessfulUnsubscribes: readonly Readonly<{name: string; result: PortResult<{readonly completed: true}>}>[] = [
  {
    name: 'failed',
    result: {
      status: 'failed',
      port: 'device',
      capability: 'unsubscribeNetworkStatus',
      error: {code: 'OS_FAILURE', message: 'failed', retryable: true},
    },
  },
  {
    name: 'timed-out',
    result: {status: 'timed-out', port: 'device', capability: 'unsubscribeNetworkStatus', timeoutMs: 100},
  },
  {name: 'unavailable', result: unavailable('unsubscribeNetworkStatus')},
];

describe('transport network status bridge', () => {
  it('uses the read as a seed and dispatches only observed transitions', async () => {
    let listener: ((event: NetworkStatusChanged) => void) | undefined;
    const unsubscribe = vi.fn(async () => success({completed: true}));
    const device = {
      getNetworkStatus: vi.fn(async () => success({connected: true})),
      subscribeNetworkStatus: vi.fn(async (input: {listener: (event: NetworkStatusChanged) => void}) => {
        listener = input.listener;
        return success({subscriptionId: 'network-1'});
      }),
      unsubscribeNetworkStatus: unsubscribe,
    } as unknown as DevicePort;
    const transitions: Array<{connected: boolean; observedAt: number}> = [];

    const bridge = await createTransportNetworkStatusBridge({
      device,
      timeoutMs: 100,
      dispatchTransition: async transition => {
        transitions.push(transition);
      },
    });

    listener?.({status: {connected: true}, observedAt: 2});
    listener?.({status: {connected: false}, observedAt: 3});
    listener?.({status: {connected: false}, observedAt: 4});
    expect(bridge.installed).toBe(true);
    expect(transitions).toEqual([{connected: false, observedAt: 3}]);

    await bridge.dispose();
    listener?.({status: {connected: true}, observedAt: 5});
    expect(unsubscribe).toHaveBeenCalledWith({subscriptionId: 'network-1', timeoutMs: 100});
    expect(transitions).toHaveLength(1);
  });

  it('treats the first notification as a seed when the initial read fails', async () => {
    let listener: ((event: NetworkStatusChanged) => void) | undefined;
    const device = {
      getNetworkStatus: vi.fn(async () => unavailable('getNetworkStatus')),
      subscribeNetworkStatus: vi.fn(async (input: {listener: (event: NetworkStatusChanged) => void}) => {
        listener = input.listener;
        return success({subscriptionId: 'network-2'});
      }),
      unsubscribeNetworkStatus: vi.fn(async () => success({completed: true})),
    } as unknown as DevicePort;
    const transitions: Array<{connected: boolean; observedAt: number}> = [];

    const bridge = await createTransportNetworkStatusBridge({
      device,
      timeoutMs: 100,
      dispatchTransition: async transition => {
        transitions.push(transition);
      },
    });
    listener?.({status: {connected: false}, observedAt: 1});
    listener?.({status: {connected: false}, observedAt: 2});
    listener?.({status: {connected: true}, observedAt: 3});

    expect(bridge.installed).toBe(true);
    expect(transitions).toEqual([{connected: true, observedAt: 3}]);
    await bridge.dispose();
  });

  it('does not install when both network read and subscription are unavailable', async () => {
    const device = {
      getNetworkStatus: vi.fn(async () => unavailable('getNetworkStatus')),
      subscribeNetworkStatus: vi.fn(async () => unavailable('subscribeNetworkStatus')),
      unsubscribeNetworkStatus: vi.fn(),
    } as unknown as DevicePort;
    const dispatchTransition = vi.fn(async () => undefined);

    const bridge = await createTransportNetworkStatusBridge({device, timeoutMs: 100, dispatchTransition});

    expect(bridge.installed).toBe(false);
    await bridge.dispose();
    expect(dispatchTransition).not.toHaveBeenCalled();
    expect(device.unsubscribeNetworkStatus).not.toHaveBeenCalled();
  });

  it.each(unsuccessfulUnsubscribes)(
    'surfaces $name and retains the subscription identity for cleanup retry',
    async ({result}) => {
      const unsubscribe = vi
        .fn()
        .mockResolvedValueOnce(result)
        .mockResolvedValueOnce(success({completed: true}));
      const device = {
        getNetworkStatus: vi.fn(async () => success({connected: true})),
        subscribeNetworkStatus: vi.fn(async () => success({subscriptionId: 'network-retry'})),
        unsubscribeNetworkStatus: unsubscribe,
      } as unknown as DevicePort;
      const bridge = await createTransportNetworkStatusBridge({
        device,
        timeoutMs: 100,
        dispatchTransition: async () => undefined,
      });

      await expect(bridge.dispose()).rejects.toThrow('TRANSPORT_NETWORK_STATUS_UNSUBSCRIBE_FAILED');
      await bridge.dispose();
      await bridge.dispose();

      expect(unsubscribe).toHaveBeenCalledTimes(2);
      expect(unsubscribe).toHaveBeenNthCalledWith(1, {subscriptionId: 'network-retry', timeoutMs: 100});
      expect(unsubscribe).toHaveBeenNthCalledWith(2, {subscriptionId: 'network-retry', timeoutMs: 100});
    },
  );
});
