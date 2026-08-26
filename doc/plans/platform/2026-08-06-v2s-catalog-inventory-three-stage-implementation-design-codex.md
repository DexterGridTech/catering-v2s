SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
SKILL_USED=cs-semantic-source-reconciliation@070d131169cdc0b0d76f9926d97bca45e692f34ded517172193ca02e2e7bb3ee
SKILL_USED=cs-spec-to-plan@bd813d97c343571fdf22f88fe6573a7deb7ac5fd7ec73ea11b4957a270a5f7b9

# v2s 商品目录与门店轻库存三阶段实施详设（Codex）

## 0. 文档性质、结论与授权边界

本文把已通过 IA 终审的商品目录与门店轻库存范围，横切为三个一次性交付阶段：

1. `CI-P1-DEFINITION`：契约、seed 数据、测试场景、契约化测试数据；
2. `CI-P2-BACKEND-API`：owner、schema/migration、应用协调、edge 与后台接口测试；
3. `CI-P3-FRONTEND-L2`：operations-admin 三页、真实 locator 绑定与受管 L2。

第一阶段定义后两阶段的完成分母，第二、三阶段不得各自复制或发明测试数据。原 IA 的
`IU-01..08` 保留为纵向责任轴，三阶段是横向交付轴；本文用显式多对多矩阵解决两套口径，
不重写已获 GO 的 IA 编号。

本文是 implementation-facing 设计，不是实施授权。本轮不修改 OpenAPI、policy、generated wire、
schema、migration、seed/runtime 或应用源码，不执行 reset/seed、DEV/UAT/L2，也不部署运行时。
`C-16/C-17/C-19` 已由 Dexter 在 IA 评审 §9 当场裁决并收口，本文直接采用终态，不保留分支。

implementationAuthority: false

> **2026-08-08 Dexter 裁决 supersede（有限）：** 本文任何“`EW` 唯一写 key 为 `EDIT_CATALOG_LIBRARY`”“`DR` 使用独立读取 key”“无诊断权限隐藏第六区”的叙述均已被 `doc/decisions/2026-08-08-v2s-catalog-inventory-scope-specific-write-capabilities.md` 取代。P1 必须生成按目标类型映射的三项写 capability 和每 mutation 的 requirement；P2 必须 live resolver → owner grant 闭环；P3 必须按 surface 显示对应写 UI，并让普通库存 reader 读取诊断。原文的阶段独立、owner 分离、API/L2/DEV seed 隔离要求继续生效。

## 1. 输入、目标与不变约束

### 1.1 绑定输入

| 输入 | 路径 | 本轮绑定 SHA-256 | 用途 |
|---|---|---|---|
| 最终需求过程稿 | `doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md` | 实施起点重新实算 | 业务模型、复制、18 条差异 |
| 裁决收口 IA | `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md` | 实施起点重新实算 | 89 个 IA-ID、三页、读需求、交互红线、C-16/17/19 终态、D-16 |
| Claude IA 终审与 Dexter 裁决记录 | `doc/review/platform/2026-08-06-v2s-catalog-inventory-ia-design-review-claude.md` | `3f2a7bbb092ac05350079a939fd29b5286bb9cc0db79d37984a6a64a09407fe3` | §8 `GO — M=0 / S=0 / N=1`；§9 三项裁决 |
| 后台逐 operation 设计契约 | `doc/review/platform/2026-08-06-v2s-catalog-inventory-backend-operation-design-contract.json` | 实施起点重新实算 | 42 个接口的逻辑步骤、异常条件、调用链与正常路径 DB 次数 |
| CRUD 展示规范 | `contracts/policy/crud-presentation-standard-catalog.json` | 实施起点重新实算 | `IU-01` 首项登记商品工作台例外 |
| 页面注册真相 | `contracts/catalog/admin-catalog.json` | 实施起点重新实算 | 三个页面、角色与数据节点 |
| foundation | `libraries/frontend/admin-ui-foundation` | 实施起点锁定真实文件集合 | Drawer、生命周期、列表状态、观测与自动化 |

实施每个变更点仍须按仓库规则逐点重开需求/IA、六维项目记忆、owning source、本文及可复用源码；
本文不能替代 source reopen。Heritage v1/v4/v6 只读，冲突时以最终需求的 18 条差异为准。

### 1.2 本期解决的问题

运营人员需要在门店或总公司+品牌范围维护完整商品资料、形态、SKU、选项、生产提示、
StockTarget 与 BOM；门店需要看轻库存、做四类人工库存动作；门店还需把所属总公司同品牌商品
连同闭包安全复制到本地。系统必须在没有菜单、销售发布、订单和履约运行时的条件下仍给出
真实、可演进、可观测且 owner 边界正确的交易前底座。

### 1.3 固定架构边界

- 一个业务 deployable、一个 PostgreSQL、多 owner schema、单 Flyway history；不建 MQ/outbox。
- owner 为 `catalog`、`inventory`、`fulfillment-production`；organization/workspace-IAM/asset 保持原 owner。
- 跨 owner 写只调用公开 command API 并加入同一 `REQUIRED` 事务；禁止跨 schema DML。
- task read 可显式 join 事实以避免 N+1，但不能复制 owner 判断。
- HTTP 只暴露 `operations-admin` face；platform-admin、public、terminal-data-server 不新增本期操作。
- 商品处理标签属于 fulfillment-production；商品只保存 typed ref。
- `SalesStockView` 不建表；库存提示与变化聚合是读模型。
- 总公司可有 StockTarget/BOM，不得有 balance/ledger 或库存写动作。

## 2. 两维交付模型：阶段 × IU

### 2.1 IU 不重切，阶段声明自己的义务

| IU | P1 定义义务 | P2 后台/API 义务 | P3 前端/L2 义务 |
|---|---|---|---|
| `IU-01-CATALOG-REGISTRY` | 定义并落 policy 例外、节点/能力/face exact-set | 提供 owner-backed capability/context readback | 只读核验 P1 policy entry；落 admin catalog；验证三页角色/数据节点 |
| `IU-02-CATALOG-CONTRACT` | 主交付：形态 manifest、OpenAPI、读写模型、错误、精度、generated 两侧 | 只能实现 P1 字节，不得扩契约 | 只消费 generated TS；不得手拼 route/enum |
| `IU-03-CATALOG-WORKBENCH` | 定义查询事实、seed/fixture、API/L2 断言 | set-based 查询与接口场景 | 两商品工作台与局部搜索/树/表格交互 |
| `IU-04-CATALOG-DRAWER` | 定义详情 sections、状态恢复与场景 | 详情/保存/状态流转与本库复制接口 | 同 Drawer 查看编辑、全部页签、dirty/overlay |
| `IU-05-CATALOG-COPY` | 定义闭包、预检、compatibility、digest/version DTO 与 fixture | 完整算法、引用重写、TOCTOU、原子性由 API 收口 | 只验入口、预检展示、确认/重做与状态保持 |
| `IU-06-INVENTORY-WORKBENCH` | 定义库存列表/聚合/动作 DTO 与场景 | set-based 列表与四动作接口 | 紧凑列表、筛选、库存变化与动作入口 |
| `IU-07-INVENTORY-DETAIL` | 定义六区独立读模型与诊断权限场景 | 六区 query、权限与结果 readback | 六区渲染、诊断整区隐藏、结果面 |
| `IU-08-IA-EVIDENCE` | 89 IA-ID→assertion→scenario exact-set，L2 不含 locator | API assertion 绑定与证据 | locator binding、89 IA-ID 与 L2 business/cleanup 对账 |

规则：一个 IA-ID 可以产生多个不同 assertion；每个 assertion 只有一个 primary verifier：
`CONTRACT_STATIC`、`API` 或 `L2`。同一需求可跨层出现，但不得由 API 和 L2 对同一 assertion
重复声称完成。P1 checker 对 `(iaId, assertionId, primaryVerifier)` 做 exact-set 与 orphan 检查。

exact-set 只能证明“不漏”，不能证明映射有判别力。P1 的每条 assertion 还必须用一句可观察业务行为说明
“给定什么前提，执行什么动作，观察什么结果”，并指向承载该行为的 scenario；禁止只复述 IA-ID、接口名或
把大量无关 IA-ID 懒挂到同一通用成功场景。该语义不做关键词 checker：P1 独立 review/Claude review 必须
抽查 IA 绑定数最高的五个 scenario、每个 IU 至少一条，以及复制/库存动作全部高风险 assertion，逐项对读
IA 原文、业务行为与 fixture 断言；无法指出实际被验证行为即 finding。

### 2.2 三阶段覆盖状态

