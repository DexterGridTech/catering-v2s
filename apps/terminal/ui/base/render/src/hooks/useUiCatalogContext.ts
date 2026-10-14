import {useMemo} from 'react';
import type {DisplayMode, UiCatalogContext} from '@catering-v2s/kernel-base-ui-state';
import type {WorkspaceKey} from '@catering-v2s/kernel-base-state';
import {useRenderContext} from './useRenderContext';
import {createCatalogContext} from '../foundations/createCatalogContext';
import {useUiStateSelector} from './useUiStateSelector';
import type {RenderProviderProps} from '../types/props';

type RuntimeStateRoot = ReturnType<RenderProviderProps['stateSource']['getState']>;

export const areUiCatalogContextsEqual = (
  previous: UiCatalogContext | undefined,
  next: UiCatalogContext | undefined,
): boolean => {
  if (Object.is(previous, next)) return true;
  if (previous === undefined || next === undefined) return false;
  return (
    previous.displayMode === next.displayMode &&
    previous.workspace === next.workspace &&
    previous.instanceMode === next.instanceMode &&
    previous.surfaceForm === next.surfaceForm
  );
};

export const useUiCatalogContext = (
  displayMode: DisplayMode,
  workspaceOverride?: WorkspaceKey,
): UiCatalogContext | undefined => {
  const {selectSurfaceForm} = useRenderContext();
  const selector = useMemo(
    () => (root: RuntimeStateRoot) =>
      createCatalogContext(root, {displayMode, surfaceForm: selectSurfaceForm(root), workspaceOverride}),
    [displayMode, selectSurfaceForm, workspaceOverride],
  );
  return useUiStateSelector(selector, areUiCatalogContextsEqual);
};
