import {useCallback, useEffect, useMemo, useRef, type ReactNode} from 'react'
import {Animated, StyleSheet, View, type LayoutChangeEvent} from 'react-native'
import {LayerStack} from './LayerStack'
import {ScreenContainer} from './ScreenContainer'
import {SurfaceContext} from '../contexts/SurfaceContext'
import {RenderContext, useRenderContext, type RenderContextValue} from '../contexts/RenderContext'
import {SurfaceHostController} from './SurfaceHostController'
import {useSurfaceHostAvailability, useSurfaceHostSnapshot} from './SurfaceHostController'
import {useUiStateSelector} from '../hooks/useUiStateSelector'
import {useSurfacePresentationOffset} from '../contexts/SurfacePresentationOffsetContext'
import type {RenderStateRoot, SurfaceRootProps} from '../types/props'

const SurfaceRootContent = ({children}: Readonly<{readonly children?: ReactNode}>) => {
  const presentationOffsetY = useSurfacePresentationOffset()
  return (
    <View style={styles.content}>
      <Animated.View style={[styles.presentedContent, {transform: [{translateY: presentationOffsetY}]}]}>
        {children}
        <ScreenContainer />
      </Animated.View>
      <LayerStack />
    </View>
  )
}

export const SurfaceRoot = ({
  displayMode,
  containerKey,
  defaultContainerPartKeys,
  children,
  renderContentFrame,
  canvas,
  surfaceHostSource,
}: SurfaceRootProps) => {
  const renderContext = useRenderContext()
  const {logger, selectSurfaceForm, createRouteContext} = renderContext
  const selectedSurfaceForm = useUiStateSelector(selectSurfaceForm)
  const surfaceForm = selectedSurfaceForm ?? 'laptop'
  const selectSurfaceRouteContext = useCallback(
    (root: RenderStateRoot) => createRouteContext?.(root, displayMode) ?? null,
    [createRouteContext, displayMode],
  )
  const selectedRouteContext = useUiStateSelector(selectSurfaceRouteContext)
  const surfaceRouteContext = selectedRouteContext ?? null
  const scopedDispatchCommand = useMemo<RenderContextValue['dispatchCommand']>(() => {
    if (createRouteContext === undefined) return renderContext.dispatchCommand
    return (command, options) => renderContext.dispatchCommand(command, {
      ...options,
      routeContext: surfaceRouteContext,
    })
  }, [createRouteContext, renderContext.dispatchCommand, surfaceRouteContext])
  const scopedRenderContext = useMemo<RenderContextValue>(() => createRouteContext === undefined
    ? renderContext
    : Object.freeze({...renderContext, dispatchCommand: scopedDispatchCommand}),
  [createRouteContext, renderContext, scopedDispatchCommand])
  const surfaceHostSnapshot = useSurfaceHostSnapshot(surfaceHostSource)
  const explicitSurfaceHostAvailability = useSurfaceHostAvailability(surfaceHostSource)
  const surfaceHostAvailability = surfaceHostSource === undefined
    ? 'not-attached' as const
    : explicitSurfaceHostAvailability ?? (surfaceHostSnapshot === null ? 'pending' : 'ready')
  const surfaceIdentity = surfaceHostSnapshot?.surfaceIdentity ?? surfaceHostSource?.getSurfaceIdentity?.() ?? null
  const surfaceValue = useMemo(
    () => Object.freeze({
      displayMode,
      containerKey,
      defaultContainerPartKeys,
      surfaceForm,
      isHostPrimaryDisplay: surfaceHostSnapshot?.isHostPrimaryDisplay
        ?? (surfaceHostAvailability === 'unavailable' && surfaceIdentity?.displayIndex === 0),
      surfaceIdentity,
      hostLogicalSize: surfaceHostSnapshot?.stableHostLogicalSize ?? null,
      surfaceHostAvailability,
    }),
    [containerKey, defaultContainerPartKeys, displayMode, surfaceForm, surfaceHostAvailability, surfaceHostSnapshot?.isHostPrimaryDisplay, surfaceHostSnapshot?.stableHostLogicalSize, surfaceIdentity],
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
  const content = <SurfaceRootContent>{children}</SurfaceRootContent>
  const framedContent = renderContentFrame?.({content}) ?? content
  const hostedContent = canvas === undefined ? framedContent : (
    <SurfaceHostController canvas={canvas} source={surfaceHostSource} snapshot={surfaceHostSnapshot}>
      {framedContent}
    </SurfaceHostController>
  )
  return (
    <SurfaceContext.Provider value={surfaceValue}>
      <View testID="ui-base-render:surface-root" style={styles.root} onLayout={reportLayout}>
        <RenderContext.Provider value={scopedRenderContext}>
          {hostedContent}
        </RenderContext.Provider>
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
  presentedContent: {
    flex: 1,
  },
})
