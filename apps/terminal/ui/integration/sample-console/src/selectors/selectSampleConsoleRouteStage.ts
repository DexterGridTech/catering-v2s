import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {selectHostStaffQualification} from '@catering-v2s/kernel-feature-sample-staff-session';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {selectTopologyState} from '@catering-v2s/kernel-base-topology';
import {selectActivationStatusView} from '@catering-v2s/ui-base-terminal-activation';
import {isSampleConsoleBusinessInterlocked} from './shared/sampleConsoleState';
import {moduleName} from '../moduleName';

export type SampleConsoleRouteStage = 'activation' | 'staff' | 'business';

const selectSampleConsoleRouteStageImplementation = (state: StateRoot): SampleConsoleRouteStage | null => {
  const topology = selectTopologyState(state);
  if (topology.repairPending) return null;
  const activationView = selectActivationStatusView(state);
  if (activationView === null || !activationView.currentPeerValue) return null;
  const status = activationView.activation.status;
  if (status === 'activating' || status === 'cancelling') return null;
  if (status === 'inactive') return 'activation';
  if (isSampleConsoleBusinessInterlocked(state)) return null;
  const staff = selectHostStaffQualification(state);
  if (staff === null) return null;
  return staff.status === 'authenticated' ? 'business' : 'staff';
};

export const selectSampleConsoleRouteStage = defineStateSelector(moduleName, 'selectSampleConsoleRouteStage', {
  parameters: [],
  selector: selectSampleConsoleRouteStageImplementation,
});
