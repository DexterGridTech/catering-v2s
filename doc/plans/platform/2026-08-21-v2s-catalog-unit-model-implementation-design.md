SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

---
title: 商品计量、销售单位与库存单位优化 · implementation-facing 详设
status: ACCEPTED_FOR_IMPLEMENTATION
---

# 商品计量、销售单位与库存单位优化 · implementation-facing 详设

## 0. 元数据、授权与边界

```text
BUSINESS_SOURCE=doc/plans/platform/2026-08-21-v2s-catalog-unit-model-optimization-requirements-analysis-codex.md#unit-formal-model
JOURNEY_SOURCE=doc/decisions/2026-08-21-v2s-catalog-unit-model-journey.md#unit-model-journey
UI_INTERACTION_SOURCE=doc/decisions/2026-08-21-v2s-catalog-unit-model-ui-interaction.md
IA_SOURCE=doc/decisions/2026-08-21-v2s-catalog-unit-model-ia.md
DEXTER_WIREFRAME_REVIEW=ACCEPTED
IMPLEMENTATION_AUTHORITY=true
```

Dexter 要求先形成完整草案供整体审阅。本文件仅规定未来实现应满足的形态；不授权代码、契约生成物、迁移、seed、reset、DEV、L2、UAT 或数据操作。交互工件尚未获得线框确认，故本文不能作为任何实施准入。

## 1. 结构性业务问题与方案选择

当前 `salesUnitRefs[]` 将一个商品的售卖口径做成多选；`inventory.stock_target.measure_mode` 又被当作消耗单位，库存盘点和 BOM 的自由文本换算没有稳定快照。这不是 Select 控件问题，而是销售单位、基础计量单位、消耗单位、盘点单位四种事实混为一层。

| 方案 | 形态 | 结论 |
| --- | --- | --- |
| A. 只把销售单位控件改成单选 | 保留 `SALES_UNIT` 通用字典、数组/sections、measureMode 伪单位和自由文本盘点。 | 拒绝：只止血，不提供基础单位、SKU 覆盖、库存快照、历史不重解释或复制重写。 |
| B. 销售/库存/盘点各建一套单位库 | 每域自己定义 kg、g、份等。 | 拒绝：同一个单位有三套真相，跨 owner 只能靠名称/编码猜测，复制和快照必漂移。 |
| C. catalog 拥有一套单位定义；商品/SKU保存两个单值角色；inventory 持久冻结快照 | 单位定义一次；销售和基础计量从同一库选；库存只接收有效基础单位快照，盘点只持录入换算。 | **选择 C 而非 A/B**：唯一保留单位语义、SKU覆盖、owner 边界和历史可追溯性，同时不引入任意单位两两换算引擎。 |

### 1.1 冻结模型

- `catalog.unit_definition`：`unitRef`、scope/brand、`code`、`name`、`unitDimension`、`precision`、`status`、`version`。编码在同 scope 唯一；`precision=0` 表示只能整数。
- 商品默认：`salesUnitRef`、`baseMeasureUnitRef`，各为0..1；SKU 覆盖：`salesUnitOverrideRef`、`baseMeasureUnitOverrideRef`，各为0..1，空即继承商品。
- 有效口径：SKU override 优先，否则商品默认。可销售事实必须有有效销售单位；直接库存/BOM 原料必须有有效基础计量单位。商品标签仍是多选，不能与单位同改。
- `inventory.stock_target`、`stock_ledger`、`stock_bom` 持久化消费单位快照 `{unitRef,code,name,unitDimension,precision}`；`measureMode` 仍仅为 COUNTED/WEIGHED 方法。
- 盘点设置保存可选 `countingUnitSnapshot` 与 `conversionFactor`，含义固定为 `1 counting unit = factor consumption units`；只用于录入，绝不改余额或 BOM 单位。
- 每次目标单位落值均使用同一规则：转换后按目标 `precision` **向零截断**，不四舍五入，不区分用户输入与系统计算。
- 单位生命周期：零引用可改/删；已引用只能改名称、可停用；被引用后代码、类别、精度不能改；停用只排除后续商品/库存候选，既有事实不变；本批不提供重新启用。

### 1.2 不建的错误机制