- P1 的 `DEFINED` 只表示形状、fixture 和验收义务冻结，不冒充业务实现。
- P2 的 `IMPLEMENTED_API` 只关闭 owner/backend/API assertions；所有 UI-only assertion 为具名 N/A。
- P3 的 `IMPLEMENTED_L2` 关闭 UI assertions，并引用 P2 报告 SHA，不重跑闭包算法作为 UI 证明。
- 三阶段完成后才可对 89 IA-ID 判 `CLOSED`；任何 `PENDING`、悬空 source 或未绑定 assertion 均 fail closed。

## 3. 第一阶段 `CI-P1-DEFINITION`

### 3.1 四项原子产物

P1 是一个原子交付，四项缺一不可：

1. **契约**：规范 manifest、OpenAPI、读模型、写命令、错误、generated Java/TS；
2. **seed 数据**：合法、稳定、可人工理解的初始业务图；
3. **测试场景**：需求/IA 到 API/L2 业务断言的机器可数分母；
4. **测试数据**：独立于 seed 的异常/边界 fixture，API 与 L2 共享同一 canonical catalog。

P1 不建数据库、不执行 seed、不实现接口、不写前端 locator。generated 产物是契约生成结果，
不是业务实现。

### 3.2 契约规范源与生成链

建议新增的手写规范源：

```text
contracts/catalog/catalog-item-editor-manifest.json
contracts/catalog/catalog-inventory-edge-contract.json
contracts/catalog/catalog-inventory-edge-placement.json
contracts/policy/catalog-inventory-copy-policy.json
contracts/policy/catalog-inventory-fixture-catalog.schema.json
contracts/policy/catalog-inventory-fixture-catalog.json
```

形态 manifest 是七形态、八类 contract surface、四条 modeRules、shape admission、字段规则、
锁定规则与 precision 的唯一真相；edge contract/placement 是本期 operation/component exact-set 及
shard 放置的唯一真相。copy policy 是两个可调上限的唯一声明点；OpenAPI 只冻结 typed problem 与
`{actual,limit}` 响应形状，不冻结数值。现有 R5 catalog 保持历史字节，不把新域伪装成旧 R5 事实；生成器读取
“既有基线 + 本期 addendum”。

生成/物化的 OpenAPI shards：

```text
contracts/openapi/components/catalog/catalog-common.schemas.json
contracts/openapi/components/catalog/catalog-workbench.schemas.json
contracts/openapi/components/catalog/catalog-item.schemas.json
contracts/openapi/components/catalog/catalog-dictionary.schemas.json
contracts/openapi/components/catalog/catalog-copy.schemas.json
contracts/openapi/components/inventory/inventory-common.schemas.json
contracts/openapi/components/inventory/inventory-workbench.schemas.json
contracts/openapi/components/inventory/inventory-command.schemas.json
contracts/openapi/components/fulfillment-production/production-tag.schemas.json
contracts/openapi/paths/operations-admin/catalog-workbench.paths.json
contracts/openapi/paths/operations-admin/catalog-item-management.paths.json
contracts/openapi/paths/operations-admin/catalog-dictionary-management.paths.json
contracts/openapi/paths/operations-admin/catalog-copy.paths.json
contracts/openapi/paths/operations-admin/inventory-workbench.paths.json
contracts/openapi/paths/operations-admin/inventory-management.paths.json
contracts/openapi/paths/operations-admin/production-tag-management.paths.json
```

generated outputs不得手改：root OpenAPI、route/capability registry、Java wire、operations-admin
generated client/RTK client，以及由形态 manifest 生成的 Java/TS typed manifest。platform-admin slice
保持无本期 operation。

### 3.3 operation exact-set（43）

所有写操作使用 `Idempotency-Key`，命令只接收 trusted context 派生后的业务输入与 expected version；
不接收客户端 owner/project/`itemKind`/`measureMode`/`usageCapabilities`/`skuMode`。

| 编号 | operation exact-set |
|---|---|
| 01—07 | `getOperationsCatalogWorkbenchContext`, `getOperationsCatalogNavigation`, `getOperationsCatalogItems`, `getOperationsCatalogItem`, `createOperationsCatalogItem`, `saveOperationsCatalogItem`, `transitionOperationsCatalogItemStatus` |
| 08—11 | `createOperationsCatalogCategory`, `updateOperationsCatalogCategory`, `moveOperationsCatalogCategory`, `deleteOperationsCatalogCategory` |
| 12—16 | `getOperationsCatalogDictionary`, `createOperationsCatalogDictionaryEntry`, `updateOperationsCatalogDictionaryEntry`, `reorderOperationsCatalogDictionaryEntry`, `transitionOperationsCatalogDictionaryEntryStatus` |
| 17—20 | `getOperationsProductionTags`, `createOperationsProductionTag`, `updateOperationsProductionTag`, `transitionOperationsProductionTagStatus` |
| 21—23 | `getOperationsLocalCatalogCopyCandidates`, `preflightOperationsLocalCatalogCopy`, `executeOperationsLocalCatalogCopy` |
| 24—25 | `preflightOperationsTemporaryCatalogItemPromotion`, `executeOperationsTemporaryCatalogItemPromotion` |
| 26—28 | `getOperationsBrandCatalogCopyCandidates`, `preflightOperationsBrandCatalogCopy`, `executeOperationsBrandCatalogCopy` |
| 29—35 | `getOperationsInventoryTargets`, `getOperationsInventoryTarget`, `getOperationsInventoryTargetChangeSummary`, `getOperationsInventoryTargetBusinessHistory`, `getOperationsInventoryTargetConsumptionReferences`, `getOperationsInventoryTargetLedger`, `getOperationsInventoryTargetDiagnostics` |
| 36—39 | `countOperationsInventoryTarget`, `increaseOperationsInventoryTarget`, `adjustOperationsInventoryTarget`, `updateOperationsInventoryTargetConfiguration` |
| 40—41 | `stageOperationsCatalogAsset`, `releaseOperationsCatalogStagedAsset`；仍由 asset owner 持有资产事实 |
| 42 | `getOperationsCatalogShapeManifest`，返回与静态 manifest 同 revision/digest 的会话可见读版本 |
| 43 | `batchTransitionOperationsCatalogItemStatus`，集合级批量状态迁移；每项携带 `itemRef` 与 `expectedVersion`，按当前 scope 逐条独立事务返回结果 |

`saveOperationsCatalogItem` 是一个 HTTP command，但内部 input 分为 `catalogDraft`、
`inventoryConfiguration`、`expectedCatalogVersion`、`expectedInventoryVersions[]`。高级诊断必须是
独立 operation，缺权限时前端不调用；不能在普通详情中返回后再过滤。

#### 3.3.1 43 行 operation assertion matrix

P1 实际规范源不是本表的 prose，而是新增
`contracts/policy/catalog-inventory-assertion-matrix.json`。每行稳定键为 `operationId`，字段固定为
`face/initiatingOwner/coordinatedOwners/authorization/request/response/errors/logicSteps/callChain/conditionToProblem/normalPathDbOperations/assertions[]`；
每个 assertion 固定包含 `assertionId/iaIds/verifiedBusinessBehavior/primaryVerifier/scenarioIds`；
本表、IU×stage 视图、operation count 与 package-exit denominator 都由该 JSON 生成并 exact-match，
禁止并行维护多份字符串。

本轮的 43 行 implementation-facing 基线由
`doc/review/platform/2026-08-06-v2s-catalog-inventory-backend-operation-design-contract.json`
逐行给出，P1 只能把它无损迁移进 assertion matrix，不能重新解释。每个 operation 必须同时声明：

1. 有序业务逻辑步骤；
2. 每个 `problemCode` 唯一对应的触发条件与判定优先级，且两边 exact-set；
3. edge、trusted context、application coordinator、initiating owner 与 coordinated owners 的调用链；
4. 具名正常 fixture 下的 `RequestCompletionEvent.databaseOperationCount` 精确次数、owner 分解与假设。

该次数是接口正常访问形态的**设计限定**，不是通用 SQL 上限，也不是性能结论。P2 用同一具名 fixture
将实测 `databaseOperationCount` 与设计值做精确对账；不一致必须给出 operationId、设计值、实测值、
新增/消失的调用链节点与具名 disposition，禁止放宽成 `<=` 或提高统一阈值。

表内 `PR/EW/DR` 与 `E-*` 只作人读摘要，绝不是契约输入。canonical JSON 每一行必须直接存
`pageKeys[]`、`capabilityKeys[]` 与展开后的 `problemCodes[]`，不得存摘要别名；生成器反向生成本表。
`PR` 仅表示该行列出的 page read access；`EW` 的唯一写 capability key 是
`EDIT_CATALOG_LIBRARY`；`DR` 的唯一额外 capability key 是
`READ_INVENTORY_ADVANCED_DIAGNOSTICS`。request/response component 名称也是 P1 component exact-set。

