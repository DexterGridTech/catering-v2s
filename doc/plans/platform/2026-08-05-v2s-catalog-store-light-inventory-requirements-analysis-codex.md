# catering-v2s 商品目录与门店轻库存需求分析（Codex 独立版）

> 日期：2026-08-05  
> 性质：需求分析，不是 Journey 裁决、implementation-facing 设计或实施授权  
> 范围：商品目录、门店交易前轻库存、生产标签定义与商品关联  
> 排除：销售集合/菜单发布、交易订单、扣减/恢复运行链、履约生产运行时  
> 独立性声明：本文由 Codex 直接阅读原始材料并亲验 v4 活环境后独立形成，未读取 Claude 本轮需求分析产出。

## 1. 结论先行

本期要建设的不是“菜单系统”或“小型 ERP”，而是交易发生前的三块可信基础：

1. 商品目录 owner 回答“这个经营对象是什么、具备什么结构和能力”；
2. 门店轻库存 owner 回答“本门店对哪些商品/SKU/选项相关对象做库存控制、现有多少、怎样通过 BOM 解释消耗”；
3. 履约生产 owner 提供完整的生产标签定义能力，商品只保存标签引用，不拥有工位、队列、KDS、打印机或生产流程。

面向用户，本期解决两类主任务：总公司商品人员维护品牌模板商品，门店商品人员从模板选择复制或维护本店商品；门店库存人员在同一商品任务中配置库存/BOM，并在门店库存工作台查看、盘点、增加或调整当前库存。它不让顾客看到菜单，不决定商品此刻是否可售，也不执行订单扣减。

模型必须“首版完整、功能分期”，但完整不等于把未来系统提前实现。现在要建稳的是商品形态、SKU/选项/套餐结构、自由描述属性、多图、生产标签、库存对象、余额、追加流水、BOM 和引用保护；只留边界而不建运行能力的是销售发布、动态可售、订单扣减/恢复、外部 ERP 适配和生产运行时。

## 2. 来源、方法与适用次序

### 2.1 裁决次序

1. Dexter 在本任务中给出的冻结前提；
2. v2s 正典 G-11/G-12 与 v2s 拓扑/owner 红线；
3. v6 领域设计中的业务边界和不变量；
4. v1 Q1-Q6、D-1-D-6 已拍板的模型取舍；
5. v4 活环境与真库研究，只验证用户任务、交互和规模，不从旧表或旧接口反推业务真相。

v1 的微服务/MQ表达在 v2s 只继承业务 owner、幂等和事实边界，不继承部署、消息或最终一致性机制。v2s 固定为一个业务 deployable、一个 PostgreSQL、多 owner schema、单 Flyway history；跨 owner 写调用目标 owner 公开 command API 并加入同一 `REQUIRED` 事务，不建 MQ/outbox 补偿链。

### 2.2 来源索引

| ID | 来源 | 使用点 |
| --- | --- | --- |
| S01 | `../requirement-doc/design-v6/01.领域设计/05-商品目录域.md` 全文 | 商品事实、目录 owner、SKU/选项/套餐、媒体、边界 |
| S02 | `../requirement-doc/design-v6/01.领域设计/07-销售库存与物料扣减域.md` 全文 | 轻库存、余额/流水、BOM、盘点、停止线 |
| S03 | `../requirement-doc/design-v6/01.领域设计/06-销售集合与发布域.md` §1、§4.4、§4.12 | 商品与菜单、销售项、动态可售边界 |
| S04 | `../requirement-doc/design-v6/01.领域设计/13-履约与生产域.md` §4.7 | `ProductionTagDefinition` |
| S05 | `../catering-all-v1/doc/review/domain/05-catalog/2026-06-30-domain-05-catalog-redesign-discussion.md` §0.2、§9 | 商品 Q1-Q6 |
| S06 | `../catering-all-v1/doc/review/domain/07-inventory/2026-06-30-domain-07-inventory-redesign-discussion.md` §0.1、§9 | 库存 Q1-Q6 |
| S07 | `../catering-all-v1/doc/review/domain/05-catalog/2026-07-08-step4-v4-cognition-and-design-essence.md` §3-§5 | D-1-D-6、D-6 修正版、交互精华 |
| S08 | `../catering-all-v1/doc/reports/2026-07-08-v4-live-experience-cognition-correction.md` | v4 实地修正 |
| S09 | `../catering-all-v1/doc/reports/2026-07-08-step4-v4-vs-new-model-catalog-inventory-deep-study.md` | 真库代表规模与效率 |
| S10 | `project-memory/decisions/confirmed-business-language-corpus.md` G-11/G-12 | v2s 正典与禁用推导 |
| S11 | `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md` §0.4、Part B | 后继领域、UI/性能/单体映射 |
| S12 | `PLATFORM-BLUEPRINT.md` | owner、契约、双后台、效率边界 |
| LIVE | v4 活环境 `192.168.0.113:28583`，2026-08-05 Codex 亲验 | 页面与交互事实 |

