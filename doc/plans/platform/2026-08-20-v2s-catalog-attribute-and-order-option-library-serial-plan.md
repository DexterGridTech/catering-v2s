SERIAL_PLAN_KIND=ONE_BATCH_INTERNAL_SERIAL_CP

# 商品属性库、点单选项库与两步新建：一批串行实施计划

> 状态：`DEXTER_WIREFRAME_REVISION_REQUIRED`
>
> 本文件只规定获后续实施授权时的一条内部串行路径，不拆分这一个业务批次为独立交付，不构成实施、运行、数据或仓库控制授权。

## 1. 目标、唯一输入、设计输出与结束条件

### 1.1 业务目标

在不改变 catalog/inventory owner 边界、双管理后台边界或商品形态不可变规则的前提下：

- 让总部/门店私有的商品属性定义被多商品选择并填写类型化值；
- 让点单选项定义统一维护顾客端顺序与扣料原料，商品只维护本商品策略与每份用量；
- 让首步 Modal 原子创建带可空单分类的 DRAFT，再无表面重叠地进入编辑 Drawer；
- 让复制、删除、库存前置和 500 条定义库异常都在 owner command 中有可观察、可拒绝的结果。

### 1.2 唯一输入与设计工件

业务/裁决输入：

- `doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-formal-requirements-analysis-codex.md`
- `doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-journey.md`

本批设计输入：

- `doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-ui-interaction.md`
- `doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-ia.md`
- `doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-implementation-design.md`

设计期结束条件：四份设计工件、独立设计盲审与作者 intake、Claude DESIGN brief 都存在且相互无矛盾。结束条件不是 implementation GO。

## 2. 总体串行边界

```text
PRE-FREEZE 设计冻结 / 未决检查
  -> CP-01 catalog 定义族与现行持久化事实
  -> CP-02 商品 assignment/config 与首步原子创建
  -> CP-03 inventory public judgement / delete 与跨 owner composition
  -> CP-04 edge contract / generated consumer chain
  -> CP-05 operations-admin 库管理与商品编辑
  -> CP-06 copy preflight/execute、backend acceptance 与静态/focused/HTTP 独立复核
  -> （只在另行授权后）受管 DEV / L2 / UAT
```

每个 CP 必须先完成上游的 owner readback、拒绝路径和对应低档验证，才可进入下一 CP。任何未来动态运行必须分开报告 business 与 cleanup；本计划不授权它们。

## 3. PRE-FREEZE：设计冻结与实施 admission

**owner**：实施会话；产品裁决仍归 Dexter。

**进入条件**：四项输入均已被重新读取；交互看图结论已反映 Dexter 2026-08-20 的商品主面直出/商品元数据 Modal 裁定；U-03/U-05/U-06 未被伪装成已定契约；点单组选项组/值编码创建后不可改已落实为确定规则。

**动作顺序**：

1. 每个实际修改点逐项重开正式需求、Journey、交互、IA、六维 memory、owning source 与对应详设锚点；
2. 检查 500 是代码上界、常规约100、501 typed reject，而不是分页条件或业务常态；
3. 检查清库裁定排除了迁移、兼容、双写和 fallback；
4. 若 U-03 落到具体已使用定义的类型或选择项更新字段，停止该点向 Dexter 求裁；组/值编码更新不是可选设计，必须拒绝。

**禁止/失败**：把自由 JSON、item-owned 选项、SKU 属性、`ORDER_OPTION_VALUE` 或单元素 `categoryRefs[]` 作为兼容层；把未决更新规则写进字段约束。

**验证**：静态逐条对照四份文档；[静态] 对新路径做同根搜索，确认没有旧模型残留的双真相。

## 4. CP-01：catalog 定义族与有界读取

**owner**：catalog。**目标锚点**：`CatalogOwnerService#createCatalogItem`、`#lockAndValidateCategoryRefs`、`#validateDeclaredOpaqueReferences`、`CatalogOrderOptionFacts#replace`、`CatalogOwnerApi.CatalogItemCreateCommand`。

**动作顺序**：

1. 以独立 definition/assignment/config 聚合替换属性 JSON 与 item-owned 点单组选项事实；不扩张 SKU 属性或普通 dictionary 为多态库；
2. 属性库与点单选项库各使用 scope 内有序 `LIMIT 501` 读取：常规约100、源码上界500（五倍余量），第501条 owner 返回 typed problem，绝不分页/截断；
3. 属性定义保存 stable ref、可改且同 scope 唯一的编码、TEXT/SINGLE/MULTIPLE 与可选项；删除只清本 scope 商品赋值和值；
4. 点单选项定义保存 SINGLE/MULTIPLE、顾客端顺序和每个可选项的强制原料意图；组和值编码仅在创建时写入、之后不可修改；商品不能改写这些定义事实。

**失败条件**：前 500 静默返回、501 HTTP500、点单组选项组/值编码可在创建后修改、商品能改库定义名称/顺序/原材料、FIXED 可被保存。

**验证**：[focused] owner 指定边界与 ref 稳定性测试；[acceptance] 两个501、定义创建/更新、属性级联；不运行 DEV/L2。

