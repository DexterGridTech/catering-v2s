import {createElement} from 'react'
import {View} from 'react-native'
import {selectScreen} from '@catering-v2s/kernel-base-ui-state'
import {useRenderContext} from '../contexts/RenderContext'
import {useSurfaceContext} from '../contexts/SurfaceContext'
import {RenderFallback, resolvePart} from '../foundations/resolvePart'
import {useRenderSnapshot} from '../hooks/useRenderSnapshot'

const SCREEN_CONTAINER_TEST_ID = 'ui-base-render:screen-container'

export const ScreenContainer = () => {
  const {displayMode, containerKey} = useSurfaceContext()
  const {uiCatalog, rendererCatalog, reportPartDiagnostic, clearPartDiagnostic} = useRenderContext()
  const snapshot = useRenderSnapshot()

  if (snapshot.root === undefined) {
    return createElement(
      View,
      {testID: SCREEN_CONTAINER_TEST_ID},
      createElement(RenderFallback, {reason: 'runtime-unavailable'}),
    )
  }

  const placement = selectScreen(snapshot.root, displayMode, containerKey)
  if (placement === undefined) {
    return createElement(
      View,
      {testID: SCREEN_CONTAINER_TEST_ID},
      createElement(RenderFallback, {reason: 'container-empty'}),
    )
  }

  return createElement(
    View,
    {testID: SCREEN_CONTAINER_TEST_ID},
    resolvePart({
      placement,
      displayMode,
      uiCatalog,
      rendererCatalog,
      reportPartDiagnostic,
      clearPartDiagnostic,
    }),
  )
}