## 3. 为谁解决什么问题

### 3.1 用户

1. **总公司商品人员**：在获品牌授权范围内维护品牌标准商品和资料/BOM 模板，供门店选择复制；不控制门店售卖和真实库存。[S01 §4.1/§9.1；S10 G-03/G-06]
2. **门店商品人员/门店管理员**：维护门店本地商品、SKU、点单选项、套餐、图片、标签、生产标签关联和门店实际库存/BOM；模板复制后是门店独立事实。[S01 §4.1；S05 Q5/Q6]
3. **门店库存人员**：查看门店库存，执行轻量盘点覆盖、库存增加和有原因的人工调整，追查余额来源和变化记录。[S02 §3.7/§9；LIVE]
4. **项目/门店生产规则管理员**：维护项目默认、门店覆盖的生产标签，供商品关联；不配置处理面、队列、工作单或 KDS。[S04 §4.7]
5. **运营/诊断人员**：追查异常余额、关联商品/BOM 与最近流水；技术诊断不能淹没门店日常任务。[S02 §9；LIVE]

### 3.2 目标结果

| 痛点 | 目标结果 |
| --- | --- |
| 商品、菜单、库存和生产容易揉成“大商品中心” | 三个 owner 分别持有商品、库存、生产标签事实；页面组合但真相不合并 |
| 不同商品形态靠可选字段堆砌会产生矛盾 payload | 持久化 `shape`，由契约统一约束前后端能力、页签和校验 |
| 总部标准要复用又不能强继承 | 总部模板库 + 门店显式 pull copy；复制后本地独立 |
| SKU、选项、套餐和 BOM 容易形成多份真相 | 规范化 SKU 维度；点单选项为 typed per-item 结构；引用边负责反查 |
| 商品与库存是两个 owner，但用户不应保存两次 | 一次 whole-save；服务端同事务调用 inventory command 并分别 CAS |
| 库存容易膨胀为采购/WMS/成本系统 | 只做 StockTarget、Balance、Ledger、BOM、盘点/增加/调整和提示 |
| 图片未来切 CDN 会牵动业务模型 | 商品只持稳定 asset refs、多图顺序和主图；分发地址由资产能力解析 |

## 4. 范围

### 4.1 In

#### 商品目录

- 总公司品牌模板目录与门店本地目录，两类均带 `brandRef`。
- 持久化、契约化商品形态；形态决定必填字段、能力、页签和结构互斥。
- 基本资料、管理分类、静态/可筛选标签、销售单位、识别码。
- 描述性属性自由 map：纯展示、不做 schema 校验；需过滤/判断的事实进入标签或明确字段。
- 多图上传、排序、主图、替换/移除；未来菜单项可从商品已有图片的稳定 ref 中选择，销售 owner 是否允许独立展示覆盖仍由 06 的 Journey 裁决。
- 规范化 SKU 销售属性和值字典、SKU 矩阵。
- 点单选项、商品型套餐、商品引用边、生产提示与生产标签关联。
- 商品关系与外部目录身份的模型占位：遵守“模型建全、功能分期”，但本期不接外部系统同步运行链。
- 商品状态、来源、治理/引用风险、软归档。
- 总部模板到门店商品的显式复制，来源可追溯且不自动跟随。

#### 门店轻库存

