import {describe, expect, it} from 'vitest';
import type {AutomationDriverServer} from '../src/server.js';
import {subscribeSelector, waitForSelector} from '../src/selectorObservation.js';

describe('Runtime selector observation', () => {
  it('subscribes before reading, observes the changed value, and releases the selector', async () => {
    const requests: Array<{type: string; body: any}> = [];
    let listener: ((message: any) => void) | undefined;
    let subscriptionId: string | undefined;
    const server = {
      getSession: () => ({}),
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
    expect(observation.latest()).toEqual({state: 'JSON', value: {name: 'before'}});
    expect(requests.slice(0, 2).map(request => request.type)).toEqual(['selector.subscribe', 'selector.read']);

    const changed = observation.waitFor(value => (value as {name?: string}).name === 'after');
    listener?.({
      type: 'event',
      body: {subscriptionId, valueState: 'JSON', value: {name: 'after'}},
    });
    await expect(changed).resolves.toEqual({name: 'after'});
    expect(observation.latest()).toEqual({state: 'JSON', value: {name: 'after'}});
    await observation.close();
    expect(requests.at(-1)?.type).toBe('selector.unsubscribe');
  });

  it('uses the newest selector event instead of a stale initial value', async () => {
    let listener: ((message: any) => void) | undefined;
    let subscriptionId: string | undefined;
    const server = {
      getSession: () => ({}),
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
      getSession: () => ({}),
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
    expect(observation.latest()).toEqual({state: 'INVALID'});
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

  it('waits through an undefined selector value until the selector becomes JSON', async () => {
    let listener: ((message: any) => void) | undefined;
    let subscriptionId: string | undefined;
    let readStarted!: () => void;
    const selectorReadStarted = new Promise<void>(resolve => { readStarted = resolve; });
    const server = {
      getSession: () => ({}),
      onMessage: (_sessionId: string, next: (message: any) => void) => {
        listener = next;
        return () => {
          listener = undefined;
        };
      },
      request: async (_sessionId: string, type: string, body: any) => {
        if (type === 'selector.subscribe') {
          subscriptionId = body.subscriptionId;
          listener?.({type: 'event', body: {subscriptionId, valueState: 'NON_JSON', reason: 'UNDEFINED'}});
          return {type: 'response', body: {result: {accepted: true, subscriptionId}}};
        }
        if (type === 'selector.read') {
          readStarted();
          return {type: 'response', body: {result: {valueState: 'NON_JSON', reason: 'UNDEFINED'}}};
        }
        if (type === 'selector.unsubscribe') return {type: 'response', body: {result: {released: true}}};
        throw new Error(`UNEXPECTED_SELECTOR_REQUEST:${type}`);
      },
    } as unknown as AutomationDriverServer;

    const waiting = waitForSelector(server, 'peer-session', 'kernel.base.ui-state.selectScreen', ['PRIMARY', 'main'],
      value => (value as {partKey?: string}).partKey === 'sample.desk.branch.member-list', 1_000);
    await selectorReadStarted;
    await new Promise<void>(resolve => setImmediate(resolve));
    listener?.({
      type: 'event',
      body: {subscriptionId, valueState: 'JSON', value: {partKey: 'sample.desk.branch.member-list'}},
    });
    await expect(waiting).resolves.toEqual({partKey: 'sample.desk.branch.member-list'});
  });

  it('does not hide a non-undefined NON_JSON event that arrives before the initial read', async () => {
    const requests: string[] = [];
    let listener: ((message: any) => void) | undefined;
    let subscriptionId: string | undefined;
    const server = {
      getSession: () => ({}),
      onMessage: (_sessionId: string, next: (message: any) => void) => {
        listener = next;
        return () => {
          listener = undefined;
        };
      },
      request: async (_sessionId: string, type: string, body: any) => {
        requests.push(type);
        if (type === 'selector.subscribe') {
          subscriptionId = body.subscriptionId;
          listener?.({type: 'event', body: {subscriptionId, valueState: 'NON_JSON', reason: 'RESOURCE_LIMIT'}});
          return {type: 'response', body: {result: {accepted: true, subscriptionId}}};
        }
        if (type === 'selector.read') {
          listener?.({type: 'event', body: {subscriptionId, valueState: 'JSON', value: {status: 'ready'}}});
          return {type: 'response', body: {result: {valueState: 'JSON', value: {status: 'ready'}}}};
        }
        if (type === 'selector.unsubscribe') return {type: 'response', body: {result: {released: true}}};
        throw new Error(`UNEXPECTED_SELECTOR_REQUEST:${type}`);
      },
    } as unknown as AutomationDriverServer;

    await expect(
      waitForSelector(server, 'peer-session', 'kernel.base.ui-state.selectScreen', ['PRIMARY', 'main'],
        value => (value as {status?: string}).status === 'ready', 1_000),
    ).rejects.toThrow('TERMINAL_AUTOMATION_SELECTOR_VALUE_NOT_JSON');
    expect(requests).toEqual(['selector.subscribe', 'selector.read', 'selector.unsubscribe']);
  });

  it('preserves a selector wait failure when the session closes before unsubscribe', async () => {
    const requests: string[] = [];
    let sessionOpen = true;
    const server = {
      getSession: () => sessionOpen ? {} : null,
      onMessage: () => () => undefined,
      request: async (_sessionId: string, type: string, body: any) => {
        requests.push(type);
        if (type === 'selector.subscribe') {
          return {type: 'response', body: {result: {accepted: true, subscriptionId: body.subscriptionId}}};
        }
        if (type === 'selector.read') {
          sessionOpen = false;
          return {type: 'response', body: {result: {valueState: 'JSON', value: {active: false}}}};
        }
        if (type === 'selector.unsubscribe') {
          throw new Error('TERMINAL_AUTOMATION_SESSION_NOT_CONNECTED');
        }
        throw new Error(`UNEXPECTED_SELECTOR_REQUEST:${type}`);
      },
    } as unknown as AutomationDriverServer;

    await expect(
      waitForSelector(server, 'session', 'example.active', [], () => false, 1),
    ).rejects.toThrow('TERMINAL_AUTOMATION_SELECTOR_WAIT_TIMEOUT');
    expect(requests).toEqual(['selector.subscribe', 'selector.read']);
  });
});
