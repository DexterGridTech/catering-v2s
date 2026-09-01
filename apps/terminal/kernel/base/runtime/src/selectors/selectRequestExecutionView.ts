import type {
  CommandId,
  RequestId,
} from '@catering-v2s/kernel-base-contracts'
import type {
  StateJsonValue,
  StateRoot,
  SyncValueEnvelope,
} from '@catering-v2s/kernel-base-state'
import {aggregateCommandStatus} from '../foundations/aggregateCommandStatus'
import {aggregateRequestStatus} from '../foundations/aggregateRequestStatus'
import {
  peerRequestLedgerSliceNameForMode,
  readLiveRequestEnvelope,
  requestLedgerSliceNameForMode,
  type RuntimeRequestLedgerState,
} from '../features/slices/requestLedger'
import {selectRuntimeInstanceMode} from './selectRuntimeInstanceMode'
import type {
  CommandExecutionObservation,
  LedgerError,
} from '../types/execution'
import type {RuntimeInstanceMode} from '../types/role'
import type {
  RequestExecutionCommandView,
  RequestExecutionRecord,
  RequestExecutionView,
} from '../types/requestLedger'

type RequestEnvelope = SyncValueEnvelope<RequestExecutionRecord>
type ObservationSource = 'local' | 'peer'

const NO_LOCAL_ENVELOPE = Object.freeze({sentinel: 'NO_LOCAL_ENVELOPE'})
const NO_PEER_ENVELOPE = Object.freeze({sentinel: 'NO_PEER_ENVELOPE'})

const viewCache = new WeakMap<object, WeakMap<object, Map<RuntimeInstanceMode, RequestExecutionView | null>>>()
const observationCache = new WeakMap<CommandExecutionObservation, Readonly<CommandExecutionObservation & {source: ObservationSource}>>()

const readLedgerState = (
  state: StateRoot,
  sliceName: string,
): RuntimeRequestLedgerState | undefined => {
  const slice = state[sliceName]
  return typeof slice === 'object' && slice !== null
    ? slice as RuntimeRequestLedgerState
    : undefined
}

const envelopeKey = (
  envelope: RequestEnvelope | undefined,
  fallback: object,
): object => envelope ?? fallback

const cachedObservation = (
  observation: CommandExecutionObservation,
  source: ObservationSource,
): Readonly<CommandExecutionObservation & {source: ObservationSource}> => {
  const cached = observationCache.get(observation)
  if (cached !== undefined && cached.source === source) return cached
  const next = Object.freeze({...observation, source})
  observationCache.set(observation, next)
  return next
}

const observationResults = (
  observations: readonly CommandExecutionObservation[],
): readonly StateJsonValue[] => Object.freeze(observations.flatMap(observation =>
  observation.actorResults.map(record => record.result),
))

const observationErrors = (
  observations: readonly CommandExecutionObservation[],
): readonly LedgerError[] => Object.freeze(observations.flatMap(observation =>
  observation.actorResults
    .filter((record): record is typeof record & {readonly error: LedgerError} => record.error !== null)
    .map(record => record.error),
))

const buildCommandView = (
  commandId: CommandId,
  local: CommandExecutionObservation | undefined,
  peer: CommandExecutionObservation | undefined,
): RequestExecutionCommandView => {
  const preferred = local ?? peer
  if (preferred === undefined) throw new Error(`request command is missing: ${commandId}`)
  const rawObservations = Object.freeze([
    ...(local === undefined ? [] : [local]),
    ...(peer === undefined ? [] : [peer]),
  ])
  const observations = Object.freeze([
    ...(local === undefined ? [] : [cachedObservation(local, 'local')]),
    ...(peer === undefined ? [] : [cachedObservation(peer, 'peer')]),
  ])
  return Object.freeze({
    commandId,
    commandName: preferred.commandName,
    parentCommandId: preferred.parentCommandId,
    displayMode: preferred.displayMode,
    timeSource: local === undefined ? 'peer' : 'local',
    status: aggregateCommandStatus(preferred),
    observations,
    results: observationResults(rawObservations),
    errors: observationErrors(rawObservations),
  })
}

const observationsByCommand = (
  record: RequestExecutionRecord | undefined,
): ReadonlyMap<string, CommandExecutionObservation> => {
  const result = new Map<string, CommandExecutionObservation>()
  for (const observation of record?.commands ?? []) {
    result.set(String(observation.commandId), observation)
  }
  return result
}

