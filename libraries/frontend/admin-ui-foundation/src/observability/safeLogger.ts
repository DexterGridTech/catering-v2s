export type FrontendLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

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
};

export type FrontendLogInput = Omit<FrontendLogEvent, 'eventId' | 'occurredAt' | 'sequence' | 'runId' | 'layer' | 'attempt' | 'level' | 'service' | 'owner' | 'instanceId'> & {
  service?: string;
  owner?: string;
  instanceId?: string;
  attempt?: number;
};

export type SafeLogger = {
  info: (event: FrontendLogInput) => void;
  warn: (event: FrontendLogInput) => void;
  error: (event: FrontendLogInput) => void;
  debug: (event: FrontendLogInput) => void;
  snapshot: () => readonly FrontendLogEvent[];
};

const blockedKeys = /password|passwordhash|otp|token|cookie|authorization|credential|requestbody|responsebody|rawpayload|mobile/i;

const safeId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'frontend-' + Date.now() + '-' + Math.random().toString(16).slice(2);
};

const clean = (event: FrontendLogEvent): FrontendLogEvent => {
  const copy = {...event};
  for (const key of Object.keys(copy)) {
    if (blockedKeys.test(key)) delete (copy as Record<string, unknown>)[key];
  }
  return copy;
};

export const createSafeLogger = (options?: {service?: string; enabled?: boolean; maxEvents?: number; runId?: string}): SafeLogger => {
  const service = options?.service ?? 'admin-ui';
  const enabled = options?.enabled ?? false;
  const maxEvents = options?.maxEvents ?? 100;
  const runId = options?.runId ?? 'unassigned';
  const events: FrontendLogEvent[] = [];
  const parentEventByOperationInstance = new Map<string, string>();
  let sequence = 0;

  const emit = (
    level: FrontendLogLevel,
    event: FrontendLogInput,
  ) => {
    if (!enabled && level === 'DEBUG') return;
    const operationKey = event.operationId && event.operationInstanceId
      ? `${event.operationId}:${event.operationInstanceId}`
      : undefined;
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
      parentEventId: event.parentEventId ?? (operationKey ? parentEventByOperationInstance.get(operationKey) : undefined),
    });
    if (operationKey) parentEventByOperationInstance.set(operationKey, safe.eventId);
    events.push(safe);
    if (events.length > maxEvents) events.shift();
    if (!enabled) return;
    const line = `[${service}] ${JSON.stringify(safe)}`;
    if (level === 'ERROR') console.error(line);
    else if (level === 'WARN') console.warn(line);
    else if (level === 'INFO') console.info(line);
    else console.debug(line);
  };

  return {
    info: (event) => emit('INFO', event),
    warn: (event) => emit('WARN', event),
    error: (event) => emit('ERROR', event),
    debug: (event) => emit('DEBUG', event),
    snapshot: () => [...events],
  };
};
