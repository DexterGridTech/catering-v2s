import type {RuntimeModule, RuntimeModuleContext, RuntimeModuleResetInput} from '@catering-v2s/kernel-base-runtime';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
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
  reconcileTerminalCredentialReadinessCommand,
  clearSharedTerminalCredentialCommand,
  refreshTerminalClientStatusProjectionCommand,
  readTerminalDataCommand,
  requestTerminalUpdateDownloadGrantCommand,
  submitTerminalUpdateReportCommand,
  terminalDataHeartbeatCommand,
  terminalHeartbeatTickCommand,
  terminalRemoteOperationMutationCommand,
  terminalActivationSucceededCommand,
  subscribeTerminalTopicCommand,
  terminalTopicChangedCommand,
  terminalTransportEventCommand,
  unsubscribeTerminalTopicCommand,
} from '../features/commands/terminalDataClientCommands';
import {
  selectActivationState,
  selectConnectionLatency,
  selectConnectionState,
  selectTerminalTopicSubscriptions,
} from '../selectors/selectTerminalDataClientState';
import {selectTerminalClientStatusProjection} from '../selectors/selectTerminalDataClientStatusProjection';
import {terminalDataClientStateSlice, terminalDataClientSliceName} from '../features/slices/terminalDataClient';
import {
  terminalClientStatusProjectionStateSlice,
  terminalClientStatusProjectionSliceName,
} from '../features/slices/terminalClientStatusProjection';
import type {TerminalClientState} from '../types/client';

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
    requestTerminalUpdateDownloadGrantCommand,
    submitTerminalUpdateReportCommand,
    terminalDataHeartbeatCommand,
    terminalTopicChangedCommand,
    initializeTerminalDataClientCommand,
    reconcileTerminalCredentialReadinessCommand,
    clearSharedTerminalCredentialCommand,
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
    selectorDefinitions: [
      selectActivationState,
      selectConnectionState,
      selectConnectionLatency,
      selectTerminalTopicSubscriptions,
      selectTerminalClientStatusProjection,
    ],
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
      let readinessAgain = false;
      let readinessInFlight: Promise<void> | undefined;
      let previousCredential = (context.getState()[terminalDataClientSliceName] as TerminalClientState).credential;
      let previousMode = selectRuntimeInstanceMode(context.getState());
      const reconcileCredentialReadiness = (): Promise<void> => {
        if (disposed) return Promise.resolve();
        readinessAgain = true;
        if (readinessInFlight !== undefined) return readinessInFlight;
        readinessInFlight = (async () => {
          while (readinessAgain && !disposed) {
            readinessAgain = false;
            const result = await context.dispatchCommand(
              reconcileTerminalCredentialReadinessCommand,
              Object.freeze({}),
            );
            const handlerResult = result.status === 'completed' ? result.actorResults[0]?.result : undefined;
            const resultStatus =
              typeof handlerResult === 'object' && handlerResult !== null
                ? Reflect.get(handlerResult, 'status')
                : 'unavailable';
            if (result.status !== 'completed' || (resultStatus !== 'ready' && resultStatus !== 'inactive')) {
              context.platformPorts.logger
                .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'credential-readiness'})
                .error({
                  category: 'terminal.credential.readiness',
                  event: 'credential-readiness-reconcile-failed',
                  message: 'Local shared-credential persistence qualification did not complete',
                  data: {dispatchStatus: result.status, resultStatus: String(resultStatus)},
                });
            }
          }
        })().finally(() => {
          readinessInFlight = undefined;
        });
        return readinessInFlight;
      };
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
        const currentState = context.getState();
        const currentClient = currentState[terminalDataClientSliceName] as TerminalClientState;
        const currentMode = selectRuntimeInstanceMode(currentState);
        if (currentClient.credential !== previousCredential || currentMode !== previousMode) {
          previousCredential = currentClient.credential;
          previousMode = currentMode;
          if (currentClient.credential !== null) void reconcileCredentialReadiness();
        }
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
