import type {ActorExecutionRecord} from '@catering-v2s/kernel-base-runtime';
import type {TerminalTransportConnection} from '../../../types/client';

export type LateRemoteResult = {
  readonly records: Map<string, ActorExecutionRecord>;
  expectedActorKeys: Set<string> | null;
  unknownPersisted: boolean;
  reported: boolean;
};

export type TerminalDataClientSession = {
  connection: TerminalTransportConnection | undefined;
  unsubscribeConnection: (() => void) | undefined;
  heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  heartbeatDeadline: ReturnType<typeof setTimeout> | undefined;
  sessionReady: boolean;
  activeSessionId: string | null;
  connectionGeneration: number;
  expectedHeartbeatTimeoutMs: number;
  currentConfigRevision: number | null;
  remoteOperationEpoch: number;
  readonly sentAtBySequence: Map<number, number>;
  readonly lateRemoteResults: Map<string, LateRemoteResult>;
};

export const createTerminalDataClientSession = (): TerminalDataClientSession => ({
  connection: undefined,
  unsubscribeConnection: undefined,
  heartbeatTimer: undefined,
  heartbeatDeadline: undefined,
  sessionReady: false,
  activeSessionId: null,
  connectionGeneration: 0,
  expectedHeartbeatTimeoutMs: 0,
  currentConfigRevision: null,
  remoteOperationEpoch: 0,
  sentAtBySequence: new Map(),
  lateRemoteResults: new Map(),
});
