import type {AndroidPersistKvStorageMode} from '../src/implementations/androidPersistKv';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const {requireNativeModuleMock} = vi.hoisted(() => ({requireNativeModuleMock: vi.fn()}));

vi.mock('expo-modules-core', () => ({requireNativeModule: requireNativeModuleMock}));

const nativeModule = requireNativeModuleMock;
const descriptorKey = Symbol.for('catering-v2s.platform-ports.descriptor');
let createAndroidPersistKvPort: typeof import('../src/implementations/androidPersistKv').createAndroidPersistKvPort;

const nativeResult = (
  port: 'persistKv' | 'persistSecure',
  mode: AndroidPersistKvStorageMode,
  capability: string,
  value: unknown,
) => ({
  status: 'succeeded' as const,
  port,
  mode,
  capability,
  value,
  completedAt: 123,
});

const createNative = (mode: AndroidPersistKvStorageMode = 'plain') => {
  const port = mode === 'protected' ? 'persistSecure' : 'persistKv';
  return {
    read: vi.fn(async (persistenceKey: string, receivedMode: string, key: string) =>
      nativeResult(port, receivedMode as AndroidPersistKvStorageMode, 'read', {
        state: 'found',
        value: `${persistenceKey}:${key}`,
      }),
    ),
    write: vi.fn(async (_persistenceKey: string, receivedMode: string, _key: string, _value: string) =>
      nativeResult(port, receivedMode as AndroidPersistKvStorageMode, 'write', {completed: true}),
    ),
    remove: vi.fn(async (_persistenceKey: string, receivedMode: string, _key: string) =>
      nativeResult(port, receivedMode as AndroidPersistKvStorageMode, 'remove', {completed: true}),
    ),
    readMany: vi.fn(async (_persistenceKey: string, receivedMode: string, keys: readonly string[]) =>
      nativeResult(
        port,
        receivedMode as AndroidPersistKvStorageMode,
        'readMany',
        keys.map(key => ({key, result: {state: 'missing'}})),
      ),
    ),
    writeMany: vi.fn(
      async (_persistenceKey: string, receivedMode: string, _keys: readonly string[], _values: readonly string[]) =>
        nativeResult(port, receivedMode as AndroidPersistKvStorageMode, 'writeMany', {completed: true}),
    ),
    removeMany: vi.fn(async (_persistenceKey: string, receivedMode: string, _keys: readonly string[]) =>
      nativeResult(port, receivedMode as AndroidPersistKvStorageMode, 'removeMany', {completed: true}),
    ),
    listKeys: vi.fn(async (_persistenceKey: string, receivedMode: string) =>
      nativeResult(port, receivedMode as AndroidPersistKvStorageMode, 'listKeys', ['one', 'two']),
    ),
    clear: vi.fn(async (_persistenceKey: string, receivedMode: string) =>
      nativeResult(port, receivedMode as AndroidPersistKvStorageMode, 'clear', {completed: true}),
    ),
  };
};

