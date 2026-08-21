---
title: 商品属性库、点单选项库与两步新建 implementation-facing 详设
status: DEXTER_WIREFRAME_REVISION_REQUIRED
createdAt: 2026-08-20
implementationAuthority: false
---

# implementation-facing 详设：商品属性库、点单选项库与两步新建

## 0. 元数据与授权边界

```text
SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
BUSINESS_SOURCE=doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-formal-requirements-analysis-codex.md
JOURNEY_REFS=doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-journey.md#7-dexter-裁决
IA_REF=doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-ia.md
INTERACTION_REF=doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-ui-interaction.md
AUTHORIZED=IA、implementation-facing 详设与串行计划的设计文档
NOT_AUTHORIZED=生产代码、契约源与生成物、数据库迁移、seed、reset、DEV、L2、UAT、数据操作、仓库控制动作
IMPLEMENTATION_AUTHORITY=false
```

## 1. 真实业务目标与方案比较

### 1.1 结构性问题

属性和点单规则今天被逐商品自由填写，导致同一业务概念的名称、值、顾客端顺序和扣料意图不一致；首步创建又没有把分类与不可改形态原子锁定。继续在 JSON 和 item-owned group/value 上打补丁，会让删除、复制和库存边界无法确定。

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A：继续扩展 `attributes_json` 与 item-owned option tables | 仍无稳定定义身份、类型化值、精确级联或一次复制闭包 | 拒绝。 |
| B：扩展现有 catalog dictionary | 父子机制可借，但会把商品属性、点单组/值、选择方式、顺序和原料模板塞入多态字典 | 拒绝，长期语义混淆。 |
| C：新建 catalog 定义族 + 商品 assignment/config，库存仍由 inventory owner 拥有 BOM | 定义复用、商品覆盖、删除止点、copy rewrite 与 owner 边界清晰 | **采用**。 |

我选了 C 而不是 A/B，因为只有 C 同时让稳定引用、定义级级联、复制语义和 inventory owner 的 BOM 真相各自有唯一住址。

## 2. CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-01 | catalog 定义族与有界读取 | catalog | 属性/点单定义、500 限制、typed problems | 正式需求、IA |
| CP-02 | 商品 assignment/config 与首步原子创建 | catalog | 0..1 分类、类型化属性、商品点单覆盖 | CP-01 |
| CP-03 | inventory 前置、BOM 删除与 copy composition | catalog+inventory | public command、REQUIRED 编排、引用重写 | CP-01/02 |
| CP-04 | edge/OpenAPI/generated 消费闭环 | catalog edge | operations-only operations/readback/problems | CP-01..03 |
| CP-05 | operations-admin 交互与刷新 | frontend | 商品主面直出、商品元数据 Modal 内库管理、Modal→Drawer、三栏、copy hard block | CP-04、交互/IA |
| CP-06 | 真实业务验收与静态/focused proof | catalog acceptance | 红夹具与行为断言 | CP-01..05 |

## 3. 横切机制对照表

