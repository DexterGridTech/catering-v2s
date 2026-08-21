# 商品库存与 BOM 业务模型正式需求

<a id="catalog-inventory-bom-formal-requirements"></a>

状态：`ACCEPTED_BY_DEXTER`

日期：2026-08-22

独立合理性评审：`doc/review/platform/2026-08-22-v2s-catalog-inventory-bom-business-model-requirements-review-claude.md`，结论 `GO`，`M/S/N = 0 / 3 / 3`；其中 3 条 S 与 3 条 N 已折入本文。

已接受裁定（Dexter，2026-08-22）：

1. 接受“商品结构派生 owner 节点 + 每个节点唯一库存扣减方式 + BOM 行只选择组件库存对象”的推荐结构。
2. 库存/BOM shape、节点准入、owner 粒度、允许方式和字段必须先在 contract 中完整约定；前端只按 contract 展示与组装草稿，后端必须按同一 contract 重新派生并拒绝非法组合。
3. 普通销售商品与称重销售商品不存在 SKU；只有“按 SKU 管理商品”存在 SKU。普通/称重库存与 BOM 固定商品级，按 SKU 管理商品固定 SKU 级。
4. `MATERIAL + SEMI_FINISHED` 当前不允许 BOM，只允许建立库存对象和被其他 BOM 引用；生产配方待生产入库、消耗和损耗语义单独裁定。
5. 零余额、无流水、无 BOM 引用且未被历史快照使用时，可以受控切换扣减方式；存在任一余额、流水、引用或历史依赖时拒绝自动切换。
6. 本专题不开放物料 shape 同时作为普通销售商品；物料兼售另开产品议题，不在本专题改变七 shape 和销售发布语义。
7. 一级用户文案固定采用“不参与库存 / 直接扣当前商品或 SKU / 按 BOM 扣组件”，不再把“新增独立库存对象”作为用户任务。

主题：商品 shape、库存对象、销售扣减方式、BOM owner 与 BOM 组件之间的业务关系

`SKILL_USED=cs-brainstorming@4a54a4858b99807f3155ed1614b2f116e35ea5c1b788e793f565dd837fd3891f`

## 0. 本稿完成什么

本稿不是实施设计，也不授权修改契约、数据库、后端、前端、seed 或运行环境。

本稿只完成一件事：基于 V6 正式领域模型、v4 已实现交互和当前 v2s owning source，重新回答下面这个用户问题：

> 什么样的商品 shape，可以使用什么样的库存与 BOM 形式；用户在商品详情中究竟是在配置谁、配置什么、会产生什么库存结果？

本稿的成功判据：

1. 用户不需要理解 `StockTarget`、`ProductBom`、`ownerTargetType` 等技术名词，也能判断应该选哪种库存方式。
2. 商品、SKU、选项值、BOM 组件四种对象不再混成同一种“节点”。
3. 同一销售节点不会同时出现商品级与 SKU 级库存，也不会同时执行“直接扣本品库存”和“按 BOM 扣组件”。
4. 原料、套餐、服务、权益和销售商品的库存语义各自可解释，不靠页面隐藏掩盖后端语义缺口。
5. 不推翻已接受的单位模型、owner 边界、轻库存边界、点单选项和 SKU 销售属性。

## 1. 先给结论

当前问题不是“页面少了一段说明”，而是当前 v2s 页面把三类不同事实压成了同一种扁平记录：

1. **谁在发生销售或选项消耗**：商品、SKU、选项值，这是 BOM/扣减规则的 owner。
2. **直接扣谁的库存**：商品或 SKU 自己对应的 `StockTarget`，它应由 owner 节点确定，不应让用户再选一个别的商品。
3. **按配方扣哪些组件**：BOM 行引用的已有 `StockTarget`，它才需要组件选择器。

因此推荐目标不是继续提供“新增独立库存对象”“新增 BOM 组件”两个顶层按钮，而是恢复并修正 v4 已验证过的主心智：

```text
商品结构自动形成节点树
  -> 用户选择一个可配置 owner 节点
  -> 为该节点选择唯一的库存扣减方式
       不参与库存
       直接扣当前商品/SKU库存
       按BOM扣组件库存
  -> 只展示该方式需要的配置
```

其中：

- “直接扣当前商品/SKU库存”不出现商品/库存对象选择器；库存对象就是当前选中的商品或 SKU。
- “按 BOM 扣组件库存”才出现组件行，每行选择一个已有、可用的组件库存对象并填写消耗量。
- 选项值只能配置“无附加耗用”或“按 BOM 增减耗用”，不能形成自己的库存对象。
- 当前轻库存范围内，同一销售 owner 的“直接扣本品库存”和“按 BOM 扣组件”必须互斥；否则一次销售到底扣哪一套没有已裁定语义。
- shape 只决定结构准入、默认粒度和禁止项；具体是否启用库存、使用直接扣减还是 BOM，仍是 inventory owner 的显式事实，不能从 shape 自动推成既成事实。

