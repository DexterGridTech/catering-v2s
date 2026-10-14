import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {selectHostStaffQualification} from '@catering-v2s/kernel-feature-sample-staff-session';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {selectTopologyState} from '@catering-v2s/kernel-base-topology';
import {hasCurrentActivatedTerminal, isSampleConsoleBusinessInterlocked} from './shared/sampleConsoleState';
import {moduleName} from '../moduleName';

const selectSampleConsoleBusinessMutationAllowedImplementation = (state: StateRoot): boolean =>
  !selectTopologyState(state).repairPending &&
  !isSampleConsoleBusinessInterlocked(state) &&
  hasCurrentActivatedTerminal(state) &&
  selectHostStaffQualification(state)?.status === 'authenticated';

export const selectSampleConsoleBusinessMutationAllowed = defineStateSelector(
  moduleName,
  'selectSampleConsoleBusinessMutationAllowed',
  {parameters: [], selector: selectSampleConsoleBusinessMutationAllowedImplementation},
);
