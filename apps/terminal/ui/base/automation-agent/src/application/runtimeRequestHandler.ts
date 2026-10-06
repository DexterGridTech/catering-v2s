import {asyncScheduler, Subject, throttleTime} from 'rxjs';
import {dequal} from 'dequal';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {
  AutomationCommandDispatchBodySchema,
  AutomationRuntimeInfoBodySchema,
  AutomationSelectorReadBodySchema,
  AutomationSelectorSubscribeBodySchema,
  AutomationSelectorUnsubscribeBodySchema,
} from '../foundations/protocol';
import type {CommandDispatchOptions, RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import type {AutomationEnvelope} from '../foundations/protocol';

const maxSubscriptions = 128;
const maxCommandObservers = 32;
const maxMessageBytes = 1_048_576;
const selectorBudgetMs = 8;
const commandObservationMs = 120_000;

export type RuntimeRequestReply = Readonly<{
  protocolVersion: 1;
  sessionId: string;
  messageId: string;
  type: 'response' | 'event' | 'error';
  body: unknown;
}>;

type Send = (reply: RuntimeRequestReply) => void;
type SelectorValue =
  Readonly<{valueState: 'JSON'; value: unknown}> | Readonly<{valueState: 'NON_JSON'; reason: string}>;
type SelectorSubscription = {
  readonly request: AutomationEnvelope;
  readonly send: Send;
  readonly selectorName: string;
  readonly argsTuple: readonly unknown[];
  previous?: SelectorValue;
  active: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).every(key => keys.includes(key));

const actorObservationKey = (commandId: unknown, actorKey: string): string =>
  `${String(commandId ?? '')}\u0000${actorKey}`;

const utf8Bytes = (value: string): number => {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) {
      bytes += 1;
      if (bytes > maxMessageBytes) return bytes;
      continue;
    }
    if (code <= 0x7ff) {
      bytes += 2;
      if (bytes > maxMessageBytes) return bytes;
      continue;
    }
    if (code < 0xd800 || code > 0xdbff || index + 1 >= value.length) {
      bytes += 3;
      if (bytes > maxMessageBytes) return bytes;
      continue;
    }
    const next = value.charCodeAt(index + 1);
    if (next < 0xdc00 || next > 0xdfff) {
      bytes += 3;
      if (bytes > maxMessageBytes) return bytes;
      continue;
    }
    bytes += 4;
    index += 1;
    if (bytes > maxMessageBytes) return bytes;
  }
  return bytes;
};

const arrayNonJsonReason = (value: readonly unknown[], seen: WeakSet<object>, path: string): string | undefined => {
  const extraKeys = Reflect.ownKeys(value).filter(
    key => {
      if (typeof key !== 'string') return true;
      if (key === 'length') return false;
      if (!/^(0|[1-9]\d*)$/.test(key)) return true;
      const index = Number(key);
      return !Number.isSafeInteger(index) || index >= value.length || index >= 0xffff_ffff;
    },
  );
  if (extraKeys.length > 0) {
    const keyKinds = new Set(extraKeys.map(key => typeof key));
    const keyKind = keyKinds.size === 1 ? [...keyKinds][0] : 'mixed';
    return `ARRAY_EXTRA_FIELD@${path}:${String(keyKind)}:${extraKeys.length}`;
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return 'ARRAY_HOLE';
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !descriptor.enumerable) return 'NON_ENUMERABLE_FIELD';
    if (!('value' in descriptor)) return 'ACCESSOR_FIELD';
    const reason = nonJsonReason(descriptor.value, seen, `${path}[${index}]`);
    if (reason !== undefined) return reason;
  }
  return undefined;
};

const objectNonJsonReason = (value: object, seen: WeakSet<object>, path: string): string | undefined => {
  let propertyIndex = 0;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') return 'SYMBOL_KEY';
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable) return 'NON_ENUMERABLE_FIELD';
    if (!('value' in descriptor)) return 'ACCESSOR_FIELD';
    const reason = nonJsonReason(descriptor.value, seen, `${path}.p${propertyIndex}`);
    if (reason !== undefined) return reason;
    propertyIndex += 1;
  }
  return undefined;
};

