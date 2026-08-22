import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {collectCursorPages, mergeCursorCandidateItems} from '@catering-v2s/admin-ui-foundation';
import type {Uuid} from '../../../app/api/generated/catalog-inventory-edge';
import {catalogInventoryProblemTab} from '../model/catalogModel';
import {
  CatalogInventoryBomWorkbench,
  inventoryRuleOwnerKey,
  inventoryWorkbenchLayout,
  inventoryWorkbenchModeOptions,
  truncateDecimalTowardZero,
} from './CatalogInventoryBomWorkbench';

vi.mock('./useInventoryConsumptionTargetCandidates', () => ({
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
}));

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
) {
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
  } as const;
}

function renderWorkbench(nodes: ReturnType<typeof node>[]) {
  return renderToStaticMarkup(
    <CatalogInventoryBomWorkbench
      shapeKey="STANDARD_SALE_COUNTED"
      nodes={nodes}
      editing
      scopeRef="00000000-0000-4000-8000-000000000001"
      unitOptions={[unit]}
      baseUnitForOwner={() => unit}
      onChange={() => undefined}
      onDirty={() => undefined}
    />,
  );
}

describe('catalog inventory and BOM workbench rules', () => {
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

  it('exposes no entry for a mode that the owner did not allow', () => {
    expect(inventoryWorkbenchModeOptions(['NONE'])).toEqual([{label: '不参与库存', value: 'NONE'}]);
    const markup = renderWorkbench([node('ITEM', 'NONE', ['NONE'])]);
    expect(markup).toContain('不参与库存');
    expect(markup).not.toContain('直接扣当前商品或 SKU');
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

  it('clears the inventory draft when the mounted Drawer closes', () => {
    const source = readFileSync(new URL('./CatalogItemDrawer.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/if \(!itemCode\) \{[\s\S]*setInventoryRulesDraft\(\[\]\);[\s\S]*lifecycle\.reset\(\);/);
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