1. 不建“份→总克数”的菜品通用换算：配方型商品由 BOM 表达各原料消耗。
2. 不建任意单位两两换算引擎：同一实物的固定同维度换算、包装商品的特定扣减量分别属于库存事实与商品/SKU事实。
3. 不保留 `salesUnitRefs[]`、item sections JSON fallback、双写、旧 `SALES_UNIT` 候选兼容层或从 `measureMode` 反推单位。
4. 不让库存页创建单位、修改消费单位或用前端正则解析换算。

## 2. 串行 CP 总览

```text
CP-00  设计冻结：线框整体确认、operation/错误码冻结、历史 target 的基础单位变更和源数量精度边界确认
CP-01  catalog 单位定义、Bounded read 与生命周期
CP-02  商品/SKU 单值单位、manifest/contract/generated/readback
CP-03  inventory 消费快照、盘点换算、截断与历史快照
CP-04  whole-save/BOM/选项、跨 owner REQUIRED 编排
CP-05  local/brand copy 与 temporary promotion 的闭包、映射和冲突
CP-06  operations-admin 元数据、商品/SKU/库存交互与统一刷新
CP-07  seed、backend-acceptance、focused/static proof 与交接
```

顺序不可倒置：库存快照不能先于有效基础单位定义；复制不能先于引用矩阵；前端不能手写路径或将旧数组适配为新模型。

## 3. 横切机制对照表（固定全集，不得删行）

