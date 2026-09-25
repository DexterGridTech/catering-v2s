---
title: 门店终端管理实施期 CP/P9 当前字节对账
status: MATCHED
reviewTarget: IMPLEMENTATION_RECONCILIATION
date: 2026-09-25
reviewerKind: MAIN_AGENT_PREPARATION_PLUS_INDEPENDENT_SUBAGENT
---

# 1. 目的与状态

本记录用于补齐实施计划要求的 CP-01 至 CP-06 步骤级三维对账、全批整体三维对账和 P9 逐实际变更文件对账。它不把动态 PASS 当成设计闭包，也不把作者自审当成独立 verdict；当前先由主 agent 按当前字节建立分母，随后交 fresh 独立只读 reviewer 复核。

- `REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION`
- `CURRENT_BYTE_STATUS=MATCHED_AFTER_FRESH_INDEPENDENT_REVIEW`
- `CP_RECONCILIATION=MATCHED`
- `WHO_WRITES=MAIN_AGENT_ONLY`
- `P9_ALLOWED_VALUES=MATCHED|OPEN`
- `P9_FINAL=MATCHED`
- `INDEPENDENT_REVIEW=GO；M/S/N=0/0/0；见 doc/review/platform/2026-09-25-v2s-store-terminal-management-implementation-reconciliation-fresh-codex.md`
- `SCOPE=`doc/plans/platform/2026-09-24-v2s-store-terminal-management-implementation-design-codex.md`、实施计划、需求正本 D-28..D-35/V-29、已接受 IA/交互、项目记忆与当前源码/evidence`

没有修改产品语义、契约、业务代码或运行环境；本记录只补交付审查所需的可复核索引。

# 2. 当前动态证据与字节绑定边界