## 5. CP-02：商品 assignment/config 与首步原子创建

**owner**：catalog。**目标锚点**：`CatalogOwnerApi.CatalogItemCreateCommand`、`CatalogOwnerService#createCatalogItem/#createItem/#lockAndValidateCategoryRefs/#validateDeclaredOpaqueReferences`、`CreateOperationsCatalogItemOperation#execute`、`SaveOperationsCatalogItemOperation#execute`。

**动作顺序**：

1. 删除 `attributes` 自由 JSON 事实，商品属性只保存 definitionRef 与 TEXT/SINGLE/MULTIPLE 类型值；不得复用 SKU 销售属性；
2. 商品点单配置只保存 group definitionRef、required/min/max/default/extra price/实际每份用量；`MULTIPLE max=1` 仍为 MULTIPLE，拒绝 FIXED；
3. 扩展既有 create command，以可空单一 `categoryRef` 在同一 REQUIRED 中写 DRAFT 与唯一分类关系；不 create 后 PATCH；
4. 商品保存只接受库定义引用与允许覆盖，不接受定义名称、顾客端顺序、库强制原料或自由 JSON。

**失败条件**：商品仍提交自由 JSON、分类以数组兼容、max=1 被转为 SINGLE、商品保存重复判断库存就绪、商品可写库定义事实。

**验证**：[focused] stable ref/typed value/category scalar；[acceptance] FIXED/min/max/max=1、DRAFT+category、商品属性与点单配置 readback。

## 6. CP-03：inventory public judgement、级联与复制编排

**owner**：catalog + inventory。**目标锚点**：`CatalogInventoryCoordinator#saveCatalogItem/#coordinateSaveInventory/#preflightBrandCopy/#executeBrandCopy`、`InventoryOwnerApi#saveCatalogItemProductBom`、`CatalogOwnerService#copyPreflight/#validateCopyCompatibility/#rewriteReferences/#copyReferenceObjectType`。

**动作顺序**：

1. 点单选项定义保存强制原料时，catalog 在同一写动作调用 inventory public target resolution judgement：原材料必须在同 scope 有已存在、可解析的 StockTarget；
2. 商品保存只传每份实际用量给 inventory public BOM save；不得再次判断原材料是否已有库存对象；
3. 属性定义删除与整个点单选项定义删除是明确命令；单个库值删除是点单选项定义整体更新中的待删除差集。catalog 分别清除 assignment、该组 config/override，或仅待删除值的 override；整个组或待删除值再调 inventory public command 清除对应 option-value BOM，全部写入在同一 REQUIRED，失败整体回滚；待删除值不得影响同组其他值；
4. 扩展 copy closure、reference plan 与 rewrite，使定义、赋值、配置和实际 BOM 纳入；同码类型/可选项/强制原料模板差异为 `BLOCKED`，不可确认；execute 重跑 preflight/digest。

**禁止/失败**：catalog 直写 inventory schema、前端补偿删除、把 option value 变为库存对象、目标门店无 target 一律硬阻断（现状可规划 create/mapping）、把语义冲突放入 confirmation。

**验证**：[focused] REQUIRED rollback/readback；[acceptance] 三清除三保留、原料前置、copy BLOCKED 定位且 execute 无写入。

## 7. CP-04：operations edge、契约与生成消费链

**owner**：catalog edge；事实仍由 owner command 保存。

**目标路径**：`OperationsCatalogInventoryController`、`BackendPerformanceM1CommandExecutionBindings`、`contracts/openapi/paths/operations-admin/catalog-item-management.paths.json`、`catalog-dictionary-management.paths.json`、`contracts/catalog/CatalogInventoryEdgeWire.java`。

**动作顺序**：

1. 先在 OpenAPI shard 定义库 CRUD/read、typed problems、现有 item/create/save/copy 的演进；每个 route 只标 `operations-admin`；
2. 再使 wire registry、binding、named REQUIRED operation、typed owner API 和 generated operations client 同步；
3. 使问题 code 从 owner→edge→生成客户端→可见业务提示有唯一闭集；日志只含 correlation/opaque reference/problem code，不含敏感原始 payload；
4. 为定义删除、商品保存和 copy execute 复用既有幂等/readback 形态。

**禁止/失败**：手写 app transport/path 字符串、read edge 推导写权限、generic JSON owner write、未注册 typed problem。

**验证**：[静态] source→wire→generated consumer readback；[focused] typed problem 表现与 idempotency replay；[acceptance] 新 operation businessOracle。

## 8. CP-05：operations-admin 库管理与商品编辑

**owner**：`apps/frontend/operations-admin`；不在 platform-admin 添加入口。

**目标锚点**：`CatalogWorkbenchPage`、`CatalogDictionaryDrawer`、`CatalogDefinitionLibraries`、`CatalogItemCreateDrawer`、`CatalogItemDrawer#OrderOptionsEditor`、`BrandCatalogCopyDrawer`，以及 foundation 的 `adminWideDrawerSurfaceProps`、`useDrawerFormLifecycle`、`useOverlayLock`、`useDetailDrawer`、`useCursorCandidates`、`operationsContentTabRefreshSignal`。

