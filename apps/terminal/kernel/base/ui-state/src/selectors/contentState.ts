import {resolveWorkspace, selectDisplayRole} from '@catering-v2s/kernel-base-display-context';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {readContentState} from '../foundations/workspaceSlices';

export const selectCurrentContentState = (root: StateRoot) =>
  readContentState(
    root,
    resolveWorkspace({
      instanceMode: selectRuntimeInstanceMode(root),
      displayRole: selectDisplayRole(root),
    }),
  );
