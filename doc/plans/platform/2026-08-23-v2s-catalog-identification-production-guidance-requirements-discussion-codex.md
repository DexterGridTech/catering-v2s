# 商品条码与标识、制作信息优化需求讨论稿

状态：`PROPOSED_FOR_DEXTER_DISCUSSION`

日期：2026-08-23

范围：商品静态识别、SKU 识别、商品/SKU 制作信息、点单选项制作影响、生产标签引用及其用户交互

实施授权：`false`

运行授权：`false`

本稿只用于需求讨论。任何 `RECOMMENDED` 都不是已裁定规则；只有 Dexter 明确接受后，才可转成正式需求并进入 Journey、IA、implementation-facing design 或实施。

## 0. 本稿要解决什么

用户当前看到的两个页面都把底层技术形状直接暴露成了业务操作：

1. “条码与识别”要求用户同时填写“类型、编码、识别码”，但没有说明三者分别是什么；类型还是自由文本，实际页面已经能读回 `BARCODE4` 这类契约外值。
2. “生产提示”让用户选择“商品 / SKU / 选项值”三种类别，却没有让用户选择具体 SKU 或具体选项值；它还同时展示生产标签、自由处理标签、打印标签、制作时长、备注和过敏原。

这不是把卡片改成表格、增加帮助文案就能修好的 UI 问题。当前 contract、持久化、owner 和页面共同缺少两组关键业务契约：

- 一个识别值究竟属于商品还是某个 SKU、是什么类型、在哪个范围唯一、如何被扫码反查；
- 一条制作信息究竟属于哪个具体对象、哪些字段可继承或叠加、哪些语义属于商品目录、履约生产、打印规则或商品属性。

本稿的成功判据是：

1. 用户只维护真实业务事实，不再填写 `kind/code/value` 这类无法解释的技术三元组。
2. 商品、SKU、选项值的制作差异都绑定到具体对象，不再用“SKU 类”“选项值类”各存一份共享对象。
3. contract 是 shape、节点、字段、闭集、合并规则与 typed problem 的单一真相；前后端同时消费并各自复核。
4. 商品处理语义不再污染打印规则、打印机配置、商品营销标签和过敏原信息。
5. 不误伤已经确认的商品 shape、SKU 销售属性、点单选项、库存/BOM 与单位模型。

## 1. 先给结论

### 1.1 条码与标识

推荐目标是把“识别码”恢复为可反查、可唯一约束的商品目录子实体，而不是继续保存在 `catalog_item.sections` 的自由数组中：

```text
具体可识别对象（商品或 SKU）
  -> 拥有 0..N 个识别码
  -> 每个识别码只有：类型 + 识别值
  -> 归属对象由当前商品 shape 和用户所在编辑位置确定
  -> owner 在目录范围内执行唯一性与反查约束
```

推荐删除当前识别码行里的“编码”字段。商品编码和 SKU 编码已经分别是 `CatalogItem.code` 与 `ProductSku.skuCode` 的一等事实；再给识别码造一个“编码”，既没有用户任务，也形成第三份内部编码真相。

### 1.2 生产提示

推荐把用户术语从笼统的“生产提示”收敛为“制作与出品”，并拆开三种不同形状：

```text
商品制作默认值
  -> 当前商品的一般制作方式

SKU 制作覆盖
  -> 某个具体 SKU 沿用商品默认，或显式使用完整覆盖

点单选项制作影响
  -> 某个具体选项值对已选商品/SKU增加的处理标签、制作说明或时长影响
```

三者不能继续共用一个 `Record<string, JsonValue>`。SKU 是单一销售变体，适合“继承或覆盖”；一次订单可同时选择多个选项值，选项值只能表达可确定合并的“影响”，不能冒充一份完整商品制作画像。

### 1.3 必须拆出的领域边界

| 当前页面字段 | 推荐归属 | 结论 |
| --- | --- | --- |
| 生产标签引用 | 履约生产 owner 定义；catalog 保存 typed ref | 保留，但必须绑定具体目标并参与有效制作信息解析 |
| 自由“处理标签” `stationTags` | 与生产标签引用重复 | 删除自由字符串，只保留 typed production tag ref |
| 打印名称 | catalog 可提供的可打印内容参数 | 保留但改称“出品显示名称”或“制作单显示名称”，不暗示已配置打印规则 |
| 打印标签 `printTags` | 语义不清，容易越界到打印场景/模板 | 当前推荐删除；若有真实业务任务，必须另行定义其消费者和闭集 |
| 预计制作秒数 | catalog 制作默认/覆盖事实 | 保留；选项值如何影响时长需 Dexter 裁定 |
| 生产备注 | catalog 制作说明 | 保留，需定义长度和快照语义 |
| 过敏原 | 商品/SKU 属性或商品标签 | 移出“制作与出品”；本专题不新建第二套过敏原库 |
| 快速创建生产标签 | 共享履约字典治理 | 从商品编辑移除；商品页只选择/查看，提供跳转到独立维护面 |

## 2. 三方来源给出的事实

### 2.1 V6：目标领域边界

V6 `05-商品目录域` 给出的稳定判断是：

