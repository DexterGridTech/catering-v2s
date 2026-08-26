import {describe, expect, it} from 'vitest';
import type {Uuid} from '../../../app/api/generated/catalog-inventory-edge';
import type {CatalogDetail} from './catalogModel';
import {serializeCompositeGroups, type SkuRowDraft} from './catalogItemEditorDraftAdapters';
import {buildCatalogItemSaveRequest} from './catalogItemSaveRequest';

const uuid = (value: string) => value as Uuid;

describe('catalog whole-save contract projection', () => {
  it('keeps resolved component names in the editor only and excludes them from the owner request', () => {
    const result = serializeCompositeGroups([
      {
        editorId: 'group-1',
        groupCode: 'MAIN',
        groupName: '主菜',
        selectionRule: 'FIXED',
        minSelections: 0,
        maxSelections: 0,
        displayOrder: 0,
        components: [
          {
            editorId: 'component-1',
            itemRef: uuid('00000000-0000-4000-8000-000000000111'),
            itemCode: 'MAIN-001',
            itemName: '西冷牛排',
            productSkuRef: uuid('00000000-0000-4000-8000-000000000112'),
            skuCode: 'STEAK-MEDIUM',
            skuName: '七分熟',
            quantity: '1',
            unit: '份',
            default: true,
            extraPrice: null,
            status: 'ENABLED',
            displayOrder: 0,
          },
        ],
      },
    ]);
    expect(result[0].components[0]).not.toHaveProperty('itemName');
    expect(result[0].components[0]).not.toHaveProperty('skuName');
    expect(result[0].components[0]).toMatchObject({itemCode: 'MAIN-001', skuCode: 'STEAK-MEDIUM'});
  });

  it('keeps the single production tag on the item while SKU and option effects carry no tag field', () => {
    const detail = {item: {version: 7, shapeKey: 'SKU_VARIANT_SALE_COUNTED', priceGranularity: 'SKU'}} as Pick<
      CatalogDetail,
      'item'
    >;
    const {body} = buildCatalogItemSaveRequest({
      dataNodeRef: uuid('scope-001'),
      itemCode: 'LATTE-001',
      detail,
      visibleTabs: new Set(['sku-specifications-pricing', 'production-prompts']),
      formValues: {displayName: '拿铁'},
      mediaDraft: [],
      skuStagedMedia: [],
      selectedTagRefs: [],
      selectedProductionTagRef: '00000000-0000-4000-8000-000000000002',
      selectedSalesUnitRef: undefined,
      selectedBaseMeasureUnitRef: undefined,
      categoryRefDraft: undefined,
      attributeAssignmentsDraft: [],
      orderOptionConfigsDraft: [
        {
          definitionRef: uuid('00000000-0000-4000-8000-000000000003'),
          name: '加冰',
          selectionMode: 'SINGLE',
          displayOrder: 0,
          required: false,
          minSelectionCount: null,
          maxSelectionCount: null,
          values: [
            {
              definitionValueRef: uuid('00000000-0000-4000-8000-000000000004'),
              name: '少冰',
              displayOrder: 0,
              defaultValue: false,
              extraPrice: null,
              bomVersion: 2,
              preparationEffect: {
                definitionValueRef: uuid('00000000-0000-4000-8000-000000000004'),
                optionGroupDisplayOrder: 0,
                optionValueDisplayOrder: 0,
                preparationSecondsDelta: 0,
                instruction: '最后加冰',
              },
            },
          ],
        },
      ],
      identifierDraft: [],
      standardSalePriceDraft: null,
      skuVariantDimensionsDraft: [],
      skusDraft: [
        {
          editorId: 'sku-1',
          productSkuRef: uuid('00000000-0000-4000-8000-000000000005'),
          skuCode: 'LATTE-M',
          skuName: '中杯拿铁',
          status: 'ENABLED',
          standardSalePrice: 3200,
          isDefault: true,
          mediaRefs: [],
          identifiers: [],
          attributeValueRefs: [],
          salesUnitOverrideRef: null,
          baseMeasureUnitOverrideRef: null,
          salesUnit: null,
          baseMeasureUnit: null,
          preparationOverride: {mode: 'INHERIT_ITEM', profile: null},
        } as unknown as SkuRowDraft,
      ],
      compositeGroupsDraft: [],
      preparationProfileDraft: {
        productionDisplayName: '拿铁',
        estimatedPreparationSeconds: 120,
        preparationNotes: null,
      },
      inventoryRulesDraft: [],
    });
    const draft = body.sections.catalogDraft;
    expect(draft.productionTagRef).toBe(uuid('00000000-0000-4000-8000-000000000002'));
    expect(draft.skus?.[0]).not.toHaveProperty('productionTagRef');
    expect(draft.orderOptionConfigs?.[0]?.values[0]?.preparationEffect).toEqual({
      instruction: '最后加冰',
      preparationSecondsDelta: 0,
    });
  });
});
