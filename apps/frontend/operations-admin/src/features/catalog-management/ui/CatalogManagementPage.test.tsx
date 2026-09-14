import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import type {
  BrandCatalogCopyPreflight,
  CatalogDictionaryView,
  CatalogInventoryEnvelope,
  CatalogShapeManifestView,
  Uuid,
} from '../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {requireOperationsScopeRef} from '../../../app/routing/model';
import {CATALOG_TAB_LABELS, catalogEditorTabIsAllowed, catalogViewTabLabel} from '../model/catalogTabLabels';
import {copyScopeTabKey} from './local-copy/localCatalogCopyModel';
import {
  buildCatalogBatchSaveRequest,
  buildCatalogBatchStatusRequest,
  buildCatalogItemsQuery,
  buildCatalogSkuVoidRequest,
  buildSkuMatrix,
  catalogCategoryCodeExists,
  catalogCopyReasonLabel,
  catalogFilterConflictReason,
  catalogFormValidationIssue,
  catalogPriceLabel,
  catalogSkuIssueCodes,
  catalogTagTreeSelection,
  copyConfirmationLabel,
  copyConfirmationRows,
  decodeBrandCopyReadback,
  decodeCatalogVoidAvailability,
  decodeCatalogBatchResults,
  decodeCatalogDictionaryLabels,
  decodeCatalogMediaLimits,
  decodeDetail,
  decodeItems,
  decodeNavigation,
  decodePreflight,
  decodeCatalogSkuVoidAvailability,
  isCatalogBatchRowSelectable,
  mergeCatalogSkuVoidReadback,
  partitionBrandCopyCompatibilityResults,
  productionTagReadbackIsComplete,
  requireCatalogSkuVoidTransitionReadback,
  serializeSkuRowsForSave,
  shapeHasVisibleTab,
  shortNameMatchesKeyword,
  shouldHydrateCatalogItemDraft,
  type CatalogBatchResult,
  type CatalogNavigation,
  type CopyPreflight,
  type CatalogSkuRow,
  type CatalogSkuVariantDimension,
} from '../model/catalogModel';
import {CatalogBatchOutcome} from './CatalogBatchOutcome';
import {temporaryPromotionBlockedReasonLabel, temporaryPromotionFieldLabel} from './CatalogTemporaryPromotionTask';

const testUuid = (value: string) => value as unknown as Uuid;
const skuUnitDefaults = {
  salesUnitOverrideRef: null,
  baseMeasureUnitOverrideRef: null,
  salesUnit: null,
  baseMeasureUnit: null,
  identifiers: [],
  preparationOverride: {mode: 'INHERIT_ITEM' as const, profile: null},
  effectivePreparation: null,
  preparationSource: 'ITEM_DEFAULT' as const,
  updatedAt: 0,
};

const batchRow = (index: number, outcome: CatalogBatchResult['outcome']): CatalogBatchResult => ({
  itemRef: testUuid(`item-${index}`),
  itemCode: `ITEM-${index}`,
  outcome,
  problemCode: outcome === 'FAILED' ? 'VERSION_CONFLICT' : null,
  reason: outcome === 'FAILED' ? 'owner raw reason must not render' : null,
  version: outcome === 'SUCCEEDED' ? index + 1 : null,
});

