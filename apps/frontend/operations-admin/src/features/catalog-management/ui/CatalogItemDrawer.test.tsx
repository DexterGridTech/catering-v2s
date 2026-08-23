import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {collectCursorPages} from '@catering-v2s/admin-ui-foundation';
import type {Uuid} from '../../../app/api/generated/catalog-inventory-edge';
import type {CatalogOrderOptionConfig, CatalogPreparationEffect, CatalogSkuRow} from '../model/catalogModel';
import {
  CATALOG_IDENTIFIER_PREPARATION_PROBLEM_CODES,
  CATALOG_IDENTIFICATION_PREPARATION_FEEDBACK,
  catalogIdentifierProblemFeedback,
} from '../model/catalogIdentificationPreparationFeedback';
import {
  IdentifierEditor,
  PreparationProfileEditor,
  PreparationVariationSummary,
  buildAdditivePreparationEffect,
  catalogPreparationLayout,
  cloneSkuRows,
  manifestIdentifierTypes,
  skuPreparationOverrideForMode,
} from './CatalogItemDrawer';

// The focused surfaces below do not mount ProList. Keep its unrelated CJS
// package boundary out of this SSR-oriented component test.
vi.mock('@ant-design/pro-components', () => ({ProList: () => null}));

const uuid = (value: string) => value as Uuid;
type IdentifierDraft = Parameters<typeof IdentifierEditor>[0]['values'][number];
type ProductionTagOption = Parameters<typeof PreparationProfileEditor>[0]['selectedTags'][number];

const profile = (overrides: Partial<Parameters<typeof PreparationProfileEditor>[0]['profile']> = {}) => ({
  productionTagRefs: [uuid('tag-hot-kitchen')],
  productionDisplayName: '黑椒牛排',
  estimatedPreparationSeconds: 720,
  preparationNotes: '按熟度煎制',
  ...overrides,
});

const identifier = (ownerType: 'CATALOG_ITEM' | 'SKU' = 'CATALOG_ITEM', value = '690100000001') => ({
  editorId: `${ownerType}-row-1`,
  identifierRef: uuid(`${ownerType}-identifier-1`),
  ownerType,
  ownerRef: uuid(`${ownerType}-owner-1`),
  identifierType: 'BARCODE' as const,
  identifierValue: value,
  normalizedValue: value,
  displayOrder: 0,
});

const sku = (overrides: Partial<CatalogSkuRow> = {}): CatalogSkuRow => ({
  productSkuRef: uuid('sku-1'),
  skuCode: 'STEAK-MEDIUM',
  skuName: '七分熟',
  displayOrder: 0,
  variantCombinationDigest: 'digest-1',
  attributeValueRefs: [],
  identifiers: [],
  preparationOverride: {mode: 'INHERIT_ITEM', profile: null},
  effectivePreparation: null,
  preparationSource: 'ITEM_DEFAULT',
  standardSalePrice: 1200,
  isDefault: true,
  status: 'ENABLED',
  version: 1,
  mediaRefs: [],
  salesUnitOverrideRef: null,
  baseMeasureUnitOverrideRef: null,
  salesUnit: null,
  baseMeasureUnit: null,
  ...overrides,
});

const optionConfig = (preparationEffect: CatalogPreparationEffect | null): CatalogOrderOptionConfig => ({
  definitionRef: uuid('option-group-1'),
  name: '冰量',
  selectionMode: 'SINGLE',
  displayOrder: 0,
  required: false,
  minSelectionCount: null,
  maxSelectionCount: null,
  values: [
    {
      definitionValueRef: uuid('option-value-1'),
      name: '加冰',
      displayOrder: 0,
      defaultValue: false,
      extraPrice: null,
      bomVersion: null,
      preparationEffect,
    },
  ],
});

function renderIdentifiers(allowedTypes: Parameters<typeof IdentifierEditor>[0]['allowedTypes'], values: IdentifierDraft[] = []) {
  return renderToStaticMarkup(
    <IdentifierEditor
      values={values}
      allowedTypes={allowedTypes}
      createDraftRowId={prefix => `${prefix}-new`}
      onChange={() => undefined}
      onDirty={() => undefined}
    />,
  );
}

