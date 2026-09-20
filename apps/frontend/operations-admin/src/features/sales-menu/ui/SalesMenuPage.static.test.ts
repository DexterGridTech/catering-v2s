import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const pageFileSource = readFileSync(new URL('./SalesMenuPage.tsx', import.meta.url), 'utf8');
const readModelFileSource = readFileSync(new URL('../model/useSalesMenuReadModel.ts', import.meta.url), 'utf8');
const mediaFileSource = readFileSync(new URL('./SalesMenuItemMediaEditor.tsx', import.meta.url), 'utf8');
const detailFileSource = readFileSync(new URL('./SalesMenuItemDetailDrawer.tsx', import.meta.url), 'utf8');
const detailGalleryFileSource = readFileSync(new URL('./SalesMenuItemImageGallery.tsx', import.meta.url), 'utf8');
const editorFileSource = readFileSync(new URL('./SalesMenuItemEditorDrawer.tsx', import.meta.url), 'utf8');
const candidateFileSource = readFileSync(new URL('./SalesMenuCandidateDrawer.tsx', import.meta.url), 'utf8');
const managerFileSource = readFileSync(new URL('./SalesMenuManagerDrawer.tsx', import.meta.url), 'utf8');
const createModalFileSource = readFileSync(new URL('./SalesMenuCreateModal.tsx', import.meta.url), 'utf8');
const publishFileSource = readFileSync(new URL('./SalesMenuPublishDrawer.tsx', import.meta.url), 'utf8');
const taskSurfacesSource = readFileSync(new URL('./SalesMenuTaskSurfaces.tsx', import.meta.url), 'utf8');
const sharedSource = readFileSync(new URL('./salesMenuUiShared.ts', import.meta.url), 'utf8');
const source = [
  pageFileSource,
  readModelFileSource,
  mediaFileSource,
  detailFileSource,
  detailGalleryFileSource,
  editorFileSource,
  candidateFileSource,
  managerFileSource,
  createModalFileSource,
  publishFileSource,
  taskSurfacesSource,
  sharedSource,
].join('\n');
const testIdsSource = readFileSync(new URL('../salesMenuTestIds.ts', import.meta.url), 'utf8');
const pageSource = pageFileSource.slice(pageFileSource.indexOf('export function SalesMenuPage'));
const draftTableSource = pageFileSource.slice(
  pageFileSource.indexOf('function DraftSalesItemTable'),
  pageFileSource.indexOf('function PublishedSalesItemTable'),
);
const candidateDrawerSource = candidateFileSource;
const editorSource = editorFileSource;
const detailSource = detailFileSource;
const mediaSource = mediaFileSource;
const candidateSource = candidateFileSource;
const managerSource = managerFileSource;
const sectionSource = pageFileSource.slice(
  pageFileSource.indexOf('function SalesMenuSectionPanel'),
  pageFileSource.indexOf('function DraftSalesItemTable'),
);
const publishedSource = pageFileSource.slice(
  pageFileSource.indexOf('function PublishedSalesItemTable'),
  pageFileSource.indexOf('function SalesMenuOperationTable'),
);
const operationSource = pageFileSource.slice(
  pageFileSource.indexOf('function SalesMenuOperationTable'),
  pageFileSource.indexOf('export function SalesMenuPage'),
);
const publishSource = publishFileSource;

