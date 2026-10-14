import {onCommand, selectRuntimeInstanceMode, type ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {selectTerminalClientStatusProjection, terminalClientStatusProjectionSliceName} from '@catering-v2s/kernel-base-terminal-data-client';
import {selectTopologyRequiredProjectionsReady, selectTopologyState} from '@catering-v2s/kernel-base-topology';
import type {
  TerminalRemoteControlDescription,
  TerminalRemoteControlEndpointGrant,
} from '../../../generated/terminalApi';
import {joinRemoteControlCommand, type JoinRemoteControlPayload, type StopRemoteControlPayload} from '../../../declarations/commands';
import type {RemoteControlSessionFence} from './createRemoteControlSession';

type RemoteControlLog = (
  context: ActorExecutionContext,
  event: string,
  data?: Readonly<Record<string, string | number | boolean | null>>,
) => void;

type RemotePeerCommandDependencies = Readonly<{
  readonly topologyModuleName: string;
  readonly readSignalConfiguration: (
    state: ReturnType<ActorExecutionContext['getState']>,
  ) => Readonly<{url: string; identity: string}> | null;
  readonly log: RemoteControlLog;
  readonly createFence: (
    context: ActorExecutionContext,
    sessionId: string,
    signalConfiguration: Readonly<{url: string; identity: string}>,
  ) => RemoteControlSessionFence;
  readonly prepareEndpoint: (input: Readonly<{
    context: ActorExecutionContext;
    description: TerminalRemoteControlDescription;
    grant: TerminalRemoteControlEndpointGrant;
    mode: 'MASTER' | 'SLAVE';
    fence: RemoteControlSessionFence;
  }>) => Promise<StateJsonValue>;
  readonly stop: (context: ActorExecutionContext, payload: StopRemoteControlPayload) => Promise<StateJsonValue>;
  readonly findEndpoint: (description: TerminalRemoteControlDescription, endpointId: string) => unknown | null;
  readonly isRecord: (value: unknown) => value is Record<string, unknown>;
}>;

export const installRemotePeerCommands = (deps: RemotePeerCommandDependencies) =>
  onCommand(joinRemoteControlCommand, async context => {
    const payload = context.command.payload as JoinRemoteControlPayload;
    const state = context.getState();
    const topology = selectTopologyState(state);
    const master = topology.masterLocator?.identity;
    const projection = selectTerminalClientStatusProjection(state);
    const statusProjectionReady = selectTopologyRequiredProjectionsReady(state, [terminalClientStatusProjectionSliceName]);
    const mode = selectRuntimeInstanceMode(state);
    deps.log(context, 'peer-join-command-received', {
      sessionId: payload.description.sessionId,
      mode,
      topologyKind: payload.description.topologyKind,
    });
    const readinessReason =
      mode !== 'SLAVE'
        ? 'LOCAL_MODE_MISMATCH'
        : payload.description.topologyKind !== 'LAPTOP_PAIRED'
          ? 'TOPOLOGY_MISMATCH'
          : master?.moduleName !== deps.topologyModuleName
            ? 'MASTER_MODULE_MISMATCH'
            : projection.sourceNodeId !== master?.nodeId
              ? 'PROJECTION_SOURCE_MISMATCH'
              : !statusProjectionReady
                ? 'STATUS_PROJECTION_NOT_READY'
                : !projection.available
                  ? 'PROJECTION_UNAVAILABLE'
                  : projection.activation?.status !== 'active'
                    ? 'MASTER_NOT_ACTIVE'
                    : null;
    if (readinessReason !== null) {
      deps.log(context, 'peer-join-command-rejected', {
        sessionId: payload.description.sessionId,
        reason: readinessReason,
        resultStatus: 'rejected',
      });
      return {status: 'rejected', reason: 'PAIR_NOT_READY'};
    }
    const secondaryScreens = payload.description.screens.filter(screen => screen.screen === 'secondary');
    const grantScreens = payload.description.screens.filter(screen => screen.endpointId === payload.grant.endpointId);
    if (
      deps.findEndpoint(payload.description, payload.description.masterEndpointId) === null ||
      payload.description.masterEndpointId === payload.grant.endpointId ||
      secondaryScreens.length !== 1 ||
      secondaryScreens[0]?.endpointId !== payload.grant.endpointId ||
      grantScreens.length !== 1 ||
      grantScreens[0]?.screen !== 'secondary'
    ) {
      deps.log(context, 'peer-join-command-rejected', {
        sessionId: payload.description.sessionId,
        reason: 'GRANT_INVALID',
        resultStatus: 'rejected',
      });
      return {status: 'rejected', reason: 'GRANT_INVALID'};
    }
    const signalConfiguration = deps.readSignalConfiguration(state);
    if (signalConfiguration === null) {
      deps.log(context, 'peer-join-command-rejected', {
        sessionId: payload.description.sessionId,
        reason: 'CONFIG_UNAVAILABLE',
        resultStatus: 'rejected',
      });
      return {status: 'rejected', reason: 'CONFIG_UNAVAILABLE'};
    }
    const fence = deps.createFence(context, payload.description.sessionId, signalConfiguration);
    const result = await deps.prepareEndpoint({
      context,
      description: payload.description,
      grant: payload.grant,
      mode: 'SLAVE',
      fence,
    });
    if (!deps.isRecord(result) || result.status !== 'started')
      await deps.stop(context, {sessionId: payload.description.sessionId, reason: 'START_FAILED'});
    return result;
  });