## 2. 为什么当前页面会让人困惑

### 2.1 当前页面不是按商品结构配置，而是手工堆卡片

当前 `InventoryBomEditor` 直接向一个 `CatalogInventoryBomEntry[]` 追加记录：

- “新增独立库存对象”追加一条 `mode=INDEPENDENT_STOCK`。
- “新增 BOM 组件”追加一条 `mode=BOM`。
- 每条记录都显示成“节点 1 / 节点 2 / 节点 3”。
- 两种模式共用同一个 `bomTarget` 选择器。

结果是用户看不到“当前在配置烤鸡翅商品、某个 SKU，还是某个选项值”，只能看到若干技术卡片。

### 2.2 “独立库存”错误地要求选择已有库存对象

直接库存控制本应表示：卖出当前商品或 SKU 时，直接扣当前商品或 SKU 的余额。

当前前端却要求 `INDEPENDENT_STOCK` 也必须有 `itemRef`，验证文案还要求“请选择已有库存对象”；选择器返回什么商品/SKU，保存时就把那个 `itemRef/productSkuRef` 带给库存 owner。截图中在“烤鸡翅”详情里出现“培根 · BACON-001”的独立库存卡片，正是这种对象角色混淆的可见结果。

### 2.3 一份结构同时承担 owner、库存对象和 BOM 行

当前 `CatalogInventoryBomEntry` 同时包含：

- owner 身份相关字段：`itemRef/productSkuRef/optionValueRef`；
- 库存对象字段：`targetRef/configuration`；
- BOM 行字段：`quantity/lineSign`。

这导致“一个商品的一条 BOM”在 UI 上不是一个 owner 下的多行配方，而是若干顶层“BOM 节点”；用户无法从页面判断这些行共同属于哪个商品/SKU/选项值。

### 2.4 当前 shape 粒度与节点准入也可能冲突

普通计件和称重 shape 的 `inventoryHintGranularity` 是 `ITEM`，按 SKU 管理 shape 才是 `SKU`。但当前准入同时允许普通/称重商品出现商品节点和 SKU 节点，后端 shape 校验也没有闭合“只能选一种粒度”。

这会产生两个风险：

1. 同一商品同时存在商品级和 SKU 级库存/BOM，未来扣减可能重复或不确定。
2. 库存结构随“有没有某条 SKU”漂移，而不是由明确的商品管理策略决定。

## 3. V6、v4 与当前 v2s 各自说明了什么

### 3.1 V6 正式领域模型给出的不可突破语义

V6 的关键结论不是“三态页面长什么样”，而是领域主权和事实边界：

1. `CatalogItem` 回答“经营对象是什么”；不拥有余额、真实消耗、可售和菜单发布。
2. `StockTarget` 是商品或 SKU 对应的可库存对象；选项值不能成为 `StockTarget`。
3. `ProductBom` 的 owner 可以是商品、SKU、选项值或经营入口覆盖；BOM 行只能引用已有库存对象。
4. `inventoryHintGranularity=SKU` 不自动创建 SKU 库存或 SKU BOM；具体配置仍是库存域事实。
5. 没有 BOM 不阻断销售。
6. 库存提示不是可售，库存配置不能反推菜单发布或订单必然成立。
7. `SERVICE_ITEM`、`COMPOSITE_ITEM`、`BENEFIT_ITEM` 起步期不开放普通实物库存/BOM能力。

因此，V6 支持 shape 做 UI/能力准入，但不支持“选择某个 shape 就自动拥有库存或 BOM”这种推断。

### 3.2 v4 值得继承的不是旧代码，而是已经验证过的用户心智

v4 已实现：

1. 左树由当前商品结构自动生成主商品、SKU 目录/SKU、选项目录/选项值。
2. 目录节点不可配置，商品/SKU/选项值是规则 owner。
3. 每个 owner 节点只有一条规则，模式为 `NONE / INDEPENDENT_STOCK / BOM`。
4. 独立库存配置不选别的商品；它为当前 owner 创建或维护库存对象。
5. BOM 模式在当前 owner 下维护多条组件行；组件行才选择已有 `StockTarget`。
6. 切换到独立库存时停用旧 BOM；切换到 BOM 时停用旧库存对象；有引用时拒绝危险切换。
7. 有 SKU 的主商品不再配置商品级库存/BOM，选项值不能独立库存。

这些是可以继承的业务交互骨架。

v4 不能照搬的部分包括：旧销售单位被当作消耗单位、自由盘点单位、固定四位精度、部分 shape 后端硬门缺失、实际 SKU 存在性与显式粒度混用，以及历史模板/多服务结构。

### 3.3 当前 v2s 已经具备、应当保留的正确基础

