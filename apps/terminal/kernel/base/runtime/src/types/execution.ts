import type {AppError, CommandId, TimestampMs} from '@catering-v2s/kernel-base-contracts';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import type {CommandTarget} from './command';

export type LedgerError = Readonly<{
  key: string;
  code: string;
  message: string;
  category: AppError['category'];
  severity: AppError['severity'];
  /** Only bounded, non-sensitive machine-readable details survive ledger normalization. */
  details?: Readonly<Record<string, string | number | boolean | null>>;
}>;

export type ActorExecutionStatus = 'running' | 'completed' | 'error' | 'timed-out';

export type ActorExecutionRecord = Readonly<{
  actorKey: string;
  status: ActorExecutionStatus;
  startedAt: TimestampMs;
  completedAt: TimestampMs | null;
  result: StateJsonValue;
  error: LedgerError | null;
}>;

export type CommandAggregateStatus = 'running' | 'completed' | 'partial-failed' | 'timed-out' | 'error';

export type CommandExecutionObservation = Readonly<{
  commandId: CommandId;
  parentCommandId: CommandId | null;
  commandName: string;
  target: CommandTarget;
  allowNoActor: boolean;
  actorResults: readonly ActorExecutionRecord[];
  startedAt: TimestampMs;
  completedAt: TimestampMs | null;
  displayMode: 'PRIMARY' | 'SECONDARY' | null;
}>;

export type CommandDispatchResult = Readonly<{
  requestId: import('@catering-v2s/kernel-base-contracts').RequestId | null;
  commandId: CommandId;
  status: CommandAggregateStatus;
  actorResults: readonly ActorExecutionRecord[];
}>;
