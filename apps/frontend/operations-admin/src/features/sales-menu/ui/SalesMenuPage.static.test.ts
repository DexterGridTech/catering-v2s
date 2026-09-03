import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const source = readFileSync(new URL('./SalesMenuPage.tsx', import.meta.url), 'utf8');
const draftTableSource = source.slice(
  source.indexOf('function DraftSalesItemTable'),
  source.indexOf('function PublishedSalesItemTable'),
);
const candidateDrawerSource = source.slice(
  source.indexOf('function SalesMenuCandidateDrawer'),
  source.indexOf('function SalesMenuManagerDrawer'),
);
const editorSource = source.slice(
  source.indexOf('function SalesMenuItemEditorDrawer'),
  source.indexOf('function SalesMenuCandidateDrawer'),
);
const detailSource = source.slice(
  source.indexOf('function SalesMenuItemDetailDrawer'),
  source.indexOf('function SalesMenuItemEditorDrawer'),
);
const mediaSource = source.slice(
  source.indexOf('function SalesMenuMediaEditor'),
  source.indexOf('function SalesMenuItemDetailDrawer'),
);
const candidateSource = source.slice(
  source.indexOf('function SalesMenuCandidateDrawer'),
  source.indexOf('function SalesMenuManagerDrawer'),
);
const managerSource = source.slice(
  source.indexOf('function SalesMenuManagerDrawer'),
  source.indexOf('function SalesMenuSectionPanel'),
);
const sectionSource = source.slice(
  source.indexOf('function SalesMenuSectionPanel'),
  source.indexOf('function DraftSalesItemTable'),
);
const publishedSource = source.slice(
  source.indexOf('function PublishedSalesItemTable'),
  source.indexOf('function SalesMenuOperationTable'),
);
const operationSource = source.slice(
  source.indexOf('function SalesMenuOperationTable'),
  source.indexOf('function PublishDrawer'),
);
const publishSource = source.slice(
  source.indexOf('function PublishDrawer'),
  source.indexOf('export function SalesMenuPage'),
);
const pageSource = source.slice(source.indexOf('export function SalesMenuPage'));

const traceSources = {
  all: source,
  page: pageSource,
  detail: detailSource,
  editor: editorSource,
  media: mediaSource,
  candidate: candidateSource,
  manager: managerSource,
  section: sectionSource,
  draft: draftTableSource,
  published: publishedSource,
  operation: operationSource,
  publish: publishSource,
};

