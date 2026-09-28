import type {CommandId, RequestId, RequestLifecycleStatus, TimestampMs} from '@catering-v2s/kernel-base-contracts';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import type {CommandAggregateStatus, CommandExecutionObservation, LedgerError} from './execution';

export type RequestExecutionRecord = Readonly<{
  requestId: RequestId;
  workspace: 'MAIN' | 'BRANCH' | null;
  startedAt: TimestampMs;
  commands: readonly CommandExecutionObservation[];
}>;

export type RequestExecutionCommandView = Readonly<{
  commandId: CommandId;
  commandName: string;
  parentCommandId: CommandId | null;
  displayMode: 'PRIMARY' | 'SECONDARY' | null;
  timeSource: 'local' | 'peer';
  status: CommandAggregateStatus;
  observations: readonly Readonly<
    CommandExecutionObservation & {
      source: 'local' | 'peer';
    }
  >[];
  results: readonly StateJsonValue[];
  errors: readonly LedgerError[];
}>;

export type RequestExecutionView = Readonly<{
  requestId: RequestId;
  status: RequestLifecycleStatus;
  rootCommandIds: readonly CommandId[];
  workspace: 'MAIN' | 'BRANCH' | null;
  startedAt: TimestampMs;
  updatedAt: TimestampMs;
  timeSource: 'local' | 'peer';
  commands: readonly RequestExecutionCommandView[];
}>;
