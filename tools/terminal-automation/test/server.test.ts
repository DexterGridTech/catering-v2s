import {afterEach, describe, expect, it} from 'vitest';
import WebSocket from 'ws';
import {createTerminalAutomationDriver} from '../src/driver.js';
import {createAutomationDriverServer} from '../src/server.js';

const waitFor = async <T>(read: () => T | null, timeoutMs = 2_000): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = read();
    if (value !== null) return value;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('AUTOMATION_TEST_WAIT_EXPIRED');
};

describe('automation driver server', () => {
  let close: (() => Promise<void>) | undefined;
  let socket: WebSocket | undefined;
  afterEach(async () => {
    socket?.close();
    await close?.();
    socket = undefined;
    close = undefined;
  });

  it('authenticates a TER runtime and sends welcome without logging the token', async () => {
    let observedSession: {runtimeId: string; localNodeId: string} | null = null;
    const driver = createTerminalAutomationDriver({
      token: 'test-token',
      port: 0,
      onSession: session => {
        observedSession = session;
      },
    });
    close = driver.close;
    const registeredSession = driver.waitForSession(session => session.runtimeId === 'runtime-1');
    await waitFor(() =>
      driver.transport.server.address() && typeof driver.transport.server.address() === 'object' ? true : null,
    );
    const address = driver.transport.server.address();
    if (address === null || typeof address === 'string') throw new Error('TEST_SERVER_ADDRESS_MISSING');
    socket = new WebSocket(`ws://127.0.0.1:${address.port}/automation`);
    await new Promise<void>((resolve, reject) => {
      socket?.once('open', resolve);
      socket?.once('error', reject);
    });
    const welcome = new Promise<unknown>(resolve =>
      socket?.once('message', data => resolve(JSON.parse(data.toString()))),
    );
    socket.send(
      JSON.stringify({
        protocolVersion: 1,
        sessionId: 'session-1',
        messageId: 'hello-1',
        type: 'hello',
        body: {
          sessionToken: 'test-token',
          runtimeId: 'runtime-1',
          localNodeId: 'node-1',
          appName: 'sample-terminal',
          buildVersion: 'test-build',
        },
      }),
    );
    expect(await welcome).toMatchObject({
      type: 'welcome',
      sessionId: 'session-1',
      body: {accepted: true, ackMessageId: 'hello-1'},
    });
    expect(observedSession).toMatchObject({runtimeId: 'runtime-1', localNodeId: 'node-1'});
    await expect(registeredSession).resolves.toMatchObject({sessionId: 'session-1', runtimeId: 'runtime-1'});
    expect(driver.transport.getDiagnostics()).toMatchObject({
      socketConnections: 1,
      authenticatedSessions: 1,
      authenticationTimeouts: 0,
      rejectedMessages: 0,
      activeSockets: 1,
      activeSessions: 1,
    });

    let acknowledgement: Promise<unknown> | undefined;
    const requestReceived = new Promise<void>(resolve =>
      socket?.once('message', data => {
        const envelope = JSON.parse(data.toString()) as {messageId: string; sessionId: string; type: string};
        expect(envelope.type).toBe('controls.query');
        acknowledgement = new Promise<unknown>(resolveAck =>
          socket?.once('message', ack => resolveAck(JSON.parse(ack.toString()))),
        );
        socket?.send(
          JSON.stringify({
            protocolVersion: 1,
            sessionId: envelope.sessionId,
            messageId: 'reply-query-1',
            type: 'response',
            body: {requestMessageId: envelope.messageId, result: {nodes: []}},
          }),
        );
        resolve();
      }),
    );
    const response = await driver.transport.request('session-1', 'controls.query', {filter: {}});
    await requestReceived;
    expect(response).toMatchObject({type: 'response', body: {result: {nodes: []}}});
    expect(await acknowledgement).toMatchObject({
      type: 'ack',
      sessionId: 'session-1',
      body: {ackMessageId: 'reply-query-1'},
    });
  });

  it('traces command and Runtime event boundaries without recording payloads or credentials', async () => {
    const traces: Readonly<Record<string, unknown>>[] = [];
    const driver = createAutomationDriverServer({
      token: 'driver-secret-token',
      port: 0,
      onDiagnostic: trace => traces.push(trace),
    });
    close = driver.close;
    await waitFor(() => (driver.server.address() && typeof driver.server.address() === 'object' ? true : null));
    const address = driver.server.address();
    if (address === null || typeof address === 'string') throw new Error('TEST_SERVER_ADDRESS_MISSING');
    socket = new WebSocket(`ws://127.0.0.1:${address.port}/automation`);
    await new Promise<void>((resolve, reject) => {
      socket?.once('open', resolve);
      socket?.once('error', reject);
    });
    const welcome = new Promise<void>((resolve, reject) => {
      socket?.once('message', data => {
        const envelope = JSON.parse(data.toString()) as {type: string};
        if (envelope.type === 'welcome') resolve();
        else reject(new Error('AUTOMATION_WELCOME_MISMATCH'));
      });
    });
    socket.send(
      JSON.stringify({
        protocolVersion: 1,
        sessionId: 'session-trace',
        messageId: 'hello-trace',
        type: 'hello',
        body: {
          sessionToken: 'driver-secret-token',
          runtimeId: 'runtime-trace',
          localNodeId: 'node-trace',
          appName: 'sample-terminal',
          buildVersion: 'build-trace',
        },
      }),
    );
    await welcome;
    socket.on('message', data => {
      const envelope = JSON.parse(data.toString()) as {sessionId: string; messageId: string; type: string};
      if (envelope.type !== 'command.dispatch') return;
      socket?.send(
        JSON.stringify({
          protocolVersion: 1,
          sessionId: envelope.sessionId,
          messageId: 'reply-command-trace',
          type: 'response',
          body: {requestMessageId: envelope.messageId, result: {secret: 'command-private-payload'}},
        }),
      );
    });
    const response = await driver.request('session-trace', 'command.dispatch', {
      commandName: 'sample.traceCommand',
      requestId: 'operation-trace',
      payload: {credential: 'credential-private-payload'},
    });
    expect(response.type).toBe('response');
    socket.send(
      JSON.stringify({
        protocolVersion: 1,
        sessionId: 'session-trace',
        messageId: 'runtime-event-trace',
        type: 'event',
        body: {
          requestId: 'operation-trace',
          sequence: 5,
          event: {kind: 'actor.completed', commandId: 'command-trace', actorKey: 'sample.actor', status: 'completed'},
          value: {secret: 'selector-private-value'},
        },
      }),
    );
    await waitFor(() => (traces.some(entry => entry.event === 'runtime.event') ? true : null));

    const serialized = JSON.stringify(traces);
    expect(traces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({event: 'session.authenticated', appName: 'sample-terminal'}),
        expect.objectContaining({
          event: 'request.started',
          commandName: 'sample.traceCommand',
          requestId: 'operation-trace',
        }),
        expect.objectContaining({event: 'request.completed', messageType: 'command.dispatch'}),
        expect.objectContaining({event: 'runtime.request.response'}),
        expect.objectContaining({event: 'runtime.event', actorKey: 'sample.actor'}),
      ]),
    );
    for (const forbidden of [
      'driver-secret-token',
      'credential-private-payload',
      'command-private-payload',
      'selector-private-value',
    ])
      expect(serialized).not.toContain(forbidden);
  });

  it('keeps two authenticated Runtime sessions independently addressable', async () => {
    const driver = createAutomationDriverServer({token: 'test-token', port: 0});
    close = driver.close;
    await waitFor(() => (driver.server.address() && typeof driver.server.address() === 'object' ? true : null));
    const address = driver.server.address();
    if (address === null || typeof address === 'string') throw new Error('TEST_SERVER_ADDRESS_MISSING');
    const connect = async (sessionId: string): Promise<WebSocket> => {
      const client = new WebSocket(`ws://127.0.0.1:${address.port}/automation`);
      await new Promise<void>((resolve, reject) => {
        client.once('open', resolve);
        client.once('error', reject);
      });
      const welcome = new Promise<void>((resolve, reject) => {
        client.once('message', data => {
          const envelope = JSON.parse(data.toString()) as {type: string; sessionId: string};
          if (envelope.type === 'welcome' && envelope.sessionId === sessionId) resolve();
          else reject(new Error('AUTOMATION_WELCOME_MISMATCH'));
        });
      });
      client.send(
        JSON.stringify({
          protocolVersion: 1,
          sessionId,
          messageId: `hello-${sessionId}`,
          type: 'hello',
          body: {
            sessionToken: 'test-token',
            runtimeId: `runtime-${sessionId}`,
            localNodeId: `node-${sessionId}`,
            appName: 'sample-terminal',
            buildVersion: 'test-build',
          },
        }),
      );
      await welcome;
      return client;
    };

    const first = await connect('session-a');
    socket = first;
    const second = await connect('session-b');
    expect(
      driver
        .getSessions()
        .map(session => session.sessionId)
        .sort(),
    ).toEqual(['session-a', 'session-b']);
    expect(driver.getSession('session-a')?.runtimeId).toBe('runtime-session-a');
    expect(driver.getSession('session-b')?.runtimeId).toBe('runtime-session-b');
    second.close();
  });

  it('rejects an incorrect credential before creating a session', async () => {
    const driver = createAutomationDriverServer({token: 'expected', port: 0});
    close = driver.close;
    await waitFor(() => (driver.server.address() && typeof driver.server.address() === 'object' ? true : null));
    const address = driver.server.address();
    if (address === null || typeof address === 'string') throw new Error('TEST_SERVER_ADDRESS_MISSING');
    socket = new WebSocket(`ws://127.0.0.1:${address.port}/automation`);
    const closed = new Promise<number>(resolve => socket?.once('close', code => resolve(code)));
    await new Promise<void>((resolve, reject) => {
      socket?.once('open', resolve);
      socket?.once('error', reject);
    });
    socket.send(
      JSON.stringify({
        protocolVersion: 1,
        sessionId: 'session-1',
        messageId: 'hello-1',
        type: 'hello',
        body: {sessionToken: 'wrong', runtimeId: 'runtime-1', localNodeId: 'node-1', appName: 'app', buildVersion: 'v'},
      }),
    );
    expect(await closed).toBe(4003);
    expect(driver.getSession()).toBeNull();
    expect(driver.getDiagnostics()).toMatchObject({
      socketConnections: 1,
      authenticatedSessions: 0,
      rejectedMessages: 1,
      activeSessions: 0,
    });
  });

  it('rejects unknown hello body fields before creating a session', async () => {
    const driver = createAutomationDriverServer({token: 'expected', port: 0});
    close = driver.close;
    await waitFor(() => (driver.server.address() && typeof driver.server.address() === 'object' ? true : null));
    const address = driver.server.address();
    if (address === null || typeof address === 'string') throw new Error('TEST_SERVER_ADDRESS_MISSING');
    socket = new WebSocket(`ws://127.0.0.1:${address.port}/automation`);
    const closed = new Promise<number>(resolve => socket?.once('close', code => resolve(code)));
    await new Promise<void>((resolve, reject) => {
      socket?.once('open', resolve);
      socket?.once('error', reject);
    });
    socket.send(
      JSON.stringify({
        protocolVersion: 1,
        sessionId: 'session-1',
        messageId: 'hello-1',
        type: 'hello',
        body: {
          sessionToken: 'expected',
          runtimeId: 'runtime-1',
          localNodeId: 'node-1',
          appName: 'sample-terminal',
          buildVersion: 'test-build',
          extra: true,
        },
      }),
    );
    expect(await closed).toBe(4003);
    expect(driver.getSession()).toBeNull();
  });
});
