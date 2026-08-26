import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {
  CatalogItemListTable,
  catalogCellBusinessLines,
  catalogItemExpandControl,
  catalogItemRowSelectionCell,
  catalogItemTagLine,
  catalogTableColumnWidths,
  type CatalogTableRow,
} from './CatalogItemListTable';
import type {CatalogItemSummary} from '../model/catalogModel';
import {catalogTestIdControls} from '../catalogTestIds';
import {catalogVoidBlockReason} from './CatalogItemEditorFieldPresentation';
import {catalogLifecycleStatusPresentation} from './CatalogLifecycleStatusTag';

const itemRow = (code: string, hasSkuChildren: boolean): CatalogItemSummary =>
  ({
    itemRef: '00000000-0000-0000-0000-000000000001',
    code,
    name: '拿铁咖啡',
    categoryRef: null,
    categoryPathLabels: ['饮品类', '饮品'],
    hasSkuChildren,
    specificationOrOptionSummary: [],
    attributeSummary: [],
    preparationSummary: [],
    productionTagRef: null,
    tagSummary: ['招牌推荐'],
    tagRefs: [],
    shapeKey: 'SKU_VARIANT_SALE_COUNTED',
    status: 'ENABLED',
    source: 'SELF_MANAGED',
    skuEnabledCount: hasSkuChildren ? 1 : 0,
    skuNonArchivedCount: hasSkuChildren ? 1 : 0,
    skuTotalCount: hasSkuChildren ? 1 : 0,
    skuDimensionSummary: [],
    priceGranularity: 'SKU',
    salesUnit: null,
    baseMeasureUnit: null,
    inventoryDeductionSummary: {grain: 'SKU', mode: null, bomLineCount: null, consumptionUnitSnapshot: null},
    version: 1,
    updatedAt: 0,
  }) as unknown as CatalogItemSummary;

function tableMarkup(item: CatalogItemSummary, skuChildrenByItem: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    <CatalogItemListTable
      tableTestId="catalog-item-table"
      items={[item]}
      skuChildrenByItem={skuChildrenByItem as never}
      skuCacheIdentity="catalog-view"
      selectedRows={[]}
      expandedRows={Object.keys(skuChildrenByItem).length ? [item.code] : []}
      failed={false}
      scopeReady
      noAuthorizedBrand={false}
      loading={false}
      onSelectedRowsChange={() => undefined}
      onTableExpand={() => undefined}
      onOpenDetail={() => undefined}
      loadSkuPage={async () => undefined}
    />,
  );
}

