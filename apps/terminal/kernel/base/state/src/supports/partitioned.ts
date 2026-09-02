import type {UnknownAction} from '@reduxjs/toolkit'
import {defineStateRuntimeSlice} from '../foundations/defineStateRuntimeSlice'
import type {
  CreatePartitionedActionDispatcherInput,
  PartitionedStateKeys,
  ToPartitionedStateDescriptorsInput,
} from '../types/partitioned'
import type {StateRuntimeSliceRegistration} from '../types/slice'

const requirePartitionList = <K extends string>(keys: readonly K[]): void => {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('[partitioned.state] keys must be a non-empty array')
  }
  const seen = new Set<string>()
  for (const key of keys) {
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new Error('[partitioned.state] partition key must be non-empty')
    }
    if (seen.has(key)) {
      throw new Error(`[partitioned.state] duplicate partition key: ${key}`)
    }
    seen.add(key)
  }
}

export const createPartitionedStateKeys = <K extends string>(
  baseName: string,
  keys: readonly K[],
): PartitionedStateKeys<K> => {
  if (typeof baseName !== 'string' || baseName.trim().length === 0) {
    throw new Error('[partitioned.state] baseName is required')
  }
  requirePartitionList(keys)
  return Object.freeze(Object.fromEntries(
    keys.map((key) => [key, `${baseName}.${key}`]),
  )) as PartitionedStateKeys<K>
}

export const createPartitionedActionDispatcher = <
  K extends string,
  TAction extends UnknownAction,
>(
  input: CreatePartitionedActionDispatcherInput<K, TAction>,
): ((createAction: (partition: K) => TAction) => unknown) => {
  if (typeof input.selectPartition !== 'function') {
    throw new Error('[partitioned.state] selectPartition is required')
  }
  if (typeof input.dispatch !== 'function') {
    throw new Error('[partitioned.state] dispatch is required')
  }
  return (createAction: (partition: K) => TAction): unknown => {
    if (typeof createAction !== 'function') {
      throw new Error('[partitioned.state] createAction is required')
    }
    return input.dispatch(createAction(input.selectPartition()))
  }
}

export const readPartitionedState = <K extends string, TValue>(
  values: Readonly<Record<K, TValue>>,
  partition: K,
): TValue => values[partition]

export const toPartitionedStateDescriptors = <
  K extends string,
  TState extends object,
>(
  input: ToPartitionedStateDescriptorsInput<K, TState>,
): readonly StateRuntimeSliceRegistration[] => {
  if (typeof input.createDescriptor !== 'function') {
    throw new Error('[toPartitionedStateDescriptors] createDescriptor is required')
  }
  requirePartitionList(input.keys)
  const registrations = input.keys.map((partition) => {
    const stateKey = input.stateKeys[partition]
    if (typeof stateKey !== 'string' || stateKey.trim().length === 0) {
      throw new Error(`[toPartitionedStateDescriptors] state key is required for ${partition}`)
    }
    const descriptor = input.createDescriptor(partition, stateKey)
    if (descriptor.name !== stateKey) {
      throw new Error(`[toPartitionedStateDescriptors] descriptor name mismatch for ${partition}`)
    }
    return defineStateRuntimeSlice(descriptor)
  })
  return Object.freeze(registrations)
}