| # | operationId | owner / coordinated owners | auth | request → response | errors | primary scenario |
|---:|---|---|---|---|---|---|
| 1 | `getOperationsCatalogWorkbenchContext` | catalog / organization, workspace-iam | PR | `CatalogContextQuery` → `CatalogWorkbenchContext` | E-R | API-003,023,024 |
| 2 | `getOperationsCatalogNavigation` | catalog / none | PR | `CatalogNavigationQuery` → `CatalogNavigationView` | E-R | API-002,004 |
| 3 | `getOperationsCatalogItems` | catalog / inventory task-read | PR | `CatalogItemPageQuery` → `CatalogItemPage` | E-R | API-003,004 |
| 4 | `getOperationsCatalogItem` | catalog / inventory, fulfillment-production task-read | PR | `CatalogItemDetailQuery` → `CatalogItemDetail` | E-R | API-005,026 |
| 5 | `createOperationsCatalogItem` | catalog / asset | EW | `CatalogItemCreateRequest` → `CatalogItemCommandReadback` | E-W | API-002,008 |
| 6 | `saveOperationsCatalogItem` | APP_COORDINATOR / catalog, inventory, asset | EW | `CatalogItemSaveRequest` → `CatalogItemSaveReadback` | E-W | API-008,014 |
| 7 | `transitionOperationsCatalogItemStatus` | catalog / inventory reference judgment | EW | `CatalogItemTransitionRequest` → `CatalogItemCommandReadback` | E-W | API-008,006 |
| 43 | `batchTransitionOperationsCatalogItemStatus` | catalog / inventory reference judgment | EW | `CatalogItemBatchStatusTransitionRequest` → `CatalogItemBatchStatusTransitionReadback` | E-W | API-008 |
| 8 | `createOperationsCatalogCategory` | catalog / none | EW | `CatalogCategoryCreateRequest` → `CatalogCategoryReadback` | E-W | API-006 |
| 9 | `updateOperationsCatalogCategory` | catalog / none | EW | `CatalogCategoryUpdateRequest` → `CatalogCategoryReadback` | E-W | API-006 |
| 10 | `moveOperationsCatalogCategory` | catalog / none | EW | `CatalogCategoryMoveRequest` → `CatalogCategoryReadback` | E-W | API-006 |
| 11 | `deleteOperationsCatalogCategory` | catalog / catalog reference judgment | EW | `CatalogCategoryDeleteRequest` → `CatalogCategoryDeleteReadback` | E-W | API-006 |
| 12 | `getOperationsCatalogDictionary` | catalog / none | PR | `CatalogDictionaryQuery` → `CatalogDictionaryView` | E-R | API-005,006 |
| 13 | `createOperationsCatalogDictionaryEntry` | catalog / none | EW | `CatalogDictionaryEntryCreateRequest` → `CatalogDictionaryEntryReadback` | E-W | API-006 |
| 14 | `updateOperationsCatalogDictionaryEntry` | catalog / none | EW | `CatalogDictionaryEntryUpdateRequest` → `CatalogDictionaryEntryReadback` | E-W | API-006 |
| 15 | `reorderOperationsCatalogDictionaryEntry` | catalog / none | EW | `CatalogDictionaryEntryReorderRequest` → `CatalogDictionaryView` | E-W | API-006 |
| 16 | `transitionOperationsCatalogDictionaryEntryStatus` | catalog / catalog reference judgment | EW | `CatalogDictionaryEntryTransitionRequest` → `CatalogDictionaryEntryReadback` | E-W | API-006 |
| 17 | `getOperationsProductionTags` | fulfillment-production / none | PR | `ProductionTagQuery` → `ProductionTagPage` | E-R | API-005,025 |
| 18 | `createOperationsProductionTag` | fulfillment-production / organization scope | EW | `ProductionTagCreateRequest` → `ProductionTagReadback` | E-W | API-025 |
| 19 | `updateOperationsProductionTag` | fulfillment-production / none | EW | `ProductionTagUpdateRequest` → `ProductionTagReadback` | E-W | API-025 |
| 20 | `transitionOperationsProductionTagStatus` | fulfillment-production / catalog reference judgment | EW | `ProductionTagTransitionRequest` → `ProductionTagReadback` | E-W | API-025 |
| 21 | `getOperationsLocalCatalogCopyCandidates` | catalog / inventory task-read | PR | `LocalCopyCandidateQuery` → `LocalCopyCandidatePage` | E-R | API-005 |
| 22 | `preflightOperationsLocalCatalogCopy` | APP_COORDINATOR / catalog, inventory | EW | `LocalCopyPreflightRequest` → `LocalCopyPreflight` | E-C | API-014,020 |
| 23 | `executeOperationsLocalCatalogCopy` | APP_COORDINATOR / catalog, inventory | EW | `LocalCopyExecuteRequest` → `LocalCopyReadback` | E-C | API-020,022 |
| 24 | `preflightOperationsTemporaryCatalogItemPromotion` | catalog / none | EW | `TemporaryPromotionPreflightRequest` → `TemporaryPromotionPreflight` | E-W | API-007 |
| 25 | `executeOperationsTemporaryCatalogItemPromotion` | catalog / none | EW | `TemporaryPromotionExecuteRequest` → `CatalogItemCommandReadback` | E-W | API-007,008 |
| 26 | `getOperationsBrandCatalogCopyCandidates` | catalog / organization copy-source judgment | PR | `BrandCopyCandidateQuery` → `BrandCopyCandidatePage` | E-R | API-023,024 |
| 27 | `preflightOperationsBrandCatalogCopy` | APP_COORDINATOR / organization, catalog, inventory, fulfillment-production | EW | `BrandCopyPreflightRequest` → `BrandCatalogCopyPreflight` | E-C | API-015..021 |
| 28 | `executeOperationsBrandCatalogCopy` | APP_COORDINATOR / organization, catalog, inventory, fulfillment-production | EW | `BrandCopyExecuteRequest` → `BrandCatalogCopyReadback` | E-C | API-021,022,024 |
| 29 | `getOperationsInventoryTargets` | inventory / catalog task-read | PR | `InventoryTargetPageQuery` → `InventoryTargetPage` | E-R | API-010 |
| 30 | `getOperationsInventoryTarget` | inventory / catalog task-read | PR | `InventoryTargetQuery` → `InventoryTargetCurrentView` | E-R | API-011 |
| 31 | `getOperationsInventoryTargetChangeSummary` | inventory / none | PR | `InventoryTargetPeriodQuery` → `InventoryChangeSummaryView` | E-R | API-011 |
| 32 | `getOperationsInventoryTargetBusinessHistory` | inventory / none | PR | `InventoryHistoryPageQuery` → `InventoryBusinessHistoryPage` | E-R | API-011 |
| 33 | `getOperationsInventoryTargetConsumptionReferences` | inventory / catalog task-read | PR | `InventoryReferencePageQuery` → `InventoryConsumptionReferencePage` | E-R | API-011 |
| 34 | `getOperationsInventoryTargetLedger` | inventory / none | PR | `InventoryLedgerPageQuery` → `InventoryLedgerPage` | E-R | API-011 |
| 35 | `getOperationsInventoryTargetDiagnostics` | inventory / none | DR | `InventoryDiagnosticsQuery` → `InventoryDiagnosticsView` | E-R | API-011,024 |
| 36 | `countOperationsInventoryTarget` | inventory / none | EW | `InventoryCountRequest` → `InventoryWriteReadback` | E-W | API-012 |
| 37 | `increaseOperationsInventoryTarget` | inventory / none | EW | `InventoryIncreaseRequest` → `InventoryWriteReadback` | E-W | API-012 |
| 38 | `adjustOperationsInventoryTarget` | inventory / none | EW | `InventoryAdjustmentRequest` → `InventoryWriteReadback` | E-W | API-012 |
| 39 | `updateOperationsInventoryTargetConfiguration` | inventory / none | EW | `InventoryTargetConfigurationRequest` → `InventoryTargetCurrentView` | E-W | API-012 |
| 40 | `stageOperationsCatalogAsset` | asset / none | EW | `CatalogAssetStageRequest` → `StagedCatalogAsset` | E-A | API-009 |
| 41 | `releaseOperationsCatalogStagedAsset` | asset / catalog reference judgment | EW | `CatalogAssetReleaseRequest` → `CatalogAssetReleaseReadback` | E-A | API-009 |
| 42 | `getOperationsCatalogShapeManifest` | catalog / none | PR | `CatalogShapeManifestQuery` → `CatalogShapeManifestView` | E-R | API-001,002,014 |

