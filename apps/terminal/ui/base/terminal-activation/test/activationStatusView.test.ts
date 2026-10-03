import {describe, expect, it} from 'vitest';
import {
  moduleName as terminalDataClientModuleName,
  terminalClientStatusProjectionSliceName,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {topologySliceName} from '@catering-v2s/kernel-base-topology';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {selectActivationStatusView} from '../src/selectors/selectActivationStatusView';

const projection = {
  available: true,
  sourceNodeId: 'host-device',
  activation: {
    status: 'active' as const,
    terminalRef: 'terminal-1',
    storeRef: 'store-1',
    groupWorkspaceKey: 'workspace-1',
    bindingGeneration: 4,
  },
  connection: {status: 'connected' as const, addressName: 'primary', nodeId: 'tds-1', lastCloseReason: null},
  lastRttMs: 19,
  updatedAt: 10,
};

const clientSliceName = `${terminalDataClientModuleName}.client`;

const branchState = (ready: boolean, localCredential = false): StateRoot => ({
  'kernel.base.runtime.instance-mode': {instanceMode: 'SLAVE'},
  [clientSliceName]: {
    credential: localCredential
      ? {
          groupWorkspaceKey: 'stale-workspace',
          terminalRef: 'stale-terminal',
          storeRef: 'stale-store',
          deviceId: 'stale-device',
          bindingGeneration: 9,
          credentialSecret: 'stale-secret',
        }
      : null,
    pendingActivations: {},
    activationStatus: 'inactive',
    connection: {status: 'stopped', addressName: null, nodeId: null, lastCloseReason: null},
    heartbeatIntervalMs: null,
    nextPingSequence: 1,
    lastRttMs: 0,
    latencySamples: [],
  },
  [terminalClientStatusProjectionSliceName]: {
    projection: {
      available: false,
      sourceNodeId: null,
      activation: null,
      connection: null,
      lastRttMs: null,
      updatedAt: 0,
    },
  },
  [topologySliceName]: {
    peerReachable: ready,
    peerIdentity: ready ? {deviceId: 'host-device', runtimeId: 'host-runtime', nodeId: 'host-device'} : null,
    peerStateSyncConnectionId: ready ? 'current-peer-connection' : null,
    peerAppliedStateSyncRevisions: ready ? {[terminalClientStatusProjectionSliceName]: 1} : {},
  },
});

describe('activation status view', () => {
  it('keeps a slave status unknown until the current peer projection is ready', () => {
    expect(selectActivationStatusView(branchState(false))).toBeNull();
    const state = {
      ...branchState(true),
      [terminalClientStatusProjectionSliceName]: {projection},
    };
    expect(selectActivationStatusView(state)).toMatchObject({
      activation: {status: 'active', terminalRef: 'terminal-1'},
      connection: {status: 'connected', nodeId: 'tds-1'},
      lastRttMs: 19,
    });
  });

  it('does not treat an isolated local SLAVE credential as current activation without a host projection', () => {
    expect(selectActivationStatusView(branchState(false, true))).toBeNull();
  });

  it('shows a matching cached projection as stale while the current peer revision is unavailable', () => {
    const base = branchState(true);
    const state = {
      ...base,
      [terminalClientStatusProjectionSliceName]: {projection},
      [topologySliceName]: {
        ...base[topologySliceName],
        peerStateSyncConnectionId: 'replacement-connection',
        peerAppliedStateSyncRevisions: {},
      },
    };
    expect(selectActivationStatusView(state)).toMatchObject({
      activation: {status: 'active'},
      currentPeerValue: false,
    });
  });

  it('does not display a persisted projection from a different host identity', () => {
    const base = branchState(true);
    const state = {
      ...base,
      [terminalClientStatusProjectionSliceName]: {projection},
      [topologySliceName]: {
        ...base[topologySliceName],
        peerIdentity: {deviceId: 'another-host', runtimeId: 'another-runtime', nodeId: 'another-node'},
      },
    };
    expect(selectActivationStatusView(state)).toBeNull();
  });
});
