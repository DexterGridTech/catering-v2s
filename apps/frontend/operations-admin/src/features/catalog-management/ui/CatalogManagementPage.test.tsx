import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import type {
  CatalogDictionaryView,
  CatalogInventoryEnvelope,
  CatalogShapeManifestView,
  Uuid,
} from '../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {requireOperationsScopeRef} from '../../../app/routing/model';
import {CATALOG_TAB_LABELS, catalogTabLabel} from '../model/catalogTabLabels';
import {copyScopeTabKey} from './LocalCatalogCopyDrawer';
import {
  buildCatalogBatchSaveRequest,
  buildCatalogBatchStatusRequest,
  buildCatalogItemsQuery,
  buildCatalogSkuVoidRequest,
  buildSkuMatrix,
  catalogCategoryCodeExists,
  catalogFilterConflictReason,
  catalogFormValidationIssue,
  catalogPriceLabel,
  catalogSkuIssueCodes,
  catalogTagTreeSelection,
  copyConfirmationLabel,
  copyConfirmationRows,
  decodeBrandCopyReadback,
  decodeCatalogBatchResults,
  decodeCatalogDictionaryLabels,
  decodeCatalogMediaLimits,
  decodeDetail,
  decodeItems,
  decodeNavigation,
  decodePreflight,
  isCatalogBatchRowSelectable,
  mergeCatalogSkuVoidReadback,
  partitionBrandCopyCompatibilityResults,
  productionTagCandidateFromReadback,
  serializeSkuRowsForSave,
  shapeHasVisibleTab,
  shortNameMatchesKeyword,
  shouldHydrateCatalogItemDraft,
  type CatalogBatchResult,
  type CatalogNavigation,
  type CopyPreflight,
} from '../model/catalogModel';
import {CatalogBatchOutcome} from './CatalogBatchOutcome';

const testUuid = (value: string) => value as unknown as Uuid;
const skuUnitDefaults = {
  salesUnitOverrideRef: null,
  baseMeasureUnitOverrideRef: null,
  salesUnit: null,
  baseMeasureUnit: null,
};

const batchRow = (index: number, outcome: CatalogBatchResult['outcome']): CatalogBatchResult => ({
  itemRef: testUuid(`item-${index}`),
  itemCode: `ITEM-${index}`,
  outcome,
  problemCode: outcome === 'FAILED' ? 'VERSION_CONFLICT' : null,
  reason: outcome === 'FAILED' ? '商品版本已变化' : null,
  version: outcome === 'SUCCEEDED' ? index + 1 : null,
});

