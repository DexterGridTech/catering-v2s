export type RuntimeResourceRegistry = Readonly<{
  register: (cleanup: () => void) => () => void
  release: () => number
}>

export const createRuntimeResourceRegistry = (): RuntimeResourceRegistry => {
  const cleanups = new Set<() => void>()
  const registry: RuntimeResourceRegistry = {
    register: (cleanup: () => void): (() => void) => {
      cleanups.add(cleanup)
      return () => { cleanups.delete(cleanup) }
    },
    release: (): number => {
      const pending = [...cleanups]
      cleanups.clear()
      for (const cleanup of pending) {
        try { cleanup() } catch { /* resource cleanup is best effort */ }
      }
      return pending.length
    },
  }
  return registry
}
