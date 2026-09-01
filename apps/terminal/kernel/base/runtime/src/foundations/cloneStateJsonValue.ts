import type {StateJsonValue} from '@catering-v2s/kernel-base-state'

export type CloneStateJsonValueFailureReason =
  | 'undefined'
  | 'non-finite-number'
  | 'function'
  | 'symbol'
  | 'bigint'
  | 'date'
  | 'non-plain-object'
  | 'circular-reference'
  | 'symbol-key'
  | 'accessor-property'
  | 'serialization-failed'
  | 'result-too-large'

export type CloneStateJsonValueResult =
  | Readonly<{
      status: 'valid'
      value: StateJsonValue
      bytes: number
    }>
  | Readonly<{
      status: 'invalid'
      reason: CloneStateJsonValueFailureReason
      path: string
      message: string
    }>

type JsonObjectClone = {
  [key: string]: StateJsonValue
}

const invalid = (
  reason: CloneStateJsonValueFailureReason,
  path: string,
  message: string,
): CloneStateJsonValueResult => ({status: 'invalid', reason, path, message})

const pathForKey = (path: string, key: string): string =>
  path === '$' ? `$.${key}` : `${path}.${key}`

const pathForIndex = (path: string, index: number): string => `${path}[${index}]`

const cloneValue = (
  value: unknown,
  path: string,
  ancestors: WeakSet<object>,
): StateJsonValue | CloneStateJsonValueResult => {
  if (value === null) return null
  if (value === undefined) return invalid('undefined', path, `Undefined value at ${path}`)

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value
    case 'number':
      return Number.isFinite(value)
        ? value
        : invalid('non-finite-number', path, `Non-finite number at ${path}`)
    case 'function':
      return invalid('function', path, `Function value at ${path}`)
    case 'symbol':
      return invalid('symbol', path, `Symbol value at ${path}`)
    case 'bigint':
      return invalid('bigint', path, `BigInt value at ${path}`)
    case 'object':
      break
    default:
      return invalid('serialization-failed', path, `Unsupported value at ${path}`)
  }

  if (ancestors.has(value)) {
    return invalid('circular-reference', path, `Circular reference at ${path}`)
  }
  if (value instanceof Date) {
    return invalid('date', path, `Date value at ${path}`)
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
    return invalid('non-plain-object', path, `Non-plain object at ${path}`)
  }
  for (const symbolKey of Object.getOwnPropertySymbols(value)) {
    return invalid('symbol-key', path, `Symbol key at ${path}`)
  }

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const cloned: StateJsonValue[] = []
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (descriptor === undefined || !('value' in descriptor)) {
          return invalid('accessor-property', pathForIndex(path, index), `Accessor array item at ${pathForIndex(path, index)}`)
        }
        const child = cloneValue(descriptor.value, pathForIndex(path, index), ancestors)
        if (isCloneFailure(child)) return child
        cloned.push(child)
      }
      return Object.freeze(cloned)
    }

    const cloned: JsonObjectClone = Object.create(null) as JsonObjectClone
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (descriptor === undefined || !('value' in descriptor)) {
        return invalid('accessor-property', pathForKey(path, key), `Accessor property at ${pathForKey(path, key)}`)
      }
      const child = cloneValue(descriptor.value, pathForKey(path, key), ancestors)
      if (isCloneFailure(child)) return child
      Object.defineProperty(cloned, key, {
        value: child,
        enumerable: true,
        configurable: true,
        writable: false,
      })
    }
    return Object.freeze(cloned)
  } finally {
    ancestors.delete(value)
  }
}

const isCloneFailure = (
  value: StateJsonValue | CloneStateJsonValueResult,
): value is CloneStateJsonValueResult & {readonly status: 'invalid'} =>
  typeof value === 'object'
  && value !== null
  && 'status' in value
  && value.status === 'invalid'

export const cloneStateJsonValue = (
  value: unknown,
  maxBytes: number,
): CloneStateJsonValueResult => {
  try {
    const cloned = cloneValue(value, '$', new WeakSet<object>())
    if (isCloneFailure(cloned)) return cloned
    const serialized = JSON.stringify(cloned)
    if (serialized === undefined) {
      return invalid('serialization-failed', '$', 'Value could not be serialized as JSON')
    }
    const bytes = new TextEncoder().encode(serialized).byteLength
    if (bytes > maxBytes) {
      return invalid('result-too-large', '$', `Serialized value is ${bytes} bytes; limit is ${maxBytes}`)
    }
    return Object.freeze({status: 'valid', value: cloned, bytes})
  } catch (error) {
    return invalid(
      'serialization-failed',
      '$',
      error instanceof Error ? error.message : 'Value could not be serialized as JSON',
    )
  }
}
