import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import {selectReadyUpdateContext} from './shared/selectReadyUpdateContext';

export const selectProjectTerminalUpdateContextFacts = defineStateSelector(
  moduleName,
  'selectProjectTerminalUpdateContextFacts',
  {
    parameters: [],
    selector: (root: StateRoot) => selectReadyUpdateContext(root)?.contextFacts ?? null,
  },
);