1. catalog 与 inventory owner 分离，并可在同一 `REQUIRED` 事务中协调写入。
2. shape 准入已在后端复核，不只靠页签隐藏。
3. `StockTarget` 与 `ProductBom` 分表、分命令，由 inventory owner 持有。
4. 消耗单位来自商品/SKU 基础计量单位快照；盘点单位只服务录入换算。
5. BOM 组件引用已有库存对象；组件库存对象不因 BOM 行而隐式创建。
6. SKU 覆盖单位、选项值实际用量、历史单位快照等本轮单位模型成果均不应被本专题改回旧语义。

本专题要修的是“结构与交互模型”，不是推倒上述 owner 和单位基础。

## 4. 推荐的业务概念模型

### 4.1 五个概念必须分开

| 概念 | 回答的问题 | 允许对象 | 是否用户手工新增 |
| --- | --- | --- | --- |
| 商品 shape | 这个商品采用哪套结构与经营意图 | 七种现有 shape | 创建商品时选择 |
| 库存/BOM owner 节点 | 谁发生销售或选项耗用 | 商品、SKU、选项值 | 否，由商品结构派生 |
| 库存扣减方式 | 该 owner 发生一次业务数量时怎么处理库存 | 无、直接扣本品、按 BOM 扣组件 | 用户在 owner 节点选择 |
| 库存对象 | 哪个商品/SKU持有余额和流水 | 商品、SKU | 否，由“直接扣本品库存”受控创建 |
| BOM 组件行 | 这份商品/SKU/选项值耗用哪个库存对象多少 | 同 owner scope、状态可用、具备 `BOM_COMPONENT`、已有 StockTarget、基础计量单位完整的商品/SKU库存对象；不得直接自引用 | 是，在当前 BOM owner 下新增行 |

### 4.2 三方前置链

```text
前置一：catalog 已有稳定商品结构
        商品 ref、SKU ref、选项值 ref、shape、基础计量单位
                ↓
前置二：inventory 为可库存的商品/SKU建立 StockTarget
        同 owner 范围、消耗单位快照、状态可用
                ↓
前置三：ProductBom owner 才能引用这些 StockTarget 形成组件行
        不自动创建组件、不引用自由商品串、不改写历史快照
```

缺少任一前置都必须给出明确阻断原因，不能用 fallback 伪造节点或库存对象。

### 4.3 当前阶段的三种扣减方式

面向用户建议不用“库存模式”这个技术词，而叫“销售/使用时怎么扣库存”：

| 业务选项 | 领域结果 | 适用说明 |
| --- | --- | --- |
| 不参与库存 | 不创建当前 owner 的新 StockTarget，不启用当前 owner 的 ProductBom | 不代表其他层级的选项 BOM 不会产生耗用 |
| 直接扣当前商品/SKU库存 | 当前商品或 SKU 拥有唯一 StockTarget；余额、阈值、盘点和流水都属于它 | 瓶装饮料、预包装食品、按件成品、按重量直接售卖物 |
| 按 BOM 扣组件库存 | 当前商品/SKU/选项值拥有 ProductBom；每行引用已有组件 StockTarget | 现制餐品、饮品配方、加料/去料/换料 |

当前阶段同一个销售 owner 只能选择其中一个主方式。原因不是数据库不能同时存两类记录，而是尚未定义“一次销售同时扣成品库存和组件库存”或“什么时候生产入库、什么时候展开半成品 BOM”的业务语义。

如果未来引入 `PRODUCIBLE`、生产批次或半成品生产入库，应单独设计“生产配方”，不能把当前销售 BOM 悄悄解释成生产 BOM。

## 5. 推荐 shape × 节点 × 库存/BOM 矩阵

以下为本稿推荐目标，不是已经批准的最终裁定。

| Shape | 可配置 owner 粒度 | 主扣减方式 | 选项值 | 能否作为其他 BOM 组件 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 普通销售商品 `STANDARD_SALE_COUNTED` | 商品级 | 不参与 / 直接扣本品 / 按 BOM 扣组件 | 无附加耗用 / 选项 BOM | 当前不允许 | 瓶装饮料选直接库存；现制菜品选 BOM |
| 按 SKU 管理商品 `SKU_VARIANT_SALE_COUNTED` | SKU 级；主商品壳只读 | 每个 SKU 分别选择不参与 / 直接扣 SKU / SKU BOM | 当前 shape 不开放点单选项 | 当前不允许 | 不允许再配置商品级库存，避免双重扣减 |
| 称重销售商品 `STANDARD_SALE_WEIGHED` | 商品级 | 不参与 / 直接扣本品 / 按 BOM 扣组件 | 无附加耗用 / 选项 BOM | 当前不允许 | 称重只表示输入数量方式，不决定库存策略 |
| 原材料/半成品/包装物 `MATERIAL` | 商品级 | 不管理 / 建立本品库存对象 | 无 | 仅已启用且可用的本品库存对象可作为组件 | 当前不把其 BOM 解释为生产配方；半成品生产语义待单独裁定 |
| 商品型套餐 `COMPOSITE` | 无库存/BOM owner | 无 | 无 | 否 | 套餐内容是销售组合，不是 BOM；各组件按自身规则产生库存影响 |
| 服务/费用商品 `SERVICE` | 无 | 无 | 无 | 否 | 不进入普通实物库存账本 |
| 权益商品壳 `BENEFIT_SHELL` | 无 | 无 | 无 | 否 | 权益额度/库存属于权益域，不走普通库存 |

