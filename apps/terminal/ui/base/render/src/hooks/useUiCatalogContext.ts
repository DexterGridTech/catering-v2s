import {useMemo} from 'react'
import type {DisplayMode, UiCatalogContext} from '@catering-v2s/kernel-base-ui-state'
import {useRenderContext} from '../contexts/RenderContext'
import {createCatalogContext} from '../foundations/createCatalogContext'
import {useUiStateSelector} from './useUiStateSelector'
import type {RenderProviderProps} from '../types/props'

type RuntimeStateRoot = ReturnType<RenderProviderProps['stateSource']['getState']>

export const areUiCatalogContextsEqual = (
  previous: UiCatalogContext | undefined,
  next: UiCatalogContext | undefined,
): boolean => {
  if (Object.is(previous, next)) return true
  if (previous === undefined || next === undefined) return false
  return previous.displayMode === next.displayMode
    && previous.workspace === next.workspace
    && previous.instanceMode === next.instanceMode
    && previous.surfaceForm === next.surfaceForm
}

export const useUiCatalogContext = (displayMode: DisplayMode): UiCatalogContext | undefined => {
  const {selectSurfaceForm} = useRenderContext()
  const selector = useMemo(
    () => (root: RuntimeStateRoot) => createCatalogContext(root, displayMode, selectSurfaceForm(root)),
    [displayMode, selectSurfaceForm],
  )
  return useUiStateSelector(selector, areUiCatalogContextsEqual)
}
