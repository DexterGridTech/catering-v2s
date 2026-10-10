import {createRuntimeInstanceId, type TimestampMs} from '@catering-v2s/kernel-base-contracts';
import {unavailableUpdatePort, type UpdatePort} from '@catering-v2s/kernel-base-platform-ports';
import type {RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createTerminalUpdateModule} from '../src/application/createTerminalUpdateModule';
import {reconcileTerminalUpdateCommand, updatePresentationChangedCommand} from '../src/features/commands/commands';
import {terminalUpdateSliceName} from '../src/features/slices/terminalUpdate';

describe('terminal-update presentation lifecycle', () => {
  afterEach(() => vi.restoreAllMocks());

  it('subscribes before reading, seeds once, deduplicates transitions, and unsubscribes on Runtime cleanup', async () => {
    const order: string[] = [];
    const dispatched: Array<Readonly<{commandName: string; payload: unknown}>> = [];
    let listener: ((presentation: 'foreground' | 'background' | 'unknown') => void) | undefined;
    const cleanups: Array<() => void> = [];
    let resolvePresentation: (result: Awaited<ReturnType<UpdatePort['readPresentation']>>) => void = () => undefined;
    const port: UpdatePort = {
      ...unavailableUpdatePort,
      subscribePresentation: next => {
        order.push('subscribe');
        listener = next;
        return () => {
          order.push('unsubscribe');
        };
      },
      readPresentation: async () => {
        order.push('read');
        return new Promise(resolve => {
          resolvePresentation = resolve;
        });
      },
    };
    const dispatchCommand = vi.fn(async (command: {commandName: string}, payload: unknown) => {
      dispatched.push({commandName: command.commandName, payload});
      return {status: 'completed' as const};
    });
    const module = createTerminalUpdateModule({port, createProtocolUuid: () => 'fixture-uuid'});
    const context = {
      runtimeId: createRuntimeInstanceId(),
      platformPorts: {logger: {warn: vi.fn(), error: vi.fn()}},
      registerResource: (release: () => void) => {
        cleanups.push(release);
        return () => undefined;
      },
      subscribeState: () => () => undefined,
      getState: () => ({[terminalUpdateSliceName]: {currentTask: null, actualVersions: null}}),
      dispatchCommand,
    } as unknown as RuntimeModuleContext;

    const install = module.install?.(context);
    listener?.('background');
    resolvePresentation({status: 'succeeded', value: 'foreground', completedAt: 1 as TimestampMs});
    await install;

    expect(order).toEqual(['subscribe', 'read']);
    expect(dispatched.map(item => item.commandName)).toEqual([
      updatePresentationChangedCommand.commandName,
      updatePresentationChangedCommand.commandName,
      reconcileTerminalUpdateCommand.commandName,
    ]);
    expect(dispatched[0]?.payload).toEqual({
      runtimeIdentity: context.runtimeId,
      presentation: 'background',
    });
    expect(dispatched[1]?.payload).toEqual({
      runtimeIdentity: context.runtimeId,
      presentation: 'foreground',
    });

    listener?.('foreground');
    await Promise.resolve();
    expect(
      dispatched.filter(item => item.commandName === updatePresentationChangedCommand.commandName),
    ).toHaveLength(2);

    listener?.('background');
    await vi.waitFor(() => {
      expect(
        dispatched.filter(item => item.commandName === updatePresentationChangedCommand.commandName),
      ).toHaveLength(3);
    });

    for (const release of cleanups.reverse()) release();
    listener?.('unknown');
    await Promise.resolve();
    expect(order).toEqual(['subscribe', 'read', 'unsubscribe']);
    expect(
      dispatched.filter(item => item.commandName === updatePresentationChangedCommand.commandName),
    ).toHaveLength(3);
  });
});
