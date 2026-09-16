import {useCallback, useMemo, useRef, type ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'
import {openLayerCommand, selectLayers} from '@catering-v2s/kernel-base-ui-state'
import {dispatchWithRequestId, useDispatchCommand, useSurfaceContext, useUiStateSelector} from '@catering-v2s/ui-base-render'
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
  windowMeasurement: Readonly<{
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  }> | null,
  canvas: SurfaceHostSize,
  host: SurfaceHostSize | null,
): AdminGestureCoordinateSpace | null => {
  if (windowMeasurement === null || host === null) return null
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
  const measuredScaleX = windowMeasurement.width / canvas.width
  const measuredScaleY = windowMeasurement.height / canvas.height
  const scaleX = Number.isFinite(measuredScaleX) && measuredScaleX > 0
    ? measuredScaleX
    : host.width / canvas.width
  const scaleY = Number.isFinite(measuredScaleY) && measuredScaleY > 0
    ? measuredScaleY
    : host.height / canvas.height
  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) return null
  return Object.freeze({
    originX: windowMeasurement.x,
    originY: windowMeasurement.y,
    scaleX,
    scaleY,
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
  const hostLogicalSize = surface.hostLogicalSize
  const hasAdminLayerSelector = useMemo(
    () => (root: Parameters<typeof selectLayers>[0]) => selectLayers(root, surface.displayMode)
      .some(layer => layer.layerId === ADMIN_CONSOLE_LAYER_ID),
    [surface.displayMode],
  )
  const hasAdminLayer = useUiStateSelector(hasAdminLayerSelector) ?? false
  const dispatchCommand = useDispatchCommand()
  const gestureState = useRef<AdminGestureState>(createInitialAdminGestureState())
  const windowMeasurementRef = useRef<Readonly<{
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  }> | null>(null)
  const nodeRef = useRef<View>(null)
  const measureOrigin = useCallback(() => {
    nodeRef.current?.measureInWindow((...measurements: [number, number, number, number]) => {
      const [x, y, width, height] = measurements
      if (
        Number.isFinite(x)
        && Number.isFinite(y)
        && Number.isFinite(width)
        && Number.isFinite(height)
      ) {
        windowMeasurementRef.current = Object.freeze({x, y, width, height})
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
    const eventRecord = typeof event === 'object' && event !== null
      ? event as Readonly<{readonly stopPropagation?: unknown}>
      : null
    const space = coordinateSpaceOf(windowMeasurementRef.current, canvas, hostLogicalSize)
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
    if (result.completed) {
      const stopPropagation = eventRecord?.stopPropagation
      if (typeof stopPropagation === 'function') {
        stopPropagation.call(event)
      }
      open()
    }
  }, [canvas, hostLogicalSize, open])

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
