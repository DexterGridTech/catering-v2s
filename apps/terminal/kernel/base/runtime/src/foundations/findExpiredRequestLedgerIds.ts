import {
  nowTimestampMs,
  type RequestId,
  type RequestLifecycleStatus,
} from '@catering-v2s/kernel-base-contracts'
import type {StateRoot} from '@catering-v2s/kernel-base-state'
import {selectRequestExecutionView} from '../selectors/selectRequestExecutionView'
import {selectRuntimeInstanceMode} from '../selectors/selectRuntimeInstanceMode'
import {readRequestLedgerState} from '../selectors/readRequestLedgerState'
import {
  readLiveRequestEnvelope,
  requestLedgerSliceNameForMode,
} from '../features/slices/requestLedger'
import type {RuntimeLimits} from '../types/limits'
import type {RuntimeInstanceMode} from '../types/role'

const isTerminalStatus = (status: RequestLifecycleStatus): boolean => {
  switch (status) {
    case 'started':
      return false
    case 'completed':
    case 'partial-failed':
    case 'timed-out':
    case 'error':
      return true
    default: {
      const exhaustive: never = status
      throw new Error(`Unknown request lifecycle status: ${exhaustive}`)
    }
  }
}

/**
 * Computes deletable ids from one runtime-owned ledger partition.  The peer
 * partition is consulted only through the merged view that supplies lifecycle
 * status; it is never scanned or mutated here.
 */
export const findExpiredRequestLedgerIds = (
  state: StateRoot,
  mode: RuntimeInstanceMode = selectRuntimeInstanceMode(state),
  limits: Pick<RuntimeLimits, 'requestRetentionMs' | 'requestMaxResidenceMs'>,
  now: number = nowTimestampMs(),
): readonly RequestId[] => {
  const ledger = readRequestLedgerState(state, requestLedgerSliceNameForMode(mode))
  const requestIds: RequestId[] = []

  for (const requestId of Object.keys(ledger ?? {})) {
    const envelope = readLiveRequestEnvelope(ledger, requestId as RequestId)
    if (envelope === undefined) continue
    const age = now - envelope.updatedAt
    const view = selectRequestExecutionView(state, requestId as RequestId)
    const terminalByMergedView = view !== null && isTerminalStatus(view.status)
    const expiredByRetention = terminalByMergedView && age > limits.requestRetentionMs
    const expiredByResidence = age > limits.requestMaxResidenceMs
    if (expiredByRetention || expiredByResidence) requestIds.push(requestId as RequestId)
  }

  return Object.freeze(requestIds)
}
