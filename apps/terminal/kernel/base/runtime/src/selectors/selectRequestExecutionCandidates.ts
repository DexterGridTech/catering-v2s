import type {CommandExecutionObservation} from '../types/execution';
import type {RequestExecutionCandidate, RequestExecutionRecord} from '../types/requestLedger';
import {defineStateSelector} from '../foundations/defineStateSelector';
import {moduleName} from '../moduleName';
import type {RequestId} from '@catering-v2s/kernel-base-contracts';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {
  peerRequestLedgerSliceNameForMode,
  readLiveRequestEnvelope,
  requestLedgerSliceNameForMode,
} from '../features/slices/requestLedger';
import {readRequestLedgerState} from './readRequestLedgerState';
import {selectRuntimeInstanceMode} from './selectRuntimeInstanceMode';
import {freezeList} from '../foundations/freezeList';

const hasMatchingRootCommand = (
  local: RequestExecutionRecord | undefined,
  peer: RequestExecutionRecord | undefined,
  commandName: string,
  displayMode: 'PRIMARY' | 'SECONDARY',
): boolean => {
  const commands = new Map<string, CommandExecutionObservation>();
  for (const command of local?.commands ?? []) commands.set(String(command.commandId), command);
  for (const command of peer?.commands ?? []) {
    if (!commands.has(String(command.commandId))) commands.set(String(command.commandId), command);
  }
  return [...commands.values()].some(
    command =>
      command.parentCommandId === null &&
      command.commandName === commandName &&
      (command.displayMode === null || command.displayMode === displayMode),
  );
};

const selectRequestExecutionCandidatesImplementation = (
  state: StateRoot,
  workspace: 'MAIN' | 'BRANCH',
  commandName: string,
  displayMode: 'PRIMARY' | 'SECONDARY',
): readonly RequestExecutionCandidate[] => {
  const mode = selectRuntimeInstanceMode(state);
  const local = readRequestLedgerState(state, requestLedgerSliceNameForMode(mode));
  const peer = readRequestLedgerState(state, peerRequestLedgerSliceNameForMode(mode));
  const requestIds = new Set<RequestId>([
    ...Object.keys(local ?? {})
      .filter(key => readLiveRequestEnvelope(local, key as RequestId) !== undefined)
      .map(key => key as RequestId),
    ...Object.keys(peer ?? {})
      .filter(key => readLiveRequestEnvelope(peer, key as RequestId) !== undefined)
      .map(key => key as RequestId),
  ]);
  const candidates: RequestExecutionCandidate[] = [];
  for (const requestId of requestIds) {
    const localRecord = readLiveRequestEnvelope(local, requestId)?.value;
    const peerRecord = readLiveRequestEnvelope(peer, requestId)?.value;
    const chosen = localRecord ?? peerRecord;
    if (chosen === undefined || (chosen.workspace !== null && chosen.workspace !== workspace)) continue;
    if (!hasMatchingRootCommand(localRecord, peerRecord, commandName, displayMode)) continue;
    candidates.push(Object.freeze({requestId, workspace: chosen.workspace}));
  }
  candidates.sort((left, right) => String(left.requestId).localeCompare(String(right.requestId)));
  return freezeList(candidates);
};

export const selectRequestExecutionCandidates = defineStateSelector(moduleName, 'selectRequestExecutionCandidates', {
  parameters: [
    {kind: 'enum', values: ['MAIN', 'BRANCH']},
    {kind: 'string'},
    {kind: 'enum', values: ['PRIMARY', 'SECONDARY']},
  ],
  selector: selectRequestExecutionCandidatesImplementation,
});
