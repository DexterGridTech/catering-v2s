import {describe, expect, it, vi} from 'vitest';
import {createAwaitableDisposal} from '../acceptance/asyncDisposal';

describe('managed asynchronous disposal', () => {
  it('shares remote-event disposal with explicit cleanup and propagates failure', async () => {
    const dispose = vi.fn(async () => {
      throw new Error('sensitive dispatcher detail');
    });
    const disposal = createAwaitableDisposal(dispose, 'TERMINAL_DEV_WS_DISPATCHER_CLOSE_FAILED');

    const remoteCloseResult = disposal.start();
    const runtimeCleanupResult = disposal.wait();

    expect(remoteCloseResult).toBe(runtimeCleanupResult);
    await expect(runtimeCleanupResult).rejects.toThrow('TERMINAL_DEV_WS_DISPATCHER_CLOSE_FAILED');
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
