import {describe, expect, it, vi} from 'vitest';
import {
  createTerminalDataClientModule,
  dependencyModuleNames,
  moduleKind,
  moduleName,
  runtimeModuleDependencyNames,
} from '../src/index';
import {
  initializeTerminalDataClientCommand,
  connectTerminalCommand,
  refreshTerminalClientStatusProjectionCommand,
} from '../src/features/commands/terminalDataClientCommands';
import {terminalDataClientStateSlice} from '../src/features/slices/terminalDataClient';
import {
  terminalClientStatusProjectionSliceName,
  terminalClientStatusProjectionStateSlice,
} from '../src/features/slices/terminalClientStatusProjection';
import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';

const createDependencies = () => ({
  businessServerName: 'terminal-business-api',
  transport: {
    start: async () => ({send: async () => undefined, subscribe: () => () => undefined}),
    ready: async () => undefined,
    invalid: async () => undefined,
    stop: async () => undefined,
    executeHttp: async () => ({kind: 'failure' as const, category: 'not-delivered' as const, code: 'test'}),
    reportHttpAddressAvailable: async () => undefined,
  },
  createCredentialSecret: () => 'A'.repeat(43),
  createProtocolUuid: () => '00000000-0000-4000-8000-000000000005',
  now: () => 1,
  appVersion: 'test',
  surfaceForm: 'laptop' as const,
});