| 范围 | 当前有效 evidence | business | cleanup | 当前边界 | 当前字节绑定 |
|---|---|---|---|---|---|
| Browser L2 | `.runtime/browser-l2/l2-1790297697640-40277-eb36782a-e4d4-468a-852b-f25576362ee0/l2-execution-manifest.json` | PASS，六场景 | PASS | admission digest=`a148e52ef89a21d70f9791920526fa531c15e8c2aa7f741265379603a8e5ccb7`；执行六个 case；lastKnownGood=`L2_6_CASES_PASS` | `PASS`；同 run readiness 的 repository-byte-binding 为 1,925 files / 17,468,406 bytes，binding digest=`548ddfc1dd2532cf51abbdca19904ae8cb98a4a4066f347e355dc57bc4b23b12` |
| reset | `.runtime/r5/reset/r5-reset-8a1d5e77-58ee-4ce8-8a38-08686d34292c/run-manifest.json` | PASS_DATABASE_ABSENT_READBACK | PASS_NO_PERSISTENT_RESET_PROCESS | firstFailure=null | `RUNTIME_EVIDENCE_ONLY`；manifest 未提供本批全源文件 digest |
| complete seed | `.runtime/r5/seed/complete/complete-seed-a7e9df45-ab3c-494e-830e-7b89485daf83/seed-report.json` | PASS | PASS_PRESERVED_DEV_STATE | terminal post-step created/readback=8/8，列表=7；group/project 可编辑，store 只读 | `RUNTIME_EVIDENCE_ONLY`；manifest 未提供本批全源文件 digest |
| backend acceptance | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790295431349-95986/run-manifest.json` | PASS，191/191 HTTP 与业务断言 | PASS | operation set 293/293；SQL 103960；unclassified=0 | `RUN_SOURCE_SYNC_ONLY`；不宣称覆盖本批全部控制面字节 |
| 当前 DEV | `.runtime/r5/run-manifest.json` | readiness PASS | 由受管 manifest 管理 | run=`r5-dev-1790295803565-86945-29fbb9e6-7a58-4eed-b3a9-d38e85f7a449`；Java/Vite/tunnel 均 ready | `RUNTIME_EVIDENCE_ONLY`；当前源码正确性由本记录的静态当前字节对账承担 |

旧失败 run 只保留为诊断历史，不升级为 PASS，也不参与当前交付判定。

只有 Browser L2 的 evidence 具备本批控制面与 UI 的完整字节绑定。reset、seed、backend acceptance 与 DEV 的结果仍是真实运行证据，分别证明其业务/清理或 readiness 结果，但本记录不把它们表述为完整当前字节绑定；当前源码、契约、脚本、测试与文档的正确性由 CP/P9 的静态当前字节对账和 fresh reviewer 复核承担。

# 3. 三维对账方法

每个 CP 逐项按以下三维重开：

1. 需求/裁决：需求正本 D-28..D-35、R/V 分母；
2. IA/详设/实施计划：IA-ID、字段/行为、CP 责任、测试与 seed 同步；
3. 项目记忆与 owning source：模块 owner、生成链、共享 foundation、事务/幂等/审计、运行器与 evidence。

每行必须能回答：当前 owning source、对应 R/V/IA、测试/生成/seed 载体、当前 evidence、是否存在零引用新增符号或设计点名未产出文件。未适用项写 `N/A_WITH_REASON`，不留空。

# 4. CP 步骤级三维对账

| CP | 需求与详设覆盖 | owning source/载体 | 当前 proof | 结论 |
|---|---|---|---|---|
| CP-01 | H1-H8、D-35、V-26/V-29；规则单源、型号×纸规格×连接方式 | `contracts/catalog/store-terminal-rules.json`、schema、generator、Java/TS/OpenAPI generated rules；owner `StoreTerminalRules` | generator --check/red mutation、owner 规则 focused、V-29 HTTP 负例与 readback；相关文件列于 §7 | MATCHED |
| CP-02 | R-1..R-8；整聚合、三表、CAS/幂等、激活码、owner 审计、organization/catalog 窄读 | store-terminal 四层、organization read、migration、audit-model/read | owner focused、migration integration、receipt/审计脱敏与 rollback；acceptance/seed 动态结果 | MATCHED |
| CP-03 | R-8/R-9、七 operation、errorSetRef、权限、审计读取 | edge source/生成物、controller、M1 operations、admin catalog、workspace IAM、audit read | 生成/route/grant、HTTP acceptance、V-25、审计 controller focused；路径见 §7 | MATCHED |
| CP-04 | 六屏 IA、foundation lifecycle、Drawer、无权限/空态/候选/激活码可见范围 | operations-admin store-terminal feature、testIds、page registry、RTK、L2 action nodes | frontend focused/render/static、TypeScript、L2 admission 与六场景 PASS；路径见 §7 | MATCHED |
| CP-05 | R-10 与全部 V；acceptance 分母、seed 正本/执行器、L2 控制面与红变异 | StoreTerminalAcceptanceScenarios、BackendAcceptanceScenarioCatalog、fixture/executor、L2 policy/scripts、catalog self-contained source | 191/191 acceptance、seed 8 台 readback、当前字节 L2 6/6、focused/static suites；动态证据见 §2；终端 seed plan 由 `store-terminal-seed-executor.mjs` 的 `buildStoreTerminalSeedPlan` 与 `--plan-only` 单一承载 | MATCHED |
| CP-06 | fresh CP review、整体三维、P9；只允许 MATCHED/OPEN | 本记录、独立 reviewer 输入/结论、实际文件全集 | fresh 独立 reviewer Fermat 已复核当前字节、CP-01..CP-06、P9 分母与 evidence 边界 | MATCHED |

# 5. 全批整体三维对账

## 5.1 需求/IA/详设反向覆盖

- R-C.1..R-C.6：规则单源、生成物、中文字典、V-26/V-29。
- R-1.1..R-1.5：终端身份、状态、设备类型、名称与编码约束。
- R-2.1..R-2.5：功能集合、实例身份、单例/多实例与整聚合保存。
- R-3.1..R-3.14：区域/标签引用、全部/指定、旧作废引用与候选边界。
- R-4.1..R-4.6：打印机、品牌/型号/纸型/连接方式与单字符串标识。
- R-5.1..R-5.6：功能内场景、订单类型与每场景无序打印机集合。
- R-6.1..R-6.5：生命周期、作废只读、门店状态与不联动经营开关。
- R-7.1..R-7.4：完整校验、版本、幂等、失败恢复。
- R-8.1..R-8.9：手填/自动激活码、唯一性、脱敏与详情专有显示。
- R-9.1..R-9.9：页面/写权限、角色、审计与状态呈现。
- V-1..V-25、V-28、V-29：真实 HTTP、typed failure、未写入与 readback；V-26 source review；V-27 frontend render。
- 六个 IA case：list/detail、create-basic、create-configuration、edit-configuration、readonly、status-actions；对应 L2 6/6。

每一项都有 owning source 与测试/seed 归属；不以“能找到一份测试”代替闭包。当前主 agent 反向扫描未发现设计点名而完全未产出的终端生产文件，也未发现为目录形态新增但无消费者的终端 operation adapter。fresh 独立 reviewer 已对 CP-06、P9 和该反向核对复算，未发现反证。

## 5.2 横切与共享能力

- dirty/close guard、submission、overlay lock、cursor candidate、refresh 走 admin-ui-foundation；
- 终端写命令沿 generated M1 binding 到 owner，不绕过 owner；
- organization/catalog 只读窄 API，不跨 owner 写；
- activation code 仅 detail DTO；list、receipt、audit、log、problem 不含原码；
- 审计写入 store-terminal 自有 `store_terminal.audit_event`，与 terminal/receipt 同 REQUIRED 事务；
- seed 使用唯一 fixture 正本与父流程 post-step，不另造第二数据住址；
- Browser L2 以当前 admission digest 绑定控制面与 UI 字节。

# 6. P9 结论与检查命令

P9 分母不是计划预期文件，而是当前任务范围内通过下列可复算规则得到的 158 个路径：

`rg -l -i 'store[-_ ]?terminal|storeTerminal|STORE_TERMINAL|PG-STORE-TERMINALS|EDIT_STORE_TERMINAL|terminalRef|terminal ref' contracts apps/backend/catering-business-server apps/frontend/operations-admin scripts doc/plans/platform/2026-09-2*.md`

排除：`build/`、`dist/`、`node_modules/`、`.runtime/`、历史迁移文本；输出按路径排序。该分母已包含生产源码、契约与生成物、前端、测试、seed/L2/生成脚本、详设与计划。catalog-inventory 自包含 seed 的不含终端字面量的源文件另列于 §8，不因字面量扫描漏掉。

额外的 N/A 分母记录：`scripts/dev/store-terminal-seed-plan.mjs` 当前不存在，也不计入 158 个实际路径。`N/A_WITH_REASON`：现有 `scripts/dev/store-terminal-seed-executor.mjs` 已提供 `buildStoreTerminalSeedPlan` 与 `--plan-only`，详设 §10b/§15 与实施计划对应步骤已冻结该 executor 为唯一计划住址；另建同名 plan 文件会形成第二住址并重复校验。对应测试为 `scripts/dev/store-terminal-seed-executor.test.mjs`，因此这是已解释的不适用文件，不是遗漏。

P9 当前主 agent 逐路径记录如下；每行的 CP 是 owning boundary，MATCHED 表示已对照需求/IA/详设/规范并有对应 focused/static/dynamic proof；没有使用 PARTIAL、ASSUMED 或 PASS_WITH_EXCEPTION。

| # | 实际路径 | owning CP | P9 |
|---:|---|---|---|
| 001 | `apps/backend/catering-business-server/build.gradle.kts` | CP-06 | MATCHED |
| 002 | `apps/backend/catering-business-server/modules/audit-model/src/main/java/com/catering/v2s/audit/contract/AuditEntityTypes.java` | CP-02 | MATCHED |
| 003 | `apps/backend/catering-business-server/modules/audit-model/src/test/java/com/catering/v2s/audit/contract/AuditChangePolicyTest.java` | CP-02 | MATCHED |
| 004 | `apps/backend/catering-business-server/modules/audit-read/build.gradle.kts` | CP-02 | MATCHED |
| 005 | `apps/backend/catering-business-server/modules/audit-read/src/main/java/com/catering/v2s/audit/read/OperationsAuditTaskReadService.java` | CP-02 | MATCHED |
| 006 | `apps/backend/catering-business-server/modules/audit-read/src/test/java/com/catering/v2s/audit/read/OperationsAuditTaskReadServiceTest.java` | CP-02 | MATCHED |
| 007 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreServicePointService.java` | CP-02 | MATCHED |
| 008 | `apps/backend/catering-business-server/modules/organization/src/test/java/com/catering/v2s/organization/application/StoreTerminalAreaReadTest.java` | CP-02 | MATCHED |
| 009 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/api/StoreTerminalOwnerApi.java` | CP-02 | MATCHED |
| 010 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/application/ActivationCodeCandidateSource.java` | CP-02 | MATCHED |
| 011 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/application/SecureActivationCodeCandidateSource.java` | CP-02 | MATCHED |
| 012 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/application/StoreTerminalAuditHistoryService.java` | CP-02 | MATCHED |
| 013 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/application/StoreTerminalOwnerService.java` | CP-02 | MATCHED |
| 014 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/application/TerminalConfigurationCodec.java` | CP-02 | MATCHED |
| 015 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/domain/ActivationCode.java` | CP-02 | MATCHED |
| 016 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/domain/PrinterSpecification.java` | CP-02 | MATCHED |
| 017 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/domain/TerminalConfiguration.java` | CP-02 | MATCHED |
| 018 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/domain/generated/StoreTerminalRules.java` | CP-02 | MATCHED |
| 019 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/persistence/StoreTerminalAuditEventWriter.java` | CP-02 | MATCHED |
| 020 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/persistence/StoreTerminalAuditHistoryPersistence.java` | CP-02 | MATCHED |
| 021 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/persistence/StoreTerminalAuditHistoryServiceSql.java` | CP-02 | MATCHED |
| 022 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/persistence/StoreTerminalOwnerPersistence.java` | CP-02 | MATCHED |
| 023 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/persistence/StoreTerminalOwnerPersistenceSql.java` | CP-02 | MATCHED |
| 024 | `apps/backend/catering-business-server/modules/store-terminal/src/test/java/com/catering/v2s/storeterminal/application/StoreTerminalAuditHistoryServiceTest.java` | CP-02 | MATCHED |
| 025 | `apps/backend/catering-business-server/modules/store-terminal/src/test/java/com/catering/v2s/storeterminal/application/StoreTerminalOwnerServiceTest.java` | CP-02 | MATCHED |
| 026 | `apps/backend/catering-business-server/modules/store-terminal/src/test/java/com/catering/v2s/storeterminal/domain/ActivationCodeTest.java` | CP-02 | MATCHED |
| 027 | `apps/backend/catering-business-server/modules/store-terminal/src/test/java/com/catering/v2s/storeterminal/domain/PrinterSpecificationTest.java` | CP-02 | MATCHED |
| 028 | `apps/backend/catering-business-server/modules/store-terminal/src/test/java/com/catering/v2s/storeterminal/domain/TerminalConfigurationTest.java` | CP-02 | MATCHED |
| 029 | `apps/backend/catering-business-server/modules/store-terminal/src/test/java/com/catering/v2s/storeterminal/persistence/StoreTerminalAuditEventWriterTest.java` | CP-02 | MATCHED |
| 030 | `apps/backend/catering-business-server/modules/store-terminal/src/test/java/com/catering/v2s/storeterminal/persistence/StoreTerminalSchemaMigrationIntegrationTest.java` | CP-02 | MATCHED |
| 031 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/api/WorkspaceAuthorizationCatalog.java` | CP-03 | MATCHED |
| 032 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/api/WorkspaceCapabilityRequirementCatalog.java` | CP-03 | MATCHED |
| 033 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/EdgeProblemCode.java` | CP-06 | MATCHED |
| 034 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalAreaCandidate.java` | CP-03 | MATCHED |
| 035 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalAreaCandidatePage.java` | CP-03 | MATCHED |
| 036 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalAreaReference.java` | CP-03 | MATCHED |
| 037 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalConfiguration.java` | CP-03 | MATCHED |
| 038 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalConfigurationInput.java` | CP-03 | MATCHED |
| 039 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalCreateRequest.java` | CP-03 | MATCHED |
| 040 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalDetail.java` | CP-03 | MATCHED |
| 041 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalFunction.java` | CP-03 | MATCHED |
| 042 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalFunctionInput.java` | CP-03 | MATCHED |
| 043 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalMutation.java` | CP-03 | MATCHED |
| 044 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalPage.java` | CP-03 | MATCHED |
| 045 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalPrinter.java` | CP-03 | MATCHED |
| 046 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalPrinterBinding.java` | CP-03 | MATCHED |
| 047 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalPrinterInput.java` | CP-03 | MATCHED |
| 048 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalPrinterRef.java` | CP-03 | MATCHED |
| 049 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalRange.java` | CP-03 | MATCHED |
| 050 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalRangeSelection.java` | CP-03 | MATCHED |
| 051 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalReplaceRequest.java` | CP-03 | MATCHED |
| 052 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalScene.java` | CP-03 | MATCHED |
| 053 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalSceneSelection.java` | CP-03 | MATCHED |
| 054 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalStatus.java` | CP-03 | MATCHED |
| 055 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalStatusRequest.java` | CP-03 | MATCHED |
| 056 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalSummary.java` | CP-03 | MATCHED |
| 057 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalTagCandidate.java` | CP-03 | MATCHED |
| 058 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalTagCandidatePage.java` | CP-03 | MATCHED |
| 059 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/StoreTerminalTagReference.java` | CP-03 | MATCHED |
| 060 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/audit/OperationsAuditHistoryController.java` | CP-03 | MATCHED |
| 061 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreTerminalController.java` | CP-03 | MATCHED |
| 062 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java` | CP-06 | MATCHED |
| 063 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/storeterminal/application/operations/PostOperationsStoreTerminalOperation.java` | CP-03 | MATCHED |
| 064 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/storeterminal/application/operations/PostOperationsStoreTerminalStatusOperation.java` | CP-03 | MATCHED |
| 065 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/storeterminal/application/operations/PutOperationsStoreTerminalOperation.java` | CP-03 | MATCHED |
| 066 | `apps/backend/catering-business-server/src/main/resources/db/migration/V20260924_000000_000__store_terminal_owner.sql` | CP-02 | MATCHED |
| 067 | `apps/backend/catering-business-server/src/main/resources/generated/capability-operation-registry.json` | CP-03 | MATCHED |
| 068 | `apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json` | CP-03 | MATCHED |
| 069 | `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java` | CP-03 | MATCHED |
| 070 | `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java` | CP-03 | MATCHED |
| 071 | `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/StoreTerminalAcceptanceScenarios.java` | CP-03 | MATCHED |
| 072 | `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/operations/audit/OperationsAuditHistoryControllerTest.java` | CP-03 | MATCHED |
| 073 | `apps/backend/catering-business-server/src/test/java/database/DatabaseBoundariesTest.java` | CP-02 | MATCHED |
| 074 | `apps/backend/catering-business-server/src/test/java/database/MasterDataLifecycleMigrationIntegrationTest.java` | CP-02 | MATCHED |
| 075 | `apps/backend/catering-business-server/src/test/java/edge/EdgeRouteRegistryCoverageTest.java` | CP-03 | MATCHED |
| 076 | `apps/backend/catering-business-server/src/test/java/edge/problem/ContractProblemAdviceTypedOwnerMappingTest.java` | CP-03 | MATCHED |
| 077 | `apps/frontend/operations-admin/src/app/OperationsApp.tsx` | CP-04 | MATCHED |
| 078 | `apps/frontend/operations-admin/src/app/api/generated/operations-edge.rtk.ts` | CP-03 | MATCHED |
| 079 | `apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts` | CP-03 | MATCHED |
| 080 | `apps/frontend/operations-admin/src/app/api/generated/storeTerminalRules.ts` | CP-03 | MATCHED |
| 081 | `apps/frontend/operations-admin/src/app/api/operationsProblemFeedback.ts` | CP-03 | MATCHED |
| 082 | `apps/frontend/operations-admin/src/app/catalog/generatedAdminCatalog.ts` | CP-04 | MATCHED |
| 083 | `apps/frontend/operations-admin/src/app/components/OperationsRequiredScopeSurface.test.tsx` | CP-04 | MATCHED |
| 084 | `apps/frontend/operations-admin/src/app/routing/pageRegistry.tsx` | CP-04 | MATCHED |
| 085 | `apps/frontend/operations-admin/src/features/store-terminal/model/storeTerminalCommands.ts` | CP-04 | MATCHED |
| 086 | `apps/frontend/operations-admin/src/features/store-terminal/model/storeTerminalModel.test.ts` | CP-04 | MATCHED |
| 087 | `apps/frontend/operations-admin/src/features/store-terminal/model/storeTerminalModel.ts` | CP-04 | MATCHED |
| 088 | `apps/frontend/operations-admin/src/features/store-terminal/model/useStoreTerminalReadModel.ts` | CP-04 | MATCHED |
| 089 | `apps/frontend/operations-admin/src/features/store-terminal/storeTerminalTestIds.ts` | CP-04 | MATCHED |
| 090 | `apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalDetail.test.tsx` | CP-04 | MATCHED |
| 091 | `apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalDetail.tsx` | CP-04 | MATCHED |
| 092 | `apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalFormDrawer.tsx` | CP-04 | MATCHED |
| 093 | `apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalL2ActionNodes.static.test.ts` | CP-04 | MATCHED |
| 094 | `apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalPage.static.test.ts` | CP-04 | MATCHED |
| 095 | `apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalPage.tsx` | CP-04 | MATCHED |
| 096 | `apps/frontend/operations-admin/src/features/store-terminal/ui/TerminalCreateDrawer.tsx` | CP-04 | MATCHED |
| 097 | `apps/frontend/operations-admin/src/features/store-terminal/ui/TerminalEditDrawer.tsx` | CP-04 | MATCHED |
| 098 | `apps/frontend/operations-admin/src/features/store-terminal/ui/TerminalEditors.partial.test.tsx` | CP-04 | MATCHED |
| 099 | `apps/frontend/operations-admin/src/features/store-terminal/ui/TerminalFunctionEditor.range.test.ts` | CP-04 | MATCHED |
| 100 | `apps/frontend/operations-admin/src/features/store-terminal/ui/TerminalFunctionEditor.tsx` | CP-04 | MATCHED |
| 101 | `apps/frontend/operations-admin/src/features/store-terminal/ui/TerminalPrinterEditor.tsx` | CP-04 | MATCHED |
| 102 | `apps/frontend/operations-admin/src/features/store-terminal/ui/TerminalSceneEditor.tsx` | CP-04 | MATCHED |
| 103 | `apps/frontend/operations-admin/src/tests/l2/operationsL2.ts` | CP-03 | MATCHED |
| 104 | `apps/frontend/operations-admin/src/tests/l2/store-terminal.spec.ts` | CP-05 | MATCHED |
| 105 | `contracts/catalog/admin-catalog.json` | CP-06 | MATCHED |
| 106 | `contracts/catalog/store-terminal-rules.json` | CP-01 | MATCHED |
| 107 | `contracts/catalog/store-terminal-rules.schema.json` | CP-01 | MATCHED |
| 108 | `contracts/openapi-source/store-terminal.schemas.json` | CP-01 | MATCHED |
| 109 | `contracts/openapi/components/store-terminal/store-terminal-rules.generated.json` | CP-01 | MATCHED |
| 110 | `contracts/openapi/components/store-terminal/store-terminal.schemas.json` | CP-01 | MATCHED |
| 111 | `contracts/openapi/edge.openapi.json` | CP-03 | MATCHED |
| 112 | `contracts/openapi/paths/operations-admin/audit-history.paths.json` | CP-03 | MATCHED |
| 113 | `contracts/openapi/paths/operations-admin/store-terminals.paths.json` | CP-03 | MATCHED |
| 114 | `contracts/policy/backend-performance-cp05-calibration-report.json` | CP-05 | MATCHED |
| 115 | `contracts/policy/frontend-asset-carryover-manifest.json` | CP-05 | MATCHED |
| 116 | `contracts/policy/lifecycle-vocabulary.json` | CP-05 | MATCHED |
| 117 | `contracts/policy/store-terminal-l2-activation-candidate.json` | CP-05 | MATCHED |
| 118 | `contracts/policy/store-terminal-l2-admission.json` | CP-05 | MATCHED |
| 119 | `contracts/policy/store-terminal-l2-case-blueprint.json` | CP-05 | MATCHED |
| 120 | `contracts/policy/store-terminal-l2-execution.json` | CP-05 | MATCHED |
| 121 | `contracts/policy/store-terminal-l2-fixture.json` | CP-05 | MATCHED |
| 122 | `contracts/policy/store-terminal-l2-locator-bindings.json` | CP-05 | MATCHED |
| 123 | `contracts/policy/store-terminal-l2-scenarios.json` | CP-05 | MATCHED |
| 124 | `contracts/policy/store-terminal-l2-timing-budget.json` | CP-05 | MATCHED |
| 125 | `contracts/policy/store-terminal-rtk-tag-policy.json` | CP-05 | MATCHED |
| 126 | `contracts/registry/generated/operation-handler-bindings/index.json` | CP-03 | MATCHED |
| 127 | `contracts/registry/generated/operation-handler-bindings/java/com/catering/v2s/generated/operationbindings/OperationBindingTypes.java` | CP-03 | MATCHED |
| 128 | `contracts/registry/generated/operation-handler-bindings/java/com/catering/v2s/generated/operationbindings/storeterminal/StoreTerminalOperationBindings.java` | CP-03 | MATCHED |
| 129 | `contracts/registry/generated/operation-handler-bindings/store-terminal.json` | CP-03 | MATCHED |
| 130 | `contracts/registry/iam-org-governance-manifest.json` | CP-03 | MATCHED |
| 131 | `contracts/registry/operation-handler-bindings.json` | CP-03 | MATCHED |
| 132 | `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md` | CP-06 | MATCHED |
| 133 | `doc/plans/platform/2026-09-23-v2s-store-terminal-management-requirements-claude.md` | CP-06 | MATCHED |
| 134 | `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ui-interaction-design-codex.md` | CP-06 | MATCHED |
| 135 | `doc/plans/platform/2026-09-24-v2s-store-terminal-management-implementation-design-codex.md` | CP-06 | MATCHED |
| 136 | `doc/plans/platform/2026-09-24-v2s-store-terminal-management-implementation-plan-codex.md` | CP-06 | MATCHED |
| 137 | `scripts/README.md` | CP-06 | MATCHED |
| 138 | `scripts/dev/owner-command-seed-executor.mjs` | CP-05 | MATCHED |
| 139 | `scripts/dev/owner-command-seed-executor.test.mjs` | CP-05 | MATCHED |
| 140 | `scripts/dev/r5-complete-seed-executor.mjs` | CP-05 | MATCHED |
| 141 | `scripts/dev/r5-complete-seed-executor.test.mjs` | CP-05 | MATCHED |
| 142 | `scripts/dev/r5-fixture-contract.mjs` | CP-05 | MATCHED |
| 143 | `scripts/dev/r5-seed-plan.mjs` | CP-05 | MATCHED |
| 144 | `scripts/dev/store-terminal-seed-executor.mjs` | CP-05 | MATCHED |
| 145 | `scripts/dev/store-terminal-seed-executor.test.mjs` | CP-05 | MATCHED |
| 146 | `scripts/generate/backend-performance-m1-command-execution-bindings.mjs` | CP-03 | MATCHED |
| 147 | `scripts/generate/edge-codegen.mjs` | CP-03 | MATCHED |
| 148 | `scripts/generate/operation-handler-bindings.mjs` | CP-03 | MATCHED |
| 149 | `scripts/generate/store-terminal-l2-p1.mjs` | CP-05 | MATCHED |
| 150 | `scripts/generate/store-terminal-rules.mjs` | CP-01 | MATCHED |
| 151 | `scripts/test/browser-l2-runtime.mjs` | CP-05 | MATCHED |
| 152 | `scripts/test/browser-l2-runtime.test.mjs` | CP-05 | MATCHED |
| 153 | `scripts/test/l2-locator-bindings.static.test.mjs` | CP-05 | MATCHED |
| 154 | `scripts/test/store-terminal-l2-admission.mjs` | CP-05 | MATCHED |
| 155 | `scripts/test/store-terminal-l2-admission.test.mjs` | CP-05 | MATCHED |
| 156 | `scripts/test/store-terminal-l2-p1.test.mjs` | CP-05 | MATCHED |
| 157 | `scripts/test/store-terminal-rules-generator.test.mjs` | CP-01 | MATCHED |
| 158 | `scripts/test/test-health-entry-runner.mjs` | CP-05 | MATCHED |

