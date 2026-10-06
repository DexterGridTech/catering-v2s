import {describe, expect, it, vi} from 'vitest';
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

describe('control request handler', () => {
  it('queries sanitized node facts without returning the host reference or semantic callbacks', () => {
    const registry = createAutomationNodeRegistry();
    registry.sink.register({
      nodeInstanceId: 'node-1',
      testID: 'member.submit',
      role: 'button',
      label: 'Submit',
      accessibilityState: Object.freeze({disabled: false}),
      value: null,
      surface: {surface: 'PRIMARY', displayIndex: 0, layoutRevision: 1},
      hostNode: {privateRef: true},
      semanticActions: {press: vi.fn()},
    });
    const handler = createControlRequestHandler({sessionId: 'session-1', registry});
    const send = vi.fn();

    handler.handle(request('controls.query', {filter: {testID: 'member.submit'}}, 'query-1'), send);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'response',
        body: {
          requestMessageId: 'query-1',
          result: {
            nodes: [
              {
                nodeInstanceId: 'node-1',
                testID: 'member.submit',
                role: 'button',
                label: 'Submit',
                accessibilityState: {disabled: false},
                value: null,
                surface: {surface: 'PRIMARY', displayIndex: 0, layoutRevision: 1},
                layout: null,
              },
            ],
          },
        },
      }),
    );
    expect(JSON.stringify(send.mock.calls[0]?.[0])).not.toContain('privateRef');
  });

  it('sends subscription updates and releases the listener on unsubscribe and dispose', () => {
    const registry = createAutomationNodeRegistry();
    const handler = createControlRequestHandler({sessionId: 'session-1', registry});
    const send = vi.fn();
    handler.handle(request('controls.subscribe', {subscriptionId: 'nodes-1', filter: {}}, 'sub-1'), send);
    expect(handler.activeSubscriptionCount).toBe(1);
    registry.sink.register({
      nodeInstanceId: 'node-1',
      testID: 'member.submit',
      role: 'button',
      label: 'Submit',
      accessibilityState: Object.freeze({disabled: false}),
      value: null,
      surface: {surface: 'PRIMARY', displayIndex: 0, layoutRevision: 1},
      hostNode: {},
    });
    expect(send.mock.calls.some(([reply]) => (reply as {type?: string}).type === 'event')).toBe(true);
    handler.handle(request('controls.unsubscribe', {subscriptionId: 'nodes-1'}, 'unsub-1'), send);
    expect(handler.activeSubscriptionCount).toBe(0);
    const countAfterUnsubscribe = send.mock.calls.length;
    registry.sink.unregister('node-1');
    expect(send.mock.calls).toHaveLength(countAfterUnsubscribe);

    handler.handle(request('controls.subscribe', {subscriptionId: 'nodes-2', filter: {}}, 'sub-2'), send);
    handler.dispose();
    expect(handler.activeSubscriptionCount).toBe(0);
  });

  it('rejects duplicate testID nodes inside one surface scope but keeps matching IDs on another display', () => {
    const registry = createAutomationNodeRegistry();
    const node = (nodeInstanceId: string, displayIndex: number) => ({
      nodeInstanceId,
      testID: 'member.submit',
      role: 'button',
      label: 'Submit',
      accessibilityState: Object.freeze({disabled: false}),
      value: null,
      surface: {surface: 'PRIMARY' as const, displayIndex, layoutRevision: 1},
      hostNode: {},
    });
    registry.sink.register(node('node-1', 0));
    registry.sink.register(node('node-2', 0));
    registry.sink.register(node('node-3', 1));
    const handler = createControlRequestHandler({sessionId: 'session-1', registry});
    const send = vi.fn();

    handler.handle(
      request('controls.query', {filter: {testID: 'member.submit', surface: 'PRIMARY'}}, 'ambiguous'),
      send,
    );
    handler.handle(
      request('controls.query', {filter: {testID: 'member.submit', surface: 'PRIMARY', displayIndex: 1}}, 'scoped'),
      send,
    );

    expect(send.mock.calls.map(([reply]) => (reply as {type: string}).type)).toEqual(['error', 'response', 'event']);
    expect(send.mock.calls[0]?.[0]).toMatchObject({body: {code: 'AMBIGUOUS_NODE'}});
    expect(send.mock.calls[1]?.[0]).toMatchObject({
      body: {result: {nodes: [{nodeInstanceId: 'node-3'}]}},
    });
    expect(send.mock.calls[2]?.[0]).toMatchObject({
      type: 'event',
      body: {
        kind: 'performance.measurement',
        phase: 'controls.query',
        elapsedMs: expect.any(Number),
        payloadBytes: expect.any(Number),
        activeSubscriptions: 0,
      },
    });
    handler.dispose();
  });

  it('rejects stale, unavailable and disabled control operations', async () => {
    const registry = createAutomationNodeRegistry();
    const press = vi.fn();
    registry.sink.register({
      nodeInstanceId: 'node-1',
      testID: 'member.submit',
      role: 'button',
      label: 'Submit',
      accessibilityState: Object.freeze({disabled: false}),
      value: null,
      surface: {surface: 'PRIMARY', displayIndex: 0, layoutRevision: 2},
      hostNode: {getBoundingClientRect: () => ({x: 1, y: 2, width: 20, height: 10})},
      semanticActions: {press},
    });
    const handler = createControlRequestHandler({sessionId: 'session-1', registry});
    const send = vi.fn();

    handler.handle(request('controls.bounds', {nodeInstanceId: 'node-1', layoutRevision: 1}, 'bounds-stale'), send);
    handler.handle(request('controls.bounds', {nodeInstanceId: 'node-1', layoutRevision: 2}, 'bounds-current'), send);
    handler.handle(
      request(
        'controls.act',
        {nodeInstanceId: 'node-1', layoutRevision: 2, action: 'changeText', value: 'x'},
        'act-missing',
      ),
      send,
    );
    handler.handle(
      request('controls.act', {nodeInstanceId: 'node-1', layoutRevision: 2, action: 'press'}, 'act-ok'),
      send,
    );
    expect(press).toHaveBeenCalledOnce();
    registry.sink.update('node-1', {accessibilityState: Object.freeze({disabled: true})});
    handler.handle(
      request('controls.act', {nodeInstanceId: 'node-1', layoutRevision: 2, action: 'press'}, 'act-disabled'),
      send,
    );
    await vi.waitFor(() =>
      expect(
        send.mock.calls.some(([reply]) => (reply as {messageId?: string}).messageId === 'reply-bounds-stale'),
      ).toBe(true),
    );
    expect(send.mock.calls.map(([reply]) => (reply as {body: {code?: string}}).body.code)).toContain('STALE_BOUNDS');
    expect(send.mock.calls.map(([reply]) => (reply as {body: {code?: string}}).body.code)).toContain(
      'ACTION_UNAVAILABLE',
    );
    expect(send.mock.calls.map(([reply]) => (reply as {body: {code?: string}}).body.code)).toContain(
      'CONTROL_DISABLED',
    );
    expect(
      send.mock.calls.some(
        ([reply]) => (reply as {body?: {result?: {bounds?: unknown}}}).body?.result?.bounds !== undefined,
      ),
    ).toBe(true);
    handler.dispose();
  });
});
