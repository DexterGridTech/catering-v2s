import {describe, expect, it} from 'vitest';
import {catalogUnitDeleteControlState} from './CatalogDictionaryDrawerState';

describe('catalog unit delete control', () => {
  it('does not send an already referenced unit into a predictable delete rejection', () => {
    expect(catalogUnitDeleteControlState({canWrite: true, isReferenced: true, isDeleting: false})).toEqual({
      disabled: true,
      reason: '该计量单位正在使用，不能删除；可以停用。',
    });
  });

  it('keeps delete available only for a writable, unreferenced and idle unit', () => {
    expect(catalogUnitDeleteControlState({canWrite: true, isReferenced: false, isDeleting: false})).toEqual({
      disabled: false,
    });
  });
});
