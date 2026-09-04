import {createModuleUiVariableFactory} from '@catering-v2s/kernel-base-ui-state'

const defineVariable = createModuleUiVariableFactory('sample.login')

export const operatorNameVariable = defineVariable.define('operator-name', {
  defaultValue: '',
  persistIntent: 'owner-only',
})

export const passcodeVariable = defineVariable.define('passcode', {
  defaultValue: '',
  persistIntent: 'never',
})

export const variables = Object.freeze([
  operatorNameVariable,
  passcodeVariable,
])
