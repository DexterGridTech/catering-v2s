import {
  defineCommand,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime'
import {
  createStartupReadyActor as createSharedStartupReadyActor,
  type StartupReadyPayload,
} from '@catering-v2s/ui-base-integration-assembly'
import {runtimeModuleDependencyNames} from '../dependencies'
import {moduleKind, moduleName} from '../moduleName'

export type SampleConsoleReadyPayload = StartupReadyPayload

/** The integration owns the startup-ready command; integration-assembly owns completion writing. */
export const startupReadyCommand = defineCommand<SampleConsoleReadyPayload>(moduleName, {
  name: 'startup-ready',
  visibility: 'internal',
})

/** A real, removable integration owner; it is not a descriptor for toolkit packages. */
export const createSampleConsoleModule = (): RuntimeModule => {
  const actors = [createSharedStartupReadyActor({
    moduleName,
    command: startupReadyCommand,
    message: 'Primary surface readiness accepted by sample console',
  })] as const
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
