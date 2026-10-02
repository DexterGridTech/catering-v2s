import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import {
  activateTerminalCommand,
  cancelTerminalOfflineCommand,
  cancelTerminalOnlineCommand,
  connectTerminalCommand,
  disconnectTerminalCommand,
  initializeTerminalDataClientCommand,
  terminalHeartbeatTickCommand,
  terminalTransportEventCommand,
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
} from '../src/selectors/selectTerminalDataClientState';
import type {ActorExecutionContext, CommandDefinition} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue, StateRoot} from '@catering-v2s/kernel-base-state';
import type {TransportConnectionEvent} from '@catering-v2s/kernel-base-transport';

describe('terminal-data-client activation command actor', () => {
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
          terminalRef: 'terminal-1',
          storeRef: 'store-1',
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
        getState: () => ({[terminalDataClientStateSlice.name]: state}) as StateRoot,
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
          terminalRef: 'terminal-1',
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
        status: 200,
        body: {
          terminalRef: 'terminal-1',
          storeRef: 'store-1',
          groupWorkspaceKey: 'workspace-1',
          bindingGeneration: 2,
        },
      };
    });
    const createCredentialSecret = vi.fn(() => secret);
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
      },
      command: {
        payload: {
          operationId: 'operation-1',
          groupWorkspaceKey: 'workspace-1',
          activationCode: '12345678',
          surfaceForm: 'laptop',
          appVersion: '1.0.0',
        },
        requestId: null,
      },
      actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
      getState: () => ({[terminalDataClientStateSlice.name]: state}) as StateRoot,
      dispatchAction: (action: unknown) => {
        state = terminalDataClientReducer(state, action as never);
        return action as never;
      },
      flushPersistence: async () => ({status: 'succeeded'}),
      subscribeState: () => () => undefined,
      dispatchCommand: async () => ({status: 'completed'}),
      requestApplicationReset: () => undefined,
    } as unknown as ActorExecutionContext;

    await handler.handle(context as never);
    (context.command as unknown as {payload: {operationId: string}}).payload.operationId = 'operation-2';
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
      pathAndQuery: '/api/terminal/group-workspaces/workspace-1/activation',
      headers: {},
    });
    expect(readback).toMatchObject({status: 'active', bindingGeneration: 2});
    expect(JSON.stringify(readback).includes(secret)).toBe(false);
    expect(second && typeof second === 'object' && 'status' in second ? second.status : '').toBe('activated');
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
    } as never);
    const actor = actorRuntime.actor;
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    const handler = actor.handlers.find(candidate => candidate.commandName === activateTerminalCommand.commandName);
    if (handler === undefined) throw new Error('activate terminal actor handler missing');
    const makeContext = (commandId: string, operationId: string): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {device},
        command: {
          commandName: activateTerminalCommand.commandName,
          commandId,
          requestId: null,
          payload: {
            operationId,
            groupWorkspaceKey: 'workspace-1',
            activationCode: '12345678',
            surfaceForm: 'laptop',
            appVersion: '1.0.0',
          },
        } as never,
        actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
        getState: () => ({[terminalDataClientStateSlice.name]: state}) as StateRoot,
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
      body: {terminalRef: 'terminal-1', storeRef: 'store-1', groupWorkspaceKey: 'workspace-1', bindingGeneration: 7},
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
        },
        command: {
          commandName: activateTerminalCommand.commandName,
          commandId,
          requestId: null,
          payload: {
            operationId: 'operation-mismatch',
            groupWorkspaceKey: 'workspace-1',
            activationCode,
            surfaceForm: 'laptop',
            appVersion: '1.0.0',
          },
        } as never,
        actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
        getState: () => ({[terminalDataClientStateSlice.name]: state}) as StateRoot,
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

  it('rejects changed activation parameters across operation ids for the same business operation', async () => {
    const secret = 'D'.repeat(43);
    let state = terminalDataClientReducer(undefined, {type: 'test/init'});
    state = terminalDataClientReducer(
      state,
      terminalDataClientActions.setPendingActivation({
        operationId: 'operation-original',
        groupWorkspaceKey: 'workspace-1',
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
      },
      command: {
        commandName: activateTerminalCommand.commandName,
        commandId: 'root-changed-params',
        requestId: null,
        payload: {
          operationId: 'operation-new',
          groupWorkspaceKey: 'workspace-1',
          activationCode: '12345678',
          surfaceForm: 'tablet',
          appVersion: '1.0.0',
        },
      } as never,
      actor: {
        actorKey: actorRuntime.actor.actorKey,
        moduleName: actorRuntime.actor.moduleName,
        actorName: actorRuntime.actor.actorName,
      },
      getState: () => ({[terminalDataClientStateSlice.name]: state}) as StateRoot,
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
        },
        command: {
          payload: {
            operationId,
            groupWorkspaceKey: 'workspace-1',
            activationCode,
            surfaceForm: 'laptop',
            appVersion: '1.0.0',
          },
          requestId: null,
        },
        actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
        getState: () => ({[terminalDataClientStateSlice.name]: state}) as StateRoot,
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
    const executeHttp = vi.fn(async (request: Record<string, unknown>) => {
      requests.push(request);
      if (requests.length === 1)
        return {kind: 'failure' as const, category: 'not-delivered' as const, code: 'NETWORK_ERROR'};
      if (requests.length === 2)
        return {
          kind: 'response' as const,
          addressName: 'primary',
          configRevision: 4,
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
        status: 200,
        body: {outcome: 'CANCELLED'},
      };
    });
    const transport = {
      start: vi.fn(),
      ready: vi.fn(),
      invalid: vi.fn(),
      stop: vi.fn(async () => undefined),
      executeHttp,
      reportHttpAddressAvailable: vi.fn(async () => undefined),
    };
    const actor = createTerminalDataClientActor({
      transport,
      businessServerName: 'terminal-business-api',
      createCredentialSecret: () => secret,
      now: () => 100,
      appVersion: '1.0.0',
    });
    const handler = actor.actor.handlers.find(
      candidate => candidate.commandName === cancelTerminalOnlineCommand.commandName,
    );
    if (handler === undefined) throw new Error('cancel terminal actor handler missing');
    const makeContext = (): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {},
        command: {
          commandName: cancelTerminalOnlineCommand.commandName,
          payload: {groupWorkspaceKey: 'workspace-1', terminalRef: 'terminal-1'},
          requestId: 'cancel-request-1',
        },
        actor: {actorKey: actor.actor.actorKey, moduleName: actor.actor.moduleName, actorName: actor.actor.actorName},
        getState: () => ({[terminalDataClientStateSlice.name]: state}) as StateRoot,
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
    const second = await handler.handle(makeContext() as never);
    expect(first).toMatchObject({kind: 'failure', category: 'not-delivered'});
    expect(second).toMatchObject({kind: 'business-rejection', errorCode: 'TERMINAL_BINDING_CREDENTIAL_INVALID'});
    expect(selectActivationState({[terminalDataClientStateSlice.name]: state} as unknown as StateRoot)).toMatchObject({
      status: 'active',
      terminalRef: 'terminal-1',
    });
    expect(requests[0]).toMatchObject({
      profileId: 'terminal-data-client:http',
      serverName: 'terminal-business-api',
      method: 'POST',
      pathAndQuery: '/api/terminal/group-workspaces/workspace-1/terminals/terminal-1/activation/cancel',
      headers: {Authorization: `Terminal 8.${secret}`},
      body: {deviceId: 'device-1'},
      safeRetryable: true,
    });
    expect(transport.reportHttpAddressAvailable).toHaveBeenCalledTimes(1);

    const reset = vi.fn();
    const success = await handler.handle({...makeContext(), requestApplicationReset: reset} as never);
    expect(success).toEqual({status: 'CANCELLED'});
    expect(transport.stop).toHaveBeenCalledWith({profileId: 'terminal-data-client'});
    expect(reset).toHaveBeenCalledWith('TERMINAL_ACTIVATION_CANCELLED');
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
        getState: () => ({[terminalDataClientStateSlice.name]: state}) as StateRoot,
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
    const actor = createTerminalDataClientActor({
      transport,
      businessServerName: 'terminal-business-api',
      createCredentialSecret: () => secret,
      now: () => now,
      appVersion: '1.0.0',
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
        getState: () => ({[terminalDataClientStateSlice.name]: state}) as StateRoot,
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
    } as never);
    const actor = actorRuntime.actor;
    const makeContext = (commandName: string, payload: unknown): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {},
        command: {commandName, payload, requestId: null, commandId: 'connect-idempotency-test'} as never,
        actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
        getState: () => ({[terminalDataClientStateSlice.name]: state}) as StateRoot,
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
    const actorRuntime = createTerminalDataClientActor({
      transport,
      businessServerName: 'terminal-business-api',
      createCredentialSecret: () => secret,
      now: () => Date.now(),
      appVersion: '1.0.0',
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
        platformPorts: {},
        command: {commandName, payload, requestId: null, commandId: 'heartbeat-renewal-test'} as never,
        actor: {
          actorKey: actorRuntime.actor.actorKey,
          moduleName: actorRuntime.actor.moduleName,
          actorName: actorRuntime.actor.actorName,
        },
        getState: () => ({[terminalDataClientStateSlice.name]: state}) as StateRoot,
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
          getState: () => ({[terminalDataClientStateSlice.name]: state}) as StateRoot,
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
    });
    const makeContext = (commandName: string, payload: unknown): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {logger},
        command: {commandName, payload, requestId: null, commandId: 'background-dispatch-test'} as never,
        actor: {actorKey: actor.actor.actorKey, moduleName: actor.actor.moduleName, actorName: actor.actor.actorName},
        getState: () => ({[terminalDataClientStateSlice.name]: state}) as StateRoot,
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
    });
    const makeContext = (commandName: string, payload: unknown): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {logger},
        command: {commandName, payload, requestId: null, commandId: 'heartbeat-dispatch-test'} as never,
        actor: {actorKey: actor.actor.actorKey, moduleName: actor.actor.moduleName, actorName: actor.actor.actorName},
        getState: () => ({[terminalDataClientStateSlice.name]: state}) as StateRoot,
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
    });
    const makeContext = (commandName: string, payload: unknown): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {logger},
        command: {commandName, payload, requestId: null, commandId: 'heartbeat-deadline-test'} as never,
        actor: {actorKey: actor.actor.actorKey, moduleName: actor.actor.moduleName, actorName: actor.actor.actorName},
        getState: () => ({[terminalDataClientStateSlice.name]: state}) as StateRoot,
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
});
