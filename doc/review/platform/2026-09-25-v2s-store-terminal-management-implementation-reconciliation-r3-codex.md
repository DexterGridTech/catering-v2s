---
title: 门店终端管理实施期第 2 轮评审处置与当前字节对账 R3
status: MATCHED
reviewTarget: IMPLEMENTATION_RECONCILIATION
date: 2026-09-25
reviewerKind: MAIN_AGENT_PREPARATION_PLUS_FRESH_INDEPENDENT_SUBAGENT
---

# 1. 目的与证据边界

本记录承接 `doc/review/platform/2026-09-25-v2s-store-terminal-management-implementation-review-r2-claude.md` 的处置，处理 N-1、N-2，并落实 Dexter 已授权的 S-1 长期方案选择。静态基线与契约链已经重建；本记录不把既有旧动态证据升级为当前字节的动态 PASS。

- `REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION`
- `CURRENT_BYTE_STATUS=MATCHED_AFTER_FRESH_INDEPENDENT_REVIEW`
- `P9_ALLOWED_VALUES=MATCHED|OPEN`
- `WHO_WRITES=MAIN_AGENT_ONLY`
- 本轮先后有两次 fresh 独立只读复核：Ramanujan，`01a0d723-2099-73f2-b9b2-851b0afa5822`，结论 `PARTIAL / M/S/N=0/1/0`；以及 Halley，`01a0d73d-dd0d-77b1-b70a-c6dd34e744ed`，在当前字节重新逐 CP-01..CP-06、全批三维、P9、L2 digest 与父 seed dry-run 后结论 `GO / M/S/N=0/0/0`。后者确认 R3 修改未破坏其它 CP，且当前动态前整体准入已闭合；两次复核均为只读，主 agent 承担文件更新。

# 2. 当前运行状态

- 当前字节上的最新运行：`NOT_RUN_AFTER_BASELINE_REGENERATION`；基线报告、目录/库存契约与 edge generated outputs 已重生成并通过静态检查，但没有因此重跑 L2、backend-acceptance、reset、DEV 或 seed。
- 最后一次通过：L2 `l2-1790308744297-70522-56d5fd5a-efe6-4874-bdd4-e4678c6206ab`，2026-09-25 04:00:04Z–04:01:18Z，六场景 `BUSINESS=PASS`、`CLEANUP=PASS`；与当前字节不一致（其后改动了 L2 admission 共享策略、终端策略、测试及 IA）。

### 当前字节的父 seed dry-run（非业务 seed）

在 2026-09-25T06:23:11Z 通过受管入口 `scripts/dev/seed --profile r5-full --dry-run` 重新执行当前字节的完整父流程计划检查，结果为：

`R5_COMPLETE_SEED_DRY_RUN=PASS; COMPONENTS=owner-command,external-collaboration-business-channel,catalog-inventory,sales-menu; SOURCE_ITEMS=73; CREATED_ITEMS=72; EXCLUDED_ITEMS=1; MEDIA=34; TERMINALS=8; TERMINAL_PLAN_DIGEST=b37af605c2a9a9bda924c5455765efd569c96766b7c4e2a11768b03a5f1e4d1c`

该入口的 `--dry-run` 分支不创建完整业务 seed 的 run manifest，也不执行 reset、DROP DATABASE 或终端后置写入，因此本条只证明当前字节的计划与闭集检查通过，不把它升级为 seed business/cleanup PASS；fresh 独立复核已将本条与 CP-01..CP-06、全批三维和 L2 admission 一并核对，动态前整体准入现为 `MATCHED`。

因此旧 L2/seed/acceptance evidence 仍不升格为当前字节的业务 PASS；它们只作为历史 last-known-good 保留。当前字节现在满足进入受管动态 reset/DEV/seed 的前置准入。

# 3. N-1 处置：终端准入策略去重

`CONFIRMED → STATIC_FIXED_PENDING_FRESH_DYNAMIC_RUN`。

根因是终端脚本复制了准入、case 分母和失败族逻辑。当前修复把它收敛到共享工厂：

