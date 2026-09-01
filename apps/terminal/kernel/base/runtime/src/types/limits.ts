export type RuntimeLimits = Readonly<{
  maxCommandDepth: number
  maxCommandsPerRequest: number
  maxActorResultBytes: number
  requestRetentionMs: number
  requestMaxResidenceMs: number
  maxJournalRecords: number
}>

export const defaultMaxCommandDepth = 32 as const
export const defaultMaxCommandsPerRequest = 256 as const
export const defaultMaxActorResultBytes = 262_144 as const
export const defaultRequestRetentionMs = 1_800_000 as const
export const defaultRequestMaxResidenceMs = 7_200_000 as const
export const defaultMaxJournalRecords = 1_000 as const
export const defaultCommandTimeoutMs = 60_000 as const

export const defaultRuntimeLimits: RuntimeLimits = Object.freeze({
  maxCommandDepth: defaultMaxCommandDepth,
  maxCommandsPerRequest: defaultMaxCommandsPerRequest,
  maxActorResultBytes: defaultMaxActorResultBytes,
  requestRetentionMs: defaultRequestRetentionMs,
  requestMaxResidenceMs: defaultRequestMaxResidenceMs,
  maxJournalRecords: defaultMaxJournalRecords,
})
