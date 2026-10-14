import {createRuntimeModule, type RuntimeModule, type RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {runtimeModuleDependencyNames} from '../dependencies';
import {moduleKind, moduleName} from '../moduleName';
import {createServerConfigSlice} from '../features/slices/serverConfig';
import {createServerConfigActor} from '../features/actors/serverConfigActor';
import {
  clearServerOverrideCommand,
  restoreServerDefaultsCommand,
  selectServerConfigSpaceCommand,
  setServerOverrideCommand,
  validateHydratedServerConfigCommand,
} from '../declarations/commands';
import {defaultServiceNames, validateServerConfigDefaults} from '../foundations/validateServerConfigDefaults';
import {resolveServerNetworkSnapshot, selectServerConfiguration} from '../selectors/selectServerConfiguration';
import {selectServerConfigServiceContext} from '../selectors/selectServerConfigServiceContext';

/** Creates the server-configuration owner with immutable assembly defaults. */
export const createServerConfigModule = (defaults: TransportServerConfig): RuntimeModule => {
  validateServerConfigDefaults(defaults);
  const serviceNames = defaultServiceNames(defaults);
  const slice = createServerConfigSlice({defaults, serviceNames});
  const actor = createServerConfigActor(defaults, slice.actions);
  const commandDefinitions = [
    selectServerConfigSpaceCommand,
    setServerOverrideCommand,
    clearServerOverrideCommand,
    restoreServerDefaultsCommand,
    validateHydratedServerConfigCommand,
  ] as const;
  return createRuntimeModule({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commandDefinitions,
    selectorDefinitions: [selectServerConfiguration, resolveServerNetworkSnapshot, selectServerConfigServiceContext],
    actorDefinitions: [actor],
    stateSlices: [slice.registration],
    install: async (context: RuntimeModuleContext) => {
      const result = await context.dispatchCommand(validateHydratedServerConfigCommand, Object.freeze({}));
      if (result.status !== 'completed')
        throw new Error(`Server configuration startup validation failed: ${result.status}`);
    },
  });
};
