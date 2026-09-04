import {createRequestId} from '@catering-v2s/kernel-base-contracts'
import type {RuntimeModule, RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime'
import {dependencyModuleNames} from './dependencies'
import {
  bootstrapSessionCommand,
  loginCommand,
  loginFailedCommand,
  loginSucceededCommand,
  logoutCommand,
  logoutSucceededCommand,
  sessionRestoredAnonymousCommand,
  sessionRestoredAuthenticatedCommand,
} from './commands'
import {createBootstrapActor, createLoginActor, createLogoutActor} from './features/actors/actors'
import {invalidCredentialsErrorDefinition} from './errors'
import {moduleKind, moduleName} from './moduleName'
import {sessionStateRegistration} from './slice'

const commands = [
  bootstrapSessionCommand,
  loginCommand,
  logoutCommand,
  loginSucceededCommand,
  loginFailedCommand,
  logoutSucceededCommand,
  sessionRestoredAuthenticatedCommand,
  sessionRestoredAnonymousCommand,
] as const

export const createSampleStaffSessionModule = (): RuntimeModule => {
  const actors = [
    createBootstrapActor(),
    createLoginActor(),
    createLogoutActor(),
  ] as const
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: dependencyModuleNames.map(name => ({moduleName: name})),
    errorDefinitions: [invalidCredentialsErrorDefinition],
    commands: commands.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions: commands,
    actors: actors.map(actor => ({name: actor.actorName})),
    actorDefinitions: actors,
    slices: [{name: sessionStateRegistration.name, persistIntent: sessionStateRegistration.persistIntent}],
    stateSlices: [sessionStateRegistration],
    install: async (context: RuntimeModuleContext) => {
      const result = await context.dispatchCommand(bootstrapSessionCommand, {}, {
        requestId: createRequestId(),
      })
      if (result.status !== 'completed') {
        throw new Error(`[sample-staff-session] bootstrap failed: ${result.status}`)
      }
    },
  })
}
