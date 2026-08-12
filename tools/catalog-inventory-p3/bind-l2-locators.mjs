#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const policyPath = path.join(root, "contracts/policy/catalog-inventory-l2-locator-bindings.json");
const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
const scenarioPolicy = JSON.parse(fs.readFileSync(path.join(root, "contracts/policy/catalog-inventory-l2-scenarios.json"), "utf8"));
const reconciliation = JSON.parse(fs.readFileSync(path.join(root, "doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json"), "utf8"));
const controlsById = new Map(reconciliation.controls.map((entry) => [entry.id, entry]));
const locatorRenderSources = {
  "operations-shell-menu": "apps/frontend/operations-admin/src/app/OperationsApp.tsx",
  "catalog-inventory-local-search": "apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx",
  "catalog-inventory-brand-switch": "apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx",
  "catalog-inventory-item-table": "apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx",
  "catalog-inventory-copy-open": "apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx",
  "catalog-inventory-item-drawer": "apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx",
  "catalog-item-tabs": "apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx",
  "catalog-dictionary-tabs": "apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx",
  "catalog-item-edit": "apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx",
  "catalog-item-problem": "apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx",
  "inventory-stock-view": "apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryManagementPage.tsx",
  "inventory-target-drawer": "apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryDetailDrawer.tsx",
  "inventory-action-modal": "apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryActionModal.tsx",
  "catalog-inventory-copy-preflight": "apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx"
};
const caseMetadata = new Map(scenarioPolicy.scenarios.flatMap((scenario) => scenario.cases.map((entry) => [entry.caseId, {
  fixtureRef: entry.fixtureRef,
  expectedBusinessResult: entry.expectedBusinessResult,
  activation: scenario.scenarioId
}])));