| 机制 | 现成能力或精确路径 | 可执行观察与最低档 | 仅代码先例时必须同形 | 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读授权 | `OperationsCatalogInventoryController` GET→catalog owner；inventory GET→inventory owner；G-05A 读/写分离 | **[acceptance]** 同身份跨 scope 请求单位列表、商品详情、库存详情均不返回他域事实 | N/A | 单位列表、商品/库存详情、复制预检、盘点读取 |
| 写/grant | generated `BackendPerformanceM1CommandExecutionBindings` → named `@Transactional(REQUIRED)` operation → owner typed command | **[static]** 所有单位/商品/库存写 operation 都经 binding；**[acceptance]** 无 capability/grant 的写被拒绝 | 以 `CreateOperationsCatalogItemOperation#execute` / `SaveOperationsCatalogItemOperation#execute` 的 grant handoff 同形 | create/update/disable/delete unit，item save，库存设置与数量动作，复制 execute |
| 跨 owner 事务 | `CatalogInventoryCoordinator#saveCatalogItem`；`InventoryOwnerApi` 公共命令；新增 task read `readCatalogUnitUsageSummaries(unitRefs)` 与 REQUIRED judgement command `validateCatalogUnitLifecycle(unitRef,intendedChange)` | **[acceptance]** catalog 保存中 inventory snapshot/BOM 任一步失败，catalog 单位配置与 inventory 写均无 readback；删除一个仅被 inventory snapshot/ledger/BOM 引用的单位仍被拒绝 | coordinator 只编排，不持有 unit/target/balance 事实；列表只用批量 task read，delete/definition change 必用同一 REQUIRED judgement command，禁止逐条跨 owner 查询 | whole-save、option BOM、复制、temporary promotion、单位生命周期 |
| 集合分页 | `project-memory/practices/collection-boundary-modes.md`；新 `listOperationsCatalogUnits` 为 Bounded | **[acceptance]** 造100单位，owner 返回 `CATALOG_UNIT_LIMIT_EXCEEDED`，没有前99条成功响应 | owner scoped ordered SQL `LIMIT 100`；前端不 cursor/page | 单位库/候选；商品与库存列表仍沿用既有 Page/Cursor |
| 刷新 | `operationsContentTabRefreshSignal`、`useRefreshVersion`、`OperationsTransport#refreshOperationsCurrentPage` | **[focused]** unit mutation 后只有单位列表、当前商品/库存 detail 缓存失效；dirty item 草稿不 hydrate 覆盖 | `CatalogWorkbenchPage`、`CatalogDictionaryDrawer` 现有订阅形态 | 元数据 Modal、商品 Drawer、库存 list/detail、复制结果 |
| RTK | generated `catalog-inventory-edge.rtk.ts`、`operationsRtk`、`catalogInventoryRtkRequest` | **[static]** consumer 只用 generated hooks，无手写 URL；mutation tag 恰失效受影响 identity | 现有 generated tag provider/invalidation policy 同形 | 新 unit ops、item save/read、inventory config/read、copy preflight/execute |
| 单一事实 | catalog `unit_definition`；inventory `stock_target/ledger/bom` snapshots；inventory 使用量仅通过 public task read 汇总 | **[acceptance]** 修改当前单位名称/定义不改变旧 target/ledger/BOM snapshot readback | N/A | unit definition、item/SKU selections、inventory snapshots、copy mappings、生命周期使用判断 |
| 失败可见 | typed problem advice + UI `adminListState`/field errors | **[focused]** 每个 §4 problem 有业务文案且失败保留草稿；**[acceptance]** owner typed code 不被 500/通用网络错误覆盖 | 现有 Catalog dictionary/item error display 同形 | 所有新/变更读写操作 |
| error 注册 | `contracts/catalog/CatalogInventoryEdgeWire.java`、P1 generator/openapi problem enum | **[static]** 设计表全部问题在 OpenAPI、edge wire、owner mapping、TS generated 四处一致 | P1 generator 为唯一 generated source，禁止手改输出 | §4 的十一个 typed problem |
| 幂等 | `useDrawerFormLifecycle`/`useSubmissionLifecycle` 内容派生 key；owner command receipt | **[acceptance]** 同 idempotency key 重放 unit create/item save/复制 execute 返回同一 readback，无重复 unit/ledger/BOM | 现有 item create/save receipt parser 同形 | unit mutation、item save、inventory config、copy execute |
| generated | `scripts/generate/catalog-inventory-p1.mjs`、`operation-handler-bindings.mjs`、`catalog-inventory-p3-frontend.mjs` | **[static]** 改源后 P1/P3/binding check 均通过，generated 手改为红 | 所有 wire/TS/RTK 从生成器产生 | OpenAPI、wire Java/TS、RTK、manifest、token/binding |
| 日志与脱敏 | `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`；operation logs | **[static]** unitRef/targetRef/requestId 可关联；不记录 authorization、cookie、raw payload 或用户输入全文 | 现有 command structured log 字段同形 | unit lifecycle、whole-save、库存数量、copy、acceptance run |
| 迁移 | 单一 Flyway history；清库裁定 | **[static]** 新 migration 加新关系/快照且移除 retire 字段；没有历史回填、fallback、双写 | `V20260806_120000_000__catalog_inventory_backend.sql` 和 catalog P3 migration 的 owner schema 区隔 | catalog unit/item/SKU，inventory target/ledger/BOM/config，reference matrix |
| foundation | `libraries/frontend/admin-ui-foundation`: `useDrawerFormLifecycle`, `useOverlayLock`, `adminWideDrawerSurfaceProps`, refresh signal | **[focused]** 所有本批 mutable Drawer/Modal 使用同一 lifecycle，提交中不可 mask/keyboard 关闭，after-close reset | `CatalogItemDrawer`、`CatalogDictionaryDrawer` 同形 | 元数据、unit drawer/confirm、item/SKU、库存 action/detail、copy |
| 候选 | 新 `listOperationsCatalogUnits` active Bounded view（盘点带 `dimension`）；`DescriptorFieldRenderer`, `useAsyncGenerationGuard` | **[focused]** stopped unit 不出候选、已绑定 stopped 值仍在 detail 原位；盘点只返回同类别候选；第100条不客户端补页 | 既有 descriptor candidate error/retry 形态；不复用 cursor 抽干 | item/SKU/stock counting candidates |
| 名码 | `NameCodeText`；G-05B | **[focused]** 单位列表主实体名称首列，编码独列；候选 `名称(编码)` 且包含类别/精度 | `NameCodeText` exact formatter | unit library, candidates, snapshots, copy conflicts |
| 原子组 | item whole-save + catalog/inventory public commands in REQUIRED | **[acceptance]** item defaults、SKU overrides、target snapshot、BOM rows readback 要么全部成功要么全不写 | `CatalogInventoryCoordinator#saveCatalogItem` command composition | whole save、option/BOM、copy/promotion relation clone |

## 4. CP 门控、失败条件与不变量

### CP-00 · 设计冻结

- **失败即停**：`DEXTER_WIREFRAME_REVIEW` 不是 ACCEPTED，或“已经存在 StockTarget 时改变有效基础计量单位”没有明确行为，均不得实施。
- **需要 Dexter 确认的剩余边界**：现有库存余额不为零的 target，若商品/SKU 基础计量单位被改成不同单位，不能静默替换 consumption snapshot，也不能自动换算余额；本设计不自行选择“拒绝、建立新 target、迁余额”其中之一。
- **RECALL**：requirements §3.3/§3.4、Journey D-UNIT-003、IA UNIT-IA-07/09。

