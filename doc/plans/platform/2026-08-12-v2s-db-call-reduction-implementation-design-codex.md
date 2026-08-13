---
implementationAuthority: false
runtimeAuthority: false
seedResetAuthority: false
status: PROPOSED_REVIEW_ONLY
reviewCycleId: DB_CALL_REDUCTION_DESIGN_20260812
---

# 无用数据库调用收敛：implementation-facing 整体详设

## 0. 目标、边界与一次性交付节奏

本设计只解决两类已批准问题：A 类事务开销与真实 owner 数对齐；B 类方法级 SQL 用量台账与只降不升棘轮。JPMS、跨模块架构重构、`Propagation.MANDATORY`、通用数据库治理设施均不在本批范围。

交付节奏固定为：本文件一次性覆盖全部设计 → 一次独立 DESIGN review → Dexter 明确实施授权后一个 package 按 DBCR-01 至 DBCR-05 串行实施 → 所有静态和获授权动态验收关闭后一次独立 IMPLEMENTATION review。不得按 unit 拆独立设计、独立实施批次或独立 review。

当前 package 仅有设计权，不得修改生产源码、运行 Testcontainers、DEV、L2、reset、seed 或宣称性能成功。此前 per-edit P0 已关闭，本设计只复核控制面健康，不重开旧 P0。

## 1. 设计裁决摘要

1. 十六个 GET 的真实事务起点在 `CatalogInventoryCoordinator` 具名方法；三个 legacy `read(operationId)` dispatcher 不在分母。最终 disposition 为 `KEEP_OUTSIDE_TRANSACTION=6`、`REMOVE_BEST_EFFORT_TRANSACTION=10`、`REQUIRE_STABLE_SNAPSHOT=0`。所有 16 个 coordinator 入口均去掉 `readOnly` 事务，且所有会重新开启事务的 typed owner/cross-owner read 入口同步去掉；命令从外层 `REQUIRED` 进入时仍自然 join 外层事务。
2. PostgreSQL 默认 `READ COMMITTED` 下，同一事务中的连续 SELECT 不提供稳定快照。未来确需稳定快照时优先合并 set-based SQL；确实不可合并才显式设计隔离级别、异常语义和并发测试，不能以普通 `readOnly=true` 冒充快照保证。
3. 五个 adapter 都是 `DECLARE_2 + KEEP_IMPLEMENTATION`，不得删第二 owner 以维持旧 `ownerCount=1`。ownerCount 只从 execute 可达的构造注入业务 owner API 字段推导，按 owner 去重；import、DTO、context resolver、fact loader 不计数。
4. canonical scanner 当前只能证明 cardinality 从 721 净增至 730。旧证据没有保存 721 行 row-set，故不得虚构“九条新增 candidate”。实施时先尝试从受信接受证据恢复完整 721-row snapshot；恢复成功才做 exact diff。若恢复失败，必须对当前 730 行全量生成 disposition，禁止任取九行或只改 count/fingerprint。
5. 三个新增方法级预算采用新 ledger ID `M14`、`S7`、`M15`；`expectedStatements` 只能由 fresh、获授权的 P4 Testcontainers 实测填入，禁止复制 seed 的端点级 41/34/12。
6. accepted baseline 是与当前 ledger 分离的历史链。当前值提高必须有 previous/current、reason、source evidence 和 `APPROVED`；下降必须同步降低 accepted latest，不能留下反弹空间。
7. seed 比较器现有 UPDATE 方向相反：candidate UPDATE 更低反而失败且更高可过。必须先修为 `CONNECTION`、`TRANSACTION` 严格下降，`QUERY`、`UPDATE` 不上升，再能承担最终证据。

### DBCR-01｜16 条 GET 的事务边界闭合

#### 1.1 权威分母与 disposition