- 门店级库存对象、当前余额、追加式变化流水。
- 无库存控制/独立库存/BOM 三种规则模式。
- 商品、SKU、选项值节点的库存/BOM 规则工作台；允许模式由后端规则快照给出，其中按 SKU 管理商品的主商品壳不能配置库存或 BOM，选项值只允许配置 BOM、不能配置独立库存。
- BOM 与 BOM 行，包含正/负消耗；无 BOM 不阻断商品保存或未来销售发布。
- 库存增加、存量盘点覆盖、带原因人工调整；均先写流水再更新余额。
- 低库存阈值、允许负库存、消耗单位、可选盘点单位及固定换算快照。
- 库存现状和详情：余额、变化摘要、盘点/增加历史、关联商品/BOM、变化记录、受控诊断。
- 库存提示 owner-side 产出边界可建模，但本期没有菜单/对客消费闭环。

#### 生产标签

- `ProductionTagDefinition` 完整 CRUD/启停/查询能力。
- `PROJECT_DEFAULT` 与 `STORE_OVERRIDE` 两级作用域、版本和引用保护。
- 商品/SKU/选项的生产标签关联与候选查询。

### 4.2 Out 及理由

| Out | 理由 |
| --- | --- |
| `SalesCollection`、`SalesItem`、菜单草稿/发布/门店渠道启用 | 回答“怎么卖”，不是“是什么”；本期排除 06 [S03] |
| 上下架、沽清、限售、动态可售、对客库存展示 | 库存只给提示，销售 owner 决定可售 [S02 §2.5；S03 §4.12；S06 Q1/Q6] |
| 订单、支付、退款、库存扣减/恢复计划及执行 | 本期是交易前，不能建无交易 owner 的假运行链 |
| 工作单、处理面、队列、KDS、打印、出品/交接 | 生产标签是语义纽带，不是生产运行时 [S04] |
| 外部 ERP/权益库存适配和补偿 | v1 Q4 已定首期只做 internal light stock [S06 Q4] |
| 采购、供应商、仓库、批次、调拨、入/出库单、预占、FIFO、成本/毛利 | 属外部 ERP/专业供应链 [S02 §2.1/§12；S10 G-12] |
| 外卖映射、菜单同步、TDP runtime | 属外部协作、经营渠道、销售发布和后续 TDP；商品域不触发 TDP [S01；S11 §0.4] |
| 商品导入/导出 | v4 有入口但本期任务未证明；批量错误与权限需另设计 [S07 §2] |
| 对客商品详情、营销价、合同货号 | 分属销售、营销、合同/结算 [S01；S10 G-11] |

“库存增加”是轻库存余额调整，不得建模或命名成供应链“入库单”；“盘点”是覆盖式流水，不建盘点任务流。

## 5. 必须说准的业务事实

