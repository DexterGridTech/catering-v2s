import {createSelector} from '@reduxjs/toolkit';
import type {CommandId, RequestId} from '@catering-v2s/kernel-base-contracts';
import type {StateJsonValue, StateRoot, SyncValueEnvelope} from '@catering-v2s/kernel-base-state';
import {aggregateCommandStatus} from '../foundations/aggregateCommandStatus';
import {aggregateRequestStatus} from '../foundations/aggregateRequestStatus';
import {
  peerRequestLedgerSliceNameForMode,
  readLiveRequestEnvelope,
  requestLedgerSliceNameForMode,
  type RuntimeRequestLedgerState,
} from '../features/slices/requestLedger';
import {selectRuntimeInstanceMode} from './selectRuntimeInstanceMode';
import {readRequestLedgerState} from './readRequestLedgerState';
import type {CommandExecutionObservation, LedgerError} from '../types/execution';
import type {RuntimeInstanceMode} from '../types/role';
import type {RequestExecutionCommandView, RequestExecutionRecord, RequestExecutionView} from '../types/requestLedger';
import {freezeList} from '../foundations/freezeList';

type RequestEnvelope = SyncValueEnvelope<RequestExecutionRecord>;
type ObservationSource = 'local' | 'peer';

const observationCache = new WeakMap<
  CommandExecutionObservation,
  Readonly<CommandExecutionObservation & {source: ObservationSource}>
>();

const cachedObservation = (
  observation: CommandExecutionObservation,
  source: ObservationSource,
): Readonly<CommandExecutionObservation & {source: ObservationSource}> => {
  const cached = observationCache.get(observation);
  if (cached !== undefined && cached.source === source) return cached;
  const next = Object.freeze({...observation, source});
  observationCache.set(observation, next);
  return next;
};

const observationResults = (observations: readonly CommandExecutionObservation[]): readonly StateJsonValue[] =>
  Object.freeze(observations.flatMap(observation => observation.actorResults.map(record => record.result)));

const observationErrors = (observations: readonly CommandExecutionObservation[]): readonly LedgerError[] =>
  Object.freeze(
    observations.flatMap(observation =>
      observation.actorResults
        .filter((record): record is typeof record & {readonly error: LedgerError} => record.error !== null)
        .map(record => record.error),
    ),
  );

const buildCommandView = (
  commandId: CommandId,
  local: CommandExecutionObservation | undefined,
  peer: CommandExecutionObservation | undefined,
): RequestExecutionCommandView => {
  const preferred = local ?? peer;
  if (preferred === undefined) throw new Error(`request command is missing: ${commandId}`);
  const rawObservations = freezeList([...(local === undefined ? [] : [local]), ...(peer === undefined ? [] : [peer])]);
  const observations = freezeList([
    ...(local === undefined ? [] : [cachedObservation(local, 'local')]),
    ...(peer === undefined ? [] : [cachedObservation(peer, 'peer')]),
  ]);
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
  });
};

const observationsByCommand = (
  record: RequestExecutionRecord | undefined,
): ReadonlyMap<string, CommandExecutionObservation> => {
  const result = new Map<string, CommandExecutionObservation>();
  for (const observation of record?.commands ?? []) {
    result.set(String(observation.commandId), observation);
  }
  return result;
};

const buildView = (
  input: Readonly<{
    requestId: RequestId;
    mode: RuntimeInstanceMode;
    localEnvelope: RequestEnvelope | undefined;
    peerEnvelope: RequestEnvelope | undefined;
  }>,
): RequestExecutionView | null => {
  if (input.localEnvelope === undefined && input.peerEnvelope === undefined) return null;
  void input.mode;
  const localRecord = input.localEnvelope?.value;
  const peerRecord = input.peerEnvelope?.value;
  const localCommands = observationsByCommand(localRecord);
  const peerCommands = observationsByCommand(peerRecord);
  const commandKeys = new Set<string>([...localCommands.keys(), ...peerCommands.keys()]);
  const commandViews = freezeList(
    [...commandKeys]
      .map(key => buildCommandView(key as CommandId, localCommands.get(key), peerCommands.get(key)))
      .sort((left, right) => {
        const leftStartedAt = left.observations[0]?.startedAt ?? 0;
        const rightStartedAt = right.observations[0]?.startedAt ?? 0;
        return leftStartedAt - rightStartedAt || String(left.commandId).localeCompare(String(right.commandId));
      }),
  );
  const chosenRecord = localRecord ?? peerRecord;
  const chosenEnvelope = input.localEnvelope ?? input.peerEnvelope;
  if (chosenRecord === undefined || chosenEnvelope === undefined) return null;
  const rootCommandIds = freezeList(
    commandViews.filter(command => command.parentCommandId === null).map(command => command.commandId),
  );
  return Object.freeze({
    requestId: input.requestId,
    status: aggregateRequestStatus(commandViews.map(command => command.status)),
    rootCommandIds,
    workspace: chosenRecord.workspace,
    startedAt: chosenRecord.startedAt,
    updatedAt: chosenEnvelope.updatedAt,
    timeSource: localRecord === undefined ? 'peer' : 'local',
    commands: commandViews,
  });
};

const selectRequestId = (_state: StateRoot, requestId: RequestId): RequestId => requestId;

const selectRequestMode = (state: StateRoot): RuntimeInstanceMode => selectRuntimeInstanceMode(state);

const selectLocalRequestEnvelope = (state: StateRoot, requestId: RequestId): RequestEnvelope | undefined => {
  const mode = selectRequestMode(state);
  return readLiveRequestEnvelope(readRequestLedgerState(state, requestLedgerSliceNameForMode(mode)), requestId);
};

const selectPeerRequestEnvelope = (state: StateRoot, requestId: RequestId): RequestEnvelope | undefined => {
  const mode = selectRequestMode(state);
  return readLiveRequestEnvelope(readRequestLedgerState(state, peerRequestLedgerSliceNameForMode(mode)), requestId);
};

const selectRequestExecutionViewMemoized = createSelector(
  [selectRequestId, selectRequestMode, selectLocalRequestEnvelope, selectPeerRequestEnvelope],
  (
    ...selectorArgs: [RequestId, RuntimeInstanceMode, RequestEnvelope | undefined, RequestEnvelope | undefined]
  ): RequestExecutionView | null => {
    const [requestId, mode, localEnvelope, peerEnvelope] = selectorArgs;
    return buildView({requestId, mode, localEnvelope, peerEnvelope});
  },
);

export const selectRequestExecutionView = (state: StateRoot, requestId: RequestId): RequestExecutionView | null => {
  return selectRequestExecutionViewMemoized(state, requestId);
};
