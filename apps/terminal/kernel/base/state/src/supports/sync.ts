import {nowTimestampMs, type TimestampMs} from '@catering-v2s/kernel-base-contracts'
import type {
  StateRuntimeSyncRecordDescriptor,
  SyncStateDiff,
  SyncStateDiffEntry,
  SyncStateSummary,
  SyncStateSummaryEntry,
  SyncValueEnvelope,
  SyncDiffOptions,
} from '../types/sync'
import type {StateJsonValue} from '../types/value'
import {
  createStateValueSerialization,
  isStateJsonValue,
} from '../foundations/persistenceCodec'

const isObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null

const readProperty = (value: object, key: string): unknown => Reflect.get(value, key)

function assertValidSyncDiff(
  diff: unknown,
): asserts diff is SyncStateDiff<string, StateJsonValue> {
  if (
    !isObject(diff)
    || readProperty(diff, 'mode') !== 'authoritative'
    || typeof readProperty(diff, 'replaceMissing') !== 'boolean'
  ) {
    throw new Error('[state.sync] invalid authoritative sync diff')
  }
  const entries = readProperty(diff, 'entries')
  if (!Array.isArray(entries)) {
    throw new Error('[state.sync] sync diff entries must be an array')
  }
  const seen = new Set<string>()
  for (const entry of entries) {
    if (!isObject(entry)) {
      throw new Error('[state.sync] sync diff entry key must be non-empty')
    }
    const key = readProperty(entry, 'key')
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new Error('[state.sync] sync diff entry key must be non-empty')
    }
    if (seen.has(key)) {
      throw new Error(`[state.sync] duplicate sync diff entry: ${key}`)
    }
    seen.add(key)
    const envelope = readProperty(entry, 'value')
    if (!isObject(envelope) || !Number.isFinite(readProperty(envelope, 'updatedAt'))) {
      throw new Error(`[state.sync] invalid sync envelope: ${key}`)
    }
    const tombstone = readProperty(envelope, 'tombstone')
    const hasTombstoneField = Object.prototype.hasOwnProperty.call(envelope, 'tombstone')
    const hasTombstone = tombstone === true
    const rawValue = readProperty(envelope, 'value')
    const hasValueField = Object.prototype.hasOwnProperty.call(envelope, 'value')
    const hasValue = hasValueField && rawValue !== undefined
    if (
      (hasTombstoneField && !hasTombstone)
      || (hasValueField && !hasValue)
      || hasTombstone === hasValue
      || (hasValue && !isStateJsonValue(rawValue))
    ) {
      throw new Error(`[state.sync] sync envelope must contain exactly one valid variant: ${key}`)
    }
  }
}

const createEntrySummary = <TValue extends StateJsonValue>(
  envelope: SyncValueEnvelope<TValue>,
): SyncStateSummaryEntry => {
  if (envelope.tombstone === true) {
    return {
      updatedAt: envelope.updatedAt,
      tombstone: true,
      valueHash: 'tombstone',
    }
  }
  return {
    updatedAt: envelope.updatedAt,
    valueHash: createStateValueSerialization(envelope.value),
  }
}

export function createSliceSyncSummary<
  TState extends object,
  TKey extends string,
  TValue extends StateJsonValue,
>(
  descriptor: StateRuntimeSyncRecordDescriptor<TState, TKey, TValue>,
  state: Readonly<TState>,
): SyncStateSummary<TKey>
export function createSliceSyncSummary(
  descriptor: StateRuntimeSyncRecordDescriptor<object, string, StateJsonValue>,
  state: Readonly<object>,
): SyncStateSummary<string> {
  const entries = descriptor.getEntries(state)
  const summary: Record<string, SyncStateSummaryEntry> = {}
  for (const [key, envelope] of Object.entries(entries)) {
    if (envelope !== undefined) {
      summary[key] = createEntrySummary(envelope)
    }
  }
  return summary
}

export function createSliceSyncDiff<
  TState extends object,
  TKey extends string,
  TValue extends StateJsonValue,
