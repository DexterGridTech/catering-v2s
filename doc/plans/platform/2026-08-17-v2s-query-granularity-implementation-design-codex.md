# 查询粒度与重复读取整改：implementation-facing 详设

`SKILL_USED=cs-writing-plans@2026-08-17`

## 0. 结论、授权与证据边界

### 0.1 目标

在不改变 Catalog、Inventory、Production-tag、Asset、Organization、Workspace 的事实 owner、命令语义、CAS、幂等、审计、授权复核或 readback 的前提下，让一个用户任务只读取其稳定事实闭包；已经可由一个读取得到的事实不得在同一任务内再次读取；集合读取不得随着当前选择数退化为逐项 owner 查询。

本详设解决的是已定位的 15 个生产源码成员，而不是把“减少数据库查询”写成全仓 KPI。每个变更的验收都以该 operation 的读取形状、保留的正确性条件和 focused proof 为准。

### 0.2 本轮授权

本文件最初定义了 implementation batch 和证据；Dexter 后续已授权 QG-01 至 QG-15 一次性实施，覆盖生产代码、契约、生成物、focused tests 与受管 backend-acceptance/Testcontainers 场景，不覆盖迁移、新数据模型、reset、seed、DEV、浏览器 L2 或 UAT。QG-12 的执行决策权已明确归 Codex：在现有数据模型内完成数据库侧过滤与受管 `EXPLAIN`，不再挂起等待 Dexter 决策。

本批每个 CP 均先执行 RECALL；实现形态由实施者在不变量和 FORBID 内自主选择，并登记“选 X 而非 Y，因为 Z”。

### 0.3 历史 NO-GO 与当前详设的关系

旧的只读发现曾收到两轮 `NO-GO`。它们否定的是旧报告尚未收敛为可执行、可验证且不越权的设计，不是断言当前用户旅程已不可用。该报告最终的业务 `GO` 仅表示：在当前已知门店规模和无动态 HTTP 证据时，候选问题不是立即的产品阻断。

本详设不以这个业务 `GO` 取代设计审查：它把问题拆成 owner-local、契约型、数据模型待裁和运行时待证四类，并将每项失败条件写成可反驳不变量。设计期盲审若否定任一项，应先修改本详设，不得以“业务暂不阻断”跳过设计缺口。

### 0.4 动态验证的前置声明

静态阅读可以证明调用图、数据形状和静态重复候选；它不能证明某次 mutation 实际发出几次 HTTP、RTK 是否在特定订阅状态下去重、或 SQL 在真实数据规模下的计划。尤其是 RTK tag 成效与 BOM/reference 查询计划，必须在以后获得独立受管动态授权后，按 operation 运行真实 HTTP/前端观测及必要的 `EXPLAIN`。

因此任何 Batch 完成前只能称为“编译/静态/focused proof PASS”；不得称 HTTP、DEV、seed、L2 或 UAT PASS。

### 0.5 历史单次读固定开销的显式 disposition（本轮不做）

`InventoryOwnerService.currentTyped` 在 QG-11 收口后的静态形状是：一条 target row 读取、三次分别计算 `TODAY` / `7D` / `30D` 的 period read，以及 recent（`LIMIT 20`）；reference 与 ledger 已从 current response 移到各自的懒加载 endpoint。这个事实仍然说明 QG-04 只消除了前端在已有 `changeSummary` 后再请求三个 summary endpoint；它**不**合并 owner 内三次 period read，也不应被表述为“已降低单次详情的固定 SQL 开销”。静态源码更不能证明这些 helper 的当前实际 SQL/连接/事务次数或逐条必要性。

**DISPOSITION=本轮不做，非 `QUERY_ALREADY_MINIMAL`。** 2026-08-13 的 catalog 六条 historical PERF finding 已要求其各自以 `QUERY_REDUCED_TO_<n>` 或 `QUERY_ALREADY_MINIMAL` 记录，并明确 DBCR 保持 `TERMINATED_BY_DEXTER_SCOPE_REFRAME`、不得重启该 package 或扩到其余 HTTP/non-route finding。已检索该裁定及后续批次材料，未发现另一个获批 batch 已处置 `InventoryOwnerService.currentTyped` 的固定读取开销。因此本详设不把历史 catalog 路由的计数嫁接到 inventory current，也不在本 15 CP 中暗中重启共享读管线整改。

后续若 Dexter 另行批准该 owner 的 query/次处置，必须先以该 operation 的 fresh 受管观测建立实际 baseline，再选择 `QUERY_REDUCED_TO_<n>`（写明合并方式与 owning source）或 `QUERY_ALREADY_MINIMAL`（逐条业务必要性）。在此之前，`DB_OPERATIONS` 继续只作诊断信息，不能成为通过条件、性能基线或“本项已关闭”的证据。

本段失败条件：“任何实施或验收把 QG-04/QG-11 表述为已经关闭 `currentTyped` 的固定 QUERY 开销，或在没有独立授权与 fresh operation evidence 时把本段改写为 `QUERY_ALREADY_MINIMAL`。”

### 0.6 设计输入与仲裁顺序

