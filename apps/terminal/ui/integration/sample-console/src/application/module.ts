import {
  defineActor,
  defineCommand,
  onCommand,
  type ActorDefinition,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime'
import {runtimeModuleDependencyNames} from '../dependencies'
import {moduleKind, moduleName} from '../moduleName'

export type SampleConsoleReadyPayload = Readonly<{
  readonly surfaceKey: 'PRIMARY'
  readonly displayIndex: 0
  readonly readyPartKey: string
}>

/** The integration owns the startup-ready command; console-assembly owns completion writing. */
export const startupReadyCommand = defineCommand<SampleConsoleReadyPayload>(moduleName, {
  name: 'startup-ready',
  visibility: 'internal',
})

const createStartupReadyActor = (): ActorDefinition => defineActor(moduleName, 'startup-ready', [
  onCommand(startupReadyCommand, context => {
    context.platformPorts.logger.info({
      category: 'startup.ready',
      event: 'startup.ready',
      message: 'Primary surface readiness accepted by sample console',
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

/** A real, removable integration owner; it is not a descriptor for toolkit packages. */
export const createSampleConsoleModule = (): RuntimeModule => {
  const actors = [createStartupReadyActor()] as const
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
