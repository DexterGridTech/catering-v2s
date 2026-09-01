import type {Runtime} from '../types/runtime'

type RuntimeTestResourceRegistry = Readonly<{
  register: (cleanup: () => void) => () => void
  release: () => number
}>

const registries = new WeakMap<object, RuntimeTestResourceRegistry>()

export const createRuntimeTestResourceRegistry = (): RuntimeTestResourceRegistry => {
  const cleanups = new Set<() => void>()
  const registry: RuntimeTestResourceRegistry = {
    register: (cleanup: () => void): (() => void) => {
      cleanups.add(cleanup)
      return () => { cleanups.delete(cleanup) }
    },
    release: (): number => {
      const pending = [...cleanups]
      cleanups.clear()
      for (const cleanup of pending) {
        try { cleanup() } catch { /* test cleanup is best effort */ }
      }
      return pending.length
    },
  }
  return registry
}

export const registerRuntimeTestResources = (
  runtime: Runtime,
  registry: RuntimeTestResourceRegistry,
): void => {
  registries.set(runtime, registry)
}

/** Test-only cleanup; deliberately absent from the package root exports. */
export const releaseRuntimeForTest = (runtime: Runtime): number =>
  registries.get(runtime)?.release() ?? 0