| 机制 | ① 用哪个现成能力/规范 | ② 如何验证 | ③ 无现成时必须符合什么形态 | ④ 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | `CatalogOwnerService` scope task reads；G-05A | [acceptance] A scope 身份读/候选 B scope 定义被拒绝 | 新定义 read 与现有 catalog 主对象同一 read predicate | 两个库 list/detail/candidate、商品 detail、copy preflight |
| 写授权与 grant 复核 | `CreateOperationsCatalogItemOperation#execute`、`SaveOperationsCatalogItemOperation#execute` 的 REQUIRED operation 形态 | [acceptance] 无 capability 无写入 | 新定义 CRUD/删除/copy execute 均在 owner 首读后复核 grant | 所有定义/商品/copy 写 operation |
| 跨 owner 写与事务 | `CatalogInventoryCoordinator#saveCatalogItem/#coordinateSaveInventory`；`InventoryOwnerApi` public command | [acceptance] inventory 删除失败则 catalog 删除整体回滚 | catalog 不直写 inventory schema；catalog→inventory public command 同一 REQUIRED | 定义扣料原料校验、定义删 BOM、商品实际 BOM、copy |
| 集合形态与分页 | `project-memory/practices/collection-boundary-modes.md` | [acceptance] 501 定义返回 typed reject、非前500截断 | 定义 scoped SQL `LIMIT 501` 探测；不收 cursor/page | 属性库定义、选项库定义；商品赋值/组选项为 Detail |
| 缓存失效 / 改完刷新什么 | `operationsContentTabRefreshSignal`、`useRefreshVersion`、generated `operationsRtk` | [focused] mutation 只刷新商品元数据内当前库 Tab、当前 detail、受影响 item detail | 不写 app-local counter；copy execute 后重取 preflight/result | 两库 CRUD、商品保存、删除、copy |
| RTK 数据读取与加载判定 | 前端规范 §3-B `currentData`/`isFetching` | [focused] loading 不清空旧表 | 新 query 使用 generated endpoint 和当前 query identity | 商品主面、商品元数据六个 Tab、Drawer detail、copy preflight |
| 同一事实只有一个住址 | 前端规范 §3-E；owner readback | [static] 不出现 attributes JSON/本地 definition cache 镜像 | draft 只服务未提交表单，成功以 owner readback 覆盖 | 商品属性、点单配置、定义抽屉 |
| 失败可见且原因不得改写 | 前端规范 §3-D；`ContractProblemAdvice` 先例 | [focused] typed problem 留在触发 Modal/Drawer | 不把 4xx 改成网络错误或关闭 surface | 所有 mutation/copy conflict |
| owner 错误到 HTTP 的映射与注册处 | `ContractProblemAdvice`/catalog edge problem registration 当前形态 | [acceptance] typed limit/copy/selection problem code 与业务 readback | 新 code 在 OpenAPI、owner、advice、generated client 统一闭集 | 500、delete cascade、copy conflict、selection、target required |
| 幂等键构成与重放语义 | `createContentIdempotencyKey`；create/save existing operation | [acceptance] 同 key 同请求重放同 receipt | 删除/完整集合命令保持 existing idempotency pattern | 首步创建、definition save/delete、item save、copy execute |
| 生成物 | 后端规范 §2-D；`CatalogInventoryEdgeWire.java` | [static] operationId/path 不手写于 consumer | OpenAPI shard→wire registry→bindings→generated frontend client | 所有新增/变更 HTTP operation |
| 日志落点与脱敏字段 | `Slf4jSecurityDiagnosticRecorder`（backend）与 `createSafeLogger`（frontend） | [static] command log 只含 correlation/opaque refs/problem code | 不记录密码、token、cookie、原始 payload | 所有写、copy preflight/execute、acceptance diagnostics |
| 迁移回填与可逆性 | Dexter 清库裁定、formal §9 | [static] design 不出现 migration/backfill/dual write/fallback | N/A：实施时只新增现行模型，无历史恢复规则 | attributes JSON、内联组选项旧数据 |
| 前端共享行为 | `adminWideDrawerSurfaceProps`、`useDrawerFormLifecycle`、`useOverlayLock`、`useDetailDrawer` | [focused] 商品元数据 Modal 与其 Tab 内容不形成双纵滚；首步 Modal close 后才 Drawer open；定义 Drawer 无双滚动 | foundation 不足才以 app feature 说明业务理由 | 十个 screen |
| 候选/下拉数据源 | `useCursorCandidates` 仅远端原材料候选；定义候选为同一 Bounded 全量读取，分类 tree existing source | [focused] 不从商品已加载列表反推定义候选 | bounded 定义 list 不伪 cursor；原材料候选按 owner task read | 属性/组选取、原材料、分类 |
| 编码与名称呈现 | G-05B、`NameCodeText`/`formatNameCode` | [static] 库列表名称首列链接、编码独立列；商品属性定义编码可改，点单组选项组/值编码创建后不可编辑 | 属性定义以 stable ref 维系可改编码；点单组选项组/值 update payload 不接收编码变更 | 两库 list/detail、copy conflict |
| 原子组 | charter §5-C | [acceptance] definition delete 后 catalog config 与 inventory option BOM 同时消失或都不变 | delete catalog refs→inventory public delete→commit/rollback | 属性删除、组选项删除、copy execute |

