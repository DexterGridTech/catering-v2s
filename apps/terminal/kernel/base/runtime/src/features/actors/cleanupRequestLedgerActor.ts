import {
  nowTimestampMs,
  type RequestId,
  type RequestLifecycleStatus,
} from '@catering-v2s/kernel-base-contracts'
import {onCommand, defineActor} from '../../foundations/defineActor'
import {moduleName} from '../../moduleName'
import {cleanupRequestLedgerCommand} from '../commands/cleanupRequestLedger'
import {
  createDeleteRequestLedgerRecordsAction,
  readLiveRequestEnvelope,
  requestLedgerSliceNameForMode,
  type RuntimeRequestLedgerState,
} from '../slices/requestLedger'
import {selectRequestExecutionView} from '../../selectors/selectRequestExecutionView'
import {selectRuntimeInstanceMode} from '../../selectors/selectRuntimeInstanceMode'
import type {ActorDefinition} from '../../types/actor'
import type {RuntimeLimits} from '../../types/limits'

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
 * The cleanup actor owns the deletion decision.  Reducers only apply the
 * explicit delete action, and timers only dispatch this command.
 */
export const createCleanupRequestLedgerActor = (
  getLimits: () => Pick<RuntimeLimits, 'requestRetentionMs' | 'requestMaxResidenceMs'>,
): ActorDefinition => defineActor(moduleName, 'request-ledger-cleanup', [
  onCommand(cleanupRequestLedgerCommand, context => {
    const mode = selectRuntimeInstanceMode(context.getState())
    const sliceName = requestLedgerSliceNameForMode(mode)
    const localState = context.getState()[sliceName]
    const typedState = typeof localState === 'object' && localState !== null
      ? localState as RuntimeRequestLedgerState
      : undefined
    const now = nowTimestampMs()
    const limits = getLimits()
    const requestIds: RequestId[] = []

    for (const requestId of Object.keys(typedState ?? {})) {
      const envelope = readLiveRequestEnvelope(typedState, requestId as RequestId)
      if (envelope === undefined) continue
      const age = now - envelope.updatedAt
      const view = selectRequestExecutionView(context.getState(), requestId as RequestId)
      const terminalByMergedView = view !== null && isTerminalStatus(view.status)
      const expiredByRetention = terminalByMergedView && age > limits.requestRetentionMs
      const expiredByResidence = age > limits.requestMaxResidenceMs
      if (expiredByRetention || expiredByResidence) requestIds.push(requestId as RequestId)
    }

    if (requestIds.length > 0) {
      context.dispatchAction(createDeleteRequestLedgerRecordsAction(sliceName, requestIds))
    }
    return Object.freeze({deletedRequestIds: Object.freeze(requestIds)})
  }),
])