1. 商品目录拥有商品定义、静态识别和生产提示，但不拥有履约工单、设备路由、打印规则或打印机配置。
2. `ProductIdentifier` 是商品识别码，条码、PLU、助记码和店内编码属于稳定识别事实；外部平台商品/SKU/选项 ID 不属于它。
3. `identifierGranularity=SKU` 时，识别码默认绑定具体 `ProductSku`。
4. `PreparationProfile` 可以关联商品、SKU、选项值；履约侧通过 `ResolvePreparationProfile(catalogItemRef, skuRef?, optionValueRefs?)` 读取解析结果。
5. 商品通过 `ProductionTagDefinition` 与履约规则连接；商品页不得选择处理面、工作台、队列、KDS、打印机或 TDP topic。
6. 打印规则域明确：商品目录只提供名称、条码、单位、保质期等可打印参数，不拥有模板、规则、打印机或打印任务。
7. 过敏原属于商品或 SKU 的属性/标签快照，不是履约路由事实。

V6 同时留下一个未闭合点：虽然给出了商品/SKU/选项值三层和 `ResolvePreparationProfile`，但没有定义三层如何合并。因此当前不能从 V6 自行推导“完全独立”“覆盖”或“叠加”中的任一种语义。

### 2.2 V4：已经实现过的能力与历史缺陷

V4 值得继承的部分：

1. `catalog_identifier` 是独立表，能按商品或 SKU 归属。
2. `identifier_type` 有数据库闭集；`identifier_value` 在目录与类型范围内唯一。
3. SKU 矩阵可以维护 SKU 条码，后端验收覆盖 SKU 粒度读回和落库。
4. 外部平台 ID 被明确排除，归外部映射。
5. 生产标签只保存语义引用，不允许商品绑定工作台、KDS、队列、打印机或履约路由。

V4 不能照搬的部分：

1. `catalog_identifier` 同时保存 `scope` 和 nullable `catalog_sku_id`，两个字段重复表达归属，存在漂移空间。
2. 数据库 enum 曾包含 `SKU_CODE`、`EXTERNAL_MASTER_CODE`，而运行规则和前端闭集又不完全相同。
3. 识别码暴露独立状态，增加了没有明确用户任务的生命周期复杂度。
4. `catalog_preparation_profile` 只有商品级单例，无法表达具体 SKU 和选项值。
5. V4 生产提示把自由 `stationTags`、`printTags` 和 `allergenNotes` 混在同一个 profile 中；这正是当前 V2S 不应继续继承的概念混装。
6. V4 更新商品识别码时会保留 SKU BARCODE 行、再插入本次提交行；SKU 矩阵与商品整体保存因此存在两条写路径和半更新风险。V2S 应统一成同一个 identifier owner 契约，而不是复制这段兼容式 replace。

### 2.3 V2S 原始需求：本来要求什么

2026-08-06 合并需求已经写明：

1. `ProductIdentifier` 必须是实体，因为扫码定位需要按值反查和唯一约束。
2. 商品与 SKU 各自已有稳定编码字段，编码还是跨 owner 复制的判同依据。
3. 制作时长、说明可以折入商品/SKU/选项值各自的 typed JSON，不必为 `PreparationProfile` 再建独立表。
4. 商品处理标签仍必须是 typed ref，不能降成 JSON 字符串。
5. 商品、SKU、选项值各自的制作信息不能全部塞进商品的一份 JSON。

原 IA 又进一步选择了“三层完全独立、无隐式继承”。这条当时没有来源定义三层解析语义；当前实际页面也证明它既难理解又未真正落到具体 SKU/选项值。因此本专题应把这条作为待重判输入，而不是继续视为不可改变的正确实现。

## 3. 当前 V2S 的可证实 gap

### 3.1 条码与标识

| 层 | 当前事实 | Gap |
| --- | --- | --- |
| contract | `identifiers[]` 只有自由字符串 `kind/code/value`，`kind` 无 enum | `BARCODE4` 等任意类型可通过契约；“编码”无业务定义 |
| SKU contract | SKU 只有一个 `skuBarcode` 字符串 | SKU 不能拥有多个条码、PLU 或助记码，item 与 SKU 使用两套模型 |
| persistence | 商品识别码在 `catalog_item.sections JSONB`，SKU 另有 `catalog_sku.sku_barcode`；没有 ProductIdentifier 表 | 同一概念存在 JSON 数组与单字符串两套模型；没有目录级唯一约束、按值反查索引、稳定 identifierRef 和 owner 归属约束 |
| owner | 保存时把 draft 字段原样写回 sections，未见识别类型、目标、唯一性与 shape 准入校验 | 前端隐藏或非空校验成为事实上的唯一防线 |
| UI | 类型、编码、识别码三个字段都是 `Input` | 用户无法理解，且无法从候选中得到受控类型和示例 |
| UI 粒度 | 普通商品用独立页；SKU 商品在矩阵只有一个 barcode 字段 | 不能用同一识别模型、同一 typed problem 和同一反查规则 |
| tests | 当前 backend acceptance 未命中 `identifiers`/识别值唯一性；focused test 只构造空值或单个 SKU barcode | 类型篡改、重复值、SKU 多识别码和归属冲突均无证据 |

