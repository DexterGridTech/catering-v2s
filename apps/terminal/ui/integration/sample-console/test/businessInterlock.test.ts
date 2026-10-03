import {describe, expect, it} from 'vitest';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {contentStateSliceName} from '@catering-v2s/kernel-base-ui-state';
import {memberSliceName} from '@catering-v2s/kernel-feature-sample-member-registry';
import {sessionSliceName} from '@catering-v2s/kernel-feature-sample-staff-session';
import {topologySliceName} from '@catering-v2s/kernel-base-topology';
import {selectSampleConsoleBusinessInterlockActive} from '../src/assembly/assembly';

const requiredSlices = [contentStateSliceName('MAIN'), sessionSliceName, memberSliceName] as const;

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

describe('sample console branch business interlock', () => {
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
          revisions: {[requiredSlices[0]]: 1, [requiredSlices[1]]: 1, [requiredSlices[2]]: 4},
        }),
      ),
    ).toBe(false);
    expect(
      selectSampleConsoleBusinessInterlockActive(
        rootWith({mode: 'SLAVE', reachable: true, connectionId: 'replacement', revisions: {}}),
      ),
    ).toBe(true);
  });
});
