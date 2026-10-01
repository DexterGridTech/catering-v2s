import type {UnknownAction} from '@reduxjs/toolkit';
import type {
  CreateStateRuntimeInput,
  StateRuntime,
  StateSyncApplyResult,
  StateSyncPayloadResult,
} from '../types/runtime';
import type {RegisteredStateRuntimeSlice} from '../types/slice';
import {getRegisteredStateRuntimeSlice} from './defineStateRuntimeSlice';
import {
  applyAuthoritativeSyncActionType,
  createStateStore,
  resetToOwnerInitialStateActionType,
} from './createStateStore';
import {hydrateStateRuntime} from './persistenceHydration';
import {applySliceSyncDiff, createFullSliceSyncPayload} from './sync';
import {assertNonEmptyString} from './assertNonEmptyString';

type AutoFlushSelection = 'all' | 'immediate';

const recordEntriesChanged = (
  previous: Readonly<Record<string, unknown>>,
  next: Readonly<Record<string, unknown>>,
): boolean => {
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) return true;
  return previousKeys.some(key => !Object.is(previous[key], next[key]));
};

const persistenceDescriptorChanged = (
  descriptor: RegisteredStateRuntimeSlice['persistence'][number],
  previous: object | undefined,
  next: object | undefined,
): boolean => {
  if (previous === next) return false;
  if (previous === undefined || next === undefined) return true;
  if (descriptor.kind === 'field') {
    return !Object.is(descriptor.readField(previous), descriptor.readField(next));
  }
  return recordEntriesChanged(descriptor.getEntries(previous), descriptor.getEntries(next));
};

const resolveSlices = (input: CreateStateRuntimeInput): readonly RegisteredStateRuntimeSlice[] => {
  const slices: RegisteredStateRuntimeSlice[] = [];
  const names = new Set<string>();
  for (const registration of input.slices) {
    const slice = getRegisteredStateRuntimeSlice(registration);
    if (slice === undefined) {
      throw new Error('[createStateRuntime] unknown state runtime slice registration');
    }
    if (names.has(slice.name)) {
      throw new Error(`[createStateRuntime] duplicate slice name: ${slice.name}`);
    }
    names.add(slice.name);
    slices.push(slice);
  }
  if (slices.length === 0) {
    throw new Error('[createStateRuntime] at least one state runtime slice is required');
  }
  return slices;
};

const createReducers = (
  slices: readonly RegisteredStateRuntimeSlice[],
): Readonly<Record<string, (state: object | undefined, action: UnknownAction) => object>> =>
  Object.fromEntries(slices.map(slice => [slice.name, slice.reducer]));