## 4. CP 门控与精确改造锚点

### CP-01 · 定义族与 Bounded 读取

- 路径：`modules/catalog/.../CatalogOwnerService` 新定义 aggregate/repository；替换而非改名 `CatalogOrderOptionFacts#readByItemRefs/#replace/#insertForCopy` 的 item-owned 语义。
- 读取：每个定义库以 scoped ordered SQL `LIMIT 501`；第 501 条存在即 `CATALOG_DEFINITION_LIMIT_EXCEEDED` typed 4xx，不返回前 500，不 HTTP500。**常规约100，源码上界500（五倍余量）；500是异常信号，不是常规门槛。**
- FORBID：不扩张 SKU_ATTRIBUTE/SKU_ATTRIBUTE_VALUE 或 ORDER_OPTION_VALUE；不分页、不静默截断。
- 编码：商品属性定义编码可改且 stable ref 不变；点单选项组和组内可选项编码仅在创建时写入，update command 不接受编码变更。

### CP-02 · 商品事实与两步创建

- 路径：`CatalogOwnerApi.CatalogItemCreateCommand`、`CatalogOwnerService#createCatalogItem/#createItem/#lockAndValidateCategoryRefs/#validateDeclaredOpaqueReferences`、`CreateOperationsCatalogItemOperation#execute`、`SaveOperationsCatalogItemOperation#execute`。
- 首步 create 扩为 `categoryRef?`，在已有 REQUIRED 事务中写 DRAFT 与 0..1 `catalog_item_category`；不先 create 再 PATCH，不保留 `attributesJson`。
- 商品保存只接定义引用和值/覆盖；MULTIPLE max=1 在 catalog validation/readback 仍为 MULTIPLE。

### CP-03 · Inventory 前置、级联和复制

- 建库扣料原料：catalog command 调 inventory public existence/resolution judgement，要求同 scope 既有可解析 StockTarget；商品配置仅保存每份用量，不重判库存就绪。
- 删除：属性定义删除和整个点单组选项定义删除是明确 command。单个库值删除是点单选项定义**整体 update** 中的待删除差集：catalog owner 锁定并删除该值的 override，再调 inventory public command 删除其对应 option-value BOM；同一 REQUIRED，保留 item/StockTarget/material，也不删除同组其余值。
- copy：`CatalogInventoryCoordinator#preflightBrandCopy/#executeBrandCopy`、`CatalogOwnerService#copyPreflight/#validateCopyCompatibility/#rewriteReferences/#copyReferenceObjectType`。定义类型/可选项/强制原材料模板的同码差异为 `BLOCKED`，计入 blockingCount、不进 confirmationRequiredCount；execute 重跑 preflight/digest。
- 反例：当前缺 StockTarget 的 copy 可计划 create/mapping，不得误改成该场景 hard block。

### CP-04..06 · Edge、UI 与证据

- Edge：`OperationsCatalogInventoryController` → `BackendPerformanceM1CommandExecutionBindings` → `*OperationsCatalog*Operation` → typed owner APIs；OpenAPI paths `catalog-item-management.paths.json` / `catalog-dictionary-management.paths.json` 与 `CatalogInventoryEdgeWire.java`/generated client 同步。
- UI：替换 `CatalogItemCreateDrawer` 为 Modal；替换 `CatalogItemDrawer#OrderOptionsEditor` 的内联/FIXED 模型；`CatalogWorkbenchPage` 删除整个顶层 Tab 容器，商品主面直出，`CatalogDictionaryDrawer` 的既有商品元数据 Modal 增加并列的商品属性库/点单选项库 Tab；保留商品详情 handoff，使用 stable definition refs。
- 证据：只设计静态/focused/acceptance，不执行 Testcontainers、DEV或L2。

