import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {collectCursorPages, mergeCursorCandidateItems} from '@catering-v2s/admin-ui-foundation';
import {isCurrentOwnerConsumptionTarget} from './useInventoryConsumptionTargetCandidates';
import type {Uuid} from '../../../app/api/generated/catalog-inventory-edge';
import {catalogInventoryProblemTab, type CatalogDetail, type CatalogInventoryRuleNode} from '../model/catalogModel';
import {
  CatalogInventoryBomWorkbench,
  inventoryWorkbenchLayout,
  inventoryWorkbenchModeOptions,
  truncateDecimalTowardZero,
} from './CatalogInventoryBomWorkbench';
import {CatalogInventoryBomView} from './CatalogInventoryBomView';
import {inventoryRuleOwnerKey} from './CatalogInventoryRuleOwnerNavigation';

vi.mock('./useInventoryConsumptionTargetCandidates', async importOriginal => {
  const actual = await importOriginal<typeof import('./useInventoryConsumptionTargetCandidates')>();
  return {
    ...actual,
    useInventoryConsumptionTargetCandidates: () => ({
      keyword: '',
      setKeyword: () => undefined,
      items: [],
      total: 0,
      loading: false,
      error: undefined,
      hasNext: false,
      loadNext: () => undefined,
      onPopupScroll: () => undefined,
      retry: async () => undefined,
    }),
  };
});

const uuid = (value: string) => value as Uuid;
const unit = {
  unitRef: uuid('unit-1'),
  code: 'KG',
  name: '千克',
  unitDimension: 'WEIGHT' as const,
  precision: 3,
  status: 'ENABLED' as const,
  isReferenced: false,
  version: 1,
};

function node(
  ownerType: 'ITEM' | 'SKU' | 'OPTION_VALUE',
  mode: 'NONE' | 'DIRECT' | 'BOM' = 'NONE',
  allowedModes: Array<'NONE' | 'DIRECT' | 'BOM'> = ownerType === 'OPTION_VALUE'
    ? ['NONE', 'BOM']
    : ['NONE', 'DIRECT', 'BOM'],
): CatalogInventoryRuleNode {
  return {
    owner: {
      ownerType,
      itemRef: uuid('item-1'),
      productSkuRef: ownerType === 'SKU' ? uuid('sku-1') : null,
      optionValueRef: ownerType === 'OPTION_VALUE' ? uuid('value-1') : null,
    },
    itemCode: 'ITEM-1',
    itemName: '当前商品',
    skuCode: ownerType === 'SKU' ? 'SKU-1' : null,
    optionValueCode: ownerType === 'OPTION_VALUE' ? 'VALUE-1' : null,
    allowedModes,
    defaultMode: 'NONE',
    disabledReason: null,
    mode,
    directConfiguration: null,
    bom: mode === 'BOM' ? {version: null, lines: []} : null,
  };
}

const detail = {
  item: {
    name: '当前商品',
    skus: [{productSkuRef: uuid('sku-1'), skuCode: 'SKU-1', skuName: '小杯当前商品'}],
    orderOptionConfigs: [
      {
        name: '加料',
        values: [{definitionValueRef: uuid('value-1'), name: '加珍珠'}],
      },
    ],
  },
} as Pick<CatalogDetail, 'item'>;

function renderWorkbench(nodes: ReturnType<typeof node>[], editing = true) {
  return renderToStaticMarkup(
    <CatalogInventoryBomWorkbench
      shapeKey="STANDARD_SALE_COUNTED"
      detail={detail}
      nodes={nodes}
      editing={editing}
      scopeRef="00000000-0000-4000-8000-000000000001"
      unitOptions={[unit]}
      createDraftRowId={prefix => `${prefix}-test`}
      baseUnitForOwner={() => unit}
      onChange={() => undefined}
      onDirty={() => undefined}
    />,
  );
}

function renderView(nodes: ReturnType<typeof node>[]) {
  return renderToStaticMarkup(<CatalogInventoryBomView detail={detail} nodes={nodes} baseUnitForOwner={() => unit} />);
}

