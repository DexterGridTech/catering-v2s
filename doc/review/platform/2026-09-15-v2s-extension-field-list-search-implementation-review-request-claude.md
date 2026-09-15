---
title: 扩展字段列表展示与类型化搜索实施后静态 review request
reviewTarget: IMPLEMENTATION
reviewCycleId: EXTENSION_FIELD_LIST_SEARCH_IMPLEMENTATION_20260915
reviewRound: 1
reviewerKind: CLAUDE_EXTERNAL_REVIEWER
adversarialReview: true
implementationAuthority: DEXTER_AUTHORIZED
visualIa: DEXTER_CONFIRMED
runtimeEvidence: MANAGED_BUSINESS_AND_CLEANUP_ATTACHED
---

REVIEW_KIND=IMPLEMENTATION_RESULT_EXTERNAL_REVIEW
REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_IMPLEMENTATION_20260915
REVIEW_ROUND=1
reviewerKind=CLAUDE_EXTERNAL_REVIEWER
ADVERSARIAL_REVIEW=TRUE
IMPLEMENTATION_AUTHORITY=DEXTER_AUTHORIZED
VISUAL_IA=DEXTER_CONFIRMED
EVIDENCE_TIER=IMPLEMENTATION_STATIC_PLUS_FOCUSED_PLUS_MANAGED_RUNTIME
VERDICT_REQUIRED=GO | NO-GO
SEVERITY_FORMAT=M/S/N

## 背景

本轮交付单元是“扩展字段列表展示与类型化搜索”的完整实施结果。最初需求以经营租户列表为示例，实际范围已盘点并实现为 8 个 host、12 个 screen、10 个 flat consumer、7 个 list operation；组织架构树保持现状，`COMMERCIAL_GROUP`、`REGION`、`PROJECT` 在配置面为“不适用”，不进入树列、树搜索、树快照或树验收。

Dexter 已确认视觉 IA，可以进入实施；详设与实施计划的 P0–P9 已完成。实施后 fresh 独立只读复审经历了真实 finding 处置：r2 发现取消按钮只有静态 TestId 证明，主 agent 新增 component focused test；r3 进一步指出该 test 缺持久 PASS 输出，主 agent 重新执行 clean Vitest 并固化 evidence；r4 曾给出 `GO`，本轮最新 fresh r5 又重新读取当前源码与受管 evidence，给出 `GO`、`M/S/N=0/0/2`，无当前实现 blocker。r2/r3/r4/r5 的原文报告和最新 P9 对账已放入仓内。

实施过程中曾出现一次 catalog seed `SIZE-XL` label drift；根因是 owning fixture dictionary 漏记 parity plan 要求的 `SIZE-XL`。已修复生成源、重新生成 plan、通过 focused executor test，并在第二次 reset 后完成最终 seed，business 与 cleanup 均通过。该首败、根因和后续证据均保留，不以重试掩盖。

最终受管流程已完成 reset→start→完整 `r5-full` seed。当前 DEV run 为 `r5-dev-1789449702279-54617-4d01c1db-be81-41c6-89e4-559fcbcdc573`，远端 Java readiness marker、HTTP/asset tunnel、本机双 Vite 均 PASS，`5174/5175` 两页面探针均 HTTP 200；该 readiness 仍不冒充业务 acceptance。完整 seed 父 receipt 为 PASS 且保留 DEV 状态。

## 评审目标

请以当前仓库字节为事实正本，对本次实现做独立、对抗式的 `REVIEW_TARGET=IMPLEMENTATION` 静态 review，并结合已保存的受管运行 evidence 核验实现是否真实闭环：

1. 核验 `ExtensionFilter`/`ExtensionFieldType`/`ExtensionFilterQuery` 的 schema、reachable codegen、generated consumer types 与唯一 serializer/parser 是否一致；
2. 核验七个 list operation 的 owner/read model、raw `extensionValues`、`definitionRevision`、AND/Page 同集、五种类型控件与谓词、invalid/stale/recovery/error mapping；
3. 核验五张表 100,000 行 scale proof、60 个 query result（每表 6 类、每 query 3 次 EXPLAIN/BUFFERS）、index decision、七个 operation 的实际预算与 calibration exact-set；
4. 核验 shared admin-ui-foundation、10 个 flat consumer、平台 detail/list、fixed columns/no sorting、`currentData`/`isFetching`、stale once、namespace、stable TestId；
5. 核验 fixture/seed/acceptance/日志隐私、reset/DEV/seed 顺序和 business/cleanup 分账；
6. 按详设章节逐项审查 P9 code-to-design 对账，不把静态、focused、managed business、cleanup、DEV readiness 或 browser L2 混为一层。

## 需阅读文件

