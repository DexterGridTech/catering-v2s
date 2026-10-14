import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import type {TerminalLatencySample} from '../types/client';
import {terminalDataClientParameters} from '../declarations/parameters';
import {readTerminalDataClientState} from './readTerminalDataClientState';

const selectConnectionLatencyImplementation = (
  state: StateRoot,
  now: number = Date.now(),
): Readonly<{lastRttMs: number; samples: readonly TerminalLatencySample[]}> => {
  const current = readTerminalDataClientState(state);
  const maxSamples =
    current.heartbeatIntervalMs === null
      ? 0
      : Math.floor(terminalDataClientParameters.latencyWindowMs.defaultValue / current.heartbeatIntervalMs);
  const samples =
    maxSamples === 0
      ? []
      : current.latencySamples
          .filter(sample => sample.observedAt >= now - terminalDataClientParameters.latencyWindowMs.defaultValue)
          .slice(-maxSamples);
  return Object.freeze({lastRttMs: current.lastRttMs, samples: Object.freeze(samples)});
};

export const selectConnectionLatency = defineStateSelector(moduleName, 'selectConnectionLatency', {
  parameters: [{kind: 'number', optional: true}],
  selector: selectConnectionLatencyImplementation,
});
