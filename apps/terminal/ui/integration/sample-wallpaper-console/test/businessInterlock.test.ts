import {describe, expect, it} from 'vitest';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {contentStateSliceName} from '@catering-v2s/kernel-base-ui-state';
import {sessionSliceName} from '@catering-v2s/kernel-feature-sample-staff-session';
import {wallpaperSliceName} from '@catering-v2s/kernel-feature-sample-wallpaper';
import {topologySliceName} from '@catering-v2s/kernel-base-topology';
import {selectSampleWallpaperConsoleBusinessInterlockActive} from '../src/assembly/assembly';

const requiredSlices = [contentStateSliceName('MAIN'), sessionSliceName, wallpaperSliceName] as const;

const rootWith = (input: Readonly<{mode: 'MASTER' | 'SLAVE'; reachable: boolean; connectionId: string | null; revisions: Readonly<Record<string, number>>}>): StateRoot =>
  ({
    'kernel.base.runtime.instance-mode': {instanceMode: input.mode},
    [topologySliceName]: {
      peerReachable: input.reachable,
      peerIdentity: input.reachable ? {nodeId: 'host-1', instanceMode: 'MASTER', displayRole: 'CHIEF'} : null,
      peerStateSyncConnectionId: input.connectionId,
      peerAppliedStateSyncRevisions: input.revisions,
    },
  }) as unknown as StateRoot;

describe('wallpaper console branch business interlock', () => {
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
          revisions: {[requiredSlices[0]]: 1, [requiredSlices[1]]: 1, [requiredSlices[2]]: 1},
        }),
      ),
    ).toBe(false);
  });
});