1. `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、当前 Roadmap 与 `doc/platform/agent-operating-model.md`；
2. owner、事务、跨 schema、生成契约的仓内源码与编译器；
3. `project-memory/decisions/http-crud-efficiency-design-redlines.md`、业务语料 `G-11` / `G-12`；
4. 本文件引用的原始只读发现：`doc/review/platform/2026-08-17-v2s-query-granularity-and-duplicate-read-remediation-codex.md`。

上游审查数字和本文数字都是待验证输入，源码优先。BOM 反向关系物化、用户可见新关系、原子/部分成功的产品语义、批次扩缩与任何不可逆动作，只能由 Dexter 裁决。

## 1. 已确认的有限分母

### 1.1 五个问题族、十五个整改 CP

| 族                    | 成员（当前 owning source）                                                                                                                                                                                                                                                                                 | 当前事实                                                                                                                              | 处理批次     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 保存链的无关读取      | `CatalogInventoryCoordinator.saveCatalogItem`、`coordinateSaveInventory`、`catalogItemAssetRefs`、`settleWorkspaceCatalogAssets`                                                                                                                                                                           | 保存链先读取 Inventory/asset 辅助事实；空 child/空 asset 的调用仍可能进入宽读取路径                                                   | QG-B1        |
| 批量编辑与库存详情    | `CatalogWorkbenchPage.runBatchAction`、`InventoryDetailDrawer`、`InventoryOwnerService.current`                                                                                                                                                                                                            | 分类/标签批改为每项“详情 GET → 保存”；current 已含 change summary 而抽屉又取三个 summary；QG-11 已将 reference/ledger 改为懒加载 zone | QG-B1、QG-B3 |
| owner 内集合/闭包读取 | `CatalogInventoryCoordinator.enrichInventoryTargets`、`CatalogOwnerService.readItems`、`CatalogOwnerService.targetScopeVersion`、`CatalogOwnerService.copyPreflight`、`InventoryOwnerService.preflightCopyCore`、`ProductionTagOwnerService.preflightCopyCore`、`CatalogOwnerService.skuInboundReferences` | 库存列表是一次 page-ref 集合读取，不是逐行调用；但其 owner payload 过宽，copy/preflight 与 SKU inbound 有逐项风险                     | QG-B2        |
| 重复/候选页读取       | `OperationsStoreManagementController.detail/store`、`PlatformWorkspaceService.initializeCommercialGroup`、`CatalogOwnerService.productionTagDetails`、`CatalogInventoryCoordinator.enrichInventory`                                                                                                        | 同一 store detail 两读；workspace UUID 可同一投影取得；production tag detail 以候选页再过滤且 coordinator 又读一次                    | QG-B1、QG-B2 |
| SQL 投影与 RTK 刷新面 | `OrganizationOverviewTaskReadService.platformOverviewTaskPage/platformHierarchyBaseDetail/platformBusinessEntityBaseDetail/platformStoreBaseDetail`、catalog-inventory generator                                                                                                                           | 5 个 CTE wildcard projection；catalog-inventory generated output 的 43 个 operations 共享 `wire/LIST`                                 | QG-B1、QG-B4 |

本详设的分母是 §3 的 **15 个整改 CP**，不是表中出现的 Java/TS/generator helper 名称数量：一个 CP 常穿过 coordinator、owner、consumer 与测试多个 source locus，且 `InventoryOwnerService.current` 同时参与 QG-04 与 QG-11。它不等于“所有接口”或“所有查询”。新增同根成员必须重新设计并获得对应 batch 授权，不能悄然并入。

### 1.2 可复测的静态数字与口径

| 声称                          | 当前静态口径                                                                                                                                                                                                                                                                           | 不能推出的结论                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 生成 RTK endpoints            | 四个输出合计 135 个 `build.query`、135 个 `build.mutation`：platform 21/29，operations 43/49，catalog-inventory 16/27，public 3/9；本详设仅改后者 43 个 operation                                                                                                                      | 不能推出一次 mutation 实际重发 62 或 135 个 HTTP                                                                                 |
| 共同 tag                      | 两个生成器的每个 GET 都 `providesTags`、每个非 GET 都 `invalidatesTags` 为同一 `{operationId, LIST}` 对                                                                                                                                                                                | 不等于所有非 GET 都改变业务事实，或所有 query 同时订阅                                                                           |
| 显式刷新                      | 原始发现阶段静态基线为 `.refetch()` 55 处、13 个生产文件；本轮当前源码扫描（`apps/frontend`、排除 generated、匹配 `.refetch()`）为 33 处、13 个文件，其中 Catalog/Inventory 片区为 21 处                                                                                               | 两个数字都不是 HTTP 次数；调用包含 retry、reload、失败分支和仍需身份读取的窄 refetch，不能据此声称 mutation-success 重复请求数量 |
| CTE wildcard                  | **5 个 wildcard projection**：`platformOverviewTaskPage` 的 `item.*`、`SELECT * FROM filtered`，以及 `platformHierarchyBaseDetail`、`platformBusinessEntityBaseDetail`、`platformStoreBaseDetail` 各一个 `target.*`/`SELECT * FROM target`；零个直接 `FROM <base-table>` 的 `SELECT *` | 它们不是额外 round-trip，不能声称有特定性能提升                                                                                  |
| production tag 的当前业务规模 | Dexter 于 2026-08-17 提供的非绑定运营观察：单门店商品处理标签预计不超过 20 个                                                                                                                                                                                                          | 不能据此把候选页存在性/详情读取当作永久正确形态；规模变化需重开任务/read-budget 审视                                             |

### 1.3 明确排除与待裁

| 项                                    | 状态              | 理由                                                                                               |
| ------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| 执行 copy 时省略 live preflight       | 排除              | 外部 preflight 与 execute-time live facts/digest 重算职责不同；必须继续拒绝 `STALE_COPY_PREFLIGHT` |
| 生产标签建立或物化 tag ↔ BOM 反向事实 | `DEXTER_DECISION` | 这是数据模型和用户任务的新关系，不可从查询优化推导                                                 |
| 商品处理标签列表的常规小规模优化      | 排除              | 门店上限约 20，未见当前业务影响；不为它增加接口                                                    |
| copy no-op execute 跳过               | 延后              | 仍需核实 receipt、digest、readback 与审计语义；不能把 preflight 可判断误作 execute 可跳过          |
| RTK request-key 订阅复用              | 延后              | 静态未证明相同 request 的运行时订阅/缓存时序；需要动态观测                                         |
| 后端到脚本的 JSON 形状                | 不在本整改对      | 是另一条跨界对，不得以本前端读模型整改偷换范围                                                     |

## 2. 批次、依赖和将做什么

### QG-B1：同任务去重与显式投影（无新 HTTP surface）

目标是先关闭同一请求内可证明的重复读取或 UI 已经拥有的重复数据。包含 QG-02 至 QG-07；QG-01 已在当前树合规、只保留其 disposition。它不删除 owner 校验、锁、grant、CAS、审计或分页；不新增 HTTP endpoint。

### QG-B2：owner-local set read 与 copy/preflight 闭包

目标是把已定位的 owner 内集合读取收口为按 refs/identities 的任务型 readback。包含 QG-08 至 QG-10。它维持 owner API、在同一 `REQUIRED` 事务内完成命令链，execute-time stale recheck 不得消失。

### QG-B3：需要契约/生成物的 inventory read-shape 收敛

目标是使 current/read zones 的返回形状与真实消费者一致。包含 QG-11、QG-12。任何最终删除 response 字段或新增 operation 都必须经过 OpenAPI → generated Java/TS → edge → consumer 的完整链，且先有 backend-acceptance 场景设计。最新批次授权已将 QG-11、QG-12 纳入本轮；QG-12 以现有数据模型内的数据库侧过滤和受管 EXPLAIN 收口，不新增反向关系模型。

### QG-B4：RTK 失效粒度与真实运行时证据

目标是以 operation 实际读取/写入事实建立可审计 tag 语义，并以真实受管观测验证“mutation → active subscription → explicit refresh”的请求集。包含 QG-13、QG-14。B4 的静态改造完成也不能声明其运行时成效；真实 HTTP/浏览器/RTK store 观测是单独授权依赖。

### QG-B5：明确列投影的低风险清理

QG-15 单独成批，以免为纯 SQL 形状清理阻塞业务读优化。它保留单 statement、snapshot、total、filter/security predicates；不承诺性能收益。

## 3. CP 详设

### QG-01 — 保存链 Inventory child guard（已合规，零代码动作）

RECALL 进入前重开：`doc/review/platform/2026-08-17-v2s-query-granularity-and-duplicate-read-remediation-codex.md` §3.3；`project-memory/decisions/http-crud-efficiency-design-redlines.md`；`project-memory/operations/business-corpus-adoption-and-read-policy.md`（G-11、G-12）；`CatalogInventoryCoordinator.saveCatalogItem`、`coordinateSaveInventory`、`InventoryOwnerApi`。

本项失败条件：“`inventoryConfiguration.nodes` 与 `catalogDraft.inventoryBom` 都不是 array 时，保存仍进入 `catalogInventoryProjection` 或 Inventory owner 写路径”。

当前源码事实：`coordinateSaveInventory` 在上述两个 payload 面均不为 array 时已经直接 return，且 projection 位于 guard 之后。旧只读报告把历史风险当成当前缺陷；本 CP 不允许实施者为“完成计划”改动代码。

不变量：Catalog 保存仍先由 Catalog owner 处理事实；有 actionable child 时仍以 Catalog owner 返回的 opaque refs 调 Inventory owner；两个 owner 在原 `REQUIRED` 事务内；不存在/不合法 child 的 typed failure 与原错误顺序保持；空数组仍表达调用方明确提交的 child 集合，不可与字段缺失混同。

FORBID：不得让 Catalog 直接写 Inventory schema；不得在 edge 重建 Inventory 授权；不得删 CAS、inventory 命令、BOM 校验或 coordinator 事务。

验证：后续触及此保存链时，focused Java test 覆盖“字段缺失不调用 Inventory”与“明确 array 仍使用 owner readback”；本 CP 当前只保留源码 readback 记录。证据档位为静态源码。

### QG-02 — asset 结算只读取实际选择/替换所需的旧引用

RECALL 进入前重开：`doc/review/platform/2026-08-17-v2s-query-granularity-and-duplicate-read-remediation-codex.md` §3.4；`CatalogInventoryCoordinator.catalogItemAssetRefs`、`settleWorkspaceCatalogAssets`；`PlatformAssetService` 的 lock/bind-grant/release 路径；`CatalogAssetGlobalReferenceTest`。

本项失败条件：“asset 结算需要旧引用集合时仍读取完整 catalog detail，而不是仅 asset-ref 任务投影；或任何旧 asset 在仍被全局引用时被释放”。

不变量：asset owner 保有 lifecycle lock、grant 消费与 release 主权；Catalog 仅判断自身业务引用；旧 ref 被替换时仍检查全局引用；asset 变更 readback 不得被伪造；字段缺失、显式空集合和媒体修改的当前命令语义必须先由当前 request builder/owner merge 亲验后再决定是否可以跳过旧 ref read。

FORBID：不得把 asset 生命周期移动到 Catalog；不得把全局引用判断改为当前 item 判断；不得把字段缺失误作“无 asset 变更”；不得用空请求跳过需要的 release。

验证：保留/增加 unchanged、replace、shared-old-ref 三组 focused proof；`CatalogAssetGlobalReferenceTest` 通过。

### QG-03 — 分类/商品标签批量编辑复用列表事实与现有逐项保存语义

RECALL 进入前重开：`doc/review/platform/2026-08-17-v2s-query-granularity-and-duplicate-read-remediation-codex.md` §3.2；`CatalogWorkbenchPage.runBatchAction`；`catalogModel.ts` 保存请求构造；`CatalogOwnerService` partial `catalogDraft` 合并；`CatalogManagementPage.test.tsx`。

本项失败条件：“category/tag 批量编辑仍对每个已选 item 先请求详情，或丢失任一 item 的 version/CAS、部分成功反馈与刷新”。

不变量：维持当前逐项提交、逐项结果与部分成功语义；每项用列表已有 code/ref/version 构造只含 relation replacement 的既有保存命令；owner 未提交事实仍由 owner merge；成功后只刷新现有 UI 所需读模型。

FORBID：不得凭优化新建 HTTP batch command；不得把逐项操作擅自改为全有全无；不得将“替换当前关联”改变成增量 add/remove；不得忽略冲突版本。

验证：前端 focused test 覆盖 N 个选项不发 N 个 detail GET、请求 payload 只含目标关联与并发身份、一个失败不阻止其余既有逐项处理；类型检查与 Catalog focused tests。

### QG-04 — Inventory detail 复用 current 已有的 changeSummary

RECALL 进入前重开：`InventoryDetailDrawer` 的 six-zone loading；`getOperationsInventoryTarget` 的 response；`InventoryOwnerService.current`；`InventoryPageQueryContractTest`。

本项失败条件：“抽屉当前概览已获得 today/7d/30d summary 后，仍并行请求三个相同 summary endpoint，或失败/刷新时显示旧 scope 的 summary”。

不变量：current 的已契约 `changeSummary` 是概览唯一来源；references 与 ledger 继续使用其 cursor-paged 独立 endpoint；loading/failed/currentData 逻辑保持各 zone 互不误覆盖。

FORBID：不得把未分页 references/ledger 当作分页 zone 替代；不得删除任何 OpenAPI 字段；不得通过全局 reload 掩盖局部刷新。

验证：前端 query contract/focused test 断言打开 detail 仅保留 current + 实际展开 zones 的请求；scope/target 切换不显示前一 target summary。

### QG-05 — 同一 operations store GET 复用已授权的 detail

RECALL 进入前重开：`OperationsStoreManagementController.detail`、`scopedReadStore`、`store`、`OrganizationOverviewTaskReadService.detail`；G-05A。

本项失败条件：“同一个 GET 在相同 scope 下对同一 store 运行两次 organization detail read，或为去重绕过 scope/authorization/status 检查”。

不变量：原先的 scoped read/authorization 是唯一准入；mapper 使用同一已获得的 typed detail；响应状态与 contract-derived fields 不变。

FORBID：不得缓存跨 request/store 结果；不得取消 owner 读、权限检查或状态映射；不得新建通用 repository cache。

验证：focused controller/task-read test 断言一次请求仅经一次 owner detail，且 unauthorized / absent store 仍返回原问题类型。

### QG-06 — workspace 初始化从既有 group/workspace 投影取得 typed UUID

RECALL 进入前重开：`PlatformWorkspaceService.initializeCommercialGroup`、对应 repository detail projection、workspace command tests。

本项失败条件：“初始化在同一 owner 已读取 workspace row 后，再按同一 key/id 读取 workspace UUID，或 command 接收未验证 string”。

不变量：repository projection 提供 typed UUID；初始化命令仍使用 typed UUID；不存在/不匹配 group/workspace 的失败保持。

FORBID：不得以二次查询以外的 fallback 猜 UUID；不得改变 workspace 创建/初始化事务边界；不得扩 API surface。

验证：workspace focused unit/integration test 覆盖存在、缺失和 key/id 不匹配；编译通过。

### QG-07 — Catalog detail 的 production tag 读取按已知 refs 而非候选页

RECALL 进入前重开：`CatalogOwnerService.productionTagDetails`、`CatalogInventoryCoordinator.enrichInventory`、production `tagsByRefs/tagsByStrings`、Catalog detail consumer/tests。

本项失败条件：“详情/验证用 `LIMIT` 候选页再过滤，或 coordinator 为仅补 name 再进行第二次全量 tag read”。

不变量：Production owner 负责按 refs 的 typed readback；Catalog 只通过公开 owner API 使用该 readback；返回顺序/缺失/禁用的 typed validation 与详情展示不变；现有 detail 中 name 不被第二次读取重写。

FORBID：不得让 Catalog 读 production schema；不得将常规 `/production-tags` 列表当作存在性或 detail lookup；不得引入 tag→BOM 新关系。

验证：focused owner/coordinator tests 覆盖 refs 大于候选页、缺 ref、顺序、name 的单一来源；编译通过。

### QG-08 — Inventory page 使用 Catalog owner 的 display-facts set read

RECALL 进入前重开：`CatalogInventoryCoordinator.enrichInventoryTargets`、`CatalogOwnerApi.readItems` 的全部调用方、`CatalogOwnerService.readItems`、`InventoryManagementPage`、inventory target detail/reference enrichment；G-11/G-12；`http-crud-efficiency-design-redlines.md`。

本项失败条件：“一个 inventory page 的 itemRefs 已集合化但仍为展示字段加载完整 Catalog item facts，或把 Inventory 的库存事实移动到 Catalog”。

不变量：Inventory owner 先完成自身分页与 scope predicate；仅当前页 refs 一次进入一个**新增、非 HTTP 的 Catalog owner typed read** `readInventoryDisplayFacts(dataNodeRef, brandRef, orderedItemRefs)`；该 API 只由 `enrichInventoryTargets` 调用，返回按输入顺序的 `InventoryDisplayFact(itemRef,itemName,skuName,materialRole,categoryDisplayName)`，并以显式 absent result 保留当前无 Catalog item 的处理；泛用 `readItems` 的 JSON response、其 inventory detail/reference enrichment 调用方和 Catalog consumers 保持不变。

FORBID：不得收窄或改造泛用 `readItems`；不得逐行调用 owner；不得从 read edge 推导写权限；不得把 owner-private facts 扩至 display readback；不得新增 HTTP endpoint。

验证：focused coordinator/owner test 断言 page refs 单次 set read、display API 的输入顺序/absent 语义/payload 无 detail-only facts、泛用 `readItems` 调用方仍得到原投影、跨 scope 过滤仍由 Inventory owner 完成。

### QG-09 — copy/preflight closure 在各 owner 内 set-based，但 execute-time fresh check 保留

RECALL 进入前重开：四个 copy coordinator entry；`CatalogOwnerService.targetScopeVersion/copyPreflight`；`InventoryOwnerService.preflightCopyCore/targetRowsByIdentities`；`ProductionTagOwnerService.preflightCopyCore/tagsByRefs/tagsByStrings`；`STALE_COPY_PREFLIGHT` 相关 tests。

本项失败条件：“输入集合增加时 owner 内按元素 query，或优化后 execute 不再以 live facts/digest 拒绝 stale preflight”。

不变量：Catalog、Inventory、Production 各自在 owner 内做 refs/identities 集合查询并按输入顺序重建 typed closure；仍区分 active/VOIDED 的版本谓词；仍保留不存在、不唯一、遗漏、scope 不兼容和 stale 的原 typed failure/顺序；execute 仍重算。

FORBID：不得让 coordinator/edge 拼跨 schema SQL；不得缓存或复用外部 preflight 当 execute 的事实；不得删除 digest/readback/receipt/replay；不得把 copy no-op 自动跳过。

验证：每 owner 增加 input=0、1、N、duplicate/absent/voided/stale 的 focused proof；执行与 preflight 对应 fixture 的 business outcome 一致。受管 HTTP 性能证据另行授权。

### QG-10 — SKU inbound reference 检查集合化且保持阻断说明

RECALL 进入前重开：`CatalogOwnerService.skuRows/skuInboundReferences`、`InventoryCatalogReferenceDeclarations`、SKU transition/void tests、G-11/G-12。

本项失败条件：“一个 item 多 SKU 的作废/transition 逐 SKU 读取 inbound reference，或批量化后漏报任何 Catalog/Inventory blocker”。

不变量：每个 SKU 的 blocker 身份仍可归属到输入 SKU；Catalog composite 与 inventory stock_target/stock_bom 均保留；失败保持 typed、可读且不乐观放行。

FORBID：不得在前端猜 blocker；不得把 Inventory reference 事实搬入 Catalog；不得移除 lock/version check。

验证：focused test 覆盖多个 SKU、一个有 blocker、多个不同 blocker、无 blocker；查询 helper 接收集合但 error 仍精确到 SKU。

### QG-11 — current endpoint 的 response shape 与六个 UI zone 解耦

RECALL 进入前重开：`InventoryOwnerService.current`、`changeSummaryData/recentChanges/references/ledger`；`InventoryDetailDrawer` six zones；`catalog-inventory.openapi.json`；generated Java/TS；`InventoryPageQueryContractTest`；backend-acceptance standard。

本项失败条件：“current 为 UI 未消费的 references/ledger 读取未分页数据，或删/改 response 字段却未同步 OpenAPI、generated client、edge、所有消费者和 acceptance 场景”。

**范围与代价：`DEXTER_DECISION`。** 该 CP 不是局部 owner 重构：`InventoryTargetCurrentView` 当前同时服务 **2 个 operation response**（`getOperationsInventoryTarget` 与 `updateOperationsInventoryTargetConfiguration`），并有 **2 个直接 operations-admin UI consumer**（`InventoryDetailDrawer` 的 GET、`InventoryActionModal` 的配置更新 readback）。变更会联动 OpenAPI、generated Java、generated TypeScript/RTK、operations edge、这两个 consumer 以及 route/contract/acceptance 测试；至少五个契约面必须同一次 change 同步。收益也必须按源码如实拆开：`currentTyped` 的 ledger 预取上限为 100 行，recent 本身为 20 行且保留在 current；但 reference read 当前扫描同 scope `stock_bom` 后在应用层过滤，**没有** SQL `LIMIT`，不得把全部收益缩写成“最多 100 行”。是否以现在承担五层契约变更来停止这两类初始未展开 zone 的预取，是范围/批次取舍，只有 Dexter 可以裁定；本详设不代裁、也不把它伪装成已批准实现。

不变量：current 只承担 current/recent/changeSummary 的已定义任务；references 与 ledger 使用各自 cursor-paged endpoint；若 response 字段删改，契约、generated Java/TS、edge、frontend 和测试在同一 change 同步；所有 owner/scope predicates 不变。

FORBID：不得以空数组冒充仍完整的旧字段；不得将分页 zone 退化成 current 的摘要；不得在没有 acceptance 场景设计前改 HTTP response。

验证：仅在 Dexter 批准 QG-11 后，先写 scenario design（identity、fixture、request、business oracle），再做 OpenAPI generate/typecheck/owner focused test；未来受管 HTTP 覆盖 current + each expanded zone 的请求/响应边界。

### QG-12 — reference zone 只取当前 target 所需事实；BOM reverse relation受裁决限制

RECALL 进入前重开：`InventoryOwnerService.references`、`CatalogInventoryCoordinator` reference enrichment、库存 schema/JSONB predicate、G-12、`http-crud-efficiency-design-redlines.md`、所有 BOM decisions。

本项失败条件：“reference zone 为一个 target 读取全 scope BOM/reference，或为优化擅自物化/新增 tag↔BOM 反向关系”。

不变量：查询仅返回当前 target 的引用事实，保持 scope/security predicates、cursor/total、blocking display data；若现有 JSONB/SQL predicate 没有可接受计划，本 CP 停在证据阶段。

FORBID：不得为了索引或展示新建/物化 BOM reverse relation、表、FK、read model 或用户 surface；不得省略 `EXPLAIN`；不得将全量数据筛到应用层。

验证：未来受管 PostgreSQL fixture 下记录 query shape 与 `EXPLAIN`；若计划不可接受，产出 `DEXTER_DECISION`，不自行改数据模型。

实施状态（2026-08-18）：运行端点 `references` 使用 PostgreSQL JSONB predicate 与 cursor 分页，数据库先按 `data_node_ref`、`brand_ref` 定位；在展开 JSONB 前新增 `jsonb_path_exists` 预筛选，随后保留精确的 `targetRef/componentTargetRef` entry 谓词、排序、total 和 cursor 语义。旧的 `referenceReadbacks` 与 `referencesData` 宽读实现经同根扫描确认没有调用方，已删除，避免后续误用。代表性受管 PostgreSQL `EXPLAIN` 显示：`stock_bom` 仍通过既有 scope/brand 索引定位，`jsonb_path_exists` 作为 base-row Filter 先排除不含目标引用的 BOM 行，只有命中的行进入 `jsonb_array_elements` 的 `Function Scan`；因此没有把全 scope JSONB 展开或搬入应用层。该计划不是 target-selective JSONB 索引计划，但在“不改迁移、不新增数据模型/反向关系”的授权边界内已满足 QG-12 的可证伪不变量。本项状态为 `CONFIRMED`，并明确不宣称索引级性能基线或吞吐收益。证据：受管隔离/EXPLAIN Testcontainers 运行 `r5-tc-1786982039973-76517`，测试 `5` 项、失败 `0`、cleanup `PASS`；计划原文见该 run evidence 的 `test-results/.../TEST-com.catering.v2s.inventory.application.InventoryCatalogReferenceDependenciesIntegrationTest.xml`。

### QG-13 — Catalog-inventory 43 个 operation 的 RTK tag 映射由事实边界决定

RECALL 进入前重开：`scripts/generate/catalog-inventory-p3-frontend.mjs`、catalog-inventory OpenAPI 43-operation 闭集、`OperationsApi` 的 tagTypes、每个 operation 的 controller/owner mutation 事实、catalog/inventory consumers 的 refresh path；`http-crud-efficiency-design-redlines.md`。

本项失败条件：“catalog-inventory 的 16 个 GET 仍只共享单一 `wire/LIST`，或下表任一 provider/invalidation 映射缺失、伪造或使无关 catalog-inventory query 成为受影响对象”。

不变量：tag key 由 operation 的稳定业务事实/读模型边界导出，而非页面/组件名；同一事实链的 read/write 共享 tag；不改变 app/runtime 边界、HTTP 认证、操作路径、generated response type 或 route；非改变事实的 operation 不得虚假 invalidation；未列入下表的 platform/operations/public generated operations 保持当前 tag 行为，不被本 CP 偷带修改。

FORBID：不得以每个 endpoint 都有独立 tag 伪装精细化；不得引入全局 polling 或手写 app-specific generated patch；不得新增 route/HTTP surface；不得根据静态 tag 通过声称网络数已下降。

**闭集映射表（唯一 implementation input，43 个 operation）：**

| 稳定事实 key                                                   | GET provider                                                                                             | mutating invalidator                                                                                                                                                                                                                                               | 明确不 invalidates                                                                                                                                                                           |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog-workbench`                                            | `getOperationsCatalogWorkbenchContext`                                                                   | create/save/transition/batch-transition Catalog item；catalog category/dictionary mutations；execute local/brand copy；execute temporary promotion                                                                                                                 | 两个 copy preflight、stage/release asset                                                                                                                                                     |
| `catalog-navigation`                                           | `getOperationsCatalogNavigation`                                                                         | create/save/transition/batch-transition Catalog item；所有 category mutation；所有 dictionary mutation；execute local/brand copy；execute temporary promotion                                                                                                      | 两个 copy preflight、production tag mutation、stage/release asset                                                                                                                            |
| `catalog-item-page`                                            | `getOperationsCatalogItems`                                                                              | create/save/transition/batch-transition Catalog item；execute local/brand copy；execute temporary promotion                                                                                                                                                        | copy preflight、dictionary mutation、stage/release asset                                                                                                                                     |
| `catalog-item-code:{itemCode}` 与 `catalog-item-ref:{itemRef}` | `getOperationsCatalogItem` 同时提供：request path 的 code key 与 response `data.item.itemRef` 的 ref key | save/单 item transition/temporary promotion 以 request path 的 itemCode invalidates code key；batch status 以 request/result 的 itemRef invalidates ref key                                                                                                        | create、category/dictionary/production-tag mutation、copy preflight、asset stage/release；不得将 batch status 伪造为 itemCode key                                                            |
| `catalog-dictionary:{dictionaryKind}`                          | `getOperationsCatalogDictionary`                                                                         | create/update/reorder/transition dictionary entry（以 path/body dictionaryKind 定位）                                                                                                                                                                              | item/category/production-tag/copy/asset mutation                                                                                                                                             |
| `production-tag-page`                                          | `getOperationsProductionTags`                                                                            | create/update/transition production tag                                                                                                                                                                                                                            | 所有 Catalog/Inventory/asset/copy mutation                                                                                                                                                   |
| `production-tag-ref:{tagRef}`                                  | `getOperationsCatalogItem` 从 `data.productionTags[].tagRef` 提供                                        | create/update/transition production tag 以 command response `tagRef` 精确失效                                                                                                                                                                                      | 不改变生产标签引用的 mutation                                                                                                                                                                |
| `local-copy-candidates`                                        | `getOperationsLocalCatalogCopyCandidates`                                                                | create/save/transition/batch-transition Catalog item；execute local copy；execute temporary promotion                                                                                                                                                              | preflight local/brand、category/dictionary/production-tag/asset mutation                                                                                                                     |
| `brand-copy-candidates`                                        | `getOperationsBrandCatalogCopyCandidates`                                                                | create/save/transition/batch-transition Catalog item；execute brand copy；execute temporary promotion                                                                                                                                                              | preflight local/brand、category/dictionary/production-tag/asset mutation                                                                                                                     |
| `inventory-target-page`                                        | `getOperationsInventoryTargets`                                                                          | count/increase/adjust/update inventory target configuration；save Catalog item with inventory section；execute local/brand copy；**所有 catalog category create/update/move/delete**（category name 与 recursive category filter membership 是该 page 的真实事实） | copy preflight、asset stage/release、dictionary mutation、production-tag mutation；后二者当前不进入 target page display/filter facts                                                         |
| `inventory-target:{targetRef}`                                 | current, changeSummary, businessHistory, consumptionReferences, ledger, diagnostics                      | count/increase/adjust/update inventory target configuration（以 path targetRef 定位）；save Catalog item / execute copy 仅对 readback 中实际改变 targetRef invalidates                                                                                             | copy preflight、asset stage/release、无 target readback 的 catalog-only mutation                                                                                                             |
| `catalog-shape-manifest`                                       | `getOperationsCatalogShapeManifest`                                                                      | **无**；manifest 是已发布 shape definition，不由本 43-operation command 写                                                                                                                                                                                         | 所有 27 个 mutation                                                                                                                                                                          |
| none                                                           | 无 GET provider                                                                                          | 无                                                                                                                                                                                                                                                                 | `preflightOperationsLocalCatalogCopy`、`preflightOperationsBrandCatalogCopy`、`stageOperationsCatalogAsset`、`releaseOperationsCatalogStagedAsset`；它们的 command readback 由调用方局部消费 |

