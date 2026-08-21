SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# 商品库存与 BOM 业务模型 implementation-facing design

## 0 · 元数据与授权边界

```text
BUSINESS_SOURCE=doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-business-model-requirements-discussion-codex.md#catalog-inventory-bom-formal-requirements
JOURNEY_REFS=doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-journey.md#catalog-inventory-bom-configuration-journey
IA_REF=doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-information-architecture-codex.md#catalog-inventory-bom-information-architecture
INTERACTION_REF=doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-ui-interaction.md#catalog-inventory-bom-configuration-interaction
AUTHORIZED=正式需求修订、Journey/交互/IA、implementation-facing design、serial plan、设计期独立盲审与 review handoff
NOT_AUTHORIZED=生产代码、契约生成物、Flyway、seed 执行、测试执行、DEV/reset/start、browser L2、UAT、部署、数据操作、Git
IMPLEMENTATION_AUTHORITY=false
SKILL_USED=cs-spec-to-plan@3f223891a0d93ce08a8c84829822d220399e0cdcb46153edac6d4b101613e6b4
DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-08-22
```

## 1 · 真实业务目标与方案比较

### 1.1 这一批要解决的结构性问题

当前 contract 把直接库存写在 `sections.inventoryConfiguration.nodes[]`，把商品/SKU BOM 写在 `catalogDraft.inventoryBom[]`，又把点单选项实际用量写在 `orderOptionConfigs.values[].materialQuantities[]`。同一 owner 的扣减方式没有一个住址，前端只能把三种来源摊平成卡片；普通 shape 还能携带 SKU 节点。继续沿用会导致：页面无法解释正在配谁、同 owner 可出现 direct/BOM 双 active、前端隐藏无法阻止篡改、方式切换重解释余额/流水/快照、组件候选由错误列表拼出。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
|---|---|---|
| A · 只重排现有卡片与文案 | 三份 payload 和 owner 漂移仍在；后端仍不能从一个聚合证明互斥 | 拒绝，因为只修可见层 |
| B · StockTarget 与 ProductBom 完全正交 | 同一 owner 可同时 active，销售链必须自行决定是否双扣 | 拒绝，因为引入未裁定语义 |
| C · contract 派生 owner tree，每个 owner 一个 `InventoryRule`，inventory owner 原子替换 | UI、contract、catalog 结构与 inventory 定义使用同一 owner/mode；历史定义保留而 active mode 唯一 | **采用** |

我选了 C 而不是 A/B，因为真正需要消除的是“owner 与扣减方式没有单一真相”，不是卡片样式，也不是增加更多可组合能力。

## 2 · CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
|---|---|---|---|---|
| CP-01 | contract 与生成链 | catalog contract source | shape policy、`inventoryRules` detail aggregate、candidate cursor operation、typed problems、generated backend/frontend wire | 已接受需求/IA |
| CP-02 | inventory 定义与生命周期 | inventory | definition status、owner 原子锁、A-05、组件候选与五条件、快照不变量 | CP-01 |
| CP-03 | catalog 结构与 whole-save 协调 | catalog | 服务端派生 owner tree、结构复核、单一 inventory command、option actual-use 映射 | CP-01、CP-02 API |
| CP-04 | operations-admin | operations-admin + foundation | 单节点退化、左树右详情、direct/BOM表单、候选 generation、错误/刷新 | CP-01、CP-03 readback |
| CP-05 | acceptance 与 seed | backend-acceptance + catalog seed | 80 条总上限内的参数化全矩阵、20 个非法 fixture 迁移、丰富 DEV seed | CP-01..04 |

## 3 · 横切机制对照表

