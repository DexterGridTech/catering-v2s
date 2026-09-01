import type {
  StateRuntime,
  StateSyncApplyResult,
  StateSyncPayloadResult,
  SyncStateDiff,
} from '@catering-v2s/kernel-base-state'
import type {Runtime} from '../types/runtime'

type RuntimeStateSyncAccessor = Readonly<{
  createFullSyncPayload: (sliceName: string) => StateSyncPayloadResult
  applyAuthoritativeSync: (sliceName: string, payload: SyncStateDiff) => StateSyncApplyResult
}>

const accessors = new WeakMap<object, () => StateRuntime | undefined>()

export const registerRuntimeStateSyncForTest = (
  runtime: Runtime,
  getStateRuntime: () => StateRuntime | undefined,
): void => {
  accessors.set(runtime, getStateRuntime)
}

/** Test-only seam; deliberately absent from the package root exports. */
export const runtimeStateSyncForTest = (runtime: Runtime): RuntimeStateSyncAccessor => {
  const getStateRuntime = accessors.get(runtime)
  if (getStateRuntime === undefined) throw new Error('Runtime state sync test accessor is not registered')
  return Object.freeze({
    createFullSyncPayload: (sliceName: string): StateSyncPayloadResult => {
      const stateRuntime = getStateRuntime()
      if (stateRuntime === undefined) throw new Error('State runtime is not available')
      return stateRuntime.createFullSyncPayload(sliceName)
    },
    applyAuthoritativeSync: (sliceName: string, payload: SyncStateDiff): StateSyncApplyResult => {
      const stateRuntime = getStateRuntime()
      if (stateRuntime === undefined) throw new Error('State runtime is not available')
      return stateRuntime.applyAuthoritativeSync(sliceName, payload)
    },
  })
}
