import {describe, expect, it, vi} from 'vitest';
import type {EnvironmentMode} from '@catering-v2s/kernel-base-platform-ports';
import type {PersistenceHealth} from '../src/index';
import {createStateRuntime, defineStateRuntimeSlice, type StateJsonValue} from '../src/index';
import {
  createPersistenceFieldKey,
  createPersistenceNamespacePrefix,
  createPersistenceRecordEntryKey,
  parsePersistenceKey,
} from '../src/foundations/keyspace';
import {encodeStateJsonValue, decodeStateJsonValue} from '../src/foundations/persistenceCodec';
import {
  createFakeLogger,
  createFakeStorage,
  exampleReducer,
  initialExampleState,
  type CapturedLog,
  type ExampleState,
} from './testSupport';

const fieldKey = createPersistenceFieldKey({
  persistenceKey: 'terminal',
  sliceName: 'example.state',
  storageKey: 'enabled',
});

const recordKey = (entryKey: string) =>
  createPersistenceRecordEntryKey({
    persistenceKey: 'terminal',
    sliceName: 'example.state',
    storageKeyPrefix: 'entries',
    entryKey,
  });

const createRuntime = async (
  options: {
    readonly plainStorage?: ReturnType<typeof createFakeStorage>;
    readonly protectedStorage?: ReturnType<typeof createFakeStorage>;
    readonly registration?: ReturnType<typeof createExampleStateRegistration>;
    readonly debounceMs?: number;
    readonly environmentMode?: EnvironmentMode;
    readonly logger?: ReturnType<typeof createFakeLogger>;
  } = {},
) => {
  const plainStorage = options.plainStorage ?? createFakeStorage();
  const protectedStorage = options.protectedStorage ?? createFakeStorage();
  const runtime = await createStateRuntime({
    runtimeName: 'test-state',
    environmentMode: options.environmentMode ?? 'TEST',
    slices: [options.registration ?? createExampleStateRegistration()],
    logger: options.logger ?? createFakeLogger(),
    plainStorage,
    protectedStorage,
    persistenceKey: 'terminal',
    persistenceDebounceMs: options.debounceMs ?? 0,
  });
  return {runtime, plainStorage, protectedStorage};
};

function createExampleStateRegistration(
  input: {
    readonly name?: string;
    readonly protection?: 'plain' | 'protected';
    readonly fieldFlushMode?: 'immediate' | 'debounced';
    readonly recordFlushMode?: 'immediate' | 'debounced';
    readonly shouldPersistField?: (value: unknown, state: Readonly<ExampleState>) => boolean;
    readonly shouldPersistEntry?: (key: string, value: StateJsonValue) => boolean;
  } = {},
) {
  return defineStateRuntimeSlice<ExampleState>({
    name: input.name ?? 'example.state',
    reducer: exampleReducer,
    persistIntent: 'owner-only',
    persistence: [
      {
        kind: 'field',
        stateKey: 'enabled',
        protection: input.protection,
        flushMode: input.fieldFlushMode,
        shouldPersist: input.shouldPersistField,
      },
      {
        kind: 'record',
        storageKeyPrefix: 'entries',
        protection: input.protection,
        flushMode: input.recordFlushMode,
        getEntries: state => state.entries,
        applyEntries: (state, entries) => ({
          ...state,
          entries,
        }),
        shouldPersistEntry: input.shouldPersistEntry,
      },
    ],
    syncIntent: 'master-to-slave',
    sync: {
      kind: 'record',
      getEntries: state => {
        const entries: Record<string, {readonly value: StateJsonValue; readonly updatedAt: 1}> = {};
        for (const [key, value] of Object.entries(state.entries)) {
          if (value !== undefined) {
            entries[key] = {value, updatedAt: 1};
          }
        }
        return entries;
      },
      applyEntries: (state, entries) => ({
        ...state,
        entries: Object.fromEntries(
          Object.entries(entries)
            .filter(entry => entry[1] !== undefined && 'value' in entry[1])
            .map(([key, entry]) => [key, entry?.value]),
        ),
      }),
    },
  });
}