| 机制 | ① 用哪个现成能力/规范（精确路径或符号名） | ② 如何验证（一个能做的观察） | ③ 无现成时：必须符合什么形态 | ④ 本批适用全集 |
|---|---|---|---|---|
| 读侧节点授权 | `OperationsCatalogInventoryController.readRequest`、`OperationsSessionResolver.requireWorkspaceRead`、`CatalogScopeLookup.requireCatalogBrand`；后台规范 §2-G | `[backend-acceptance]` A 门店身份请求 B 门店 item detail、shape manifest scoped projection、unit list、component candidate，四条均不得返回 B 数据 | 新 candidate controller 分支与 `item()` 同形：session → selected node → brand → owner query；不得信 browser URL | `getOperationsCatalogItem`、`getOperationsCatalogShapeManifest`、`listOperationsCatalogUnits`、`getOperationsInventoryConsumptionTargetCandidates` |
| 写授权与 grant 复核 | `CommandExecutionContextResolver.resolveCatalog`、`CatalogOwnerService.typedCommandScope`、`InventoryOwnerService.requireTypedContext` | `[acceptance]` 缺 `EDIT_STORE_CATALOG` 或跨 node 的 whole-save 返回 403，catalog version、target/BOM 均不变 | inventory 新 command 接收同一个 `WorkspaceExecutionContext<CatalogAuthorizationScope>` 并复核 catalog-save token/grant | `saveOperationsCatalogItem` 唯一写入口；内部 `CatalogOwnerApi.saveCatalogItem`、`InventoryOwnerApi.replaceCatalogInventoryRules`、asset settlement |
| 跨 owner 写与事务 | `SaveOperationsCatalogItemOperation.execute @Transactional(REQUIRED)`、`CatalogInventoryCoordinator.saveCatalogItem`；后台规范 §1-C/§1-D | `[owner integration]` inventory rule 第 N 个 owner 拒绝后 catalog version、所有 definition status/rows 与 asset binding 全回滚 | 依赖单向 catalog coordinator → inventory public API；inventory 不 import catalog、不写 catalog schema | catalog item save、inventory rules replace、option-value BOM lifecycle、asset settle；一个 REQUIRED 事务 |
| 集合形态与分页 | `project-memory/practices/collection-boundary-modes.md`、`useCursorCandidates` | `[静态]` detail aggregate 无 cursor/slice；unit max 99 无 cursor；candidate 真消费 cursor/pageSize；`[acceptance]` 101 个合格 target 第二页可达且不重不漏 | 新 candidate 使用 SQL keyset cursor，默认 20、最大 100，返回 `items,nextCursor,total`；不内存分页/顶替选中项 | owner tree、每 owner BOM rows=`Detail aggregate`；unit=`Bounded(99)`；component candidates=`Cursor(20/100)` |
| 缓存失效 / 改完刷新什么 | `contracts/catalog/catalog-inventory-rtk-tag-policy.json`、generated RTK tag helpers、前端规范 §3-H | `[静态]` save invalidates item detail/list、inventory target list/detail、component candidate；unit/category/tag/attribute/option-definition query 不失效 | 由 P1 policy 单源生成，禁止组件手写 `refetch()` 广播 | `saveOperationsCatalogItem` 的 5 个 identity：current item、current catalog result、affected target list、affected target detail、component candidate LIST |
| **RTK 数据读取与加载判定** (`currentData` / `isFetching`) | 前端规范 §3-B；`CatalogItemDrawer` 现有 manifest/unit query；`useCursorCandidates` | `[组件 test]` 切 item/owner/keyword 时旧 `data` 不出现在 DOM；loading 由对应 `isFetching` 可见 | 新 component hook 只消费 generated RTK endpoint 的 `currentData`，generation 变化取消旧页 | item detail、shape manifest、unit list、component candidate 四条 query |
| **同一事实只有一个住址** | 前端规范 §3-E；generated detail readback | `[静态]` 无 `acceptedPage`/`serverInventoryRules` 本地镜像；`[组件 test]` readback 变化后 UI 只由 `currentData` hydrate 一次 | 本地只留 `inventoryRuleDrafts` 与 `selectedOwnerKey`；服务端 tree/modes/versions 不复制 | owner tree、allowedModes、mode readback、单位快照、candidate page/total、expected versions |
| **失败可见且原因不得改写** | 前端规范 §3-D；`operationsProblemFeedback.ts`；后台规范 §2-B/§1-D | `[组件 test]` 15 个 IA code 均有文案；owner safe message/field path 保留；failure 不关 Drawer | 新 code 加入 generated enum 与闭集 feedback；只对 IA 明定 code 给固定任务文案，details/reason 不丢 | IA §4 的 15 个 code、candidate load failure、unknown readback、field validation |
| owner 错误到 HTTP 的映射与注册处 | `apps/backend/.../app/edge/problem/ContractProblemAdvice.java` | `[静态]` `CatalogOwnerApi.Problem` 与 `InventoryOwnerApi.Problem` 均映射原 status/code；新增 code 在 OpenAPI enum | 扩展同一 advice/envelope，不增第二 problem controller | 新 5 code + 现有 10 code；catalog/inventory owner exception 两类 |
| 幂等键构成与重放语义 | 前端规范 §3-G；`useSubmissionLifecycle`；`InventoryOwnerService.catalogSaveReceiptKey` | `[acceptance]` 同 key 同 payload 重放得到相同 readback且无多次状态切换；同 key 异 payload=`IDEMPOTENCY_MISMATCH` | parent key 只由 Drawer business intent 生命周期提供；inventory child receipt 固定 `${parent}:inventory-rules:${itemRef}` | `saveOperationsCatalogItem` parent；catalog save、inventory replace、asset settle 子键；候选/reads 不适用 |
| **该用生成物的地方不得手搓字符串** | 后台规范 §2-D；`CatalogInventoryWorkspaceCommandTokens`、generated wire、generated RTK | `[静态/compile]` operationId/path/request/response/problem code 从 P1 生成；生产源码无新手写 wire DTO/path | P1 是唯一 contract 生成源；generated 文件只重生成，不手改 | 57 operations 全集中的 5 个本屏 operations；37 command tokens exact-set 不因新增 GET 改变 |
| 日志落点与脱敏字段 | `SaveOperationsCatalogItemOperation.LOG`、`HttpRequestMetricsInterceptor`、`EdgeRouteFaceRegistry`、AGENTS 日志硬约束 | `[focused/log read]` rejection/rollback 可由 operationId/correlationId/requestId/ownerCount/stage 定位；日志搜索不到 payload、名称、编码、token/cookie/Authorization | inventory replace 记录 stage、ownerType、mode transition、blocker kinds 的计数/枚举，不记 owner refs、数量、单位文本或 raw rows | candidate read、whole-save、inventory replace 的 precheck/lock/validate/write/readback/rollback；managed test manifest |
| 迁移回填与可逆性 | 单一 Flyway history；现有 `stock_target`/`stock_bom` opaque ref migrations | `[Testcontainers]` 合法旧行全部 `definition_status=ENABLED`；双 active/非法 grain/无法解析 owner 时 Flyway 抛出带 ref 类型的首败，不猜测 | additive migration；先检查后加约束；不恢复 JSON fallback/legacy arrays；生产写入后不可 down-migrate | `inventory.stock_target`、`inventory.stock_bom`、其 unique/partial index、旧普通-shape SKU target/BOM、flat seed/fixture |
| 前端共享行为（Drawer/列表/表单生命周期） | `adminDrawerSurfaceProps`、`useSubmissionLifecycle`、`useCursorCandidates`、`useAsyncGenerationGuard`、`testId` | `[组件 test]` dirty close、submit lock、focus restore、late response guard、cursor next page 各有断言 | 业务 workbench 留 app 内；不复制 foundation lifecycle；从 5k+ Drawer 拆出 bounded feature component | CIB-01 Drawer lifecycle；CIB-02 owner tree/workbench；component candidate hook；BOM row controls |
| 候选/下拉数据源 | `listOperationsCatalogUnits`、新 `getOperationsInventoryConsumptionTargetCandidates`、`useCursorCandidates` | `[acceptance]` 五条件各一反例，101 条翻页；`[组件]` owner/scope 变化清空并取消旧 generation | inventory owner SQL 直接过滤五条件，save 时同条件复核；前端不使用 catalog items 页拼候选 | 盘点单位候选（99 bounded）；耗用 target 候选（cursor）；当前已绑定停用单位 readback 不作为新候选 |
| 编码与名称呈现 | detail/candidate typed snapshot；交互稿 USER_VISIBLE_COPY | `[组件 test]` 树和行显示名称为主、编码辅助；长值截断/tooltip；提交不从 label 反推 ref | candidate 返回 `itemName,itemCode,skuName,skuCode,unitSnapshot`；历史显示 snapshot，不查当前定义覆盖 | item/SKU/option owner、component target、unit、BOM rows、problem summaries |
| **会同时坏的东西是否已声明为原子组** | `doc/platform/foundation-charter.md` §5-C；P1 generator + operation bindings | `[静态链]` P1→operation-handler-bindings→tokens→M1→P3 后 operation/enum/route/tag exact-set 一致；任一失败整组未完成 | 原子组 `CONTRACT_GENERATION`、`WHOLE_SAVE`、`DEFINITION_MIGRATION`、`UI_WORKBENCH`、`ACCEPTANCE_SEED` | CP-01 全生成物；CP-02/03 transaction；CP-04 generated+UI；CP-05 fixtures+seed source/executor/tests |

## 4 · 每个 CP 的门控

### CP-01 · contract 与生成链