const bindings = {
  "CI-L2-001": {locator: "operations-shell-menu", position: "operations shell navigation; page menu entry", wireframe: "IA §4.1/§5.1/§5.2：三页二级导航", controlIds: ["IA-NAV-001", "IA-NAV-002", "IA-NAV-003"]},
  "CI-L2-002": {locator: "catalog-inventory-local-search", position: "catalog result-domain toolbar; below global toolbar and above table", wireframe: "IA §5.1/§5.2：当前结果域搜索", controlIds: ["IA-CAT-LIST-001", "IA-CAT-LIST-002", "IA-CAT-LIST-012"]},
  "CI-L2-003": {locator: "catalog-inventory-brand-switch", position: "brand page global toolbar; immediately after view switch", wireframe: "IA §5.2：树表/仅表格右侧品牌切换器", controlIds: ["IA-CAT-LIST-001", "IA-CAT-LIST-003", "IA-CAT-LIST-004"]},
  "CI-L2-004": {locator: "catalog-inventory-item-table", position: "catalog workbench table; item identity and composite cells", wireframe: "IA §5.1/§5.2：商品表格与复合单元格", controlIds: ["IA-CAT-LIST-005", "IA-CAT-LIST-009"]},
  "CI-L2-005": {locator: "catalog-inventory-copy-open", position: "store catalog global action row; conditional brand-copy entry", wireframe: "IA §5.1/§7.1：从品牌复制入口", controlIds: ["IA-CAT-LIST-009", "IA-COPY-001", "IA-STATE-007"]},
  "CI-L2-006": {locator: "catalog-inventory-item-drawer", position: "right 1024px detail/edit Drawer", wireframe: "IA §6.1/§6.4：同 Drawer 查看/编辑与 dirty 关闭", controlIds: ["IA-CAT-DETAIL-001", "IA-CAT-DETAIL-002", "IA-CAT-DETAIL-003", "IA-STATE-001", "IA-STATE-002", "IA-STATE-003", "IA-STATE-005", "IA-STATE-006"]},
  "CI-L2-007": {locator: "catalog-item-tabs", position: "detail Drawer tab strip; shape-driven visible/disabled tabs", wireframe: "IA §6.3：基础、SKU、条码、点单、属性、生产、库存/BOM、治理、套餐", controlIds: ["IA-CAT-TAB-001", "IA-CAT-TAB-002", "IA-CAT-TAB-003", "IA-CAT-TAB-005", "IA-CAT-TAB-006", "IA-CAT-TAB-007", "IA-CAT-TAB-008"]},
  "CI-L2-008": {locator: "catalog-dictionary-tabs", position: "商品字典 launcher Drawer; dictionary/production-tag tabs", wireframe: "IA §5.4/§6.2：字典与生产标签 owner 分离", controlIds: ["IA-CAT-DICT-001", "IA-CAT-DICT-002", "IA-CAT-DICT-003", "IA-CAT-DICT-004", "IA-CAT-DICT-005"]},
  "CI-L2-009": {locator: "catalog-item-tabs", position: "detail Drawer governance/source tab", wireframe: "IA §5.5/§6.5：自动同步锁定与临时商品治理", controlIds: ["IA-CAT-SOURCE-AUTO-001", "IA-CAT-SOURCE-TEMP-001", "IA-CAT-SOURCE-TEMP-002"]},
  "CI-L2-010": {locator: "catalog-item-edit", position: "detail Drawer title action area", wireframe: "IA §6.5/§6.6：生命周期与两种复制流程隔离", controlIds: ["IA-CAT-LIFECYCLE-001", "IA-CAT-LIFECYCLE-002", "IA-CAT-LIFECYCLE-003", "IA-CAT-COPY-LOCAL-001", "IA-CAT-COPY-LOCAL-002", "IA-CAT-COPY-LOCAL-003", "IA-CAT-COPY-LOCAL-004"]},
  "CI-L2-011": {locator: "catalog-item-tabs", position: "detail Drawer media and governance tabs", wireframe: "IA §6.3/§6.4：多图资产与引用保护", controlIds: ["IA-CAT-MEDIA-001", "IA-CAT-MEDIA-002", "IA-CAT-MEDIA-003", "IA-CAT-DETAIL-004"]},
  "CI-L2-012": {locator: "inventory-stock-view", position: "inventory page status view bar; above compact table", wireframe: "IA §7.2：状态分类、需处理派生视图与库存变化", controlIds: ["IA-INV-001", "IA-INV-002", "IA-INV-003"]},
  "CI-L2-013": {locator: "inventory-target-drawer", position: "right 1024px inventory detail Drawer", wireframe: "IA §7.3：六区详情与诊断权限", controlIds: ["IA-INV-001", "IA-INV-002", "IA-INV-003", "IA-INV-005", "IA-STATE-008"]},
  "CI-L2-014": {locator: "inventory-action-modal", position: "inventory detail action surface", wireframe: "IA §7.4：四种动作、预览与统一结果面", controlIds: ["IA-INV-ACTION-COUNT-001", "IA-INV-ACTION-INCREASE-001", "IA-INV-ACTION-ADJUST-001", "IA-INV-ACTION-CONFIG-001", "IA-INV-ACTION-RESULT-001"]},
  "CI-L2-015": {locator: "catalog-inventory-copy-preflight", position: "brand-copy Drawer step 2 preflight surface", wireframe: "IA §7.1：闭包、映射、兼容、引用重写预检", controlIds: ["IA-COPY-001", "IA-COPY-002", "IA-COPY-003", "IA-COPY-004", "IA-COPY-005", "IA-COPY-006", "IA-COPY-007", "IA-COPY-008"]},
  "CI-L2-016": {locator: "catalog-inventory-item-table", position: "catalog workbench table and result-domain state", wireframe: "IA §5.1：generation、分页、筛选和错误恢复", controlIds: ["IA-CAT-LIST-001", "IA-CAT-LIST-004", "IA-CAT-LIST-005", "IA-CAT-LIST-009"]},
  "CI-L2-017": {locator: "catalog-item-problem", position: "detail Drawer error surface; inventory equivalent is inventory-zone-current-problem", wireframe: "IA §6.5/§7.3：错误焦点与具体阻断原因", controlIds: ["IA-STATE-003", "IA-STATE-005", "IA-STATE-006", "IA-STATE-010", "IA-CAT-LIFECYCLE-002"]},
  "CI-L2-018": {locator: "catalog-inventory-item-table", position: "catalog workbench table; Out columns/actions absent", wireframe: "IA §5.1：本期不渲染菜单/导出等 Out 项", controlIds: ["IA-CAT-LIST-006", "IA-CAT-LIST-008"]}
};

policy.bindings = policy.bindings.filter((binding) => caseMetadata.has(binding.caseId));
policy.caseCount = policy.bindings.length;

for (const binding of policy.bindings) {
  const scenario = binding.scenarioId;
  const metadata = bindings[scenario];
  if (!metadata) throw new Error(`L2_LOCATOR_SCENARIO_UNMAPPED:${scenario}`);
  if (!Array.isArray(metadata.controlIds) || metadata.controlIds.length === 0) throw new Error(`L2_CONTROL_BINDING_MISSING:${scenario}`);
  const controls = metadata.controlIds.map((id) => controlsById.get(id));
  if (controls.some((entry) => !entry)) throw new Error(`L2_CONTROL_ID_UNKNOWN:${scenario}`);
  Object.assign(binding, metadata);
  binding.controlSourceFiles = [...new Set(controls.map((entry) => entry.sourceFile))];
  binding.sourceFiles = [...new Set([...binding.controlSourceFiles, locatorRenderSources[metadata.locator]])];
  Object.assign(binding, caseMetadata.get(binding.caseId));
}
policy.locatorBinding = "P3_BOUND_TO_IMPLEMENTATION_SURFACES";
policy.bindingSemantics = {
  locator: "稳定 data-testid，由前端实际渲染；不是 case 名或合成占位符",
  position: "控件在页面/Drawer/结果域中的稳定布局位置",
  wireframe: "对应 IA 章节与线框语义；运行时验收必须同时核对位置与行为"
};
fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
process.stdout.write(`L2_LOCATORS_BOUND=${policy.bindings.length}\n`);