const traceSources = {
  all: source,
  page: pageSource,
  readModel: readModelFileSource,
  detail: detailSource,
  detailGallery: detailGalleryFileSource,
  editor: editorSource,
  media: mediaSource,
  candidate: candidateSource,
  manager: managerSource,
  create: createModalFileSource,
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
    [
      '<div {...testId(salesMenuTestIds.page)} data-scope-ref={queryContext.scopeRef}>',
      'testId(salesMenuTestIds.channelSelector)',
      'testId(salesMenuTestIds.managerOpen)',
    ],
  ],
  [
    'UI-02',
    'section',
    ['<Card', 'title="销售分区"', 'type="primary"', '新建分区', 'testId(salesMenuTestIds.sectionList)'],
  ],
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
  ['UI-08', 'draft', ['salesMenuProductShapeLabel(row.productShape)', '{row.itemCode}']],
  [
    'UI-09',
    'media',
    ["title: '展示图片'", '<AdminImageCollectionEditor', '<AssetPreview', 'onStageMedia={stageMedia}'],
  ],
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
  ['UI-15', 'published', ['salesMenuProductShapeLabel(row.productShape)', '{row.itemCode}']],
  ['UI-16', 'draft', ['title="草稿销售项"', "title: '销售约束'"]],
  ['UI-17', 'operation', ['title="操作记录"', 'testId(salesMenuTestIds.operationLog)']],
  ['UI-18', 'operation', ['salesMenuOperationLabel(row.operationKind)', 'SALES_MENU_OPERATION_COLUMN_TITLE']],
  [
    'UI-19',
    'published',
    ["title: '销售状态'", 'salesMenuPublishedSaleStatusLabel(row)', 'onStatus(row, event.currentTarget)'],
  ],
  [
    'UI-20',
    'page',
    [
      '生效与时段',
      '更新到前台',
      '同一经营入口可以同时启用多份菜单',
      'testId(salesMenuTestIds.menuSelector)',
      'read.selector.candidates.onPopupScroll',
      'testId(salesMenuTestIds.menuRefresh)',
    ],
  ],
  [
    'UI-21',
    'draft',
    ['SALES_MENU_OPERATION_COLUMN_TITLE', "triggerTestId={salesMenuTestIds.itemAction(row.salesItemRef, 'menu')}"],
  ],
  ['UI-22', 'editor', ['onDelete(detail, stagedReleaseRef.current)', '删除销售项']],
  ['UI-23', 'editor', ['onClick={lifecycle.requestClose}', '关闭']],
  [
    'UI-24',
    'manager',
    [
      "managerAction(row.salesMenuRef, 'toggle')",
      "row.activation?.status === 'ENABLED' ? '停用' : '启用'",
      'testId(salesMenuTestIds.managerCreate)',
    ],
  ],
  ['UI-25', 'all', ['commands.copy(', "managerAction(row.salesMenuRef, 'copy')"]],
  ['UI-26', 'page', ['菜单已停用。', 'commands.activate(']],
  ['UI-27', 'editor', ["title: '商品默认价'", "title: '菜单挂牌价'"]],
  ['UI-28', 'editor', ["const isSku = item.saleContent.kind === 'SKU_SELECTION'", 'salesMenuTestIds.itemListedPrice']],
  ['UI-29', 'page', ["salesMenuTestIds.mode('PUBLISHED')", "value: 'PUBLISHED'", '<PublishedSalesItemTable']],
  ['UI-30', 'detail', ['title="销售项详情"', '<Descriptions', '适用约束']],
  ['UI-31', 'all', ['testIdPrefix={salesMenuTestIds.draftCursor}', 'testIdPrefix={salesMenuTestIds.logCursor}']],
  ['UI-32', 'detailGallery', ['<button', 'aria-pressed={active}', 'itemDetailMediaChoice(itemRef, assetRef)']],
  [
    'UI-33',
    'editor',
    ['查看商品', 'onViewProduct(detail.itemCode, event.currentTarget)', 'testId(salesMenuTestIds.itemViewProduct)'],
  ],
];