- **失败条件**：普通/称重 contract 仍允许 SKU owner；request 仍同时存在 `inventoryConfiguration.nodes`、`catalogDraft.inventoryBom`、`materialQuantities` 三处 active rule；candidate route 无 cursor；57 operation 与生成物 exact-set 不一致。
- **不变量**：七 shape 矩阵、owner identity、allowedModes、request/readback、problem codes 同源；新增 1 个 GET，command token 仍 37。
- **FORBID**：手改 OpenAPI/root shards/generated Java/RTK；兼容旧 flat fields；`HAS_SKU` 动态库存粒度。
- **比例验证**：generator check/self-test、operation bindings、tokens/M1/P3 self-test、compile/typecheck。
- **形态理由**：选择一个 `inventoryRules` detail aggregate，而不是继续协调三个 payload，因为 whole-save 本来就是整体 CAS。
- **RECALL**：正式需求 §5/§8/§9、IA §2.2、collection boundary memory、两份 coding standard。

### CP-02 · inventory 定义与生命周期

- **失败条件**：同 owner 两表都 ENABLED；切换时只查余额不查流水/引用/历史定义快照；把当前命令刚停用的行误算成 pre-existing 历史 blocker；非法 component 在 candidate 隐藏后仍可篡改保存；active 空 BOM。
- **不变量**：所有 owner 按稳定 identity 排序后 advisory lock + `FOR UPDATE`；先验证整组再写；历史 unit snapshot 不改；任何拒绝零部分写。
- **FORBID**：自动搬余额、删 ledger、重写快照、跨 schema 查 catalog、用 fallback 挑 mode。
- **比例验证**：inventory owner integration + Testcontainers migration + backend acceptance。
- **形态理由**：在两张 owner 表增加 definition status 并由一个 replace command 保证跨表互斥，不新增第三张“规则真相表”。
- **RECALL**：A-05、unit model 八条、`InventoryOwnerApi`、`InventoryOwnerService`、相关 Flyway。

### CP-03 · catalog 结构与 whole-save

- **失败条件**：catalog 信任 request 的 shape/nodeType/ownerRef；inventory 拒绝后 catalog version 变化；option actual-use 继续产生第二份 BOM 真相。
- **不变量**：catalog 在当前事务从已保存商品结构派生 owner set；inventory 只接 immutable typed command；option definition 强制物料由 catalog 解析，实际行由 inventory rule 保存。
- **FORBID**：catalog 写 inventory schema；inventory 读 catalog schema；按数组顺序匹配 owner；恢复 SALES_UNIT/fallback。
- **比例验证**：catalog owner integration、coordinator rollback tests、acceptance 篡改矩阵。
- **形态理由**：保留 catalog 作为 initiating owner，因为商品结构与整体保存归 catalog；inventory 只终判库存事实。
- **RECALL**：A-01/A-02、coordinator `saveCatalogItem`、`coordinateSaveInventory`、`coordinateOrderOptionValueBoms`。

### CP-04 · operations-admin

- **失败条件**：顶层新增库存/BOM按钮仍在；direct 显示其他商品 picker；单节点仍画空树；前端 local shape 常量成为授权；error 关闭 Drawer。
- **不变量**：可见结构与已接受线框逐字一致；generated readback 唯一；draft 按 owner 隔离；source/target precision 不由控件四舍五入。
- **FORBID**：复制 foundation、服务端数据镜像、InputNumber round、自由单位文本、本地 component filter。
- **比例验证**：focused component tests、operations-admin typecheck/static tests；浏览器 L2 仅未来另授权。
- **形态理由**：从 `CatalogItemDrawer.tsx` 拆出 `CatalogInventoryBomWorkbench`，但保存 lifecycle 仍归宿主，避免新 Drawer/新全局状态。
- **RECALL**：交互稿、线框、IA、frontend standard、frontend capability memory。

### CP-05 · acceptance 与 seed

- **失败条件**：15 条只写文案无断言；CP-00 的 `annotated == discovered == selected` 基线对账不成立；77 基线新增超过 3 个 scenario 导致总数 >80；普通 shape+SKU 20 个 call site 任一保留；seed 只有 happy path或手改 generated fixture。
- **不变量**：3 个参数化 scenario 内覆盖全部 case；fixture/seed 分离；seed 新功能与旧调整两栏；reset 后每 shape/方式/选项/单位分支可体验。
- **FORBID**：新增 provider 壳/registry、把 seed 当 acceptance、把本批对象塞进其他域 plan、绕 owner SQL seed。
- **比例验证**：Node static门、focused owner tests、先在 CP-00 证明 `annotated == discovered == selected == 77`，新增后再证明 `80/80` managed Testcontainers；DEV/reset/seed 另授权。
- **形态理由**：用参数化 case 把完整矩阵放进 3 个真实场景，既不牺牲断言又遵守 80 上限。
- **RECALL**：需求 §11、Claude review 测试/seed要求、acceptance standard、seed generator/executor。

## 5 · operation / path / face / 集合形态

| 业务意图 | operationId | method/path | consumer face | 集合形态 | 预期规模与增长驱动 |
|---|---|---|---|---|---|
| 读取 shape 与库存准入 policy | `getOperationsCatalogShapeManifest` | GET `/operations/catalog-inventory/shape-manifest` | operations-admin | Bounded manifest | 固定 7 shape；源码固定集合，不随租户数据增长 |
| 读取当前商品及 owner rule detail | `getOperationsCatalogItem` | GET `/operations/catalog-inventory/items/{itemCode}` | operations-admin | Detail aggregate | 1 商品；内部 owner/BOM 随 SKU、选项值、组件行增长，整体 CAS |
| 读取盘点单位候选 | `listOperationsCatalogUnits` | GET `/operations/catalog-inventory/units?enabledOnly=true` | operations-admin | Bounded | 正常十几个、硬上限 99；由单位库增长 |
| 连续搜索可耗用库存对象 | `getOperationsInventoryConsumptionTargetCandidates`（新增，ordinal 57） | GET `/operations/catalog-inventory/inventory-consumption-target-candidates` | operations-admin | Cursor，default 20/max 100 | 每范围几十至数千；由可用 StockTarget 数增长 |
| 整体保存商品与规则 | `saveOperationsCatalogItem` | PATCH `/operations/catalog-inventory/items/{itemCode}` | operations-admin | 单命令/Detail replace | 单商品聚合；不分页、不部分提交 |

所有 route 只有 `x-consumer-faces=[operations-admin]`。新增 candidate 是 inventory owner task-read，不获得写 capability。

## 6 · 跨 owner 写矩阵

