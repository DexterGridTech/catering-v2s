import type {ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {readDisplayInfo} from '@catering-v2s/kernel-base-display-context';
import {topologyTransportConfig} from '@catering-v2s/kernel-base-contracts';
import {topologyActions} from '../slices/topology';
import {selectTopologyState} from '../../selectors/selectTopologyState';
import {topologyPeerWsUrl} from '../../foundations/topologyPeerWsUrl';
import {
  reconcileTopologyHostCommand,
  reconcileTopologyPeerCommand,
  refreshTopologyDisplayCommand,
  setTopologyHostEnabledCommand,
  topologyDisplayChangedCommand,
  topologyHostEventCommand,
  requestTopologySlaveUnpairStateClearCommand,
} from '../../declarations/commands';
import {
  type TopologyActorInput,
  type PeerCloseResolution,
  hostFailureCode,
  hostStatusActionIfChanged,
  hostAddressActionIfChanged,
  readHostStatus,
  hostShouldRun,
  createTopologyHostIdentity,
  dispatchCompleted,
  resolvePeerClose,
  hostAddressFromStatus,
  topologyCallTimeoutMs,
} from './topologyActorSupport';

export const createTopologyRoleActor = (input: TopologyActorInput = {}): ActorDefinition =>
  defineActor(moduleName, 'role-lifecycle', [
    onCommand(setTopologyHostEnabledCommand, async context => {
      context.dispatchAction(topologyActions.setHostDesired(context.command.payload.enabled));
      return null;
    }),
    onCommand(topologyHostEventCommand, async context => {
      const event = context.command.payload;
      let peerCloseResolution: PeerCloseResolution | null = null;
      if (event.event === 'state-transfer-failed' && event.payloadFailure !== undefined) {
        context.dispatchAction(topologyActions.setPayloadFailure(event.payloadFailure));
        return null;
      }
      if (event.event === 'state-transfer-recovered') {
        context.dispatchAction(topologyActions.clearPayloadFailure());
        return null;
      }
      if (event.event === 'peer-accepted') {
        if (event.peerIdentity !== undefined)
          context.dispatchAction(topologyActions.setPeerIdentity(event.peerIdentity));
        context.dispatchAction(topologyActions.setPeerStateSyncConnection(event.connectionId ?? null));
        context.dispatchAction(topologyActions.setPeerReachable(true));
      }
      if (event.event === 'peer-connection-installed') {
        context.dispatchAction(topologyActions.setPeerStateSyncConnection(null));
        context.dispatchAction(topologyActions.setPeerReachable(false));
      }
      if (
        event.event === 'state-sync-slice-applied' &&
        event.connectionId &&
        event.sliceName &&
        event.revision !== undefined
      ) {
        context.dispatchAction(
          topologyActions.markPeerStateSyncSliceApplied({
            connectionId: event.connectionId,
            sliceName: event.sliceName,
            revision: event.revision,
          }),
        );
      }
      if (
        event.event === 'state-sync-slice-apply-failed' &&
        event.connectionId &&
        event.sliceName &&
        event.revision !== undefined
      ) {
        context.dispatchAction(
          topologyActions.markPeerStateSyncSliceFailed({
            connectionId: event.connectionId,
            sliceName: event.sliceName,
            revision: event.revision,
          }),
        );
      }
      if (event.event === 'close' || event.event === 'error' || event.event === 'peer-unreachable') {
        context.dispatchAction(topologyActions.setPeerStateSyncConnection(null));
        context.dispatchAction(topologyActions.setPeerReachable(false));
        context.dispatchAction(topologyActions.bumpPeerConnectionRevision());
        if (event.reason === 'TOPOLOGY_UNPAIRED') {
          const instanceMode = selectRuntimeInstanceMode(context.getState());
          if (instanceMode === 'SLAVE') {
            context.dispatchAction(topologyActions.setRepairPending(true));
            await dispatchCompleted({
              context,
              definition: requestTopologySlaveUnpairStateClearCommand,
              payload: Object.freeze({transition: 'peer-unpaired' as const}),
              label: 'Peer unpair slave TDC state clear',
            });
          } else {
            // A transient close preserves facts; only an explicit unpair notice
            // resolves the role-specific owner boundary.
            peerCloseResolution = await resolvePeerClose({context, instanceMode});
          }
        }
      }
      for (const action of peerCloseResolution?.actions ?? []) context.dispatchAction(action);
      return null;
    }),
    onCommand(refreshTopologyDisplayCommand, async context => {
      const displayInfo = await readDisplayInfo(context.platformPorts.device);
      const displayCount = displayInfo.status === 'valid' ? displayInfo.displayCount : null;
      const current = selectTopologyState(context.getState());
      if (current.displayCount !== displayCount) {
        context.dispatchAction(topologyActions.setDisplayCount(displayCount));
        await context.dispatchCommand(topologyDisplayChangedCommand, {displayCount});
      }
      return Object.freeze({status: displayInfo.status, displayCount});
    }),
    onCommand(reconcileTopologyHostCommand, async context => {
      const shouldRun = hostShouldRun(context);
      const status = await readHostStatus(context);
      if (!shouldRun) {
        if (status.status === 'succeeded' && status.value.state === 'stopped') {
          const action = hostStatusActionIfChanged(context, 'stopped');
          if (action !== undefined) context.dispatchAction(action);
          const stoppedAddressAction = hostAddressActionIfChanged(context, null);
          if (stoppedAddressAction !== undefined) context.dispatchAction(stoppedAddressAction);
          return Object.freeze({state: 'stopped' as const, desired: false});
        }
        const stoppingAddressAction = hostAddressActionIfChanged(context, null);
        if (stoppingAddressAction !== undefined) context.dispatchAction(stoppingAddressAction);
        const stoppingAction = hostStatusActionIfChanged(context, 'stopping');
        if (stoppingAction !== undefined) context.dispatchAction(stoppingAction);
        const stopped = await context.platformPorts.topologyHost.stop({timeoutMs: topologyCallTimeoutMs});
        if (stopped.status !== 'succeeded') {
          const errorCode = hostFailureCode(stopped);
          const errorAction = hostStatusActionIfChanged(context, 'error', errorCode);
          if (errorAction !== undefined) context.dispatchAction(errorAction);
          const errorAddressAction = hostAddressActionIfChanged(context, null);
          if (errorAddressAction !== undefined) context.dispatchAction(errorAddressAction);
          return Object.freeze({state: 'error' as const, desired: false, errorCode});
        }
        const stoppedAction = hostStatusActionIfChanged(context, 'stopped');
        if (stoppedAction !== undefined) context.dispatchAction(stoppedAction);
        const stoppedAfterStopAddressAction = hostAddressActionIfChanged(context, null);
        if (stoppedAfterStopAddressAction !== undefined) context.dispatchAction(stoppedAfterStopAddressAction);
        return Object.freeze({state: 'stopped' as const, desired: false});
      }

      if (status.status === 'succeeded' && status.value.state === 'running' && status.value.address !== undefined) {
        const runningAction = hostStatusActionIfChanged(context, 'running');
        if (runningAction !== undefined) context.dispatchAction(runningAction);
        const address = hostAddressFromStatus(status.value);
        const runningAddressAction = hostAddressActionIfChanged(context, address ?? null);
        if (runningAddressAction !== undefined) context.dispatchAction(runningAddressAction);
        return Object.freeze({state: 'running' as const, desired: true});
      }

      const startingAddressAction = hostAddressActionIfChanged(context, null);
      if (startingAddressAction !== undefined) context.dispatchAction(startingAddressAction);
      const startingAction = hostStatusActionIfChanged(context, 'starting');
      if (startingAction !== undefined) context.dispatchAction(startingAction);
      const started = await context.platformPorts.topologyHost.start({
        port: topologyTransportConfig.port,
        basePath: topologyTransportConfig.basePath,
        heartbeatIntervalMs: topologyTransportConfig.heartbeatIntervalMs,
        heartbeatTimeoutMs: topologyTransportConfig.heartbeatTimeoutMs,
        timeoutMs: topologyCallTimeoutMs,
        identity: createTopologyHostIdentity(context, input.moduleName),
      });
      if (started.status !== 'succeeded') {
        const errorCode = hostFailureCode(started);
        const errorAction = hostStatusActionIfChanged(context, 'error', errorCode);
        if (errorAction !== undefined) context.dispatchAction(errorAction);
        const startErrorAddressAction = hostAddressActionIfChanged(context, null);
        if (startErrorAddressAction !== undefined) context.dispatchAction(startErrorAddressAction);
        return Object.freeze({state: 'error' as const, desired: true, errorCode});
      }
      const settled = await readHostStatus(context);
      if (settled.status !== 'succeeded' || settled.value.state !== 'running' || settled.value.address === undefined) {
        const errorCode = settled.status === 'failed' ? settled.errorCode : 'TOPOLOGY_HOST_FAILED';
        const errorAction = hostStatusActionIfChanged(context, 'error', errorCode);
        if (errorAction !== undefined) context.dispatchAction(errorAction);
        const settleErrorAddressAction = hostAddressActionIfChanged(context, null);
        if (settleErrorAddressAction !== undefined) context.dispatchAction(settleErrorAddressAction);
        return Object.freeze({state: 'error' as const, desired: true, errorCode});
      }
      const runningAction = hostStatusActionIfChanged(context, 'running');
      if (runningAction !== undefined) context.dispatchAction(runningAction);
      const address = hostAddressFromStatus(settled.value);
      const settledAddressAction = hostAddressActionIfChanged(context, address ?? null);
      if (settledAddressAction !== undefined) context.dispatchAction(settledAddressAction);
      return Object.freeze({state: 'running' as const, desired: true});
    }),
    onCommand(reconcileTopologyPeerCommand, async context => {
      const topology = selectTopologyState(context.getState());
      const instanceMode = selectRuntimeInstanceMode(context.getState());
      if (
        input.peerChannel === undefined ||
        instanceMode !== 'SLAVE' ||
        topology.masterLocator === null ||
        topology.repairPending
      ) {
        return Object.freeze({connected: false, reason: 'not-configured'});
      }
      await input.peerChannel.connect(topologyPeerWsUrl(topology.masterLocator));
      return Object.freeze({connected: true});
    }),
  ]);
