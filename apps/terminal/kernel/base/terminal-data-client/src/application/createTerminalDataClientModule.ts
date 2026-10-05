import type {RuntimeModule, RuntimeModuleContext, RuntimeModuleResetInput} from '@catering-v2s/kernel-base-runtime';
import {runtimeModuleDependencyNames} from '../dependencies';
import {moduleKind, moduleName} from '../moduleName';
import type {TerminalDataClientDependencies} from '../types/client';
import {createTerminalDataClientActor} from '../features/actors/terminalDataClientActor';
import {
  activateTerminalCommand,
  acceptTerminalTopicNotificationCommand,
  cancelTerminalOfflineCommand,
  cancelTerminaActivationCommand,
  connectTerminalCommand,
  disconnectTerminalCommand,
  initializeTerminalDataClientCommand,
  refreshTerminalClientStatusProjectionCommand,
  readTerminalDataCommand,
  terminalHeartbeatTickCommand,
  terminalRemoteOperationMutationCommand,
  terminalActivationSucceededCommand,
  subscribeTerminalTopicCommand,
  terminalTopicChangedCommand,
  terminalTransportEventCommand,
  unsubscribeTerminalTopicCommand,
} from '../features/commands/terminalDataClientCommands';
import {terminalDataClientStateSlice, terminalDataClientSliceName} from '../features/slices/terminalDataClient';
import {
  terminalClientStatusProjectionStateSlice,
  terminalClientStatusProjectionSliceName,
} from '../features/slices/terminalClientStatusProjection';

/** Creates one isolated credential/protocol owner for one TER runtime. */
export const createTerminalDataClientModule = (dependencies: TerminalDataClientDependencies): RuntimeModule => {
  const actorRuntime = createTerminalDataClientActor(dependencies);
  const commandDefinitions = [
    activateTerminalCommand,
    terminalActivationSucceededCommand,
    cancelTerminaActivationCommand,
    cancelTerminalOfflineCommand,
    connectTerminalCommand,
    disconnectTerminalCommand,
    subscribeTerminalTopicCommand,
    unsubscribeTerminalTopicCommand,
    acceptTerminalTopicNotificationCommand,
    readTerminalDataCommand,
    terminalTopicChangedCommand,
    initializeTerminalDataClientCommand,
    refreshTerminalClientStatusProjectionCommand,
    terminalTransportEventCommand,
    terminalHeartbeatTickCommand,
    terminalRemoteOperationMutationCommand,
  ] as const;
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commands: commandDefinitions.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions,
    actors: [{name: actorRuntime.actor.actorName}],
    actorDefinitions: [actorRuntime.actor],
    slices: [
      {name: terminalDataClientSliceName, persistIntent: 'owner-only' as const},
      {name: terminalClientStatusProjectionSliceName, persistIntent: 'owner-only' as const},
    ],
    stateSlices: [terminalDataClientStateSlice, terminalClientStatusProjectionStateSlice],
    install: async (context: RuntimeModuleContext) => {
      context.registerResource(actorRuntime.dispose);
      let disposed = false;
      let refreshAgain = false;
      let refreshInFlight: Promise<void> | undefined;
      const refreshProjection = (): Promise<void> => {
        if (disposed) return Promise.resolve();
        refreshAgain = true;
        if (refreshInFlight !== undefined) return refreshInFlight;
        refreshInFlight = (async () => {
          while (refreshAgain && !disposed) {
            refreshAgain = false;
            const result = await context.dispatchCommand(
              refreshTerminalClientStatusProjectionCommand,
              Object.freeze({}),
            );
            if (result.status !== 'completed') {
              context.platformPorts.logger
                .scope({
                  moduleName,
                  layer: 'kernel',
                  subsystem: 'terminal-data-client',
                  component: 'status-projection',
                })
                .error({
                  category: 'terminal.status-projection.refresh',
                  event: 'refresh-failed',
                  message: 'Terminal status projection could not be refreshed',
                  data: {dispatchStatus: result.status},
                });
            }
          }
        })().finally(() => {
          refreshInFlight = undefined;
        });
        return refreshInFlight;
      };
      const unsubscribe = context.subscribeState(() => {
        void refreshProjection();
      });
      context.registerResource(() => {
        disposed = true;
        unsubscribe();
      });
      await refreshProjection();
      const result = await context.dispatchCommand(initializeTerminalDataClientCommand, Object.freeze({}));
      if (result.status !== 'completed') throw new Error(`Terminal data client startup failed: ${result.status}`);
    },
    onApplicationReset: (context: RuntimeModuleContext, input: RuntimeModuleResetInput) =>
      actorRuntime.afterApplicationReset(context, input.reason),
  });
};