| policy | 第一个 owner command | 第二个 owner command | 事务 | 失败时的回滚事实 |
|---|---|---|---|---|
| 商品 whole-save | `CatalogOwnerApi.saveCatalogItem`：保存 catalog 字段并返回当前事务内结构投影 | `InventoryOwnerApi.replaceCatalogInventoryRules`：锁定、验证、替换所有 owner rule；随后 asset owner settle | `SaveOperationsCatalogItemOperation.execute` 的同一 REQUIRED | inventory/asset 任一失败：catalog item version/sections、target/BOM status/rows/version、asset binding、所有 child receipt 一起回滚 |
| 删除点单选项定义值 | `CatalogOwnerApi.update/deleteOrderOptionDefinition` 确认删除值集合 | `InventoryOwnerApi.deleteCatalogOptionValueBoms` 仅停用对应 option owner BOM，不删 target | 现有 catalog operation REQUIRED | catalog definition 与 option BOM 同时恢复 |
| 临时商品晋升/复制 | catalog 产生 source→target owner mapping | inventory copy command 只复制合法 active/历史定义并按新矩阵复核 | 现有 promotion/copy REQUIRED | target catalog closure 与 inventory definitions 同时恢复 |

whole-save 的 inventory command 接收一次完整、已由 catalog 派生的 `CatalogInventoryRuleReplaceCommand`；旧 `ensureCatalogItemSaveTarget`、`saveCatalogItemProductBom` 与 `coordinateOrderOptionValueBoms` 不再作为 whole-save 消费者。仍有生命周期消费者的专用 option delete/copy API 保留。

## 7 · 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
|---|---|---|---|---|
| shape→owner grain | P1 `shapePolicies[].inventoryOwnerGranularity` | shape manifest + item detail `inventoryRules.nodes[].owner` | 前端 owner tree；catalog save 重派生 | contract self-test + matrix acceptance |
| owner→allowed modes | P1 七 shape矩阵 | detail `allowedModes/defaultMode/disabledReason`；save 只传 selected mode | UI 只展示；inventory command 再核验 | 篡改 case |
| 单一 active mode | request `inventoryRules.nodes[].mode` | catalog immutable replace command | inventory 两表 definition status + readback | dual-mode red case、DB integration |
| direct configuration | `directConfiguration` nullable union branch | targetRef/version、配置、catalog base-unit snapshot | inventory target create/update/enable | direct item/SKU/material readback |
| BOM lines | `bom.lines[]` nullable union branch | targetRef、lineSign、quantity、expectedBomVersion；单位不由 client 传 | inventory 复核 target并保存 consumption snapshot | positive/negative/precision cases |
| option forced material与实际用量 | catalog order-option definition 的 materialRef 是强制约束；实际 sign/quantity 只在 option owner rule | catalog 将 definitionValueRef→允许 material target 的不可变映射传给 inventory | inventory 校验 required rows 并保存 option BOM；catalog 不再存 materialQuantities 第二真相 | option required/positive/negative/actual cases |
| A-05 blockers | requirement A-05；§8.1 权威事实表 | inventory command 在写前读取四类事实，problem details 只传 `blockingFacts[]` 枚举/计数 | UI 摘要/owner拒绝；不提供 force | 四正/四拒参数化 case；历史分支先完成一次成功切换再尝试第二次 |
| unit snapshots | unit model；catalog item/SKU effective base snapshot | direct command consumptionUnitSnapshot；BOM candidate target snapshot | stock_target header、stock_bom line、ledger immutable snapshot | 0.3567→356、rename/disable history |
| **集合形态** | IA `collectionShapeAndScale` | detail无 cursor；unit max99；candidate cursor/pageSize | UI aggregate无 slice；candidate total/nextCursor | static + 101 candidate acceptance |
| **授权执行点** | IA `stateAndPermission` | controller `readRequest`；save `resolveCatalog` | catalog/inventory `requireTypedContext`/grant复核 | A→B scope read/write拒绝 |
| **缓存失效** | IA `navigationAndRefresh` | P1 RTK tag policy的 save invalidates | generated RTK 重取5个 identity | frontend static/focused test |
| **错误映射** | IA 15 code | OpenAPI enum + `ContractProblemAdvice` | `operationsProblemFeedback` + field/owner surface | enum exact-set + 15-case component test |
| **幂等** | frontend business-intent key | `Idempotency-Key` +固定 inventory child key | catalog/inventory receipt replay | same/same与same/different acceptance |
| **日志与脱敏** | 禁 payload、refs、名称、数量、token/cookie/IP | operationId/correlationId/requestId/stage/count/blockerKind | run-scoped log diagnosis | log read + forbidden token static test |

## 8 · 业务规则 → owner 判定点

| 规则编号 | owner 判定点 |
|---|---|
| A-01 | catalog `deriveInventoryRuleOwners` 由 shape/有效 SKU/option assignment 产出 owner set；inventory `requireAllowedMode` 对照同版 policy；普通/称重 SKU 与 SKU shape item owner 均拒绝 |
| A-02 | policy 将 MATERIAL（含 `RAW_MATERIAL/SEMI_FINISHED/PACKAGING` role）限定 `NONE/DIRECT`；inventory 对 MATERIAL BOM 返回 `INVENTORY_DEDUCTION_MODE_NOT_ALLOWED` |
| A-03 | contract 枚举的 display copy 与 IA USER_VISIBLE_COPY；前端只消费任务文案，技术 identity 只读隐藏 |
| A-04 | shape 不变；MATERIAL 不增加销售入口/销售单位要求；catalog owner 不扩展 SELLABLE/publish |
| A-05 | inventory 按 owner lock 后检查 `balance!=0`、ledger count、active BOM component reference、**命令开始前已存在的 DISABLED definition snapshot**；任一 blocker 拒绝，否则停用旧定义并启用新定义。当前命令将旧 active 行改成 DISABLED 是写阶段，不反向成为本次 blocker |
| U-01 | catalog item `salesUnitRef/baseMeasureUnitRef` 单值；无 arrays/fallback |
| U-02 | SKU override nullable，null 继承；清除覆盖不物化复制值 |
| U-03 | MATERIAL 可无 sales unit，但创建 target/BOM component 必须有 effective base snapshot |
| U-04 | target consumption snapshot 来自 item/SKU effective base；measureMode 只表达计量方式 |
| U-05 | counting unit 仅 direct config 输入换算，不改 target snapshot |
| U-06 | source quantity 按 source precision、target/BOM quantity 按 consumption precision，BigDecimal 向零截断 |
| U-07 | 被引用单位不可删；停用只影响新候选；历史绑定/快照继续可读 |
| U-08 | unit rename/disable 不改 stock_target、stock_bom line、stock_ledger 保存时快照 |

规则编号无空号；A 共 5 条，单位保持规则共 8 条。

### 8.1 · A-05 四维权威事实表