| # | 事实 | 错误模型后果 | 来源 |
| --- | --- | --- | --- |
| F01 | `CatalogItem` 回答“卖的是什么”，不回答上架、最终价或库存 | 把目录、菜单、库存状态压成一个状态 | S01 §1；S10 G-11 |
| F02 | 目录 owner 只有“总公司+品牌”或“门店+品牌”；品牌不是 owner | 丢失同品牌不同总公司的目录主权 | S01 §4.1 |
| F03 | 总部目录是模板；门店显式 pull 复制商品及其 BOM/库存规则模板后形成独立事实，不强继承 | 总部修改意外改写门店事实，或把已拍板的模板复制重新做成可选议题 | S01 §4.1；S05 Q6；S10 G-11 |
| F04 | 商品形态是 source fact，必须持久化并进入契约；创建后固定 | 两端各自推导能力，产生矛盾 payload | Dexter 冻结输入；LIVE；S07 §4 |
| F05 | `itemKind`、capabilities、materialRole、measureMode、状态、来源是不同维度 | 用一个 `product_kind` 表达全部语义 | S01 §4.2/§10；S10 G-11 |
| F06 | `SELLABLE` 只表示可被未来销售项引用，不表示已售/可售 | 目录启用直接变菜单上架 | S01 §4.2；S10 G-11 |
| F07 | SKU 是规格；选项是怎么做/加什么；`REQUIRED_MATRIX`（强 SKU 矩阵）与点单选项必须互斥，其他 SKU mode 的适用范围仍需 O-02 裁决 | 终端无法解释同一商品结构，或把尚未裁决的互斥范围伪装成事实 | S01 §4.8-4.10；S03 §4.4；S10 G-11 |
| F08 | SKU 维度和值用规范化字典，SKU 只引用值真相 | 字典与标签快照双写漂移 | S05 Q1；S07 D-1；S09 A |
| F09 | 描述属性是自由 map、纯展示、不校验；业务判断不能藏进 map | 造 EAV/schema 或让 map 承担规则 | Dexter 冻结输入；S05 Q2 |
| F10 | 商品支持多图且只持 asset ref；未来菜单可选择已有图片，但本期不限制销售项自己的展示覆盖规则 | CDN 切换改业务数据，或目录 owner 越权冻结销售展示 | Dexter 冻结输入；S01；S03 §4.4 |
| F11 | 商品型套餐是稳定组合；营销套餐/权益包不是同一概念 | 套餐、促销、权益混为一物 | S01 §4.11；S10 G-11；S09 B |
| F12 | 生产标签属于履约生产 owner，商品只关联 ref | 商品直接绑定工位/KDS/打印机/topic | S04 §4.7 |
| F13 | 商品与库存是两个 owner；同屏不等于同表 | catalog 为方便直接写 inventory schema | Dexter 冻结输入；S12 |
| F14 | 库存固定到门店；总部模板没有真实余额/流水/共享库存 | 建总部共享库存或跨店调拨 | S02 §2.3；S10 G-12 |
| F15 | 流水是事实、余额是可重建当前态；先流水后余额 | 只改 balance，无法审计/重建 | S02 §4.2-4.3；S10 G-12 |
| F16 | 状态是 `IN_STOCK/LOW_STOCK/OUT_OF_STOCK/NEGATIVE/UNKNOWN`；“需处理”是派生视图 | UI 分类污染领域枚举 | S02 §4.2；LIVE |
| F17 | 消耗单位是库存真相单位；盘点单位只便于录入，历史冻结换算 | 改单位后重解释历史数量 | S02 §3.7/§4.1-4.3 |
| F18 | BOM 可挂商品、SKU、选项；但选项值只能是 BOM owner，不能生成独立 `StockTarget`；无 BOM 不阻断；正负行支持加料/换料 | 把“可配规则节点”误建为库存对象，或缺 BOM 就不可用、无法换料 | S02 §2.2/§4.4；S06 Q5；S10 G-12 |
| F18a | 按 SKU 管理商品的主商品壳不能配置库存或 BOM；BOM 行组件只能引用具备 `BOM_COMPONENT` 且已开启独立库存控制的库存对象 | 主壳和 SKU 双重计存，或扣减引用没有余额主权的组件 | S01 §4.10；S02 §3.1/§4.4 |
| F19 | D-6 已锁定：一次保存商品+库存/BOM；服务端同事务调用各 owner，各自 CAS | 两次保存半成功，或为单按钮合并 owner | S07 D-6；S08 A12 |
| F20 | 库存提示不直接形成沽清/下架；低库存不自动下架 | inventory owner 越权成为 sales owner | S02 §2.5；S06 Q1；S10 G-12 |
| F21 | 本期不建扣减/恢复；v1 MQ语义未来按 v2s 同 deployable 边界重判 | 照抄消息链、提前建 MQ/outbox | S06 Q2/Q3；S11；S12 |

## 6. 领域模型与规模

### 6.1 商品目录 owner

- `ProductCatalog`：目录类型、owner ref、brand ref、维护策略。
- `CatalogItem`：shape、基本资料、能力、自由属性 map、图片 refs、状态、来源、版本。
- `CatalogCategory`、`CatalogTag`、`SalesUnit`、`ProductIdentifier`：需复用、查询、过滤或唯一约束的小实体。
- `CatalogSkuSalesAttribute`、`CatalogSkuSalesAttributeValue`、`ProductSku`：规范化维度字典 + SKU 组合。
- `ItemOrderingOptions`：per-item typed JSON，含 group/value、选择规则、普通加价、排序和生产标签引用；不是裸 map，也不建跨商品共享选项库（v1 D-5）。
- `CompositeStructure`：typed JSON；另有 `CatalogItemReference` 瘦边做反查/归档保护。
- `CatalogItemRelation`、`ExternalCatalogIdentity`：保留合法领域模型与来源追溯；本期不因此接入外部同步 runtime。
- `PreparationProfile`：可折入商品结构 JSON，生产标签必须是 typed ref。
- `CatalogInventoryBomRuleTemplate`：总部模板规则，只随显式复制初始化门店事实，不参与余额。

