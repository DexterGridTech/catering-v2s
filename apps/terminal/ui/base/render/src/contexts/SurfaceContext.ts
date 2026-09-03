import {createContext, useContext} from 'react'
import type {ContainerKey, DisplayMode} from '@catering-v2s/kernel-base-ui-state'

export type SurfaceContextValue = Readonly<{
  readonly displayMode: DisplayMode
  readonly containerKey: ContainerKey
}>

export const SurfaceContext = createContext<SurfaceContextValue | undefined>(undefined)

export const useSurfaceContext = (): SurfaceContextValue => {
  const value = useContext(SurfaceContext)
  if (value === undefined) throw new Error('[ui-base-render] SurfaceRoot is required')
  return value
}