### CP-01 · catalog 单位定义

- 新 schema `catalog.unit_definition`，scope+brand+code unique；`status` 仅 `ENABLED|DISABLED`，无 VOID fallback。
- operations：`listOperationsCatalogUnits`（GET `/operations/catalog-inventory/units?includeInactive=`）、`createOperationsCatalogUnit`（POST）、`updateOperationsCatalogUnit`（PATCH `/{unitRef}`）、`disableOperationsCatalogUnit`（POST `/{unitRef}/disable`）、`deleteOperationsCatalogUnit`（DELETE `/{unitRef}`）。全部 `x-consumer-faces=[operations-admin]`，catalog owner，HEAD_COMPANY/STORE 按当前商品元数据 capability 冻结。
- list 默认只返回启用单位；`includeInactive=true` 仅元数据 Tab 可用；可选 `dimension` 仅过滤同类别候选；查询 `LIMIT 100`，第100条抛 `CATALOG_UNIT_LIMIT_EXCEEDED`。
- delete/update 的应用 operation 先要求 catalog owner 对商品、SKU、复制闭包等 catalog 事实作 set-based usage judgement，再在同一 REQUIRED 调 `InventoryOwnerApi#validateCatalogUnitLifecycle(unitRef,intendedChange)`。该公开 judgement command 锁定当时的 target、盘点换算、BOM、ledger unit-reference 集合；所有 inventory 新增/改写 unit reference 与它使用相同 unitRef advisory lock，因而不会在判定后插入新引用。任一 owner 报引用即 `CATALOG_UNIT_IN_USE`。catalog 不跨 schema 直查 inventory 表。update 同样实时检查：零引用全字段可变，已引用只允许 name。
- `listOperationsCatalogUnits` 的“正在使用”由 catalog usage 与 set-based task read `readCatalogUnitUsageSummaries(unitRefs)` 合并为 readback；这只是一条协调读取，不作为 mutation 放行依据，也不把 inventory 事实复制进 catalog。
- **反例**：不能把新语义塞入现 `SALES_UNIT` dictionary；它缺少类别/precision、引用锁定与 inventory snapshot 语义。

### CP-02 · 商品/SKU、契约和生成

- retire `salesUnitRefs[]` 和 `catalog_item_reference(kind=SALES_UNIT)` 作为销售单位事实；新增 explicit item columns/owner facts：`sales_unit_ref`、`base_measure_unit_ref`，以及 SKU override refs。标签 `tagRefs` 保持原多选关系。
- `CatalogItemDetail`、`CatalogItemSaveRequest.sections.catalogDraft`、shape manifest、P1 generator、coverage/reference matrix、generated Java/TS/RTK 同时替换为 `salesUnitRef`、`baseMeasureUnitRef`、SKU `salesUnitOverrideRef`/`baseMeasureUnitOverrideRef`。
- `CatalogOwnerService#saveCatalogItem` 在 command 内解析 effective unit；销售/基础条件按实际用途判定，不由 UI required 星号代替。该 readback 返回 unit labels、precision、status和 inheritance source，不能只返回 ref。
- normal local copy、brand copy、temporary promotion 都用明确 refs，不再读取/复制数组 JSON。

### CP-03 · inventory snapshot、盘点和截断

- target 存 `consumption_unit_ref/code/name/dimension/precision`，ledger/BOM 存各自写入时的同形 snapshot；`measure_mode` 只保留计量方式。
- `InventoryOwnerApi#ensureCatalogItemSaveTarget`、`#saveCatalogItemProductBom` 接收 effective base-unit snapshot 而非 `String consumptionUnit`；inventory rechecks target scope/precision/validity，不向 catalog read edge 反查。
- `updateOperationsInventoryTargetConfiguration` request 改为 optional `countingUnitRef`、`conversionFactor`，不含可写 consumption unit。owner 写入 counting snapshot、校验同维度+正有限数/分数。
- `count/increase/adjust` 的输入可选盘点单位；inventory 先按 conversion 转为 consumption quantity，再按 destination precision `RoundingMode.DOWN` / toward-zero 截断后写 ledger/余额。禁止 BigDecimal HALF_UP 和 UI 二次计算。
- `CatalogItemDrawer#InventoryBomEditor`、`InventoryActionModal` 的自由文本单位/解析/固定6位输入必须整体删除替换，不留兼容控件。