表中“所有”仅指 custom catalog-inventory generator 的 43-operation 闭集；其精确 operation 清单是该 generator 当前产生的 16 GET + 27 mutation。实施时 generator metadata 必须把每一 operation 显式归入上述一行；未归类 operation 使 generator check fail。`OperationsApi` 仅增加表中事实 key 所需 tag type，不改变其他 generated output。

字典粒度的当前边界：`CatalogDictionaryDrawer` 是唯一执行业务 dictionary mutation 的 UI 调用点；该界面同时只展示当前 kind 和一个选中 SKU 属性的属性值列表，未发现多个不同 `parentEntryRef` 的同 kind 子列表同时挂载。因此 `catalog-dictionary:{dictionaryKind}` 是当前实现的 kind 级稳定失效键，可能使非当前父项的已缓存订阅成为失效候选，但没有证据表明当前界面存在父项数据串漏。普通字典创建与 SKU 属性值创建仍各保留一条窄 `refetch`，因为当前 command readback 没有 `entryRef`；去掉它会失去新建后选中父项/子项的身份事实。是否在不扩大契约的情况下进一步消除该窄读取与 kind 级失效的运行时重叠，需要受管 HTTP/RTK 请求观测；本批没有将未验证的重复请求写成生产错误，也没有为了静态“更细”而破坏其它订阅者的一致性。

