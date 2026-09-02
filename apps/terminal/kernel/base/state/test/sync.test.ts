import {describe, expect, it} from 'vitest'
import {
  applySliceSyncDiff,
  createFullSliceSyncPayload,
  createSyncTombstone,
  type StateRuntimeSyncRecordDescriptor,
} from '../src/index'
import type {ExampleState} from './testSupport'
import {createSyncValue} from './testSupport'

const descriptor: StateRuntimeSyncRecordDescriptor<ExampleState> = {
  kind: 'record',
  getEntries: (state) => {
    const entries: Record<string, ReturnType<typeof createSyncValue>> = {}
    for (const [key, value] of Object.entries(state.entries)) {
      if (value !== undefined) {
        entries[key] = createSyncValue(value)
      }
    }
    return entries
  },
  applyEntries: (state, entries) => ({
    ...state,
    entries: Object.fromEntries(
      Object.entries(entries)
        .filter((entry) => entry[1] !== undefined && 'value' in entry[1])
        .map(([key, entry]) => [key, entry?.value]),
    ),
  }),
}

describe('S group: authoritative stateless sync', () => {
  it('S-4 creates full payloads with replaceMissing true', () => {
    const payload = createFullSliceSyncPayload(descriptor, {
      enabled: true,
      count: 1,
      entries: {a: 1},
    })

    expect(payload.replaceMissing).toBe(true)
    expect(payload.entries).toHaveLength(1)
  })

  it('S-5 applies full authoritative payload without latest-wins comparisons', () => {
    const next = applySliceSyncDiff(descriptor, {
      enabled: true,
      count: 1,
      entries: {old: 1},
    }, {
      mode: 'authoritative',
      replaceMissing: true,
      entries: [{key: 'new', value: createSyncValue(2)}],
    })

    expect(next.entries).toEqual({new: 2})
  })

  it('S-2 applies a partial diff while preserving receiver entries not listed', () => {
    const next = applySliceSyncDiff(descriptor, {
      enabled: true,
      count: 1,
      entries: {keep: 1, untouched: 2},
    }, {
      mode: 'authoritative',
      replaceMissing: false,
      entries: [{key: 'keep', value: createSyncValue(3)}],
    })

    expect(next.entries).toEqual({keep: 3, untouched: 2})
  })

  it('S-4 applies a tombstone by removing the addressed receiver entry', () => {
    const next = applySliceSyncDiff(descriptor, {
      enabled: true,
      count: 1,
      entries: {remove: 1, keep: 2},
    }, {
      mode: 'authoritative',
      replaceMissing: false,
      entries: [{key: 'remove', value: createSyncTombstone(2)}],
    })

    expect(next.entries).toEqual({keep: 2})
  })

  it('S-6 exposes tombstones as values the receiver can apply', () => {
    expect(createSyncTombstone(123)).toEqual({
      updatedAt: 123,
      tombstone: true,
    })
  })

  it('T-7 rejects malformed runtime envelopes instead of applying an ambiguous value', () => {
    expect(() => applySliceSyncDiff(
      descriptor,
      {enabled: true, count: 1, entries: {}},
      {
        mode: 'authoritative',
        replaceMissing: false,
        entries: [{key: 'broken', value: {updatedAt: 1} as never}],
      },
    )).toThrow('exactly one valid variant')
  })
})
