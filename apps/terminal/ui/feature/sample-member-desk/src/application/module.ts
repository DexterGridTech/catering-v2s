import {createFeatureAssemblyModule, type CreateFeatureAssemblyModuleInput} from '@catering-v2s/ui-base-feature-assembly'
import {runtimeModuleDependencyNames} from '../dependencies'
import {
  deskSystemFailureDismissedCommand,
  deskSystemFailureObservedCommand,
  memberDraftDiscardedCommand,
  memberFormCancelledCommand,
  memberFormOpenedCommand,
  memberRegistrationAbandonedCommand,
  memberRegistrationRetryRequestedCommand,
  memberSubmissionWithdrawnCommand,
} from '../features/commands/commands'
import {
  createDeskConfirmedActor,
  createDeskFormActor,
  createDeskNavigationActor,
  createDeskNoticeActor,
  createDeskPendingActor,
  createDeskRejectedActor,
  createDeskSystemNoticeActor,
} from '../features/actors/actors'
import {moduleKind, moduleName} from '../moduleName'

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

export const createSampleMemberDeskModuleInput = (): CreateFeatureAssemblyModuleInput => {
  const actors = [
    createDeskNavigationActor(),
    createDeskFormActor(),
    createDeskPendingActor(),
    createDeskConfirmedActor(),
    createDeskRejectedActor(),
    createDeskNoticeActor(),
    createDeskSystemNoticeActor(),
  ] as const
  return {
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commandDefinitions: commands,
    actorDefinitions: actors,
  }
}

export const createSampleMemberDeskModule = () => createFeatureAssemblyModule(createSampleMemberDeskModuleInput())