### 6.2 生产标签 owner

- `ProductionTagDefinition`：projectRef、可选 storeRef、code、name、kind、scope、enabled、version。
- code 在有效作用域内唯一；门店覆盖必须有明确覆盖/停用语义，不能复制成无来源第二真相。
- 已引用标签停用不改历史快照，但阻止新增引用并显示风险。

### 6.3 轻库存 owner

- `StockTarget`：门店 + 商品或 SKU、单位、阈值、负库存策略、authority、版本；`OPTION_VALUE` 不能成为独立库存对象。
- `StockBalance`：quantity、state、version、lastLedgerRef、lastChangedAt。
- `StockChangeLedger`：append-only；来源、before/change/after、原始录入和换算、原因、操作者、幂等键。
- `ProductBom`、`ProductBomLine`：owner target（商品/SKU/选项值）、version/digest、组件、quantity、lineSign；选项值在这里表达附加/替换消耗规则；组件必须指向具备 `BOM_COMPONENT` 且已开启独立库存控制的 `StockTarget`。
- `SalesStockView`：未来销售消费的提示，不承载可售决定。

本期不创建 `StockDeductionPlan/RestorePlan` 假执行面。即使需求模型提及，也不应建无调用者的表/API。

### 6.4 一次保存、两个 owner

推荐不拥有事实的 application use-case coordinator：

1. 校验 shape contract 与 catalog 草稿；
2. catalog owner 保存商品结构并 CAS；
3. 调 inventory owner command，校验 `expectedStockTargetVersion/expectedProductBomVersion`；
4. 加入同一 `REQUIRED` 事务，任一失败整体回滚；
5. readback 返回完整编辑视图。

禁止前端串两个保存请求，也禁止 catalog repository 直接写 inventory schema。

### 6.5 规模

v4 真库样本为 `73` 商品、`20` 库存对象；拿铁三 SKU 在 v4 约 `17` 行/`9` 张 catalog 表，新模型研究约 `11` 行/`5` 张；详情触及表约 `9→4`。[S09]

这只证明模型可精简，不是 v2s 上限。建议设计/测试分母：

- 单目录千级商品、三级分类、百级标签/单位/销售属性字典；（2026-08-25 Dexter 分类深度裁定覆盖原二级表述。）
- 单商品个位到低十位图片/选项组，SKU 组合通常个位到数十；前后端双重限制笛卡尔积；
- 单门店库存对象与商品/SKU 同量级，BOM 行低十位常态；
- 流水是唯一高增长集合，必须游标/时间分页、门店+时间索引，预留归档/分区而不提前分区。

具体上限、索引或分区必须经受控数据量与 `EXPLAIN (ANALYZE, BUFFERS)` 证明。

## 7. 页面与交互

### 7.1 保留 v4 的好做法

#### 商品工作台

- 显示项目和门店/总公司商品库上下文。
- 左侧分类+智能视图，右侧筛选+列表；关键字、状态、治理、来源、标签均有明确任务。
- 点名称进独立只读详情；编辑是显式动作，不用 disabled 表单冒充查看。
- shape 驱动页签 manifest，普通与 SKU 商品必须不同。
- SKU 保留“维度和值 → 即时矩阵 → 默认项/价/条码”。
- 点单选项保留左分组树、中规则、右预览/结构检查。
- 套餐保留左树右详情、规则卡片、组件选择和结构检查。
- 库存/BOM 保留节点树+规则详情，明确“随保存商品一起提交”。
- dirty close 统一确认，提交中锁定，失败保留草稿。

#### 库存工作台

- 固定门店上下文；保留全部/需处理/低库存/无库存/负库存/未知。
- 分类、库存来源、名称/编码筛选；列为库存对象、当前库存、状态、低库存提醒、消耗、最近变化、库存来源。
- 详情分当前状态、变化趋势、盘点/增加历史、关联商品与扣减规则、变化记录；技术诊断折叠在最后。
- 盘点、库存增加、快捷配置是对象上下文动作，不做采购/入库单入口。

