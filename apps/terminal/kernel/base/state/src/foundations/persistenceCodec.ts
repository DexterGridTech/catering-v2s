import type {StateJsonObject, StateJsonValue} from '../types/value'

export type JsonEncodeResult =
  | {
      readonly status: 'succeeded'
      readonly encoded: string
    }
  | {
      readonly status: 'failed'
      readonly message: string
    }

export type JsonDecodeResult =
  | {
      readonly status: 'succeeded'
      readonly value: StateJsonValue
    }
  | {
      readonly status: 'failed'
      readonly message: string
    }

const isPlainObject = (value: unknown): value is object => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const validateJsonValue = (
  value: unknown,
  active: WeakSet<object>,
): value is StateJsonValue => {
  if (value === null) {
    return true
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return true
  }
  if (typeof value === 'number') {
    return Number.isFinite(value)
  }
  if (Array.isArray(value)) {
    if (value.length !== Object.keys(value).length || active.has(value)) {
      return false
    }
    active.add(value)
    try {
      for (const entry of value) {
        if (!validateJsonValue(entry, active)) {
          return false
        }
      }
      return true
    } finally {
      active.delete(value)
    }
  }
  if (isPlainObject(value)) {
    if (active.has(value)) {
      return false
    }
    active.add(value)
    try {
      for (const key of Object.keys(value)) {
        if (!validateJsonValue(Reflect.get(value, key), active)) {
          return false
        }
      }
      return true
    } finally {
      active.delete(value)
    }
  }
  return false
}

export const isStateJsonValue = (value: unknown): value is StateJsonValue =>
  validateJsonValue(value, new WeakSet<object>())

const isStateJsonObject = (value: StateJsonValue): value is StateJsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const canonicalize = (value: StateJsonValue): StateJsonValue => {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }
  if (isStateJsonObject(value)) {
    const objectValue = value
    const result: {[key: string]: StateJsonValue} = {}
    for (const key of Object.keys(objectValue).sort()) {
      result[key] = canonicalize(objectValue[key])
    }
    return result
  }
  return value
}

export const canonicalizeStateJsonValue = (value: StateJsonValue): StateJsonValue =>
  canonicalize(value)

export const encodeStateJsonValue = (value: unknown): JsonEncodeResult => {
  if (!isStateJsonValue(value)) {
    return {
      status: 'failed',
      message: 'value is not JSON-safe state data',
    }
  }
  return {
    status: 'succeeded',
    encoded: JSON.stringify(canonicalizeStateJsonValue(value)),
  }
}

export const decodeStateJsonValue = (encoded: string): JsonDecodeResult => {
  try {
    const value: unknown = JSON.parse(encoded)
    if (!isStateJsonValue(value)) {
      return {
        status: 'failed',
        message: 'encoded value is not JSON-safe state data',
      }
    }
    return {
      status: 'succeeded',
      value,
    }
  } catch (error: unknown) {
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'invalid JSON state data',
    }
  }
}

export const createStateValueSerialization = (value: StateJsonValue): string =>
  `json:${JSON.stringify(canonicalizeStateJsonValue(value))}`