补充规则：

1. SKU 销售属性值不是库存/BOM owner；它只用于构成 SKU。
2. 点单选项值不是库存对象，只能拥有附加/替换 BOM。
3. 套餐组件关系不是 BOM 行；套餐中每个实际销售组件继续使用自己的商品/SKU库存规则。
4. `measureMode=WEIGHED` 只影响销售数量输入，不代表一定直接扣库存，也不代表消耗单位。
5. 原料必须有基础计量单位且已形成可用 StockTarget，才能被 BOM 行引用。

### 5.1 商品与 SKU 粒度硬规则（已裁定）

v4 依据“是否存在非归档 SKU”在商品级与 SKU 级之间切换，当前 v2s 生成源又把普通/称重 shape 声明为 `OPTIONAL_TABLE`。这两种口径都不再保留。

规则固定为：

- 普通计件 shape：`skuMode=NONE`、`inventoryHintGranularity=ITEM`，库存/BOM owner 只能是商品与其点单选项值。
- 称重销售 shape：`skuMode=NONE`、`inventoryHintGranularity=ITEM`，库存/BOM owner 只能是商品与其点单选项值。
- 按 SKU 管理 shape：`skuMode=REQUIRED_MATRIX`、`inventoryHintGranularity=SKU`，主商品壳不可配置库存/BOM，每个 SKU 独立选择扣减方式。
- SKU 销售属性值仍只构成 SKU，不成为独立库存/BOM owner。
- 当前 `HAS_SKU / NO_SKU` 动态切换规则从目标 contract 退役；不允许因数据中碰巧出现 SKU 而改变库存粒度。

如果未来需要“称重且按 SKU 管理”，必须单独讨论新 shape，不复用普通称重商品并偷偷开放 SKU。

### 5.2 contract 单一真相要求（已裁定）

库存/BOM contract 对每个商品 shape 至少必须声明：

1. `skuMode` 与 `inventoryOwnerGranularity = ITEM | SKU | NONE`。
2. 可出现的结构节点类型与目录层级。
3. 每种结构节点允许的扣减方式、默认方式和禁用原因。
4. 每种方式的字段、必填、只读、单位来源和候选选择器。
5. BOM 组件候选条件与 owner scope。
6. 方式切换、停用、归档和已有引用时的生命周期规则。
7. 保存请求、详情 readback 和摘要所需的 typed 结构。

三方式准入只看 `shape × owner 节点 × 方式` 矩阵；`usageCapabilities` 不作为“直接扣当前商品或 SKU”的准入条件，`BOM_COMPONENT` 仅作为 BOM 组件候选门。

前端职责：

- 根据商品草稿和 contract 生成 owner 节点树；
- 只展示 contract 准入的方式与字段；
- 提交 typed owner rule，不提交用户可篡改的任意 nodeType/itemRef 关系；
- 前端校验只服务即时反馈，不作为业务安全边界。

后端职责：

- 根据当前事务内已保存的商品结构和同一 contract 重新派生 owner 节点、粒度和允许方式；
- 不信任前端提交的 shape、nodeType、ownerRef、SKU 归属或模式合法性；
- catalog owner 解释商品结构与能力，inventory owner 解释 StockTarget、BOM、余额、流水和引用；
- 任一非法组合返回 typed problem，不能依赖页签隐藏，也不能用 fallback 修正请求。

## 6. 典型业务例子

