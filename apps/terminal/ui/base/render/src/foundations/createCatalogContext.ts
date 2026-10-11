import {resolveWorkspace, selectDisplayRole} from '@catering-v2s/kernel-base-display-context';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {DisplayMode, SurfaceForm, UiCatalogContext} from '@catering-v2s/kernel-base-ui-state';
import type {WorkspaceKey} from '@catering-v2s/kernel-base-state';

type CatalogStateRoot = Parameters<typeof selectRuntimeInstanceMode>[0];

export const createCatalogContext = (
  root: CatalogStateRoot,
  input: Readonly<{displayMode: DisplayMode; surfaceForm: SurfaceForm; workspaceOverride?: WorkspaceKey}>,
): UiCatalogContext => {
  const {displayMode, surfaceForm, workspaceOverride} = input;
  const instanceMode = selectRuntimeInstanceMode(root);
  const displayRole = selectDisplayRole(root);
  return Object.freeze({
    displayMode,
    workspace: workspaceOverride ?? resolveWorkspace({instanceMode, displayRole}),
    instanceMode,
    surfaceForm,
  });
};
