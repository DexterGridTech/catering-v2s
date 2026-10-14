import type {UnknownAction} from '@reduxjs/toolkit';
import type {
  CreateStateRuntimeInput,
  StateRuntime,
  StateSyncApplyResult,
  StateSyncPayloadResult,
  StateSyncQualification,
} from '../types/runtime';
import type {RegisteredStateRuntimeSlice} from '../types/slice';
import {getRegisteredStateRuntimeSlice} from '../foundations/defineStateRuntimeSlice';
import {
  applyAuthoritativeSyncActionType,
  createStateStore,
  resetToOwnerInitialStateActionType,
} from './createStateStore';
import {hydrateStateRuntime} from './persistenceHydration';
import {applySliceSyncDiff, createFullSliceSyncPayload} from '../foundations/sync';
import {assertNonEmptyString} from '../foundations/assertNonEmptyString';
import {createPersistenceFlushScheduler} from './createPersistenceFlushScheduler';
import {stateParameters} from '../declarations/parameters';

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
  if (!stateParameters.persistenceDebounceMs.validate?.(input.persistenceDebounceMs)) {
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

  const flushScheduler = createPersistenceFlushScheduler({
    store,
    slices,
    engine: hydrated.engine,
    debounceMs: input.persistenceDebounceMs,
    logger: input.logger,
  });

  const findSyncSlice = (sliceName: string): RegisteredStateRuntimeSlice | undefined =>
    slices.find(slice => slice.name === sliceName && slice.sync !== undefined);
  const syncPayloadCache = new Map<
    string,
    Readonly<{sourceState: object; payload: Extract<StateSyncPayloadResult, {status: 'ready'}>['payload']}>
  >();
  const stateSyncQualifications = Object.freeze(
    slices
      .filter(slice => slice.sync !== undefined)
      .map(slice =>
        Object.freeze({
          name: slice.name,
          syncIntent: slice.syncIntent as StateSyncQualification['syncIntent'],
        }),
      ),
  );

  const runtime: StateRuntime = {
    dispose: () => {
      if (disposePromise !== undefined) return disposePromise;
      syncPayloadCache.clear();
      const persistence = hydrated.engine.dispose();
      const scheduler = flushScheduler.dispose();
      disposePromise = Promise.all([persistence, scheduler]).then(() => undefined);
      return disposePromise;
    },
    getStore: () => store,
    getState: () => store.getState(),
    getSlices: () => input.slices,
    getStateSyncQualifications: () => stateSyncQualifications,
    getPersistenceHealth: () => hydrated.engine.getHealth(),
    subscribePersistenceHealth: listener => hydrated.engine.subscribe(listener),
    flushPersistence: () => hydrated.engine.flush(store.getState()),
    getResetActor: () => ({
      handleResetCommand: () => {
        flushScheduler.cancel();
        return hydrated.engine.reset(
          () => store.getState(),
          () => {
            syncPayloadCache.clear();
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
      const cached = syncPayloadCache.get(sliceName);
      if (cached?.sourceState === state) {
        return {status: 'ready', sliceName, payload: cached.payload};
      }
      const payload = createFullSliceSyncPayload(slice.sync, state);
      syncPayloadCache.set(sliceName, {sourceState: state, payload});
      return {
        status: 'ready',
        sliceName,
        payload,
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
      if (nextState !== state) syncPayloadCache.delete(sliceName);
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

  let disposePromise: Promise<void> | undefined;
  return Object.freeze(runtime);
};