请从 `catering-v2s` 仓库根按当前字节阅读：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`：仓库入口、边界、Roadmap/执行规则；
- `project-memory/index.md`、全部 `project-memory/kernel/*.md`、`project-memory/decisions/deterministic-context-only.md`、`project-memory/operations/claude-review-handoff-standard.md`、`project-memory/operations/verification-governance.md`、`project-memory/operations/backend-acceptance.md`、`project-memory/operations/dev-command-separation.md`：项目规则、证据分层、受管运行和交接要求；
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md`：原始业务范围与验收；
- `doc/decisions/2026-09-14-v2s-extension-field-list-search-journey.md`：Journey、actor、平面/树边界；
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-ia-design-codex.md`、`doc/plans/platform/2026-09-14-v2s-extension-field-list-search-interaction-design-codex.md`：12 screen 的 IA、控件、状态、文案、焦点和 TestId 判据；
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-design-codex.md`：契约、owner、typed semantics、§9a、scale/index/budget、seed、P9 判据；
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-plan-codex.md`：P0–P9 顺序、验证与收口条件；
- `doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-reconciliation-codex.md`：最终对账与证据索引；只作为索引，需回到源码和原始 evidence；
- `doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-independent-review-codex-r2.md`、`doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-independent-review-codex-r3.md`、`doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-independent-review-codex-r4.md`：fresh 独立复审原文、finding 处置和最终 GO；
- `doc/review/platform/2026-09-15-v2s-extension-field-list-search-focused-test-evidence.md`：取消动作 focused test 的持久运行证据；
- `contracts/openapi/components/extension/extension.schemas.json`、`scripts/generate/edge-codegen.mjs`、`doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`、`contracts/registry/operation-handler-bindings.json`、`contracts/registry/edge-route-face-registry.json`：schema、reachable codegen、edge/generated binding；
- `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionFilterQuery.java` 及其 test、七个 operation 的 owner/controller/persistence/read model：typed parser、predicate、Page、revision、error 和 scope；
- `libraries/frontend/admin-ui-foundation/src/extension/typedExtension.ts`、`libraries/frontend/admin-ui-foundation/src/extension/staleRecovery.ts`、`libraries/frontend/admin-ui-foundation/src/extension/invalidFilter.tsx`、两 app 的 extension list adapter 和 10 个 flat list surface：共享能力、动态列/搜索/恢复；
- `apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionDefinitionEditDrawer.tsx`、`apps/frontend/platform-admin/src/app/automation/extensionTestIds.ts`、`apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionDefinitionEditDrawer.test.tsx`：配置 Drawer、真实 footer action、stable TestId 与 focused proof；
- `scripts/dev/owner-command-seed-executor.mjs`、`scripts/dev/r5-seed-plan.mjs`、`scripts/dev/profiles/r5-full.json`、`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/ExtensionScaleProof.java`、相关 `*AcceptanceScenarios.java`：fixture、seed、scale 和 acceptance；
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1789425899480-87349/extension-scale-evidence.json`：五表 100k scale 与 EXPLAIN evidence；
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1789426917726-92553/run-manifest.json`、`contracts/policy/backend-performance-cp05-calibration-report.json`：calibration、operation set、预算与 cleanup；
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1789424250358-71817/`、`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789424331930-72170/`、`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789424410961-72353/`、`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789424490584-72560/`、`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789424938412-80897/`、`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789425016749-81167/`、`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789425253628-83647/`：七个 list operation 的独立 managed acceptance；
- `.runtime/r5/reset/r5-reset-ae6c5a74-e33d-4161-9915-fa2eaa9164b9/`、`.runtime/r5/seed/complete/complete-seed-33a40d09-267e-4e1b-b503-e007f17cb7f7/`、`.runtime/r5/catalog-inventory/seed/catalog-seed-8c6bc230-9b42-42f1-b296-6f24f9c30398/`、`.runtime/r5/run-manifest.json`：最终 reset、complete seed、catalog seed、DEV readiness/topology。

## 独立核验重点

请先从当前源码和 owning source 建立判断，再对照本文档和 review 报告。重点包括：

- `ExtensionFilter.value` 必须是可生成的 `string`；`ExtensionFieldType` 必须是共享 component；`ExtensionFilterQuery` 虽为 scalar string，也必须通过 `x-v2s-logical-schema`/reachable closure 进入 generated chain，不能有第二套手写 serializer/parser；
- 非空 filters 才比较 `definitionRevision`；`extensionFilters=[]` 等价于未携带条件；五类型必须走类型匹配控件和 owner typed predicate；invalid 必须汇总且在 definition snapshot 前拒绝；stale 只恢复一次；
- 适用分母是 8 host、12 screen、10 flat consumers、7 operations，不是单独的经营租户列表；组织架构树的既有名称/编码搜索、树详情和 tree wire 必须保持不变；
- 动态列必须是固定列、无排序、按 shared `displayOrder + key` 排序；动态搜索必须进入 typed namespace；Page 的 total/items/page、raw `extensionValues` 和 definition revision 必须来自同一 owner read model；平台组织 Tab、合同 project prerequisite 和 detail/list consumer 不得串 identity；
- 五表 scale evidence 必须实际包含每表 100,000 行、每表 6 类查询、30 query、真实 plan/Planning Time/Execution Time/BUFFERS/recheck 和结果分页；index 选择不得被预期性能或 runtime DDL 替代；七个 operation 的 budget 要按 operation 读 calibration，不把另一个 run 的 observed set 混入；
- 所有 evidence 必须区分 `CONTRACT`、`BUSINESS`、`DB_OPERATIONS`、cleanup、DEV readiness 和 browser L2。当前 browser L2 是 `NOT_RUN/未授权`，不能作为实现 PASS，也不能因为未运行而否定本轮已授权实现；
- S1 focused proof 需确认 test 是当前 platform-admin runner 可执行的 component test，并确实证明 stable cancel locator、click→`requestClose`、submitting disabled；r4 已确认该证据；N1 需确认 `parseWire` 与 `validateAndBuild` 的两处 `reasons` 判断分属不同方法，不能为了错误 finding 修改代码；
- 逐项输出 P9 code-to-design：每项写明详设章节、当前实现文件/符号、实际 evidence 和结论；如果提出 finding，写明根因、适用分母、最小修复、影响和是否需要 Dexter 产品裁决。不得留下没有处置说明的 `OPEN`。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，并使用 `M/S/N` 统计。每条 finding 必须包含：严重级别、精确仓根相对路径与行号/符号、依据的详设章节、影响范围、根因、最小修复建议、是否需要 Dexter 产品裁决，以及 `CONFIRMED` / `PARTIALLY_CONFIRMED` / `REJECTED_WITH_EVIDENCE` / `UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION` 分类。

请同时给出 P0–P9 状态、`SAME_ROOT_SCAN`、`DESIGN_GAPS`、`EVIDENCE_TIER` 和 `P9_CODE_TO_DESIGN_RECONCILIATION`。如果复核后没有真实 finding，可对当前实现给出 `GO`；请明确写出 browser L2 `NOT_RUN/未授权`，不要把它混入 focused 或 managed business 证据。此次 Claude review 仅针对当前实现结果，不扩大实现范围，不要求 Git 操作，不授权 UAT、生产部署或浏览器 L2。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审「扩展字段列表展示与类型化搜索」的实施结果。

背景：本轮不是只做经营租户列表，而是完整覆盖 8 个 host、12 个 screen、10 个 flat consumer、7 个 list operation；组织架构树保持现状。Dexter 已确认视觉 IA，并授权按详设和实施计划完成 P0–P9。实施后 fresh 独立复审的真实 finding 已逐条处置：r2 的取消按钮 focused proof 缺口已补 test，r3 的持久 PASS evidence 缺口已补 evidence，r4 重新读取当前字节与 evidence 后给出 GO、M/S/N=0/0/0；N1 关于 ExtensionFilterQuery 两处 reasons 判断的重复分支已由当前源码反证为不同方法/阶段，不改代码。

目标：请独立核验当前 implementation 是否与 requirements、Journey、IA、interaction、implementation design 和 implementation plan 一致，重点核验 ExtensionFilter 的可生成 schema/reachable codegen、唯一 typed serializer/parser、五种类型谓词与控件、empty array/revision/stale/invalid/recovery、7 operation 的 Page/raw extensionValues/AND/definitionRevision、10 个 flat consumer 的 fixed columns/no sorting/currentData/isFetching、platform detail、stable TestId、五表 100,000 行 EXPLAIN/BUFFERS、七 operation budget、seed/acceptance/日志隐私，以及 P9 逐代码对账。

请从 catering-v2s 仓库根阅读：
- AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md：执行边界与工程规则；
- project-memory/index.md、全部 project-memory/kernel/*.md、project-memory/decisions/deterministic-context-only.md、project-memory/operations/claude-review-handoff-standard.md、project-memory/operations/verification-governance.md、project-memory/operations/backend-acceptance.md、project-memory/operations/dev-command-separation.md：项目 memory、证据分层和受管运行规则；
- doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md：原始范围和验收；
- doc/decisions/2026-09-14-v2s-extension-field-list-search-journey.md：Journey、actor 与树/平面边界；
- doc/plans/platform/2026-09-14-v2s-extension-field-list-search-ia-design-codex.md、doc/plans/platform/2026-09-14-v2s-extension-field-list-search-interaction-design-codex.md：12 screen 的 IA 与交互判据；
- doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-design-codex.md、doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-plan-codex.md：详设、§9a、scale/budget、seed、P0–P9 判据；
- doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-reconciliation-codex.md：最终对账索引，需回到 owning source 和原始 evidence；
- doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-independent-review-codex-r2.md、doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-independent-review-codex-r3.md、doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-independent-review-codex-r4.md：独立复审原文；
- doc/review/platform/2026-09-15-v2s-extension-field-list-search-focused-test-evidence.md：cancel focused test 的命令和 2/2 PASS；
- contracts/openapi/components/extension/extension.schemas.json、scripts/generate/edge-codegen.mjs、doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json、contracts/registry/operation-handler-bindings.json、contracts/registry/edge-route-face-registry.json：schema、codegen 和 edge binding；
- apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionFilterQuery.java 及其 tests、7 个 operation 的 owner/controller/persistence/read model：typed parser/predicate、Page、revision、error 和 scope；
- libraries/frontend/admin-ui-foundation/src/extension/typedExtension.ts、staleRecovery.ts、invalidFilter.tsx、两 app 的 extension list adapter 和 flat list surface、apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionDefinitionEditDrawer.tsx、apps/frontend/platform-admin/src/app/automation/extensionTestIds.ts、apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionDefinitionEditDrawer.test.tsx：共享能力、列表状态、配置 action 和 focused proof；
- scripts/dev/owner-command-seed-executor.mjs、scripts/dev/r5-seed-plan.mjs、scripts/dev/profiles/r5-full.json、ExtensionScaleProof.java、相关 AcceptanceScenarios.java：fixture、seed、scale、acceptance；
- .runtime/r5/evidence/remote-testcontainers/r5-tc-1789425899480-87349/extension-scale-evidence.json、.runtime/r5/evidence/remote-testcontainers/r5-tc-1789426917726-92553/run-manifest.json、contracts/policy/backend-performance-cp05-calibration-report.json：五表 EXPLAIN、calibration、operation set、budget、cleanup；
- .runtime/r5/evidence/remote-testcontainers/r5-tc-1789424250358-71817/ 至 .runtime/r5/evidence/remote-testcontainers/r5-tc-1789425253628-83647/ 的七个 run 目录：七个 list operation 的独立 managed acceptance；
- .runtime/r5/reset/r5-reset-ae6c5a74-e33d-4161-9915-fa2eaa9164b9/、.runtime/r5/seed/complete/complete-seed-33a40d09-267e-4e1b-b503-e007f17cb7f7/、.runtime/r5/catalog-inventory/seed/catalog-seed-8c6bc230-9b42-42f1-b296-6f24f9c30398/、.runtime/r5/run-manifest.json：最终 reset、seed 和 DEV readiness。

请重点独立核验：
1. `ExtensionFilter.value` 为 string，`ExtensionFieldType` 为共享 component，`ExtensionFilterQuery` 通过 logical schema 进入 edge-codegen reachable closure；不得出现第二套手写 DTO/serializer/parser。
2. 空 `extensionFilters=[]` 等价于未携带条件且不比较 revision；非空 filters 才要求 definitionRevision；五种类型使用匹配控件和 typed predicate；invalid/stale/recovery/error 的顺序和用户可见闭环正确。
3. 分母必须是 8/12/10/7，组织树不变；动态列是 fixed/no-sort，动态搜索位于 typed namespace；Page total/items/page、raw extensionValues 和 revision 同源；平台 Tab/project/detail identity 不串。
4. 五表各 100,000 行、每表 6 类 query、30 query 的真实 EXPLAIN/BUFFERS/Planning Time/Execution Time/recheck/分页结果，以及七个 operation 的独立 budget/calibration；不要把不同 run 的 observed set 混成一份证据。
5. seed、acceptance、reset、DEV readiness、business 和 cleanup 分开判断；`SIZE-XL` 的首败与修复需回读；DEV readiness 不等于 business acceptance；browser L2 当前 NOT_RUN/未授权，不作为 focused proof。
6. cancel TestId focused evidence 是否真实证明 render/click→requestClose 和 submitting disabled；N1 两处 reasons 是否确属 parseWire 与 validateAndBuild 的不同阶段。

请给出明确 `GO` 或 `NO-GO`，并按 `M/S/N` 汇总。每条 finding 请标注精确路径/行号或符号、依据的详设章节、影响范围、根因、最小修复以及是否需要 Dexter 产品裁决，并分类为 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`。同时输出 P0–P9、`SAME_ROOT_SCAN`、`DESIGN_GAPS`、`EVIDENCE_TIER` 和 `P9_CODE_TO_DESIGN_RECONCILIATION`，不得留下未处置的 OPEN。

授权边界：本次请只评审当前 implementation result；此前 Dexter 已授权 P0–P9 实施及本次 reset/DEV/seed，当前 DEV 保持运行供体验。此次 review 不授权 Git 操作、UAT、生产部署或 browser L2；browser L2 的未运行状态必须单独列出，不得升级为实现失败。谢谢。
```

## 当前权威状态覆盖（2026-09-15；以本节为准）

本文件前面的内容是上一阶段交接草稿，其中的旧 run 路径、旧预算、旧 DEV 状态和旧动态结论均不再是当前事实正本。请以仓内当前源码、当前详设以及本节列出的最新证据为准；如前文与本节冲突，以本节为准。

```text
CURRENT_REVIEW_TARGET=IMPLEMENTATION
CURRENT_REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_IMPLEMENTATION_20260915
CURRENT_REVIEW_ROUND=1
CURRENT_REVIEWER=Popper; agent=01a0a37a-ecd4-71e3-a232-58684810d038; independent_read_only; pending
CURRENT_IMPLEMENTATION_SCOPE=8 hosts / 12 screens / 10 flat consumers / 7 list operations; tree unchanged
CURRENT_BROWSER_L2=NOT_RUN_UNAUTHORIZED
CURRENT_FINAL_RESET_SEED_DEV=RESET_PASS / DEV_START_PASS / R5_FULL_SEED_PASS
```

当前已核实的最新受管证据：

- scale：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789445514821-36502/extension-scale-evidence.json`，五表各 `100000` 行，5 表 × 6 类查询 = `60` 个 query result，每个 query result `3` 次 `EXPLAIN (ANALYZE, BUFFERS)`；`INDEX_DECISION=BOUNDED_CORE_SCOPE_SCAN`、`runtimeDdl=false`、无 per-key expression index、business/cleanup 均 `PASS`。
- calibration：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789447620559-58804/`（batch 1）、`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789446413531-85798/`（batch 20）、`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789447975719-70788/`（batch 100）；三次均 `269/269`、missing/extra/drift `0`、business/cleanup `PASS`。
- ordinary acceptance：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789448750623-27172/`；`DISCOVERED=7419`、`HTTP_SUCCESS=140`、`REAL_BUSINESS_ASSERTIONS=140`、`STUB_ONLY=0`、`DIRECT_FAILURES=0`，operation set `269/269`、missing/extra/drift `0`，declared/observed/exceeded `269/269/0`，business/cleanup `PASS`。
- CP05 当前正本：`contracts/policy/backend-performance-cp05-calibration-report.json`，`BUDGET_READY=269`、`BUDGET_BLOCKED=0`。七个目标 operation 的 calibration max 为 `12/11/11/15/11/9/11`（按详设 operation 顺序逐一回读，不跨 run 混用）。批量真实观测为 `1→19`、`20→112`、`100→512`，允许上限为 `20/115/515`。
- 首败必须保留并复核：`r5-tc-1789448360590-3458` 的 `getOperationsContracts actual=12 max=8`；business/cleanup 当时已 `PASS`。根因是 CP05 report 更新后 generated outputs 仍为旧 max，修复为 `node scripts/generate/edge-codegen.mjs --write`，之后 `edge-codegen --check`、`compileTestJava` 和 ordinary acceptance 均通过。

请按原 handoff 要求输出独立 `GO`/`NO-GO` 和 `M/S/N`，并逐条分类 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`。每条 finding 必须写精确源码路径/符号、详设章节、影响分母、根因、最小修复、是否需要 Dexter 产品裁决；同时输出 P0–P9、`SAME_ROOT_SCAN`、`DESIGN_GAPS`、`EVIDENCE_TIER` 和 `P9_CODE_TO_DESIGN_RECONCILIATION`，不得以历史文本留下 OPEN。

最终交接边界：fresh reviewer 已返回并完成主 agent intake；最终 reset、DEV start、完整 seed 已按 Dexter 授权完成。browser L2 仍未授权；不要求 Git、UAT 或生产部署。请只 review 当前 implementation result，不把 DEV readiness、focused、business、cleanup 或 browser L2 混为一个证据层。

## 最终权威交接（2026-09-15；以本节为准）

前文是阶段性交接草稿；其中与本节冲突的旧 run 路径、旧 scale 数字、旧预算或旧 DEV 状态全部降级为历史记录。下面是当前实现、当前证据和当前授权的最终交接。

```text
REVIEW_KIND=IMPLEMENTATION_RESULT_EXTERNAL_REVIEW
REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_IMPLEMENTATION_20260915
REVIEW_ROUND=1
REVIEWER_KIND=CLAUDE_EXTERNAL_REVIEWER
ADVERSARIAL_REVIEW=TRUE
IMPLEMENTATION_AUTHORITY=DEXTER_AUTHORIZED
VISUAL_IA=DEXTER_CONFIRMED
FRESH_INDEPENDENT_REVIEW=GO; M/S/N=0/0/2; reviewer=Popper; agent=01a0a37a-ecd4-71e3-a232-58684810d038
AUTHOR_INTAKE=COMPLETE; CONFIRMED_IMPLEMENTATION_FINDINGS=0; DESIGN_GAPS=0; AUTHOR_OPEN=0
SCOPE=8 hosts / 12 screens / 10 flat consumers / 7 list operations; organization tree unchanged
BROWSER_L2=NOT_RUN_UNAUTHORIZED
FINAL_RUNTIME=RESET_PASS / DEV_START_PASS / R5_FULL_SEED_PASS
```

请以当前仓库字节、原始需求/Journey/IA/interaction/详设/实施计划、项目 memory 和下列最新证据为事实正本，独立判断，不接受本文或旧 review 的结论替代源码核验：

- 独立复审原始留痕：`doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-independent-review-codex-r5.md`。其中 F-01（LSP transport/tooling limitation）经主 agent 回源后以 edge-codegen、Gradle、前端 typecheck/unit/architecture 及 managed evidence 关闭为 `REJECTED_WITH_EVIDENCE`，F-02（browser L2 未授权）是正确边界，亦为 `REJECTED_WITH_EVIDENCE`；不构成实现 finding。
- 最终逐代码对账：`doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-reconciliation-codex.md` 第 11 节，须回到 owning source/evidence 验证 P0–P9；每条 finding 必须标注详设章节和实现路径/符号。
- 契约/codegen：`contracts/openapi/components/extension/extension.schemas.json`、`scripts/generate/edge-codegen.mjs`、active edge registries；当前 `ExtensionFieldType` 是共享 component，`ExtensionFilter.value` 是可生成的 string，`edge-codegen --check` PASS。
- 最新 scale：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789445514821-36502/extension-scale-evidence.json`，五表各 100,000 行，5×6=`60` query results，每个 query result 3 次真实 `EXPLAIN (ANALYZE, BUFFERS)`，`BOUNDED_CORE_SCOPE_SCAN`、无 runtime DDL/per-key expression index，business/cleanup PASS。历史 30-query run 不得覆盖此最新事实。
- 最新 calibration：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789447620559-58804/`（batch 1）、`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789446413531-85798/`（batch 20）、`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789447975719-70788/`（batch 100）；均 `269/269`、missing/extra/drift=0、business/cleanup PASS。CP05 `contracts/policy/backend-performance-cp05-calibration-report.json` 当前 `READY=269/BLOCKED=0`，七个目标 operation fixed max=`12/11/11/15/11/9/11`。
- 最新 ordinary acceptance：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789448750623-27172/`，`HTTP_SUCCESS=140`、`REAL_BUSINESS_ASSERTIONS=140`、operation set `269/269`、budget `269/269/0`、business/cleanup PASS。
- 最终 reset：`.runtime/r5/reset/r5-reset-1a54514e-e1c9-4c76-b589-a7001594302f/`；最终 DEV：`.runtime/r5/run-manifest.json`，run `r5-dev-1789449702279-54617-4d01c1db-be81-41c6-89e4-559fcbcdc573`，远端 Java + 远端同侧 DB + 本机双 Vite + HTTP/asset-only tunnel，readiness PASS。
- 最终完整 seed：`.runtime/r5/seed/complete/complete-seed-c44513ba-c7a6-47ca-9df8-70ab27123a4d/seed-report.json` 及同目录 Markdown；父 `BUSINESS=PASS`、`CLEANUP=PASS_PRESERVED_DEV_STATE`、`FIRST_FAILURE=NONE`，四阶段均 PASS。owner report 的 extension revision change/readback 与 8 host readback 位于 `.runtime/r5/seed/r5-dev-1789449702279-54617-4d01c1db-be81-41c6-89e4-559fcbcdc573/`。

请重点独立核验：

1. `ExtensionFilter.value`、共享 `ExtensionFieldType`、logical scalar query 与唯一 typed serializer/parser 是否真的形成可达生成闭包；五类型 predicate、empty array/revision ordering、invalid aggregate、stale once、scope 和 raw `extensionValues` 是否与详设一致。
2. 七个 list operation 的 owner/read model 是否在 count/page 使用同一 core+extension AND 集合；Page、definition revision、project/tenant scope、平台 hierarchy 与 flat list 是否无 identity 串线；8/12/10/7 分母是否完整。
3. foundation 是否承载 typed controls、typed namespace、stale/invalid recovery、`currentData/isFetching`；10 个 flat consumer 的动态列是否 fixed、无 sorter、`displayOrder + key` 稳定；Drawer 的 flat false/false、tree null/N/A、真实 cancel Button 和 stable TestId 是否有实现与 focused proof。
4. scale 的五表/100k/60 query/EXPLAIN 以及 CP05 三档 calibration、269 exact set、七 operation budget 是否各自使用正确 evidence；不把 211 edge registry denominator 与 269 measurement denominator 混同。
5. reset→start→seed 的受管顺序、seed 父子 receipt、extension revision/readback、日志隐私和 business/cleanup 分账是否真实成立；DEV readiness 不是 acceptance，browser L2 当前 `NOT_RUN/UNAUTHORIZED` 不作为实现缺陷。

请输出明确 `GO` 或 `NO-GO`、`M/S/N`，每条 finding 写 `CONFIRMED` / `PARTIALLY_CONFIRMED` / `REJECTED_WITH_EVIDENCE` / `UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION`、精确路径/行号或符号、详设章节、影响范围、根因、最小修复和产品裁决需求；同时输出 P0–P9、`SAME_ROOT_SCAN`、`DESIGN_GAPS`、`EVIDENCE_TIER`、`P9_CODE_TO_DESIGN_RECONCILIATION`，不得留下没有处置说明的 OPEN。

授权边界：本次只请 review 当前 implementation result。不得要求 Git、UAT、生产部署或 browser L2；DEV 当前已保持运行供 Dexter 体验。若提出 finding，主 agent 会按当前源码和 owning evidence 逐条复核后处理。

## 运行状态补充（最终）

```text
FINAL_RESET=PASS; RUN=.runtime/r5/reset/r5-reset-1a54514e-e1c9-4c76-b589-a7001594302f/
FINAL_DEV=PASS; RUN=r5-dev-1789449702279-54617-4d01c1db-be81-41c6-89e4-559fcbcdc573; MANIFEST=.runtime/r5/run-manifest.json
FINAL_SEED=PASS; REPORT=.runtime/r5/seed/complete/complete-seed-c44513ba-c7a6-47ca-9df8-70ab27123a4d/seed-report.json
FINAL_SEED_BUSINESS=PASS; FINAL_SEED_CLEANUP=PASS_PRESERVED_DEV_STATE; FIRST_FAILURE=NONE
DEV_URLS=http://localhost:5174/ ; http://localhost:5175/
DEV_HTTP_PROBE=200/200
```

补充说明：启动前 `scripts/env/check-runtime-resource-budget .runtime/r5` 为 `STATUS=PASS`（live=0）。启动后再次运行该 checker 返回 `MANAGED_RESOURCE_BUDGET_EXCEEDED`，原因是它按设计拒绝任何 live managed process；当前三棵进程树均由 `.runtime/r5/run-manifest.json` 精确拥有且仍 alive，所以这不是 DEV 失败，也不是 cleanup 失败，不应被误报为资源泄漏。

## 最新 post-repair review brief（请以本节为当前请求）

```text
您好 Claude，请对「扩展字段列表展示与类型化搜索」当前 implementation 字节做一次新的独立静态复审。

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_IMPLEMENTATION_20260915
REVIEWER_KIND=CLAUDE_EXTERNAL_REVIEWER
AUTHOR_INTAKE=COMPLETE
VISUAL_IA=DEXTER_CONFIRMED
IMPLEMENTATION_AUTHORITY=DEXTER_AUTHORIZED
CURRENT_SCOPE=8 hosts / 12 screens / 10 flat consumers / 7 list operations；组织架构树保持现状

上一次 Claude 复审中的 N-02 是真实代码逻辑问题，主 agent 已修复：
1. definition reread 失败、无 data 或 revision 低于 stale payload 下界时，列表保持 skip，不退化为 core-only 查询；页面显示字段配置错误并提供手动“重试”。
2. foundation stale gate 改为同一 scope 只自动 claim 一次；五个 recovery scope 都校验 reread definition.revision >= stale response 的 currentDefinitionRevision。
3. 成功路径仍以 typed reconcile 保留核心条件、清理无效动态条件、回第一页；显式查询/重置可以解除 recovery block。

上述修复覆盖：
- `apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx`
- `apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx`
- `apps/frontend/operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx`
- `apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`（organization/contract 两个 scope）
- `libraries/frontend/admin-ui-foundation/src/extension/staleRecovery.ts`
- `libraries/frontend/admin-ui-foundation/src/index.ts`
- 对应 foundation/operations/platform recovery tests

本轮已有 fresh 独立步骤复查：`doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-independent-review-codex-r6.md`，Bernoulli，`STEP_RECONCILIATION=MATCHED`、`OPEN_COUNT=0`。对应 design 判据是：需求 §7.3、interaction §1/§7、implementation design §6.3。请不要把该报告当作本轮 Claude 结论，仍请你独立回源当前字节。

请优先核验：
- foundation gate 是否真按 scope 单次自动恢复，manual retry 是否不被 gate 错误拦截；
- 五个 recovery scope 的 failure/no-data/low-revision 分支是否始终阻止 list query，是否有真实用户可见错误与 retry；
- revision 下界是否取自 stale response，成功后是否只发生一次 typed reconcile/list 重发，核心筛选、动态筛选、page=1 是否正确；
- scope/tab/project 切换及显式查询/重置是否清除 block，是否存在异步 recovery 覆盖用户新提交的逻辑风险；
- 不要把既有 N-01/N-04 的已修复状态重新报成 finding；请同时确认两个 adapter 当前的 ellipsis/width、generated `ExtensionFilter` 双向关联仍在。

Claude 第二轮中 S-01/S-03/N-03/N-05/N-06/DG-2..DG-6/L3 属于预算、性能阈值、fixture、P9 或 evidence/设计边界；依据 Dexter 的明确要求，本轮不补这些单纯 evidence，不要仅因它们未重提就制造代码 finding。S-02 也请区分同过滤谓词的 owner 语义与性能/evidence 争议；只有当前源码能证明业务逻辑错误时才报告代码 finding。

请输出：读取文件清单、盲审声明、每条 finding 的 `CONFIRMED` / `PARTIALLY_CONFIRMED` / `REJECTED_WITH_EVIDENCE` / `UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION`，精确源码路径/符号、详设章节、影响范围、根因、最小修复和是否需 Dexter 裁决；最后给出 `REVIEW_TARGET=IMPLEMENTATION`、`GO`/`NO-GO`、`M/S/N`、`P0-P9`、`SAME_ROOT_SCAN`、`DESIGN_GAPS`、`EVIDENCE_TIER`、`P9_CODE_TO_DESIGN_RECONCILIATION`。证据不全可明确列为未重新提供，不要把静态 proof 升级成 runtime/browser L2 PASS。

授权边界：只 review 当前 implementation；不得要求 Git、UAT、生产部署或 browser L2。当前 DEV 仅保持既有受管状态供 Dexter 体验，不要自行 reset/seed/重启。
谢谢。
```

## 最新 post-repair review brief（2026-09-15；以本节为当前请求）

```text
您好 Claude，烦请对「扩展字段列表展示与类型化搜索」当前 implementation 字节做新一轮独立静态复审。

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_IMPLEMENTATION_20260915
REVIEW_ROUND=2
REVIEWER_KIND=CLAUDE_EXTERNAL_REVIEWER
ADVERSARIAL_REVIEW=TRUE
IMPLEMENTATION_AUTHORITY=DEXTER_AUTHORIZED
VISUAL_IA=DEXTER_CONFIRMED
CURRENT_SCOPE=8 hosts / 12 screens / 10 flat consumers / 7 list operations；组织架构树保持现状
AUTHOR_INTAKE=COMPLETE
FRESH_STEP_REVIEW=Aristotle; doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-independent-review-codex-r8.md; STEP_RECONCILIATION=MATCHED; OPEN_COUNT=0

背景：上一轮 Claude 静态 implementation review 的 S-01、N-01、N-02、N-03 已逐条回源确认并修复。之后 Locke fresh 步骤复查又发现两条代码逻辑输入：失败态可能继续显示旧 currentData rows，以及组织 Tab 切换时旧 detail lazy promise 的状态串线风险；主 agent 已完成修复，Aristotle fresh 复查为 PASS、STEP_RECONCILIATION=MATCHED、OPEN_COUNT=0。请不要把上述复查报告替代你的独立判断，仍请从当前源码和正本设计回源。

本轮已修复的代码逻辑：
1. `libraries/frontend/admin-ui-foundation/src/extension/staleRecovery.ts` 的 recovery state 保存最近 stale lower bound，并以 `scopeKey + generation` 丢弃过期回调；operations 三页和 Platform organization/contract 两个 scope 的手动重试都重新 reread definition，gate 用尽后的再次 stale 也走同一恢复路径。
2. `apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx`、`StoreManagementPage.tsx`、`ContractManagementPage.tsx` 与 `apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`：list/definition/recovery failure 同时进入 failed state 并传 `dataSource=[]`，恢复中显示 loading，失败显示“暂时无法获取…字段配置”与“请重试。”。
3. Platform 组织 Tab 切换会 invalidate detail generation、关闭旧 detail 并清理旧层级选择，旧 lazy 回调不能写入当前 detail。
4. `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/OrganizationOverviewTaskReadPersistence.java`：当前 owner projection 为 MANUAL fact 的 BUSINESS_ENTITY/HIERARCHY 在 `source=SYSTEM` 时返回空结果；STORE 保留 `AND 1=0`，并有三类别测试。

请从 catering-v2s 仓库根阅读：
- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`：执行边界与 Roadmap 授权入口；
- `project-memory/index.md` 全部 kernel、`project-memory/decisions/deterministic-context-only.md`、`project-memory/operations/claude-review-handoff-standard.md`：当前记忆、事实正本与评审交接纪律；
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md`：需求 §5.2、§7.3、§10.2；
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-ia-design-codex.md`、`doc/plans/platform/2026-09-14-v2s-extension-field-list-search-interaction-design-codex.md`：列表失败清空、loading、错误文案、Tab/detail 行为；
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-design-codex.md`：§6.3、§7.2、owner/source/recovery 判据；
- `libraries/frontend/admin-ui-foundation/src/extension/staleRecovery.ts`、`src/list/adminListState.tsx`、`src/foundation.test.ts`：共享 recovery、失败列表状态与测试；
- `apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx`、`StoreManagementPage.tsx`、`ContractManagementPage.tsx`：三个 operations flat list；
- `apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`：组织五 Tab、合同列表、recovery 与 detail；
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/OrganizationOverviewTaskReadPersistence.java`、`.../OrganizationOverviewTaskReadServiceTest.java`、`.../OrganizationOverviewQueryTest.java`：platform source=SYSTEM owner projection 与测试；
- `doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-reconciliation-codex.md` §11.8、`doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-independent-review-codex-r7.md`、`...-r8.md`：本轮修复处置和独立步骤复查留痕，仅作索引，必须回源。

请重点独立核验：
1. manual retry 是否永远使用最近 stale response 的下界并绕缓存重读 definition；gate 用尽后第二次 stale 是否仍可恢复；五个 recovery scope 的 no-data/low-revision/failure 是否 fail-closed、阻断 list、可重试且不循环。
2. 五个 operations/platform flat-list consumer 是否在 list、definition、recovery failure 时既清空 `dataSource` 又进入 failed state；恢复中是否 loading 而非 empty；文案是否与 interaction §7 一致。
3. recovery 的 `scopeKey + generation` 是否覆盖显式查询、reset、scope/project/tab 切换、卸载；Platform detail Tab 切换后旧成功/失败回调是否不能覆盖当前 detail。
4. Platform `source=SYSTEM` 在 BUSINESS_ENTITY、HIERARCHY、STORE 三类的真实语义是否一致且不把 MANUAL owner rows 冒充 SYSTEM；七个 list operation、Page/raw extensionValues/definitionRevision、类型化搜索与固定无排序动态列是否仍符合详设。
5. 不要把 evidence-only 项重新制造成代码 finding：预算、性能、fixture、P9 完整性以及 browser L2 均不在本轮补证范围。当前只做静态复审；本轮未执行 runtime、reset、seed、DEV、browser L2 或 backend dynamic test。此前本地 Gradle test 受 `V2S_TESTCONTAINERS_REMOTE_REQUIRED` 门拒绝，organization `compileJava/compileTestJava` 已 PASS；不得把编译或 DEV readiness升级成动态 acceptance。

请给出读取文件清单和盲审声明，逐条使用 `CONFIRMED` / `PARTIALLY_CONFIRMED` / `REJECTED_WITH_EVIDENCE` / `UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION`，每条写精确源码路径/符号、详设章节、影响范围、根因、最小修复和是否需要 Dexter 产品裁决。最后输出：
`REVIEW_TARGET=IMPLEMENTATION`、明确 `GO` 或 `NO-GO`、`M/S/N`、P0-P9、`SAME_ROOT_SCAN`、`DESIGN_GAPS`、`EVIDENCE_TIER`、`P9_CODE_TO_DESIGN_RECONCILIATION`，不得留下未处置的 OPEN。若仅是 evidence 不全，请明确列出证据边界，不要升级为代码缺陷。

授权边界：本次只 review 当前 implementation result，不授权 Git、UAT、生产部署、reset、seed、重启 DEV 或 browser L2；当前既有受管 DEV 保持不变。谢谢。
```
