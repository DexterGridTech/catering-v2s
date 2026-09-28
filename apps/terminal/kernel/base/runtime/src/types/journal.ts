import type {CommandId, NodeId, RequestId, RuntimeInstanceId, TimestampMs} from '@catering-v2s/kernel-base-contracts';
import type {ActorExecutionStatus, CommandAggregateStatus} from './execution';
import type {CommandVisibility} from './command';

type RuntimeJournalEventBase = Readonly<{
  occurredAt: TimestampMs;
  runtimeId: RuntimeInstanceId;
  localNodeId: NodeId;
  requestId: RequestId | null;
  commandId: CommandId | null;
  parentCommandId: CommandId | null;
  commandName: string | null;
  visibility: CommandVisibility;
}>;

type RuntimeJournalCommandStartedEvent = RuntimeJournalEventBase &
  Readonly<{
    kind: 'command.started';
    status: 'running';
  }>;

type RuntimeJournalCommandCompletedEvent = RuntimeJournalEventBase &
  Readonly<{
    kind: 'command.completed';
    /**
     * A healthy dispatch always completes with a terminal status.  If the
     * lifecycle emitter receives an inconsistent completion transition, retain
     * the observed `running`/unknown state instead of fabricating an `error`
     * entry in the diagnostic journal.
     */
    status: CommandAggregateStatus;
    actorStatuses: readonly Readonly<{
      actorKey: string;
      status: ActorExecutionStatus;
    }>[];
  }>;

type RuntimeJournalActorEvent = RuntimeJournalEventBase &
  Readonly<{
    kind: 'actor.running' | 'actor.completed' | 'actor.error' | 'actor.timed-out';
    actorKey: string;
    status: ActorExecutionStatus;
    errorKey: string | null;
  }>;

type RuntimeJournalLateActorEvent = RuntimeJournalEventBase &
  Readonly<{
    kind: 'actor.late-completed' | 'actor.late-error';
    actorKey: string;
    terminalStatus: 'completed' | 'error';
    errorKey: string | null;
  }>;

type RuntimeJournalResetReasonIgnoredEvent = RuntimeJournalEventBase &
  Readonly<{
    kind: 'reset.reason-ignored';
    rootCommandId: CommandId;
    keptReason: string | null;
    ignoredReason: string | null;
  }>;

type RuntimeJournalResetDuringResetEvent = RuntimeJournalEventBase &
  Readonly<{
    kind: 'reset.during-reset-ignored';
    rootCommandId: CommandId;
    ignoredCommandId: CommandId;
  }>;

type RuntimeJournalDepthRejectedEvent = RuntimeJournalEventBase &
  Readonly<{
    kind: 'command.depth-rejected';
    commandChain: readonly Readonly<{
      commandName: string;
      commandId: CommandId;
    }>[];
  }>;

type RuntimeJournalRoleEvent = RuntimeJournalEventBase &
  Readonly<{
    kind: 'role.change-requested' | 'role.changed';
    previousMode: 'MASTER' | 'SLAVE';
    nextMode: 'MASTER' | 'SLAVE';
  }>;

export type RuntimeJournalEvent =
  | RuntimeJournalCommandStartedEvent
  | RuntimeJournalCommandCompletedEvent
  | RuntimeJournalActorEvent
  | RuntimeJournalLateActorEvent
  | RuntimeJournalResetReasonIgnoredEvent
  | RuntimeJournalResetDuringResetEvent
  | RuntimeJournalDepthRejectedEvent
  | RuntimeJournalRoleEvent;

export type RuntimeLifecycleObserver = (event: RuntimeJournalEvent) => void;

export type RuntimeJournal = Readonly<{
  list: () => readonly RuntimeJournalEvent[];
  subscribe: (listener: RuntimeLifecycleObserver) => () => void;
}>;
