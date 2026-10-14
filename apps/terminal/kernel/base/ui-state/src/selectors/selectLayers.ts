import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {DisplayMode} from '@catering-v2s/kernel-base-display-context';
import type {StateRoot, WorkspaceKey} from '@catering-v2s/kernel-base-state';
import {readContentState} from '../foundations/workspaceSlices';
import {moduleName} from '../moduleName';
import type {LayerEntry} from '../types/content';
import {selectCurrentContentState} from './contentState';

const requireDisplayMode = (value: unknown): DisplayMode => {
  if (value !== 'PRIMARY' && value !== 'SECONDARY') {
    throw new Error(`[ui-state] invalid displayMode: ${String(value)}`);
  }
  return value;
};

const selectLayersImplementation = (
  root: StateRoot,
  displayMode: DisplayMode,
  workspace?: WorkspaceKey,
): readonly LayerEntry[] => {
  const content =
    workspace === undefined
      ? selectCurrentContentState(root)
      : readContentState(root, workspace);
  return content.contentSets[requireDisplayMode(displayMode)].layers;
};

export const selectLayers = defineStateSelector(moduleName, 'selectLayers', {
  parameters: [
    {kind: 'enum', values: ['PRIMARY', 'SECONDARY']},
    {kind: 'enum', values: ['MAIN', 'BRANCH'], optional: true},
  ],
  selector: selectLayersImplementation,
});
