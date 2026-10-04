import {describe, expect, it} from 'vitest';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {contentStateSliceName} from '@catering-v2s/kernel-base-ui-state';
import {memberSliceName} from '@catering-v2s/kernel-feature-sample-member-registry';
import {sessionSliceName} from '@catering-v2s/kernel-feature-sample-staff-session';
import {serverConfigSliceName} from '@catering-v2s/kernel-base-server-config';
import {
  moduleName as terminalClientModuleName,
  terminalClientStatusProjectionSliceName,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {topologySliceName} from '@catering-v2s/kernel-base-topology';
import {
  selectSampleConsoleBusinessInterlockActive,
  selectSampleConsoleBusinessMutationAllowed,
  selectSampleConsoleRouteStage,
  selectSampleConsoleStaffLoginAllowed,
} from '../src/application/module';

const requiredSlices = [
  contentStateSliceName('MAIN'),
  sessionSliceName,
  memberSliceName,
  serverConfigSliceName,
  terminalClientStatusProjectionSliceName,
] as const;
const emptyContent = Object.freeze({
  contentSets: Object.freeze({
    PRIMARY: Object.freeze({containers: Object.freeze({}), layers: Object.freeze([])}),
    SECONDARY: Object.freeze({containers: Object.freeze({}), layers: Object.freeze([])}),
  }),
});

const rootWith = (
  input: Readonly<{
    mode: 'MASTER' | 'SLAVE';
    reachable: boolean;
    connectionId: string | null;
    revisions: Readonly<Record<string, number>>;
  }>,
): StateRoot =>
  ({
    'kernel.base.runtime.instance-mode': {instanceMode: input.mode},
    [contentStateSliceName('MAIN')]: emptyContent,
    [contentStateSliceName('BRANCH')]: emptyContent,
    [sessionSliceName]: {status: 'anonymous', operatorName: null, hostQualification: null},
    [`${terminalClientModuleName}.client`]: {
      credential: {
        groupWorkspaceKey: 'aurora',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        deviceId: 'device-1',
        bindingGeneration: 1,
        credentialSecret: 'test-secret',
      },
      pendingActivations: {},
      activationStatus: 'active',
      connection: {status: 'backoff', addressName: null, nodeId: null, lastCloseReason: 'NETWORK_ERROR'},
      heartbeatIntervalMs: null,
      nextPingSequence: 1,
      lastRttMs: 0,
      latencySamples: [],
    },
    [topologySliceName]: {
      peerReachable: input.reachable,
      peerIdentity: input.reachable ? {nodeId: 'host-1', instanceMode: 'MASTER', displayRole: 'CHIEF'} : null,
      peerStateSyncConnectionId: input.connectionId,
      peerAppliedStateSyncRevisions: input.revisions,
      peerFailedStateSyncRevisions: {},
    },
  }) as unknown as StateRoot;

describe('sample console branch business interlock', () => {
  it('does not make a live TDS socket a staff or business qualification', () => {
    const state = rootWith({mode: 'MASTER', reachable: false, connectionId: null, revisions: {}});
    expect(selectSampleConsoleStaffLoginAllowed(state)).toBe(true);
    const authenticated = {
      ...state,
      [sessionSliceName]: {status: 'authenticated', operatorName: 'A001', hostQualification: null},
    } as StateRoot;
    expect(selectSampleConsoleBusinessInterlockActive(authenticated)).toBe(false);
    expect(selectSampleConsoleBusinessMutationAllowed(authenticated)).toBe(true);
  });

  it('blocks disconnected or incompletely applied peers and opens only on current required slices', () => {
    expect(
      selectSampleConsoleBusinessInterlockActive(
        rootWith({mode: 'MASTER', reachable: false, connectionId: null, revisions: {}}),
      ),
    ).toBe(false);
    expect(
      selectSampleConsoleBusinessInterlockActive(
        rootWith({mode: 'SLAVE', reachable: false, connectionId: null, revisions: {}}),
      ),
    ).toBe(true);
    expect(
      selectSampleConsoleBusinessInterlockActive(
        rootWith({
          mode: 'SLAVE',
          reachable: true,
          connectionId: 'current',
          revisions: {[requiredSlices[0]]: 1, [requiredSlices[1]]: 1},
        }),
      ),
    ).toBe(true);
    expect(
      selectSampleConsoleBusinessInterlockActive(
        rootWith({
          mode: 'SLAVE',
          reachable: true,
          connectionId: 'current',
          revisions: Object.fromEntries(
            requiredSlices.map(sliceName => [sliceName, sliceName === memberSliceName ? 4 : 1]),
          ),
        }),
      ),
    ).toBe(false);
    expect(
      selectSampleConsoleBusinessInterlockActive(
        rootWith({mode: 'SLAVE', reachable: true, connectionId: 'replacement', revisions: {}}),
      ),
    ).toBe(true);
  });

  it('routes an inactive MASTER to activation despite stale restored staff qualification', () => {
    const state = rootWith({mode: 'MASTER', reachable: false, connectionId: null, revisions: {}});
    const staleStaff = {
      ...state,
      [sessionSliceName]: {status: 'authenticated', operatorName: 'A001', hostQualification: null},
      [`${terminalClientModuleName}.client`]: {
        ...(state[`${terminalClientModuleName}.client`] as Record<string, unknown>),
        credential: null,
        activationStatus: 'inactive',
      },
    } as StateRoot;

    expect(selectSampleConsoleRouteStage(staleStaff)).toBe('activation');
  });
});