const nonJsonReason = (value: unknown, seen: WeakSet<object>, path = 'root'): string | undefined => {
  if (value === undefined) return 'UNDEFINED';
  if (typeof value === 'function') return 'FUNCTION';
  if (typeof value === 'symbol') return 'SYMBOL';
  if (typeof value === 'bigint') return 'BIGINT';
  if (typeof value === 'number' && !Number.isFinite(value)) return 'NON_FINITE_NUMBER';
  if (value === null || typeof value !== 'object') return undefined;
  if (value instanceof Date) return 'DATE';
  if (value instanceof Map) return 'MAP';
  if (value instanceof Set) return 'SET';
  if (seen.has(value)) return 'CYCLE';
  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value) && prototype !== Array.prototype) return 'NON_PLAIN_ARRAY';
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return 'NON_PLAIN_OBJECT';
  seen.add(value);
  const reason = Array.isArray(value) ? arrayNonJsonReason(value, seen, path) : objectNonJsonReason(value, seen, path);
  if (reason !== undefined) return reason;
  seen.delete(value);
  return undefined;
};

const evaluateValue = (context: RuntimeModuleContext, name: string, argsTuple: readonly unknown[]): SelectorValue => {
  const evaluationStarted = performance.now();
  const value = context.evaluateSelector(name, argsTuple);
  if (performance.now() - evaluationStarted > selectorBudgetMs) {
    throw new Error('RUNTIME_SELECTOR_EVALUATION_BUDGET_EXCEEDED');
  }
  const serializationStarted = performance.now();
  const reason = nonJsonReason(value, new WeakSet<object>());
  if (performance.now() - serializationStarted > selectorBudgetMs) {
    throw new Error('RUNTIME_SELECTOR_SERIALIZATION_BUDGET_EXCEEDED');
  }
  if (reason !== undefined) return Object.freeze({valueState: 'NON_JSON', reason});
  const result = Object.freeze({valueState: 'JSON' as const, value});
  const encoded = JSON.stringify(result);
  if (performance.now() - serializationStarted > selectorBudgetMs) {
    throw new Error('RUNTIME_SELECTOR_SERIALIZATION_BUDGET_EXCEEDED');
  }
  if (utf8Bytes(encoded) > maxMessageBytes) throw new Error('RUNTIME_SELECTOR_MESSAGE_LIMIT_EXCEEDED');
  return result;
};

const selectorBody = (body: unknown): Readonly<{selectorName: string; argsTuple: readonly unknown[]}> | undefined => {
  const parsed = AutomationSelectorReadBodySchema.safeParse(body);
  return parsed.success ? parsed.data : undefined;
};

const routeContext = (value: unknown): CommandDispatchOptions['routeContext'] | undefined => {
  if (value === undefined || value === null) return value;
  if (!isRecord(value) || !hasOnlyKeys(value, ['workspace', 'instanceMode', 'displayMode'])) return undefined;
  if (value.workspace !== undefined && value.workspace !== 'MAIN' && value.workspace !== 'BRANCH') return undefined;
  if (value.instanceMode !== undefined && value.instanceMode !== 'MASTER' && value.instanceMode !== 'SLAVE')
    return undefined;
  if (value.displayMode !== undefined && value.displayMode !== 'PRIMARY' && value.displayMode !== 'SECONDARY')
    return undefined;
  return value as CommandDispatchOptions['routeContext'];
};

const commandBody = (
  body: unknown,
):
  | Readonly<{
      commandName: string;
      payload: unknown;
      requestId?: string;
      options: Pick<CommandDispatchOptions, 'routeContext' | 'routeIntent' | 'target'>;
    }>
  | undefined => {
  const parsed = AutomationCommandDispatchBodySchema.safeParse(body);
  if (!parsed.success) return undefined;
  const value = parsed.data;
  const parsedRouteContext = routeContext(value.routeContext);
  if (value.routeContext !== undefined && parsedRouteContext === undefined) return undefined;
  return {
    commandName: value.commandName,
    payload: value.payload,
    ...(typeof value.requestId === 'string' ? {requestId: value.requestId} : {}),
    options: {
      ...(parsedRouteContext !== undefined ? {routeContext: parsedRouteContext} : {}),
      ...(value.routeIntent !== undefined ? {routeIntent: value.routeIntent} : {}),
      ...(value.target !== undefined ? {target: value.target} : {}),
    },
  };
};

