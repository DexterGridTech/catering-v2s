type StateStore = Readonly<{
  subscribe: (listener: () => void) => () => void
}>

type RegisterResource = (cleanup: () => void) => () => void

export const createStateSubscription = (
  store: StateStore,
  listener: () => void,
  registerResource?: RegisterResource,
): (() => void) => {
  const unsubscribe = store.subscribe(listener)
  const unregister = registerResource?.(unsubscribe)
  let active = true
  return () => {
    if (!active) return
    active = false
    unsubscribe()
    unregister?.()
  }
}
