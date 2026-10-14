import {describe, expect, it} from 'vitest';
import {createStateRuntime, defineStateRuntimeSlice, type StateRuntimeSliceRegistration} from '../src/index';
import {
  createExampleRegistration,
  createFakeLogger,
  createFakeStorage,
  exampleReducer,
  type ExampleState,
} from './testSupport';

const createRuntime = (slices: readonly StateRuntimeSliceRegistration[]) =>
  createStateRuntime({
    runtimeName: 'test-sync-registration',
    environmentMode: 'TEST',
    slices,
    logger: createFakeLogger(),
    plainStorage: createFakeStorage(),
    protectedStorage: createFakeStorage(),
    persistenceKey: 'terminal',
    persistenceDebounceMs: 0,
  });

const isolatedRegistration = defineStateRuntimeSlice<ExampleState>({
  name: 'fixture.isolated',
  reducer: exampleReducer,
  persistIntent: 'never',
  syncIntent: 'isolated',
});

describe('State sync registration qualifications', () => {
  it('derives both sync directions from loaded registrations and excludes isolated or unknown slices', async () => {
    const runtime = await createRuntime([
      createExampleRegistration('fixture.master-to-slave', 'master-to-slave'),
      createExampleRegistration('fixture.slave-to-master', 'slave-to-master'),
      isolatedRegistration,
    ]);

    try {
      expect(runtime.getStateSyncQualifications()).toEqual([
        {name: 'fixture.master-to-slave', syncIntent: 'master-to-slave'},
        {name: 'fixture.slave-to-master', syncIntent: 'slave-to-master'},
      ]);

      for (const [sliceName, reason] of [
        ['missing.fixture', 'UNKNOWN_SLICE'],
        ['fixture.isolated', 'SYNC_NOT_DECLARED'],
      ] as const) {
        expect(runtime.createFullSyncPayload(sliceName)).toEqual({status: 'skipped', sliceName, reason});
        expect(
          runtime.applyAuthoritativeSync(sliceName, {
            mode: 'authoritative',
            replaceMissing: true,
            entries: [],
          }),
        ).toEqual({status: 'skipped', sliceName, reason});
      }
    } finally {
      await runtime.dispose();
    }
  });

  it('does not retain a sync qualification when that registration is absent from the Runtime', async () => {
    const runtime = await createRuntime([createExampleRegistration('fixture.current', 'slave-to-master')]);

    try {
      expect(runtime.getStateSyncQualifications()).toEqual([
        {name: 'fixture.current', syncIntent: 'slave-to-master'},
      ]);
      expect(runtime.createFullSyncPayload('fixture.removed')).toEqual({
        status: 'skipped',
        sliceName: 'fixture.removed',
        reason: 'UNKNOWN_SLICE',
      });
    } finally {
      await runtime.dispose();
    }
  });
});
