import {createUiRuntimeModule} from '@catering-v2s/ui-base-feature-assembly';
import {runtimeModuleDependencyNames} from '../dependencies';
import {
  authNoticeDismissedCommand,
  authSystemFailureDismissedCommand,
  authSystemFailureObservedCommand,
  needToLoginStaffCommand,
} from '../declarations/commands';
import {createAuthNavigationActor} from '../features/actors/authNavigationActor';
import {createAuthNoticeActor} from '../features/actors/authNoticeActor';
import {createAuthResultActor} from '../features/actors/authResultActor';
import {createAuthSystemNoticeActor} from '../features/actors/authSystemNoticeActor';
import {moduleKind, moduleName} from '../moduleName';
import {parts, layerDismissals} from '../declarations/parts';
import {variables} from '../declarations/variables';

const commands = [
  authNoticeDismissedCommand,
  needToLoginStaffCommand,
  authSystemFailureObservedCommand,
  authSystemFailureDismissedCommand,
] as const;

export const createSampleStaffAuthModule = () => {
  const actors = [
    createAuthResultActor(),
    createAuthNavigationActor(),
    createAuthNoticeActor(),
    createAuthSystemNoticeActor(),
  ] as const;
  return createUiRuntimeModule(
    {
      moduleName,
      kind: moduleKind,
      dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
      commandDefinitions: commands,
      actorDefinitions: actors,
    },
    {parts, variables, layerDismissals},
  );
};