##### 授权与 typed problem 的逐 operation exact expansion

page/capability membership 是封闭集合：

| operation membership | pageKeys | capabilityKeys |
|---|---|---|
| `1..21,24..25,40..42` | `PG-CATALOG-STORE-ITEMS`, `PG-CATALOG-BRAND-ITEMS` | GET 为空；写 operation 为 `EDIT_CATALOG_LIBRARY` |
| `22..23,26..28` | `PG-CATALOG-STORE-ITEMS` | 写 operation 为 `EDIT_CATALOG_LIBRARY`；candidate GET `26` 为空 |
| `29..34` | `PG-INVENTORY-STORE-STATUS` | GET 为空 |
| `35` | `PG-INVENTORY-STORE-STATUS` | `READ_INVENTORY_ADVANCED_DIAGNOSTICS` |
| `36..39` | `PG-INVENTORY-STORE-STATUS` | `EDIT_CATALOG_LIBRARY` |

problem profile 只为压缩本文；P1 checker 必须把下列 profile 按 membership 展开成每行
`problemCodes[]` 并证明 JSON 中不存在 profileId：

| exact operation membership | exact problemCodes[] |
|---|---|
| `1,2,3,12,17,21,26,29,31,32,33,34,42` | `VALIDATION_ERROR,SCOPE_FORBIDDEN` |
| `4,30,35` | `VALIDATION_ERROR,SCOPE_FORBIDDEN,NOT_FOUND` |
| `5` | `VALIDATION_ERROR,SCOPE_FORBIDDEN,DUPLICATE_CODE,IDEMPOTENCY_MISMATCH,RESULT_UNKNOWN,ASSET_NOT_READY` |
| `8,13,18` | `VALIDATION_ERROR,SCOPE_FORBIDDEN,DUPLICATE_CODE,IDEMPOTENCY_MISMATCH,RESULT_UNKNOWN` |
| `6` | `VALIDATION_ERROR,SCOPE_FORBIDDEN,NOT_FOUND,VERSION_CONFLICT,IDEMPOTENCY_MISMATCH,RESULT_UNKNOWN,VOIDED_RECORD_IMMUTABLE,ASSET_NOT_READY` |
| `9,14,15,19,39` | `VALIDATION_ERROR,SCOPE_FORBIDDEN,NOT_FOUND,VERSION_CONFLICT,IDEMPOTENCY_MISMATCH,RESULT_UNKNOWN,VOIDED_RECORD_IMMUTABLE` |
| `10` | `VALIDATION_ERROR,SCOPE_FORBIDDEN,NOT_FOUND,VERSION_CONFLICT,HIERARCHY_CYCLE,IDEMPOTENCY_MISMATCH,RESULT_UNKNOWN,VOIDED_RECORD_IMMUTABLE` |
| `7,11,16,20` | `VALIDATION_ERROR,SCOPE_FORBIDDEN,NOT_FOUND,VERSION_CONFLICT,REFERENCE_BLOCKS_VOID,DEPENDENT_FACTS_BLOCK_VOID,IDEMPOTENCY_MISMATCH,RESULT_UNKNOWN,VOIDED_RECORD_IMMUTABLE` |
| `22` | `VALIDATION_ERROR,SCOPE_FORBIDDEN,NOT_FOUND` |
| `23` | `VALIDATION_ERROR,SCOPE_FORBIDDEN,NOT_FOUND,STRUCTURE_INCOMPATIBLE,CONSUMPTION_UNIT_INCOMPATIBLE,REFERENCE_MAPPING_UNRESOLVED,STALE_COPY_PREFLIGHT,IDEMPOTENCY_MISMATCH,RESULT_UNKNOWN` |
| `24` | `VALIDATION_ERROR,SCOPE_FORBIDDEN,NOT_FOUND` |
| `25` | `VALIDATION_ERROR,SCOPE_FORBIDDEN,NOT_FOUND,DUPLICATE_CODE,STALE_COPY_PREFLIGHT,VERSION_CONFLICT,IDEMPOTENCY_MISMATCH,RESULT_UNKNOWN` |
| `27` | `VALIDATION_ERROR,SCOPE_FORBIDDEN,NOT_FOUND,COPY_SELECTED_ITEMS_TOO_LARGE,COPY_CLOSURE_TOO_LARGE` |
| `28` | `VALIDATION_ERROR,SCOPE_FORBIDDEN,NOT_FOUND,COPY_SELECTED_ITEMS_TOO_LARGE,COPY_CLOSURE_TOO_LARGE,STRUCTURE_INCOMPATIBLE,CONSUMPTION_UNIT_INCOMPATIBLE,REFERENCE_MAPPING_UNRESOLVED,OWNER_REFERENCE_LEAK,STALE_COPY_PREFLIGHT,IDEMPOTENCY_MISMATCH,RESULT_UNKNOWN` |
| `36,37` | `VALIDATION_ERROR,SCOPE_FORBIDDEN,NOT_FOUND,VERSION_CONFLICT,IDEMPOTENCY_MISMATCH,RESULT_UNKNOWN` |
| `38` | `VALIDATION_ERROR,SCOPE_FORBIDDEN,NOT_FOUND,VERSION_CONFLICT,NEGATIVE_STOCK_NOT_ALLOWED,IDEMPOTENCY_MISMATCH,RESULT_UNKNOWN` |
| `40` | `VALIDATION_ERROR,SCOPE_FORBIDDEN,ASSET_PROCESSING_FAILED,IDEMPOTENCY_MISMATCH,RESULT_UNKNOWN` |
| `41` | `VALIDATION_ERROR,SCOPE_FORBIDDEN,NOT_FOUND,ASSET_REFERENCE_PROTECTED,IDEMPOTENCY_MISMATCH,RESULT_UNKNOWN` |

上述 membership 对 `1..42` 必须 exact cover 一次且仅一次；create 不获得 void error、普通 GET 不获得
version error、asset 不继承 catalog lifecycle error。删除任一 operation、重复归类或在 JSON 中保留宽泛
superset 都由 assertion-matrix checker 失败。

预检的结构/单位/引用问题是 `200` 响应中完整、可确认或可阻断的 `compatibilityResults[]`，不是首错即停的
typed problem；执行时才按 design contract 的既定顺序重新计算并抛出 typed problem。`STALE_COPY_PREFLIGHT`
专用于已接受 digest/version vector 漂移，不能再同时用宽泛 `VERSION_CONFLICT` 表达同一事实。

`APP_COORDINATOR` 不是 owner schema，也不写 `x-owner-module=APP_COORDINATOR`。edge contract 的
`x-owner-module` 仍取 initiating owner `catalog`，并由 assertion matrix 的 `coordinatedOwners` 显式声明
参与者；coordinator 不解释 capability，只消费 workspace-IAM 的 trusted execution context，三个 owner
各自做对象/范围/版本判断。

临时商品转正是资料补全与治理命令，不是把 `status` 直接改成 `DRAFT` 的快捷按钮。预检要求正式编码、
形态、名称、来源版本以及形态所需资料，返回当前/拟转商品、正式编码占用、必填字段、差异、阻断原因
与 `preflightDigest`；执行必须携带同一资料、来源版本、owner 版本和 digest。正式编码不变时在原临时
记录上完成治理转正，编码变化时在同一 owner 事务内新建正式商品并归档临时记录，历史临时商品的原编码
永不释放。执行优先返回 `DUPLICATE_CODE`、`STALE_COPY_PREFLIGHT`，只有条件写入竞争才返回
`VERSION_CONFLICT`；前端失败必须保留已填写资料并要求重新预检。

#### 3.3.2 C-17 编码作废重建的可执行语义

`VOIDED` 是区别于 `DISABLED/ARCHIVED` 的 terminal 状态，适用于有独立编码的
CatalogItem、Category、CatalogTag、SalesUnit、SKU 销售属性、SKU 属性值、ProductSku 与
ProductionTagDefinition；StockTarget 没有自身编码，明确 `NOT_APPLICABLE`。进入 `VOIDED` 后对象只读、
审计可见，编码在原 owner scope 内永久保留，并从新选择、复制候选和写集合排除，禁止恢复或改码。

C-17 的 item/category/dictionary/production-tag 仍复用各自 transition operation；本设计另有已批准的第 43 个 HTTP operation `batchTransitionOperationsCatalogItemStatus`，不改变 C-17 的单条复用语义；
`saveOperationsCatalogItem` 的 typed request 允许 `skuTransitions[]`，只接受
`{skuRef,targetStatus:VOIDED,expectedVersion}`，仍不接受 code。每个 transition readback 必须包含
`canVoid/blockingReferences/dependentFacts` 的 owner judgment；执行前 owner 在同一事务中重算：