>(
  descriptor: StateRuntimeSyncRecordDescriptor<TState, TKey, TValue>,
  state: Readonly<TState>,
  remoteSummary: SyncStateSummary<TKey>,
  options: SyncDiffOptions,
): Extract<SyncStateDiff<TKey, TValue>, {readonly replaceMissing: false}>
export function createSliceSyncDiff(
  descriptor: StateRuntimeSyncRecordDescriptor<object, string, StateJsonValue>,
  state: Readonly<object>,
  remoteSummary: SyncStateSummary<string>,
  options: SyncDiffOptions,
): Extract<SyncStateDiff<string, StateJsonValue>, {readonly replaceMissing: false}> {
  void options
  const localEntries = descriptor.getEntries(state)
  const diffEntries: SyncStateDiffEntry<string, StateJsonValue>[] = []
  const localKeys = new Set(Object.keys(localEntries))
  for (const [key, envelope] of Object.entries(localEntries)) {
    if (envelope === undefined) {
      continue
    }
    const localSummary = createEntrySummary(envelope)
    const remote = remoteSummary[key]
    if (
      remote === undefined
      || remote.updatedAt !== localSummary.updatedAt
      || remote.valueHash !== localSummary.valueHash
      || remote.tombstone !== localSummary.tombstone
    ) {
      diffEntries.push({key, value: envelope})
    }
  }
  for (const key of Object.keys(remoteSummary)) {
    if (!localKeys.has(key)) {
      diffEntries.push({
        key,
        value: createSyncTombstone(nowTimestampMs()),
      })
    }
  }
  return {
    mode: 'authoritative',
    replaceMissing: false,
    entries: diffEntries,
  }
}

export function createFullSliceSyncPayload<
  TState extends object,
  TKey extends string,
  TValue extends StateJsonValue,
>(
  descriptor: StateRuntimeSyncRecordDescriptor<TState, TKey, TValue>,
  state: Readonly<TState>,
): Extract<SyncStateDiff<TKey, TValue>, {readonly replaceMissing: true}>
export function createFullSliceSyncPayload(
  descriptor: StateRuntimeSyncRecordDescriptor<object, string, StateJsonValue>,
  state: Readonly<object>,
): Extract<SyncStateDiff<string, StateJsonValue>, {readonly replaceMissing: true}> {
  const entries: SyncStateDiffEntry<string, StateJsonValue>[] = []
  for (const [key, envelope] of Object.entries(descriptor.getEntries(state))) {
    if (envelope !== undefined) {
      entries.push({key, value: envelope})
    }
  }
  return {
    mode: 'authoritative',
    replaceMissing: true,
    entries,
  }
}

export function applySliceSyncDiff<
  TState extends object,
  TKey extends string,
  TValue extends StateJsonValue,
>(
  descriptor: StateRuntimeSyncRecordDescriptor<TState, TKey, TValue>,
  state: Readonly<TState>,
  diff: SyncStateDiff<TKey, TValue>,
): TState
export function applySliceSyncDiff(
  descriptor: StateRuntimeSyncRecordDescriptor<object, string, StateJsonValue>,
  state: Readonly<object>,
  diff: SyncStateDiff<string, StateJsonValue>,
): object {
  assertValidSyncDiff(diff)
  const current = descriptor.getEntries(state)
  const next: Partial<Record<string, SyncValueEnvelope<StateJsonValue>>> = {}
  if (!diff.replaceMissing) {
    for (const [key, value] of Object.entries(current)) {
      if (value !== undefined) {
        next[key] = value
      }
    }
  }
  for (const entry of diff.entries) {
    if (entry.value.tombstone === true) {
      Reflect.deleteProperty(next, entry.key)
      continue
    }
    next[entry.key] = entry.value
  }
  return descriptor.applyEntries(state, next)
}

export const createSyncTombstone = (
  updatedAt: TimestampMs,
): SyncValueEnvelope<never> => ({
  updatedAt,
  tombstone: true,
})
