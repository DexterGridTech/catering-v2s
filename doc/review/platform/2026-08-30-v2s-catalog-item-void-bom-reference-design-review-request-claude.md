# 商品作废 BOM 引用语义：implementation-facing 详设与实施方案 · Claude review request

```text
REVIEW_STATUS=READY
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
REVIEW_CYCLE_ID=CATALOG_ITEM_VOID_BOM_REFERENCE_DESIGN_20260830
REVIEW_TARGET=DESIGN
IA=IA-CIB-VOID-01
IMPLEMENTATION_AUTHORITY=false
INDEPENDENT_SUBAGENT_REVIEW=ROUND_2_COMPLETE_GO_WITH_UNVERIFIED_UI
INDEPENDENT_REVIEW_REPORT=doc/review/platform/2026-08-30-v2s-catalog-item-void-bom-reference-design-independent-review.md
```

## 背景

当前 operations-admin 商品治理页把商品自有 `stock_target.item_ref` / `stock_bom.item_ref` 计为“已配置库存对象/已配置用料”，从而阻止商品作废。用户指出真实业务关系应区分：A 是 BOM owner，B 才是被 A 的 `rows[*].targetRef` 引用的 component；A 不应仅因拥有自己的 BOM 而不能作废，B 在仍有有效入向用料引用时才应被阻断。

本轮只授权 Codex 生成问题分析、J-CIB-001 的 UI/IA 修订草案、implementation-facing 详设和实施方案，尚未授权写生产代码、改生成物、执行 DEV/reset/seed/L2 或部署。现有接受的 J-CIB-001 与 R-09/R-10 在“自有 BOM 是否阻断作废”处存在需要显式裁决的语义冲突，本轮不能静默覆盖。

## 评审目标

请先独立判断问题是否正确、推荐方案是否比更小替代更优、复杂度是否与当前阶段相称；再核验 owner、reference path、transaction、contract、UI、测试、seed、L2 和旧空间下线边界是否足以直接实施。

核心方案是：inventory owner 将自有 active definitions 与入向 active BOM component references 分离；判断时同时读取 subject 的 all-status target refs，明确分流 `ENABLED`/`DISABLED`，排除 subject 自己将要退休的 BOM owner；没有外部入向引用时在同一 `REQUIRED` 事务将自有 definitions 从 `ENABLED` 退休为 `DISABLED`，再由 catalog owner 将商品置为 `VOIDED`；有入向引用或 active row 命中 disabled/unknown target 时 typed fail closed；详情和 mutation 消费同一份 owner judgement。`references` 继续只表达 catalog composite 关系，不用前端推导 inventory BOM。

## 需阅读文件

