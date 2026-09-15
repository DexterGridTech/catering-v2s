import {
  consoleLoggerBinding,
  createPlatformPorts,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableHotUpdatePort,
  unavailableLogUploadPort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  type NativeLoadingCapability,
  type PlatformPorts,
  type EnvironmentMode,
} from '@catering-v2s/kernel-base-platform-ports'
import {createAndroidDevicePort} from '@catering-v2s/adapter-android-device'
import {createAndroidSurfaceHostSource} from '@catering-v2s/adapter-android-dual-screen'
import {createAndroidPersistKvPort} from '@catering-v2s/adapter-android-persist-kv'
import {createAndroidNativeLoadingCapability} from './nativeLoadingCapability'

export type AndroidPlatformBinding = Readonly<{
  readonly environmentMode: EnvironmentMode
  readonly platformPorts: PlatformPorts
  readonly nativeLoadingCapability: NativeLoadingCapability
  readonly surfaceHostSourcesByDisplayIndex: Readonly<{
    readonly 0: ReturnType<typeof createAndroidSurfaceHostSource>
    readonly 1: ReturnType<typeof createAndroidSurfaceHostSource>
  }>
}>

export const createAndroidPlatformBinding = (persistenceKey: string): AndroidPlatformBinding => {
  const environmentMode: EnvironmentMode = __DEV__ ? 'DEV' : 'PROD'
  const nativeLoadingCapability = createAndroidNativeLoadingCapability()
  const platformPorts = createPlatformPorts({
    environmentMode,
    bindings: {
      logger: consoleLoggerBinding,
      persistKv: createAndroidPersistKvPort(persistenceKey, 'plain'),
      persistSecure: createAndroidPersistKvPort(persistenceKey, 'protected'),
      device: createAndroidDevicePort(),
      appControl: unavailableAppControlPort,
      script: unavailableScriptPort,
      connector: unavailableConnectorPort,
      hotUpdate: unavailableHotUpdatePort,
      logUpload: unavailableLogUploadPort,
      topologyHost: unavailableTopologyHostPort,
    },
  })
  return Object.freeze({
    environmentMode,
    platformPorts,
    nativeLoadingCapability,
    surfaceHostSourcesByDisplayIndex: Object.freeze({
      0: createAndroidSurfaceHostSource({surfaceKey: 'PRIMARY', displayIndex: 0}),
      1: createAndroidSurfaceHostSource({surfaceKey: 'SECONDARY', displayIndex: 1}),
    }),
  })
}
