import type {CommandDispatchResult} from '@catering-v2s/kernel-base-runtime'

export type RequestOutcome = 'completed' | 'running' | 'business-failure' | 'system-failure'

const businessCategories = new Set(['AUTHENTICATION', 'BUSINESS', 'VALIDATION'])

export const classifyRequestResult = (result: CommandDispatchResult): RequestOutcome => {
  if (result.status === 'completed') return 'completed'
  if (result.status === 'running') return 'running'
  const errors = result.actorResults
    .map(actor => actor.error)
    .filter((error): error is NonNullable<typeof error> => error !== null)
  const hasSystemError = errors.some(error => !businessCategories.has(error.category))
  return !hasSystemError && errors.length > 0 ? 'business-failure' : 'system-failure'
}
