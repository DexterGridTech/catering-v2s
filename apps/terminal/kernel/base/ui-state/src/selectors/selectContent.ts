import type {DisplayMode} from '@catering-v2s/kernel-base-display-context';
import {resolveWorkspace, selectDisplayRole} from '@catering-v2s/kernel-base-display-context';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot, WorkspaceKey} from '@catering-v2s/kernel-base-state';
import {readContentState} from '../foundations/workspaceSlices';
import type {ContainerKey} from '../types/catalog';
import type {LayerEntry, ScreenPlacement} from '../types/content';

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

const selectCurrentContentState = (root: StateRoot) =>
  readContentState(
    root,
    resolveWorkspace({
      instanceMode: selectRuntimeInstanceMode(root),
      displayRole: selectDisplayRole(root),
    }),
  );

export const selectScreen = (
  root: StateRoot,
  displayMode: DisplayMode,
  containerKey: ContainerKey,
): ScreenPlacement | undefined => {
  return selectCurrentContentState(root).contentSets[requireDisplayMode(displayMode)].containers[
    requireContainerKey(containerKey)
  ];
};

export const selectLayers = (
  root: StateRoot,
  displayMode: DisplayMode,
  workspace?: WorkspaceKey,
): readonly LayerEntry[] => {
  const content = workspace === undefined ? selectCurrentContentState(root) : readContentState(root, workspace);
  return content.contentSets[requireDisplayMode(displayMode)].layers;
};
