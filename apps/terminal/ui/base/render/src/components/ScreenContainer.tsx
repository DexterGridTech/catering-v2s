import {StyleSheet, View} from 'react-native'
import {selectScreen} from '@catering-v2s/kernel-base-ui-state'
import {useRenderContext} from '../contexts/RenderContext'
import {useSurfaceContext} from '../contexts/SurfaceContext'
import {RenderFallback, resolvePart} from './resolvePart'
import {useRenderSnapshot} from '../hooks/useRenderSnapshot'

const SCREEN_CONTAINER_TEST_ID = 'ui-base-render:screen-container'

export const ScreenContainer = () => {
  const {displayMode, containerKey} = useSurfaceContext()
  const {uiCatalog, rendererCatalog, reportPartDiagnostic, clearPartDiagnostic} = useRenderContext()
  const snapshot = useRenderSnapshot()

  if (snapshot.root === undefined) {
    return (
      <View testID={SCREEN_CONTAINER_TEST_ID} style={styles.container}>
        <RenderFallback reason="runtime-unavailable" />
      </View>
    )
  }

  const placement = selectScreen(snapshot.root, displayMode, containerKey)
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