### 3.2 制作与出品

| 层 | 当前事实 | Gap |
| --- | --- | --- |
| contract | `productionProfiles={item:{},sku:{},optionValue:{}}`，三个对象均 `additionalProperties:true` | 与“typed JSON”原需求相反，任何字段和任意值都可进入 |
| contract 补洞 | `CatalogInventoryCoordinator` 因生成契约缺少 typed `materialRole`，会从 `productionProfiles.item.materialRole` 提升到顶层 | 制作信息被迫承载无关的商品物料角色；这是兼容 fallback，不是合法制作语义 |
| 目标身份 | `sku` 和 `optionValue` 只是各一份通用 map，没有 skuRef/optionValueRef | 所有 SKU 共享一份所谓 SKU profile；所有选项值共享一份所谓 option profile |
| owner | owner 只按三个 map 原样保存/读回 | 无法校验目标属于当前商品，也无法解析一次订单选择的具体 SKU/选项值 |
| production tag | `productionTagRefs` 只有商品级 item reference | 不能表达 SKU 覆盖或选项值制作影响 |
| 重复语义 | 页面先选 typed production tags，又在 profile 中允许自由 `stationTags` | 同一处理语义有 ref 与字符串两份真相 |
| 打印边界 | `printTags` 是自由字符串 | 没有消费者、闭集或与打印规则域的边界，容易被误解为打印配置 |
| 属性边界 | `allergens` 放在生产 profile | 过敏原无法进入商品信息展示/筛选的正确路径，且会被误当作生产备注 |
| UI | “节点”下拉只有商品/SKU/选项值类别，不列具体对象 | 文案声称可分别配置，实际无法指出在配置哪个 SKU/选项值 |
| seed | 生产标签 seed 为“招牌推荐、午餐常用、晚餐常用、适合外卖”，同一生成源又已有“推荐商品、当季推荐”商品标签 | 营销/餐段/渠道标签被错误路由成履约处理标签；正确 owner 已存在，属于可证实的语义污染 |
| tests | acceptance 只覆盖 productionTagRefs 的复制/引用；制作 profile 结构、目标与解析无业务断言 | 当前 generic map 即使写反或覆盖错误也不会被发现 |

### 3.3 这两个 gap 的共同根因

共同根因不是“页面赶工”，而是原始需求里的“契约化清单”没有落到生成源：

1. 本应闭集的识别类型被生成为普通 string。
2. 本应 typed 的制作 JSON 被生成为 `additionalProperties:true`。
3. 本应绑定具体节点的事实只保存了节点类别。
4. owner 没有足够结构执行 shape、归属、唯一性、引用和有效值复核。
5. UI 只能把这个不完整契约直接翻译成自由输入框。
6. 契约缺口又促使 coordinator 从 opaque 制作 profile 提升 `materialRole`，进一步把临时兼容路径固化成跨概念写入。

因此修复必须从唯一生成源和 owner 开始，不能只在 React 中换控件或加校验。

## 4. 推荐的商品识别业务模型

以下均为 `RECOMMENDED_PENDING_DEXTER`。

### 4.1 对象模型

```text
ProductIdentifier
  identifierRef
  ownerType = CATALOG_ITEM | SKU
  ownerRef
  identifierType
  identifierValue
  normalizedValue
```

说明：

1. `ownerType + ownerRef` 是唯一归属表达，不再额外保存可与它冲突的 `scope`。
2. 用户只编辑“类型 + 识别值”；`identifierRef` 与 `normalizedValue` 由 owner 生成。
3. 商品编码、SKU 编码不是 ProductIdentifier 的重复行。
4. 外部 ERP/主数据身份继续由 `ExternalCatalogIdentity` 承接；外部平台对象由外部映射承接。
5. ProductIdentifier 是 catalog owner 的关系子实体，但仍随商品 whole-save 原子提交，不额外制造一套用户保存流程。

### 4.2 推荐类型闭集

首期推荐只保留：

| 类型 | 用户含义 | Shape/节点建议 |
| --- | --- | --- |
| `BARCODE` | 扫码枪、价签或包装上的条码值 | 普通、称重、物料、套餐的商品；SKU shape 的具体 SKU |
| `PLU` | 称重/计价设备使用的 PLU | 仅称重销售商品；未来若新增称重 SKU shape 再扩展 |
| `MNEMONIC` | 收银或后台快速检索助记码 | 可识别商品或具体 SKU |

不推荐首期继续保留：

- `INTERNAL_CODE`：与 `CatalogItem.code` 重复；
- `SKU_CODE`：与 `ProductSku.skuCode` 重复；
- `EXTERNAL_MASTER_CODE`：与 `ExternalCatalogIdentity` 重复；
- `BARCODE4`、`EAN13`、`CODE128` 等任意格式名：symbology 是扫描输入/设备事实，不应成为商品识别类型的自由扩张点。

如果 Dexter 确认存在“一个商品除 canonical code 外还必须维护多个内部别名”的真实任务，应新增语义明确的 `ALIAS_CODE`，而不是恢复含义模糊的 `INTERNAL_CODE`。