### 7.2 v2s 要改

1. **删除本期菜单/渠道摘要**：06 不在本期，不展示“已加入菜单草稿/渠道数”空事实。
2. **校验可定位**：v4 顶部“保存失败，请检查”过粗；v2s 给首错摘要、页签错误计数和字段定位。
3. **价格按形态**：v4 SKU 商品 item 价硬必填、SKU 价可缺会制造 `0.00` 假基准。草稿可不完整；激活时 ITEM 粒度要求 item price，SKU 粒度要求每个 active SKU 有价。
4. **“增量入库”改“库存增加”**，避免供应链单据暗示。
5. **“需处理”只是工作台派生视图**，不进入 stockState。
6. **高级诊断降噪**：门店默认看业务流水；幂等/watermark 仅授权诊断区显示。
7. **图片升级**：多图排序、主图、预览、替换/移除；业务只存 ref。
8. **生产标签独立入口**：商品编辑只关联/查看；定义、停用、作用域在生产标签维护面完成。

### 7.3 不搬的历史惯性

- 本期任务未证明的导入、导出、商品字典入口。
- shape 派生后又允许手改 itemKind/capability 的重复控件。
- 跨商品共享 OptionGroup/OptionValue 复杂管理链；按 D-5 使用 per-item typed structure。
- 无消费者的 authority、扣减、恢复、外部调用、图表大契约面。
- 供应链仓库/批次信息，或把高级诊断与业务流水平铺。

## 8. 非功能与一致性

### 8.1 一致性

- 所有写有幂等键和 expectedVersion；商品+inventory rules 原子成功/失败。
- 库存余额乐观锁；流水幂等唯一；盘点冻结 before/input/conversion/after。
- 归档不物删，历史销售快照、套餐引用、库存/BOM/流水仍可读。
- 关联候选由目标 owner 提供 typed ID，不在前端拼名称/编码或相信请求 scope。

### 8.2 查询与效率

- 列表、详情、表单支持是独立 task read model；一个 surface 不循环查 item/SKU/BOM。
- 商品列表 set-based；SKU 子行可懒加载但批量；库存列表一次返回余额和必要摘要。
- 商品编辑支持可由任务 query 组合 catalog/inventory/production tag；跨 schema join 只用于显式读取，不产生写权。
- 搜索先 PostgreSQL 索引/FTS/trigram，不预建搜索服务。
- 图片列表和结构 JSON 有上限，SKU 笛卡尔积前后端双限界。

### 8.3 契约与单一真相

- `shape` 是 OpenAPI component 闭集 enum，并生成两端类型、manifest 与服务端校验，不复制字符串。
- attributes map 是唯一开放描述容器；SKU、选项、套餐、图片、生产标签、库存规则均 typed。
- 金额为整数分；数量用明确 decimal 精度和单位，不用浮点。
- `x-consumer-faces` 决定暴露面；业务页属于 operations-admin，权限仍由 workspace IAM 与 owner 重核验。

### 8.4 资产

- 复用既有 asset owner；商品只接收稳定 `assetRef`。
- 被引用资产不能物删；移除商品关联不等于删文件。
- DEV/UAT 可用当前对象存储实现，但业务 API 不暴露路径假设；CDN 只替换解析/分发层。
- 图片类型、大小、尺寸、数量、排序、主图在下一阶段契约设计一次裁决。

### 8.5 日志、审计、安全

- 商品保存/状态/复制、生产标签、BOM/库存规则、盘点、增加、调整均有业务审计和同 correlation ID 诊断。
- 日志记 operation、scope、objectRef、version、result、failureType，不记图片二进制、raw payload、隐私或凭据。
- 库存流水不是运行日志，运行日志也不替代流水/审计。
- 列表/详情/保存链观察 database operation count 防 N+1；性能结论仍需受控 workload。

### 8.6 可用性

- 树、tab、表格、抽屉全键盘可达，关闭后焦点归还。
- loading、真空、筛选无结果、无权、冲突、保存失败分开。
- 改 shape、SKU 维度、BOM 模式前说明影响；已有下游事实时 fail closed。

## 9. 建议分期