describe('P/R/F/H/C/M/X groups: persistence runtime', () => {
  it('P-1 hydrates field and record values through one listKeys and one readMany per backend', async () => {
    const plainStorage = createFakeStorage({
      [fieldKey]: 'true',
      [recordKey('item/a')]: '{"qty":2}',
    });

    const {runtime} = await createRuntime({plainStorage});

    expect(runtime.getState()['example.state']).toEqual({
      ...initialExampleState,
      enabled: true,
      entries: {'item/a': {qty: 2}},
    });
    expect(plainStorage.calls.listKeys).toHaveLength(1);
    expect(plainStorage.calls.readMany).toHaveLength(1);
  });

  it('P-1b hydrates multiple record entries without requiring owner applyEntries to merge', async () => {
    const plainStorage = createFakeStorage({
      [recordKey('a')]: '1',
      [recordKey('b')]: '2',
    });

    const {runtime} = await createRuntime({plainStorage});

    expect(runtime.getState()['example.state']).toMatchObject({
      entries: {a: 1, b: 2},
    });
  });

  it('P-2 does not rewrite hydrated data on immediate flush', async () => {
    const plainStorage = createFakeStorage({
      [fieldKey]: 'true',
      [recordKey('a')]: '1',
    });
    const {runtime} = await createRuntime({plainStorage});

    await runtime.flushPersistence();

    expect(plainStorage.calls.write).toHaveLength(0);
  });

  it('P-3 writes only changed field and record entries', async () => {
    const plainStorage = createFakeStorage();
    const {runtime} = await createRuntime({plainStorage});

    runtime.getStore().dispatch({type: 'example/setEnabled', value: true});
    runtime.getStore().dispatch({type: 'example/setEntry', key: 'a', value: 1});
    const result = await runtime.flushPersistence();

    expect(result.status).toBe('succeeded');
    expect(plainStorage.calls.write.map(entry => entry.key).sort()).toEqual([fieldKey, recordKey('a')].sort());
  });

  it('P-3b keeps an existing debounce deadline when an immediate descriptor changes', async () => {
    vi.useFakeTimers();
    const plainStorage = createFakeStorage();
    try {
      const registration = createExampleStateRegistration({
        fieldFlushMode: 'immediate',
        recordFlushMode: 'debounced',
      });
      const {runtime} = await createRuntime({
        plainStorage,
        registration,
        debounceMs: 25,
      });
      const settle = async () => {
        for (let index = 0; index < 8; index += 1) await Promise.resolve();
      };

      runtime.getStore().dispatch({type: 'example/setEntry', key: 'debounced', value: 1});
      vi.advanceTimersByTime(10);
      runtime.getStore().dispatch({type: 'example/setEnabled', value: true});
      await settle();
      expect(plainStorage.calls.write.map(entry => entry.key)).toContain(fieldKey);
      expect(plainStorage.calls.write.map(entry => entry.key)).not.toContain(recordKey('debounced'));

      vi.advanceTimersByTime(14);
      await settle();
      expect(plainStorage.calls.write.map(entry => entry.key)).not.toContain(recordKey('debounced'));

      vi.advanceTimersByTime(1);
      await settle();
      expect(plainStorage.calls.write.map(entry => entry.key)).toContain(recordKey('debounced'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('P-3c does not select immediate persistence for a debounced-only descriptor change', async () => {
    vi.useFakeTimers();
    try {
      const shouldPersistField = vi.fn(() => true);
      const {runtime} = await createRuntime({
        plainStorage: createFakeStorage(),
        registration: createExampleStateRegistration({
          fieldFlushMode: 'immediate',
          recordFlushMode: 'debounced',
          shouldPersistField,
        }),
        debounceMs: 25,
      });
      const settle = async () => {
        for (let index = 0; index < 8; index += 1) await Promise.resolve();
      };

      runtime.getStore().dispatch({type: 'example/setEntry', key: 'debounced-only', value: 1});
      await settle();
      expect(shouldPersistField).not.toHaveBeenCalled();

      vi.advanceTimersByTime(24);
      await settle();
      expect(shouldPersistField).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      await settle();
      expect(shouldPersistField).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('P-4 removes cached record entries that disappeared from owner state', async () => {
    const plainStorage = createFakeStorage({
      [recordKey('stale')]: '1',
    });
    const {runtime} = await createRuntime({plainStorage});
    runtime.getStore().dispatch({type: 'example/removeEntry', key: 'stale'});

    await runtime.flushPersistence();

    expect(plainStorage.calls.remove).toContain(recordKey('stale'));
  });

  it('P-5 rejects non-JSON-safe values as typed persistence failures', async () => {
    const plainStorage = createFakeStorage();
    const {runtime} = await createRuntime({plainStorage});

    runtime.getStore().dispatch({type: 'example/setEntry', key: 'bad', value: Number.NaN});
    const result = await runtime.flushPersistence();

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.failures[0]?.kind).toBe('ENCODE_REJECTED');
    }
  });

  it('R-1 survives restart when two runtime instances share the same storage', async () => {
    const plainStorage = createFakeStorage();
    const first = await createRuntime({plainStorage});
    first.runtime.getStore().dispatch({type: 'example/setEntry', key: 'ticket', value: 'A-1'});
    await first.runtime.flushPersistence();

    const second = await createRuntime({plainStorage});

    expect(second.runtime.getState()['example.state']).toMatchObject({
      entries: {ticket: 'A-1'},
    });
  });

  it('R-2 does not persist a slice declared with persistIntent never', async () => {
    const registration = defineStateRuntimeSlice<ExampleState>({
      name: 'never.state',
      reducer: exampleReducer,
      persistIntent: 'never',
      syncIntent: 'isolated',
    });
    const plainStorage = createFakeStorage();
    const first = await createRuntime({plainStorage, registration});

    first.runtime.getStore().dispatch({type: 'example/setEnabled', value: true});
    await first.runtime.flushPersistence();

    expect(plainStorage.values).toEqual(new Map());
    const second = await createRuntime({plainStorage, registration});
    expect(second.runtime.getState()['never.state']).toEqual(initialExampleState);
  });

  it('R-2 keeps protected and plain backends independent', async () => {
    const protectedStorage = createFakeStorage({[fieldKey]: 'true'});
    const registration = createExampleStateRegistration({protection: 'protected'});

    const {runtime, plainStorage} = await createRuntime({protectedStorage, registration});

    expect(runtime.getState()['example.state']).toMatchObject({enabled: true});
    expect(plainStorage.calls.readMany[0] ?? []).toEqual([]);
    expect(protectedStorage.calls.readMany[0]).toContain(fieldKey);
  });

  it('F-2 fails closed for a protected backend and does not hydrate its legacy plain value', async () => {
    const plainStorage = createFakeStorage({[fieldKey]: 'true'});
    const protectedStorage = createFakeStorage({}, {failList: true});
    const registration = createExampleStateRegistration({protection: 'protected'});

    const {runtime} = await createRuntime({plainStorage, protectedStorage, registration});

    expect(runtime.getState()['example.state']).toMatchObject({enabled: false});
    expect(runtime.getPersistenceHealth().blockedStorageKinds).toContain('protected');
    expect(plainStorage.values.get(fieldKey)).toBe('true');
  });

  it('R-3 persists authoritative sync changes through the runtime subscription', async () => {
    const plainStorage = createFakeStorage();
    const {runtime} = await createRuntime({plainStorage});

    runtime.applyAuthoritativeSync('example.state', {
      mode: 'authoritative',
      replaceMissing: true,
      entries: [{key: 'remote', value: {value: 'yes', updatedAt: 1}}],
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(plainStorage.values.get(recordKey('remote'))).toBe('"yes"');
  });

  it('F-1 reports automatic flush failures through health and error logging', async () => {
    const captured: Parameters<typeof createFakeLogger>[0] = [];
    const plainStorage = createFakeStorage({}, {failWrites: [recordKey('auto-failure')]});
    const {runtime} = await createRuntime({
      plainStorage,
      logger: createFakeLogger(captured),
    });

    runtime.getStore().dispatch({type: 'example/setEntry', key: 'auto-failure', value: 1});
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(runtime.getPersistenceHealth().status).toBe('degraded');
    expect(captured.some(entry => entry.level === 'error' && entry.input.event === 'state.persistence.failure')).toBe(
      true,
    );
  });

  it('F-1 reports write failures through health listener revision updates', async () => {
    const plainStorage = createFakeStorage({}, {failWrites: [fieldKey]});
    const {runtime} = await createRuntime({plainStorage});
    const snapshots: PersistenceHealth[] = [];
    runtime.subscribePersistenceHealth(health => snapshots.push(health));

    runtime.getStore().dispatch({type: 'example/setEnabled', value: true});
    const result = await runtime.flushPersistence();

    expect(result.status).toBe('failed');
    expect(snapshots.some(health => health.revision > 0 && health.status === 'degraded')).toBe(true);
  });

  it('F-2 continues after a failed key and persists succeeding keys', async () => {
    const plainStorage = createFakeStorage({}, {failWrites: [recordKey('bad')]});
    const {runtime} = await createRuntime({plainStorage});

    runtime.getStore().dispatch({type: 'example/setEntry', key: 'bad', value: 1});
    runtime.getStore().dispatch({type: 'example/setEntry', key: 'good', value: 2});
    const result = await runtime.flushPersistence();

    expect(result.status).toBe('failed');
    expect(plainStorage.values.get(recordKey('good'))).toBe('2');
    if (result.status === 'failed') {
      expect(result.dirtyKeys).toContain(recordKey('bad'));
    }
  });

  it('B-5 reports an invalid record key as a typed failure and continues with valid entries', async () => {
    const {runtime, plainStorage} = await createRuntime();

    runtime.getStore().dispatch({type: 'example/setEntry', key: '   ', value: 1});
    runtime.getStore().dispatch({type: 'example/setEntry', key: 'good', value: 2});
    const result = await runtime.flushPersistence();

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.failures).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'ENCODE_REJECTED',
            phase: 'flush',
            operation: 'encode',
          }),
        ]),
      );
    }
    expect(plainStorage.values.get(recordKey('good'))).toBe('2');
    expect(plainStorage.calls.write.map(entry => entry.key)).toContain(recordKey('good'));
    expect(runtime.getPersistenceHealth().status).toBe('degraded');
  });

  it('F-3 retries failed keys on the next flush because cache was not advanced', async () => {
    const plainStorage = createFakeStorage({}, {failWrites: [recordKey('bad')]});
    const {runtime} = await createRuntime({plainStorage});
    runtime.getStore().dispatch({type: 'example/setEntry', key: 'bad', value: 1});
    await runtime.flushPersistence();
    plainStorage.setOptions({});

    const result = await runtime.flushPersistence();

    expect(result.status).toBe('succeeded');
    expect(plainStorage.values.get(recordKey('bad'))).toBe('1');
  });

  it('F-4 clears field dirty state when the owner returns to the confirmed baseline', async () => {
    const plainStorage = createFakeStorage({[fieldKey]: 'true'}, {failWrites: [fieldKey]});
    const {runtime} = await createRuntime({plainStorage});

    runtime.getStore().dispatch({type: 'example/setEnabled', value: false});
    const failed = await runtime.flushPersistence();
    expect(failed.status).toBe('failed');

    plainStorage.setOptions({});
    runtime.getStore().dispatch({type: 'example/setEnabled', value: true});
    const recovered = await runtime.flushPersistence();

    expect(recovered.status).toBe('succeeded');
    expect(runtime.getPersistenceHealth().status).toBe('healthy');
  });

  it('F-5 clears record dirty state when the owner returns to the confirmed baseline', async () => {
    const plainStorage = createFakeStorage({[recordKey('a')]: '1'}, {failWrites: [recordKey('a')]});
    const {runtime} = await createRuntime({plainStorage});

    runtime.getStore().dispatch({type: 'example/setEntry', key: 'a', value: 2});
    const failed = await runtime.flushPersistence();
    expect(failed.status).toBe('failed');

    plainStorage.setOptions({});
    runtime.getStore().dispatch({type: 'example/setEntry', key: 'a', value: 1});
    const recovered = await runtime.flushPersistence();

    expect(recovered.status).toBe('succeeded');
    expect(runtime.getPersistenceHealth().status).toBe('healthy');
  });

  it('H-1 makes listKeys failure visible and blocks destructive writes', async () => {
    const plainStorage = createFakeStorage({}, {failList: true});
    const captured: CapturedLog[] = [];
    const {runtime} = await createRuntime({plainStorage, logger: createFakeLogger(captured)});

    expect(runtime.getPersistenceHealth().blockedStorageKinds).toContain('plain');
    expect(
      captured.some(entry => entry.level === 'error' && entry.input.event === 'state.persistence.hydrate.failure'),
    ).toBe(true);
    runtime.getStore().dispatch({type: 'example/setEntry', key: 'new', value: 1});
    await runtime.flushPersistence();

    expect(plainStorage.calls.write).toHaveLength(0);
  });

  it('H-2 makes readMany failure visible and blocks writes', async () => {
    const plainStorage = createFakeStorage({[recordKey('a')]: '1'}, {failReadMany: true});
    const captured: CapturedLog[] = [];
    const {runtime} = await createRuntime({plainStorage, logger: createFakeLogger(captured)});

    expect(runtime.getPersistenceHealth().blockedStorageKinds).toContain('plain');
    expect(
      captured.some(entry => entry.level === 'error' && entry.input.event === 'state.persistence.hydrate.failure'),
    ).toBe(true);
    await runtime.flushPersistence();

    expect(plainStorage.calls.write).toHaveLength(0);
  });

  it('H-3 keeps blocked backend persistent across flush after one failed rebaseline', async () => {
    const plainStorage = createFakeStorage({}, {failList: true});
    const {runtime} = await createRuntime({plainStorage});
    runtime.getStore().dispatch({type: 'example/setEntry', key: 'new', value: 1});
    await runtime.flushPersistence();
    await runtime.flushPersistence();

    expect(plainStorage.calls.listKeys).toHaveLength(2);
    expect(plainStorage.calls.write).toHaveLength(0);
  });

  it('H-4 clears a blocked backend after one successful rebaseline and then writes', async () => {
    const plainStorage = createFakeStorage({}, {failList: true});
    const {runtime} = await createRuntime({plainStorage});
    runtime.getStore().dispatch({type: 'example/setEntry', key: 'new', value: 1});
    plainStorage.setOptions({});
    const result = await runtime.flushPersistence();

    expect(result.status).toBe('succeeded');
    expect(plainStorage.values.get(recordKey('new'))).toBe('1');
  });

  it('H-5 reports decode failures without deleting existing storage', async () => {
    const plainStorage = createFakeStorage({[recordKey('bad')]: '{'});
    const captured: CapturedLog[] = [];

    const {runtime} = await createRuntime({plainStorage, logger: createFakeLogger(captured)});

    expect(runtime.getPersistenceHealth().status).toBe('degraded');
    expect(plainStorage.values.has(recordKey('bad'))).toBe(true);
    expect(
      captured.some(
        entry =>
          entry.level === 'warn' &&
          entry.input.event === 'state.persistence.hydrate.decode-rejected' &&
          entry.input.data?.storageKey === recordKey('bad'),
      ),
    ).toBe(true);
  });

  it('C-1 reset removes only keys under the persistence namespace', async () => {
    const plainStorage = createFakeStorage({
      [recordKey('a')]: '1',
      unrelated: '2',
    });
    const {runtime} = await createRuntime({plainStorage});

    const result = await runtime.getResetActor().handleResetCommand();

    expect(result.status).toBe('succeeded');
    expect(plainStorage.values.has(recordKey('a'))).toBe(false);
    expect(plainStorage.values.get('unrelated')).toBe('2');
  });

  it('C-1b reset retains only registered owner-declared state and clears other owners and orphan keys', async () => {
    const retainedSliceName = 'kernel.base.server-config.configuration';
    const otherSliceName = 'kernel.base.other-owner.preferences';
    const retainedKey = createPersistenceFieldKey({
      persistenceKey: 'terminal',
      sliceName: retainedSliceName,
      storageKey: 'enabled',
    });
    const otherKey = createPersistenceFieldKey({
      persistenceKey: 'terminal',
      sliceName: otherSliceName,
      storageKey: 'enabled',
    });
    const orphanKey = `${createPersistenceNamespacePrefix('terminal')}unregistered/orphan`;
    const plainStorage = createFakeStorage({[otherKey]: 'true', [orphanKey]: '"orphan"'});
    const protectedStorage = createFakeStorage({[retainedKey]: 'true'});
    const retainedRegistration = defineStateRuntimeSlice<ExampleState>({
      name: retainedSliceName,
      reducer: exampleReducer,
      resetIntent: 'retain',
      persistIntent: 'owner-only',
      persistence: [{kind: 'field', stateKey: 'enabled', protection: 'protected'}],
      syncIntent: 'isolated',
    });
    const otherRegistration = defineStateRuntimeSlice<ExampleState>({
      name: otherSliceName,
      reducer: exampleReducer,
      persistIntent: 'owner-only',
      persistence: [{kind: 'field', stateKey: 'enabled'}],
      syncIntent: 'isolated',
    });
    const runtime = await createStateRuntime({
      runtimeName: 'reset-retention-test',
      environmentMode: 'TEST',
      slices: [retainedRegistration, otherRegistration],
      logger: createFakeLogger(),
      plainStorage,
      protectedStorage,
      persistenceKey: 'terminal',
      persistenceDebounceMs: 0,
    });

    expect(runtime.getState()[retainedSliceName]).toMatchObject({enabled: true});
    expect(runtime.getState()[otherSliceName]).toMatchObject({enabled: true});
    runtime.getStore().dispatch({type: 'example/setCount', value: 9});
    runtime.getStore().dispatch({type: 'example/setEntry', key: 'transient', value: 'discard-me'});
    const result = await runtime.getResetActor().handleResetCommand();

    expect(result.status).toBe('succeeded');
    expect(runtime.getState()[retainedSliceName]).toMatchObject({enabled: true, count: 0, entries: {}});
    expect(runtime.getState()[otherSliceName]).toMatchObject({enabled: false});
    expect(protectedStorage.values.get(retainedKey)).toBe('true');
    expect(plainStorage.values.has(otherKey)).toBe(false);
    expect(plainStorage.values.has(orphanKey)).toBe(false);
  });

  it('C-1c retain intent requires an owner-declared persistent scope', () => {
    expect(() =>
      defineStateRuntimeSlice<ExampleState>({
        name: 'invalid-retained-owner',
        reducer: exampleReducer,
        resetIntent: 'retain',
        persistIntent: 'never',
      }),
    ).toThrow('retain requires persisted owner state');
  });

  it('C-2 does not reset memory when storage deletion fails', async () => {
    const plainStorage = createFakeStorage({[recordKey('a')]: '1'}, {failRemoves: [recordKey('a')]});
    const {runtime} = await createRuntime({plainStorage});

    const result = await runtime.getResetActor().handleResetCommand();

    expect(result.status).toBe('failed');
    expect(runtime.getState()['example.state']).toMatchObject({entries: {a: 1}});
  });

  it('C-2b recovers the serial queue after an unexpected reset exception', async () => {
    const plainStorage = createFakeStorage({[fieldKey]: 'true'});
    const originalRemove = plainStorage.remove;
    let throwOnce = true;
    plainStorage.remove = async input => {
      if (throwOnce) {
        throwOnce = false;
        throw new Error('unexpected reset storage exception');
      }
      return originalRemove(input);
    };
    const {runtime} = await createRuntime({plainStorage});

    await expect(runtime.getResetActor().handleResetCommand()).rejects.toThrow('unexpected reset storage exception');
    const result = await runtime.getResetActor().handleResetCommand();

    expect(result.status).toBe('succeeded');
    expect(runtime.getState()['example.state']).toMatchObject({enabled: false});
  });

  it('C-3 exposes the exact namespace prefix used by reset filtering', () => {
    expect(createPersistenceNamespacePrefix('terminal')).toBe('catering-v2s.terminal.state.v1/terminal/');
  });

  it('M-1 migrates old plain data to protected by writing new before deleting old', async () => {
    const plainStorage = createFakeStorage({[fieldKey]: 'true'});
    const protectedStorage = createFakeStorage();
    const registration = createExampleStateRegistration({protection: 'protected'});
    const {runtime} = await createRuntime({plainStorage, protectedStorage, registration});

    const result = await runtime.flushPersistence();

    expect(result.status).toBe('succeeded');
    expect(protectedStorage.values.get(fieldKey)).toBe('true');
    expect(plainStorage.values.has(fieldKey)).toBe(false);
  });

  it('M-2 reports migration failure when writing the new protected key fails', async () => {
    const plainStorage = createFakeStorage({[fieldKey]: 'true'});
    const protectedStorage = createFakeStorage({}, {failWrites: [fieldKey]});
    const registration = createExampleStateRegistration({protection: 'protected'});
    const {runtime} = await createRuntime({plainStorage, protectedStorage, registration});

    const result = await runtime.flushPersistence();

    expect(result.status).toBe('failed');
    expect(plainStorage.values.has(fieldKey)).toBe(true);
  });

  it('M-3 reports migration failure when deleting old plain key fails', async () => {
    const plainStorage = createFakeStorage({[fieldKey]: 'true'}, {failRemoves: [fieldKey]});
    const protectedStorage = createFakeStorage();
    const registration = createExampleStateRegistration({protection: 'protected'});
    const {runtime} = await createRuntime({plainStorage, protectedStorage, registration});

    const result = await runtime.flushPersistence();

    expect(result.status).toBe('failed');
    expect(protectedStorage.values.get(fieldKey)).toBe('true');
    expect(plainStorage.values.has(fieldKey)).toBe(true);
  });

  it('M-4 keeps storage category migration independent of record entry commits', async () => {
    const registration = createExampleStateRegistration({protection: 'protected'});
    const plainStorage = createFakeStorage({[recordKey('a')]: '1'});
    const protectedStorage = createFakeStorage();
    const {runtime} = await createRuntime({plainStorage, protectedStorage, registration});

    const result = await runtime.flushPersistence();

    expect(result.status).toBe('succeeded');
    expect(protectedStorage.values.get(recordKey('a'))).toBe('1');
  });

  it('M-4b prefers current protected data when both storage categories contain a key', async () => {
    const registration = createExampleStateRegistration({protection: 'protected'});
    const plainStorage = createFakeStorage({[fieldKey]: 'false'});
    const protectedStorage = createFakeStorage({[fieldKey]: 'true'});
    const {runtime} = await createRuntime({plainStorage, protectedStorage, registration});

    expect(runtime.getState()['example.state']).toMatchObject({enabled: true});
    const result = await runtime.flushPersistence();

    expect(result.status).toBe('succeeded');
    expect(protectedStorage.values.get(fieldKey)).toBe('true');
    expect(plainStorage.values.has(fieldKey)).toBe(false);
  });

  it('M-5 continues independent migrations after one key fails', async () => {
    const registration = createExampleStateRegistration({protection: 'protected'});
    const plainStorage = createFakeStorage({
      [recordKey('bad')]: '1',
      [recordKey('good')]: '2',
    });
    const protectedStorage = createFakeStorage({}, {failWrites: [recordKey('bad')]});
    const {runtime} = await createRuntime({plainStorage, protectedStorage, registration});

    const result = await runtime.flushPersistence();

    expect(result.status).toBe('failed');
    expect(protectedStorage.values.get(recordKey('good'))).toBe('2');
    expect(plainStorage.values.has(recordKey('good'))).toBe(false);
    expect(plainStorage.values.has(recordKey('bad'))).toBe(true);
  });

  it('X-1 allows partial record success and reloads each committed entry independently', async () => {
    const plainStorage = createFakeStorage({}, {failWrites: [recordKey('bad')]});
    const first = await createRuntime({plainStorage});
    first.runtime.getStore().dispatch({type: 'example/setEntry', key: 'bad', value: 1});
    first.runtime.getStore().dispatch({type: 'example/setEntry', key: 'good', value: 2});
    await first.runtime.flushPersistence();

    const second = await createRuntime({plainStorage});

    expect(second.runtime.getState()['example.state']).toMatchObject({
      entries: {good: 2},
    });
  });

  it('X-2 rejects duplicate canonical field keys', async () => {
    const registration = defineStateRuntimeSlice<ExampleState>({
      name: 'example.state',
      reducer: exampleReducer,
      persistIntent: 'owner-only',
      persistence: [
        {kind: 'field', stateKey: 'enabled', storageKey: 'same'},
        {kind: 'field', stateKey: 'count', storageKey: 'same'},
      ],
      syncIntent: 'isolated',
    });

    await expect(createRuntime({registration})).rejects.toThrow('duplicate persistence key');
  });

  it('X-3 rejects duplicate record prefixes', async () => {
    const registration = defineStateRuntimeSlice<ExampleState>({
      name: 'example.state',
      reducer: exampleReducer,
      persistIntent: 'owner-only',
      persistence: [
        {
          kind: 'record',
          storageKeyPrefix: 'same',
          getEntries: state => state.entries,
          applyEntries: (state, entries) => ({...state, entries}),
        },
        {
          kind: 'record',
          storageKeyPrefix: 'same',
          getEntries: state => state.entries,
          applyEntries: (state, entries) => ({...state, entries}),
        },
      ],
      syncIntent: 'isolated',
    });

    await expect(createRuntime({registration})).rejects.toThrow('duplicate persistence');
  });

  it('X-4 respects shouldPersistEntry without deleting unrelated record data', async () => {
    const registration = createExampleStateRegistration({
      shouldPersistEntry: key => key !== 'skip',
    });
    const plainStorage = createFakeStorage();
    const {runtime} = await createRuntime({registration, plainStorage});
    runtime.getStore().dispatch({type: 'example/setEntry', key: 'keep', value: 1});
    runtime.getStore().dispatch({type: 'example/setEntry', key: 'skip', value: 2});

    await runtime.flushPersistence();

    expect(plainStorage.values.get(recordKey('keep'))).toBe('1');
    expect(plainStorage.values.has(recordKey('skip'))).toBe(false);
  });

  it('X-5 rejects invalid persistenceKey and storage key segments', async () => {
    await expect(
      createStateRuntime({
        runtimeName: 'test',
        environmentMode: 'TEST',
        slices: [createExampleStateRegistration()],
        logger: createFakeLogger(),
        plainStorage: createFakeStorage(),
        protectedStorage: createFakeStorage(),
        persistenceKey: '   ',
        persistenceDebounceMs: 0,
      }),
    ).rejects.toThrow('persistenceKey must be non-empty');
  });

  it('X-6 round-trips entry keys containing delimiter characters', () => {
    const key = createPersistenceRecordEntryKey({
      persistenceKey: 'terminal/main',
      sliceName: 'example.state',
      storageKeyPrefix: 'entries/local',
      entryKey: 'ticket/100%ready',
    });

    expect(parsePersistenceKey(key)).toEqual({
      persistenceKey: 'terminal/main',
      sliceName: 'example.state',
      kind: 'record',
      storageKeyPrefix: 'entries/local',
      entryKey: 'ticket/100%ready',
    });
    expect(parsePersistenceKey(`${createPersistenceNamespacePrefix('terminal')}broken`)).toBeUndefined();
  });

  it('X-7 rejects non-JSON-safe persistence values before writing', () => {
    const circular: {self?: unknown} = {};
    circular.self = circular;
    const sparse = [1, , 3];
    const accessor = {};
    Object.defineProperty(accessor, 'value', {
      enumerable: true,
      get: () => 1,
    });
    const symbolKey = {[Symbol('state')]: 1};
    const invalidValues: readonly unknown[] = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      undefined,
      BigInt(1),
      () => 1,
      Symbol('x'),
      new Date(0),
      new Map(),
      circular,
      sparse,
      accessor,
      symbolKey,
    ];

    for (const value of invalidValues) {
      expect(encodeStateJsonValue(value).status).toBe('failed');
    }
    expect(decodeStateJsonValue('{"ok":true}')).toEqual({
      status: 'succeeded',
      value: {ok: true},
    });
  });

  it('X-6/X-7 enables RTK serializable and immutable checks outside PROD only', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const testRuntime = await createRuntime({environmentMode: 'TEST'});
      testRuntime.runtime.getStore().dispatch({
        type: 'test/non-serializable',
        payload: new Date(0),
      });
      expect(consoleError).toHaveBeenCalled();
      const testState = testRuntime.runtime.getState()['example.state'] as unknown as {enabled: boolean};
      testState.enabled = true;
      expect(() => testRuntime.runtime.getStore().dispatch({type: 'test/immutable-check'})).toThrow(
        /state mutation was detected/i,
      );

      consoleError.mockClear();
      const prodRuntime = await createRuntime({environmentMode: 'PROD'});
      prodRuntime.runtime.getStore().dispatch({
        type: 'test/non-serializable',
        payload: new Date(0),
      });
      expect(consoleError).not.toHaveBeenCalled();
      const prodState = prodRuntime.runtime.getState()['example.state'] as unknown as {enabled: boolean};
      prodState.enabled = true;
      expect(() => prodRuntime.runtime.getStore().dispatch({type: 'test/immutable-check'})).not.toThrow();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('X-9 skips unknown and undeclared sync slices with typed reasons', async () => {
    const isolated = defineStateRuntimeSlice<ExampleState>({
      name: 'isolated.state',
      reducer: exampleReducer,
      persistIntent: 'never',
      syncIntent: 'isolated',
    });
    const {runtime} = await createRuntime({registration: isolated});

    expect(runtime.createFullSyncPayload('missing.state')).toEqual({
      status: 'skipped',
      sliceName: 'missing.state',
      reason: 'UNKNOWN_SLICE',
    });
    expect(runtime.createFullSyncPayload('isolated.state')).toEqual({
      status: 'skipped',
      sliceName: 'isolated.state',
      reason: 'SYNC_NOT_DECLARED',
    });
  });

  it('S-5 skips undeclared sync apply and emits a warning', async () => {
    const captured: CapturedLog[] = [];
    const {runtime} = await createRuntime({logger: createFakeLogger(captured)});

    const result = runtime.applyAuthoritativeSync('missing.state', {
      mode: 'authoritative',
      replaceMissing: true,
      entries: [],
    });

    expect(result).toEqual({
      status: 'skipped',
      sliceName: 'missing.state',
      reason: 'UNKNOWN_SLICE',
    });
    expect(captured.some(entry => entry.level === 'warn' && entry.input.event === 'state.sync.apply.skipped')).toBe(
      true,
    );
  });
});
