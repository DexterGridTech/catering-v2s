# 门店经营规则开关 · 实施后静态 review 请求

REVIEW_TARGET=IMPLEMENTATION
STATUS=READY_FOR_CLAUDE_REVIEW
VERDICT=PENDING_INDEPENDENT_REVIEW
M/S/N=NOT_YET_RATED
REVIEWER_KIND=INDEPENDENT_REVIEWER
SOURCE_REMINDER=以当前字节、owning source 和本文件列出的实际 evidence 为准；不把旧 handoff、聊天摘要或作者自审当作事实正本

## 背景

本次交付单元是“门店经营规则开关”。需求正本冻结 12 个开关，当前唯一真实消费者是 `catalogManagementEnabled`：它决定门店商品、库存、销售菜单页面是否可用，并要求所有会改变该门店三类数据的 STORE mutation 在后端不可绕过地拒绝。Store 规则本身由 organization owner 持有，审计同时覆盖四类 Business Entity 的扩展字段表示。

Claude 第 2 轮 DESIGN review 的结论为 `NO-GO，M/S/N=1/0/1`。其中 M-01（project-target 读取阻断门店层角色）已改为独立 Store-target operating-rule read；N-01（registry root 字段与 operation entry 字段混写）已按当前字节收窄为 `commandBoundary` 是 operation entry 字段，而 `kind`、`commandCount` 是 root 统计字段。Dexter 已授权完成生产实现、契约生成、migration、构建、测试、backend acceptance、reset、DEV、seed；browser L2、UAT、生产部署不在授权内。

实施已完成，P9 逐代码与详设对账为 `MATCHED` 且 `P9_OPEN_ITEMS=0`。请不要把这个作者侧对账状态或受管运行 PASS 当作本轮 review verdict；本文件请求 fresh、独立、以证伪为立场的 `REVIEW_TARGET=IMPLEMENTATION` 静态复审。

## 评审目标

请从当前生产源码、契约生成物、测试与 evidence 重新判断方案是否真正实现了需求与详设，重点找会让实现“不成立”的代码逻辑、授权边界、契约/生成漂移、审计回归和证据越界。对每条 finding 请指出它依据的详设章节和当前源码行号；仅把 evidence 不全与代码逻辑问题分开，不要把未授权的 browser L2 当成本批代码缺陷。

## 需阅读文件

请从 `catering-v2s` 仓库根直接打开：

