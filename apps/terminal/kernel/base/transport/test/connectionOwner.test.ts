import {describe, expect, it, vi} from 'vitest';
import type {TransportConnectionEvent, TransportManagedConnection, TransportNetworkAdapter} from '../src/index';
import {createTransportConnectionOwner, transportReconnectDelayMs} from '../src/index';

class ControlledTimers {
  now = 0;
  active = 0;
  maximumActive = 0;
  private jobs: Array<{at: number; cancelled: boolean; callback: () => void}> = [];
  readonly schedule = (delayMs: number, callback: () => void): (() => void) => {
    const job = {at: this.now + delayMs, cancelled: false, callback};
    this.jobs.push(job);
    this.active += 1;
    this.maximumActive = Math.max(this.maximumActive, this.active);
    return () => {
      if (job.cancelled) return;
      job.cancelled = true;
      this.active -= 1;
    };
  };
  async advanceBy(deltaMs: number): Promise<void> {
    const target = this.now + deltaMs;
    for (;;) {
      this.jobs.sort((left, right) => left.at - right.at);
      const next = this.jobs.find(job => !job.cancelled && job.at <= target);
      if (next === undefined) break;
      this.jobs = this.jobs.filter(job => job !== next);
      this.now = next.at;
      this.active -= 1;
      next.callback();
      await Promise.resolve();
    }
    this.now = target;
  }
}

const makeConnection = (): TransportManagedConnection & Readonly<{emit: (event: TransportConnectionEvent) => void}> => {
  const listeners = new Set<(event: TransportConnectionEvent) => void>();
  return {
    send: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit: event => {
      for (const listener of listeners) listener(event);
    },
  };
};

const snapshot = (addresses = ['primary', 'backup']) => ({
  serverName: 'terminal-data-server',
  revision: 1,
  addresses: addresses.map(addressName => ({addressName, baseUrl: `ws://${addressName}.example/terminal`})),
});
const reconnectPolicy = Object.freeze({
  initialDelayMs: 10_000,
  incrementMs: 1_000,
  maximumDelayMs: 300_000,
  maximumJitterRatio: 0.5,
  cappedDelayFloorRatio: 5 / 6,
  readyTimeoutMs: 20_000,
  networkRecoveryMinimumIntervalMs: 10_000,
});

