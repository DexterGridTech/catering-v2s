import {createFeatureAssemblyModule, type CreateFeatureAssemblyModuleInput} from '@catering-v2s/ui-base-feature-assembly'
import {runtimeModuleDependencyNames} from '../dependencies'
import {createWallpaperPickerActor} from '../features/actors/actors'
import {
  confirmWallpaperRequestedCommand,
  wallpaperSystemFailureDismissedCommand,
  wallpaperSystemFailureObservedCommand,
  wallpaperOptionSelectedCommand,
} from '../features/commands/commands'
import {moduleKind, moduleName} from '../moduleName'

const commands = [
  wallpaperOptionSelectedCommand,
  confirmWallpaperRequestedCommand,
  wallpaperSystemFailureObservedCommand,
  wallpaperSystemFailureDismissedCommand,
] as const

export const createSampleWallpaperPickerModuleInput = (): CreateFeatureAssemblyModuleInput => {
  const actors = [createWallpaperPickerActor()] as const
  return {
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commandDefinitions: commands,
    actorDefinitions: actors,
  }
}

export const createSampleWallpaperPickerModule = () => createFeatureAssemblyModule(createSampleWallpaperPickerModuleInput())
