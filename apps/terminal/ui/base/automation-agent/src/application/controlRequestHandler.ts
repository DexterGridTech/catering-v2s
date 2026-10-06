import {
  ControlsActRequestSchema,
  ControlsBoundsRequestSchema,
  ControlsQueryRequestSchema,
  ControlsSubscribeRequestSchema,
  ControlsUnsubscribeRequestSchema,
  type AutomationEnvelope,
  type AutomationControlFilter,
} from '../foundations/protocol';
import type {AutomationNodeRecord, AutomationNodeRegistry} from '../foundations/registry/createAutomationNodeRegistry';

export type AutomationControlReply = Readonly<{
  readonly protocolVersion: 1;
  readonly sessionId: string;
  readonly messageId: string;
  readonly type: 'response' | 'event' | 'error';
  readonly body: unknown;
}>;

const replyId = (request: AutomationEnvelope): string => `reply-${request.messageId}`;

const matches = (node: AutomationNodeRecord, filter: AutomationControlFilter): boolean =>
  (filter.testID === undefined || node.testID === filter.testID) &&
  (filter.surface === undefined || node.surface.surface === filter.surface) &&
  (filter.displayIndex === undefined || node.surface.displayIndex === filter.displayIndex) &&
  (filter.role === undefined || node.role === filter.role) &&
  (filter.label === undefined || node.label === filter.label);

const publicNode = (node: AutomationNodeRecord): Readonly<Record<string, unknown>> =>
  Object.freeze({
    nodeInstanceId: node.nodeInstanceId,
    testID: node.testID,
    role: node.role,
    label: node.label,
    accessibilityState: node.accessibilityState,
    value: node.value,
    surface: node.surface,
    layout: node.layout,
  });

