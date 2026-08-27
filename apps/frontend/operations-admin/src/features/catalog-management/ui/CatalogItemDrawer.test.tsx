import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {collectCursorPages} from '@catering-v2s/admin-ui-foundation';
import type {Uuid} from '../../../app/api/generated/catalog-inventory-edge';
import {
  decodeDetail,
  type CatalogOrderOptionConfig,
  type CatalogPreparationEffect,
  type CatalogCompositeGroup,
  type CatalogSkuRow,
} from '../model/catalogModel';
import {
  CATALOG_IDENTIFIER_PREPARATION_PROBLEM_CODES,
  CATALOG_IDENTIFICATION_PREPARATION_FEEDBACK,
  catalogIdentifierProblemFeedback,
} from '../model/catalogIdentificationPreparationFeedback';
import {PreparationProfileEditor} from './CatalogItemProductionEditor';
import {
  PreparationProfileReadOnly,
  PreparationVariationSummary,
  CompositeGroupsReadOnly,
  SkuMatrixReadOnly,
} from './CatalogItemReadOnlyPresenters';
import {IdentifierEditor, manifestIdentifierTypes} from './CatalogItemIdentifiersEditor';
import {
  buildAdditivePreparationEffect,
  catalogPreparationLayout,
  cloneSkuRows,
  skuPreparationOverrideForMode,
  type CatalogCompositeGroupDraft,
} from '../model/catalogItemEditorDraftAdapters';
import {catalogUiProblemFeedback} from '../model/catalogUiProblemFeedback';
import {CatalogItemCompositeEditor} from './CatalogItemCompositeEditor';

// The focused surfaces below do not mount ProList. Keep its unrelated CJS
// package boundary out of this SSR-oriented component test.
vi.mock('@ant-design/pro-components', () => ({ProList: () => null}));

const uuid = (value: string) => value as Uuid;
type IdentifierDraft = Parameters<typeof IdentifierEditor>[0]['values'][number];
type ProductionTagOption = NonNullable<Parameters<typeof PreparationProfileEditor>[0]['selectedTag']>;

