import type {Runtime} from '../types/runtime'
import type {RuntimeResourceRegistry} from './createRuntimeResourceRegistry'

const registries = new WeakMap<object, RuntimeResourceRegistry>()

export const registerRuntimeResourceAccessor = (
  runtime: Runtime,
  registry: RuntimeResourceRegistry,
): void => {
  registries.set(runtime, registry)
}

export const readRuntimeResourceRegistry = (
  runtime: Runtime,
): RuntimeResourceRegistry | undefined => registries.get(runtime)