describe('catalog management runtime model contracts', () => {
  it('keeps view tab labels in one source while excluding reference facts from the editor', () => {
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
    expect(catalogViewTabLabel('governance')).toBe('引用关系');
    expect(catalogEditorTabIsAllowed('governance')).toBe(false);
    expect(catalogEditorTabIsAllowed('inventory-bom')).toBe(true);
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

  it('hydrates a same-item draft only when an explicit server refresh requires it', () => {
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
    ).toBe(false);
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
    const rows: CatalogSkuRow[] = [
      {
        productSkuRef: testUuid('sku-1'),
        skuCode: 'SKU-1',
        skuName: '拿铁',
        displayOrder: 0,
        variantCombinationDigest: 'digest-1',
        attributeValueRefs: [],
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
      blockingReasons: [{reasonCode: 'ALREADY_VOIDED', count: 1, relatedItemNames: []}],
    });
    expect(merged[0]).toMatchObject({
      productSkuRef: 'sku-1',
      standardSalePrice: 1280,
      status: 'VOIDED',
      version: 6,
      voidAvailability: {
        canVoid: false,
        blockingReferences: [],
        dependentFacts: [],
        blockingReasons: [{reasonCode: 'ALREADY_VOIDED', count: 1, relatedItemNames: []}],
      },
    });
    expect(merged[1]).toEqual(rows[1]);
  });

  it('rejects an incomplete item or SKU void readback instead of inventing a false void prohibition', () => {
    expect(() => decodeCatalogSkuVoidAvailability(undefined)).toThrow('INVALID_CATALOG_VOID_AVAILABILITY');
    expect(() =>
      decodeCatalogSkuVoidAvailability({
        canVoid: false,
        blockingReferences: [],
        dependentFacts: [],
      }),
    ).toThrow('INVALID_CATALOG_VOID_AVAILABILITY');
    expect(() => decodeCatalogVoidAvailability({canVoid: false, blockingReferences: [], dependentFacts: []})).toThrow(
      'INVALID_CATALOG_VOID_AVAILABILITY',
    );
    expect(
      decodeCatalogSkuVoidAvailability({
        canVoid: false,
        blockingReferences: [],
        dependentFacts: [],
        blockingReasons: [{reasonCode: 'USED_BY_INVENTORY_BOM', count: 1, relatedItemNames: []}],
      }),
    ).toMatchObject({canVoid: false, blockingReasons: [{reasonCode: 'USED_BY_INVENTORY_BOM', count: 1}]});
  });

  it('accepts only the exact complete owner SKU void transition and never changes a draft for an unknown result', () => {
    const rows: CatalogSkuRow[] = [
      {
        productSkuRef: testUuid('sku-void-1'),
        skuCode: 'SKU-VOID-1',
        skuName: '待作废规格',
        displayOrder: 0,
        variantCombinationDigest: 'void-digest',
        attributeValueRefs: [],
        standardSalePrice: 1280,
        isDefault: true,
        status: 'ENABLED',
        version: 3,
        ...skuUnitDefaults,
        mediaRefs: [],
        voidAvailability: {canVoid: true, blockingReferences: [], dependentFacts: [], blockingReasons: []},
      },
    ];
    const requestedSkuRef = rows[0].productSkuRef;
    const complete = requireCatalogSkuVoidTransitionReadback(
      [
        {
          skuRef: requestedSkuRef,
          targetStatus: 'VOIDED',
          version: 4,
          canVoid: false,
          blockingReferences: [],
          dependentFacts: [],
          blockingReasons: [{reasonCode: 'ALREADY_VOIDED', count: 1, relatedItemNames: []}],
        },
      ],
      requestedSkuRef,
    );
    expect(mergeCatalogSkuVoidReadback(rows, requestedSkuRef, complete)[0]).toMatchObject({
      status: 'VOIDED',
      version: 4,
    });
    for (const invalid of [
      [],
      [{...complete, skuRef: testUuid('sku-void-other')}],
      [{...complete, blockingReasons: []}],
      [{...complete, targetStatus: 'ENABLED'}],
    ]) {
      expect(() => requireCatalogSkuVoidTransitionReadback(invalid, requestedSkuRef)).toThrow(
        'INVALID_CATALOG_SKU_VOID_TRANSITION_READBACK',
      );
      expect(rows[0]).toMatchObject({status: 'ENABLED', version: 3});
    }
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

  it('excludes voided and temporary rows from every batch write snapshot', () => {
    expect(isCatalogBatchRowSelectable({status: 'ENABLED', source: 'SELF_MANAGED'})).toBe(true);
    expect(isCatalogBatchRowSelectable({status: 'VOIDED', source: 'SELF_MANAGED'})).toBe(false);
    expect(isCatalogBatchRowSelectable({status: 'ENABLED', source: 'TEMPORARY'})).toBe(false);
  });

  it('builds SKU VOIDED transitions without crossing response-only fields', () => {
    const request = buildCatalogSkuVoidRequest(
      {
        name: '拿铁',
        shapeKey: 'STANDARD_SALE_COUNTED',
        images: [],
        identifiers: [],
        preparationProfile: null,
        productionTagRef: null,
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
      productionTagRef: null,
      categoryRef: null,
    });
    expect(request.sections.catalogDraft).not.toHaveProperty('attributeAssignments');
    expect(request.sections.catalogDraft).not.toHaveProperty('orderOptionConfigs');
    expect(request.sections.catalogDraft).not.toHaveProperty('identifiers');
    expect(request.sections.catalogDraft).not.toHaveProperty('preparationProfile');
    expect(request.sections.catalogDraft).not.toHaveProperty('tagRefs');
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
        directCount: 0,
        countSemantics: 'SELF_AND_DESCENDANTS',
        deletionAvailability: {
          canDelete: true,
          subtreeSize: 1,
          blockingReferenceCount: 0,
          blockingReferences: {count: 0, references: []},
        },
      },
      {
        categoryRef: testUuid('category-b'),
        code: 'FOOD',
        name: '食品',
        parentCategoryRef: null,
        version: 1,
        displayOrder: 1,
        count: 0,
        directCount: 0,
        countSemantics: 'SELF_AND_DESCENDANTS',
        deletionAvailability: {
          canDelete: true,
          subtreeSize: 1,
          blockingReferenceCount: 0,
          blockingReferences: {count: 0, references: []},
        },
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
          categoryPath: [],
          specificationFacts: [],
          orderOptionFacts: [],
          attributeFacts: [],
          preparationFacts: {productionTag: null, profile: null, skuVariation: {varies: false}},
          lifecycle: {status: 'DISABLED', version: 4, source: 'TEMPORARY'},
          externalIdentity: {
            sourceOrderRef: 'EXT-ORDER-001',
            sourceRecordRef: 'EXT-RECORD-001',
            sourceItemRef: 'EXT-SKU-88',
            snapshot: {name: '外部订单临时拿铁', specification: '中杯 / 热', price: 2800},
          },
        },
        governance: {externalIdentity: null},
        productionTags: [],
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
            categoryPath: [],
            productionTagRef: null,
            tags: [],
            tagRefs: ['00000000-0000-4000-8000-000000000002'],
            status: 'ENABLED',
            specificationFacts: [],
            orderOptionFacts: [],
            attributeFacts: [],
            preparationFacts: {productionTag: null, profile: null, skuVariation: {varies: false}},
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

  it('keeps the same resolved names for composite components at both detail contract locations', () => {
    const component = {
      itemRef: '00000000-0000-4000-8000-000000000101',
      itemCode: 'MAIN-STEAK',
      itemName: '西冷牛排',
      productSkuRef: '00000000-0000-4000-8000-000000000102',
      skuCode: 'STEAK-MEDIUM',
      skuName: '七分熟',
      quantity: '1',
      unit: '份',
      default: true,
      extraPrice: null,
      status: 'ENABLED',
      displayOrder: 0,
    };
    const groups = [
      {
        groupCode: 'MAIN',
        groupName: '主菜',
        selectionRule: 'FIXED',
        minSelections: 0,
        maxSelections: 0,
        displayOrder: 0,
        components: [component],
      },
    ];
    const decoded = decodeDetail({
      data: {
        item: {
          itemRef: '00000000-0000-4000-8000-000000000100',
          code: 'COMBO-001',
          name: '双人套餐',
          source: 'CATALOG',
          status: 'DISABLED',
          shapeKey: 'COMPOSITE',
          categoryPath: [],
          specificationFacts: [],
          orderOptionFacts: [],
          attributeFacts: [],
          preparationFacts: {productionTag: null, profile: null, skuVariation: {varies: false}},
          compositeGroups: groups,
          lifecycle: {status: 'DISABLED', version: 1, source: 'CATALOG'},
        },
        compositeGroups: groups,
        productionTags: [],
      },
    } as CatalogInventoryEnvelope);
    expect(decoded?.item.compositeGroups).toEqual(decoded?.compositeGroups);
    expect(decoded?.item.compositeGroups[0]?.components[0]).toMatchObject({
      itemName: '西冷牛排',
      skuName: '七分熟',
    });
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
          categoryPath: [],
          salesUnitRef: 'unit-ref',
          baseMeasureUnitRef: 'base-unit-ref',
          specificationFacts: [],
          orderOptionFacts: [],
          attributeFacts: [],
          preparationFacts: {productionTag: null, profile: null, skuVariation: {varies: false}},
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
        productionTags: [],
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
    const existing: CatalogSkuRow = {
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
      standardSalePrice: 1280,
      isDefault: true,
      status: 'ENABLED',
      version: 4,
      ...skuUnitDefaults,
      mediaRefs: [testUuid('asset-1')],
    };
    const stoppedValueRow: CatalogSkuRow = {
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
    const archivedRow: CatalogSkuRow = {
      ...existing,
      productSkuRef: testUuid('sku-archived'),
      skuCode: 'SKU-011',
      skuName: '已作废旧行',
      displayOrder: 9,
      status: 'VOIDED',
      isDefault: false,
    };
    const dimensions: CatalogSkuVariantDimension[] = [
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
    const row: CatalogSkuRow = {
      productSkuRef: testUuid(''),
      skuCode: '',
      skuName: '',
      displayOrder: 0,
      variantCombinationDigest: '',
      attributeValueRefs: [],
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
          {
            objectType: 'CATALOG_ITEM',
            compatibilityId: 'catalog:1',
            result: 'CREATE',
            reason: '目标侧新建',
            reasonCode: 'TARGET_ABSENT',
          },
          {
            objectType: 'CATALOG_ITEM',
            compatibilityId: 'catalog:1',
            result: 'REUSE',
            reason: '目标侧已有',
            reasonCode: 'REUSE_CONFIRMATION_REQUIRED',
          },
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

  it('accepts production-tag create readback only with its stable identity and displayed facts', () => {
    expect(productionTagReadbackIsComplete({tagRef: 'tag-ref', code: 'HOT', name: '热', status: 'ENABLED'})).toBe(true);
    expect(productionTagReadbackIsComplete({code: 'HOT', name: '热', status: 'ENABLED'})).toBe(false);
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
    expect(buildCatalogBatchStatusRequest(testUuid('node-1'), 'VOIDED', rows)).toEqual({
      dataNodeRef: 'node-1',
      targetStatus: 'VOIDED',
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

  it('accepts a typed failed receipt without an explanatory reason', () => {
    const itemRef = testUuid('00000000-0000-4000-8000-000000000003');
    const results = decodeCatalogBatchResults(
      {
        revision: 'r',
        requestId: 'q',
        results: [
          {
            itemRef,
            itemCode: 'C',
            outcome: 'FAILED',
            problemCode: 'VERSION_CONFLICT',
            reason: null,
            version: null,
          },
        ],
      } as never,
      [itemRef],
    );
    expect(results).toEqual([
      {
        itemRef,
        itemCode: 'C',
        outcome: 'FAILED',
        problemCode: 'VERSION_CONFLICT',
        reason: null,
        version: null,
      },
    ]);
    const markup = renderToStaticMarkup(<CatalogBatchOutcome results={results} onClose={() => undefined} />);
    expect(markup).toContain('商品资料已有更新，请重新读取后再操作。');
    expect(markup).not.toContain('VERSION_CONFLICT');
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
    expect(markup).not.toContain('逐项处理结果');
    expect(markup).not.toContain('已处理');
  });

  it('renders partial failures with the approved heading and table columns', () => {
    const markup = renderToStaticMarkup(
      <CatalogBatchOutcome results={[batchRow(1, 'SUCCEEDED'), batchRow(2, 'FAILED')]} onClose={() => undefined} />,
    );
    expect(markup).toContain('成功 1 项，失败 1 项');
    expect(markup).toContain('以下 1 个商品未处理成功');
    expect(markup).toContain('商品编码');
    expect(markup).toContain('失败原因');
    expect(markup).toContain('ITEM-2');
    expect(markup).toContain('商品资料已有更新，请重新读取后再操作。');
    expect(markup).not.toContain('owner raw reason must not render');
    expect(markup).not.toContain('处理结果');
    expect(markup).not.toContain('说明');
    expect(markup).toContain('data-testid="catalog-batch-outcome-failures"');
    expect(markup).toContain('tabindex="0"');
  });

  it('keeps the 100-item failure result in the keyboard-accessible result table region', () => {
    const markup = renderToStaticMarkup(
      <CatalogBatchOutcome
        results={Array.from({length: 100}, (_, index) => batchRow(index + 1, 'FAILED'))}
        onClose={() => undefined}
      />,
    );
    expect(markup).toContain('以下 100 个商品未处理成功');
    expect(markup).toContain('class="catalog-batch-outcome__failure-table"');
    expect(markup).toContain('tabindex="0"');
  });

  it('projects known problem codes instead of rendering a long owner reason', () => {
    const markup = renderToStaticMarkup(
      <CatalogBatchOutcome
        results={[{...batchRow(1, 'FAILED'), reason: '业务原因 '.repeat(400)}]}
        onClose={() => undefined}
      />,
    );
    expect(markup).toContain('商品资料已有更新，请重新读取后再操作。');
    expect(markup).not.toContain('业务原因');
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

  it('uses a safe fallback when the problem code is not in the UI dictionary', () => {
    const result: CatalogBatchResult = {
      ...batchRow(1, 'FAILED'),
      itemRef: testUuid('hidden-item-ref'),
      problemCode: 'INTERNAL_PROBLEM_CODE',
      version: 42,
      reason: 'raw exception / internal detail',
    };
    const markup = renderToStaticMarkup(<CatalogBatchOutcome results={[result]} onClose={() => undefined} />);
    expect(markup).toContain('批量操作项执行失败，请重新读取后再试。');
    expect(markup).not.toContain('raw exception / internal detail');
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

  it('decodes the direct brand-copy preflight edge readback', () => {
    const preflight = decodePreflight({
      sourceScope: {
        ownerType: 'BRAND',
        ownerRef: testUuid('source-owner'),
        brandRef: testUuid('source-brand'),
      },
      targetScope: {
        ownerType: 'STORE',
        ownerRef: testUuid('target-owner'),
        brandRef: testUuid('target-brand'),
      },
      selectedItems: [],
      selectedCount: 0,
      selectedLimit: 20,
      closureItems: [],
      closureEdges: [],
      skipped: [],
      closureCount: 0,
      closureLimit: 500,
      objectVersions: [],
      referenceMappings: [],
      mappingPreview: [],
      referenceRewritePreview: [],
      compatibilityResults: [],
      preflightDigest: 'direct-brand-preflight',
      blockingCount: 0,
      confirmationRequiredCount: 0,
    } as BrandCatalogCopyPreflight);
    expect(preflight?.preflightDigest).toBe('direct-brand-preflight');
    expect(preflight?.selectedCount).toBe(0);
    expect(preflight?.compatibilityResults).toEqual([]);
  });

  it('does not hide unclassified brand-copy compatibility facts', () => {
    const buckets = partitionBrandCopyCompatibilityResults([
      {
        objectType: 'STOCK_TARGET',
        compatibilityId: 'stock:1',
        result: 'REUSE',
        reason: '库存对象可复用',
        reasonCode: 'REUSE_CONFIRMATION_REQUIRED',
      },
      {
        objectType: 'PRODUCTION_TAG',
        compatibilityId: 'production:1',
        result: 'SKIPPED',
        reason: '生产标签缺失',
        reasonCode: 'OWNER_FACT_UNAVAILABLE',
      },
      {
        objectType: 'CATALOG_ITEM',
        compatibilityId: 'catalog:1',
        result: 'BLOCKED',
        reason: '商品关系需人工确认',
        reasonCode: 'STRUCTURE_INCOMPATIBLE',
      },
    ]);
    expect(buckets.inventory).toHaveLength(1);
    expect(buckets.production).toHaveLength(1);
    expect(buckets.other).toEqual([
      {
        objectType: 'CATALOG_ITEM',
        compatibilityId: 'catalog:1',
        result: 'BLOCKED',
        reason: '商品关系需人工确认',
        reasonCode: 'STRUCTURE_INCOMPATIBLE',
      },
    ]);
  });

  it('requires one confirmation for every non-blocked copy result without collapsing duplicates', () => {
    const rows: CopyPreflight['compatibilityResults'] = [
      {
        objectType: 'STOCK_TARGET',
        compatibilityId: 'stock:1',
        result: 'REUSE',
        reason: '库存对象可复用',
        reasonCode: 'REUSE_CONFIRMATION_REQUIRED',
      },
      {
        objectType: 'STOCK_TARGET',
        compatibilityId: 'stock:2',
        result: 'REUSE',
        reason: '库存对象可复用',
        reasonCode: 'REUSE_CONFIRMATION_REQUIRED',
      },
      {
        objectType: 'CATALOG_ITEM',
        compatibilityId: 'catalog:1',
        result: 'CREATE',
        reason: '目标侧新建',
        reasonCode: 'TARGET_ABSENT',
      },
      {
        objectType: 'SKU_ATTRIBUTE_VALUE',
        compatibilityId: 'attribute:1',
        result: 'CONFIRMABLE_REUSE',
        reason: '需要确认复用',
        reasonCode: 'REUSE_CONFIRMATION_REQUIRED',
      },
      {
        objectType: 'PRODUCTION_TAG',
        compatibilityId: 'production:1',
        result: 'BLOCKED',
        reason: '生产标签冲突',
        reasonCode: 'CATALOG_COPY_DEFINITION_CONFLICT',
      },
      {
        objectType: 'UNKNOWN',
        compatibilityId: 'unknown:1',
        result: 'FUTURE_RESULT',
        reason: '未登记结果',
        reasonCode: 'FUTURE_REASON',
      },
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
    expect(catalogCopyReasonLabel('SKU_STRUCTURE_INCOMPATIBLE')).toBe('规格结构不一致。');
    expect(catalogCopyReasonLabel('FUTURE_REASON')).toBe('当前内容需要进一步确认，请核对后重新检查。');
    expect(copyConfirmationRows([rows[2], rows[0]]).map(({key}) => key)).toEqual(['catalog:1', 'stock:1']);
    expect(copyConfirmationRows([{...rows[0], compatibilityId: ''}])).toEqual([]);
  });

  it('projects temporary-promotion protocol fields and reasons into business copy', () => {
    expect(temporaryPromotionFieldLabel('formalCode')).toBe('商品编码');
    expect(temporaryPromotionFieldLabel('materialRole')).toBe('物料角色');
    expect(temporaryPromotionFieldLabel('ownerVersion')).toBe('商品资料');
    expect(temporaryPromotionBlockedReasonLabel('DUPLICATE_CODE')).toBe('商品编码已被使用，请修改后重新检查。');
    expect(temporaryPromotionBlockedReasonLabel('MATERIAL_ROLE_REQUIRED')).toBe(
      '选择原材料、半成品或包装物时，请填写物料角色。',
    );
    expect(temporaryPromotionBlockedReasonLabel('UNRECOGNIZED_PROTOCOL_REASON')).toBe(
      '尚有资料或规则不满足转正条件，请调整后重新检查。',
    );
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
            directCount: 1,
            countSemantics: 'SELF_AND_DESCENDANTS',
            deletionAvailability: {
              canDelete: false,
              subtreeSize: 2,
              blockingReferenceCount: 1,
              blockingReferences: {
                count: 1,
                references: [
                  {
                    referenceKind: 'CATALOG_ITEM',
                    referenceRef: 'item-ref',
                    code: 'APP-CHICKEN-WINGS-001',
                    name: '烤鸡翅',
                    direction: 'INBOUND',
                  },
                ],
              },
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
        productionTags: [],
        generation: 7,
      },
    } as CatalogInventoryEnvelope;
    const navigation = decodeNavigation(envelope);
    expect(navigation).toBeDefined();
    if (!navigation) throw new Error('expected navigation response');
    const node = navigation.tree[0];
    expect(navigation.allCount).toBe(8);
    expect(node.parentCategoryRef).toBeNull();
    expect(node).toMatchObject({
      categoryRef: 'a0f5f2c9-3e80-4e10-9ecf-a6d8186dfd49',
      name: '根类',
      version: 3,
      displayOrder: 0,
      count: 2,
      directCount: 1,
      countSemantics: 'SELF_AND_DESCENDANTS',
      deletionAvailability: {
        canDelete: false,
        subtreeSize: 2,
        blockingReferenceCount: 1,
        blockingReferences: {
          count: 1,
          references: [
            {
              referenceKind: 'CATALOG_ITEM',
              referenceRef: 'item-ref',
              code: 'APP-CHICKEN-WINGS-001',
              name: '烤鸡翅',
              direction: 'INBOUND',
            },
          ],
        },
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
    expect(decodeNavigation(undefined)).toBeUndefined();
    const incompleteNavigationEnvelope = structuredClone(envelope) as {data: Record<string, unknown>};
    delete incompleteNavigationEnvelope.data.productionTags;
    expect(() => decodeNavigation(incompleteNavigationEnvelope as CatalogInventoryEnvelope)).toThrow(
      'CATALOG_REQUIRED_FIELD_MISSING:CatalogNavigation.data.productionTags',
    );
  });
});