describe('catalog item table cell presentation', () => {
  it('keeps four actual business facts instead of replacing the fourth line with a count', () => {
    const facts = [
      '生产标签：热厨',
      '制作单显示名称：招牌牛肉面',
      '预计制作时长：300 秒',
      '制作说明：先煮面',
      '制作说明：最后加葱',
    ];

    expect(catalogCellBusinessLines(facts)).toEqual([
      '生产标签：热厨',
      '制作单显示名称：招牌牛肉面',
      '预计制作时长：300 秒',
      '制作说明：先煮面',
    ]);
    expect(catalogCellBusinessLines(facts).join('')).not.toContain('还有');
  });

  it('removes empty values before applying the fixed four-line business limit', () => {
    expect(
      catalogCellBusinessLines(['规格：大杯', '', '  ', '点单选项：少冰', '点单选项：加珍珠', '点单选项：换燕麦奶']),
    ).toEqual(['规格：大杯', '点单选项：少冰', '点单选项：加珍珠', '点单选项：换燕麦奶']);
  });

  it('keeps a blank aligned selection cell for every SKU child rather than a disabled checkbox', () => {
    const markup = renderToStaticMarkup(
      <>{catalogItemRowSelectionCell({rowType: 'SKU'} as CatalogTableRow, <input type="checkbox" disabled />)}</>,
    );

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain('checkbox');
  });

  it('keeps the confirmed image scale, compact item column, and an untruncated short single tag', () => {
    expect(catalogTableColumnWidths.item).toBe(240);
    const markup = renderToStaticMarkup(<>{catalogItemTagLine(['招牌推荐'])}</>);
    expect(markup).toContain('招牌推荐');
    expect(markup).toContain('overflow:visible');
    expect(markup).not.toContain('text-overflow:ellipsis');
    expect(markup).not.toContain('50%');
  });

  it('renders an accessible explicit SKU expander instead of relying on an implicit table icon', () => {
    const markup = renderToStaticMarkup(
      <>{catalogItemExpandControl('BEV-LATTE-001', '拿铁咖啡', false, () => undefined)}</>,
    );
    expect(markup).toContain('展开 拿铁咖啡 的规格');
    expect(markup).toContain('catalog-item-expand-');
  });

  it('does not offer an expander for a product without SKU, while a SKU product gets the explicit control', () => {
    const withoutSku = tableMarkup(itemRow('NO-SKU-001', false));
    const withSku = tableMarkup(itemRow('WITH-SKU-001', true));

    expect(withoutSku).not.toContain(catalogTestIdControls.itemTable.itemExpand('NO-SKU-001'));
    expect(withSku).toContain(catalogTestIdControls.itemTable.itemExpand('WITH-SKU-001'));
  });

  it('places the only SKU expander beside the item name and keeps the selection column for batch selection', () => {
    const markup = tableMarkup(itemRow('WITH-SKU-001', true));
    const expanderIndex = markup.indexOf(catalogTestIdControls.itemTable.itemExpand('WITH-SKU-001'));
    const visibleItemNameIndex = markup.lastIndexOf('拿铁咖啡');

    expect(catalogTableColumnWidths).not.toHaveProperty('expand');
    expect(expanderIndex).toBeGreaterThanOrEqual(0);
    expect(expanderIndex).toBeLessThan(visibleItemNameIndex);
  });

  it('uses the same compact visual rhythm for structured first lines and indents SKU children', () => {
    const parentMarkup = tableMarkup(itemRow('WITH-SKU-001', true));
    const sku = {
      productSkuRef: '00000000-0000-0000-0000-000000000002',
      skuCode: 'LATTE-SMALL',
      skuName: '小杯拿铁',
      attributeValueRefs: [],
      standardSalePrice: 2800,
      salesUnit: null,
      baseMeasureUnit: null,
      isDefault: true,
      status: 'ENABLED',
      primaryImageAssetRef: null,
      attributeSummary: [],
      preparationSummary: [],
      inventoryDeductionSummary: {grain: 'SKU', mode: null, bomLineCount: null, consumptionUnitSnapshot: null},
      updatedAt: 0,
    };
    const skuMarkup = tableMarkup(itemRow('WITH-SKU-001', true), {
      'catalog-view:WITH-SKU-001': {rows: [sku], nextCursor: null, loaded: true, loading: false, error: null},
    });

    expect(parentMarkup).toContain('font-size:12px');
    expect(parentMarkup).not.toContain('font-size:14px');
    expect(skuMarkup).toContain('padding-inline-start:24px');
    expect(skuMarkup).toContain('border-inline-start:1px solid #e6f4ff');
  });

  it('uses the owner supplied void reasons instead of falsely calling all blocks generic dependencies', () => {
    expect(
      catalogVoidBlockReason({
        canVoid: false,
        blockingReferences: [],
        dependentFacts: [],
        blockingReasons: [
          {label: '包含规格', count: 3, relatedItemNames: []},
          {label: '已配置库存对象', count: 1, relatedItemNames: []},
        ],
      }),
    ).toBe('包含规格（3项）、已配置库存对象，暂不能作废。');
    expect(
      catalogVoidBlockReason({canVoid: false, blockingReferences: [], dependentFacts: [], blockingReasons: []}),
    ).toBe('作废限制信息暂时无法确认，请刷新后重试。');
  });

  it('presents every lifecycle status consistently and explains a SKU independently from an unenabled item', () => {
    expect(catalogLifecycleStatusPresentation(undefined, 'ITEM', 'DRAFT')).toMatchObject({color: 'default'});
    expect(catalogLifecycleStatusPresentation(undefined, 'ITEM', 'ENABLED')).toMatchObject({color: 'success'});
    expect(catalogLifecycleStatusPresentation(undefined, 'ITEM', 'DISABLED')).toMatchObject({color: 'warning'});
    expect(catalogLifecycleStatusPresentation(undefined, 'ITEM', 'ARCHIVED')).toMatchObject({color: 'processing'});
    expect(catalogLifecycleStatusPresentation(undefined, 'ITEM', 'VOIDED')).toMatchObject({color: 'error'});
    expect(catalogLifecycleStatusPresentation(undefined, 'SKU', 'ENABLED', 'DRAFT').tooltip).toBe(
      '规格状态独立维护；商品尚未启用时不会作为启用商品使用。',
    );
  });

  it('makes a parent draft state visible beside an enabled SKU instead of leaving two apparently conflicting tags', () => {
    const item = {...itemRow('SKU-DRAFT-001', true), status: 'DRAFT'};
    const sku = {
      productSkuRef: '00000000-0000-0000-0000-000000000002',
      skuCode: 'SKU-DRAFT-SMALL',
      skuName: '小杯规格',
      attributeValueRefs: [],
      standardSalePrice: 2800,
      salesUnit: null,
      baseMeasureUnit: null,
      isDefault: false,
      status: 'ENABLED',
      primaryImageAssetRef: null,
      attributeSummary: [],
      preparationSummary: [],
      inventoryDeductionSummary: {grain: 'SKU', mode: null, bomLineCount: null, consumptionUnitSnapshot: null},
      updatedAt: 0,
    };

    const markup = tableMarkup(item, {
      'catalog-view:SKU-DRAFT-001': {rows: [sku], nextCursor: null, loaded: true, loading: false, error: null},
    });

    expect(markup).toContain('商品未启用，规格暂不对外使用');
  });

  it('renders retry and continuation controls as distinct SKU child states', () => {
    const errorMarkup = tableMarkup(itemRow('SKU-ERROR-001', true), {
      'catalog-view:SKU-ERROR-001': {rows: [], nextCursor: null, loaded: false, loading: false, error: 'network'},
    });
    const moreMarkup = tableMarkup(itemRow('SKU-MORE-001', true), {
      'catalog-view:SKU-MORE-001': {
        rows: [],
        nextCursor: 'next-page',
        loaded: true,
        loading: false,
      },
    });

    expect(errorMarkup).toContain('规格明细加载失败');
    expect(errorMarkup).toContain(catalogTestIdControls.itemTable.skuRetry('SKU-ERROR-001'));
    expect(moreMarkup).toContain('继续加载规格');
    expect(moreMarkup).toContain(catalogTestIdControls.itemTable.skuMore('SKU-MORE-001'));
  });
});
