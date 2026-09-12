import type {DevicePort} from '@catering-v2s/kernel-base-platform-ports'
import {createAndroidDevicePort} from '../src/implementations/androidDevice'
import {describe, expect, it, vi} from 'vitest'

const {requireNativeModuleMock} = vi.hoisted(() => ({requireNativeModuleMock: vi.fn()}))

vi.mock('expo-modules-core', () => ({requireNativeModule: requireNativeModuleMock}))

const nativeModule = requireNativeModuleMock

describe('createAndroidDevicePort', () => {
  it('maps native device/display snapshots and preserves the other typed unavailable capabilities', async () => {
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
        value: {displayCount: 2},
        completedAt: 123,
      })),
    })

    const port: DevicePort = createAndroidDevicePort()
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
    })
    await expect(port.getDisplayInfo({timeoutMs: 1_000})).resolves.toEqual({
      status: 'succeeded',
      value: {displayCount: 2},
      completedAt: 123,
    })
    await expect(port.getSystemStatus({timeoutMs: 1_000})).resolves.toMatchObject({
      status: 'unavailable',
      port: 'device',
      capability: 'getSystemStatus',
    })
    await expect(port.getPowerStatus({timeoutMs: 1_000})).resolves.toMatchObject({
      status: 'unavailable',
      port: 'device',
      capability: 'getPowerStatus',
    })
    await expect(port.subscribePowerStatus({
      timeoutMs: 1_000,
      listener: () => undefined,
      onError: () => undefined,
    })).resolves.toMatchObject({
      status: 'unavailable',
      port: 'device',
      capability: 'subscribePowerStatus',
    })
    await expect(port.unsubscribePowerStatus({
      timeoutMs: 1_000,
      subscriptionId: 'test-subscription',
    })).resolves.toMatchObject({
      status: 'unavailable',
      port: 'device',
      capability: 'unsubscribePowerStatus',
    })
  })

  it('turns a native bridge rejection into a typed failure instead of throwing', async () => {
    nativeModule.mockReturnValue({
      getDeviceInfo: vi.fn(async () => {
        throw new Error('bridge disconnected')
      }),
      getDisplayInfo: vi.fn(async () => {
        throw new Error('bridge disconnected')
      }),
    })

    await expect(createAndroidDevicePort().getDisplayInfo({timeoutMs: 1_000})).resolves.toEqual({
      status: 'failed',
      port: 'device',
      capability: 'getDisplayInfo',
      error: {
        code: 'DEVICE_DISPLAY_INFO_BRIDGE_FAILED',
        message: 'device display-info bridge failed',
        retryable: true,
      },
    })
    await expect(createAndroidDevicePort().getDeviceInfo({timeoutMs: 1_000})).resolves.toEqual({
      status: 'failed',
      port: 'device',
      capability: 'getDeviceInfo',
      error: {
        code: 'DEVICE_INFO_BRIDGE_FAILED',
        message: 'device-info bridge failed',
        retryable: true,
      },
    })
  })
})
