import type {RuntimeModule, RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import type {UpdatePort} from '@catering-v2s/kernel-base-platform-ports';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {runtimeModuleDependencyNames} from '../dependencies';
import {moduleKind, moduleName} from '../moduleName';
import {createTerminalUpdateActor} from '../features/actors/terminalUpdateActor';
import {
  acceptTerminalUpdateTargetCommand,
  clearTerminalUpdateReportContextCommand,
  confirmTerminalUpdateBootCommand,
  refreshTerminalUpdateRuleSnapshotCommand,
  reconcileTerminalUpdateCommand,
} from '../features/commands/commands';
import {terminalUpdateRegistration} from '../features/slices/terminalUpdate';
import {
  selectTerminalUpdateActualVersions,
  selectTerminalUpdateRecentStatus,
  selectTerminalUpdateReportDelivery,
  selectTerminalUpdateRuleSnapshot,
  selectTerminalUpdateTask,
} from '../selectors/selectors';
import {selectConnectionState} from '@catering-v2s/kernel-base-terminal-data-client';
import type {
  UpdateNetworkSnapshotReader,
  UpdateRuleSnapshotContext,
  UpdateTargetSourceProvider,
} from '../types/terminalUpdate';

export const unavailableUpdateTargetSourceProvider: UpdateTargetSourceProvider = Object.freeze({
  readTarget: async () => null,
});

export const createTerminalUpdateModule = (
  input: Readonly<{
    port: UpdatePort;
    /** Platform RFC 4122 UUID source for persisted task IDs and TDC report identities. */
    createProtocolUuid: () => string;
    sourceProvider?: UpdateTargetSourceProvider;
    readNetworkSnapshot?: UpdateNetworkSnapshotReader;
    readRuleSnapshotContext?: (state: ReturnType<RuntimeModuleContext['getState']>) => UpdateRuleSnapshotContext | null;
  }>,
): RuntimeModule => {
  const actor = createTerminalUpdateActor({
    port: input.port,
    createProtocolUuid: input.createProtocolUuid,
    sourceProvider: input.sourceProvider,
    readRuleSnapshotContext: input.readRuleSnapshotContext,
    readNetworkSnapshot: input.readNetworkSnapshot,
  });
  const commandDefinitions = [
    acceptTerminalUpdateTargetCommand,
    clearTerminalUpdateReportContextCommand,
    confirmTerminalUpdateBootCommand,
    refreshTerminalUpdateRuleSnapshotCommand,
    reconcileTerminalUpdateCommand,
  ] as const;
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commands: commandDefinitions.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions,
    selectorDefinitions: [
      selectTerminalUpdateActualVersions,
      selectTerminalUpdateTask,
      selectTerminalUpdateRecentStatus,
      selectTerminalUpdateReportDelivery,
      selectTerminalUpdateRuleSnapshot,
    ],
    actors: [{name: actor.actorName}],
    actorDefinitions: [actor],
    slices: [
      {name: terminalUpdateRegistration.name, persistIntent: 'owner-only' as const, resetIntent: 'retain' as const},
    ],
    stateSlices: [terminalUpdateRegistration],
    install: async (context: RuntimeModuleContext) => {
      const result = await context.dispatchCommand(
        reconcileTerminalUpdateCommand,
        Object.freeze({resumeFixedTask: false}),
      );
      if (result.status !== 'completed')
        throw new Error(`Terminal update startup reconciliation failed: ${result.status}`);
      const refresh = async () => {
        const currentContext = input.readRuleSnapshotContext?.(context.getState()) ?? null;
        const connection = selectConnectionState(context.getState());
        const key =
          currentContext === null
            ? 'not-ready'
            : `${currentContext.terminalRef}:${currentContext.bindingGeneration}:${currentContext.storeRef}:${currentContext.projectRef}:${currentContext.projectUpdatedAtEpochMillis}:${connection.status}`;
        if (key === lastRefreshKey && currentContext !== null && connection.status !== 'connected') return;
        if (key === lastRefreshKey) return;
        context.platformPorts.logger.info({
          category: 'terminal-update.rules',
          event: 'terminal-update.rules.refresh-evaluated',
          message: 'Evaluated the current owner context for the terminal rule snapshot',
          data: {contextReady: currentContext !== null, connectionStatus: connection.status},
        });
        lastRefreshKey = key;
        const refreshed = await context.dispatchCommand(refreshTerminalUpdateRuleSnapshotCommand, Object.freeze({}), {
          requestId: createRequestId(),
        });
        const snapshot = selectTerminalUpdateRuleSnapshot(context.getState());
        context.platformPorts.logger.info({
          category: 'terminal-update.rules',
          event: 'terminal-update.rules.refresh-readback',
          message: 'Read the terminal rule snapshot state after refresh',
          data: {
            dispatchStatus: refreshed.status,
            snapshotStatus: snapshot.status,
            errorCode: snapshot.errorCode,
            itemCount: snapshot.items.length,
            contextPresent: snapshot.contextIdentity !== null,
            selectedSpacePresent: snapshot.selectedSpace !== null,
          },
        });
        if (refreshed.status !== 'completed')
          context.platformPorts.logger.warn({
            category: 'terminal-update.rules',
            event: 'terminal-update.rules.refresh-dispatch-failed',
            message: 'Rule snapshot refresh command did not complete',
            data: {dispatchStatus: refreshed.status},
          });
      };
      let lastRefreshKey = '';
      await refresh();
      const unsubscribe = context.subscribeState(() => {
        void refresh().catch(error => {
          context.platformPorts.logger.error({
            category: 'terminal-update.rules',
            event: 'terminal-update.rules.refresh-failed',
            message: 'Rule snapshot refresh failed while observing Runtime state',
            data: {errorName: error instanceof Error ? error.name : 'UnknownError'},
          });
        });
      });
      context.registerResource(unsubscribe);
    },
    onApplicationReset: async (context: RuntimeModuleContext) => {
      const result = await context.dispatchCommand(clearTerminalUpdateReportContextCommand, Object.freeze({}));
      if (result.status !== 'completed') throw new Error(`Terminal update report reset failed: ${result.status}`);
      const refreshed = await context.dispatchCommand(refreshTerminalUpdateRuleSnapshotCommand, Object.freeze({}), {
        requestId: createRequestId(),
      });
      if (refreshed.status !== 'completed')
        throw new Error(`Terminal update snapshot reset failed: ${refreshed.status}`);
    },
  });
};