| operationId | coordinator | sourcePath | sourceAnchor | disposition | 正常路径 SQL 特征 |
|---|---|---|---|---|---|
| getOperationsCatalogWorkbenchContext | readCatalogWorkbenchContext | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `CatalogInventoryCoordinator#readCatalogWorkbenchContext` | REMOVE_BEST_EFFORT_TRANSACTION | 1 或 4 |
| getOperationsCatalogNavigation | readCatalogNavigation | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `CatalogInventoryCoordinator#readCatalogNavigation` | REMOVE_BEST_EFFORT_TRANSACTION | 4 |
| getOperationsCatalogItems | readCatalogItems | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `CatalogInventoryCoordinator#readCatalogItems` | REMOVE_BEST_EFFORT_TRANSACTION | 4 |
| getOperationsCatalogItem | readCatalogItem | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `CatalogInventoryCoordinator#readCatalogItem` | REMOVE_BEST_EFFORT_TRANSACTION | 5-6 |
| getOperationsCatalogDictionary | readCatalogDictionary | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `CatalogInventoryCoordinator#readCatalogDictionary` | REMOVE_BEST_EFFORT_TRANSACTION | 1-2 |
| getOperationsProductionTags | readProductionTags | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `CatalogInventoryCoordinator#readProductionTags` | KEEP_OUTSIDE_TRANSACTION | 1 |
| getOperationsLocalCatalogCopyCandidates | readLocalCatalogCopyCandidates | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `CatalogInventoryCoordinator#readLocalCatalogCopyCandidates` | REMOVE_BEST_EFFORT_TRANSACTION | 2 |
| getOperationsBrandCatalogCopyCandidates | readBrandCatalogCopyCandidates | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `CatalogInventoryCoordinator#readBrandCatalogCopyCandidates` | REMOVE_BEST_EFFORT_TRANSACTION | 5 |
| getOperationsInventoryTargets | readInventoryTargets | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `CatalogInventoryCoordinator#readInventoryTargets` | REMOVE_BEST_EFFORT_TRANSACTION | 6 |
| getOperationsInventoryTarget | readInventoryTarget | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `CatalogInventoryCoordinator#readInventoryTarget` | REMOVE_BEST_EFFORT_TRANSACTION | 9-10 |
| getOperationsInventoryTargetChangeSummary | readInventoryTargetChangeSummary | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `CatalogInventoryCoordinator#readInventoryTargetChangeSummary` | KEEP_OUTSIDE_TRANSACTION | 1 |
| getOperationsInventoryTargetBusinessHistory | readInventoryTargetBusinessHistory | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `CatalogInventoryCoordinator#readInventoryTargetBusinessHistory` | KEEP_OUTSIDE_TRANSACTION | 1，窗口计数 |
| getOperationsInventoryTargetConsumptionReferences | readInventoryTargetConsumptionReferences | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `CatalogInventoryCoordinator#readInventoryTargetConsumptionReferences` | REMOVE_BEST_EFFORT_TRANSACTION | 1 或 3 |
| getOperationsInventoryTargetLedger | readInventoryTargetLedger | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `CatalogInventoryCoordinator#readInventoryTargetLedger` | KEEP_OUTSIDE_TRANSACTION | 1，窗口计数 |
| getOperationsInventoryTargetDiagnostics | readInventoryTargetDiagnostics | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `CatalogInventoryCoordinator#readInventoryTargetDiagnostics` | KEEP_OUTSIDE_TRANSACTION | 0 |
| getOperationsCatalogShapeManifest | readCatalogShapeManifest | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `CatalogInventoryCoordinator#readCatalogShapeManifest` | KEEP_OUTSIDE_TRANSACTION | 0 |

#### 1.2 精确源码处置

- 更新 `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java`：删除上述 16 个具名 GET coordinator 的 `@Transactional(readOnly = true)`；transaction topology ledger 逐项绑定 operationId、method symbol、source path 与 source anchor，禁止仅按类名计数。
- 更新 `CatalogOwnerService.java`：删除八个 typed read 入口及 `skuNamesByItemCodes` 的 read-only 事务；保留三个 legacy dispatcher 现状，不把它们计入本分母。
- 更新 `InventoryOwnerService.java`：删除七个 typed read 入口以及两个被 catalog task read 调用的 cross-owner read 入口事务。
- 更新 `ProductionTagOwnerService.java#readTags` 与 `BusinessEntityService.java#resolveCatalogCopySource` 的 read-only 事务。
- 不改任何命令事务；同一 owner read 被命令调用时继续 join 外层 `REQUIRED`。

#### 1.3 证明与红变异

扩展 route test 以 exact-set 对账 16 个 operation/path/controller/coordinator；新增 capability-named `CatalogInventoryReadTransactionTopologyTest`，真实调用 16 个 coordinator 并让 owner probe 断言 `TransactionSynchronizationManager.isActualTransactionActive()==false`，覆盖 brand edge resolver。任意被 disposition 为 outside/remove 的真实 coordinator、typed owner 或 cross-owner read 入口恢复事务必须红；legacy dispatcher 或命令进入分母也必须红。

