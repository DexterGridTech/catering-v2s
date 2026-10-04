import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import {
  activateTerminalCommand,
  cancelTerminalOfflineCommand,
  cancelTerminaActivationCommand,
  connectTerminalCommand,
  disconnectTerminalCommand,
  subscribeTerminalTopicCommand,
  unsubscribeTerminalTopicCommand,
  acceptTerminalTopicNotificationCommand,
  terminalTopicChangedCommand,
  initializeTerminalDataClientCommand,
  terminalHeartbeatTickCommand,
  terminalTransportEventCommand,
  readTerminalDataCommand,
} from '../src/features/commands/terminalDataClientCommands';
import {
  terminalDataClientActions,
  terminalDataClientReducer,
  terminalDataClientStateSlice,
} from '../src/features/slices/terminalDataClient';
import {
  createTerminalDataClientActor,
  terminalConnectionCloseReasons,
} from '../src/features/actors/terminalDataClientActor';
import {
  selectActivationState,
  selectConnectionLatency,
  selectConnectionState,
  selectTerminalTopicSubscriptions,
} from '../src/selectors/selectTerminalDataClientState';
import type {ActorExecutionContext, CommandDefinition} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue, StateRoot} from '@catering-v2s/kernel-base-state';
import type {TransportConnectionEvent} from '@catering-v2s/kernel-base-transport';
import type {RemoteOperationFact} from '../src/types/client';

const createActivationTestLogger = () => {
  const events: unknown[] = [];
  const logger = {
    debug: vi.fn((event: unknown) => {
      events.push(event);
      return {status: 'succeeded'};
    }),
    info: vi.fn((event: unknown) => {
      events.push(event);
      return {status: 'succeeded'};
    }),
    warn: vi.fn((event: unknown) => {
      events.push(event);
      return {status: 'succeeded'};
    }),
    error: vi.fn((event: unknown) => {
      events.push(event);
      return {status: 'succeeded'};
    }),
    scope: vi.fn(),
    withContext: vi.fn(),
  };
  logger.scope.mockReturnValue(logger as never);
  logger.withContext.mockReturnValue(logger as never);
  return {logger, events};
};

const actorState = (clientState: unknown, instanceMode: 'MASTER' | 'SLAVE' = 'MASTER'): StateRoot =>
  ({
    [terminalDataClientStateSlice.name]: clientState,
    'kernel.base.runtime.instance-mode': {instanceMode},
  }) as StateRoot;

const remoteOperationFact = (index: number, phase: RemoteOperationFact['phase'] = 'COMPLETED'): RemoteOperationFact => ({
  remoteOperationId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  requestId: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  localRequestId: `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  groupWorkspaceKey: 'workspace-1',
  terminalRef: 'terminal-1',
  bindingGeneration: 7,
  addressName: 'dev',
  configRevision: 4,
  commandName: 'test.remote-noop',
  phase,
  reportId: `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  occurredAt: '2027-01-01T00:00:00.000Z',
  ...(phase === 'UNKNOWN' ? {errorCode: 'REMOTE_RESULT_UNKNOWN'} : {resultJson: '{"actorResults":[]}'}),
});

const createRemoteOperationHarness = (options?: {
  initialFacts?: readonly RemoteOperationFact[];
  dispatchCommand?: ActorExecutionContext['dispatchCommand'];
  flushPersistence?: ActorExecutionContext['flushPersistence'];
}) => {
  const secret = 'R'.repeat(43);
  let state = terminalDataClientReducer(undefined, {type: 'test/init'});
  state = terminalDataClientReducer(state, terminalDataClientActions.replaceCredential({
    groupWorkspaceKey: 'workspace-1', terminalRef: 'terminal-1', storeRef: 'store-1', deviceId: 'device-1',
    bindingGeneration: 7, credentialSecret: secret,
  }));
  for (const fact of options?.initialFacts ?? []) {
    state = terminalDataClientReducer(state, terminalDataClientActions.putRemoteOperation(fact));
  }
  const sent: string[] = [];
  const connection = {send: vi.fn(async (raw: string) => { sent.push(raw); }), subscribe: vi.fn(() => () => undefined)};
  const transport = {
    start: vi.fn(async () => connection), ready: vi.fn(async () => undefined), invalid: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined), executeHttp: vi.fn(), reportHttpAddressAvailable: vi.fn(async () => undefined),
  };
  const dispatchCommand = options?.dispatchCommand ?? vi.fn(async () => ({
    requestId: 'local-request', commandId: 'local-command', status: 'completed' as const,
    actorResults: [{actorKey: 'test.actor', status: 'completed' as const, startedAt: 1, completedAt: 2, result: {changed: true}, error: null}],
  }));
  const actor = createTerminalDataClientActor({
    transport, businessServerName: 'terminal-business-api', createCredentialSecret: () => secret,
    now: () => 1_799_999_640_000, appVersion: 'test', surfaceForm: 'laptop',
  });
  const makeContext = (commandName: string, payload: unknown): ActorExecutionContext => ({
    runtimeId: 'test-runtime', localNodeId: 'test-node', platformPorts: {},
    command: {commandName, payload, requestId: 'root-request', commandId: 'root-command'} as never,
    actor: {actorKey: actor.actor.actorKey, moduleName: actor.actor.moduleName, actorName: actor.actor.actorName},
    getState: () => actorState(state),
    dispatchAction: (action: unknown) => { state = terminalDataClientReducer(state, action as never); return action as never; },
    flushPersistence: options?.flushPersistence ?? (async () => ({status: 'succeeded'})),
    subscribeState: () => () => undefined,
    dispatchCommand: dispatchCommand as never,
    requestApplicationReset: () => undefined,
  }) as unknown as ActorExecutionContext;
  const handler = actor.actor.handlers.find(item => item.commandName === terminalTransportEventCommand.commandName)!;
  const runEvent = (event: TransportConnectionEvent) => handler.handle(makeContext(terminalTransportEventCommand.commandName, {event}));
  const command = (remoteOperationId = '5b7a27c6-2d14-4df5-9e13-07e58798a9cb', requestId = '1e947a10-c7d6-4e37-93e7-587e7a90c111') => ({
    type: 'REMOTE_COMMAND', remoteOperationId, requestId, bindingGeneration: 7,
    commandName: 'test.remote-noop', parameters: {scope: 'fixture'},
  });
  const connectReady = async (configRevision = 4) => {
    await actor.actor.handlers.find(item => item.commandName === connectTerminalCommand.commandName)!
      .handle(makeContext(connectTerminalCommand.commandName, {}));
    await runEvent({type: 'open', addressName: 'dev', configRevision});
    await runEvent({type: 'message', raw: JSON.stringify({
      type: 'SESSION_READY', sessionId: 'session-1', nodeId: 'tds-1', serverTime: '2027-01-01T00:00:00Z',
      heartbeatIntervalMs: 1_000, heartbeatTimeoutMs: 3_000,
    })});
  };
  return {
    actor, transport, connection, sent, state: () => state, dispatchCommand, makeContext, runEvent, command, connectReady,
    dispose: () => actor.dispose(),
  };
};

