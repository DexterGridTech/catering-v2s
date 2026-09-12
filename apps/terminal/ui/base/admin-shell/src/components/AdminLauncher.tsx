import {useCallback, useRef} from 'react'
import {Pressable, StyleSheet, type GestureResponderEvent} from 'react-native'
import {openLayerCommand, selectLayers} from '@catering-v2s/kernel-base-ui-state'
import {dispatchWithRequestId, useDispatchCommand, useRenderSnapshot, useSurfaceContext} from '@catering-v2s/ui-base-render'
import {ADMIN_CONSOLE_LAYER_ID, ADMIN_CONSOLE_PART_KEY} from '../foundations/adminIdentity'
import {createInitialAdminGestureState, trackAdminGesture, type AdminGestureState} from '../foundations/adminLauncher'
import {adminTestIds} from '../foundations/adminTestIds'

export const AdminLauncher = () => {
  const surface = useSurfaceContext()
  const snapshot = useRenderSnapshot()
  const dispatchCommand = useDispatchCommand()
  const gestureState = useRef<AdminGestureState>(createInitialAdminGestureState())
  const hasAdminLayer = snapshot.root !== undefined
    && selectLayers(snapshot.root, surface.displayMode).some(layer => layer.layerId === ADMIN_CONSOLE_LAYER_ID)

  const open = useCallback(() => {
    void dispatchWithRequestId({
      dispatchCommand,
      definition: openLayerCommand,
      payload: {
        displayMode: surface.displayMode,
        layerId: ADMIN_CONSOLE_LAYER_ID,
        partKey: ADMIN_CONSOLE_PART_KEY,
      },
    }).catch(() => undefined)
  }, [dispatchCommand, surface.displayMode])

  const handlePress = useCallback((event: GestureResponderEvent) => {
    const point = event.nativeEvent
    const result = trackAdminGesture(gestureState.current, {
      x: point.locationX,
      y: point.locationY,
      atMs: Date.now(),
    })
    gestureState.current = result.state
    if (result.completed) open()
  }, [open])

  if (!surface.isHostPrimaryDisplay || hasAdminLayer) return null
  return (
    <Pressable
      testID={adminTestIds.launcher}
      accessibilityRole="button"
      accessibilityLabel="打开终端管理"
      style={styles.launcher}
      onPress={handlePress}
    />
  )
}

const styles = StyleSheet.create({
  launcher: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 96,
    height: 96,
    opacity: 0,
    zIndex: 1100,
  },
})
