import packageJson from '../../package.json'
import {createAndroidPlatformBinding} from '@catering-v2s/assembly-base-android'
import {createSampleAssembly, type SurfaceForm} from '@catering-v2s/ui-integration-sample-console'

const persistenceKey = 'sample-terminal-android'
const androidPlatform = createAndroidPlatformBinding(persistenceKey)
export const nativeLoadingCapability = androidPlatform.nativeLoadingCapability
export const nativeLoadingLogger = androidPlatform.platformPorts.logger

export const createSampleTerminalAssembly = (input: Readonly<{readonly surfaceForm: SurfaceForm}>) => {
  return createSampleAssembly({
    ...androidPlatform,
    persistenceKey,
    surfaceForm: input.surfaceForm,
    terminalSurfaces: packageJson.terminalSurfaces,
    showAdminPassword: packageJson.showAdminPassword,
  })
}
