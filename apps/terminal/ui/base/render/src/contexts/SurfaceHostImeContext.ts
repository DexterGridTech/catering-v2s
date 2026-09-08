import {createContext, useContext} from 'react'

export type SurfaceHostImeContextValue = Readonly<{
  readonly imeInset: number
}>

export const SurfaceHostImeContext = createContext<SurfaceHostImeContextValue | null>(null)

export const useSurfaceHostImeInset = (): number => useContext(SurfaceHostImeContext)?.imeInset ?? 0