## 5. operation / path / face / 集合形态

| 业务意图 | operationId | method/path | face | 集合形态 | 预期规模与增长驱动 | acceptance scenario |
| --- | --- | --- | --- | --- | --- | --- |
| 读商品属性库 | `listOperationsCatalogAttributeDefinitions` | `GET /operations/catalog-inventory/attribute-definitions` | operations-admin | `Bounded(500)` | 常规约100；总部/门店不断增加可复用描述定义；500 为五倍余量及异常信号，501 typed reject。 | `catalog.attribute-definition-list-limit` |
| 新建商品属性定义 | `createOperationsCatalogAttributeDefinition` | `POST /operations/catalog-inventory/attribute-definitions` | operations-admin | definition `Detail` aggregate | 当前定义及其选择项；选择项数量随单一属性业务含义增长，不设无依据上限。 | `catalog.attribute-definition-create-update` |
| 更新商品属性定义 | `updateOperationsCatalogAttributeDefinition` | `PATCH /operations/catalog-inventory/attribute-definitions/{definitionRef}` | operations-admin | definition `Detail` aggregate | 同上；U-03 不在本批假定已使用定义的类型/选项更新策略。 | `catalog.attribute-definition-create-update` |
| 删除商品属性定义 | `deleteOperationsCatalogAttributeDefinition` | `DELETE /operations/catalog-inventory/attribute-definitions/{definitionRef}` | operations-admin | single mutation readback | 删除影响当前 scope assignment/value，商品保留。 | `catalog.attribute-definition-delete-cascade` |
| 读点单选项库 | `listOperationsCatalogOrderOptionDefinitions` | `GET /operations/catalog-inventory/order-option-definitions` | operations-admin | `Bounded(500)` | 常规约100；总部/门店不断增加可复用点单规则；500 为五倍余量及异常信号，501 typed reject。 | `catalog.order-option-definition-list-limit` |
| 新建点单选项定义 | `createOperationsCatalogOrderOptionDefinition` | `POST /operations/catalog-inventory/order-option-definitions` | operations-admin | definition `Detail` aggregate | 可选项及每项扣料原料受一个点单问题/配方约束；不随库总量增长。 | `catalog.order-option-definition-create-update` |
| 更新点单选项定义 | `updateOperationsCatalogOrderOptionDefinition` | `PATCH /operations/catalog-inventory/order-option-definitions/{definitionRef}` | operations-admin | definition `Detail` aggregate | 同上；可选项顺序/强制原料随该 aggregate readback；待删除值作为整体差集清其 override/BOM、其余值保留。 | `catalog.order-option-definition-create-update`、`catalog.order-option-definition-value-delete-cascade` |
| 删除整个点单选项定义 | `deleteOperationsCatalogOrderOptionDefinition` | `DELETE /operations/catalog-inventory/order-option-definitions/{definitionRef}` | operations-admin | single mutation readback | 清除引用该组的 config/override/BOM，商品/target/material保留。 | `catalog.order-option-definition-delete-cascade` |
| 首步创建商品 | `createOperationsCatalogItem` | 既有 `POST /operations/catalog-inventory/items` 演进 | operations-admin | single resource | 单一 DRAFT；`categoryRef?`，不以 categoryRefs 数组模拟。 | `catalog.item-create-draft-category` |
| 保存商品属性与点单配置 | `saveOperationsCatalogItem` | 既有 `PATCH /operations/catalog-inventory/items/{itemCode}` 演进 | operations-admin | item `Detail` aggregate | 属性赋值与组选项配置均由单商品业务描述/可选服务数约束，不随定义库总量增长。 | `catalog.item-attribute-and-order-option-save`、`catalog.option-selection-mode-and-range` |
| 品牌复制预检 | `preflightOperationsBrandCatalogCopy` | 既有 `POST /operations/catalog-inventory/copy/brand/preflight` 演进 | operations-admin | copy-request `Detail` readback | 结果由本次复制闭包决定；同码语义差异硬阻断，不套定义库 500 上限。 | `catalog.copy-definition-semantic-conflict` |
| 品牌复制执行 | `executeOperationsBrandCatalogCopy` | 既有 `POST /operations/catalog-inventory/copy/brand/execute` 演进 | operations-admin | copy-request `Detail` readback | execute 重跑预检/digest；BLOCKED 不允许写入。 | `catalog.copy-definition-semantic-conflict` |

