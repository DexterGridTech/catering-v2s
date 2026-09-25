---
title: 门店终端管理实施期 CP/P9 当前字节对账 R2
status: READY_FOR_CLAUDE_REVIEW
reviewTarget: IMPLEMENTATION_RECONCILIATION
date: 2026-09-25
reviewerKind: MAIN_AGENT_PREPARATION
---

# 1. 目的与证据边界

本记录取代上一份同名无 `-r2` 记录作为当前修复轮的对账输入。上一份记录中的 L2、reset、DEV、seed 与 acceptance 证据绑定在修复前字节，不能被本轮继承为最终证据；它仍保留为历史诊断，不在本记录升级。

- `REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION`
- `CURRENT_BYTE_STATUS=READY_FOR_CLAUDE_REVIEW`
- `WHO_WRITES=MAIN_AGENT_ONLY`
- `P9_ALLOWED_VALUES=MATCHED|OPEN`
- `P9_FINAL=MATCHED_AFTER_FRESH_INDEPENDENT_IMPLEMENTATION_REVIEW`
- `FRESH_INDEPENDENT_IMPLEMENTATION_REVIEW=GO_M0_S0_N0`
- `SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787`
- `DYNAMIC_FRONT_GATE=REQUIRED`

本轮没有改变产品语义：手填激活码仍不进入内容摘要；编辑/状态命令改为内容派生幂等键；前端不再构造服务端问题对象；基础输入和坏游标统一为 `PLATFORM_COMMON_VALIDATION_FAILED`；停用门店沿用共享门店读取边界返回 `PLATFORM_COMMON_RESOURCE_NOT_FOUND`，不再误发状态迁移码；L2 准入与失败族门对三个套件统一生效。

# 2. 当前运行状态

按项目要求，动态状态固定保留两行：

- 当前字节上的最新运行：`l2-1790308744297-70522-56d5fd5a-efe6-4874-bdd4-e4678c6206ab`，2026-09-25 04:00:04Z–04:01:18Z，完整六场景 `BUSINESS=PASS`、`CLEANUP=PASS`；其前的正式 r5-full seed `complete-seed-3b64796b-e362-4f8f-a07d-49543c3c3b9c` 也为 `BUSINESS=PASS`、`CLEANUP=PASS_PRESERVED_DEV_STATE`。
- 最后一次通过：`l2-1790308744297-70522-56d5fd5a-efe6-4874-bdd4-e4678c6206ab`，2026-09-25，`PASS`，与当前 L2 控制面字节一致；该 run 的 1,925 个绑定文件逐字节复核 `mismatchCount=0`。正式 seed 与当前 seed 脚本字节也一致。

另有一个本机直接 Gradle 命令因 `V2S_TESTCONTAINERS_REMOTE_REQUIRED` 被拒绝；该结果是执行平面门的 `NOT_APPLICABLE/拒绝` 证据，不能冒充业务测试失败，也不能替代受管远端 run。受管远端 focused owner test 的业务结果为 PASS、资源 cleanup 为 PASS，run 为 `r5-tc-1790301729596-56425`；受管远端全量 backend acceptance 也已 PASS，run 为 `r5-tc-1790304510655-47656`。

本轮 reset 已完成：`r5-reset-4f46ea7e-ad39-4ed8-8b76-2d2dc75f6f5a`，`BUSINESS=PASS_DATABASE_ABSENT_READBACK`、`CLEANUP=PASS_NO_PERSISTENT_RESET_PROCESS`。其后 DEV 受管启动为 `r5-dev-1790307619674-38620-76a62af1-2d3b-41a1-ab7b-24c3568c2311`；seed 保留 DEV 状态，未引入持久 seed 进程。

# 3. CP/整体三维对账

三维固定为：需求/裁决与 R/V、IA/详设/实施计划、项目记忆与 owning source。每个 CP 都重新核了本轮 finding 的根因、同族路径、测试/seed 载体和失败/恢复语义。

