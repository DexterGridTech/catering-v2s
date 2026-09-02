import type {PersistIntent, StateJsonValue} from '@catering-v2s/kernel-base-state'
import {assertNonEmptyString} from './assertNonEmptyString'
import {
  assertStateJsonValue,
  cloneAndFreezeStateJsonValue,
} from './valueValidation'
import type {
  UiVariableDeclaration,
  UiVariableFactory,
  UiVariableWrite,
} from '../types/variable'
import {uiVariableDeclarationBrand} from '../types/variable'

const persistIntents = ['never', 'owner-only'] as const satisfies readonly PersistIntent[]

function assertPersistIntent(value: unknown): asserts value is PersistIntent {
  if (typeof value !== 'string' || !persistIntents.includes(value as PersistIntent)) {
    throw new Error('[ui-state] variable persistIntent must be never or owner-only')
  }
}

export const createModuleUiVariableFactory = (moduleName: string): UiVariableFactory => {
  assertNonEmptyString(moduleName, 'ui-state', 'variable.moduleName')
  return Object.freeze({
    define: <TValue extends StateJsonValue>(
      localKey: string,
      input: Readonly<{defaultValue: TValue; persistIntent: PersistIntent}>,
    ): UiVariableDeclaration<TValue> => {
      assertNonEmptyString(localKey, 'ui-state', 'variable.localKey')
      assertPersistIntent(input.persistIntent)
      assertStateJsonValue(input.defaultValue, 'variable.defaultValue')
      return Object.freeze({
        key: `${moduleName}.${localKey}`,
        moduleName,
        defaultValue: cloneAndFreezeStateJsonValue(input.defaultValue),
        persistIntent: input.persistIntent,
        [uiVariableDeclarationBrand]: true as const,
      })
    },
  })
}

const variableDeclarationKeys = Object.freeze([
  'key', 'moduleName', 'defaultValue', 'persistIntent', uiVariableDeclarationBrand,
] as const)

export function assertUiVariableDeclaration(
  value: unknown,
): asserts value is UiVariableDeclaration<StateJsonValue> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('[ui-state] variable declaration must be created by createModuleUiVariableFactory')
  }
  const record = value as Record<PropertyKey, unknown>
  const actualKeys = Reflect.ownKeys(record)
  if (actualKeys.length !== variableDeclarationKeys.length
    || variableDeclarationKeys.some(key => !actualKeys.includes(key))) {
    throw new Error('[ui-state] variable declaration shape is invalid')
  }
  if (record[uiVariableDeclarationBrand] !== true) {
    throw new Error('[ui-state] variable declaration must be created by createModuleUiVariableFactory')
  }
  if (typeof record.key !== 'string' || typeof record.moduleName !== 'string') {
    throw new Error('[ui-state] variable declaration key and moduleName must be strings')
  }
  const prefix = `${record.moduleName}.`
  if (record.moduleName.trim().length === 0 || record.key.length <= prefix.length || !record.key.startsWith(prefix)) {
    throw new Error('[ui-state] variable declaration key must use its moduleName prefix')
  }
  assertPersistIntent(record.persistIntent)
  assertStateJsonValue(record.defaultValue, '[ui-state] variable declaration.defaultValue')
}

export const createUiVariableWrite = <TValue extends StateJsonValue>(
  declaration: UiVariableDeclaration<TValue>,
  value: TValue,
): UiVariableWrite<TValue> => {
  assertUiVariableDeclaration(declaration)
  assertStateJsonValue(value, 'variable.value')
  return Object.freeze({
    key: declaration.key,
    value: cloneAndFreezeStateJsonValue(value),
  })
}