验证：每个映射类一个 generator red mutation（漏 provider、误加 preflight invalidation、跨 target invalidation、漏 item invalidation）；generated source assertions 覆盖 16 GET/27 mutation 均有且仅有表规定 tag；未来受管 HTTP/RTK store 观测选定 mutation 与 active subscriptions，记录实际 request-set、无关 query 不重取、相关 query 更新。动态观测未授权前不能关闭成效。另加一条同根保护：local/brand copy 的 `data.targetVersions[].targetRef` 必须生成 `catalog-item-ref`，不得生成 `inventory-target`；该约束有真实 red mutation `RED_COPY_ITEM_REFERENCE_TAG=PASS`。

### QG-14 — 显式刷新只保留不能由准确 tag/readback 表达的用户动作

RECALL 进入前重开：catalog-inventory consumer 中 `.refetch()` 的调用链（不是 55 处全仓清单）；具体 refresh callback 的调用者/失败分支；QG-13 映射表；frontend coding standard currentData/refresh rules。

本项失败条件：“catalog-inventory mutation 成功后的显式 refetch 与 QG-13 的准确 invalidation/readback 重叠且产生重复，或删掉 retry/manual reload/失败恢复所需的刷新”。

不变量：每个移除项有调用链理由；retry、用户手动 reload、scope change、失败恢复与独立 UI zone 的刷新保持；新的 mutation readback 优先在局部 state 使用而非全局刷新。

