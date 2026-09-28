import {createRuntime, defaultCommandTimeoutMs, resetRuntimeAfterSystemFailureCommand} from '../src';
import {createTestRuntimeInput} from './testSupport';
import type {AppControlPort} from '@catering-v2s/kernel-base-platform-ports';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {describe, expect, it, vi} from 'vitest';

describe('resetRuntimeAfterSystemFailureCommand', () => {
  it('calls the app-control reset port and returns a typed accepted outcome', async () => {
    const resetRuntime = vi.fn(async input => ({
      status: 'accepted' as const,
      requestId: input.requestId,
      acceptedAt: 1 as never,
      terminalObservation: 'SUCCESSOR_RUNTIME_STARTED' as const,
    }));
    const input = createTestRuntimeInput();
    const runtime = createRuntime({
      ...input,
      platformPorts: {
        ...input.platformPorts,
        appControl: {...input.platformPorts.appControl, resetRuntime} as AppControlPort,
      },
    });
    await runtime.start();

    const result = await runtime.dispatchCommand(
      resetRuntimeAfterSystemFailureCommand,
      {},
      {requestId: createRequestId()},
    );

    expect(resetRuntime).toHaveBeenCalledTimes(1);
    expect(resetRuntime.mock.calls[0]?.[0]).toMatchObject({timeoutMs: defaultCommandTimeoutMs});
    expect(result).toMatchObject({status: 'completed', actorResults: [{result: {status: 'accepted'}}]});
  });

  it('does not claim success when the Web platform port is unavailable', async () => {
    const events: import('@catering-v2s/kernel-base-platform-ports').LogEvent[] = [];
    const input = createTestRuntimeInput({events});
    const runtime = createRuntime(input);
    await runtime.start();

    const result = await runtime.dispatchCommand(
      resetRuntimeAfterSystemFailureCommand,
      {},
      {requestId: createRequestId()},
    );

    expect(result).toMatchObject({status: 'completed', actorResults: [{result: {status: 'unavailable'}}]});
    expect(events).toContainEqual(
      expect.objectContaining({
        category: 'runtime.system-failure',
        event: 'runtime.system-failure.reset-unavailable',
        data: expect.objectContaining({portStatus: 'unavailable'}),
      }),
    );
  });
});