### CP-04 · whole-save、BOM 与 option material

- `CatalogInventoryCoordinator#saveCatalogItem` 保持 `@Transactional(REQUIRED)`：catalog save/readback → inventory target snapshot command → catalog BOM/option config → inventory BOM command；任一失败 rollback。
- 每个 BOM/点单强制原料的单位来自其 material StockTarget consumption snapshot；商品销售单位与盘点单位不得进入 BOM 行。
- 若包含 SKU override，coordinator 把按 SKU 解析后的有效 base snapshot 传给 inventory；不默认用 item unit。
- **比例验证**：所有按 item/SKU、option-value、temporary promotion、copy 创建的 BOM 路径均使用 snapshot，逐路径列在 §6。

### CP-05 · 复制与转正

- catalog closure 增 `CATALOG_UNIT` object type，映射 `(sourceRef,targetRef)`；目标 scope 同编码但类别/precision不同产出 `BLOCKED` + `CATALOG_COPY_UNIT_CONFLICT`，不进确认队列。
- execute 必重新 preflight/digest；所有 item/SKU/unit refs、target/BOM/ledger snapshots改为 target mapping；任何 source unitRef 留在 target readback 即失败。
- temporary promotion 新 code 复制关系化单位 refs与 inventory snapshots，仅走 coordinator public inventory command，不能从旧 sections fallback。

### CP-06 · operations-admin

- 商品元数据 Modal 将现“销售单位”扩为唯一“计量单位”Tab；不加顶层 Tab、库存页入口或 platform-admin 页面。
- 商品基础与 SKU 落 UI artifact 的单选/继承交互；库存 Drawer 只读 consumption snapshot、仅编辑 counting conversion；所有 mutable overlays 接 `useDrawerFormLifecycle`。
- generated hooks 是唯一 HTTP consumer；mutation 精确失效并发布 `operationsContentTabRefreshSignal`。

### CP-07 · proof 与交接

- 更新 `CatalogAcceptanceScenarios.java`、适用 frontend focused tests、generator red mutations、`scripts/dev/catalog-inventory-seed-executor.mjs` 和 `catalog-inventory-definition-seed.test.mjs`。
- **系统性防再犯**：同根缺陷族为“将业务单位当字符串/数组或从计量方式推导”。防线落入完整 reference matrix、真实 HTTP scenarios与 review checklist：任何新增 unit consumer 必须声明角色（sales/base/consumption/counting）、owner、snapshot、copy rewrite和precision处理；SKU属性/标签是明确反例。

## 5. operation / path / face / collection / 规模

| operation | HTTP path | face / owner | collection/readback | 规模与责任 |
| --- | --- | --- | --- | --- |
| `listOperationsCatalogUnits` | `GET /operations/catalog-inventory/units?includeInactive=&dimension=` | operations-admin / coordinator read（catalog 定义、inventory 使用汇总） | Bounded list；候选默认仅启用，盘点以 `dimension` 过滤，元数据可含停用 | ≤99；100拒绝，不分页 |
| `createOperationsCatalogUnit` | `POST /operations/catalog-inventory/units` | operations-admin / catalog | Detail readback | 单 definition |
| `updateOperationsCatalogUnit` | `PATCH /operations/catalog-inventory/units/{unitRef}` | operations-admin / coordinator command（catalog 写、inventory lifecycle judgement command） | Detail readback + ref count | 单 definition，两个 owner在同一 REQUIRED 共同核验使用状态 |
| `disableOperationsCatalogUnit` | `POST /operations/catalog-inventory/units/{unitRef}/disable` | operations-admin / catalog | Detail readback | 单 definition；只影响未来候选 |
| `deleteOperationsCatalogUnit` | `DELETE /operations/catalog-inventory/units/{unitRef}` | operations-admin / coordinator command（catalog 写、inventory lifecycle judgement command） | delete readback | 两个 owner均在同一 REQUIRED 判为0引用 |
| `saveOperationsCatalogItem` | `PATCH /operations/catalog-inventory/items/{itemCode}` | operations-admin / catalog coordinated inventory/asset | item detail aggregate | item 2 scalar + each SKU2 scalar；无新列表 |
| `updateOperationsInventoryTargetConfiguration` | existing PATCH target configuration | operations-admin / inventory | target detail | 1 counting config/target |
| `count/increase/adjustOperationsInventoryTarget` | existing operations | operations-admin / inventory | target+ledger Page/Cursor | ledger遵循既有分页 |
| `preflight/executeOperations{Brand,Local}CatalogCopy` | existing paths | operations-admin / coordinator | preflight detail | unit dependency subset；全单位库≤99 |

