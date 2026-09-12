import {useEffect} from 'react'
import {StyleSheet, View} from 'react-native'
import {selectScreen} from '@catering-v2s/kernel-base-ui-state'
import {useRenderContext} from '../contexts/RenderContext'
import {useSurfaceContext} from '../contexts/SurfaceContext'
import {RenderFallback, resolvePart} from './resolvePart'
import {useRenderSnapshot} from '../hooks/useRenderSnapshot'
import {createCatalogContext} from '../foundations/createCatalogContext'

const SCREEN_CONTAINER_TEST_ID = 'ui-base-render:screen-container'

export const ScreenContainer = () => {
  const {displayMode, containerKey} = useSurfaceContext()
  const {logger, uiCatalog, rendererCatalog, reportPartDiagnostic, clearPartDiagnostic, selectSurfaceForm} = useRenderContext()
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
  if (snapshot.root === undefined) {
    return (
      <View testID={SCREEN_CONTAINER_TEST_ID} style={styles.container}>
        <RenderFallback reason="runtime-unavailable" />
      </View>
    )
  }
  if (placement === undefined) {
    return (
      <View testID={SCREEN_CONTAINER_TEST_ID} style={styles.container}>
        <RenderFallback reason="container-empty" />
      </View>
    )
  }

  return (
    <View testID={SCREEN_CONTAINER_TEST_ID} style={styles.container}>
      {resolvePart({
        placement,
        displayMode,
        containerKey,
        catalogContext: catalogContext!,
        uiCatalog,
        rendererCatalog,
        reportPartDiagnostic,
        clearPartDiagnostic,
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