### DBCR-02｜五条 coordinated-owner command shape

#### 2.1 五条真实 owner 集

| operationId | reachable owner set | disposition |
|---|---|---|
| createOperationsOrganizationStore | organization + contract | DECLARE_2 + KEEP_IMPLEMENTATION |
| updateOperationsOrganizationStore | organization + contract | DECLARE_2 + KEEP_IMPLEMENTATION |
| transitionOperationsOrganizationStoreStatus | organization + contract | DECLARE_2 + KEEP_IMPLEMENTATION |
| releaseOperationsCatalogStagedAsset | catalog + platform-asset | DECLARE_2 + KEEP_IMPLEMENTATION |
| transitionOperationsCatalogItemStatus | catalog + inventory | DECLARE_2 + KEEP_IMPLEMENTATION |

#### 2.2 唯一 derivation

创建唯一有限映射 `contracts/policy/backend-performance-owner-api-registry.json`。每行以完整 API type/package 为 key、module owner 为 value，并绑定 API 声明源码 path+hash；本批至少精确登记 `OperationsStoreCommandApi.StoreDetailReadbackApi→organization`、`OperationsStoreContractCommandApi.StoreStatusReadbackApi→contract`、`CatalogAssetReferenceLock/CatalogAssetCommandApi→platform-asset`、`CatalogOwnerApi→catalog`、`InventoryOwnerApi→inventory`。未知 API、重复冲突 owner 或 source hash 漂移均 fail closed。

`backend-performance-operation-source-inventory.mjs` 从 production adapter 构造字段中识别 registry API type，再用 execute 方法内对字段的方法调用证明 reachability，生成 `ownerApiBindings={field,type,owner,callSymbols}` 后按 owner 去重。`CreateOperationsCatalogItemOperation` 对 `CatalogScopeLookup` 的纯 import 是固定反例，不得增加 ownerCount；context resolver 即使构造注入也按 closed exclusion kind 排除。同一 owner 的多个 API 字段只计一次。

`backend-performance-operation-database-shape.mjs` 对 `ownerCount>1` 派生既有 `OWNER_COMMAND_CROSS_OWNER`，新增 `coordinatedOwnerParticipations=ownerCount-1` 作为预算参与量，不伪造额外 owner write。旧 profile hardcode 与 command ownerCount=1 必须删除；bindings 中的 initiating owner 不改义。

#### 2.3 生成物与红变异

重生成 source inventory 与 database shape matrix。五条必须为 ownerCount=2/cross-owner；其余行保持 source-derived。新增/调整 generator self-test 与 database-shape test，证明：漏报第二 owner、shapeClass 漂移、coordinated count 漂移、import 扫描、同 owner 重复计数均红。

### DBCR-03｜canonical candidate 与三条方法级预算

#### 3.1 721→730 的诚实迁移

实现顺序固定：

1. 读取 accepted ledger 的 721/count/fingerprint，并只检查以下有限恢复分母：`doc/evidence/platform/rm1/p4/2026-08-12-p4-runtime-ledger-rebaseline.json`、`doc/evidence/platform/rm1/p4/p4-ledger-authority-problem-family-discovery.json`、`doc/evidence/platform/rm1/p4/rm1-u07-package-exit.json`、`.runtime/compliance-control/hook-events/p4-final-candidate-fingerprint-14.pre.json`、`.runtime/compliance-control/hook-events/p4-final-candidate-fingerprint-14.post.json`、`.runtime/compliance-control/hook-events/p4-refresh-canonical-ledger-final-source-20260729.pre.json`、`.runtime/compliance-control/hook-events/p4-refresh-canonical-ledger-final-source-20260729.post.json`。为每个位置记录 path、sha256、FOUND_WITH_FINGERPRINT 或 NOT_PRESENT_OR_NO_ROW_SET，形成 `canonical-performance-candidate-recovery-receipt.json`；不得从聊天摘要或当前 scan 猜测。
2. 若找到完整旧 scan，校验其 fingerprint 后生成 old/current exact diff，并逐真实新增/删除/identity-change 行 disposition。
3. 若有限分母均找不到，receipt 必须声明 `OLD_ROW_SET_UNRECOVERABLE`，然后生成当前 730 行的完整 candidate-disposition artifact。`COVERED_BY_EXISTING_LEDGER_ROW` 必须绑定唯一 ledgerId/caseId 与 identity exact match；`NOT_RUNTIME_BUDGET_WITH_REASON` 只允许 closed reason `TEST_FIXTURE_SETUP | STATIC_INITIALIZER | NON_REPEATED_OWNER_WRITE | OBJECT_STORAGE_NOT_SQL`，并绑定 owning source path+hash+anchor；`RUNTIME_BUDGET_REQUIRED` 必须绑定现有或新增 ledger case。无 PENDING 才可更新 ledger scan。
4. scanner 必须对 disposition artifact 与 current scan 做 exact-set 对账；缺行、多行、source substitution、只改 count/fingerprint 均红。

