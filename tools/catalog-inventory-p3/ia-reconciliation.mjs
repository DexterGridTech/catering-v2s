#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const iaPath = path.join(root, 'doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md');
const outputPath = path.join(root, 'doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json');
const iaText = fs.readFileSync(iaPath, 'utf8');
const ids = [...new Set([...iaText.matchAll(/`(IA-[A-Z0-9-]+)`/g)].map((match) => match[1]))].sort();

const implementedStatic = new Set([
  'IA-NAV-001', 'IA-NAV-002', 'IA-NAV-003', 'IA-CAT-LIST-006', 'IA-CAT-LIST-008', 'IA-CAT-LIST-010', 'IA-CAT-LIST-011', 'IA-CAT-LIST-013',
  'IA-CAT-DICT-001', 'IA-CAT-DICT-003', 'IA-CAT-DICT-004', 'IA-CAT-DICT-005', 'IA-CAT-DETAIL-001', 'IA-CAT-DETAIL-002', 'IA-CAT-TAB-003', 'IA-CAT-TAB-005', 'IA-CAT-TAB-006', 'IA-CAT-TAB-008',
  'IA-CAT-SOURCE-TEMP-001', 'IA-CAT-SOURCE-TEMP-002', 'IA-CAT-LIFECYCLE-003', 'IA-CAT-COPY-LOCAL-001', 'IA-CAT-COPY-LOCAL-002', 'IA-CAT-COPY-LOCAL-003', 'IA-CAT-COPY-LOCAL-004',
  'IA-CAT-LIST-003', 'IA-CAT-LIST-012',
  'IA-INV-ACTION-COUNT-001', 'IA-INV-ACTION-INCREASE-001', 'IA-INV-ACTION-CONFIG-001', 'IA-INV-ACTION-ADJUST-001', 'IA-INV-ACTION-RESULT-001',
  'IA-INV-002', 'IA-INV-003', 'IA-INV-004', 'IA-INV-005', 'IA-STATE-004', 'IA-STATE-007', 'IA-STATE-008', 'IA-STATE-009',
]);
const outOfScopeStatic = new Set(['IA-CAT-LIST-006', 'IA-CAT-LIST-008', 'IA-INV-004']);
const upstreamBlocked = new Set();
const notImplemented = new Set([
  'IA-CAT-LIST-007', 'IA-CAT-CATEGORY-001', 'IA-CAT-CATEGORY-002', 'IA-CAT-SOURCE-AUTO-002',
]);

const notImplementedReasons = new Map([
  ['IA-CAT-LIST-007', 'SKU 展开行已经有按需详情读取、loading/空/失败与重试渲染，但尚无 focused proof 证明展开子行不参与批选、旧请求不会覆盖新行及持久错误恢复。'],
  ['IA-CAT-CATEGORY-001', '根/子分类创建与作废后重建事件和 owner request 已存在；尚无独立 focused proof 覆盖根级/子级创建成功 readback 及失败后父级输入保持。'],
  ['IA-CAT-CATEGORY-002', '改名、移动、停用/启用及 expectedVersion 已接线；尚无独立 focused proof 覆盖 typed 环检测/层级阻断、冲突恢复和写后树 readback。'],
  ['IA-CAT-SOURCE-AUTO-002', '当前没有同步执行按钮，符合本期边界；但尚无 focused proof 证明“仅模型/视图、不建设同步链”在所有入口均无误触发路径。'],
]);

