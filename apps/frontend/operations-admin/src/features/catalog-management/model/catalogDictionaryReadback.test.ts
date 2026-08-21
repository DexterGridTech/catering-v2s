import {describe, expect, it} from 'vitest';
import type {CatalogDictionaryEntryReadback, Uuid} from '../../../app/api/generated/catalog-inventory-edge';
import {catalogDictionaryQuickManageCandidateFromReadback} from './catalogDictionaryReadback';

const uuid = (value: string) => value as Uuid;

describe('catalog dictionary create readback', () => {
  it('returns the stable candidate only when the command readback is complete', () => {
    const response = {
      revision: 'test',
      requestId: 'request',
      result: {
        entryRef: uuid('00000000-0000-4000-8000-000000000001'),
        dictionaryKind: 'TAG',
        code: 'bao',
        name: '包',
        status: 'ENABLED',
      },
    } satisfies CatalogDictionaryEntryReadback;

    expect(catalogDictionaryQuickManageCandidateFromReadback(response)).toEqual({
      entryRef: '00000000-0000-4000-8000-000000000001',
      code: 'bao',
      name: '包',
    });
  });

  it('rejects a successful transport response without a usable result', () => {
    expect(catalogDictionaryQuickManageCandidateFromReadback(undefined)).toBeUndefined();
    expect(
      catalogDictionaryQuickManageCandidateFromReadback({
        revision: 'test',
        requestId: 'request',
        result: undefined as never,
      }),
    ).toBeUndefined();
  });
});
