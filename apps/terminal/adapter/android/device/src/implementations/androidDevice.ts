import {LegacyEventEmitter, requireNativeModule, type EventSubscription} from 'expo-modules-core'
import type {
  DeviceCall,
  DeviceInfo,
  DevicePort,
  DisplayInfo,
  NoOutput,
  PortFailure,
  PortResult,
  PowerStatus,
  PowerStatusChanged,
  PowerStatusSubscriptionInput,
  PowerStatusUnsubscribeInput,
} from '@catering-v2s/kernel-base-platform-ports'
import {unavailableDevicePort} from '@catering-v2s/kernel-base-platform-ports'

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor')

type NativeDeviceModule = Readonly<{
  addListener: (eventName: string) => unknown
  getDeviceInfo: (timeoutMs: number) => Promise<NativeDeviceInfoResult>
  getDisplayInfo: (timeoutMs: number) => Promise<NativeDisplayInfoResult>
  getPowerStatus: (timeoutMs: number) => Promise<NativePowerStatusResult>
  subscribePowerStatus: (timeoutMs: number) => Promise<NativePowerSubscriptionResult>
  unsubscribePowerStatus: (subscriptionId: string, timeoutMs: number) => Promise<NativePowerUnsubscribeResult>
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

type NativePowerStatusResult = PortResult<PowerStatus>
type NativePowerSubscriptionResult = PortResult<{readonly subscriptionId: string}>
type NativePowerUnsubscribeResult = PortResult<NoOutput>

type NativePowerStatusEvent = Readonly<PowerStatusChanged & {
  readonly subscriptionId: string
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

const powerStatusBridgeFailure = (capability: string, code: string, message: string): PortFailure => ({
  status: 'failed',
  port: 'device',
  capability,
  error: {code, message, retryable: true},
})

const mapNativeResult = (result: NativeDisplayInfoResult): PortResult<DisplayInfo> => result

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isPowerStatus = (value: unknown): value is PowerStatus => {
  if (!isRecord(value)) return false
  if (value.source !== 'external' && value.source !== 'battery' && value.source !== 'unknown') return false
  if (value.charging !== 'charging' && value.charging !== 'not-charging' && value.charging !== 'unknown') return false
  return value.levelRatio === undefined
    || (typeof value.levelRatio === 'number' && Number.isFinite(value.levelRatio) && value.levelRatio >= 0 && value.levelRatio <= 1)
}

const readPowerStatusEvent = (value: unknown): NativePowerStatusEvent | null => {
  if (!isRecord(value) || typeof value.subscriptionId !== 'string' || !isPowerStatus(value.status)) return null
  if (typeof value.observedAt !== 'number' || !Number.isFinite(value.observedAt)) return null
  return value as NativePowerStatusEvent
}

const reportInitialPowerStatus = (
  result: NativePowerStatusResult,
  listener: PowerStatusSubscriptionInput['listener'],
  onError: PowerStatusSubscriptionInput['onError'],
): void => {
  switch (result.status) {
    case 'succeeded':
      listener({status: result.value, observedAt: result.completedAt})
      return
    case 'failed':
      onError(result.error)
      return
    case 'timed-out':
      onError({code: 'POWER_STATUS_INITIAL_READ_TIMED_OUT', message: 'initial power status read timed out', retryable: true})
      return
    case 'unavailable':
      onError({code: `POWER_STATUS_INITIAL_READ_${result.reason}`, message: result.message, retryable: false})
      return
  }
}

/**
 * Android is the owner of the synchronous DisplayManager read. Loading the
 * module is intentionally lazy so importing this package on Web remains
 * harmless; only the Android call crosses the native bridge.
 */
export const createAndroidDevicePort = (): DevicePort => {
  let nativeEmitter: LegacyEventEmitter | null = null
  const nativeSubscriptions = new Map<string, EventSubscription>()
  const getNativeModule = (): NativeDeviceModule => requireNativeModule<NativeDeviceModule>('TerminalDevice')
  const getNativeEmitter = (): LegacyEventEmitter => {
    if (nativeEmitter === null) nativeEmitter = new LegacyEventEmitter(getNativeModule())
    return nativeEmitter
  }
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
    getPowerStatus: async ({timeoutMs}: DeviceCall) => {
      try {
        return await getNativeModule().getPowerStatus(timeoutMs)
      } catch (_error) {
        return powerStatusBridgeFailure('getPowerStatus', 'DEVICE_POWER_STATUS_BRIDGE_FAILED', 'device power-status bridge failed')
      }
    },
    subscribePowerStatus: async ({timeoutMs, listener, onError}: PowerStatusSubscriptionInput) => {
      const nativeEventSubscription = getNativeEmitter().addListener('onPowerStatusChanged', value => {
        const event = readPowerStatusEvent(value)
        if (event === null) {
          onError({code: 'POWER_STATUS_EVENT_INVALID', message: 'power status event shape is invalid', retryable: false})
          return
        }
        if (!nativeSubscriptions.has(event.subscriptionId)) return
        listener({status: event.status, observedAt: event.observedAt})
      }) as EventSubscription
      try {
        const result = await getNativeModule().subscribePowerStatus(timeoutMs)
        if (result.status !== 'succeeded') {
          nativeEventSubscription.remove()
          return result
        }
        nativeSubscriptions.set(result.value.subscriptionId, nativeEventSubscription)
        try {
          const initial = await getNativeModule().getPowerStatus(timeoutMs)
          reportInitialPowerStatus(initial, listener, onError)
        } catch (_error) {
          onError({code: 'DEVICE_POWER_STATUS_INITIAL_READ_BRIDGE_FAILED', message: 'device power-status initial read bridge failed', retryable: true})
        }
        return result
      } catch (_error) {
        nativeEventSubscription.remove()
        return powerStatusBridgeFailure(
          'subscribePowerStatus',
          'DEVICE_POWER_STATUS_SUBSCRIPTION_BRIDGE_FAILED',
          'device power-status subscription bridge failed',
        )
      }
    },
    unsubscribePowerStatus: async ({subscriptionId, timeoutMs}: PowerStatusUnsubscribeInput) => {
      try {
        const result = await getNativeModule().unsubscribePowerStatus(subscriptionId, timeoutMs)
        if (result.status === 'succeeded') {
          nativeSubscriptions.get(subscriptionId)?.remove()
          nativeSubscriptions.delete(subscriptionId)
        }
        return result
      } catch (_error) {
        return powerStatusBridgeFailure(
          'unsubscribePowerStatus',
          'DEVICE_POWER_STATUS_UNSUBSCRIPTION_BRIDGE_FAILED',
          'device power-status unsubscription bridge failed',
        )
      }
    },
  }
  Object.defineProperty(port, PORT_DESCRIPTOR_KEY, {
      value: Object.freeze({
        port: 'device',
        capabilities: Object.freeze([
          Object.freeze({capability: 'getDeviceInfo', state: 'real' as const, source: 'adapter' as const}),
          Object.freeze({capability: 'getDisplayInfo', state: 'real' as const, source: 'adapter' as const}),
          Object.freeze({capability: 'getSystemStatus', state: 'unavailable' as const, source: 'default' as const}),
          Object.freeze({capability: 'getPowerStatus', state: 'real' as const, source: 'adapter' as const}),
          Object.freeze({capability: 'subscribePowerStatus', state: 'real' as const, source: 'adapter' as const}),
          Object.freeze({capability: 'unsubscribePowerStatus', state: 'real' as const, source: 'adapter' as const}),
        ]),
      }),
      enumerable: false,
      writable: false,
      configurable: false,
    })
  return Object.freeze(port)
}
