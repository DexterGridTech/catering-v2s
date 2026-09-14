import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts'
import {
  createPlatformPorts,
  createProcessMemoryStateStoragePort,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableDevicePort,
  unavailableHotUpdatePort,
  unavailableLogUploadPort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  type DeviceInfo,
  type DevicePort,
  type DisplayInfo,
  type LogEvent,
  type PlatformPorts,
  type PortResult,
  type StateStoragePort,
} from '@catering-v2s/kernel-base-platform-ports'

const success = <TValue>(value: TValue): PortResult<TValue> => ({
  status: 'succeeded',
  value,
  completedAt: nowTimestampMs(),
})

export const createTestPlatformPorts = (input: Readonly<{
  readonly displayCount?: number
  readonly deviceInfo?: DeviceInfo
  readonly events?: LogEvent[]
  readonly plainStorage?: StateStoragePort
  readonly protectedStorage?: StateStoragePort
}> = {}): PlatformPorts => {
  const events = input.events ?? []
  const device: DevicePort = {
    ...unavailableDevicePort,
    getDeviceInfo: async ({timeoutMs}) => input.deviceInfo === undefined
      ? unavailableDevicePort.getDeviceInfo({timeoutMs})
      : success(input.deviceInfo),
    getDisplayInfo: async (): Promise<PortResult<DisplayInfo>> =>
      success({displayCount: input.displayCount ?? 1}),
  }
  return createPlatformPorts({
    environmentMode: 'TEST',
    bindings: {
      logger: {kind: 'sink', write: (event: LogEvent) => { events.push(event) }},
      persistKv: input.plainStorage ?? createProcessMemoryStateStoragePort(),
      persistSecure: input.protectedStorage ?? createProcessMemoryStateStoragePort(),
      device,
      appControl: unavailableAppControlPort,
      script: unavailableScriptPort,
      connector: unavailableConnectorPort,
      hotUpdate: unavailableHotUpdatePort,
      logUpload: unavailableLogUploadPort,
      topologyHost: unavailableTopologyHostPort,
    },
  })
}
