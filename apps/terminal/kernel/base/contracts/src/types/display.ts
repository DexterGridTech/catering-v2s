export type SurfaceForm = 'laptop' | 'mobile'

export const isSurfaceForm = (value: unknown): value is SurfaceForm =>
  value === 'laptop' || value === 'mobile'
