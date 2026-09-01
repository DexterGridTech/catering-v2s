import type {UnknownAction} from '@reduxjs/toolkit'
import type {
  CreateStateRuntimeInput,
  StateRuntime,
  StateSyncApplyResult,
  StateSyncPayloadResult,
} from '../types/runtime'
import type {StateRoot} from '../types/runtime'
import type {RegisteredStateRuntimeSlice} from '../types/slice'
import {
  getRegisteredStateRuntimeSlice,
} from './defineStateRuntimeSlice'
import {
  applyAuthoritativeSyncActionType,
  createStateStore,
  resetToOwnerInitialStateActionType,
} from './createStateStore'
import {hydrateStateRuntime} from './persistenceEngine'
import {
  applySliceSyncDiff,
  createFullSliceSyncPayload,
} from '../supports/sync'

type AutoFlushSelection = 'all' | 'immediate'

const requirePositiveFinite = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`[createStateRuntime] ${label} must be a positive finite number`)
  }
}

const requireNonEmpty = (value: string, label: string): void => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`[createStateRuntime] ${label} must be non-empty`)
  }
}

const resolveSlices = (
  input: CreateStateRuntimeInput,
): readonly RegisteredStateRuntimeSlice[] => {
  const slices: RegisteredStateRuntimeSlice[] = []
  const names = new Set<string>()
  for (const registration of input.slices) {
    const slice = getRegisteredStateRuntimeSlice(registration)
    if (slice === undefined) {
      throw new Error('[createStateRuntime] unknown state runtime slice registration')
    }
    if (names.has(slice.name)) {
      throw new Error(`[createStateRuntime] duplicate slice name: ${slice.name}`)
    }
    names.add(slice.name)
    slices.push(slice)
  }
  if (slices.length === 0) {
    throw new Error('[createStateRuntime] at least one state runtime slice is required')
  }
  return slices
}

const createReducers = (
  slices: readonly RegisteredStateRuntimeSlice[],
): Readonly<Record<string, (state: object | undefined, action: UnknownAction) => object>> =>
  Object.fromEntries(
    slices.map((slice) => [slice.name, slice.reducer]),
  )