| 商品 | Shape | 推荐方式 | 实际结果 |
| --- | --- | --- | --- |
| 瓶装可乐 | 普通销售商品 | 直接扣当前商品库存 | 卖 1 瓶，扣可乐 StockTarget 1 瓶 |
| 拿铁 | 普通销售商品 | 按 BOM 扣组件 | 卖 1 杯，扣咖啡豆、牛奶、杯子对应库存对象 |
| 大/中/小杯鲜榨果汁 | 按 SKU 管理商品 | 每个 SKU 配各自 BOM | 不同杯型使用不同水果和杯子数量；主商品不再扣一次 |
| 散装熟食 | 称重销售商品 | 直接扣当前商品库存 | 盘点或人工调整以 kg 录入 `0.3567`，目标消耗单位为 `g precision=0` 时写入 `356g`；销售触发扣减的数量单位来源不在本专题承诺 |
| 生菜 | 物料 | 建立本品库存对象 | 可被沙拉 BOM 引用；自身没有销售 BOM |
| 餐盒 | 物料/包装物 | 建立本品库存对象 | 可被外带相关 BOM 行扣减 |
| 加珍珠 | 选项值 | 选项 BOM 正向行 | 不创建“加珍珠”库存，额外扣珍珠 StockTarget |
| 不加牛奶/换燕麦奶 | 选项值 | 选项 BOM 负向/正向行 | 在基础 BOM 上扣回普通牛奶并增加燕麦奶耗用 |
| 双人套餐 | 商品型套餐 | 不在套餐壳配置库存/BOM | 套餐选择结果展开到实际子商品/SKU，再各自按规则扣减 |
| 预制肉酱 | 半成品 | 当前仅建立本品库存对象 | 如何由原料生产并增加肉酱库存尚未裁定，不能用销售 BOM 代替 |

## 7. 推荐交互需求

### 7.1 页面结构

恢复 v4 的“左树右详情”，但使用 v2s 当前 shape、单位和 owner 契约：

```text
库存与 BOM
├─ 商品：拿铁（可配置）
│  ├─ 商品 SKU（目录；仅 SKU 粒度商品出现）
│  │  ├─ 中杯（可配置）
│  │  └─ 大杯（可配置）
│  └─ 点单选项（目录）
│     └─ 加料（目录）
│        ├─ 加珍珠（可配置）
│        └─ 换燕麦奶（可配置）
└─ 右侧：当前选中 owner 的库存扣减方式与详情
```

当商品既无 SKU 也无点单选项、结构树只有唯一商品 owner 时，允许收起左树并直接呈现该商品的配置详情；这只是单节点交互退化，不改变 contract 中“结构派生唯一 owner 节点”的事实。

### 7.2 必须删除的用户动作

1. 删除顶层“新增独立库存对象”。
2. 删除顶层“新增 BOM 组件”。
3. 删除“独立库存模式也选择已有库存对象”的交互。
4. 删除用户手工创建 owner 节点、手工选择 nodeType、手工拼 item/SKU/option ref 的能力。

### 7.3 右侧详情

商品/SKU owner：

- 先显示“销售/使用时怎么扣库存”。
- 选择“直接扣当前商品/SKU库存”后显示当前 owner 摘要、消耗单位、盘点单位、换算、低库存阈值、负库存策略。
- 选择“按 BOM 扣组件库存”后显示当前 owner 摘要和 BOM 行表格。
- BOM 行只包含组件库存对象、正/负方向、每份耗用、组件消耗单位快照和操作。

选项值 owner：

- 不显示“直接扣本品库存”。
- 文案改为“这个选项是否改变物料耗用”。
- BOM 行支持正向、负向和实际用量；不误伤现有强制原料及实际用量规则。

目录或不准入节点：

- 只显示说明，不显示 disabled 的伪表单。
- 服务、权益、套餐主壳不出现库存/BOM 配置节点。

### 7.4 摘要必须直接回答业务问题

列表/树节点摘要建议使用：

- `不参与库存`
- `直接库存 · 消耗单位：瓶`
- `BOM · 3 个组件`
- `选项耗用 · +珍珠 20g / -牛奶 30ml`
- `未配置基础计量单位，暂不能启用库存`
- `已有余额/流水，暂不能切换扣减方式`

不要继续展示“节点 1”“允许模式”“目标引用”等技术文案。

## 8. owner 与一致性要求

1. catalog owner 决定商品结构、shape、SKU、选项值、基础计量单位和能力；inventory owner 不自行解释 catalog 表。
2. inventory owner 拥有 StockTarget、ProductBom、BOM 行、余额和流水。
3. 商品整单保存可以由 catalog edge coordinator 在同一 `REQUIRED` 事务中调用 inventory 公开 command。
4. owner 节点身份必须从当前保存后的商品结构解析；不得相信前端传入一个任意 item/SKU/option ref。
5. 一个 owner 节点最多一个 active 主扣减方式；不得同时 active 商品级和 SKU 级规则。
6. 切换方式前必须检查余额、流水和引用：
   - 未产生事实的旧配置可受控替换；
   - 已被引用或已有历史的对象不得物理删除；
   - 不能安全切换时返回 typed problem，并说明如何处理。
7. BOM 组件必须同 owner scope、状态可用、具备组件能力、已有 StockTarget、基础计量单位完整，且不得直接自引用。
8. BOM 行不得隐式创建组件库存对象；用户应先到组件商品的库存/BOM节点启用直接库存。
9. 无 BOM 不阻断商品保存或销售；运行时可返回 `NO_BOM_CONFIGURED`。
10. 历史流水、BOM 快照和单位快照不因后续 shape、单位名称或配置变化而重解释。