#### 3.2 三条 P4 mapping

| operationId | ledger/case | callerSymbol | fixture | measurementBoundary |
|---|---|---|---|---|
| createOperationsOrganizationStore | M14#NORMAL_SUCCESS | CreateOperationsOrganizationStoreOperation#execute | PERF-WORKSPACE-COMMAND-V1 同 operation；独立 store ref，三个依赖均使用 counted collaborators | execute 入栈至 createStore + detail + contract status 的共享 counted DataSource；不含 HTTP/setup |
| selectOperationsWorkspaceSessionDataNode | S7#NORMAL_SUCCESS | WorkspaceAuthenticationService#selectDataNode | 专用 token、PROJECT candidate、contextVersion=1 | requireNormal、assignment、visibility、CAS、session readback 全部 counted JDBC；不含 HTTP resolver |
| getExtensionDefinition | M15#NORMAL_SUCCESS | ExtensionDefinitionService#platformManagementDefinition | PERF-READ-V1；已配置 host type | 目标方法及 managementDefinition counted JDBC；不含 platform session/workspace context |

P4 继续复用 `setupJdbc` 与 `countedJdbc` 的现有隔离；每个 case 在 invocation 前 reset。只在 fresh remote Testcontainers 获授权运行后写入实测整数，不填理想值、不复制 seed 数值。

### DBCR-04｜accepted baseline 与只降不升棘轮

创建 `canonical-performance-accepted-baseline.json`，按 `ledgerId#caseId` 与 runtime ledger exact-set 对账。每个 case 的 history 包含连续 sequence、previousExpectedStatements、expectedStatements、changeKind、reason、sourceEvidence(path+sha256)、approvalStatus。

规则：INITIAL 必须有 fresh measurement；DECREASE 严格下降；latest 必须等于 current ledger；下降后不允许 baseline 保持旧高值。INCREASE 不是当前实施包可自批的 disposition：它必须引用一个在本 package entry 前已存在、且不在本 package changedPaths 中的独立 authority artifact；artifact 的 closed kind 为 `DEXTER_EXPLICIT_SQL_BUDGET_INCREASE_AUTHORITY`，必须含 decisionId、approver=`DEXTER`、ledgerId、caseId、previousExpectedStatements、approvedExpectedStatements、reason 和自身 hash。不存在该前置授权时任何 INCREASE 一律红。scanner self-test 必须验红只提高 current、无 authority 同步提高两文件、同包伪造 authority、未知 authority kind、断链、未批准、坏 hash、case set 漂移、降低 current 未降低 accepted latest。

### DBCR-05｜单批顺序实施与最终验收

#### 5.1 单一实施 package 顺序