| CP | 当前对账结论 | 证据边界 |
|---|---|---|
| CP-01 | MATCHED | 规则生成物仍由 `store-terminal-rules.json` 单源生成；N-2 的数量上限、范围键和连接/型号字典仍由 generated 产物消费。 |
| CP-02 | MATCHED | S-1 幂等键、owner 审计摘要、N-1 标签/名称摘要、基础输入异常均已按 owning source 与 focused 测试复核。 |
| CP-03 | MATCHED | 七个终端 operation 的 `x-error-codes` 与 errorSetRef/增补集合一致；S-3 的坏游标、基础输入、停用门店映射已有精确 assertion。 |
| CP-04 | MATCHED | Detail action menu 改为 foundation `AdminDetailActionMenu`；前端不再自建 server problem 对象或恢复状态机；TypeScript 与 37 个 targeted UI/model 测试通过。 |
| CP-05 | MATCHED | 五个 formal seed executor 通过共享 `seed-http-client.mjs`；完整 seed dry-run 四组件、终端 8 台计划与阶段顺序通过。 |
| CP-06 | MATCHED | L2 admission 为当前 digest PASS；受影响场景与完整六场景 PASS；reset、DEV、正式 seed 均按受管入口完成，证据在第 8 节与运行目录。 |

整体结论：当前 CP、动态证据与交付前对账均 MATCHED；fresh 独立 implementation reconciliation 以当前字节复核交接入口，结论 `GO / M/S/N=0/0/0`。本记录允许进入 Claude 的独立 IMPLEMENTATION review，但不替代 Claude review。

# 4. S-1/S-3 逐条处置

| Finding | 当前处置 | 证据 |
|---|---|---|
| S-1 | `CONFIRMED → FIXED`。编辑与状态命令使用 `createContentIdempotencyKey`；新建手填码保留 drawer 意图键，并在详设登记 §3-G 例外；页面删除伪造的服务端 problem 对象与独立 recovery 状态。 | `apps/frontend/operations-admin/src/features/store-terminal/model/storeTerminalCommands.ts`；`.../ui/StoreTerminalPage.tsx`；`.../ui/StoreTerminalFormDrawer.tsx`；实现详设与计划的幂等矩阵。 |
| S-2 | `CONFIRMED → FIXED`。详情操作菜单统一使用 foundation `AdminDetailActionMenu`，带 `triggerRef` 与 `triggerTestId`。 | `apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalDetail.tsx`；`StoreTerminalPage.static.test.ts`。 |
| S-3 | `CONFIRMED → FIXED`。`InvalidTerminalInputException`（含坏游标、空白/格式基础输入、幂等键格式）映射 `PLATFORM_COMMON_VALIDATION_FAILED`；正常 owner 入口遇到停用门店映射通用 `PLATFORM_COMMON_ACCESS_DENIED`，而共享 scope 边界在页面/候选读取前将不可见门店收敛为参照页一致的 `PLATFORM_COMMON_RESOURCE_NOT_FOUND`；两条路径都不再借用 `ORGANIZATION_STORE_STATUS_TRANSITION_INVALID`。新增坏游标 acceptance 场景并改为精确码断言。 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/application/StoreTerminalOwnerService.java`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java`；`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/StoreTerminalAcceptanceScenarios.java`；`apps/backend/catering-business-server/src/test/java/edge/problem/ContractProblemAdviceTypedOwnerMappingTest.java`。 |
| S-4 | `CONFIRMED → STATIC FIXED`。P9 增量分母纳入三份 edge catalog 与 `safeLogger.ts`；七个 operation 按基础 errorSetRef 加 operation augmentation 对账，未直接把 paths 当登记源。 | 三份 `doc/plans/platform/2026-07-25-v2s-r5-edge-*.json`/`2026-07-26-v2s-r5-error-code-disposition-catalog.json`；`libraries/frontend/admin-ui-foundation/src/observability/safeLogger.ts`；`contracts/openapi/paths/operations-admin/store-terminals.paths.json`。 |
| S-5 | `CONFIRMED → FIXED STATIC`。运行器从 `L2_SUITE_CONFIGS` 取得策略，所有套件均执行 admission 与 failure-family 检查；catalog-inventory、sales-menu、store-terminal 都有策略与 policy。 | `scripts/test/browser-l2-runtime.mjs`；`scripts/test/l2-suite-admission.mjs`；三份 `scripts/test/*-l2-admission.mjs`；三份 `contracts/policy/*-l2-admission.json`；`scripts/test/l2-suite-admission.test.mjs`。 |

# 5. N-1 至 N-5 逐条处置