- 入站引用非零返回 `REFERENCE_BLOCKS_VOID`；
- 自有依赖事实非空返回 `DEPENDENT_FACTS_BLOCK_VOID`；商品包括仍存子 SKU/识别码/库存/BOM，SKU 包括
  识别码/StockTarget/BOM/引用，字典与生产标签包括所有使用引用；
- 版本漂移、幂等不一致与已作废再写继续使用 E-W 封闭错误集；
- “作废并重建”是两条独立命令：先成功作废，后用新编码创建新对象；旧编码绝不释放。前端可预填
  描述字段但必须让用户重新输入编码并再次通过格式与 owner-scope 唯一性校验。

上述规则由 `CI-API-006` 的 10 个 parameterized cases 覆盖：八类对象各一条 zero-reference 成功，
再加入站引用阻断与依赖事实阻断；`CI-L2-010` 保持两条浏览器责任，分别证明可执行向导与阻断原因，
不重复 owner 判断算法。

作废前判断必须随既有 GET 返回，而不是等 transition 之后才出现：CatalogItemDetail 的 action availability、
CatalogNavigationView 的每个 category node、CatalogDictionaryView 的每个 entry、ProductionTagPage 的
每个 row 都携带同一 typed `voidAvailability={canVoid,blockingReferences[],dependentFacts[]}`。字段由各
owner 批量判断，禁止前端计算、逐行 N+1 或新增第 43 个 endpoint；transition 仍在事务内重算而不信任
读时结果。

### 3.4 读模型一次定全

#### 3.4.1 工作台 context、导航与分页

`CatalogWorkbenchContext`：

- `ownerType/ownerRef/brandRef`、范围名称/编码；
- nullable `headCompanyRef`、`copySourceAvailable`；
- owner 返回的 action availability 与 typed reason；
- `contextVersion/authorizationRevision`。

`CatalogNavigationView`：`allCount` 是当前 `dataNodeRef + brandRef` 内所有非 `VOIDED` 商品的 owner
统计，且必须与 `SMART:ALL` 的无额外筛选结果域一致；全部、未分类、六个智能视图及计数、七形态及计数
（零计数保留）、三级分类树（名码/状态/计数；2026-08-25 深度裁定覆盖原两级表述）。`allCount` 不得由分类、形态或分页结果在前端推导。
分类 count 是否包含后代固定为显式字段 `countSemantics=SELF_ONLY|SELF_AND_DESCENDANTS`，前端不得猜。

`CatalogItemPage` 请求/响应共同回显 query identity：owner scope、selected tree node、
`includeSubCategories`、节点内 keyword、status/governance/source/tag filters、opaque cursor、
next cursor 与 client query generation。keyword 只在当前树节点结果域搜索，不是全库搜索。

每个 summary 一次返回：主图 ref、名码/短名、分类/标签、shape/status/governance/source、
SKU 启用/非归档/总数与维度、商品/SKU 价格摘要与 priceGranularity/缺价数、
StockTarget/BOM 数与风险、version/updatedAt。禁止逐商品 N+1 补库存摘要。

#### 3.4.2 商品详情

`CatalogItemDetail` 按 IA 页签提供 typed sections：基础资料与全部图片、识别码、SKU 矩阵、
点单选项 typed JSON、自由描述 map、商品/SKU/选项值三层 production profile、
shape-admitted StockTarget/BOM 节点树、套餐内容、生命周期、来源/外部身份、引用与阻断动作、
`deniedFields`/field ownership、owner action availability。UI dirty/focus 不进 DTO；后端只给 typed error、
recovery action、query identity 与 owner readback。

#### 3.4.3 库存列表与详情六区

库存列表 summary 一次返回库存对象名码/type、关联商品/SKU 名码、分类/materialRole、消耗单位、
盘点单位/换算摘要、余额与 `stockState`、stale/unknown、threshold/gap、今日/7日/30日变化、
最近变化 source/time、`authorityType=INTERNAL`。`需处理` 仅为 query view key，不进入状态枚举。

六区不折成超大 DTO：

1. `InventoryTargetCurrentView`；
2. `InventoryChangeSummaryView`；
3. `InventoryBusinessHistoryPage`；
4. `InventoryConsumptionReferencePage`；
5. `InventoryLedgerPage`；
6. `InventoryDiagnosticsView`（独立权限与 operation）。

各区有独立 pagination/error/retry identity；关键对象身份读取失败才阻断整个 Drawer。

#### 3.4.4 品牌复制预检

`BrandCatalogCopyPreflight` 必须返回 source/target scope、selected items、两个 limit 及实际数、
`closureItems[]`、`closureEdges[]`、双侧 `objectVersions[]`、`mappingPreview[]`、
九类 `compatibilityResults[]`、`referenceRewritePreview[]`、`preflightDigest`、blocking count 与
confirmation-required count。执行请求只带原始选择、digest、完整 expected version vector、
accepted difference IDs 和幂等键，不让客户端回传/修改执行 plan。

Dexter 已确认当前值为 selected `20`、closure `500`。数值只写入
`contracts/policy/catalog-inventory-copy-policy.json`；owner 校验加载该 policy，workbench/preflight readback
把当前 limit 传给 UI 形成提示，fixture generator 同样加载该 policy。OpenAPI、generated wire、owner 源码、
UI 文案与 fixture 均不得内嵌 `20/500` 字面量，因此日后调整只改一个声明点，不改变契约结构，也不重写场景。
P1 机械门对上述有限 consumer 分母扫描，除 policy source 外出现任一 `20/500` limit 字面量即失败。

typed failures 至少包括：

```text
COPY_SELECTED_ITEMS_TOO_LARGE
COPY_CLOSURE_TOO_LARGE
STRUCTURE_INCOMPATIBLE
CONSUMPTION_UNIT_INCOMPATIBLE
REFERENCE_MAPPING_UNRESOLVED
OWNER_REFERENCE_LEAK
STALE_COPY_PREFLIGHT
```

另复用通用 validation/version/idempotency/result-unknown problem。

### 3.5 形态与封闭集合的静态真相

- 七个 shape 全集、stable key/display、派生 fields、tabs、field rules、priceGranularity。
- `usageCapabilities={SELLABLE,STOCK_MANAGED,BOM_COMPONENT,PRODUCIBLE}`；当前七形态派生
  `PRODUCIBLE` 的 count 必须为 0，删掉该保留位是 red。
- `HAS_SKU` = 存在任一非归档 SKU；停用 SKU 仍算，只有全归档才是 `NO_SKU`。
- 先 shape admission 决定节点存在，再用四条 modeRules 决定存在节点的 mode；SERVICE 与
  BENEFIT_SHELL 不得因 `NO_SKU` 获得三态。
- 所有 typed JSON `additionalProperties:false`；仅描述属性 free map 是具名豁免。
- 金额 integer cents；数量为 decimal string + 明确 scale/rounding，禁止 float/double。
- relation enum 精确五值，不含 `MATERIAL_OF/PACKAGING_OF`。
- 商品、分类、标签、销售单位、SKU 销售属性/值、SKU、商品处理标签的 code 创建后不可修改；
  update request 不含 code。创建即时校验格式与 owner-scope 唯一性；录错只允许零引用记录整体作废重建。
- StockTarget 不设自身 code；canonical identity 精确为 `(targetType,itemCode,skuCode?)`。
  UI、owner、数据库唯一约束、mapping、digest 与 preflight 共用同一 tuple。
- BENEFIT_SHELL 保留在七形态与 itemKind 中，左树恒列零计数；创建形态选项可见但 disabled，
  typed disabled reason 为“权益域尚未开放”，不能隐藏或显示笼统“不可用”。
- 不生成四个扣减/恢复 command，不生成 SalesStockView/外部库存 authority/同步执行 API。

### 3.6 canonical fixture catalog：seed 与 test 数据不混

唯一数据规范源：

```text
contracts/policy/catalog-inventory-fixture-catalog.schema.json
contracts/policy/catalog-inventory-fixture-catalog.json
```

根字段至少为 `schemaVersion/kind/catalogId/revision/sourceBindings/seedDatasets/testDatasets/`
`scenarioCatalog/denominators/consumerBindings/forbiddenStructures`。每个 dataset 声明 fixtureId、
class、purpose、owner scopes、objects、批准 edges、prerequisite refs、可选 generator recipe、
setup channel、readback selectors、expected counts、scenario IDs 与 cleanup policy。

`seedDatasets` 只含合法初始样本，DEV seed 只能消费这里；`testDatasets` 承载边界/异常，
任何正常 fixture 不得 direct SQL。STALE 场景必须用“预检→owner command 修改→旧 digest 执行”生成，
超限场景按契约 `limit+1` 参数化生成。API/L2 report 都记录同一 catalog path、实际 SHA、revision、
consumed fixture/scenario exact-set，不能把 catalog 自身 SHA 写进自身造成自引用。

