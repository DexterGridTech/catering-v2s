import {createUiRuntimeModule} from '@catering-v2s/ui-base-feature-assembly';
import {runtimeModuleDependencyNames} from '../dependencies';
import {
  deskSystemFailureDismissedCommand,
  deskSystemFailureObservedCommand,
  memberDraftDiscardedCommand,
  memberFormCancelledCommand,
  memberFormOpenedCommand,
  startMemberDeskCommand,
  memberRegistrationAbandonedCommand,
  memberRegistrationRetryRequestedCommand,
  memberSubmissionWithdrawnCommand,
} from '../declarations/commands';
import {createDeskConfirmedActor} from '../features/actors/deskConfirmedActor';
import {createDeskFormActor} from '../features/actors/deskFormActor';
import {createDeskNavigationActor} from '../features/actors/deskNavigationActor';
import {createDeskNoticeActor} from '../features/actors/deskNoticeActor';
import {createDeskPendingActor} from '../features/actors/deskPendingActor';
import {createDeskRejectedActor} from '../features/actors/deskRejectedActor';
import {createDeskSystemNoticeActor} from '../features/actors/deskSystemNoticeActor';
import {moduleKind, moduleName} from '../moduleName';
import {parts, layerDismissals} from '../declarations/parts';

const commands = [
  startMemberDeskCommand,
  memberFormOpenedCommand,
  memberFormCancelledCommand,
  memberDraftDiscardedCommand,
  memberSubmissionWithdrawnCommand,
  memberRegistrationRetryRequestedCommand,
  memberRegistrationAbandonedCommand,
  deskSystemFailureObservedCommand,
  deskSystemFailureDismissedCommand,
] as const;

export const createSampleMemberDeskModule = () => {
  const actors = [
    createDeskNavigationActor(),
    createDeskFormActor(),
    createDeskPendingActor(),
    createDeskConfirmedActor(),
    createDeskRejectedActor(),
    createDeskNoticeActor(),
    createDeskSystemNoticeActor(),
  ] as const;
  return createUiRuntimeModule(
    {
      moduleName,
      kind: moduleKind,
      dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
      commandDefinitions: commands,
      actorDefinitions: actors,
    },
    {parts, layerDismissals},
  );
};
