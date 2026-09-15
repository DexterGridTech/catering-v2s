import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts'
import {
  createPlatformPorts,
  createProcessMemoryStateStoragePort,
  consoleLoggerBinding,
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
  type NativeLoadingCapability,
} from '@catering-v2s/kernel-base-platform-ports'

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor')
const testPortCapabilities = Object.freeze([
  Object.freeze({capability: 'fixture', state: 'real' as const, source: 'fixture' as const}),
])

const withTestPortDescriptor = <T extends object>(
  value: T,
  port: string,
): T => {
  const descriptors = Object.getOwnPropertyDescriptors(value)
  Reflect.deleteProperty(descriptors, PORT_DESCRIPTOR_KEY)
  const copy = Object.create(Object.getPrototypeOf(value), descriptors) as T
  Object.defineProperty(copy, PORT_DESCRIPTOR_KEY, {
    value: Object.freeze({port, capabilities: testPortCapabilities}),
    enumerable: false,
    writable: false,
    configurable: false,
  })
  return Object.freeze(copy)
}

const nativeLoadingCapability: NativeLoadingCapability = Object.freeze({
  targetPhysicalSurface: Object.freeze({surfaceKey: 'PRIMARY', displayIndex: 0}),
  hideOnce: async reason => Object.freeze({hidden: true, alreadyHidden: false, reason}),
})

export type TestPlatformPorts = PlatformPorts & Readonly<{readonly nativeLoadingCapability: NativeLoadingCapability}>

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
}> = {}): TestPlatformPorts => {
  const events = input.events ?? []
  const device = withTestPortDescriptor({
    ...unavailableDevicePort,
    getDeviceInfo: async ({timeoutMs}) => input.deviceInfo === undefined
      ? unavailableDevicePort.getDeviceInfo({timeoutMs})
      : success(input.deviceInfo),
    getDisplayInfo: async (): Promise<PortResult<DisplayInfo>> =>
      success({displayCount: input.displayCount ?? 1}),
  }, 'device') as DevicePort
  const logger = withTestPortDescriptor({
    ...consoleLoggerBinding,
    kind: 'sink' as const,
    write: (event: LogEvent) => { events.push(event) },
  }, 'logger')
  const plainStorage = withTestPortDescriptor(
    input.plainStorage ?? createProcessMemoryStateStoragePort(),
    'persistKv',
  )
  const protectedStorage = withTestPortDescriptor(
    input.protectedStorage ?? createProcessMemoryStateStoragePort(),
    'persistSecure',
  )
  const ports = createPlatformPorts({
    environmentMode: 'TEST',
    bindings: {
      logger,
      persistKv: plainStorage,
      persistSecure: protectedStorage,
      device,
      appControl: unavailableAppControlPort,
      script: unavailableScriptPort,
      connector: unavailableConnectorPort,
      hotUpdate: unavailableHotUpdatePort,
      logUpload: unavailableLogUploadPort,
      topologyHost: unavailableTopologyHostPort,
    },
  })
  return Object.freeze({...ports, nativeLoadingCapability})
}