| Finding | 当前处置 | 证据 |
|---|---|---|
| N-1 | `CONFIRMED → FIXED`。审计配置摘要读取并显示名称、中文标签、品牌/型号/纸张/连接方式标签；不输出区域/标签 UUID 或内部 range key。owner focused 测试覆盖名称与中文标签断言。 | `StoreTerminalOwnerService.java`；`StoreTerminalOwnerServiceTest.java`。 |
| N-2 | `CONFIRMED → FIXED`。前端使用 generated range keys 与 generated function max count，不再把 `KITCHEN_PRINT` 或数量 3 作为业务字面量；规则生成器 `--check` 通过。 | `scripts/generate/store-terminal-rules.mjs`；`apps/frontend/operations-admin/src/app/api/generated/storeTerminalRules.ts`；`storeTerminalModel.ts`；`TerminalFunctionEditor.tsx`；`StoreTerminalFormDrawer.tsx`。 |
| N-3 | `CONFIRMED → FIXED`。场景编辑器使用 typed `TerminalSceneValidationError.code`，不再匹配用户可见错误文本；本地模型校验码改为 `TERMINAL_SCENE_PRINTER_IDENTITY_*`，不进入服务端 problem/error-code catalog。 | `TerminalSceneEditor.tsx`；`storeTerminalModel.ts`；`storeTerminalModel.test.ts`。 |
| N-4 | `CONFIRMED → FIXED`。正式 seed executor 使用 `invocationKey`，`invocationKeyForTest` 只留在测试装配/导出。 | `scripts/dev/owner-command-seed-executor.mjs`；`scripts/dev/store-terminal-seed-executor.mjs`。 |
| N-5 | `CONFIRMED → FIXED`。owner、business-channel、catalog/inventory、sales-menu、store-terminal 五个 formal executor 共用 `scripts/dev/seed-http-client.mjs`，保留各自业务 plan/phase/failure policy；共享 client focused/red tests 及四类既有 executor 测试通过。 | 五个 `scripts/dev/*seed-executor.mjs`；`scripts/dev/seed-http-client.mjs`；`scripts/dev/seed-http-client.test.mjs`；对应 executor tests。 |

# 6. 本轮 P9 实际增量分母

上一轮完整实现分母 158 条路径作为历史基线保留；本轮修复的实际增量分母为下列 45 条路径，四个 review 点名的遗漏文件明确在其中：三份 edge catalog 与 `safeLogger.ts`；本轮还修正了显式 Node 测试健康入口的新增测试分母。三套 L2 policy 也已把共享 `operationsL2.test.ts` 纳入控制面字节集。没有用章节抽查替代逐文件对账。