#### 3.6.1 seed 代表图

| 样本 | 必须事实 |
|---|---|
| 拿铁 | 三 SKU；SMALL/MEDIUM/LARGE；三份 SKU BOM 分别 14/18/24 克咖啡豆 |
| 双人晚餐套餐 | typed composite JSON；跨商品引用且至少一个指向具体 SKU；引用瘦边由 JSON 派生 |
| 凯撒沙拉 | 三个商品内联选项组；默认 + 三个 option-value BOM 共四份 |
| 物料 | 咖啡豆、沙拉基底、培根、鸡蛋、鸡胸肉、餐具等；MATERIAL + materialRole |
| 称重占位 | `STANDARD_SALE_WEIGHED`；只声明按重量卖/单位/识别码，不存重量 |

同一业务图在总公司+品牌和门店+品牌各有合法 owner 事实。总公司可有 StockTarget/BOM，
balance/ledger exact count=0；门店有余额与合法变化流水。SKU 只持 attributeValueRefs，不建坐标表；
选项组/值不升格为共享实体；不复制 v4 的 SalesStockView、InventoryAuthorityConfig、假 EAV 或双真相。

#### 3.6.2 test fixture 必备 exact-set

```text
store-without-head-company-write-capable
store-with-head-company-read-only
copy-unit-kind-conflict
copy-selected-limit-plus-one
copy-closure-limit-plus-one
copy-stale-preflight-source-mutated
copy-stale-preflight-target-mutated
copy-product-sku-combination-conflict
sku-only-disabled
sku-only-archived
service-no-sku-no-stock-node
benefit-shell-no-sku-no-stock-node
advanced-diagnostic-denied
compat-<type>-structural-negative
compat-<type>-confirm-reuse
reference-rewrite-complete
reference-rewrite-unmapped
```

九类兼容矩阵中，商品、销售单位、属性值、处理标签、库存对象、BOM 六类有真实结构阻断；
商品的结构判别位包含 shape 与 SKU 结构指纹，后者是排序后的
`skuCode -> sorted(attributeCode,valueCode)` 映射；它不新增第十类对象，也不改变 SKU 判同 tuple。
分类、商品标签、SKU 销售属性没有结构判别位，三者的 structural negative 必须标记
`NOT_APPLICABLE_NO_STRUCTURAL_BITS`，并证明展示/组织差异不会被误阻断。不得为凑“九条阻断”发明业务语义。

### 3.7 测试场景分母与层级裁判规则

P1 固定 **26 个 API scenario definitions / 100 个 parameterized API cases**，以及
**18 个 L2 scenario definitions / 43 个 L2 business cases**。场景 case 与 89 个 IA-ID 是不同分母；
需求映射靠 assertion ID，不靠数字巧合。

分层判据：纯业务判断、集合、排序/分页、owner、事务、幂等、版本、闭包、重写与 typed error
由 API primary verify；只有视觉呈现、入口是否存在、局部交互、dirty/overlay/focus、浏览器状态保持
由 L2 primary verify。L2 可使用 API 已证明的结果数据，但不重复证明算法。

#### API scenario definitions（26 / 100 cases）

| ID | cases | fixture / 正反例与预期 |
|---|---|---:|
| `CI-API-001` | 1 | manifest/closed-set exact；删 `PRODUCIBLE`、relation 或 error value 必红 |
| `CI-API-002` | 7 | 七形态逐个校验派生字段、tabs、priceGranularity、create availability |
| `CI-API-003` | 1 | tree node + keyword + filters + cursor/generation 联合；跨节点污染必红 |
| `CI-API-004` | 1 | 六智能视图事实与计数；`需处理` 不进入 stockState |
| `CI-API-005` | 9 | IA §4.3 九 surface 各有 loading/error/empty/recovery 所需 typed facts |
| `CI-API-006` | 10 | 八类有编码对象逐类 GET `voidAvailability` + zero-reference `VOIDED` 成功；入站引用与依赖事实各一 typed 阻断；code 永不释放、重建必须新 code |
| `CI-API-007` | 1 | self-managed/auto-sync/temporary 三来源 ownership 与 promotion preflight |
| `CI-API-008` | 3 | lifecycle legal transition；CAS conflict；idempotency replay/mismatch |
| `CI-API-009` | 2 | asset stage/claim/release happy path；processing/failure/ref-protected negative |
| `CI-API-010` | 1 | inventory list set-based summary、状态/gap/三周期变化/最近变化 |
| `CI-API-011` | 6 | 库存详情六个独立 read operation 各一 case；删任一区必红 |
| `CI-API-012` | 4 | 盘点、库存增加、人工调整、快捷配置各自 before/change/after/ledger readback |
| `CI-API-013` | 3 | enabled SKU→HAS；disabled-only→HAS；archived-only→NO_SKU |
| `CI-API-014` | 6 | 普通商品节点/modes 正例；SKU 壳、option value；SERVICE、BENEFIT_SHELL 准入反例 |
| `CI-API-015` | 2 | 多层 DAG 与循环依赖均按 visited 到不动点且不沿反向/relations 扩张 |
| `CI-API-016` | 2 | selected limit 边界值成功；`limit+1` 返回 `COPY_SELECTED_ITEMS_TOO_LARGE` |
| `CI-API-017` | 2 | closure limit 边界值成功；`limit+1` 返回完整实际数且不截断 |
| `CI-API-018` | 18 | 九类各一 confirmable reuse；六类真实 structural block（商品负例使用同 SKU 编码但属性组合冲突），三类显式 N/A 且展示差异不误阻断 |
| `CI-API-019` | 2 | GRAM↔EACH 两方向均 `CONSUMPTION_UNIT_INCOMPATIBLE`，禁止接受忽略 |
| `CI-API-020` | 2 | 全 outbound refs 完整重写正例；删一个 mapping 整体 `REFERENCE_MAPPING_UNRESOLVED` |
| `CI-API-021` | 2 | source mutation 与 target mutation 均在任何写前 `STALE_COPY_PREFLIGHT` |
| `CI-API-022` | 2 | 同 idempotency replay 同结果；中途 owner failure 三 owner 全回滚 |
| `CI-API-023` | 1 | 无 headCompanyRef 正常返回 copySourceAvailable=false，不发明来源 |
| `CI-API-024` | 4 | store/head-company owner 正例、scope 越界、无写 capability 四种判断 |
| `CI-API-025` | 3 | HQ+brand、store+brand 标签正例；project-scope 标签 typed failure |
| `CI-API-026` | 5 | 拿铁、双人套餐、凯撒沙拉、物料图、称重占位逐图 readback/count |

精确 case vector 为：
`[1,7,1,1,9,10,1,3,2,1,6,4,3,6,2,2,2,18,2,2,2,2,1,4,3,5]`，总和 100。

#### L2 scenario definitions（18 / 43 cases）

| ID | cases | 浏览器唯一责任（P1 不含 locator） |
|---|---:|---|
| `CI-L2-001` | 6 | 三页导航、四类/两类角色与 store/head-company 数据节点组合 |
| `CI-L2-002` | 1 | 先选树节点再域内搜索；切节点保留 keyword 且旧响应不覆盖 |
| `CI-L2-003` | 1 | view toggle 最左、品牌切换紧邻；切换状态与结果域正确 |
| `CI-L2-004` | 1 | 名称+弱化编码、价格/SKU/库存风险复合单元格与 compact table |
| `CI-L2-005` | 4 | 来源事实×写 capability 真值表；任一 false 时复制入口不在 DOM |
| `CI-L2-006` | 2 | 同 Drawer 查看→编辑上下文；dirty 关闭、失败保留与焦点归还 |
| `CI-L2-007` | 7 | 七形态 tabs/create state；BENEFIT_SHELL 可见置灰并显示“权益域尚未开放” |
| `CI-L2-008` | 2 | catalog quickManage 与 production-tag quickManage 分 owner 且创建后选中 |
| `CI-L2-009` | 2 | auto-sync deniedFields 真锁定；temporary promotion 补全/校验而非直接改态 |
| `CI-L2-010` | 2 | 生命周期动作矩阵；本库五步复制不与品牌复制混用 |
| `CI-L2-011` | 2 | 多图排序/主图/失败重试；引用保护与删除最后一图为空 |
| `CI-L2-012` | 2 | 库存筛选/五状态/需处理；三周期变化与最近变化独立显示 |
| `CI-L2-013` | 2 | 六区按需加载；无诊断权限时整区和 HTTP request 都不存在 |
| `CI-L2-014` | 2 | 四动作输入/预览/失败保留；统一结果面与关闭后焦点归还 |
| `CI-L2-015` | 2 | preflight 五页签/阻断；STALE 返回预检并只保留安全选择 |
| `CI-L2-016` | 2 | query generation、分页/筛选/滚动位置在刷新和错误恢复后保持 |
| `CI-L2-017` | 2 | keyboard/overlay lock/error focus；有条件阻断显示具体原因 |
| `CI-L2-018` | 1 | 菜单/渠道、套餐引用列、导入导出、独立库存创建等 Out 项全不渲染 |