### 4.3 Shape × owner 准入

| Shape | 识别码 owner | 页面位置 |
| --- | --- | --- |
| 普通销售商品 | 商品 | 条码与识别 |
| 称重销售商品 | 商品 | 条码与识别；PLU 仅此 shape 可选 |
| 按 SKU 管理商品 | 每个具体 SKU | SKU 矩阵的“识别码”单元格进入行内/侧滑编辑；不显示商品级识别页 |
| 原材料/半成品/包装物 | 商品 | 条码与识别 |
| 商品型套餐 | 商品 | 条码与识别；识别后解析套餐销售壳，不把组件码当套餐码 |
| 服务/费用商品 | 商品，可选 | 仅 BARCODE/MNEMONIC；是否保留条码入口待 Dexter 确认 |
| 权益商品壳 | 本期无可编辑实例 | 不形成新入口 |

按 SKU 管理商品禁止商品级识别码，是因为一个父商品对应多个销售变体，扫描父级值没有已裁定的 SKU 选择结果。若未来确有“扫描父码后再选规格”的业务任务，应作为销售入口解析规则专题处理，不能由 catalog 静默选默认 SKU。

### 4.4 唯一性、规范化和生命周期

推荐要求：

1. 唯一约束至少为 `dataNodeRef + brandRef + identifierType + normalizedValue`。
2. BARCODE 必须按字符串保存，保留前导零；不得转 number。
3. 每种类型的 trim、大小写、允许字符与长度由 contract 声明并由 owner 统一实现，前端只复用生成规则做即时反馈。
4. 不校验 EAN/UPC checksum，除非有明确设备/业务需求；不要把格式猜测变成商品主数据门槛。
5. 同一 owner 可以有多个同类型识别码，但同一 normalized value 不能指向两个 owner。
6. 当前推荐不向用户暴露每条识别码的启用/停用状态；商品编辑维护的是当前有效识别集合，移除后不再用于新识别，历史订单/工作单按已冻结快照解释。
7. 若需要“临时停用后恢复”而不删除的业务任务，必须由 Dexter 明确后再加入独立生命周期；不能因为 V4 有 status 就默认照搬。

## 5. 推荐的制作与出品业务模型

以下均为 `RECOMMENDED_PENDING_DEXTER`。

### 5.1 不建立新的 PreparationProfile 表

保留 V2S 原需求的精简判断：制作信息随其父对象整读整写，使用契约定义的 typed JSON；跨 owner 的生产标签仍是 typed ref，并形成可反查引用边。

目标结构不是当前顶层三份 generic map，而是把事实放回真实父对象：

```text
CatalogItem.preparationProfile
ProductSku.preparationOverride
CatalogItemOrderOptionValueOverride.preparationEffect
```

这样既不新增没有独立生命周期的实体，也不会丢失具体 SKU/选项值身份。

### 5.2 商品制作默认值

```text
ItemPreparationProfile
  productionTagRefs[]
  productionDisplayName?
  estimatedPreparationSeconds?
  preparationNotes?
```

它回答“这件商品通常怎样制作和在制作单上怎样显示”。

约束：

1. `productionTagRefs[]` 只能引用当前 owner scope 中可供新绑定的 production tag；已停用标签仍可在历史/既有绑定中读回并标风险。
2. `productionDisplayName` 只是内容参数，不选择 printScene、模板、份数、打印机或终端。
3. `estimatedPreparationSeconds` 为非负整数；空表示未维护，不用 0 冒充未知。
4. `preparationNotes` 是面向制作人员的短说明，需有明确长度上限。

### 5.3 SKU 制作覆盖

```text
SkuPreparationOverride
  mode = INHERIT_ITEM | OVERRIDE
  profile?  // mode=OVERRIDE 时为完整 ItemPreparationProfile 形状
```

推荐原因：

1. 大部分 SKU 与商品制作方式相同，不应要求逐个复制一遍。
2. 某个 SKU 确有差异时，完整覆盖比逐字段隐式合并更容易解释、保存和回读。
3. 清除覆盖后立即恢复商品默认，来源可见、无残留字段。
4. owner 可返回 `effectiveProfile + source=ITEM_DEFAULT|SKU_OVERRIDE`，页面不需要自己猜继承。

### 5.4 点单选项制作影响

选项值不应复用完整 Profile。一次订单可同时选择“少冰 + 加珍珠 + 打包”，多个完整 Profile 没有可靠覆盖顺序。

推荐形状：

```text
OptionValuePreparationEffect
  addProductionTagRefs[]
  instruction?
  preparationSecondsDelta?
```

推荐解析顺序：

```text
商品默认
  -> 如选择 SKU 且有覆盖，使用 SKU 完整覆盖
  -> 按 optionValueRef 稳定排序，叠加每个选项值的 effect
  -> 去重标签、按稳定顺序追加制作说明、求和时长影响
  -> 输出 effective profile + source trace
```

这里仍有两项必须由 Dexter 裁定：