这里的“历史快照”不是单位快照、ledger 的重复别名，也不是 copy/promotion 的任意历史记录。本专题把它精确定义为：**同一 owner 在本次命令取得锁之前，已经存在于 `inventory.stock_target` 或 `inventory.stock_bom`、且 `definition_status='DISABLED'` 的旧扣减定义行**。该行保留旧 direct configuration/consumption unit snapshot，或旧 BOM rows/unit snapshots 与 version，因而是旧扣减方式的 owner-owned immutable definition snapshot；不建立第三张规则真相表。

| blocker kind（problem details） | owner 表/列与锁定查询 | PRESENT | ABSENT | 与其他维度的区别 | acceptance fixture |
|---|---|---|---|---|---|
| `BALANCE` | 当前 owner 的 `inventory.stock_target.balance`；owner identity 行 `FOR UPDATE` | 任一相关 target `balance <> 0` | 无 target 或全部 `balance = 0` | 当前余额事实，不以 ledger 推算 | 直接库存 owner 增加非零余额 / 保持零余额 |
| `LEDGER` | `inventory.stock_ledger.target_ref` 对当前 owner 所有 target refs 做 `EXISTS` | 至少一条 ledger；即使余额已回零仍 PRESENT | 无 ledger 行 | 历史数量动作，不等同余额或 definition snapshot | 真实 increase/adjust 后归零 / 从未发生动作 |
| `BOM_REFERENCE` | scope 内 ENABLED `inventory.stock_bom.rows` 对当前 owner targetRef 的组件引用计数 | 至少一条 active BOM component reference | 计数为 0 | 其他 owner 对该 target 的当前引用，不是本 owner 自有 BOM 定义 | 另一个 owner 的 active BOM 引用 / 无引用 |
| `HISTORICAL_DEFINITION` | 同 owner identity 在两表锁定结果中，命令开始前 `definition_status='DISABLED'` 的行 | 任一旧 target 或 BOM definition 已 DISABLED | 两表均无 pre-existing DISABLED 行 | 代表此前方式切换留下的旧规则快照；不是单位历史，也不是当前命令稍后停用的 active 行 | 先完成一次合法 DIRECT→BOM（产生 disabled target），再发 BOM→DIRECT / 初始 owner 首次切换 |

执行次序固定为：锁定两表 owner rows → 拍下 pre-existing status 集合 → 查询四维 → 任一 PRESENT 返回 `INVENTORY_DEDUCTION_MODE_CHANGE_BLOCKED`，`details.blockingFacts` 只含上述枚举及计数 → 全部 ABSENT 才把当前 active 定义改为 DISABLED并创建/启用目标定义。DISABLED 定义不得由普通 whole-save 重新启用、改写或删除；再次切换必须走未来显式治理，因此第一次合法切换不会被本次新产生的 DISABLED 行自我阻断，第二次自动切换则会被历史定义阻断。

## 9 · owner API 与消费者清单

| owner 方法 | 谁调用（精确路径） |
|---|---|
| `CatalogOwnerApi.saveCatalogItem` | `CatalogInventoryCoordinator.saveCatalogItem` |
| `CatalogOwnerApi.readItem` / `CatalogOwnerService.readItem` | coordinator item detail与保存后的当前事务投影 |
| `InventoryOwnerApi.readCatalogInventoryDefinition` | `CatalogInventoryCoordinator.readCatalogItem` 合并 definition-only readback |
| `InventoryOwnerApi.readCatalogInventoryConsumptionTargetCandidates`（新增 typed cursor query） | coordinator 新 candidate read；HTTP 只由 `getOperationsInventoryConsumptionTargetCandidates` 暴露 |
| `InventoryOwnerApi.replaceCatalogInventoryRules`（新增） | `CatalogInventoryCoordinator.saveCatalogItem`，每次 whole-save 最多一次 |
| `InventoryOwnerApi.validateCatalogItemBaseMeasureUnitTransition` | catalog save 的单位生命周期守卫，继续保留 |
| `InventoryOwnerApi.deleteCatalogOptionValueBoms` | order-option definition value 删除/解绑 lifecycle |
| `InventoryOwnerApi.copyCatalogOptionValueBoms` | temporary promotion/copy lifecycle |

旧 `ensureCatalogItemSaveTarget`、`saveCatalogItemProductBom` 若在全仓扫描后无非 whole-save 调用者则删除；legacy overload 也一并删，不保留“以后可能用”的零调用 API。

## 9b · 变更定位

| 层 | 精确路径 | 唯一锚点 |
|---|---|---|
| contract source | `scripts/generate/catalog-inventory-p1.mjs` | `const shapeNodeAdmission =`、`const operationMetadata = [`、`const inventoryConfigurationSaveSchema =`、`const inventoryBomLineSchema =`、`const catalogDefinitionSeed =`、`const seedDatasets = [` |
| operation design source | `doc/review/platform/2026-08-06-v2s-catalog-inventory-backend-operation-design-contract.json` | `"operations"`；实施时将来源迁至本详设对应的新同域 contract source，旧件标 SUPERSEDED-BY |
| generated chain | `scripts/generate/catalog-inventory-p3-frontend.mjs`、`catalog-inventory-workspace-command-tokens.mjs`、`backend-performance-m1-command-execution-bindings.mjs`、`operation-handler-bindings.mjs` | 各自 operation exact-set / self-test |
| HTTP edge | `OperationsCatalogInventoryController.java` | `@GetMapping("/items/{itemCode}")`、`@PatchMapping("/items/{itemCode}")` 同形相邻新增 candidate GET |
| catalog coordinator | `CatalogInventoryCoordinator.java` | `saveCatalogItem(`、`coordinateSaveInventory(`、`coordinateOrderOptionValueBoms(` |
| catalog owner | `CatalogOwnerService.java` | `saveCatalogItem(`、`validateShapeOwnedSections(`、`writeItemUnitSnapshots(`、`writeSkuUnitFacts(` |
| inventory API | `InventoryOwnerApi.java` | `readCatalogInventoryDefinition(`、`CatalogItemSaveEnsureTargetCommand`、`CatalogItemSaveBomCommand` |
| inventory owner | `InventoryOwnerService.java` | `readCatalogInventoryDefinition(`、`ensureCatalogItemSaveTarget(`、`saveCatalogItemProductBom(`、`saveCatalogProductBomCore(`、`loadTargetsByItemRef(` |
| migration | `apps/backend/catering-business-server/src/main/resources/db/migration/` | 新时间戳 migration；不得改历史文件 |
| frontend | `CatalogItemDrawer.tsx` | `const [inventoryBomDraft`、`catalogDraft.inventoryBom =`、`function InventoryBomEditor`；新建同目录 `CatalogInventoryBomWorkbench.tsx` 与 `useInventoryConsumptionTargetCandidates.ts` |
| problem mapping | `ContractProblemAdvice.java`、`operationsProblemFeedback.ts` | owner problem handler、`OPERATIONS_PROBLEM_FEEDBACK` |

