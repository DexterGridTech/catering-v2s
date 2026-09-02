import type {StateRoot} from '@catering-v2s/kernel-base-state'
import {displayRoleSliceName} from '../features/slices/displayRole'
import {isDisplayRole, type DisplayRole} from '../types/display'

export const selectDisplayRole = (state: StateRoot): DisplayRole => {
  const slice = state[displayRoleSliceName]
  if (slice === undefined || slice === null) {
    throw new Error(`Missing display role slice: ${displayRoleSliceName}`)
  }
  const value = Reflect.get(slice, 'displayRole')
  if (!isDisplayRole(value)) {
    throw new Error(`Invalid display role slice: ${displayRoleSliceName}`)
  }
  return value
}
