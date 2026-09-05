import {requireNativeModule} from 'expo-modules-core'
import type {DeviceCall, DevicePort, DisplayInfo, PortFailure, PortResult} from '@catering-v2s/kernel-base-platform-ports'
import {unavailableDevicePort} from '@catering-v2s/kernel-base-platform-ports'

type NativeDeviceModule = Readonly<{
  getDisplayInfo: (timeoutMs: number) => Promise<NativeDisplayInfoResult>
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

const mapNativeResult = (result: NativeDisplayInfoResult): PortResult<DisplayInfo> => result

/**
 * Android is the owner of the synchronous DisplayManager read. Loading the
 * module is intentionally lazy so importing this package on Web remains
 * harmless; only the Android call crosses the native bridge.
 */
export const createAndroidDevicePort = (): DevicePort => Object.freeze({
  ...unavailableDevicePort,
  getDisplayInfo: async ({timeoutMs}: DeviceCall) => {
    try {
      const native = requireNativeModule<NativeDeviceModule>('TerminalDevice')
      return mapNativeResult(await native.getDisplayInfo(timeoutMs))
    } catch (_error) {
      return bridgeFailure()
    }
  },
})
