import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import type {CatalogInventoryEnvelope} from '../../../app/api/generated/catalog-inventory-edge';
import {decodeDetail, decodeNavigation} from '../model/catalogModel';

const workbench = await readFile(new URL('./CatalogWorkbenchPage.tsx', import.meta.url), 'utf8');
const detail = await readFile(new URL('./CatalogItemDrawer.tsx', import.meta.url), 'utf8');
const copy = await readFile(new URL('./BrandCatalogCopyDrawer.tsx', import.meta.url), 'utf8');
const localCopy = await readFile(new URL('./LocalCatalogCopyDrawer.tsx', import.meta.url), 'utf8');
const create = await readFile(new URL('./CatalogItemCreateDrawer.tsx', import.meta.url), 'utf8');
const dictionary = await readFile(new URL('./CatalogDictionaryDrawer.tsx', import.meta.url), 'utf8');
const model = await readFile(new URL('../model/catalogModel.ts', import.meta.url), 'utf8');

describe('catalog management focused contract', () => {
  it('keeps store and brand as distinct approved workbench surfaces', () => {
    expect(workbench).toContain('StoreCatalogManagementPage');
    expect(workbench).toContain('BrandCatalogManagementPage');
    expect(workbench).toContain('catalog-inventory-store-page');
    expect(workbench).toContain('catalog-inventory-brand-page');
    expect(workbench).toContain('catalog-inventory-view-switch');
    expect(workbench).toContain('catalog-inventory-brand-switch');
    expect(workbench).toContain('catalog-inventory-item-table');
    expect(workbench).toContain("editCatalogCapability = 'EDIT_CATALOG_LIBRARY'");
    expect(workbench).toContain("surface === 'store' && canWrite && context?.headCompanyRef && context.brandRef && context.copySourceAvailable");
    expect(workbench).not.toContain('导入');
    expect(workbench).not.toContain('导出');
    expect(workbench).not.toContain('当前库存');
  });

  it('uses generated operations and foundation behavior instead of routes or local lifecycle copies', () => {
    for (const source of [workbench, detail, copy, localCopy]) expect(source).toContain('catalogInventoryRtkRequest');
    expect(workbench).toContain('useAsyncGenerationGuard');
    expect(workbench).toContain('adminListState');
    expect(workbench).toContain('NameCodeText');
    expect(detail).toContain('useDrawerFormLifecycle');
    expect(detail).toContain('adminWideDrawerSurfaceProps');
    expect(copy).toContain('useSubmissionLifecycle');
    expect(copy).toContain('adminWideDrawerSurfaceProps');
    expect(model).toContain('CatalogInventoryEnvelope');
    for (const source of [workbench, detail, copy]) expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(workbench).toContain('queryGeneration');
    expect(workbench).toContain('next.queryGeneration !== queryGeneration');
    expect(model).toContain('queryGeneration: text(value.queryGeneration)');
  });

  it('keeps one wide view-edit drawer with manifest tabs and dirty protection', () => {
    expect(detail).toContain('catalog-inventory-item-drawer');
    expect(detail).toContain('catalog-item-dirty-discard');
    expect(detail).toContain('catalog-item-tabs');
    expect(detail).toContain('detail.tabs');
    expect(detail).toContain('expectedCatalogVersion: detail.item.version');
    expect(detail).toContain("'Idempotency-Key': lifecycle.getIdempotencyKey()");
  });

  it('keeps temporary-item promotion as a typed completion journey, not a direct status flip', () => {
    expect(detail).toContain('TemporaryPromotionPreflightRequest');
    expect(detail).toContain('expectedSourceVersion');
    expect(detail).toContain('preflightDigest');
    expect(detail).toContain('catalog-temporary-promotion-formal-code');
    expect(detail).toContain('catalog-temporary-promotion-shape');
    expect(detail).toContain('catalog-temporary-promotion-re-preflight');
    expect(detail).toContain('STALE_COPY_PREFLIGHT');
    expect(detail).toContain('formalCodeAvailable');
    expect(detail).not.toContain("targetStatus: 'DRAFT'");
  });

  it('renders typed external-order source facts and the immutable snapshot summary', () => {
    expect(detail).toContain('catalog-item-temporary-source-facts');
    for (const label of ['来源订单', '来源记录', '来源商品', '原始快照名称', '原始快照规格', '原始快照价格']) expect(detail).toContain(label);
    const decoded = decodeDetail({data: {item: {code: 'TEMP-001', name: '临时商品', source: 'TEMPORARY', externalIdentity: {sourceOrderRef: 'EXT-ORDER-001', sourceRecordRef: 'EXT-RECORD-001', sourceItemRef: 'EXT-SKU-88', snapshot: {name: '外部订单临时拿铁', specification: '中杯 / 热', price: 2800}}}, governance: {externalIdentity: null}}} as CatalogInventoryEnvelope);
    expect(decoded?.item.externalIdentity).toMatchObject({sourceOrderRef: 'EXT-ORDER-001', sourceRecordRef: 'EXT-RECORD-001', sourceItemRef: 'EXT-SKU-88', snapshot: {name: '外部订单临时拿铁', specification: '中杯 / 热', price: 2800}});
    const rawDecoded = decodeDetail({item: {code: 'LATTE-001', name: '拿铁', source: 'CATALOG', status: 'ENABLED', shapeKey: 'STANDARD_SALE_COUNTED'}, tabs: [{tabKey: 'basic', visible: true, disabled: false, reason: null}]} as CatalogInventoryEnvelope);
    expect(rawDecoded?.item.code).toBe('LATTE-001');
    expect(rawDecoded?.tabs).toHaveLength(1);
  });

  it('keeps brand copy owner-derived and preflight-gated', () => {
    expect(copy).toContain('getOperationsBrandCatalogCopyCandidates');
    expect(copy).toContain('preflightOperationsBrandCatalogCopy');
    expect(copy).toContain('executeOperationsBrandCatalogCopy');
    expect(copy).toContain('catalog-inventory-copy-preflight');
    expect(copy).toContain('preflight.blockingCount > 0 || !confirmed');
    expect(copy).toContain("(feedback.errorCode as string) === 'STALE_COPY_PREFLIGHT'");
    expect(copy).not.toContain('sourceDataNodeRef:');
  });

  it('keeps local copy bound to the approved preflight/execute contract', () => {
    expect(detail).toContain('catalog-item-copy-local-open');
    expect(localCopy).toContain('getOperationsLocalCatalogCopyCandidates');
    expect(localCopy).toContain('preflightOperationsLocalCatalogCopy');
    expect(localCopy).toContain('executeOperationsLocalCatalogCopy');
    expect(localCopy).toContain('catalog-local-copy-preflight');
    expect(localCopy).toContain('preflight.blockingCount > 0');
    expect(localCopy).toContain('expectedSourceVersion');
    expect(localCopy).toContain('expectedTargetVersion');
  });

  it('keeps local copy as the approved five-step, nine-scope, typed readback journey', () => {
    for (const step of ['source-scope', 'source-item', 'copy-scope', 'bom-mapping', 'preview']) expect(localCopy).toContain(`key: '${step}'`);
    for (const title of ['来源范围', '来源商品', '复制范围', 'BOM映射', '预览确认']) expect(localCopy).toContain(`title: '${title}'`);
    for (const scope of ['BASIC_INFO', 'SKU_STRUCTURE', 'SKU_BOM', 'ORDER_OPTIONS', 'OPTION_VALUE_BOM', 'ITEM_BOM', 'PACKAGE_STRUCTURE', 'PRODUCTION_PROMPTS', 'PRINT_NAME']) expect(model).toContain(`value: '${scope}'`);
    for (const removedScope of ['OPTION_RULES', 'INVENTORY_BOM', 'MEDIA', 'GOVERNANCE']) expect(localCopy).not.toContain(removedScope);
    expect(localCopy).toContain('catalog-local-copy-candidates-loading');
    expect(localCopy).toContain('catalog-local-copy-source-keyword');
    expect(localCopy).toContain('catalog-local-copy-preflight-loading');
    expect(localCopy).toContain('catalog-local-copy-mapping-loading');
    expect(localCopy).toContain('decodeLocalCopyPreflight');
    expect(localCopy).toContain('decodeLocalCopyReadback');
    expect(localCopy).toContain('catalog-local-copy-closure-items');
    expect(localCopy).toContain('catalog-local-copy-mapping-preview');
    expect(localCopy).toContain('catalog-local-copy-compatibility-results');
    expect(localCopy).toContain('catalog-local-copy-reference-rewrite-preview');
    expect(localCopy).toContain('catalog-local-copy-created');
    expect(localCopy).toContain('catalog-local-copy-reused');
    expect(localCopy).toContain('catalog-local-copy-skipped');
    expect(localCopy).toContain('catalog-local-copy-owner-readbacks');
    expect(localCopy).toContain('catalog-local-copy-target-versions');
    expect(localCopy).toContain('catalog-local-copy-open-target');
    expect(localCopy).toContain('STALE_COPY_PREFLIGHT');
    expect(localCopy).toContain('已保留，请重新生成预检');
    expect(localCopy).not.toContain('Object.entries');
    expect(model).toContain('LOCAL_COPY_SCOPE_OPTIONS');
    expect(model).toContain('decodeLocalCopyCandidatePage');
    expect(model).toContain('decodeLocalCopyPreflight');
    expect(model).toContain('decodeLocalCopyReadback');
    expect(model).toContain('parentCode?: string');
    expect(model).toContain('status?: string');
    expect(model).toContain('version?: number');
    expect(model).toContain('voidAvailability?: CatalogVoidAvailability');
  });

  it('retains typed category navigation owner facts when the edge returns them', () => {
    const envelope = {data: {tree: [{nodeRef: 'CAT-ROOT', label: '根类', code: 'CAT-ROOT', parentCode: null, status: 'ENABLED', version: 3, count: 2, countSemantics: 'SELF_ONLY', voidAvailability: {canVoid: false, blockingReferences: [{referenceKind: 'CATALOG_ITEM', referenceRef: 'ITEM-1'}], dependentFacts: []}}], smartViews: [], shapeCounts: [], generation: 7}} as CatalogInventoryEnvelope;
    const node = decodeNavigation(envelope).tree[0];
    expect(node.parentCode).toBeUndefined();
    expect(node).toMatchObject({nodeRef: 'CAT-ROOT', status: 'ENABLED', version: 3, countSemantics: 'SELF_ONLY', voidAvailability: {canVoid: false, blockingReferences: [{referenceKind: 'CATALOG_ITEM', referenceRef: 'ITEM-1'}]}});
  });

  it('rebuilds a voided category under its original parent instead of the voided code', () => {
    expect(workbench).toContain('rebuildParentCode?: string');
    expect(workbench).toContain('rebuildParentCode: rebuildNode.parentCode ??');
    expect(workbench).toContain('const parentCode = categoryAction.rebuildParentCode !== undefined');
    expect(workbench).toContain("categoryAction.rebuildParentCode ? '作废后重建子分类' : '作废后重建分类'");
  });

  it('keeps free-map attributes editable without inventing a schema', () => {
    expect(detail).toContain('catalog-item-edit-attributes');
    expect(detail).toContain('ATTRIBUTES_OBJECT_REQUIRED');
    expect(detail).toContain('attributes');
  });

  it('keeps order options and composite content aligned with the IA workbench', () => {
    expect(detail).toContain('catalog-item-order-options-groups');
    expect(detail).toContain('catalog-item-order-options-details');
    expect(detail).toContain('catalog-item-order-options-preview');
    expect(detail).toContain('catalog-item-order-options-validation');
    expect(detail).toContain('实时预览只反映当前草稿');
    expect(detail).toContain('CompositeCandidatePicker');
    expect(detail).toContain('catalog-item-composite-component-item');
    expect(detail).toContain('getOperationsCatalogNavigation');
    expect(detail).toContain('在选定分类中搜索商品名称或编码');
    expect(detail).toContain('加载下一页');
    expect(detail).not.toContain('Input addonBefore="组件商品" value={component.itemCode}');
  });

  it('keeps create and dictionary controls connected to generated owner operations', () => {
    expect(workbench).toContain('onClick={() => setCreateOpen(true)}');
    expect(workbench).toContain("setDictionaryKind('TAG'); setDictionaryOpen(true)");
    expect(create).toContain('createOperationsCatalogItem');
    expect(create).toContain('catalog-create-shape');
    expect(create).toContain('权益域尚未开放');
    expect(dictionary).toContain('getOperationsCatalogDictionary');
    expect(dictionary).toContain('createOperationsCatalogDictionaryEntry');
    expect(dictionary).toContain('createOperationsProductionTag');
    expect(dictionary).toContain('catalog-dictionary-tabs');
    expect(dictionary).toContain('quickManage');
    expect(dictionary).toContain('fulfillment-production');
    expect(dictionary).toContain('onCreated');
    expect(detail).toContain('catalog-production-tag-quick-manage');
    expect(detail).toContain('selectedProductionTagRefs');
    expect(detail).toContain('onProductionTagCreated');
    expect(detail).toContain('CatalogDictionaryDrawer');
    expect(detail).toContain('getOperationsProductionTags');
    expect(detail).toContain('MAX_MEDIA_COUNT = 6');
    expect(detail).toContain('MAX_MEDIA_BYTES = 2 * 1024 * 1024');
    expect(detail).toContain('stageOperationsCatalogAsset');
    expect(detail).toContain('releaseOperationsCatalogStagedAsset');
    expect(detail).toContain('expectedVersion: asset.version');
    expect(detail).toContain('staged: true');
    expect(detail).toContain('content: file');
    expect(detail).toContain('catalog-item-media-retry');
    expect(detail).toContain('catalog-item-media-replace');
    expect(detail).toContain('catalog-item-media-remove');
    expect(detail).toContain('catalog-item-media-set-primary');
    expect(detail).toContain('catalog-item-media-move-up');
    expect(detail).toContain('images: mediaDraft.filter');
    expect(workbench).toContain("setDictionaryKind('PRODUCTION_TAG')");
  });
});
