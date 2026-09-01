import {
  defineStateRuntimeSlice,
  type StateRuntimeSliceRegistration,
  type SyncRecordState,
  type StateJsonValue,
  type SyncValueEnvelope,
} from '@catering-v2s/kernel-base-state'
import type {RequestId, TimestampMs} from '@catering-v2s/kernel-base-contracts'
import type {RuntimeUnknownAction} from '../../types/runtime'
import type {RuntimeInstanceMode} from '../../types/role'
import type {RequestExecutionRecord} from '../../types/requestLedger'

export const runtimeRequestLedgerMasterSliceName = 'kernel.base.runtime.request-ledger.MASTER' as const
export const runtimeRequestLedgerSlaveSliceName = 'kernel.base.runtime.request-ledger.SLAVE' as const

export type RuntimeRequestLedgerSliceName =
  | typeof runtimeRequestLedgerMasterSliceName
  | typeof runtimeRequestLedgerSlaveSliceName

export type RuntimeRequestLedgerState = SyncRecordState<string, RequestExecutionRecord>

const upsertRequestLedgerRecordActionType = '@@catering-v2s/runtime/UPSERT_REQUEST_LEDGER_RECORD'
const deleteRequestLedgerRecordsActionType = '@@catering-v2s/runtime/DELETE_REQUEST_LEDGER_RECORDS'
const clearRequestLedgerSliceActionType = '@@catering-v2s/runtime/CLEAR_REQUEST_LEDGER_SLICE'

export const requestLedgerSliceNameForMode = (
  mode: RuntimeInstanceMode,
): RuntimeRequestLedgerSliceName => mode === 'MASTER'
  ? runtimeRequestLedgerMasterSliceName
  : runtimeRequestLedgerSlaveSliceName

export const peerRequestLedgerSliceNameForMode = (
  mode: RuntimeInstanceMode,
): RuntimeRequestLedgerSliceName => mode === 'MASTER'
  ? runtimeRequestLedgerSlaveSliceName
  : runtimeRequestLedgerMasterSliceName

export const createUpsertRequestLedgerRecordAction = (
  sliceName: RuntimeRequestLedgerSliceName,
  record: RequestExecutionRecord,
  updatedAt: TimestampMs,
): RuntimeUnknownAction & {
  readonly payload: Readonly<{
    sliceName: RuntimeRequestLedgerSliceName
    requestId: RequestId
    record: RequestExecutionRecord
    updatedAt: TimestampMs
  }>
} => ({
  type: upsertRequestLedgerRecordActionType,
  payload: {sliceName, requestId: record.requestId, record, updatedAt},
})

export const createDeleteRequestLedgerRecordsAction = (
  sliceName: RuntimeRequestLedgerSliceName,
  requestIds: readonly RequestId[],
): RuntimeUnknownAction & {
  readonly payload: Readonly<{
    sliceName: RuntimeRequestLedgerSliceName
    requestIds: readonly RequestId[]
  }>
} => ({
  type: deleteRequestLedgerRecordsActionType,
  payload: {sliceName, requestIds: Object.freeze([...requestIds])},
})

export const createClearRequestLedgerSliceAction = (
  sliceName: RuntimeRequestLedgerSliceName,
): RuntimeUnknownAction & {
  readonly payload: Readonly<{sliceName: RuntimeRequestLedgerSliceName}>
} => ({
  type: clearRequestLedgerSliceActionType,
  payload: {sliceName},
})

export const readLiveRequestEnvelope = (
  state: RuntimeRequestLedgerState | undefined,
  requestId: RequestId,
): SyncValueEnvelope<RequestExecutionRecord> | undefined => {
  const envelope = state?.[String(requestId)]
  if (envelope === undefined || envelope.tombstone === true) return undefined
  return envelope
}

const reducerFor = (
  sliceName: RuntimeRequestLedgerSliceName,
) => (
  state: RuntimeRequestLedgerState = {},
  action: RuntimeUnknownAction,
): RuntimeRequestLedgerState => {
  const payload = Reflect.get(action, 'payload')
  if (typeof payload !== 'object' || payload === null || Reflect.get(payload, 'sliceName') !== sliceName) {
    return state
  }
  if (action.type === upsertRequestLedgerRecordActionType) {
    const requestId = Reflect.get(payload, 'requestId')
    const record = Reflect.get(payload, 'record')
    const updatedAt = Reflect.get(payload, 'updatedAt')
    if (typeof requestId !== 'string' || typeof record !== 'object' || record === null || typeof updatedAt !== 'number') {
      return state
    }
    return {
      ...state,
      [requestId]: {value: record as RequestExecutionRecord, updatedAt},
    }
  }
  if (action.type === deleteRequestLedgerRecordsActionType) {
    const requestIds = Reflect.get(payload, 'requestIds')
    if (!Array.isArray(requestIds) || requestIds.length === 0) return state
    const next: Record<string, SyncValueEnvelope<RequestExecutionRecord>> = {}
    for (const [key, value] of Object.entries(state)) {
      if (value !== undefined && !requestIds.includes(key as RequestId)) next[key] = value
    }
    return next
  }
  if (action.type === clearRequestLedgerSliceActionType) {
    return {}
  }
  return state
}

const syncDescriptor = {
  kind: 'record' as const,
  getEntries: (state: RuntimeRequestLedgerState): RuntimeRequestLedgerState => state,
  applyEntries: (
    _state: RuntimeRequestLedgerState,
    entries: Readonly<Partial<Record<string, SyncValueEnvelope<StateJsonValue>>>>,
  ): RuntimeRequestLedgerState => ({...(entries as RuntimeRequestLedgerState)}),
}

export const runtimeRequestLedgerMasterSlice: StateRuntimeSliceRegistration = defineStateRuntimeSlice<RuntimeRequestLedgerState>({
  name: runtimeRequestLedgerMasterSliceName,
  reducer: reducerFor(runtimeRequestLedgerMasterSliceName),
  persistIntent: 'never',
  syncIntent: 'master-to-slave',
  sync: syncDescriptor,
})

export const runtimeRequestLedgerSlaveSlice: StateRuntimeSliceRegistration = defineStateRuntimeSlice<RuntimeRequestLedgerState>({
  name: runtimeRequestLedgerSlaveSliceName,
  reducer: reducerFor(runtimeRequestLedgerSlaveSliceName),
  persistIntent: 'never',
  syncIntent: 'slave-to-master',
  sync: syncDescriptor,
})
