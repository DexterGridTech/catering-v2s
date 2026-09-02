import type {DevicePort, DisplayInfo} from '@catering-v2s/kernel-base-platform-ports'
import type {PortResult} from '@catering-v2s/kernel-base-platform-ports'

/**
 * A private bound for device calls made while a runtime is starting or while
 * an actor is deciding whether a role transition is safe.  It is deliberately
 * not part of the public port contract.
 */
export const displayDeviceTimeoutMs = 1_000

export type DisplayInfoRead =
  | Readonly<{status: 'valid'; displayCount: number}>
  | Readonly<{
      status: 'unavailable'
      portStatus: Exclude<PortResult<DisplayInfo>['status'], 'succeeded'>
      reason?: string
      capability?: string
      port?: string
      timeoutMs?: number
      errorCode?: string
    }>

  | Readonly<{
      status: 'malformed'
      portStatus: 'succeeded'
      valueType: string
    }>

type UnavailableDisplayInfo = Extract<DisplayInfoRead, {status: 'unavailable'}>

export const toDisplayInfoDiagnostic = (
  displayInfo: UnavailableDisplayInfo,
  statusKey: 'status' | 'portStatus' = 'status',
): Readonly<Record<string, string | number | null>> => ({
  [statusKey]: displayInfo.portStatus,
  reason: displayInfo.reason ?? null,
  capability: displayInfo.capability ?? null,
  timeoutMs: displayInfo.timeoutMs ?? null,
  errorCode: displayInfo.errorCode ?? null,
})

export const isValidDisplayCount = (value: unknown): value is number =>
  typeof value === 'number'
  && Number.isFinite(value)
  && Number.isInteger(value)
  && value >= 1

export const readDisplayInfo = async (device: DevicePort): Promise<DisplayInfoRead> => {
  const result = await device.getDisplayInfo({timeoutMs: displayDeviceTimeoutMs})
  if (result.status !== 'succeeded') {
    if (result.status === 'failed') {
      return Object.freeze({
        status: 'unavailable' as const,
        portStatus: result.status,
        port: result.port,
        capability: result.capability,
        errorCode: result.error.code,
      })
    }
    if (result.status === 'timed-out') {
      return Object.freeze({
        status: 'unavailable' as const,
        portStatus: result.status,
        port: result.port,
        capability: result.capability,
        timeoutMs: result.timeoutMs,
      })
    }
    return Object.freeze({
      status: 'unavailable' as const,
      portStatus: result.status,
      port: result.port,
      capability: result.capability,
      reason: result.reason,
    })
  }
  const value = result.value
  const displayCount = typeof value === 'object' && value !== null
    ? Reflect.get(value, 'displayCount')
    : undefined
  if (!isValidDisplayCount(displayCount)) {
    return Object.freeze({
      status: 'malformed' as const,
      portStatus: result.status,
      valueType: typeof displayCount,
    })
  }
  return Object.freeze({status: 'valid', displayCount})
}
