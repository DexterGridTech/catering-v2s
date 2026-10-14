import type {AutomationDriverServer} from './server.js';

type SafePush = Readonly<{
  readonly type: 'event';
  readonly requestId?: string;
  readonly sequence?: number;
  readonly kind?: string;
  readonly eventKind?: string;
  readonly commandId?: string;
  readonly actorKey?: string;
  readonly status?: string;
  readonly selectorName?: string;
  readonly subscriptionId?: string;
  readonly selectorValueState?: 'JSON' | 'NON_JSON';
  readonly selectorReason?: string;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const safeIdentifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9._:-]{1,160}$/u.test(value);

const safePushOf = (message: Readonly<{readonly type: string; readonly body: unknown}>): SafePush | undefined => {
  if (message.type !== 'event' || !isRecord(message.body)) return undefined;
  const body = message.body;
  const event = isRecord(body.event) ? body.event : undefined;
  const requestId = safeIdentifier(body.requestId) ? body.requestId : undefined;
  const kind = safeIdentifier(body.kind) ? body.kind : undefined;
  const eventKind = event !== undefined && safeIdentifier(event.kind) ? event.kind : undefined;
  const selectorName = safeIdentifier(body.selectorName) ? body.selectorName : undefined;
  const subscriptionId = safeIdentifier(body.subscriptionId) ? body.subscriptionId : undefined;
  const selectorValueState = body.valueState === 'JSON' || body.valueState === 'NON_JSON' ? body.valueState : undefined;
  const selectorReasonPrefix =
    selectorValueState === 'NON_JSON' && typeof body.reason === 'string'
      ? body.reason.match(/^([A-Z][A-Z0-9_]*)/u)?.[1]
      : undefined;
  const selectorReason =
    selectorReasonPrefix !== undefined && safeIdentifier(selectorReasonPrefix) ? selectorReasonPrefix : undefined;
  if (
    requestId === undefined && kind === undefined && eventKind === undefined && selectorName === undefined &&
    (subscriptionId === undefined || selectorValueState === undefined)
  ) return undefined;
  return Object.freeze({
    type: 'event',
    ...(requestId === undefined ? {} : {requestId}),
    ...(typeof body.sequence !== 'number' || !Number.isSafeInteger(body.sequence) || body.sequence < 0
      ? {}
      : {sequence: body.sequence}),
    ...(kind === undefined ? {} : {kind}),
    ...(eventKind === undefined ? {} : {eventKind}),
    ...(event !== undefined && safeIdentifier(event.commandId) ? {commandId: event.commandId} : {}),
    ...(event !== undefined && safeIdentifier(event.actorKey) ? {actorKey: event.actorKey} : {}),
    ...(event !== undefined && safeIdentifier(event.status) ? {status: event.status} : {}),
    ...(selectorName === undefined ? {} : {selectorName}),
    ...(subscriptionId === undefined ? {} : {subscriptionId}),
    ...(selectorValueState === undefined ? {} : {selectorValueState}),
    ...(selectorReason === undefined ? {} : {selectorReason}),
  });
};

const failureCodeOf = (error: unknown): string => {
  if (!(error instanceof Error)) return 'NON_ERROR_THROWN';
  const match = error.message.match(/^(TERMINAL_AUTOMATION_[A-Z0-9_]+)/u);
  if (match !== null) return match[1]!;
  return /^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(error.name) ? error.name : 'ERROR';
};

/** Captures only whitelisted journey metadata; never records selector values or action payloads. */
export const createJourneyFailureDiagnostics = (input: Readonly<{
  readonly server: AutomationDriverServer;
  readonly sessionId: string;
  readonly write?: (line: string) => void;
}>) => {
  let currentStep = 'journey.start';
  let lastKnownGoodStep: string | null = null;
  let lastPush: SafePush | null = null;
  const inProgressRequestIds = new Set<string>();
  const requestStartedAt = new Map<string, number>();
  const write = input.write ?? (line => process.stderr.write(`${line}\n`));
  const runId = process.env.TERMINAL_AUTOMATION_RUN_ID;
  const safeRunId = safeIdentifier(runId) ? runId : undefined;
  const emit = (event: string, fields: Readonly<Record<string, unknown>> = {}): void => {
    write(`TERMINAL_AUTOMATION_JOURNEY ${JSON.stringify({
      at: new Date().toISOString(),
      ...(safeRunId === undefined ? {} : {runId: safeRunId}),
      event,
      step: currentStep,
      ...fields,
    })}`);
  };
  const removeListener = input.server.onMessage(input.sessionId, message => {
    const push = safePushOf(message);
    if (push === undefined) return;
    lastPush = push;
    emit('runtime.push', {push});
  });

  return Object.freeze({
    markStep: (step: string): void => {
      if (
        currentStep !== 'journey.start' &&
        !currentStep.endsWith('.failed') &&
        !step.endsWith('.failed')
      ) {
        lastKnownGoodStep = currentStep;
        emit('step.completed', {step: currentStep});
      }
      currentStep = safeIdentifier(step) ? step : 'journey.step.unclassified';
      emit('step.started');
    },
    requestStarted: (requestId: string): void => {
      if (safeIdentifier(requestId)) {
        inProgressRequestIds.add(requestId);
        requestStartedAt.set(requestId, Date.now());
        emit('request.observer.started', {requestId});
      }
    },
    requestFinished: (requestId: string): void => {
      inProgressRequestIds.delete(requestId);
      const startedAt = requestStartedAt.get(requestId);
      requestStartedAt.delete(requestId);
      if (safeIdentifier(requestId)) {
        emit('request.observer.finished', {
          requestId,
          ...(startedAt === undefined ? {} : {elapsedMs: Math.max(0, Date.now() - startedAt)}),
        });
      }
    },
    report: (error: unknown): void => {
      const errorDetails = error instanceof Error
        ? {errorName: error.name, errorMessage: error.message, errorStack: error.stack ?? null}
        : {errorName: 'NON_ERROR_THROWN', errorMessage: String(error), errorStack: null};
      write(
        `TERMINAL_AUTOMATION_JOURNEY_FAILURE ${JSON.stringify({
          at: new Date().toISOString(),
          ...(safeRunId === undefined ? {} : {runId: safeRunId}),
          step: currentStep,
          lastKnownGoodStep,
          brokenBoundary: currentStep,
          failureCode: failureCodeOf(error),
          ...errorDetails,
          inProgressRequestIds: [...inProgressRequestIds],
          lastRelevantPush: lastPush,
          screenshot: 'NOT_SAVED_REDACTION_UNAVAILABLE',
        })}`,
      );
    },
    close: removeListener,
  });
};
