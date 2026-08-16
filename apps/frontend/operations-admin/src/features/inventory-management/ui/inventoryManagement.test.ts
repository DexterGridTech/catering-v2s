import {describe, expect, it} from 'vitest';
import {inventoryActionResetKey} from './InventoryActionModal';
import {envelopeData, inventoryAuthorityLabel, shouldRequestInventoryDiagnostics} from './inventoryManagementModel';

describe('inventory management runtime model contracts', () => {
  it('requests diagnostics only when the selected inventory target is eligible', () => {
    expect(shouldRequestInventoryDiagnostics(true)).toBe(true);
    expect(shouldRequestInventoryDiagnostics(false)).toBe(false);
  });

  it('decodes both enveloped pages and raw detail read models', () => {
    expect(envelopeData<{items: string[]}>({data: {items: ['page']}} as never)).toEqual({items: ['page']});
    expect(envelopeData<{target: {productCode: string}}>({target: {productCode: 'LATTE-001'}} as never)).toEqual({
      target: {productCode: 'LATTE-001'},
    });
  });

  it('does not reset an action surface when only the refreshed readback changes', () => {
    expect(inventoryActionResetKey('COUNT', 'target-1')).toBe(inventoryActionResetKey('COUNT', 'target-1'));
    expect(inventoryActionResetKey('COUNT', 'target-1')).not.toBe(inventoryActionResetKey('COUNT', 'target-2'));
    expect(inventoryActionResetKey('COUNT', 'target-1')).not.toBe(inventoryActionResetKey('INCREASE', 'target-1'));
  });

  it('renders the inventory source from the authority fact', () => {
    expect(inventoryAuthorityLabel('INTERNAL')).toBe('内部轻库存');
    expect(inventoryAuthorityLabel(undefined)).toBe('—');
    expect(inventoryAuthorityLabel('EXTERNAL')).toBe('EXTERNAL');
  });
});
