import {
  defineActor,
  defineCommand,
  onCommand,
  type ActorDefinition,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime'
import {runtimeModuleDependencyNames} from '../dependencies'
import {createWallpaperConsolePlacementActor} from '../features/actors/actors'
import {moduleKind, moduleName} from '../moduleName'

export type SampleWallpaperConsoleReadyPayload = Readonly<{
  readonly surfaceKey: 'PRIMARY'
  readonly displayIndex: 0
  readonly readyPartKey: string
}>

export const startupReadyCommand = defineCommand<SampleWallpaperConsoleReadyPayload>(moduleName, {
  name: 'startup-ready',
  visibility: 'internal',
})

const createStartupReadyActor = (): ActorDefinition => defineActor(moduleName, 'startup-ready', [
  onCommand(startupReadyCommand, context => {
    context.platformPorts.logger.info({
      category: 'startup.ready',
      event: 'startup.ready',
      message: 'Primary sample2 surface readiness accepted by wallpaper console',
      data: {
        surfaceKey: context.command.payload.surfaceKey,
        displayIndex: context.command.payload.displayIndex,
        readyPartKey: context.command.payload.readyPartKey,
        writer: 'ui.base.console-assembly',
      },
    })
    return null
  }),
])

export const createSampleWallpaperConsoleModule = (): RuntimeModule => {
  const actors = [
    createWallpaperConsolePlacementActor(),
    createStartupReadyActor(),
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