function renderPreparationProfile() {
  const tag: ProductionTagOption = {
    tagRef: uuid('tag-hot-kitchen'),
    code: 'HOT_KITCHEN',
    name: '热厨制作',
    owner: 'FULFILLMENT_PRODUCTION',
    status: 'ENABLED',
  };
  return renderToStaticMarkup(
    <PreparationProfileEditor
      profile={profile()}
      selectedTagRefs={[String(tag.tagRef)]}
      selectedTags={[tag]}
      tagOptions={[{value: String(tag.tagRef), label: tag.name}]}
      tagsLoading={false}
      onTagsSearch={() => undefined}
      onTagsPopupScroll={() => undefined}
      onTagsChange={() => undefined}
      onChange={() => undefined}
      onDirty={() => undefined}
    />,
  );
}

describe('catalog identification and preparation editor boundaries', () => {
  it('derives identifier choices from the generated capability and renders business branches', () => {
    const manifest = {
      identifierRules: {
        admission: {
          STANDARD_SALE_COUNTED: {
            CATALOG_ITEM: {BARCODE: true, PLU: true, MNEMONIC: true},
            SKU: {BARCODE: false, PLU: false, MNEMONIC: false},
          },
          SERVICE_FEE: {
            CATALOG_ITEM: {BARCODE: false, PLU: false, MNEMONIC: true},
            SKU: {BARCODE: false, PLU: false, MNEMONIC: false},
          },
        },
      },
    } as unknown as Parameters<typeof manifestIdentifierTypes>[0];

    expect(manifestIdentifierTypes(manifest, 'STANDARD_SALE_COUNTED', 'CATALOG_ITEM')).toEqual([
      'BARCODE',
      'PLU',
      'MNEMONIC',
    ]);
    expect(manifestIdentifierTypes(manifest, 'SERVICE_FEE', 'CATALOG_ITEM')).toEqual(['MNEMONIC']);
    expect(manifestIdentifierTypes(manifest, 'STANDARD_SALE_COUNTED', 'SKU')).toEqual([]);

    const serviceMarkup = renderIdentifiers(['MNEMONIC'], [{...identifier(), identifierType: 'MNEMONIC'}]);
    expect(serviceMarkup).toContain('添加识别码');
    expect(serviceMarkup).toContain('助记码');
    expect(serviceMarkup).not.toMatch(/title="条码"|>条码<|>称重键码（PLU）</);
    expect(renderIdentifiers([])).toContain('当前商品类型不提供识别方式');
    expect(renderIdentifiers([])).toContain('disabled');
  });

  it('keeps parent drafts isolated when a specification modal receives nested edits', () => {
    const original = [
      sku({
        identifiers: [identifier('SKU')],
        attributeValueRefs: [
          {
            attributeRef: uuid('size'),
            attributeCode: 'SIZE',
            attributeName: '规格',
            attributeValueRef: uuid('medium'),
            valueCode: 'MEDIUM',
            valueLabel: '中杯',
            displayOrder: 0,
            status: 'ENABLED',
          },
        ],
        preparationOverride: {mode: 'OVERRIDE', profile: profile()},
        effectivePreparation: profile(),
        mediaRefs: [uuid('asset-1')],
      }),
    ];
    const draft = cloneSkuRows(original);
    draft[0].identifiers[0].identifierValue = 'changed';
    draft[0].attributeValueRefs[0].valueLabel = '大杯';
    draft[0].preparationOverride.profile?.productionTagRefs.push(uuid('tag-cold-dish'));
    draft[0].effectivePreparation?.productionTagRefs.push(uuid('tag-beverage'));
    draft[0].mediaRefs.push(uuid('asset-2'));

    expect(original[0].identifiers[0].identifierValue).toBe('690100000001');
    expect(original[0].attributeValueRefs[0].valueLabel).toBe('中杯');
    expect(original[0].preparationOverride.profile?.productionTagRefs).toEqual([uuid('tag-hot-kitchen')]);
    expect(original[0].effectivePreparation?.productionTagRefs).toEqual([uuid('tag-hot-kitchen')]);
    expect(original[0].mediaRefs).toEqual([uuid('asset-1')]);
  });

  it('maps every typed problem to a business target without exposing the transport code', () => {
    expect(Object.keys(CATALOG_IDENTIFICATION_PREPARATION_FEEDBACK)).toHaveLength(10);
    for (const code of CATALOG_IDENTIFIER_PREPARATION_PROBLEM_CODES) {
      const feedback = catalogIdentifierProblemFeedback(code);
      expect(feedback?.message).toBeTruthy();
      expect(feedback?.message).not.toContain(code);
      expect(['identifier', 'skuIdentifier', 'preparation', 'skuPreparation', 'optionPreparation']).toContain(
        feedback?.target,
      );
    }
    expect(catalogIdentifierProblemFeedback('CATALOG_IDENTIFIER_DUPLICATE')).toMatchObject({
      target: 'identifier',
      field: 'value',
      message: '该识别码已被同一品牌下的其他商品或规格使用',
    });
  });

  it('clears all identification and preparation drafts on Drawer close and keeps modal edits local', () => {
    const source = readFileSync(new URL('./CatalogItemDrawer.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(
      /if \(!itemCode\) \{[\s\S]*setIdentifierDraft\(\[\]\);[\s\S]*setPreparationProfileDraft\(null\);[\s\S]*setSkusDraft\(\[\]\);[\s\S]*lifecycle\.reset\(\);/,
    );
    expect(source).toMatch(
      /onConfirm=\{identifiers => \{[\s\S]*updateSku\(identifierModalIndex, \{identifiers\}\);[\s\S]*setIdentifierModalIndex\(undefined\);/,
    );
    expect(source).toMatch(
      /onConfirm=\{preparationOverride => \{[\s\S]*updateSku\(preparationModalIndex, \{preparationOverride\}\);[\s\S]*setPreparationModalIndex\(undefined\);/,
    );
  });

  it('covers item-only, specification, option, and combined preparation layouts', () => {
    expect(catalogPreparationLayout('STANDARD_SALE_COUNTED', 0, 0)).toBe('ITEM_ONLY');
    expect(catalogPreparationLayout('SKU_VARIANT_SALE_COUNTED', 2, 0)).toBe('SKU');
    expect(catalogPreparationLayout('STANDARD_SALE_COUNTED', 0, 1)).toBe('OPTIONS');
    expect(catalogPreparationLayout('SKU_VARIANT_SALE_COUNTED', 2, 1)).toBe('SKU_AND_OPTIONS');

    const effect: CatalogPreparationEffect = {
      definitionValueRef: uuid('option-value-1'),
      optionGroupDisplayOrder: 0,
      optionValueDisplayOrder: 0,
      addProductionTagRefs: [uuid('tag-beverage')],
      instruction: '最后加冰',
      preparationSecondsDelta: 10,
    };
    const itemOnly = renderToStaticMarkup(
      <PreparationVariationSummary
        skus={[]}
        orderOptions={[]}
        shapeKey="STANDARD_SALE_COUNTED"
        onNavigateToOptions={() => undefined}
      />,
    );
    const optionOnly = renderToStaticMarkup(
      <PreparationVariationSummary
        skus={[]}
        orderOptions={[optionConfig(effect)]}
        shapeKey="STANDARD_SALE_COUNTED"
        onNavigateToOptions={() => undefined}
      />,
    );
    const skuAndOptions = renderToStaticMarkup(
      <PreparationVariationSummary
        skus={[sku({preparationOverride: {mode: 'OVERRIDE', profile: profile()}})]}
        orderOptions={[optionConfig(effect)]}
        shapeKey="SKU_VARIANT_SALE_COUNTED"
        onNavigateToOptions={() => undefined}
      />,
    );
    expect(itemOnly).toBe('');
    expect(optionOnly).toContain('data-preparation-layout="OPTIONS"');
    expect(skuAndOptions).toContain('data-preparation-layout="SKU_AND_OPTIONS"');
    expect(skuAndOptions).toContain('去点单选项维护');
  });

  it('makes inherit, full override, clear, and add-only option changes explicit', () => {
    const itemDefault = profile();
    const override = skuPreparationOverrideForMode('OVERRIDE', itemDefault);
    expect(override.mode).toBe('OVERRIDE');
    expect(override.profile).toEqual(itemDefault);
    expect(override.profile).not.toBe(itemDefault);
    expect(skuPreparationOverrideForMode('INHERIT_ITEM', itemDefault)).toEqual({
      mode: 'INHERIT_ITEM',
      profile: null,
    });

    const current: CatalogPreparationEffect = {
      definitionValueRef: uuid('option-value-1'),
      optionGroupDisplayOrder: 1,
      optionValueDisplayOrder: 2,
      addProductionTagRefs: [uuid('tag-old')],
      instruction: '先摇匀',
      preparationSecondsDelta: 5,
    };
    const next = buildAdditivePreparationEffect(
      {
        definitionValueRef: current.definitionValueRef,
        optionGroupDisplayOrder: current.optionGroupDisplayOrder,
        optionValueDisplayOrder: current.optionValueDisplayOrder,
      },
      current,
      {addProductionTagRefs: [uuid('tag-old'), uuid('tag-new')], instruction: '最后加冰', preparationSecondsDelta: 10},
    );
    expect(next).toMatchObject({
      addProductionTagRefs: [uuid('tag-old'), uuid('tag-new')],
      instruction: '最后加冰',
      preparationSecondsDelta: 10,
    });
    expect(next).not.toHaveProperty('removeProductionTagRefs');
    expect(next).not.toHaveProperty('decreasePreparationSeconds');
    expect(
      buildAdditivePreparationEffect(
        {
          definitionValueRef: current.definitionValueRef,
          optionGroupDisplayOrder: current.optionGroupDisplayOrder,
          optionValueDisplayOrder: current.optionValueDisplayOrder,
        },
        null,
        {addProductionTagRefs: [], instruction: '', preparationSecondsDelta: null},
      ),
    ).toBeNull();
  });

  it('keeps production-tag candidate pagination and stale-query isolation bounded by the cursor', async () => {
    const calls: Array<string | undefined> = [];
    const pages = new Map<string | undefined, {items: ProductionTagOption[]; nextCursor?: string}>([
      [undefined, {items: [{tagRef: uuid('tag-1'), code: 'HOT', name: '热厨制作', owner: 'FULFILLMENT_PRODUCTION'}], nextCursor: 'cursor-2'}],
      ['cursor-2', {items: [{tagRef: uuid('tag-2'), code: 'COLD', name: '冷菜制作', owner: 'FULFILLMENT_PRODUCTION'}]}],
    ]);
    await expect(
      collectCursorPages<ProductionTagOption>({
        pageSize: 1,
        keyOf: tag => tag.tagRef,
        readPage: async (cursor, pageSize) => {
          expect(pageSize).toBe(1);
          calls.push(cursor);
          const page = pages.get(cursor);
          if (!page) throw new Error('missing production tag page');
          return {...page, total: 2};
        },
      }),
    ).resolves.toMatchObject({items: [{code: 'HOT'}, {code: 'COLD'}], pageCount: 2});
    expect(calls).toEqual([undefined, 'cursor-2']);

    const source = readFileSync(new URL('./CatalogItemDrawer.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/const productionTagCandidates = useCursorCandidates/);
    expect(source).toMatch(/resetKey: `\$\{itemCode \?\? ''\}\|\$\{queryContext\.scopeRef \?\? ''\}\|\$\{brandRef \?\? ''\}`/);
    expect(source).toMatch(/if \(cancelled \|\| result\.stale\) return;/);
  });

  it('keeps user-facing surfaces free of the implementation vocabulary', () => {
    const markup = [
      renderIdentifiers(['MNEMONIC'], [{...identifier(), identifierType: 'MNEMONIC'}]),
      renderPreparationProfile(),
      renderToStaticMarkup(
        <PreparationVariationSummary
          skus={[sku({preparationOverride: {mode: 'OVERRIDE', profile: profile()}})]}
          orderOptions={[optionConfig(null)]}
          shapeKey="SKU_VARIANT_SALE_COUNTED"
          onNavigateToOptions={() => undefined}
        />,
      ),
    ].join('\n');
    for (const forbidden of [
      'kind',
      'identifierRef',
      'normalizedValue',
      'ownerType',
      'INHERIT_ITEM',
      'OVERRIDE',
      'profile',
      'effect',
      'source',
      'problem code',
      'BARCODE',
      'PLU',
      'MNEMONIC',
    ]) {
      expect(markup).not.toContain(forbidden);
    }
    expect(markup).toContain('条码与标识');
    expect(markup).toContain('制作单显示名称');
    const source = readFileSync(new URL('./CatalogItemDrawer.tsx', import.meta.url), 'utf8');
    expect(source).toContain('增加制作时长（秒）');
    expect(source).toContain('追加制作说明');
  });

  it('keeps the whole-save invalidation policy exact for identification and preparation edits', () => {
    const policy = JSON.parse(
      readFileSync(
        new URL('../../../../../../../contracts/catalog/catalog-inventory-rtk-tag-policy.json', import.meta.url),
        'utf8',
      ),
    ) as {operations: Array<{operationId: string; invalidates: Array<{kind: string; id?: string; prefix?: string; path?: string}>}>};
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
