export type TransportCancellationToken = Readonly<{
  readonly isCancelled: () => boolean
  readonly cancel: () => void
  readonly throwIfCancelled: () => void
}>

export type TransportAttemptMetric = Readonly<{
  readonly attempt: number
  readonly outcome: 'succeeded' | 'failed' | 'cancelled'
  readonly elapsedMs: number
}>

export type TransportRetryOptions<T> = Readonly<{
  readonly maxAttempts: number
  readonly delayMs: number | ((attempt: number) => number)
  readonly attempt: (input: Readonly<{readonly attempt: number; readonly token: TransportCancellationToken}>) => Promise<T>
  readonly token?: TransportCancellationToken
  readonly shouldRetry?: (error: unknown, attempt: number) => boolean
  readonly now?: () => number
  readonly sleep?: (delayMs: number, token: TransportCancellationToken) => Promise<void>
  readonly onAttempt?: (metric: TransportAttemptMetric) => void
}>

export const createTransportCancellationToken = (): TransportCancellationToken => {
  let cancelled = false
  return Object.freeze({
    isCancelled: (): boolean => cancelled,
    cancel: (): void => { cancelled = true },
    throwIfCancelled: (): void => {
      if (cancelled) throw new Error('transport attempt cancelled')
    },
  })
}

const defaultSleep = async (delayMs: number, token: TransportCancellationToken): Promise<void> => {
  if (delayMs <= 0) return
  await new Promise<void>(resolve => setTimeout(resolve, delayMs))
  token.throwIfCancelled()
}

export const runWithBoundedTransportRetry = async <T>(options: TransportRetryOptions<T>): Promise<T> => {
  if (!Number.isSafeInteger(options.maxAttempts) || options.maxAttempts < 1) {
    throw new Error('transport maxAttempts must be a positive integer')
  }
  const now = options.now ?? (() => Date.now())
  const sleep = options.sleep ?? defaultSleep
  const shouldRetry = options.shouldRetry ?? (() => true)
  const token = options.token ?? createTransportCancellationToken()
  let lastError: unknown

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    token.throwIfCancelled()
    const startedAt = now()
    try {
      const result = await options.attempt({attempt, token})
      options.onAttempt?.({attempt, outcome: 'succeeded', elapsedMs: Math.max(0, now() - startedAt)})
      token.throwIfCancelled()
      return result
    } catch (error) {
      lastError = error
      const cancelled = token.isCancelled()
      options.onAttempt?.({
        attempt,
        outcome: cancelled ? 'cancelled' : 'failed',
        elapsedMs: Math.max(0, now() - startedAt),
      })
      if (cancelled || attempt >= options.maxAttempts || !shouldRetry(error, attempt)) throw error
      const configuredDelay = typeof options.delayMs === 'function'
        ? options.delayMs(attempt)
        : options.delayMs
      await sleep(Math.max(0, configuredDelay), token)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('transport retry failed')
}