1. 新 implementation package admission；同时取得明确 dynamic/reset/seed authority 才能进入比较步骤，复核控制面健康，不重开已关闭 P0。
2. 在任何 production behavior source 改动前，先修 seed report/comparator schema、方向与 self-test；comparison identity 包含 fixture path/version/sha256、每 operation 的 callCount 与 stageIds exact map、businessStatus 与 cleanupStatus。
3. 静态验证比较工具后，记录 PRE-bound production source exact path+sha256，并执行同配置 PRE reset→DEV→seed；PRE report 和 run manifest 均 immutable，business/cleanup 均 PASS。若任一 PRE-bound source 已偏离 package-entry hash，admission 直接失败。
4. 建立 DBCR-01 16-row exact ledger 与 transaction topology red proof，再改事务源码。
5. 完成 DBCR-02 owner registry/derivation、cross-owner shape、生成物和 red proof。
6. 按 DBCR-03 先闭合 721/730 真实性，再建立三条 mapping 与 fixture；建立 DBCR-04 accepted baseline checker，运行 fresh P4 并写入三条实测值。
7. 静态和 Testcontainers 全部通过后执行同配置 POST reset→DEV→seed。比较 PRE/POST 的 report schema、measurement、seedProfile、fixture identity、41-operation exact set、每 operation callCount/stageIds exact map；两侧 business/cleanup 必须 PASS，CONNECTION/TRANSACTION 严格下降，QUERY/UPDATE 不上升。
8. 所有静态、business、cleanup 证据关闭后，执行唯一一次独立 IMPLEMENTATION review；不得提前 review 或拆分 review。

#### 5.2 验收矩阵

- 静态：canonical ledger check/self-test、source inventory/shape check/self-test、16-row topology focused tests、P4 source compilation、standards coverage。
- Testcontainers：经受管 remote lane 只运行所需 backend/P4；first failure 保留，根因和同族修复后才复跑；business 与 cleanup 分开且都 PASS。
- Seed comparison：`owner-command-seed-executor.mjs#finalize` 把已知 business/cleanup 终态、fixture identity、stageIds/callCount 写入 immutable report；两份报告必须 `reportKind=SEED`、schema/measurement/seedProfile/fixture path+version+sha256 相同、operation exact-set 恰 41、每 operation 的 callCount 与 stageIds exact 相同、business/cleanup 均 PASS；CONNECTION 与 TRANSACTION 严格下降，QUERY 与 UPDATE 不上升。
- 结论限制：seed 只覆盖 41 operations，不得表述为全部接口或全部性能达标；本项目不执行 L2。

#### 5.3 禁止伪修复

- 只摘 coordinator 注解而让 owner 重新开事务。
- 把普通 read-only 事务说成稳定快照。
- 为保持 ownerCount=1 删除正确的第二 owner 调用。
- 用 import 统计 owner，或只改数字不改 shape/generator/budget。
- 把净增 9 冒充已知九个新增 candidate。
- 填理想 SQL 数或复制 seed 端点数。
- 同时提高 current 与 baseline 规避棘轮。
- 保留 UPDATE comparator 的反向逻辑。
- 用 retry、timeout、重复运行掩盖首败。

## 2. 六类 package-exit source 对账分母

| denominator | owning source | exact denominator / exit rule |
|---|---|---|
| AUTHORITY_REQUIREMENT | Dexter authority + revised requirement | 两份输入 hash-bound；implementation/runtime/seed 权限不得扩大 |
| TRANSACTION_OPERATION_DISPOSITION | bindings + 16 coordinator + typed owner source | 16/16，6 keep + 10 remove + 0 snapshot，无 PENDING，源码/测试/evidence exact-set |
| COORDINATED_OWNER_SHAPE | 五个 adapter + source inventory generator + shape generator | 5/5 ownerCount=2；reachable owner field exact-set；生成物与 source exact-set |
| CANONICAL_LEDGER_AND_MEASUREMENT_MAPPING | scanner + canonical ledger + P4 | 721 snapshot 可恢复则 exact diff，否则当前 730 全量 disposition；M14/S7/M15 mapping 3/3 |
| ACCEPTED_BASELINE_RATCHET | accepted baseline + scanner checker | ledger case 与 baseline exact-set；history 全链；所有 increase 有批准归因 |
| PREVENTION_ACCEPTANCE_HANDOFF | red mutations + comparator + managed reports + reviews | 静态 red 全绿；获授权动态 business/cleanup 全绿；一轮 DESIGN + 一轮 IMPLEMENTATION review |

任一 denominator 缺项、source 漂移、PENDING、动态越权或 evidence claim 超出 41 operations，package exit 必须失败。

## 3. 设计后的重新回读

本设计已再次对照 revised requirement 与 owning source：没有把 legacy dispatcher 当真实事务起点；没有把五条 coordinated-owner 修成单 owner；没有把净增 9 冒充精确新增九条；没有把 seed 数填入方法预算；没有新建第二套 runner 或重复接线 P4；没有进入 JPMS、MANDATORY、L2、DEV、reset、部署或手工 SQL。