## 6. 跨 owner 写矩阵

| policy | 第一个 owner command | 第二个 owner command | 事务 | 失败时回滚 |
| --- | --- | --- | --- | --- | --- | --- |
| 定义扣料原料保存 | catalog definition command | inventory target resolution judgement | REQUIRED | 定义不保存 |
| 商品实际用量保存 | catalog item config save | `InventoryOwnerApi#saveCatalogItemProductBom` | REQUIRED | config/BOM 均不变 |
| 属性定义删除 | catalog delete/attribute assignment cleanup | N/A：没有 inventory BOM | REQUIRED | 商品仍在；assignment/value均不删 |
| 整个点单选项定义删除 | catalog definition/config/override cleanup | 新 inventory option-value BOM delete command（该组所有值） | REQUIRED | config/override/BOM均不删 |
| 点单选项定义更新（含待删值差集） | catalog child value/override cleanup | 新 inventory option-value BOM delete command（仅待删值） | REQUIRED | 该值的override/BOM均不删；同组其余值不变 |
| 品牌复制 | catalog preflight/execute | inventory preflight/execute | REQUIRED execute | closure/ref rewrite/BOM 不产生半成品 |

## 7. 声明—传递—消费矩阵

| fact | 契约层声明 | owner 层履行 | 前端层消费 | proof |
| --- | --- | --- | --- | --- |
| 集合形态 | 定义库 read 无 cursor/page，声明 `Bounded(500)`、常规约100/五倍余量/501 reject；商品 read 是 Detail | scoped `LIMIT 501`、501 typed 4xx；assignment/config 作为 item aggregate 返回 | 两库全量列表无 pager，501 显示业务错误；商品页不做本地 slice | acceptance 501 fixture；static 无 slice/cursor |
| 授权执行点 | 每 route 只声明 `operations-admin` 及对应 capability | edge operation 进入 REQUIRED 后，catalog/inventory owner 重检 scope/grant/current facts | UI 只呈现拒绝，不本地推导可写性 | acceptance cross-scope/no-capability |
| 缓存失效 | mutation readback / generated RTK tag 与内容页 refresh signal 声明商品元数据当前库 Tab、detail、受影响 item | owner 成功 receipt/readback 决定失效对象，无跨 scope 广播 | `operationsContentTabRefreshSignal`/`useRefreshVersion` 精确重取当前商品元数据 Tab/detail；不重取 SKU 销售属性等无关 Tab | focused query identity |
| 错误映射 | OpenAPI problem schema 统一声明 typed limit/delete/copy/range/原材料问题 | `CatalogInventoryEdgeWire` 与 `ContractProblemAdvice` 注册同一 problem code | Modal/Drawer 就地呈现业务提示；BLOCKED 无确认操作 | acceptance problem code + focused render |
| 日志与脱敏 | contract 不声明敏感 payload；相关 operation 有 correlation/opaque reference 诊断字段 | command/copy log 只写 correlation、opaque ref、problem code；不写密码/token/cookie/raw payload | 前端不把敏感错误细节或原始 payload 作为文案显示 | static red search；受管运行另行授权 |
| 容器行为 | interaction `CONTAINER_LAYOUT` 是静态声明，IA `containerBehaviorUnderLoad` 是数据行为声明 | N/A：owner 不参与 CSS 容器布局 | 商品主面无顶层 Tab；商品元数据 Modal 单 body 滚动、六个 Tab 并列；wide Drawer/body 单滚、窄屏堆叠、长内容截断提示 | focused layout/static；L2未授权 |

## 8. 业务规则 → owner 判定点

