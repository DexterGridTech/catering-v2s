import {requireNativeModule} from 'expo-modules-core'
import type {DeviceCall, DeviceInfo, DevicePort, DisplayInfo, PortFailure, PortResult} from '@catering-v2s/kernel-base-platform-ports'
import {unavailableDevicePort} from '@catering-v2s/kernel-base-platform-ports'

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor')

type NativeDeviceModule = Readonly<{
  getDeviceInfo: (timeoutMs: number) => Promise<NativeDeviceInfoResult>
  getDisplayInfo: (timeoutMs: number) => Promise<NativeDisplayInfoResult>
}>

type NativeDeviceInfoResult =
  | Readonly<{
      status: 'succeeded'
      value: DeviceInfo
      completedAt: number
    }>
  | Readonly<{
      status: 'unavailable'
      port: 'device'
      capability: 'getDeviceInfo'
      reason: 'ADAPTER_NOT_INJECTED' | 'PLATFORM_UNSUPPORTED'
      message: string
    }>
  | Readonly<{
      status: 'failed'
      port: 'device'
      capability: 'getDeviceInfo'
      error: Readonly<{
        code: string
        message: string
        retryable: boolean
      }>
    }>

type NativeDisplayInfoResult =
  | Readonly<{
      status: 'succeeded'
      value: DisplayInfo
      completedAt: number
    }>
  | Readonly<{
      status: 'unavailable'
      port: 'device'
      capability: 'getDisplayInfo'
      reason: 'ADAPTER_NOT_INJECTED' | 'PLATFORM_UNSUPPORTED'
      message: string
    }>
  | Readonly<{
      status: 'failed'
      port: 'device'
      capability: 'getDisplayInfo'
      error: Readonly<{
        code: string
        message: string
        retryable: boolean
      }>
    }>

const bridgeFailure = (): PortFailure => ({
  status: 'failed',
  port: 'device',
  capability: 'getDisplayInfo',
  error: {
    code: 'DEVICE_DISPLAY_INFO_BRIDGE_FAILED',
    message: 'device display-info bridge failed',
    retryable: true,
  },
})

const deviceInfoBridgeFailure = (): PortFailure => ({
  status: 'failed',
  port: 'device',
  capability: 'getDeviceInfo',
  error: {
    code: 'DEVICE_INFO_BRIDGE_FAILED',
    message: 'device-info bridge failed',
    retryable: true,
  },
})

const mapNativeResult = (result: NativeDisplayInfoResult): PortResult<DisplayInfo> => result

/**
 * Android is the owner of the synchronous DisplayManager read. Loading the
 * module is intentionally lazy so importing this package on Web remains
 * harmless; only the Android call crosses the native bridge.
 */
export const createAndroidDevicePort = (): DevicePort => {
  const port: DevicePort = {
    ...unavailableDevicePort,
    getDeviceInfo: async ({timeoutMs}: DeviceCall) => {
      try {
        const native = requireNativeModule<NativeDeviceModule>('TerminalDevice')
        return await native.getDeviceInfo(timeoutMs)
      } catch (_error) {
        return deviceInfoBridgeFailure()
      }
    },
    getDisplayInfo: async ({timeoutMs}: DeviceCall) => {
      try {
        const native = requireNativeModule<NativeDeviceModule>('TerminalDevice')
        return mapNativeResult(await native.getDisplayInfo(timeoutMs))
      } catch (_error) {
        return bridgeFailure()
      }
    },
  }
  if (__DEV__) {
    Object.defineProperty(port, PORT_DESCRIPTOR_KEY, {
    value: Object.freeze({
      port: 'device',
      capabilities: Object.freeze([
        Object.freeze({capability: 'getDeviceInfo', state: 'real' as const, source: 'adapter' as const}),
        Object.freeze({capability: 'getDisplayInfo', state: 'real' as const, source: 'adapter' as const}),
        Object.freeze({capability: 'getSystemStatus', state: 'unavailable' as const, source: 'default' as const}),
        Object.freeze({capability: 'getPowerStatus', state: 'unavailable' as const, source: 'default' as const}),
        Object.freeze({capability: 'subscribePowerStatus', state: 'unavailable' as const, source: 'default' as const}),
        Object.freeze({capability: 'unsubscribePowerStatus', state: 'unavailable' as const, source: 'default' as const}),
      ]),
    }),
    enumerable: false,
    writable: false,
    configurable: false,
    })
  }
  return Object.freeze(port)
}
