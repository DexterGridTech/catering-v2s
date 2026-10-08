import {describe, expect, it, vi} from 'vitest';
import type {RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import {createRuntimeRequestHandler} from '../src/application/runtimeRequestHandler';
import {createControlRequestHandler} from '../src/application/controlRequestHandler';
import {createAutomationNodeRegistry} from '../src/foundations/registry/createAutomationNodeRegistry';
import type {AutomationEnvelope} from '../src/foundations/protocol';

const request = (type: AutomationEnvelope['type'], body: unknown, messageId: string): AutomationEnvelope => ({
  protocolVersion: 1,
  sessionId: 'session-1',
  messageId,
  type,
  body,
});

const makeContext = () => {
  const journalListeners = new Set<(event: never) => void>();
  const stateListeners = new Set<() => void>();
  let dispatch: ((name: string, payload: unknown, options: unknown) => Promise<unknown>) | undefined;
  let selectedValue: unknown = {value: 1};
  const context = {
    runtimeId: 'runtime-1',
    localNodeId: 'node-1',
    descriptors: [{moduleName: 'example', selectorNames: ['example.value']}],
    journal: {
      list: () => [],
      subscribe: (listener: (event: never) => void) => {
        journalListeners.add(listener);
        return () => journalListeners.delete(listener);
      },
    },
    evaluateSelector: (name: string, args: readonly unknown[]) => {
      if (name !== 'example.value') throw new Error('RUNTIME_SELECTOR_NOT_REGISTERED:example.value');
      return args[0] === 'mutable' ? selectedValue : {value: args[0] ?? 1};
    },
    subscribeState: (listener: () => void) => {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
    dispatchCommand: (name: string, payload: unknown, options: unknown) =>
      dispatch?.(name, payload, options) ?? Promise.resolve({status: 'completed'}),
  };
  return {
    context: context as unknown as RuntimeModuleContext,
    journalListeners,
    notifyState: () => {
      for (const listener of [...stateListeners]) listener();
    },
    stateListenerCount: () => stateListeners.size,
    setDispatch: (value: typeof dispatch) => {
      dispatch = value;
    },
    setSelectedValue: (value: unknown) => {
      selectedValue = value;
    },
  };
};

describe('Runtime automation request handler', () => {
  it('uses disjoint event message IDs across control and Runtime handlers in one session', () => {
    const fixture = makeContext();
    const runtime = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const control = createControlRequestHandler({sessionId: 'session-1', registry: createAutomationNodeRegistry()});
    const runtimeReplies: unknown[] = [];
    const controlReplies: unknown[] = [];

    control.handle(request('controls.query', {filter: {}}, 'control-query'), value => controlReplies.push(value));
    runtime.handle(request('selector.read', {selectorName: 'example.value', argsTuple: []}, 'runtime-read'), value =>
      runtimeReplies.push(value),
    );

    const eventIds = [...controlReplies, ...runtimeReplies]
      .filter(
        (reply): reply is {type: string; messageId: string} =>
          typeof reply === 'object' && reply !== null && 'type' in reply && 'messageId' in reply,
      )
      .filter(reply => reply.type === 'event')
      .map(reply => reply.messageId);
    expect(eventIds).toHaveLength(2);
    expect(new Set(eventIds).size).toBe(2);
    expect(eventIds).toEqual(
      expect.arrayContaining([expect.stringMatching(/^controls-event-/), expect.stringMatching(/^runtime-event-/)]),
    );
    control.dispose();
    runtime.dispose();
  });

  it('returns the composition-resolved app DevicePort identity in authenticated runtime info', () => {
    const fixture = makeContext();
    const handler = createRuntimeRequestHandler({
      sessionId: 'session-1',
      context: fixture.context,
      deviceIdentity: {available: true, deviceId: 'app-scoped-device-id'},
    });
    const send = vi.fn();

    handler.handle(request('runtime.info', null, 'runtime-info'), send);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'response',
        body: {
          requestMessageId: 'runtime-info',
          result: expect.objectContaining({
            deviceIdentity: {available: true, deviceId: 'app-scoped-device-id'},
          }),
        },
      }),
    );
    expect(JSON.stringify(send.mock.calls)).not.toContain('sessionToken');
    handler.dispose();
  });

  it('preserves an unavailable app identity instead of inventing one', () => {
    const fixture = makeContext();
    const handler = createRuntimeRequestHandler({
      sessionId: 'session-1',
      context: fixture.context,
      deviceIdentity: {available: false, deviceId: null},
    });
    const send = vi.fn();

    handler.handle(request('runtime.info', null, 'runtime-info-unavailable'), send);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'response',
        body: {
          requestMessageId: 'runtime-info-unavailable',
          result: expect.objectContaining({
            deviceIdentity: {available: false, deviceId: null},
          }),
        },
      }),
    );
    handler.dispose();
  });

  it('evaluates a named selector without exposing Runtime state', () => {
    const fixture = makeContext();
    const handler = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const send = vi.fn();

    handler.handle(request('selector.read', {selectorName: 'example.value', argsTuple: [9]}, 'read-1'), send);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'response',
        body: {requestMessageId: 'read-1', result: {valueState: 'JSON', value: {value: 9}}},
      }),
    );
    handler.dispose();
  });

  it('reports selector query timing after the response is handed to the send queue', () => {
    const fixture = makeContext();
    const handler = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const sent: unknown[] = [];

    handler.handle(
      request('selector.read', {selectorName: 'example.value', argsTuple: [9]}, 'read-measured'),
      message => sent.push(message),
    );

    expect(sent[0]).toMatchObject({type: 'response', body: {result: {valueState: 'JSON', value: {value: 9}}}});
    expect(sent[1]).toMatchObject({
      type: 'event',
      body: {
        kind: 'performance.measurement',
        phase: 'selector.read',
        elapsedMs: expect.any(Number),
        payloadBytes: expect.any(Number),
        activeSubscriptions: 0,
      },
    });
    handler.dispose();
  });

  it('sends an initial selector value, suppresses equal values, and unsubscribes on disposal', () => {
    const fixture = makeContext();
    const handler = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const send = vi.fn();

    handler.handle(
      request(
        'selector.subscribe',
        {
          subscriptionId: 'sub-1',
          selectorName: 'example.value',
          argsTuple: [],
        },
        'subscribe-1',
      ),
      send,
    );
    expect(handler.activeSelectorSubscriptionCount).toBe(1);
    expect(
      send.mock.calls.filter(
        ([reply]) =>
          (reply as {type: string; body: {subscriptionId?: string}}).type === 'event' &&
          (reply as {body: {subscriptionId?: string}}).body.subscriptionId === 'sub-1',
      ),
    ).toHaveLength(1);
    fixture.notifyState();
    expect(
      send.mock.calls.filter(
        ([reply]) =>
          (reply as {type: string; body: {subscriptionId?: string}}).type === 'event' &&
          (reply as {body: {subscriptionId?: string}}).body.subscriptionId === 'sub-1',
      ),
    ).toHaveLength(1);

    handler.dispose();
    expect(handler.activeSelectorSubscriptionCount).toBe(0);
    expect(fixture.journalListeners.size).toBe(0);
    expect(fixture.stateListenerCount()).toBe(0);
  });

  it('rejects an initial selector evaluation before accepting the subscription', () => {
    const fixture = makeContext();
    const handler = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const send = vi.fn();

    handler.handle(
      request(
        'selector.subscribe',
        {subscriptionId: 'sub-missing-selector', selectorName: 'missing.selector', argsTuple: []},
        'subscribe-missing-selector',
      ),
      send,
    );

    expect(send.mock.calls).toHaveLength(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      type: 'error',
      messageId: 'reply-subscribe-missing-selector',
      body: {requestMessageId: 'subscribe-missing-selector', code: 'SELECTOR_NOT_REGISTERED'},
    });
    expect(handler.activeSelectorSubscriptionCount).toBe(0);
    expect(fixture.stateListenerCount()).toBe(0);
    handler.dispose();
  });

  it('coalesces state notifications across active subscriptions and reports the whole flush', async () => {
    const fixture = makeContext();
    const handler = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const send = vi.fn();

    for (const subscriptionId of ['sub-a', 'sub-b']) {
      handler.handle(
        request(
          'selector.subscribe',
          {
            subscriptionId,
            selectorName: 'example.value',
            argsTuple: ['mutable'],
          },
          `subscribe-${subscriptionId}`,
        ),
        send,
      );
    }
    expect(fixture.stateListenerCount()).toBe(1);
    fixture.setSelectedValue({value: 2});
    fixture.notifyState();
    await vi.waitFor(() =>
      expect(
        send.mock.calls.some(
          ([message]) =>
            (message as {body?: {kind?: string; phase?: string}}).body?.kind === 'performance.measurement' &&
            (message as {body?: {phase?: string}}).body?.phase === 'selector.flush',
        ),
      ).toBe(true),
    );

    const measurements = send.mock.calls
      .map(([message]) => message as {body?: Record<string, unknown>})
      .filter(message => message.body?.kind === 'performance.measurement' && message.body.phase === 'selector.flush');
    expect(measurements).toHaveLength(1);
    expect(measurements[0]?.body).toMatchObject({
      activeSubscriptions: 2,
      elapsedMs: expect.any(Number),
      payloadBytes: expect.any(Number),
    });
    expect(
      send.mock.calls.filter(
        ([message]) =>
          (message as {body?: {subscriptionId?: string}}).body?.subscriptionId === 'sub-a' ||
          (message as {body?: {subscriptionId?: string}}).body?.subscriptionId === 'sub-b',
      ),
    ).toHaveLength(4);
    handler.dispose();
    expect(fixture.stateListenerCount()).toBe(0);
  });

  it('keeps a subscription alive across NON_JSON to JSON to NON_JSON values', async () => {
    const fixture = makeContext();
    fixture.setSelectedValue(undefined);
    const handler = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const send = vi.fn();
    const events = () =>
      send.mock.calls
        .map(
          ([reply]) => reply as {type: string; body: {subscriptionId?: string; valueState?: string; reason?: string}},
        )
        .filter(reply => reply.type === 'event' && reply.body.subscriptionId === 'sub-non-json');

    handler.handle(
      request(
        'selector.subscribe',
        {
          subscriptionId: 'sub-non-json',
          selectorName: 'example.value',
          argsTuple: ['mutable'],
        },
        'subscribe-non-json',
      ),
      send,
    );
    expect(events().at(-1)?.body).toMatchObject({valueState: 'NON_JSON', reason: 'UNDEFINED'});

    fixture.setSelectedValue({ready: true});
    fixture.notifyState();
    await vi.waitFor(() => expect(events()).toHaveLength(2));
    expect(events().at(-1)?.body).toMatchObject({valueState: 'JSON', value: {ready: true}});

    fixture.setSelectedValue(undefined);
    fixture.notifyState();
    await vi.waitFor(() => expect(events()).toHaveLength(3));
    expect(events().at(-1)?.body).toMatchObject({valueState: 'NON_JSON', reason: 'UNDEFINED'});
    expect(handler.activeSelectorSubscriptionCount).toBe(1);
    handler.dispose();
  });

  it('identifies an invalid nested array by structural path without exposing field names', () => {
    const fixture = makeContext();
    const nested = [] as unknown[] & {privateField?: string};
    Object.defineProperty(nested, 'privateField', {value: 'not-for-diagnostics'});
    fixture.setSelectedValue({nested});
    const handler = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const send = vi.fn();

    handler.handle(
      request('selector.read', {selectorName: 'example.value', argsTuple: ['mutable']}, 'read-invalid-array'),
      send,
    );

    const reply = send.mock.calls[0]?.[0] as {body?: {result?: {reason?: string}}};
    expect(reply.body?.result?.reason).toBe('ARRAY_EXTRA_FIELD@root.p0:string:1');
    expect(JSON.stringify(reply)).not.toContain('privateField');
    expect(JSON.stringify(reply)).not.toContain('not-for-diagnostics');
    handler.dispose();
  });

  it.each(['01', '4294967295'])('rejects noncanonical JSON array property %s', property => {
    const fixture = makeContext();
    const nested = [1] as unknown[] & Record<string, unknown>;
    Object.defineProperty(nested, property, {value: 'not-serialized', enumerable: true});
    fixture.setSelectedValue({nested});
    const handler = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const send = vi.fn();

    handler.handle(
      request('selector.read', {selectorName: 'example.value', argsTuple: ['mutable']}, `read-${property}`),
      send,
    );

    expect(send.mock.calls[0]?.[0]).toMatchObject({
      type: 'response',
      body: {result: {valueState: 'NON_JSON', reason: 'ARRAY_EXTRA_FIELD@root.p0:string:1'}},
    });
    handler.dispose();
  });

  it('rejects array accessors without invoking them', () => {
    const fixture = makeContext();
    const getter = vi.fn(() => 'secret');
    const value: unknown[] = [];
    Object.defineProperty(value, '0', {get: getter, enumerable: true, configurable: true});
    value.length = 1;
    fixture.setSelectedValue({nested: value});
    const handler = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const send = vi.fn();

    handler.handle(
      request('selector.read', {selectorName: 'example.value', argsTuple: ['mutable']}, 'read-array-accessor'),
      send,
    );

    expect(send.mock.calls[0]?.[0]).toMatchObject({
      type: 'response',
      body: {result: {valueState: 'NON_JSON', reason: 'ACCESSOR_FIELD'}},
    });
    expect(getter).not.toHaveBeenCalled();
    handler.dispose();
  });

  it('rejects arrays with an inherited toJSON override', () => {
    const fixture = makeContext();
    const toJSON = vi.fn(() => ['rewritten']);
    const customPrototype = Object.create(Array.prototype, {toJSON: {value: toJSON}}) as object;
    const value = [1];
    Object.setPrototypeOf(value, customPrototype);
    fixture.setSelectedValue({nested: value});
    const handler = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const send = vi.fn();

    handler.handle(
      request('selector.read', {selectorName: 'example.value', argsTuple: ['mutable']}, 'read-array-prototype'),
      send,
    );

    expect(send.mock.calls[0]?.[0]).toMatchObject({
      type: 'response',
      body: {result: {valueState: 'NON_JSON', reason: 'NON_PLAIN_ARRAY'}},
    });
    expect(toJSON).not.toHaveBeenCalled();
    handler.dispose();
  });

  it('releases a selector when the complete subscription event exceeds the wire limit', () => {
    const fixture = makeContext();
    fixture.setSelectedValue({data: 'x'.repeat(1_048_500)});
    const handler = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const send = vi.fn();

    handler.handle(
      request(
        'selector.subscribe',
        {
          subscriptionId: 'sub-envelope-limit',
          selectorName: 'example.value',
          argsTuple: ['mutable'],
        },
        'subscribe-envelope-limit',
      ),
      send,
    );

    expect(send.mock.calls.map(([reply]) => reply)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'error',
          body: {requestMessageId: 'subscribe-envelope-limit', code: 'RESOURCE_LIMIT'},
        }),
      ]),
    );
    expect(handler.activeSelectorSubscriptionCount).toBe(0);
    expect(fixture.stateListenerCount()).toBe(0);
    handler.dispose();
  });

  it('serializes ordinary array indices as JSON rather than extra fields', () => {
    const fixture = makeContext();
    fixture.setSelectedValue({nested: [1, 'value']});
    const handler = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const send = vi.fn();

    handler.handle(
      request('selector.read', {selectorName: 'example.value', argsTuple: ['mutable']}, 'read-valid-array'),
      send,
    );

    expect(send.mock.calls[0]?.[0]).toMatchObject({
      type: 'response',
      body: {result: {valueState: 'JSON', value: {nested: [1, 'value']}}},
    });
    handler.dispose();
  });

  it('rejects an oversized selector subscription explicitly and releases it', () => {
    const fixture = makeContext();
    fixture.setSelectedValue({data: 'x'.repeat(1_048_576)});
    const handler = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const send = vi.fn();

    handler.handle(
      request(
        'selector.subscribe',
        {
          subscriptionId: 'sub-oversized',
          selectorName: 'example.value',
          argsTuple: ['mutable'],
        },
        'subscribe-oversized',
      ),
      send,
    );

    expect(send.mock.calls).toHaveLength(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      type: 'error',
      body: {requestMessageId: 'subscribe-oversized', code: 'RESOURCE_LIMIT'},
    });
    expect(handler.activeSelectorSubscriptionCount).toBe(0);
    expect(fixture.stateListenerCount()).toBe(0);
    expect(JSON.stringify(send.mock.calls)).not.toContain('x'.repeat(128));
    handler.dispose();
  });

  it('rejects a selector whose JSON validation exceeds the serialization budget and releases it', () => {
    const fixture = makeContext();
    const diagnostics: Readonly<{
      selectorName: string;
      failureCode: string;
      phase: string;
      elapsedMs: number;
      budgetMs: number;
    }>[] = [];
    const startedAt = performance.now();
    const slowJsonValue = new Proxy(
      {value: 1},
      {
        ownKeys: target => {
          while (performance.now() - startedAt < 12) {
            /* deterministic budget red */
          }
          return Reflect.ownKeys(target);
        },
      },
    );
    fixture.setSelectedValue(slowJsonValue);
    const handler = createRuntimeRequestHandler({
      sessionId: 'session-1',
      context: fixture.context,
      onSelectorFailure: diagnostic => diagnostics.push(diagnostic),
    });
    const send = vi.fn();

    handler.handle(
      request(
        'selector.subscribe',
        {
          subscriptionId: 'sub-slow-serialization',
          selectorName: 'example.value',
          argsTuple: ['mutable'],
        },
        'subscribe-slow-serialization',
      ),
      send,
    );

    expect(send.mock.calls.map(([reply]) => reply)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'error',
          body: {
            requestMessageId: 'subscribe-slow-serialization',
            code: 'SELECTOR_SERIALIZATION_BUDGET_EXCEEDED',
          },
        }),
      ]),
    );
    expect(handler.activeSelectorSubscriptionCount).toBe(0);
    expect(fixture.stateListenerCount()).toBe(0);
    expect(diagnostics).toMatchObject([
      {
        selectorName: 'example.value',
        failureCode: 'SELECTOR_SERIALIZATION_BUDGET_EXCEEDED',
        phase: 'json-validation',
        budgetMs: 8,
      },
    ]);
    expect(diagnostics[0]?.elapsedMs).toBeGreaterThanOrEqual(8);
    expect(JSON.stringify(diagnostics)).not.toContain('value: 1');
    handler.dispose();
  });

  it('subscribes to the journal before dispatch and keeps timed-out request observation for late actor events', async () => {
    const fixture = makeContext();
    const handler = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const send = vi.fn();
    let finish!: (result: unknown) => void;
    let observedRequestId = '';
    fixture.setDispatch((name, payload, options) => {
      expect(name).toBe('example.command');
      expect(payload).toEqual({value: 1});
      expect(fixture.journalListeners.size).toBe(1);
      expect(options).toMatchObject({lateResultTtlMs: 120_000});
      observedRequestId = (options as {requestId: string}).requestId;
      return new Promise(resolve => {
        finish = resolve;
      });
    });

    handler.handle(
      request('command.dispatch', {commandName: 'example.command', payload: {value: 1}}, 'command-1'),
      send,
    );
    expect(send.mock.calls[0]?.[0]).toMatchObject({type: 'response', body: {result: {accepted: true}}});
    for (const listener of fixture.journalListeners) {
      listener({
        kind: 'actor.timed-out',
        actorKey: 'example.actor',
        requestId: observedRequestId,
      } as never);
      listener({
        kind: 'actor.completed',
        actorKey: 'example.peerActor',
        requestId: observedRequestId,
      } as never);
    }
    finish({
      status: 'partial-failed',
      actorResults: [
        {actorKey: 'example.actor', status: 'timed-out'},
        {actorKey: 'example.peerActor', status: 'completed'},
      ],
    });
    await Promise.resolve();
    expect(handler.activeRequestTrackingCount).toBe(1);
    for (const listener of fixture.journalListeners) {
      listener({
        kind: 'actor.late-error',
        actorKey: 'example.actor',
        requestId: observedRequestId,
      } as never);
    }
    expect(handler.activeRequestTrackingCount).toBe(0);
    handler.dispose();
  });

  it('tracks repeated child actor keys by command instance until both late outcomes arrive', async () => {
    const fixture = makeContext();
    const handler = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const send = vi.fn();
    let finish!: (result: unknown) => void;
    let observedRequestId = '';
    fixture.setDispatch((_name, _payload, options) => {
      observedRequestId = (options as {requestId: string}).requestId;
      return new Promise(resolve => {
        finish = resolve;
      });
    });

    handler.handle(
      request('command.dispatch', {commandName: 'example.command', payload: null}, 'same-child-twice'),
      send,
    );
    const emit = (kind: 'actor.timed-out' | 'actor.late-completed' | 'actor.late-error', commandId: string): void => {
      for (const listener of fixture.journalListeners) {
        listener({kind, actorKey: 'example.child', commandId, requestId: observedRequestId} as never);
      }
    };
    emit('actor.timed-out', 'child-command-1');
    emit('actor.timed-out', 'child-command-2');
    finish({status: 'completed', commandId: 'root-command', actorResults: []});
    await Promise.resolve();
    expect(handler.activeRequestTrackingCount).toBe(1);

    emit('actor.late-completed', 'child-command-1');
    expect(handler.activeRequestTrackingCount).toBe(1);
    emit('actor.late-error', 'child-command-2');
    expect(handler.activeRequestTrackingCount).toBe(0);
    handler.dispose();
  });

  it('does not re-add a command instance whose late result arrived before dispatch settled', async () => {
    const fixture = makeContext();
    const handler = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const send = vi.fn();
    let finish!: (result: unknown) => void;
    let observedRequestId = '';
    fixture.setDispatch((_name, _payload, options) => {
      observedRequestId = (options as {requestId: string}).requestId;
      return new Promise(resolve => {
        finish = resolve;
      });
    });

    handler.handle(
      request('command.dispatch', {commandName: 'example.command', payload: null}, 'late-before-result'),
      send,
    );
    const emit = (kind: 'actor.timed-out' | 'actor.late-completed'): void => {
      for (const listener of fixture.journalListeners) {
        listener({kind, actorKey: 'example.root', commandId: 'root-command', requestId: observedRequestId} as never);
      }
    };
    emit('actor.timed-out');
    emit('actor.late-completed');
    finish({
      status: 'timed-out',
      commandId: 'root-command',
      actorResults: [{actorKey: 'example.root', status: 'timed-out'}],
    });
    await Promise.resolve();

    expect(handler.activeRequestTrackingCount).toBe(0);
    handler.dispose();
  });

  it('bounds active command observers per WebSocket session', () => {
    const fixture = makeContext();
    fixture.setDispatch(() => new Promise(() => undefined));
    const handler = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const send = vi.fn();

    for (let index = 0; index < 32; index += 1) {
      handler.handle(
        request(
          'command.dispatch',
          {
            commandName: 'example.command',
            payload: null,
            requestId: `req-${index}`,
          },
          `command-${index}`,
        ),
        send,
      );
    }
    handler.handle(
      request(
        'command.dispatch',
        {
          commandName: 'example.command',
          payload: null,
          requestId: 'req-overflow',
        },
        'command-overflow',
      ),
      send,
    );

    expect(handler.activeRequestTrackingCount).toBe(32);
    expect(send.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'error',
      body: {requestMessageId: 'command-overflow', code: 'RESOURCE_LIMIT'},
    });
    handler.dispose();
  });

  it('reports finite observation expiry without redispatching or retaining the request', async () => {
    vi.useFakeTimers();
    const fixture = makeContext();
    fixture.setDispatch(() => new Promise(() => undefined));
    const handler = createRuntimeRequestHandler({sessionId: 'session-1', context: fixture.context});
    const send = vi.fn();
    try {
      handler.handle(
        request(
          'command.dispatch',
          {
            commandName: 'example.command',
            payload: null,
            requestId: 'req-expiring',
          },
          'command-expiring',
        ),
        send,
      );
      await vi.advanceTimersByTimeAsync(120_000);
      expect(
        send.mock.calls.some(
          ([reply]) =>
            (reply as {body?: {kind?: string; lastOutcome?: string}}).body?.kind === 'TRACKING_EXPIRED' &&
            (reply as {body?: {lastOutcome?: string}}).body?.lastOutcome === 'UNKNOWN',
        ),
      ).toBe(true);
      expect(handler.activeRequestTrackingCount).toBe(0);
    } finally {
      handler.dispose();
      vi.useRealTimers();
    }
  });
});
