import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts'
import {
  createPlatformPorts,
  consoleLoggerBinding,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableDevicePort,
  unavailableHotUpdatePort,
  unavailableLogUploadPort,
  unavailablePersistSecurePort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  type DevicePort,
  type DisplayInfo,
  type PlatformPorts,
  type PortResult,
  type StateStoragePort,
} from '@catering-v2s/kernel-base-platform-ports'
import {createWebStateStoragePort} from './webStorage'

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor')

export type SurfaceMode = 'single' | 'dual'

export type WebPlatformOptions = Readonly<{
  readonly storage?: Storage
  readonly storageNamespace?: string
  /**
   * Optional non-persistent protected seam for a Web preview.  The default
   * remains unavailable so the host never presents Web Storage as secure
   * storage; an integration may opt into process memory only to keep the
   * state runtime's legacy-backend probe executable during a preview.
   */
  readonly protectedStorage?: StateStoragePort
}>

export const createWebDevicePort = (
  readSurfaceMode: () => SurfaceMode,
): DevicePort => {
  const port: DevicePort = {
    ...unavailableDevicePort,
    getDisplayInfo: async (): Promise<PortResult<DisplayInfo>> => ({
      status: 'succeeded',
      value: {displayCount: readSurfaceMode() === 'dual' ? 2 : 1},
      completedAt: nowTimestampMs(),
    }),
  }
  if (__DEV__) Object.defineProperty(port, PORT_DESCRIPTOR_KEY, {
    value: Object.freeze({
      port: 'device',
      capabilities: Object.freeze([
        Object.freeze({capability: 'getDeviceInfo', state: 'unavailable' as const, source: 'default' as const}),
        Object.freeze({capability: 'getDisplayInfo', state: 'real' as const, source: 'web' as const}),
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
  return Object.freeze(port)
}

export const createWebPlatformPorts = (
  readSurfaceMode: () => SurfaceMode,
  options: WebPlatformOptions = {},
): PlatformPorts => {
  const storage = options.storage ?? globalThis.localStorage
  const storageNamespace = options.storageNamespace ?? 'test-expo'
  const namespace = storageNamespace.endsWith(':') ? storageNamespace : `${storageNamespace}:`
  const persistKv = createWebStateStoragePort(storage, `${namespace}plain:`, 'persistKv')
  return createPlatformPorts({
    environmentMode: 'DEV',
    bindings: {
      logger: consoleLoggerBinding,
      persistKv,
      persistSecure: options.protectedStorage ?? unavailablePersistSecurePort,
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
