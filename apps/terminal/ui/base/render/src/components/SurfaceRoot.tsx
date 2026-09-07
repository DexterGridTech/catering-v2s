import {useMemo} from 'react'
import {StyleSheet, View} from 'react-native'
import {LayerStack} from './LayerStack'
import {ScreenContainer} from './ScreenContainer'
import {SurfaceContext} from '../contexts/SurfaceContext'
import type {SurfaceRootProps} from '../types/props'

export const SurfaceRoot = ({displayMode, containerKey, children, renderContentFrame}: SurfaceRootProps) => {
  const surfaceValue = useMemo(
    () => Object.freeze({displayMode, containerKey}),
    [containerKey, displayMode],
  )
  const content = (
    <View style={styles.content}>
      {children}
      <ScreenContainer />
      <LayerStack />
    </View>
  )
  const framedContent = renderContentFrame?.({content}) ?? content
  return (
    <SurfaceContext.Provider value={surfaceValue}>
      <View testID="ui-base-render:surface-root" style={styles.root}>
        {framedContent}
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
