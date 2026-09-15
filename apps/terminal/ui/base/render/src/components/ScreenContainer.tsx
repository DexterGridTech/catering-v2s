import {useEffect} from 'react'
import {StyleSheet, View} from 'react-native'
import {selectScreen} from '@catering-v2s/kernel-base-ui-state'
import {useRenderContext} from '../contexts/RenderContext'
import {useSurfaceContext} from '../contexts/SurfaceContext'
import {RenderFallback, resolvePartWithStatus} from './resolvePart'
import {useRenderSnapshot} from '../hooks/useRenderSnapshot'
import {createCatalogContext} from '../foundations/createCatalogContext'
import {ScreenReadyBoundary, StartupFailurePage} from './ScreenReadyBoundary'

const SCREEN_CONTAINER_TEST_ID = 'ui-base-render:screen-container'

export const ScreenContainer = () => {
  const {
    displayMode,
    containerKey,
    isHostPrimaryDisplay,
    surfaceHostAvailability,
    surfaceIdentity,
  } = useSurfaceContext()
  const {
    logger,
    nativeLoadingCapability,
    hasPrimarySurfaceReady,
    uiCatalog,
    rendererCatalog,
    reportPartDiagnostic,
    clearPartDiagnostic,
    selectSurfaceForm,
  } = useRenderContext()
  const snapshot = useRenderSnapshot()
  const catalogContext = snapshot.root === undefined
    ? undefined
    : createCatalogContext(snapshot.root, displayMode, selectSurfaceForm(snapshot.root))

  const placement = snapshot.root === undefined
    ? undefined
    : selectScreen(snapshot.root, displayMode, containerKey)
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
        runtimeStatus: snapshot.status,
        screenPartKey: placement?.partKey ?? null,
        screenInstanceId: placement?.instanceId ?? null,
        fallback: placement === undefined ? 'container-empty' : null,
      },
    })
  }, [containerKey, displayMode, logger, placement, snapshot.status])
  const isTargetPrimarySurface = surfaceIdentity?.surfaceKey === nativeLoadingCapability.targetPhysicalSurface.surfaceKey
    && surfaceIdentity.displayIndex === nativeLoadingCapability.targetPhysicalSurface.displayIndex
    && (isHostPrimaryDisplay || surfaceHostAvailability === 'unavailable')
  const failureStage = hasPrimarySurfaceReady ? 'runtime' as const : 'startup' as const

  if (surfaceHostAvailability === 'unavailable') {
    return (
      <View testID={SCREEN_CONTAINER_TEST_ID} style={styles.container}>
        {isTargetPrimarySurface ? (
          <StartupFailurePage reason="surface-host-unavailable" failureStage={failureStage} />
        ) : <RenderFallback reason="runtime-unavailable" />}
      </View>
    )
  }
  if (snapshot.root === undefined) {
    if (snapshot.status === 'failed') {
      return (
        <View testID={SCREEN_CONTAINER_TEST_ID} style={styles.container}>
          <RenderFallback reason="runtime-unavailable" />
          {isTargetPrimarySurface ? (
            <StartupFailurePage reason="runtime-failed" failureStage={failureStage} fallbackReason="runtime-unavailable" />
          ) : null}
        </View>
      )
    }
    return (
      <View testID={SCREEN_CONTAINER_TEST_ID} style={styles.container}>
        <RenderFallback reason="runtime-unavailable" />
      </View>
    )
  }
  if (placement === undefined) {
    // A started runtime with a resolved physical host must have a real main
    // screen.  Keeping the empty-container fallback on the PRIMARY surface
    // would leave the native splash visible forever without a terminal fact.
    // Do not apply this to the initial/unhosted test and web surfaces, or to a
    // SECONDARY surface: only the physical PRIMARY owns startup failure.
    const isResolvedPrimarySurface = snapshot.status === 'started'
      && surfaceHostAvailability === 'ready'
      && isHostPrimaryDisplay
      && surfaceIdentity?.surfaceKey === 'PRIMARY'
      && surfaceIdentity.displayIndex === 0
    return (
      <View testID={SCREEN_CONTAINER_TEST_ID} style={styles.container}>
        <RenderFallback reason="container-empty" />
        {isResolvedPrimarySurface && isTargetPrimarySurface ? (
          <StartupFailurePage
            reason="screen-fallback:container-empty"
            failureStage={failureStage}
            fallbackReason="container-empty"
          />
        ) : null}
      </View>
    )
  }

  const resolution = resolvePartWithStatus({
    placement,
    displayMode,
    containerKey,
    catalogContext: catalogContext!,
    uiCatalog,
    rendererCatalog,
    reportPartDiagnostic,
    clearPartDiagnostic,
    elementKey: placement.instanceId ?? placement.partKey,
  })
  const terminalFallback = resolution.kind === 'fallback'
    && resolution.reason !== 'runtime-unavailable'
    && resolution.reason !== 'container-empty'

  return (
    <View testID={SCREEN_CONTAINER_TEST_ID} style={styles.container}>
      {resolution.kind === 'resolved' ? (
        <ScreenReadyBoundary
          key={placement.instanceId ?? placement.partKey}
          partKey={placement.partKey}
        >
          {resolution.node}
        </ScreenReadyBoundary>
      ) : terminalFallback && isTargetPrimarySurface ? (
        <>
          {resolution.node}
          <StartupFailurePage
            reason={`screen-fallback:${resolution.reason}`}
            failureStage={failureStage}
            fallbackReason={resolution.reason}
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
