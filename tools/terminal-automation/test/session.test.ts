import {describe, expect, it} from 'vitest';
import type {AutomationDriverServer, AutomationDriverSession} from '../src/server.js';
import {waitForAutomationSession} from '../src/session.js';

const createSession = (runtimeId: string): AutomationDriverSession =>
  ({runtimeId, sessionId: `session-${runtimeId}`}) as AutomationDriverSession;

const createServer = (): Readonly<{
  readonly server: AutomationDriverServer;
  readonly add: (session: AutomationDriverSession) => void;
  readonly listenerCount: () => number;
}> => {
  const sessions: AutomationDriverSession[] = [];
  const listeners = new Set<() => void>();
  const server = {
    getSessions: () => Object.freeze([...sessions]),
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
