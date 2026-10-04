import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {terminalDataClientSliceName} from '../features/slices/terminalDataClient';
import type {
  TerminalActivationView,
  TerminalClientState,
  TerminalConnectionView,
  TerminalLatencySample,
  TerminalTopicSubscription,
} from '../types/client';

const readState = (state: StateRoot): TerminalClientState => {
  const slice = state[terminalDataClientSliceName];
  if (slice === undefined || slice === null) throw new Error('TERMINAL_DATA_CLIENT_STATE_MISSING');
  return slice as TerminalClientState;
};

export const selectActivationState = (state: StateRoot): TerminalActivationView => {
  const current = readState(state);
  const credential = current.credential;
  const status =
    current.activationStatus === 'cancelling'
      ? 'cancelling'
      : current.activationStatus === 'activating'
        ? 'activating'
        : credential !== null
          ? 'active'
          : Object.keys(current.pendingActivations).length > 0
            ? 'activating'
            : 'inactive';
  return Object.freeze({
    status,
    terminalRef: credential?.terminalRef ?? null,
    storeRef: credential?.storeRef ?? null,
    groupWorkspaceKey: credential?.groupWorkspaceKey ?? null,
    bindingGeneration: credential?.bindingGeneration ?? null,
  });
};

export const selectConnectionState = (state: StateRoot): TerminalConnectionView => readState(state).connection;

export const selectConnectionLatency = (
  state: StateRoot,
  now: number = Date.now(),
): Readonly<{lastRttMs: number; samples: readonly TerminalLatencySample[]}> => {
  const current = readState(state);
  const maxSamples = current.heartbeatIntervalMs === null ? 0 : Math.floor(7_200_000 / current.heartbeatIntervalMs);
  const samples =
    maxSamples === 0
      ? []
      : current.latencySamples.filter(sample => sample.observedAt >= now - 7_200_000).slice(-maxSamples);
  return Object.freeze({lastRttMs: current.lastRttMs, samples: Object.freeze(samples)});
};

export const selectTerminalTopicSubscriptions = (state: StateRoot): readonly TerminalTopicSubscription[] =>
  Object.freeze(Object.values(readState(state).topicSubscriptions));