## 6. 跨 owner 写矩阵

| 发起操作 | catalog owner 写/判定 | inventory public command | REQUIRED 原子组 | 禁止 |
| --- | --- | --- | --- | --- |
| 商品/SKU保存 | 有效销售/基础单位、SKU继承、unit ref state | `ensureCatalogItemSaveTarget(snapshot)`、`saveCatalogItemProductBom(snapshot)` | item defaults、SKU override、target snapshot、BOM | catalog JDBC写inventory；inventory read edge推断 |
| 点单/option material | option关联商品、数量 | existing option-value BOM save/delete，材料 target snapshot | config+option BOM | 用销售/盘点单位写BOM |
| 盘点设置 | 无 | `updateTargetConfiguration(counting snapshot,factor)` | inventory own transaction | 改写 consumption snapshot |
| 数量动作 | 无 | count/increase/adjust + target precision truncate | inventory own transaction | 前端转换/rounding |
| 单位改名/删除 | catalog 定义写、catalog usage judgement | `validateCatalogUnitLifecycle(unitRef,intendedChange)` 锁定式公开判定 command | operation 在同一 REQUIRED 中先判两 owner 使用量、后写 catalog；inventory 不被 catalog 直查 | catalog JDBC 查 inventory schema；按列表旧计数或 task read 放行删除 |
| copy/promotion | closure、unit map、target unit refs | copy/rewrite target snapshots/BOM | coordinator execute | target保留source unitRef |

## 7. 声明—传递—消费矩阵

| 机制 | 契约层 | owner/coordinator 层 | 前端层 |
| --- | --- | --- | --- |
| 截断规则 | quantity 是有限数；运行期先按源 unit snapshot precision 向零截断，再转换并按目标 consumption snapshot precision 向零截断；无 `multipleOf` 假冒静态精度 | inventory conversion→源 `RoundingMode.DOWN`→factor→目标 `RoundingMode.DOWN`→target/ledger/BOM snapshot write | 按当前录入单位 precision 提供输入限制，按同一向零截断语义处理；不把目标 precision 当源 precision，不使用四舍五入 formatter，readback 仍以 owner 为真相 |
| 单位快照 | item/SKU refs；target/ledger/BOM/counting snapshot readback字段 | catalog解析effective base；inventory持久snapshot且不由后来定义重解释 | 商品选择单值；库存只读消耗 snapshot；历史显示行快照 |
| 集合形态 | units GET无cursor/pageSize；100th typed problem | scoped ordered `LIMIT 100` | 一次完整读、名称/编码本地筛选；无分页/无限加载 |
| 授权执行点 | writes有 `x-consumer-faces` 与 capability；GET不嫁接 capability | edge grant→owner重核当前scope/status/fact | UI仅基于会话显示；不把隐藏当授权 |
| 缓存失效 | generated RTK tag policy含 unit/item/target identities | command readback提供受影响 ref | publish signal；仅重读当前受影响视图，dirty不覆盖 |
| 错误映射 | §4 typed problem注册在OpenAPI/wire/TS | owner产生业务问题，不用通用500 | §4中文字段/列表错误，不改写为网络失败 |
| 日志与脱敏 | requestId/operationId传播；无敏感字段协议 | structured `unitRef,targetRef,scope,phase,outcome`；不记raw payload/credential | 只显示requestId支持诊断，不显示scope/ref内部值 |

## 8. 业务规则 → owner 判定