分期是后续 Journey/设计顺序，不构成实施授权；每期仍先 Journey，再契约。

### P0：语言、形态、owner 冻结

- 裁决 O-01 至 O-07。
- 冻结 shape enum/能力矩阵、目录 owner、状态、价格粒度、图片约束。
- 冻结 catalog/inventory/production 三 owner 的同步事务和 task read 边界。

### P1：生产标签与共享字典

- 生产标签全能力；分类、标签、销售单位、SKU 销售属性/值、候选查询。
- 先建稳定 ref，避免商品 payload 临时字符串。

### P2：商品目录主线

- 总部/门店目录与批准形态。
- 多图、自由 attributes、识别码、SKU 矩阵、选项、套餐、生产标签关联、引用保护。
- 只读详情、编辑、复制、归档。

### P3：门店库存/BOM交易前闭环

- StockTarget/Balance/Ledger/BOM。
- 商品页库存/BOM节点工作台与原子 whole-save。
- 库存现状、详情、库存增加、盘点覆盖、人工调整。
- owner、版本、幂等、审计、日志和 L2 同批闭合。

### P4：真实环境收口

- 总部模板→门店复制完整 Journey，含图片、结构、生产标签和批准的 BOM 模板。
- 普通、SKU、套餐、物料各至少一个；库存覆盖正常/低/零/负/未知。
- business 与 cleanup 分账；不拿 seed 样本声称全接口性能。

后续独立 Roadmap 才进入菜单发布；再后续交易订单启用扣减/恢复；履约域启动时再扩处理面与生产运行时。

## 10. 仍需 Dexter 裁决

已拍板的 v1 Q1-Q6、D1-D6 和本任务冻结前提不重开。

| ID | 问题 | 选项 | Codex 推荐 |
| --- | --- | --- | --- |
| O-01 | 本期可见商品形态 | A：七种全开放；B：模型七种，首期 UI 不开放权益壳 | **B**。权益规则/资产不在本期，开放空壳无法闭环 |
| O-02 | SKU 与点单选项互斥范围 | A：仅 `REQUIRED_MATRIX` 互斥；B：任何非 `NONE` SKU mode 都互斥 | **A**。先锁强矩阵的确定冲突，`OPTIONAL_TABLE` 不因技术字段被无依据禁用 |
| O-03 | SKU 商品价格校验 | A：item 价硬必填、SKU 可缺；B：按 priceGranularity 激活校验 | **B**。避免 0 元假真相；SKU 粒度要求 active SKU 价格齐 |
| O-04 | 图片上限 | A：不限；B：固定上限+主图/排序 | **B，建议 9 张**。足够展示且上传/契约可控，未来不改模型即可配置 |
| O-05 | 生产标签门店覆盖 | A：门店只能新增；B：可新增并局部停用/改展示名 | **B**，但 code/ref 不变，只新增覆盖事实 |
| O-06 | 允许负库存后的反馈 | A：仍归“需处理”；B：不提示 | **A**。写策略不等于余额健康；提示但不阻断 |
| O-07 | 本期“消耗趋势” | A：显示空/零；B：订单扣减未落地前隐藏 | **B**。不造伪指标；先显示“变化趋势”，真实销售消耗待交易域 |

## 11. v6/v1 到 v2s 的必要修正

1. v6 的 MQ/outbox/topic 不是本期架构输入；保留 owner、快照、幂等和不可变事实语义。[S11/S12]
2. v6 描述属性定义实体不适用：Dexter 已裁决自由 map、无 schema；需过滤的另入标签/明确字段。[S05 Q2]
3. v1 Q4 早期把 `PreparationProfile` 作为实体保留，但后续 D-3 与精简骨架已把生产提示折入商品 typed JSON、生产标签单独成为关系字典；本文采用后出的修正版，同时不把生产标签降成 JSON 字符串。[S05 Q4；S07 D-3]
4. v6 完整外部库存权威首期不成立：沿用 v1 Q4，只做 internal light stock，不造 ERP stub。[S06 Q4]
5. v1 “不得直连 catalog 表”在 v2s 应解释为：写严格 owner API；显式任务型读可跨 schema join，避免进程内 API N+1，但不得据此写/锁/授权。[S11 B.6；S12]
6. v1 事件驱动扣减不能照搬；未来有订单后按当时真实边界裁决，当前不为未来 MQ 化。[S06 Q2；S12]
7. v4 商品级价格硬必填不应无条件复刻；由 shape/priceGranularity 决定激活条件。
8. v4 菜单渠道摘要、导入导出和高级诊断不是必搬内容，它们不是本期用户任务。

