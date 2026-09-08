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
import {createSampleAssembly} from '@catering-v2s/ui-integration-sample-console'

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

export const createSampleTerminalAssembly = () => createSampleAssembly({
  platformPorts,
  persistenceKey,
  surfaceHostSources: {
    PRIMARY: createAndroidSurfaceHostSource('PRIMARY'),
    SECONDARY: createAndroidSurfaceHostSource('SECONDARY'),
  },
})
