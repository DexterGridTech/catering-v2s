import type {RequestId} from '@catering-v2s/kernel-base-contracts'
import type {StateRoot} from '@catering-v2s/kernel-base-state'
import {
  peerRequestLedgerSliceNameForMode,
  readLiveRequestEnvelope,
  requestLedgerSliceNameForMode,
} from '../features/slices/requestLedger'
import {selectRuntimeInstanceMode} from './selectRuntimeInstanceMode'
import {selectRequestExecutionView} from './selectRequestExecutionView'
import {readRequestLedgerState} from './readRequestLedgerState'
import type {RequestExecutionCommandView, RequestExecutionView} from '../types/requestLedger'
import {freezeList} from '../foundations/freezeList'

export const selectRequestExecutionViews = (
  state: StateRoot,
  workspace?: 'MAIN' | 'BRANCH',
): readonly RequestExecutionView[] => {
  const mode = selectRuntimeInstanceMode(state)
  const local = readRequestLedgerState(state, requestLedgerSliceNameForMode(mode))
  const peer = readRequestLedgerState(state, peerRequestLedgerSliceNameForMode(mode))
  const requestIds = new Set<RequestId>([
    ...Object.keys(local ?? {}).filter(key => readLiveRequestEnvelope(local, key as RequestId) !== undefined).map(key => key as RequestId),
    ...Object.keys(peer ?? {}).filter(key => readLiveRequestEnvelope(peer, key as RequestId) !== undefined).map(key => key as RequestId),
  ])
  return freezeList(
    [...requestIds]
      .map(requestId => selectRequestExecutionView(state, requestId))
      .filter((view): view is RequestExecutionView => view !== null)
      .filter(view => workspace === undefined || view.workspace === null || view.workspace === workspace)
      .sort((left, right) => right.updatedAt - left.updatedAt || String(left.requestId).localeCompare(String(right.requestId))),
  )
}

export const selectRequestExecutionCommands = (
  state: StateRoot,
  requestId: RequestId,
  displayMode?: 'PRIMARY' | 'SECONDARY',
): readonly RequestExecutionCommandView[] => {
  const view = selectRequestExecutionView(state, requestId)
  if (view === null) return freezeList([])
  return freezeList(view.commands.filter(command =>
    displayMode === undefined || command.displayMode === null || command.displayMode === displayMode,
  ))
}
