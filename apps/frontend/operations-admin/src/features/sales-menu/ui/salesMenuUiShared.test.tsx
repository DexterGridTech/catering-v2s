import {describe, expect, it} from 'vitest';
import type {SalesMenuDraftItemView, SalesMenuPublishedItemView} from '../../../app/api/generated/operations-edge';
import {
  salesMenuConstraintLabel,
  salesMenuPriceLabel,
  salesMenuPublishedPriceLabel,
  salesMenuSpecificationLabel,
} from './salesMenuUiShared';

const draftItem = (overrides: Partial<SalesMenuDraftItemView> = {}): SalesMenuDraftItemView =>
  ({
    salesItemRef: 'sales-item-1' as never,
    catalogItemRef: 'catalog-item-1' as never,
    itemCode: 'ITEM-001',
    displayName: '测试商品',
    productShape: 'ORDINARY',
    orderOptions: [],
    defaultPriceCents: 2800,
    catalogPrimaryImageAssetRef: null,
    saleContent: {
      kind: 'DIRECT',
      listedPriceCents: 2800,
      skuPrices: [],
      salesUnit: {
        unitRef: 'unit-1' as never,
        code: 'PORTION',
        name: '份',
        unitDimension: 'COUNT',
        precision: 0,
      },
    },
    orderingConstraints: {minItemQuantity: 1, quantityStep: 1},
    displayMedia: {mode: 'INHERIT_CATALOG', assetRefs: [], primaryAssetRef: null},
    displayOrder: 0,
    canMoveUp: false,
    canMoveDown: false,
    version: 1,
    ...overrides,
  }) as SalesMenuDraftItemView;

const publishedItem = (overrides: Partial<SalesMenuPublishedItemView> = {}): SalesMenuPublishedItemView =>
  ({
    salesItemRef: 'sales-item-1' as never,
    catalogItemRef: 'catalog-item-1' as never,
    itemCode: 'ITEM-001',
    displayName: '测试商品',
    productShape: 'ORDINARY',
    orderOptions: [],
    saleContent: {
      kind: 'DIRECT',
      listedPriceCents: 2800,
      skuPrices: [],
      salesUnit: {
        unitRef: 'unit-1' as never,
        code: 'PORTION',
        name: '份',
        unitDimension: 'COUNT',
        precision: 0,
      },
    },
    orderingConstraints: {minItemQuantity: 1, quantityStep: 1},
    displayMedia: {mode: 'INHERIT_CATALOG', assetRefs: [], primaryAssetRef: null},
    displayOrder: 0,
    inventoryAvailability: {applicability: 'APPLICABLE', state: 'AVAILABLE', reason: null},
    manualSaleStatus: {state: 'NORMAL', reason: null, changedAt: null, changedByDisplayName: null},
    version: 1,
    ...overrides,
  }) as SalesMenuPublishedItemView;

describe('sales menu shared table presentation', () => {
  it('shows only the listed price when a direct item matches its catalog default', () => {
    expect(salesMenuPriceLabel(draftItem())).toBe('¥28.00');
  });

  it('shows both prices when a direct item overrides its catalog default', () => {
    expect(
      salesMenuPriceLabel(
        draftItem({
          saleContent: {
            ...draftItem().saleContent,
            listedPriceCents: 3200,
          },
        }),
      ),
    ).toBe('菜单 ¥32.00 / 默认 ¥28.00');
  });

  it('renders SKU names and prices as separate lines with equality-aware labels', () => {
    const item = draftItem({
      productShape: 'SKU',
      saleContent: {
        ...draftItem().saleContent,
        kind: 'SKU_SELECTION',
        skuPrices: [
          {
            skuRef: 'sku-1' as never,
            skuName: '小杯拿铁',
            skuCode: 'LATTE-S',
            standardPriceCents: 2800,
            listedPriceCents: 2800,
          },
          {
            skuRef: 'sku-2' as never,
            skuName: '中杯拿铁',
            skuCode: 'LATTE-M',
            standardPriceCents: 3000,
            listedPriceCents: 3200,
          },
        ],
      },
    });
    expect(salesMenuPriceLabel(item)).toEqual(['小杯拿铁：¥28.00', '中杯拿铁：菜单 ¥32.00 / 默认 ¥30.00']);
    expect(salesMenuSpecificationLabel(item)).toEqual(['小杯拿铁', '中杯拿铁']);
  });

  it('renders published SKU prices and specifications one per line', () => {
    const item = publishedItem({
      productShape: 'SKU',
      saleContent: {
        ...publishedItem().saleContent,
        kind: 'SKU_SELECTION',
        skuPrices: [
          {
            skuRef: 'sku-1' as never,
            skuName: '小杯拿铁',
            skuCode: 'LATTE-S',
            standardPriceCents: 2800,
            listedPriceCents: 2800,
          },
          {
            skuRef: 'sku-2' as never,
            skuName: '中杯拿铁',
            skuCode: 'LATTE-M',
            standardPriceCents: 3000,
            listedPriceCents: 3200,
          },
        ],
      },
    });
    expect(salesMenuPublishedPriceLabel(item)).toEqual(['小杯拿铁：¥28.00', '中杯拿铁：¥32.00']);
    expect(salesMenuSpecificationLabel(item)).toEqual(['小杯拿铁', '中杯拿铁']);
  });

  it('renders point-order options for ordinary sales items', () => {
    const item = draftItem({
      orderOptions: [
        {
          definitionRef: 'option-definition-1' as never,
          name: '甜度',
          selectionMode: 'SINGLE',
          displayOrder: 0,
          required: true,
          minSelectionCount: 1,
          maxSelectionCount: 1,
          values: [
            {
              definitionValueRef: 'option-value-1' as never,
              name: '少糖',
              displayOrder: 0,
              defaultValue: false,
              extraPrice: 0,
            },
            {
              definitionValueRef: 'option-value-2' as never,
              name: '加糖',
              displayOrder: 1,
              defaultValue: false,
              extraPrice: 200,
            },
          ],
        },
      ],
    });
    expect(salesMenuSpecificationLabel(item)).toBe('甜度：少糖、加糖（加价 ¥2.00）');
  });

  it('renders ordering constraints as separate lines', () => {
    expect(salesMenuConstraintLabel(draftItem())).toEqual(['起售量 1', '订购倍数 1']);
  });

  it('keeps ordering constraints inapplicable for weighted items', () => {
    expect(
      salesMenuConstraintLabel(
        draftItem({
          saleContent: {
            ...draftItem().saleContent,
            kind: 'WEIGHTED',
          },
        }),
      ),
    ).toBe('不适用');
  });
});
