# 商品计量、销售单位与库存单位优化：implementation review request

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=CATALOG_UNIT_MODEL_IMPLEMENTATION_2026_08_21
CONTEXT_MODE=V2S_ROOTED_CONTINUATION_WITH_FRESH_EVIDENCE

## 背景

本轮交付是 `catering-v2s` 的商品计量、销售单位与库存单位优化完整实施。此前独立 implementation review 结论为 `NO-GO`，M/S/N = `3 / 5 / 5`，原评审件为 `doc/review/platform/2026-08-21-v2s-catalog-unit-model-implementation-review-claude.md`。

Dexter 已明确裁定并要求按以下语义实现：

- U-UNIT-DESIGN-01：沿用当前安全守卫；已有库存对象的消费单位快照会因基础单位变更而漂移时，在 catalog 保存事务内拒绝，不静默同步 target、余额或历史；
- U-UNIT-DESIGN-02：源数量按源单位 precision 截断，换算后的目标消费数量按目标消费单位 precision 截断；precision=0 表示整数；统一向零截断，不四舍五入；
- 取消单位详情页/Drawer；单位库保留列表行内编辑和“正在使用”列；
- owner 与前端错误文案以 IA 为准。

本轮已修复原评审中的 M/S/N，并在最终全量 acceptance 中额外发现并修复了 copy preflight producer 生成非法 `closureEdges.fromRef="CATALOG_UNIT"` 的契约边界问题。

## 评审目标

请独立重开真实源码、契约、owner API、事务边界、前端行为、seed 与本轮 fresh evidence，确认：

1. 单值商品销售单位/基础计量单位、SKU 覆盖与清除继承、原料无销售单位但有基础计量单位的闭环；
2. inventory consumption unit snapshot、counting unit 录入换算、源/目标 precision 和向零截断的真实行为；
3. U01 typed guard 是否在 catalog 保存事务内阻止单位漂移，且不重解释既有余额/流水/历史快照；
4. 单位生命周期、引用锁定、停用候选、IA 文案与行内编辑是否一致；
5. `salesUnitRefs`、`SALES_UNIT` item reference、自由单位字符串、measureMode 伪消费单位及 JSON fallback 是否确实退休，且没有误伤商品标签、SKU 销售属性、点单选项；
6. catalog/inventory owner、生成链、copy rewrite、N+1 修复、operations-admin 与 seed 是否仍有边界漏洞；
7. 本轮静态、真实 HTTP/Testcontainers acceptance、seed 和 managed DEV 证据是否被准确表述，哪些仍不是 browser L2/UAT。

## 需阅读文件

请从 `catering-v2s` 仓库根打开：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`CLAUDE.md`：执行、owner、验证和授权边界；
- `doc/decisions/2026-08-21-v2s-catalog-unit-model-ia.md`：已接受 IA、U01/U02、单位列表交互与 IA 文案；
- `doc/decisions/2026-08-21-v2s-catalog-unit-model-journey.md`：Journey 语义与计量规则；
- `doc/decisions/2026-08-21-v2s-catalog-unit-model-ui-interaction.md`：取消详情面后的行内编辑交互；
- `doc/plans/platform/2026-08-21-v2s-catalog-unit-model-implementation-design.md`、`doc/plans/platform/2026-08-21-v2s-catalog-unit-model-serial-plan.md`：实施边界与串行计划；
- `scripts/generate/catalog-inventory-p1.mjs`、`scripts/generate/catalog-inventory-workspace-command-tokens.mjs`、`scripts/generate/backend-performance-m1-command-execution-bindings.mjs`：唯一生成源与生成闭包；
- `scripts/dev/catalog-inventory-seed-executor.mjs`：唯一单位/商品/SKU/BOM/历史快照 seed executor；
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`、`CatalogUnitDefinitionFacts.java`、`CatalogInventoryCoordinator.java`：catalog owner、单位生命周期和跨 owner command；
- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java`：target snapshot、U01 guard、precision、counting/consumption unit 与 N+1 相关读取；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/catalog/application/operations/CopyPreflightWireShape.java`：copy wire shape validation；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java`：U01 typed rejection 与 0.3567kg→356g/historical snapshot acceptance；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/catalog/application/operations/CopyPreflightWireShapeTest.java`：closure edge UUID contract regression；
- `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryActionModal.tsx`：源/目标 precision 输入行为；
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx`：单位列表、引用状态、行内编辑与 IA 文案；
- `doc/review/platform/2026-08-21-v2s-catalog-unit-model-implementation-review-claude.md`：上一轮 NO-GO findings，逐条复核修复是否真实闭合。

## 独立核验重点

请优先用源码和真实运行结果验证，不采信本文自报：

