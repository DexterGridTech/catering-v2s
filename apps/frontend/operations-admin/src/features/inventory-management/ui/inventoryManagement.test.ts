import {describe, expect, it} from 'vitest';
import {envelopeData, shouldRequestInventoryDiagnostics} from './inventoryManagementModel';

describe('inventory management runtime model contracts', () => {
  it('requests diagnostics only when the selected inventory target is eligible', () => {
    expect(shouldRequestInventoryDiagnostics(true)).toBe(true);
    expect(shouldRequestInventoryDiagnostics(false)).toBe(false);
  });

  it('decodes both enveloped pages and raw detail read models', () => {
    expect(envelopeData<{items: string[]}>({data: {items: ['page']}} as never)).toEqual({items: ['page']});
    expect(envelopeData<{target: {productCode: string}}>({target: {productCode: 'LATTE-001'}} as never)).toEqual({target: {productCode: 'LATTE-001'}});
  });
});