| # | 实际增量编辑路径 | owning boundary | P9 |
|---:|---|---|---|
| 01 | `apps/frontend/operations-admin/src/features/store-terminal/model/storeTerminalCommands.ts` | CP-04 | MATCHED |
| 02 | `apps/frontend/operations-admin/src/features/store-terminal/model/storeTerminalModel.ts` | CP-01/04 | MATCHED |
| 03 | `apps/frontend/operations-admin/src/features/store-terminal/model/storeTerminalModel.test.ts` | CP-05 | MATCHED |
| 04 | `apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalPage.tsx` | CP-04 | MATCHED |
| 05 | `apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalPage.static.test.ts` | CP-05 | MATCHED |
| 06 | `apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalFormDrawer.tsx` | CP-04 | MATCHED |
| 07 | `apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalDetail.tsx` | CP-04 | MATCHED |
| 08 | `apps/frontend/operations-admin/src/features/store-terminal/ui/TerminalFunctionEditor.tsx` | CP-04 | MATCHED |
| 09 | `apps/frontend/operations-admin/src/features/store-terminal/ui/TerminalSceneEditor.tsx` | CP-04 | MATCHED |
| 10 | `libraries/frontend/admin-ui-foundation/src/observability/safeLogger.ts` | CP-06 | MATCHED |
| 11 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/application/StoreTerminalOwnerService.java` | CP-02 | MATCHED |
| 12 | `apps/backend/catering-business-server/modules/store-terminal/src/test/java/com/catering/v2s/storeterminal/application/StoreTerminalOwnerServiceTest.java` | CP-02 | MATCHED |
| 13 | `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/StoreTerminalAcceptanceScenarios.java` | CP-05 | MATCHED |
| 14 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java` | CP-03 | MATCHED |
| 15 | `apps/backend/catering-business-server/src/test/java/edge/problem/ContractProblemAdviceTypedOwnerMappingTest.java` | CP-05 | MATCHED |
| 16 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/domain/generated/StoreTerminalRules.java` | CP-01 | MATCHED |
| 17 | `apps/frontend/operations-admin/src/app/api/generated/storeTerminalRules.ts` | CP-01 | MATCHED |
| 18 | `scripts/generate/store-terminal-rules.mjs` | CP-01 | MATCHED |
| 19 | `scripts/dev/owner-command-seed-executor.mjs` | CP-05 | MATCHED |
| 20 | `scripts/dev/store-terminal-seed-executor.mjs` | CP-05 | MATCHED |
| 21 | `scripts/dev/external-collaboration-business-channel-seed-executor.mjs` | CP-05 | MATCHED |
| 22 | `scripts/dev/catalog-inventory-seed-executor.mjs` | CP-05 | MATCHED |
| 23 | `scripts/dev/sales-menu-seed-executor.mjs` | CP-05 | MATCHED |
| 24 | `scripts/dev/seed-http-client.mjs` | CP-05 | MATCHED |
| 25 | `scripts/dev/seed-http-client.test.mjs` | CP-05 | MATCHED |
| 26 | `scripts/dev/external-collaboration-business-channel-seed-executor.test.mjs` | CP-05 | MATCHED |
| 27 | `scripts/dev/catalog-inventory-seed-executor.test.mjs` | CP-05 | MATCHED |
| 28 | `scripts/dev/sales-menu-seed-executor.test.mjs` | CP-05 | MATCHED |
| 29 | `scripts/test/browser-l2-runtime.mjs` | CP-06 | MATCHED |
| 30 | `scripts/test/browser-l2-runtime.test.mjs` | CP-06 | MATCHED |
| 31 | `scripts/test/l2-suite-admission.mjs` | CP-06 | MATCHED |
| 32 | `scripts/test/l2-suite-admission.test.mjs` | CP-06 | MATCHED |
| 33 | `scripts/test/catalog-inventory-l2-admission.mjs` | CP-06 | MATCHED |
| 34 | `scripts/test/sales-menu-l2-admission.mjs` | CP-06 | MATCHED |
| 35 | `scripts/test/store-terminal-l2-admission.mjs` | CP-06 | MATCHED |
| 36 | `scripts/test/store-terminal-l2-admission.test.mjs` | CP-06 | MATCHED |
| 37 | `contracts/policy/catalog-inventory-l2-admission.json` | CP-06 | MATCHED |
| 38 | `contracts/policy/sales-menu-l2-admission.json` | CP-06 | MATCHED |
| 39 | `contracts/policy/store-terminal-l2-admission.json` | CP-06 | MATCHED |
| 40 | `doc/plans/platform/2026-09-24-v2s-store-terminal-management-implementation-design-codex.md` | CP-06 | MATCHED |
| 41 | `doc/plans/platform/2026-09-24-v2s-store-terminal-management-implementation-plan-codex.md` | CP-06 | MATCHED |
| 42 | `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` | CP-03/06 | MATCHED |
| 43 | `doc/plans/platform/2026-07-26-v2s-r5-edge-contract-file-placement-catalog.json` | CP-03/06 | MATCHED |
| 44 | `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json` | CP-03/06 | MATCHED |
| 45 | `scripts/test/test-health-entry-runner.mjs` | CP-05/06 | MATCHED |

`P9=MATCHED` 的依据是这 45 条增量路径逐文件对账、当前 CP 对账、fresh admission 与动态证据均已闭合；最终交付仍须由独立 implementation review 重新确认，不能用本轮增量表替代整批逐代码审查。上一轮列出的旧 158 条路径已作为历史基线保留，并在本轮整批复核范围内重放。

# 7. 七个 operation 的声明码与实际发码对账

`contracts/openapi/paths/operations-admin/store-terminals.paths.json` 的 `x-error-codes` 已按三个生成登记源物化；paths 文件不是登记源。当前实际 owner/edge 映射如下：

| operation | errorSetRef | 增补/域码 | 当前对账 |
|---|---|---|---|
| `getOperationsStoreTerminals` | `AUTHZ_READ` | `PLATFORM_COMMON_VALIDATION_FAILED` | MATCHED |
| `getOperationsStoreTerminal` | `AUTHZ_READ` | 无 | MATCHED |
| `postOperationsStoreTerminal` | `OWNER_COMMAND` | `STORE_TERMINAL_NAME_CONFLICT`、`STORE_TERMINAL_ACTIVATION_CODE_CONFLICT`、`STORE_TERMINAL_ACTIVATION_CODE_EXHAUSTED`、`STORE_TERMINAL_REFERENCE_INVALID`、`STORE_TERMINAL_RULE_INVALID` | MATCHED |
| `putOperationsStoreTerminal` | `OWNER_COMMAND` | `STORE_TERMINAL_NAME_CONFLICT`、`STORE_TERMINAL_REFERENCE_INVALID`、`STORE_TERMINAL_RULE_INVALID`、`STORE_TERMINAL_VOIDED_IMMUTABLE` | MATCHED |
| `postOperationsStoreTerminalStatus` | `OWNER_COMMAND` | `STORE_TERMINAL_STATUS_TRANSITION_INVALID` | MATCHED |
| `getOperationsStoreTerminalAreaCandidates` | `AUTHZ_READ` | `PLATFORM_COMMON_VALIDATION_FAILED` | MATCHED |
| `getOperationsStoreTerminalTagCandidates` | `AUTHZ_READ` | `PLATFORM_COMMON_VALIDATION_FAILED` | MATCHED |

实际发码的特殊分支：基础参数/坏 cursor → `PLATFORM_COMMON_VALIDATION_FAILED`；领域规则 → `STORE_TERMINAL_RULE_INVALID`；停用门店在共享门店读取边界被隐藏并返回 `PLATFORM_COMMON_RESOURCE_NOT_FOUND`，不再借用 `ORGANIZATION_STORE_STATUS_TRANSITION_INVALID`。前端不再比较不存在的 `STORE_TERMINAL_VERSION_CONFLICT`。

# 8. L2 admission 与动态结果

fresh admission 复核已以当前三套策略分别计算 admission digest，并复核：

1. control-plane 文件全集、UI 目录、case 分母和 design/review marker；
2. 缺失 review、BLOCKED review、admission 后任一控制面字节变化均拒绝；
3. 同 suite、同 case、同 failureCategory 且字节不变的失败重跑均拒绝；
4. `browser-l2-runtime.mjs` 不存在 store-terminal 专用绕过，三个套件都通过同一策略接口；
5. 当前策略只在 fresh review 记录写入对应 digest 后才能 `L2_SCRIPT_ADMISSION=PASS`。

当前 fresh admission 记录为 `L2_SCRIPT_ADMISSION_PASS`，绑定 store-terminal digest `a622f5c9c54d87e450813f60cd202fdd60a6414870c0f858d2bc25641dfd2952`；catalog-inventory 与 sales-menu 的策略也分别以各自 digest 通过。前一轮旧 digest 记录漂移已修正，Ohm（`01a0d6b3-a55f-7601-a5d5-bd74c0064296`）以当前 digest 完成 fresh 复核。其后受管 L2 为：

- focused 受影响场景：`l2-1790308649663-68640-17da5431-08a6-4b51-a7d9-2ef5e4a7e50f`，`terminal-edit-configuration=PASS`，diagnostic business 不升级，cleanup PASS；
- 完整六场景：`l2-1790308744297-70522-56d5fd5a-efe6-4874-bdd4-e4678c6206ab`，`DISCOVERED=6 SELECTED=6 RESULTS=6 BUSINESS=PASS CLEANUP=PASS`；
- 当前 L2 byte binding 共 1,925 个文件，逐字节复核 `mismatchCount=0`；seed 相关脚本不在该绑定分母内。

# 9. 运行边界与未授权

- 本轮 Browser L2：已运行，focused 与完整六场景均 PASS，cleanup PASS；
- reset：已运行，`BUSINESS=PASS_DATABASE_ABSENT_READBACK`、`CLEANUP=PASS_NO_PERSISTENT_RESET_PROCESS`；正式 seed：`BUSINESS=PASS`、`CLEANUP=PASS_PRESERVED_DEV_STATE`，seed dry-run 亦 PASS；DEV：当前受管 run 已启动并达到 Java、Vite 与 tunnel readiness，manifest 记录 run identity/readiness，当前 DEV manifest 不声明独立 business/cleanup PASS；
- UAT、生产部署、真实设备激活、真实打印、TDP：`NOT_AUTHORIZED/OUT_OF_SCOPE`；
- Git、部署和仓库控制动作：未执行。