## 10 · 数据迁移

| 迁移 | 加/改什么 | 旧行回填取什么值 | 为什么那是唯一可恢复的事实 | 可否回滚 |
|---|---|---|---|---|
| inventory definition status | `stock_target.definition_status`、`stock_bom.definition_status`：`ENABLED/DISABLED`；增加 active lookup index；DISABLED 行保持 configuration/rows/unit snapshots/version immutable | 旧行先标 `ENABLED` | 旧表只有存在的定义，没有可恢复的旧停用事实；不能猜 DISABLED。上线后 owner 在成功切换时创建首个可执行历史定义快照 | schema 可回滚但生产写入后会丢历史状态，不允许自动 down |
| owner grain/双 active precheck | migration SQL 按 opaque `(item_ref,product_sku_ref,option_value_ref)` 与 catalog shape 检查；冲突 `RAISE` 聚合 refs/type | 不回填冲突，不按数组或 code 猜 | A-01/A-05 禁止静默转换；首败日志就是治理清单 | 修数据后重跑；不绕过 |
| active BOM non-empty | `stock_bom` CHECK 不能可靠校验 JSON业务语义，owner 写侧强制；可加 `definition_status` partial indexes | existing rows `rows=[]` 且 ENABLED 视为 conflict | 空 BOM 无法证明 active recipe | 同上 |
| 普通/称重 + SKU旧事实 | 不自动改成 item owner；迁移 precheck 列出 target/BOM及其 balance/ledger/ref | 无自动回填 | SKU→item 会重解释库存身份 | 由显式治理或 reset 清库；fixture迁到合法 shape |
| old flat contract data | catalog `sections.inventoryBom` 仅旧 JSON投影，不再读写；真实 inventory rows按 owner readback生成新 detail | 不从 JSON恢复 inventory owner | inventory schema 是事实 owner，catalog JSON不是 | 清库环境直接按新模型物化；不建 fallback |

迁移还必须证明没有恢复 `salesUnitRefs`、`SALES_UNIT` item reference、自由 counting/consumption 字符串、`measureMode` 消耗单位或 JSON fallback。旧合法 target/BOM 的 UUID、version、余额、ledger 和单位快照原样保留。

## 10b · seed 数据

### 10b.1 受影响的 seed 全集

| seed 文件 | 本批为什么受影响 | 处置 |
|---|---|---|
| `scripts/generate/catalog-inventory-p1.mjs` | 唯一业务图生成源；`seedDatasets`、`catalogDefinitionSeed`、schema/assertions 仍声明旧 flat mode/option material shape | 在这里且只在这里新增/调整业务对象、shape/mode/option sign/单位/盘点配置；同时更新自校验 |
| `scripts/dev/catalog-inventory-seed-executor.mjs` | 唯一 HTTP 物化执行器；当前仍分别写 `inventoryConfiguration.nodes`、`catalogDraft.inventoryBom`、`materialQuantities` | 改为 generated `inventoryRules` whole-save；仍只走 owner HTTP；增加逐 fixture readback 与拒绝结果诊断 |
| `scripts/dev/catalog-inventory-seed-plan.mjs` | 消费 generated fixture 并声明执行阶段/分母 | 只更新新 fixture 字段与分母读取，不在 plan 内重复定义业务对象 |
| `contracts/policy/catalog-inventory-fixture-catalog.json` 与 `.schema.json` | P1 的 generated fixture/schema 输出 | 只能由 P1 重生成，禁止手改；输出中 ordinary/weighed+SKU 分母必须为 0 |
| `doc/evidence/platform/2026-08-07-v2s-catalog-inventory-seed-plan-codex.json` | seed plan 的 generated evidence 输出 | 只能由 seed plan 重生成；不作为新业务定义源 |
| `scripts/test/catalog-inventory-definition-seed.test.mjs` | 当前断言旧 `materialQuantities` 与 seed schema | 改为新 option rule/sign/actual quantity、每 shape/方式代表、no legacy fields |
| `scripts/test/catalog-inventory-seed-identity.test.mjs` | 当前 identity 分母尚未覆盖完整 shape×mode | 加 ordinary/weighed+SKU=0、SKU shell readonly、material no BOM、shared component、counting configured/unconfigured |
| `scripts/dev/catalog-inventory-seed-executor.test.mjs` | executor 静态协议与日志断言 | 加 whole-save payload、owner HTTP、无 fallback/无 raw payload 日志断言 |
| `scripts/test/test-health-entry-runner.mjs` | Node test 唯一登记分母 | 上述文件若新增独立 test 才登记；若只改既有三条，分母不增 |

`scripts/dev/r5-complete-seed-executor.mjs`、`r5-seed-plan.mjs` 只继续编排 catalog-inventory 子 seed，不接收本专题业务对象，不形成第二 seed 住址。

### 10b.2 两类改动分开写

| 类型 | 落点与覆盖清单 |
|---|---|
| **新功能上线** | `SEED-BOTTLED-COLA`：标准计件+DIRECT；`SEED-CAESAR`：标准计件+item BOM；`SEED-MILK-TEA`：选项“加珍珠”正向与“换燕麦奶”一负一正；`SEED-LATTE`：SKU_VARIANT 主壳只读、至少两个 SKU 各有独立 BOM；`SEED-WEIGHED`：称重商品 DIRECT；`SEED-MATERIALS`：RAW_MATERIAL/SEMI_FINISHED/PACKAGING direct targets；`SEED-DINNER-SET`、`SEED-SERVICE`、`SEED-BENEFIT`：无库存 owner；公共 `BOX-001` 被至少两个 BOM 引用；至少一个 target 配盘点单位、一个不配；一个 direct target 有历史/流水用于展示 A-05 blocker。 |
| **旧功能调整** | 删除 seed payload 的旧 flat `inventoryBom`/`inventoryConfiguration`/option `materialQuantities` 三真相；普通/称重不再挂 SKU；`SEED-LATTE` 保持合法 SKU_VARIANT 并把 archived SKU 设为 NONE；MATERIAL 不再允许 BOM；COMPOSITE 内容关系不转 BOM；旧 unit 单值、SKU override/clear、停用绑定可见、0.3567kg→356g 语义全部保留。 |

### 10b.3 覆盖判据