case vector 为：`[6,1,1,1,4,2,7,2,2,2,2,2,2,2,2,2,2,1]`，总和 43。
P1 只保存 IA-ID、业务动作和预期业务结果，schema 明确禁止 `locator/testId/css/xpath` 字段。
P3 才生成独立 locator binding catalog 并 exact-match 43 cases。

### 3.8 18 条差异与 fixture/red 对账

`D-01,D-02,D-03,D-04,D-05,D-06,D-07,D-08,D-09,D-10,D-11,D-12,D-13,D-13b,D-13c,D-14,D-15,D-16`
是精确分母。每条必须有 source binding、positive fixture 或 `NOT_APPLICABLE`、以及真实 red mutation。
重点 red：项目级 production tag、总公司 balance/ledger、缺 brandRef、SalesStockView、
  PreparationProfile entity、InventoryAuthorityConfig/EXTERNAL、CatalogAttributeDefinition、共享 OptionGroup、
  独立 StockTarget create、销售消耗趋势、MQ/outbox、缺 shapeKey、可写 capability/删 PRODUCIBLE、
  缺 code/范围重码、两类旧 relation、四个 plan command、同码 SKU 属性组合漂移未阻断均必须失败。

### 3.9 P1 exit

P1 只有同时满足以下条件才完成：

- policy 例外设计已先落具名 entry，随后 contract/fixture 实施才开始；
+ 43 operations、components、shards、root OpenAPI、route registry、Java wire、TS client exact-set；
+ 43 行 backend operation design contract 的逻辑步骤、problem mapping、owner call chain 与正常 DB 分解
  机械 exact-set；缺失、顺序漂移、owner 漂移、problem 漂移或分解求和漂移均有真实 red；
- Java/TS shape manifest revision/digest/count/语义字节一致；七形态、四 capability、0 PRODUCIBLE 派生、
  四 modeRules、shape admission、HAS_SKU 判据全有真实 red；
- 六区读模型、preflight closure/version/mapping/rewrite/digest 任一删除都会 red；
- canonical fixture schema/catalog 通过；seed/test 互斥、26/100 API 与 18/43 L2 分母可复算；
- requirements→IA→assertion→scenario 与 18 differences 全部 exact-set、零 orphan、零 PENDING；
- assertion 的 `verifiedBusinessBehavior` 已由人工按“最高绑定数五项 + 每 IU 一项 + 复制/库存动作全项”
  抽样对读，未用通用成功场景冒充多项业务证明；该项是 review evidence，不是关键词门；
- L2 scenario 不含 locator；P2/P3 consumer 都绑定同一 canonical path/revision；
- copy policy 是 selected/closure 数值唯一声明点；生产源码、fixture、UI 文案和 OpenAPI/generated 中
  `20/500` limit 字面量出现次数均为 0，当前 limit 与 `limit+1` 场景从 policy 参数化生成；
- generated Java 编译、operations-admin generated consumer typecheck；
- `r5-edge-materialize/openapi-contracts/edge-codegen/contract-face/module-dependency-registry/code-layout`
  及新 manifest/fixture/scenario checker 与各自 self-test/red mutation PASS；
- `scripts/check/standards-coverage --phase RM1-P6-3` PASS。

P1 不以 HTTP、数据库、seed 实跑或浏览器 PASS 为 exit；这些也不能弥补契约/分母缺口。

## 4. 第二阶段 `CI-P2-BACKEND-API`

### 4.1 物理模块与依赖方向

```text
modules/catalog                    schema catalog
modules/inventory                  schema inventory
modules/fulfillment-production     schema fulfillment_production
app/application/cataloginventory   无 schema/repository 的跨 owner 协调器
app/edge/operations/catalog
app/edge/operations/inventory
app/edge/operations/production
```

`catalog` 拥有 12 个 catalog 实体、typed JSON 与引用瘦边；`inventory` 拥有 StockTarget、Balance、
Ledger、BOM/BOM line 与四张 interface-reserved 表；fulfillment-production 本期只拥有
ProductionTagDefinition，不借机建设生产 runtime。协调器只 import owner `.api`，不持有资产，controller
只做 wire mapping。catalog/inventory 不得双向模块依赖。

organization 提供窄 typed judgment：store scope、head-company+brand scope、唯一 copy source；
workspace-IAM 在事务首批读形成 immutable trusted execution context。owner 不重查 IAM，但必须复核
对象范围、来源、状态、版本与 authorization revision。

### 4.2 schema/migration

一个新的顺序 migration 原子创建三 owner schema 下本期表/索引/唯一约束/FK，仍进入单一 Flyway history。
跨 schema FK 只按 module dependency registry 明示；禁止依赖 migration 顺序进行跨 owner DML。
四张 deduction/restore 表存在但无 create/execute runtime API。D-04/D-06/D-07/D-08 与 SKU 双真相通过
有限表名/列名/实体分母和真实 red 守住。

### 4.3 写事务

`saveOperationsCatalogItem`：同一 `REQUIRED` 内 catalog 复核/写 catalog，inventory 复核并写
StockTarget/BOM，各 owner 写自己的 audit；任一步失败全部回滚；返回 owner typed readback，事务内不做
为了展示的跨 schema join。

`executeOperationsBrandCatalogCopy`：三个 owner 各自重建判断切片，协调器合并并重算 plan/digest；
version/digest 漂移在任何写前返回 `STALE_COPY_PREFLIGHT`；依次创建/复用 production tags、catalog
字典/商品/SKU、inventory StockTarget/BOM，逐对象重写 refs；三个 owner 各自断言目标图无 head-company ref；
全部 command 为 `REQUIRED`，禁止 `REQUIRES_NEW`、listener/MQ/outbox。

### 4.4 查询与性能

catalog workbench/detail/preflight 位于 catalog task query，inventory workbench/六区位于 inventory query；
不建全局 BFF/query 模块。批准 task-read join 只取展示事实，owner judgment 由 owner pure API 对已载入事实
批量给出。列表/闭包/版本向量/引用反查都用 set-based query 或批量 API；请求日志记录 operationId、
route template、correlation、database operation count/duration，不记 raw payload、名称、编码或 token。

### 4.5 复用 P1 fixture 与 API 验收

P2 loader 读取 P1 canonical catalog 实际 SHA，只用 owner commands 构造 seed/test graph；无正常命令
可达时才允许具名 terminal fixture，并保持窄 allowlist。两个 limit 从 copy policy 动态取值；STALE 用真实
owner mutation；每个场景 cleanup 独立登记。

26/100 API 全量执行，尤其编码作废重建、闭包、两个上限、九类兼容、单位阻断、全图重写、TOCTOU、幂等、原子性、
owner 与权限全部在本阶段逻辑闭环。P3 不再承担这些逻辑的正确性证明。

### 4.6 P2 exit

- P1 contract/fixture SHA 与 revision 原样消费，无本阶段新增字段/场景；发现缺口必须退回重开 P1。
- 模块 owner、COMMAND/TASK_READ/SCHEMA_FK registry 与实际依赖 exact-set；无跨 schema DML。
+ migration、owner repository/service/api、协调器、edge mapper/controller 全部对齐 43 operations。
- transaction rollback、idempotency replay/mismatch/result-unknown、version conflict 有真实 red。
+ 43 个 operation 的正常 fixture 实测 `databaseOperationCount` 与逐 operation 设计值精确相等；任何漂移有具名 disposition，不能当性能预算放宽。
- 26 definitions / 100 cases 全绿；每个 expected error 是 typed problem，不以 500/日志文本代替。
- 复制全部逻辑在 API stage 关闭；目标图 head-company ref 泄漏、漏映射、截断闭包 mutation 均红。
- 代表 seed 图经 owner command 创建和 readback count 验证；不执行 DEV seed。
- focused logs 可关联且脱敏；静态、compile、module、migration、API tests 与 red mutations PASS。
- 本阶段 business evidence 为 API 结果；若使用受管测试数据库，cleanup evidence 单独 PASS。

## 5. 第三阶段 `CI-P3-FRONTEND-L2`

### 5.1 实现面

