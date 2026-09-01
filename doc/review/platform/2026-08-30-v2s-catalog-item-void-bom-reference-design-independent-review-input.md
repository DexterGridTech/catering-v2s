# 商品作废 BOM 引用语义：fresh 独立 DESIGN 盲审输入

```text
REVIEW_CYCLE_ID=CATALOG_ITEM_VOID_BOM_REFERENCE_DESIGN_20260830
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_MODE=BLIND_FIRST
AUTHOR_DISPOSITION=NOT_READ
```

## 审查任务

这是 implementation-facing 详设与实施方案的 fresh 独立审查。审查者必须先从原始需求/已接受 Journey、项目规范、当前 owning source 和真实数据路径独立推导预期行为，再阅读本批问题分析、Journey/UI/IA 修订、详设和实施方案；不得先阅读 Claude handoff、作者处置或任何既有 reviewer 结论。

请以“找出它为什么不能直接实施”为立场，检查：

1. A 的 `stock_bom.item_ref`（BOM owner）与 B 的 `stock_target.target_ref` 被 `rows[*].targetRef` 引用的方向是否被正确区分；
2. A 自有 active inventory definitions 是否可以在同一 `REQUIRED` 事务安全退休并保留历史，B 的 active inbound BOM 是否必然阻断；
3. 详情 `voidAvailability`、mutation、batch 和前端是否消费同一 authoritative owner judgement；
4. active/disabled/history/status、scope/brand、mapping failure、lock/CAS/idempotency/rollback 是否闭合；
5. SKU sibling、option-value counterexample、catalog composite relation、A-05 mode-switch 是否被正确收敛而没有偷偷扩张；
6. contract/generator/generated chain、backend acceptance、seed、browser L2、`scripts/verify --validate-only` 顺序和旧空间下线是否可真实证伪目标缺陷；
7. 是否存在更小且同样安全的方案，以及当前方案是否过度设计；
8. 是否存在“所有计划判据通过但业务仍错误”的旁路。

每条 finding 必须包含精确文件与行号、事实类别、可证伪失败条件、影响面、最小修复和为什么更小修复不足；产品/Journey 语义写 `DEXTER_DECISION`，未证事实写 `UNVERIFIED_REQUIRES_EVIDENCE`。不要运行 DEV、reset、seed、browser L2 或修改源码。

## 最小输入清单

先读规范与已接受输入：

- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `CLAUDE.md`
- `doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-journey.md`
- `doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-ui-interaction.md`
- `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-implementation-design-codex.md`
- `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-serial-plan.md`
- `doc/plans/platform/2026-08-26-v2s-catalog-workbench-observed-remediation-plan-codex.md`
- `contracts/policy/catalog-inventory-reference-path-matrix.json`
- `project-memory/decisions/confirmed-business-language-corpus.md`
- `project-memory/decisions/deterministic-context-only.md`
- `project-memory/operations/backend-acceptance.md`
- `project-memory/decisions/independent-subagent-adversarial-review.md`

再读当前 owning source：

- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/api/InventoryOwnerApi.java`
- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java`
- `apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts`
- `apps/frontend/operations-admin/src/features/catalog-management/model/catalogManifestLabels.ts`
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemGovernanceView.tsx`
- `scripts/generate/catalog-inventory-p1.mjs`
- `scripts/dev/catalog-inventory-seed-plan.mjs`
- `scripts/dev/catalog-inventory-seed-executor.mjs`
- `scripts/test/catalog-inventory-l2-fixture.mjs`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java`
- `apps/backend/catering-business-server/modules/inventory/src/test/java/com/catering/v2s/inventory/application/InventoryCatalogReferenceDependenciesIntegrationTest.java`

最后再读待审材料：

- `doc/plans/platform/2026-08-30-v2s-catalog-item-void-bom-reference-problem-analysis-codex.md`
- `doc/decisions/2026-08-30-v2s-catalog-item-void-bom-reference-journey-amendment.md`
- `doc/plans/platform/2026-08-30-v2s-catalog-item-void-bom-reference-implementation-design-codex.md`
- `doc/plans/platform/2026-08-30-v2s-catalog-item-void-bom-reference-implementation-plan-codex.md`

## 输出要求

请把独立 verdict 写入：

`doc/review/platform/2026-08-30-v2s-catalog-item-void-bom-reference-design-independent-subagent-review.md`

报告顶部必须保留：

```text
REVIEW_CYCLE_ID=CATALOG_ITEM_VOID_BOM_REFERENCE_DESIGN_20260830
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=OPEN_FOR_AUTHOR_INTAKE
```

报告先给独立 `GO`/`NO-GO` 与 `M/S/N`，再给 findings、实际打开文件、未核范围和方案合理性判断。不得代替作者修改设计，不得创建第二轮；第二轮只有在作者完成处置后、同一 cycle 定向复核时才允许。

