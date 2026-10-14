import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import {readSessionState} from '../foundations/readSessionState';

export const selectSessionState = defineStateSelector(moduleName, 'selectSessionState', {
  parameters: [],
  selector: (root: StateRoot) => readSessionState(root),
});