const uiTrace: Array<[string, keyof typeof traceSources, string[]]> = [
  [
    'UI-01',
    'page',
    ['<div {...testId(salesMenuTestIds.page)} data-scope-ref={queryContext.scopeRef}>', '门店销售菜单'],
  ],
  ['UI-02', 'section', ['<Card', 'title="销售分区"', '新建分区', 'testId(salesMenuTestIds.sectionList)']],
  [
    'UI-03',
    'section',
    ["sectionMenuAction(section.salesSectionRef, 'up')", "onMove(section, event.key === 'up' ? 'UP' : 'DOWN')"],
  ],
  ['UI-04', 'section', ["sectionMenuAction(section.salesSectionRef, 'delete')", 'onDelete(section)']],
  [
    'UI-05',
    'candidate',
    ['title="添加商品到菜单"', 'const submit = useCallback', 'const added = await onAdd(selected);'],
  ],
  ['UI-06', 'editor', ['编辑销售项', 'onClick={() => void save()}', '保存']],
  [
    'UI-07',
    'editor',
    ['onDelete(detail, stagedReleaseRef.current)', '删除销售项', 'testId(salesMenuTestIds.itemEditor)'],
  ],
  ['UI-08', 'draft', ["title: '商品形态'", 'salesMenuProductShapeLabel(row.productShape)']],
  ['UI-09', 'media', ["title: '展示图片'", '<AdminImageCollectionEditor', 'onStageMedia={stageMedia}']],
  [
    'UI-10',
    'editor',
    ['称重销售商品不显示按份定义的起售量与订购倍数。', "const isWeighted = item.saleContent.kind === 'WEIGHTED'"],
  ],
  [
    'UI-11',
    'draft',
    [
      'SALES_MENU_OPERATION_COLUMN_TITLE',
      "itemMenuAction(row.salesItemRef, 'up')",
      "itemMenuAction(row.salesItemRef, 'down')",
    ],
  ],
  ['UI-12', 'page', ['catalogItemRefs: refs', "setFeedback({type: 'success', message: '商品已添加到菜单。'})"]],
  [
    'UI-13',
    'candidate',
    ['<Col xs={24} md={7}>', 'title="商品分类"', 'treeData={categoryTreeData}', 'read.candidates.cursor.reset()'],
  ],
  ['UI-14', 'candidate', ["title: '中文商品形态'", 'salesMenuProductShapeLabel(row.productShape)']],
  ['UI-15', 'published', ["title: '商品形态'", 'salesMenuProductShapeLabel(row.productShape)']],
  ['UI-16', 'draft', ['title="草稿销售项"', "title: '销售约束'"]],
  ['UI-17', 'operation', ['title="操作记录"', 'testId(salesMenuTestIds.operationLog)']],
  ['UI-18', 'operation', ['salesMenuOperationLabel(row.operationKind)', 'SALES_MENU_OPERATION_COLUMN_TITLE']],
  [
    'UI-19',
    'published',
    ["title: '销售状态'", 'salesMenuManualSaleStatusLabel(row.manualSaleStatus)', 'onStatus(row)'],
  ],
  ['UI-20', 'page', ['生效与时段', '更新到前台', '同一经营入口可以同时启用多份菜单']],
  [
    'UI-21',
    'draft',
    ['SALES_MENU_OPERATION_COLUMN_TITLE', "testId(salesMenuTestIds.itemAction(row.salesItemRef, 'menu'))"],
  ],
  ['UI-22', 'editor', ['onDelete(detail, stagedReleaseRef.current)', '删除销售项']],
  ['UI-23', 'editor', ['onClick={lifecycle.requestClose}', '关闭']],
  [
    'UI-24',
    'manager',
    ["managerAction(row.salesMenuRef, 'toggle')", "row.activation?.status === 'ENABLED' ? '停用' : '启用'"],
  ],
  ['UI-25', 'all', ['commands.copy(', "managerAction(row.salesMenuRef, 'copy')"]],
  ['UI-26', 'page', ['菜单已停用。', 'commands.activate(']],
  ['UI-27', 'editor', ["title: '商品默认价'", "title: '菜单挂牌价'"]],
  ['UI-28', 'editor', ["const isSku = item.saleContent.kind === 'SKU_SELECTION'", 'salesMenuTestIds.itemListedPrice']],
  ['UI-29', 'page', ["salesMenuTestIds.mode('PUBLISHED')", "value: 'PUBLISHED'", '<PublishedSalesItemTable']],
  ['UI-30', 'detail', ['title="销售项详情"', '<Descriptions', '适用约束']],
  ['UI-31', 'all', ['testIdPrefix={salesMenuTestIds.draftCursor}', 'testIdPrefix={salesMenuTestIds.logCursor}']],
];

