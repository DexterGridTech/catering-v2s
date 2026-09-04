import {createModuleUiVariableFactory} from '@catering-v2s/kernel-base-ui-state'

const defineVariable = createModuleUiVariableFactory('sample.member')

export const memberNameVariable = defineVariable.define('name', {
  defaultValue: '',
  persistIntent: 'never',
})

export const memberPhoneVariable = defineVariable.define('phone', {
  defaultValue: '',
  persistIntent: 'never',
})

export const variables = Object.freeze([
  memberNameVariable,
  memberPhoneVariable,
])
