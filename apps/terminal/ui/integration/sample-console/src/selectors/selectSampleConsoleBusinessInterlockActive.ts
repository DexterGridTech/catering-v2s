import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import {isSampleConsoleBusinessInterlocked} from './shared/sampleConsoleState';

const selectSampleConsoleBusinessInterlockActiveImplementation = (state: StateRoot): boolean =>
  isSampleConsoleBusinessInterlocked(state);

export const selectSampleConsoleBusinessInterlockActive = defineStateSelector(
  moduleName,
  'selectSampleConsoleBusinessInterlockActive',
  {parameters: [], selector: selectSampleConsoleBusinessInterlockActiveImplementation},
);
