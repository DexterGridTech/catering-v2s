import {describe, expect, it} from 'vitest';
import type {
  CatalogDictionaryView,
  CatalogInventoryEnvelope,
  CatalogShapeManifestView,
  Uuid,
} from '../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {requireOperationsScopeRef} from '../../../app/routing/model';
import {canMoveDictionaryRow} from '../model/dictionaryOrdering';
import {CATALOG_TAB_LABELS, catalogTabLabel} from '../model/catalogTabLabels';
import {copyScopeTabKey} from './LocalCatalogCopyDrawer';
import {
  alignCatalogBatchResults,
  attributeDraftRowsFromRecord,
  buildCatalogBatchSaveRequest,
  buildCatalogBatchStatusRequest,
  buildCatalogItemsQuery,
  buildCatalogSkuVoidRequest,
  buildSkuMatrix,
  catalogCategoryCodeExists,
  catalogDictionaryCodeConflict,
  catalogFilterConflictReason,
  catalogFormValidationIssue,
  catalogPriceLabel,
  catalogSkuIssueCodes,
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
  duplicateCatalogAttributeKeys,
  isCatalogBatchRowSelectable,
  mergeCatalogSkuVoidReadback,
  partitionBrandCopyCompatibilityResults,
  productionTagCandidateFromReadback,
  serializeCatalogAttributeDraftRows,
  serializeSkuRowsForSave,
  shapeHasVisibleTab,
  shortNameMatchesKeyword,
  shouldHydrateCatalogItemDraft,
  type CatalogNavigation,
  type CopyPreflight,
} from '../model/catalogModel';