describe('transport connection owner', () => {
  it('keeps the first retry at ten seconds, applies jitter, and spreads the capped interval', () => {
    expect(transportReconnectDelayMs(1, {jitter: 0, cap: 0}, reconnectPolicy)).toBe(10_000);
    expect(transportReconnectDelayMs(1, {jitter: 1, cap: 1}, reconnectPolicy)).toBe(15_000);
    expect(transportReconnectDelayMs(2, {jitter: 0, cap: 0}, reconnectPolicy)).toBe(11_000);
    expect(transportReconnectDelayMs(2, {jitter: 1, cap: 1}, reconnectPolicy)).toBe(16_500);
    expect(transportReconnectDelayMs(291, {jitter: 0.5, cap: 0.2}, reconnectPolicy)).toBe(260_000);
    expect(transportReconnectDelayMs(291, {jitter: 0.5, cap: 0.8}, reconnectPolicy)).toBe(290_000);
  });

  it('rotates handshake failures, then keeps the ready address preferred after REDIRECT_TO_NEXT_NODE', async () => {
    const timers = new ControlledTimers();
    const connection = makeConnection();
    const diagnostics: Array<{event: string; profileId: string; data?: Readonly<Record<string, unknown>>}> = [];
    const connect = vi.fn(async ({address}: {address: {addressName: string}}) => {
      if (address.addressName === 'primary') {
        throw Object.assign(new Error('connection refused'), {code: 'ECONNREFUSED'});
      }
      return connection;
    });
    const adapter: TransportNetworkAdapter = {readSnapshot: async () => snapshot(), connect};
    const internal: Array<{kind: string; profileId: string; token: number}> = [];
    const owner = createTransportConnectionOwner({
      adapter,
      now: () => timers.now,
      random: () => 0,
      schedule: timers.schedule,
      dispatchInternal: (kind, profileId, token) => internal.push({kind, profileId, token}),
      diagnose: (event, profileId, data) => diagnostics.push({event, profileId, data}),
    });

    await owner.start({profileId: 'ter', serverName: 'terminal-data-server', reconnectPolicy});
    expect(connect.mock.calls.map(call => call[0].address.addressName)).toEqual(['primary', 'backup']);
    expect(diagnostics).toContainEqual({
      event: 'connect-candidate-failed',
      profileId: 'ter',
      data: expect.objectContaining({
        addressName: 'primary',
        revision: 1,
        errorName: 'Error',
        errorCode: 'ECONNREFUSED',
      }),
    });
    expect(JSON.stringify(diagnostics)).not.toContain('connection refused');
    const events: TransportConnectionEvent[] = [];
    const channel = owner.connectionFor('ter');
    channel.subscribe(event => events.push(event));
    await channel.send('{"type":"AUTHENTICATE"}');
    owner.ready('ter', 1_000);
    expect(connection.send).toHaveBeenCalledTimes(1);
    expect(events).toEqual([{type: 'open', addressName: 'backup', configRevision: 1}]);

    await owner.invalid('ter', 'REDIRECT_TO_NEXT_NODE');
    expect(connection.close).toHaveBeenCalledTimes(1);
    expect(internal).toEqual([]);
    await timers.advanceBy(10_000);
    expect(internal).toEqual([expect.objectContaining({kind: 'retry', profileId: 'ter'})]);
    const retry = internal[0]!;
    await owner.retryDue(retry.profileId, retry.token);
    expect(connect.mock.calls.map(call => call[0].address.addressName)).toEqual(['primary', 'backup', 'backup']);
    await owner.dispose();
  });

  it('records safe socket failure codes and connection identity without logging raw reasons', async () => {
    const connection = makeConnection();
    const diagnostics: Array<{event: string; profileId: string; data?: Readonly<Record<string, unknown>>}> = [];
    const owner = createTransportConnectionOwner({
      adapter: {readSnapshot: async () => snapshot(['primary']), connect: async () => connection},
      dispatchInternal: () => undefined,
      diagnose: (event, profileId, data) => diagnostics.push({event, profileId, data}),
    });

    await owner.start({profileId: 'ter', serverName: 'terminal-data-server', reconnectPolicy});
    connection.emit({type: 'error', reason: 'NETWORK_ERROR'});
    connection.emit({type: 'close', code: 1006, reason: 'private-token=do-not-log'});

    expect(diagnostics).toContainEqual({
      event: 'socket-error-observed',
      profileId: 'ter',
      data: expect.objectContaining({addressName: 'primary', revision: 1, reasonCode: 'NETWORK_ERROR'}),
    });
    expect(diagnostics).toContainEqual({
      event: 'socket-closed',
      profileId: 'ter',
      data: expect.objectContaining({addressName: 'primary', revision: 1, closeCode: 1006, reasonCode: 'UNCLASSIFIED'}),
    });
    expect(JSON.stringify(diagnostics)).not.toContain('private-token');
    await owner.dispose();
  });

  it('passes an origin-relative route without interpretation and rejects origin escapes', async () => {
    const connection = makeConnection();
    const connect = vi.fn(async () => connection);
    const adapter: TransportNetworkAdapter = {readSnapshot: async () => snapshot(['primary']), connect};
    const owner = createTransportConnectionOwner({adapter, dispatchInternal: () => undefined});

    await owner.start({
      profileId: 'ter',
      serverName: 'terminal-data-server',
      endpointPathAndQuery: '/tdp/aurora/ws?x=1',
      reconnectPolicy,
    });
    expect(connect.mock.calls[0]?.[0].endpointPathAndQuery).toBe('/tdp/aurora/ws?x=1');
    await owner.stop('ter');

    const invalidPaths = [
      '//attacker.invalid/ws',
      'https://attacker.invalid/ws',
      '/tdp\\workspace/ws',
      '/tdp/workspace/ws#fragment',
      '/tdp/workspace/\u0000ws',
    ];
    for (const [index, endpointPathAndQuery] of invalidPaths.entries()) {
      await expect(
        owner.start({
          profileId: `escape-${index}`,
          serverName: 'terminal-data-server',
          endpointPathAndQuery,
          reconnectPolicy,
        }),
      ).rejects.toThrow('TRANSPORT_ENDPOINT_PATH_INVALID');
    }
    expect(connect).toHaveBeenCalledTimes(1);
    await owner.dispose();
  });

  it('retains a connection whose close failed so runtime disposal can retry it', async () => {
    const timers = new ControlledTimers();
    const connection = makeConnection();
    connection.close = vi
      .fn<TransportManagedConnection['close']>()
      .mockRejectedValueOnce(new Error('adapter close failed'))
      .mockResolvedValue(undefined);
    const owner = createTransportConnectionOwner({
      adapter: {readSnapshot: async () => snapshot(['primary']), connect: async () => connection},
      now: () => timers.now,
      schedule: timers.schedule,
      dispatchInternal: () => undefined,
    });

    await owner.start({profileId: 'ter', serverName: 'terminal-data-server', reconnectPolicy});
    await expect(owner.stop('ter')).rejects.toThrow('adapter close failed');
    expect(connection.close).toHaveBeenCalledTimes(1);

    await owner.dispose();
    expect(connection.close).toHaveBeenCalledTimes(2);
  });

  it('expedites a pending retry after network recovery without retrying inside the ten-second floor', async () => {
    const timers = new ControlledTimers();
    let calls = 0;
    const connection = makeConnection();
    const adapter: TransportNetworkAdapter = {
      readSnapshot: async () => snapshot(['primary']),
      connect: async () => {
        calls += 1;
        if (calls === 1) throw new Error('DNS failure');
        return connection;
      },
    };
    const internal: Array<{kind: string; profileId: string; token: number}> = [];
    const owner = createTransportConnectionOwner({
      adapter,
      now: () => timers.now,
      random: () => 0,
      schedule: timers.schedule,
      dispatchInternal: (kind, profileId, token) => internal.push({kind, profileId, token}),
    });

    await owner.start({profileId: 'ter', serverName: 'terminal-data-server', reconnectPolicy});
    expect(calls).toBe(1);
    timers.now = 2_000;
    owner.networkStatusChanged(false);
    owner.networkStatusChanged(true);
    await timers.advanceBy(7_999);
    expect(internal).toHaveLength(0);
    await timers.advanceBy(1);
    expect(internal).toHaveLength(1);
    expect(internal[0]?.kind).toBe('retry');
    const retry = internal[0]!;
    await owner.retryDue(retry.profileId, retry.token);
    expect(calls).toBe(2);
    await owner.dispose();
  });

  it('starts immediately, follows the increasing delay, and sustains 1000 failures with one timer', async () => {
    const timers = new ControlledTimers();
    const internal: Array<{kind: string; profileId: string; token: number}> = [];
    const connect = vi.fn(async () => {
      throw new Error('connection unavailable');
    });
    const owner = createTransportConnectionOwner({
      adapter: {readSnapshot: async () => snapshot(['primary']), connect},
      now: () => timers.now,
      random: () => 0,
      schedule: timers.schedule,
      dispatchInternal: (kind, profileId, token) => internal.push({kind, profileId, token}),
    });

    await owner.start({profileId: 'ter', serverName: 'terminal-data-server', reconnectPolicy});
    expect(connect).toHaveBeenCalledTimes(1);
    expect(timers.active).toBe(1);
    await timers.advanceBy(9_999);
    expect(internal).toHaveLength(0);
    await timers.advanceBy(1);
    expect(internal).toHaveLength(1);
    const firstRetry = internal.shift()!;
    await owner.retryDue(firstRetry.profileId, firstRetry.token);
    // The first timer fired at 10 seconds; reconnect number 2 schedules 11 seconds.
    expect(connect).toHaveBeenCalledTimes(2);
    expect(timers.active).toBe(1);

    for (let attempts = 2; attempts < 1_000; attempts += 1) {
      await timers.advanceBy(300_000);
      const retry = internal.shift();
      expect(retry?.kind).toBe('retry');
      if (retry === undefined) throw new Error('transport retry timer did not fire');
      await owner.retryDue(retry.profileId, retry.token);
    }
    expect(connect).toHaveBeenCalledTimes(1_000);
    expect(timers.maximumActive).toBe(1);
    await owner.dispose();
    expect(timers.active).toBe(0);
  });

  it('rotates after an opened socket misses SESSION_READY and retries on the next address', async () => {
    const timers = new ControlledTimers();
    const internal: Array<{kind: string; profileId: string; token: number}> = [];
    const connect = vi.fn(async () => makeConnection());
    const owner = createTransportConnectionOwner({
      adapter: {readSnapshot: async () => snapshot(), connect},
      now: () => timers.now,
      random: () => 0,
      schedule: timers.schedule,
      dispatchInternal: (kind, profileId, token) => internal.push({kind, profileId, token}),
    });

    await owner.start({profileId: 'ter', serverName: 'terminal-data-server', reconnectPolicy});
    expect(connect.mock.calls.map(call => call[0].address.addressName)).toEqual(['primary']);
    await timers.advanceBy(reconnectPolicy.readyTimeoutMs);
    const timeout = internal.find(item => item.kind === 'ready-timeout');
    expect(timeout).toBeDefined();
    await owner.readyTimeout(timeout!.profileId, timeout!.token);
    await timers.advanceBy(10_000);
    const retry = internal.find(item => item.kind === 'retry');
    expect(retry).toBeDefined();
    await owner.retryDue(retry!.profileId, retry!.token);

    expect(connect.mock.calls.map(call => call[0].address.addressName)).toEqual(['primary', 'backup']);
    await owner.dispose();
  });

  it('applies the ten-second floor when connectivity recovers during an in-flight attempt', async () => {
    const timers = new ControlledTimers();
    const internal: Array<{kind: string; profileId: string; token: number}> = [];
    let rejectConnect: ((reason: Error) => void) | undefined;
    const connect = vi.fn(
      () =>
        new Promise<TransportManagedConnection>((_resolve, reject) => {
          rejectConnect = reject;
        }),
    );
    const owner = createTransportConnectionOwner({
      adapter: {readSnapshot: async () => snapshot(['primary']), connect},
      now: () => timers.now,
      random: () => 0,
      schedule: timers.schedule,
      dispatchInternal: (kind, profileId, token) => internal.push({kind, profileId, token}),
    });

    const starting = owner.start({profileId: 'ter', serverName: 'terminal-data-server', reconnectPolicy});
    await Promise.resolve();
    timers.now = 3_000;
    owner.networkStatusChanged(false);
    owner.networkStatusChanged(true);
    rejectConnect?.(new Error('transient network failure'));
    await starting;
    await timers.advanceBy(6_999);
    expect(internal).toHaveLength(0);
    await timers.advanceBy(1);
    expect(internal).toHaveLength(1);
    expect(internal[0]?.kind).toBe('retry');
    await owner.dispose();
  });

  it('keeps network-flap retries at or above the ten-second floor for two minutes', async () => {
    const timers = new ControlledTimers();
    const retryEvents: Array<{kind: string; profileId: string; token: number}> = [];
    const retryTimes: number[] = [];
    const connect = vi.fn(async () => {
      throw new Error('connection unavailable');
    });
    const owner = createTransportConnectionOwner({
      adapter: {readSnapshot: async () => snapshot(['primary']), connect},
      now: () => timers.now,
      random: () => 0,
      schedule: timers.schedule,
      dispatchInternal: (kind, profileId, token) => retryEvents.push({kind, profileId, token}),
    });

    await owner.start({profileId: 'ter', serverName: 'terminal-data-server', reconnectPolicy});
    for (let second = 1; second <= 120; second += 1) {
      await timers.advanceBy(1_000);
      while (retryEvents.length > 0) {
        const event = retryEvents.shift()!;
        if (event.kind === 'retry') {
          retryTimes.push(timers.now);
          await owner.retryDue(event.profileId, event.token);
        }
      }
      owner.networkStatusChanged(second % 2 === 0);
    }
    expect(connect).toHaveBeenCalledTimes(12);
    expect(timers.maximumActive).toBeLessThanOrEqual(1);
    expect(retryTimes.length).toBe(11);
    expect(retryTimes.every((time, index) => index === 0 || time - retryTimes[index - 1]! >= 10_000)).toBe(true);
    await owner.dispose();
  });

  it('replays the active address to late subscribers and removes listeners on unsubscribe', async () => {
    const timers = new ControlledTimers();
    const connection = makeConnection();
    const owner = createTransportConnectionOwner({
      adapter: {readSnapshot: async () => snapshot(['primary']), connect: async () => connection},
      now: () => timers.now,
      schedule: timers.schedule,
      dispatchInternal: () => undefined,
    });
    await owner.start({profileId: 'ter', serverName: 'terminal-data-server', reconnectPolicy});
    const events: TransportConnectionEvent[] = [];
    const unsubscribe = owner.connectionFor('ter').subscribe(event => events.push(event));
    expect(events).toEqual([{type: 'open', addressName: 'primary', configRevision: 1}]);
    connection.emit({type: 'message', raw: '{"type":"SESSION_READY"}'});
    unsubscribe();
    connection.emit({type: 'message', raw: '{"type":"PING"}'});
    expect(events).toEqual([
      {type: 'open', addressName: 'primary', configRevision: 1},
      {type: 'message', raw: '{"type":"SESSION_READY"}'},
    ]);
    await owner.dispose();
  });

  it('publishes exactly one open signal when a resolved adapter also reports its socket open event', async () => {
    const timers = new ControlledTimers();
    const createSocket = (): TransportManagedConnection => ({
      send: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
      subscribe: listener => {
        listener({type: 'open'});
        return () => undefined;
      },
    });
    const sockets = [createSocket(), createSocket()];
    let connectCount = 0;
    const internal: Array<{kind: string; profileId: string; token: number}> = [];
    const owner = createTransportConnectionOwner({
      adapter: {
        readSnapshot: async () => snapshot(['primary']),
        connect: async () => sockets[connectCount++]!,
      },
      now: () => timers.now,
      random: () => 0,
      schedule: timers.schedule,
      dispatchInternal: (kind, profileId, token) => internal.push({kind, profileId, token}),
    });

    await owner.start({profileId: 'ter', serverName: 'terminal-data-server', reconnectPolicy});
    const events: TransportConnectionEvent[] = [];
    owner.connectionFor('ter').subscribe(event => events.push(event));
    expect(events).toEqual([{type: 'open', addressName: 'primary', configRevision: 1}]);

    await owner.invalid('ter', 'NODE_UNAVAILABLE');
    await timers.advanceBy(10_000);
    const retry = internal[0]!;
    await owner.retryDue(retry.profileId, retry.token);

    expect(connectCount).toBe(2);
    expect(events).toEqual([
      {type: 'open', addressName: 'primary', configRevision: 1},
      {type: 'open', addressName: 'primary', configRevision: 1},
    ]);
    await owner.dispose();
  });

  it('retries not-delivered HTTP attempts, preserves request fields, and stops on unsafe delivered failures', async () => {
    const calls: unknown[] = [];
    let forceDeliveredFailure = false;
    const adapter: TransportNetworkAdapter = {
      readSnapshot: async () => ({
        ...snapshot(),
        serverName: 'terminal-business-api',
        addresses: [
          {addressName: 'primary', baseUrl: 'https://primary.example', timeoutMs: 7_500},
          {addressName: 'backup', baseUrl: 'https://backup.example'},
        ],
      }),
      connect: async () => makeConnection(),
      sendHttp: async input => {
        calls.push(input);
        if (forceDeliveredFailure)
          return {kind: 'failure', category: 'delivered-failure', code: 'RESPONSE_BODY_UNAVAILABLE'};
        if (calls.length === 1) return {kind: 'failure', category: 'not-delivered', code: 'DNS_FAILURE'};
        return {kind: 'failure', category: 'delivered-failure', code: 'RESPONSE_BODY_UNAVAILABLE'};
      },
    };
    const owner = createTransportConnectionOwner({adapter, dispatchInternal: () => undefined});
    const request = {
      profileId: 'terminal-data-client:http',
      serverName: 'terminal-business-api',
      method: 'POST',
      pathAndQuery: '/api/terminal/group-workspaces/workspace-1/activation',
      headers: {'Content-Type': 'application/json'},
      body: {activationCode: 'activation-code', credentialSecret: 'secret'},
      safeRetryable: false,
    } as const;

    const result = await owner.executeHttp(request);
    expect(result).toEqual({kind: 'failure', category: 'delivered-failure', code: 'RESPONSE_BODY_UNAVAILABLE'});
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      address: {addressName: 'primary'},
      timeoutMs: 7_500,
      method: 'POST',
      pathAndQuery: request.pathAndQuery,
      headers: request.headers,
      body: request.body,
    });
    expect(calls[1]).toMatchObject({address: {addressName: 'backup'}, timeoutMs: 5_000});

    calls.length = 0;
    forceDeliveredFailure = true;
    await owner.executeHttp(request);
    expect(calls).toHaveLength(1);

    calls.length = 0;
    const safeDeliveredRetry = await owner.executeHttp({...request, safeRetryable: true});
    expect(safeDeliveredRetry).toMatchObject({kind: 'failure', category: 'delivered-failure'});
    expect(calls.map(call => (call as {address: {addressName: string}}).address.addressName)).toEqual([
      'primary',
      'backup',
    ]);
    await owner.dispose();
  });

  it('keeps the first address preferred until the caller accepts a typed business response', async () => {
    const calls: string[] = [];
    const adapter: TransportNetworkAdapter = {
      readSnapshot: async () => snapshot(),
      connect: async () => makeConnection(),
      sendHttp: async input => {
        calls.push(input.address.addressName);
        return {
          kind: 'response',
          status: 409,
          body: {errorCode: 'BUSINESS_REJECTION'},
          requestId: 'req-owner-001',
          correlationId: 'corr-owner-001',
        };
      },
    };
    const owner = createTransportConnectionOwner({adapter, dispatchInternal: () => undefined});
    const request = {
      profileId: 'terminal-data-client:http',
      serverName: 'terminal-data-server',
      method: 'POST',
      pathAndQuery: '/activation',
      headers: {},
      safeRetryable: true,
    } as const;

    const first = await owner.executeHttp(request);
    expect(first).toMatchObject({
      kind: 'response',
      addressName: 'primary',
      configRevision: 1,
      requestId: 'req-owner-001',
      correlationId: 'corr-owner-001',
    });
    await owner.executeHttp(request);
    expect(calls).toEqual(['primary', 'primary']);
    owner.reportHttpAddressAvailable({
      profileId: request.profileId,
      serverName: request.serverName,
      addressName: 'backup',
      configRevision: 1,
    });
    await owner.executeHttp(request);
    expect(calls).toEqual(['primary', 'primary', 'backup']);
    await owner.dispose();
  });

  it('keeps only bounded safe response identity values for downstream diagnostics', async () => {
    const adapter: TransportNetworkAdapter = {
      readSnapshot: async () => snapshot(),
      connect: async () => makeConnection(),
      sendHttp: async () => ({
        kind: 'response',
        status: 409,
        body: {errorCode: 'BUSINESS_REJECTION'},
        requestId: 'req-owner-002',
        correlationId: `unsafe${'x'.repeat(128)}`,
      }),
    };
    const owner = createTransportConnectionOwner({adapter, dispatchInternal: () => undefined});
    const result = await owner.executeHttp({
      profileId: 'terminal-data-client:http',
      serverName: 'terminal-data-server',
      method: 'POST',
      pathAndQuery: '/activation',
      headers: {},
      safeRetryable: true,
    });

    expect(result).toMatchObject({kind: 'response', requestId: 'req-owner-002'});
    expect(result).not.toHaveProperty('correlationId');
    await owner.dispose();
  });

  it('logs non-success HTTP status and attempt identity without request or response secrets', async () => {
    const diagnostics: Array<{event: string; profileId: string; data?: Readonly<Record<string, unknown>>}> = [];
    const owner = createTransportConnectionOwner({
      adapter: {
        readSnapshot: async serverName => ({...snapshot(['primary']), serverName}),
        connect: async () => makeConnection(),
        sendHttp: async () => ({
          kind: 'response',
          status: 503,
          body: {detail: 'response-secret'},
          requestId: 'req-http-503',
        }),
      },
      diagnose: (event, profileId, data) => diagnostics.push({event, profileId, data}),
      now: () => 120,
    });

    const result = await owner.executeHttp({
      profileId: 'terminal-data-client:http',
      serverName: 'terminal-business-api',
      method: 'POST',
      pathAndQuery: '/api/private/workspace-secret/activation?token=query-secret',
      headers: {Authorization: 'Bearer header-secret'},
      body: {credentialSecret: 'body-secret'},
      safeRetryable: false,
    });

    expect(result).toMatchObject({kind: 'response', status: 503, addressName: 'primary'});
    expect(diagnostics).toContainEqual({
      event: 'http-response-non-success',
      profileId: 'terminal-data-client:http',
      data: expect.objectContaining({
        executionId: 'http-1',
        serverName: 'terminal-business-api',
        method: 'POST',
        addressName: 'primary',
        revision: 1,
        status: 503,
        requestId: 'req-http-503',
      }),
    });
    const serializedDiagnostics = JSON.stringify(diagnostics);
    for (const secret of ['workspace-secret', 'query-secret', 'header-secret', 'body-secret', 'response-secret'])
      expect(serializedDiagnostics).not.toContain(secret);
    await owner.dispose();
  });

  it('logs safe HTTP adapter error facts without exposing exception or request contents', async () => {
    const diagnostics: Array<{event: string; profileId: string; data?: Readonly<Record<string, unknown>>}> = [];
    const owner = createTransportConnectionOwner({
      adapter: {
        readSnapshot: async serverName => ({...snapshot(['primary']), serverName}),
        connect: async () => makeConnection(),
        sendHttp: async () => {
          throw Object.assign(new Error('secret-url and bearer-token'), {
            code: 'ECONNRESET',
            cause: Object.assign(new Error('private-proxy-password'), {code: 'EHOSTUNREACH'}),
          });
        },
      },
      diagnose: (event, profileId, data) => diagnostics.push({event, profileId, data}),
    });

    const result = await owner.executeHttp({
      profileId: 'terminal-data-client:http',
      serverName: 'terminal-business-api',
      method: 'POST',
      pathAndQuery: '/activation?token=private-query',
      headers: {Authorization: 'Bearer private-header'},
      body: {credentialSecret: 'private-body'},
      safeRetryable: false,
    });

    expect(result).toEqual({kind: 'failure', category: 'delivered-failure', code: 'HTTP_TRANSPORT_ERROR'});
    expect(diagnostics).toContainEqual({
      event: 'http-attempt-failed',
      profileId: 'terminal-data-client:http',
      data: expect.objectContaining({
        addressName: 'primary',
        category: 'delivered-failure',
        code: 'HTTP_TRANSPORT_ERROR',
        errorName: 'Error',
        errorCode: 'ECONNRESET',
        causeName: 'Error',
        causeCode: 'EHOSTUNREACH',
      }),
    });
    const serialized = JSON.stringify(diagnostics);
    for (const secret of [
      'secret-url',
      'bearer-token',
      'private-proxy-password',
      'private-query',
      'private-header',
      'private-body',
    ])
      expect(serialized).not.toContain(secret);
    await owner.dispose();
  });

  it('does not expose an HTTP response after the effective network revision changes in flight', async () => {
    let revision = 1;
    let completeResponse!: () => void;
    const responseStarted = new Promise<void>(resolve => {
      completeResponse = resolve;
    });
    let releaseResponse!: () => void;
    const responseCanFinish = new Promise<void>(resolve => {
      releaseResponse = resolve;
    });
    const adapter: TransportNetworkAdapter = {
      readSnapshot: async () => ({...snapshot(), serverName: 'terminal-business-api', revision}),
      connect: async () => makeConnection(),
      sendHttp: async () => {
        completeResponse();
        await responseCanFinish;
        return {kind: 'response', status: 200, body: {groupWorkspaceKey: 'old-space'}};
      },
    };
    const owner = createTransportConnectionOwner({adapter, dispatchInternal: () => undefined});
    const request = {
      profileId: 'terminal-data-client:http',
      serverName: 'terminal-business-api',
      method: 'POST',
      pathAndQuery: '/activation',
      headers: {},
      body: {activationCode: '01234567'},
      safeRetryable: true,
    } as const;

    const execution = owner.executeHttp(request);
    await responseStarted;
    revision = 2;
    releaseResponse();

    expect(await execution).toEqual({
      kind: 'failure',
      category: 'delivered-failure',
      code: 'HTTP_NETWORK_CONFIGURATION_CHANGED',
    });
    await owner.dispose();
  });
});