export const createStateRuntime = async (
  input: CreateStateRuntimeInput,
): Promise<StateRuntime> => {
  requireNonEmpty(input.runtimeName, 'runtimeName')
  requireNonEmpty(input.persistenceKey, 'persistenceKey')
  requirePositiveFinite(input.storageTimeouts.readMs, 'storageTimeouts.readMs')
  requirePositiveFinite(input.storageTimeouts.writeMs, 'storageTimeouts.writeMs')
  requirePositiveFinite(input.storageTimeouts.resetMs, 'storageTimeouts.resetMs')
  if (!Number.isFinite(input.persistenceDebounceMs) || input.persistenceDebounceMs < 0) {
    throw new Error('[createStateRuntime] persistenceDebounceMs must be a non-negative finite number')
  }
  if (input.plainStorage === input.protectedStorage) {
    throw new Error(
      '[createStateRuntime] plainStorage and protectedStorage must be distinct physical ports',
    )
  }

  const slices = resolveSlices(input)
  const hydrated = await hydrateStateRuntime({
    persistenceKey: input.persistenceKey,
    slices,
    storagePorts: {
      plain: input.plainStorage,
      protected: input.protectedStorage,
    },
    timeouts: input.storageTimeouts,
    logger: input.logger.scope({
      moduleName: '@catering-v2s/kernel-base-state',
      layer: 'kernel',
      subsystem: 'state-runtime',
      component: input.runtimeName,
    }),
  })
  const store = createStateStore({
    reducers: createReducers(slices),
    preloadedState: hydrated.preloadedState,
    environmentMode: input.environmentMode,
    storeEnhancers: input.storeEnhancers,
  })

  let autoFlushPromise: Promise<unknown> | undefined
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  const persistableSliceRefs = new Map<string, object | undefined>(
    slices
      .filter((slice) => slice.persistence.length > 0)
      .map((slice) => [slice.name, store.getState()[slice.name]]),
  )
  const cancelDebounce = (): void => {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer)
      debounceTimer = undefined
    }
  }
  const runFlush = (selection: AutoFlushSelection): void => {
      autoFlushPromise = hydrated.engine.flush(store.getState(), selection)
      autoFlushPromise.catch((error: unknown) => {
        input.logger.error({
          category: 'state.persistence',
          event: 'state.persistence.autoflush.unhandled',
          message: error instanceof Error ? error.message : 'state autoflush failed',
        })
      })
  }
  const scheduleAutoFlush = (): void => {
    const state = store.getState()
    const changedSlices = slices.filter((slice) => {
      if (slice.persistence.length === 0) {
        return false
      }
      const next = state[slice.name]
      const previous = persistableSliceRefs.get(slice.name)
      persistableSliceRefs.set(slice.name, next)
      return next !== previous
    })
    if (changedSlices.length === 0) {
      return
    }

    const hasImmediateChange = changedSlices.some((slice) =>
      slice.persistence.some((entry) => entry.flushMode !== 'debounced'),
    )
    const hasDebouncedChange = changedSlices.some((slice) =>
      slice.persistence.some((entry) => entry.flushMode === 'debounced'),
    )
    if (input.persistenceDebounceMs === 0) {
      cancelDebounce()
      runFlush('all')
      return
    }

    // An immediate change must not flush a debounced descriptor that is still
    // inside its debounce window.  Keep an existing timer alive for that work.
    if (hasImmediateChange) {
      runFlush('immediate')
    }
    if (hasDebouncedChange) {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined
        runFlush('all')
      }, input.persistenceDebounceMs)
    }
  }
  store.subscribe(scheduleAutoFlush)

  const findSyncSlice = (
    sliceName: string,
  ): RegisteredStateRuntimeSlice | undefined =>
    slices.find((slice) => slice.name === sliceName && slice.sync !== undefined)

  const runtime: StateRuntime = {
    getStore: () => store,
    getState: () => store.getState(),
    getSlices: () => input.slices,
    getPersistenceHealth: () => hydrated.engine.getHealth(),
    subscribePersistenceHealth: (listener) => hydrated.engine.subscribe(listener),
    flushPersistence: () => hydrated.engine.flush(store.getState()),
    getResetActor: () => ({
      handleResetCommand: () => {
        cancelDebounce()
        return hydrated.engine.reset(() => {
          store.dispatch({type: resetToOwnerInitialStateActionType})
        })
      },
    }),
    createFullSyncPayload: (sliceName: string): StateSyncPayloadResult => {
      const slice = findSyncSlice(sliceName)
      if (slice === undefined || slice.sync === undefined) {
        input.logger.warn({
          category: 'state.sync',
          event: 'state.sync.payload.skipped',
          message: `sync slice is not registered: ${sliceName}`,
          data: {sliceName},
        })
        return {
          status: 'skipped',
          sliceName,
          reason: slices.some((candidate) => candidate.name === sliceName)
            ? 'SYNC_NOT_DECLARED'
            : 'UNKNOWN_SLICE',
        }
      }
      const state = store.getState()[slice.name]
      if (state === undefined) {
        return {
          status: 'skipped',
          sliceName,
          reason: 'UNKNOWN_SLICE',
        }
      }
      return {
        status: 'ready',
        sliceName,
        payload: createFullSliceSyncPayload(slice.sync, state),
      }
    },
    applyAuthoritativeSync: (sliceName, payload): StateSyncApplyResult => {
      const slice = findSyncSlice(sliceName)
      if (slice === undefined || slice.sync === undefined) {
        input.logger.warn({
          category: 'state.sync',
          event: 'state.sync.apply.skipped',
          message: `sync slice is not registered: ${sliceName}`,
          data: {sliceName},
        })
        return {
          status: 'skipped',
          sliceName,
          reason: slices.some((candidate) => candidate.name === sliceName)
            ? 'SYNC_NOT_DECLARED'
            : 'UNKNOWN_SLICE',
        }
      }
      const state = store.getState()[slice.name]
      if (state === undefined) {
        return {
          status: 'skipped',
          sliceName,
          reason: 'UNKNOWN_SLICE',
        }
      }
      const nextState = applySliceSyncDiff(slice.sync, state, payload)
      store.dispatch({
        type: applyAuthoritativeSyncActionType,
        payload: {
          sliceName,
          state: nextState,
        },
      })
      return {
        status: 'applied',
        sliceName,
        changed: nextState !== state,
      }
    },
  }
  return Object.freeze(runtime)
}
