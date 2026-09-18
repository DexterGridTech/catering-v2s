export type TransportLimiter = Readonly<{
  readonly run: <T>(operation: () => Promise<T> | T) => Promise<T>
}>

export type TransportLimiterOptions = Readonly<{
  readonly maxConcurrent: number
  readonly minStartIntervalMs?: number
  readonly now?: () => number
}> 

type PendingOperation = Readonly<{
  readonly operation: () => Promise<unknown> | unknown
  readonly resolve: (value: unknown) => void
  readonly reject: (error: unknown) => void
}>

export const createTransportLimiter = (options: TransportLimiterOptions): TransportLimiter => {
  if (!Number.isSafeInteger(options.maxConcurrent) || options.maxConcurrent < 1) {
    throw new Error('transport maxConcurrent must be a positive integer')
  }
  const now = options.now ?? (() => Date.now())
  const minStartIntervalMs = Math.max(0, options.minStartIntervalMs ?? 0)
  const queue: PendingOperation[] = []
  let active = 0
  let nextStartAt = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const schedule = (): void => {
    if (timer !== undefined) return
    const waitMs = Math.max(0, nextStartAt - now())
    if (waitMs === 0) {
      pump()
      return
    }
    timer = setTimeout(() => {
      timer = undefined
      pump()
    }, waitMs)
  }

  const pump = (): void => {
    if (active >= options.maxConcurrent || queue.length === 0) return
    if (now() < nextStartAt) {
      schedule()
      return
    }
    const pending = queue.shift()
    if (pending === undefined) return
    active += 1
    nextStartAt = now() + minStartIntervalMs
    Promise.resolve()
      .then(pending.operation)
      .then(pending.resolve, pending.reject)
      .finally(() => {
        active -= 1
        pump()
      })
    pump()
  }

  return Object.freeze({
    run: <T>(operation: () => Promise<T> | T): Promise<T> => new Promise<T>((resolve, reject) => {
      queue.push({operation, resolve: value => resolve(value as T), reject})
      pump()
    }),
  })
}
