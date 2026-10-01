import {describe, expect, it, vi} from 'vitest';
import {
  createTransportModule,
  transportHttpAddressAvailableCommand,
  transportHttpRequestCommand,
  transportNetworkStatusChangedCommand,
  transportRetryDueCommand,
  transportStartCommand,
} from '../src/index';
import type {TransportConnectionEvent, TransportManagedConnection} from '../src/index';
import type {RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';

describe('transport module command facade', () => {
  it('executes generic HTTP only through the owner command and keeps request data out of command payloads', async () => {
    const sent: unknown[] = [];
    const transportModule = createTransportModule({
      networkAdapter: {
        readSnapshot: async serverName => ({
          serverName,
          revision: 3,
          addresses: [{addressName: 'primary', baseUrl: 'https://primary.example'}],
          proxy: {
            protocol: 'http',
            host: 'proxy.example',
            port: 8080,
            username: 'user',
            password: 'proxy-secret',
          },
        }),
        connect: async () => {
          throw new Error('websocket not used in HTTP proof');
        },
        sendHttp: async request => {
          sent.push(request);
          return {kind: 'response', status: 200, body: {accepted: true}};
        },
      },
    });
    const actor = transportModule.actorDefinitions?.[0];
    if (actor === undefined) throw new Error('transport actor missing');
    const dispatched: Array<{commandName: string; payload: StateJsonValue; requestId?: string}> = [];
    const dispatchCommand = async (
      command: {commandName: string},
      payload: StateJsonValue,
      options?: {requestId?: string},
    ) => {
      dispatched.push({
        commandName: command.commandName,
        payload,
        ...(options?.requestId === undefined ? {} : {requestId: options.requestId}),
      });
      const handler = actor.handlers.find(candidate => candidate.commandName === command.commandName);
      if (handler === undefined) throw new Error(`transport command handler missing: ${command.commandName}`);
      const value = await handler.handle({command: {payload}} as never);
      return {status: 'completed', value} as never;
    };
    const unavailable = (capability: string) => ({
      status: 'unavailable',
      port: 'device',
      capability,
      reason: 'PLATFORM_UNSUPPORTED',
      message: `${capability} unavailable`,
    });
    const cleanup: Array<() => Promise<void>> = [];
    const context = {
      localNodeId: 'test-node',
      platformPorts: {
        device: {
          getNetworkStatus: async () => unavailable('getNetworkStatus'),
          subscribeNetworkStatus: async () => unavailable('subscribeNetworkStatus'),
          unsubscribeNetworkStatus: async () => unavailable('unsubscribeNetworkStatus'),
        },
        logger: {withContext: () => ({info: vi.fn(), warn: vi.fn()})},
      },
      dispatchCommand,
      registerAsyncResource: (resource: () => Promise<void>) => cleanup.push(resource),
    } as unknown as RuntimeModuleContext;
    await transportModule.install?.(context);

    const result = await transportModule.commandGateway.executeHttp({
      profileId: 'terminal-data-client:http',
      serverName: 'terminal-business-api',
      method: 'POST',
      pathAndQuery: '/activation',
      headers: {Authorization: 'Terminal 5.secret'},
      body: {credentialSecret: 'secret', activationCode: 'code'},
      safeRetryable: true,
    });
    expect(result).toMatchObject({kind: 'response', status: 200, addressName: 'primary', configRevision: 3});
    expect(sent[0]).toMatchObject({
      method: 'POST',
      pathAndQuery: '/activation',
      headers: {Authorization: 'Terminal 5.secret'},
      body: {credentialSecret: 'secret'},
    });
    expect(sent[0]).toMatchObject({
      proxy: {protocol: 'http', host: 'proxy.example', port: 8080, username: 'user', password: 'proxy-secret'},
    });
    const requestCommand = dispatched.find(command => command.commandName === transportHttpRequestCommand.commandName);
    expect(requestCommand).toBeDefined();
    expect(Object.keys(requestCommand?.payload as object)).toEqual(['requestId']);
    expect(JSON.stringify(requestCommand?.payload)).not.toContain('secret');

    await transportModule.commandGateway.reportHttpAddressAvailable({
      profileId: 'terminal-data-client:http',
      serverName: 'terminal-business-api',
      addressName: 'primary',
      configRevision: 3,
    });
    expect(dispatched.some(command => command.commandName === transportHttpAddressAvailableCommand.commandName)).toBe(
      true,
    );
    expect(
      dispatched
        .filter(
          command =>
            command.commandName === transportHttpRequestCommand.commandName ||
            command.commandName === transportHttpAddressAvailableCommand.commandName,
        )
        .every(command => command.requestId !== undefined),
    ).toBe(true);
    expect(JSON.stringify(dispatched)).not.toContain('proxy-secret');
    expect(JSON.stringify(dispatched)).not.toContain('activationCode');
    for (const release of cleanup) await release();
  });

  it('routes DevicePort network changes through the generic transport owner command only', async () => {
    let listener: ((event: {status: {connected: boolean}; observedAt: number}) => void) | undefined;
    const connection: TransportManagedConnection = {
      send: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
      subscribe: vi.fn((_onEvent: (event: TransportConnectionEvent) => void) => () => undefined),
    };
    const device = {
      getNetworkStatus: vi.fn(async () => ({status: 'succeeded', value: {connected: true}, completedAt: 1})),
      subscribeNetworkStatus: vi.fn(async (input: {listener: typeof listener}) => {
        listener = input.listener;
        return {status: 'succeeded', value: {subscriptionId: 'network-1'}, completedAt: 1};
      }),
      unsubscribeNetworkStatus: vi.fn(async () => ({status: 'succeeded', value: {completed: true}, completedAt: 1})),
    };
    const transportModule = createTransportModule({
      networkAdapter: {
        readSnapshot: async serverName => ({
          serverName,
          revision: 1,
          addresses: [{addressName: 'primary', baseUrl: 'ws://primary.example/terminal'}],
        }),
        connect: vi.fn(async () => connection),
      },
    });
    const actor = transportModule.actorDefinitions?.[0];
    if (actor === undefined) throw new Error('transport actor missing');
    const dispatched: string[] = [];
    const dispatchCommand = async (command: {commandName: string}, payload: StateJsonValue) => {
      dispatched.push(command.commandName);
      const handler = actor.handlers.find(candidate => candidate.commandName === command.commandName);
      if (handler === undefined) throw new Error(`transport command handler missing: ${command.commandName}`);
      const value = await handler.handle({command: {payload}} as never);
      return {status: 'completed', value} as never;
    };
    const cleanup: Array<() => Promise<void>> = [];
    const context = {
      localNodeId: 'test-node',
      platformPorts: {device, logger: {withContext: () => ({info: vi.fn(), warn: vi.fn()})}},
      dispatchCommand,
      registerAsyncResource: (resource: () => Promise<void>) => cleanup.push(resource),
    } as unknown as RuntimeModuleContext;
    await transportModule.install?.(context);

    await transportModule.commandGateway.start({
      profileId: 'terminal-data-client',
      serverName: 'terminal-data-server',
      reconnectPolicy: {
        initialDelayMs: 10_000,
        incrementMs: 1_000,
        maximumDelayMs: 300_000,
        maximumJitterRatio: 0.5,
        cappedDelayFloorRatio: 5 / 6,
        readyTimeoutMs: 20_000,
        networkRecoveryMinimumIntervalMs: 10_000,
      },
    });
    listener?.({status: {connected: true}, observedAt: 2});
    listener?.({status: {connected: false}, observedAt: 3});
    listener?.({status: {connected: false}, observedAt: 4});
    listener?.({status: {connected: true}, observedAt: 5});

    expect(dispatched).toEqual([
      transportStartCommand.commandName,
      transportNetworkStatusChangedCommand.commandName,
      transportNetworkStatusChangedCommand.commandName,
    ]);
    expect(device.getNetworkStatus).toHaveBeenCalledTimes(1);
    expect(device.subscribeNetworkStatus).toHaveBeenCalledTimes(1);
    expect(device.unsubscribeNetworkStatus).not.toHaveBeenCalled();
    for (const release of cleanup) await release();
    expect(device.unsubscribeNetworkStatus).toHaveBeenCalledWith({subscriptionId: 'network-1', timeoutMs: 5_000});
  });

  it('does not bypass the transport actor when a timer command is rejected', async () => {
    vi.useFakeTimers();
    try {
      const connection: TransportManagedConnection = {
        send: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
        subscribe: vi.fn(() => () => undefined),
      };
      const connect = vi
        .fn<() => Promise<TransportManagedConnection>>()
        .mockRejectedValueOnce(new Error('first connection attempt failed'))
        .mockResolvedValueOnce(connection);
      const transportModule = createTransportModule({
        networkAdapter: {
          readSnapshot: async serverName => ({
            serverName,
            revision: 1,
            addresses: [{addressName: 'primary', baseUrl: 'ws://primary.example/terminal'}],
          }),
          connect,
        },
      });
      const actor = transportModule.actorDefinitions?.[0];
      if (actor === undefined) throw new Error('transport actor missing');
      const warnings: unknown[] = [];
      const cleanup: Array<() => Promise<void>> = [];
      let rejectRetry = true;
      let rejectedRetryPayload: StateJsonValue | undefined;
      const dispatchCommand = async (command: {commandName: string}, payload: StateJsonValue) => {
        if (command.commandName === transportRetryDueCommand.commandName && rejectRetry) {
          rejectRetry = false;
          rejectedRetryPayload = payload;
          return {status: 'rejected'} as never;
        }
        const handler = actor.handlers.find(candidate => candidate.commandName === command.commandName);
        if (handler === undefined) throw new Error(`transport command handler missing: ${command.commandName}`);
        const value = await handler.handle({command: {payload}} as never);
        return {status: 'completed', value} as never;
      };
      const context = {
        localNodeId: 'test-node',
        platformPorts: {
          device: {
            getNetworkStatus: async () => ({
              status: 'unavailable',
              port: 'device',
              capability: 'getNetworkStatus',
              reason: 'PLATFORM_UNSUPPORTED',
              message: 'unavailable',
            }),
            subscribeNetworkStatus: async () => ({
              status: 'unavailable',
              port: 'device',
              capability: 'subscribeNetworkStatus',
              reason: 'PLATFORM_UNSUPPORTED',
              message: 'unavailable',
            }),
            unsubscribeNetworkStatus: async () => ({
              status: 'unavailable',
              port: 'device',
              capability: 'unsubscribeNetworkStatus',
              reason: 'PLATFORM_UNSUPPORTED',
              message: 'unavailable',
            }),
          },
          logger: {
            withContext: () => ({info: vi.fn(), warn: (entry: unknown) => warnings.push(entry)}),
          },
        },
        dispatchCommand,
        registerAsyncResource: (resource: () => Promise<void>) => cleanup.push(resource),
      } as unknown as RuntimeModuleContext;
      await transportModule.install?.(context);
      await transportModule.commandGateway.start({
        profileId: 'terminal-data-client',
        serverName: 'terminal-data-server',
        reconnectPolicy: {
          initialDelayMs: 1_000,
          incrementMs: 1_000,
          maximumDelayMs: 5_000,
          maximumJitterRatio: 0,
          cappedDelayFloorRatio: 1,
          readyTimeoutMs: 5_000,
          networkRecoveryMinimumIntervalMs: 1_000,
        },
      });

      await vi.advanceTimersByTimeAsync(1_000);

      expect(connect).toHaveBeenCalledTimes(1);
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'transport.connection.internal-command-failed',
            data: expect.objectContaining({kind: 'retry', status: 'rejected', stateTransition: 'not-applied'}),
          }),
        ]),
      );
      if (rejectedRetryPayload === undefined) throw new Error('rejected retry payload was not captured');
      const retryResult = await dispatchCommand(transportRetryDueCommand, rejectedRetryPayload);
      expect(retryResult).toMatchObject({status: 'completed'});
      expect(connect).toHaveBeenCalledTimes(2);
      for (const release of cleanup) await release();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports asynchronous transport resource disposal failures', async () => {
    const connection: TransportManagedConnection = {
      send: vi.fn(async () => undefined),
      close: vi.fn(async () => {
        throw new Error('sensitive adapter detail');
      }),
      subscribe: vi.fn(() => () => undefined),
    };
    const transportModule = createTransportModule({
      networkAdapter: {
        readSnapshot: async serverName => ({
          serverName,
          revision: 1,
          addresses: [{addressName: 'primary', baseUrl: 'ws://primary.example/terminal'}],
        }),
        connect: async () => connection,
      },
    });
    const actor = transportModule.actorDefinitions?.[0];
    if (actor === undefined) throw new Error('transport actor missing');
    const warnings: unknown[] = [];
    const cleanup: Array<() => Promise<void>> = [];
    const context = {
      localNodeId: 'test-node',
      platformPorts: {
        device: {
          getNetworkStatus: async () => ({status: 'succeeded', value: {connected: true}, completedAt: 1}),
          subscribeNetworkStatus: async () => ({status: 'succeeded', value: {subscriptionId: 'network-1'}, completedAt: 1}),
          unsubscribeNetworkStatus: async () => ({
            status: 'unavailable',
            port: 'device',
            capability: 'unsubscribeNetworkStatus',
            reason: 'PLATFORM_UNSUPPORTED',
            message: 'unavailable',
          }),
        },
        logger: {withContext: () => ({info: vi.fn(), warn: (entry: unknown) => warnings.push(entry)})},
      },
      dispatchCommand: async (command: {commandName: string}, payload: StateJsonValue) => {
        const handler = actor.handlers.find(candidate => candidate.commandName === command.commandName);
        if (handler === undefined) throw new Error(`transport command handler missing: ${command.commandName}`);
        const value = await handler.handle({command: {payload}} as never);
        return {status: 'completed', value} as never;
      },
      registerAsyncResource: (resource: () => Promise<void>) => cleanup.push(resource),
    } as unknown as RuntimeModuleContext;
    await transportModule.install?.(context);
    await transportModule.commandGateway.start({
      profileId: 'terminal-data-client',
      serverName: 'terminal-data-server',
      reconnectPolicy: {
        initialDelayMs: 1_000,
        incrementMs: 1_000,
        maximumDelayMs: 5_000,
        maximumJitterRatio: 0,
        cappedDelayFloorRatio: 1,
        readyTimeoutMs: 5_000,
        networkRecoveryMinimumIntervalMs: 1_000,
      },
    });

    await expect(cleanup[0]!()).rejects.toThrow('TRANSPORT_RESOURCE_DISPOSAL_FAILED');

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'transport.connection.resource-disposal-failed',
          data: expect.objectContaining({resource: 'network-status-bridge', status: 'rejected'}),
        }),
        expect.objectContaining({
          event: 'transport.connection.resource-disposal-failed',
          data: expect.objectContaining({resource: 'connection-owner', status: 'rejected'}),
        }),
      ]),
    );
    expect(JSON.stringify(warnings)).not.toContain('sensitive adapter detail');
  });
});
