import type {RuntimeModule, RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import type {RemoteControlPort, RemoteControlPortEvent} from '@catering-v2s/kernel-base-platform-ports';
import {runtimeModuleDependencyNames} from '../dependencies';
import {moduleKind, moduleName} from '../moduleName';
import {createRemoteControlActor} from '../features/actors/remoteControlActor';
import {joinRemoteControlCommand, remoteControlPortEventCommand, startRemoteControlCommand, stopRemoteControlCommand, type RemoteControlPortEventPayload} from '../features/commands/commands';
import {remoteControlStateSlice, remoteControlSliceName} from '../features/slices/remoteControl';
import {selectRemoteControlScreen, selectRemoteControlStatus} from '../selectors/selectors';
import {selectActivationState, selectConnectionState} from '@catering-v2s/kernel-base-terminal-data-client';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {selectTopologyFacts, selectTopologyState} from '@catering-v2s/kernel-base-topology';

const toPayload = (event: RemoteControlPortEvent): RemoteControlPortEventPayload => {
  if (event.type === 'data') return Object.freeze({type: event.type, sessionId: event.sessionId, senderIdentity: event.senderIdentity, payload: Object.freeze(Array.from(event.payload))});
  if (event.type === 'screen-ready') return Object.freeze({...event});
  if (event.type === 'cleanup-failed') return Object.freeze({...event});
  return Object.freeze({...event});
};

export const createRemoteControlModule = (input: Readonly<{
  applicationId: string;
  port: RemoteControlPort;
  readSignalConfiguration: (state: ReturnType<RuntimeModuleContext['getState']>) => Readonly<{url: string; identity: string}> | null;
}>): RuntimeModule => {
  const remote = createRemoteControlActor(input);
  const commands = [startRemoteControlCommand, joinRemoteControlCommand, stopRemoteControlCommand, remoteControlPortEventCommand] as const;
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commands: commands.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions: commands,
    selectorDefinitions: [selectRemoteControlStatus, selectRemoteControlScreen],
    actors: [{name: remote.actor.actorName}],
    actorDefinitions: [remote.actor],
    slices: [{name: remoteControlSliceName, persistIntent: 'never' as const, syncIntent: 'isolated' as const}],
    stateSlices: [remoteControlStateSlice],
    install: async (context: RuntimeModuleContext) => {
      context.registerAsyncResource(remote.dispose);
      let lastEnvironment = JSON.stringify(readEnvironment(context.getState(), input.readSignalConfiguration));
      const unsubscribeState = context.subscribeState(() => {
        const state = context.getState();
        const nextEnvironment = JSON.stringify(readEnvironment(state, input.readSignalConfiguration));
        if (nextEnvironment === lastEnvironment) return;
        lastEnvironment = nextEnvironment;
        const current = selectRemoteControlStatus(state);
        const sessionId = current.sessionId;
        if (sessionId !== null && (current.phase === 'starting' || current.phase === 'active')) {
          void context.dispatchCommand(remoteControlPortEventCommand, {type: 'state-changed'}).catch((error: unknown) => {
            context.platformPorts.logger.scope({moduleName, layer: 'kernel', subsystem: 'remote-control', component: 'environment-watch'}).error({
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
        void context.dispatchCommand(remoteControlPortEventCommand, toPayload(event)).then(result => {
          if (result.status !== 'completed') {
            context.platformPorts.logger.scope({moduleName, layer: 'kernel', subsystem: 'remote-control', component: 'port-events'}).warn({
              category: 'terminal.remote-control.port-event',
              event: 'port-event-dispatch-failed',
              message: 'Remote-control port event could not be applied by the owner actor',
              data: {eventType: event.type, dispatchStatus: result.status, sessionId: event.sessionId},
            });
          }
        }).catch((error: unknown) => {
          context.platformPorts.logger.scope({moduleName, layer: 'kernel', subsystem: 'remote-control', component: 'port-events'}).error({
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
  readSignalConfiguration: (state: ReturnType<RuntimeModuleContext['getState']>) => Readonly<{url: string; identity: string}> | null,
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
