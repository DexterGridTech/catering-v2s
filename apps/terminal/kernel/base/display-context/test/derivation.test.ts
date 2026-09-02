import {describe, expect, it} from 'vitest'
import {
  getDisplayRoleChangeEligibility,
  getSwitchInstanceModeEligibility,
  resolvePowerRoleTarget,
  resolveSurfaceDisplayMode,
  resolveWorkspace,
} from '../src/index'

describe('display derivation', () => {
  it('D-1 idx0 MASTER CHIEF is PRIMARY', () => {
    expect(resolveSurfaceDisplayMode({displayIndex: 0, displayRole: 'CHIEF', instanceMode: 'MASTER'})).toBe('PRIMARY')
    expect(resolveSurfaceDisplayMode({displayIndex: 0, displayRole: 'CHIEF', instanceMode: 'MASTER'})).not.toBe('SECONDARY')
  })

  it('D-2 idx1 MASTER CHIEF is SECONDARY', () => {
    expect(resolveSurfaceDisplayMode({displayIndex: 1, displayRole: 'CHIEF', instanceMode: 'MASTER'})).toBe('SECONDARY')
    expect(resolveSurfaceDisplayMode({displayIndex: 1, displayRole: 'CHIEF', instanceMode: 'MASTER'})).not.toBe('PRIMARY')
  })

  it('D-3 idx0 SLAVE VICE is SECONDARY', () => {
    expect(resolveSurfaceDisplayMode({displayIndex: 0, displayRole: 'VICE', instanceMode: 'SLAVE'})).toBe('SECONDARY')
    expect(resolveSurfaceDisplayMode({displayIndex: 0, displayRole: 'VICE', instanceMode: 'SLAVE'})).not.toBe('PRIMARY')
  })

  it('D-4 idx0 SLAVE CHIEF is PRIMARY', () => {
    expect(resolveSurfaceDisplayMode({displayIndex: 0, displayRole: 'CHIEF', instanceMode: 'SLAVE'})).toBe('PRIMARY')
    expect(resolveSurfaceDisplayMode({displayIndex: 0, displayRole: 'CHIEF', instanceMode: 'SLAVE'})).not.toBe('SECONDARY')
  })

  it('D-5 idx1 SLAVE VICE remains SECONDARY', () => {
    expect(resolveSurfaceDisplayMode({displayIndex: 1, displayRole: 'VICE', instanceMode: 'SLAVE'})).toBe('SECONDARY')
    expect(resolveSurfaceDisplayMode({displayIndex: 1, displayRole: 'VICE', instanceMode: 'SLAVE'})).not.toBe('PRIMARY')
  })

  it('D-6 MASTER VICE bad state is PRIMARY on idx0', () => {
    expect(resolveSurfaceDisplayMode({displayIndex: 0, displayRole: 'VICE', instanceMode: 'MASTER'})).toBe('PRIMARY')
    expect(resolveSurfaceDisplayMode({displayIndex: 0, displayRole: 'VICE', instanceMode: 'MASTER'})).not.toBe('SECONDARY')
  })

  it('D-7 MASTER VICE bad state is SECONDARY on idx1', () => {
    expect(resolveSurfaceDisplayMode({displayIndex: 1, displayRole: 'VICE', instanceMode: 'MASTER'})).toBe('SECONDARY')
    expect(resolveSurfaceDisplayMode({displayIndex: 1, displayRole: 'VICE', instanceMode: 'MASTER'})).not.toBe('PRIMARY')
  })

  it('D-8 PRIMARY is the fallback for idx0 CHIEF', () => {
    expect(resolveSurfaceDisplayMode({displayIndex: 0, displayRole: 'CHIEF', instanceMode: 'SLAVE'})).toEqual('PRIMARY')
    expect(resolveSurfaceDisplayMode({displayIndex: 0, displayRole: 'CHIEF', instanceMode: 'SLAVE'})).not.toEqual('SECONDARY')
  })

  it('W-1 maps SLAVE CHIEF to BRANCH', () => {
    expect(resolveWorkspace({instanceMode: 'SLAVE', displayRole: 'CHIEF'})).toBe('BRANCH')
    expect(resolveWorkspace({instanceMode: 'SLAVE', displayRole: 'CHIEF'})).not.toBe('MAIN')
  })

  it('W-2 maps SLAVE VICE to MAIN', () => {
    expect(resolveWorkspace({instanceMode: 'SLAVE', displayRole: 'VICE'})).toBe('MAIN')
    expect(resolveWorkspace({instanceMode: 'SLAVE', displayRole: 'VICE'})).not.toBe('BRANCH')
  })

  it('W-3 maps MASTER CHIEF to MAIN', () => {
    expect(resolveWorkspace({instanceMode: 'MASTER', displayRole: 'CHIEF'})).toBe('MAIN')
    expect(resolveWorkspace({instanceMode: 'MASTER', displayRole: 'CHIEF'})).not.toBe('BRANCH')
  })

  it('W-4 maps MASTER VICE to MAIN', () => {
    expect(resolveWorkspace({instanceMode: 'MASTER', displayRole: 'VICE'})).toBe('MAIN')
    expect(resolveWorkspace({instanceMode: 'MASTER', displayRole: 'VICE'})).not.toBe('BRANCH')
  })

  it('E-1 rejects role VICE on MASTER', () => {
    const result = getDisplayRoleChangeEligibility({currentRole: 'CHIEF', targetRole: 'VICE', instanceMode: 'MASTER', routeDisplayMode: 'PRIMARY', displayCount: 1})
    expect(result).toEqual({allowed: false, reasonCode: 'master-instance'})
    expect(result.allowed).not.toBe(true)
  })

  it('E-2 rejects role VICE from a managed secondary', () => {
    const result = getDisplayRoleChangeEligibility({currentRole: 'CHIEF', targetRole: 'VICE', instanceMode: 'SLAVE', routeDisplayMode: 'SECONDARY', displayCount: 1})
    expect(result).toEqual({allowed: false, reasonCode: 'managed-secondary'})
    expect(result.allowed).not.toBe(true)
  })

  it('E-3 allows role VICE from a single primary slave', () => {
    const result = getDisplayRoleChangeEligibility({currentRole: 'CHIEF', targetRole: 'VICE', instanceMode: 'SLAVE', routeDisplayMode: 'PRIMARY', displayCount: 1})
    expect(result).toEqual({allowed: true, reasonCode: 'allowed'})
    expect(result.allowed).not.toBe(false)
  })

  it('E-4 rejects role VICE without route', () => {
    const result = getDisplayRoleChangeEligibility({currentRole: 'CHIEF', targetRole: 'VICE', instanceMode: 'SLAVE', displayCount: 1})
    expect(result).toEqual({allowed: false, reasonCode: 'missing-display-route'})
    expect(result.allowed).not.toBe(true)
  })

  it('E-5 allows role CHIEF from a slave vice', () => {
    const result = getDisplayRoleChangeEligibility({currentRole: 'VICE', targetRole: 'CHIEF', instanceMode: 'SLAVE', displayCount: 1})
    expect(result).toEqual({allowed: true, reasonCode: 'allowed'})
    expect(result.allowed).not.toBe(false)
  })

  it('E-6 rejects slave mode from a managed secondary', () => {
    const result = getSwitchInstanceModeEligibility({targetMode: 'SLAVE', routeDisplayMode: 'SECONDARY', displayCount: 1})
    expect(result).toEqual({allowed: false, reasonCode: 'managed-secondary'})
    expect(result.allowed).not.toBe(true)
  })

  it('E-7 rejects slave mode without a route', () => {
    const result = getSwitchInstanceModeEligibility({targetMode: 'SLAVE', displayCount: 1})
    expect(result).toEqual({allowed: false, reasonCode: 'missing-display-route'})
    expect(result.allowed).not.toBe(true)
  })

  it('E-8 rejects slave mode on multiple displays', () => {
    const result = getSwitchInstanceModeEligibility({targetMode: 'SLAVE', routeDisplayMode: 'PRIMARY', displayCount: 2})
    expect(result).toEqual({allowed: false, reasonCode: 'multiple-physical-displays'})
    expect(result.allowed).not.toBe(true)
  })

  it('E-9 allows slave mode on one primary display', () => {
    const result = getSwitchInstanceModeEligibility({targetMode: 'SLAVE', routeDisplayMode: 'PRIMARY', displayCount: 1})
    expect(result).toEqual({allowed: true, reasonCode: 'allowed'})
    expect(result.allowed).not.toBe(false)
  })

  it('P-1 external power changes slave chief to vice', () => {
    expect(resolvePowerRoleTarget({powerSource: 'external', instanceMode: 'SLAVE', displayRole: 'CHIEF', displayCount: 1})).toBe('VICE')
    expect(resolvePowerRoleTarget({powerSource: 'external', instanceMode: 'SLAVE', displayRole: 'CHIEF', displayCount: 1})).not.toBe('CHIEF')
  })

  it('P-2 battery changes slave vice to chief', () => {
    expect(resolvePowerRoleTarget({powerSource: 'battery', instanceMode: 'SLAVE', displayRole: 'VICE', displayCount: 1})).toBe('CHIEF')
    expect(resolvePowerRoleTarget({powerSource: 'battery', instanceMode: 'SLAVE', displayRole: 'VICE', displayCount: 1})).not.toBe('VICE')
  })

  it('P-3 unknown power does not change role', () => {
    expect(resolvePowerRoleTarget({powerSource: 'unknown', instanceMode: 'SLAVE', displayRole: 'CHIEF', displayCount: 1})).toBeNull()
    expect(resolvePowerRoleTarget({powerSource: 'unknown', instanceMode: 'SLAVE', displayRole: 'CHIEF', displayCount: 1})).not.toBe('VICE')
  })

  it('P-4 master power does not change role', () => {
    expect(resolvePowerRoleTarget({powerSource: 'external', instanceMode: 'MASTER', displayRole: 'CHIEF', displayCount: 1})).toBeNull()
    expect(resolvePowerRoleTarget({powerSource: 'external', instanceMode: 'MASTER', displayRole: 'CHIEF', displayCount: 1})).not.toBe('VICE')
  })

  it('P-5 multi-display power does not change role', () => {
    expect(resolvePowerRoleTarget({powerSource: 'external', instanceMode: 'SLAVE', displayRole: 'CHIEF', displayCount: 2})).toBeNull()
    expect(resolvePowerRoleTarget({powerSource: 'external', instanceMode: 'SLAVE', displayRole: 'CHIEF', displayCount: 2})).not.toBe('VICE')
  })
})
