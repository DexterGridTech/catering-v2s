import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import {readTerminalUpdateState} from '../foundations/readTerminalUpdateState';

export const selectTerminalUpdateTask = defineStateSelector(moduleName, 'selectTerminalUpdateTask', {
  parameters: [],
  selector: (root: StateRoot) => readTerminalUpdateState(root).currentTask,
});