| 规则 | 最终 owner 判定点 |
| --- | --- |
| 同 scope 单位编码唯一、≤99 | catalog unit definition command/read |
| 零引用可改删；已引用仅名称可改、可停用 | coordinator 汇总 catalog usage judgement + `InventoryOwnerApi#validateCatalogUnitLifecycle` 后，catalog unit update/delete/disable command 再执行 |
| 停用不能再选择，既有绑定保留 | catalog unit candidate read + item save recheck；inventory configuration candidate recheck |
| 一个销售/基础单位、SKU override优先 | catalog item save/readback |
| 非销售物料可无销售单位但需要基础单位 | catalog item save + inventory target creation judgment |
| 消耗快照来自effective base而非measureMode | coordinator typed input + inventory target command |
| 盘点只录入换算、同维度、正有限 | inventory configuration/action owner |
| 向零截断 | inventory normalization before balance/ledger/BOM write |
| 历史不重解释 | inventory snapshots read/write |
| copy target无source ref、同码语义冲突阻断 | catalog preflight/digest/execute + inventory rewrite |

## 9. owner API → 精确消费者

| owner API / readback | 消费者 |
| --- | --- |
| `CatalogOwnerApi.listUnits/createUnit/updateUnit/disableUnit/deleteUnit` | unit list/read coordinator 或 command operation → generated operations-admin RTK → CatalogDictionaryDrawer unit tab/Drawer |
| `InventoryOwnerApi.readCatalogUnitUsageSummaries(unitRefs)` | unit list/read coordinator；不向 UI 暴露 inventory 原始记录 |
| `InventoryOwnerApi.validateCatalogUnitLifecycle(unitRef,intendedChange)` | update/delete unit command operation；在同一 REQUIRED 内作 inventory 最终引用判定与锁定 |
| `CatalogOwnerApi.saveCatalogItem` effective unit readback | `CatalogInventoryCoordinator#saveCatalogItem`、get item edge、CatalogItemDrawer |
| `InventoryOwnerApi.ensureCatalogItemSaveTarget(snapshot)` | CatalogInventoryCoordinator whole-save |
| `InventoryOwnerApi.updateTargetConfiguration(countingSnapshot,factor)` | inventory operation adapter → InventoryDetailDrawer/InventoryActionModal |
| target/ledger/BOM unit snapshot readbacks | inventory GET/action readbacks → InventoryManagementPage/InventoryDetailDrawer |
| `CatalogOwnerApi.preflight/execute{Brand,Local}Copy` unit mappings | CatalogInventoryCoordinator → BrandCatalogCopyDrawer/local-copy consumer |

## 9b. 唯一锚点定位

| 主题 | 当前锚点 |
| --- | --- |
| 当前多选源 | `scripts/generate/catalog-inventory-p1.mjs` `salesUnitRefs` manifest rule；`CatalogDescriptorPicker#MULTI_VALUE_FIELDS` |
| 商品保存编排 | `CatalogInventoryCoordinator#saveCatalogItem` / `#coordinateSaveInventory` |
| 库存错误单位来源 | `InventoryOwnerService#normalizeQuantity`、`#ensureCatalogInventoryTargetCore` |
| 库存自由文本反例 | `CatalogItemDrawer#InventoryBomEditor`；`InventoryActionModal` 的 conversion parsing/AutoComplete |
| 单位元数据入口 | `CatalogWorkbenchPage` → `CatalogDictionaryDrawer` |
| refresh/lifecycle | `operationsContentTabRefreshSignal`；`useDrawerFormLifecycle` |
| copy | `CatalogInventoryCoordinator#preflightBrandCopy/#executeBrandCopy`；`CatalogOwnerService#copyPreflight/#rewriteReferences` |

## 10. 数据与迁移

清库裁定成立。本批未来 migration 只建立新 schema/columns/snapshots，并删除旧 `salesUnitRefs` 数组、`SALES_UNIT`关系化引用及其 P1 mapping；**不设计**历史数据回填、兼容 read、双写、fallback 或历史换算收敛。seed 在新模型上重新物化单位、商品/SKU覆盖、material base、target snapshot、counting conversion和copy fixture。

## 11. backend-acceptance 场景设计

所有场景进入 `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java`，使用真实 route constants、真实HTTP、`CONTRACT`与`BUSINESS`分离。每条 identity/fixture/request/businessOracle 非空。