- 静态：`scripts/verify --validate-only` 应为 `PASS`、`EXECUTED=15/15`；`node scripts/test/test-health-entry-runner.mjs --node` 应为 `106 pass, 0 fail`、`21/21`；seed executor self-test 应为 PASS。
- U01 focused evidence：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1787320751234-42145/backend-acceptance-result.jsonl` 与同目录 `run-manifest.json`；确认 `CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED`、catalog/target version 不变、target snapshot 不被同步。
- 精度 focused evidence：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1787320590813-39381/backend-acceptance-result.jsonl` 与 `run-manifest.json`；同时核对 `CatalogAcceptanceScenarios.java` 中 `0.3567`、`356`、历史快照稳定断言。
- copy focused evidence：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1787321401213-53824/` 和 `.runtime/r5/evidence/remote-testcontainers/r5-tc-1787321467625-55040/`；确认修复后两条 copy semantic-conflict 场景均 contract/business PASS。
- 最终全量 evidence：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1787321536079-56325/backend-acceptance-result.jsonl` 与 `run-manifest.json`；必须核对 `DISCOVERED=76 SELECTED=76 HTTP_SUCCESS=76 REAL_BUSINESS_ASSERTIONS=76 STUB_ONLY=0 DIRECT_FAILURES=0`、逐条 contract/business PASS、Testcontainers 与 cleanup PASS。
- seed/DEV：`.runtime/r5/seed/complete/complete-seed-62653d1f-b67c-459a-a68c-db2be0658e49/seed-report.json`、`.runtime/r5/run-manifest.json`、`.runtime/r5/readiness-58658.jsonl`；当前 DEV 由 `scripts/dev/start` 启动，operations-admin 为 `http://localhost:5175/operations/aurora/catalog/store-items`，platform-admin 为 `http://localhost:5174/`。这些是 managed DEV 体验证据，不是 browser L2/UAT。
- 评审中不得要求任何仓库控制动作；不得把静态门、后台 acceptance 或 managed DEV 启动描述成 browser L2、UAT、部署或 Roadmap 下一步授权。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，并按 `M` / `S` / `N` 报告 findings。每条 finding 请给出精确仓库相对路径与行号、影响面、最小修复建议、适用条件/反例，以及是否属于 `DEXTER_DECISION`。请特别说明是否仍存在产品/Journey 语义未裁定；不要自行发明 U-UNIT-DESIGN-01、U-UNIT-DESIGN-02 或单位详情语义。

## 授权边界

本次 review 只请求对当前实现、契约、owner、前端、acceptance、seed 与 managed DEV evidence 做独立 implementation verdict。`GO`/`NO-GO` 不授权新增产品语义、不解除其他未决项、不授权 Roadmap 下一 step、部署、UAT、browser L2 或额外 reset/seed；当前 DEV start 是本轮既有授权下已执行的体验动作。任何新范围、产品取舍或外部协调仍由 Dexter 裁定。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助对本轮“商品计量、销售单位与库存单位优化”做独立 implementation review。

背景：上一轮独立 implementation review 结论为 `NO-GO`，M/S/N = `3 / 5 / 5`，评审件是 `doc/review/platform/2026-08-21-v2s-catalog-unit-model-implementation-review-claude.md`。此后 Dexter 已裁定 U01 采用当前安全拒绝守卫、U02 采用源/目标单位各自 precision 并向零截断、取消单位详情面、文案以 IA 为准。本轮已完成代码修复、生成链、owner、operations-admin、acceptance、seed 与 managed DEV start；最终 fresh 全量 acceptance 已达到 76/76，但请不要直接采信这些结论。

目标：请从用户真实任务出发，独立重开源码与证据，核验单值销售/基础单位、SKU 覆盖继承、原料/BOM/StockTarget、消费单位快照、盘点换算、源/目标 precision、向零截断、U01 事务内拒绝、单位生命周期、legacy 退休、copy closure、owner 边界、前端 IA 和 seed 历史稳定性；并判断方案是否合理、复杂度是否匹配，而不只是检查机器门是否绿色。

请从 `catering-v2s` 仓库根阅读：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`CLAUDE.md`：执行、评审和授权边界；
- `doc/decisions/2026-08-21-v2s-catalog-unit-model-ia.md`、`doc/decisions/2026-08-21-v2s-catalog-unit-model-journey.md`、`doc/decisions/2026-08-21-v2s-catalog-unit-model-ui-interaction.md`：已接受业务与 UI 语义；
- `doc/plans/platform/2026-08-21-v2s-catalog-unit-model-implementation-design.md`、`doc/plans/platform/2026-08-21-v2s-catalog-unit-model-serial-plan.md`：实施边界；
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`、`CatalogUnitDefinitionFacts.java`、`CatalogInventoryCoordinator.java`：catalog owner 与跨 owner 闭环；
- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java`：inventory owner、U01、precision、snapshot 与 N+1；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java`：U01 和 0.3567kg→356g 的真实断言；
- `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryActionModal.tsx`、`apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx`：前端输入精度、单位列表与 IA 文案；
- `scripts/generate/catalog-inventory-p1.mjs`、`scripts/dev/catalog-inventory-seed-executor.mjs`：唯一生成源与 seed executor；
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1787321536079-56325/backend-acceptance-result.jsonl`、同目录 `run-manifest.json`：最终 76/76 全量真实 HTTP/Testcontainers evidence；
- `doc/review/platform/2026-08-21-v2s-catalog-unit-model-implementation-review-claude.md`：上一轮 findings。

请重点独立核验：最终 run 的 `DISCOVERED=76 SELECTED=76 HTTP_SUCCESS=76 REAL_BUSINESS_ASSERTIONS=76` 与逐场景 contract/business；U01 的 typed problem `CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED` 是否发生在 catalog 保存事务内；0.3567kg 是否真实存成 356g 而不是 357g；copy closure 是否仍为合法 UUID 边；单位 precision、停用/删除/引用守卫和前端交互是否符合 IA；以及 managed DEV 证据是否被严格区分于 browser L2/UAT。

烦请给出明确 `GO` 或 `NO-GO`。如有问题，请按 `M` / `S` / `N` 标注精确仓库相对路径与行号、影响面、最小修复建议、适用边界，并注明是否需要 Dexter 产品裁决；不要自行替代 Dexter 裁定 U01/U02 或新增单位详情语义。

授权边界：本次结论仅针对当前 implementation、contract、owner、frontend、acceptance、seed 与 managed DEV evidence；不授权新增产品语义、解除其他未决项、Roadmap 下一 step、部署、UAT、browser L2、额外 reset/seed 或任何仓库控制动作。谢谢。
```