## 9. 单位规则保持现状，不回退 v4

1. 销售单位与基础计量单位仍是单值；SKU 可覆盖或清除覆盖后继承。
2. 直接库存的消耗单位来自当前商品/SKU基础计量单位快照，不来自销售单位，不由 `measureMode` 伪造。
3. 原料没有销售单位也可以建立库存对象，但必须有基础计量单位。
4. BOM 每份耗用按组件 StockTarget 的消耗单位解释。
5. 盘点单位只用于录入换算，不改变余额与 BOM 消耗单位。
6. 数量按单位 precision 向零截断，不四舍五入。
7. 单位停用只影响后续候选，不改既有绑定和历史快照。

## 10. 三个方案比较

### 方案 A：只改文案和布局，保留扁平 entry

优点：改动小。

拒绝原因：owner、库存对象和 BOM 行仍然是同一个结构；用户仍可在当前商品中选到别的商品作为“独立库存”，商品级/SKU级重复和多条模式冲突仍然存在。

### 方案 B：把 StockTarget 与 ProductBom 完全正交，允许同 owner 同时启用

优点：领域存储上最自由，也能覆盖未来“半成品既有库存又有生产配方”。

拒绝作为当前默认的原因：当前没有生产入库、销售时双扣、成品优先还是配方优先等裁定。直接开放会让一次销售的扣减结果不确定，并可能同时扣成品和原料。

未来如开放 `PRODUCIBLE`，应新增明确的生产场景与生产配方，而不是复用当前销售扣减模式制造隐式双语义。

### 方案 C：结构派生 owner + 每 owner 一个明确扣减方式（推荐）

优点：

- 用户问题与系统事实一一对应。
- 继承 v4 已验证的左树右详情和互斥模式。
- 保留 V6 的 catalog/inventory owner 边界。
- 可在当前轻库存范围内给出确定扣减结果。
- 可以明确阻止商品级/SKU级重复和隐式组件创建。

代价：需要重做当前前端草稿模型、生成契约和 owner 命令形状，不能靠 UI 局部补丁完成。

## 11. 验收场景草案

1. 普通商品“瓶装可乐”选择直接库存后，不出现商品选择器；保存后创建当前可乐商品自己的 StockTarget。
2. 普通商品“拿铁”选择 BOM 后，在拿铁 owner 下添加咖啡豆、牛奶、杯子三行；不创建拿铁 StockTarget。
3. 同一 owner 不能同时提交直接库存和 BOM；篡改请求由 owner 拒绝。
4. 按 SKU 管理商品主壳只读，每个 SKU 可独立选择直接库存或 SKU BOM。
5. 商品级和 SKU 级规则不能在同一商品同时 active。
6. 选项值“加珍珠”只能配置 BOM，不能创建 StockTarget。
7. SKU 销售属性值、商品标签、商品属性均不出现在库存/BOM owner 树中。
8. BOM 组件候选只包含同范围、可用、具备组件能力且已开启直接库存的商品/SKU库存对象。
9. 选择没有 StockTarget 的原料时明确提示“请先为该原料启用库存管理”，不自动补建。
10. 原料没有销售单位但有基础计量单位时，可以建立 StockTarget 并作为 BOM 组件。
11. 套餐、服务和权益商品不出现可配置库存/BOM owner；直接篡改请求也被后端拒绝。
12. 由直接库存切换为 BOM 时，如果旧 StockTarget 有余额、流水或被其他 BOM 引用，保存被明确阻断，不静默归档或删除。
13. 商品没有配置 BOM 时仍可保存和销售；但用户一旦选择“按 BOM 扣组件”，active BOM 至少要有一条有效组件行，不能用空 BOM 冒充已完成配方。
14. `0.3567kg -> g precision=0` 的行为语义仍按现行单位规则保存为 `356g`；承载该断言的存量夹具必须迁移到合法 shape，不得继续用普通 shape + SKU 的非法组合证明该规则。
15. 单位定义后来改名或停用，历史 BOM/流水仍按保存时快照解释。

## 12. 迁移与清理要求草案

本稿不设计具体 migration，但需求层必须先定清理原则：

