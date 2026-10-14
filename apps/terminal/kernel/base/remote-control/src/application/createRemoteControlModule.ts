import {
  createRuntimeModule,
  selectRuntimeInstanceMode,
  type RuntimeModule,
  type RuntimeModuleContext,
} from '@catering-v2s/kernel-base-runtime';
import type {RemoteControlPort, RemoteControlPortEvent} from '@catering-v2s/kernel-base-platform-ports';
import {runtimeModuleDependencyNames} from '../dependencies';
import {moduleKind, moduleName} from '../moduleName';
import {createRemoteControlActor} from '../features/actors/remoteControlActor';
import {
  joinRemoteControlCommand,
  remoteControlPortEventCommand,
  startRemoteControlCommand,
  stopRemoteControlCommand,
  type RemoteControlPortEventPayload,
} from '../declarations/commands';
import {remoteControlStateSlice} from '../features/slices/remoteControl';
import {selectRemoteControlScreen} from '../selectors/selectRemoteControlScreen';
import {selectRemoteControlStatus} from '../selectors/selectRemoteControlStatus';
import {selectActivationState, selectConnectionState} from '@catering-v2s/kernel-base-terminal-data-client';
import {selectTopologyFacts, selectTopologyState} from '@catering-v2s/kernel-base-topology';
import type {ServerConfigDefaults} from '@catering-v2s/kernel-base-server-config';
import {readRemoteControlSignalConfiguration} from './readRemoteControlSignalConfiguration';

const toPayload = (event: RemoteControlPortEvent): RemoteControlPortEventPayload => {
  if (event.type === 'data')
    return Object.freeze({
      type: event.type,
      sessionId: event.sessionId,
      senderIdentity: event.senderIdentity,
      payload: Object.freeze(Array.from(event.payload)),
    });
  if (event.type === 'screen-ready') return Object.freeze({...event});
  if (event.type === 'cleanup-failed') return Object.freeze({...event});
  return Object.freeze({...event});
};

export const createRemoteControlModule = (
  input: Readonly<{
    /** Must match the moduleName published by this Runtime's TopologyIdentity. */
    topologyModuleName: string;
    port: RemoteControlPort;
    serverSpaces: ServerConfigDefaults;
  }>,
): RuntimeModule => {
  const readSignalConfiguration = (state: ReturnType<RuntimeModuleContext['getState']>) =>
    readRemoteControlSignalConfiguration(state, input.serverSpaces);
  const remote = createRemoteControlActor({
    topologyModuleName: input.topologyModuleName,
    port: input.port,
    readSignalConfiguration,
  });
  const commands = [
    startRemoteControlCommand,
    joinRemoteControlCommand,
    stopRemoteControlCommand,
    remoteControlPortEventCommand,
  ] as const;
  return createRuntimeModule({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commandDefinitions: commands,
    selectorDefinitions: [selectRemoteControlStatus, selectRemoteControlScreen],
    actorDefinitions: [remote.actor],
    stateSlices: [remoteControlStateSlice],
    install: async (context: RuntimeModuleContext) => {
      context.registerAsyncResource(remote.dispose);
      let lastEnvironment = JSON.stringify(readEnvironment(context.getState(), readSignalConfiguration));
      const unsubscribeState = context.subscribeState(() => {
        const state = context.getState();
        const nextEnvironment = JSON.stringify(readEnvironment(state, readSignalConfiguration));
        if (nextEnvironment === lastEnvironment) return;
        lastEnvironment = nextEnvironment;
        const current = selectRemoteControlStatus(state);
        const sessionId = current.sessionId;
        if (sessionId !== null && (current.phase === 'starting' || current.phase === 'active')) {
          void context
            .dispatchCommand(remoteControlPortEventCommand, {type: 'state-changed'})
            .catch((error: unknown) => {
              context.platformPorts.logger
                .scope({moduleName, layer: 'kernel', subsystem: 'remote-control', component: 'environment-watch'})
                .error({
                  category: 'terminal.remote-control.environment',
                  event: 'environment-change-dispatch-failed',
                  message: 'Remote-control environment change could not be applied',
                  data: {errorName: error instanceof Error ? error.name : 'UnknownError'},
                });
            });
        }
      });
      context.registerResource(unsubscribeState);
      const unsubscribe = input.port.subscribeEvents(event => {
        void context
          .dispatchCommand(remoteControlPortEventCommand, toPayload(event))
          .then(result => {
            if (result.status !== 'completed') {
              context.platformPorts.logger
                .scope({moduleName, layer: 'kernel', subsystem: 'remote-control', component: 'port-events'})
                .warn({
                  category: 'terminal.remote-control.port-event',
                  event: 'port-event-dispatch-failed',
                  message: 'Remote-control port event could not be applied by the owner actor',
                  data: {eventType: event.type, dispatchStatus: result.status, sessionId: event.sessionId},
                });
            }
          })
          .catch((error: unknown) => {
            context.platformPorts.logger
              .scope({moduleName, layer: 'kernel', subsystem: 'remote-control', component: 'port-events'})
              .error({
                category: 'terminal.remote-control.port-event',
                event: 'port-event-dispatch-threw',
                message: 'Remote-control port event dispatch threw',
                data: {eventType: event.type, errorName: error instanceof Error ? error.name : 'UnknownError'},
              });
          });
      });
      context.registerResource(unsubscribe);
    },
  });
};

const readEnvironment = (
  state: ReturnType<RuntimeModuleContext['getState']>,
  readSignalConfiguration: (
    state: ReturnType<RuntimeModuleContext['getState']>,
  ) => Readonly<{url: string; identity: string}> | null,
): Readonly<Record<string, unknown>> => {
  const activation = selectActivationState(state);
  const connection = selectConnectionState(state);
  const topology = selectTopologyFacts(state);
  const topologyState = selectTopologyState(state);
  return Object.freeze({
    mode: selectRuntimeInstanceMode(state),
    activationStatus: activation.status,
    bindingGeneration: activation.bindingGeneration,
    connectionStatus: connection.status,
    connectionSessionId: connection.sessionId ?? null,
    paired: topology?.paired ?? false,
    peerReachable: topology?.peerReachable ?? false,
    peerStateSyncConnectionId: topologyState.peerStateSyncConnectionId,
    peerModuleName: topology?.peerIdentity?.moduleName ?? topology?.masterLocator?.identity.moduleName ?? null,
    peerNodeId: topology?.peerIdentity?.nodeId ?? topology?.masterLocator?.identity.nodeId ?? null,
    signalConfiguration: readSignalConfiguration(state),
  });
};