1. 选项值的时长影响是否允许负数，还是只允许非负增量；
2. 选项值是否允许移除基础 production tag。首期 KISS 推荐只允许增加，不允许移除，避免多选项互相冲突。

### 5.5 生产标签治理

生产标签的用户任务是维护稳定处理语义，例如：

- 热厨制作；
- 冷菜制作；
- 饮品制作；
- 烘焙；
- 打包处理。

“招牌推荐、午餐常用、晚餐常用、适合外卖”分别是商品营销标签、餐段/菜单或渠道适配语义，不是生产处理标签。

推荐规则：

1. 商品编辑页只选择和查看 production tag，不内联创建共享标签。
2. 有权限的用户可从商品页跳转独立“制作处理标签”维护面，返回后刷新候选。
3. 标签 owner 继续负责 code、name、kind、scope、status、version 和引用保护。
4. catalog owner 保存前调用 production owner 的 typed 判断，不自己解释标签状态与 scope。
5. 不再维护自由 `stationTags`，也不从名称猜岗位/设备/队列。

### 5.6 移出本页的字段

1. `allergens`：放回商品/SKU 属性或商品标签；制作页只可显示“过敏原信息请到属性维护”的跳转提示，不复制字段。
2. `printTags`：当前删除。若未来要表达杯贴、厨打、价签场景，必须由打印规则域定义 printScene/模板规则；商品只提供内容参数。
3. 营销标签、餐段标签、渠道标签：使用商品标签、销售集合或经营渠道的现有 owner，不得转成 production tag。

## 6. Contract、owner 与持久化目标

### 6.1 单一声明源

本专题必须在 `scripts/generate/catalog-inventory-p1.mjs` 的既有 catalog 生成链中声明并生成：

1. identifier type 闭集、字段形状、shape × owner × type 准入矩阵；
2. `ProductIdentifier` save/readback、SKU 识别码形状和 typed problem；
3. `ItemPreparationProfile`、`SkuPreparationOverride`、`OptionValuePreparationEffect`；
4. production tag 字段来源、目标粒度与有效值解析规则；
5. 字段显隐、页面位置、用户文案和 owner 复核要求。

不得手改 generated OpenAPI、generated TS/Java 类型或 generated fixture，也不得保留旧 generic map 作为 fallback。

### 6.2 Catalog owner

Catalog owner 必须：

1. 在保存事务内从当前 shape 和当前商品结构重新派生识别码允许 owner；
2. 校验所有 SKU/选项值目标真实属于当前商品且未作废；
3. 校验 identifier type、normalized value、目录唯一性和重复提交；
4. 将 ProductIdentifier 写入 owner-local 关系表，并提供按 type/value 的反查任务读；
5. 校验制作 JSON 的闭合结构、长度、数值范围和 target shape；
6. 经 production owner 判断新 production tag ref 是否有效；
7. 生成有效制作信息和来源轨迹，供未来履约 owner 冻结，不让前端承担合并器；
8. 整体保存继续使用 catalog version/CAS，不为两个页签制造第二个并行版本真相。
9. `materialRole` 只从 catalog draft 的顶层 typed 字段读取；不得再从制作 profile 推导、提升或回填。

### 6.3 持久化

推荐新增 `catalog.product_identifier` 关系表，至少具有：

```text
identifier_ref
data_node_ref
brand_ref
item_ref
product_sku_ref nullable
identifier_type
identifier_value
normalized_value
display_order
```

约束：

1. `product_sku_ref` 为空表示商品 owner，非空时必须通过复合 FK 归属于同一 item。
2. 归属由 FK 事实表达，不再保存第二个 `scope` 字段。
3. 对目录范围、类型和 normalized value 建唯一约束与反查索引。
4. display order 只服务稳定编辑/读回，不参与识别语义。

制作信息继续存父对象 typed JSON 或现有父对象关系结构；production tag ref 的派生引用边必须覆盖商品、SKU 和选项值来源，保证标签停用/复制/引用 readback 可解释。

### 6.4 Typed problems 草案

| code 草案 | 触发条件 | 用户结果 |
| --- | --- | --- |
| `CATALOG_IDENTIFIER_TYPE_NOT_ALLOWED` | type 不在闭集或不适用于 shape/owner | 定位到具体识别码行 |
| `CATALOG_IDENTIFIER_DUPLICATE` | 同目录同 type/normalizedValue 已指向其他 owner | 显示冲突对象名称/编码，不暴露技术异常 |
| `CATALOG_IDENTIFIER_OWNER_INVALID` | SKU 不属于当前商品、商品级/SKU级粒度矛盾 | 回到 SKU 行或识别页 |
| `CATALOG_PREPARATION_TARGET_INVALID` | SKU/选项值不存在、已作废或不属于当前商品 | 定位具体目标 |
| `CATALOG_PREPARATION_SHAPE_NOT_ALLOWED` | 当前 shape 不允许该层制作信息 | 拒绝篡改请求，版本不变 |
| `CATALOG_PRODUCTION_TAG_UNAVAILABLE` | 新绑定标签停用、越 scope 或不存在 | 保留草稿并提示重新选择 |
| `CATALOG_PREPARATION_EFFECT_CONFLICT` | 未来若开放 add/remove 且效果冲突 | 拒绝并指出冲突选项；首期不开放移除则不需要 |

