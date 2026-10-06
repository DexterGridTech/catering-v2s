import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import {
  selectActivationState,
  selectConnectionLatency,
  selectConnectionState,
  selectTerminalClientStatusProjection,
  terminalClientStatusProjectionSliceName,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {selectTopologyRequiredProjectionsReady, selectTopologyState} from '@catering-v2s/kernel-base-topology';
import type {StateRoot} from '@catering-v2s/kernel-base-state';

export type ActivationStatusView = Readonly<{
  readonly activation: ReturnType<typeof selectActivationState>;
  readonly connection: ReturnType<typeof selectConnectionState>;
  readonly lastRttMs: number | null;
  readonly currentPeerValue: boolean;
}>;

/** A matching persisted host cache is display-only until the current peer applies its revision. */
const selectActivationStatusViewImplementation = (state: StateRoot): ActivationStatusView | null => {
  if (selectRuntimeInstanceMode(state) === 'MASTER') {
    const latency = selectConnectionLatency(state);
    return Object.freeze({
      activation: selectActivationState(state),
      connection: selectConnectionState(state),
      lastRttMs: latency.samples.length === 0 ? null : latency.lastRttMs,
      currentPeerValue: true,
    });
  }
  const projection = selectTerminalClientStatusProjection(state);
  if (!projection.available || projection.activation === null || projection.connection === null) return null;
  const peerIdentity = selectTopologyState(state).peerIdentity;
  if (peerIdentity === null || peerIdentity.nodeId !== projection.sourceNodeId) return null;
  return Object.freeze({
    activation: projection.activation,
    connection: projection.connection,
    lastRttMs: projection.lastRttMs,
    currentPeerValue: selectTopologyRequiredProjectionsReady(state, [terminalClientStatusProjectionSliceName]),
  });
};

export const selectActivationStatusView = defineStateSelector(moduleName, 'selectActivationStatusView', {
  parameters: [],
  selector: selectActivationStatusViewImplementation,
});