- `doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-requirements-claude.md`：需求正本、R-9.2a-c、四实体审计范围和 V-1 至 V-12；
- `doc/decisions/2026-09-16-v2s-store-operating-rule-switches-journey-codex.md`：已确认 Journey、角色和 Store scope；
- `doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-interaction-design-codex.md`：Drawer、错误分层、失败留稿和用户可见行为；
- `doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-ia-design-codex.md`：三个 host 的门店事实、列表 gate 与不发列表请求约束；
- `doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-implementation-design-codex.md`：详设 §3-19、Store-target read、audit、seed 与实际执行状态；
- `doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-implementation-plan-codex.md`：P0-P9 计划、完成判据和授权边界；
- `doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-operation-mapping-codex.md`：registry 到 270 行 operation 的完整分类与 52 条 gate mapping；
- `doc/review/platform/2026-09-17-v2s-store-operating-rule-switches-implementation-reconciliation-codex.md`：主 agent 的逐文件、逐 mapping 对账和实际验证索引；
- `contracts/catalog/store-operating-rule-switches.json` 与 `contracts/catalog/store-operating-rule-switches.schema.json`：唯一规则声明和生成前校验；
- `scripts/generate/store-operating-rule-catalog.mjs`：catalog 生成器及 invalid/valid self-test；
- `contracts/openapi/components/organization/store-operating-rule-schemas.generated.json`、`contracts/openapi/components/organization/store.schemas.json`、`contracts/openapi/paths/operations-admin/store-operating-rule.paths.json`：Store values schema 和显式 Store-target path；
- `scripts/generate/edge-codegen.mjs`、`scripts/generate/r5-edge-materialize.mjs`、`contracts/registry/operation-handler-bindings.json`：生成、x-error-codes、operation 分母和 source hash；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreOperatingRuleController.java`：唯一规则读取 edge adapter；
- `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceUserService.java`：`resolveTaskScope(session, STORE, storeId)` 的 assignment/selected context 解析；
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityService.java`、`StoreService.java`、`StoreOperatingRuleCodec.java`、`StorePersistence.java`、`StoreServiceSql.java`：owner、校验、JSONB、CAS、readback、audit 和 gate；
- `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/CommandExecutionContextResolver.java`、`apps/backend/catering-business-server/modules/execution-context/src/main/java/com/catering/v2s/platform/command/WorkspaceCommandOperationToken.java`、`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/StoreOperatingRuleGate.java`：52 条 mutation 的中央 gate 链；
- `apps/backend/catering-business-server/modules/audit-model/src/main/java/com/catering/v2s/audit/contract/AuditChange.java`、`AuditChangeJson.java`、`AuditChangePolicy.java`、`AuditValueState.java` 与 `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityValueSupport.java`：四态审计、legacy、label snapshot、截断和 dynamic key policy；
- `apps/frontend/operations-admin/src/features/store-operating-rules/model/useStoreOperatingRuleGate.ts`、`apps/frontend/operations-admin/src/app/components/OperationsStoreCatalogManagementDisabledSurface.tsx`、`features/catalog-management/ui/controllers/CatalogWorkbenchController.tsx`、`features/catalog-management/ui/CatalogWorkbenchContent.tsx`、`features/inventory-management/ui/InventoryManagementPage.tsx`、`features/sales-menu/ui/SalesMenuPage.tsx`：三个 host 的规则读取、共享 surface 和列表子树生命周期；
- `apps/frontend/operations-admin/src/features/store-management/ui/StoreEditDrawer.tsx`、`apps/frontend/operations-admin/src/features/store-management/storeManagementTestIds.ts`：12 项规则控件、父子语义、完整提交和 testId；
- `apps/frontend/operations-admin/src/features/audit-history/ui/OperationsAuditHistoryModal.tsx`、`apps/frontend/platform-admin/src/features/audit-history/ui/PlatformAuditHistoryModal.tsx` 及两端 `auditChangePresentation.ts`：双端审计展示；
- `scripts/dev/owner-command-seed-executor.mjs`、`scripts/dev/owner-command-seed-executor.test.mjs`、`doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`：显式 seed map 与 owner readback；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/OrganizationAcceptanceScenarios.java`、`CatalogAcceptanceScenarios.java`、`AuditAcceptanceScenarios.java`、`BackendAcceptanceTest.java`：真实 HTTP 正反场景，包括项目层/门店层读取、父 false 子 true、batch、local/brand copy；
- `apps/backend/catering-business-server/modules/audit-model/src/test/java/com/catering/v2s/audit/contract/AuditChangeJsonTest.java`、`apps/backend/catering-business-server/modules/organization/src/test/java/com/catering/v2s/organization/application/BusinessEntityValueSupportTest.java`、`StoreOperatingRuleCodecTest.java`、`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/generated/wire/OrganizationStoreOperatingRuleWireBindingTest.java`：重点 focused/unit oracle。

## 独立核验重点

1. M-01：三个 host 的规则读取是否真的以当前选中门店 `storeId` 为显式目标，并在服务端通过 Store-target scope 解析；项目、大区、集团和门店层的允许/拒绝边界是否正确，是否仍可能读错门店或复用旧 project-target/profile 路径。
2. R-9.2c：重新从 `contracts/registry/operation-handler-bindings.json` 计算 270 条分母，核对 mapping 不是抽样；确认 52 条 mutation 每一条在 owner mutation 前经过 typed gate，34 read、3 preflight、181 non-STORE 不被误拦。batch status、local copy、brand/company copy 必须分别核验。
3. Contract boundary：确认 values 的 12 键、BOOLEAN/NUMBER/STRING 三成员闭集、默认 false/0/空串、schema 400 与 owner 422 的边界；父 false/子 true 必须合法；用四类非法声明和合法 catalog 输入证伪生成器不能“永远失败”或“永远通过”。
4. Error closure：核对新增问题码、operation augmentation、生成 enum/advice、x-error-codes 和前端中文反馈是否闭合；closure 三个实测数应为 `79/79/157`，不是只看静态 catalog。
5. Store owner：核对 JSONB 单一事实、create/update REQUIRED transaction、CAS/idempotency、权威 readback、业务写入失败时的回滚，以及 status/batch/copy 等旁路不会绕过 owner gate。
6. Audit：核对 MISSING、NULL、CLEARED、VALUE 和真实空字符串没有合并；旧行可读且明确 legacy；动态扩展 key 只来自本次 definition；label snapshot、2000 字符截断不使合法业务写失败；四类实体及既有审计读写没有回归。
7. UI：核对 StoreEditDrawer 复用既有 lifecycle、父子禁用和 full payload；三个 host 共用一个 domain surface；scope/loading/failed/disabled 时不挂载或请求列表子树，失败可重试且不丢草稿；规则事实来自显式 owner read，不来自 cache key 或 local mirror。
8. Seed/runtime evidence：核对 seed executor 每个体验 Store 显式传完整 map 且 owner readback 逐键为真；只把受管 backend acceptance 的 `CONTRACT/BUSINESS/DB_OPERATIONS` 与 cleanup 分开判读，不把 DEV 或 seed 伪称 UAT/browser L2。
9. Source drift：核对生成物 source hash、registry hash、mapping header、operation bindings 和最终 acceptance 使用的是同一当前字节；如果发现“静态已通过但生成后漂移”或 P9 漏文件，请按实际行号提出 finding。

## 当前 evidence（仅供核验，不是预先 verdict）

- 最终受管 backend acceptance：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789578383813-98101/run-manifest.json`；`status=PASS`、business=`PASS`、remote/Testcontainers cleanup=`PASS`、evidence archive=`PASS`、DEV stop/restore/cleanup=`PASS`；operation set=270/270，unclassified SQL=0，budget exceeded=0。
- reset：`.runtime/r5/reset/r5-reset-022c56a8-8b6e-4a69-af52-2c6d37a16cf6/run-manifest.json`，PASS；DEV：`.runtime/r5/run-manifest.json`，当前 `scripts/dev/check` PASS；seed：`.runtime/r5/seed/complete/complete-seed-68fc6676-6659-4472-8d18-9dd31d55f438/run-manifest.json` 与 `seed-report.json`，business PASS、cleanup=`PASS_PRESERVED_DEV_STATE`。
- 这些 evidence 证明受管后端和 DEV/seed 边界，不证明 browser L2；browser L2、UAT、生产部署本轮均 `NOT_AUTHORIZED`。
- 静态基线中的 Android 生成空目录、UTF-8 行长和 terminal readability 观察已单独记录，不要把它们无依据升级为本批实现缺陷，也不要把本批所有静态检查泛化成“全仓无问题”。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，并报告 `M/S/N` 数量。每条 finding 请标注：