- `scripts/test/l2-suite-admission.mjs:25-33` 新增 `screens[].caseId` 选择器，兼容终端 blueprint，同时保留 catalog/sales 的既有选择器。
- `scripts/test/store-terminal-l2-admission.mjs:1-20` 只负责 suite 配置，调用 `createL2SuiteAdmissionStrategy`；不再保留专用摘要、case 校验或失败族实现。
- `scripts/test/store-terminal-l2-admission.test.mjs:7-67` 和 `scripts/test/l2-suite-admission.test.mjs:12-67` 均改用共享 strategy API。
- `scripts/test/browser-l2-runtime.mjs:116-207`、`:7771-7775`、`:8116-8117`、`:8283-8316` 从 `L2_SUITE_CONFIGS` 读取每个 suite 的策略，并统一执行 admission 与 failure-family 检查。
- 终端五个 case source 的顺序和分母一致：`terminal-list-detail`、`terminal-create-basic`、`terminal-create-configuration`、`terminal-edit-configuration`、`terminal-readonly-state`、`terminal-status-actions`；policy 在 `contracts/policy/store-terminal-l2-admission.json:5-12`，blueprint 在 `contracts/policy/store-terminal-l2-case-blueprint.json:20-134`。

静态验证：

- `node --check` 覆盖共享策略、终端策略、测试入口与 browser runner，结果 PASS。
- 只跑红例与共享边界的 focused Node tests：5/5 PASS，覆盖缺记录、BLOCKED、漂移、控制面 locator、未变字节同失败族阻断。
- 完整终端准入测试当前为 `6/6 PASS`：上一版 review record 的 digest `704346b2...` 因详设/计划字节更新而失效；Ramanujan fresh 复核当前 digest `4ef6b254aba32a131a19ff7738a3aa2f17e4a1e9ef2312d5421b1373e75f8d36` 后，准入记录已更新为 25 个 control-plane、18 个 UI 文件、43 个总文件、1,269,220 bytes。此前出现的 `L2_SCRIPT_ADMISSION_SOURCE_DRIFT` 是正确的 fail-closed 行为，现已闭合。

# 4. N-2 处置：IA 的停用门店 HTTP 语义

`CONFIRMED → STATIC_FIXED`。

`doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md:129-140` 已将“门店已停用”归入既有 HTTP 404，与当前实现和 acceptance 一致；HTTP 403 仅保留页面/写权限拒绝。对该 IA 文件搜索没有发现“停用门店=403”的同族残留。

# 5. S-1 事实核验

## 5.1 02:58Z 写入命令

当前可确认的最小事实是：36 个在 2026-09-25T02:58:35Z–02:59:05Z 被触碰的 catalog/inventory 文件，均属于 `scripts/generate/catalog-inventory-p1.mjs` 的写入闭集；该脚本在 `writeJson`/`writeText` 路径生成 catalog edge、OpenAPI、policy、fixture、L2 与 manifest 产物，manifest 写入点在 `scripts/generate/catalog-inventory-p1.mjs:10792-10795`。`tools/catalog-inventory-p1/cli.mjs` 与 `scripts/check/catalog-inventory-p1` 是检查入口，不是这 36 个文件的写入源。

但当前仓内没有一份带 02:58Z 时间戳并绑定 shell 命令、run id 或执行 manifest 的原始 stdout/log。因此：

- `CONFIRMED`：写入者属于 `scripts/generate/catalog-inventory-p1.mjs` 生成器家族；该生成器默认执行会写这些目标。
- `UNVERIFIED_REQUIRES_EVIDENCE`：02:58Z 那一次的精确命令行与 run id。不能把生成器家族事实夸大为时间点调用证明。
- `UNVERIFIED_REQUIRES_EVIDENCE`：除 `transitionOperationsProductionTagStatus` 已由 7→9 的当前字节差异证实外，其余被触碰文件没有保存本次生成前的字节快照；mtime 不能单独证明内容发生变化。

