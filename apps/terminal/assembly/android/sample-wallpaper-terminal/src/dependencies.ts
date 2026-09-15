import {moduleName as assemblyBaseAndroid} from '@catering-v2s/assembly-base-android'
import {moduleName as uiBaseRender} from '@catering-v2s/ui-base-render'
import {moduleName as uiIntegrationSampleWallpaperConsole} from '@catering-v2s/ui-integration-sample-wallpaper-console'

export const dependencyModuleNames = [
  assemblyBaseAndroid,
  uiBaseRender,
  uiIntegrationSampleWallpaperConsole,
] as const

export const devDependencyModuleNames = [] as const
