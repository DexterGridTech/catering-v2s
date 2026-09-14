import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime'
import {dependencyModuleNames} from '../dependencies'
import {createWallpaperPickerActor} from '../features/actors/actors'
import {
  confirmWallpaperRequestedCommand,
  wallpaperOptionSelectedCommand,
} from '../features/commands/commands'
import {moduleKind, moduleName} from '../moduleName'

const commands = [wallpaperOptionSelectedCommand, confirmWallpaperRequestedCommand] as const

const runtimeModuleDependencies = dependencyModuleNames.filter(
  name => name !== 'ui.base.render' && name !== 'ui.base.primitives',
)

export const createSampleWallpaperPickerModule = (): RuntimeModule => {
  const actors = [createWallpaperPickerActor()] as const
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencies.map(name => ({moduleName: name})),
    commands: commands.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions: commands,
    actors: actors.map(actor => ({name: actor.actorName})),
    actorDefinitions: actors,
    slices: [],
    stateSlices: [],
  })
}
