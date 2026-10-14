import type {RemoteControlScreen} from '@catering-v2s/kernel-base-platform-ports';

export type RemoteControlSessionFence = Readonly<{
  sessionId: string;
  mode: 'MASTER' | 'SLAVE';
  bindingGeneration: number | null;
  targetSessionId: string | null;
  signalUrl: string;
  signalConfigIdentity: string;
  paired: boolean;
  peerModuleName: string | null;
  peerNodeId: string | null;
  peerConnectionId: string | null;
}>;

type ActiveGesture = Readonly<{gestureId: string; downSequence: number}>;

export type RemoteControlSession = {
  activePortSessionId: string | null;
  transmitSequence: number;
  readonlySequences: Map<string, number>;
  gestures: Map<RemoteControlScreen, ActiveGesture>;
  leaseTimer: ReturnType<typeof setTimeout> | undefined;
  renewalTimer: ReturnType<typeof setTimeout> | undefined;
  watchdogTimer: ReturnType<typeof setTimeout> | undefined;
  lastKeepaliveAt: number;
  activeFence: RemoteControlSessionFence | null;
  startReservation: RemoteControlSessionFence | null;
  stoppingSessionId: string | null;
  serializeMutation<TResult>(operation: () => Promise<TResult>): Promise<TResult>;
  clearTimers(): void;
};

export const createRemoteControlSession = (): RemoteControlSession => {
  let mutationTail: Promise<void> = Promise.resolve();
  const session: RemoteControlSession = {
    activePortSessionId: null,
    transmitSequence: 0,
    readonlySequences: new Map(),
    gestures: new Map(),
    leaseTimer: undefined,
    renewalTimer: undefined,
    watchdogTimer: undefined,
    lastKeepaliveAt: 0,
    activeFence: null,
    startReservation: null,
    stoppingSessionId: null,
    serializeMutation: async <TResult>(operation: () => Promise<TResult>): Promise<TResult> => {
      const previous = mutationTail;
      let release!: () => void;
      mutationTail = new Promise<void>(resolve => {
        release = resolve;
      });
      return previous.then(async () => {
        try {
          return await operation();
        } finally {
          release();
        }
      });
    },
    clearTimers: () => {
      if (session.leaseTimer !== undefined) clearTimeout(session.leaseTimer);
      if (session.renewalTimer !== undefined) clearTimeout(session.renewalTimer);
      if (session.watchdogTimer !== undefined) clearTimeout(session.watchdogTimer);
      session.leaseTimer = undefined;
      session.renewalTimer = undefined;
      session.watchdogTimer = undefined;
    },
  };
  return session;
};
