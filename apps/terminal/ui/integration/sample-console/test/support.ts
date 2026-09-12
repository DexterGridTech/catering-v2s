import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts'
import {
  createPlatformPorts,
  createProcessMemoryStateStoragePort,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableHotUpdatePort,
  unavailableLogUploadPort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  unavailableDevicePort,
  type DevicePort,
  type DeviceInfo,
  type DisplayInfo,
  type LogEvent,
  type PlatformPorts,
  type PortResult,
} from '@catering-v2s/kernel-base-platform-ports'

export class FakeWebStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length(): number { return this.values.size }
  clear(): void { this.values.clear() }
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null }
  removeItem(key: string): void { this.values.delete(key) }
  setItem(key: string, value: string): void { this.values.set(key, value) }
}

const success = <TValue>(value: TValue): PortResult<TValue> => ({
  status: 'succeeded',
  value,
  completedAt: nowTimestampMs(),
})

export const createTestPlatformPorts = (input: Readonly<{
  readonly displayCount?: number
  readonly deviceInfo?: DeviceInfo
  readonly onGetDeviceInfo?: () => void
  readonly storage?: Storage
  readonly events?: LogEvent[]
}> = {}): PlatformPorts => {
  const events = input.events ?? []
  const storage = input.storage ?? new FakeWebStorage()
  const device: DevicePort = {
    ...unavailableDevicePort,
    getDeviceInfo: async ({timeoutMs}) => {
      input.onGetDeviceInfo?.()
      return input.deviceInfo === undefined
        ? unavailableDevicePort.getDeviceInfo({timeoutMs})
        : success(input.deviceInfo)
    },
    getDisplayInfo: async (): Promise<PortResult<DisplayInfo>> => success({
      displayCount: input.displayCount ?? 1,
    }),
  }
  return createPlatformPorts({
    environmentMode: 'TEST',
    bindings: {
      logger: {kind: 'sink', write: (event: LogEvent) => { events.push(event) }},
      persistKv: createProcessMemoryStateStoragePort(),
      persistSecure: createProcessMemoryStateStoragePort(),
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

export const readText = (children: readonly unknown[] | undefined): string =>
  (children ?? []).filter((child): child is string => typeof child === 'string').join('')