const partialReasons = new Map([
  ['IA-CAT-SOURCE-AUTO-001', '自动同步 banner 与服务端 deniedFields 已消费，名称字段按 owner 锁定且本地补充字段仍可编辑；来源映射、持久失败/重试及全部字段 owner 锁定的受管运行证据仍待 P4。'],
  ['IA-CAT-TAB-004', '已补齐左组/中详情/右实时预览三栏与具体字段校验；跨页签修复提示和 owner readback 的受管运行证据仍待 P4 API/L2。'],
  ['IA-CAT-TAB-009', '已改为分类树+关键词+游标候选 Drawer，选择结果通过商品保存并由 owner readback；候选 owner 业务校验的受管运行证据仍待 P4 API/L2。'],
  ['IA-CAT-LIFECYCLE-002', 'CatalogOwnerService 已实现按 priceGranularity 的启用前价格校验并在 transitionItem 调用；但 IA 要求的首错摘要、页签错误数/字段定位、启停/归档二次确认与写后 owner readback 尚未在 CatalogItemDrawer 取得静态行为证明。'],
  ['IA-INV-001', 'InventoryOwnerService 先将 productName、categoryName、materialRole 置空，CatalogInventoryApplicationService 随后回填 productName 与 categoryName；当前 materialRole 端到端没有回填点，次级行的物料标记恒空，尚未满足 IA 的复合主列与筛选语义可见性要求。'],
]);

const retainedBlockedReasons = new Map();
if (retainedBlockedReasons.size !== upstreamBlocked.size || new Set(retainedBlockedReasons.values()).size !== retainedBlockedReasons.size || [...upstreamBlocked].some((id) => !retainedBlockedReasons.has(id) || !retainedBlockedReasons.get(id))) {
  throw new Error('BLOCKED_REASON_LEDGER_INVALID');
}

const statusLedger = {
  policy: 'implementationStatus 由人工维护的语义状态集合声明，不由 locator 存在性推导；每次集合变更必须在 disposition 中列逐条 ID、from/to、依据与当前缺口。',
  historicalReviewDeclaredCounts: {IMPLEMENTED_STATIC: 86, PARTIAL_STATIC: 0, BLOCKED_UPSTREAM_CONTRACT: 0, NOT_IMPLEMENTED: 0, OUT_OF_SCOPE_STATIC: 3},
  currentByteBeforeLatestRemediationCounts: {IMPLEMENTED_STATIC: 29, PARTIAL_STATIC: 40, BLOCKED_UPSTREAM_CONTRACT: 10, NOT_IMPLEMENTED: 7, OUT_OF_SCOPE_STATIC: 3},
  latestRemediationChanges: [
    {id: 'IA-CAT-LIST-003', from: 'BLOCKED_UPSTREAM_CONTRACT', to: 'IMPLEMENTED_STATIC', basis: 'typed smartViewKey/shapeKey/categoryRef query, owner validation and recursive category_scope are present'},
    {id: 'IA-CAT-LIST-012', from: 'BLOCKED_UPSTREAM_CONTRACT', to: 'IMPLEMENTED_STATIC', basis: 'current-result-domain keyword search and queryGeneration are wired through frontend, generated query and owner'},
    {id: 'IA-INV-ACTION-COUNT-001', from: 'BLOCKED_UPSTREAM_CONTRACT', to: 'IMPLEMENTED_STATIC', basis: 'typed count request includes unit/note/zeroConfirmation and result readback'},
    {id: 'IA-INV-ACTION-INCREASE-001', from: 'BLOCKED_UPSTREAM_CONTRACT', to: 'IMPLEMENTED_STATIC', basis: 'typed increase request includes unit/note and result readback'},
    {id: 'IA-INV-ACTION-CONFIG-001', from: 'BLOCKED_UPSTREAM_CONTRACT', to: 'IMPLEMENTED_STATIC', basis: 'typed configuration request submits threshold/negative/counting-unit/conversion fields'},
    {id: 'IA-INV-ACTION-ADJUST-001', from: 'BLOCKED_UPSTREAM_CONTRACT', to: 'IMPLEMENTED_STATIC', basis: 'typed adjustment request includes direction/reason/unit/note and negative guard'},
    {id: 'IA-INV-ACTION-RESULT-001', from: 'BLOCKED_UPSTREAM_CONTRACT', to: 'IMPLEMENTED_STATIC', basis: 'shared result surface renders before/change/after/ledger/version and preserves failure path'},
    {id: 'IA-INV-002', from: 'BLOCKED_UPSTREAM_CONTRACT', to: 'IMPLEMENTED_STATIC', basis: 'stockState remains a five-state fact while attention_count is a server-derived view count consumed by the segmented control'},
    {id: 'IA-CAT-LIFECYCLE-002', from: 'BLOCKED_UPSTREAM_CONTRACT', to: 'PARTIAL_STATIC', basis: 'owner activation validation is present; remaining gaps are frontend error summary/tab targeting/confirmation/readback behavior'},
    {id: 'IA-INV-001', from: 'BLOCKED_UPSTREAM_CONTRACT', to: 'PARTIAL_STATIC', basis: 'owner nulls productName/categoryName/materialRole, coordinator backfills the first two, and materialRole has no end-to-end backfill so IA identity facts remain incomplete'},
    {id: 'IA-CAT-TAB-004', from: 'NOT_IMPLEMENTED', to: 'PARTIAL_STATIC', basis: 'CatalogItemDrawer now renders the IA three-column order-options editor with group selection, group detail, live preview and concrete validation; runtime cross-tab/readback proof remains for P4'},
    {id: 'IA-CAT-TAB-009', from: 'NOT_IMPLEMENTED', to: 'PARTIAL_STATIC', basis: 'CatalogItemDrawer now uses owner-backed category/search/cursor candidate selection instead of free text; runtime owner validation and readback proof remains for P4'},
    {id: 'IA-CAT-SOURCE-AUTO-001', from: 'NOT_IMPLEMENTED', to: 'PARTIAL_STATIC', basis: 'CatalogItemDrawer renders source ownership and consumes deniedFields for name locking while preserving local supplements; complete field-level runtime proof remains for P4'},
  ],
  retainedNotImplementedReasons: Object.fromEntries(notImplementedReasons),
  retainedBlockedReasons: Object.fromEntries(retainedBlockedReasons),
  retainedPartialReasons: Object.fromEntries(partialReasons),
  previousByteBeforeRound2RemediationCounts: {IMPLEMENTED_STATIC: 36, PARTIAL_STATIC: 40, BLOCKED_UPSTREAM_CONTRACT: 3, NOT_IMPLEMENTED: 7, OUT_OF_SCOPE_STATIC: 3},
};

