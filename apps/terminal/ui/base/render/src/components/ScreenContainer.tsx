import {useEffect, useMemo} from 'react'
import {StyleSheet, View} from 'react-native'
import {selectScreen, type ScreenPlacement} from '@catering-v2s/kernel-base-ui-state'
import {useRenderContext} from '../contexts/RenderContext'
import {useSurfaceContext} from '../contexts/SurfaceContext'
import {RenderFallback, resolvePartWithStatus} from './resolvePart'
import {useRenderStatus} from '../hooks/useRenderStatus'
import {useUiCatalogContext} from '../hooks/useUiCatalogContext'
import {useUiStateSelector} from '../hooks/useUiStateSelector'
import {ScreenReadyBoundary, StartupFailurePage} from './ScreenReadyBoundary'
import type {RenderFailure} from '../types/props'

const SCREEN_CONTAINER_TEST_ID = 'ui-base-render:screen-container'

export const ScreenContainer = () => {
  const {
    displayMode,
    containerKey,
    isHostPrimaryDisplay,
    surfaceHostAvailability,
    surfaceIdentity,
    defaultContainerPartKeys,
  } = useSurfaceContext()
  const {
    logger,
    nativeLoadingCapability,
    hasPrimarySurfaceReady,
    uiCatalog,
    rendererCatalog,
    reportPartDiagnostic,
    clearPartDiagnostic,
  } = useRenderContext()
  const runtimeStatus = useRenderStatus()
  const catalogContext = useUiCatalogContext(displayMode)
  const defaultPartKey = defaultContainerPartKeys?.[containerKey]
  const defaultPlacement = useMemo<ScreenPlacement | undefined>(
    () => defaultPartKey === undefined ? undefined : {partKey: defaultPartKey},
    [defaultPartKey],
  )
  const placementSelector = useMemo(() => (root: Parameters<typeof selectScreen>[0]) => {
    const persistedPlacement = selectScreen(root, displayMode, containerKey)
    return persistedPlacement ?? defaultPlacement
  }, [containerKey, defaultPlacement, displayMode])
  const placement = useUiStateSelector(placementSelector)
  useEffect(() => {
    if (!__DEV__) return
    logger.info({
      category: 'display-diagnostics',
      event: 'render.screen-selection',
      message: 'Screen selection observed',
      data: {
        source: 'ui-base-render.ScreenContainer',
        displayMode,
        containerKey,
        runtimeStatus,
        screenPartKey: placement?.partKey ?? null,
        screenInstanceId: placement?.instanceId ?? null,
        fallback: placement === undefined ? 'container-empty' : null,
      },
    })
  }, [containerKey, displayMode, logger, placement, runtimeStatus])
  const isTargetPrimarySurface = surfaceIdentity?.surfaceKey === nativeLoadingCapability.targetPhysicalSurface.surfaceKey
    && surfaceIdentity.displayIndex === nativeLoadingCapability.targetPhysicalSurface.displayIndex
    && (isHostPrimaryDisplay || surfaceHostAvailability === 'unavailable')
  const failureStage = hasPrimarySurfaceReady ? 'runtime' as const : 'startup' as const

  if (surfaceHostAvailability === 'unavailable') {
    const failure: RenderFailure = {category: 'system', reason: 'surface-host-unavailable'}
    return (
      <View testID={SCREEN_CONTAINER_TEST_ID} style={styles.container}>
        {isTargetPrimarySurface ? (
          <StartupFailurePage
            reason={failure.reason}
            failureStage={failureStage}
            fallbackReason={failure.reason}
          />
        ) : <RenderFallback failure={failure} />}
      </View>
    )
  }
  if (runtimeStatus !== 'started') {
    if (runtimeStatus === 'failed') {
      const failure: RenderFailure = {category: 'system', reason: 'runtime-start-failed'}
      return (
        <View testID={SCREEN_CONTAINER_TEST_ID} style={styles.container}>
          <RenderFallback failure={failure} />
          {isTargetPrimarySurface ? (
            <StartupFailurePage
              reason={failure.reason}
              failureStage={failureStage}
              fallbackReason={failure.reason}
            />
          ) : null}
        </View>
      )
    }
    const failure: RenderFailure = {category: 'transition', reason: 'runtime-not-started'}
    return (
      <View testID={SCREEN_CONTAINER_TEST_ID} style={styles.container}>
        <RenderFallback failure={failure} />
      </View>
    )
  }
  if (catalogContext === undefined) {
    throw new Error('[ui-base-render] catalog context is required when runtime root is available')
  }
  if (placement === undefined) {
    const failure: RenderFailure = {
      category: 'content',
      reason: 'container-empty',
      partKey: null,
      containerKey,
      surfaceForm: catalogContext.surfaceForm,
    }
    reportPartDiagnostic({
      event: 'container-empty',
      data: {
        category: 'content',
        reason: 'container-empty',
        partKey: null,
        displayMode,
        containerKey,
        surfaceForm: catalogContext.surfaceForm,
      },
    })
    return (
      <View testID={SCREEN_CONTAINER_TEST_ID} style={styles.container}>
        <ScreenReadyBoundary
          key={`${containerKey}:container-empty`}
          partKey={null}
          contentFailure={failure.reason}
        >
          <RenderFallback failure={failure} />
        </ScreenReadyBoundary>
      </View>
    )
  }

  const resolution = resolvePartWithStatus({
    placement,
    displayMode,
    containerKey,
    catalogContext,
    uiCatalog,
    rendererCatalog,
    reportPartDiagnostic,
    clearPartDiagnostic,
    elementKey: placement.instanceId ?? placement.partKey,
  })

  return (
    <View testID={SCREEN_CONTAINER_TEST_ID} style={styles.container}>
      {resolution.kind === 'resolved' ? (
        <ScreenReadyBoundary
          key={placement.instanceId ?? placement.partKey}
          partKey={placement.partKey}
          contentFailure={null}
        >
          {resolution.node}
        </ScreenReadyBoundary>
      ) : resolution.failure.category === 'content' ? (
        <ScreenReadyBoundary
          key={placement.instanceId ?? placement.partKey}
          partKey={resolution.failure.partKey}
          contentFailure={resolution.failure.reason}
        >
          {resolution.node}
        </ScreenReadyBoundary>
      ) : resolution.failure.category === 'system' && isTargetPrimarySurface ? (
        <>
          {resolution.node}
          <StartupFailurePage
            reason={`screen-fallback:${resolution.failure.reason}`}
            failureStage={failureStage}
            fallbackReason={resolution.failure.reason}
          />
        </>
      ) : resolution.node}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
