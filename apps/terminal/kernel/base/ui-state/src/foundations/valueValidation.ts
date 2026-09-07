import type {StateJsonObject, StateJsonValue} from '@catering-v2s/kernel-base-state'

const isPlainObject = (value: unknown): value is object => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function validateArrayJsonValue(
  value: readonly unknown[],
  active: WeakSet<object>,
): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (descriptor === undefined || !('value' in descriptor)) {
      return false
    }
    if (!isJsonValue(descriptor.value, active)) {
      return false
    }
  }
  return true
}

function validateObjectJsonValue(
  value: object,
  active: WeakSet<object>,
): boolean {
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !('value' in descriptor)) {
      return false
    }
    if (!isJsonValue(descriptor.value, active)) {
      return false
    }
  }
  return true
}

const isJsonValue = (
  value: unknown,
  active: WeakSet<object>,
): value is StateJsonValue => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) {
    if (active.has(value) || Object.getOwnPropertySymbols(value).length > 0) return false
    active.add(value)
    try {
      if (value.length !== Object.keys(value).length) return false
      return validateArrayJsonValue(value, active)
    } finally {
      active.delete(value)
    }
  }
  if (!isPlainObject(value) || active.has(value) || Object.getOwnPropertySymbols(value).length > 0) return false
  active.add(value)
  try {
    return validateObjectJsonValue(value, active)
  } finally {
    active.delete(value)
  }
}

export function assertStateJsonValue(value: unknown, label: string): asserts value is StateJsonValue {
  if (!isJsonValue(value, new WeakSet<object>())) {
    throw new Error(`[ui-state] ${label} must be JSON-safe state data`)
  }
}

const cloneJsonValue = (value: StateJsonValue): StateJsonValue => {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(cloneJsonValue))
  }
  if (typeof value === 'object' && value !== null) {
    const result: {[key: string]: StateJsonValue} = {}
    for (const key of Object.keys(value as StateJsonObject)) {
      result[key] = cloneJsonValue((value as StateJsonObject)[key])
    }
    return Object.freeze(result)
  }
  return value
}

export const cloneAndFreezeStateJsonValue = <TValue extends StateJsonValue>(value: TValue): TValue =>
  cloneJsonValue(value) as TValue