最终 code 与文案应在详设中与既有 problem namespace 对账，本稿不授权直接采用名称。

## 7. 推荐 UI 信息架构

### 7.1 非 SKU 商品：条码与识别

```text
┌ 条码与识别 ────────────────────────────────────────────────────────────┐
│ 说明：商品编码 APP-001 已在“基础”维护；这里维护扫码/PLU/助记识别。     │
│ [新增识别]                                                             │
│ 类型       识别值                 用途提示                   操作       │
│ 条码       6901234567890          扫码识别                   删除       │
│ 助记码     KJTC                   收银快速检索               删除       │
│ PLU        0231                   仅称重商品显示             删除       │
└────────────────────────────────────────────────────────────────────────┘
```

要求：

1. 类型用 contract Select，不允许自由输入。
2. 不显示“绑定范围=商品”这种由 shape 已经确定的技术事实。
3. 行内显示类型专属示例和冲突错误。
4. 商品编码只读说明，不在识别码里复制一行。

### 7.2 SKU 商品：SKU 矩阵

SKU 矩阵保留“识别码”列，但单元格显示摘要：

```text
中杯热饮 | LAT-M-H | 2 个识别码 [维护]
```

点击“维护”打开当前 SKU 的轻量 Drawer/Popover，使用与商品识别完全相同的行编辑器和 contract。不能继续只留一个 `skuBarcode` 输入框。

### 7.3 制作与出品

普通/称重商品：

```text
┌ 制作与出品 ────────────────────────────────────────────────────────────┐
│ 商品默认                                                              │
│ 制作处理标签 [饮品制作 ×] [打开标签维护]                              │
│ 制作单显示名称 [拿铁]  预计制作时间 [180] 秒                          │
│ 制作说明 [先萃取，再加热牛奶……]                                      │
│                                                                        │
│ 点单选项制作影响（摘要）                                               │
│ 少冰：说明“减少冰量”；+0 秒                              [去点单选项] │
│ 加珍珠：增加“饮品加料”；+20 秒                           [去点单选项] │
└────────────────────────────────────────────────────────────────────────┘
```

按 SKU 管理商品：

```text
┌ 制作与出品 ────────────────────────────────────────────────────────────┐
│ 商品默认                                                              │
│ 制作处理标签 [饮品制作 ×]  制作单显示名称 [咖啡]  180 秒              │
│                                                                        │
│ SKU 覆盖                                                              │
│ SKU              当前来源      有效摘要                    操作        │
│ 中杯              沿用商品      饮品制作 / 180 秒           [单独设置] │
│ 大杯              单独设置      饮品制作 / 220 秒           [编辑][清除]│
└────────────────────────────────────────────────────────────────────────┘
```

页面不再出现抽象的“生产提示节点=SKU/选项值”选择器。用户始终看到具体名称、编码和来源。

### 7.4 点单选项制作影响的位置

推荐在“点单选项”页的具体选项值中编辑 effect，因为用户是在定义“少冰/加珍珠有什么影响”；“制作与出品”页只做跨对象摘要和跳转。这样避免同一选项值在两个页签分别维护两份事实。

## 8. 典型业务例子

| 场景 | 识别模型 | 制作模型 |
| --- | --- | --- |
| 瓶装可乐 | 商品有一个或多个 BARCODE | 无制作信息，制作页可为空 |
| 称重沙拉 | 商品有 PLU 和可选 BARCODE | 商品默认为冷菜制作、90 秒 |
| T 恤颜色/尺码 SKU | 每个 SKU 有自己的 BARCODE | 默认无制作信息；SKU 可选覆盖包装说明 |
| 拿铁（无 SKU，有选项） | 商品 BARCODE/MNEMONIC | 商品默认饮品制作；“加珍珠”作为选项 effect 增加标签/说明/时长 |
| 原料鸡胸肉 | 商品 BARCODE，可无制作信息 | 不能因为是库存物料就自动生成生产提示 |
| 双人套餐 | 套餐壳 BARCODE | 套餐主壳不维护制作 profile；实际组件按其商品/SKU制作信息解析 |
| 服务费 | 通常只用商品 code，识别码可空 | 不显示制作与出品页 |

## 9. 验收场景草案

正式需求定稿后，至少应覆盖：

### 9.1 识别码

1. 普通商品可保存两个 BARCODE 和一个 MNEMONIC，按 type/value 反查到同一 item。
2. 称重商品可保存 PLU；普通计件商品提交 PLU 被 owner 拒绝且 version 不变。
3. SKU 商品父壳提交 item identifier 被拒绝；每个具体 SKU 可保存多个 identifier。
4. 同目录同 type/normalizedValue 指向两个对象时第二次保存返回 typed duplicate，原对象与新对象版本均保持可证伪状态。
5. 前导零条码保存、读回、反查均不丢零。
6. `BARCODE4`、空白 type、篡改 ownerRef 被 contract/owner 拒绝。
7. 商品 code、skuCode、外部平台 ID 不会被自动复制成 ProductIdentifier 行。
8. 移除 identifier 后不再被新反查命中，历史业务快照不被重解释。

