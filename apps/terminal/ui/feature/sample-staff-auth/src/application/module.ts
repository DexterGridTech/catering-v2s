import {
  createFeatureAssemblyModule,
  type CreateFeatureAssemblyModuleInput,
} from '@catering-v2s/ui-base-feature-assembly';
import {runtimeModuleDependencyNames} from '../dependencies';
import {
  authNoticeDismissedCommand,
  authSystemFailureDismissedCommand,
  authSystemFailureObservedCommand,
} from '../features/commands/commands';
import {
  createAuthNavigationActor,
  createAuthNoticeActor,
  createAuthResultActor,
  createAuthSystemNoticeActor,
} from '../features/actors/actors';
import {moduleKind, moduleName} from '../moduleName';

const commands = [
  authNoticeDismissedCommand,
  authSystemFailureObservedCommand,
  authSystemFailureDismissedCommand,
] as const;

export const createSampleStaffAuthModuleInput = (): CreateFeatureAssemblyModuleInput => {
  const actors = [
    createAuthResultActor(),
    createAuthNavigationActor(),
    createAuthNoticeActor(),
    createAuthSystemNoticeActor(),
  ] as const;
  return {
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commandDefinitions: commands,
    actorDefinitions: actors,
  };
};

export const createSampleStaffAuthModule = () => createFeatureAssemblyModule(createSampleStaffAuthModuleInput());
