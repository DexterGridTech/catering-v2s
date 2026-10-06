import {describe, expect, it} from 'vitest';
import {createAutomationAgentModule, createSessionScopedSender} from '../src/application/createAutomationAgentModule';
import {createAutomationNodeRegistry} from '../src/foundations/registry/createAutomationNodeRegistry';

describe('automation agent RuntimeModule', () => {
  it('declares only the RuntimeModule it actually needs, not its type-only primitives package', () => {
    const module = createAutomationAgentModule({
      appName: 'sample-console',
      buildVersion: 'test',
      config: {enabled: false, url: 'ws://localhost:19090', sessionToken: ''},
      deviceIdentity: {available: false, deviceId: null},
      nodeRegistry: createAutomationNodeRegistry(),
    });

    expect(module.dependencies).toEqual([{moduleName: 'kernel.base.runtime'}]);
  });

  it('does not deliver an old session callback through the replacement socket', async () => {
    let activeSessionId = 'session-a';
    let activeSocket: {closed: boolean; next: (value: {sessionId: string; messageId: string}) => void};
    const oldSent: Array<{sessionId: string; messageId: string}> = [];
    const newSent: Array<{sessionId: string; messageId: string}> = [];
    const oldSocket = {closed: false, next: (value: {sessionId: string; messageId: string}) => oldSent.push(value)};
    const newSocket = {closed: false, next: (value: {sessionId: string; messageId: string}) => newSent.push(value)};
    activeSocket = oldSocket;
    const sendOld = createSessionScopedSender({
      sessionId: 'session-a',
      socket: oldSocket,
      isCurrent: () => activeSocket === oldSocket && activeSessionId === 'session-a',
    });

    const delayedSend = Promise.resolve().then(() => sendOld({sessionId: 'session-a', messageId: 'late-reply'}));
    activeSessionId = 'session-b';
    activeSocket = newSocket;
    await delayedSend;

    expect(oldSent).toEqual([]);
    expect(newSent).toEqual([]);
  });
});
