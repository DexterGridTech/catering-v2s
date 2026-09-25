export type FrontendLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
export type FrontendLogDiagnostic = Readonly<Record<string, string | number | boolean | null>>;

export type FrontendLogEvent = {
  eventId: string;
  occurredAt: string;
  sequence: number;
  runId: string;
  service: string;
  owner: string;
  instanceId: string;
  layer: 'frontend';
  event: string;
  phase: string;
  operationId?: string;
  /**
   * A fresh UI-workflow instance, for example one concrete Drawer opening.
   * It is deliberately distinct from the stable operationId so a later
   * opening of the same form never inherits the earlier session's parent.
   */
  operationInstanceId?: string;
  routeTemplate?: string;
  correlationId?: string;
  requestId?: string;
  traceId?: string;
  parentEventId?: string;
  attempt: number;
  outcome: string;
  level: FrontendLogLevel;
  status?: number | string;
  requiresSession?: boolean;
  errorCode?: string;
  durationMs?: number;
  /** Scalar diagnostic facts only; never put request/response payloads here. */
  diagnostic?: FrontendLogDiagnostic;
};

export type FrontendLogInput = Omit<
  FrontendLogEvent,
  'eventId' | 'occurredAt' | 'sequence' | 'runId' | 'layer' | 'attempt' | 'level' | 'service' | 'owner' | 'instanceId'
> & {
  service?: string;
  owner?: string;
  instanceId?: string;
  attempt?: number;
};

export type FrontendLogSink = (event: FrontendLogEvent) => void | Promise<void>;

export type SafeLogger = {
  info: (event: FrontendLogInput) => void;
  warn: (event: FrontendLogInput) => void;
  error: (event: FrontendLogInput) => void;
  debug: (event: FrontendLogInput) => void;
  snapshot: () => readonly FrontendLogEvent[];
};

const blockedKeys =
  /password|passwordhash|otp|token|cookie|authorization|credential|requestbody|responsebody|rawpayload|mobile|activationcode/i;

const safeId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'frontend-' + Date.now() + '-' + Math.random().toString(16).slice(2);
};

const clean = (event: FrontendLogEvent): FrontendLogEvent => {
  const copy = {...event};
  for (const key of Object.keys(copy)) {
    if (blockedKeys.test(key)) delete (copy as Record<string, unknown>)[key];
  }
  if (copy.diagnostic) {
    copy.diagnostic = Object.fromEntries(Object.entries(copy.diagnostic).filter(([key]) => !blockedKeys.test(key)));
  }
  return copy;
};

export const createBeaconLogSink = (endpoint?: string): FrontendLogSink | undefined => {
  const target = endpoint?.trim();
  if (!target) return undefined;
  return event => {
    const body = JSON.stringify(event);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        if (navigator.sendBeacon(target, new Blob([body], {type: 'application/json'}))) return;
      }
    } catch {
      /* telemetry must never change the user operation */
    }
    if (typeof fetch === 'function') {
      void fetch(target, {
        method: 'POST',
        credentials: 'include',
        headers: {'Content-Type': 'application/json'},
        body,
        keepalive: true,
      }).catch(() => undefined);
    }
  };
};

export const createSafeLogger = (options?: {
  service?: string;
  enabled?: boolean;
  maxEvents?: number;
  runId?: string;
  sink?: FrontendLogSink;
}): SafeLogger => {
  const service = options?.service ?? 'admin-ui';
  const enabled = options?.enabled ?? false;
  const maxEvents = options?.maxEvents ?? 100;
  const runId = options?.runId ?? 'unassigned';
  const events: FrontendLogEvent[] = [];
  const parentEventByOperationInstance = new Map<string, string>();
  let sequence = 0;

  const emit = (level: FrontendLogLevel, event: FrontendLogInput) => {
    if (!enabled && level === 'DEBUG') return;
    const operationKey =
      event.operationId && event.operationInstanceId ? `${event.operationId}:${event.operationInstanceId}` : undefined;
    const safe = clean({
      ...event,
      service,
      owner: event.owner ?? 'frontend-platform',
      instanceId: event.instanceId ?? 'browser',
      eventId: safeId(),
      occurredAt: new Date().toISOString(),
      sequence: ++sequence,
      runId,
      layer: 'frontend',
      attempt: event.attempt ?? 1,
      level,
      parentEventId:
        event.parentEventId ?? (operationKey ? parentEventByOperationInstance.get(operationKey) : undefined),
    });
    if (operationKey) parentEventByOperationInstance.set(operationKey, safe.eventId);
    events.push(safe);
    if (events.length > maxEvents) events.shift();
    if (options?.sink && (enabled || level === 'WARN' || level === 'ERROR')) {
      try {
        const result = options.sink(safe);
        if (result && typeof (result as Promise<void>).catch === 'function')
          void (result as Promise<void>).catch(() => undefined);
      } catch {
        /* telemetry must never change the user operation */
      }
    }
    if (!enabled) return;
    const line = `[${service}] ${JSON.stringify(safe)}`;
    if (level === 'ERROR') console.error(line);
    else if (level === 'WARN') console.warn(line);
    else if (level === 'INFO') console.info(line);
    else console.debug(line);
  };

  return {
    info: event => emit('INFO', event),
    warn: event => emit('WARN', event),
    error: event => emit('ERROR', event),
    debug: event => emit('DEBUG', event),
    snapshot: () => [...events],
  };
};