describe('createAndroidPersistKvPort', () => {
  beforeEach(async () => {
    vi.resetModules();
    nativeModule.mockReset();
    ({createAndroidPersistKvPort} = await import('../src/implementations/androidPersistKv'));
  });

  it('does not cache a failed module lookup, then forwards opaque values with no timeout argument', async () => {
    const native = createNative();
    nativeModule.mockImplementationOnce(() => {
      throw new Error('module not loaded');
    });
    nativeModule.mockReturnValue(native);
    const port = createAndroidPersistKvPort('sample-terminal-android', 'plain');

    await expect(port.read({key: 'state.key'})).resolves.toMatchObject({
      status: 'failed',
      port: 'persistKv',
      capability: 'read',
      error: {code: 'PERSIST_KV_BRIDGE_FAILED', retryable: true},
    });
    await expect(port.read({key: 'state.key'})).resolves.toEqual({
      status: 'succeeded',
      value: {state: 'found', value: 'sample-terminal-android:state.key'},
      completedAt: 123,
    });
    expect(nativeModule).toHaveBeenCalledTimes(2);
    expect(native.read).toHaveBeenCalledWith('sample-terminal-android', 'plain', 'state.key');
  });

  it('uses one native module for both explicit mode wrappers while keeping port identity and descriptors separate', async () => {
    const native = createNative('protected');
    nativeModule.mockReturnValue(native);
    const plain = createAndroidPersistKvPort('sample-terminal-android', 'plain');
    const protectedPort = createAndroidPersistKvPort('sample-terminal-android', 'protected');

    expect(plain).not.toBe(protectedPort);
    expect(Object.isFrozen(plain)).toBe(true);
    expect(Object.isFrozen(protectedPort)).toBe(true);
    expect(Reflect.get(plain, descriptorKey)).toMatchObject({port: 'persistKv'});
    expect(Reflect.get(protectedPort, descriptorKey)).toMatchObject({port: 'persistSecure'});

    await expect(protectedPort.read({key: 'secret'})).resolves.toEqual({
      status: 'succeeded',
      value: {state: 'found', value: 'sample-terminal-android:secret'},
      completedAt: 123,
    });
    expect(native.read).toHaveBeenCalledWith('sample-terminal-android', 'protected', 'secret');
  });

  it('forwards all eight capabilities through the same mode boundary', async () => {
    const native = createNative('protected');
    nativeModule.mockReturnValue(native);
    const port = createAndroidPersistKvPort('sample-terminal-android', 'protected');

    await expect(port.write({key: 'state.key', value: '{"kind":"null","value":null}'})).resolves.toMatchObject({
      status: 'succeeded',
      value: {completed: true},
    });
    await expect(port.remove({key: 'state.key'})).resolves.toMatchObject({
      status: 'succeeded',
      value: {completed: true},
    });
    await expect(port.readMany({keys: ['one', 'two']})).resolves.toMatchObject({
      status: 'succeeded',
      value: [{key: 'one'}, {key: 'two'}],
    });
    await expect(
      port.writeMany({
        entries: [
          {key: 'one', value: '1'},
          {key: 'two', value: '2'},
        ],
      }),
    ).resolves.toMatchObject({status: 'succeeded', value: {completed: true}});
    await expect(port.removeMany({keys: ['one', 'two']})).resolves.toMatchObject({
      status: 'succeeded',
      value: {completed: true},
    });
    await expect(port.listKeys({})).resolves.toMatchObject({status: 'succeeded', value: ['one', 'two']});
    await expect(port.clear({})).resolves.toMatchObject({status: 'succeeded', value: {completed: true}});

    expect(native.write).toHaveBeenCalledWith(
      'sample-terminal-android',
      'protected',
      'state.key',
      '{"kind":"null","value":null}',
    );
    expect(native.writeMany).toHaveBeenCalledWith('sample-terminal-android', 'protected', ['one', 'two'], ['1', '2']);
    expect(native.clear).toHaveBeenCalledWith('sample-terminal-android', 'protected');
  });

  it('rejects malformed and mismatched private wire results instead of passing them to state', async () => {
    const native = createNative();
    native.read
      .mockResolvedValueOnce({
        status: 'succeeded',
        port: 'persistKv',
        mode: 'plain',
        capability: 'read',
        completedAt: 123,
      })
      .mockResolvedValueOnce({
        status: 'succeeded',
        port: 'persistSecure',
        mode: 'protected',
        capability: 'read',
        value: {state: 'missing'},
        completedAt: 123,
      })
      .mockResolvedValueOnce({
        status: 'failed',
        port: 'persistKv',
        mode: 'plain',
        capability: 'read',
        error: {code: 'X', message: 'x', retryable: false, key: 'raw.secret'},
      });
    nativeModule.mockReturnValue(native);
    const port = createAndroidPersistKvPort('sample-terminal-android', 'plain');

    for (let index = 0; index < 3; index += 1) {
      await expect(port.read({key: `key-${index}`})).resolves.toEqual({
        status: 'failed',
        port: 'persistKv',
        capability: 'read',
        error: {
          code: 'PERSIST_KV_INVALID_RESULT',
          message: 'persist-kv bridge returned an invalid result',
          retryable: false,
        },
      });
    }
  });

  it('rejects a runtime-invalid factory mode without touching the native module', async () => {
    const native = createNative();
    nativeModule.mockReturnValue(native);
    const invalidPort = createAndroidPersistKvPort('sample-terminal-android', 'future' as AndroidPersistKvStorageMode);

    await expect(invalidPort.read({key: 'state.key'})).resolves.toEqual({
      status: 'failed',
      port: 'persistKv',
      capability: 'read',
      error: {code: 'PERSIST_KV_INVALID_MODE', message: 'persist-kv storage mode is invalid: future', retryable: false},
    });
    expect(nativeModule).not.toHaveBeenCalled();
    expect(native.read).not.toHaveBeenCalled();
  });

  it('maps a native bridge rejection to a typed failure with the expected protected port', async () => {
    const native = createNative('protected');
    native.clear.mockRejectedValue(new Error('bridge disconnected'));
    nativeModule.mockReturnValue(native);
    const port = createAndroidPersistKvPort('sample-terminal-android', 'protected');

    await expect(port.clear({})).resolves.toEqual({
      status: 'failed',
      port: 'persistSecure',
      capability: 'clear',
      error: {
        code: 'PERSIST_KV_BRIDGE_FAILED',
        message: 'persist-kv bridge failed',
        retryable: true,
      },
    });
  });
});
