import {describe, expect, it, vi} from 'vitest';
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
  const sessionListeners = new Set<() => void>();
  const activeSubscriptions = new Set<string>();
  let exactSubscribedWithListActive = false;
  let candidateQuery: Readonly<{selectorName: string; argsTuple: readonly unknown[]}> | undefined;
  let emittedAction = false;
  let sessionPresent = true;
  const sendValue = (subscriptionId: string, value: unknown) => {
    for (const listener of [...listeners])
      listener({
        type: 'event',
        body: Object.freeze({subscriptionId, valueState: 'JSON', value}),
      });
  };
  const server = {
    getSession: (_sessionId?: string) => sessionPresent ? ({sessionId: 'session'}) : null,
    onMessage: (_sessionId: string, listener: (message: {type: string; body: unknown}) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onSessionChange: (listener: () => void) => {
      sessionListeners.add(listener);
      return () => sessionListeners.delete(listener);
    },
    request: async (_sessionId: string, type: string, body: unknown) => {
      if (type === 'selector.subscribe' && typeof body === 'object' && body !== null) {
        const request = body as {subscriptionId: string; selectorName: string; argsTuple: readonly unknown[]};
        if (request.selectorName.endsWith('selectRequestExecutionCandidates')) {
          candidateQuery = Object.freeze({selectorName: request.selectorName, argsTuple: request.argsTuple});
        }
        if (request.selectorName.endsWith('selectRequestExecutionView')) {
          exactSubscribedWithListActive = [...activeSubscriptions].some(id => id.startsWith('request-list-'));
        }
        activeSubscriptions.add(request.subscriptionId);
        if (request.selectorName.endsWith('selectRequestExecutionCandidates'))
          sendValue(request.subscriptionId, []);
        else
          sendValue(
            request.subscriptionId,
            actionViews.find(candidate => candidate.requestId === request.argsTuple[0]) ?? null,
          );
        return response({subscriptionId: request.subscriptionId, accepted: true});
      }
      if (type === 'selector.read' && typeof body === 'object' && body !== null) {
        const request = body as {selectorName: string};
        if (request.selectorName.endsWith('selectRequestExecutionCandidates')) {
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
        if (subscriptionId.startsWith('request-list-'))
          sendValue(
            subscriptionId,
            actionViews.map(candidate => ({requestId: candidate.requestId, workspace: candidate.workspace})),
          );
      }
    },
    closeSession: () => {
      sessionPresent = false;
      activeSubscriptions.clear();
      for (const listener of [...sessionListeners]) listener();
    },
    activeSubscriptions,
    exactSubscribedWithListActive: () => exactSubscribedWithListActive,
    candidateQuery: () => candidateQuery,
  };
  return server;
};

const initialListFailureServer = (
  failure: 'NON_JSON' | 'RESOURCE_LIMIT' | 'RESOURCE_LIMIT_BEFORE_RESPONSE' | 'SESSION_CLOSE_AFTER_ACCEPTED',
) => {
  const listeners = new Set<(message: {type: string; body: unknown}) => void>();
  const sessionListeners = new Set<() => void>();
  const unsubscribed: string[] = [];
  let sessionPresent = true;
  const session = {sessionId: 'session'};
  const closeSession = () => {
    if (!sessionPresent) return;
    sessionPresent = false;
    for (const listener of [...sessionListeners]) listener();
  };
  const server = {
    getSession: () => sessionPresent ? session : null,
    onMessage: (_sessionId: string, listener: (message: {type: string; body: unknown}) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onSessionChange: (listener: () => void) => {
      sessionListeners.add(listener);
      return () => sessionListeners.delete(listener);
    },
    request: async (_sessionId: string, type: string, body: unknown) => {
      if (type === 'selector.subscribe' && typeof body === 'object' && body !== null) {
        const subscriptionId = (body as {subscriptionId: string}).subscriptionId;
        if (failure === 'NON_JSON') {
          setTimeout(() => {
            for (const listener of [...listeners])
              listener({type: 'event', body: {subscriptionId, sequence: 1, valueState: 'NON_JSON', reason: 'UNDEFINED'}});
          }, 0);
        } else if (failure === 'RESOURCE_LIMIT_BEFORE_RESPONSE') {
          for (const listener of [...listeners])
            listener({type: 'error', body: {requestMessageId: 'list-subscribe-request', code: 'RESOURCE_LIMIT'}});
        } else if (failure === 'SESSION_CLOSE_AFTER_ACCEPTED') {
          setTimeout(closeSession, 0);
        } else {
          setTimeout(() => {
            for (const listener of [...listeners])
              listener({type: 'error', body: {requestMessageId: 'list-subscribe-request', code: 'RESOURCE_LIMIT'}});
          }, 0);
        }
        return {
          type: 'response',
          sessionId: 'session',
          messageId: 'subscribe-response',
          body: {
            requestMessageId: 'list-subscribe-request',
            result: {subscriptionId, accepted: true},
          },
        };
      }
      if (type === 'selector.unsubscribe' && typeof body === 'object' && body !== null) {
        const subscriptionId = (body as {subscriptionId: string}).subscriptionId;
        unsubscribed.push(subscriptionId);
        return response({subscriptionId, released: true});
      }
      throw new Error(`UNEXPECTED_SELECTOR_REQUEST:${type}`);
    },
  };
  return {server, unsubscribed};
};

describe('Runtime UI request observation', () => {
  it('fails promptly and releases a request-list subscription whose current value is NON_JSON', async () => {
    const {server, unsubscribed} = initialListFailureServer('NON_JSON');
    const action = vi.fn(async () => undefined);
    const observerSteps: string[] = [];

    await expect(
      requests.observeUiAction({
        server: server as unknown as AutomationDriverServer,
        sessionId: 'session',
        workspace: 'MAIN',
        displayMode: 'PRIMARY',
        commandName: 'kernel.feature.sample-staff-session.login',
        action,
        timeoutMs: 100,
        onObserverStep: step => observerSteps.push(step),
      }),
    ).rejects.toThrow('TERMINAL_AUTOMATION_REQUEST_LIST_NON_JSON');
    expect(action).not.toHaveBeenCalled();
    expect(unsubscribed).toHaveLength(1);
    expect(observerSteps).toEqual([
      'request-list.subscribe-start',
      'request-list.subscribe-accepted',
      'request-list.initial-value-non-json',
    ]);
  });

  it('does not wait for an initial request-list value after Runtime has rejected its serialization', async () => {
    const {server, unsubscribed} = initialListFailureServer('RESOURCE_LIMIT');
    const action = vi.fn(async () => undefined);

    await expect(
      requests.observeUiAction({
        server: server as unknown as AutomationDriverServer,
        sessionId: 'session',
        workspace: 'MAIN',
        displayMode: 'PRIMARY',
        commandName: 'kernel.feature.sample-staff-session.login',
        action,
        timeoutMs: 100,
      }),
    ).rejects.toThrow('TERMINAL_AUTOMATION_REQUEST_LIST_INITIAL_VALUE_FAILED code=RESOURCE_LIMIT');
    expect(action).not.toHaveBeenCalled();
    expect(unsubscribed).toHaveLength(0);
  });

  it('correlates an initial-value error delivered before the subscribe response resolves', async () => {
    const {server, unsubscribed} = initialListFailureServer('RESOURCE_LIMIT_BEFORE_RESPONSE');
    const action = vi.fn(async () => undefined);

    await expect(
      requests.observeUiAction({
        server: server as unknown as AutomationDriverServer,
        sessionId: 'session',
        workspace: 'MAIN',
        displayMode: 'PRIMARY',
        commandName: 'kernel.feature.sample-staff-session.login',
        action,
        timeoutMs: 100,
      }),
    ).rejects.toThrow('TERMINAL_AUTOMATION_REQUEST_LIST_INITIAL_VALUE_FAILED code=RESOURCE_LIMIT');
    expect(action).not.toHaveBeenCalled();
    expect(unsubscribed).toHaveLength(0);
  });

  it('stops waiting and does not dispatch the action when the subscribed Runtime session closes', async () => {
    const {server, unsubscribed} = initialListFailureServer('SESSION_CLOSE_AFTER_ACCEPTED');
    const action = vi.fn(async () => undefined);
    const observerSteps: string[] = [];

    await expect(
      requests.observeUiAction({
        server: server as unknown as AutomationDriverServer,
        sessionId: 'session',
        workspace: 'MAIN',
        displayMode: 'PRIMARY',
        commandName: 'kernel.feature.sample-staff-session.login',
        action,
        timeoutMs: 1_000,
        onObserverStep: step => observerSteps.push(step),
      }),
    ).rejects.toThrow('TERMINAL_AUTOMATION_SESSION_NOT_CONNECTED_BEFORE_ACTION');
    expect(action).not.toHaveBeenCalled();
    expect(unsubscribed).toHaveLength(0);
    expect(observerSteps).toContain('request-list.session-closed-before-initial-value');
  });

  it('marks a session loss before the action so a caller can safely rebind without duplicating the action', async () => {
    const server = {
      getSession: () => null,
      onMessage: () => () => undefined,
      request: async () => {
        throw new Error('TERMINAL_AUTOMATION_SESSION_NOT_CONNECTED');
      },
    };
    const action = vi.fn(async () => undefined);

    await expect(
      requests.observeUiAction({
        server: server as unknown as AutomationDriverServer,
        sessionId: 'session-1',
        workspace: 'MAIN',
        displayMode: 'PRIMARY',
        commandName: 'kernel.feature.sample-staff-session.login',
        action,
      }),
    ).rejects.toThrow('TERMINAL_AUTOMATION_SESSION_NOT_CONNECTED_BEFORE_ACTION');
    expect(action).not.toHaveBeenCalled();
  });

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
    expect(server.candidateQuery()).toEqual({
      selectorName: 'kernel.base.runtime.selectRequestExecutionCandidates',
      argsTuple: ['MAIN', 'kernel.feature.sample-staff-session.login', 'PRIMARY'],
    });
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

  it('preserves the action failure when the Android session closes and releases its subscriptions', async () => {
    const server = fakeServer([view('request-1')]);
    await expect(
      requests.observeUiAction({
        server: server as unknown as AutomationDriverServer,
        sessionId: 'session',
        workspace: 'MAIN',
        displayMode: 'PRIMARY',
        commandName: 'kernel.feature.sample-staff-session.login',
        action: async () => {
          server.closeSession();
          throw new Error('TERMINAL_AUTOMATION_TAP_FAILED');
        },
        timeoutMs: 50,
      }),
    ).rejects.toThrow('TERMINAL_AUTOMATION_TAP_FAILED');
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
