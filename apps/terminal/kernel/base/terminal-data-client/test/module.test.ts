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
} from '../src/features/commands/terminalDataClientCommands';
import {terminalDataClientStateSlice} from '../src/features/slices/terminalDataClient';
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
  now: () => 1,
  appVersion: 'test',
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
      `${moduleName}.cancel-terminal-online`,
      `${moduleName}.cancel-terminal-offline`,
      `${moduleName}.connect-terminal`,
      `${moduleName}.disconnect-terminal`,
      `${moduleName}.initialize-terminal-data-client`,
      `${moduleName}.transport-event`,
      `${moduleName}.heartbeat-tick`,
    ]);
    expect(module.slices).toEqual([{name: `${moduleName}.client`, persistIntent: 'owner-only'}]);
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
        getState: () => ({[terminalDataClientStateSlice.name]: {credential}}) as StateRoot,
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
    } as never);
    expect(moduleDispatch).toHaveBeenCalledWith(initializeTerminalDataClientCommand, {});
  });
});
