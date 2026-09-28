import {describe, expect, it} from 'vitest';
import {createCommandId, createRequestId} from '@catering-v2s/kernel-base-contracts';
import {
  createRuntime,
  defineCommand,
  type CommandDispatchResult,
  type PeerDispatchGateway,
  type RuntimeModule,
} from '../src/index';
import {createTestRuntimeInput, deferred} from './testSupport';

type CommandSpec = NonNullable<RuntimeModule['commandDefinitions']>[number];

const moduleFor = (moduleName: string, commands: readonly CommandSpec[]): RuntimeModule =>
  Object.freeze({
    moduleName,
    kind: 'owner' as const,
    dependencies: [{moduleName: 'kernel.base.runtime'}],
    commands: commands.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions: commands,
  });

const peerCommand = (name: string) =>
  defineCommand<Readonly<{}>>('test.peer', {
    name,
    visibility: 'internal',
    defaultTarget: 'peer',
    timeoutMs: 50,
  });

describe('runtime peer gateway', () => {
  it('P-1 returns a typed error when no gateway is installed', async () => {
    const command = peerCommand('missing');
    const runtime = createRuntime(createTestRuntimeInput({modules: [moduleFor('test.peer', [command])]}));
    await runtime.start();
    const result = await runtime.dispatchCommand(command, {});
    expect(result.status).toBe('error');
    expect(result.actorResults[0]?.actorKey).toBe('kernel.base.runtime.peer-dispatch');
    expect(result.actorResults[0]?.error?.key).toBe('kernel.base.runtime.peer_gateway_not_installed');
    expect(result.actorResults[0]?.result).toBeNull();
  });

  it('P-2 maps peer success, partial failure, timeout, and error to typed actor results', async () => {
    const commands = [peerCommand('completed'), peerCommand('partial'), peerCommand('timed'), peerCommand('error')];
    const runtime = createRuntime(createTestRuntimeInput({modules: [moduleFor('test.peer', commands)]}));
    const statuses: CommandDispatchResult['status'][] = ['completed', 'partial-failed', 'timed-out', 'error'];
    const gateway: PeerDispatchGateway = {
      dispatchCommand: async command => ({
        requestId: null,
        commandId: command.definition.commandName.endsWith('completed') ? createCommandId() : createCommandId(),
        status: statuses[commands.findIndex(item => item.commandName === command.definition.commandName)] ?? 'error',
        actorResults: [],
      }),
    };
    // The gateway is installed during the module install phase, before dispatch.
    const installModule = Object.freeze({
      ...moduleFor('test.peer', commands),
      install: (context: Parameters<NonNullable<RuntimeModule['install']>>[0]) =>
        context.installPeerDispatchGateway(gateway),
    });
    const installed = createRuntime(createTestRuntimeInput({modules: [installModule]}));
    await installed.start();
    for (let index = 0; index < commands.length; index += 1) {
      const result = await installed.dispatchCommand(commands[index]!, {});
      const expected = statuses[index];
      expect(result.status).toBe(expected === 'partial-failed' ? 'error' : expected);
      expect(result.actorResults[0]?.result).toBeNull();
      expect(result.actorResults[0]?.status).toBe(
        expected === 'completed' ? 'completed' : expected === 'timed-out' ? 'timed-out' : 'error',
      );
    }

    const lateCommand = defineCommand<Readonly<{}>>('test.peer.late', {
      name: 'run',
      visibility: 'internal',
      defaultTarget: 'peer',
      timeoutMs: 5,
    });
    const late = deferred<CommandDispatchResult>();
    const lateGateway: PeerDispatchGateway = {
      dispatchCommand: async () => late.promise,
    };
    const lateModule = Object.freeze({
      ...moduleFor('test.peer.late', [lateCommand]),
      install: (context: Parameters<NonNullable<RuntimeModule['install']>>[0]) =>
        context.installPeerDispatchGateway(lateGateway),
    });
    const lateRuntime = createRuntime(createTestRuntimeInput({modules: [lateModule]}));
    await lateRuntime.start();
    const timedOut = await lateRuntime.dispatchCommand(lateCommand, {});
    expect(timedOut.status).toBe('timed-out');
    expect(timedOut.actorResults[0]?.status).toBe('timed-out');
    late.resolve({requestId: null, commandId: createCommandId(), status: 'completed', actorResults: []});
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(lateRuntime.journal.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({kind: 'actor.late-completed', actorKey: 'kernel.base.runtime.peer-dispatch'}),
      ]),
    );
  });

  it('P-3 installs exactly one gateway and forwards opaque identity options by reference', async () => {
    const command = peerCommand('identity');
    let received: unknown;
    const gateway: PeerDispatchGateway = {
      dispatchCommand: async (_command, options) => {
        received = options;
        return {requestId: options.requestId, commandId: options.commandId, status: 'completed', actorResults: []};
      },
    };
    let installError: unknown;
    const module = Object.freeze({
      ...moduleFor('test.peer', [command]),
      install: (context: Parameters<NonNullable<RuntimeModule['install']>>[0]) => {
        context.installPeerDispatchGateway(gateway);
        try {
          context.installPeerDispatchGateway(gateway);
        } catch (error) {
          installError = error;
        }
      },
    });
    const runtime = createRuntime(createTestRuntimeInput({modules: [module]}));
    await runtime.start();
    const requestId = createRequestId();
    const commandId = createCommandId();
    const routeContext = Object.freeze({workspace: 'BRANCH', instanceMode: 'SLAVE'});
    const result = await runtime.dispatchCommand(command, {}, {requestId, commandId, routeContext});
    expect(result.status).toBe('completed');
    expect(installError).toBeInstanceOf(Error);
    expect(received).toEqual({requestId, commandId, parentCommandId: null, routeContext});
    expect((received as {routeContext: object}).routeContext).toBe(routeContext);
  });

  it('P-4 string dispatch reuses the registered definition, including allowNoActor', async () => {
    const command = defineCommand<Readonly<{}>>('test.peer.string', {
      name: 'inbound',
      visibility: 'internal',
      allowNoActor: true,
    });
    const runtime = createRuntime(createTestRuntimeInput({modules: [moduleFor('test.peer.string', [command])]}));
    await runtime.start();
    const result = await runtime.dispatchCommand(command.commandName, {});
    expect(result.status).toBe('completed');
    expect(result.actorResults).toHaveLength(0);
    await expect(runtime.dispatchCommand('test.peer.string.unknown', {})).rejects.toMatchObject({
      key: 'kernel.base.runtime.lifecycle_failed',
      message: 'Runtime lifecycle failed',
    });
  });
});
