import type {RuntimeModule, RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
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
} from '../features/commands';
import {defaultServiceNames, validateServerConfigDefaults} from '../foundations/validateServerConfigDefaults';

/** Creates the server-configuration owner with immutable assembly defaults. */
export const createServerConfigModule = (defaults: TransportServerConfig): RuntimeModule => {
  validateServerConfigDefaults(defaults);
  const serviceNames = defaultServiceNames(defaults);
  const slice = createServerConfigSlice({defaultSpace: defaults.selectedSpace, serviceNames});
  const actor = createServerConfigActor(defaults, slice.actions);
  const commandDefinitions = [
    selectServerConfigSpaceCommand,
    setServerOverrideCommand,
    clearServerOverrideCommand,
    restoreServerDefaultsCommand,
    validateHydratedServerConfigCommand,
  ] as const;
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commands: commandDefinitions.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions,
    actors: [{name: actor.actorName}],
    actorDefinitions: [actor],
    slices: [{name: slice.registration.name, persistIntent: 'owner-only' as const, resetIntent: 'retain' as const}],
    stateSlices: [slice.registration],
    install: async (context: RuntimeModuleContext) => {
      const result = await context.dispatchCommand(validateHydratedServerConfigCommand, Object.freeze({}));
      if (result.status !== 'completed') throw new Error(`Server configuration startup validation failed: ${result.status}`);
    },
  });
};