### 9.2 制作与出品

1. 商品默认 profile 保存后返回完全相同 typed readback，未知字段被拒绝。
2. SKU 未覆盖时有效值来自 item；建立覆盖后来自 SKU；清除覆盖后恢复 item，来源轨迹逐次正确。
3. 两个具体 SKU 的覆盖互不污染；不存在“一份 SKU profile 覆盖全部 SKU”。
4. 两个具体选项值的 effect 分别绑定自身 ref；选择一个不会应用另一个。
5. 多选项 effect 的标签、说明和时长按 contract 确定顺序合并，重复标签去重。
6. 越商品提交 skuRef/optionValueRef 被 owner 拒绝，catalog version 不变。
7. 停用 production tag 不再进入新候选；既有绑定与历史有效快照仍可读并显示停用。
8. 自由 `stationTags`、`printTags`、`allergens` 和旧 generic `productionProfiles` 请求被拒绝，不通过 fallback 保存。
9. 套餐、服务、物料等不准入 shape 的篡改请求被 owner 拒绝。
10. seed 中 production tag 只出现真实制作处理语义；“招牌推荐、午餐常用、适合外卖”分别留在正确 owner，不再作为 production tag。
11. 商品页面不出现工作台、队列、KDS、打印机、topic 或模板配置。
12. 未来履约读取的是 owner 解析出的 effective profile 快照，不由前端或履约模块自行重复合并。
13. `productionProfiles.item.materialRole` 不再被提升为商品物料角色；合法 `materialRole` 只由顶层 typed 字段保存和读回。

## 10. 数据迁移与 seed 要求草案

本稿不授权迁移或 seed，但正式计划必须处理现存非法数据，不能靠 runtime fallback：

1. 扫描当前 `sections.identifiers` 全集，按 `kind/code/value` 形成迁移报告；无法确定含义的 `code` 不得静默丢弃或猜成 identifier value。
2. 合法闭集类型迁入 `product_identifier`；`BARCODE4` 等非法 type 进入明确的治理/阻断清单，由 Dexter 决定映射或删除。
3. SKU 的单个 `skuBarcode` 迁为该 SKU 的 BARCODE 行；空串不造行。
4. 当前 generic `productionProfiles.sku` 和 `.optionValue` 没有具体 target，无法自动安全迁移；必须先盘点非空数据。若存在，停止自动迁移并让 Dexter 选择归属或清理。
5. `productionProfiles.item` 中可确认的 display name、duration、notes 可迁入 item profile；自由 stationTags/printTags/allergens 按各自 owner 做显式处置，不得原样塞进新 profile。
6. 若 `productionProfiles.item.materialRole` 与顶层 `materialRole` 同时存在，迁移报告必须显式列出一致/冲突两类；一致值只保留顶层，冲突值停止自动迁移交 Dexter 裁决，运行时不得继续提升 fallback。
7. production tag seed 改为热厨、冷菜、饮品、烘焙、打包等；营销、餐段、渠道标签迁回正确字典或从本专题 seed 删除。
8. seed 至少覆盖普通商品多条码、称重 PLU、SKU 每行多识别码、item 默认、SKU 继承/覆盖/清除、两个 option effect、停用标签历史可见和非法类型拒绝。

## 11. 明确非目标

本专题不做：

1. 扫码枪、电子秤、标签秤的设备注册、协议解析或在线状态。
2. 称重条码中重量/价格编码规则、销售下单输入和价差确认；这些属于销售入口/设备协作专题。
3. 外部平台商品/SKU/选项映射。
4. 打印场景、模板、份数、打印机、KDS、队列、工作台和履约路由配置。
5. 新建过敏原专用字典；只把字段移回商品属性/标签正确边界。
6. 改变商品 shape、SKU 销售属性、点单选项选择规则、库存/BOM 或单位模型。
7. 为未来可能出现的任意识别码类型建立可配置类型库。

## 12. 待 Dexter 分轮裁定

### 第一轮：决定核心模型

| ID | 问题 | 选项 | Codex 推荐 |
| --- | --- | --- | --- |
| D-01 | 首期识别类型闭集 | A：BARCODE/PLU/MNEMONIC；B：再保留 INTERNAL_CODE/SKU_CODE/EXTERNAL_MASTER_CODE | **A**。后三者已分别有 item/sku code 和 ExternalCatalogIdentity owner |
| D-02 | identifier 独立状态 | A：不暴露状态，维护当前有效集合；B：每条可停用/启用 | **A**。当前没有临时停用的真实用户任务，避免照搬 V4 生命周期 |
| D-03 | SKU 制作差异 | A：商品默认 + SKU 继承/完整覆盖；B：每个 SKU 完全独立；C：逐字段隐式覆盖 | **A**。用户负担最低，来源明确，清除可恢复 |
| D-04 | 选项值制作模型 | A：增量 effect；B：完整 profile；C：本期不支持 | **A**。多选项可以确定合并，完整 profile 无可靠优先级 |

### 第二轮：决定字段与合并细节