const testUuid = (value: string) => value as unknown as Uuid;

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
    expect(
      catalogFormValidationIssue({errorFields: [{name: ['attributesDraftRows'], errors: ['属性键重复：origin']}]}),
    ).toEqual({tabKey: 'attributes', message: '属性键重复：origin'});
    expect(catalogFormValidationIssue({errorFields: [{name: ['displayName'], errors: ['请输入商品名称']}]})).toEqual({
      tabKey: 'basic',
      message: '请输入商品名称',
    });
    expect(catalogFormValidationIssue({errorFields: []})).toBeUndefined();
  });

  it('keeps attribute JSON types and exact string digits until the single submit serialization', () => {
    const rows = attributeDraftRowsFromRecord({note: 'true', id: '1234567890123456789', count: 2});
    expect(rows).toEqual([
      {key: 'note', value: '"true"'},
      {key: 'id', value: '"1234567890123456789"'},
      {key: 'count', value: '2'},
    ]);
    expect(serializeCatalogAttributeDraftRows([...rows, {key: 'other', value: '"直营"'}])).toEqual({
      note: 'true',
      id: '1234567890123456789',
      count: 2,
      other: '直营',
    });
  });

  it('rejects duplicate attribute keys instead of silently dropping the first row', () => {
    const rows = [
      {key: 'origin', value: '"直营"'},
      {key: ' origin ', value: '"加盟"'},
    ];
    expect(duplicateCatalogAttributeKeys(rows)).toEqual(['origin']);
    expect(() => serializeCatalogAttributeDraftRows(rows)).toThrow('CATALOG_ATTRIBUTE_DUPLICATE_KEY:origin');
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
        attributes: {},
        images: [],
        productionTagRefs: [],
        categoryRefs: [],
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
      sections: {expectedCatalogVersion: 7, inventoryConfiguration: {nodes: []}, expectedInventoryVersions: []},
    });
    expect(request.sections.catalogDraft).toMatchObject({
      name: '拿铁',
      shapeKey: 'STANDARD_SALE_COUNTED',
      images: [],
      productionTagRefs: [],
      categoryRefs: [],
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

  it('keeps VOIDED dictionary entries in the same reorderable sequence', () => {
    const rows = [{status: 'ENABLED'}, {status: 'ENABLED'}, {status: 'VOIDED'}, {status: 'ENABLED'}];
    expect(canMoveDictionaryRow(rows, 0, 1)).toBe(true);
    expect(canMoveDictionaryRow(rows, 1, 1)).toBe(true);
    expect(canMoveDictionaryRow(rows, 3, -1)).toBe(true);
    expect(canMoveDictionaryRow(rows, 2, -1)).toBe(true);
    expect(canMoveDictionaryRow(rows, 2, 1)).toBe(true);
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
            categoryRefs: [],
            productionTagRefs: [],
            tagRefs: ['00000000-0000-4000-8000-000000000002'],
            salesUnitRefs: ['00000000-0000-4000-8000-000000000003'],
            standardSalePrice: null,
            standardSalePriceMin: 2800,
            standardSalePriceMax: 3400,
            priceGranularity: 'SKU',
          },
        ],
      },
    } as CatalogInventoryEnvelope);
    expect(decoded.items[0].tagRefs).toEqual(['00000000-0000-4000-8000-000000000002']);
    expect(decoded.items[0].salesUnitRefs).toEqual(['00000000-0000-4000-8000-000000000003']);
    expect(catalogPriceLabel(decoded.items[0])).toBe('¥28.00~34.00');
  });

  it('keeps inventory configuration and reference fields on detail readback', () => {
    const decoded = decodeDetail({
      data: {
        item: {
          code: 'LATTE-001',
          name: '拿铁',
          source: 'CATALOG',
          status: 'ENABLED',
          shapeKey: 'STANDARD_SALE_COUNTED',
          tagRefs: ['tag-ref'],
          salesUnitRefs: ['unit-ref'],
          inventoryBom: [
            {
              nodeType: 'ITEM',
              mode: 'INDEPENDENT_STOCK',
              targetRef: 'target-ref',
              quantity: '1',
              unit: '份',
              consumptionUnit: '份',
              configuration: {allowNegative: true, lowStockThreshold: '2', countingUnit: '箱', conversionFactor: '12'},
            },
          ],
        },
        governance: {externalIdentity: null},
      },
    } as CatalogInventoryEnvelope);
    expect(decoded?.item.tagRefs).toEqual(['tag-ref']);
    expect(decoded?.item.salesUnitRefs).toEqual(['unit-ref']);
    expect(decoded?.item.inventoryBom[0].configuration).toEqual({
      allowNegative: true,
      lowStockThreshold: '2',
      countingUnit: '箱',
      conversionFactor: '12',
    });
  });

  it('decodes dictionary labels by UUID for list reference summaries', () => {
    const labels = decodeCatalogDictionaryLabels({
      data: {entries: [{entryRef: 'tag-ref', name: '口味', status: 'ENABLED'}]},
    } as unknown as CatalogDictionaryView);
    expect(labels).toEqual([{entryRef: 'tag-ref', name: '口味', status: 'ENABLED'}]);
  });

  it('checks dictionary codes against active owner rows while allowing a released VOIDED code', () => {
    const rows = [
      {code: 'LATTE', name: '拿铁', status: 'ENABLED'},
      {code: 'OLD', name: '旧记录', status: 'VOIDED'},
    ];
    expect(catalogDictionaryCodeConflict(rows, ' latte ')).toEqual({name: '拿铁', code: 'LATTE'});
    expect(catalogDictionaryCodeConflict(rows, 'old')).toBeUndefined();
    expect(catalogDictionaryCodeConflict(rows, 'new')).toBeUndefined();
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

  it('builds a category batch save from the detail facts without clearing optional sections', () => {
    const detail = decodeDetail({
      data: {
        item: {
          code: 'LATTE-001',
          name: '拿铁',
          shapeKey: 'STANDARD_SALE_COUNTED',
          version: 7,
          attributes: {materialRole: 'DRINK'},
          images: ['asset-1'],
          productionTagRefs: ['production-1'],
          categoryRefs: ['old-category'],
          tagRefs: ['tag-1'],
          inventoryBom: [
            {
              nodeType: 'ITEM_BOM',
              mode: 'BOM',
              targetRef: 'target-1',
              quantity: '1',
              unit: '份',
              itemRef: 'item-1',
              skuCode: null,
              optionValueRef: null,
            },
          ],
        },
        governance: {externalIdentity: null},
      },
    } as CatalogInventoryEnvelope)!;
    const request = buildCatalogBatchSaveRequest(detail, testUuid('node-1'), 'CATEGORY', [testUuid('new-category')]);
    expect(request).toMatchObject({
      dataNodeRef: 'node-1',
      itemCode: 'LATTE-001',
      sections: {expectedCatalogVersion: 7, expectedInventoryVersions: []},
    });
    expect(request.sections.catalogDraft).toMatchObject({
      name: '拿铁',
      shapeKey: 'STANDARD_SALE_COUNTED',
      attributes: {materialRole: 'DRINK'},
      images: ['asset-1'],
      productionTagRefs: ['production-1'],
      categoryRefs: ['new-category'],
    });
    expect(request.sections.catalogDraft).not.toHaveProperty('tagRefs');
    expect(request.sections.catalogDraft).not.toHaveProperty('orderOptions');
    expect(request.sections.catalogDraft).not.toHaveProperty('inventoryBom');
    expect(request.sections.inventoryConfiguration).toEqual({nodes: []});
  });

  it('builds a tag batch save while retaining the current category relationship', () => {
    const detail = decodeDetail({
      data: {
        item: {
          code: 'LATTE-002',
          name: '燕麦拿铁',
          shapeKey: 'STANDARD_SALE_COUNTED',
          version: 3,
          attributes: {},
          images: [],
          productionTagRefs: [],
          categoryRefs: ['category-1'],
          tagRefs: ['old-tag'],
        },
        governance: {externalIdentity: null},
      },
    } as CatalogInventoryEnvelope)!;
    const request = buildCatalogBatchSaveRequest(detail, testUuid('node-2'), 'TAG', [testUuid('new-tag')]);
    expect(request.sections.catalogDraft).toMatchObject({categoryRefs: ['category-1'], tagRefs: ['new-tag']});
  });

  it('keeps batch status versions and request order separate from response order', () => {
    const rows = [
      {itemRef: testUuid('item-a'), code: 'A', version: 4},
      {itemRef: testUuid('item-b'), code: 'B', version: 9},
    ];
    expect(buildCatalogBatchStatusRequest(testUuid('node-1'), 'ARCHIVED', rows)).toEqual({
      dataNodeRef: 'node-1',
      targetStatus: 'ARCHIVED',
      items: [
        {itemRef: 'item-a', expectedVersion: 4},
        {itemRef: 'item-b', expectedVersion: 9},
      ],
    });
    const results = decodeCatalogBatchResults({
      revision: 'r',
      requestId: 'q',
      results: [
        {itemRef: 'item-b', ok: false, failureCode: 'VERSION_CONFLICT', version: 10},
        {itemRef: 'item-a', ok: true, failureCode: null, version: 5},
      ],
    } as never);
    expect(alignCatalogBatchResults(rows, results)).toEqual([
      {itemRef: 'item-a', code: 'A', ok: true, failureCode: null, version: 5},
      {itemRef: 'item-b', code: 'B', ok: false, failureCode: 'VERSION_CONFLICT', version: 10},
    ]);
  });

  it('fails closed when a batch response moves results below the root', () => {
    const rows = [{itemRef: testUuid('item-a'), code: 'A', version: 4}];
    const nested = decodeCatalogBatchResults({data: {results: [{itemRef: testUuid('item-a'), ok: true}]}} as never);
    expect(nested).toEqual([]);
    expect(alignCatalogBatchResults(rows, nested)).toEqual([
      {itemRef: 'item-a', code: 'A', ok: false, failureCode: 'RESULT_UNKNOWN', version: undefined},
    ]);
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
  });
});