describe('catalog inventory and BOM workbench rules', () => {
  it('does not offer the stock target belonging to the BOM owner, while preserving distinct SKU targets', () => {
    const owner = {itemRef: 'item-1', productSkuRef: 'sku-1'};
    expect(
      isCurrentOwnerConsumptionTarget(
        {targetRef: 'target-1', itemRef: 'item-1', productSkuRef: 'sku-1'} as Parameters<
          typeof isCurrentOwnerConsumptionTarget
        >[0],
        owner,
      ),
    ).toBe(true);
    expect(
      isCurrentOwnerConsumptionTarget(
        {targetRef: 'target-2', itemRef: 'item-1', productSkuRef: 'sku-2'} as Parameters<
          typeof isCurrentOwnerConsumptionTarget
        >[0],
        owner,
      ),
    ).toBe(false);
  });

  it('truncates source quantities toward zero at the declared unit precision', () => {
    expect(truncateDecimalTowardZero('0.3567', 3)).toBe('0.356');
    expect(truncateDecimalTowardZero('0.3567', 0)).toBe('0');
    expect(truncateDecimalTowardZero('-0.3567', 3)).toBe('-0.356');
    expect(truncateDecimalTowardZero('0.29', 2)).toBe('0.29');
    expect(truncateDecimalTowardZero('not-a-number', 2)).toBe('not-a-number');
  });

  it('keeps item, SKU, and option-value owners distinct even when refs overlap', () => {
    const item = {
      owner: {ownerType: 'ITEM', itemRef: uuid('item-1'), productSkuRef: null, optionValueRef: null},
    } as const;
    const sku = {
      owner: {ownerType: 'SKU', itemRef: uuid('item-1'), productSkuRef: uuid('sku-1'), optionValueRef: null},
    } as const;
    const option = {
      owner: {ownerType: 'OPTION_VALUE', itemRef: uuid('item-1'), productSkuRef: null, optionValueRef: uuid('value-1')},
    } as const;

    expect(new Set([inventoryRuleOwnerKey(item), inventoryRuleOwnerKey(sku), inventoryRuleOwnerKey(option)]).size).toBe(
      3,
    );
    expect(inventoryRuleOwnerKey(item)).toBe('ITEM:item-1::');
    expect(inventoryRuleOwnerKey(sku)).toBe('SKU:item-1:sku-1:');
    expect(inventoryRuleOwnerKey(option)).toBe('OPTION_VALUE:item-1::value-1');
  });

  it('renders empty, single-node, and tree-plus-detail layout branches', () => {
    expect(inventoryWorkbenchLayout(0)).toBe('EMPTY');
    expect(inventoryWorkbenchLayout(1)).toBe('SINGLE_DETAIL');
    expect(inventoryWorkbenchLayout(2)).toBe('TREE_DETAIL');

    expect(renderWorkbench([])).toContain('data-testid="catalog-inventory-owner-empty"');
    expect(renderWorkbench([node('ITEM')])).toContain('data-testid="catalog-inventory-owner-current"');
    expect(renderWorkbench([node('ITEM'), node('SKU')])).toContain('data-testid="catalog-inventory-owner-tree"');
  });

  it('uses one business-name navigation in view and edit contexts instead of primary action buttons', () => {
    const nodes = [node('ITEM'), node('SKU', 'BOM'), node('OPTION_VALUE', 'BOM')];
    for (const markup of [renderWorkbench(nodes), renderView(nodes)]) {
      expect(markup).toContain('选择要配置的对象');
      expect(markup).toContain('商品和每个规格可以分别设置库存扣减方式。');
      expect(markup).toContain('规格</span>');
      expect(markup).toContain('当前商品');
      expect(markup).toContain('小杯当前商品');
      expect(markup).toContain('按 BOM 扣组件');
      expect(markup).not.toContain('SKU-1 · 按 BOM 扣组件');
      expect(markup).not.toContain('SKU-1</span>');
      expect(markup).toContain('加珍珠');
      expect(markup).toContain('点单选项');
      expect(markup).toContain('aria-current="page"');
      expect(markup).toContain('border-inline-start:3px solid');
      expect(markup).not.toContain('ant-btn-primary');
    }
  });

  it('keeps configuration-object switching outside the whole-save draft mutation paths', () => {
    const navigation = readFileSync(new URL('./CatalogInventoryRuleOwnerNavigation.tsx', import.meta.url), 'utf8');
    expect(navigation).toContain('onClick={() => onSelect(key)}');
    expect(navigation).not.toContain('onChange(');
    expect(navigation).not.toContain('onDirty(');
  });

  it('renders read-only inventory facts as business content instead of disabled form controls', () => {
    const direct = node('ITEM', 'DIRECT');
    const directMarkup = renderWorkbench([direct], false);
    expect(directMarkup).toContain('销售/使用时怎么扣库存');
    expect(directMarkup).toContain('库存消费单位');
    expect(directMarkup).not.toContain('ant-input');
    expect(directMarkup).not.toContain('ant-select');
    expect(directMarkup).not.toContain('ant-radio');
    expect(directMarkup).not.toContain('ant-switch');

    const bom = node('ITEM', 'BOM');
    bom.bom!.lines.push({
      targetRef: uuid('material-1'),
      itemRef: uuid('material-1'),
      productSkuRef: null,
      itemCode: 'MATERIAL-1',
      skuCode: null,
      itemName: '鸡胸肉',
      skuName: null,
      lineSign: 'POSITIVE',
      quantity: '160',
      consumptionUnitSnapshot: unit,
    });
    const bomMarkup = renderWorkbench([bom], false);
    expect(bomMarkup).toContain('物料耗用明细');
    expect(bomMarkup).toContain('鸡胸肉');
    expect(bomMarkup).toContain('消费单位');
    expect(bomMarkup).not.toContain('ant-input');
    expect(bomMarkup).not.toContain('ant-select');
    expect(bomMarkup).not.toContain('ant-radio');
    expect(bomMarkup).not.toContain('ant-switch');
  });

  it('keeps a saved BOM selection identifiable by its business name without inventing a saved-state label', () => {
    const bom = node('SKU', 'BOM');
    bom.bom!.lines.push({
      targetRef: uuid('material-1'),
      itemRef: uuid('material-1'),
      productSkuRef: null,
      itemCode: 'MAT-COFFEE-BEAN-001',
      skuCode: null,
      itemName: '咖啡豆',
      skuName: null,
      lineSign: 'POSITIVE',
      quantity: '18',
      consumptionUnitSnapshot: unit,
    });

    const markup = renderWorkbench([bom]);
    expect(markup).toContain('咖啡豆');
    expect(markup).not.toContain('（已保存）');
  });

  it('distinguishes a new empty BOM line from a saved target whose business name is missing', () => {
    const bom = node('SKU', 'BOM');
    bom.bom!.lines.push({
      targetRef: '' as Uuid,
      itemRef: '' as Uuid,
      productSkuRef: null,
      itemCode: '',
      skuCode: null,
      itemName: '',
      skuName: null,
      lineSign: 'POSITIVE',
      quantity: '',
      consumptionUnitSnapshot: unit,
    });

    const markup = renderWorkbench([bom]);
    expect(markup).toContain('新增耗用项');
    expect(markup).not.toContain('耗用商品名称暂时无法读取');
  });

  it('never presents a historical code copied into a BOM name field as the product name', () => {
    const bom = node('SKU', 'BOM');
    bom.bom!.lines.push({
      targetRef: uuid('material-1'),
      itemRef: uuid('material-1'),
      productSkuRef: null,
      itemCode: 'MAT-COFFEE-BEAN-001',
      skuCode: null,
      itemName: 'MAT-COFFEE-BEAN-001',
      skuName: null,
      lineSign: 'POSITIVE',
      quantity: '18',
      consumptionUnitSnapshot: unit,
    });

    const markup = renderWorkbench([bom]);
    expect(markup).toContain('耗用商品名称暂时无法读取');
    expect(markup).not.toContain('MAT-COFFEE-BEAN-001（已保存）');
  });

  it('exposes no entry for a mode that the owner did not allow', () => {
    expect(inventoryWorkbenchModeOptions(['NONE'])).toEqual([{label: '不参与库存', value: 'NONE'}]);
    const markup = renderWorkbench([node('ITEM', 'NONE', ['NONE'])]);
    expect(markup).toContain('不参与库存');
    expect(markup).not.toContain('直接扣当前商品或规格');
  });

  it('keeps cursor-backed component candidates across two pages without duplicates', async () => {
    const calls: Array<string | undefined> = [];
    const pages = new Map<string | undefined, {items: Array<{id: string}>; nextCursor?: string}>([
      [undefined, {items: [{id: 'target-1'}, {id: 'target-2'}], nextCursor: 'cursor-2'}],
      ['cursor-2', {items: [{id: 'target-2'}, {id: 'target-3'}]}],
    ]);
    await expect(
      collectCursorPages<{id: string}>({
        pageSize: 2,
        keyOf: item => item.id,
        readPage: async (cursor, pageSize) => {
          expect(pageSize).toBe(2);
          calls.push(cursor);
          const page = pages.get(cursor);
          if (!page) throw new Error('missing candidate page');
          return {...page, total: 3};
        },
      }),
    ).resolves.toMatchObject({items: [{id: 'target-1'}, {id: 'target-2'}, {id: 'target-3'}], pageCount: 2});
    expect(calls).toEqual([undefined, 'cursor-2']);
    expect(
      mergeCursorCandidateItems(
        [{id: 'target-1'}, {id: 'target-2'}],
        [{id: 'target-2'}, {id: 'target-3'}],
        item => item.id,
      ),
    ).toEqual([{id: 'target-1'}, {id: 'target-2'}, {id: 'target-3'}]);
  });

  it('locates typed inventory problems at the owning inventory tab', () => {
    expect(catalogInventoryProblemTab('INVENTORY_BOM_EMPTY')).toBe('inventory-bom');
    expect(catalogInventoryProblemTab('CONSUMPTION_UNIT_INCOMPATIBLE')).toBe('inventory-bom');
    expect(catalogInventoryProblemTab('CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED')).toBe('basic');
  });

  it('clears the complete editor draft, including inventory rules, when the mounted Drawer closes', () => {
    const source = readFileSync(new URL('./useCatalogItemEditorWorkspaceState.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(
      /if \(!itemCode\) \{[\s\S]*replaceDraft\(emptyCatalogItemDraftSnapshot\(\)\);[\s\S]*resetLifecycle\(\);/,
    );
    expect(source).toContain("setDraftField('inventoryRulesDraft', next)");
  });

  it('invalidates only the item detail and affected candidate identities after save', () => {
    const policy = JSON.parse(
      readFileSync(
        new URL('../../../../../../../contracts/catalog/catalog-inventory-rtk-tag-policy.json', import.meta.url),
        'utf8',
      ),
    ) as {operations: Array<{operationId: string; invalidates: Array<{kind: string; id?: string; prefix?: string}>}>};
    const save = policy.operations.find(operation => operation.operationId === 'saveOperationsCatalogItem');
    expect(save?.invalidates).toEqual([
      {kind: 'static', id: 'catalog-workbench'},
      {kind: 'static', id: 'catalog-navigation'},
      {kind: 'static', id: 'catalog-item-page'},
      {kind: 'requestPath', prefix: 'catalog-item-code', path: 'itemCode'},
      {kind: 'static', id: 'local-copy-candidates'},
      {kind: 'static', id: 'brand-copy-candidates'},
      {kind: 'static', id: 'inventory-target-page'},
      {kind: 'static', id: 'inventory-rule-definition'},
    ]);
  });
});
