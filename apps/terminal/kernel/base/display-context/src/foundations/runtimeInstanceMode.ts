export type DisplayRuntimeInstanceMode = 'MASTER' | 'SLAVE'

export const isRuntimeInstanceMode = (
  value: unknown,
): value is DisplayRuntimeInstanceMode => value === 'MASTER' || value === 'SLAVE'
