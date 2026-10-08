import {describe, expect, it} from 'vitest';
import type {AutomationDriverServer} from '../src/server.js';
import {subscribeSelector} from '../src/selectorObservation.js';

describe('Runtime selector observation', () => {
  it('subscribes before reading, observes the changed value, and releases the selector', async () => {
    const requests: Array<{type: string; body: any}> = [];
    let listener: ((message: any) => void) | undefined;
    let subscriptionId: string | undefined;
    const server = {
      onMessage: (_sessionId: string, next: (message: any) => void) => {
        listener = next;
        return () => {
          listener = undefined;
        };
      },
      request: async (_sessionId: string, type: string, body: any) => {
        requests.push({type, body});
        if (type === 'selector.subscribe') {
          subscriptionId = body.subscriptionId;
          return {type: 'response', body: {result: {accepted: true, subscriptionId}}};
        }
        if (type === 'selector.read') {
          return {type: 'response', body: {result: {valueState: 'JSON', value: {name: 'before'}}}};
        }
        if (type === 'selector.unsubscribe') {
          return {type: 'response', body: {result: {released: true}}};
        }
        throw new Error(`UNEXPECTED_SELECTOR_REQUEST:${type}`);
      },
    } as unknown as AutomationDriverServer;

    const observation = await subscribeSelector(
      server,
      'runtime-session',
      'kernel.feature.store-basic.selectStore',
      [],
    );
    expect(observation.current).toEqual({name: 'before'});
    expect(requests.slice(0, 2).map(request => request.type)).toEqual(['selector.subscribe', 'selector.read']);

    const changed = observation.waitFor(value => (value as {name?: string}).name === 'after');
    listener?.({
      type: 'event',
      body: {subscriptionId, valueState: 'JSON', value: {name: 'after'}},
    });
    await expect(changed).resolves.toEqual({name: 'after'});
    await observation.close();
    expect(requests.at(-1)?.type).toBe('selector.unsubscribe');
  });

  it('uses the newest selector event instead of a stale initial value', async () => {
    let listener: ((message: any) => void) | undefined;
    let subscriptionId: string | undefined;
    const server = {
      onMessage: (_sessionId: string, next: (message: any) => void) => {
        listener = next;
        return () => {
          listener = undefined;
        };
      },
      request: async (_sessionId: string, type: string, body: any) => {
        if (type === 'selector.subscribe') {
          subscriptionId = body.subscriptionId;
          return {type: 'response', body: {result: {accepted: true, subscriptionId}}};
        }
        if (type === 'selector.read') {
          return {type: 'response', body: {result: {valueState: 'JSON', value: {active: true}}}};
        }
        if (type === 'selector.unsubscribe') return {type: 'response', body: {result: {released: true}}};
        throw new Error(`UNEXPECTED_SELECTOR_REQUEST:${type}`);
      },
    } as unknown as AutomationDriverServer;

    const observation = await subscribeSelector(server, 'session', 'example.active', []);
    listener?.({type: 'event', body: {subscriptionId, valueState: 'JSON', value: {active: false}}});
    let settled = false;
    const waiting = observation
      .waitFor(value => (value as {active?: boolean}).active === true, 1_000)
      .then(value => {
        settled = true;
        return value;
      });
    await Promise.resolve();
    expect(settled).toBe(false);
    listener?.({type: 'event', body: {subscriptionId, valueState: 'JSON', value: {active: true, revision: 2}}});
    await expect(waiting).resolves.toEqual({active: true, revision: 2});
    await observation.close();
  });

  it('does not fall back to an old JSON value after a NON_JSON event', async () => {
    let listener: ((message: any) => void) | undefined;
    let subscriptionId: string | undefined;
    const server = {
      onMessage: (_sessionId: string, next: (message: any) => void) => {
        listener = next;
        return () => {
          listener = undefined;
        };
      },
      request: async (_sessionId: string, type: string, body: any) => {
        if (type === 'selector.subscribe') {
          subscriptionId = body.subscriptionId;
          return {type: 'response', body: {result: {accepted: true, subscriptionId}}};
        }
        if (type === 'selector.read') {
          return {type: 'response', body: {result: {valueState: 'JSON', value: {status: 'ready'}}}};
        }
        if (type === 'selector.unsubscribe') return {type: 'response', body: {result: {released: true}}};
        throw new Error(`UNEXPECTED_SELECTOR_REQUEST:${type}`);
      },
    } as unknown as AutomationDriverServer;

    const observation = await subscribeSelector(server, 'session', 'example.state', []);
    listener?.({type: 'event', body: {subscriptionId, valueState: 'NON_JSON', reason: 'UNDEFINED'}});
    let settled = false;
    const waiting = observation
      .waitFor(value => (value as {status?: string}).status === 'ready', 1_000)
      .then(value => {
        settled = true;
        return value;
      });
    await Promise.resolve();
    expect(settled).toBe(false);
    listener?.({type: 'event', body: {subscriptionId, valueState: 'JSON', value: {status: 'ready', revision: 2}}});
    await expect(waiting).resolves.toEqual({status: 'ready', revision: 2});
    await observation.close();
  });
});