describe('sales menu IA static trace', () => {
  it('keeps visible pagination for tables and accumulates selector candidates in dropdowns', () => {
    expect((source.match(/<CursorPagination/g) ?? []).length).toBe(5);
    for (const prefix of ['managerCursor', 'candidateCursor', 'draftCursor', 'publishedCursor', 'logCursor']) {
      expect(source).toContain(`salesMenuTestIds.${prefix}`);
    }
    expect(readModelFileSource).toContain('useCursorCandidates');
    expect(pageSource).toContain('read.channels.candidates.onPopupScroll');
    expect(pageSource).toContain('read.selector.candidates.onPopupScroll');
    expect(source).not.toContain('salesMenuTestIds.pageCursor');
    expect(source).not.toContain('salesMenuTestIds.selectorCursor');
    expect(source).toContain('MEDIA_LIMITS = {maxImageCount: 6, maxImageBytes: 2 * 1024 * 1024}');
  });

  it('keeps the front table read-only with separate inventory and sale-status surfaces', () => {
    expect(source).toContain("title: '库存状态'");
    expect(source).toContain("title: '销售状态'");
    expect(source).toContain('salesMenuInventoryAvailabilityLabel(row.inventoryAvailability)');
    expect(source).toContain('salesMenuPublishedSaleStatusLabel(row)');
    expect(source).not.toContain("dataIndex: 'operationKind'");
  });

  it('keeps the draft table and candidate drawer at the approved IA denominator', () => {
    for (const title of ['菜单商品', '挂牌价', '销售规格', '销售约束'])
      expect(draftTableSource).toContain(`title: '${title}'`);
    expect(draftTableSource).not.toContain("title: '商品形态'");
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

  it('keeps the sales-menu display cells aligned with the approved density rules', () => {
    const draftColumns = ['菜单商品', '挂牌价', '销售规格', '销售约束'];
    const draftColumnPositions = draftColumns.map(title => draftTableSource.indexOf(`title: '${title}'`));
    expect(draftColumnPositions.every(position => position >= 0)).toBe(true);
    expect(draftColumnPositions).toEqual([...draftColumnPositions].sort((left, right) => left - right));
    expect(draftTableSource).toContain('width: 210');
    expect(draftTableSource).not.toContain('NameCodeText name={row.displayName} code={row.itemCode}');
    expect(draftTableSource).toContain('{row.displayName}');
    expect(draftTableSource).toContain('{row.itemCode}');
    expect(draftTableSource).toContain('salesMenuProductShapeLabel(row.productShape)');
    expect(draftTableSource).toContain('itemMediaLabel(row)');
    expect(draftTableSource).toContain('<AssetPreview');
    expect(draftTableSource).toContain('salesMenuPrimaryImageAssetRef(row)');
    expect(draftTableSource).toContain('width: 108');
    expect(draftTableSource).toContain('width: 120');
    expect(draftTableSource).toContain('width: 110');
    expect(draftTableSource).toContain('tableLayout="fixed"');
    expect(draftTableSource).toContain('scroll={{x: 620}}');
    expect(draftTableSource).toContain('salesMenuConstraintLabel(row)');
    expect(sharedSource).toContain('listedPriceCents === defaultPriceCents');
    expect(sharedSource).toContain('salesMenuStackedLines(');
    expect(sharedSource).toContain('salesMenuPublishedPriceLabel');
    expect(sharedSource).not.toContain(".join('；')");
    expect(sharedSource).not.toContain(".join('、')");

    const publishedColumns = ['菜单商品', '挂牌价', '销售规格', '库存状态', '销售状态'];
    const publishedColumnPositions = publishedColumns.map(title => publishedSource.indexOf(`title: '${title}'`));
    expect(publishedColumnPositions.every(position => position >= 0)).toBe(true);
    expect(publishedColumnPositions).toEqual([...publishedColumnPositions].sort((left, right) => left - right));
    expect(publishedSource).toContain('width: 210');
    expect(publishedSource).toContain('width: 80');
    expect(publishedSource).toContain('width: 147');
    expect(publishedSource).toContain('tableLayout="fixed"');
    expect(publishedSource).toContain('scroll={{x: 697}}');
    expect(publishedSource).toContain('<AssetPreview');
    expect(publishedSource).toContain('salesMenuPrimaryImageAssetRef(row)');
    expect(publishedSource).toContain('itemMediaLabel(row)');
    expect(publishedSource).toContain('salesMenuPublishedPriceLabel(row)');
    expect(publishedSource).toContain('salesMenuSpecificationLabel(row)');
    expect(publishedSource).toContain('salesMenuProductShapeLabel(row.productShape)');
    expect(publishedSource).not.toContain("title: '商品形态'");
  });

  it('retains candidate selection across cursor pages and makes off-page submission explicit', () => {
    expect(candidateDrawerSource).toContain('preserveSelectedRowKeys: true');
    expect(candidateDrawerSource).toContain('mergeSalesMenuCandidateSelection(');
    expect(candidateDrawerSource).toContain('提交按钮会包含这些已选商品');
    expect(candidateDrawerSource).toContain('setSelected([])');
  });

  it('binds both selectors to stable test ids and actual business-identity option roots', () => {
    expect(testIdsSource).toContain("menuSelectorInput: 'sales-menu-selector-input'");
    expect(source).toContain(
      "const SalesMenuSelectorInput = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<'input'>>",
    );
    expect(pageSource).toContain('testId(salesMenuTestIds.channelSelector)');
    expect(pageSource).toContain("'data-testid': salesMenuTestIds.channelOption(channel.channelRef)");
    expect(pageSource).toContain('read.selectChannel(value as Uuid)');
    expect(pageSource).toContain('virtual={false}');
    expect(pageSource).toContain('components={{input: SalesMenuSelectorInput}}');
    expect(pageSource).toContain('showSearch');
    expect(pageSource).toContain('filterOption={false}');
    expect(pageSource).toContain('searchValue={read.selectorQuery}');
    expect(pageSource).toContain('read.setSelectorQuery(value)');
    expect(pageSource).toContain("'data-testid': salesMenuTestIds.menuOption(menu.salesMenuRef)");
    expect(pageSource).not.toContain('<Space {...testId(salesMenuTestIds.menuOption(menu.salesMenuRef))}>');
  });

  it('keeps the channel option row rich enough to explain the selected business entry', () => {
    expect(pageSource).toContain('read.channels.templateByRef.get(channel.templateRef)');
    expect(pageSource).toContain('{channel.channelName}');
    expect(pageSource).toContain('渠道模板：');
    expect(pageSource).toContain('closedCodeLabel(accessKindLabels, template.accessKind)');
    expect(pageSource).toContain('closedCodeLabel(orderKindLabels, template.orderKind)');
    expect(pageSource).toContain('模板状态：');
    expect(pageSource).toContain('read.channels.candidates.onPopupScroll');
  });

  it('keeps the entry and menu controls in one section with single-line selector content', () => {
    const entrySectionSource = pageSource.slice(
      pageSource.indexOf('<Card title="经营入口"'),
      pageSource.indexOf('{!selectedMenu ?'),
    );
    expect(entrySectionSource).not.toContain('title="菜单工作区"');

    const channelOptionsSource = entrySectionSource.slice(
      entrySectionSource.indexOf('options={channelItems.map'),
      entrySectionSource.indexOf('onPopupScroll={event =>'),
    );
    expect(channelOptionsSource).not.toContain('direction="vertical"');
    expect(channelOptionsSource).toContain('wrap={false}');
    expect(channelOptionsSource).toContain("whiteSpace: 'nowrap'");

    const menuSelectorOffset = entrySectionSource.indexOf('value={selectedMenuRef}');
    const menuRowSource = entrySectionSource.slice(entrySectionSource.lastIndexOf('<Row', menuSelectorOffset));
    expect(menuRowSource).toContain('<Segmented<SalesMenuMode>');
    expect(menuRowSource).toContain('wrap={false}');
  });

  it('keeps menu actions in the same row as the menu selector', () => {
    const menuSelectorOffset = pageSource.indexOf('value={selectedMenuRef}');
    const menuRowSource = pageSource.slice(
      pageSource.lastIndexOf('<Row', menuSelectorOffset),
      pageSource.indexOf('{menuProblem &&'),
    );
    expect(menuRowSource).toContain('<Col flex="auto" style={{minWidth: 260}}>');
    expect(menuRowSource).toContain('<Col flex="none">');
    expect(menuRowSource).toContain('<Space wrap={false}>');
    expect(menuRowSource).toContain('testId(salesMenuTestIds.menuSchedule)');
    expect(menuRowSource).toContain('testId(salesMenuTestIds.menuPublish)');
    expect(menuRowSource).toContain('刷新');
    expect(menuRowSource).toContain('<Segmented<SalesMenuMode>');
  });

  it('keeps the Segmented option anchors explicit for the documented composite-control exception', () => {
    const modeSource = pageSource.slice(pageSource.indexOf('<Segmented'), pageSource.indexOf('</Segmented>'));
    for (const mode of ['PUBLISHED', 'DRAFT', 'OPERATIONS'])
      expect(modeSource).toContain(`testId(salesMenuTestIds.mode('${mode}'))`);
  });

  it('exposes the selected section state on the exact section action node', () => {
    expect(sectionSource).toContain("aria-current={active ? 'true' : undefined}");
    expect(sectionSource).toContain('testId(salesMenuTestIds.section(section.salesSectionRef))');
    expect(sectionSource).toContain('theme.useToken()');
    expect(sectionSource).toContain('background: active ? token.colorPrimaryBg : token.colorBgContainer');
    expect(sectionSource).toContain("textAlign: 'left'");
    expect(sectionSource).toContain("justifyContent: 'flex-start'");
    expect(sectionSource).toContain("display: 'flex'");
    expect(pageSource).toContain('<Col xs={24} lg={5} style={{minWidth: 0}}>');
    expect(pageSource).toContain('<Col xs={24} lg={19} style={{minWidth: 0}}>');
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

  it('opens the existing catalog detail surface without closing the sales-item editor', () => {
    expect(testIdsSource).toContain("itemViewProduct: 'sales-menu-item-view-product'");
    expect(editorSource).toContain('onViewProduct(detail.itemCode, event.currentTarget)');
    expect(taskSurfacesSource).toContain(
      "import {CatalogItemDrawer} from '../../catalog-management/CatalogItemDrawer';",
    );
    expect(taskSurfacesSource).toContain('<CatalogItemDrawer {...catalogItem} />');
    expect(pageSource).toContain('const [productDetailItemCode, setProductDetailItemCode] = useState<string>();');
    expect(pageSource).toContain('onViewProduct: openProductDetail');
    expect(pageSource).toContain("initialMode: 'view'");
    expect(pageSource).toContain('canWriteCatalog: false');
    expect(pageSource).toContain('onAfterOpenChange: productDetailAfterOpenChange');
    expect(pageSource).toContain('clearProductDetailContext();');
  });

  it('does not expose stale manager versions while the manager read model refreshes', () => {
    expect(managerSource).toContain(
      'const managerReadModelReady = !read.manager.query.isFetching && !read.manager.query.isError;',
    );
    expect(managerSource).toContain('disabled={!canEdit || row.archived || !managerReadModelReady}');
    expect(managerSource).toContain('disabled={!managerReadModelReady}');
  });

  it('places menu creation in the manager drawer header rather than its content toolbar', () => {
    const drawerStart = managerSource.indexOf('<Drawer');
    const contentStart = managerSource.indexOf('<Space direction="vertical"', drawerStart);
    const drawerHeaderSource = managerSource.slice(drawerStart, contentStart);
    const contentToolbarSource = managerSource.slice(contentStart, managerSource.indexOf('{error &&', contentStart));
    expect(drawerHeaderSource).toContain('extra={');
    expect(drawerHeaderSource).toContain('testId(salesMenuTestIds.managerCreate)');
    expect(drawerHeaderSource).toContain('onClick={event => onCreate(event.currentTarget)}');
    expect(contentToolbarSource).toContain('<Input.Search');
    expect(contentToolbarSource).not.toContain('testId(salesMenuTestIds.managerCreate)');
  });

  it('shows the menu schedule as a manager-table column from the owner summary', () => {
    expect(managerSource).toContain("title: '菜单时段'");
    expect(managerSource).toContain('salesMenuScheduleLabel(row.draftSchedule)');
  });

  it('hydrates published read-only detail from the owner published-item operation', () => {
    expect(detailSource).toContain('operationsAdminRtkRequest.getOperationsSalesMenuPublishedItem(');
    expect(detailSource).toContain('useGetOperationsSalesMenuPublishedItemQuery');
    expect(detailSource).toContain('if (publishedDetailQuery.isError) return undefined;');
    expect(detailSource).toContain('const current = publishedDetailQuery.currentData;');
    expect(detailSource).not.toContain('publishedDetailQuery.data');
    expect(detailSource).toContain('publishedDetailQuery.isFetching && !displayedItem');
    expect(detailSource).toContain('current.salesItemRef === publishedRow.salesItemRef');
    expect(detailSource).toContain('正在读取前台销售项详情');
    expect(detailSource).toContain('前台销售项详情暂时无法获取');
    expect(detailSource).not.toContain('onStatus');
    expect(pageSource).toContain('channelRef: selectedChannelRef');
    expect(detailSource).toContain('<SalesMenuItemImageGallery');
    expect(detailSource).toContain('salesMenuImageAssetRefs(displayedItem)');
    expect(detailGalleryFileSource).toContain('<AssetPreview');
    expect(detailGalleryFileSource).toContain(
      "testId={salesMenuTestIds.itemMedia(itemRef, 'published-detail-primary')}",
    );
  });

  it('keeps business-channel status separate from menu activation status', () => {
    expect(pageSource).toContain('const selectedChannel = channelItems.find');
    expect(pageSource).toContain('channelStatus={selectedChannel?.status}');
    expect(sectionSource).toContain("channelStatus ? salesMenuChannelStatusLabel(channelStatus) : '未读取'");
    expect(sectionSource).toContain('label="菜单启停"');
    expect(sectionSource).toContain("menu.activation?.status ?? 'DISABLED'");
  });

  it('keeps sales-menu target selection and target-status controls on the approved facts', () => {
    expect(editorSource).toContain('selectedSkuRefs');
    expect(editorSource).toContain('skuPrices: isSku');
    expect(editorSource).toContain('orderOptionSelections:');
    expect(editorSource).toContain("item.saleContent.kind === 'DIRECT'");
    expect(editorSource).toContain('catalogOrderOptions.map(option => ({');
    expect(editorSource).toContain('testId(salesMenuTestIds.itemSkuOption(String(row.skuRef)))');
    expect(editorSource).toContain('testId(salesMenuTestIds.itemSkuPrice(String(row.skuRef)))');
    expect(editorSource).toContain('salesMenuTestIds.itemOrderOptionValue(');
    expect(editorSource).toContain('testId(salesMenuTestIds.itemStaleSkuNotice)');
    expect(editorSource).not.toMatch(/\borderOptions\b/);

    expect(pageSource).toContain('statusItem.saleContent.selectedOrderOptions');
    expect(pageSource).toContain('target: {targetKind: target.targetKind, targetRef: target.targetRef}');
    expect(pageSource).toContain('testId(salesMenuTestIds.statusTarget(');
    expect(pageSource).toContain('salesMenuTestIds.statusTargetQuickAction(');
    expect(pageSource).toContain('testId(salesMenuTestIds.statusTargetReason)');
    expect(pageSource).toContain('testId(salesMenuTestIds.statusFeedback)');
    expect(pageSource).toContain('testId(salesMenuTestIds.statusClose)');
    expect(pageSource).toContain('onClick={() => handleStatusTargetAction(target)}');
    expect(pageSource).toContain('footer={');
    expect(testIdsSource).toContain("statusClose: 'sales-menu-status-close'");
    expect(testIdsSource).not.toContain('statusTargetState');
    expect(testIdsSource).not.toContain('statusTargetSubmit');
    expect(pageSource).not.toContain('statusTargetState(');
    expect(pageSource).not.toContain('statusTargetSubmit');
    expect(pageSource).not.toContain('onOk={submitStatus}');
    expect(pageSource).toContain('库存状态是独立事实；本弹窗不能恢复库存自动不可售。');
    expect(detailSource).toContain('displayedItem.saleContent.selectedOrderOptions');
    expect(detailSource).toContain('manualSaleTargetStatuses');
  });

  it('keeps status and detail surfaces scannable without changing their owner facts', () => {
    expect(pageSource).toContain('1. 选择要变更的目标');
    expect(pageSource).toContain('当前状态');
    expect(pageSource).toContain('操作');
    expect(pageSource).toContain('2. 当前操作目标');
    expect(pageSource).toContain('当前选中目标');
    expect(pageSource).toContain('填写原因后，点击上方目标行的“设置沽清”完成操作。');
    expect(pageSource).toContain('恢复销售请点击上方目标行的“恢复销售”；只恢复人工销售状态。');
    expect(pageSource).toContain('afterOpenChange={statusAfterOpenChange}');
    expect(detailSource).toContain('title="菜单商品"');
    expect(detailSource).toContain('title="可售状态"');
    expect(detailSource).toContain('xs={24} sm={12}');
    expect(detailSource).toContain('salesMenuManualSaleStatusTagColor');
    expect(detailSource).toContain('salesMenuPublishedTargetGroupLabel(displayedItem, status)');
  });

  it('centralizes sales-menu locators and records every approved UI trace item', () => {
    expect(source).not.toMatch(/testId\('sales-menu-/);
    expect(uiTrace).toHaveLength(33);
    for (const [requirement, segment, anchors] of uiTrace) {
      expect(requirement).toMatch(/^UI-(0[1-9]|[12][0-9]|3[0-3])$/);
      for (const anchor of anchors)
        expect(traceSources[segment], `${requirement} missing ${anchor} in ${segment}`).toContain(anchor);
    }
  });

  it('exposes stable ids for every interactive control used by the current L2 journeys', () => {
    for (const anchor of [
      'testId(salesMenuTestIds.section(section.salesSectionRef))',
      'triggerTestId={salesMenuTestIds.sectionAction(section.salesSectionRef)}',
      "testId(salesMenuTestIds.sectionMenuAction(section.salesSectionRef, 'rename'))",
      'testId(salesMenuTestIds.menuPublish)',
      'testId(salesMenuTestIds.managerCreate)',
      'testId(salesMenuTestIds.menuCreateModal)',
      "testId(salesMenuTestIds.itemMenuAction(row.salesItemRef, 'up'))",
      "triggerTestId={salesMenuTestIds.managerAction(row.salesMenuRef, 'menu')}",
      "testId(salesMenuTestIds.managerAction(row.salesMenuRef, 'rename'))",
      'testId(salesMenuTestIds.candidateRow(row.candidateRef))',
      'testId(salesMenuTestIds.menuSchedule)',
      'testId(salesMenuTestIds.menuPublish)',
      'testId(salesMenuTestIds.menuRefresh)',
      'testId(salesMenuTestIds.itemDiscardConfirm)',
      'testId(salesMenuTestIds.itemDiscardCancel)',
      "testId(salesMenuTestIds.itemMediaChoice('CUSTOM'))",
      'testId(salesMenuTestIds.itemMinQuantity)',
      'testId(salesMenuTestIds.itemQuantityStep)',
      'testId(salesMenuTestIds.statusAction(row.salesItemRef))',
      'testId(salesMenuTestIds.itemDetailMediaChoice(itemRef, assetRef))',
    ]) {
      expect(source, `missing interactive control testId: ${anchor}`).toContain(anchor);
    }
    expect(testIdsSource).toContain("managerSearch: 'sales-menu-manager-search'");
    expect(testIdsSource).toContain("candidateSearch: 'sales-menu-candidate-search'");
    expect(managerSource).toContain('testId(salesMenuTestIds.managerSearch)');
    expect(candidateDrawerSource).toContain('testId(salesMenuTestIds.candidateSearch)');
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

  it('uses the foundation lifecycle at each editable sales-menu overlay boundary', () => {
    for (const [lifecycle, afterOpenChange] of [
      ['renameLifecycle', 'renameAfterOpenChange'],
      ['scheduleLifecycle', 'scheduleAfterOpenChange'],
    ]) {
      expect(pageSource).toContain(`onClose={${lifecycle}.requestClose}`);
      expect(pageSource).toContain(`afterOpenChange={${afterOpenChange}}`);
      expect(pageSource).toContain(`maskClosable={!${lifecycle}.submitting}`);
      expect(pageSource).toContain(`keyboard={!${lifecycle}.submitting}`);
    }
    expect(createModalFileSource).toContain('onCancel={lifecycle.requestClose}');
    expect(createModalFileSource).toContain('afterOpenChange={onAfterOpenChange}');
    expect(createModalFileSource).toContain('maskClosable={!submitting}');
    expect(createModalFileSource).toContain('keyboard={!submitting}');
    expect(createModalFileSource).toContain('confirmLoading={submitting}');
    expect(createModalFileSource).toContain('testId(salesMenuTestIds.menuCreateModal)');
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

  it('uses the shared mutually-exclusive list state for every query-backed sales-menu collection', () => {
    expect(source).toContain('adminListState,');
    for (const prefix of ['candidateList', 'managerList', 'draftList', 'publishedList', 'operationList']) {
      expect(testIdsSource).toContain(`${prefix}: 'sales-menu-${prefix.replace('List', '-list')}'`);
      expect(source).toContain(`testIdPrefix: salesMenuTestIds.${prefix}`);
    }
    expect(candidateDrawerSource).toContain('failed: Boolean(error)');
    expect(managerSource).toContain('const error = problemMessage(read.manager.query.error');
    expect(managerSource).toContain('read.manager.query.refetch()');
    expect(draftTableSource).toContain('failed: Boolean(error)');
    expect(publishedSource).toContain('failed: Boolean(error)');
    expect(operationSource).toContain('failed: Boolean(error)');
    expect(candidateDrawerSource).not.toContain("locale={{emptyText: '该分类暂无可编入商品'}}");
    expect(managerSource).not.toContain("locale={{emptyText: '暂无菜单'}}");
    expect(draftTableSource).not.toContain("locale={{emptyText: '该分区暂无菜单商品'}}");
    expect(publishedSource).not.toContain("locale={{emptyText: '该分区暂无菜单商品'}}");
    expect(operationSource).not.toContain("locale={{emptyText: '暂无操作记录'}}");
  });
});