1. 当前扁平 entry 必须按“真实 owner + 真实模式 + 真实组件”重建，不能按数组顺序猜。
2. 当前商品抽屉中指向其他商品的 `INDEPENDENT_STOCK` 记录属于待治理数据，不能静默改成当前商品，也不能继续当作合法关系。
3. 同一商品同时存在商品级和 SKU 级 active 规则、或同 owner 同时存在 active StockTarget 与 ProductBom 时，必须进入显式冲突清单。
4. 普通/称重 shape 下既有 SKU 行，以及依附这些 SKU 的 SKU 级 StockTarget、BOM、余额、流水、引用和历史快照，均属于 A-01 落地后的非法存量类。当前 acceptance 源码已确认存在 20 个使用普通 shape 再写 SKU 结构的 payload call site，后续详设必须逐项分类；单位截断/精度等行为夹具迁移到合法的按 SKU 管理 shape。当前 `catalogDefinitionSeed` 静态扫描未发现普通 shape + SKU 的同类组合，seed 设计仍须以完整定义分母复核并保持该非法组合为零。有历史事实的数据进入显式治理，不得伪装成商品级配置或静默删除。
5. 有余额、流水、BOM 引用和历史快照的旧库存对象只允许停用/归档或保留，不物理删除。
6. 迁移不能恢复 salesUnitRefs、自由单位串、`measureMode` 消耗单位或 JSON fallback。
7. 任何无法确定 owner 的记录必须阻断迁移并给出治理证据，不使用“尽量匹配”fallback。

## 13. 非目标

本专题不做：

1. 采购、供应商、仓库、库位、批次、调拨、WMS、成本核算或毛利。
2. 任意单位两两换算引擎或库存专用单位库。
3. 菜单发布、可售、自动沽清、订单成立或履约生产全链路。
4. 多版本 BOM、审批、生效窗口、替补料和递归 BOM 引擎。
5. 半成品生产入库、生产损耗或 `PRODUCIBLE` 运行语义。
6. 改造商品标签、SKU 销售属性、商品属性、点单选项或套餐内容模型。
7. 用 shape 自动创建库存/BOM事实。
8. 为兼容当前扁平 payload 保留长期双写、fallback 或隐藏转换层。
9. 建立经营入口覆盖 BOM owner，或实现商品/SKU、选项与经营入口覆盖的四层合并次序。
10. 裁定销售触发扣减时的源数量单位与换算来源；该语义留给销售扣减链路契约，本专题只沿用已裁定的盘点/人工调整换算。

## 14. 禁止推断

1. shape 允许显示库存页签，不等于该商品已经有库存对象或 BOM。
2. `SELLABLE` 不等于已发布、可售或有库存。
3. `STOCK_MANAGED` 不等于已有余额。
4. `BOM_COMPONENT` 不等于已经创建 StockTarget；只有可用库存对象才能被组件行引用。
5. `measureMode=WEIGHED` 不等于消耗单位是 kg，也不等于一定使用直接库存。
6. SKU 属性值不是 SKU 本身，不能成为库存/BOM owner。
7. 点单选项值拥有 BOM，不等于它拥有库存。
8. 套餐内容不是 BOM，套餐壳也不因包含实物商品而自动拥有库存。
9. 无 BOM 不等于商品不可卖。
10. 库存不足不等于菜单自动下架或订单一定失败。

## 15. 业务语料映射

| 需求结论 | 业务语料 |
| --- | --- |
| CatalogItem 只回答卖的是什么，不拥有价格/销售发布/库存余额 | G-11 |
| SKU 是规格单位，选项值是制作/加料选择，两者不混为库存节点 | G-11 |
| 轻库存只包含 StockTarget、Balance、Ledger、BOM、扣减/恢复和提示 | G-12 |
| BOM 可挂商品、SKU、选项值；无 BOM 不阻断销售 | G-12 |
| 消耗单位是库存真相，盘点单位只服务录入 | G-12 + 已接受单位专题 |
| 库存提示不是可售，不从库存反推菜单与订单 | G-12 |

## 16. Dexter 已接受的完整裁定

### A-01 商品/SKU 粒度与 contract 主权（已裁定）

普通/称重无 SKU、固定商品级；只有按 SKU 管理商品使用 SKU 级。库存/BOM shape 必须先进入 contract，前后端消费同一事实并由后端重新派生、复核。

### A-02 `MATERIAL + SEMI_FINISHED` 当前不允许 BOM（已裁定）

当前只允许建立库存对象和被其他 BOM 引用；不允许把当前销售 BOM 当生产配方。等生产入库/消耗/损耗语义裁定后，再单独开放生产配方。

### A-03 用户文案使用任务语言（已裁定）

一级选项使用“不参与库存 / 直接扣当前商品或 SKU / 按 BOM 扣组件”；可在帮助说明中保留 StockTarget/BOM 技术解释，但不把“新增独立库存对象”作为用户任务。

### A-04 本专题不开放物料兼售（已裁定）

本专题不顺带修改七种 shape 和销售发布语义；保留当前 v2s 的物料 shape 非普通销售口径。若未来讨论同一目录对象兼具零售和原料身份，必须另开产品议题。

### A-05 已有库存事实时的扣减方式切换（已裁定）

零余额、无流水、无 BOM 引用且未被历史快照使用时，可以在同一事务中停用旧定义并切换；只要存在余额、流水、引用或历史依赖，就拒绝自动切换，要求显式治理。不得自动搬余额、重解释历史或同时保留两套 active 方式。

