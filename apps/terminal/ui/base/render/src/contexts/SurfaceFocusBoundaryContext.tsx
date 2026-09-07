import {createContext, useContext} from 'react'

export type SurfaceFocusBoundaryPhase = 'suspend' | 'restore'

export type SurfaceFocusBoundaryListener = (phase: SurfaceFocusBoundaryPhase) => void

const noopFocusBoundaryListener: SurfaceFocusBoundaryListener = () => undefined

export const SurfaceFocusBoundaryContext = createContext<SurfaceFocusBoundaryListener>(
  noopFocusBoundaryListener,
)

export const useSurfaceFocusBoundary = (): SurfaceFocusBoundaryListener =>
  useContext(SurfaceFocusBoundaryContext)
