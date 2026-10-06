import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import type {TopologyState} from '../types/state';

export type {TopologyState} from '../types/state';

export const topologySliceName = `${moduleName}.state` as const;

const selectTopologyStateImplementation = (state: StateRoot): TopologyState => {
  const value = state[topologySliceName];
  if (value === undefined || value === null) throw new Error(`Missing topology slice: ${topologySliceName}`);
  return value as TopologyState;
};

const selectTopologyRequiredProjectionsReadyImplementation = (
  state: StateRoot,
  requiredSliceNames: readonly string[],
): boolean => {
  const topology = selectTopologyState(state);
  if (!topology.peerReachable || topology.peerIdentity === null || topology.peerStateSyncConnectionId === null)
    return false;
  return requiredSliceNames.every(sliceName => {
    const appliedRevision = topology.peerAppliedStateSyncRevisions[sliceName];
    const failedRevision = topology.peerFailedStateSyncRevisions[sliceName];
    return appliedRevision !== undefined && (failedRevision === undefined || appliedRevision >= failedRevision);
  });
};

export const selectTopologyRequiredProjectionsReady = defineStateSelector(
  moduleName,
  'selectTopologyRequiredProjectionsReady',
  {
    parameters: [{kind: 'array', items: {kind: 'string'}}],
    selector: selectTopologyRequiredProjectionsReadyImplementation,
  },
);
export const selectTopologyState = defineStateSelector(moduleName, 'selectTopologyState', {
  parameters: [],
  selector: selectTopologyStateImplementation,
});
