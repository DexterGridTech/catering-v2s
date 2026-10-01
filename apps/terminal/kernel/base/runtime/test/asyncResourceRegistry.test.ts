import {describe, expect, it, vi} from 'vitest';
import {createRuntimeResourceRegistry} from '../src/foundations/createRuntimeResourceRegistry';

describe('runtime asynchronous resources', () => {
  it('awaits registered asynchronous cleanup before release completes', async () => {
    const registry = createRuntimeResourceRegistry();
    let completed = false;
    registry.registerAsync(async () => {
      await Promise.resolve();
      completed = true;
    });

    await expect(registry.releaseAsync()).resolves.toBe(1);

    expect(completed).toBe(true);
  });

  it('continues cleanup and rejects release when an asynchronous resource fails', async () => {
    const registry = createRuntimeResourceRegistry();
    const laterCleanup = vi.fn();
    registry.registerAsync(async () => {
      throw new Error('adapter detail');
    });
    registry.registerAsync(async () => {
      laterCleanup();
    });

    await expect(registry.releaseAsync()).rejects.toThrow('RUNTIME_RESOURCE_RELEASE_FAILED');

    expect(laterCleanup).toHaveBeenCalledOnce();
    await expect(registry.releaseAsync()).resolves.toBe(0);
  });

  it('fails closed when synchronous release is asked to own asynchronous resources', async () => {
    const registry = createRuntimeResourceRegistry();
    const cleanup = vi.fn(async () => undefined);
    registry.registerAsync(cleanup);

    expect(() => registry.release()).toThrow('ASYNC_RUNTIME_RESOURCES_REQUIRE_RELEASE_ASYNC');
    expect(cleanup).not.toHaveBeenCalled();
    await expect(registry.releaseAsync()).resolves.toBe(1);
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
