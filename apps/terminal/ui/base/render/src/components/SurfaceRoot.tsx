import {createElement, useMemo} from 'react'
import {LayerStack} from './LayerStack'
import {ScreenContainer} from './ScreenContainer'
import {SurfaceContext} from '../contexts/SurfaceContext'
import type {SurfaceRootProps} from '../types/props'

export const SurfaceRoot = ({displayMode, containerKey, children}: SurfaceRootProps) => {
  const surfaceValue = useMemo(
    () => Object.freeze({displayMode, containerKey}),
    [containerKey, displayMode],
  )
  return createElement(
    SurfaceContext.Provider,
    {value: surfaceValue},
    children,
    createElement(ScreenContainer),
    createElement(LayerStack),
  )
}
