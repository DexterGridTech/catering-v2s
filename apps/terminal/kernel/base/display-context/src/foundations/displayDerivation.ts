import type {DisplayMode, DisplayRole, DisplayRoleChangeEligibilityInput, DisplayContextEligibility, PowerRoleTargetInput, SurfaceDisplayModeInput, SwitchInstanceModeEligibilityInput, WorkspaceInput} from '../types/display'
import type {WorkspaceKey} from '@catering-v2s/kernel-base-state'

export const resolveSurfaceDisplayMode = (input: SurfaceDisplayModeInput): DisplayMode =>
  input.displayIndex === 1
    || (input.displayRole === 'VICE' && input.instanceMode === 'SLAVE')
    ? 'SECONDARY'
    : 'PRIMARY'

export const resolveWorkspace = (input: WorkspaceInput): WorkspaceKey =>
  input.instanceMode === 'SLAVE' && input.displayRole === 'CHIEF'
    ? 'BRANCH'
    : 'MAIN'

export const getDisplayRoleChangeEligibility = (
  input: DisplayRoleChangeEligibilityInput,
): DisplayContextEligibility => {
  if (input.targetRole === input.currentRole) return {allowed: true, reasonCode: 'allowed'}
  if (input.targetRole === 'CHIEF') {
    return input.instanceMode === 'SLAVE'
      ? {allowed: true, reasonCode: 'allowed'}
      : {allowed: false, reasonCode: 'master-instance'}
  }
  if (input.instanceMode === 'MASTER') return {allowed: false, reasonCode: 'master-instance'}
  if (input.routeDisplayMode === undefined || input.routeDisplayMode === null) {
    return {allowed: false, reasonCode: 'missing-display-route'}
  }
  if (input.routeDisplayMode === 'SECONDARY') {
    return {allowed: false, reasonCode: 'managed-secondary'}
  }
  if (input.displayCount !== 1) {
    return {allowed: false, reasonCode: 'multiple-physical-displays'}
  }
  return {allowed: true, reasonCode: 'allowed'}
}

export const getSwitchInstanceModeEligibility = (
  input: SwitchInstanceModeEligibilityInput,
): DisplayContextEligibility => {
  if (input.targetMode === 'MASTER') {
    return input.routeDisplayMode === 'SECONDARY'
      ? {allowed: false, reasonCode: 'managed-secondary'}
      : {allowed: true, reasonCode: 'allowed'}
  }
  if (input.routeDisplayMode === undefined || input.routeDisplayMode === null) {
    return {allowed: false, reasonCode: 'missing-display-route'}
  }
  if (input.routeDisplayMode === 'SECONDARY') {
    return {allowed: false, reasonCode: 'managed-secondary'}
  }
  return input.displayCount === 1
    ? {allowed: true, reasonCode: 'allowed'}
    : {allowed: false, reasonCode: 'multiple-physical-displays'}
}

export const resolvePowerRoleTarget = (input: PowerRoleTargetInput): DisplayRole | null => {
  if (input.instanceMode !== 'SLAVE' || input.displayCount !== 1) return null
  if (input.powerSource === 'external' && input.displayRole === 'CHIEF') return 'VICE'
  if (input.powerSource === 'battery' && input.displayRole === 'VICE') return 'CHIEF'
  return null
}