# 7. 关键符号与反向核对

| 设计要求 | 当前源码锚点 | 反例/验证 |
|---|---|---|
| 三个真实写 operation adapter 必须有消费者 | `PostOperationsStoreTerminalOperation`、`PutOperationsStoreTerminalOperation`、`PostOperationsStoreTerminalStatusOperation` 与 `OperationsStoreTerminalController`/generated M1 bindings | acceptance all 与 operation set 293/293；静态引用扫描无零引用 adapter |
| owner 只掌握终端写与自有审计 | `StoreTerminalOwnerService`、`StoreTerminalAuditEventWriter`、`V20260924_000000_000__store_terminal_owner.sql` | migration focused、审计 HTTP V-25、三表提交前故障 rollback |
| 跨 owner 只读 | organization `StoreTerminalAreaReadTest`、catalog `CatalogProductionTagOwnerService`/generated owner read | V-5..8、V-20、V-28 与 acceptance readback |
| 规则单源 | contract JSON/schema/generator 与 generated Java/TS/OpenAPI | generator check/red mutation、V-29 12×7 手写期望 |
| 前端分层与 foundation | `StoreTerminalPage`、read model、commands、Create/Edit Drawer、Printer/Function/Scene editor、testIds | frontend focused/render/static、L2 admission、六场景 |
| seed 闭环 | fixture contract、r5 fixture/count、terminal post-step、parent complete executor | seed 8/8 detail、7 list、role matrix、report 不泄漏码 |
| L2 控制面闭环 | six policy sources、P1 generator、locator bindings、runner | admission PASS digest 绑定，L2 6/6 business/cleanup PASS |