operations-admin 新增三个 feature surface：门店商品管理、门店库存管理、品牌商品管理；对接 generated
client 与 foundation，禁止手拼 route/enum、复制 Drawer 生命周期、overlay lock、列表 context、日志或
automation primitive。CRUD policy 的两个互斥 surface 分母和反例由 P1 单一写入；P3 只能只读核验其
已冻结 entry 与真实页面一致，再注册 admin catalog 节点，不得二次修改同一 policy。

App-local 只保留本域语义组件：三段树、品牌切换、manifest-driven tabs/fields、SKU matrix、
点单选项、套餐、gallery、production-tag quickManage、StockTarget/BOM tree、copy preflight、库存六区。
两列详情布局若 foundation 不足，先扩 foundation 并做双向 focused proof，不得在 app 内另造 wrapper。

### 5.2 locator 绑定

P3 新增 locator binding catalog，把 P1 的 18/43 业务 cases 绑定到真实 `data-testid`/role/name；
binding 的 scenario IDs 与 P1 exact-set，零多、零少。testId 只用于 IA 已批准的歧义/自动化 surface，
不能为了测试把隐藏元素渲染到 DOM。

### 5.3 L2 责任

L2 只验浏览器才能证明的事实：

- 三页角色/数据节点、门店节点内搜索、品牌全局切换、树表/表格全局切换；
- 名称+弱化编码、紧凑 ProTable、复合单元格、局部筛选与分页状态；
- 无 headCompanyRef 与无写 capability 两条件各自隐藏“从品牌复制”，任一不满足均不渲染；
- 同 Drawer 查看/编辑、全部页签、dirty close、overlay lock、error focus、焦点归还；
- quickManage 创建并选中、图片多状态、自动同步字段 ownership、临时商品转正预检；
- 库存列表、四动作、统一结果面、六区详情；无诊断权限时第六区整块不渲染且不发请求；
- 品牌复制完整差异预检、阻断/确认、STALE 后回预检且保留可安全保留的选择；
- Out 项（菜单/渠道、套餐引用列、导入导出、独立库存对象创建等）不渲染。

闭包计算、兼容判断、引用重写、事务与幂等只引用 P2 API evidence，不在 L2 重复穷举。

### 5.4 P3 exit

- 对照 v4 live 对批准保留/改造/不搬逐项 fresh 交互证明，不以旧截图替代。
- 18 definitions / 43 cases 全绿，locator binding exact-set；89 IA-ID 每条有最终实现与 evidence，零 orphan。
- foundation reuse、App-local exception、generated client、admin catalog、policy surface 对账 PASS。
- 当前受管 L2 只在本机 app/browser，经 tunnel 用隔离远端中间件；run-scoped manifest、日志、PID identity、
  fixture catalog SHA、business 与 cleanup 分账齐全。
- `business=PASS` 且 `cleanup=PASS` 才完成；浏览器通过但本机进程、隧道、远端数据库/资产残留均不得完成。
- 失败保留 first failure/last known good/broken boundary；不得靠延长 timeout 或盲重试。

## 6. 六类 package-exit source 分母

每个阶段都必须声明并对账以下六类，不适用要有具体反例理由，不能空缺或 `PENDING`：

| 类别 | P1 | P2 | P3 |
|---|---|---|---|
| `USER_TASK_JOURNEY_IA` | 需求、89 IA-ID、18 differences、C-16/C-17/C-19 已裁终态 | P1 scenario/fixture 绑定 | 89 IA-ID/43 L2 cases |
| `OWNER_CONTRACT_GENERATED` | manifest/OpenAPI/generated exact-set | owner API/edge/DB 对齐 | generated TS 消费与无手拼 |
| `RUNTIME_RUNNER` | N/A：无动态执行，给出反例边界 | 受管测试 loader/runner | 本机 app/browser+tunnel L2 runner |
| `FOCUSED_PROOF` | static/count/hash/red mutation | compile/API/red mutation | component/foundation/locator/L2 |
| `BUSINESS_EVIDENCE` | N/A：只定义，不冒充业务闭环 | 26/100 API report | 18/43 L2 report + 89 IA 对账 |
| `CLEANUP_EVIDENCE` | N/A：无动态资源 | 动态测试用到资源才必须 PASS | 必须独立 PASS |

实际实施时每个阶段所有变更文件均须有 pre/post compliance receipt；非空 receipt set、change set 与
package exit set equality。单项 gate、mapping 或某一层 PASS 不等于阶段 exit。

## 7. 已裁决产品语义与不允许静默假设

| 决策 | 影响面 | 已裁终态 | 强制验证 |
|---|---|---|---|
| `C-16` 权益商品壳 UI | tree/createAllowed/disabled reason/L2 | 左树恒列 0；新建可见但 disabled，原因“权益域尚未开放”；七形态/itemKind 不变 | P1 静态枚举和 reason；P3 可见置灰正例与隐藏 mutation red |
| `C-17` 编码不可修改 | update schema、唯一校验、作废重建、复制稳定性 | create 必填且即时校验；update 无 code；零引用可整体作废重建 | P1 request closed shape；P2 owner 拒改码；P3 编辑态无改码控件 |
| `C-19` canonical tuple | copy identity、digest、unique、mapping、fixture | 普通 `(type,code)`；属性值/SKU/BOM 叠父级；StockTarget `(targetType,itemCode,skuCode?)` 且无自身 code | UI/owner/DB/digest/preflight exact tuple equality |
| 两个 copy limit | 单一 policy、owner 校验、server readback、UI 提示、参数化 fixture | selected=20，closure=500；已由 Dexter 确认 | P1 保证除 policy 外零数值副本，后续改一处自动跟随 |
| 商品 SKU 结构指纹 | 复制 compatibility 的“商品”结构判别位 | 已由 Dexter 授权回写最终需求 §5.6.6，并登记为 `D-16` | requirements/IA/assertion/fixture/digest 使用同一排序算法 |

兼容矩阵中三类“无结构判别位”不是产品决策缺口，而是明确 `NOT_APPLICABLE`；禁止把它们改成
人为结构阻断。若 Dexter 仍要求九类各有真正结构阻断，必须先改变需求兼容矩阵，不能由测试倒逼业务语义。

## 8. 执行顺序与回退纪律

1. P1 第一项登记 CRUD policy 设计例外；`C-16/C-17/C-19` 与两个 copy limit 直接按已裁终态实现。
2. 同一 P1 内先规范 manifest/edge catalog，再生成 OpenAPI/Java/TS，最后写 fixture/scenario；
   读模型先于后端和 UI。
3. P1 exit 后才进入 P2；P2 若发现字段/fixture 缺口，显式重开 P1，不在后台私加 DTO。
4. P2 先 owner/schema，再 query/command/coordinator/edge，最终一次性跑 26/100 API。
5. P2 exit 后才进入 P3；P3 绑定 locators、实现三页，最终一次性跑 18/43 L2。
6. 任一动态运行首败立即保存并读日志；同 signal 第二次前完成边界诊断；business/cleanup 分开。

三阶段每阶段都是一次性实施与一次性交付。阶段内部可以按依赖并行，但 contract/source、共享 schema、
生成链、migration、canonical fixture 与同一 feature 文件属于共享写关键区，必须单 owner 串行合并；
并行不降低逐点双读、独立对抗审查或 package-exit 证据要求。

## 9. 设计完成判据

本文可进入 Claude review 的条件是：四项 P1 产物均有明确 source/consumer/exit；43 operations 与全部
读模型可定位；seed/test 数据严格分层；26/100、18/43 分母可复算；89 IA-ID、18 differences、8 IU
与三阶段均有明确归属；复制在 P2 逻辑闭环、P3 只验交互；三项 Dexter 裁决已完整吸收且无残留分支；三个阶段的
business/cleanup 结论没有互相借用。

## 10. 实施前 Dexter 确认清单

1. 接受保留 `IU-01..08` 纵轴，并以 P1/P2/P3 横轴做多对多 exact-set，不重新编号 IA；
2. 确认 P1 operation 分母 42，尤其 operations asset stage/release 与独立 diagnostics operation；
3. 确认本文对既有裁决的转录无误：C-16 左树零计数+新建可见置灰；C-17 code 不可改+零引用作废重建；C-19 StockTarget 不另设编码；
4. 接受 compatibility 三个无结构位按 `NOT_APPLICABLE_NO_STRUCTURAL_BITS` 证明，而非伪造阻断；
5. 确认 P1 场景分母 `26/100 API + 18/43 L2`，P1 不写 locator，P3 才绑定；
6. 确认一个 canonical fixture catalog 同时分隔 seed/test，两阶段记录同一实际 SHA；
7. 确认 P2 完整关闭复制逻辑，P3 不重复用浏览器穷举算法。
