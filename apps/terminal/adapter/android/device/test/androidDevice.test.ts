import type {DevicePort} from '@catering-v2s/kernel-base-platform-ports';
import {createAndroidDevicePort} from '../src/implementations/androidDevice';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const {requireNativeModuleMock, eventListeners} = vi.hoisted(() => ({
  requireNativeModuleMock: vi.fn(),
  eventListeners: [] as Array<(value: unknown) => void>,
}));

vi.mock('expo-modules-core', () => ({
  requireNativeModule: (...args: unknown[]) => {
    const module = requireNativeModuleMock(...args) as Record<string, unknown>;
    return {
      ...module,
      addListener: (_eventName: string, listener: (value: unknown) => void) => {
        eventListeners.push(listener);
        return {
          remove: () => {
            const index = eventListeners.indexOf(listener);
            if (index >= 0) eventListeners.splice(index, 1);
          },
        };
      },
    };
  },
}));

const nativeModule = requireNativeModuleMock;

describe('createAndroidDevicePort', () => {
  beforeEach(() => {
    nativeModule.mockReset();
    eventListeners.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps native device/display/power snapshots and forwards power events', async () => {
    nativeModule.mockReturnValue({
      getDeviceInfo: vi.fn(async () => ({
        status: 'succeeded' as const,
        value: {
          deviceId: 'DEVICE-001',
          manufacturer: 'Example',
          model: 'Terminal',
          systemName: 'Android',
          systemVersion: '15',
          logicalProcessorCount: 8,
        },
        completedAt: 122,
      })),
      getDisplayInfo: vi.fn(async () => ({
        status: 'succeeded' as const,
        value: {
          displayCount: 2,
          surfaces: [
            {
              displayId: 0,
              role: 'primary' as const,
              logicalSize: {width: 1280, height: 800},
              physicalSize: {width: 1920, height: 1200},
              readiness: 'ready' as const,
            },
            {
              displayId: 1,
              role: 'secondary' as const,
              logicalSize: {width: 1920, height: 1080},
              physicalSize: null,
              readiness: 'loading' as const,
            },
          ],
        },
        completedAt: 123,
      })),
      getPowerStatus: vi.fn(async () => ({
        status: 'succeeded' as const,
        value: {source: 'external' as const, charging: 'charging' as const, levelRatio: 0.75},
        completedAt: 124,
      })),
      subscribePowerStatus: vi.fn(async () => ({
        status: 'succeeded' as const,
        value: {subscriptionId: 'power-subscription'},
        completedAt: 125,
      })),
      unsubscribePowerStatus: vi.fn(async () => ({
        status: 'succeeded' as const,
        value: {completed: true as const},
        completedAt: 126,
      })),
    });

    const port: DevicePort = createAndroidDevicePort();
    await expect(port.getDeviceInfo({timeoutMs: 1_000})).resolves.toEqual({
      status: 'succeeded',
      value: {
        deviceId: 'DEVICE-001',
        manufacturer: 'Example',
        model: 'Terminal',
        systemName: 'Android',
        systemVersion: '15',
        logicalProcessorCount: 8,
      },
      completedAt: 122,
    });
    await expect(port.getDisplayInfo({timeoutMs: 1_000})).resolves.toEqual({
      status: 'succeeded',
      value: {
        displayCount: 2,
        surfaces: [
          {
            displayId: 0,
            role: 'primary',
            logicalSize: {width: 1280, height: 800},
            physicalSize: {width: 1920, height: 1200},
            readiness: 'ready',
          },
          {
            displayId: 1,
            role: 'secondary',
            logicalSize: {width: 1920, height: 1080},
            physicalSize: null,
            readiness: 'loading',
          },
        ],
      },
      completedAt: 123,
    });
    await expect(port.getPowerStatus({timeoutMs: 1_000})).resolves.toEqual({
      status: 'succeeded',
      value: {source: 'external', charging: 'charging', levelRatio: 0.75},
      completedAt: 124,
    });
    await expect(port.getSystemStatus({timeoutMs: 1_000})).resolves.toMatchObject({
      status: 'unavailable',
      port: 'device',
      capability: 'getSystemStatus',
    });
    const events: Array<{readonly source: string; readonly charging: string}> = [];
    const errors: unknown[] = [];
    await expect(
      port.subscribePowerStatus({
        timeoutMs: 1_000,
        listener: event => events.push({source: event.status.source, charging: event.status.charging}),
        onError: error => errors.push(error),
      }),
    ).resolves.toMatchObject({status: 'succeeded', value: {subscriptionId: 'power-subscription'}});
    expect(eventListeners).toHaveLength(1);
    eventListeners[0]?.({
      subscriptionId: 'power-subscription',
      status: {source: 'battery', charging: 'not-charging'},
      observedAt: 127,
    });
    eventListeners[0]?.({
      subscriptionId: 'another-subscription',
      status: {source: 'external', charging: 'charging'},
      observedAt: 128,
    });
    eventListeners[0]?.({subscriptionId: 'power-subscription', status: {source: 'invalid'}, observedAt: 129});
    expect(events).toEqual([
      {source: 'external', charging: 'charging'},
      {source: 'battery', charging: 'not-charging'},
    ]);
    expect(errors).toMatchObject([{code: 'POWER_STATUS_EVENT_INVALID'}]);
    await expect(
      port.unsubscribePowerStatus({
        timeoutMs: 1_000,
        subscriptionId: 'power-subscription',
      }),
    ).resolves.toMatchObject({status: 'succeeded', value: {completed: true}});
    expect(eventListeners).toHaveLength(0);
  });

  it('turns a native bridge rejection into a typed failure instead of throwing', async () => {
    nativeModule.mockReturnValue({
      getDeviceInfo: vi.fn(async () => {
        throw new Error('bridge disconnected');
      }),
      getDisplayInfo: vi.fn(async () => {
        throw new Error('bridge disconnected');
      }),
      getPowerStatus: vi.fn(async () => {
        throw new Error('bridge disconnected');
      }),
      subscribePowerStatus: vi.fn(async () => {
        throw new Error('bridge disconnected');
      }),
      unsubscribePowerStatus: vi.fn(async () => {
        throw new Error('bridge disconnected');
      }),
    });

    await expect(createAndroidDevicePort().getDisplayInfo({timeoutMs: 1_000})).resolves.toEqual({
      status: 'failed',
      port: 'device',
      capability: 'getDisplayInfo',
      error: {
        code: 'DEVICE_DISPLAY_INFO_BRIDGE_FAILED',
        message: 'device display-info bridge failed',
        retryable: true,
      },
    });
    await expect(createAndroidDevicePort().getDeviceInfo({timeoutMs: 1_000})).resolves.toEqual({
      status: 'failed',
      port: 'device',
      capability: 'getDeviceInfo',
      error: {
        code: 'DEVICE_INFO_BRIDGE_FAILED',
        message: 'device-info bridge failed',
        retryable: true,
      },
    });
    await expect(createAndroidDevicePort().getPowerStatus({timeoutMs: 1_000})).resolves.toEqual({
      status: 'failed',
      port: 'device',
      capability: 'getPowerStatus',
      error: {
        code: 'DEVICE_POWER_STATUS_BRIDGE_FAILED',
        message: 'device power-status bridge failed',
        retryable: true,
      },
    });
  });
});
