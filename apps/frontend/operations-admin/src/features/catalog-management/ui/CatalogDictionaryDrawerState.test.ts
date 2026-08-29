import {describe, expect, it} from 'vitest';
import {catalogUnitStatusQuery, catalogUnitVoidControlState} from './CatalogDictionaryDrawerState';

describe('catalog unit void control', () => {
  it('does not send an already referenced unit into a predictable void rejection', () => {
    expect(catalogUnitVoidControlState({canWrite: true, isReferenced: true, isTransitioning: false})).toEqual({
      disabled: true,
      reason: '该计量单位正在使用，不能作废；可以停用。',
    });
  });

  it('keeps void available only for a writable, unreferenced and idle unit', () => {
    expect(catalogUnitVoidControlState({canWrite: true, isReferenced: false, isTransitioning: false})).toEqual({
      disabled: false,
    });
  });
});

describe('catalog unit status query', () => {
  it.each(['ENABLED', 'DISABLED', 'VOIDED'] as const)('forwards %s without widening the filter', status => {
    expect(catalogUnitStatusQuery(status)).toEqual({status});
  });

  it('does not invent a status for the unfiltered management list', () => {
    expect(catalogUnitStatusQuery(undefined)).toEqual({});
  });
});
