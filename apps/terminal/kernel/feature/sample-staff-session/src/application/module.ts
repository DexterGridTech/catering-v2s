import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {createRuntimeModule, type RuntimeModule, type RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {runtimeModuleDependencyNames} from '../dependencies';
import {
  bootstrapSessionCommand,
  loginCommand,
  loginFailedCommand,
  loginSucceededCommand,
  logoutCommand,
  logoutSucceededCommand,
  sessionRestoredAnonymousCommand,
  sessionRestoredAuthenticatedCommand,
} from '../declarations/commands';
import {createStaffBootstrapActor} from '../features/actors/staffBootstrapActor';
import {createStaffLoginActor} from '../features/actors/staffLoginActor';
import {createStaffLogoutActor} from '../features/actors/staffLogoutActor';
import {moduleKind, moduleName} from '../moduleName';
import {sessionStateRegistration} from '../features/slices/staffSession';
import {selectHostStaffQualification} from '../selectors/selectHostStaffQualification';
import {selectSessionState} from '../selectors/selectSessionState';

const commands = [
  bootstrapSessionCommand,
  loginCommand,
  logoutCommand,
  loginSucceededCommand,
  loginFailedCommand,
  logoutSucceededCommand,
  sessionRestoredAuthenticatedCommand,
  sessionRestoredAnonymousCommand,
] as const;

export const createSampleStaffSessionModule = (
  input: Readonly<{canLogin?: (state: StateRoot) => boolean}> = {},
): RuntimeModule => {
  const actors = [
    createStaffBootstrapActor(),
    createStaffLoginActor(input.canLogin),
    createStaffLogoutActor(),
  ] as const;
  return createRuntimeModule({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commandDefinitions: commands,
    selectorDefinitions: [selectHostStaffQualification, selectSessionState],
    actorDefinitions: actors,
    stateSlices: [sessionStateRegistration],
    install: async (context: RuntimeModuleContext) => {
      const result = await context.dispatchCommand(
        bootstrapSessionCommand,
        {},
        {
          requestId: createRequestId(),
        },
      );
      if (result.status !== 'completed') {
        throw new Error(`[sample-staff-session] bootstrap failed: ${result.status}`);
      }
    },
  });
};
