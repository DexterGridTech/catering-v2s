import type {
  EnhancedStore,
  StoreEnhancer,
} from '@reduxjs/toolkit'
import type {
  EnvironmentMode,
  LoggerPort,
  StateStoragePort,
} from '@catering-v2s/kernel-base-platform-ports'
import type {
  PersistenceHealth,
  PersistenceHealthListener,
  PersistenceOperationResult,
} from './persistence'
import type {StateRuntimeSliceRegistration} from './slice'
import type {SyncStateDiff} from './sync'

export interface StateResetActor {
  handleResetCommand(): Promise<PersistenceOperationResult>
}

export type StateSyncSkipReason = 'UNKNOWN_SLICE' | 'SYNC_NOT_DECLARED'

export type StateSyncPayloadResult =
  | {
      readonly status: 'ready'
      readonly sliceName: string
      readonly payload: SyncStateDiff
    }
  | {
      readonly status: 'skipped'
      readonly sliceName: string
      readonly reason: StateSyncSkipReason
    }

export type StateSyncApplyResult =
  | {
      readonly status: 'applied'
      readonly sliceName: string
      readonly changed: boolean
    }
  | {
      readonly status: 'skipped'
      readonly sliceName: string
      readonly reason: StateSyncSkipReason
    }

export interface CreateStateRuntimeInput {
  readonly runtimeName: string
  readonly environmentMode: EnvironmentMode
  readonly slices: readonly StateRuntimeSliceRegistration[]
  readonly logger: LoggerPort
  readonly plainStorage: StateStoragePort
  readonly protectedStorage: StateStoragePort
  readonly persistenceKey: string
  readonly persistenceDebounceMs: number
  readonly storeEnhancers?: readonly StoreEnhancer[]
}

export interface StateRoot {
  readonly [sliceName: string]: object | undefined
}

export interface StateRuntime {
  getStore(): EnhancedStore<StateRoot>
  getState(): StateRoot
  getSlices(): readonly StateRuntimeSliceRegistration[]
  getPersistenceHealth(): PersistenceHealth
  subscribePersistenceHealth(listener: PersistenceHealthListener): () => void
  flushPersistence(): Promise<PersistenceOperationResult>
  getResetActor(): StateResetActor
  createFullSyncPayload(sliceName: string): StateSyncPayloadResult
  applyAuthoritativeSync(
    sliceName: string,
    payload: SyncStateDiff,
  ): StateSyncApplyResult
}