FORBID：不得以 `void refetch`/是否 await 作为成功刷新分类；不得批量删除 55 处全仓清单；不得把刷新信号当作没有消费者的通用修复。

验证：每个 catalog-inventory 候选以 focused UI test 列出 before/after query intent；最终由 QG-13 的动态 request-set 证明。没有动态授权时只保留静态 disposition，不宣称消除重复请求。

实施状态（2026-08-18）：已逐条处置成功回调与保留刷新路径。Catalog category、Catalog 批量分类/标签/状态成功后不再调用页面级 `refresh`，由 QG-13 的准确 invalidation 收口；Catalog item 保存、状态变更、SKU 作废、临时转正成功后不再对同一 detail query 额外 `refetch`，局部 SKU readback 继续用于本地状态。local/brand copy 的 `targetVersions[].targetRef` 经 Catalog owner 源码回读确认是 Catalog item ref，策略由错误的 `inventory-target` 修正为 `catalog-item-ref` 后，local copy 成功不再额外 refetch detail。生产标签 mutation 现在同时按 command response 的 `tagRef` 精确失效商品详情中的 `productionTags`，并按 page tag 收口列表；生产标签创建仍使用 command readback，不再重复拉列表。字典/属性名称更新、启停、作废由对应 dictionary-kind tag 收口；普通字典创建与新增 SKU 属性值仍保留各自一条因身份缺口必需的窄读取。库存 action 成功不再触发 detail 全 zones 与列表全量刷新；各 zone 的用户重试、current 重试、列表重试、ProTable reload、scope change 与失败恢复均保留。静态 proof 为 `scripts/test/frontend-transport-cache-lifecycle.test.mjs` 4/4、operations-admin unit 64/64、typecheck PASS、architecture focused 18 项（16 PASS、2 TODO、0 FAIL）。未宣称真实 HTTP 请求集合减少，因本批未获得浏览器/HTTP 动态观测授权。