const profile = (overrides: Partial<Parameters<typeof PreparationProfileEditor>[0]['profile']> = {}) => ({
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
  updatedAt: 0,
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

function renderIdentifiers(
  allowedTypes: Parameters<typeof IdentifierEditor>[0]['allowedTypes'],
  values: IdentifierDraft[] = [],
) {
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
      selectedTagRef={String(tag.tagRef)}
      selectedTag={tag}
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
    expect(renderIdentifiers([])).toContain('当前商品形态不提供识别方式');
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
    draft[0].mediaRefs.push(uuid('asset-2'));

    expect(original[0].identifiers[0].identifierValue).toBe('690100000001');
    expect(original[0].attributeValueRefs[0].valueLabel).toBe('中杯');
    expect(original[0].mediaRefs).toEqual([uuid('asset-1')]);
  });

  it('keeps the production tag singularly on the item and still shows a tag-only production fact', () => {
    const tag: ProductionTagOption = {
      tagRef: uuid('tag-hot-kitchen'),
      code: 'HOT_KITCHEN',
      name: '热厨制作',
      owner: 'FULFILLMENT_PRODUCTION',
      status: 'ENABLED',
    };
    const specificationMarkup = renderToStaticMarkup(
      <PreparationProfileEditor
        profile={profile()}
        showProductionTag={false}
        onChange={() => undefined}
        onDirty={() => undefined}
      />,
    );
    const tagOnlyMarkup = renderToStaticMarkup(<PreparationProfileReadOnly profile={null} tag={tag} />);

    expect(specificationMarkup).not.toContain('生产标签');
    expect(specificationMarkup).not.toContain('catalog-item-production-tags');
    expect(tagOnlyMarkup).toContain('生产标签');
    expect(tagOnlyMarkup).toContain('热厨制作');
    expect(tagOnlyMarkup).not.toContain('尚未设置制作信息');
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

  it('keeps an unmapped owner reason instead of replacing it with a generic retry', () => {
    expect(
      catalogUiProblemFeedback(
        {
          status: 422,
          data: {
            title: '商品与库存操作失败',
            detail: '商品分类最多只能建立三级',
            errorCode: 'CATEGORY_DEPTH_EXCEEDED',
          },
        },
        '分类操作未完成，请重试。',
      ),
    ).toEqual({message: '商品分类最多只能建立三级', known: false});
  });

  it('uses the shared debounced cursor lifecycle only for category search while preserving lazy tree loading', () => {
    const source = readFileSync(new URL('./useCatalogCategoryCandidates.tsx', import.meta.url), 'utf8');
    expect(source).toContain('const searchCandidates = useCursorCandidates<Candidate>');
    expect(source).toContain('searchCandidates.debouncedQueryText');
    expect(source).toContain('const onSearch = useCallback((value: string) => setSearchValue(value), []);');
    expect(source).toContain('const loadChildren = useCallback');
    expect(source).not.toMatch(/const onSearch[\s\S]{0,160}readPage/);
  });

  it('passes basic and production facts as typed draft slices rather than one callback per field', () => {
    const assembler = readFileSync(new URL('./CatalogItemEditorSectionAssembler.tsx', import.meta.url), 'utf8');
    const workspace = readFileSync(new URL('./useCatalogItemEditorWorkspaceState.tsx', import.meta.url), 'utf8');
    const adapters = readFileSync(new URL('../model/catalogItemEditorDraftAdapters.ts', import.meta.url), 'utf8');
    const basic = readFileSync(new URL('./CatalogItemBasicEditor.tsx', import.meta.url), 'utf8');
    const production = readFileSync(new URL('./CatalogItemProductionEditor.tsx', import.meta.url), 'utf8');

    expect(assembler).toContain('basicDraft={basicDraft}');
    expect(assembler).toContain('productionDraft={productionDraft}');
    expect(assembler).not.toContain('onSalesUnitRefChange=');
    expect(assembler).not.toContain('onProductionTagChange=');
    expect(workspace).toContain('values: selectCatalogItemBasicDraft(draft)');
    expect(workspace).toContain('values: selectCatalogItemProductionDraft(draft)');
    expect(workspace).not.toContain('selectedSalesUnitRef: draft.selectedSalesUnitRef');
    expect(workspace).not.toContain('selectedProductionTagRef: draft.selectedProductionTagRef');
    expect(adapters).toContain('function selectCatalogItemBasicDraft');
    expect(adapters).toContain('function selectCatalogItemProductionDraft');
    expect(workspace).toContain("updateFields(patch, 'basic')");
    expect(workspace).toContain("updateFields(patch, 'production-prompts')");
    expect(basic).toContain('basicDraft.onChange({selectedSalesUnitRef: next})');
    expect(production).toContain('productionDraft.onChange({selectedProductionTagRef: next})');
  });

  it('keeps first-level task ownership in the workbench and gives SKU sub-editors stable identity', () => {
    const drawerSource = readFileSync(new URL('./CatalogItemDrawer.tsx', import.meta.url), 'utf8');
    const editorSource = readFileSync(new URL('./CatalogItemSkuSpecificationsEditor.tsx', import.meta.url), 'utf8');
    expect(drawerSource).toContain('CatalogItemEditorDrawer');
    expect(drawerSource).not.toContain('useState');
    expect(drawerSource).not.toContain('LocalCatalogCopyDrawer');
    expect(editorSource).toContain('identifierModalEditorId');
    expect(editorSource).toContain('preparationModalEditorId');
    expect(editorSource).toContain('updateSku(identifierModalEditorId, {identifiers})');
    expect(editorSource).toContain('updateSku(preparationModalEditorId, {preparationOverride})');
    expect(editorSource).not.toMatch(/updateSku\((?:identifierModalIndex|preparationModalIndex)/);
  });

  it('keeps the editor open when maintaining metadata and retires the transition-persistence path', () => {
    const workspace = readFileSync(new URL('./CatalogItemEditorWorkspace.tsx', import.meta.url), 'utf8');
    const state = readFileSync(new URL('./useCatalogItemEditorWorkspaceState.tsx', import.meta.url), 'utf8');
    const dictionaryState = readFileSync(new URL('./CatalogDictionaryDrawerState.tsx', import.meta.url), 'utf8');
    const configurationSurface = readFileSync(
      new URL('./CatalogConfigurationDrawerSurface.tsx', import.meta.url),
      'utf8',
    );
    const coordinator = readFileSync(
      new URL('./controllers/useCatalogWorkbenchTaskCoordinator.tsx', import.meta.url),
      'utf8',
    );
    const content = readFileSync(new URL('./CatalogWorkbenchContent.tsx', import.meta.url), 'utf8');
    const childTask = readFileSync(new URL('../model/catalogEditorChildTask.ts', import.meta.url), 'utf8');
    const openChild = state.match(/const openCatalogConfig[\s\S]*?const closeConfiguration/u)?.[0] ?? '';

    expect(workspace).toContain('<CatalogDictionaryDrawer');
    expect(workspace).toContain('presentation="EDITOR_CHILD"');
    expect(workspace).toContain('keyboard={!state.lifecycleSubmitting}');
    expect(workspace).toContain('onAfterClose={state.afterConfigurationClose}');
    expect(state).toContain('catalogEditorChildTaskReducer');
    expect(state).toContain('catalogEditorCanClose(configurationTask)');
    expect(state).toContain('catalogEditorChildCloseResult(configurationTask)');
    expect(childTask).toContain('CATALOG_EDITOR_CHILD_TASK_CLOSE_REQUIRED');
    expect(childTask).toContain('export function catalogEditorCanClose');
    expect(childTask).toContain('export function catalogEditorChildCloseResult');
    expect(openChild).toContain("dispatchConfigurationTask({type: 'OPEN_CONFIG'");
    expect(openChild).not.toContain('persistCurrentDraft');
    expect(openChild).not.toContain('onOpenCatalogConfig');
    expect(openChild).not.toContain('sessionStorage');
    expect(state).toContain('const afterConfigurationClose = useCallback');
    expect(state).toContain('pendingConfigurationFocusTestId.current');
    expect(openChild).not.toContain('focus()');
    expect(dictionaryState).toContain('onAfterClose?: () => void');
    expect(dictionaryState).toContain('onAfterClose={onAfterClose}');
    expect(configurationSurface).toContain('if (!visible && !open) onAfterClose?.();');
    expect(coordinator).not.toContain('onOpenCatalogConfig');
    expect(content).not.toContain('商品编辑已暂停');
    expect(content).not.toContain('继续编辑');
  });

  it('keeps the saved-product view free of SKU governance controls', () => {
    const source = readFileSync(new URL('./CatalogItemSkuSpecificationsView.tsx', import.meta.url), 'utf8');
    expect(source).toContain('canWriteCatalog={false}');
    expect(source).not.toContain('onVoidSku=');
    const markup = renderToStaticMarkup(
      <SkuMatrixReadOnly
        dimensions={[]}
        skus={[
          sku({
            productSkuRef: uuid('sku-view-only'),
            skuCode: 'SKU-VIEW-ONLY',
            skuName: '查看规格',
            voidAvailability: {canVoid: false, blockingReferences: [], dependentFacts: [], blockingReasons: []},
          }),
        ]}
        summary={{enabledCount: 1, nonArchivedCount: 1, totalCount: 1, dimensions: []}}
        priceGranularity="SKU"
        canWriteCatalog={false}
      />,
    );
    expect(markup).not.toContain('作废规格');
    expect(markup).not.toContain('disabled');
  });

  it('keeps an opened item identity-bound while a detail request settles', () => {
    const viewSource = readFileSync(new URL('./CatalogItemViewDrawer.tsx', import.meta.url), 'utf8');
    const sessionSource = readFileSync(new URL('../model/useCatalogItemEditorSession.ts', import.meta.url), 'utf8');
    expect(viewSource).toContain(
      'selectCatalogDetailForItem(viewedItemCode, detailQuery.currentData, detailQuery.data)',
    );
    expect(viewSource).toContain('setViewedItemCode(code)');
    expect(viewSource).toContain('detailQuery.isError ? undefined');
    expect(sessionSource).toContain('selectCatalogDetailForItem(itemCode, detailQuery.currentData, detailQuery.data)');
    expect(sessionSource).toContain('detailQuery.isError ? undefined');
    expect(viewSource).toContain('detailQuery.isLoading && !detail');
    expect(viewSource).toContain('onOpenReferencedItem={code => {');
    expect(viewSource).toContain("setActiveTab('basic')");
  });

  it('lets the catalog owner, rather than a client-side shape guess, provide package-content candidates', () => {
    const source = readFileSync(new URL('./CatalogItemCompositeEditor.tsx', import.meta.url), 'utf8');

    expect(source).toContain("candidateUsage: 'COMPOSITE_COMPONENT'");
    expect(source).toContain('excludeItemCode: currentItemCode');
    expect(source).toContain('currentItemCode,');
    expect(source).toContain('const selectableItems = candidateState.items');
    expect(source).not.toContain('filter(item => item.code !== currentItemCode)');
  });

  it('decodes the detail contract without importing list-only projections', () => {
    const detail = decodeDetail({
      revision: 'test',
      requestId: 'request-test',
      data: {
        item: {
          itemRef: 'item-1',
          code: 'DETAIL-ONLY',
          name: '详情商品',
          shortName: null,
          materialRole: null,
          categoryRef: null,
          categoryPathLabels: ['餐饮', '饮品'],
          productionTagRef: null,
          tagRefs: [],
          shapeKey: 'STANDARD_SALE_COUNTED',
          itemKind: 'STANDARD',
          measureMode: 'COUNT',
          usageCapabilities: [],
          images: [],
          primaryImageAssetRef: null,
          salesUnitRef: null,
          baseMeasureUnitRef: null,
          salesUnit: null,
          baseMeasureUnit: null,
          identifiers: [],
          skuVariantDimensions: [],
          skus: [],
          skuSummary: {enabledCount: 0, nonArchivedCount: 0, totalCount: 0, dimensions: []},
          standardSalePrice: null,
          priceGranularity: 'ITEM',
          attributeAssignments: [],
          orderOptionConfigs: [],
          compositeGroups: [],
          preparationProfile: null,
          lifecycle: {status: 'DRAFT', version: 1, source: 'CATALOG'},
          source: 'CATALOG',
          externalIdentity: null,
          version: 1,
          updatedAt: 0,
        },
        tabs: [],
        references: [],
        inventoryRules: {nodes: []},
        productionTags: [],
        compositeGroups: [],
        governance: {deniedFields: [], externalIdentity: null},
        actionAvailability: {canEdit: true, canEnable: true, canDisable: false, canArchive: false},
        deniedFields: [],
        fieldOwnership: {catalog: 'CATALOG', inventory: 'INVENTORY', asset: 'ASSET'},
        queryIdentity: {dataNodeRef: 'scope-1', generation: 'generation-1'},
      },
    } as never);
    expect(detail?.item.code).toBe('DETAIL-ONLY');
    expect(detail?.item.categoryPathLabels).toEqual(['餐饮', '饮品']);
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
      {instruction: '最后加冰', preparationSecondsDelta: 10},
    );
    expect(next).toMatchObject({
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
        {instruction: '', preparationSecondsDelta: null},
      ),
    ).toBeNull();
  });

  it('keeps production-tag candidate pagination and stale-query isolation bounded by the cursor', async () => {
    const calls: Array<string | undefined> = [];
    const pages = new Map<string | undefined, {items: ProductionTagOption[]; nextCursor?: string}>([
      [
        undefined,
        {
          items: [{tagRef: uuid('tag-1'), code: 'HOT', name: '热厨制作', owner: 'FULFILLMENT_PRODUCTION'}],
          nextCursor: 'cursor-2',
        },
      ],
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

    const source = readFileSync(new URL('./CatalogItemProductionEditor.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/const candidates = useCursorCandidates/);
    expect(source).toMatch(/resetKey: `\$\{scopeRef \?\? ''\}\|\$\{brandRef \?\? ''\}`/);
    expect(source).toMatch(/usage: 'BINDABLE_CANDIDATE'/);
    expect(source).toMatch(/status !== undefined && tag\.status !== 'ENABLED'/);
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
      '商品类型',
    ]) {
      expect(markup).not.toContain(forbidden);
    }
    expect(markup).toContain('条码与标识');
    expect(markup).toContain('制作单显示名称');
    const productionSource = readFileSync(new URL('./CatalogItemProductionEditor.tsx', import.meta.url), 'utf8');
    const optionSource = readFileSync(new URL('./CatalogItemOrderOptionsEditor.tsx', import.meta.url), 'utf8');
    expect(productionSource).toContain('生产标签');
    expect(optionSource).toContain('增加制作时长（秒）');
    expect(optionSource).toContain('追加制作说明');
  });

  it('keeps the whole-save invalidation policy exact for identification and preparation edits', () => {
    const policy = JSON.parse(
      readFileSync(
        new URL('../../../../../../../contracts/catalog/catalog-inventory-rtk-tag-policy.json', import.meta.url),
        'utf8',
      ),
    ) as {
      operations: Array<{
        operationId: string;
        invalidates: Array<{kind: string; id?: string; prefix?: string; path?: string}>;
      }>;
    };
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

  it('presents a package as groups and business content, not codes or persisted enum values', () => {
    const groups: CatalogCompositeGroup[] = [
      {
        groupCode: 'MAIN',
        groupName: '主菜',
        selectionRule: 'SINGLE',
        minSelections: 1,
        maxSelections: 1,
        displayOrder: 0,
        components: [
          {
            itemCode: 'MAIN-STEAK-SIRLOIN',
            itemName: '西冷牛排',
            itemRef: uuid('item-steak'),
            productSkuRef: uuid('sku-medium'),
            skuCode: 'STEAK-MEDIUM',
            skuName: '七分熟',
            quantity: '1',
            unit: '份',
            default: true,
            extraPrice: 600,
            status: 'ENABLED',
            displayOrder: 0,
          },
        ],
      },
    ];

    const markup = renderToStaticMarkup(<CompositeGroupsReadOnly values={groups} />);
    expect(markup).toContain('主菜');
    expect(markup).toContain('任选一项');
    expect(markup).toContain('西冷牛排');
    expect(markup).toContain('七分熟');
    expect(markup).toContain('数量：1 份');
    expect(markup).toContain('加价：¥6.00');
    expect(markup).toContain('默认内容');
    expect(markup).not.toContain('MAIN-STEAK-SIRLOIN');
    expect(markup).not.toContain('STEAK-MEDIUM');
    expect(markup).not.toContain('SINGLE');
  });

  it('uses a group-and-content task surface for package editing instead of a wide technical components table', () => {
    const values: CatalogCompositeGroupDraft[] = [
      {
        editorId: 'group-1',
        groupCode: 'MAIN',
        groupName: '主菜',
        selectionRule: 'SINGLE',
        minSelections: 1,
        maxSelections: 1,
        displayOrder: 0,
        components: [
          {
            editorId: 'component-1',
            itemCode: '',
            itemName: '',
            itemRef: uuid('item-1'),
            productSkuRef: null,
            skuCode: null,
            skuName: null,
            quantity: '1',
            unit: '份',
            default: false,
            extraPrice: null,
            status: 'ENABLED',
            displayOrder: 0,
          },
        ],
      },
    ];
    const markup = renderToStaticMarkup(
      <CatalogItemCompositeEditor
        mode="edit"
        shapeKey="COMPOSITE"
        values={values}
        readOnlyValues={[]}
        onChange={() => undefined}
        onDirty={() => undefined}
        queryContext={{
          groupWorkspaceKey: 'workspace-test',
          expectedContextVersion: 1,
          scopeRef: uuid('00000000-0000-4000-8000-000000000001'),
        }}
        version={1}
        createDraftRowId={prefix => `${prefix}-new`}
      />,
    );

    expect(markup).toContain('套餐分组');
    expect(markup).toContain('添加内容');
    expect(markup).toContain('选择商品');
    expect(markup).toContain('规格');
    expect(markup).toContain('默认内容');
    const source = readFileSync(new URL('./CatalogItemCompositeEditor.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain('scroll={{x: 1336}}');
    expect(source).toContain('title="选择套餐内容"');
  });
});
