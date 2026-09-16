import packageJson from '../../package.json'
import {createAndroidPlatformBinding} from '@catering-v2s/assembly-base-android'
import {
  createSampleWallpaperConsoleAssembly,
  type SurfaceForm,
} from '@catering-v2s/ui-integration-sample-wallpaper-console'

const persistenceKey = 'sample-wallpaper-terminal-android'
const androidPlatform = createAndroidPlatformBinding(persistenceKey)
export const nativeLoadingCapability = androidPlatform.nativeLoadingCapability
export const nativeLoadingLogger = androidPlatform.platformPorts.logger

export const createSampleWallpaperTerminalAssembly = (input: Readonly<{
  readonly surfaceForm: SurfaceForm
}>) => createSampleWallpaperConsoleAssembly({
  ...androidPlatform,
  persistenceKey,
  surfaceForm: input.surfaceForm,
  terminalSurfaces: packageJson.terminalSurfaces,
  showAdminPassword: packageJson.showAdminPassword,
})