### QG-15 — Organization task-read CTE 使用显式消费列

RECALL 进入前重开：`OrganizationOverviewTaskReadService.platformOverviewTaskPage/platformHierarchyBaseDetail/platformBusinessEntityBaseDetail/platformStoreBaseDetail`；其 SQL consumer mapping、snapshot/total/filter predicates、organization task-read tests。

本项失败条件：“5 个 CTE wildcard projection 中任一仍存在，或替换时遗漏结果映射实际读取的列、total、scope/security predicate”。

不变量：仅替换 5 个 CTE projection 为准确显式列；保留 single statement、MATERIALIZED/snapshot 行为、total、排序、filter options、授权谓词和 mapper contract；不是 round-trip 优化声明。

FORBID：不得改为多 statement；不得顺带改变查询/分页语义；不得把“零 direct base-table SELECT *”误称为本项改造成果。

验证：task-read focused test 覆盖 page/detail mapping、total、filter/scope；静态 SQL check 仅对这三处；编译通过。

## 4. 实施顺序与验证矩阵

1. QG-B1：QG-01 → QG-02 → QG-03 → QG-04 → QG-05 → QG-06 → QG-07；每项先确认它未改变接口/数据模型。
2. QG-B2：QG-08 → QG-09 → QG-10；QG-09 按 Catalog、Inventory、Production owner 分段 focused proof，不能跨 owner 混为一个 SQL patch。
3. QG-B3：QG-11 已获本批授权，按“先 acceptance scenario design、再 contract → generated → edge → consumer → tests”完成；QG-12 已在现有数据模型内完成数据库侧 JSONPath 预筛选、隔离测试与受管 `EXPLAIN`，不挂起、不新增迁移或反向关系模型。
4. QG-B4：先完成 operation-fact/tag 输入表和 generator red mutation，再处置 explicit refresh；最后单独申请动态观测。
5. QG-B5：QG-15 末尾单独提交，避免 SQL 格式变化干扰业务变更验证。

| 批次 | 静态/编译                                    | focused 业务 proof               | 未来动态证据                 |
| ---- | -------------------------------------------- | -------------------------------- | ---------------------------- |
| B1   | frontend typecheck、相关 module compile      | coordinator/owner/UI tests       | 不要求作为 B1 closure        |
| B2   | affected module compile                      | copy stale/voided/blocker cases  | 仅效率成效另行授权           |
| B3   | OpenAPI generate、Java/TS typecheck          | scenario design + contract tests | managed HTTP/必要 EXPLAIN    |
| B4   | generator red mutation、generated assertions | UI query-intent disposition      | managed RTK/HTTP request-set |
| B5   | compile/static SQL assertion                 | task-read tests                  | 不要求                       |

## 5. 设计期盲审要求

`REVIEW_CYCLE_ID=QUERY_GRANULARITY_IMPLEMENTATION_DESIGN_20260817`

在任何 implementation 授权前，必须完成 fresh 独立子 agent 的两阶段盲审：

1. 阶段一只阅读冻结输入、源码与 RECALL，不阅读本文件或旧作者整改报告；独立推导问题族、成员分母、批次与边界，并独立复测本文所有数字。
2. 阶段二才打开本文件，逐项攻击 scope、owner/transaction、契约、动态证据、BOM 决策与验证可证伪性；形成 verdict。

prompt 必须包含“禁止派生子 agent”、目标与判据、独立推导题、每个数字的独立复测、本轮攻击面、本机没有 `timeout`/按 shebang 选解释器/以 exit code 判红绿，以及“如果确实没问题就直说没问题”。最多两轮；第二轮标注 `ROUND_FINAL_DECISION=SELF_DECIDED`。Dexter 指定的额外审查不计入此上限。

