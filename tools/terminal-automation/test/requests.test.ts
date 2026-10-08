import {describe, expect, it} from 'vitest';
import type {AutomationDriverServer} from '../src/server.js';
import {requests} from '../src/requests.js';
import {dispatchObservedUiCommand} from '../src/uiAction.js';

type View = Readonly<{
  requestId: string;
  status: 'completed' | 'error';
  rootCommandIds: readonly string[];
  workspace: 'MAIN';
  commands: readonly Readonly<{
    commandId: string;
    commandName: string;
    parentCommandId: string | null;
    displayMode: 'PRIMARY';
    status: 'completed' | 'error';
    results: readonly unknown[];
    errors: readonly unknown[];
  }>[];
}>;

const view = (requestId: string): View =>
  Object.freeze({
    requestId,
    status: 'completed',
    rootCommandIds: [`command-${requestId}`],
    workspace: 'MAIN',
    commands: [
      Object.freeze({
        commandId: `command-${requestId}`,
        commandName: 'kernel.feature.sample-staff-session.login',
        parentCommandId: null,
        displayMode: 'PRIMARY',
        status: 'completed',
        results: [Object.freeze({status: 'completed'})],
        errors: [],
      }),
    ],
  });

const response = (result: unknown) =>
  Object.freeze({
    type: 'response' as const,
    sessionId: 'session',
    messageId: 'response',
    body: Object.freeze({result}),
  });

const fakeServer = (actionViews: readonly View[]) => {
  const listeners = new Set<(message: {type: string; body: unknown}) => void>();
  const activeSubscriptions = new Set<string>();
  let exactSubscribedWithListActive = false;
  let emittedAction = false;
  const sendValue = (subscriptionId: string, value: unknown) => {
    for (const listener of [...listeners])
      listener({
        type: 'event',
        body: Object.freeze({subscriptionId, valueState: 'JSON', value}),
      });
  };
  const server = {
    onMessage: (_sessionId: string, listener: (message: {type: string; body: unknown}) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    request: async (_sessionId: string, type: string, body: unknown) => {
      if (type === 'selector.subscribe' && typeof body === 'object' && body !== null) {
        const request = body as {subscriptionId: string; selectorName: string; argsTuple: readonly unknown[]};
        if (request.selectorName.endsWith('selectRequestExecutionView')) {
          exactSubscribedWithListActive = [...activeSubscriptions].some(id => id.startsWith('request-list-'));
        }
        activeSubscriptions.add(request.subscriptionId);
        if (request.selectorName.endsWith('selectRequestExecutionViews')) sendValue(request.subscriptionId, []);
        else
          sendValue(
            request.subscriptionId,
            actionViews.find(candidate => candidate.requestId === request.argsTuple[0]) ?? null,
          );
        return response({subscriptionId: request.subscriptionId, accepted: true});
      }
      if (type === 'selector.read' && typeof body === 'object' && body !== null) {
        const request = body as {selectorName: string};
        if (request.selectorName.endsWith('selectRequestExecutionViews')) {
          throw new Error('TEST_REJECTED_REDUNDANT_REQUEST_LIST_READ');
        }
      }
      if (type === 'selector.read') return response({valueState: 'JSON', value: []});
      if (type === 'selector.unsubscribe' && typeof body === 'object' && body !== null) {
        const subscriptionId = (body as {subscriptionId: string}).subscriptionId;
        activeSubscriptions.delete(subscriptionId);
        return response({subscriptionId, released: true});
      }
      return response({});
    },
    emitAction: () => {
      if (emittedAction) return;
      emittedAction = true;
      for (const subscriptionId of activeSubscriptions) {
        if (subscriptionId.startsWith('request-list-')) sendValue(subscriptionId, actionViews);
      }
    },
    activeSubscriptions,
    exactSubscribedWithListActive: () => exactSubscribedWithListActive,
  };
  return server;
};

describe('Runtime UI request observation', () => {
  it('observes a fast UI request from the existing request ledger and releases both selectors', async () => {
    const server = fakeServer([view('request-1')]);
    const result = await requests.observeUiAction({
      server: server as unknown as AutomationDriverServer,
      sessionId: 'session',
      workspace: 'MAIN',
      displayMode: 'PRIMARY',
      commandName: 'kernel.feature.sample-staff-session.login',
      action: async () => {
        server.emitAction();
        return 'real-action';
      },
      timeoutMs: 50,
    });
    expect(result).toMatchObject({requestId: 'request-1', view: {status: 'completed'}, actionResult: 'real-action'});
    expect(server.exactSubscribedWithListActive()).toBe(false);
    expect(server.activeSubscriptions.size).toBe(0);
  });

  it('fails closed when one UI action creates multiple matching root requests', async () => {
    const server = fakeServer([view('request-1'), view('request-2')]);
    await expect(
      requests.observeUiAction({
        server: server as unknown as AutomationDriverServer,
        sessionId: 'session',
        workspace: 'MAIN',
        displayMode: 'PRIMARY',
        commandName: 'kernel.feature.sample-staff-session.login',
        action: async () => {
          server.emitAction();
        },
        timeoutMs: 50,
      }),
    ).rejects.toThrow('TERMINAL_AUTOMATION_UI_ACTION_REQUEST_AMBIGUOUS');
    expect(server.activeSubscriptions.size).toBe(0);
  });

  it('keeps UI request correlation and terminal-status checks out of business journey runners', async () => {
    const server = fakeServer([view('request-1')]);
    await expect(
      dispatchObservedUiCommand({
        server: server as unknown as AutomationDriverServer,
        sessionId: 'session',
        workspace: 'MAIN',
        displayMode: 'PRIMARY',
        commandName: 'kernel.feature.sample-staff-session.login',
        action: async () => server.emitAction(),
        timeoutMs: 50,
      }),
    ).resolves.toBeUndefined();
    expect(server.activeSubscriptions.size).toBe(0);
  });
});
