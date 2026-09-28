import type {AppError} from './error';
import type {CommandId, NodeId, RequestId, SessionId, TimestampMs} from './ids';

export type CommandLifecycleStatus = 'registered' | 'dispatched' | 'accepted' | 'started' | 'completed' | 'error';

export type RequestLifecycleStatus = 'started' | 'completed' | 'partial-failed' | 'timed-out' | 'error';

export interface CommandResultPatch<TResult extends object = object> {
  readonly commandId: CommandId;
  readonly result: TResult;
  readonly patchedAt: TimestampMs;
}

export interface CommandResultSnapshot<TResult extends object = object> {
  readonly commandId: CommandId;
  readonly result?: TResult;
  readonly error?: AppError;
  readonly completedAt?: TimestampMs;
  readonly erroredAt?: TimestampMs;
}

export interface RequestCommandSnapshot<TResult extends object = object> {
  readonly commandId: CommandId;
  readonly parentCommandId?: CommandId;
  readonly ownerNodeId: NodeId;
  readonly sourceNodeId: NodeId;
  readonly targetNodeId: NodeId;
  readonly commandName: string;
  readonly status: CommandLifecycleStatus;
  readonly result?: TResult;
  readonly error?: AppError;
  readonly startedAt?: TimestampMs;
  readonly updatedAt: TimestampMs;
}

export interface RequestLifecycleSnapshot<TResult extends object = object> {
  readonly requestId: RequestId;
  readonly ownerNodeId: NodeId;
  readonly rootCommandId: CommandId;
  readonly sessionId?: SessionId;
  readonly status: RequestLifecycleStatus;
  readonly startedAt: TimestampMs;
  readonly updatedAt: TimestampMs;
  readonly commands: readonly RequestCommandSnapshot<TResult>[];
  readonly commandResults: readonly CommandResultSnapshot<TResult>[];
}