# 8. v2s 自包含 catalog-inventory seed 补充分母

本任务同时把完整 r5-full catalog-inventory seed 改为 v2s 自包含数据源；以下不依赖终端字面量，故不由 §6 的 158 路径扫描捕获，单列为 CP-05 分母：

- `contracts/policy/catalog-inventory-source/items/headquarter-templates.json`
- `contracts/policy/catalog-inventory-source/items/store-combos-services.json`
- `contracts/policy/catalog-inventory-source/items/store-core-sales.json`
- `contracts/policy/catalog-inventory-source/items/store-materials.json`
- `contracts/policy/catalog-inventory-source/items/store-more-sales.json`
- `contracts/policy/catalog-inventory-fixture-catalog.json`
- `contracts/policy/catalog-inventory-media-assets.json`
- `scripts/dev/profiles/catalog-inventory.json`
- `scripts/dev/catalog-inventory-seed-plan.mjs`
- `scripts/dev/catalog-inventory-seed-executor.mjs`
- `scripts/dev/catalog-inventory-seed-executor.test.mjs`
- `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`

- 5 个源 JSON 共 73 个商品条目，源摘要：`32a0a2f993aae28067aef21bd27d3a5dfacae1fd8fa6427ac55b97b97d379589`。
- 34 个 catalog media asset 按字节从 v4 复制，使用 v2s media manifest；不引入 runtime/build fallback。
- catalog seed plan/executor/test、profile 与 fixture 校验器同步，旧 owner 数据不再从 v4 读取。
- 这些路径已在当前 seed PASS 中实际被消费；catalog-inventory component business/cleanup 均 PASS。