只读检查结果：`node tools/catalog-inventory-p1/cli.mjs --check` 为 `CATALOG_INVENTORY_P1_CHECK=PASS`、`OPERATIONS=58`；`node scripts/generate/edge-codegen.mjs --check` 为 `R5_EDGE_CODEGEN_CHECK=PASS`。`node scripts/generate/r5-edge-materialize.mjs --check` 未通过，原因是其 Heritage 只读输入 `../catering-all-v2/contracts/openapi/platform-admin-edge.openapi.yaml` 缺失；该结果没有被当作本轮 S-1 或 N-1/N-2 的 PASS，也没有通过 fallback 掩盖。

## 5.2 7 → 9 的证据

这不是当前字节随机波动。旧 run `r5-tc-1790228471746-13251` 的正常 transition 组为 7 个事件：连接、事务、认证、scope、经营规则、一次 owner mutate、commit。后续 run `r5-tc-1790240057378-90074` 的具体作废引用分支为 9 个事件，多出的两个读取是：

1. `CatalogProductionTagOwnerPersistence#findByCode:288`；
2. `CatalogItemReferenceFacts#referenced:99`。

当前 owning source 与该分支一致：
`apps/backend/catering-business-server/src/main/java/com/catering/v2s/catalog/application/operations/TransitionOperationsProductionTagStatusOperation.java:44-57` 在目标状态为 `VOIDED` 时解析生产标签并调用 `catalog.productionTagReferenced(...)`，引用存在时在状态变更前拒绝。故 +2 是真实的引用保护路径，不是单纯测量抖动。当前报告的三次 run 也都记录 transition `maxDatabaseOperationCount=9`，总事件 44，连接/事务最大值仍为 1。

## 5.3 当前 S-1 对账分母

本轮已把校准报告和该生成闭集列入待决策对账分母：

  - `contracts/policy/backend-performance-cp05-calibration-report.json`；当前报告 `generatedAt=2026-09-25T05:45:59.055Z`，`expectedOperations=293`、`runCount=3`，`budget.baselineDecisionRef=DEXTER-2026-09-25-V2S-STORE-TERMINAL-CP05-BASELINE-293`，`replayIdentity.contentDigest=06138adb5cb2b1d478eda213534474ac0182076e4a78220e52cc9aac7f18b065`。
- 生成闭集 36 个文件（由 mtime 窗口脚本枚举，已去重）：
  - `contracts/catalog/catalog-item-editor-manifest.json`
  - `contracts/catalog/catalog-inventory-read-models.json`
  - `contracts/catalog/catalog-inventory-edge-contract.json`
  - `apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json`
  - `contracts/catalog/catalog-inventory-edge-placement.json`
  - `contracts/openapi/components/catalog/catalog-common.schemas.json`
  - `contracts/openapi/components/catalog/catalog-workbench.schemas.json`
  - `contracts/openapi/components/catalog/catalog-item.schemas.json`
  - `contracts/openapi/components/catalog/catalog-dictionary.schemas.json`
  - `contracts/openapi/components/catalog/catalog-copy.schemas.json`
  - `contracts/openapi/components/inventory/inventory-common.schemas.json`
  - `contracts/openapi/components/inventory/inventory-workbench.schemas.json`
  - `contracts/openapi/components/inventory/inventory-command.schemas.json`
  - `contracts/openapi/components/catalog/production-tag.schemas.json`
  - `contracts/openapi/paths/operations-admin/catalog-workbench.paths.json`
  - `contracts/openapi/paths/operations-admin/catalog-item-management.paths.json`
  - `contracts/openapi/paths/operations-admin/catalog-dictionary-management.paths.json`
  - `contracts/openapi/paths/operations-admin/catalog-copy.paths.json`
  - `contracts/openapi/paths/operations-admin/inventory-workbench.paths.json`
  - `contracts/openapi/paths/operations-admin/inventory-management.paths.json`
  - `contracts/openapi/paths/operations-admin/production-tag-management.paths.json`
  - `contracts/openapi/catalog-inventory.openapi.json`
  - `contracts/policy/catalog-inventory-fixture-catalog.json`
  - `contracts/policy/catalog-inventory-fixture-catalog.schema.json`
  - `contracts/policy/catalog-inventory-l2-activation-candidate.json`
  - `contracts/policy/catalog-inventory-api-scenarios.json`
  - `contracts/policy/catalog-inventory-l2-scenarios.json`
  - `contracts/policy/catalog-inventory-l2-execution.json`
  - `contracts/policy/catalog-inventory-l2-timing-budget.json`
  - `contracts/policy/catalog-inventory-assertion-matrix.json`
  - `contracts/catalog/CatalogInventoryShapeManifest.java`
  - `contracts/catalog/catalogInventoryShapeManifest.ts`
  - `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryCatalogReferenceDeclarations.java`
  - `contracts/catalog/CatalogInventoryEdgeWire.java`
  - `contracts/catalog/catalogInventoryEdgeWire.ts`
  - `doc/review/platform/2026-08-06-v2s-catalog-inventory-p1-implementation-manifest.json`