describe('catalog management runtime model contracts', () => {
  it('keeps the nine tab labels in one frontend source and uses the decided reference label', () => {
    expect(Object.keys(CATALOG_TAB_LABELS).sort()).toEqual(
      [
        'attributes',
        'basic',
        'composite-content',
        'governance',
        'identifiers',
        'inventory-bom',
        'order-options',
        'production-prompts',
        'sku-specifications-pricing',
      ].sort(),
    );
    expect(catalogTabLabel('governance')).toBe('引用关系');
    expect(Object.values(CATALOG_TAB_LABELS)).not.toContain('治理与引用');
  });

  it('does not emit the retired governance filter in any catalog list query', () => {
    const query = buildCatalogItemsQuery({
      dataNodeRef: wireUuid('00000000-0000-4000-8000-000000000001'),
      status: 'ENABLED',
      source: 'SELF_MANAGED',
    });
    expect(query).toEqual({
      dataNodeRef: '00000000-0000-4000-8000-000000000001',
      status: 'ENABLED',
      source: 'SELF_MANAGED',
    });
    expect(query).not.toHaveProperty('governanceStatus');
  });

  it('keeps a selected product tag in the owner-backed item query', () => {
    const selection = catalogTagTreeSelection({
      tagRef: wireUuid('00000000-0000-4000-8000-000000000023'),
      code: 'SIGNATURE',
      name: '招牌商品',
      count: 2,
    });
    expect(selection).toEqual({
      kind: 'TAG',
      ref: '00000000-0000-4000-8000-000000000023',
      label: '招牌商品',
    });
    const query = buildCatalogItemsQuery({
      dataNodeRef: wireUuid('00000000-0000-4000-8000-000000000001'),
      tagRef: selection.ref,
    });
    expect(query).toEqual({
      dataNodeRef: '00000000-0000-4000-8000-000000000001',
      tagRef: '00000000-0000-4000-8000-000000000023',
    });
  });

  it('matches a short name only when the active keyword actually hits it', () => {
    expect(shortNameMatchesKeyword('拿铁', '铁')).toBe(true);
    expect(shortNameMatchesKeyword('拿铁', '茶')).toBe(false);
    expect(shortNameMatchesKeyword('拿铁', undefined)).toBe(false);
  });

  it('explains and blocks only the filters already fixed by the selected smart view', () => {
    expect(catalogFilterConflictReason({kind: 'SMART', ref: 'INACTIVE'}, 'status')).toContain('状态限定');
    expect(catalogFilterConflictReason({kind: 'SMART', ref: 'EXTERNAL_ORDER_TEMP'}, 'source')).toContain('来源限定');
    expect(catalogFilterConflictReason({kind: 'SMART', ref: 'RECENTLY_UPDATED'}, 'status')).toBeUndefined();
    expect(catalogFilterConflictReason({kind: 'CATEGORY', ref: 'category-1'}, 'status')).toBeUndefined();
  });

  it('maps generated form validation failures to the owning editor tab', () => {
    expect(catalogFormValidationIssue({errorFields: [{name: ['displayName'], errors: ['请输入商品名称']}]})).toEqual({
      tabKey: 'basic',
      message: '请输入商品名称',
    });
    expect(catalogFormValidationIssue({errorFields: []})).toBeUndefined();
  });

  it('does not hydrate a dirty draft from a same-item detail refresh', () => {
    expect(
      shouldHydrateCatalogItemDraft({
        initializedItemCode: 'LATTE-001',
        detailItemCode: 'LATTE-001',
        dirty: true,
        forceHydrate: false,
      }),
    ).toBe(false);
    expect(
      shouldHydrateCatalogItemDraft({
        initializedItemCode: 'LATTE-001',
        detailItemCode: 'LATTE-001',
        dirty: false,
        forceHydrate: false,
      }),
    ).toBe(true);
    expect(
      shouldHydrateCatalogItemDraft({
        initializedItemCode: 'LATTE-001',
        detailItemCode: 'LATTE-002',
        dirty: true,
        forceHydrate: false,
      }),
    ).toBe(true);
    expect(
      shouldHydrateCatalogItemDraft({
        initializedItemCode: 'LATTE-001',
        detailItemCode: 'LATTE-001',
        dirty: true,
        forceHydrate: true,
      }),
    ).toBe(true);
  });

  it('merges only the owner-confirmed voided SKU into the local draft', () => {
    const rows = [
      {
        productSkuRef: testUuid('sku-1'),
        skuCode: 'SKU-1',
        skuName: '拿铁',
        displayOrder: 0,
        variantCombinationDigest: 'digest-1',
        attributeValueRefs: [],
        skuBarcode: '',
        standardSalePrice: 1280,
        isDefault: false,
        status: 'ENABLED',
        version: 4,
        ...skuUnitDefaults,
        mediaRefs: [],
      },
      {
        productSkuRef: testUuid('sku-2'),
        skuCode: 'SKU-2',
        skuName: '美式',
        displayOrder: 1,
        variantCombinationDigest: 'digest-2',
        attributeValueRefs: [],
        skuBarcode: '',
        standardSalePrice: 980,
        isDefault: false,
        status: 'ENABLED',
        version: 5,
        ...skuUnitDefaults,
        mediaRefs: [],
      },
    ];
    const merged = mergeCatalogSkuVoidReadback(rows, testUuid('sku-1'), {
      version: 6,
      canVoid: false,
      blockingReferences: [],
      dependentFacts: [],
    });
    expect(merged[0]).toMatchObject({
      productSkuRef: 'sku-1',
      standardSalePrice: 1280,
      status: 'VOIDED',
      version: 6,
      voidAvailability: {canVoid: false},
    });
    expect(merged[1]).toEqual(rows[1]);
  });

  it('fails closed when a write request has no selected data-node scope', () => {
    expect(
      requireOperationsScopeRef({
        groupWorkspaceKey: 'workspace-1',
        expectedContextVersion: 3,
        scopeRef: wireUuid('00000000-0000-4000-8000-000000000001'),
      }),
    ).toBe('00000000-0000-4000-8000-000000000001');
    expect(() => requireOperationsScopeRef({groupWorkspaceKey: 'workspace-1', expectedContextVersion: 3})).toThrow(
      'OPERATIONS_DATA_NODE_SCOPE_REQUIRED',
    );
  });

  it('excludes archived and temporary rows from every batch write snapshot', () => {
    expect(isCatalogBatchRowSelectable({status: 'ENABLED', source: 'SELF_MANAGED'})).toBe(true);
    expect(isCatalogBatchRowSelectable({status: 'ARCHIVED', source: 'SELF_MANAGED'})).toBe(false);
    expect(isCatalogBatchRowSelectable({status: 'ENABLED', source: 'TEMPORARY'})).toBe(false);
  });

  it('builds SKU VOIDED transitions without crossing response-only fields', () => {
    const request = buildCatalogSkuVoidRequest(
      {
        name: '拿铁',
        shapeKey: 'STANDARD_SALE_COUNTED',
        images: [],
        productionTagRefs: [],
        categoryRef: null,
        attributeAssignments: [],
        orderOptionConfigs: [],
        version: 7,
      } as unknown as Parameters<typeof buildCatalogSkuVoidRequest>[0],
      testUuid('node-1'),
      'LATTE-001',
      {productSkuRef: testUuid('sku-1'), version: 3},
    );
    expect(request).toMatchObject({
      dataNodeRef: 'node-1',
      itemCode: 'LATTE-001',
      skuTransitions: [{skuRef: 'sku-1', targetStatus: 'VOIDED', expectedVersion: 3}],
      sections: {expectedCatalogVersion: 7, inventoryRules: {nodes: []}},
    });
    expect(request.sections.catalogDraft).toMatchObject({
      name: '拿铁',
      shapeKey: 'STANDARD_SALE_COUNTED',
      images: [],
      productionTagRefs: [],
      categoryRef: null,
    });
    expect(request.sections.catalogDraft).not.toHaveProperty('skus');
  });

  it('fails closed when a local-copy shape manifest is missing or malformed', () => {
    expect(shapeHasVisibleTab(undefined, 'STANDARD_SALE_COUNTED', 'basic')).toBe(false);
    expect(
      shapeHasVisibleTab(
        {tabRules: {}} as Pick<CatalogShapeManifestView, 'tabRules'>,
        'STANDARD_SALE_COUNTED',
        'basic',
      ),
    ).toBe(false);
    expect(
      shapeHasVisibleTab(
        {tabRules: null} as unknown as Pick<CatalogShapeManifestView, 'tabRules'>,
        'STANDARD_SALE_COUNTED',
        'basic',
      ),
    ).toBe(false);
    expect(
      shapeHasVisibleTab(
        {tabRules: {STANDARD_SALE_COUNTED: {visible: 'basic'}}} as unknown as Pick<
          CatalogShapeManifestView,
          'tabRules'
        >,
        'STANDARD_SALE_COUNTED',
        'basic',
      ),
    ).toBe(false);
    expect(
      shapeHasVisibleTab(
        {tabRules: {STANDARD_SALE_COUNTED: {visible: ['basic']}}} as unknown as Pick<
          CatalogShapeManifestView,
          'tabRules'
        >,
        'STANDARD_SALE_COUNTED',
        'basic',
      ),
    ).toBe(true);
  });

  it('accepts only positive integer media limits from the generated manifest', () => {
    expect(decodeCatalogMediaLimits({typeEffects: {mediaLimits: {maxImageCount: 6, maxImageBytes: 2097152}}})).toEqual({
      maxImageCount: 6,
      maxImageBytes: 2097152,
    });
    expect(
      decodeCatalogMediaLimits({typeEffects: {mediaLimits: {maxImageCount: 0, maxImageBytes: 2097152}}}),
    ).toBeUndefined();
    expect(
      decodeCatalogMediaLimits({typeEffects: {mediaLimits: {maxImageCount: 6, maxImageBytes: '2097152'}}}),
    ).toBeUndefined();
    expect(decodeCatalogMediaLimits(undefined)).toBeUndefined();
  });

  it('checks category codes against the loaded tree without treating the edited node as a duplicate', () => {
    const tree: CatalogNavigation['tree'] = [
      {
        categoryRef: testUuid('category-a'),
        code: 'DRINK',
        name: '饮品',
        parentCategoryRef: null,
        version: 1,
        displayOrder: 0,
        count: 0,
        countSemantics: 'SELF_ONLY',
        deletionAvailability: {canDelete: true, subtreeSize: 1, blockingReferenceCount: 0, blockingReferenceLabels: []},
      },
      {
        categoryRef: testUuid('category-b'),
        code: 'FOOD',
        name: '食品',
        parentCategoryRef: null,
        version: 1,
        displayOrder: 1,
        count: 0,
        countSemantics: 'SELF_ONLY',
        deletionAvailability: {canDelete: true, subtreeSize: 1, blockingReferenceCount: 0, blockingReferenceLabels: []},
      },
    ];
    expect(catalogCategoryCodeExists(tree, 'drink')).toBe(true);
    expect(catalogCategoryCodeExists(tree, ' drink ', testUuid('category-a'))).toBe(false);
    expect(catalogCategoryCodeExists(tree, 'dessert')).toBe(false);
  });

  it('decodes the canonical catalog detail envelope and rejects an unwrapped detail', () => {
    const decoded = decodeDetail({
      data: {
        item: {
          code: 'TEMP-001',
          name: '临时商品',
          source: 'TEMPORARY',
          status: 'ENABLED',
          shapeKey: 'MATERIAL',
          materialRole: 'RAW_MATERIAL',
          lifecycle: {status: 'DISABLED', version: 4, source: 'TEMPORARY'},
          externalIdentity: {
            sourceOrderRef: 'EXT-ORDER-001',
            sourceRecordRef: 'EXT-RECORD-001',
            sourceItemRef: 'EXT-SKU-88',
            snapshot: {name: '外部订单临时拿铁', specification: '中杯 / 热', price: 2800},
          },
        },
        governance: {externalIdentity: null},
      },
    } as CatalogInventoryEnvelope);
    expect(decoded?.item.externalIdentity).toMatchObject({
      sourceOrderRef: 'EXT-ORDER-001',
      sourceRecordRef: 'EXT-RECORD-001',
      sourceItemRef: 'EXT-SKU-88',
      snapshot: {name: '外部订单临时拿铁', specification: '中杯 / 热', price: 2800},
    });
    expect(decoded?.item.lifecycle.status).toBe('DISABLED');
    expect(decoded?.item.materialRole).toBe('RAW_MATERIAL');
    const unwrapped = decodeDetail({
      item: {code: 'LATTE-001', name: '拿铁', source: 'CATALOG', status: 'ENABLED', shapeKey: 'STANDARD_SALE_COUNTED'},
      tabs: [{tabKey: 'basic', visible: true, disabled: false, reason: null}],
    } as CatalogInventoryEnvelope);
    expect(unwrapped).toBeUndefined();
  });

  it('decodes catalog references and range prices without collapsing UUIDs into labels', () => {
    const decoded = decodeItems({
      data: {
        items: [
          {
            itemRef: '00000000-0000-4000-8000-000000000001',
            code: 'LATTE-001',
            name: '拿铁',
            categoryRef: null,
            productionTagRefs: [],
            tagRefs: ['00000000-0000-4000-8000-000000000002'],
            standardSalePrice: null,
            standardSalePriceMin: 2800,
            standardSalePriceMax: 3400,
            priceGranularity: 'SKU',
          },
        ],
      },
    } as CatalogInventoryEnvelope);
    expect(decoded.items[0].tagRefs).toEqual(['00000000-0000-4000-8000-000000000002']);
    expect(catalogPriceLabel(decoded.items[0])).toBe('¥28.00~34.00');
  });

  it('keeps inventory rule configuration and reference fields on detail readback', () => {
    const decoded = decodeDetail({
      data: {
        item: {
          code: 'LATTE-001',
          name: '拿铁',
          source: 'CATALOG',
          status: 'ENABLED',
          shapeKey: 'STANDARD_SALE_COUNTED',
          tagRefs: ['tag-ref'],
          salesUnitRef: 'unit-ref',
          baseMeasureUnitRef: 'base-unit-ref',
        },
        inventoryRules: {
          nodes: [
            {
              owner: {ownerType: 'ITEM', itemRef: 'item-ref', productSkuRef: null, optionValueRef: null},
              itemCode: 'LATTE-001',
              itemName: '拿铁',
              skuCode: null,
              optionValueCode: null,
              allowedModes: ['NONE', 'DIRECT', 'BOM'],
              defaultMode: 'NONE',
              disabledReason: null,
              mode: 'DIRECT',
              directConfiguration: {
                targetRef: 'target-ref',
                allowNegative: true,
                lowStockThreshold: '2',
                consumptionUnitSnapshot: {
                  unitRef: 'unit-ref',
                  code: 'GRAM',
                  name: '克',
                  unitDimension: 'WEIGHT',
                  precision: 0,
                },
                countingUnitSnapshot: {
                  unitRef: 'counting-ref',
                  code: 'KILOGRAM',
                  name: '千克',
                  unitDimension: 'WEIGHT',
                  precision: 4,
                },
                conversionFactor: '12',
                version: 2,
              },
              bom: null,
            },
          ],
        },
        governance: {externalIdentity: null},
      },
    } as CatalogInventoryEnvelope);
    expect(decoded?.item.tagRefs).toEqual(['tag-ref']);
    expect(decoded?.item.salesUnitRef).toBe('unit-ref');
    expect(decoded?.inventoryRules.nodes[0].directConfiguration).toEqual({
      targetRef: 'target-ref',
      allowNegative: true,
      lowStockThreshold: '2',
      consumptionUnitSnapshot: {
        unitRef: 'unit-ref',
        code: 'GRAM',
        name: '克',
        unitDimension: 'WEIGHT',
        precision: 0,
      },
      countingUnitSnapshot: {
        unitRef: 'counting-ref',
        code: 'KILOGRAM',
        name: '千克',
        unitDimension: 'WEIGHT',
        precision: 4,
      },
      conversionFactor: '12',
      version: 2,
    });
  });

  it('decodes dictionary labels by UUID for list reference summaries', () => {
    const labels = decodeCatalogDictionaryLabels({
      data: {entries: [{entryRef: 'tag-ref', name: '口味', status: 'ENABLED'}]},
    } as unknown as CatalogDictionaryView);
    expect(labels).toEqual([{entryRef: 'tag-ref', name: '口味', status: 'ENABLED'}]);
  });

  it('generates the SKU matrix from enabled values while preserving rows by ref-set', () => {
    const existing = {
      productSkuRef: testUuid('sku-red-small'),
      skuCode: 'SKU-001',
      skuName: '手工名称',
      displayOrder: 7,
      variantCombinationDigest: 'server-digest',
      attributeValueRefs: [
        {
          attributeRef: testUuid('attr-size'),
          attributeCode: 'SIZE',
          attributeName: '尺寸',
          attributeValueRef: testUuid('value-small'),
          valueCode: 'S',
          valueLabel: '小',
          displayOrder: 0,
          status: 'ENABLED',
        },
        {
          attributeRef: testUuid('attr-color'),
          attributeCode: 'COLOR',
          attributeName: '颜色',
          attributeValueRef: testUuid('value-red'),
          valueCode: 'RED',
          valueLabel: '红',
          displayOrder: 0,
          status: 'ENABLED',
        },
      ],
      skuBarcode: '690000000001',
      standardSalePrice: 1280,
      isDefault: true,
      status: 'ENABLED',
      version: 4,
      ...skuUnitDefaults,
      mediaRefs: [testUuid('asset-1')],
    };
    const stoppedValueRow = {
      ...existing,
      productSkuRef: testUuid('sku-green-large'),
      skuCode: 'SKU-010',
      skuName: '停用值旧行',
      displayOrder: 8,
      attributeValueRefs: [
        {
          attributeRef: testUuid('attr-color'),
          attributeCode: 'COLOR',
          attributeName: '颜色',
          attributeValueRef: testUuid('value-green'),
          valueCode: 'GREEN',
          valueLabel: '绿',
          displayOrder: 2,
          status: 'DISABLED',
        },
        {
          attributeRef: testUuid('attr-size'),
          attributeCode: 'SIZE',
          attributeName: '尺寸',
          attributeValueRef: testUuid('value-large'),
          valueCode: 'L',
          valueLabel: '大',
          displayOrder: 1,
          status: 'ENABLED',
        },
      ],
      isDefault: false,
    };
    const archivedRow = {
      ...existing,
      productSkuRef: testUuid('sku-archived'),
      skuCode: 'SKU-011',
      skuName: '已归档旧行',
      displayOrder: 9,
      status: 'ARCHIVED',
      isDefault: false,
    };
    const dimensions = [
      {
        attributeRef: testUuid('attr-color'),
        attributeCode: 'COLOR',
        attributeName: '颜色',
        values: [
          {valueRef: testUuid('value-red'), valueCode: 'RED', valueLabel: '红', displayOrder: 0, status: 'ENABLED'},
          {valueRef: testUuid('value-blue'), valueCode: 'BLUE', valueLabel: '蓝', displayOrder: 1, status: 'ENABLED'},
          {
            valueRef: testUuid('value-green'),
            valueCode: 'GREEN',
            valueLabel: '绿',
            displayOrder: 2,
            status: 'DISABLED',
          },
        ],
      },
      {
        attributeRef: testUuid('attr-size'),
        attributeCode: 'SIZE',
        attributeName: '尺寸',
        values: [
          {valueRef: testUuid('value-small'), valueCode: 'S', valueLabel: '小', displayOrder: 0, status: 'ENABLED'},
          {valueRef: testUuid('value-large'), valueCode: 'L', valueLabel: '大', displayOrder: 1, status: 'ENABLED'},
        ],
      },
    ];

    const rows = buildSkuMatrix(dimensions, [existing, stoppedValueRow, archivedRow]);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({
      productSkuRef: 'sku-red-small',
      skuCode: 'SKU-001',
      skuName: '手工名称',
      standardSalePrice: 1280,
      isDefault: true,
      mediaRefs: ['asset-1'],
    });
    const generatedRowsKeepEnabledValues = rows
      .slice(0, 4)
      .every(row => row.attributeValueRefs.every(value => value.attributeValueRef !== 'value-green'));
    expect(generatedRowsKeepEnabledValues).toBe(true);
    expect(rows.slice(4).map(row => row.productSkuRef)).toEqual(['sku-green-large', 'sku-archived']);
    expect(rows[1].skuCode).toBe('SKU-002');
    expect(rows[1].skuName).toBe('红 / 大');
    expect(rows.map(row => row.displayOrder)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('reports every SKU matrix cell issue without treating item pricing as SKU pricing', () => {
    const row = {
      productSkuRef: testUuid(''),
      skuCode: '',
      skuName: '',
      displayOrder: 0,
      variantCombinationDigest: '',
      attributeValueRefs: [],
      skuBarcode: '',
      standardSalePrice: null,
      isDefault: false,
      status: 'ENABLED',
      version: 0,
      ...skuUnitDefaults,
      mediaRefs: [],
    };
    expect(catalogSkuIssueCodes(row, 'SKU', true, true)).toEqual([
      'MISSING_CODE',
      'MISSING_NAME',
      'MISSING_SKU_PRICE',
      'DUPLICATE_COMBINATION',
    ]);
    expect(
      catalogSkuIssueCodes({...row, skuCode: 'SKU-001', skuName: '拿铁', standardSalePrice: null}, 'ITEM', false),
    ).toEqual([]);
    expect(
      catalogSkuIssueCodes({...row, skuCode: 'SKU-001', skuName: '停用 SKU', status: 'DISABLED'}, 'SKU', false),
    ).toEqual([]);
    expect(catalogSkuIssueCodes({...row, skuCode: 'SKU-001', skuName: '重复编码'}, 'ITEM', false, true)).toEqual([
      'DUPLICATE_CODE',
    ]);
  });

  it('keeps every local-copy scope mapped and fails closed when the enum grows', () => {
    expect(
      [
        'BASIC_INFO',
        'SKU_STRUCTURE',
        'SKU_BOM',
        'ITEM_BOM',
        'ORDER_OPTIONS',
        'OPTION_VALUE_BOM',
        'PACKAGE_STRUCTURE',
        'PRODUCTION_PROMPTS',
      ].map(scope => copyScopeTabKey(scope as Parameters<typeof copyScopeTabKey>[0])),
    ).toEqual([
      'basic',
      'sku-specifications-pricing',
      'inventory-bom',
      'inventory-bom',
      'order-options',
      'inventory-bom',
      'composite-content',
      'production-prompts',
    ]);
  });

  it('fails closed when a copy compatibility fact has no stable identity', () => {
    const envelope = {
      data: {
        preflightDigest: 'digest',
        compatibilityResults: [{objectType: 'CATALOG_ITEM', result: 'CREATE', reason: '目标侧新建'}],
      },
    } as CatalogInventoryEnvelope;
    expect(decodePreflight(envelope)).toBeUndefined();
  });

  it('fails closed when copy compatibility facts repeat a stable identity', () => {
    const envelope = {
      data: {
        preflightDigest: 'digest',
        compatibilityResults: [
          {objectType: 'CATALOG_ITEM', compatibilityId: 'catalog:1', result: 'CREATE', reason: '目标侧新建'},
          {objectType: 'CATALOG_ITEM', compatibilityId: 'catalog:1', result: 'REUSE', reason: '目标侧已有'},
        ],
      },
    } as CatalogInventoryEnvelope;
    expect(decodePreflight(envelope)).toBeUndefined();
  });

  it('keeps response-only SKU fields out of the save request and preserves real refs', () => {
    const rows = buildSkuMatrix(
      [],
      [
        {
          productSkuRef: testUuid('sku-existing'),
          skuCode: 'SKU-001',
          skuName: '已存在',
          displayOrder: 0,
          variantCombinationDigest: 'digest',
          attributeValueRefs: [],
          skuBarcode: '',
          standardSalePrice: 100,
          isDefault: false,
          status: 'ENABLED',
          version: 8,
          ...skuUnitDefaults,
          mediaRefs: [],
        },
        {
          productSkuRef: testUuid(''),
          skuCode: 'SKU-002',
          skuName: '新行',
          displayOrder: 1,
          variantCombinationDigest: '',
          attributeValueRefs: [],
          skuBarcode: '',
          standardSalePrice: null,
          isDefault: false,
          status: 'ENABLED',
          version: 0,
          ...skuUnitDefaults,
          mediaRefs: [],
        },
      ],
    );
    const requestRows = serializeSkuRowsForSave(rows);
    expect(requestRows[0]).toMatchObject({productSkuRef: 'sku-existing', skuCode: 'SKU-001'});
    expect(requestRows[0]).not.toHaveProperty('variantCombinationDigest');
    expect(requestRows[0]).not.toHaveProperty('version');
    expect(requestRows[1]).not.toHaveProperty('productSkuRef');
  });

  it('keeps production-tag quick-create identity as tagRef and fails closed without it', () => {
    const candidate = productionTagCandidateFromReadback(
      {tagRef: 'tag-ref', code: 'HOT', name: '热', status: 'ENABLED'},
      {code: 'HOT', name: '热', tagKind: 'PRODUCTION'},
    );
    expect(candidate).toMatchObject({tagRef: 'tag-ref', code: 'HOT', name: '热', owner: 'fulfillment-production'});
    expect(
      productionTagCandidateFromReadback({code: 'HOT', name: '热'}, {code: 'HOT', name: '热', tagKind: 'PRODUCTION'}),
    ).toBeUndefined();
  });

  it('builds a category batch save from list facts with a relation-only draft', () => {
    const row = {
      code: 'LATTE-001',
      version: 7,
      categoryRef: testUuid('old-category'),
      tagRefs: [testUuid('tag-1')],
    };
    const request = buildCatalogBatchSaveRequest(row, testUuid('node-1'), 'CATEGORY', [testUuid('new-category')]);
    expect(request).toMatchObject({
      dataNodeRef: 'node-1',
      itemCode: 'LATTE-001',
      sections: {expectedCatalogVersion: 7, inventoryRules: {nodes: []}},
    });
    expect(request.sections.catalogDraft).toEqual({categoryRef: 'new-category'});
    expect(request.sections.catalogDraft).not.toHaveProperty('name');
    expect(request.sections.catalogDraft).not.toHaveProperty('images');
    expect(request.sections.catalogDraft).not.toHaveProperty('tagRefs');
    expect(request.sections.inventoryRules).toEqual({nodes: []});
  });

  it('builds a tag batch save without copying the row category relationship', () => {
    const row = {
      code: 'LATTE-002',
      version: 3,
      categoryRef: testUuid('category-1'),
      tagRefs: [testUuid('old-tag')],
    };
    const request = buildCatalogBatchSaveRequest(row, testUuid('node-2'), 'TAG', [testUuid('new-tag')]);
    expect(request.sections.expectedCatalogVersion).toBe(3);
    expect(request.sections.catalogDraft).toEqual({tagRefs: ['new-tag']});
    expect(request.sections.catalogDraft).not.toHaveProperty('categoryRef');
  });

  it('strictly decodes ordered batch outcomes with the owner item code and reason', () => {
    const rows = [
      {itemRef: testUuid('00000000-0000-4000-8000-000000000001'), code: 'A', version: 4},
      {itemRef: testUuid('00000000-0000-4000-8000-000000000002'), code: 'B', version: 9},
    ];
    expect(buildCatalogBatchStatusRequest(testUuid('node-1'), 'ARCHIVED', rows)).toEqual({
      dataNodeRef: 'node-1',
      targetStatus: 'ARCHIVED',
      items: [
        {itemRef: '00000000-0000-4000-8000-000000000001', expectedVersion: 4},
        {itemRef: '00000000-0000-4000-8000-000000000002', expectedVersion: 9},
      ],
    });
    const results = decodeCatalogBatchResults(
      {
        revision: 'r',
        requestId: 'q',
        results: [
          {
            itemRef: '00000000-0000-4000-8000-000000000001',
            itemCode: 'A',
            outcome: 'SUCCEEDED',
            problemCode: null,
            reason: null,
            version: 5,
          },
          {
            itemRef: '00000000-0000-4000-8000-000000000002',
            itemCode: 'B',
            outcome: 'FAILED',
            problemCode: 'VERSION_CONFLICT',
            reason: '商品版本已变化',
            version: null,
          },
        ],
      } as never,
      rows.map(row => row.itemRef),
    );
    expect(results).toEqual([
      {
        itemRef: rows[0].itemRef,
        itemCode: 'A',
        outcome: 'SUCCEEDED',
        problemCode: null,
        reason: null,
        version: 5,
      },
      {
        itemRef: rows[1].itemRef,
        itemCode: 'B',
        outcome: 'FAILED',
        problemCode: 'VERSION_CONFLICT',
        reason: '商品版本已变化',
        version: null,
      },
    ]);
  });

  it('fails closed when the owner response is nested or reordered', () => {
    const refs = [testUuid('00000000-0000-4000-8000-000000000001'), testUuid('00000000-0000-4000-8000-000000000002')];
    expect(() => decodeCatalogBatchResults({data: {results: []}} as never, refs)).toThrow(
      'CATALOG_BATCH_RESULT_PROTOCOL_INVALID',
    );
    expect(() =>
      decodeCatalogBatchResults(
        {
          revision: 'r',
          requestId: 'q',
          results: [
            {
              itemRef: refs[1],
              itemCode: 'B',
              outcome: 'FAILED',
              problemCode: 'VERSION_CONFLICT',
              reason: 'stale',
              version: null,
            },
            {itemRef: refs[0], itemCode: 'A', outcome: 'SUCCEEDED', problemCode: null, reason: null, version: 5},
          ],
        } as never,
        refs,
      ),
    ).toThrow('CATALOG_BATCH_RESULT_PROTOCOL_INVALID');
  });

  it('renders the approved full-success result layer and close affordance', () => {
    const markup = renderToStaticMarkup(
      <CatalogBatchOutcome results={[batchRow(1, 'SUCCEEDED'), batchRow(2, 'SUCCEEDED')]} onClose={() => undefined} />,
    );
    expect(markup).toContain('批量操作完成');
    expect(markup).toContain('成功 2 项，失败 0 项');
    expect(markup).toContain('data-testid="catalog-batch-outcome-summary"');
    expect(markup).toContain('data-testid="catalog-batch-outcome-close"');
    expect(markup).not.toContain('catalog-batch-outcome-failures');
  });

  it('renders partial failures with the approved heading and table columns', () => {
    const markup = renderToStaticMarkup(
      <CatalogBatchOutcome results={[batchRow(1, 'SUCCEEDED'), batchRow(2, 'FAILED')]} onClose={() => undefined} />,
    );
    expect(markup).toContain('成功 1 项，失败 1 项');
    expect(markup).toContain('以下 1 个商品未处理成功');
    expect(markup).toContain('商品编码');
    expect(markup).toContain('失败原因');
    expect(markup).toContain('data-testid="catalog-batch-outcome-failures"');
  });

  it('keeps the 100-item failure result inside the bounded scroll container', () => {
    const markup = renderToStaticMarkup(
      <CatalogBatchOutcome
        results={Array.from({length: 100}, (_, index) => batchRow(index + 1, 'FAILED'))}
        onClose={() => undefined}
      />,
    );
    expect(markup).toContain('max-height:50vh');
    expect(markup).toContain('overflow-y:auto');
    expect(markup).toContain('以下 100 个商品未处理成功');
  });

  it('does not fabricate a result layer for an empty or protocol-invalid receipt', () => {
    expect(renderToStaticMarkup(<CatalogBatchOutcome results={[]} onClose={() => undefined} />)).toBe('');
  });

  it('keeps a list refresh failure visible without changing the authoritative receipt', () => {
    const markup = renderToStaticMarkup(
      <CatalogBatchOutcome
        results={[batchRow(1, 'SUCCEEDED')]}
        refreshProblem="列表刷新失败，请手动刷新"
        onClose={() => undefined}
      />,
    );
    expect(markup).toContain('批量操作完成');
    expect(markup).toContain('列表刷新失败，请手动刷新');
    expect(markup).toContain('成功 1 项，失败 0 项');
  });

  it('does not expose itemRef, problemCode, version, or raw exception as user fields', () => {
    const result: CatalogBatchResult = {
      ...batchRow(1, 'FAILED'),
      itemRef: testUuid('hidden-item-ref'),
      problemCode: 'INTERNAL_PROBLEM_CODE',
      version: 42,
      reason: '已脱敏的业务失败原因',
    };
    const markup = renderToStaticMarkup(<CatalogBatchOutcome results={[result]} onClose={() => undefined} />);
    expect(markup).toContain('已脱敏的业务失败原因');
    expect(markup).not.toContain('hidden-item-ref');
    expect(markup).not.toContain('INTERNAL_PROBLEM_CODE');
    expect(markup).not.toContain('>42<');
    expect(markup).not.toContain('raw exception');
  });

  it('keeps brand-copy reference readbacks label-only after decoding', () => {
    const preflight = decodePreflight({
      data: {
        preflightDigest: 'digest',
        selectedCount: 1,
        selectedLimit: 20,
        closureCount: 1,
        closureLimit: 500,
        blockingCount: 0,
        confirmationRequiredCount: 0,
        selectedItems: [],
        closureItems: [],
        objectVersions: [],
        compatibilityResults: [],
        referenceMappings: [
          {
            objectType: 'OPTION_VALUE_BOM',
            sourceRef: '11111111-1111-1111-1111-111111111111',
            targetRef: '22222222-2222-2222-2222-222222222222',
            targetCode: 'LATTE-001',
            targetSkuCode: 'LATTE-001-L',
            targetOptionValueCode: 'HOT',
          },
        ],
      },
    } as CatalogInventoryEnvelope);
    expect(preflight?.referenceMappings).toEqual([
      {
        objectType: 'OPTION_VALUE_BOM',
        targetCode: 'LATTE-001',
        targetSkuCode: 'LATTE-001-L',
        targetOptionValueCode: 'HOT',
      },
    ]);

    const readback = decodeBrandCopyReadback({
      data: {
        preflightDigest: 'digest',
        created: [],
        reused: [],
        targetVersions: [{targetRef: '33333333-3333-3333-3333-333333333333', version: 2}],
        ownerReadbacks: [],
        referenceMappings: [
          {
            objectType: 'SKU_BOM',
            sourceRef: '44444444-4444-4444-4444-444444444444',
            targetRef: '55555555-5555-5555-5555-555555555555',
            targetCode: 'LATTE-001',
            targetSkuCode: 'LATTE-001-L',
            targetOptionValueCode: null,
          },
        ],
      },
    } as CatalogInventoryEnvelope);
    expect(readback?.referenceMappings).toEqual([
      {objectType: 'SKU_BOM', targetCode: 'LATTE-001', targetSkuCode: 'LATTE-001-L'},
    ]);
    expect(readback?.targetVersions).toEqual([{version: 2}]);
  });

  it('does not hide unclassified brand-copy compatibility facts', () => {
    const buckets = partitionBrandCopyCompatibilityResults([
      {objectType: 'STOCK_TARGET', compatibilityId: 'stock:1', result: 'REUSE', reason: '库存对象可复用'},
      {objectType: 'PRODUCTION_TAG', compatibilityId: 'production:1', result: 'SKIPPED', reason: '生产标签缺失'},
      {objectType: 'CATALOG_ITEM', compatibilityId: 'catalog:1', result: 'BLOCKED', reason: '商品关系需人工确认'},
    ]);
    expect(buckets.inventory).toHaveLength(1);
    expect(buckets.production).toHaveLength(1);
    expect(buckets.other).toEqual([
      {objectType: 'CATALOG_ITEM', compatibilityId: 'catalog:1', result: 'BLOCKED', reason: '商品关系需人工确认'},
    ]);
  });

  it('requires one confirmation for every non-blocked copy result without collapsing duplicates', () => {
    const rows: CopyPreflight['compatibilityResults'] = [
      {objectType: 'STOCK_TARGET', compatibilityId: 'stock:1', result: 'REUSE', reason: '库存对象可复用'},
      {objectType: 'STOCK_TARGET', compatibilityId: 'stock:2', result: 'REUSE', reason: '库存对象可复用'},
      {objectType: 'CATALOG_ITEM', compatibilityId: 'catalog:1', result: 'CREATE', reason: '目标侧新建'},
      {
        objectType: 'SKU_ATTRIBUTE_VALUE',
        compatibilityId: 'attribute:1',
        result: 'CONFIRMABLE_REUSE',
        reason: '需要确认复用',
      },
      {objectType: 'PRODUCTION_TAG', compatibilityId: 'production:1', result: 'BLOCKED', reason: '生产标签冲突'},
      {objectType: 'UNKNOWN', compatibilityId: 'unknown:1', result: 'FUTURE_RESULT', reason: '未登记结果'},
    ];
    const confirmations = copyConfirmationRows(rows);
    expect(confirmations).toHaveLength(5);
    expect(new Set(confirmations.map(({key}) => key)).size).toBe(5);
    expect(confirmations.map(({row}) => row.result)).toEqual([
      'REUSE',
      'REUSE',
      'CREATE',
      'CONFIRMABLE_REUSE',
      'FUTURE_RESULT',
    ]);
    expect(copyConfirmationLabel('CREATE')).toBe('确认新建');
    expect(copyConfirmationLabel('REUSE')).toBe('确认复用');
    expect(copyConfirmationLabel('CONFIRMABLE_REUSE')).toBe('确认复用');
    expect(copyConfirmationLabel('FUTURE_RESULT')).toBe('确认此处理');
    expect(copyConfirmationRows([rows[2], rows[0]]).map(({key}) => key)).toEqual(['catalog:1', 'stock:1']);
    expect(copyConfirmationRows([{...rows[0], compatibilityId: ''}])).toEqual([]);
  });

  it('decodes category navigation from the canonical envelope', () => {
    const envelope = {
      data: {
        allCount: 8,
        tree: [
          {
            categoryRef: 'a0f5f2c9-3e80-4e10-9ecf-a6d8186dfd49',
            code: 'CAT-ROOT',
            name: '根类',
            parentCategoryRef: null,
            version: 3,
            displayOrder: 0,
            count: 2,
            countSemantics: 'SELF_ONLY',
            deletionAvailability: {
              canDelete: false,
              subtreeSize: 2,
              blockingReferenceCount: 1,
              blockingReferenceLabels: ['烤鸡翅(APP-CHICKEN-WINGS-001)'],
            },
          },
        ],
        smartViews: [],
        shapeCounts: [
          {shapeKey: 'STANDARD_SALE_COUNTED', count: 1},
          {shapeKey: 'MATERIAL', count: 2},
        ],
        tags: [
          {
            tagRef: 'd3cdd2f7-8d0e-4cff-9dbe-f1b8a5a82672',
            code: 'SIGNATURE',
            name: '招牌商品',
            count: 3,
          },
        ],
        generation: 7,
      },
    } as CatalogInventoryEnvelope;
    const navigation = decodeNavigation(envelope);
    const node = navigation.tree[0];
    expect(navigation.allCount).toBe(8);
    expect(node.parentCategoryRef).toBeNull();
    expect(node).toMatchObject({
      categoryRef: 'a0f5f2c9-3e80-4e10-9ecf-a6d8186dfd49',
      name: '根类',
      version: 3,
      displayOrder: 0,
      countSemantics: 'SELF_ONLY',
      deletionAvailability: {
        canDelete: false,
        subtreeSize: 2,
        blockingReferenceCount: 1,
        blockingReferenceLabels: ['烤鸡翅(APP-CHICKEN-WINGS-001)'],
      },
    });
    expect(navigation.tags).toEqual([
      {
        tagRef: 'd3cdd2f7-8d0e-4cff-9dbe-f1b8a5a82672',
        code: 'SIGNATURE',
        name: '招牌商品',
        count: 3,
      },
    ]);
  });
});