请从 `catering-v2s` 仓库根阅读：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`CLAUDE.md`：执行、owner、UI、测试与评审边界；
- `doc/plans/platform/2026-08-30-v2s-catalog-item-void-bom-reference-problem-analysis-codex.md`：问题证据、根因、同根扫描和反例；
- `doc/decisions/2026-08-30-v2s-catalog-item-void-bom-reference-journey-amendment.md`：J-CIB-001 的 UI/IA 修订草案；
- `doc/plans/platform/2026-08-30-v2s-catalog-item-void-bom-reference-implementation-design-codex.md`：implementation-facing 详设；
- `doc/plans/platform/2026-08-30-v2s-catalog-item-void-bom-reference-implementation-plan-codex.md`：CP-00 至 CP-08 实施方案；
- `doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-journey.md`、`doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-ui-interaction.md`：已接受 Journey 与交互边界；
- `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-implementation-design-codex.md`、`doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-serial-plan.md`：既有实现方向与 A-05 mode-switch 边界；
- `doc/plans/platform/2026-08-26-v2s-catalog-workbench-observed-remediation-plan-codex.md`：现有 R-09/R-10 语义及本轮冲突来源；
- `contracts/policy/catalog-inventory-reference-path-matrix.json`：R13/R15 owner path 与 C02 `rows[*].targetRef`；
- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/api/InventoryOwnerApi.java`：当前 inventory owner API；
- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java`：当前 own-definition count 与 BOM references query；
- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/ResolvedBomTargets.java`、`apps/backend/catering-business-server/src/main/resources/db/migration/V20260822_010000_000__catalog_inventory_rule_definition_status.sql`：legacy resolver 与 `DISABLED` immutable history 边界；
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`、`CatalogInventoryCoordinator.java`：item/SKU transition、detail、batch 和 inventory 协调；
- `apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts`、`catalogManifestLabels.ts`、`ui/CatalogItemGovernanceView.tsx`：现有 contract decoder 与用户展示；
- `scripts/generate/catalog-inventory-p1.mjs`、`scripts/dev/catalog-inventory-seed-plan.mjs`、`scripts/dev/catalog-inventory-seed-executor.mjs`、`scripts/test/catalog-inventory-l2-fixture.mjs`：生成、seed、L2 入口；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java`、`apps/backend/catering-business-server/modules/inventory/src/test/java/com/catering/v2s/inventory/application/InventoryCatalogReferenceDependenciesIntegrationTest.java`：现有 acceptance/inventory test ownership。

## 独立核验重点

1. 先从 reference matrix 和真实表/JSON path 独立重建 A→B 方向，证伪“`stock_bom.item_ref` 是 B 的依赖”的可能性；确认 C02 是否足以成为 component lifecycle path，是否需要最小 source metadata 修订。
2. 核验推荐的 own/inbound 分离是否解决完整根因：A 自有 definitions 是否安全退休、B active inbound BOM 是否一定阻断、disabled/history/scope 是否不误判；确认 all-status target 集合、own-BOM exclusion/self-reference 和 active row 命中 disabled target 的 fail-closed 逻辑没有遗漏；检查 SKU sibling 和 option-value counterexample 是否被正确收敛或明确排除。
3. 核验 inventory owner API 是否提供了真正的 set-based、scope-bound、active-status-bound judgement；是否存在 N+1、直接跨 schema、raw JSON fallback、错误复用 `catalogReferenceDependencies` 或 read/detail 与 mutation 漂移。
4. 核验同一 `REQUIRED` 事务、锁顺序、CAS、幂等、rollback 和最终 owner readback；构造“detail 可作废但 mutation 失败”以及“A 已 VOIDED 但 active definition 仍在”的反例。
5. 核验 `voidAvailability`/reason enum/生成链和前端 IA：`商品关联` 是否继续是 catalog composite 语义，`USED_BY_INVENTORY_BOM` 是否只显示业务事实，是否有更短自然的 UI 路径；不得以改 label 代替 owner 修复。
6. 核验 acceptance、seed、L2、旧空间下线是否真的能证伪 A/B 两个方向，而不是只验证页面或 response status；确认 backend acceptance 不受历史 80 条总 cap 约束，且验证顺序为 contract/source + generator → `scripts/verify --validate-only` → tests；确认 batch-start graph 下同批 A/B 不拓扑释放，未裁决前 batch path 不实施。
7. 按仓内规范判断该方案是否越过用户授权：本轮只做设计 review，不授权源码、generated、DEV、reset、seed、L2、UAT、部署或数据动作。
8. 再构造一条“所有计划判据通过但 A 仍不能作废、B 仍能作废，或历史被删除”的路径；若存在，指出最小修复与为什么更小方案不足。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并汇总 `M` / `S` / `N`。每条 finding 请带：精确仓库相对文件与行号、事实类别（仓内事实/推论/产品判断/`UNVERIFIED_REQUIRES_EVIDENCE`/`DEXTER_DECISION`）、可证伪失败条件、影响面、最小修复，以及为什么更小方案不足。涉及“是否自动退休自有库存定义”、同批 A/B 互相释放、SKU/option value 范围的事项请单列需 Dexter 裁决。

首轮独立审查提出的四项问题已由主 agent 回源复核并修订；第二轮独立审查已完成，结论为 `GO_WITH_UNVERIFIED_UI`、M/S/N=0/0/0。请将 `doc/review/platform/2026-08-30-v2s-catalog-item-void-bom-reference-design-independent-review.md` 作为独立审查证据读取，不把它与作者结论混同；仍须明确区分静态设计可实施性与未运行的 UI/动态证据。

这是静态 DESIGN review；请列出实际打开核对的源文件与未核部分，不把未运行命令、文档自洽或未来 L2 当作 GO 证据。第二轮独立审查虽为 `GO_WITH_UNVERIFIED_UI`，也不替代你的独立判断。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请独立评审“商品作废与库存 BOM 引用语义”的 implementation-facing 详设与实施方案。

背景：当前实现把商品自有 stock_target.item_ref / stock_bom.item_ref 当成商品作废依赖，导致 BOM owner A 仅因自己有用料配置就不能作废；真正应阻断的是其他有效 BOM 的 rows[*].targetRef 指向当前商品的入向用料引用 B。本轮已形成问题分析、J-CIB-001 的 UI/IA 修订、详设和 CP-00 至 CP-08 实施方案，并已根据首轮独立审查回源修订；但尚未授权源码、生成物、DEV、reset、seed、浏览器 L2 或部署。请不要把既有 R-09/R-10 的自有 BOM blocker 直接当作正确结论，本轮需要先判断语义方向。

目标：请独立核验 A/B 关系方向、inventory owner 的 all-status target + own/inbound 分离、同事务退休自有 active definitions、入向 active BOM typed fail-closed、`DISABLED` immutable operational/resolver 边界、详情与 mutation 同源、contract/generator/frontend、acceptance/seed/L2 和旧空间下线是否足以直接实施；先判断问题是否正确、方案是否优于“只改 UI”或“要求用户手工删除 BOM”的更小替代、代价是否匹配。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-08-30-v2s-catalog-item-void-bom-reference-problem-analysis-codex.md；
- doc/decisions/2026-08-30-v2s-catalog-item-void-bom-reference-journey-amendment.md；
- doc/plans/platform/2026-08-30-v2s-catalog-item-void-bom-reference-implementation-design-codex.md；
- doc/plans/platform/2026-08-30-v2s-catalog-item-void-bom-reference-implementation-plan-codex.md；
- doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-journey.md、doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-ui-interaction.md；
- doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-implementation-design-codex.md、doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-serial-plan.md；
- doc/plans/platform/2026-08-26-v2s-catalog-workbench-observed-remediation-plan-codex.md；
- contracts/policy/catalog-inventory-reference-path-matrix.json；
- apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/api/InventoryOwnerApi.java；
- apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java；
- apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java、CatalogInventoryCoordinator.java；
- apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts、catalogManifestLabels.ts、ui/CatalogItemGovernanceView.tsx；
- scripts/generate/catalog-inventory-p1.mjs、scripts/dev/catalog-inventory-seed-plan.mjs、scripts/dev/catalog-inventory-seed-executor.mjs、scripts/test/catalog-inventory-l2-fixture.mjs；
- apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java；
- apps/backend/catering-business-server/modules/inventory/src/test/java/com/catering/v2s/inventory/application/InventoryCatalogReferenceDependenciesIntegrationTest.java。

请重点独立核验：
1. 从真实 owner column 与 JSON payload path 重建 A -> B，证伪 owner/component 混淆；
2. A 自有 definitions 是否会在同一 REQUIRED 事务安全转 DISABLED 并保留历史，B active inbound BOM 是否一定阻断；
3. all-status target 分流、active status、scope/brand、disabled/history、mapping failure、own-BOM exclusion/self-reference、lock/CAS/idempotency/rollback 和最终 owner readback；
4. SKU sibling、option-value counterexample、批量作废是否被明确而不偷偷扩张；
5. voidAvailability/reason/generator/frontend/商品关联与作废限制是否同源、业务可理解且没有只改文案；
6. acceptance、seed、L2、旧空间下线与 contract/source + generator -> scripts/verify --validate-only -> tests 顺序是否能证伪反例；backend acceptance 场景无历史 80 条总 cap；batch-start graph 不做同批拓扑释放。

烦请给出明确 GO 或 NO-GO，并汇总 M / S / N。每条 finding 请列精确文件与行号、事实类别、可证伪失败条件、影响面、最小修复及为什么更小方案不足；“自动退休自有库存定义”、同批 A/B 互相释放、SKU/option value 范围请标明是否需要 Dexter 裁决。本轮是静态 DESIGN review，请披露实际打开的文件和未核部分，不把未运行命令当作证据。

授权边界：你的 GO 只表示这组问题分析、Journey/UI/IA 修订、详设和实施方案可以交 Dexter 决定是否作为后续实施输入；不授权修改源码或 generated 文件，不授权 scripts/verify 之外的动态测试、backend acceptance、DEV、reset、seed、浏览器 L2、UAT、部署、数据操作或任何仓库控制动作。NO-GO 只是 findings 输入，仍须由 Codex 回源核验并由 Dexter 收口。谢谢。
```

## 授权边界

Claude 的 GO 只表示设计材料可供 Dexter 决定是否授权后续实施；不自动授权源码、契约生成物、migration、seed、reset、DEV、browser L2、UAT、部署、数据操作或仓库控制动作。实现前仍需完成 fresh 独立 DESIGN 子 agent 盲审与作者处置；若发生产品/Journey 语义分歧，保留 `DEXTER_DECISION`。
