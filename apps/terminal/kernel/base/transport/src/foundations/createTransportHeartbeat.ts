export type TransportHeartbeatSchedule = (intervalMs: number, callback: () => void) => () => void;

export type TransportHeartbeatOptions = Readonly<{
  readonly intervalMs: number;
  readonly timeoutMs: number;
  readonly sendPing: (sequence: number) => void | Promise<void>;
  readonly onTimeout: (sequence: number) => void;
  readonly now?: () => number;
  readonly schedule?: TransportHeartbeatSchedule;
}>;

export type TransportHeartbeatController = Readonly<{
  readonly start: () => void;
  readonly markPong: () => void;
  readonly stop: () => void;
  readonly state: () => 'idle' | 'running' | 'timed-out' | 'stopped';
  readonly sequence: () => number;
}>;

const defaultSchedule: TransportHeartbeatSchedule = (intervalMs, callback) => {
  const handle = setInterval(callback, intervalMs);
  return () => clearInterval(handle);
};

export const createTransportHeartbeat = (options: TransportHeartbeatOptions): TransportHeartbeatController => {
  if (!Number.isFinite(options.intervalMs) || options.intervalMs <= 0) {
    throw new Error('transport heartbeat interval must be positive');
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('transport heartbeat timeout must be positive');
  }

  const now = options.now ?? (() => Date.now());
  const schedule = options.schedule ?? defaultSchedule;
  let currentState: 'idle' | 'running' | 'timed-out' | 'stopped' = 'idle';
  let currentSequence = 0;
  let lastPongAt = 0;
  let cancelSchedule: (() => void) | undefined;

  const tick = (): void => {
    if (currentState !== 'running') return;
    const elapsedMs = now() - lastPongAt;
    if (elapsedMs > options.timeoutMs) {
      currentState = 'timed-out';
      cancelSchedule?.();
      cancelSchedule = undefined;
      options.onTimeout(currentSequence);
      return;
    }
    currentSequence += 1;
    void options.sendPing(currentSequence);
  };

  return Object.freeze({
    start: (): void => {
      if (currentState === 'running') return;
      currentState = 'running';
      currentSequence = 0;
      lastPongAt = now();
      cancelSchedule?.();
      cancelSchedule = schedule(options.intervalMs, tick);
    },
    markPong: (): void => {
      if (currentState === 'running') lastPongAt = now();
    },
    stop: (): void => {
      cancelSchedule?.();
      cancelSchedule = undefined;
      currentState = 'stopped';
    },
    state: (): 'idle' | 'running' | 'timed-out' | 'stopped' => currentState,
    sequence: (): number => currentSequence,
  });
};
