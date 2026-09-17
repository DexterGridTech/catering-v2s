import type {StateRoot} from '@catering-v2s/kernel-base-state'
import {displayRoleSliceName} from '../features/slices/displayRole'
import type {PendingPowerConfirmation} from '../types/display'

export const selectPowerConfirmation = (state: StateRoot): PendingPowerConfirmation | null => {
  const slice = state[displayRoleSliceName]
  if (slice === undefined || slice === null) {
    throw new Error(`Missing display role slice: ${displayRoleSliceName}`)
  }
  const value = Reflect.get(slice, 'powerConfirmation')
  return value === undefined || value === null ? null : value as PendingPowerConfirmation
}
