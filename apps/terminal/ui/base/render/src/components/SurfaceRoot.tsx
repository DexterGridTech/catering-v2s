import {useCallback, useEffect, useMemo, useRef} from 'react'
import {StyleSheet, View, type LayoutChangeEvent} from 'react-native'
import {LayerStack} from './LayerStack'
import {ScreenContainer} from './ScreenContainer'
import {SurfaceContext} from '../contexts/SurfaceContext'
import {useRenderContext} from '../contexts/RenderContext'
import {SurfaceHostController} from './SurfaceHostController'
import type {SurfaceRootProps} from '../types/props'

export const SurfaceRoot = ({
  displayMode,
  containerKey,
  children,
  renderContentFrame,
  canvas,
  surfaceHostSource,
}: SurfaceRootProps) => {
  const {logger} = useRenderContext()
  const surfaceValue = useMemo(
    () => Object.freeze({displayMode, containerKey}),
    [containerKey, displayMode],
  )
  const previousLayout = useRef<string | null>(null)
  const reportLayout = useCallback((event: LayoutChangeEvent) => {
    if (!__DEV__) return
    const {x, y, width, height} = event.nativeEvent.layout
    const signature = JSON.stringify({x, y, width, height})
    if (previousLayout.current === signature) return
    previousLayout.current = signature
    logger.info({
      category: 'display-diagnostics',
      event: 'render.surface-root-layout',
      message: 'SurfaceRoot layout observed',
      data: {
        source: 'ui-base-render.SurfaceRoot.onLayout',
        displayMode,
        containerKey,
        units: 'logical-layout-unit',
        x,
        y,
        width,
        height,
        renderContentFrame: renderContentFrame !== undefined,
      },
    })
  }, [containerKey, displayMode, logger, renderContentFrame])
  useEffect(() => {
    if (!__DEV__) return
    logger.info({
      category: 'display-diagnostics',
      event: 'render.surface-root-mounted',
      message: 'SurfaceRoot mounted',
      data: {
        source: 'ui-base-render.SurfaceRoot',
        displayMode,
        containerKey,
        renderContentFrame: renderContentFrame !== undefined,
      },
    })
  }, [containerKey, displayMode, logger, renderContentFrame])
  const content = (
    <View style={styles.content}>
      {children}
      <ScreenContainer />
      <LayerStack />
    </View>
  )
  const framedContent = renderContentFrame?.({content}) ?? content
  const hostedContent = canvas === undefined ? framedContent : (
    <SurfaceHostController canvas={canvas} source={surfaceHostSource}>
      {framedContent}
    </SurfaceHostController>
  )
  return (
    <SurfaceContext.Provider value={surfaceValue}>
      <View testID="ui-base-render:surface-root" style={styles.root} onLayout={reportLayout}>
        {hostedContent}
      </View>
    </SurfaceContext.Provider>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
  },
  content: {
    flex: 1,
  },
})
