import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts'
import {
  createPlatformPorts,
  consoleLoggerBinding,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableDevicePort,
  unavailableHotUpdatePort,
  unavailableLogUploadPort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  type DevicePort,
  type DisplayInfo,
  type PlatformPorts,
  type PortResult,
} from '@catering-v2s/kernel-base-platform-ports'
import {createWebStateStoragePort} from './webStorage'

export type SurfaceMode = 'single' | 'dual'

export type WebPlatformOptions = Readonly<{
  readonly storage?: Storage
  readonly storageNamespace?: string
}>

export const createWebDevicePort = (
  readSurfaceMode: () => SurfaceMode,
): DevicePort => Object.freeze({
  ...unavailableDevicePort,
  getDisplayInfo: async (): Promise<PortResult<DisplayInfo>> => ({
    status: 'succeeded',
    value: {displayCount: readSurfaceMode() === 'dual' ? 2 : 1},
    completedAt: nowTimestampMs(),
  }),
})

export const createWebPlatformPorts = (
  readSurfaceMode: () => SurfaceMode,
  options: WebPlatformOptions = {},
): PlatformPorts => {
  const storage = options.storage ?? globalThis.localStorage
  const storageNamespace = options.storageNamespace ?? 'test-expo'
  const namespace = storageNamespace.endsWith(':') ? storageNamespace : `${storageNamespace}:`
  const persistKv = createWebStateStoragePort(storage, `${namespace}plain:`, 'persistKv')
  const persistSecure = createWebStateStoragePort(storage, `${namespace}protected:`, 'persistSecure')
  return createPlatformPorts({
    environmentMode: 'DEV',
    bindings: {
      logger: consoleLoggerBinding,
      persistKv,
      persistSecure,
      device: createWebDevicePort(readSurfaceMode),
      appControl: unavailableAppControlPort,
      script: unavailableScriptPort,
      connector: unavailableConnectorPort,
      hotUpdate: unavailableHotUpdatePort,
      logUpload: unavailableLogUploadPort,
      topologyHost: unavailableTopologyHostPort,
    },
  })
}
