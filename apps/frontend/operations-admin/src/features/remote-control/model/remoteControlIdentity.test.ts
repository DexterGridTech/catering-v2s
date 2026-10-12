import {describe, expect, it} from 'vitest';
import {createRemoteControlUuid} from './remoteControlIdentity';

describe('createRemoteControlUuid', () => {
  it('formats a v4 UUID from the available random-values source', () => {
    const uuid = createRemoteControlUuid({
      getRandomValues: <T extends ArrayBufferView>(array: T) => {
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(0);
        return array;
      },
    });
    expect(uuid).toBe('00000000-0000-4000-8000-000000000000');
  });
});