作者对 verdict 逐条以 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE`、`DEXTER_DECISION` intake；产品/Journey、范围/批次、破坏性/不可逆事项才请求 Dexter。

## 6. 交付检查表

- [x] B1–B5 对象、分母、排除项与动态授权边界明确。
- [x] 每个 QG CP 有 RECALL、失败条件、不变量、FORBID 和相称验证。
- [x] 当前 5 个 CTE wildcard 的口径明确为 5 projections，并列出四个 task-read 方法；不再使用“3 个 CTE 中间 wildcard”。
- [x] RTK 135/135 与 55 refetch 仅作为静态分母，不外推运行时网络数。
- [x] `currentTyped` 的固定读取开销已按 §0.5 明确 disposition；本批不把 QG-04/QG-11 表述为该开销已闭合。
- [x] BOM reverse materialization 未采用；QG-12 以现有 `stock_bom.rows` 的数据库侧 JSONPath 预筛选与受管 `EXPLAIN` 收口，不新增迁移、数据模型、FK、read model 或用户 surface。
- [x] QG-11 的 response-shape 变更保留契约代价、consumer 影响与有界预取的 `DEXTER_DECISION` 记录，并已在最新授权下完成同步实施。
- [x] 设计期独立盲审完成，并对 verdict 做作者 intake。
- [x] 已实施代码、契约、生成物与 focused/受管证据；未执行迁移、reset、seed、DEV、浏览器 L2 或 UAT。

## 7. Testcontainers 验证设计（后续实施的完成条件）

所有触及后端行为的 CP 都必须同时具备：模块 focused proof（定位 owner/transaction/query-shape 回归）与真实 PostgreSQL Testcontainers 场景（验证 HTTP/owner 可见业务行为、隔离和 readback）。Testcontainers 通过的是 `scripts/test/backend-acceptance` 的受管远端 runner；不能用本地 Docker、裸 Gradle Testcontainers 或 `response.ok` 替代。新增或扩展的 scenario 必须在 `CatalogAcceptanceScenarios` 或 `OrganizationAcceptanceScenarios` 中具有非空 `identity`、`fixture`、`request`、`businessOracle`，并由目录发现；`CONTRACT` 与 `BUSINESS` 是独立结果，`DB_OPERATIONS` 仅诊断信息，不能当成 business oracle 或性能基线。

| CP          | Testcontainers 场景（归属）                                                    | identity / fixture / request                                                                                                    | BUSINESS oracle（完整业务断言）                                                                                              | 同族/反例                                                                                |
| ----------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| QG-02       | 新增或扩展 `catalog.save-asset-reference-lifecycle`（Catalog）                 | 有旧 image/SKU media 的 item、一个共享旧 asset、一个新绑定 asset；HTTP `saveOperationsCatalogItem` 分别提交保留、替换、移除媒体 | 保留不释放；替换只释放不再被引用的旧 ref；共享 ref 仍保留；readback 与最终 detail 的 asset refs 一致                         | 空/缺失媒体字段不得被误作删除；无效 bind grant、跨 scope asset 仍 typed failure/no write |
| QG-05       | 扩展 `org.store-state-and-derived-status`（Organization）                      | 同 scope 的可读 store 与无权/不存在 store；HTTP store detail GET                                                                | status、scope-derived fields、可读 store identity 与改前 contract 一致；无权/不存在仍原问题类型                              | 同一 request 的 `DB_OPERATIONS` 只作人工诊断，不作为通过条件                             |
| QG-06       | 新增 `org.commercial-group-workspace-initialization`（Organization）           | 完整 group/workspace、缺失 workspace、key/id 不匹配 fixture；正常初始化 command                                                 | 成功 readback 的 typed workspace UUID 正确；缺失/不匹配不写入且问题类型不变                                                  | 不接受 string UUID 或 fallback 查找                                                      |
| QG-07/QG-08 | 扩展 `catalog.inventory-page-and-detail-readback`（Catalog）                   | 多 item、多 SKU、category、materialRole、production tag；其中一 ref 缺失或不同 scope                                            | inventory page 的名称/SKU/分类/materialRole 与 owner facts 一致；detail production tag 的 name/order/缺失语义一致            | page 的 scope 过滤先于 Catalog display read；不存在 ref 不映射为另一 item                |
| QG-09       | 扩展 local/brand copy 真实场景（Catalog）                                      | N 个 category/dictionary、inventory target、production tag；分别正常、VOIDED、缺 ref、changed-after-preflight fixture           | 预检 closure/readback 的每个 owner 事实正确；执行重算后 stale 返回 `STALE_COPY_PREFLIGHT`；正常执行与既有 copy readback 一致 | 不允许把预检 response 当 execution 事实；不唯一/遗漏/active-vs-VOIDED 仍 typed failure   |
| QG-10       | 扩展 `catalog.sku-void-reference-blocking`（Catalog）                          | 一个 item 多 SKU，分别被 catalog composite、inventory stock_target、stock_bom 引用                                              | 每个 blocker 精确归属到相应 SKU；任何 blocker 阻止 VOIDED；无 blocker SKU 可完成状态变更并 readback                          | lock/version conflict 仍高于/保持既有错误顺序                                            |
| QG-11       | 扩展 `catalog.inventory-current-and-zones`（Catalog）                          | 一个 target 有 current/recent/changeSummary、超过一页 ledger/reference、另一个 scope target                                     | current 仅断言 current/recent/changeSummary；ledger/reference 各 HTTP endpoint 保持 cursor/total/隔离与完整记录              | 不用 current 摘要冒充分页数据；目标/作用域切换不泄漏                                     |
| QG-12       | 扩展 `catalog.inventory-consumption-reference-isolation`（Catalog）            | 当前 target、同 scope 其他 target、跨 scope target 与多条 BOM/reference fixture                                                 | 当前 target 只返回自身 reference，cursor/total/显示补充字段正确，跨 scope 不可见                                             | 受管 `EXPLAIN` 已证明先做 base-row JSONPath Filter 再展开；不物化新关系                  |
| QG-15       | 扩展 organization task-read Testcontainers/integration fixture（Organization） | hierarchy、business entity、store 三种 detail 与 overview page/filter fixture                                                   | page/detail 映射、total、排序、scope/security predicate 保持；五个 CTE 改显式列后结果相同                                    | 不以 statement 数或耗时作 BUSINESS oracle                                                |

QG-01 当前无实现动作；QG-03/QG-04/QG-13/QG-14 是前端/生成器缓存行为，不能伪造 Testcontainers 覆盖。它们必须分别有前端 focused/type/generated red-mutation proof；QG-13/QG-14 的最终“请求集变少/无关 query 不重取”仍需要单独受权的受管 HTTP/RTK 或浏览器观测。完成 Testcontainers 运行时必须报告 `business` 与 `cleanup` 两项，任一 cleanup FAIL 都不能完成 batch。

## 8. 串行实施计划（获得实施授权后执行）

以下顺序是本批已执行的实施计划。每个编号均按独立闭环执行：进入前 RECALL → 改动前重开原始材料/适用决策/命中记忆/owning source → 实现 → focused proof → 用同一材料做需求、详设、代码三方逐项回读 → 登记实现形态理由与证据档位。任何新发现先做同根扫描；不得点状止血。

1. **准备与基线。** 重测 QG-01 guard、QG-15 五个 projection、QG-08 `readItems` 所有调用方、QG-13 的 16 GET/27 mutation 闭集；确认当前源码未漂移。QG-01 只登记 `NO_ACTION_ALREADY_COMPLIANT`，不改码。
2. **QG-02。** 增加 Catalog owner 的窄 asset-ref task read 并迁移 asset settlement；先完成 Catalog Testcontainers asset 生命周期场景与模块 focused tests。
3. **QG-03。** 保持逐项、部分成功/CAS；去除 batch action 的 N 次详情 GET，完成前端 focused/type proof。
4. **QG-04。** 以 current 的已契约 changeSummary 驱动概览，保留 paged zones，完成前端 query-contract proof。
5. **QG-05。** 在同一 store GET 复用已授权 typed detail；完成 Organization Testcontainers 场景与 focused test。
6. **QG-06。** 将 typed workspace UUID 纳入既有投影并删除二次读取；完成 Organization Testcontainers 场景与 focused test。
7. **QG-07。** 先实现 Production owner 的 refs readback，再迁移 Catalog detail/coordinator，完成 Catalog Testcontainers detail/page 场景。
8. **QG-08。** 新增仅供 inventory-page enrichment 的 typed Catalog display read；泛用 `readItems` 不动；完成 Catalog Testcontainers page/detail 场景与 owner/coordinator focused tests。
9. **QG-09。** 依次在 Catalog、Inventory、Production owner 收敛 set read；每个 owner 单独保留 stale/VOIDED/missing/duplicate typed failure，再运行 copy Testcontainers 场景。
10. **QG-10。** 集合化 SKU inbound blockers 并保持精确归属，完成 SKU-void Testcontainers 场景。
11. **QG-11（本批已授权）。** 先补 backend-acceptance scenario design；再同步 OpenAPI、generated Java/TS、edge、consumer 和 tests，最后运行 current/zones Testcontainers 场景；保留契约改动的 consumer 影响与代价说明，不把它表述为共享读管线固定开销已关闭。
12. **QG-12。** 在现有数据模型内为 `references` 增加 JSONPath base-row 预筛选；保留精确 entry 谓词、cursor/total、scope/brand 隔离和展示字段。受管 PostgreSQL fixture 的隔离测试与 `EXPLAIN` 通过，计划明确先 Filter 再 JSONB Function Scan；不物化 BOM reverse relation，不新增迁移、数据模型、FK、read model 或用户 surface。QG-12 已自主完成，不挂起。
13. **QG-13。** 以 §3 闭集表为唯一 generator input，先落 red mutations，再改 generator/API tag types/生成物；完成 16 GET + 27 mutation 的静态 generated assertions。不得声称运行时成效。
14. **QG-14。** 仅处置 QG-13 已映射的 catalog-inventory refresh，逐条保留 retry/manual reload/failure paths；完成 focused UI query-intent proof。
15. **QG-15。** 最后将五个 CTE projection 列显式化，完成 Organization Testcontainers/integration proof；不和语义改动混批。
16. **整体收口。** 逐 CP 复读三方材料，跑相关编译/type/generator/focused tests 和受管 Testcontainers（若该 batch 已获得动态授权）；汇总 business/cleanup；静态与模块 PASS 不得升级表述为 HTTP/DEV/L2/UAT。随后做实施后独立 review，再交 Claude 事后复核。

## 9. 本批实施收口清单（2026-08-18）

本节是对 §8 的代码、详设与证据三方回读，不改变 §3 的失败条件或 §7 的证据等级。

| CP    | 状态                                        | 代码/生成物落点                                                                                                                               | 证据与边界                                                                                                                                                                              |
| ----- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QG-01 | `CONFIRMED` / `NO_ACTION_ALREADY_COMPLIANT` | `CatalogInventoryCoordinator.coordinateSaveInventory` 的缺失 child guard 保持原状                                                             | 源码静态回读；未为“完成计划”改码                                                                                                                                                        |
| QG-02 | `CONFIRMED`                                 | Catalog asset-ref 窄读、settlement 调用链与生命周期 focused/acceptance 场景                                                                   | 后端编译；受管 Catalog asset lifecycle 场景 business/cleanup PASS                                                                                                                       |
| QG-03 | `CONFIRMED`                                 | `CatalogWorkbenchPage` 批量关系操作直接使用列表既有 code/ref/version，保留逐项结果与 CAS                                                      | operations-admin focused unit 通过；未运行浏览器 L2                                                                                                                                     |
| QG-04 | `CONFIRMED`                                 | `InventoryDetailDrawer` 使用 current 的 `changeSummary`，分页 zone 保持懒加载                                                                 | query-contract proof、unit、typecheck 通过；未宣称 owner 内固定 SQL 合并                                                                                                                |
| QG-05 | `CONFIRMED`                                 | Organization store detail 复用已授权 typed projection                                                                                         | 模块 focused 与受管场景 business/cleanup PASS                                                                                                                                           |
| QG-06 | `CONFIRMED`                                 | workspace UUID 使用既有 typed projection，删除重复读取                                                                                        | 模块 focused 与受管场景 business/cleanup PASS                                                                                                                                           |
| QG-07 | `CONFIRMED`                                 | Production refs readback 先落 owner，再迁移 Catalog detail/coordinator                                                                        | 受管 Catalog detail/page 场景 business/cleanup PASS                                                                                                                                     |
| QG-08 | `CONFIRMED`                                 | inventory-page 专用 typed Catalog display read；泛用 `readItems` 未改                                                                         | focused 15/15；readItems 未改形状；编译/type/UTF-8 proof PASS                                                                                                                           |
| QG-09 | `CONFIRMED`                                 | Catalog、Inventory、Production 各自 set-read；Production preflight 对已作废来源显式产出 `BLOCKED/REFERENCE_MAPPING_UNRESOLVED`，execute 仍保留 fresh recheck | Inventory/Production copy 场景受管 business/cleanup PASS；Production 新增 6-case PostgreSQL proof（empty/N/missing/duplicate/VOIDED/stale）run `r5-tc-1786986673654-62557`，business/cleanup PASS |
| QG-10 | `CONFIRMED`                                 | SKU inbound blockers 集合读取，Catalog 与 Inventory blockers 保留 owner 归属                                                                  | 受管 detail/transition/void-blocking 场景 business/cleanup PASS                                                                                                                         |
| QG-11 | `CONFIRMED`                                 | current response 去掉 UI 不消费的 references/ledger，lazy endpoints 与 generated Java/TS/edge/consumer 同步                                   | generation、backend compile、current/zones 受管场景 business/cleanup PASS；仍保留 §0.5 固定开销 disposition                                                                             |
| QG-12 | `CONFIRMED`                                 | references 查询增加 base-row `jsonb_path_exists` 预筛选；删除无调用方的宽读死实现；无迁移/新模型                                              | 受管 Testcontainers run `r5-tc-1786982039973-76517`：5 tests、0 failures/errors、business PASS、cleanup PASS；EXPLAIN 先 Filter 后 Function Scan；由 Codex 自主收口，无 Dexter decision |
| QG-13 | `CONFIRMED`                                 | 43-operation policy 驱动 RTK tags；修正 copy `targetVersions[].targetRef` 为 `catalog-item-ref`；共享 edge RTK tagTypes 支持 catalogInventory | generator red self-test、tag-generation、edge-codegen check、typecheck PASS；不宣称运行时请求集收益                                                                                     |
| QG-14 | `CONFIRMED`                                 | 删除准确 tag/readback 已覆盖的成功 refetch；保留 retry/manual reload/scope/failure recovery 与两处 identity lookup                            | query-intent proof 4/4、unit 64/64、architecture focused 16 PASS/2 TODO/0 FAIL、ESLint/typecheck/format PASS；未运行 HTTP/浏览器观测                                                    |
| QG-15 | `CONFIRMED`                                 | 5 个 organization task-read CTE projection 改为显式列，single statement/snapshot/total/security 保持                                          | focused/integration、编译与受管 Testcontainers business/cleanup PASS                                                                                                                    |

### 9.1 本批实现形态选择

- QG-12 选择“现有 JSONB 语义上的 base-row 预筛选”而不是物化反向关系，因为受管 `EXPLAIN` 已给出可接受的过滤顺序，且用户明确授权 Codex 自主落地、同时 FORBID 禁止新数据模型。
- QG-13/QG-14 选择“策略/生成器单一声明源 + 成功回调按事实分类”而不是继续保留通用页面 refresh，因为后者与准确 invalidation/readback 叠加，无法解释刷新来源；动态 request-set 仍按授权边界留待后续观测。
- 普通字典创建与 SKU 属性值创建保留窄 `refetch` 而不是新增 command readback 字段，因为当前响应缺少新实体身份；这是身份解析的必要读取，不是成功后的全量刷新。
