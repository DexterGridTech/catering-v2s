import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import type {CatalogInventoryEnvelope} from '../../../app/api/generated/catalog-inventory-edge';
import {requireOperationsScopeRef} from '../../../app/routing/model';
import {decodeBrandCopyReadback, decodeDetail, decodeNavigation, decodePreflight} from '../model/catalogModel';

const workbench = await readFile(new URL('./CatalogWorkbenchPage.tsx', import.meta.url), 'utf8');
const detail = await readFile(new URL('./CatalogItemDrawer.tsx', import.meta.url), 'utf8');
const assetPreview = await readFile(new URL('./CatalogAssetPreview.tsx', import.meta.url), 'utf8');
const copy = await readFile(new URL('./BrandCatalogCopyDrawer.tsx', import.meta.url), 'utf8');
const localCopy = await readFile(new URL('./LocalCatalogCopyDrawer.tsx', import.meta.url), 'utf8');
const create = await readFile(new URL('./CatalogItemCreateDrawer.tsx', import.meta.url), 'utf8');
const dictionary = await readFile(new URL('./CatalogDictionaryDrawer.tsx', import.meta.url), 'utf8');
const model = await readFile(new URL('../model/catalogModel.ts', import.meta.url), 'utf8');

describe('catalog management focused contract', () => {
  it('fails closed when a write request has no selected data-node scope', () => {
    expect(requireOperationsScopeRef({groupWorkspaceKey: 'workspace-1', expectedContextVersion: 3, scopeRef: 'store-1'})).toBe('store-1');
    expect(() => requireOperationsScopeRef({groupWorkspaceKey: 'workspace-1', expectedContextVersion: 3})).toThrow('OPERATIONS_DATA_NODE_SCOPE_REQUIRED');
    for (const source of [workbench, detail, copy, localCopy, create, dictionary]) expect(source).toContain('requireOperationsScopeRef');
  });

  it('binds the shape-manifest read to the selected data-node scope', () => {
    expect(create).toContain("getOperationsCatalogShapeManifest({}, {query: {dataNodeRef: queryContext.scopeRef ?? ''}, headers})");
    expect(create).toContain('{skip: !open || !queryContext.scopeRef}');
  });

  it('keeps store and brand as distinct approved workbench surfaces', () => {
    expect(workbench).toContain('StoreCatalogManagementPage');
    expect(workbench).toContain('BrandCatalogManagementPage');
    expect(workbench).toContain('catalog-inventory-store-page');
    expect(workbench).toContain('catalog-inventory-brand-page');
    expect(workbench).toContain('catalog-inventory-view-switch');
    expect(workbench).toContain('catalog-inventory-brand-switch');
    expect(workbench).toContain('catalog-inventory-item-table');
    expect(workbench).toMatch(/surface\s*===\s*'brand'\s*\?\s*'EDIT_HEAD_COMPANY_CATALOG'\s*:\s*'EDIT_STORE_CATALOG'/);
    expect(workbench).not.toContain('EDIT_CATALOG_LIBRARY');
    expect(workbench).toContain("surface === 'store' && canWriteCatalog && context?.headCompanyRef && context.brandRef && context.copySourceAvailable");
    expect(workbench).not.toContain('导入');
    expect(workbench).not.toContain('导出');
    expect(workbench).not.toContain('当前库存');
  });

  it('uses one bounded tree-and-table layout for both catalog surfaces', () => {
    expect(workbench).toContain("width: 312, flex: '0 0 312px'");
    expect(workbench).toContain('<Tree blockNode');
    expect(workbench).toContain('function CatalogTreeLine');
    expect(workbench).toContain("flex: '1 1 auto', minWidth: 0");
    expect(workbench).toContain('ellipsis={{tooltip: label}}');
    expect(workbench).toContain('count !== undefined && <Tag');
    expect(workbench.indexOf('count !== undefined && <Tag')).toBeLessThan(workbench.indexOf('Typography.Text ellipsis'));
    for (const icon of ['BulbOutlined', 'AppstoreOutlined', 'TagsOutlined', 'smartViewIcons', 'shapeIcons']) expect(workbench).toContain(icon);
    expect(workbench).toContain('icon={smartViewIcons[node.viewKey]');
    expect(workbench).toContain('icon={shapeIcons[node.shapeKey]');
    expect(workbench).toContain("marginLeft: 'auto'");
    expect(workbench).toContain('toolBarRender={() => selectedRows.length');
    expect(workbench).toContain('catalog-inventory-selection-summary');
    expect(workbench).toContain('tableAlertRender={false}');
    expect(workbench).toContain('tableAlertOptionRender={false}');
  });

  it('keeps inventory/BOM in the catalog item save under the catalog capability', () => {
    expect(workbench).toMatch(/const canWriteCatalog = \(actionCapabilityKeys as readonly string\[\]\)\.includes\(editCatalogCapability\)/);
    expect(workbench).toContain('surface === \'store\' && canWriteCatalog && context?.headCompanyRef');
    expect(workbench).toContain('canWriteCatalog={canWriteCatalog}');
    expect(workbench).not.toContain('EDIT_STORE_INVENTORY');

    expect(detail).toContain("if (visibleTabs.has('inventory-bom')) {");
    expect(detail).toContain("if (visibleTabs.has('inventory-bom')) catalogDraft.inventoryBom = inventoryBomDraft;");
    expect(detail).toContain("if (tabKey === 'inventory-bom' && editing) return <InventoryBomEditor");
    expect(detail).toContain("inventoryConfiguration: {nodes: visibleTabs.has('inventory-bom')");
    expect(detail).toContain("expectedInventoryVersions: visibleTabs.has('inventory-bom')");
    expect(detail).toContain('canWriteCatalog');
    expect(detail).not.toContain('canWriteInventory');
    expect(detail).not.toContain('EDIT_STORE_INVENTORY');

    for (const action of ['action?.canEdit', 'action?.canEnable', 'action?.canDisable', 'action?.canArchive']) {
      expect(detail).toContain(`canWriteCatalog && ${action}`);
    }
    expect(detail).toContain("surface === 'store' && mode === 'view' && canWriteCatalog");
    expect(detail).not.toMatch(/canWriteInventory\s*&&\s*action\?\.(canEdit|canEnable|canDisable|canArchive)/);
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

  it('resolves catalog image URLs only through the generated public asset operation', () => {
    expect(assetPreview).toContain('publicRtkRequest.getPublicAssetContent');
    expect(assetPreview).toContain('assetQuery.data?.publicUrl');
    expect(assetPreview).toContain('data-testid={testId ? `${testId}-retry` : undefined}');
    expect(assetPreview).toContain('重试加载');
    expect(assetPreview).toContain('图片不可用');
    expect(assetPreview).not.toMatch(/\/api\/public\/assets/);
    expect(workbench).toContain('catalog-item-thumbnail-');
    expect(detail).toContain('catalog-item-media-gallery-');
    expect(detail).toContain('catalog-item-media-preview-');
    expect(detail).toContain('catalog-item-drawer-thumbnail');
    expect(detail).toContain('catalog-item-sku-media-preview-');
    expect(detail).toContain('catalog-item-sku-media-readonly-');
    expect(detail).toContain('catalog-item-sku-media-upload-');
    expect(detail).toContain('catalog-item-sku-media-replace-');
    expect(detail).toContain('catalog-item-sku-media-remove-');
  });

  it('keeps one wide view-edit drawer with manifest tabs and dirty protection', () => {
    expect(detail).toContain('catalog-inventory-item-drawer');
    expect(detail).toContain('catalog-item-dirty-discard');
    expect(detail).toContain('catalog-item-tabs');
    expect(detail).toContain('detail.tabs');
    expect(detail).toContain('expectedCatalogVersion: detail.item.version');
    expect(detail).toContain("'Idempotency-Key': lifecycle.getIdempotencyKey()");
  });

  it('carries staged-asset bind grants only through the transient save header', () => {
    expect(detail).toContain('bindGrant?: string');
    expect(detail).toContain("'X-Catalog-Asset-Bind-Grants'");
    expect(detail).toContain('CATALOG_ASSET_STAGE_READBACK_MISSING');
    expect(detail).not.toContain('bindGrant: asset.bindGrant');
  });

  it('binds each staged asset request to the currently selected data node', () => {
    expect(detail.match(/stageOperationsCatalogAsset/g)).toHaveLength(2);
    expect(detail.match(/const body = \{dataNodeRef, fileName:/g)).toHaveLength(2);
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
    expect(copy).toContain('referenceMappings');
    expect(copy).toContain('targetSkuCode');
    expect(copy).toContain('targetOptionValueCode');
    for (const retiredField of ['mappingPreview', 'referenceRewritePreview', '.mappings', 'Object.entries', 'JSON.stringify', 'sourceRef', 'targetRef']) expect(copy).not.toContain(retiredField);
  });

  it('keeps brand-copy reference mappings label-only after decoding', () => {
    const preflight = decodePreflight({data: {preflightDigest: 'digest', selectedCount: 1, selectedLimit: 20, closureCount: 1, closureLimit: 500, blockingCount: 0, confirmationRequiredCount: 0, selectedItems: [], closureItems: [], objectVersions: [], compatibilityResults: [], referenceMappings: [{objectType: 'OPTION_VALUE_BOM', sourceRef: '11111111-1111-1111-1111-111111111111', targetRef: '22222222-2222-2222-2222-222222222222', targetCode: 'LATTE-001', targetSkuCode: 'LATTE-001-L', targetOptionValueCode: 'HOT'}]}} as CatalogInventoryEnvelope);
    expect(preflight?.referenceMappings).toEqual([{objectType: 'OPTION_VALUE_BOM', targetCode: 'LATTE-001', targetSkuCode: 'LATTE-001-L', targetOptionValueCode: 'HOT'}]);

    const readback = decodeBrandCopyReadback({data: {preflightDigest: 'digest', created: [], reused: [], targetVersions: [{targetRef: '33333333-3333-3333-3333-333333333333', version: 2}], ownerReadbacks: [], referenceMappings: [{objectType: 'SKU_BOM', sourceRef: '44444444-4444-4444-4444-444444444444', targetRef: '55555555-5555-5555-5555-555555555555', targetCode: 'LATTE-001', targetSkuCode: 'LATTE-001-L', targetOptionValueCode: null}]}} as CatalogInventoryEnvelope);
    expect(readback?.referenceMappings).toEqual([{objectType: 'SKU_BOM', targetCode: 'LATTE-001', targetSkuCode: 'LATTE-001-L'}]);
    expect(readback?.targetVersions).toEqual([{version: 2}]);
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
    expect(localCopy).toContain('catalog-local-copy-reference-mappings');
    expect(localCopy).toContain('catalog-local-copy-compatibility-results');
    expect(localCopy).toContain('referenceMappings');
    expect(localCopy).toContain('targetSkuCode');
    expect(localCopy).toContain('targetOptionValueCode');
    for (const retiredField of ['mappingPreview', 'closureEdges', 'referenceRewritePreview', '.mappings', 'sourceRef', 'targetRef']) expect(localCopy).not.toContain(retiredField);
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
    expect(model).toContain('parentCategoryRef: string | null');
    expect(model).toContain('categoryRef: string');
    expect(model).toContain('displayOrder: number');
    expect(model).toContain('deletionAvailability: CatalogCategoryDeletionAvailability');
  });

  it('keeps truthful category refs, versions and safe deletion availability from navigation', () => {
    const envelope = {data: {tree: [{categoryRef: 'a0f5f2c9-3e80-4e10-9ecf-a6d8186dfd49', code: 'CAT-ROOT', name: '根类', parentCategoryRef: null, version: 3, displayOrder: 0, count: 2, countSemantics: 'SELF_ONLY', deletionAvailability: {canDelete: false, subtreeSize: 2, blockingReferenceCount: 1, blockingReferenceLabels: ['烤鸡翅(APP-CHICKEN-WINGS-001)']}}], smartViews: [], shapeCounts: [], generation: 7}} as CatalogInventoryEnvelope;
    const node = decodeNavigation(envelope).tree[0];
    expect(node.parentCategoryRef).toBeNull();
    expect(node).toMatchObject({categoryRef: 'a0f5f2c9-3e80-4e10-9ecf-a6d8186dfd49', name: '根类', version: 3, displayOrder: 0, countSemantics: 'SELF_ONLY', deletionAvailability: {canDelete: false, subtreeSize: 2, blockingReferenceCount: 1, blockingReferenceLabels: ['烤鸡翅(APP-CHICKEN-WINGS-001)']}});
  });

  it('maps category management to distinct rename, reparent, ordering and delete commands', () => {
    for (const control of ['更换父分类', '向上移动', '向下移动', '删除分类']) expect(workbench).toContain(control);
    expect(workbench).toContain("action === 'REPARENT'");
    expect(workbench).toContain("? 'UP' : 'DOWN'");
    expect(workbench).toContain('deleteOperationsCatalogCategory');
    expect(workbench).toContain('categoryAction.node?.categoryRef');
    expect(workbench).toContain('deletionAvailability.blockingReferenceLabels');
    expect(workbench).toContain('function itemReferenceSummary');
    expect(workbench).toContain('生产标签 ${row.productionTagRefs.length}');
    expect(workbench).not.toContain('[...row.categoryRefs, ...row.productionTagRefs].slice(0, 2).join');
    expect(workbench).not.toContain('transitionOperationsCatalogCategoryStatus');
    expect(workbench).not.toContain('作废并重建');
    expect(workbench).not.toContain('重新启用');
    expect(workbench).not.toContain('停用分类');
    expect(detail).toContain('组件商品引用');
    expect(detail).toContain('itemRef: item.itemRef');
    expect(detail).toContain('attributeValueRef: globalThis.crypto.randomUUID()');
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

  it('keeps staged item replacement and SKU upload recoverable without changing owner or asset-preview boundaries', () => {
    expect(detail).toContain('const previousAsset = previous');
    expect(detail).not.toContain('mediaDraft.find((asset) => asset.id === id)?.previous');
    expect(detail).toContain('if (stagedMedia) await releaseStagedAsset(stagedMedia);');
    expect(detail).toContain("skuStagedMedia.some((asset) => asset.status === 'UPLOADING')");
    expect(detail).toContain("skuStagedMedia.some((asset) => asset.status === 'FAILED' && !asset.assetRef)");
    expect(detail).toContain("status: 'UPLOADING'");
    expect(detail).toContain("status: 'FAILED'");
    expect(detail).toContain('catalog-item-sku-media-status-');
    expect(detail).toContain('catalog-item-sku-media-retry-');
    expect(detail).toContain('catalog-item-sku-media-draft-remove-');
    expect(detail).toContain('CatalogAssetPreview assetRef={assetRef}');
    expect(detail).not.toMatch(/publicUrl|\/api\/public\/assets/);
  });

  it('keeps the Drawer open with a retryable recovery action when any staged asset release fails', () => {
    expect(detail).toContain('releaseStagedMedia([...mediaDraft, ...skuStagedMedia])');
    expect(detail).toContain('if (!released) {');
    expect(detail).toContain('setMediaDraft((current) => current.map((asset) => releasedIds.has(asset.id) ? {...asset, staged: false} : asset));');
    expect(detail).toContain('setSkuStagedMedia((current) => current.map((asset) => releasedIds.has(asset.id) ? {...asset, staged: false} : asset));');
    expect(detail).toContain('setReleaseCloseFailed(true);');
    expect(detail).toContain("setMediaProblem('图片资产释放未完成，请重试关闭。')");
    expect(detail).toContain('catalog-item-release-close-retry');
    expect(detail).toContain('closeAfterStagedRelease');
    expect(detail).not.toContain('void releaseStagedMedia([...mediaDraft, ...skuStagedMedia]); onClose();');
  });
});