| seed 状态分支 | 可证伪失败条件 |
|---|---|
| 三种方式 | reset+seed readback 中不存在 NONE、DIRECT、BOM 任一实例；或同 owner 两 mode active |
| 七 shape | 任一 shape 无代表；普通/称重出现 SKU；SKU shell active；MATERIAL 出现 BOM；套餐/服务/权益出现 owner |
| SKU 独立 BOM | 两个 SKU 读回相同 owner/version/rows，或任一行归到 item shell |
| option 正负/实际用量 | 加珍珠非 POSITIVE；换燕麦奶没有 MILK NEGATIVE + OAT_MILK POSITIVE；数量未按 target snapshot 读回 |
| 公共物料 | `BOX-001` 少于两个 BOM 引用，无法体验引用保护 |
| 盘点单位分支 | 所有 target 都有或都没有 counting unit；无盘点单位 readback 不能保留小数 |
| 单位历史 | rename/disable 后已有 BOM/ledger snapshot 被当前定义覆盖；0.3567kg 得 357g |
| 方式切换阻断 | 有历史 target 在 UI/readback 仍显示可自动切换，或 executor 静默切换成功 |

### 10b.4 同步项

- P1 generator、generated fixture/schema、seed plan、executor、三条既有 static test 同一原子组更新。
- executor readback 必须断言 owner identity、mode、definition status、rows/sign/quantity、unit snapshot、counting config、version，不以 HTTP 2xx 代替。
- Node test 分母以 `test-health-entry-runner.mjs --node` 退出码为准；磁盘文件数不代替 runner 分母。

### 10b.5 边界

本节只设计 seed，不执行。实施完成后的 reset/start/seed 仍需 Dexter 另行授权，并走受管入口；start 不 seed。清库原则下直接按新模型重建，不写 legacy 转换器。

## 11 · 验收场景设计

当前源码静态计数为 `77` 个 `@AcceptanceScenario`，框架硬上限为 80；静态注解数不是 discovery 证据，实施前必须由 `BackendAcceptanceScenarioCatalog.discover(this)` 实际核对 `annotated == discovered == selected == 77`。本批只新增以下 **3 个** catalog scenario；每个 method 内用具名 case table 逐 case 建独立 fixture、请求和业务断言。新增后再次核对三者均为 80，不新增 provider 壳、共享 SPI 或第二 registry。

| scenario id（能力命名） | owner 文件 | identity | fixture | request | businessOracle |
|---|---|---|---|---|---|
| `catalog.inventory-rule-admission-matrix` | `CatalogAcceptanceScenarios.java` | operations-admin，store catalog edit | 七 shape × ITEM/SKU/OPTION_VALUE × NONE/DIRECT/BOM 的 63 个独立 case；另含 dual mode、标签/属性伪 node、空 BOM、套餐内容伪 BOM | 真实 HTTP create/save/detail；每个非法 case 篡改 ownerType/ref/mode，合法 case 按 generated union 提交 | 每个 case 断言 expected mode/target/BOM、catalog version；非法 case 断言 typed code且版本/定义均不变；普通/称重无 SKU、SKU shell只读、MATERIAL无 BOM、非库存壳无 owner |
| `catalog.inventory-component-option-and-unit-semantics` | 同上 | operations-admin，store catalog+inventory edit | 101 个合格 target形成两页；五条件各一非法 target；self target；material 无销售单位有基础单位；option 正/负/实际用量；kg/g；unit rename/disable | candidate cursor 两页 + whole-save BOM/option/direct + inventory count/adjust + unit update/disable | total 是完整 101；第二页不重不漏；五条件和自引用保存均拒；缺 target 不自动建；option sign/quantity readback；0.3567kg 精确为356g；历史 BOM/ledger snapshot 不重解释 |
| `catalog.inventory-mode-switch-guard` | 同上 | operations-admin，store catalog+inventory edit | 8 个独立 owner：四个“对应维度为空”正例与四个单 blocker 拒例（非零余额、余额归零但有 ledger、active BOM 引用、pre-existing disabled definition snapshot） | 对每个 owner从 DIRECT↔BOM whole-save；前三类拒例用真实 owner operation或受控fixture建 blocker；历史拒例先真实完成一次合法切换，再请求第二次反向切换 | 四正例切换后旧定义 DISABLED、新定义 ENABLED且整体 readback；历史正例证明当前命令新产生的 DISABLED 行不阻断首次切换；四拒例 code=`INVENTORY_DEDUCTION_MODE_CHANGE_BLOCKED`、`details.blockingFacts` 精确等于单一 blocker、catalog/inventory versions与状态不变 |

### 11.1 shape × node × mode 精确矩阵

`Y` 表示该 owner/mode 合法；`R` 表示 payload 出现即拒绝。对不存在的 owner，即使 mode=NONE 也不允许客户端伪造节点，正确表达是该节点缺席。

| shape | ITEM NONE/DIRECT/BOM | SKU NONE/DIRECT/BOM | OPTION_VALUE NONE/DIRECT/BOM |
|---|---|---|---|
| `STANDARD_SALE_COUNTED` | Y/Y/Y | R/R/R | Y/R/Y |
| `STANDARD_SALE_WEIGHED` | Y/Y/Y | R/R/R | Y/R/Y |
| `SKU_VARIANT_SALE_COUNTED` | R/R/R（主壳只读且不提交） | Y/Y/Y | R/R/R |
| `MATERIAL`（RAW/SEMI_FINISHED/PACKAGING） | Y/Y/R | R/R/R | R/R/R |
| `COMPOSITE` | R/R/R | R/R/R | R/R/R |
| `SERVICE` | R/R/R | R/R/R | R/R/R |
| `BENEFIT_SHELL` | R/R/R | R/R/R | R/R/R |

`usageCapabilities` 不参与前三列准入；`BOM_COMPONENT` 只参与 component candidate 五条件。

### 11.2 正式需求 §11 十五条逐条落点

| 原场景 | 可执行断言落点 | 明确失败条件 |
|---:|---|---|
| 1 | admission matrix：标准商品 ITEM/DIRECT | 出现外部商品 selector 语义、target 不属当前 item |
| 2 | admission matrix：标准商品 ITEM/BOM 三行 | 创建商品自身 target，或组件行未按 target readback |
| 3 | admission matrix：同 owner dual payload red case | direct+BOM 同时 ENABLED |
| 4 | admission matrix：SKU_VARIANT 两 SKU 不同 mode | shell 可写、SKU mode/rows 串线 |
| 5 | admission matrix：ITEM+SKU 同时提交 red case | 同商品两 grain active |
| 6 | component/option scenario：OPTION_VALUE/BOM | option target 被创建或 DIRECT 被接受 |
| 7 | admission matrix：tag/product attribute/SKU attribute value伪 node | 任一进入 owner tree或保存成功 |
| 8 | component scenario：五条件 candidate与save双复核 | 非法 target 出现在合格结果或保存成功 |
| 9 | component scenario：无 target MATERIAL | 自动补建 target或无明确拒绝 |
| 10 | component scenario：MATERIAL无销售单位有基础单位 | 要求销售单位或无 unit snapshot |
| 11 | admission matrix：COMPOSITE/SERVICE/BENEFIT 27个 red case | 任一 owner/mode保存成功 |
| 12 | switch scenario：四 blocker | 任一 blocker 存在仍切换或做事后补偿 |
| 13 | admission matrix：无 BOM正常保存；BOM+0行拒绝 | 空 BOM active或无 BOM阻断销售资料保存 |
| 14 | component/unit scenario：合法 MATERIAL 或 SKU owner 承载 0.3567kg | 使用普通shape+SKU或结果非356g |
| 15 | component/unit scenario：rename/disable 后读历史 | BOM/ledger快照按当前单位重解释 |