const buildView = (
  requestId: RequestId,
  mode: RuntimeInstanceMode,
  localEnvelope: RequestEnvelope | undefined,
  peerEnvelope: RequestEnvelope | undefined,
): RequestExecutionView | null => {
  if (localEnvelope === undefined && peerEnvelope === undefined) return null
  void mode
  const localRecord = localEnvelope?.value
  const peerRecord = peerEnvelope?.value
  const localCommands = observationsByCommand(localRecord)
  const peerCommands = observationsByCommand(peerRecord)
  const commandKeys = new Set<string>([
    ...localCommands.keys(),
    ...peerCommands.keys(),
  ])
  const commandViews = Object.freeze(
    [...commandKeys]
      .map(key => buildCommandView(
        key as CommandId,
        localCommands.get(key),
        peerCommands.get(key),
      ))
      .sort((left, right) => {
        const leftStartedAt = left.observations[0]?.startedAt ?? 0
        const rightStartedAt = right.observations[0]?.startedAt ?? 0
        return leftStartedAt - rightStartedAt || String(left.commandId).localeCompare(String(right.commandId))
      }),
  )
  const chosenRecord = localRecord ?? peerRecord
  const chosenEnvelope = localEnvelope ?? peerEnvelope
  if (chosenRecord === undefined || chosenEnvelope === undefined) return null
  const rootCommandIds = Object.freeze(commandViews
    .filter(command => command.parentCommandId === null)
    .map(command => command.commandId))
  return Object.freeze({
    requestId,
    status: aggregateRequestStatus(commandViews.map(command => command.status)),
    rootCommandIds,
    workspace: chosenRecord.workspace,
    startedAt: chosenRecord.startedAt,
    updatedAt: chosenEnvelope.updatedAt,
    timeSource: localRecord === undefined ? 'peer' : 'local',
    commands: commandViews,
  })
}

const readCache = (
  mode: RuntimeInstanceMode,
  localEnvelope: RequestEnvelope | undefined,
  peerEnvelope: RequestEnvelope | undefined,
): RequestExecutionView | null | undefined => {
  if (localEnvelope === undefined && peerEnvelope === undefined) return undefined
  const localKey = envelopeKey(localEnvelope, NO_LOCAL_ENVELOPE)
  const peerKey = envelopeKey(peerEnvelope, NO_PEER_ENVELOPE)
  const peerMap = viewCache.get(localKey)
  const modeMap = peerMap?.get(peerKey)
  return modeMap?.get(mode)
}

const writeCache = (
  mode: RuntimeInstanceMode,
  localEnvelope: RequestEnvelope | undefined,
  peerEnvelope: RequestEnvelope | undefined,
  view: RequestExecutionView | null,
): void => {
  if (localEnvelope === undefined && peerEnvelope === undefined) return
  const localKey = envelopeKey(localEnvelope, NO_LOCAL_ENVELOPE)
  const peerKey = envelopeKey(peerEnvelope, NO_PEER_ENVELOPE)
  let peerMap = viewCache.get(localKey)
  if (peerMap === undefined) {
    peerMap = new WeakMap()
    viewCache.set(localKey, peerMap)
  }
  let modeMap = peerMap.get(peerKey)
  if (modeMap === undefined) {
    modeMap = new Map()
    peerMap.set(peerKey, modeMap)
  }
  modeMap.set(mode, view)
}

export const selectRequestExecutionView = (
  state: StateRoot,
  requestId: RequestId,
): RequestExecutionView | null => {
  const mode = selectRuntimeInstanceMode(state)
  const localEnvelope = readLiveRequestEnvelope(
    readLedgerState(state, requestLedgerSliceNameForMode(mode)),
    requestId,
  )
  const peerEnvelope = readLiveRequestEnvelope(
    readLedgerState(state, peerRequestLedgerSliceNameForMode(mode)),
    requestId,
  )
  const cached = readCache(mode, localEnvelope, peerEnvelope)
  if (cached !== undefined) return cached
  const view = buildView(requestId, mode, localEnvelope, peerEnvelope)
  writeCache(mode, localEnvelope, peerEnvelope, view)
  return view
}