export const createControlRequestHandler = (input: Readonly<{sessionId: string; registry: AutomationNodeRegistry}>) => {
  const subscriptions = new Map<string, () => void>();
  let sequence = 0;
  const reportQueryPerformance = (
    send: (reply: AutomationControlReply) => void,
    elapsedMs: number,
    payloadBytes: number,
  ): void =>
    send({
      protocolVersion: 1,
      sessionId: input.sessionId,
      messageId: `controls-event-${++sequence}`,
      type: 'event',
      body: Object.freeze({
        kind: 'performance.measurement',
        phase: 'controls.query',
        elapsedMs,
        payloadBytes,
        activeSubscriptions: 0,
      }),
    });
  const sendBytes = (reply: AutomationControlReply): number => new TextEncoder().encode(JSON.stringify(reply)).length;
  const snapshot = (filter: AutomationControlFilter): readonly Readonly<Record<string, unknown>>[] =>
    Object.freeze(
      input.registry
        .list()
        .filter(node => matches(node, filter))
        .map(publicNode),
    );
  const isAmbiguous = (nodes: readonly Readonly<Record<string, unknown>>[]): boolean => {
    const scopes = new Set<string>();
    for (const node of nodes) {
      const surface = node.surface as {surface: string; displayIndex: number | null};
      const scope = `${surface.surface}:${surface.displayIndex ?? 'host'}`;
      if (scopes.has(scope)) return true;
      scopes.add(scope);
    }
    return false;
  };
  const releaseSubscription = (subscriptionId: string): void => {
    subscriptions.get(subscriptionId)?.();
    subscriptions.delete(subscriptionId);
  };

  const handle = (request: AutomationEnvelope, send: (reply: AutomationControlReply) => void): void => {
    const fail = (code: string): void =>
      send({
        protocolVersion: 1,
        sessionId: input.sessionId,
        messageId: replyId(request),
        type: 'error',
        body: Object.freeze({requestMessageId: request.messageId, code}),
      });
    const succeed = (result: unknown): void =>
      send({
        protocolVersion: 1,
        sessionId: input.sessionId,
        messageId: replyId(request),
        type: 'response',
        body: Object.freeze({requestMessageId: request.messageId, result}),
      });
    if (request.sessionId !== input.sessionId) {
      fail('SESSION_MISMATCH');
      return;
    }

    if (request.type === 'controls.query') {
      const parsed = ControlsQueryRequestSchema.safeParse(request.body);
      if (!parsed.success) return fail('INVALID_CONTROL_REQUEST');
      const started = performance.now();
      const nodes = snapshot(parsed.data.filter);
      if (parsed.data.filter.testID !== undefined && isAmbiguous(nodes)) return fail('AMBIGUOUS_NODE');
      const result = Object.freeze({nodes});
      const response: AutomationControlReply = Object.freeze({
        protocolVersion: 1,
        sessionId: input.sessionId,
        messageId: replyId(request),
        type: 'response',
        body: Object.freeze({requestMessageId: request.messageId, result}),
      });
      send(response);
      const elapsedMs = performance.now() - started;
      reportQueryPerformance(send, elapsedMs, sendBytes(response));
      return;
    }
    if (request.type === 'controls.subscribe') {
      const parsed = ControlsSubscribeRequestSchema.safeParse(request.body);
      if (!parsed.success) return fail('INVALID_CONTROL_REQUEST');
      const {subscriptionId, filter} = parsed.data;
      if (subscriptions.has(subscriptionId)) return fail('DUPLICATE_SUBSCRIPTION');
      if (subscriptions.size >= 128) return fail('RESOURCE_LIMIT');
      const initialNodes = snapshot(filter);
      if (filter.testID !== undefined && isAmbiguous(initialNodes)) return fail('AMBIGUOUS_NODE');
      const unsubscribe = input.registry.subscribe(event => {
        if (event.type === 'nodes.changed') {
          const nodes = snapshot(filter);
          if (filter.testID !== undefined && isAmbiguous(nodes)) {
            send({
              protocolVersion: 1,
              sessionId: input.sessionId,
              messageId: `controls-event-${++sequence}`,
              type: 'error',
              body: Object.freeze({subscriptionId, code: 'AMBIGUOUS_NODE'}),
            });
            releaseSubscription(subscriptionId);
            return;
          }
          send({
            protocolVersion: 1,
            sessionId: input.sessionId,
            messageId: `controls-event-${++sequence}`,
            type: 'event',
            body: Object.freeze({subscriptionId, sequence, nodes}),
          });
          return;
        }
        if (matches(event.node, filter)) {
          send({
            protocolVersion: 1,
            sessionId: input.sessionId,
            messageId: `controls-event-${++sequence}`,
            type: 'event',
            body: Object.freeze({
              subscriptionId,
              sequence,
              interaction: Object.freeze({...event, node: publicNode(event.node)}),
            }),
          });
        }
      });
      subscriptions.set(subscriptionId, unsubscribe);
      succeed({subscriptionId, sequence, nodes: initialNodes});
      return;
    }
    if (request.type === 'controls.unsubscribe') {
      const parsed = ControlsUnsubscribeRequestSchema.safeParse(request.body);
      if (!parsed.success) return fail('INVALID_CONTROL_REQUEST');
      if (!subscriptions.has(parsed.data.subscriptionId)) return fail('SUBSCRIPTION_NOT_FOUND');
      releaseSubscription(parsed.data.subscriptionId);
      succeed({subscriptionId: parsed.data.subscriptionId, released: true});
      return;
    }
    if (request.type === 'controls.bounds') {
      const parsed = ControlsBoundsRequestSchema.safeParse(request.body);
      if (!parsed.success) return fail('INVALID_CONTROL_REQUEST');
      const {nodeInstanceId, layoutRevision} = parsed.data;
      const node = input.registry.get(nodeInstanceId);
      if (node === undefined) return fail('NODE_GONE');
      if (node.surface.layoutRevision !== layoutRevision) return fail('STALE_BOUNDS');
      void input.registry.measure(nodeInstanceId).then(
        bounds => {
          const current = input.registry.get(nodeInstanceId);
          if (current === undefined) return fail('NODE_GONE');
          if (current.surface.layoutRevision !== layoutRevision) return fail('STALE_BOUNDS');
          if (bounds === null) return fail('BOUNDS_NOT_READY');
          succeed({nodeInstanceId, layoutRevision, bounds});
        },
        () => fail('BOUNDS_NOT_READY'),
      );
      return;
    }
    if (request.type === 'controls.act') {
      const parsed = ControlsActRequestSchema.safeParse(request.body);
      if (!parsed.success || (parsed.data.action === 'changeText' && parsed.data.value === undefined)) {
        return fail('INVALID_CONTROL_REQUEST');
      }
      const {nodeInstanceId, layoutRevision, action, value} = parsed.data;
      const result = input.registry.act({nodeInstanceId, layoutRevision, action, value});
      if (!result.ok) return fail(result.code);
      succeed({nodeInstanceId, layoutRevision, action, delivery: 'semantic'});
      return;
    }
    fail('UNSUPPORTED_METHOD');
  };

  return Object.freeze({
    handle,
    dispose: (): void => {
      for (const unsubscribe of subscriptions.values()) unsubscribe();
      subscriptions.clear();
    },
    get activeSubscriptionCount(): number {
      return subscriptions.size;
    },
  });
};
