import {useEffect, useMemo, useState, type ReactNode} from 'react'
import {PixelRatio, StyleSheet, View} from 'react-native'
import {SurfaceHostImeContext} from '../contexts/SurfaceHostImeContext'
import {useRenderContext} from '../contexts/RenderContext'
import {
  calculateSurfaceHostImeInset,
  calculateSurfaceHostGeometry,
  type SurfaceCanvasDeclaration,
  type SurfaceHostGeometry,
  type SurfaceHostSnapshot,
  type SurfaceHostSource,
} from '../foundations/surfaceHost'

export type SurfaceHostControllerProps = Readonly<{
  readonly canvas: SurfaceCanvasDeclaration
  readonly source?: SurfaceHostSource
  readonly children?: ReactNode
}>

const staticGeometryOf = (canvas: SurfaceCanvasDeclaration): SurfaceHostGeometry => Object.freeze({
  canvas,
  host: canvas,
  scaleX: 1,
  scaleY: 1,
})

export const SurfaceHostController = ({canvas, source, children}: SurfaceHostControllerProps) => {
  const {logger} = useRenderContext()
  const [snapshot, setSnapshot] = useState<SurfaceHostSnapshot | null>(
    () => source?.getSnapshot() ?? null,
  )

  useEffect(() => {
    if (source === undefined) {
      setSnapshot(null)
      return undefined
    }
    setSnapshot(source.getSnapshot())
    return source.subscribe(setSnapshot)
  }, [source])

  const geometry = useMemo(
    () => source === undefined
      ? staticGeometryOf(canvas)
      : calculateSurfaceHostGeometry({canvas, snapshot}),
    [canvas, snapshot, source],
  )
  const imeInset = useMemo(
    () => geometry === null
      ? null
      : calculateSurfaceHostImeInset({ime: snapshot?.ime, scaleY: geometry.scaleY}),
    [geometry, snapshot?.ime],
  )

  useEffect(() => {
    if (!__DEV__) return
    logger.info({
      category: 'display-diagnostics',
      event: 'render.surface-host-layout',
      message: 'Surface host canvas geometry observed',
      data: {
        source: 'ui-base-render.SurfaceHostController',
        hostSourceAttached: source !== undefined,
        ready: geometry !== null,
        canvasWidth: geometry?.canvas.width ?? canvas.width,
        canvasHeight: geometry?.canvas.height ?? canvas.height,
        hostWidth: geometry?.host.width ?? null,
        hostHeight: geometry?.host.height ?? null,
        scaleX: geometry?.scaleX ?? null,
        scaleY: geometry?.scaleY ?? null,
        imeVisible: snapshot?.ime?.visible ?? false,
        imeBottomLogicalBeforeCanvasScale: snapshot?.ime?.bottomLogicalBeforeCanvasScale ?? 0,
        imeInset,
        // PixelRatio is diagnostics-only. Geometry must stay owned by the
        // per-surface host snapshot and the package canvas declaration.
        pixelRatio: PixelRatio.get(),
        fontScale: PixelRatio.getFontScale(),
        units: 'logical-layout-unit',
      },
    })
  }, [canvas.height, canvas.width, geometry, imeInset, logger, snapshot?.ime, source])

  if (geometry === null || imeInset === null) {
    return <View testID="ui-base-render:surface-host-pending" style={styles.viewport} />
  }

  return (
    <SurfaceHostImeContext.Provider value={{imeInset}}>
      <View testID="ui-base-render:surface-host-viewport" style={styles.viewport}>
        <View
          testID="ui-base-render:surface-host-canvas"
          style={[
            styles.canvas,
            {
              width: geometry.canvas.width,
              height: geometry.canvas.height,
              transform: [{scaleX: geometry.scaleX}, {scaleY: geometry.scaleY}],
            },
          ]}
        >
          {children}
        </View>
      </View>
    </SurfaceHostImeContext.Provider>
  )
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  canvas: {
    position: 'relative',
    transformOrigin: 'top left',
  },
})
