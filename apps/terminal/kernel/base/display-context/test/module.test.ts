import {describe, expect, it} from 'vitest'
import * as displayContext from '../src/index'
import {createDisplayContextModule} from '../src/index'

describe('display-context module and public surface', () => {
  it('T-1 exports the expected value surface without extra runtime symbols', () => {
    expect(Object.keys(displayContext).sort()).toEqual([
      'createDisplayContextModule',
      'dependencyModuleNames',
      'devDependencyModuleNames',
      'getDisplayRoleChangeEligibility',
      'getSwitchInstanceModeEligibility',
      'moduleName',
      'powerStatusChangedCommand',
      'resolvePowerRoleTarget',
      'resolveSurfaceDisplayMode',
      'resolveWorkspace',
      'selectDisplayRole',
      'switchDisplayRoleCommand',
      'switchInstanceModeCommand',
    ].sort())
    expect(Object.keys(displayContext)).not.toContain('validateHydratedDisplayRoleCommand')
  })

  it('T-2 module declares four commands, five actors, and one owner slice', () => {
    const module = createDisplayContextModule()
    expect(module.commands).toHaveLength(4)
    expect(module.commandDefinitions).toHaveLength(4)
    expect(module.actors).toHaveLength(5)
    expect(module.actorDefinitions).toHaveLength(5)
    expect(module.slices).toEqual([{name: 'kernel.base.display-context.display-role', persistIntent: 'owner-only'}])
    expect(module.stateSlices).toHaveLength(1)
    expect(module.onApplicationReset).toBeUndefined()
  })
})
