import {createElement, useMemo} from 'react'
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
  const content = createElement(
    View,
    {style: styles.content},
    children,
    createElement(ScreenContainer),
    createElement(LayerStack),
  )
  const framedContent = renderContentFrame?.({content}) ?? content
  return createElement(
    SurfaceContext.Provider,
    {value: surfaceValue},
    createElement(
      View,
      {testID: 'ui-base-render:surface-root', style: styles.root},
      framedContent,
    ),
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
