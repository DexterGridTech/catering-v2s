import {
  defineCommand,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime'
import {
  createStartupReadyActor as createSharedStartupReadyActor,
  type StartupReadyPayload,
} from '@catering-v2s/ui-base-integration-assembly'
import {runtimeModuleDependencyNames} from '../dependencies'
import {createWallpaperConsolePlacementActor} from '../features/actors/actors'
import {moduleKind, moduleName} from '../moduleName'

export type SampleWallpaperConsoleReadyPayload = StartupReadyPayload

export const startupReadyCommand = defineCommand<SampleWallpaperConsoleReadyPayload>(moduleName, {
  name: 'startup-ready',
  visibility: 'internal',
})

export const createSampleWallpaperConsoleModule = (): RuntimeModule => {
  const actors = [
    createWallpaperConsolePlacementActor(),
    createSharedStartupReadyActor({
      moduleName,
      command: startupReadyCommand,
      message: 'Primary sample2 surface readiness accepted by wallpaper console',
    }),
  ] as const
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commands: [{name: startupReadyCommand.commandName, visibility: startupReadyCommand.visibility}],
    commandDefinitions: [startupReadyCommand],
    actors: actors.map(actor => ({name: actor.actorName})),
    actorDefinitions: actors,
    slices: [],
    stateSlices: [],
  })
}
