import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {DisplayMode} from '@catering-v2s/kernel-base-display-context';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import type {ContainerKey} from '../types/catalog';
import type {ScreenPlacement} from '../types/content';
import {selectCurrentContentState} from './contentState';

const requireDisplayMode = (value: unknown): DisplayMode => {
  if (value !== 'PRIMARY' && value !== 'SECONDARY') {
    throw new Error(`[ui-state] invalid displayMode: ${String(value)}`);
  }
  return value;
};

const requireContainerKey = (value: ContainerKey): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('[ui-state] containerKey must be non-empty');
  }
  return value;
};

const selectScreenImplementation = (
  root: StateRoot,
  displayMode: DisplayMode,
  containerKey: ContainerKey,
): ScreenPlacement | undefined =>
  selectCurrentContentState(root).contentSets[requireDisplayMode(displayMode)].containers[requireContainerKey(containerKey)];

export const selectScreen = defineStateSelector(moduleName, 'selectScreen', {
  parameters: [{kind: 'enum', values: ['PRIMARY', 'SECONDARY']}, {kind: 'string'}],
  selector: selectScreenImplementation,
});
