import {createRuntimeModule, type RuntimeModule, type RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import type {SurfaceForm} from '@catering-v2s/kernel-base-contracts';
import {runtimeModuleDependencyNames} from '../dependencies';
import {moduleKind, moduleName} from '../moduleName';
import {selectDisplayRole} from '../selectors/selectDisplayRole';
import {selectPowerConfirmation} from '../selectors/selectPowerConfirmation';
import {displayRoleSlice, displayRoleSliceName} from '../features/slices/displayRole';
import {
  powerStatusChangedCommand,
  requestPowerRoleChangeCommand,
  confirmPowerRoleChangeCommand,
  cancelPowerRoleChangeCommand,
  switchDisplayRoleCommand,
  switchInstanceModeCommand,
  validateHydratedDisplayRoleCommand,
} from '../declarations/commands';
import {createSwitchDisplayRoleActor} from '../features/actors/switchDisplayRoleActor';
import {createSwitchInstanceModeActor} from '../features/actors/switchInstanceModeActor';
import {createPowerStatusActor} from '../features/actors/powerStatusActor';
import {createPowerRoleChangeActor} from '../features/actors/powerRoleChangeActor';
import {createValidateHydratedDisplayRoleActor} from '../features/actors/validateHydratedDisplayRoleActor';
import {createRuntimeRoleChangedActor} from '../features/actors/runtimeRoleChangedActor';
import {installPowerStatusBridge} from './createPowerStatusBridge';

export const createDisplayContextModule = (
  input: Readonly<{readonly surfaceForm?: SurfaceForm}> = {},
): RuntimeModule => {
  const switchDisplayRoleActor = createSwitchDisplayRoleActor();
  const switchInstanceModeActor = createSwitchInstanceModeActor();
  const powerStatusActor = createPowerStatusActor();
  const powerRoleChangeActor = createPowerRoleChangeActor(input.surfaceForm ?? 'laptop');
  const validateHydratedDisplayRoleActor = createValidateHydratedDisplayRoleActor();
  const runtimeRoleChangedActor = createRuntimeRoleChangedActor();

  return createRuntimeModule({
    moduleName,
    kind: moduleKind,
    // The package dependency list is the source-import closure.  Only the
    // runtime owner is a runtime-module edge; contracts, ports and state are
    // toolkits and are not fabricated into the runtime graph.
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commandDefinitions: [
      switchDisplayRoleCommand,
      switchInstanceModeCommand,
      powerStatusChangedCommand,
      requestPowerRoleChangeCommand,
      confirmPowerRoleChangeCommand,
      cancelPowerRoleChangeCommand,
      validateHydratedDisplayRoleCommand,
    ],
    selectorDefinitions: [selectDisplayRole, selectPowerConfirmation],
    actorDefinitions: [
      switchDisplayRoleActor,
      switchInstanceModeActor,
      powerStatusActor,
      powerRoleChangeActor,
      validateHydratedDisplayRoleActor,
      runtimeRoleChangedActor,
    ],
    stateSlices: [displayRoleSlice],
    install: async (context: RuntimeModuleContext) => {
      const validation = await context.dispatchCommand(validateHydratedDisplayRoleCommand, Object.freeze({}));
      if (validation.status !== 'completed') {
        throw new Error(`Display role startup validation failed: ${validation.status}`);
      }
      await installPowerStatusBridge(context);
    },
  });
};
