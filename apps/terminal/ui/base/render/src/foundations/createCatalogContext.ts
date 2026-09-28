import {resolveWorkspace, selectDisplayRole} from '@catering-v2s/kernel-base-display-context';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {DisplayMode, SurfaceForm, UiCatalogContext} from '@catering-v2s/kernel-base-ui-state';

type CatalogStateRoot = Parameters<typeof selectRuntimeInstanceMode>[0];

export const createCatalogContext = (
  root: CatalogStateRoot,
  displayMode: DisplayMode,
  surfaceForm: SurfaceForm,
): UiCatalogContext => {
  const instanceMode = selectRuntimeInstanceMode(root);
  const displayRole = selectDisplayRole(root);
  return Object.freeze({
    displayMode,
    workspace: resolveWorkspace({instanceMode, displayRole}),
    instanceMode,
    surfaceForm,
  });
};