export const createRuntimeRequestHandler = (
  input: Readonly<{
    sessionId: string;
    context: RuntimeModuleContext;
    deviceIdentity?: Readonly<{available: boolean; deviceId: string | null}>;
  }>,
) => {
  const selectorSubscriptions = new Map<string, SelectorSubscription>();
  const trackedRequests = new Set<() => void>();
  const stateChanges = new Subject<void>();
  const stateFlush = stateChanges.pipe(throttleTime(50, asyncScheduler, {leading: true, trailing: true}));
  let releaseStateListener: (() => void) | undefined;
  let sequence = 0;
  let disposed = false;

  const reply = (
    options: Readonly<{request: AutomationEnvelope; send: Send; type: RuntimeRequestReply['type']; body: unknown}>,
  ): number | undefined => {
    const {request, send, type, body} = options;
    const response: RuntimeRequestReply = {
      protocolVersion: 1,
      sessionId: input.sessionId,
      messageId:
        type === 'response' || type === 'error' ? `reply-${request.messageId}` : `runtime-event-${++sequence}`,
      type,
      body,
    };
    let encoded: string;
    try {
      encoded = JSON.stringify(response);
    } catch {
      encoded = '';
    }
    const payloadBytes = encoded.length === 0 ? 0 : utf8Bytes(encoded);
    if (payloadBytes > maxMessageBytes || encoded.length === 0) {
      const failure: RuntimeRequestReply = {
        protocolVersion: 1,
        sessionId: input.sessionId,
        messageId: `runtime-event-${++sequence}`,
        type: 'error',
        body: Object.freeze({requestMessageId: request.messageId, code: 'RESOURCE_LIMIT'}),
      };
      send(failure);
      return undefined;
    }
    send(response);
    return payloadBytes;
  };

  const reportPerformance = (
    measurement: Readonly<{
      send: Send;
      phase: 'selector.read' | 'selector.flush';
      elapsedMs: number;
      payloadBytes: number;
      activeSubscriptions: number;
    }>,
  ): void => {
    const {send, phase, elapsedMs, payloadBytes, activeSubscriptions} = measurement;
    send({
      protocolVersion: 1,
      sessionId: input.sessionId,
      messageId: `runtime-event-${++sequence}`,
      type: 'event',
      body: Object.freeze({
        kind: 'performance.measurement',
        phase,
        elapsedMs,
        payloadBytes,
        activeSubscriptions,
      }),
    });
  };

  const fail = (
    failure: Readonly<{
      request: AutomationEnvelope;
      send: Send;
      code: string;
      detail?: Readonly<Record<string, string>>;
    }>,
  ): void => {
    const {request, send, code, detail} = failure;
    reply({request, send, type: 'error', body: Object.freeze({requestMessageId: request.messageId, code, ...detail})});
  };

  const success = (response: Readonly<{request: AutomationEnvelope; send: Send; result: unknown}>): void => {
    const {request, send, result} = response;
    reply({request, send, type: 'response', body: Object.freeze({requestMessageId: request.messageId, result})});
  };

  const removeSubscription = (subscriptionId: string): void => {
    const subscription = selectorSubscriptions.get(subscriptionId);
    if (subscription === undefined) return;
    subscription.active = false;
    selectorSubscriptions.delete(subscriptionId);
    if (selectorSubscriptions.size === 0) {
      releaseStateListener?.();
      releaseStateListener = undefined;
    }
  };

  const emitSubscriptionValue = (subscriptionId: string, subscription: SelectorSubscription): number => {
    if (!subscription.active || disposed) return 0;
    const value = evaluate({
      request: subscription.request,
      send: subscription.send,
      name: subscription.selectorName,
      args: subscription.argsTuple,
    });
    if (value === undefined) {
      removeSubscription(subscriptionId);
      return 0;
    }
    if (subscription.previous !== undefined && dequal(subscription.previous, value)) return 0;
    const sentBytes = reply({
      request: subscription.request,
      send: subscription.send,
      type: 'event',
      body: Object.freeze({
        subscriptionId,
        sequence: ++sequence,
        valueState: value.valueState,
        ...(value.valueState === 'JSON' ? {value: value.value} : {reason: value.reason}),
      }),
    });
    if (sentBytes === undefined) {
      removeSubscription(subscriptionId);
      return 0;
    }
    subscription.previous = value;
    return sentBytes;
  };

  const flushSubscriptions = (): void => {
    if (disposed || selectorSubscriptions.size === 0) return;
    const flushStarted = performance.now();
    const subscriptions = [...selectorSubscriptions];
    const activeSubscriptions = subscriptions.length;
    const sendMeasurement = subscriptions[0]?.[1].send;
    let payloadBytes = 0;
    for (const [subscriptionId, subscription] of subscriptions) {
      payloadBytes += emitSubscriptionValue(subscriptionId, subscription);
    }
    if (sendMeasurement !== undefined) {
      reportPerformance({
        send: sendMeasurement,
        phase: 'selector.flush',
        elapsedMs: performance.now() - flushStarted,
        payloadBytes,
        activeSubscriptions,
      });
    }
  };
  const stateFlushSubscription = stateFlush.subscribe({next: flushSubscriptions});

  const evaluate = (
    query: Readonly<{request: AutomationEnvelope; send: Send; name: string; args: readonly unknown[]}>,
  ): SelectorValue | undefined => {
    const {request, send, name, args} = query;
    try {
      const value = evaluateValue(input.context, name, args);
      return value;
    } catch (error) {
      const code =
        error instanceof Error && error.message.startsWith('RUNTIME_SELECTOR_ARGUMENT_')
          ? 'SELECTOR_ARGUMENT_INVALID'
          : error instanceof Error && error.message.startsWith('RUNTIME_SELECTOR_NOT_REGISTERED:')
            ? 'SELECTOR_NOT_REGISTERED'
            : error instanceof Error && error.message.startsWith('RUNTIME_SELECTOR_EVALUATION_BUDGET_EXCEEDED')
              ? 'SELECTOR_EVALUATION_BUDGET_EXCEEDED'
              : error instanceof Error && error.message.startsWith('RUNTIME_SELECTOR_SERIALIZATION_BUDGET_EXCEEDED')
                ? 'SELECTOR_SERIALIZATION_BUDGET_EXCEEDED'
                : error instanceof Error && error.message.startsWith('RUNTIME_SELECTOR_MESSAGE_LIMIT_EXCEEDED')
                  ? 'RESOURCE_LIMIT'
                  : 'SELECTOR_EVALUATION_FAILED';
      fail({request, send, code});
      return undefined;
    }
  };

  const handle = (request: AutomationEnvelope, send: Send): void => {
    if (disposed || request.sessionId !== input.sessionId) {
      fail({request: request, send: send, code: disposed ? 'SESSION_CLOSED' : 'SESSION_MISMATCH'});
      return;
    }
    if (request.type === 'runtime.info') {
      if (request.body !== null && !AutomationRuntimeInfoBodySchema.safeParse(request.body).success) {
        fail({request: request, send: send, code: 'INVALID_RUNTIME_REQUEST'});
        return;
      }
      success({
        request: request,
        send: send,
        result: {
          runtimeId: input.context.runtimeId,
          localNodeId: input.context.localNodeId,
          descriptors: input.context.descriptors,
          deviceIdentity: input.deviceIdentity ?? Object.freeze({available: false, deviceId: null}),
        },
      });
      return;
    }
    if (request.type === 'selector.read') {
      const parsed = selectorBody(request.body);
      if (parsed === undefined) return fail({request: request, send: send, code: 'INVALID_SELECTOR_REQUEST'});
      const queryStarted = performance.now();
      const result = evaluate({request: request, send: send, name: parsed.selectorName, args: parsed.argsTuple});
      if (result !== undefined) {
        const payloadBytes =
          reply({
            request: request,
            send: send,
            type: 'response',
            body: Object.freeze({requestMessageId: request.messageId, result}),
          }) ?? 0;
        reportPerformance({
          send: send,
          phase: 'selector.read',
          elapsedMs: performance.now() - queryStarted,
          payloadBytes: payloadBytes,
          activeSubscriptions: selectorSubscriptions.size,
        });
      }
      return;
    }
    if (request.type === 'selector.subscribe') {
      const parsed = AutomationSelectorSubscribeBodySchema.safeParse(request.body);
      if (!parsed.success) return fail({request: request, send: send, code: 'INVALID_SELECTOR_REQUEST'});
      if (selectorSubscriptions.has(parsed.data.subscriptionId))
        return fail({request: request, send: send, code: 'DUPLICATE_SUBSCRIPTION'});
      if (selectorSubscriptions.size >= maxSubscriptions)
        return fail({request: request, send: send, code: 'RESOURCE_LIMIT'});
      const subscription: SelectorSubscription = {
        request,
        send,
        selectorName: parsed.data.selectorName,
        argsTuple: parsed.data.argsTuple,
        active: true,
      };
      selectorSubscriptions.set(parsed.data.subscriptionId, subscription);
      if (releaseStateListener === undefined) {
        releaseStateListener = input.context.subscribeState(() => stateChanges.next());
      }
      success({request: request, send: send, result: {subscriptionId: parsed.data.subscriptionId, accepted: true}});
      emitSubscriptionValue(parsed.data.subscriptionId, subscription);
      return;
    }
    if (request.type === 'selector.unsubscribe') {
      const parsed = AutomationSelectorUnsubscribeBodySchema.safeParse(request.body);
      if (!parsed.success) return fail({request: request, send: send, code: 'INVALID_SELECTOR_REQUEST'});
      if (!selectorSubscriptions.has(parsed.data.subscriptionId))
        return fail({request: request, send: send, code: 'SUBSCRIPTION_NOT_FOUND'});
      removeSubscription(parsed.data.subscriptionId);
      success({request: request, send: send, result: {subscriptionId: parsed.data.subscriptionId, released: true}});
      return;
    }
    if (request.type === 'command.dispatch') {
      const parsed = commandBody(request.body);
      if (parsed === undefined) return fail({request: request, send: send, code: 'INVALID_COMMAND_REQUEST'});
      if (trackedRequests.size >= maxCommandObservers)
        return fail({request: request, send: send, code: 'RESOURCE_LIMIT'});
      const requestId = parsed.requestId ?? createRequestId();
      let dispatchSettled = false;
      let trackingStopped = false;
      const timedOutActors = new Set<string>();
      const lateTerminalActors = new Set<string>();
      let timer: ReturnType<typeof setTimeout>;
      let unsubscribeJournal = (): void => undefined;
      const stopTracking = (): void => {
        if (trackingStopped) return;
        trackingStopped = true;
        clearTimeout(timer);
        unsubscribeJournal();
        trackedRequests.delete(stopTracking);
      };
      const maybeStopTracking = (): void => {
        if (dispatchSettled && timedOutActors.size === 0) stopTracking();
      };
      unsubscribeJournal = input.context.journal.subscribe(event => {
        if (String(event.requestId ?? '') !== requestId) return;
        if (event.kind === 'actor.timed-out') timedOutActors.add(actorObservationKey(event.commandId, event.actorKey));
        if (event.kind === 'actor.late-completed' || event.kind === 'actor.late-error') {
          const actorKey = actorObservationKey(event.commandId, event.actorKey);
          timedOutActors.delete(actorKey);
          lateTerminalActors.add(actorKey);
        }
        reply({
          request: request,
          send: send,
          type: 'event',
          body: Object.freeze({requestId, sequence: ++sequence, event}),
        });
        maybeStopTracking();
      });
      timer = setTimeout(() => {
        reply({
          request: request,
          send: send,
          type: 'event',
          body: Object.freeze({
            requestId,
            sequence: ++sequence,
            kind: 'TRACKING_EXPIRED',
            lastOutcome: 'UNKNOWN',
          }),
        });
        stopTracking();
      }, commandObservationMs);
      trackedRequests.add(stopTracking);
      success({request: request, send: send, result: {requestId, accepted: true}});
      void input.context
        .dispatchCommand(parsed.commandName, parsed.payload as never, {
          ...parsed.options,
          requestId: requestId as never,
          lateOutcome: () => undefined,
          lateResultTtlMs: commandObservationMs,
        })
        .then(result => {
          reply({
            request: request,
            send: send,
            type: 'event',
            body: Object.freeze({requestId, sequence: ++sequence, kind: 'command.result', result}),
          });
          dispatchSettled = true;
          for (const actor of result.actorResults) {
            const actorKey = actorObservationKey(result.commandId, actor.actorKey);
            if (actor.status === 'timed-out' && !lateTerminalActors.has(actorKey)) timedOutActors.add(actorKey);
            else timedOutActors.delete(actorKey);
          }
          maybeStopTracking();
        })
        .catch(error => {
          const code = isRecord(error) && typeof error.code === 'string' ? error.code : 'GENERIC_DISPATCH_ERROR';
          fail({request: request, send: send, code: 'COMMAND_DISPATCH_REJECTED', detail: {detail: code}});
          stopTracking();
        });
      return;
    }
    fail({request: request, send: send, code: 'UNSUPPORTED_METHOD'});
  };

  return Object.freeze({
    handle,
    dispose: (): void => {
      if (disposed) return;
      disposed = true;
      releaseStateListener?.();
      releaseStateListener = undefined;
      stateFlushSubscription.unsubscribe();
      stateChanges.complete();
      for (const subscription of selectorSubscriptions.values()) subscription.active = false;
      selectorSubscriptions.clear();
      for (const stop of [...trackedRequests]) stop();
    },
    get activeSelectorSubscriptionCount(): number {
      return selectorSubscriptions.size;
    },
    get activeRequestTrackingCount(): number {
      return trackedRequests.size;
    },
  });
};
