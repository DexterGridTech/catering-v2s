import type {StateRuntime} from '@catering-v2s/kernel-base-state'
import type {Runtime} from '../types/runtime'

type RuntimeStateSyncAccessor = () => StateRuntime | undefined

const accessors = new WeakMap<object, RuntimeStateSyncAccessor>()

export const registerRuntimeStateSyncAccessor = (
  runtime: Runtime,
  getStateRuntime: RuntimeStateSyncAccessor,
): void => {
  accessors.set(runtime, getStateRuntime)
}

export const readRuntimeStateSyncAccessor = (
  runtime: Runtime,
): RuntimeStateSyncAccessor | undefined => accessors.get(runtime)
