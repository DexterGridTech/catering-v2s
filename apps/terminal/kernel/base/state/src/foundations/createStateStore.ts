import {combineReducers, configureStore, type Reducer, type StoreEnhancer, type UnknownAction} from '@reduxjs/toolkit';
import type {EnvironmentMode} from '@catering-v2s/kernel-base-platform-ports';
import type {StateRoot} from '../types/runtime';

export const applyAuthoritativeSyncActionType = '@@catering-v2s/state/APPLY_AUTHORITATIVE_SYNC';
export const resetToOwnerInitialStateActionType = '@@catering-v2s/state/RESET_TO_OWNER_INITIAL_STATE';

export interface CreateStateStoreInput {
  readonly reducers: Readonly<Record<string, Reducer<object, UnknownAction>>>;
  readonly preloadedState: StateRoot;
  readonly retainedSlices: readonly Readonly<{
    name: string;
    retainPersistedState: (initialState: object, currentState: object) => object;
  }>[];
  readonly environmentMode: EnvironmentMode;
  readonly storeEnhancers?: readonly StoreEnhancer[];
}

export interface ApplyAuthoritativeSyncAction extends UnknownAction {
  readonly type: typeof applyAuthoritativeSyncActionType;
  readonly payload: {
    readonly sliceName: string;
    readonly state: object;
  };
}

const isApplyAuthoritativeSyncAction = (action: UnknownAction): action is ApplyAuthoritativeSyncAction =>
  action.type === applyAuthoritativeSyncActionType;

export const createStateStore = (input: CreateStateStoreInput) => {
  const combinedReducer = combineReducers(input.reducers);
  const rootReducer = (state: StateRoot | undefined, action: UnknownAction): StateRoot => {
    if (isApplyAuthoritativeSyncAction(action)) {
      return {
        ...(state ?? {}),
        [action.payload.sliceName]: action.payload.state,
      };
    }
    if (action.type === resetToOwnerInitialStateActionType) {
      const resetState = combinedReducer(undefined, action);
      const retainedState = Object.fromEntries(
        input.retainedSlices.flatMap(slice => {
          const currentSlice = state?.[slice.name];
          const initialSlice = resetState[slice.name];
          return currentSlice === undefined || initialSlice === undefined
            ? []
            : [[slice.name, slice.retainPersistedState(initialSlice, currentSlice)]];
        }),
      );
      return {...resetState, ...retainedState};
    }
    return combinedReducer(state, action);
  };

  return configureStore({
    reducer: rootReducer,
    preloadedState: input.preloadedState,
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        immutableCheck: input.environmentMode !== 'PROD',
        serializableCheck: input.environmentMode !== 'PROD',
      }),
    enhancers: getDefaultEnhancers =>
      input.storeEnhancers === undefined ? getDefaultEnhancers() : getDefaultEnhancers().concat(input.storeEnhancers),
  });
};
