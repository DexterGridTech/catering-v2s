import type {RuntimeModule, RuntimeModuleContext, RuntimeModuleResetInput} from '@catering-v2s/kernel-base-runtime';
import {runtimeModuleDependencyNames} from '../dependencies';
import {moduleKind, moduleName} from '../moduleName';
import type {TerminalDataClientDependencies} from '../types/client';
import {createTerminalDataClientActor} from '../features/actors/terminalDataClientActor';
import {
  activateTerminalCommand,
  cancelTerminalOfflineCommand,
  cancelTerminalOnlineCommand,
  connectTerminalCommand,
  disconnectTerminalCommand,
  terminalHeartbeatTickCommand,
  terminalTransportEventCommand,
} from '../features/commands/terminalDataClientCommands';
import {terminalDataClientStateSlice, terminalDataClientSliceName} from '../features/slices/terminalDataClient';

/** Creates one isolated credential/protocol owner for one TER runtime. */
export const createTerminalDataClientModule = (dependencies: TerminalDataClientDependencies): RuntimeModule => {
  const actorRuntime = createTerminalDataClientActor(dependencies);
  const commandDefinitions = [
    activateTerminalCommand,
    cancelTerminalOnlineCommand,
    cancelTerminalOfflineCommand,
    connectTerminalCommand,
    disconnectTerminalCommand,
    terminalTransportEventCommand,
    terminalHeartbeatTickCommand,
  ] as const;
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commands: commandDefinitions.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions,
    actors: [{name: actorRuntime.actor.actorName}],
    actorDefinitions: [actorRuntime.actor],
    slices: [{name: terminalDataClientSliceName, persistIntent: 'owner-only' as const}],
    stateSlices: [terminalDataClientStateSlice],
    install: (context: RuntimeModuleContext) => {
      context.registerResource(actorRuntime.dispose);
    },
    onApplicationReset: (context: RuntimeModuleContext, input: RuntimeModuleResetInput) => actorRuntime.afterApplicationReset(context, input.reason),
  });
};