- 类型：仓内事实、推论、产品判断或尚缺证据的假设；
- 详设依据：具体章节；
- 当前源码：从仓根可打开的相对路径与精确行号；
- 影响、最小修复和为什么更小方案不足；
- 是否需要 Dexter 的产品/范围裁决；
- 区分代码逻辑缺陷、文档/P9 evidence 缺口和未授权动态验证。

## 授权边界

本文件只请求实施结果的独立静态 review。生产代码、契约生成、migration、构建、测试、backend acceptance、reset、DEV、seed 已在 Dexter 授权内并已执行；Claude 的 verdict 只评估当前实施是否满足需求与详设，不新增 UAT、部署或 browser L2 授权。若发现代码逻辑问题，修复仍须由主 Codex agent current-source 验证后处理；若只是 evidence 不全，按 Dexter 的要求可记录但不要求为了补材料扩大运行范围。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助对「门店经营规则开关」实施结果做一轮独立静态 review。

REVIEW_TARGET=IMPLEMENTATION。

背景：本批实现 12 个门店经营规则开关，当前唯一真实消费者是 catalogManagementEnabled；它控制三个门店经营 host，并要求所有改变该门店商品、库存、销售菜单数据的 STORE mutation 在后端拒绝。上一轮 DESIGN review 为 NO-GO，M-01（project-target 规则读取阻断门店层角色）与 N-01（registry root/operation entry 字段口径）已按当前字节修复。生产代码、契约生成、migration、测试、backend acceptance、reset、DEV、seed 已在 Dexter 授权内完成；browser L2、UAT、生产部署未授权。

目标：请独立判断当前实现是否满足需求、详设、IA、交互和 owner/契约边界，并找出会使交付不成立的代码逻辑问题。

请不要把旧 handoff、聊天摘要、作者自审结论或本文件的 MATCHED/evidence 摘要当作事实正本。请从当前仓库字节、owning source 和下列正本独立推导并以证伪为立场复审：
- doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-requirements-claude.md
- doc/decisions/2026-09-16-v2s-store-operating-rule-switches-journey-codex.md
- doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-interaction-design-codex.md
- doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-ia-design-codex.md
- doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-implementation-design-codex.md
- doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-implementation-plan-codex.md
- doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-operation-mapping-codex.md
- doc/review/platform/2026-09-17-v2s-store-operating-rule-switches-implementation-reconciliation-codex.md

请重点核验：
1. 三个 host 是否以显式 storeId 使用 Store-target resolveTaskScope，集团/大区/项目/门店层是否都得到正确的目标门店事实；
2. registry 270 与 mapping 270 的全集一致性，以及 52/52 STORE mutation 是否都在 owner mutation 前 gate；batch status、local copy、brand/company copy 各自不能漏；
3. 12 键、BOOLEAN/NUMBER/STRING 闭集、默认值、schema 400 与 owner 422 的边界，父 false/子 true 合法，生成器四类 red mutation 加合法正例；
4. 403/422 error chain、54 path materialization、closure 79/79/157；
5. Store JSONB owner、同事务 CAS/idempotency/readback、审计四态/legacy/label snapshot/截断/dynamic allowlist 与四类实体回归；
6. StoreEditDrawer、shared disabled surface、三个 host 的 failure/disabled/no-list-request 行为、seed 显式 true 和 owner readback；
7. source hash、生成物、最终受管 acceptance 的当前字节是否一致，并区分静态、backend acceptance、DEV/seed 与未授权 browser L2 证据。

请给出明确 GO 或 NO-GO，并报告 M/S/N 数量。每条 finding 请写明：仓根相对路径、当前字节精确行号、对应详设章节、影响、最小修复及更小方案为何不足、是否需要 Dexter 裁决；区分代码逻辑问题和单纯 evidence 缺口。不要把 browser L2/UAT/deploy 未运行本身记为本批代码缺陷。

授权边界：本轮只评估当前 implementation，不新增任何实施、运行、UAT、部署或 browser L2 授权；若发现真实代码逻辑问题，由主 Codex agent 先按 current source 验证和根因扫描后处理。谢谢。
```