这里的“历史依赖/历史快照”按扣减定义生命周期理解：之前一次成功方式切换所保留的停用旧 StockTarget/ProductBom 定义（含当时 configuration/rows、单位快照与 version）就是历史定义快照。首次切换前没有这种旧定义时可通过；首次切换将旧定义停用保留后，后续第二次自动切换必须因该历史定义而拒绝。ledger 与当前 BOM 引用仍分别由“流水”和“BOM 引用”两个维度判断，不能拿单位历史或任意 copy 记录替代这一维。该澄清只把已裁定的“停用旧定义 + 历史依赖阻断”落为可执行事实，不开放强制切换或新治理动作。

本需求分析层面已无待 Dexter 裁定项；后续若 Journey、IA 或 implementation-facing design 发现新的产品语义缺口，必须重新显式提出，不能在技术设计中自行补义。

## 17. 后续顺序（仅在本稿经讨论确认后）

```text
需求分析定稿
  -> Journey/交互稿
  -> IA 修订
  -> implementation-facing design
  -> serial implementation plan
  -> 独立 design review
  -> Dexter 明确授权后才可实施
```

本稿不授权越过上述顺序。

## 18. 证据清单与内容锚点

| 来源 | 主要用途 | SHA-256 |
| --- | --- | --- |
| `project-memory/decisions/confirmed-business-language-corpus.md` | G-11/G-12 业务语言和边界 | `3dba1c80579d4a0eca281efd59d27fbfb20aa86572648f8e36c83a68a603b4f3` |
| `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md` | 既有节点树、形态准入和三态 IA；商品库存/BOM专题已加 `SUPERSEDED-BY` | `860224dc6b167bf66b2025715be6eb8f1d24312d3fca728801b6183e4f44d959` |
| `doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md` | 既有 modeRules、轻库存与 owner 裁定；商品库存/BOM专题已加 `SUPERSEDED-BY` | `ce32dcf053b2a427576f38ad83719683a7e0488a28b530befea0cd3b31efeeea` |
| `scripts/generate/catalog-inventory-p1.mjs` | 当前七 shape、准入、粒度与生成契约源 | `dbf6683a31aa2221f964a3f8ca9123218dffc722f46d4352affc0e89af9d0299` |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx` | 当前扁平 InventoryBomEditor 和保存 payload | `65ca4416583f2e3147230f5317340fd23e92d8be8108b87df8de6260909af561` |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | 当前 catalog→inventory 协调与 entry 分流 | `e6dd0742c9f7ce37626b2476b0f2e864b232a8a96a7a2e6eca48c5c812fd2204` |
| `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java` | StockTarget/ProductBom 分立 owner 事实 | `1fd8a8d62b93c3ad742bb26f8e61db50e020062cc4b9f33582af0f01a8b4b168` |
| v4 `2026-06-08-catalog-item-integrated-inventory-bom-redesign.md` | 左树右详情和规则 owner 原始设计 | `cf80065a33e46a9488052ab956178d73c6a7cac3a84f48a0c0ec6385175dcca8` |
| v4 `catalog-item-inventory-bom-state.ts` | 商品结构自动成树和每节点规则 | `a053930d93afeea641fcda084e7e0f385461f416b06247d38c4edbe89be1a676` |
| v4 generated `catalog-item-editor-manifest.ts` | 三态、节点、粒度和禁用原因 | `6b13b340334a7bf067a760db5614776d5f0b55e099f6f04a4c23d7a3fd358d95` |
| v4 `CatalogInventoryBomOrchestrator.java` | 模式互斥、旧事实停用、组件校验 | `d38f125bd372f7c788cdd4ed595d883ac9abcef6062316c2172ab9fa9f6d17f6` |
| V6 `05-商品目录域.md` | CatalogItem、能力、SKU policy 主权 | `8c29d94ab78d8403e079cea3ea6dcbdbcb7635b637d3400535bfe365e5353e5d` |
| V6 `07-销售库存与物料扣减域.md` | StockTarget、ProductBom、单位、轻库存正本 | `9d05dce5f61a570c7e21411f239391986f72a106e23257767fc9063423464058` |
| V6 `08-商品销售库存可售与渠道发布契约.md` | 库存提示、销售可售和跨域红线 | `638f97484cfbb409e36103337e888ada56a8cc78f6424170f7a3dc927f2ede54` |

内容锚点：

- V6 商品目录：`usageCapabilities`、`CatalogItemSkuPolicy`、`OptionValue`。
- V6 库存：`StockTarget`、`ProductBom / ProductBomLine`、`SalesStockView`。
- v4 交互：`buildDraftTreeNodes`、`inventoryBomWorkbench.modeRules`、`CatalogInventoryBomOrchestrator.applyRule`。
- 当前 v2s：`InventoryBomEditor`、`catalogDraft.inventoryBom`、`inventoryConfiguration.nodes`、`coordinateSaveInventory`。