describe('terminal-data-client package identity', () => {
  it('owns protocol and credential behavior while depending only on the generic transport mechanism', () => {
    expect(moduleName).toBe('kernel.base.terminal-data-client');
    expect(moduleKind).toBe('owner');
    expect(dependencyModuleNames).toEqual([
      'kernel.base.contracts',
      'kernel.base.platform-ports',
      'kernel.base.runtime',
      'kernel.base.state',
      'kernel.base.transport',
    ]);
    expect(dependencyModuleNames).not.toContain('kernel.base.server-config');
    expect(runtimeModuleDependencyNames).toEqual(['kernel.base.runtime', 'kernel.base.transport']);
    const module = createTerminalDataClientModule(createDependencies());
    expect(module.dependencies).toEqual([{moduleName: 'kernel.base.runtime'}, {moduleName: 'kernel.base.transport'}]);
    expect(module.commands?.map(command => command.name)).toEqual([
      `${moduleName}.activate-terminal`,
      `${moduleName}.activation-succeeded`,
      `${moduleName}.cancel-terminal-activation`,
      `${moduleName}.cancel-terminal-offline`,
      `${moduleName}.connect-terminal`,
      `${moduleName}.disconnect-terminal`,
      `${moduleName}.subscribe-topic`,
      `${moduleName}.unsubscribe-topic`,
      `${moduleName}.accept-topic-notification`,
      `${moduleName}.read-terminal-data`,
      `${moduleName}.request-terminal-update-download-grant`,
      `${moduleName}.submit-terminal-update-report`,
      `${moduleName}.terminal-data-heartbeat`,
      `${moduleName}.topic-changed`,
      `${moduleName}.initialize-terminal-data-client`,
      `${moduleName}.refresh-status-projection`,
      `${moduleName}.transport-event`,
      `${moduleName}.heartbeat-tick`,
      `${moduleName}.mutate-remote-operation`,
    ]);
    expect(module.slices).toEqual([
      {name: `${moduleName}.client`, persistIntent: 'owner-only'},
      {name: terminalClientStatusProjectionSliceName, persistIntent: 'owner-only'},
    ]);
  });

  it('restores the connection through the owner initialize command and does not connect without a credential', async () => {
    const module = createTerminalDataClientModule(createDependencies());
    const actor = module.actorDefinitions?.[0];
    if (actor === undefined) throw new Error('terminal client actor definition missing');
    const handler = actor?.handlers.find(
      candidate => candidate.commandName === initializeTerminalDataClientCommand.commandName,
    );
    if (handler === undefined) throw new Error('terminal client initialize actor handler missing');
    const dispatchCommand = vi.fn(async () => ({status: 'completed'}));
    const makeContext = (credential: unknown): ActorExecutionContext =>
      ({
        runtimeId: 'test-runtime',
        localNodeId: 'test-node',
        platformPorts: {},
        command: {
          commandName: initializeTerminalDataClientCommand.commandName,
          commandId: 'initialize',
          requestId: null,
          payload: {},
        } as never,
        actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
        getState: () =>
          ({
            'kernel.base.runtime.instance-mode': {instanceMode: 'MASTER'},
            [terminalDataClientStateSlice.name]: {credential},
          }) as StateRoot,
        dispatchAction: (action: unknown) => action as never,
        flushPersistence: async () => ({status: 'succeeded'}),
        subscribeState: () => () => undefined,
        dispatchCommand,
        requestApplicationReset: () => undefined,
      }) as unknown as ActorExecutionContext;

    expect(await handler.handle(makeContext(null))).toEqual({status: 'inactive'});
    expect(dispatchCommand).not.toHaveBeenCalled();
    const restoredCredential = {
      groupWorkspaceKey: 'workspace-1',
      terminalRef: 'terminal-1',
      storeRef: 'store-1',
      deviceId: 'device-1',
      bindingGeneration: 4,
      credentialSecret: 'A'.repeat(43),
    };
    expect(await handler.handle(makeContext(restoredCredential))).toEqual({status: 'connect-requested'});
    expect(dispatchCommand).toHaveBeenCalledWith(
      connectTerminalCommand,
      {},
      {requestId: expect.stringMatching(/^req_/)},
    );

    const moduleDispatch = vi.fn(async () => ({status: 'completed'}));
    await module.install?.({
      registerResource: vi.fn(),
      dispatchCommand: moduleDispatch,
      subscribeState: vi.fn(() => () => undefined),
      platformPorts: {logger: {scope: () => ({error: vi.fn()})}},
    } as never);
    expect(moduleDispatch).toHaveBeenNthCalledWith(1, refreshTerminalClientStatusProjectionCommand, {});
    expect(moduleDispatch).toHaveBeenNthCalledWith(2, initializeTerminalDataClientCommand, {});
  });

  it('projects only safe host activation, connection and latency facts', async () => {
    const module = createTerminalDataClientModule(createDependencies());
    const actor = module.actorDefinitions?.[0];
    if (actor === undefined) throw new Error('terminal client actor definition missing');
    const handler = actor.handlers.find(
      candidate => candidate.commandName === refreshTerminalClientStatusProjectionCommand.commandName,
    );
    if (handler === undefined) throw new Error('terminal status projection handler missing');
    const secret = 'A'.repeat(43);
    const actions: unknown[] = [];
    const projectionState = terminalClientStatusProjectionStateSlice;
    const state = {
      'kernel.base.runtime.instance-mode': {instanceMode: 'MASTER'},
      [terminalDataClientStateSlice.name]: {
        credential: {
          groupWorkspaceKey: 'workspace-1',
          terminalRef: 'terminal-1',
          storeRef: 'store-1',
          deviceId: 'device-1',
          bindingGeneration: 2,
          credentialSecret: secret,
        },
        pendingActivations: {},
        activationStatus: 'active',
        connection: {status: 'connected', addressName: 'primary', nodeId: 'tds-1', sessionId: 'session-host-only', lastCloseReason: null},
        heartbeatIntervalMs: 10_000,
        nextPingSequence: 2,
        lastRttMs: 17,
        latencySamples: [{rttMs: 17, observedAt: 1}],
      },
      [projectionState.name]: {
        projection: {available: false, activation: null, connection: null, lastRttMs: null, updatedAt: 0},
      },
    } as unknown as StateRoot;
    const context = {
      getState: () => state,
      dispatchAction: (action: unknown) => {
        actions.push(action);
        return action as never;
      },
    } as unknown as ActorExecutionContext;
    expect(await handler.handle(context)).toEqual({status: 'updated'});
    expect(JSON.stringify(actions)).not.toContain(secret);
    expect(JSON.stringify(actions)).not.toContain('credentialSecret');
    expect(JSON.stringify(actions)).not.toContain('session-host-only');
    expect(JSON.stringify(actions)).toContain('terminal-1');
    expect(JSON.stringify(actions)).toContain('17');
  });
});
