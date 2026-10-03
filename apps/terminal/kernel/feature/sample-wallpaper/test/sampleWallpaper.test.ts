import {describe, expect, it} from 'vitest';
import type {LoggerPort} from '@catering-v2s/kernel-base-platform-ports';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {releaseRuntimeForTestAsync, runtimeStateSyncForTest} from '@catering-v2s/kernel-base-runtime/testing';
import {createStateRuntime} from '@catering-v2s/kernel-base-state';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {
  confirmWallpaperCommand,
  cancelWallpaperSelectionCommand,
  createSampleWallpaperModule,
  selectPendingWallpaperId,
  selectHostConfirmedWallpaperId,
  selectWallpaperCommand,
  selectWallpaperId,
} from '../src/index';
import {createMemoryStorageForTest, createTestRuntime} from './support';

describe('sample wallpaper owner module', () => {
  it('describes the owner module and persists both confirmed and pending fields', () => {
    const module = createSampleWallpaperModule();
    expect(module.moduleName).toBe('kernel.feature.sample-wallpaper');
    expect(module.kind).toBe('owner');
    expect(module.dependencies?.map(dependency => dependency.moduleName)).toEqual(['kernel.base.runtime']);
    expect(module.commands?.map(command => [command.name, command.visibility])).toEqual([
      ['kernel.feature.sample-wallpaper.select-wallpaper', 'public'],
      ['kernel.feature.sample-wallpaper.confirm-wallpaper', 'public'],
      ['kernel.feature.sample-wallpaper.cancel-wallpaper-selection', 'public'],
    ]);
    expect(module.actors?.map(actor => actor.name)).toEqual(['selection']);
    expect(module.slices).toEqual([
      {
        name: 'kernel.feature.sample-wallpaper.selection',
        persistIntent: 'owner-only',
      },
    ]);
    expect(module.stateSlices?.[0]?.syncIntent).toBe('master-to-slave');
    expect(module.stateSlices?.[0]?.hasPersistence).toBe(true);
  });

  it('syncs the host confirmed wallpaper without replacing the slave pending choice', async () => {
    const host = createTestRuntime([createSampleWallpaperModule()]);
    const slave = createTestRuntime([createSampleWallpaperModule()]);
    try {
      await host.start();
      await slave.start();
      await host.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w2'}, {requestId: createRequestId()});
      await host.dispatchCommand(confirmWallpaperCommand, {}, {requestId: createRequestId()});
      await host.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w3'}, {requestId: createRequestId()});
      await slave.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w1'}, {requestId: createRequestId()});

      const payload = runtimeStateSyncForTest(host).createFullSyncPayload('kernel.feature.sample-wallpaper.selection');
      expect(payload.status).toBe('ready');
      if (payload.status !== 'ready') return;
      expect(payload.payload.entries).toEqual([
        expect.objectContaining({
          key: 'state',
          value: expect.objectContaining({value: {wallpaperId: 'w2'}}),
        }),
      ]);
      expect(runtimeStateSyncForTest(slave).applyAuthoritativeSync('kernel.feature.sample-wallpaper.selection', payload.payload)).toMatchObject({status: 'applied'});
      expect(selectWallpaperId(slave.getState())).toBe('none');
      const slaveState = {
        ...slave.getState(),
        'kernel.base.runtime.instance-mode': {instanceMode: 'SLAVE'},
      } as StateRoot;
      expect(selectHostConfirmedWallpaperId(slaveState)).toBe('w2');
      expect(slave.getState()['kernel.feature.sample-wallpaper.selection']).toMatchObject({
        wallpaperId: 'none',
        hostConfirmedWallpaperId: 'w2',
      });
      expect(selectPendingWallpaperId(slave.getState())).toBe('w1');
    } finally {
      await releaseRuntimeForTestAsync(host);
      await releaseRuntimeForTestAsync(slave);
    }
  });

  it('selects a valid wallpaper into pending without changing confirmed state', async () => {
    const runtime = createTestRuntime([createSampleWallpaperModule()]);
    await runtime.start();

    const before = runtime.getState();
    const result = await runtime.dispatchCommand(
      selectWallpaperCommand,
      {wallpaperId: 'w2'},
      {
        requestId: createRequestId(),
      },
    );

    expect(result.status).toBe('completed');
    expect(selectWallpaperId(runtime.getState())).toBe('none');
    expect(selectPendingWallpaperId(runtime.getState())).toBe('w2');
    expect(runtime.getState()).not.toBe(before);
  });

  it('does not treat an absent pending selection as an encode failure', async () => {
    const module = createSampleWallpaperModule();
    const logger: LoggerPort = {
      debug: () => undefined as never,
      info: () => undefined as never,
      warn: () => undefined as never,
      error: () => undefined as never,
      scope: () => logger,
      withContext: () => logger,
    };
    const runtime = await createStateRuntime({
      runtimeName: 'sample-wallpaper-persistence-test',
      environmentMode: 'TEST',
      slices: module.stateSlices ?? [],
      logger,
      plainStorage: createMemoryStorageForTest(),
      protectedStorage: createMemoryStorageForTest(),
      persistenceKey: 'sample-wallpaper-persistence',
      persistenceDebounceMs: 0,
    });

    const result = await runtime.flushPersistence();

    expect(result.status).toBe('succeeded');
  });

  it('confirms a different pending wallpaper and clears pending', async () => {
    const runtime = createTestRuntime([createSampleWallpaperModule()]);
    await runtime.start();
    await runtime.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w2'}, {requestId: createRequestId()});

    const result = await runtime.dispatchCommand(confirmWallpaperCommand, {}, {requestId: createRequestId()});

    expect(result.status).toBe('completed');
    expect(selectWallpaperId(runtime.getState())).toBe('w2');
    expect(selectPendingWallpaperId(runtime.getState())).toBeUndefined();
  });

  it('cancels only the pending choice and preserves the confirmed wallpaper', async () => {
    const runtime = createTestRuntime([createSampleWallpaperModule()]);
    await runtime.start();
    await runtime.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w2'}, {requestId: createRequestId()});
    await runtime.dispatchCommand(confirmWallpaperCommand, {}, {requestId: createRequestId()});
    await runtime.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w3'}, {requestId: createRequestId()});

    const result = await runtime.dispatchCommand(cancelWallpaperSelectionCommand, {}, {requestId: createRequestId()});

    expect(result.status).toBe('completed');
    expect(selectWallpaperId(runtime.getState())).toBe('w2');
    expect(selectPendingWallpaperId(runtime.getState())).toBeUndefined();
    await releaseRuntimeForTestAsync(runtime);
  });

  it('rejects confirm without a different pending wallpaper with no state write or child command', async () => {
    const runtime = createTestRuntime([createSampleWallpaperModule()]);
    await runtime.start();
    const before = {
      wallpaperId: selectWallpaperId(runtime.getState()),
      pendingWallpaperId: selectPendingWallpaperId(runtime.getState()),
    };

    const result = await runtime.dispatchCommand(confirmWallpaperCommand, {}, {requestId: createRequestId()});

    expect(result.status).toBe('error');
    expect(result.actorResults[0]?.error).toMatchObject({
      code: 'ERR_TER_SAMPLE_WALLPAPER_CONFIRM_WITHOUT_PENDING',
    });
    expect({
      wallpaperId: selectWallpaperId(runtime.getState()),
      pendingWallpaperId: selectPendingWallpaperId(runtime.getState()),
    }).toEqual(before);
    expect(result.actorResults[0]?.result).toBeNull();
    expect(
      runtime.journal
        .list()
        .filter(event => event.kind === 'command.started' && event.parentCommandId === result.commandId),
    ).toHaveLength(0);
  });

  it('rejects confirm when pending equals the confirmed wallpaper', async () => {
    const runtime = createTestRuntime([createSampleWallpaperModule()]);
    await runtime.start();
    await runtime.dispatchCommand(
      selectWallpaperCommand,
      {wallpaperId: 'none'},
      {
        requestId: createRequestId(),
      },
    );

    const before = {
      wallpaperId: selectWallpaperId(runtime.getState()),
      pendingWallpaperId: selectPendingWallpaperId(runtime.getState()),
    };
    const result = await runtime.dispatchCommand(
      confirmWallpaperCommand,
      {},
      {
        requestId: createRequestId(),
      },
    );

    expect(result.status).toBe('error');
    expect(result.actorResults[0]?.error?.code).toBe('ERR_TER_SAMPLE_WALLPAPER_CONFIRM_WITHOUT_PENDING');
    expect({
      wallpaperId: selectWallpaperId(runtime.getState()),
      pendingWallpaperId: selectPendingWallpaperId(runtime.getState()),
    }).toEqual(before);
  });

  it('rejects an invalid runtime wallpaper id before any state write', async () => {
    const runtime = createTestRuntime([createSampleWallpaperModule()]);
    await runtime.start();
    const before = {
      wallpaperId: selectWallpaperId(runtime.getState()),
      pendingWallpaperId: selectPendingWallpaperId(runtime.getState()),
    };

    const result = await runtime.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w9'} as never, {
      requestId: createRequestId(),
    });

    expect(result.status).toBe('error');
    expect(result.actorResults[0]?.error).toMatchObject({
      code: 'ERR_TER_SAMPLE_WALLPAPER_INVALID_ID',
    });
    expect({
      wallpaperId: selectWallpaperId(runtime.getState()),
      pendingWallpaperId: selectPendingWallpaperId(runtime.getState()),
    }).toEqual(before);
  });

  it('restores confirmed and unconfirmed selections after a new runtime starts', async () => {
    const storage = createMemoryStorageForTest();
    const first = createTestRuntime([createSampleWallpaperModule()], storage);
    await first.start();
    await first.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w2'}, {requestId: createRequestId()});
    await first.dispatchCommand(confirmWallpaperCommand, {}, {requestId: createRequestId()});
    await first.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w3'}, {requestId: createRequestId()});
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    const second = createTestRuntime([createSampleWallpaperModule()], storage);
    await second.start();

    expect(selectWallpaperId(second.getState())).toBe('w2');
    expect(selectPendingWallpaperId(second.getState())).toBe('w3');
  });
});
