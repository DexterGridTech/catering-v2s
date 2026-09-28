import {describe, expect, it} from 'vitest';
import {createWebStateStoragePort} from '../src';

class ThrowingWebStorage implements Storage {
  get length(): number {
    throw new Error('quota exceeded');
  }
  clear(): void {
    throw new Error('quota exceeded');
  }
  getItem(): string | null {
    throw new Error('quota exceeded');
  }
  key(): string | null {
    throw new Error('quota exceeded');
  }
  removeItem(): void {
    throw new Error('quota exceeded');
  }
  setItem(): void {
    throw new Error('quota exceeded');
  }
}

describe('ui.base.dev-host Web StateStoragePort', () => {
  it('preserves namespace isolation for successful storage operations', async () => {
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return values.size;
      },
      clear: () => {
        values.clear();
      },
      getItem: key => values.get(key) ?? null,
      key: index => [...values.keys()][index] ?? null,
      removeItem: key => {
        values.delete(key);
      },
      setItem: (key, value) => {
        values.set(key, value);
      },
    };
    const port = createWebStateStoragePort(storage, 'plain:', 'persistKv');
    const other = createWebStateStoragePort(storage, 'protected:', 'persistSecure');

    expect(await port.write({key: 'members', value: '{"members":[]} '})).toMatchObject({status: 'succeeded'});
    expect(await port.read({key: 'members'})).toMatchObject({
      status: 'succeeded',
      value: {state: 'found', value: '{"members":[]} '},
    });
    expect(await other.read({key: 'members'})).toMatchObject({status: 'succeeded', value: {state: 'missing'}});
    expect(storage.getItem('plain:members')).toBe('{"members":[]} ');
  });

  it('returns the caught storage reason for every failure operation', async () => {
    const port = createWebStateStoragePort(new ThrowingWebStorage(), 'plain:', 'persistKv');
    const results = await Promise.all([
      port.read({key: 'key'}),
      port.write({key: 'key', value: 'value'}),
      port.remove({key: 'key'}),
      port.readMany({keys: ['key']}),
      port.writeMany({entries: [{key: 'key', value: 'value'}]}),
      port.removeMany({keys: ['key']}),
      port.listKeys({}),
      port.clear({}),
    ]);

    for (const result of results) {
      expect(result).toMatchObject({
        status: 'failed',
        error: {code: 'WEB_STORAGE_ERROR', message: 'Error: quota exceeded', retryable: true},
      });
    }
  });
});