| identity | fixture | request | businessOracle |
| --- | --- | --- | --- |
| `catalog.unit.single-sale-rejected` | enabled unit库；可销售 item/SKU | save含两个销售单位或错误数组形态 | 422 typed `CATALOG_EFFECTIVE_SALES_UNIT_REQUIRED`/semantic rejection；item readback无第二单位且无非法写入 |
| `catalog.unit.sku-override-inheritance` | item默认份/g，两个SKU | one override瓶/ml；one null override；再更改item默认 | detail中前者覆盖生效、后者继承最新默认；每个角色仅一ref |
| `catalog.unit.material-base-required` | material item，无销售单位 | set BOM/target with and without base | 无base拒绝；有base可建target/BOM，销售单位仍null |
| `inventory.unit.snapshot-from-effective-base` | item/SKU effective kg或g | whole-save | target snapshot等于effective base，不等于measureMode或request config自由文本 |
| `inventory.unit.counting-does-not-rewrite-balance` | target g snapshot，counting kg factor1000 | PATCH config，count/increase/readback | target/余额/BOM仍g；盘点输入仅转换录入 |
| `inventory.unit.truncate-toward-zero` | g precision0，kg source | submit0.3567kg等价量 | target/ledger delta `356`，非`357`，snapshot为g |
| `inventory.unit.history-not-reinterpreted` | target+ledger+BOM snapshot，然后允许的单位名称变化 | read history | history仍存写入时code/name/precision；不从当前definition重新投影 |
| `catalog.unit.lifecycle` | zero ref unit、被商品引用unit及仅被 target/ledger/BOM 引用unit | update/delete/disable | zero ref可全改删；任一 owner 引用时delete/非name update拒绝，name update/disable成功，既有事实不变 |
| `catalog.copy-unit-rewrite-and-conflict` | source单位与item/target；target空或同code不同precision | brand/local preflight+execute | 成功目标只用target refs/snapshots；冲突为BLOCKED可定位，execute无写 |
| `catalog.unit.bounded-limit` | 100同scope单位 | list | typed limit，不返回静默前99 |

红夹具必须超过边界：单位100条；至少两个 SKU；至少一条无销售单位物料；至少一个 target/ledger/BOM；复制 fixture 同时验证 unit ref 与 snapshot rewrite。

## 12. 未决项

| ID | 问题 | 状态与停机 |
| --- | --- | --- |
| U-UNIT-DESIGN-01 | 已有非零余额 StockTarget 的商品/SKU基础计量单位被改成不同单位时，究竟拒绝、建立新 target并转移后续事实，还是另有流程？ | **DEXTER_ACCEPTED_2026_08_21**。按当前安全守卫在 catalog 保存事务内返回 typed `CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED`；不静默同步 target snapshot，不改写余额、流水、BOM 或历史。 |
| U-UNIT-DESIGN-02 | 精度约束的是哪一种数量：用户在某单位键入的源数量、系统转换中的源数量，还是仅最终写入 target/ledger/BOM 的目标数量？尤其 kg precision=2 与要求 `0.3567kg → 356g` 的例子必须同时成立。 | **DEXTER_ACCEPTED_2026_08_21**。源输入按源单位 precision 向零截断，转换结果按目标消耗单位 precision 向零截断；前端动态限制与 owner 同义，不固定为3、不四舍五入。 |

## 13. Stop conditions

1. `DEXTER_WIREFRAME_REVIEW` 非 ACCEPTED：不实施。
2. U-UNIT-DESIGN-01/02 已由 Dexter 裁定；若实现不再执行事务内安全拒绝、源/目标各自 precision 向零截断，或出现四舍五入/目标冒充源 precision，停止。
3. 任何方案需要保留数组、sections JSON fallback、双写或从 `measureMode` 推导单位：拒绝该方案。
4. 任何跨 owner 实现绕过 public `InventoryOwnerApi`、不在 REQUIRED，或 catalog 直写 inventory schema：停止。
5. 单位数量未按第100条拒绝、候选改成 cursor/分页、或前端出现自由文本单位：停止。

## 14. 自查

- §3 17行未删，均有精确能力、观察档位、先例/N/A和完整适用面。
- §7 含截断、单位快照、集合形态、授权、缓存、错误、日志七类机制，三层都有具体值。
- IA/本详设共同事实逐字：`典型十几个、最多几十个；上限固定为99，owner 读取第100条即拒绝，前端不分页、不无限加载、不静默截断。`
- 每个新/改 HTTP operation在§5、§11有路径、face/owner和验收场景。
- 清库边界、无 fallback、无历史回填明确；库存 target 变更不清楚处已停止而非擅自设计。