const descriptors = [
  [/^IA-NAV-/, '导航、页面注册与 scope 进入', 'apps/frontend/operations-admin/src/app/routing/pageRegistry.tsx', 'catalog-inventory-store-page|catalog-inventory-brand-page|inventory-store-status-page', 'page registration + scope context', 'IA §4.1/§4.2 shell：左侧导航→内容区顶部 scope 条'],
  [/^IA-STATE-/, '权限、dirty、overlay、错误与诊断可见性', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx', 'catalog-item-dirty-discard|catalog-inventory-item-drawer', 'lifecycle/permission/render boundary', 'IA §3.3/§6.4/§7.2：Drawer 头部、页签区、错误摘要与诊断区'],
  [/^IA-CAT-LIST-/, '商品工作台左树、局部查询、全局工具与结果表', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx', 'catalog-inventory-view-switch|catalog-inventory-brand-switch|catalog-inventory-local-search|catalog-inventory-item-table', 'navigation + scoped query + table controls', 'IA §5.1/§5.2 线框：全局工具行→结果域工具行→左树+表格'],
  [/^IA-CAT-DETAIL-/, '商品详情/编辑同 Drawer 与恢复', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx', 'catalog-inventory-item-drawer|catalog-item-tabs|catalog-item-save', 'detail/edit/dirty controls', 'IA §6.1/§6.4：右侧 1024px Drawer 标题动作→页签→表单/只读事实'],
  [/^IA-CAT-TAB-/, '商品详情各页签与形态准入', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx', 'catalog-item-tabs', 'manifest-driven tab visibility', 'IA §6.2/§6.3：Drawer 页签条→当前页签内容区'],
  [/^IA-CAT-DICT-/, '商品字典与生产标签 launcher/quickManage', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx', 'catalog-inventory-dictionary|catalog-dictionary-tabs|catalog-dictionary-create', 'dictionary/production-tag owner controls', 'IA §5.4 线框：商品字典 Launcher→字典页签/生产履约标签页'],
  [/^IA-CAT-CATEGORY-/, '商品分类树维护', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx', 'catalog-inventory-tree', 'category tree maintenance controls', 'IA §5.1/§5.4：左树商品分类节点→根/子分类动作'],
  [/^IA-CAT-SOURCE-/, '自动同步与外部临时商品治理', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx', 'catalog-inventory-item-drawer|catalog-item-tabs', 'source ownership/read-only/promotion controls', 'IA §5.5/§6.5：智能视图→来源 banner→详情治理页签'],
  [/^IA-CAT-LIFECYCLE-/, '商品生命周期动作与激活校验', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx', 'catalog-item-edit|catalog-item-save', 'status action controls', 'IA §6.5：Drawer 标题动作区→阻断原因/错误摘要'],
  [/^IA-CAT-COPY-LOCAL-/, '同库复制配置向导', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx', 'catalog-item-tabs', 'local copy controls', 'IA §6.6：商品 Drawer 动作→五步本库复制向导'],
  [/^IA-CAT-MEDIA-/, '商品图片与资产生命周期', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx', 'catalog-item-tabs', 'asset stage/release/order controls', 'IA §6.3/§6.7：基础资料图片 gallery→资产状态/排序'],
  [/^IA-COPY-/, '品牌到门店复制来源、闭包、预检与执行', 'apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx', 'catalog-inventory-copy-open|catalog-copy-preflight|catalog-inventory-copy-preflight|catalog-copy-execute', 'copy preflight/execute controls', 'IA §8.1/§8.2：入口→选择商品→五页签预检→确认执行→结果'],
  [/^IA-INV-ACTION-/, '库存四类动作与统一结果面', 'apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryActionModal.tsx', 'inventory-action-count|inventory-action-increase|inventory-action-adjust|inventory-action-configure|inventory-action-submit|inventory-action-result', 'action input/preview/result controls', 'IA §7.4 线框：详情 Drawer 动作区→输入/预览→统一结果面'],
  [/^IA-INV-/, '库存工作台、派生视图与六区详情', 'apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryManagementPage.tsx', 'inventory-stock-view|inventory-filter-keyword|inventory-target-table|inventory-target-drawer', 'inventory list/detail controls', 'IA §7.1/§7.2：状态 Segmented→筛选/表格→详情六区 Drawer'],
  // Contract IDs describe an OpenAPI/generated source-of-truth assertion, not
  // a rendered UI control. Keep the source file and position for traceability,
  // but make the locator explicitly non-applicable instead of putting prose in
  // a field that the locator gate must resolve mechanically.
  [/^IA-CONTRACT-/, '契约字段、形态、owner、固定编码与结构约束', 'contracts/openapi/catalog-inventory.openapi.yaml', 'NOT_APPLICABLE', 'contract/source-of-truth control', 'IA §4.3/§9：契约控制无直接 UI 位置，由页面控件消费'],
];

const positions = [
  [/^IA-NAV-/, 'operations-admin shell navigation and scoped content header'],
  [/^IA-STATE-/, 'current page, Drawer title/action area, overlay or conditional detail zone'],
  [/^IA-CAT-LIST-/, 'catalog global toolbar, result-domain toolbar, left tree or compact result table'],
  [/^IA-CAT-DETAIL-/, 'right 1024px catalog detail/edit Drawer title and tab surface'],
  [/^IA-CAT-TAB-/, 'catalog detail Drawer active tab content region'],
  [/^IA-CAT-DICT-/, '商品字典 launcher Drawer and production-tag quickManage surface'],
  [/^IA-CAT-CATEGORY-/, 'catalog left-tree category node action area'],
  [/^IA-CAT-SOURCE-/, 'catalog list smart-view result and detail governance banner/tab'],
  [/^IA-CAT-LIFECYCLE-/, 'catalog detail Drawer title action area and problem summary'],
  [/^IA-CAT-COPY-LOCAL-/, 'catalog detail Drawer action → local-copy preflight Drawer'],
  [/^IA-CAT-MEDIA-/, 'catalog basic tab asset gallery and asset action region'],
  [/^IA-COPY-/, 'store catalog global action → copy Drawer steps 1–3'],
  [/^IA-INV-ACTION-/, 'inventory detail Drawer extra actions → action surface → result surface'],
  [/^IA-INV-/, 'inventory status bar, compact table, or right 1024px detail Drawer zones'],
  [/^IA-CONTRACT-/, 'OpenAPI/generated source assertion; no rendered UI locator'],
];

function describe(id) {
  const override = {
    'IA-CAT-DICT-001': ['商品字典与生产标签 launcher/quickManage', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx', 'catalog-inventory-dictionary', 'dictionary launcher', 'IA §5.4 线框：商品字典 Launcher→字典页签/生产履约标签页'],
    'IA-CAT-DICT-002': ['商品字典与生产标签 launcher/quickManage', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx', 'catalog-dictionary-tabs|catalog-dictionary-table', 'dictionary tabs and entries', 'IA §5.4 线框：商品字典页签与条目列表'],
    'IA-CAT-DICT-004': ['商品字典与生产标签 launcher/quickManage', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx', 'catalog-dictionary-tabs|catalog-production-tag-owner', 'production-tag owner surface', 'IA §5.4 线框：处理标签独立 owner 入口'],
    'IA-INV-003': ['库存工作台、派生视图与六区详情', 'apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryDetailDrawer.tsx', 'inventory-target-drawer|inventory-zone-changes', 'inventory change periods', 'IA §7.2：详情 Drawer 第二区库存变化'],
    'IA-INV-005': ['库存工作台、派生视图与六区详情', 'apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryDetailDrawer.tsx', 'inventory-target-drawer|inventory-zone-diagnostics', 'inventory diagnostics visibility', 'IA §7.2：详情 Drawer 第六区高级诊断'],
    'IA-INV-001': ['库存工作台、派生视图与六区详情', 'apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryManagementPage.tsx', 'inventory-stock-view|inventory-target-table', 'inventory identity and server list facts', 'IA §7.1：紧凑库存列表复合主列与状态事实'],
    'IA-INV-002': ['库存工作台、派生视图与六区详情', 'apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryManagementPage.tsx', 'inventory-stock-view|inventory-target-table', 'derived needs-attention view', 'IA §7.1：需处理是查询视图而非 stockState'],
    'IA-INV-004': ['库存工作台、派生视图与六区详情', 'apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryManagementPage.tsx', 'inventory-target-table', 'no standalone inventory object create', 'IA §7.1：库存对象只从商品库存/BOM或复制产生'],
    'IA-NAV-001': ['导航、页面注册与 scope 进入', 'apps/frontend/operations-admin/src/app/routing/pageRegistry.tsx', 'PgCatalogStoreItems|PgCatalogBrandItems|PgInventoryStoreStatus', 'catalog and inventory page registrations', 'IA §4.1：商品与服务下三个页面注册'],
    'IA-NAV-002': ['导航、页面注册与 scope 进入', 'apps/frontend/operations-admin/src/app/routing/pageRegistry.tsx', 'PgCatalogStoreItems|PgCatalogBrandItems|PgInventoryStoreStatus', 'page component routing', 'IA §4.1：页面与组件边界'],
    'IA-NAV-003': ['导航、页面注册与 scope 进入', 'apps/frontend/operations-admin/src/app/routing/pageRegistry.tsx', 'parseOperationsPageDesignKey|approvedKeys', 'registered page allowlist', 'IA §4.1：唯一注册源与 fail-closed 进入'],
    'IA-STATE-008': ['权限、dirty、overlay、错误与诊断可见性', 'apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryDetailDrawer.tsx', 'inventory-zone-diagnostics', 'advanced diagnostics entire-zone visibility', 'IA §7.2：无权限时第六区完全不渲染'],
    'IA-COPY-001': ['品牌到门店复制来源、闭包、预检与执行', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx', 'catalog-inventory-copy-open', 'brand copy entry conditions', 'IA §8.1：门店商品工作台全局工具行的品牌复制入口'],
    'IA-COPY-002': ['品牌到门店复制来源、闭包、预检与执行', 'apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx', 'catalog-brand-copy-drawer|catalog-brand-copy-source-keyword', 'source selection scope', 'IA §8.1：复制抽屉来源范围与候选搜索'],
    'IA-COPY-003': ['品牌到门店复制来源、闭包、预检与执行', 'apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx', 'catalog-inventory-copy-preflight|catalog-copy-preflight', 'preflight closure and limit', 'IA §8.2：闭包差异预检'],
    'IA-COPY-004': ['品牌到门店复制来源、闭包、预检与执行', 'apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx', 'catalog-inventory-copy-preflight', 'compatibility and mapping preview', 'IA §8.2：兼容性、映射与引用重写'],
    'IA-COPY-005': ['品牌到门店复制来源、闭包、预检与执行', 'apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx', 'catalog-copy-confirm|catalog-copy-execute', 'confirmation and atomic execute', 'IA §8.2：确认执行与 stale guard'],
    'IA-COPY-006': ['品牌到门店复制来源、闭包、预检与执行', 'apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx', 'catalog-copy-result', 'copy result readback', 'IA §8.2：结果分列与 owner readback'],
    'IA-COPY-007': ['品牌到门店复制来源、闭包、预检与执行', 'apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx', 'catalog-copy-problem', 'copy failure and retry', 'IA §8.2：失败持久化与重试'],
    'IA-COPY-008': ['品牌到门店复制来源、闭包、预检与执行', 'apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx', 'catalog-brand-copy-drawer', 'copy drawer lifecycle', 'IA §8.2：抽屉生命周期与焦点返回'],
    'IA-CAT-COPY-LOCAL-001': ['同库复制配置向导', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx', 'catalog-item-copy-local-open', 'local copy entry action', 'IA §6.6：商品 Drawer 动作→五步本库复制向导'],
    'IA-CAT-COPY-LOCAL-002': ['同库复制配置向导', 'apps/frontend/operations-admin/src/features/catalog-management/ui/LocalCatalogCopyDrawer.tsx', 'catalog-local-copy-sections|catalog-local-copy-preflight', 'selected sections and preflight', 'IA §6.6：复制配置范围→差异预检'],
    'IA-CAT-COPY-LOCAL-003': ['同库复制配置向导', 'apps/frontend/operations-admin/src/features/catalog-management/ui/LocalCatalogCopyDrawer.tsx', 'catalog-local-copy-preflight', 'mapping and compatibility preview', 'IA §6.6：映射/结构兼容分组'],
    'IA-CAT-COPY-LOCAL-004': ['同库复制配置向导', 'apps/frontend/operations-admin/src/features/catalog-management/ui/LocalCatalogCopyDrawer.tsx', 'catalog-local-copy-result', 'local copy result and readback', 'IA §6.6：结果面与 owner readback'],
    'IA-CAT-MEDIA-001': ['商品图片与资产生命周期', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx', 'catalog-item-media-gallery', 'asset gallery and asset references', 'IA §6.3/§6.7：基础资料图片 gallery→资产状态/排序'],
    'IA-CAT-MEDIA-002': ['商品图片与资产生命周期', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx', 'catalog-item-media-gallery', 'asset state and failure surface', 'IA §6.3/§6.7：上传中/失败/重试/排序'],
    'IA-CAT-MEDIA-003': ['商品图片与资产生命周期', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx', 'catalog-item-media-gallery', 'assetRef-only persistence', 'IA §6.3/§6.7：业务事实只存 assetRef'],
    'IA-CAT-DICT-003': ['商品字典与生产标签 launcher/quickManage', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx', 'catalog-production-tag-quick-manage', 'production-tag quickManage entry', 'IA §5.4/§6.2：编辑商品中快速维护处理标签'],
    'IA-CAT-DICT-005': ['商品字典与生产标签 launcher/quickManage', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx', 'catalog-production-tag-quick-manage', 'production-tag quickManage owner handoff', 'IA §5.4/§6.2：生产提示字段旁快速创建'],
    'IA-CAT-LIFECYCLE-003': ['商品生命周期动作与激活校验', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx', 'catalog-item-temporary-promotion|catalog-temporary-promotion-preflight', 'temporary item promotion', 'IA §6.5：临时商品转正预检'],
    'IA-CAT-SOURCE-TEMP-001': ['自动同步与外部临时商品治理', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx', 'catalog-item-source-temporary', 'temporary item read-only banner', 'IA §5.5/§6.5：临时商品治理待办入口'],
    'IA-CAT-SOURCE-TEMP-002': ['自动同步与外部临时商品治理', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx', 'catalog-item-temporary-promotion|catalog-temporary-promotion-preflight', 'temporary item promotion controls', 'IA §5.5/§6.5：资料补齐与转正预检'],
    'IA-CAT-SOURCE-AUTO-001': ['自动同步与外部临时商品治理', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx', 'catalog-item-source-auto_sync', 'auto-sync ownership banner', 'IA §5.5/§6.5：自动同步字段主权解释'],
    'IA-CAT-SOURCE-AUTO-002': ['自动同步与外部临时商品治理', 'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx', 'catalog-item-source-auto_sync', 'auto-sync locked editing', 'IA §5.5/§6.5：同步链不在本期、字段锁定'],
  }[id];
  if (override) return override;
  const descriptor = descriptors.find(([pattern]) => pattern.test(id));
  return descriptor ? descriptor.slice(1) : ['IA requirement', 'doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md', 'N/A', 'IA source control'];
}

function describePosition(id) {
  return positions.find(([pattern]) => pattern.test(id))?.[1] ?? 'mapped IA control surface';
}

function status(id) {
  if (outOfScopeStatic.has(id)) return {implementationStatus: 'OUT_OF_SCOPE_STATIC', reason: 'IA 明确要求本期不渲染/不提供独立入口。'};
  if (upstreamBlocked.has(id)) return {implementationStatus: 'BLOCKED_UPSTREAM_CONTRACT', reason: retainedBlockedReasons.get(id)};
  if (notImplemented.has(id)) return {implementationStatus: 'NOT_IMPLEMENTED', reason: notImplementedReasons.get(id) ?? '控件 locator 存在，但 IA 要求的完整事件、owner request、错误恢复或 readback 尚未取得静态证明。'};
  if (partialReasons.has(id)) return {implementationStatus: 'PARTIAL_STATIC', reason: partialReasons.get(id)};
  if (implementedStatic.has(id)) return {implementationStatus: 'IMPLEMENTED_STATIC', reason: '源码存在批准控件/状态边界，已由 typecheck、focused test 或静态门证明；尚未取得受管 L2 business evidence。'};
  return {implementationStatus: 'PARTIAL_STATIC', reason: '存在相关控件或生成字段，但未完成 IA 要求的全部状态、行为、请求或 readback。'};
}

const controls = ids.map((id) => {
  const [control, sourceFile, locator, assertion, wireframe] = describe(id);
  return {id, control, sourceFile, locator, position: describePosition(id), assertion, wireframe, ...status(id), runtimeStatus: 'UNVERIFIED_REQUIRES_EVIDENCE'};
});
const counts = ['IMPLEMENTED_STATIC', 'PARTIAL_STATIC', 'BLOCKED_UPSTREAM_CONTRACT', 'NOT_IMPLEMENTED', 'OUT_OF_SCOPE_STATIC'].reduce((result, statusName) => {
  result[statusName] = controls.filter((entry) => entry.implementationStatus === statusName).length;
  return result;
}, {});
const output = {
  schemaVersion: 'P3_IA_CONTROL_RECONCILIATION_20260806',
  iaSource: 'doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md',
  iaIdCount: controls.length,
  exactSet: true,
  runtimeEvidence: 'NOT_EXECUTED_REMOTE_GUARD',
  businessStatus: 'NOT_STARTED',
  cleanupStatus: 'NOT_STARTED',
  counts,
  statusLedger: {...statusLedger, currentByteAfterLatestRemediationCounts: counts},
  controls,
};
fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(`P3_IA_CONTROL_RECONCILIATION=${controls.length}\n`);
