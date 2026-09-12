import {
  consoleLoggerBinding,
  createPlatformPorts,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableHotUpdatePort,
  unavailableLogUploadPort,
  unavailablePersistSecurePort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
} from '@catering-v2s/kernel-base-platform-ports'
import {createAndroidDevicePort} from '@catering-v2s/adapter-android-device'
import {createAndroidSurfaceHostSource} from '@catering-v2s/adapter-android-dual-screen'
import {createAndroidPersistKvPort} from '@catering-v2s/adapter-android-persist-kv'
import {createSampleAssembly, type SurfaceForm} from '@catering-v2s/ui-integration-sample-console'

const persistenceKey = 'sample-terminal-android'

const platformPorts = createPlatformPorts({
  environmentMode: 'DEV',
  bindings: {
    logger: consoleLoggerBinding,
    persistKv: createAndroidPersistKvPort(persistenceKey),
    persistSecure: unavailablePersistSecurePort,
    device: createAndroidDevicePort(),
    appControl: unavailableAppControlPort,
    script: unavailableScriptPort,
    connector: unavailableConnectorPort,
    hotUpdate: unavailableHotUpdatePort,
    logUpload: unavailableLogUploadPort,
    topologyHost: unavailableTopologyHostPort,
  },
})

export const createSampleTerminalAssembly = (input: Readonly<{readonly surfaceForm?: SurfaceForm}> = {}) => {
  const surfaceForm = input.surfaceForm ?? 'laptop'
  return createSampleAssembly({
    platformPorts,
    persistenceKey,
    surfaceForm,
    surfaceHostSourcesByDisplayIndex: {
      0: createAndroidSurfaceHostSource({surfaceKey: 'PRIMARY', displayIndex: 0}),
      1: createAndroidSurfaceHostSource({surfaceKey: 'SECONDARY', displayIndex: 1}),
    },
  })
}
