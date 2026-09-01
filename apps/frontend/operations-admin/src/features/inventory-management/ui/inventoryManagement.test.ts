import {describe, expect, it} from 'vitest';
import {inventoryActionResetKey, truncateTowardZero} from './InventoryActionModal';
import {
  envelopeData,
  inventoryAuthorityLabel,
  inventoryDeductionTimingLabel,
  inventoryMaterialRoleLabel,
  inventoryOperationLabel,
  inventoryReasonLabel,
  inventoryReferenceSourceKindLabel,
  inventorySelectableUnitSnapshots,
  inventoryShapeLabel,
  inventoryStockStateLabel,
  inventoryTargetTypeLabel,
} from './inventoryManagementModel';

describe('inventory management runtime model contracts', () => {
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

  it('truncates decimal input without a binary-float multiplication boundary', () => {
    expect(truncateTowardZero(0.29, 2)).toBe(0.29);
    expect(truncateTowardZero(-0.299, 2)).toBe(-0.29);
    expect(truncateTowardZero(1.999, 2)).toBe(1.99);
  });

  it('renders the inventory source from the authority fact', () => {
    expect(inventoryAuthorityLabel('INTERNAL')).toBe('内部轻库存');
    expect(inventoryAuthorityLabel(undefined)).toBe('—');
    expect(inventoryAuthorityLabel('EXTERNAL')).toBe('未识别');
  });

  it('translates inventory closed-set values before they reach the UI', () => {
    expect(inventoryShapeLabel('MATERIAL')).toBe('原材料/半成品/包装物');
    expect(inventoryShapeLabel('COUNTED')).toBe('计数销售');
    expect(inventoryMaterialRoleLabel('RAW_MATERIAL')).toBe('原材料');
    expect(inventoryMaterialRoleLabel('SEMI_FINISHED')).toBe('半成品');
    expect(inventoryMaterialRoleLabel('PACKAGING_MATERIAL')).toBe('包装物');
    expect(inventoryTargetTypeLabel('CATALOG_ITEM')).toBe('商品');
    expect(inventoryTargetTypeLabel('SKU')).toBe('规格');
    expect(inventoryTargetTypeLabel('OPTION_VALUE')).toBe('点单选项值');
    expect(inventoryStockStateLabel('OUT')).toBe('无库存');
    expect(inventoryOperationLabel('COUNT')).toBe('存量盘点');
    expect(inventoryOperationLabel('MANUAL_COUNT_COVERAGE')).toBe('存量盘点');
    expect(inventoryReasonLabel('CORRECTION')).toBe('盘点纠正');
    expect(inventoryReferenceSourceKindLabel('OPTION_VALUE')).toBe('点单选项值');
    expect(inventoryDeductionTimingLabel('BOM')).toBe('按 BOM 扣组件库存');
    expect(inventoryOperationLabel('UNSUPPORTED_INTERNAL_VALUE')).toBe('未识别');
  });

  it('limits inventory input units to the current product snapshots', () => {
    const consumptionUnit = {
      unitRef: 'gram',
      code: 'GRAM',
      name: '克',
      unitDimension: 'WEIGHT' as const,
      precision: 0,
    };
    const countingUnit = {
      unitRef: 'kilogram',
      code: 'KILOGRAM',
      name: '千克',
      unitDimension: 'WEIGHT' as const,
      precision: 3,
    };
    const current = {
      target: {consumptionUnitSnapshot: consumptionUnit, countingUnitSnapshot: null},
      configuration: {countingUnitSnapshot: countingUnit},
    } as never;

    expect(inventorySelectableUnitSnapshots(current)).toEqual([consumptionUnit, countingUnit]);
  });

  it('does not expose a second unit when the product has only its consumption unit', () => {
    const consumptionUnit = {
      unitRef: 'gram',
      code: 'GRAM',
      name: '克',
      unitDimension: 'WEIGHT' as const,
      precision: 0,
    };
    const current = {
      target: {consumptionUnitSnapshot: consumptionUnit, countingUnitSnapshot: null},
      configuration: {countingUnitSnapshot: null},
    } as never;

    expect(inventorySelectableUnitSnapshots(current)).toEqual([consumptionUnit]);
  });
});