| 规则 | owner 判定点 |
| --- | --- |
| 属性 TEXT/SINGLE/MULTIPLE 与选项归属 | catalog definition/item save |
| 属性编码可改且同 scope 唯一 | catalog definition update |
| 点单选项组与组内可选项编码创建后不可改 | catalog order-option definition create/update validation；update command 无编码变更字段 |
| 属性删除只清 assignment/value | catalog delete command |
| 单选/多选、min/max/default | catalog item config save |
| 强制扣料原料已有 StockTarget | catalog definition save → inventory resolution judgement |
| 商品只填每份用量 | catalog item config save → inventory BOM save |
| 整个组选项删除清 config/override/BOM 而保留三类事实 | coordinator delete composition |
| 点单选项定义更新中的待删值只清该值的 override/BOM 而保留同组其他值 | coordinator aggregate-update composition |
| 同码语义 copy hard block | catalog copy preflight + execute recheck |
| 500上界 | catalog bounded list owner read |

## 9. owner API 与消费者

| owner 方法/锚点 | 消费者 |
| --- | --- |
| `CatalogOwnerApi` attribute definition list/create/update/delete commands | `List/Create/Update/DeleteOperationsCatalogAttributeDefinitionOperation`、copy coordinator |
| `CatalogOwnerApi` order-option definition list/create/update/delete commands | `List/Create/Update/DeleteOperationsCatalogOrderOptionDefinitionOperation`、copy coordinator |
| `InventoryOwnerApi` target resolution judgement | catalog definition command |
| `InventoryOwnerApi` option-value BOM delete command | group-delete and definition-update-diff catalog coordinators |
| `CatalogInventoryCoordinator#saveCatalogItem/#preflightBrandCopy/#executeBrandCopy` | `SaveOperationsCatalogItemOperation`、`PreflightOperationsBrandCatalogCopyOperation`、`ExecuteOperationsBrandCatalogCopyOperation` |
| generated operations client | operations-admin catalog feature only |

## 9b. 变更定位

唯一锚点：`CatalogOwnerService#createCatalogItem`、`CatalogOwnerService#lockAndValidateCategoryRefs`、`CatalogOwnerService#validateDeclaredOpaqueReferences`、`CatalogOrderOptionFacts#replace`、`CatalogInventoryCoordinator#coordinateSaveInventory`、`CatalogOwnerService#validateCopyCompatibility`、`CatalogOwnerService#rewriteReferences`、`CatalogItemDrawer#OrderOptionsEditor`、`CatalogItemCreateDrawer`、`CatalogWorkbenchPage`、`CatalogDictionaryDrawer`、`CatalogDefinitionLibraries`。

## 10. 数据迁移

| 迁移 | 加/改什么 | 旧行回填取什么值 | 为什么那是唯一可恢复的事实 | 可否回滚 |
| --- | --- | --- | --- | --- |
| 旧 attributes JSON、item-owned order options、旧 categoryRefs 多选 | N/A：按新现行模型替换旧事实形态 | N/A：Dexter 已裁定清库 | N/A：不保留历史业务数据，故不存在可恢复旧事实 | N/A：本批禁止设计迁移/兼容层/fallback/双写/收敛规则 |

## 11. 验收场景设计

所有场景归 `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java`，通过真实 HTTP、真实 route 常量、非空 identity/fixture/request/businessOracle。