# 9. 证据等级、未验证与边界

- 本记录不是 UAT、真实设备激活、真实打印、TDP 或生产部署证明。
- Browser L2 仅证明六个已授权终端场景；不扩张到未登记的其他 L2 suite。
- global `scripts/verify --validate-only` 仍有仓内既有 backend Spotless UTF-8/行宽失败以及 R4 database SQL status OPEN；这些不属于本批 store-terminal 业务 evidence，不能被写成 PASS，也不遮蔽本批 acceptance/L2/seed 结果。
- 非 L2 动态 manifest 的字节绑定限制已显式保留：它们只作为运行结果，不升级为完整当前字节证明；静态当前字节对账必须覆盖其实现、fixture、执行器和控制面。
- CP-06 与 P9 已由 fresh 独立 reviewer 逐项复核；该 verdict 只关闭本记录的 IMPLEMENTATION_RECONCILIATION，不扩张为 UAT、真实设备、真实打印、TDP 或生产部署证明。

# 10. 交付门

本记录已满足交付门：fresh reviewer 对当前字节返回：
- CP-01..CP-06 三维对账均 MATCHED；
- 全批整体三维 MATCHED；
- P9 所有实际文件 MATCHED；
- N/A 分母均有可复算的理由，且不把非 L2 manifest 误表述为完整当前字节绑定；
- M/S/N=0/0/0；
因此本记录状态为 `MATCHED`，可以生成 Claude IMPLEMENTATION review handoff；若后续源码、契约、测试、seed 或 L2 控制面再变更，必须重新建立当前字节对账和独立复核，不得复用本 verdict。