| ID | 问题 | 选项 | Codex 推荐 |
| --- | --- | --- | --- |
| D-05 | `stationTags` | A：删除，只保留 productionTagRefs；B：两者都留 | **A**。两份真相不可维护 |
| D-06 | `printTags` | A：删除；B：保留自由字符串；C：另开打印规则专题 | **A**；若有真实打印任务则走 C，不选 B |
| D-07 | 过敏原 | A：移回商品/SKU属性或标签；B：继续放制作信息 | **A** |
| D-08 | 选项时长影响 | A：仅非负增量；B：允许正负 delta；C：不支持时长 effect | **A**，先覆盖加料/额外处理且避免时长变负 |
| D-09 | 选项 production tag | A：只允许增加；B：允许 add/remove 并定义冲突；C：不支持标签 effect | **A**，首期最简单且确定 |
| D-10 | production tag 快速创建 | A：商品页移除，仅跳独立维护面；B：保留 quick create | **A**。共享履约语义不应按商品临时造词 |
| D-11 | “打印名称”用户术语 | A：制作单显示名称；B：出品显示名称；C：沿用打印名称 | **A**，描述内容用途但不暗示打印规则已配置 |

### 第三轮：决定边界例外

| ID | 问题 | Codex 推荐 |
| --- | --- |
| D-12 | 服务/费用商品是否保留识别码入口 | 默认保留可选 BARCODE/MNEMONIC；若无真实场景则隐藏但 owner 仍按 contract 拒绝 PLU |
| D-13 | 套餐主壳是否可维护制作信息 | 不可；只维护套餐识别码，实际组件各自解析制作信息 |
| D-14 | 是否存在“扫描父商品码后再选 SKU”的场景 | 当前不支持；若存在，另开销售入口解析规则，不在 catalog 默认 SKU 上止血 |
| D-15 | 是否存在 identifier 临时停用/恢复的真实任务 | 没有则 D-02 维持无独立状态；有则补 actor、场景和历史行为后再设计 |
| D-16 | identifier 唯一范围是否按 `dataNode + brand + type + normalizedValue` | 推荐是；既避免同一目录内一值多物，又不把不同品牌/数据节点强行绑成全平台唯一。若扫码入口跨品牌检索，则必须先裁定冲突选择任务再扩大范围 |

## 13. 证据索引

### 13.1 V4 只读实现

- `catering-server-v4/backend/edge-bff-service/src/main/resources/db/migration/V009__catalog_items_rebuild.sql@751fad5cde3fd4070337d9aacbcb2ce1eec7fb13c39747bc36d7ed253338a561`
- `catering-server-v4/backend/commerce-catalog-service/src/main/java/com/next/catering/v4/catalog/adapter/persistence/CatalogIdentifierPersistenceWriter.java@27e5fa5d4f227c7b4bd683aa5a7868a02656f140fef6bd5201c987fe7e889ab9`
- `catering-server-v4/frontend/apps/catering-operations-admin/src/resources/catalog-items/components/CatalogEditableTables.tsx@219df5ed014a12bc059f56d8d09c8e81d7debd5d92026e4557e2ffb0ab447ebd`

### 13.2 V6 只读领域设计

- `requirement-doc/design-v6/01.领域设计/05-商品目录域.md@8c29d94ab78d8403e079cea3ea6dcbdbcb7635b637d3400535bfe365e5353e5d`
- `requirement-doc/design-v6/01.领域设计/13-履约与生产域.md@0e7323a62d05654729bff4c2d0a918547f4f76accc5a64b8226329cfb26198e7`
- `requirement-doc/design-v6/01.领域设计/21-打印规则域.md@d095b02b00e9597b0a53d720c3e6c3ac7ac430df4ccbd0a48a69389a3840dcc3`

### 13.3 V2S 原始需求与当前 owning source

- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md@ce32dcf053b2a427576f38ad83719683a7e0488a28b530befea0cd3b31efeeea`
- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md@860224dc6b167bf66b2025715be6eb8f1d24312d3fca728801b6183e4f44d959`
- `contracts/openapi/components/catalog/catalog-item.schemas.json@89a840455c85e79df802aa312a191868a267a174a222faee682a086f9bd2527d`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java@cc46ac14a3c58519ef283648d08e4d5b92c2f0ff3bbb1fc01ce5aa848bfb3c3e`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java@50bb9c0f71e7c99b75d266d6f5299142d8912d398fc47de703fd992ea8906461`（当前树第 1120—1125 行为 `materialRole` opaque-profile 提升 fallback）
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260814_100000_000__catalog_p3_model.sql@e13afb70f253b8b3cbf62567841d4c2f63487e07458153580cd338cff7d802e6`（当前树第 10 行为单值 `sku_barcode`）
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx@8d1497160ff61a7fbe9c18a14cb0a4cdc184514f1bbc200248605c715b74c27e`
- `scripts/generate/catalog-inventory-p1.mjs@43bc1d828639e9516098eec03e1ff42cfb9da2c4376f6ee8cc218ed6fef92cdf`

浏览器截图只用来确认当前用户可见症状，不作为领域真相或字段定义来源。