**动作顺序**：

1. 删除 `CatalogWorkbenchPage` 整个顶层 Tab 容器，商品主面直出；将两个全量 Bounded 库页签放入既有 `CatalogDictionaryDrawer` 商品元数据 Modal，与商品标签、销售单位、SKU 销售属性、商品处理标签六项并列。名称首列进入详情，编码独立列；不能用分页/cursor 逃避501；
2. 用 Modal 替换首步 Drawer：仅编码、名称、单选可空分类树、形态及业务说明。成功 readback 后先关闭 Modal，在 `afterOpenChange(false)` 后以编辑态打开同一商品 Drawer；关闭 Drawer 保留服务端 DRAFT；
3. 用稳定 definitionRef 的类型化属性 UI 替换 JSON；无自由键值输入；
4. 保留商品点单页三栏布局但替换内联语义：左选库组、中间本商品设置、右顾客端显示效果。max=1 显示“多选（最多1项）”；
5. 点单选项定义 Drawer 用左有序可选项稳定选择当前项、右仅当前项“扣料原料”的主从结构；组和值编码仅在新建时编辑、已有项只读；整 Drawer body 唯一纵滚，窄时左后右堆叠，绝不混排各项原料或使用技术词；
6. 只以 generated RTK readback/refresh signal 刷新商品元数据当前库 Tab、detail、受影响商品；不刷新 SKU 销售属性等无关 Tab；copy hard block 不提供确认或覆盖操作。

**禁止/失败**：重造 foundation overlay/Drawer/list lifecycle、商品工作台恢复顶层 Tab 容器、两个定义库出现在商品元数据 Modal 之外、两个滚动祖先、1280 以下横滚、Drawer 与 Modal 重叠、库定义在商品页可编辑、点单组选项组/值编码在创建后可编辑、显示“组件/target/BOM”等技术词。

**验证**：[focused] 商品主面无顶层 Tab、商品元数据 Modal 六个并列 Tab、Modal handoff、single category scalar、无 JSON/FIXED、max1 仍多选、组/值编码不可变、主从动态集合、BLOCKED 无 confirmation；静态检查十项 `CONTAINER_LAYOUT`。浏览器 L2 仅另行授权。

## 9. CP-06：backend acceptance 场景与红夹具

**owner 文件**：`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java`。

**动作顺序**：按 implementation design §11 的全部能力命名场景（定义库读、新建/更新/删除、单值删除、商品保存、复制、创建）填真实 identity、fixture、request、businessOracle；所有 list 上界夹具创建 501，而不是 500；执行场景用真实 route registry 常量。

**红夹具**：

- 删除属性定义后，商品仍在而 assignment/value 消失；
- 删除组选项后，商品/StockTarget/原材料商品仍在而 config/override/option-value BOM 消失；
- 同编码不同语义在 preflight 为不可确认 BLOCKED，execute 不写入；
- FIXED、非法 min/max 被拒绝，max=1 readback 仍为 MULTIPLE；
- 点单选项组或组内可选项在 update 中携带改变后的编码被拒绝，原编码 readback 保持不变；
- create 的 categoryRef 与 DRAFT/resourceRef/version 原子 readback；
- 501 definition 返回 typed limit，绝不返回静默截断列表。

**禁止/失败**：只断言状态码、路径、`response.ok` 或无异常；不造超过边界的 fixture；把 Modal→Drawer 说成后端 HTTP 证明。

**验证**：[acceptance] 真实 HTTP 与真正业务字段/副作用 oracle；本批不执行 Testcontainers。

## 10. POST-VERIFY：静态、focused、acceptance 与评审收口

**动作顺序**：

1. source→OpenAPI/wire→generated Java/TS→consumer 的静态读回；
2. owner/协调器与前端 focused tests；
3. 经另行测试执行授权后，Catalog acceptance 真实 HTTP；
4. fresh 独立对抗审查、作者辩证 intake、Claude DESIGN review；
5. 只有 Dexter 后续明确授权时才进入 managed DEV、browser L2 或 UAT。

**动态退出分层**：静态/focused/HTTP acceptance 都不是 DEV、L2 或 UAT；任一将低档证据写成高档，即本 CP 失败。将来动态运行仍须按受管 manifest、日志、first failure/last known good/broken boundary 及 business/cleanup 分开收口。

## 11. 硬停止清单

- U-03（已使用属性定义的更新）影响具体约束时；
- inventory 无法在同一 REQUIRED 提供 public target resolution judgement 或 option-value BOM delete command 时；
- 501 typed problem 没有统一 contract/edge/generated 注册位置时；
- 任一 UI screen 不能保持单一滚动、窄屏堆叠且无需技术术语时；
- copy preflight 无法表示不可确认 `BLOCKED` 语义冲突时。

不得以 JSON 兼容、前端补偿、跨 schema 直写、普通确认项或扩大范围绕过停止条件。

## 12. 实施期交接

实现前逐点重新读取本计划 §3–10、四份设计工件、当前 owning source 与六维 memory；实现后用相同原文回读。实施授权、任何 runtime 以及仓库控制均仍由 Dexter 单独决定。