这 36 个路径加校准报告共 37 个 S-1 对账项；重生成后以实际变更文件重新取分母，至少覆盖该 37 项及由 edge-codegen 写入的 429 个 generated outputs 中实际内容变化者，不以手写数量代替。当前已确认 `catalog-inventory-p1 --check` 与 `edge-codegen --check` 均 PASS。

# 6. 已授权的基线选择与机器落点

Dexter 已授权按长期可追溯方向决策，选择 A 已落实：

- 决定文件：`doc/decisions/2026-09-25-v2s-store-terminal-cp05-baseline-293.md`；
- `decisionRef=DEXTER-2026-09-25-V2S-STORE-TERMINAL-CP05-BASELINE-293`；
- 当前报告为 `293` operation、三次受管运行、逐 operation 最大值，`transitionOperationsProductionTagStatus=9`；
- `scripts/test/backend-performance-cp05-reclassification.mjs` 要求三次重分类显式携带 `--baseline-decision-ref`；
- `scripts/generate/backend-performance-budget.mjs` 对三次报告缺 `budget.baselineDecisionRef` 直接失败；
- `scripts/test/backend-performance-budget.test.mjs` 新增缺引用 red test，并以 24/24 通过；
- 目录/库存契约由 `scripts/generate/catalog-inventory-p1.mjs` 重生成，edge generated outputs 由 `scripts/generate/edge-codegen.mjs --write` 重生成，两个 `--check` 均通过。

这不是全局裸放宽，也不是 operation-scoped exception；生产标签 VOIDED 引用保护的两次额外读取保留为业务事实。不可恢复的 286 报告没有被猜造或替换。

# 7. 当前字节静态验证结果

| 检查 | 结果 | 证据与边界 |
|---|---|---|
| CP-05 报告读取与预算消费 | `PASS` | `readCp05CalibrationReport` 读回 `293/3`、决定引用与 digest `06138adb5cb2b1d478eda213534474ac0182076e4a78220e52cc9aac7f18b065`。 |
| CP-05 schema/self-test 与 red mutation | `PASS` | `node scripts/generate/backend-performance-budget.mjs --self-test`；含缺决定引用的 focused red test；`node --test scripts/test/backend-performance-budget.test.mjs` 为 `24/24`。 |
| catalog-inventory P1 | `PASS` | `node tools/catalog-inventory-p1/cli.mjs --check`，`OPERATIONS=58`、`SHAPES=7`、`API_SCENARIOS=26/99`、`L2_SCENARIOS=26/65`、`IA_IDS=89`。 |
| edge codegen | `PASS` | `node scripts/generate/edge-codegen.mjs --check`，`FILES=429`；生成前首次 drift 已通过唯一 `--write` 生成入口闭合。 |
| Heritage materialize | `FAIL / 环境输入缺失` | `node scripts/generate/r5-edge-materialize.mjs --check` 首败 `R5_EDGE_HERITAGE_SOURCE_MISSING:../catering-all-v2/contracts/openapi/platform-admin-edge.openapi.yaml`；当前工作区不存在该目录，未使用 fallback。 |
| 全量 `scripts/verify --validate-only` | `FAIL / 既有静态阻断` | 首个阶段为 `backend-spotless-check`，7 个既有 Java UTF-8 行宽文件失败，另有 SQL 构造 `2255` 个 unresolved/open；未修改这些 unrelated 业务源，不将其记为本批基线修复 PASS。 |
| N-1/N-2 focused 与准入测试 | `PASS` | 共享 suite admission 与终端 admission 测试合计 `6/6`；当前 digest 为 `4ef6b254aba32a131a19ff7738a3aa2f17e4a1e9ef2312d5421b1373e75f8d36`，fresh reviewer 为 Ramanujan。 |

