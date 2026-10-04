import {describe, expect, it} from 'vitest';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {contentStateSliceName} from '@catering-v2s/kernel-base-ui-state';
import {sessionSliceName} from '@catering-v2s/kernel-feature-sample-staff-session';
import {wallpaperSliceName} from '@catering-v2s/kernel-feature-sample-wallpaper';
import {serverConfigSliceName} from '@catering-v2s/kernel-base-server-config';
import {
  moduleName as terminalClientModuleName,
  terminalClientStatusProjectionSliceName,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {topologySliceName} from '@catering-v2s/kernel-base-topology';
import {
  selectSampleWallpaperConsoleBusinessInterlockActive,
  selectSampleWallpaperConsoleBusinessMutationAllowed,
  selectSampleWallpaperConsoleRouteStage,
  selectSampleWallpaperConsoleStaffLoginAllowed,
} from '../src/application/module';

const requiredSlices = [
  contentStateSliceName('MAIN'),
  sessionSliceName,
  wallpaperSliceName,
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

describe('wallpaper console branch business interlock', () => {
  it('does not make a live TDS socket a staff or business qualification', () => {
    const state = rootWith({mode: 'MASTER', reachable: false, connectionId: null, revisions: {}});
    expect(selectSampleWallpaperConsoleStaffLoginAllowed(state)).toBe(true);
    const authenticated = {
      ...state,
      [sessionSliceName]: {status: 'authenticated', operatorName: 'A001', hostQualification: null},
    } as StateRoot;
    expect(selectSampleWallpaperConsoleBusinessInterlockActive(authenticated)).toBe(false);
    expect(selectSampleWallpaperConsoleBusinessMutationAllowed(authenticated)).toBe(true);
  });

  it('blocks while staff, placement, or host wallpaper is not applied on the current peer', () => {
    expect(
      selectSampleWallpaperConsoleBusinessInterlockActive(
        rootWith({mode: 'SLAVE', reachable: false, connectionId: null, revisions: {}}),
      ),
    ).toBe(true);
    expect(
      selectSampleWallpaperConsoleBusinessInterlockActive(
        rootWith({
          mode: 'SLAVE',
          reachable: true,
          connectionId: 'current',
          revisions: {[requiredSlices[0]]: 1, [requiredSlices[1]]: 1},
        }),
      ),
    ).toBe(true);
    expect(
      selectSampleWallpaperConsoleBusinessInterlockActive(
        rootWith({
          mode: 'SLAVE',
          reachable: true,
          connectionId: 'current',
          revisions: Object.fromEntries(requiredSlices.map(sliceName => [sliceName, 1])),
        }),
      ),
    ).toBe(false);
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

    expect(selectSampleWallpaperConsoleRouteStage(staleStaff)).toBe('activation');
  });
});