describe('terminal-data-client activation command actor', () => {
  it('injects the active credential into generated read operations and replaces caller store identity', async () => {
    const secret = 'A'.repeat(43);
    const executeHttp = vi.fn(async () => ({
      kind: 'failure' as const,
      category: 'not-delivered' as const,
      code: 'TEST_STOP',
    }));
    const actorRuntime = createTerminalDataClientActor({
      transport: {
        start: vi.fn(),
        ready: vi.fn(),
        invalid: vi.fn(),
        stop: vi.fn(),
        executeHttp,
        reportHttpAddressAvailable: vi.fn(),
      },
      businessServerName: 'terminal-business-api',
      createCredentialSecret: () => secret,
      now: () => 10,
      appVersion: 'test',
      surfaceForm: 'laptop',
    });
    const state = terminalDataClientReducer(undefined, {type: 'test/init'});
    const activeState = terminalDataClientReducer(
      state,
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'workspace-1',
        terminalRef: 'terminal-1',
        storeRef: 'store-authoritative',
        deviceId: 'device-1',
        bindingGeneration: 9,
        credentialSecret: secret,
      }),
    );
    const handler = actorRuntime.actor.handlers.find(
      candidate => candidate.commandName === readTerminalDataCommand.commandName,
    );
    if (handler === undefined) throw new Error('terminal data read handler missing');
    const context = {
      runtimeId: 'test-runtime',
      localNodeId: 'test-node',
      platformPorts: {logger: createActivationTestLogger().logger},
      command: {
        commandName: readTerminalDataCommand.commandName,
        commandId: 'read-store',
        requestId: 'read-store',
        payload: {operationId: 'terminalReadStoreBasic', pathParameters: {storeRef: 'caller-store'}},
      },
      actor: {
        actorKey: actorRuntime.actor.actorKey,
        moduleName: actorRuntime.actor.moduleName,
        actorName: actorRuntime.actor.actorName,
      },
      getState: () => actorState(activeState),
      dispatchAction: (action: unknown) => action as never,
      flushPersistence: async () => ({status: 'succeeded'}),
      subscribeState: () => () => undefined,
      dispatchCommand: async () => ({status: 'completed'}),
      requestApplicationReset: vi.fn(),
    } as unknown as ActorExecutionContext;

    await expect(handler.handle(context)).resolves.toMatchObject({kind: 'failure', code: 'TEST_STOP'});
    expect(executeHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        serverName: 'terminal-business-api',
        method: 'GET',
        pathAndQuery: '/stores/store-authoritative/basic',
        headers: {
          Authorization: `Terminal 9.${secret}`,
          'X-Terminal-Device-Id': 'device-1',
          'X-Terminal-Ref': 'terminal-1',
        },
      }),
    );
    actorRuntime.dispose();
  });

  it('rejects activation while a topology transition is in progress before reading device identity', async () => {
    const secret = 'A'.repeat(43);
    const getDeviceInfo = vi.fn();
    const actorRuntime = createTerminalDataClientActor({
      transport: {
        start: vi.fn(),
        ready: vi.fn(),
        invalid: vi.fn(),
        stop: vi.fn(),
        executeHttp: vi.fn(),
        reportHttpAddressAvailable: vi.fn(),
      },
      businessServerName: 'terminal-business-api',
      createCredentialSecret: () => secret,
      now: () => 1_000,
      surfaceForm: 'laptop',
      appVersion: '1.0.0',
      canActivate: () => false,
    });
    const handler = actorRuntime.actor.handlers.find(
      candidate => candidate.commandName === activateTerminalCommand.commandName,
    );
    if (handler === undefined) throw new Error('activate terminal actor handler missing');
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    const context = {
      runtimeId: 'test-runtime',
      localNodeId: 'test-node',
      platformPorts: {device: {getDeviceInfo}},
      command: {
        commandName: activateTerminalCommand.commandName,
        payload: {activationCode: '12345678'},
        requestId: 'blocked-activation',
      },
      actor: {
        actorKey: actorRuntime.actor.actorKey,
        moduleName: actorRuntime.actor.moduleName,
        actorName: actorRuntime.actor.actorName,
      },
      getState: () => actorState(state),
      dispatchAction: (action: unknown) => {
        state = terminalDataClientReducer(state, action as never);
        return action as never;
      },
      flushPersistence: async () => ({status: 'succeeded'}),
      subscribeState: () => () => undefined,
      dispatchCommand: async () => ({status: 'completed'}),
      requestApplicationReset: vi.fn(),
    } as unknown as ActorExecutionContext;

    await expect(handler.handle(context as never)).resolves.toMatchObject({
      status: 'rejected',
      reason: 'TOPOLOGY_CHANGE_IN_PROGRESS',
    });
    expect(getDeviceInfo).not.toHaveBeenCalled();
    expect(selectActivationState(actorState(state))).toMatchObject({status: 'inactive'});
    actorRuntime.dispose();
  });

  it('blocks SLAVE credential actions but allows local disconnect cleanup without touching credentials', async () => {
    const secret = 'A'.repeat(43);
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    state = terminalDataClientReducer(
      state,
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'workspace-1',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        deviceId: 'device-1',
        bindingGeneration: 8,
        credentialSecret: secret,
      }),
    );
    const transport = {
      start: vi.fn(),
      ready: vi.fn(),
      invalid: vi.fn(),
      stop: vi.fn(),
      executeHttp: vi.fn(),
      reportHttpAddressAvailable: vi.fn(),
    };
    const actor = createTerminalDataClientActor({
      transport,
      businessServerName: 'terminal-business-api',
      createCredentialSecret: () => secret,
      now: () => 1_000,
      appVersion: '1.0.0',
      surfaceForm: 'laptop',
    });
    const findHandler = (commandName: string) => {
      const handler = actor.actor.handlers.find(candidate => candidate.commandName === commandName);
      if (handler === undefined) throw new Error(`terminal handler missing: ${commandName}`);
      return handler;
    };
    const makeContext = (commandName: string, payload: unknown): ActorExecutionContext =>
      ({
        runtimeId: 'slave-runtime',
        localNodeId: 'slave-node',
        platformPorts: {device: {getDeviceInfo: vi.fn()}},
        command: {commandName, payload, requestId: 'operation-1', commandId: 'slave-command'} as never,
        actor: {actorKey: actor.actor.actorKey, moduleName: actor.actor.moduleName, actorName: actor.actor.actorName},
        getState: () => actorState(state, 'SLAVE'),
        dispatchAction: (action: unknown) => {
          state = terminalDataClientReducer(state, action as never);
          return action as never;
        },
        flushPersistence: async () => ({status: 'succeeded'}),
        subscribeState: () => () => undefined,
        dispatchCommand: async () => ({status: 'completed'}),
        requestApplicationReset: vi.fn(),
      }) as unknown as ActorExecutionContext;

    expect(
      await findHandler(initializeTerminalDataClientCommand.commandName).handle(
        makeContext(initializeTerminalDataClientCommand.commandName, {}),
      ),
    ).toEqual({status: 'not-host'});
    expect(
      await findHandler(activateTerminalCommand.commandName).handle(
        makeContext(activateTerminalCommand.commandName, {activationCode: '12345678'}),
      ),
    ).toMatchObject({
      status: 'rejected',
      reason: 'TERMINAL_CLIENT_HOST_ROLE_REQUIRED',
    });
    expect(
      await findHandler(cancelTerminaActivationCommand.commandName).handle(
        makeContext(cancelTerminaActivationCommand.commandName, {}),
      ),
    ).toMatchObject({
      status: 'rejected',
      reason: 'TERMINAL_CLIENT_HOST_ROLE_REQUIRED',
    });
    expect(
      await findHandler(cancelTerminalOfflineCommand.commandName).handle(
        makeContext(cancelTerminalOfflineCommand.commandName, {}),
      ),
    ).toMatchObject({
      status: 'rejected',
      reason: 'TERMINAL_CLIENT_HOST_ROLE_REQUIRED',
    });
    expect(
      await findHandler(connectTerminalCommand.commandName).handle(makeContext(connectTerminalCommand.commandName, {})),
    ).toMatchObject({
      status: 'rejected',
      reason: 'TERMINAL_CLIENT_HOST_ROLE_REQUIRED',
    });

    expect(
      await findHandler(disconnectTerminalCommand.commandName).handle(
        makeContext(disconnectTerminalCommand.commandName, {}),
      ),
    ).toEqual({
      status: 'disconnected',
    });
    expect(selectActivationState(actorState(state, 'SLAVE'))).toMatchObject({
      status: 'active',
      terminalRef: 'terminal-1',
    });
    expect(state).toMatchObject({credential: {deviceId: 'device-1', credentialSecret: secret}});
    expect(transport.start).not.toHaveBeenCalled();
    expect(transport.executeHttp).not.toHaveBeenCalled();
    expect(transport.stop).toHaveBeenCalledTimes(1);
    actor.dispose();
  });

  it('keeps the TypeScript close-reason set aligned with the shared protocol', () => {
    const protocol = JSON.parse(
      readFileSync(
        new URL('../../../../../../contracts/protocol/terminal-connection-protocol.json', import.meta.url),
        'utf8',
      ),
    ) as {close: {application: {reasons: readonly string[]}}};
    expect(terminalConnectionCloseReasons).toEqual(protocol.close.application.reasons);
  });

  it('maps only canonical application closes to their reasons and preserves cancellation semantics', async () => {
    const cases = [
      ...terminalConnectionCloseReasons.map(reason => ({
        type: 'close' as const,
        code: 4000,
        reason,
        expectedReason: reason,
      })),
      {type: 'close' as const, code: 1009, reason: 'ACTIVATION_CANCELLED', expectedReason: 'UNKNOWN'},
      {type: 'close' as const, code: 4000, reason: 'UNRECOGNIZED_REASON', expectedReason: 'UNKNOWN'},
      {type: 'error' as const, reason: 'ACTIVATION_CANCELLED', expectedReason: 'NETWORK_ERROR'},
    ];

    for (const [index, testCase] of cases.entries()) {
      const {expectedReason} = testCase;
      const secret = 'A'.repeat(43);
      let state = terminalDataClientReducer(undefined, {type: 'test/init'});
      state = terminalDataClientReducer(
        state,
        terminalDataClientActions.replaceCredential({
          groupWorkspaceKey: 'workspace-1',
          terminalRef: '00000000-0000-4000-8000-000000000001',
          storeRef: '00000000-0000-4000-8000-000000000002',
          deviceId: 'device-1',
          bindingGeneration: 8,
          credentialSecret: secret,
        }),
      );
      const transport = {
        start: vi.fn(),
        ready: vi.fn(async () => undefined),
        invalid: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
        executeHttp: vi.fn(),
        reportHttpAddressAvailable: vi.fn(async () => undefined),
      };
      const actor = createTerminalDataClientActor({
        transport,
        businessServerName: 'terminal-business-api',
        createCredentialSecret: () => secret,
        now: () => 1_000,
        appVersion: '1.0.0',
        surfaceForm: 'laptop',
      });
      const handler = actor.actor.handlers.find(
        candidate => candidate.commandName === terminalTransportEventCommand.commandName,
      );
      if (handler === undefined) throw new Error('terminal transport event handler missing');
      const reset = vi.fn();
      const context = {
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {},
        command: {
          commandName: terminalTransportEventCommand.commandName,
          payload: {event: testCase},
          requestId: `close-${index}`,
        },
        actor: {actorKey: actor.actor.actorKey, moduleName: actor.actor.moduleName, actorName: actor.actor.actorName},
        getState: () => actorState(state),
        dispatchAction: (action: unknown) => {
          state = terminalDataClientReducer(state, action as never);
          return action as never;
        },
        flushPersistence: async () => ({status: 'succeeded'}),
        subscribeState: () => () => undefined,
        dispatchCommand: async () => ({status: 'completed'}),
        requestApplicationReset: reset,
      } as unknown as ActorExecutionContext;

      await handler.handle(context as never);
      const connection = selectConnectionState({[terminalDataClientStateSlice.name]: state} as unknown as StateRoot);
      expect(connection.lastCloseReason).toBe(expectedReason);
      if (expectedReason === 'ACTIVATION_CANCELLED') {
        expect(transport.stop).toHaveBeenCalledWith({profileId: 'terminal-data-client'});
        expect(reset).toHaveBeenCalledWith('TERMINAL_ACTIVATION_CANCELLED');
        expect(transport.invalid).not.toHaveBeenCalled();
      } else {
        expect(
          selectActivationState({[terminalDataClientStateSlice.name]: state} as unknown as StateRoot),
        ).toMatchObject({
          status: 'active',
          terminalRef: '00000000-0000-4000-8000-000000000001',
        });
        expect(transport.invalid).toHaveBeenCalledWith({profileId: 'terminal-data-client', cause: expectedReason});
        expect(reset).not.toHaveBeenCalled();
      }
      actor.dispose();
    }
  });

  it('reuses the protected pending secret when the same business operation retries with a different operation id', async () => {
    const secret = 'A'.repeat(43);
    const submitted: string[] = [];
    const requests: Array<Record<string, unknown>> = [];
    const executeHttp = vi.fn(async (request: Record<string, unknown> & {body?: unknown}) => {
      requests.push(request);
      submitted.push((request.body as {credentialSecret: string}).credentialSecret);
      if (submitted.length === 1)
        return {kind: 'failure' as const, category: 'not-delivered' as const, code: 'NETWORK_ERROR'};
      return {
        kind: 'response' as const,
        addressName: 'primary',
        configRevision: 1,
        requestId: 'req-activation-001',
        correlationId: 'corr-activation-001',
        status: 200,
        body: {
          terminalRef: '00000000-0000-4000-8000-000000000001',
          storeRef: '00000000-0000-4000-8000-000000000002',
          groupWorkspaceKey: 'workspace-1',
          bindingGeneration: 2,
        },
      };
    });
    const dispatchCommand = vi.fn(async () => ({status: 'completed' as const}));
    const createCredentialSecret = vi.fn(() => secret);
    const activationDiagnostics = createActivationTestLogger();
    const dependencies = {
      businessServerName: 'terminal-business-api',
      transport: {
        start: vi.fn(),
        ready: vi.fn(),
        invalid: vi.fn(),
        stop: vi.fn(),
        executeHttp,
        reportHttpAddressAvailable: vi.fn(),
      },
      createCredentialSecret,
      now: () => 100,
      appVersion: '1.0.0',
      surfaceForm: 'laptop',
    } as never;
    const actor = createTerminalDataClientActor(dependencies).actor;
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    const handler = actor.handlers.find(candidate => candidate.commandName === activateTerminalCommand.commandName);
    if (handler === undefined) throw new Error('activate terminal actor handler missing');
    const context = {
      runtimeId: 'test-runtime',
      localNodeId: 'test-node',
      platformPorts: {
        device: {getDeviceInfo: async () => ({status: 'succeeded', value: {deviceId: 'device-1'}, completedAt: 1})},
        logger: activationDiagnostics.logger,
      },
      command: {
        payload: {
          activationCode: '12345678',
        },
        requestId: 'operation-1',
      },
      actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
      getState: () => actorState(state),
      dispatchAction: (action: unknown) => {
        state = terminalDataClientReducer(state, action as never);
        return action as never;
      },
      flushPersistence: async () => ({status: 'succeeded'}),
      subscribeState: () => () => undefined,
      dispatchCommand,
      requestApplicationReset: () => undefined,
    } as unknown as ActorExecutionContext;

    await handler.handle(context as never);
    (context.command as unknown as {requestId: string}).requestId = 'operation-2';
    const second = await handler.handle(context as never);
    const readback = selectActivationState({[terminalDataClientStateSlice.name]: state} as unknown as StateRoot);
    expect(submitted.length).toBe(2);
    expect(submitted[0] === submitted[1]).toBe(true);
    expect(createCredentialSecret).toHaveBeenCalledTimes(1);
    expect(executeHttp.mock.calls.map(call => call[0].safeRetryable)).toEqual([true, true]);
    expect(requests[0]).toMatchObject({
      profileId: 'terminal-data-client:http',
      serverName: 'terminal-business-api',
      method: 'POST',
      pathAndQuery: '/activation',
      headers: {},
    });
    expect(readback).toMatchObject({status: 'active', bindingGeneration: 2});
    expect(JSON.stringify(readback).includes(secret)).toBe(false);
    expect(second && typeof second === 'object' && 'status' in second ? second.status : '').toBe('activated');
    expect(activationDiagnostics.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'activation-request-started',
          data: expect.objectContaining({operationId: 'activateTerminal'}),
        }),
        expect.objectContaining({
          event: 'activation-request-result',
          data: expect.objectContaining({
            kind: 'success',
            status: 200,
            requestId: 'req-activation-001',
            correlationId: 'corr-activation-001',
          }),
        }),
      ]),
    );
    expect(JSON.stringify(activationDiagnostics.events)).not.toContain(secret);
    expect(JSON.stringify(activationDiagnostics.events)).not.toContain('12345678');
    expect(dispatchCommand).toHaveBeenCalledTimes(2);
    expect(dispatchCommand).toHaveBeenCalledWith(
      connectTerminalCommand,
      Object.freeze({}),
      expect.objectContaining({requestId: expect.any(String)}),
    );
    expect(dispatchCommand).toHaveBeenCalledWith(
      expect.objectContaining({commandName: expect.stringMatching(/\.activation-succeeded$/)}),
      expect.objectContaining({terminalRef: '00000000-0000-4000-8000-000000000001', bindingGeneration: 2}),
    );
  });

  it('shares one pending secret across same-business-operation calls with different operation ids', async () => {
    const secret = `${'B'.repeat(42)}A`;
    expect(secret).toMatch(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/);
    const deviceInfoResult = Object.freeze({
      status: 'succeeded' as const,
      value: Object.freeze({deviceId: 'device-1'}),
      completedAt: 1,
    });
    const deviceResolutions: Array<() => void> = [];
    const requestResolutions: Array<(value: never) => void> = [];
    const requestBodies: Array<{credentialSecret?: string}> = [];
    let releaseBothRequests!: () => void;
    const bothRequestsStarted = new Promise<void>(resolve => {
      releaseBothRequests = resolve;
    });
    const executeHttp = vi.fn((request: {body?: {credentialSecret?: string}}) => {
      requestBodies.push(request.body ?? {});
      if (requestBodies.length === 2) releaseBothRequests();
      return new Promise<never>(resolve => requestResolutions.push(resolve));
    });
    const device = {
      getDeviceInfo: vi.fn(
        () =>
          new Promise<typeof deviceInfoResult>(resolve => {
            deviceResolutions.push(() => resolve(deviceInfoResult));
          }),
      ),
    };
    const transport = {
      start: vi.fn(),
      ready: vi.fn(),
      invalid: vi.fn(),
      stop: vi.fn(),
      executeHttp,
      reportHttpAddressAvailable: vi.fn(),
    };
    const createCredentialSecret = vi.fn(() => secret);
    const actorRuntime = createTerminalDataClientActor({
      businessServerName: 'terminal-business-api',
      transport,
      createCredentialSecret,
      now: () => 100,
      appVersion: '1.0.0',
      surfaceForm: 'laptop',
    } as never);
    const actor = actorRuntime.actor;
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    const handler = actor.handlers.find(candidate => candidate.commandName === activateTerminalCommand.commandName);
    if (handler === undefined) throw new Error('activate terminal actor handler missing');
    const makeContext = (commandId: string, operationId: string): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {device, logger: createActivationTestLogger().logger},
        command: {
          commandName: activateTerminalCommand.commandName,
          commandId,
          requestId: operationId,
          payload: {activationCode: '12345678'},
        } as never,
        actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
        getState: () => actorState(state),
        dispatchAction: (action: unknown) => {
          state = terminalDataClientReducer(state, action as never);
          return action as never;
        },
        flushPersistence: async () => ({status: 'succeeded'}),
        subscribeState: () => () => undefined,
        dispatchCommand: async () => ({status: 'completed'}),
        requestApplicationReset: () => undefined,
      }) as unknown as ActorExecutionContext;

    const first = handler.handle(makeContext('root-1', 'operation-a'));
    const second = handler.handle(makeContext('root-2', 'operation-b'));
    expect(deviceResolutions).toHaveLength(2);
    deviceResolutions[0]!();
    deviceResolutions[1]!();
    await bothRequestsStarted;

    expect(createCredentialSecret).toHaveBeenCalledTimes(1);
    expect(requestBodies.map(body => body.credentialSecret)).toEqual([secret, secret]);
    const response = {
      kind: 'response',
      addressName: 'primary',
      configRevision: 1,
      status: 200,
      body: {
        terminalRef: '00000000-0000-4000-8000-000000000001',
        storeRef: '00000000-0000-4000-8000-000000000002',
        groupWorkspaceKey: 'workspace-1',
        bindingGeneration: 7,
      },
    };
    // Reverse by HTTP submission order: the first root awaits persistence, so call order need not equal wire order.
    requestResolutions[1]!(response as never);
    const firstResponse = await Promise.race([first, second]);
    expect(firstResponse).toMatchObject({status: 'activated', bindingGeneration: 7});
    requestResolutions[0]!(response as never);
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toMatchObject({status: 'activated', bindingGeneration: 7});
    expect(secondResult).toMatchObject({status: 'activated', bindingGeneration: 7});
    expect(state.credential).toMatchObject({bindingGeneration: 7, credentialSecret: secret});
    expect(Object.keys(state.pendingActivations)).toEqual([]);
    actorRuntime.dispose();
  });

  it('rejects mismatched parameters for concurrent calls with the same operation id', async () => {
    const secret = `${'C'.repeat(42)}A`;
    expect(secret).toMatch(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/);
    const executeHttp = vi.fn(async () => ({
      kind: 'failure' as const,
      category: 'not-delivered' as const,
      code: 'NETWORK_ERROR',
    }));
    const transport = {
      start: vi.fn(),
      ready: vi.fn(),
      invalid: vi.fn(),
      stop: vi.fn(),
      executeHttp,
      reportHttpAddressAvailable: vi.fn(),
    };
    const createCredentialSecret = vi.fn(() => secret);
    const actorRuntime = createTerminalDataClientActor({
      businessServerName: 'terminal-business-api',
      transport,
      createCredentialSecret,
      now: () => 100,
      appVersion: '1.0.0',
      surfaceForm: 'laptop',
    } as never);
    const actor = actorRuntime.actor;
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    const handler = actor.handlers.find(candidate => candidate.commandName === activateTerminalCommand.commandName);
    if (handler === undefined) throw new Error('activate terminal actor handler missing');
    const makeContext = (commandId: string, activationCode: string): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {
          device: {getDeviceInfo: async () => ({status: 'succeeded', value: {deviceId: 'device-1'}, completedAt: 1})},
          logger: createActivationTestLogger().logger,
        },
        command: {
          commandName: activateTerminalCommand.commandName,
          commandId,
          requestId: 'operation-mismatch',
          payload: {activationCode},
        } as never,
        actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
        getState: () => actorState(state),
        dispatchAction: (action: unknown) => {
          state = terminalDataClientReducer(state, action as never);
          return action as never;
        },
        flushPersistence: async () => ({status: 'succeeded'}),
        subscribeState: () => () => undefined,
        dispatchCommand: async () => ({status: 'completed'}),
        requestApplicationReset: () => undefined,
      }) as unknown as ActorExecutionContext;

    const [first, mismatched] = await Promise.all([
      handler.handle(makeContext('root-1', '12345678')),
      handler.handle(makeContext('root-2', '87654321')),
    ]);

    expect(mismatched).toMatchObject({status: 'rejected', reason: 'ACTIVATION_OPERATION_MISMATCH'});
    expect(createCredentialSecret).toHaveBeenCalledTimes(1);
    expect(executeHttp).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({kind: 'failure', code: 'NETWORK_ERROR'});
    actorRuntime.dispose();
  });

  it('rejects a changed activation code under the same owner operation identity', async () => {
    const secret = 'D'.repeat(43);
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    state = terminalDataClientReducer(
      state,
      terminalDataClientActions.setPendingActivation({
        operationId: 'operation-original',
        activationCode: '12345678',
        deviceId: 'device-1',
        surfaceForm: 'laptop',
        appVersion: '1.0.0',
        credentialSecret: secret,
      }),
    );
    const executeHttp = vi.fn();
    const createCredentialSecret = vi.fn(() => 'E'.repeat(43));
    const actorRuntime = createTerminalDataClientActor({
      businessServerName: 'terminal-business-api',
      transport: {
        start: vi.fn(),
        ready: vi.fn(),
        invalid: vi.fn(),
        stop: vi.fn(),
        executeHttp,
        reportHttpAddressAvailable: vi.fn(),
      },
      createCredentialSecret,
      now: () => 100,
      appVersion: '1.0.0',
      surfaceForm: 'laptop',
    } as never);
    const handler = actorRuntime.actor.handlers.find(
      candidate => candidate.commandName === activateTerminalCommand.commandName,
    );
    if (handler === undefined) throw new Error('activate terminal actor handler missing');
    const result = await handler.handle({
      runtimeId: 'test-runtime',
      localNodeId: 'test-node',
      platformPorts: {
        device: {getDeviceInfo: async () => ({status: 'succeeded', value: {deviceId: 'device-1'}, completedAt: 1})},
        logger: createActivationTestLogger().logger,
      },
      command: {
        commandName: activateTerminalCommand.commandName,
        commandId: 'root-changed-params',
        requestId: 'operation-original',
        payload: {
          activationCode: '87654321',
        },
      } as never,
      actor: {
        actorKey: actorRuntime.actor.actorKey,
        moduleName: actorRuntime.actor.moduleName,
        actorName: actorRuntime.actor.actorName,
      },
      getState: () => actorState(state),
      dispatchAction: (action: unknown) => {
        state = terminalDataClientReducer(state, action as never);
        return action as never;
      },
      flushPersistence: async () => ({status: 'succeeded'}),
      subscribeState: () => () => undefined,
      dispatchCommand: async () => ({status: 'completed'}),
      requestApplicationReset: () => undefined,
    } as unknown as ActorExecutionContext);
    expect(result).toEqual({status: 'rejected', reason: 'ACTIVATION_OPERATION_MISMATCH'});
    expect(createCredentialSecret).not.toHaveBeenCalled();
    expect(executeHttp).not.toHaveBeenCalled();
    actorRuntime.dispose();
  });

  it('accepts every canonical final base64url sextet for a 32-byte activation secret', async () => {
    const validFinalChars = 'AEIMQUYcgkosw048';
    let secret = `${'A'.repeat(42)}${validFinalChars[0]}`;
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    const executeHttp = vi.fn(async () => ({
      kind: 'failure' as const,
      category: 'not-delivered' as const,
      code: 'NETWORK_ERROR',
    }));
    const actorRuntime = createTerminalDataClientActor({
      businessServerName: 'terminal-business-api',
      transport: {
        start: vi.fn(),
        ready: vi.fn(),
        invalid: vi.fn(),
        stop: vi.fn(),
        executeHttp,
        reportHttpAddressAvailable: vi.fn(),
      },
      createCredentialSecret: () => secret,
      now: () => 100,
      appVersion: '1.0.0',
      surfaceForm: 'laptop',
    });
    const actor = actorRuntime.actor;
    const handler = actor.handlers.find(candidate => candidate.commandName === activateTerminalCommand.commandName);
    if (handler === undefined) throw new Error('activate terminal actor handler missing');
    const runActivation = async (operationId: string, activationCode: string): Promise<unknown> =>
      handler.handle({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {
          device: {getDeviceInfo: async () => ({status: 'succeeded', value: {deviceId: 'device-1'}, completedAt: 1})},
          logger: createActivationTestLogger().logger,
        },
        command: {
          payload: {activationCode},
          requestId: operationId,
        },
        actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
        getState: () => actorState(state),
        dispatchAction: (action: unknown) => {
          state = terminalDataClientReducer(state, action as never);
          return action as never;
        },
        flushPersistence: async () => ({status: 'succeeded'}),
        subscribeState: () => () => undefined,
        dispatchCommand: async () => ({status: 'completed'}),
        requestApplicationReset: () => undefined,
      } as unknown as ActorExecutionContext);

    for (const [index, finalChar] of [...validFinalChars].entries()) {
      secret = `${'A'.repeat(42)}${finalChar}`;
      const result = (await runActivation(`operation-${index}`, String(10_000_000 + index))) as {
        kind?: string;
        category?: string;
      };
      expect(result).toMatchObject({kind: 'failure', category: 'not-delivered'});
    }
    expect(executeHttp).toHaveBeenCalledTimes(validFinalChars.length);

    secret = `${'A'.repeat(42)}B`;
    const rejected = (await runActivation('operation-invalid', '87654321')) as {status?: string; reason?: string};
    expect(rejected).toMatchObject({status: 'rejected', reason: 'SECURE_RANDOM_INVALID'});
    expect(executeHttp).toHaveBeenCalledTimes(validFinalChars.length);
    actorRuntime.dispose();
  });

  it('keeps cancellation credentials on transport failure/rejection and sends the generated HTTP fields exactly', async () => {
    const secret = 'A'.repeat(43);
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    state = terminalDataClientReducer(
      state,
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'workspace-1',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        deviceId: 'device-1',
        bindingGeneration: 8,
        credentialSecret: secret,
      }),
    );
    const requests: Array<Record<string, unknown>> = [];
    const callOrder: string[] = [];
    const executeHttp = vi.fn(async (request: Record<string, unknown>) => {
      callOrder.push('http');
      requests.push(request);
      if (requests.length === 1)
        return {kind: 'failure' as const, category: 'not-delivered' as const, code: 'NETWORK_ERROR'};
      if (requests.length === 2)
        return {
          kind: 'response' as const,
          addressName: 'primary',
          configRevision: 4,
          requestId: 'req-cancel-rejected-001',
          correlationId: 'corr-cancel-rejected-001',
          status: 409,
          body: {
            type: 'https://example.invalid/problems/terminal-binding-credential-invalid',
            title: 'Credential invalid',
            status: 409,
            detail: 'The terminal credential is invalid.',
            errorCode: 'TERMINAL_BINDING_CREDENTIAL_INVALID',
            correlationId: 'correlation-1234',
          },
        };
      return {
        kind: 'response' as const,
        addressName: 'primary',
        configRevision: 4,
        requestId: 'req-cancel-success-001',
        correlationId: 'corr-cancel-success-001',
        status: 200,
        body: {outcome: 'CANCELLED'},
      };
    });
    const transport = {
      start: vi.fn(),
      ready: vi.fn(),
      invalid: vi.fn(),
      stop: vi.fn(async () => {
        callOrder.push('stop');
      }),
      executeHttp,
      reportHttpAddressAvailable: vi.fn(async () => undefined),
    };
    const actor = createTerminalDataClientActor({
      transport,
      businessServerName: 'terminal-business-api',
      createCredentialSecret: () => secret,
      now: () => 100,
      appVersion: '1.0.0',
      surfaceForm: 'laptop',
    });
    const handler = actor.actor.handlers.find(
      candidate => candidate.commandName === cancelTerminaActivationCommand.commandName,
    );
    if (handler === undefined) throw new Error('cancel terminal actor handler missing');
    const cancellationDiagnostics = createActivationTestLogger();
    const makeContext = (platformPorts: Record<string, unknown> = {}): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {logger: cancellationDiagnostics.logger, ...platformPorts},
        command: {
          commandName: cancelTerminaActivationCommand.commandName,
          payload: {},
          requestId: 'cancel-request-1',
        },
        actor: {actorKey: actor.actor.actorKey, moduleName: actor.actor.moduleName, actorName: actor.actor.actorName},
        getState: () => actorState(state),
        dispatchAction: (action: unknown) => {
          state = terminalDataClientReducer(state, action as never);
          return action as never;
        },
        flushPersistence: async () => ({status: 'succeeded'}),
        subscribeState: () => () => undefined,
        dispatchCommand: async () => ({status: 'completed'}),
        requestApplicationReset: vi.fn(),
      }) as unknown as ActorExecutionContext;
    const first = await handler.handle(makeContext() as never);
    expect(callOrder.slice(0, 2)).toEqual(['stop', 'http']);
    expect(transport.stop).toHaveBeenCalled();
    const second = await handler.handle(makeContext() as never);
    expect(first).toMatchObject({kind: 'failure', category: 'not-delivered'});
    expect(second).toMatchObject({kind: 'business-rejection', errorCode: 'TERMINAL_BINDING_CREDENTIAL_INVALID'});
    expect(cancellationDiagnostics.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({event: 'cancel-activation-request-started'}),
        expect.objectContaining({
          event: 'cancel-activation-request-result',
          data: expect.objectContaining({
            kind: 'business-rejection',
            status: 409,
            errorCode: 'TERMINAL_BINDING_CREDENTIAL_INVALID',
            requestId: 'req-cancel-rejected-001',
            correlationId: 'corr-cancel-rejected-001',
          }),
        }),
      ]),
    );
    expect(selectActivationState({[terminalDataClientStateSlice.name]: state} as unknown as StateRoot)).toMatchObject({
      status: 'active',
      terminalRef: 'terminal-1',
    });
    expect(requests[0]).toMatchObject({
      profileId: 'terminal-data-client:http',
      serverName: 'terminal-business-api',
      method: 'POST',
      pathAndQuery: '/terminals/terminal-1/activation/cancel',
      headers: {Authorization: `Terminal 8.${secret}`},
      body: {deviceId: 'device-1'},
      safeRetryable: true,
    });
    expect(transport.reportHttpAddressAvailable).toHaveBeenCalledTimes(1);

    const reset = vi.fn();
    const success = await handler.handle({
      ...makeContext({
        device: {
          getDeviceInfo: async () => ({
            status: 'succeeded',
            value: {deviceId: 'ter-web-run-fixture', systemName: 'Web'},
          }),
        },
        appControl: {resetRuntime: reset},
      }),
      requestApplicationReset: reset,
    } as never);
    expect(success).toEqual({status: 'CANCELLED'});
    expect(cancellationDiagnostics.events).toContainEqual(
      expect.objectContaining({
        event: 'cancel-activation-request-result',
        data: expect.objectContaining({
          kind: 'success',
          status: 200,
          requestId: 'req-cancel-success-001',
          correlationId: 'corr-cancel-success-001',
        }),
      }),
    );
    expect(JSON.stringify(cancellationDiagnostics.events)).not.toContain(secret);
    expect(JSON.stringify(cancellationDiagnostics.events)).not.toContain('Authorization');
    expect(transport.stop).toHaveBeenCalledWith({profileId: 'terminal-data-client'});
    expect(reset).toHaveBeenCalledWith('TERMINAL_ACTIVATION_CANCELLED');
    const webResetLog = createActivationTestLogger();
    const webContext = {
      ...makeContext({
        device: {
          getDeviceInfo: async () => ({
            status: 'succeeded',
            value: {deviceId: 'ter-web-run-fixture', systemName: 'Web'},
          }),
        },
        appControl: {resetRuntime: reset},
        logger: webResetLog.logger,
      }),
    };
    await actor.afterApplicationReset(webContext as never, 'TERMINAL_ACTIVATION_CANCELLED');
    expect(reset).toHaveBeenCalledTimes(1);
    expect(webResetLog.events).toContainEqual(
      expect.objectContaining({
        event: 'web-runtime-reset-observation-not-applicable',
        data: {platform: 'Web', outcome: 'in-process-reset'},
      }),
    );
    actor.dispose();
  });

  it('resends the TDS authentication frame on each generic transport reopen', async () => {
    const secret = 'A'.repeat(43);
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    state = terminalDataClientReducer(
      state,
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'workspace-1',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        deviceId: 'device-1',
        bindingGeneration: 7,
        credentialSecret: secret,
      }),
    );
    let onTransportEvent: ((event: TransportConnectionEvent) => void) | undefined;
    const connection = {
      send: vi.fn(async (_raw: string) => undefined),
      subscribe: vi.fn((listener: (event: TransportConnectionEvent) => void) => {
        onTransportEvent = listener;
        return () => {
          onTransportEvent = undefined;
        };
      }),
    };
    const transport = {
      start: vi.fn(async () => connection),
      ready: vi.fn(async () => undefined),
      invalid: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      executeHttp: vi.fn(async () => ({kind: 'failure' as const, category: 'not-delivered' as const, code: 'unused'})),
      reportHttpAddressAvailable: vi.fn(async () => undefined),
    };
    const actor = createTerminalDataClientActor({
      businessServerName: 'terminal-business-api',
      transport,
      createCredentialSecret: () => secret,
      now: () => 1_000,
      appVersion: '1.0.0',
      surfaceForm: 'laptop',
    });
    const makeContext = (commandName: string, payload: unknown): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {
          device: {getDeviceInfo: async () => ({status: 'succeeded', value: {deviceId: 'device-1'}, completedAt: 1})},
        },
        command: {commandName, payload, requestId: null, commandId: 'test-command'} as never,
        actor: {actorKey: actor.actor.actorKey, moduleName: actor.actor.moduleName, actorName: actor.actor.actorName},
        getState: () => actorState(state),
        dispatchAction: (action: unknown) => {
          state = terminalDataClientReducer(state, action as never);
          return action as never;
        },
        flushPersistence: async () => ({status: 'succeeded'}),
        subscribeState: () => () => undefined,
        dispatchCommand: async (definition: CommandDefinition, childPayload: StateJsonValue) => {
          if (definition.commandName === terminalTransportEventCommand.commandName) {
            const childHandler = actor.actor.handlers.find(
              handler => handler.commandName === terminalTransportEventCommand.commandName,
            );
            await childHandler?.handle(makeContext(terminalTransportEventCommand.commandName, childPayload));
          }
          return {status: 'completed'};
        },
        requestApplicationReset: () => undefined,
      }) as unknown as ActorExecutionContext;
    const connectHandler = actor.actor.handlers.find(
      handler => handler.commandName === connectTerminalCommand.commandName,
    );
    const eventHandler = actor.actor.handlers.find(
      handler => handler.commandName === terminalTransportEventCommand.commandName,
    );
    const disconnectHandler = actor.actor.handlers.find(
      handler => handler.commandName === disconnectTerminalCommand.commandName,
    );
    if (connectHandler === undefined || eventHandler === undefined || disconnectHandler === undefined)
      throw new Error('terminal transport handlers are missing');

    await connectHandler.handle(makeContext(connectTerminalCommand.commandName, {}));
    expect(connection.send).not.toHaveBeenCalled();
    onTransportEvent?.({type: 'open', addressName: 'backup'});
    await Promise.resolve();
    await Promise.resolve();
    expect(connection.send).toHaveBeenCalledTimes(1);
    expect(connection.send.mock.calls[0]?.[0]).toContain(`7.${secret}`);
    expect(transport.ready).not.toHaveBeenCalled();
    await disconnectHandler.handle(makeContext(disconnectTerminalCommand.commandName, {}));
    expect(transport.stop).toHaveBeenCalledWith({profileId: 'terminal-data-client'});
    expect(selectConnectionState({[terminalDataClientStateSlice.name]: state} as unknown as StateRoot).status).toBe(
      'stopped',
    );
    actor.dispose();
  });

  it('ignores unknown protocol fields and exposes SESSION_READY/PONG state through selectors', async () => {
    const secret = 'A'.repeat(43);
    let now = Date.parse('2026-10-01T00:00:00Z');
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    state = terminalDataClientReducer(
      state,
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'workspace-1',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        deviceId: 'device-1',
        bindingGeneration: 8,
        credentialSecret: secret,
      }),
    );
    const sentFrames: string[] = [];
    const connection = {
      send: vi.fn(async (raw: string) => {
        sentFrames.push(raw);
      }),
      subscribe: vi.fn(() => () => undefined),
    };
    const transport = {
      start: vi.fn(async () => connection),
      ready: vi.fn(async () => undefined),
      invalid: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      executeHttp: vi.fn(async () => ({kind: 'failure' as const, category: 'not-delivered' as const, code: 'unused'})),
      reportHttpAddressAvailable: vi.fn(async () => undefined),
    };
    const diagnostics = createActivationTestLogger();
    const actor = createTerminalDataClientActor({
      transport,
      businessServerName: 'terminal-business-api',
      createCredentialSecret: () => secret,
      now: () => now,
      appVersion: '1.0.0',
      surfaceForm: 'laptop',
    });
    const makeContext = (commandName: string, payload: unknown): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {
          logger: diagnostics.logger,
          device: {getDeviceInfo: async () => ({status: 'succeeded', value: {deviceId: 'device-1'}, completedAt: 1})},
        },
        command: {commandName, payload, requestId: null, commandId: 'test-command'} as never,
        actor: {actorKey: actor.actor.actorKey, moduleName: actor.actor.moduleName, actorName: actor.actor.actorName},
        getState: () => actorState(state),
        dispatchAction: (action: unknown) => {
          state = terminalDataClientReducer(state, action as never);
          return action as never;
        },
        flushPersistence: async () => ({status: 'succeeded'}),
        subscribeState: () => () => undefined,
        dispatchCommand: async () => ({status: 'completed'}),
        requestApplicationReset: () => undefined,
      }) as unknown as ActorExecutionContext;
    const findHandler = (commandName: string): NonNullable<(typeof actor.actor.handlers)[number]> => {
      const handler = actor.actor.handlers.find(candidate => candidate.commandName === commandName);
      if (handler === undefined) throw new Error(`terminal-data-client handler missing: ${commandName}`);
      return handler;
    };

    await findHandler(connectTerminalCommand.commandName).handle(makeContext(connectTerminalCommand.commandName, {}));
    expect(transport.start).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'terminal-data-client',
        serverName: 'terminal-data-server',
        endpointPathAndQuery: '/tdp/workspace-1/ws',
      }),
    );
    await findHandler(terminalTransportEventCommand.commandName).handle(
      makeContext(terminalTransportEventCommand.commandName, {
        event: {
          type: 'message',
          raw: JSON.stringify({
            type: 'SESSION_READY',
            sessionId: 'session-1',
            nodeId: 'tds-a',
            serverTime: '2026-10-01T00:00:00Z',
            heartbeatIntervalMs: 1_000,
            heartbeatTimeoutMs: 3_000,
            extension: {items: [1, {note: 'x'.repeat(1_024)}]},
          }),
        },
      }),
    );
    expect(selectConnectionState({[terminalDataClientStateSlice.name]: state} as unknown as StateRoot)).toMatchObject({
      status: 'connected',
      nodeId: 'tds-a',
    });
    expect(transport.ready).toHaveBeenCalledWith({profileId: 'terminal-data-client', stableAfterMs: 1_000});

    const repeatedConnect = await findHandler(connectTerminalCommand.commandName).handle(
      makeContext(connectTerminalCommand.commandName, {}),
    );
    expect(repeatedConnect).toEqual({status: 'connected'});
    expect(transport.start).toHaveBeenCalledTimes(1);
    expect(transport.stop).not.toHaveBeenCalled();

    await findHandler(terminalHeartbeatTickCommand.commandName).handle(
      makeContext(terminalHeartbeatTickCommand.commandName, {}),
    );
    expect(JSON.parse(sentFrames.at(-1) ?? '{}')).toMatchObject({type: 'PING', seq: 1});
    now += 1_237;
    await findHandler(terminalTransportEventCommand.commandName).handle(
      makeContext(terminalTransportEventCommand.commandName, {
        event: {
          type: 'message',
          raw: JSON.stringify({type: 'PONG', seq: 1, serverTs: '2026-10-01T00:00:01Z', extension: ['ignored']}),
        },
      }),
    );
    expect(selectConnectionLatency({[terminalDataClientStateSlice.name]: state} as unknown as StateRoot, now)).toEqual({
      lastRttMs: 1_237,
      samples: [{rttMs: 1_237, observedAt: now}],
    });
    expect(diagnostics.events).toContainEqual(
      expect.objectContaining({
        category: 'terminal.connection.heartbeat',
        event: 'heartbeat-pong-matched',
        data: {profileId: 'terminal-data-client', sequence: 1, rttMs: 1_237},
      }),
    );
    expect(transport.invalid).not.toHaveBeenCalled();
    await findHandler(terminalTransportEventCommand.commandName).handle(
      makeContext(terminalTransportEventCommand.commandName, {
        event: {
          type: 'message',
          raw: JSON.stringify({type: 'FUTURE_MESSAGE', extension: {willBeIgnored: true}}),
        },
      }),
    );
    expect(transport.invalid).not.toHaveBeenCalled();
    await findHandler(terminalTransportEventCommand.commandName).handle(
      makeContext(terminalTransportEventCommand.commandName, {
        event: {
          type: 'message',
          raw: '{"type":"PONG","seq":1,"seq":2,"serverTs":"2026-10-01T00:00:01Z"}',
        },
      }),
    );
    expect(transport.invalid).toHaveBeenCalledWith({profileId: 'terminal-data-client', cause: 'PROTOCOL_INVALID'});
    actor.dispose();
  });

  it('isolates shared topic subscriptions and accepts only the latest matching notification', async () => {
    const secret = 'A'.repeat(43);
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    state = terminalDataClientReducer(
      state,
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'workspace-1',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        deviceId: 'device-1',
        bindingGeneration: 8,
        credentialSecret: secret,
      }),
    );
    const sentFrames: string[] = [];
    const dispatchedTopics: unknown[] = [];
    const connection = {
      send: vi.fn(async (raw: string) => {
        sentFrames.push(raw);
      }),
      subscribe: vi.fn(() => () => undefined),
    };
    const transport = {
      start: vi.fn(async () => connection),
      ready: vi.fn(async () => undefined),
      invalid: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      executeHttp: vi.fn(async () => ({kind: 'failure' as const, category: 'not-delivered' as const, code: 'unused'})),
      reportHttpAddressAvailable: vi.fn(async () => undefined),
    };
    const actor = createTerminalDataClientActor({
      transport,
      businessServerName: 'terminal-business-api',
      createCredentialSecret: () => secret,
      now: () => 1_000,
      appVersion: '1.0.0',
      surfaceForm: 'laptop',
    });
    const makeContext = (commandName: string, payload: unknown): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {},
        command: {commandName, payload, requestId: 'request-id', commandId: 'command-id'} as never,
        actor: {actorKey: actor.actor.actorKey, moduleName: actor.actor.moduleName, actorName: actor.actor.actorName},
        getState: () => actorState(state),
        dispatchAction: (action: unknown) => {
          state = terminalDataClientReducer(state, action as never);
          return action as never;
        },
        flushPersistence: async () => ({status: 'succeeded'}),
        subscribeState: () => () => undefined,
        dispatchCommand: async (definition: CommandDefinition, childPayload: StateJsonValue) => {
          if (definition.commandName === terminalTopicChangedCommand.commandName) dispatchedTopics.push(childPayload);
          return {status: 'completed'};
        },
        requestApplicationReset: () => undefined,
      }) as unknown as ActorExecutionContext;
    const findHandler = (commandName: string) => {
      const handler = actor.actor.handlers.find(candidate => candidate.commandName === commandName);
      if (handler === undefined) throw new Error(`terminal topic handler missing: ${commandName}`);
      return handler;
    };
    const subscribe = findHandler(subscribeTerminalTopicCommand.commandName);
    const ownerRef = 'f756e82d-28f5-4d09-9a2a-7d2c6e3f0c1a';
    const first = await subscribe.handle(
      makeContext(subscribeTerminalTopicCommand.commandName, {
        subscriberKey: 'feature.store-basic',
        topicKey: 'STORE',
        ownerRef,
        initialTimeEpochMillis: 100,
      }),
    );
    const duplicate = await subscribe.handle(
      makeContext(subscribeTerminalTopicCommand.commandName, {
        subscriberKey: 'feature.store-basic',
        topicKey: 'STORE',
        ownerRef,
        initialTimeEpochMillis: 50,
      }),
    );
    const second = await subscribe.handle(
      makeContext(subscribeTerminalTopicCommand.commandName, {
        subscriberKey: 'feature.other',
        topicKey: 'STORE',
        ownerRef,
        initialTimeEpochMillis: 75,
      }),
    );
    const invalidTopic = await subscribe.handle(
      makeContext(subscribeTerminalTopicCommand.commandName, {
        subscriberKey: 'feature.invalid',
        topicKey: 'UNRECOGNIZED',
        ownerRef,
        initialTimeEpochMillis: 75,
      }),
    );
    expect(first).toMatchObject({status: 'subscribed'});
    expect(first).toMatchObject({
      subscriptionId: expect.stringMatching(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/),
    });
    expect(duplicate).toEqual(expect.objectContaining({status: 'already-subscribed'}));
    expect(second).toMatchObject({status: 'subscribed'});
    expect(invalidTopic).toMatchObject({status: 'rejected', reason: 'INVALID_SUBSCRIPTION'});
    expect(selectTerminalTopicSubscriptions(actorState(state))).toHaveLength(2);

    await findHandler(connectTerminalCommand.commandName).handle(makeContext(connectTerminalCommand.commandName, {}));
    await findHandler(terminalTransportEventCommand.commandName).handle(
      makeContext(terminalTransportEventCommand.commandName, {
        event: {type: 'open', addressName: 'primary'},
      }),
    );
    await findHandler(terminalTransportEventCommand.commandName).handle(
      makeContext(terminalTransportEventCommand.commandName, {
        event: {
          type: 'message',
          raw: JSON.stringify({
            type: 'SESSION_READY',
            sessionId: 'session-1',
            nodeId: 'tds-1',
            serverTime: '2026-10-04T00:00:00Z',
            heartbeatIntervalMs: 1_000,
            heartbeatTimeoutMs: 3_000,
          }),
        },
      }),
    );
    const subscribeFrames = sentFrames.map(raw => JSON.parse(raw)).filter(frame => frame.type === 'TOPIC_SUBSCRIBE');
    expect(subscribeFrames).toHaveLength(2);
    expect(subscribeFrames.map(frame => frame.lastAcceptedTimeEpochMillis).sort((left, right) => left - right)).toEqual(
      [75, 100],
    );

    const firstSubscription = selectTerminalTopicSubscriptions(actorState(state)).find(
      item => item.subscriberKey === 'feature.store-basic',
    );
    if (firstSubscription === undefined) throw new Error('first topic subscription missing');
    const deliver = (notificationId: string, time: number) =>
      findHandler(terminalTransportEventCommand.commandName).handle(
        makeContext(terminalTransportEventCommand.commandName, {
          event: {
            type: 'message',
            raw: JSON.stringify({
              type: 'TOPIC_CHANGED',
              notificationId,
              subscriptionId: firstSubscription.subscriptionId,
              topicKey: 'STORE',
              ownerRef,
              topicTimeEpochMillis: time,
            }),
          },
        }),
      );
    const oldNotificationId = '8b81d930-f455-407c-88b6-e777934e54c2';
    const currentNotificationId = '9c92ea41-a566-418d-99c7-f888a45f65d3';
    await deliver(oldNotificationId, 100);
    await deliver(currentNotificationId, 200);
    expect(dispatchedTopics).toHaveLength(2);
    expect(dispatchedTopics[0]).toMatchObject({
      subscriberKey: 'feature.store-basic',
      notification: {topicTimeEpochMillis: 100},
    });
    expect(
      await findHandler(acceptTerminalTopicNotificationCommand.commandName).handle(
        makeContext(acceptTerminalTopicNotificationCommand.commandName, {
          subscriberKey: 'feature.store-basic',
          subscriptionId: firstSubscription.subscriptionId,
          notificationId: oldNotificationId,
        }),
      ),
    ).toMatchObject({status: 'rejected', reason: 'STALE_NOTIFICATION'});
    expect(
      await findHandler(acceptTerminalTopicNotificationCommand.commandName).handle(
        makeContext(acceptTerminalTopicNotificationCommand.commandName, {
          subscriberKey: 'feature.store-basic',
          subscriptionId: firstSubscription.subscriptionId,
          notificationId: currentNotificationId,
        }),
      ),
    ).toMatchObject({status: 'accepted', acceptedTimeEpochMillis: 200});
    expect(JSON.parse(sentFrames.at(-1) ?? '{}')).toMatchObject({
      type: 'TOPIC_ACCEPT',
      notificationId: currentNotificationId,
      acceptedTimeEpochMillis: 200,
    });
    expect(
      selectTerminalTopicSubscriptions(actorState(state)).find(item => item.subscriberKey === 'feature.store-basic'),
    ).toMatchObject({acceptedTimeEpochMillis: 200, pendingNotification: null});

    await findHandler(unsubscribeTerminalTopicCommand.commandName).handle(
      makeContext(unsubscribeTerminalTopicCommand.commandName, {
        subscriberKey: 'feature.store-basic',
        topicKey: 'STORE',
        ownerRef,
      }),
    );
    expect(selectTerminalTopicSubscriptions(actorState(state))).toHaveLength(1);
    expect(selectTerminalTopicSubscriptions(actorState(state))[0]).toMatchObject({subscriberKey: 'feature.other'});
    expect(JSON.parse(sentFrames.at(-1) ?? '{}')).toMatchObject({type: 'TOPIC_UNSUBSCRIBE'});
    actor.dispose();
  });

  it('resends accepted topic times after reconnect without replacing them with old initialization time', async () => {
    const secret = 'B'.repeat(43);
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    state = terminalDataClientReducer(
      state,
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'workspace-1',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        deviceId: 'device-1',
        bindingGeneration: 9,
        credentialSecret: secret,
      }),
    );
    const sentFrames: string[] = [];
    const connection = {
      send: vi.fn(async (raw: string) => {
        sentFrames.push(raw);
      }),
      subscribe: vi.fn(() => () => undefined),
    };
    const transport = {
      start: vi.fn(async () => connection),
      ready: vi.fn(async () => undefined),
      invalid: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      executeHttp: vi.fn(async () => ({kind: 'failure' as const, category: 'not-delivered' as const, code: 'unused'})),
      reportHttpAddressAvailable: vi.fn(async () => undefined),
    };
    const actor = createTerminalDataClientActor({
      transport,
      businessServerName: 'terminal-business-api',
      createCredentialSecret: () => secret,
      now: () => 1_000,
      appVersion: '1.0.0',
      surfaceForm: 'laptop',
    });
    const makeContext = (commandName: string, payload: unknown): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {},
        command: {commandName, payload, requestId: 'request-id', commandId: 'command-id'} as never,
        actor: {actorKey: actor.actor.actorKey, moduleName: actor.actor.moduleName, actorName: actor.actor.actorName},
        getState: () => actorState(state),
        dispatchAction: (action: unknown) => {
          state = terminalDataClientReducer(state, action as never);
          return action as never;
        },
        flushPersistence: async () => ({status: 'succeeded'}),
        subscribeState: () => () => undefined,
        dispatchCommand: async () => ({status: 'completed'}),
        requestApplicationReset: () => undefined,
      }) as unknown as ActorExecutionContext;
    const findHandler = (commandName: string) => {
      const handler = actor.actor.handlers.find(candidate => candidate.commandName === commandName);
      if (handler === undefined) throw new Error(`terminal topic handler missing: ${commandName}`);
      return handler;
    };
    const ownerRef = 'f756e82d-28f5-4d09-9a2a-7d2c6e3f0c1a';
    const subscribePayload = {
      subscriberKey: 'feature.store-basic',
      topicKey: 'STORE',
      ownerRef,
      initialTimeEpochMillis: 100,
    };
    await findHandler(subscribeTerminalTopicCommand.commandName).handle(
      makeContext(subscribeTerminalTopicCommand.commandName, subscribePayload),
    );
    await findHandler(connectTerminalCommand.commandName).handle(makeContext(connectTerminalCommand.commandName, {}));
    const ready = () =>
      findHandler(terminalTransportEventCommand.commandName).handle(
        makeContext(terminalTransportEventCommand.commandName, {
          event: {
            type: 'message',
            raw: JSON.stringify({
              type: 'SESSION_READY',
              sessionId: 'session-1',
              nodeId: 'tds-1',
              serverTime: '2026-10-04T00:00:00Z',
              heartbeatIntervalMs: 1_000,
              heartbeatTimeoutMs: 3_000,
            }),
          },
        }),
      );
    await findHandler(terminalTransportEventCommand.commandName).handle(
      makeContext(terminalTransportEventCommand.commandName, {
        event: {type: 'open', addressName: 'primary'},
      }),
    );
    await ready();
    const subscriptionId = selectTerminalTopicSubscriptions(actorState(state))[0]!.subscriptionId;
    await findHandler(terminalTransportEventCommand.commandName).handle(
      makeContext(terminalTransportEventCommand.commandName, {
        event: {
          type: 'message',
          raw: JSON.stringify({
            type: 'TOPIC_CHANGED',
            notificationId: '8b81d930-f455-407c-88b6-e777934e54c2',
            subscriptionId,
            topicKey: 'STORE',
            ownerRef,
            topicTimeEpochMillis: 200,
          }),
        },
      }),
    );
    expect(
      await findHandler(acceptTerminalTopicNotificationCommand.commandName).handle(
        makeContext(acceptTerminalTopicNotificationCommand.commandName, {
          subscriberKey: 'feature.store-basic',
          subscriptionId,
          notificationId: '8b81d930-f455-407c-88b6-e777934e54c2',
        }),
      ),
    ).toMatchObject({status: 'accepted', acceptedTimeEpochMillis: 200});
    expect(selectTerminalTopicSubscriptions(actorState(state))[0]).toMatchObject({acceptedTimeEpochMillis: 200});
    await findHandler(terminalTransportEventCommand.commandName).handle(
      makeContext(terminalTransportEventCommand.commandName, {
        event: {type: 'close', code: 1006},
      }),
    );
    await findHandler(connectTerminalCommand.commandName).handle(makeContext(connectTerminalCommand.commandName, {}));
    await findHandler(terminalTransportEventCommand.commandName).handle(
      makeContext(terminalTransportEventCommand.commandName, {
        event: {type: 'open', addressName: 'primary'},
      }),
    );
    await ready();
    const subscribeFrames = sentFrames.map(raw => JSON.parse(raw)).filter(frame => frame.type === 'TOPIC_SUBSCRIBE');
    expect(subscribeFrames.map(frame => frame.lastAcceptedTimeEpochMillis)).toEqual([100, 200]);
    expect(subscribeFrames[0]?.subscriptionId).toBe(subscribeFrames[1]?.subscriptionId);
    expect(
      await findHandler(subscribeTerminalTopicCommand.commandName).handle(
        makeContext(subscribeTerminalTopicCommand.commandName, {...subscribePayload, initialTimeEpochMillis: 50}),
      ),
    ).toMatchObject({status: 'already-subscribed'});
    expect(selectTerminalTopicSubscriptions(actorState(state))[0]).toMatchObject({acceptedTimeEpochMillis: 200});
    actor.dispose();
  });

  it('preserves the client session for repeated connect and resumes only backoff or stopped states', async () => {
    const secret = 'D'.repeat(43);
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    state = terminalDataClientReducer(
      state,
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'workspace-1',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        deviceId: 'device-1',
        bindingGeneration: 1,
        credentialSecret: secret,
      }),
    );
    const firstUnsubscribe = vi.fn();
    const backoffUnsubscribe = vi.fn();
    const firstConnection = {
      send: vi.fn(async (_raw: string) => undefined),
      subscribe: vi.fn(() => firstUnsubscribe),
    };
    const backoffConnection = {
      send: vi.fn(async (_raw: string) => undefined),
      subscribe: vi.fn(() => backoffUnsubscribe),
    };
    const restartedConnection = {
      send: vi.fn(async (_raw: string) => undefined),
      subscribe: vi.fn(() => vi.fn()),
    };
    let resolveFirstStart!: (connection: typeof firstConnection) => void;
    const transport = {
      start: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<typeof firstConnection>(resolve => {
              resolveFirstStart = resolve;
            }),
        )
        .mockResolvedValueOnce(backoffConnection)
        .mockResolvedValueOnce(restartedConnection),
      ready: vi.fn(async () => undefined),
      invalid: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      executeHttp: vi.fn(),
      reportHttpAddressAvailable: vi.fn(async () => undefined),
    };
    const actorRuntime = createTerminalDataClientActor({
      transport,
      businessServerName: 'terminal-business-api',
      createCredentialSecret: () => secret,
      now: () => 1_000,
      appVersion: '1.0.0',
      surfaceForm: 'laptop',
    } as never);
    const actor = actorRuntime.actor;
    const makeContext = (commandName: string, payload: unknown): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {},
        command: {commandName, payload, requestId: null, commandId: 'connect-idempotency-test'} as never,
        actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
        getState: () => actorState(state),
        dispatchAction: (action: unknown) => {
          state = terminalDataClientReducer(state, action as never);
          return action as never;
        },
        flushPersistence: async () => ({status: 'succeeded'}),
        subscribeState: () => () => undefined,
        dispatchCommand: async () => ({status: 'completed'}),
        requestApplicationReset: () => undefined,
      }) as unknown as ActorExecutionContext;
    const findHandler = (commandName: string): NonNullable<(typeof actor.handlers)[number]> => {
      const handler = actor.handlers.find(candidate => candidate.commandName === commandName);
      if (handler === undefined) throw new Error(`terminal client handler missing: ${commandName}`);
      return handler;
    };
    const connect = findHandler(connectTerminalCommand.commandName);
    const events = findHandler(terminalTransportEventCommand.commandName);
    const heartbeat = findHandler(terminalHeartbeatTickCommand.commandName);
    const disconnect = findHandler(disconnectTerminalCommand.commandName);

    const firstStart = connect.handle(makeContext(connectTerminalCommand.commandName, {}));
    expect(selectConnectionState({[terminalDataClientStateSlice.name]: state} as unknown as StateRoot).status).toBe(
      'connecting',
    );
    expect(await connect.handle(makeContext(connectTerminalCommand.commandName, {}))).toEqual({status: 'connecting'});
    expect(transport.start).toHaveBeenCalledTimes(1);
    expect(transport.stop).not.toHaveBeenCalled();
    resolveFirstStart(firstConnection);
    await firstStart;

    await events.handle(
      makeContext(terminalTransportEventCommand.commandName, {event: {type: 'open', addressName: 'primary'}}),
    );
    await events.handle(
      makeContext(terminalTransportEventCommand.commandName, {
        event: {
          type: 'message',
          raw: JSON.stringify({
            type: 'SESSION_READY',
            sessionId: 'session-1',
            nodeId: 'tds-1',
            serverTime: '2026-10-01T00:00:00Z',
            heartbeatIntervalMs: 1_000,
            heartbeatTimeoutMs: 3_000,
          }),
        },
      }),
    );
    expect(await connect.handle(makeContext(connectTerminalCommand.commandName, {}))).toEqual({status: 'connected'});
    expect(transport.start).toHaveBeenCalledTimes(1);
    expect(transport.stop).not.toHaveBeenCalled();
    expect(firstConnection.subscribe).toHaveBeenCalledTimes(1);
    expect(firstUnsubscribe).not.toHaveBeenCalled();
    await heartbeat.handle(makeContext(terminalHeartbeatTickCommand.commandName, {}));
    expect(firstConnection.send).toHaveBeenCalledWith(expect.stringContaining('"type":"PING"'));

    await events.handle(makeContext(terminalTransportEventCommand.commandName, {event: {type: 'close', code: 1006}}));
    expect(selectConnectionState({[terminalDataClientStateSlice.name]: state} as unknown as StateRoot).status).toBe(
      'backoff',
    );
    await connect.handle(makeContext(connectTerminalCommand.commandName, {}));
    expect(transport.start).toHaveBeenCalledTimes(2);
    expect(transport.stop).not.toHaveBeenCalled();
    expect(firstUnsubscribe).toHaveBeenCalledTimes(1);
    expect(selectConnectionState({[terminalDataClientStateSlice.name]: state} as unknown as StateRoot).status).toBe(
      'awaiting-ready',
    );

    await disconnect.handle(makeContext(disconnectTerminalCommand.commandName, {}));
    expect(selectConnectionState({[terminalDataClientStateSlice.name]: state} as unknown as StateRoot).status).toBe(
      'stopped',
    );
    await connect.handle(makeContext(connectTerminalCommand.commandName, {}));
    expect(transport.start).toHaveBeenCalledTimes(3);
    expect(transport.stop).toHaveBeenCalledTimes(1);
    actorRuntime.dispose();
  });

  it('renews the heartbeat deadline on each valid PONG while other sequences remain pending', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
    const secret = 'F'.repeat(43);
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    state = terminalDataClientReducer(
      state,
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'workspace-1',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        deviceId: 'device-1',
        bindingGeneration: 1,
        credentialSecret: secret,
      }),
    );
    const connection = {send: vi.fn(async () => undefined), subscribe: vi.fn(() => () => undefined)};
    const transport = {
      start: vi.fn(async () => connection),
      ready: vi.fn(async () => undefined),
      invalid: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      executeHttp: vi.fn(),
      reportHttpAddressAvailable: vi.fn(async () => undefined),
    };
    const diagnostics = createActivationTestLogger();
    const actorRuntime = createTerminalDataClientActor({
      transport,
      businessServerName: 'terminal-business-api',
      createCredentialSecret: () => secret,
      now: () => Date.now(),
      appVersion: '1.0.0',
      surfaceForm: 'laptop',
    });
    const findHandler = (commandName: string) => {
      const handler = actorRuntime.actor.handlers.find(candidate => candidate.commandName === commandName);
      if (handler === undefined) throw new Error(`terminal handler missing: ${commandName}`);
      return handler;
    };
    const makeContext = (commandName: string, payload: unknown): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {logger: diagnostics.logger},
        command: {commandName, payload, requestId: null, commandId: 'heartbeat-renewal-test'} as never,
        actor: {
          actorKey: actorRuntime.actor.actorKey,
          moduleName: actorRuntime.actor.moduleName,
          actorName: actorRuntime.actor.actorName,
        },
        getState: () => actorState(state),
        dispatchAction: (action: unknown) => {
          state = terminalDataClientReducer(state, action as never);
          return action as never;
        },
        flushPersistence: async () => ({status: 'succeeded'}),
        subscribeState: () => () => undefined,
        dispatchCommand: async (definition: CommandDefinition, childPayload: StateJsonValue) => {
          await findHandler(definition.commandName).handle(makeContext(definition.commandName, childPayload));
          return {status: 'completed'};
        },
        requestApplicationReset: () => undefined,
      }) as unknown as ActorExecutionContext;

    try {
      await findHandler(connectTerminalCommand.commandName).handle(makeContext(connectTerminalCommand.commandName, {}));
      await findHandler(terminalTransportEventCommand.commandName).handle(
        makeContext(terminalTransportEventCommand.commandName, {
          event: {
            type: 'message',
            raw: JSON.stringify({
              type: 'SESSION_READY',
              sessionId: 'session-1',
              nodeId: 'tds-1',
              serverTime: '2026-10-01T00:00:00Z',
              heartbeatIntervalMs: 1_000,
              heartbeatTimeoutMs: 3_000,
            }),
          },
        }),
      );
      for (let second = 1; second <= 8; second += 1) {
        await vi.advanceTimersByTimeAsync(1_000);
        if (second >= 3) {
          await findHandler(terminalTransportEventCommand.commandName).handle(
            makeContext(terminalTransportEventCommand.commandName, {
              event: {
                type: 'message',
                raw: JSON.stringify({
                  type: 'PONG',
                  seq: second - 2,
                  serverTs: '2026-10-01T00:00:00Z',
                }),
              },
            }),
          );
        }
      }
      expect(connection.send).toHaveBeenCalledTimes(8);
      expect(transport.invalid).not.toHaveBeenCalledWith({
        profileId: 'terminal-data-client',
        cause: 'HEARTBEAT_TIMEOUT',
      });
      expect(selectConnectionState({[terminalDataClientStateSlice.name]: state} as unknown as StateRoot).status).toBe(
        'connected',
      );
      expect(
        diagnostics.events.filter(
          value =>
            typeof value === 'object' &&
            value !== null &&
            (value as {event?: string}).event === 'heartbeat-pong-matched',
        ),
      ).toHaveLength(6);
    } finally {
      actorRuntime.dispose();
      vi.useRealTimers();
    }
  });

  it('blocks connect before waiting for cancellation stop and keeps cancellation visible if stop fails', async () => {
    for (const trigger of ['offline-command', 'activation-cancelled-close'] as const) {
      let rejectStop!: (error: Error) => void;
      const stop = vi.fn(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectStop = reject;
          }),
      );
      const secret = 'G'.repeat(43);
      let state = terminalDataClientReducer(undefined, {type: 'test/init'});
      state = terminalDataClientReducer(
        state,
        terminalDataClientActions.replaceCredential({
          groupWorkspaceKey: 'workspace-1',
          terminalRef: 'terminal-1',
          storeRef: 'store-1',
          deviceId: 'device-1',
          bindingGeneration: 1,
          credentialSecret: secret,
        }),
      );
      const actorRuntime = createTerminalDataClientActor({
        transport: {
          start: vi.fn(),
          ready: vi.fn(),
          invalid: vi.fn(),
          stop,
          executeHttp: vi.fn(),
          reportHttpAddressAvailable: vi.fn(),
        },
        businessServerName: 'terminal-business-api',
        createCredentialSecret: () => secret,
        now: () => 1_000,
        appVersion: '1.0.0',
        surfaceForm: 'laptop',
      } as never);
      const findHandler = (commandName: string) => {
        const handler = actorRuntime.actor.handlers.find(candidate => candidate.commandName === commandName);
        if (handler === undefined) throw new Error(`terminal handler missing: ${commandName}`);
        return handler;
      };
      const reset = vi.fn();
      const makeContext = (commandName: string, payload: unknown): ActorExecutionContext =>
        ({
          runtimeId: 'test-runtime',
          localNodeId: 'test-node',
          platformPorts: {},
          command: {commandName, payload, requestId: `request-${trigger}`, commandId: `cancel-${trigger}`} as never,
          actor: {
            actorKey: actorRuntime.actor.actorKey,
            moduleName: actorRuntime.actor.moduleName,
            actorName: actorRuntime.actor.actorName,
          },
          getState: () => actorState(state),
          dispatchAction: (action: unknown) => {
            state = terminalDataClientReducer(state, action as never);
            return action as never;
          },
          flushPersistence: async () => ({status: 'succeeded'}),
          subscribeState: () => () => undefined,
          dispatchCommand: async () => ({status: 'completed'}),
          requestApplicationReset: reset,
        }) as unknown as ActorExecutionContext;
      const cancelResult =
        trigger === 'offline-command'
          ? findHandler(cancelTerminalOfflineCommand.commandName).handle(
              makeContext(cancelTerminalOfflineCommand.commandName, {}),
            )
          : findHandler(terminalTransportEventCommand.commandName).handle(
              makeContext(terminalTransportEventCommand.commandName, {
                event: {type: 'close', code: 4000, reason: 'ACTIVATION_CANCELLED'},
              }),
            );
      const settledCancel = Promise.resolve(cancelResult).then(
        () => null,
        (error: unknown) => error,
      );
      expect(selectActivationState({[terminalDataClientStateSlice.name]: state} as unknown as StateRoot).status).toBe(
        'cancelling',
      );
      expect(
        await findHandler(connectTerminalCommand.commandName).handle(
          makeContext(connectTerminalCommand.commandName, {}),
        ),
      ).toEqual({
        status: 'rejected',
        reason: 'CANCELLATION_IN_PROGRESS',
      });
      rejectStop(new Error('stop failed'));
      expect(await settledCancel).toBeInstanceOf(Error);
      expect(selectActivationState({[terminalDataClientStateSlice.name]: state} as unknown as StateRoot).status).toBe(
        'cancelling',
      );
      expect(reset).not.toHaveBeenCalled();
      actorRuntime.dispose();
    }
  });

  it('logs and invalidates the transport when a WebSocket event command does not complete', async () => {
    const secret = 'A'.repeat(43);
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    state = terminalDataClientReducer(
      state,
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'workspace-1',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        deviceId: 'device-1',
        bindingGeneration: 8,
        credentialSecret: secret,
      }),
    );
    const logs: unknown[] = [];
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn((event: unknown) => {
        logs.push(event);
        return {status: 'succeeded'};
      }),
      scope: vi.fn(),
      withContext: vi.fn(),
    };
    logger.scope.mockReturnValue(logger as never);
    let listener: ((event: TransportConnectionEvent) => void) | undefined;
    let rejectInvalid!: () => void;
    const invalidStarted = new Promise<void>(resolve => {
      rejectInvalid = resolve;
    });
    const connection = {
      send: vi.fn(async () => undefined),
      subscribe: vi.fn((next: (event: TransportConnectionEvent) => void) => {
        listener = next;
        return () => {
          listener = undefined;
        };
      }),
    };
    const transport = {
      start: vi.fn(async () => connection),
      ready: vi.fn(async () => undefined),
      invalid: vi.fn(async () => {
        rejectInvalid();
      }),
      stop: vi.fn(async () => undefined),
      executeHttp: vi.fn(),
      reportHttpAddressAvailable: vi.fn(async () => undefined),
    };
    const actor = createTerminalDataClientActor({
      transport,
      businessServerName: 'terminal-business-api',
      createCredentialSecret: () => secret,
      now: () => 1_000,
      appVersion: '1.0.0',
      surfaceForm: 'laptop',
    });
    const makeContext = (commandName: string, payload: unknown): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {logger},
        command: {commandName, payload, requestId: null, commandId: 'background-dispatch-test'} as never,
        actor: {actorKey: actor.actor.actorKey, moduleName: actor.actor.moduleName, actorName: actor.actor.actorName},
        getState: () => actorState(state),
        dispatchAction: (action: unknown) => {
          state = terminalDataClientReducer(state, action as never);
          return action as never;
        },
        flushPersistence: async () => ({status: 'succeeded'}),
        subscribeState: () => () => undefined,
        dispatchCommand: async () => ({
          requestId: null,
          commandId: 'failed-background-command',
          status: 'error',
          actorResults: [],
        }),
        requestApplicationReset: () => undefined,
      }) as unknown as ActorExecutionContext;
    const connectHandler = actor.actor.handlers.find(
      handler => handler.commandName === connectTerminalCommand.commandName,
    );
    if (connectHandler === undefined) throw new Error('terminal connect handler missing');

    try {
      await connectHandler.handle(makeContext(connectTerminalCommand.commandName, {}));
      const raw = '{"type":"SESSION_READY","secret":"do-not-log-this-frame"}';
      listener?.({type: 'message', raw});
      await invalidStarted;

      expect(transport.invalid).toHaveBeenCalledWith({profileId: 'terminal-data-client', cause: 'NETWORK_ERROR'});
      expect(logs).toContainEqual(
        expect.objectContaining({
          event: 'background-command-dispatch-failed',
          data: expect.objectContaining({
            commandName: terminalTransportEventCommand.commandName,
            trigger: 'websocket-message',
            failureKind: 'dispatch-result-not-completed',
            dispatchStatus: 'error',
          }),
        }),
      );
      expect(JSON.stringify(logs)).not.toContain('do-not-log-this-frame');
    } finally {
      actor.dispose();
    }
  });

  it('logs and invalidates the transport when a heartbeat interval dispatch rejects', async () => {
    vi.useFakeTimers();
    const secret = 'A'.repeat(43);
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    state = terminalDataClientReducer(
      state,
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'workspace-1',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        deviceId: 'device-1',
        bindingGeneration: 8,
        credentialSecret: secret,
      }),
    );
    const logs: unknown[] = [];
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn((event: unknown) => {
        logs.push(event);
        return {status: 'succeeded'};
      }),
      scope: vi.fn(),
      withContext: vi.fn(),
    };
    logger.scope.mockReturnValue(logger as never);
    let rejectInvalid!: () => void;
    const invalidStarted = new Promise<void>(resolve => {
      rejectInvalid = resolve;
    });
    const connection = {send: vi.fn(async () => undefined), subscribe: vi.fn(() => () => undefined)};
    const transport = {
      start: vi.fn(async () => connection),
      ready: vi.fn(async () => undefined),
      invalid: vi.fn(async () => {
        rejectInvalid();
      }),
      stop: vi.fn(async () => undefined),
      executeHttp: vi.fn(),
      reportHttpAddressAvailable: vi.fn(async () => undefined),
    };
    const actor = createTerminalDataClientActor({
      transport,
      businessServerName: 'terminal-business-api',
      createCredentialSecret: () => secret,
      now: () => 1_000,
      appVersion: '1.0.0',
      surfaceForm: 'laptop',
    });
    const makeContext = (commandName: string, payload: unknown): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {logger},
        command: {commandName, payload, requestId: null, commandId: 'heartbeat-dispatch-test'} as never,
        actor: {actorKey: actor.actor.actorKey, moduleName: actor.actor.moduleName, actorName: actor.actor.actorName},
        getState: () => actorState(state),
        dispatchAction: (action: unknown) => {
          state = terminalDataClientReducer(state, action as never);
          return action as never;
        },
        flushPersistence: async () => ({status: 'succeeded'}),
        subscribeState: () => () => undefined,
        dispatchCommand: async (definition: CommandDefinition) => {
          if (definition.commandName === terminalHeartbeatTickCommand.commandName)
            return Promise.reject(new Error('do-not-log-dispatch-error'));
          return {requestId: null, commandId: 'completed-command', status: 'completed', actorResults: []};
        },
        requestApplicationReset: () => undefined,
      }) as unknown as ActorExecutionContext;
    const findHandler = (commandName: string) => {
      const handler = actor.actor.handlers.find(candidate => candidate.commandName === commandName);
      if (handler === undefined) throw new Error(`terminal handler missing: ${commandName}`);
      return handler;
    };

    try {
      await findHandler(connectTerminalCommand.commandName).handle(makeContext(connectTerminalCommand.commandName, {}));
      await findHandler(terminalTransportEventCommand.commandName).handle(
        makeContext(terminalTransportEventCommand.commandName, {
          event: {
            type: 'message',
            raw: JSON.stringify({
              type: 'SESSION_READY',
              sessionId: 'session-1',
              nodeId: 'tds-a',
              serverTime: '2026-10-01T00:00:00Z',
              heartbeatIntervalMs: 1_000,
              heartbeatTimeoutMs: 3_000,
            }),
          },
        }),
      );
      await vi.advanceTimersByTimeAsync(1_000);
      await invalidStarted;

      expect(transport.invalid).toHaveBeenCalledWith({profileId: 'terminal-data-client', cause: 'NETWORK_ERROR'});
      expect(logs).toContainEqual(
        expect.objectContaining({
          event: 'background-command-dispatch-failed',
          data: expect.objectContaining({
            commandName: terminalHeartbeatTickCommand.commandName,
            trigger: 'heartbeat-interval',
            failureKind: 'dispatch-rejected',
          }),
        }),
      );
      expect(JSON.stringify(logs)).not.toContain('do-not-log-dispatch-error');
    } finally {
      actor.dispose();
      vi.useRealTimers();
    }
  });

  it('logs and re-signals a heartbeat timeout when its close command does not complete', async () => {
    vi.useFakeTimers();
    const secret = 'A'.repeat(43);
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    state = terminalDataClientReducer(
      state,
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'workspace-1',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        deviceId: 'device-1',
        bindingGeneration: 8,
        credentialSecret: secret,
      }),
    );
    const logs: unknown[] = [];
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn((event: unknown) => {
        logs.push(event);
        return {status: 'succeeded'};
      }),
      scope: vi.fn(),
      withContext: vi.fn(),
    };
    logger.scope.mockReturnValue(logger as never);
    let rejectInvalid!: () => void;
    const invalidStarted = new Promise<void>(resolve => {
      rejectInvalid = resolve;
    });
    const connection = {send: vi.fn(async () => undefined), subscribe: vi.fn(() => () => undefined)};
    const transport = {
      start: vi.fn(async () => connection),
      ready: vi.fn(async () => undefined),
      invalid: vi.fn(async () => {
        rejectInvalid();
      }),
      stop: vi.fn(async () => undefined),
      executeHttp: vi.fn(),
      reportHttpAddressAvailable: vi.fn(async () => undefined),
    };
    const actor = createTerminalDataClientActor({
      transport,
      businessServerName: 'terminal-business-api',
      createCredentialSecret: () => secret,
      now: () => 1_000,
      appVersion: '1.0.0',
      surfaceForm: 'laptop',
    });
    const makeContext = (commandName: string, payload: unknown): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {logger},
        command: {commandName, payload, requestId: null, commandId: 'heartbeat-deadline-test'} as never,
        actor: {actorKey: actor.actor.actorKey, moduleName: actor.actor.moduleName, actorName: actor.actor.actorName},
        getState: () => actorState(state),
        dispatchAction: (action: unknown) => {
          state = terminalDataClientReducer(state, action as never);
          return action as never;
        },
        flushPersistence: async () => ({status: 'succeeded'}),
        subscribeState: () => () => undefined,
        dispatchCommand: async (definition: CommandDefinition, childPayload: StateJsonValue) => {
          if (
            definition.commandName === terminalTransportEventCommand.commandName &&
            (childPayload as {event?: {reason?: string}}).event?.reason === 'HEARTBEAT_TIMEOUT'
          )
            return {requestId: null, commandId: 'failed-timeout-command', status: 'timed-out', actorResults: []};
          return {requestId: null, commandId: 'completed-command', status: 'completed', actorResults: []};
        },
        requestApplicationReset: () => undefined,
      }) as unknown as ActorExecutionContext;
    const findHandler = (commandName: string) => {
      const handler = actor.actor.handlers.find(candidate => candidate.commandName === commandName);
      if (handler === undefined) throw new Error(`terminal handler missing: ${commandName}`);
      return handler;
    };

    try {
      await findHandler(connectTerminalCommand.commandName).handle(makeContext(connectTerminalCommand.commandName, {}));
      await findHandler(terminalTransportEventCommand.commandName).handle(
        makeContext(terminalTransportEventCommand.commandName, {
          event: {
            type: 'message',
            raw: JSON.stringify({
              type: 'SESSION_READY',
              sessionId: 'session-1',
              nodeId: 'tds-a',
              serverTime: '2026-10-01T00:00:00Z',
              heartbeatIntervalMs: 1_000,
              heartbeatTimeoutMs: 3_000,
            }),
          },
        }),
      );
      await findHandler(terminalHeartbeatTickCommand.commandName).handle(
        makeContext(terminalHeartbeatTickCommand.commandName, {}),
      );
      await vi.advanceTimersByTimeAsync(3_000);
      await invalidStarted;

      expect(transport.invalid).toHaveBeenCalledWith({profileId: 'terminal-data-client', cause: 'HEARTBEAT_TIMEOUT'});
      expect(logs).toContainEqual(
        expect.objectContaining({
          event: 'background-command-dispatch-failed',
          data: expect.objectContaining({
            commandName: terminalTransportEventCommand.commandName,
            trigger: 'heartbeat-deadline',
            failureKind: 'dispatch-result-not-completed',
            dispatchStatus: 'timed-out',
          }),
        }),
      );
    } finally {
      actor.dispose();
      vi.useRealTimers();
    }
  });

  it('persists remote execution before dispatch and releases only after matching result acknowledgement', async () => {
    const secret = 'R'.repeat(43);
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    state = terminalDataClientReducer(state, terminalDataClientActions.replaceCredential({
      groupWorkspaceKey: 'workspace-1', terminalRef: 'terminal-1', storeRef: 'store-1', deviceId: 'device-1',
      bindingGeneration: 7, credentialSecret: secret,
    }));
    const sent: string[] = [];
    const connection = {send: vi.fn(async (raw: string) => { sent.push(raw); }), subscribe: vi.fn(() => () => undefined)};
    const transport = {
      start: vi.fn(async () => connection), ready: vi.fn(async () => undefined), invalid: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined), executeHttp: vi.fn(), reportHttpAddressAvailable: vi.fn(async () => undefined),
    };
    const childDispatch = vi.fn(async () => ({
      requestId: 'local-request', commandId: 'local-command', status: 'completed',
      actorResults: [{actorKey: 'test.actor', status: 'completed', startedAt: 1, completedAt: 2, result: {changed: true}, error: null}],
    }));
    const actor = createTerminalDataClientActor({
      transport, businessServerName: 'terminal-business-api', createCredentialSecret: () => secret,
      now: () => 1_799_999_640_000, appVersion: 'test', surfaceForm: 'laptop',
    });
    const makeContext = (commandName: string, payload: unknown): ActorExecutionContext => ({
      runtimeId: 'test-runtime', localNodeId: 'test-node', platformPorts: {},
      command: {commandName, payload, requestId: 'root-request', commandId: 'root-command'} as never,
      actor: {actorKey: actor.actor.actorKey, moduleName: actor.actor.moduleName, actorName: actor.actor.actorName},
      getState: () => actorState(state),
      dispatchAction: (action: unknown) => { state = terminalDataClientReducer(state, action as never); return action as never; },
      flushPersistence: async () => ({status: 'succeeded'}), subscribeState: () => () => undefined,
      dispatchCommand: childDispatch as never, requestApplicationReset: () => undefined,
    }) as unknown as ActorExecutionContext;
    const handler = actor.actor.handlers.find(item => item.commandName === terminalTransportEventCommand.commandName)!;
    const runEvent = (event: TransportConnectionEvent) => handler.handle(makeContext(terminalTransportEventCommand.commandName, {event}));

    try {
      await actor.actor.handlers.find(item => item.commandName === connectTerminalCommand.commandName)!
        .handle(makeContext(connectTerminalCommand.commandName, {}));
      await runEvent({type: 'open', addressName: 'dev', configRevision: 4});
      await runEvent({type: 'message', raw: JSON.stringify({
        type: 'SESSION_READY', sessionId: 'session-1', nodeId: 'tds-1', serverTime: '2027-01-01T00:00:00Z',
        heartbeatIntervalMs: 1_000, heartbeatTimeoutMs: 3_000,
      })});
      await runEvent({type: 'message', raw: JSON.stringify({
        type: 'REMOTE_COMMAND', remoteOperationId: '5b7a27c6-2d14-4df5-9e13-07e58798a9cb',
        requestId: '1e947a10-c7d6-4e37-93a7-c0573a90c51b', bindingGeneration: 7,
        commandName: 'test.remote-noop', parameters: {scope: 'fixture'},
      })});

      expect(childDispatch).toHaveBeenCalledWith('test.remote-noop', {scope: 'fixture'}, expect.objectContaining({target: 'local'}));
      expect(Object.values(state.remoteOperations)).toHaveLength(1);
      expect(Object.values(state.remoteOperations)[0]).toMatchObject({phase: 'COMPLETED', configRevision: 4});
      const report = JSON.parse(sent.at(-1) ?? '{}');
      expect(report).toMatchObject({type: 'REMOTE_REPORT', phase: 'COMPLETED', result: {actorResults: [{actorKey: 'test.actor'}]}});
      await runEvent({type: 'message', raw: JSON.stringify({
        type: 'REMOTE_REPORT_ACK', reportId: report.reportId, remoteOperationId: report.remoteOperationId,
        requestId: report.requestId, acceptedAt: '2027-01-01T00:00:01Z',
      })});
      expect(state.remoteOperations).toEqual({});
    } finally {
      actor.dispose();
    }
  });

  it('replays a retained operation without redispatch and rejects conflicting request identity', async () => {
    const harness = createRemoteOperationHarness();
    try {
      await harness.connectReady();
      const message = harness.command();
      await harness.runEvent({type: 'message', raw: JSON.stringify(message)});
      const firstReport = JSON.parse(harness.sent.at(-1) ?? '{}');

      await expect(harness.runEvent({type: 'message', raw: JSON.stringify(message)})).resolves.toMatchObject({status: 'duplicate-reported'});
      const replay = JSON.parse(harness.sent.at(-1) ?? '{}');
      await expect(harness.runEvent({type: 'message', raw: JSON.stringify({...message, requestId: '2e947a10-c7d6-4e37-93e7-587e7a90c222'})}))
        .resolves.toMatchObject({status: 'REMOTE_OPERATION_ID_CONFLICT'});

      expect(harness.dispatchCommand).toHaveBeenCalledTimes(1);
      expect(replay).toMatchObject({remoteOperationId: firstReport.remoteOperationId, requestId: firstReport.requestId, reportId: firstReport.reportId});
      expect(JSON.parse(harness.sent.at(-1) ?? '{}')).toMatchObject({phase: 'FAILED', errorCode: 'REMOTE_OPERATION_ID_CONFLICT'});
      expect(Object.keys(harness.state().remoteOperations)).toHaveLength(1);
    } finally {
      harness.dispose();
    }
  });

  it('does not dispatch when RECEIVED or STARTED persistence fails', async () => {
    const firstFailure = createRemoteOperationHarness({
      flushPersistence: vi.fn().mockRejectedValue(new Error('storage unavailable')),
    });
    try {
      await firstFailure.connectReady();
      await expect(firstFailure.runEvent({type: 'message', raw: JSON.stringify(firstFailure.command())}))
        .resolves.toMatchObject({status: 'TERMINAL_PERSISTENCE_FAILED'});
      expect(firstFailure.dispatchCommand).not.toHaveBeenCalled();
      expect(firstFailure.state().remoteOperations).toEqual({});
      expect(JSON.parse(firstFailure.sent.at(-1) ?? '{}')).toMatchObject({phase: 'FAILED', errorCode: 'TERMINAL_PERSISTENCE_FAILED'});
    } finally {
      firstFailure.dispose();
    }

    const startedFailure = createRemoteOperationHarness({
      flushPersistence: vi.fn()
        .mockResolvedValueOnce({status: 'succeeded'})
        .mockRejectedValueOnce(new Error('storage unavailable')),
    });
    try {
      await startedFailure.connectReady();
      await expect(startedFailure.runEvent({type: 'message', raw: JSON.stringify(startedFailure.command())}))
        .resolves.toMatchObject({status: 'start-persistence-failed'});
      expect(startedFailure.dispatchCommand).not.toHaveBeenCalled();
      expect(Object.values(startedFailure.state().remoteOperations)).toMatchObject([expect.objectContaining({phase: 'RECEIVED'})]);
    } finally {
      startedFailure.dispose();
    }
  });

  it('retains an unacknowledged result through duplicate delivery and a failed ACK flush', async () => {
    const flush = vi.fn()
      .mockResolvedValueOnce({status: 'succeeded'})
      .mockResolvedValueOnce({status: 'succeeded'})
      .mockResolvedValueOnce({status: 'succeeded'})
      .mockRejectedValueOnce(new Error('storage unavailable'));
    const harness = createRemoteOperationHarness({flushPersistence: flush});
    try {
      await harness.connectReady();
      const message = harness.command();
      await harness.runEvent({type: 'message', raw: JSON.stringify(message)});
      const report = JSON.parse(harness.sent.at(-1) ?? '{}');
      await harness.runEvent({type: 'message', raw: JSON.stringify({...message})});
      expect(harness.dispatchCommand).toHaveBeenCalledTimes(1);

      await harness.runEvent({type: 'message', raw: JSON.stringify({
        type: 'REMOTE_REPORT_ACK', reportId: '4e947a10-c7d6-4e37-93e7-587e7a90c333',
        remoteOperationId: report.remoteOperationId, requestId: report.requestId, acceptedAt: '2027-01-01T00:00:01Z',
      })});
      expect(Object.keys(harness.state().remoteOperations)).toHaveLength(1);
      await expect(harness.runEvent({type: 'message', raw: JSON.stringify({
        type: 'REMOTE_REPORT_ACK', reportId: report.reportId, remoteOperationId: report.remoteOperationId,
        requestId: report.requestId, acceptedAt: '2027-01-01T00:00:01Z',
      })})).resolves.toMatchObject({status: 'remote-report-release-failed'});
      expect(Object.keys(harness.state().remoteOperations)).toHaveLength(1);
      expect(Object.values(harness.state().remoteOperations)[0]).toMatchObject({phase: 'COMPLETED'});
    } finally {
      harness.dispose();
    }
  });

  it('refuses the sixty-fifth retained operation without evicting existing facts', async () => {
    const harness = createRemoteOperationHarness({initialFacts: Array.from({length: 64}, (_, index) => remoteOperationFact(index + 1))});
    try {
      await harness.connectReady();
      await expect(harness.runEvent({type: 'message', raw: JSON.stringify(harness.command())}))
        .resolves.toMatchObject({status: 'REMOTE_OPERATION_LIMIT_REACHED'});
      expect(harness.dispatchCommand).not.toHaveBeenCalled();
      expect(Object.keys(harness.state().remoteOperations)).toHaveLength(64);
      expect(Object.values(harness.state().remoteOperations).map(fact => fact.remoteOperationId))
        .toEqual(Array.from({length: 64}, (_, index) => remoteOperationFact(index + 1).remoteOperationId));
    } finally {
      harness.dispose();
    }
  });

  it('marks persisted in-flight work UNKNOWN on reconnect and never redispatches it', async () => {
    const prior = remoteOperationFact(1, 'STARTED');
    const harness = createRemoteOperationHarness({initialFacts: [prior]});
    try {
      await harness.connectReady();
      expect(harness.dispatchCommand).not.toHaveBeenCalled();
      expect(Object.values(harness.state().remoteOperations)[0]).toMatchObject({
        remoteOperationId: prior.remoteOperationId, requestId: prior.requestId, phase: 'UNKNOWN', errorCode: 'REMOTE_RESULT_UNKNOWN',
      });
      expect(JSON.parse(harness.sent.at(-1) ?? '{}')).toMatchObject({type: 'REMOTE_REPORT', phase: 'UNKNOWN', remoteOperationId: prior.remoteOperationId});
      await harness.runEvent({type: 'message', raw: JSON.stringify(harness.command(prior.remoteOperationId, prior.requestId))});
      expect(harness.dispatchCommand).not.toHaveBeenCalled();
      expect(JSON.parse(harness.sent.at(-1) ?? '{}')).toMatchObject({phase: 'UNKNOWN', errorCode: 'REMOTE_RESULT_UNKNOWN'});
    } finally {
      harness.dispose();
    }
  });

  it('retains STARTED after its durable phase ACK while the local command is still running', async () => {
    let completeDispatch: ((value: unknown) => void) | undefined;
    const dispatch = vi.fn(() => new Promise(resolve => { completeDispatch = resolve; }));
    const harness = createRemoteOperationHarness({dispatchCommand: dispatch as never});
    try {
      await harness.connectReady();
      const commandPending = harness.runEvent({type: 'message', raw: JSON.stringify(harness.command())});
      await vi.waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
      const started = JSON.parse(harness.sent.at(-1) ?? '{}');
      expect(started).toMatchObject({type: 'REMOTE_REPORT', phase: 'STARTED'});
      await harness.runEvent({type: 'message', raw: JSON.stringify({
        type: 'REMOTE_REPORT_ACK', reportId: started.reportId, remoteOperationId: started.remoteOperationId,
        requestId: started.requestId, acceptedAt: '2027-01-01T00:00:01Z',
      })});
      expect(Object.values(harness.state().remoteOperations)).toMatchObject([expect.objectContaining({phase: 'STARTED'})]);

      completeDispatch?.({
        requestId: 'local-request', commandId: 'local-command', status: 'completed',
        actorResults: [{actorKey: 'test.actor', status: 'completed', startedAt: 1, completedAt: 2, result: {changed: true}, error: null}],
      });
      await commandPending;
      expect(Object.values(harness.state().remoteOperations)).toMatchObject([expect.objectContaining({phase: 'COMPLETED'})]);
    } finally {
      harness.dispose();
    }
  });

  it('reports a late actual result after UNKNOWN without dispatching again', async () => {
    type Dispatch = NonNullable<ActorExecutionContext['dispatchCommand']>;
    let lateOutcome: NonNullable<Parameters<Dispatch>[2]>['lateOutcome'];
    const dispatch = vi.fn(async (_name: string, _payload: unknown, options?: NonNullable<Parameters<Dispatch>[2]>) => {
      lateOutcome = options?.lateOutcome;
      return {requestId: 'local-request', commandId: 'local-command', status: 'timed-out', actorResults: []} as never;
    });
    const harness = createRemoteOperationHarness({dispatchCommand: dispatch as unknown as Dispatch});
    try {
      await harness.connectReady();
      const message = harness.command();
      await expect(harness.runEvent({type: 'message', raw: JSON.stringify(message)})).resolves.toMatchObject({status: 'unknown'});
      expect(Object.values(harness.state().remoteOperations)).toMatchObject([expect.objectContaining({phase: 'UNKNOWN'})]);
      expect(lateOutcome).toBeTypeOf('function');
      lateOutcome?.({
        actorKey: 'test.actor', status: 'completed', startedAt: 1, completedAt: 2,
        result: {changed: true}, error: null,
      } as never);
      await vi.waitFor(() => expect(Object.values(harness.state().remoteOperations)).toMatchObject([
        expect.objectContaining({phase: 'COMPLETED', resultJson: expect.stringContaining('changed')}),
      ]));
      await vi.waitFor(() => expect(JSON.parse(harness.sent.at(-1) ?? '{}')).toMatchObject({phase: 'COMPLETED'}));
      expect(harness.dispatchCommand).toHaveBeenCalledTimes(1);
    } finally {
      harness.dispose();
    }
  });

  it('discards the late result after a configuration change has cleared its map entry', async () => {
    type Dispatch = NonNullable<ActorExecutionContext['dispatchCommand']>;
    let lateOutcome: NonNullable<Parameters<Dispatch>[2]>['lateOutcome'];
    const dispatch = vi.fn(async (_name: string, _payload: unknown, options?: NonNullable<Parameters<Dispatch>[2]>) => {
      lateOutcome = options?.lateOutcome;
      return {requestId: 'local-request', commandId: 'local-command', status: 'timed-out', actorResults: []} as never;
    });
    const harness = createRemoteOperationHarness({dispatchCommand: dispatch as unknown as Dispatch});
    try {
      await harness.connectReady();
      await harness.runEvent({type: 'message', raw: JSON.stringify(harness.command())});
      expect(Object.values(harness.state().remoteOperations)).toMatchObject([expect.objectContaining({phase: 'UNKNOWN'})]);
      await harness.runEvent({type: 'open', addressName: 'dev-next', configRevision: 5});
      expect(harness.state().remoteOperations).toEqual({});

      lateOutcome?.({
        actorKey: 'test.actor', status: 'completed', startedAt: 1, completedAt: 2,
        result: {oldConfig: true}, error: null,
      } as never);
      await Promise.resolve();
      await Promise.resolve();
      expect(harness.state().remoteOperations).toEqual({});
      expect(harness.dispatchCommand).toHaveBeenCalledTimes(1);
    } finally {
      harness.dispose();
    }
  });

  it('does not restore a late result after root reset clears the persisted map', async () => {
    type Dispatch = NonNullable<ActorExecutionContext['dispatchCommand']>;
    let lateOutcome: NonNullable<Parameters<Dispatch>[2]>['lateOutcome'];
    const dispatch = vi.fn(async (_name: string, _payload: unknown, options?: NonNullable<Parameters<Dispatch>[2]>) => {
      lateOutcome = options?.lateOutcome;
      return {requestId: 'local-request', commandId: 'local-command', status: 'timed-out', actorResults: []} as never;
    });
    const harness = createRemoteOperationHarness({dispatchCommand: dispatch as unknown as Dispatch});
    try {
      await harness.connectReady();
      await harness.runEvent({type: 'message', raw: JSON.stringify(harness.command())});
      expect(Object.values(harness.state().remoteOperations)).toMatchObject([expect.objectContaining({phase: 'UNKNOWN'})]);

      const context = harness.makeContext('test.root-reset', {});
      context.dispatchAction(terminalDataClientActions.clearRemoteOperations());
      await harness.actor.afterApplicationReset(context as never, 'ROOT_RESET');
      expect(harness.state().remoteOperations).toEqual({});

      lateOutcome?.({
        actorKey: 'test.actor', status: 'completed', startedAt: 1, completedAt: 2,
        result: {oldRuntime: true}, error: null,
      } as never);
      await Promise.resolve();
      await Promise.resolve();
      expect(harness.state().remoteOperations).toEqual({});
      expect(dispatch).toHaveBeenCalledTimes(1);
    } finally {
      harness.dispose();
    }
  });

  it('does not restore a late result after server configuration clears its operation', async () => {
    let completeDispatch: ((value: Awaited<ReturnType<NonNullable<ActorExecutionContext['dispatchCommand']>>>) => void) | undefined;
    const dispatch = vi.fn(() => new Promise(resolve => { completeDispatch = resolve; }));
    const harness = createRemoteOperationHarness({dispatchCommand: dispatch as never});
    try {
      await harness.connectReady();
      const commandPending = harness.runEvent({type: 'message', raw: JSON.stringify(harness.command())});
      await vi.waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
      expect(Object.keys(harness.state().remoteOperations)).toHaveLength(1);
      await harness.runEvent({type: 'open', addressName: 'dev-next', configRevision: 5});
      expect(harness.state().remoteOperations).toEqual({});

      completeDispatch?.({
        requestId: 'local-request', commandId: 'local-command', status: 'completed',
        actorResults: [{actorKey: 'test.actor', status: 'completed', startedAt: 1, completedAt: 2, result: {oldConfig: true}, error: null}],
      } as never);
      await commandPending;
      expect(harness.state().remoteOperations).toEqual({});
      expect(dispatch).toHaveBeenCalledTimes(1);
    } finally {
      harness.dispose();
    }
  });
});