| scenario id | owner 文件 | identity | fixture | request | businessOracle |
| --- | --- | --- | --- | --- | --- |
| `catalog.attribute-definition-list-limit` | `CatalogAcceptanceScenarios.java` | 可读当前 scope 身份 | 501 同 scope 属性定义 | list attribute definitions | `CATALOG_DEFINITION_LIMIT_EXCEEDED`，不返回截断列表 |
| `catalog.attribute-definition-create-update` | `CatalogAcceptanceScenarios.java` | 可写当前 scope 运营身份 | 文本、单选和多选定义输入 | create 后 update | stable definitionRef 不变，编码可改且同 scope 唯一，typed value definition readback 正确 |
| `catalog.attribute-definition-delete-cascade` | `CatalogAcceptanceScenarios.java` | 可写当前 scope 运营身份 | 定义+两个商品赋值 | 删除属性定义 | 两商品仍可读取；属性 assignment/value 不存在 |
| `catalog.order-option-definition-list-limit` | `CatalogAcceptanceScenarios.java` | 可读当前 scope 身份 | 501 同 scope 点单选项定义 | list order-option definitions | `CATALOG_DEFINITION_LIMIT_EXCEEDED`，不返回截断列表 |
| `catalog.order-option-definition-create-update` | `CatalogAcceptanceScenarios.java` | 可写当前 scope 身份 | SINGLE/MULTIPLE 定义、创建时组/值编码、排序值、可解析 StockTarget 的原料 | create 后以改变后的组/值编码 update | 顺序、模式和当前值的原料模板从完整 aggregate readback；无 target 原料拒绝；组/值编码变更拒绝 |
| `catalog.order-option-definition-delete-cascade` | `CatalogAcceptanceScenarios.java` | 可写当前 scope 身份 | 定义+商品配置/覆盖+BOM+StockTarget+原材料商品 | 删除整个组选项定义 | config/override/BOM 消失；商品/target/material仍在 |
| `catalog.order-option-definition-value-delete-cascade` | `CatalogAcceptanceScenarios.java` | 可写当前 scope 身份 | 一个组、两个值，各有独立商品覆盖/BOM | 删除其中一个库值 | 仅该值的 override/BOM 消失；同组另一值、商品/target/material仍在 |
| `catalog.copy-definition-semantic-conflict` | `CatalogAcceptanceScenarios.java` | 可读源、可写目标 | 同码不同 type/options/material template | preflight后execute | typed BLOCKED 定位冲突；execute无写入/确认路径 |
| `catalog.option-selection-mode-and-range` | `CatalogAcceptanceScenarios.java` | 可写商品身份 | MULTIPLE 定义与商品配置 | FIXED、非法 min/max、max=1 | FIXED typed reject；max=1 readback仍MULTIPLE |
| `catalog.item-attribute-and-order-option-save` | `CatalogAcceptanceScenarios.java` | 可写商品身份 | 同商品的属性定义、组选项定义、已有目标 | PATCH item typed assignment/config | 属性值、required/min/max/default/extraPrice/actual quantity readback；商品侧不重判原料库存就绪 |
| `catalog.item-create-draft-category` | `CatalogAcceptanceScenarios.java` | 可写商品身份 | 分类树节点 | create(categoryRef?) | DRAFT/resourceRef/version/category readback原子成立 |

## 12. 未决项处置

| 项目 | 当前状态 | 本批允许 | 本批禁止 |
| --- | --- | --- | --- |
| 已使用属性定义类型/选择项更新 | U-03 | 保留 typed problem/决策依赖 | 猜测迁移策略 |
| 定义库真实长期规模/搜索需求 | U-05 部分未决 | 按已裁定 500 bounded | 把常规100当上界或提前分页 |
| 未来历史事实删除 | U-06 | 明确当前不覆盖 | 假装历史已解决 |

## 13. 停机条件

若 U-03 影响 API/DB 的已使用属性定义更新语义；若现有 owner 无法提供在同一 REQUIRED 下的 target resolution 或 BOM delete public command；若 500 新 typed problem 无统一契约/edge 注册位置，必须停下交 Dexter 或设计 review，不以 JSON、前端补偿或跨 schema 直写替代。

## 14. 交付前自查

§3 17 行完整；§3 第④列列出全部 operation/screen；§7 含五个机制行；500/常规100/五倍余量/501 reject 在 IA、§5、§7、§11一致；十个 screen 的 `CONTAINER_LAYOUT` 与 IA一致；商品主面无顶层 Tab、商品元数据 Modal 六个并列 Tab、点单组选项组/值编码创建后不可改均已与交互工件逐字对账；动态与浏览器证据均标未授权；本设计不构成 implementation authorization。