动态状态仍按两行报告：

- 当前字节上的最新运行：父 seed dry-run `2026-09-25T06:23:11Z`，`BUSINESS=PASS`（计划检查）、`CLEANUP=N/A_NO_RUNTIME_MUTATION`；预算 self-test、预算测试 `24/24`、准入测试 `6/6`、P1、edge-codegen 与 Claude handoff check 均为 `PASS`，full `scripts/verify` 与 Heritage materialize 仍分别为上述独立 FAIL，尚未运行新的动态 business/cleanup。
- 最后一次通过：L2 `l2-1790308744297-70522-56d5fd5a-efe6-4874-bdd4-e4678c6206ab`，2026-09-25 04:00:04Z–04:01:18Z，六场景 `BUSINESS=PASS`、`CLEANUP=PASS`；与当前字节不一致。

## 7.1 本轮受管动态收口

动态前整体准入经 Halley fresh 独立复核为 `GO / M/S/N=0/0/0` 后，按计划顺序执行：

- reset：`R5_DEV_RESET=PASS`；目标 `catering_v2s_dev_r5_full` 已完成远端数据库不存在读回与资产清理，cleanup PASS；manifest=`.runtime/r5/reset/r5-reset-480c8d9d-7b70-467e-abd4-e63400e1495d/run-manifest.json`。
- DEV：`R5_DEV_START=PASS`；远端 Java、HTTP/asset tunnel 与两个本机 Vite 均由 `.runtime/r5/run-manifest.json` 管理，未在 start 中执行 seed。
- 完整 seed：`R5_COMPLETE_SEED=PASS`、`CLEANUP=PASS_PRESERVED_DEV_STATE`；四个父阶段均 PASS，无首败；manifest=`.runtime/r5/seed/complete/complete-seed-b1529503-4a20-4b96-8461-8b4326b097ea/run-manifest.json`，report=`.runtime/r5/seed/complete/complete-seed-b1529503-4a20-4b96-8461-8b4326b097ea/seed-report.json`。
- 终端 post-step：`CREATED=8`、`DETAIL_READBACK=8`、`LIST_READBACK=7`；role-group 与 role-project 为 `EDIT`，role-store 为 `READ_ONLY`；post-step=`.runtime/r5/seed/store-terminal/r5-dev-1790317886037-48411-0c44f03a-1c14-4f78-b16d-efb5b29d9b7a/post-step.json`。激活码只在 runner 内存比较与脱敏断言中使用，未写入交付输出。

动态状态两行更新为：

- 当前字节上的最新运行：完整 seed `complete-seed-b1529503-4a20-4b96-8461-8b4326b097ea`，`BUSINESS=PASS`、`CLEANUP=PASS_PRESERVED_DEV_STATE`；终端后置 `BUSINESS=PASS`、`CLEANUP=PASS_NO_PERSISTENT_SEED_PROCESS`。
- 最后一次通过：同一完整 seed run `complete-seed-b1529503-4a20-4b96-8461-8b4326b097ea`，与当前字节一致；reset 与 DEV 也分别为 `PASS`，未运行新的 Browser L2 或 backend-acceptance。

# 8. 未运行/未授权

- 本轮未运行 Browser L2 或 backend-acceptance；reset、DEV 与完整业务 seed 已按授权运行并通过。
- UAT、部署、真实设备激活、真实打印与 TDP 仍为 `NOT_AUTHORIZED/OUT_OF_SCOPE`。
- 基线选择与动态前准入不再阻断；本轮 reset、DEV、seed 已完成，Browser L2、backend-acceptance、UAT、部署、真实设备激活、真实打印与 TDP 仍未运行或不在授权范围。
