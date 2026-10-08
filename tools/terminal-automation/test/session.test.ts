import {describe, expect, it} from 'vitest';
import type {AutomationDriverServer, AutomationDriverSession} from '../src/server.js';
import {
  resolveCurrentAutomationSession,
  waitForAutomationSession,
  waitForReplacementAutomationSession,
} from '../src/session.js';

const createSession = (runtimeId: string): AutomationDriverSession =>
  ({
    runtimeId,
    sessionId: `session-${runtimeId}`,
    appName: 'sample-wallpaper-console',
    localNodeId: `node-${runtimeId}`,
    socket: {readyState: 1, OPEN: 1},
  }) as unknown as AutomationDriverSession;

const createServer = (): Readonly<{
  readonly server: AutomationDriverServer;
  readonly add: (session: AutomationDriverSession) => void;
  readonly remove: (sessionId: string) => void;
  readonly listenerCount: () => number;
}> => {
  const sessions: AutomationDriverSession[] = [];
  const listeners = new Set<() => void>();
  const server = {
    getSessions: () => Object.freeze([...sessions]),
    getSession: (sessionId?: string) =>
      sessionId === undefined ? (sessions.at(-1) ?? null) : (sessions.find(session => session.sessionId === sessionId) ?? null),
    onSessionChange: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } as unknown as AutomationDriverServer;
  return Object.freeze({
    server,
    add: session => {
      sessions.push(session);
      for (const listener of [...listeners]) listener();
    },
    remove: sessionId => {
      const index = sessions.findIndex(session => session.sessionId === sessionId);
      if (index >= 0) sessions.splice(index, 1);
      for (const listener of [...listeners]) listener();
    },
    listenerCount: () => listeners.size,
  });
};

describe('waitForAutomationSession', () => {
  it('selects one matching session from the owned session map', async () => {
    const fake = createServer();
    fake.add(createSession('old'));
    fake.add(createSession('wanted'));
    await expect(
      waitForAutomationSession(fake.server, session => session.runtimeId === 'wanted'),
    ).resolves.toMatchObject({
      runtimeId: 'wanted',
    });
  });

  it('waits for the matching connection event without polling', async () => {
    const fake = createServer();
    const waiting = waitForAutomationSession(fake.server, session => session.runtimeId === 'wanted', 100);
    expect(fake.listenerCount()).toBe(1);
    fake.add(createSession('wanted'));
    await expect(waiting).resolves.toMatchObject({runtimeId: 'wanted'});
    expect(fake.listenerCount()).toBe(0);
  });

  it('rebinds to the same app after FULL creates a new Runtime localNodeId', async () => {
    const fake = createServer();
    const previous = {
      ...createSession('before-full'),
      sessionId: 'session-before-full',
      appName: 'sample-wallpaper-console',
      localNodeId: 'node-before-full',
    } as AutomationDriverSession;
    const replacement = {
      ...createSession('after-full'),
      sessionId: 'session-after-full',
      appName: previous.appName,
      localNodeId: 'node-after-full',
    } as AutomationDriverSession;
    const waiting = waitForReplacementAutomationSession(fake.server, previous, 100);

    fake.add(replacement);

    await expect(waiting).resolves.toBe(replacement);
  });

  it('prefers the replacement Runtime even while the previous app socket remains open', async () => {
    const fake = createServer();
    const previous = createSession('previous');
    const replacement = createSession('replacement');
    fake.add(previous);
    fake.add(replacement);

    await expect(resolveCurrentAutomationSession(fake.server, previous)).resolves.toBe(replacement);
  });

  it('keeps the prior Runtime only when it is the sole open app session', async () => {
    const fake = createServer();
    const previous = createSession('previous');
    fake.add(previous);

    await expect(resolveCurrentAutomationSession(fake.server, previous)).resolves.toBe(previous);
  });

  it('fails closed when the owned map is already ambiguous', async () => {
    const fake = createServer();
    fake.add(createSession('one'));
    fake.add(createSession('two'));
    await expect(waitForAutomationSession(fake.server, () => true, 100)).rejects.toThrow(
      'TERMINAL_AUTOMATION_SESSION_AMBIGUOUS',
    );
    expect(fake.listenerCount()).toBe(0);
  });

  it('times out and releases its lifecycle listener', async () => {
    const fake = createServer();
    await expect(waitForAutomationSession(fake.server, () => true, 5)).rejects.toThrow(
      'TERMINAL_AUTOMATION_SESSION_TIMEOUT',
    );
    expect(fake.listenerCount()).toBe(0);
  });

  it('cancels a losing session wait and releases its lifecycle listener', async () => {
    const fake = createServer();
    const controller = new AbortController();
    const waiting = waitForAutomationSession(fake.server, () => true, 1_000, controller.signal);
    expect(fake.listenerCount()).toBe(1);
    controller.abort();
    await expect(waiting).rejects.toThrow('TERMINAL_AUTOMATION_SESSION_WAIT_CANCELLED');
    expect(fake.listenerCount()).toBe(0);
  });
});
