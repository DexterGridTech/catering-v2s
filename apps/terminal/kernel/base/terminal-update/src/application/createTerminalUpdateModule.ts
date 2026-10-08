import type {RuntimeModule, RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import type {UpdatePort} from '@catering-v2s/kernel-base-platform-ports';
import {runtimeModuleDependencyNames} from '../dependencies';
import {moduleKind, moduleName} from '../moduleName';
import {createTerminalUpdateActor} from '../features/actors/terminalUpdateActor';
import {acceptTerminalUpdateTargetCommand, confirmTerminalUpdateBootCommand, reconcileTerminalUpdateCommand} from '../features/commands/commands';
import {terminalUpdateRegistration} from '../features/slices/terminalUpdate';
import {selectTerminalUpdateActualVersions, selectTerminalUpdateRecentStatus, selectTerminalUpdateTask} from '../selectors/selectors';
import type {UpdateNetworkSnapshotReader, UpdateTargetSourceProvider} from '../types/terminalUpdate';

export const unavailableUpdateTargetSourceProvider: UpdateTargetSourceProvider = Object.freeze({
  readTarget: async () => null,
});

export const createTerminalUpdateModule = (input: Readonly<{port: UpdatePort; sourceProvider?: UpdateTargetSourceProvider; readNetworkSnapshot?: UpdateNetworkSnapshotReader}>): RuntimeModule => {
  const sourceProvider = input.sourceProvider ?? unavailableUpdateTargetSourceProvider;
  const actor = createTerminalUpdateActor({port: input.port, sourceProvider, readNetworkSnapshot: input.readNetworkSnapshot});
  const commandDefinitions = [acceptTerminalUpdateTargetCommand, confirmTerminalUpdateBootCommand, reconcileTerminalUpdateCommand] as const;
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commands: commandDefinitions.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions,
    selectorDefinitions: [selectTerminalUpdateActualVersions, selectTerminalUpdateTask, selectTerminalUpdateRecentStatus],
    actors: [{name: actor.actorName}],
    actorDefinitions: [actor],
    slices: [{name: terminalUpdateRegistration.name, persistIntent: 'owner-only' as const, resetIntent: 'retain' as const}],
    stateSlices: [terminalUpdateRegistration],
    install: async (context: RuntimeModuleContext) => {
      const result = await context.dispatchCommand(reconcileTerminalUpdateCommand, Object.freeze({resumeFixedTask: false}));
      if (result.status !== 'completed') throw new Error(`Terminal update startup reconciliation failed: ${result.status}`);
    },
  });
};
