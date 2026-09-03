import {createElement} from 'react'
import {selectLayers} from '@catering-v2s/kernel-base-ui-state'
import {useRenderContext} from '../contexts/RenderContext'
import {useSurfaceContext} from '../contexts/SurfaceContext'
import {RenderFallback, resolvePart} from '../foundations/resolvePart'
import {useRenderSnapshot} from '../hooks/useRenderSnapshot'

const LAYER_STACK_TEST_ID = 'ui-base-render:layer-stack'

type Layer = Readonly<{
  readonly layerId: string
  readonly partKey: string
  readonly props?: unknown
  readonly openedAt: number
}>

const tierRank = (
  layer: Layer,
  uiCatalog: Parameters<typeof resolvePart>[0]['uiCatalog'],
  rendererCatalog: Parameters<typeof resolvePart>[0]['rendererCatalog'],
): number => {
  const entry = uiCatalog.byPartKey[layer.partKey]
  if (entry === undefined) return 0
  return rendererCatalog.tierOf(entry.rendererKey) === 'alert' ? 1 : 0
}

const compareStrings = (left: string, right: string): number =>
  left === right ? 0 : left < right ? -1 : 1

const compareLayers = (
  left: Layer,
  right: Layer,
  uiCatalog: Parameters<typeof resolvePart>[0]['uiCatalog'],
  rendererCatalog: Parameters<typeof resolvePart>[0]['rendererCatalog'],
): number => {
  const tierDelta = tierRank(left, uiCatalog, rendererCatalog) - tierRank(right, uiCatalog, rendererCatalog)
  if (tierDelta !== 0) return tierDelta
  if (left.openedAt !== right.openedAt) return left.openedAt - right.openedAt
  return compareStrings(left.layerId, right.layerId)
}

export const LayerStack = () => {
  const {displayMode} = useSurfaceContext()
  const {uiCatalog, rendererCatalog, reportPartDiagnostic, clearPartDiagnostic} = useRenderContext()
  const snapshot = useRenderSnapshot()

  if (snapshot.root === undefined) {
    return createElement(
      'render-layer-stack',
      {testID: LAYER_STACK_TEST_ID},
      createElement(RenderFallback, {reason: 'runtime-unavailable'}),
    )
  }

  const layers = selectLayers(snapshot.root, displayMode) as readonly Layer[]
  const orderedLayers = [...layers].sort((left, right) => compareLayers(left, right, uiCatalog, rendererCatalog))
  return createElement(
    'render-layer-stack',
    {testID: LAYER_STACK_TEST_ID},
    orderedLayers.map(layer => resolvePart({
      placement: layer,
      displayMode,
      uiCatalog,
      rendererCatalog,
      reportPartDiagnostic,
      clearPartDiagnostic,
      elementKey: layer.layerId,
    })),
  )
}