describe('sales menu IA static trace', () => {
  it('uses the shared cursor surface independently for all seven required collections', () => {
    expect((source.match(/<CursorPagination/g) ?? []).length).toBe(7);
    for (const prefix of [
      'pageCursor',
      'selectorCursor',
      'managerCursor',
      'candidateCursor',
      'draftCursor',
      'publishedCursor',
      'logCursor',
    ]) {
      expect(source).toContain(`salesMenuTestIds.${prefix}`);
    }
    expect(source).toContain('MEDIA_LIMITS = {maxImageCount: 6, maxImageBytes: 2 * 1024 * 1024}');
  });

  it('keeps the front table read-only with separate inventory and sale-status surfaces', () => {
    expect(source).toContain("title: '库存状态'");
    expect(source).toContain("title: '销售状态'");
    expect(source).toContain('salesMenuInventoryAvailabilityLabel(row.inventoryAvailability)');
    expect(source).toContain('salesMenuManualSaleStatusLabel(row.manualSaleStatus)');
    expect(source).not.toContain("dataIndex: 'operationKind'");
  });

  it('keeps the draft table and candidate drawer at the approved IA denominator', () => {
    for (const title of ['菜单商品', '商品形态', '销售规格', '挂牌价', '销售约束'])
      expect(draftTableSource).toContain(`title: '${title}'`);
    expect(draftTableSource).toContain('SALES_MENU_OPERATION_COLUMN_TITLE');
    expect(draftTableSource).not.toContain('销售内容');
    expect(draftTableSource).not.toContain('展示图片');
    expect(draftTableSource).not.toContain('查看详情');
    expect(draftTableSource).not.toContain('删除销售项');
    for (const title of ['商品名称', '商品编码', '中文商品形态', '所属分类', '默认价格'])
      expect(candidateDrawerSource).toContain(`title: '${title}'`);
    expect(candidateDrawerSource).toContain('row.categoryNames');
    expect(candidateDrawerSource).toContain('row.defaultPriceCents');
    expect(candidateDrawerSource).toContain('hiddenSelectedCount');
    expect(candidateDrawerSource).toContain('清除不可见选择');
    expect(candidateDrawerSource).toContain('categoryNavigation?.tree');
    expect(candidateDrawerSource).toContain('title="商品分类"');
  });

  it('retains candidate selection across cursor pages and makes off-page submission explicit', () => {
    expect(candidateDrawerSource).toContain('preserveSelectedRowKeys: true');
    expect(candidateDrawerSource).toContain('mergeSalesMenuCandidateSelection(');
    expect(candidateDrawerSource).toContain('提交按钮会包含这些已选商品');
    expect(candidateDrawerSource).toContain('setSelected([])');
  });

  it('gives each sales-menu selector option a stable business-identity test id', () => {
    expect(source).toContain('salesMenuTestIds.menuOption(menu.salesMenuRef)');
  });

  it('uses generated exact invalidation for command readback and keeps broad refresh user initiated', () => {
    expect(pageSource).toContain('const result = await operation();\n        after?.(result);');
    expect(pageSource).toContain('onClick={() => void read.refresh()}');
    expect(pageSource).not.toMatch(/const result = await operation\(\);\s*await read\.refresh\(\);/);
    expect(pageSource).not.toMatch(/await commands\.updateItem\([\s\S]*?\);\s*await read\.refresh\(\);/);
    expect(pageSource).not.toMatch(/await commands\.addItems\([\s\S]*?\);\s*await read\.refresh\(\);/);
    expect(sectionSource).toContain('gap: 4, minWidth: 0');
    expect(sectionSource).toContain("flex: '1 1 auto',");
    expect(sectionSource).toContain("textOverflow: 'ellipsis'");
  });

  it('hydrates the editor from the owner draft-item detail operation', () => {
    expect(editorSource).toContain('operationsAdminRtkRequest.getOperationsSalesMenuDraftItem(');
    expect(editorSource).toContain('useGetOperationsSalesMenuDraftItemQuery');
    expect(editorSource).toContain('if (detailQuery.isError || detailQuery.isFetching) return undefined;');
    expect(editorSource).toContain('const current = detailQuery.currentData;');
    expect(editorSource).toContain('current.salesItemRef === rowItem.salesItemRef');
    expect(editorSource).toContain('if (!detail || !open) return;');
    expect(editorSource).toContain("outcome: 'SKIPPED_DIRTY_DRAFT'");
    expect(editorSource).toContain('if (lifecycle.dirty)');
    expect(editorSource).toContain('disabled={!detail || mediaPending || closing}');
  });

  it('does not expose stale manager versions while the manager read model refreshes', () => {
    expect(managerSource).toContain(
      'const managerReadModelReady = !read.manager.query.isFetching && !read.manager.query.isError;',
    );
    expect(managerSource).toContain('disabled={!canEdit || row.archived || !managerReadModelReady}');
    expect(managerSource).toContain('disabled={!managerReadModelReady}');
  });

  it('hydrates published read-only detail from the owner published-item operation', () => {
    expect(detailSource).toContain('operationsAdminRtkRequest.getOperationsSalesMenuPublishedItem(');
    expect(detailSource).toContain('useGetOperationsSalesMenuPublishedItemQuery');
    expect(detailSource).toContain('if (publishedDetailQuery.isError) return undefined;');
    expect(detailSource).toContain('current.salesItemRef === publishedRow.salesItemRef');
    expect(detailSource).toContain('正在读取前台销售项详情');
    expect(detailSource).toContain('前台销售项详情暂时无法获取');
    expect(detailSource).not.toContain('onStatus');
    expect(pageSource).toContain('channelRef={selectedChannelRef}');
  });

  it('centralizes sales-menu locators and records every approved UI trace item', () => {
    expect(source).not.toMatch(/testId\('sales-menu-/);
    expect(uiTrace).toHaveLength(31);
    for (const [requirement, segment, anchors] of uiTrace) {
      expect(requirement).toMatch(/^UI-(0[1-9]|[12][0-9]|3[01])$/);
      for (const anchor of anchors)
        expect(traceSources[segment], `${requirement} missing ${anchor} in ${segment}`).toContain(anchor);
    }
  });

  it('exposes stable ids for every interactive control used by the current L2 journeys', () => {
    for (const anchor of [
      'testId(salesMenuTestIds.section(section.salesSectionRef))',
      'testId(salesMenuTestIds.sectionAction(section.salesSectionRef))',
      "testId(salesMenuTestIds.sectionMenuAction(section.salesSectionRef, 'rename'))",
      'testId(salesMenuTestIds.menuPublish)',
      'testId(salesMenuTestIds.menuCreate)',
      "testId(salesMenuTestIds.itemMenuAction(row.salesItemRef, 'up'))",
      "testId(salesMenuTestIds.managerAction(row.salesMenuRef, 'menu'))",
      "testId(salesMenuTestIds.managerAction(row.salesMenuRef, 'rename'))",
      'testId(salesMenuTestIds.candidateRow(row.candidateRef))',
      'testId(salesMenuTestIds.menuSchedule)',
      'testId(salesMenuTestIds.menuPublish)',
      'testId(salesMenuTestIds.itemDiscardConfirm)',
      'testId(salesMenuTestIds.itemDiscardCancel)',
      "testId(salesMenuTestIds.itemMediaChoice('CUSTOM'))",
      'testId(salesMenuTestIds.statusAction(row.salesItemRef))',
    ]) {
      expect(source, `missing interactive control testId: ${anchor}`).toContain(anchor);
    }
  });

  it('binds manual sales-status CAS to the aggregate menu read-model version', () => {
    expect(pageSource).toContain('const expectedVersion = selectedMenu.version;');
    expect(pageSource).toContain("expectedVersionSource: 'SALES_MENU_DETAIL'");
    expect(pageSource).not.toContain('expectedVersion: statusItem.version');
  });

  it('keeps weighted constraints out of the editor and reuses the foundation image primitive', () => {
    expect(source).toContain('称重销售商品不显示按份定义的起售量与订购倍数。');
    expect(source).toContain('<AdminImageCollectionEditor');
    expect(source).toContain('onPendingChange(true)');
    expect(source).toContain('onPendingChange(false)');
    expect(source).toContain('沿用商品图片');
    expect(source).toContain('单独设置');
    expect(source).toContain('onRegisterRelease');
    expect(source).toContain('expectedAssetVersion');
    expect(source).toContain('releaseStagedMedia');
  });

  it('closes the editable drawer lifecycle at the actual overlay boundary', () => {
    expect(editorSource).toContain('onClose={lifecycle.requestClose}');
    expect(editorSource).toContain('afterOpenChange={handleAfterOpenChange}');
    expect(editorSource).toContain('maskClosable={!lifecycle.submitting}');
    expect(editorSource).toContain('keyboard={!lifecycle.submitting}');
    expect(editorSource).toContain('lifecycle.setSubmitting(pending)');
    expect(editorSource).toContain('dirtyGuardTestIds');
    expect(editorSource).toContain('testId(salesMenuTestIds.itemDiscardConfirm)');
    expect(editorSource).toContain('testId(salesMenuTestIds.itemDiscardCancel)');
    expect(editorSource).toContain('window.requestAnimationFrame(onClosedFocus)');
    expect((editorSource.match(/min=\{1\}/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('uses the foundation lifecycle for every editable sales-menu Drawer', () => {
    for (const [lifecycle, afterOpenChange] of [
      ['createLifecycle', 'createAfterOpenChange'],
      ['renameLifecycle', 'renameAfterOpenChange'],
      ['scheduleLifecycle', 'scheduleAfterOpenChange'],
    ]) {
      expect(pageSource).toContain(`onClose={${lifecycle}.requestClose}`);
      expect(pageSource).toContain(`afterOpenChange={${afterOpenChange}}`);
      expect(pageSource).toContain(`maskClosable={!${lifecycle}.submitting}`);
      expect(pageSource).toContain(`keyboard={!${lifecycle}.submitting}`);
    }
    expect(pageSource).toContain('createTriggerRef.current?.focus()');
    expect(pageSource).toContain('menuActionTriggerRef.current?.focus()');
  });

  it('locks candidate submission and closes through the shared drawer lifecycle', () => {
    expect(candidateDrawerSource).toContain('useDrawerFormLifecycle');
    expect(candidateDrawerSource).toContain('lifecycle.requestClose');
    expect(candidateDrawerSource).toContain('afterOpenChange={handleAfterOpenChange}');
    expect(candidateDrawerSource).toContain('maskClosable={!lifecycle.submitting}');
    expect(candidateDrawerSource).toContain('keyboard={!lifecycle.submitting}');
    expect(candidateDrawerSource).toContain('closable={!lifecycle.submitting}');
    expect(candidateDrawerSource).toContain('lifecycle.setSubmitting(true)');
    expect(candidateDrawerSource).toContain('if (added) lifecycle.closeAfterSuccess();');
    expect(candidateDrawerSource).toContain('lifecycle.setSubmitting(false)');
    expect(candidateDrawerSource).toContain('onClosedFocus');
    expect(candidateDrawerSource).toContain('lifecycle.markBusinessIntentChanged();');
  });

  it('does not create a page-local store selector or expose raw operation names', () => {
    expect(source).not.toContain('门店选择器');
    expect(source).not.toContain('切换生效菜单');
    expect(source).toContain('salesMenuOperationLabel(row.operationKind)');
  });
});
