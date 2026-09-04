import {describe, expect, it} from 'vitest'
import {
  sampleStaffAuthAssembly,
} from '../src/index'
import {authNoticeDismissedCommand} from '../src/commands'
import {operatorNameVariable, passcodeVariable} from '../src/variables'

describe('sample staff auth UI feature', () => {
  it('exports one assembly description with the approved parts and variables', () => {
    expect(sampleStaffAuthAssembly.parts.map(part => part.catalogEntry.partKey)).toEqual([
      'sample.auth.login',
      'sample.auth.notice',
    ])
    expect(sampleStaffAuthAssembly.variables).toEqual([
      operatorNameVariable,
      passcodeVariable,
    ])
    expect(sampleStaffAuthAssembly.variables.map(variable => [variable.key, variable.persistIntent])).toEqual([
      ['sample.login.operator-name', 'owner-only'],
      ['sample.login.passcode', 'never'],
    ])
    expect(sampleStaffAuthAssembly.createModule().commands).toEqual([{
      name: authNoticeDismissedCommand.commandName,
      visibility: 'public',
    }])
  })

  it('keeps the notice layer-only and the login screen on PRIMARY', () => {
    const [login, notice] = sampleStaffAuthAssembly.parts
    expect(login?.catalogEntry).toMatchObject({
      partKey: 'sample.auth.login',
      containerKeys: ['main'],
      displayModes: ['PRIMARY'],
    })
    expect(notice?.catalogEntry).toMatchObject({
      partKey: 'sample.auth.notice',
      containerKeys: [],
      displayModes: ['PRIMARY'],
    })
    expect(notice?.rendererBinding.layerTier).toBe('alert')
  })
})
