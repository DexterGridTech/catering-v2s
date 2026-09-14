import {useCallback, useRef, type ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'
import {openLayerCommand, selectLayers} from '@catering-v2s/kernel-base-ui-state'
import {dispatchWithRequestId, useDispatchCommand, useRenderSnapshot, useSurfaceContext} from '@catering-v2s/ui-base-render'
import type {SurfaceHostSize} from '@catering-v2s/ui-base-render'
import {ADMIN_CONSOLE_LAYER_ID, ADMIN_CONSOLE_PART_KEY} from '../foundations/adminIdentity'
import {
  createInitialAdminGestureState,
  adminLauncherPointFromEvent,
  logicalPointFromWindow,
  trackAdminGesture,
  type AdminGestureCoordinateSpace,
  type AdminGestureState,
} from '../foundations/adminLauncher'
import {adminTestIds} from '../foundations/adminTestIds'

const coordinateSpaceOf = (
  origin: Readonly<{readonly x: number; readonly y: number}> | null,
  canvas: SurfaceHostSize,
  host: SurfaceHostSize | null,
): AdminGestureCoordinateSpace | null => {
  if (origin === null || host === null) return null
  if (
    !Number.isFinite(canvas.width)
    || !Number.isFinite(canvas.height)
    || canvas.width <= 0
    || canvas.height <= 0
    || !Number.isFinite(host.width)
    || !Number.isFinite(host.height)
    || host.width <= 0
    || host.height <= 0
  ) return null
  return Object.freeze({
    originX: origin.x,
    originY: origin.y,
    scaleX: host.width / canvas.width,
    scaleY: host.height / canvas.height,
  })
}

type AdminLauncherProps = Readonly<{
  readonly canvas: SurfaceHostSize
  readonly children?: ReactNode
}>

/**
 * Observes the launcher completion event on the business-content ancestor.
 * This node is deliberately a plain View: it has no responder negotiation or
 * press handling of its own, so descendants keep their normal touch behavior.
 */
export const AdminLauncher = ({canvas, children}: AdminLauncherProps) => {
  const surface = useSurfaceContext()
  const snapshot = useRenderSnapshot()
  const dispatchCommand = useDispatchCommand()
  const gestureState = useRef<AdminGestureState>(createInitialAdminGestureState())
  const originRef = useRef<Readonly<{readonly x: number; readonly y: number}> | null>(null)
  const nodeRef = useRef<View>(null)
  const hasAdminLayer = snapshot.root !== undefined
    && selectLayers(snapshot.root, surface.displayMode).some(layer => layer.layerId === ADMIN_CONSOLE_LAYER_ID)

  const measureOrigin = useCallback(() => {
    nodeRef.current?.measureInWindow((x, y) => {
      if (Number.isFinite(x) && Number.isFinite(y)) {
        originRef.current = Object.freeze({x, y})
      }
    })
  }, [])

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

  const handleLauncherEvent = useCallback((event: unknown) => {
    const eventPoint = adminLauncherPointFromEvent(event)
    const space = coordinateSpaceOf(originRef.current, canvas, surface.hostLogicalSize)
    const point = space === null
      ? null
      : eventPoint === null
        ? null
        : logicalPointFromWindow({
            pageX: eventPoint.pageX,
            pageY: eventPoint.pageY,
            space,
          })
    if (point === null) {
      gestureState.current = createInitialAdminGestureState()
      return
    }
    const result = trackAdminGesture(gestureState.current, {
      x: point.x,
      y: point.y,
      atMs: Date.now(),
    })
    gestureState.current = result.state
    if (result.completed) open()
  }, [canvas, open, surface.hostLogicalSize])

  if (!surface.isHostPrimaryDisplay) return <>{children}</>
  const launcherEventProps = typeof document === 'undefined'
    ? {onTouchEnd: hasAdminLayer ? undefined : handleLauncherEvent}
    : {onClick: hasAdminLayer ? undefined : handleLauncherEvent}
  return (
    <View
      ref={nodeRef}
      testID={adminTestIds.launcher}
      style={styles.observer}
      onLayout={measureOrigin}
      {...launcherEventProps}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  observer: {
    flex: 1,
    width: '100%',
  },
})