export const createStateRuntime = async (input: CreateStateRuntimeInput): Promise<StateRuntime> => {
  assertNonEmptyString(input.runtimeName, 'createStateRuntime', 'runtimeName');
  assertNonEmptyString(input.persistenceKey, 'createStateRuntime', 'persistenceKey');
  if (!Number.isFinite(input.persistenceDebounceMs) || input.persistenceDebounceMs < 0) {
    throw new Error('[createStateRuntime] persistenceDebounceMs must be a non-negative finite number');
  }
  if (input.plainStorage === input.protectedStorage) {
    throw new Error('[createStateRuntime] plainStorage and protectedStorage must be distinct physical ports');
  }

  const slices = resolveSlices(input);
  const retainedSlices = slices
    .filter(slice => slice.resetIntent === 'retain')
    .map(slice => ({
      name: slice.name,
      retainPersistedState: (initialState: object, currentState: object): object =>
        slice.persistence.reduce((retained, descriptor) => {
          if (descriptor.kind === 'field') {
            const value = descriptor.readField(currentState);
            if (descriptor.shouldPersist !== undefined && !descriptor.shouldPersist(value, currentState))
              return retained;
            return descriptor.writeField(retained, value);
          }
          const entries = descriptor.getEntries(currentState);
          const persistedEntries = Object.fromEntries(
            Object.entries(entries).filter(
              ([key, value]) =>
                value !== undefined &&
                (descriptor.shouldPersistEntry === undefined ||
                  descriptor.shouldPersistEntry(key, value, currentState)),
            ),
          );
          return descriptor.applyEntries(retained, persistedEntries);
        }, initialState),
    }));
  const hydrated = await hydrateStateRuntime({
    persistenceKey: input.persistenceKey,
    slices,
    storagePorts: {
      plain: input.plainStorage,
      protected: input.protectedStorage,
    },
    logger: input.logger.scope({
      moduleName: '@catering-v2s/kernel-base-state',
      layer: 'kernel',
      subsystem: 'state-runtime',
      component: input.runtimeName,
    }),
  });
  const store = createStateStore({
    reducers: createReducers(slices),
    preloadedState: hydrated.preloadedState,
    retainedSlices,
    environmentMode: input.environmentMode,
    storeEnhancers: input.storeEnhancers,
  });

  let autoFlushPromise: Promise<unknown> | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  const persistableSliceRefs = new Map<string, object | undefined>(
    slices.filter(slice => slice.persistence.length > 0).map(slice => [slice.name, store.getState()[slice.name]]),
  );
  const cancelDebounce = (): void => {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
  };
  const runFlush = (selection: AutoFlushSelection): void => {
    autoFlushPromise = hydrated.engine.flush(store.getState(), selection);
    autoFlushPromise.catch((error: unknown) => {
      input.logger.error({
        category: 'state.persistence',
        event: 'state.persistence.autoflush.unhandled',
        message: error instanceof Error ? error.message : 'state autoflush failed',
      });
    });
  };
  const scheduleAutoFlush = (): void => {
    const state = store.getState();
    const changedDescriptors = slices.flatMap(slice => {
      if (slice.persistence.length === 0) {
        return [];
      }
      const next = state[slice.name];
      const previous = persistableSliceRefs.get(slice.name);
      persistableSliceRefs.set(slice.name, next);
      return slice.persistence.filter(descriptor => persistenceDescriptorChanged(descriptor, previous, next));
    });
    const hasImmediateChange = changedDescriptors.some(entry => entry.flushMode !== 'debounced');
    const hasDebouncedChange = changedDescriptors.some(entry => entry.flushMode === 'debounced');
    if (!hasImmediateChange && !hasDebouncedChange) return;
    if (input.persistenceDebounceMs === 0) {
      cancelDebounce();
      runFlush('all');
      return;
    }

    // An immediate change must not flush a debounced descriptor that is still
    // inside its debounce window.  Keep an existing timer alive for that work.
    if (hasImmediateChange) {
      runFlush('immediate');
    }
    if (hasDebouncedChange) {
      if (debounceTimer === undefined) {
        debounceTimer = setTimeout(() => {
          debounceTimer = undefined;
          runFlush('all');
        }, input.persistenceDebounceMs);
      }
    }
  };
  store.subscribe(scheduleAutoFlush);

  const findSyncSlice = (sliceName: string): RegisteredStateRuntimeSlice | undefined =>
    slices.find(slice => slice.name === sliceName && slice.sync !== undefined);

  const runtime: StateRuntime = {
    getStore: () => store,
    getState: () => store.getState(),
    getSlices: () => input.slices,
    getPersistenceHealth: () => hydrated.engine.getHealth(),
    subscribePersistenceHealth: listener => hydrated.engine.subscribe(listener),
    flushPersistence: () => hydrated.engine.flush(store.getState()),
    getResetActor: () => ({
      handleResetCommand: () => {
        cancelDebounce();
        return hydrated.engine.reset(
          () => store.getState(),
          () => {
            store.dispatch({type: resetToOwnerInitialStateActionType});
          },
        );
      },
    }),
    createFullSyncPayload: (sliceName: string): StateSyncPayloadResult => {
      const slice = findSyncSlice(sliceName);
      if (slice === undefined || slice.sync === undefined) {
        input.logger.warn({
          category: 'state.sync',
          event: 'state.sync.payload.skipped',
          message: `sync slice is not registered: ${sliceName}`,
          data: {sliceName},
        });
        return {
          status: 'skipped',
          sliceName,
          reason: slices.some(candidate => candidate.name === sliceName) ? 'SYNC_NOT_DECLARED' : 'UNKNOWN_SLICE',
        };
      }
      const state = store.getState()[slice.name];
      if (state === undefined) {
        return {
          status: 'skipped',
          sliceName,
          reason: 'UNKNOWN_SLICE',
        };
      }
      return {
        status: 'ready',
        sliceName,
        payload: createFullSliceSyncPayload(slice.sync, state),
      };
    },
    applyAuthoritativeSync: (sliceName, payload): StateSyncApplyResult => {
      const slice = findSyncSlice(sliceName);
      if (slice === undefined || slice.sync === undefined) {
        input.logger.warn({
          category: 'state.sync',
          event: 'state.sync.apply.skipped',
          message: `sync slice is not registered: ${sliceName}`,
          data: {sliceName},
        });
        return {
          status: 'skipped',
          sliceName,
          reason: slices.some(candidate => candidate.name === sliceName) ? 'SYNC_NOT_DECLARED' : 'UNKNOWN_SLICE',
        };
      }
      const state = store.getState()[slice.name];
      if (state === undefined) {
        return {
          status: 'skipped',
          sliceName,
          reason: 'UNKNOWN_SLICE',
        };
      }
      const nextState = applySliceSyncDiff(slice.sync, state, payload);
      store.dispatch({
        type: applyAuthoritativeSyncActionType,
        payload: {
          sliceName,
          state: nextState,
        },
      });
      return {
        status: 'applied',
        sliceName,
        changed: nextState !== state,
      };
    },
  };
  return Object.freeze(runtime);
};
