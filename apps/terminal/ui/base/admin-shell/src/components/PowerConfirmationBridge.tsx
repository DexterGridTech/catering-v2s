import {useEffect, useMemo} from 'react'
import {closeLayerCommand, openLayerCommand, selectLayers} from '@catering-v2s/kernel-base-ui-state'
import {selectPowerConfirmation} from '@catering-v2s/kernel-base-display-context'
import {useDispatchCommand, useSurfaceContext, useUiStateSelector} from '@catering-v2s/ui-base-render'
import {dispatchWithRequestId} from '@catering-v2s/ui-base-render'
import {ADMIN_POWER_CONFIRMATION_LAYER_ID, ADMIN_POWER_CONFIRMATION_PART_KEY} from '../foundations/adminIdentity'

export const PowerConfirmationBridge = () => {
  const surface = useSurfaceContext()
  const dispatchCommand = useDispatchCommand()
  const pending = useUiStateSelector(selectPowerConfirmation)
  const layerSelector = useMemo(
    () => (root: Parameters<typeof selectLayers>[0]) => selectLayers(root, surface.displayMode),
    [surface.displayMode],
  )
  const layers = useUiStateSelector(layerSelector) ?? []
  const hasLayer = layers.some(layer => layer.layerId === ADMIN_POWER_CONFIRMATION_LAYER_ID)

  useEffect(() => {
    if (surface.displayMode !== 'PRIMARY' || pending === undefined || (pending !== null && hasLayer) || (pending === null && !hasLayer)) return
    if (pending !== null) {
      void dispatchWithRequestId({
        dispatchCommand,
        definition: openLayerCommand,
        payload: {
          displayMode: 'PRIMARY',
          layerId: ADMIN_POWER_CONFIRMATION_LAYER_ID,
          partKey: ADMIN_POWER_CONFIRMATION_PART_KEY,
          persistence: 'ephemeral',
        },
      }).catch(() => undefined)
      return
    }
    void dispatchWithRequestId({
      dispatchCommand,
      definition: closeLayerCommand,
      payload: {displayMode: 'PRIMARY', layerId: ADMIN_POWER_CONFIRMATION_LAYER_ID},
    }).catch(() => undefined)
  }, [dispatchCommand, hasLayer, pending, surface.displayMode])

  return null
}