### 11.3 额外强制 case 分母

- A-05 共 8 case：`BALANCE_ABSENT/PRESENT`、`LEDGER_ABSENT/PRESENT`、`BOM_REFERENCE_ABSENT/PRESENT`、`HISTORICAL_DEFINITION_ABSENT/PRESENT`；每一对一正一拒。历史 PRESENT 只能由一次先行成功切换产生 pre-existing DISABLED 行，不能直接伪造单位快照或把本次待停用 active 行计入。
- 组件资格共 6 个 red case：跨 scope、不可用、无 BOM_COMPONENT、无 StockTarget、单位不完整、自引用；candidate 隐藏与篡改 save 拒绝都断言。
- option 共 3 个业务分支：POSITIVE、NEGATIVE、actual quantity；强制原料缺行也拒绝。
- 粒度共 3 类 red case：普通/称重 SKU、SKU shape ITEM、同商品 ITEM+SKU；标签/属性/选项组目录不混入。
- 非库存壳共 27 个 shape×node×mode tamper case；COMPOSITE 组件关系单独断言不是 inventory BOM。

### 11.4 受影响 fixture 全集

`CatalogAcceptanceScenarios.java` 中当前 20 个 `saveIndependentSku*` 调用点必须全部分类迁移：单位换算2、base-unit守卫1、SKU lifecycle/引用/copy16、伪 material1。保留 SKU 业务语义的改为 `SKU_VARIANT_SALE_COUNTED`；只测 target/单位/分页的改成合法 item-level/MATERIAL fixture。同步 helper：`saveIndependentSku`、`saveIndependentSkuWithUnits`、`saveSkuBom`、`referenceRow`、`createInventoryBackedMaterialItem`、`insertInventoryBomFixture`，以及全部手写 `inventoryConfiguration`/`inventoryBom` payload。

出现即缺陷的红夹具：ordinary/weighed+SKU、ITEM+SKU active、dual mode、active empty BOM、option target、MATERIAL BOM、COMPOSITE/SERVICE/BENEFIT rule、invalid component accepted、历史切换成功。每个 red case 在拒绝后都读回 catalog version与 inventory definitions，不能只断言 HTTP code。

## 12 · 未决项处置

| 项目 | 当前状态 | 本批允许 | 本批禁止 |
|---|---|---|---|
| U-UNIT-DESIGN-01 | 已裁定：现有安全守卫 | target snapshot 会漂移时同事务拒绝 | 静默同步余额单位 |
| U-UNIT-DESIGN-02 | 已裁定：源/目标各按自身 precision | source normalize + backend BigDecimal向零截断 | 前端固定3位、四舍五入 |
| 单位详情页 | 已裁定取消 | 列表内完整维护 | 新造详情 route |
| IA错误文案 | 已裁定按 IA | owner/code/UI逐字一致 | 保留第二套文案 |
| 销售触发扣减的源数量单位 | 本专题非目标 | 只保存可被未来链路消费的定义/快照 | 新增销售换算或声称已闭合销售扣减 |
| 生产配方/半成品生产 | 本专题非目标 | MATERIAL direct + component资格 | 为 MATERIAL开放 BOM/生产入库 |

没有新的产品未决项；candidate operation、definition status 与 parameterized acceptance 是技术实现选择，不改变业务语义。

## 13 · 停机条件

出现以下任一情况必须停下单条交 Dexter，不得用 fallback：

1. owning source 发现第八种 shape、SKU shape 也允许点单选项、或正式需求矩阵与当前批准 Journey 冲突；
2. 无法从 catalog 当前事务结构唯一派生 owner identity；
3. migration 发现普通/称重 SKU inventory fact、双 active、空 active BOM 或无法解析 opaque owner；
4. 实施前源码或迁移数据发现另有已运行的扣减定义历史事实源，且与 §8.1 的 pre-existing DISABLED definition 不可兼容；
5. 现有非 whole-save 消费者仍调用拟删除 API，且不能迁到 `replaceCatalogInventoryRules` 或专用 lifecycle command；
6. backend acceptance 基线不是 `annotated == discovered == selected == 77`，导致新增3条后超过80；
7. seed 需要修改别的业务域计划才能成立；
8. 任何评审 finding 要求新增销售、生产、采购、WMS、任意单位换算或兼容层语义。

上游规格、review finding、给定数字都是待验证输入；实施时以当时真实源码和 generated exact-set 为准，差异先报告。

## 14 · 交付前自查

| 检查 | 本稿结果 |
|---|---|
| §3 行完整 | PASS：17/17，无删行、无整组 N/A |
| §3 ④ 列 | PASS：每行枚举本批 operations/queries/owners/files/identities 全集 |
| §7 机制行 | PASS：集合、授权、缓存、错误、幂等、日志均跨层展开 |
| 详设 ↔ IA | PASS：两个 IA-ID、三集合形态、四读一写、15 code、布局/文案/失效集合逐字对账 |
| seed 全集 | PASS：唯一 P1 source、executor、plan、generated outputs、三 static test、runner 均列出 |
| seed 两类 | PASS：新功能实例与旧 flat/非法 shape 调整分栏 |
| 测试分母 | PASS：CP-00 先证 `annotated == discovered == selected == 77`，新增3条后再证三者均为80；15需求、63矩阵、8 switch、6 component red、3 option branch 均有落点 |
| 证据档位 | PASS：本轮只写设计；实施期 static/focused/Testcontainers/browser 各自不越级，browser仍需另授权 |

```text
DESIGN_STATUS=READY_FOR_INDEPENDENT_DESIGN_REVIEW
IMPLEMENTATION_AUTHORITY=false
BUSINESS_RESULT=需求、Journey、交互、IA与implementation-facing design已形成可复核闭环
CLEANUP_RESULT=NOT_APPLICABLE_STATIC_DESIGN_ONLY
```
