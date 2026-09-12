import {createContext, useContext} from 'react'
import type {ContainerKey, DisplayMode, SurfaceForm} from '@catering-v2s/kernel-base-ui-state'
import type {SurfaceIdentity} from '../foundations/surfaceHost'
import type {SurfaceHostSize} from '../foundations/surfaceHost'

export type SurfaceContextValue = Readonly<{
  readonly displayMode: DisplayMode
  readonly containerKey: ContainerKey
  readonly surfaceForm: SurfaceForm
  readonly isHostPrimaryDisplay: boolean
  readonly surfaceIdentity: SurfaceIdentity | null
  readonly hostLogicalSize: SurfaceHostSize | null
}>

export const SurfaceContext = createContext<SurfaceContextValue | undefined>(undefined)

export const useSurfaceContext = (): SurfaceContextValue => {
  const value = useContext(SurfaceContext)
  if (value === undefined) throw new Error('[ui-base-render] SurfaceRoot is required')
  return value
}
