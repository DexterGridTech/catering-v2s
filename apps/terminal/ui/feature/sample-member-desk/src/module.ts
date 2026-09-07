import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime'
import {dependencyModuleNames} from './dependencies'
import {
  deskSystemFailureDismissedCommand,
  deskSystemFailureObservedCommand,
  memberDraftDiscardedCommand,
  memberFormCancelledCommand,
  memberFormOpenedCommand,
  memberRegistrationAbandonedCommand,
  memberRegistrationRetryRequestedCommand,
  memberSubmissionWithdrawnCommand,
} from './commands'
import {
  createDeskConfirmedActor,
  createDeskFormActor,
  createDeskNavigationActor,
  createDeskNoticeActor,
  createDeskPendingActor,
  createDeskRejectedActor,
  createDeskSystemNoticeActor,
} from './features/actors/actors'
import {moduleKind, moduleName} from './moduleName'

const commands = [
  memberFormOpenedCommand,
  memberFormCancelledCommand,
  memberDraftDiscardedCommand,
  memberSubmissionWithdrawnCommand,
  memberRegistrationRetryRequestedCommand,
  memberRegistrationAbandonedCommand,
  deskSystemFailureObservedCommand,
  deskSystemFailureDismissedCommand,
] as const

const runtimeModuleDependencies = dependencyModuleNames.filter(
  name => name !== 'ui.base.render' && name !== 'ui.base.primitives' && name !== 'ui.base.input',
)

export const createSampleMemberDeskModule = (): RuntimeModule => {
  const actors = [
    createDeskNavigationActor(),
    createDeskFormActor(),
    createDeskPendingActor(),
    createDeskConfirmedActor(),
    createDeskRejectedActor(),
    createDeskNoticeActor(),
    createDeskSystemNoticeActor(),
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
