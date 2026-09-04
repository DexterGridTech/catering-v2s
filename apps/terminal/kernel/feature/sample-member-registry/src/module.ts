import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime'
import {dependencyModuleNames} from './dependencies'
import {
  confirmMemberCommand,
  memberConfirmedCommand,
  memberPendingCommand,
  memberRejectedCommand,
  rejectMemberCommand,
  submitMemberCommand,
} from './commands'
import {createConfirmMemberActor, createRejectMemberActor, createSubmitMemberActor} from './features/actors/actors'
import {memberErrorDefinitions} from './errors'
import {moduleKind, moduleName} from './moduleName'
import {memberStateRegistration} from './slice'

const commands = [
  submitMemberCommand,
  confirmMemberCommand,
  rejectMemberCommand,
  memberPendingCommand,
  memberConfirmedCommand,
  memberRejectedCommand,
] as const

export const createSampleMemberRegistryModule = (): RuntimeModule => {
  const actors = [
    createSubmitMemberActor(),
    createConfirmMemberActor(),
    createRejectMemberActor(),
  ] as const
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: dependencyModuleNames.map(name => ({moduleName: name})),
    errorDefinitions: memberErrorDefinitions,
    commands: commands.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions: commands,
    actors: actors.map(actor => ({name: actor.actorName})),
    actorDefinitions: actors,
    slices: [{name: memberStateRegistration.name, persistIntent: memberStateRegistration.persistIntent}],
    stateSlices: [memberStateRegistration],
  })
}
