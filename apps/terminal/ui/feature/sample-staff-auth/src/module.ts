import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime'
import {dependencyModuleNames} from './dependencies'
import {authNoticeDismissedCommand} from './commands'
import {
  createAuthNavigationActor,
  createAuthNoticeActor,
  createAuthResultActor,
} from './features/actors/actors'
import {moduleKind, moduleName} from './moduleName'

const commands = [authNoticeDismissedCommand] as const

const runtimeModuleDependencies = dependencyModuleNames.filter(
  name => name !== 'ui.base.render' && name !== 'ui.base.primitives',
)

export const createSampleStaffAuthModule = (): RuntimeModule => {
  const actors = [
    createAuthResultActor(),
    createAuthNavigationActor(),
    createAuthNoticeActor(),
  ] as const
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    // UI toolkit package edges are not runtime modules and must not enter the
    // runtime module graph. The package dependency list remains complete.
    dependencies: runtimeModuleDependencies.map(name => ({moduleName: name})),
    commands: commands.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions: commands,
    actors: actors.map(actor => ({name: actor.actorName})),
    actorDefinitions: actors,
    slices: [],
    stateSlices: [],
  })
}