## 12. 后续 Journey 的验收问题

1. 总公司怎样建模板，门店怎样选择复制且不被总部后续修改？
2. 普通与 SKU 商品为何显示不同页签，两端怎样从同一 shape contract 得出？
3. 多图怎样排序并让未来 CDN 无感？
4. 生产标签由谁创建、在哪生效，为何商品不能创建生产运行配置？
5. 一次保存怎样原子写两个 owner，又不合并真相？
6. 盘点、增加、调整怎样全部形成流水，余额怎样重建？
7. 为什么负/零库存不自动下架？
8. 哪些 v4 行为保留、哪些删除，是否都对应真实任务？

这些问题未被 Journey、契约和交互工件回答前，不应进入 schema 或实现。

## 13. 读取与活环境证据

### 13.1 源文件 SHA-256

```text
S01 8c29d94ab78d8403e079cea3ea6dcbdbcb7635b637d3400535bfe365e5353e5d
S02 9d05dce5f61a570c7e21411f239391986f72a106e23257767fc9063423464058
S03 715a99efbbba5c9b46a1b958cdd463e4a8360b13ac48b7c5e998b5520ebc8d12
S04 0e7323a62d05654729bff4c2d0a918547f4f76accc5a64b8226329cfb26198e7
S05 bd4d1d26867fd86e43ff0223d11528941e544f365f20aa8bc8bed708a21e54f9
S06 14a473a56bf455f284417e9201ae2d001126a83afaa5046a43357c37122760f2
S07 efb7b51f8fdb2da29606edd2fa85c4831034965556b6eda8d889c25e8db8bd6f
S08 b2f73828dae828ae88b40897fdf7ada613fc28bf54753a65b0833b62b9bbec09
S09 3092c010bfa816d35f97dded6d4b6c43ef02764bda45d08ce687be635715e139
S10 3dba1c80579d4a0eca281efd59d27fbfb20aa86572648f8e36c83a68a603b4f3
S11 84037f1c81ae17ce51ee488723f5e230b4fe3f76c16e690c58c96606793e6c69
S12 3b90bd602eb682c4718d6c51f399501c34f804cddd96da82d59495e60b115a8d
```

### 13.2 LIVE 亲验

以下是本次只读浏览得到的观察性参考，不反向定义领域真相，也不作为任何冻结需求的唯一证据：

- 商品工作台：门店上下文、分类/智能视图、状态/治理/来源/标签筛选、shape 摘要、SKU 子项。
- 普通商品页签：`基础资料 / 条码与识别 / 点单选项 / 属性 / 生产提示 / 库存与 BOM / 治理与引用`。
- SKU 商品页签：`基础资料 / SKU 规格与价格 / 属性 / 生产提示 / 库存与 BOM / 治理与引用`；实见两规格矩阵。
- 普通商品编辑：基础资料全宽表单；点单选项左树/中规则/右预览；库存/BOM 左节点树/右三态规则，实见 BOM 组件和消耗量，明确“随保存商品一起提交”。
- 库存现状：全部/需处理/低库存/无库存/负库存/未知；列与筛选符合 §7。
- 库存详情：当前状态、消耗趋势、盘点与增加历史、关联商品与扣减规则、变化记录、高级诊断；动作是存量盘点、增量入库、快捷配置，其中 v2s 建议将“增量入库”改称“库存增加”。

浏览器全程只读浏览、切页签和进入编辑态，未提交表单、未保存或修改 v4 数据。

## 14. 授权边界

本文只完成需求调研与分析，不授权实现、OpenAPI/contract、generated wire、schema、数据库/migration、seed/reset、DEV/UAT/L2、runtime 部署或来源仓写入。下一步应由 Dexter 比较 Codex 与 Claude 两份独立分析，裁决开放问题与需求基线后，再按“Journey → 契约 → 实现”进入后续阶段。
