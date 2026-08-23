# 商品条码与标识、制作信息优化正式需求

> `PARTIALLY_SUPERSEDED_BY`：`doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md#4.2.2`。
> 自 2026-08-24 起，生产标签的用户术语、商品级 0..1 基数、SKU 不覆盖标签、点单选项不增减标签及“本期不实现生产路由”
> 以新正本为准；本文件的识别码规则与制作单显示名称/时长/说明规则继续有效。

<a id="catalog-identification-production-guidance-formal-requirements"></a>

状态：`ACCEPTED_BY_DEXTER`

日期：2026-08-23

独立合理性评审：`doc/review/platform/2026-08-23-v2s-catalog-identification-production-guidance-requirements-review-claude.md`，结论 `GO`，`M/S/N = 0 / 2 / 3`。两条 S、三条 N 与该评审第 5 节记录的 Dexter 裁定均已折入本文。

讨论稿：`doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-requirements-discussion-codex.md`。讨论稿保留分析过程，不再作为后续设计的业务真相源。

实施授权：`false`

运行授权：`false`

`SKILL_USED=cs-brainstorming@4a54a4858b99807f3155ed1614b2f116e35ea5c1b788e793f565dd837fd3891f`

## 0. 用户任务与成功判据

商品资料维护者需要在一个商品的编辑上下文中回答两件不同的事：

1. 哪些实际输入值可以唯一识别这个商品或它的某个 SKU；
2. 这个商品、SKU 或点单选项在制作时应显示什么、需要哪些处理语义、会增加多少制作时间。

正式需求成功时：

1. 用户只维护“识别类型 + 识别值”，不再填写无业务含义的 `kind/code/value` 三元组；
2. 普通商品的识别码绑定商品，按 SKU 管理商品的识别码绑定具体 SKU，父商品不能被 catalog 静默解析成默认 SKU；
3. 商品制作信息、SKU 覆盖与选项值影响都绑定具体对象，不再存在全商品共享的一份“SKU profile”或“选项值 profile”；
4. SKU 使用“继承商品默认或完整覆盖”，选项值只表达可交换的增量 effect；
5. production tag、打印规则、过敏原、营销标签和 `materialRole` 各归其 owner，不在制作信息中保留自由字符串或 fallback；
6. contract、owner、持久化、前端、迁移、acceptance 与 seed 使用同一套 shape、归属、闭集和合并规则；
7. 不改变商品标签、SKU 销售属性、点单选项选择规则、库存/BOM、单位模型、菜单与可售语义。
8. 用户界面只出现业务用户能理解的对象、动作、结果和恢复提示；技术枚举、引用、作用域、版本、错误码和内部模型名称只在契约与实现层流转，不进入可见文案。

## 1. 已接受业务结论

### 1.1 来源可直接确定的结论

1. `ProductIdentifier` 首期类型闭集为 `BARCODE / PLU / MNEMONIC`。
2. `INTERNAL_CODE` 由 `CatalogItem.code` 拥有，`SKU_CODE` 由 `ProductSku.skuCode` 拥有，`EXTERNAL_MASTER_CODE` 由 `ExternalCatalogIdentity` 拥有；三者不得再次写入 identifier，避免同一事实两个住址。
3. SKU 制作差异采用“商品默认 + SKU 完整覆盖”，不用三层完全独立或逐字段隐式合并。
4. 选项值只表达增量 effect，不保存完整制作 profile。
5. 删除自由 `stationTags`，只保留 typed `productionTagRefs`。
6. 删除自由 `printTags`；打印场景、模板、规则、打印机和任务归打印规则/终端域。
7. 过敏原移回商品/SKU属性或商品标签，不作为制作 profile 字段。
8. 商品页移除 production tag 快速创建；共享标签由独立 owner 治理，商品页只选择和查看。
9. 套餐主壳不维护制作信息；实际组件各自解析商品/SKU制作信息。

### 1.2 Dexter 已裁定的十一项

1. **Identifier 不建立独立状态**：移除即不再用于新识别；历史订单、工作单和其他已冻结快照不重解释。过渡期以“删旧码 + 加新码”表达，两步均可逆。该结论不是基于“没有用户任务”的假设，而是复用已裁定的“候选变化不改历史快照”语义。
2. **选项制作时长只允许非负增量**：避免引入多减项叠加为负与下限保护新规则；制作时长用于排产和等待告知，高估安全、低估会造成错误承诺。
3. **选项只允许增加 production tag，不允许移除**：标签合并保持集合并集和可交换性。
4. **用户术语固定为“制作单显示名称”**：不得显示“打印名称”，避免暗示打印规则已经配置。
5. **服务/费用商品只允许 `MNEMONIC`**：UI 不提供 `BARCODE/PLU`，contract 与 owner 对该 shape 提交 `BARCODE/PLU` 必须直接拒绝。
6. **不支持扫父商品码后选择 SKU**：正常业务中每个规格使用自己的识别码；同码多规格属于未来销售入口解析专题，catalog 不得静默选择默认 SKU。
7. **Identifier 唯一域为 `dataNodeRef + brandRef + identifierType + normalizedValue`**。
8. **D-16 已知边界已接受**：同一 dataNode 下不同 brand 可以使用相同 normalized value。若未来同一门店经营多品牌，扫码解析入口必须携带 brand 上下文；否则重开唯一域裁定。catalog 不得猜品牌。
9. **识别码规范化规则固定**：BARCODE/PLU 去除首尾空白后按原值比较并保存，保留前导零与大小写；MNEMONIC 去除首尾空白后按大小写不敏感值比较，展示仍保留用户录入大小写；三类识别码均拒绝 Unicode 控制字符。
10. **制作文本与时长边界固定**：“制作单显示名称”最多 120 个字符，“制作说明”和“追加制作说明”分别最多 1000 个字符；预计制作时长及选项增加时长只能为空或非负整数，不设 86400 等业务上限。
11. **本批不新增识别码解析 HTTP 接口**：本批闭合 identifier 存储、唯一索引、whole-save/readback 与未来 owner 查询边界设计；真实销售/扫码 Journey 出现时，再由该 Journey 携带 brand 上下文新增 consumer face、HTTP edge 与性能预算。不得提前建设零消费者接口。

### 1.3 已接受代价

选项 effect 本期不能表达“移除基础制作岗位/改换制作岗位”。确有这种差异时，应建模为 SKU，由 SKU 完整覆盖 production tags；不得回头给 option effect 开放 tag remove 或优先级覆盖。

## 2. 当前 V2S 的结构性 gap

### 2.1 条码与标识

1. 商品 `identifiers[]` 是无 enum、无格式、无唯一约束的自由 `kind/code/value`。
2. SKU 只有一个 `skuBarcode` 字符串，商品与 SKU 使用两套模型。
3. 商品识别码存在 `catalog_item.sections JSONB`，SKU 条码存在 `catalog_sku.sku_barcode`，没有可反查的 owner-local identifier 事实。
4. 当前 owner 没有 identifier type、shape、owner、唯一性和反查复核；前端非空校验成了事实上的唯一防线。

### 2.2 制作信息

1. `productionProfiles.item/sku/optionValue` 均为 `additionalProperties:true`。
2. `sku` 分支没有 `productSkuRef`，`optionValue` 分支没有 `definitionValueRef`；目标身份根本不存在，不是仅仅字段过多。
3. 所有 SKU 实际共享一份 generic map，所有选项值也共享一份 generic map，无法表达具体对象差异。
4. typed `productionTagRefs` 与自由 `stationTags` 重复表达处理语义。
5. `printTags`、过敏原、营销标签被错误放进制作信息。
6. coordinator 会从 `productionProfiles.item.materialRole` 提升顶层 `materialRole`，使制作 profile 承载无关 catalog 字段；该兼容 fallback 必须退役。
7. seed 把“招牌推荐、午餐常用、晚餐常用、适合外卖”放进 production tag，而同一生成源已有商品营销标签，属于可证实的 owner 误路由。

## 3. ProductIdentifier 正式模型

### 3.1 事实与归属

```text
ProductIdentifier
  identifierRef
  ownerType = CATALOG_ITEM | SKU
  ownerRef
  identifierType = BARCODE | PLU | MNEMONIC
  identifierValue
  normalizedValue
```

1. 用户只编辑类型和识别值。
2. `identifierRef` 与 `normalizedValue` 由 catalog owner 生成。
3. 归属由 `ownerType + ownerRef` 的领域形状和数据库 FK 表达，不再保存第二个可漂移的 item/SKU `scope` 字段。
4. ProductIdentifier 是 catalog owner 的关系子事实，但继续随商品 whole-save 原子提交；不新增第二套用户保存流程。
5. 商品 code、skuCode 和外部主数据身份保持原 owner，不自动生成 identifier 行。

### 3.2 V6 `scope` 的落地关系

V6 `ProductIdentifier.scope` 在本期落地为唯一与反查所处的 catalog 范围：`dataNodeRef + brandRef`。它不是 V4 的 `PRODUCT_CATALOG / CATALOG_ITEM / SKU` 归属枚举；owner 归属已由 `ownerType/ownerRef` 或 FK 表达。本期不再持久化另一个名为 `scope` 的字段，避免“唯一域”和“归属粒度”被各层分别解释。

### 3.3 类型与 shape 准入

| Shape | Identifier owner | 允许类型 | 必须拒绝 |
| --- | --- | --- | --- |
| 普通销售商品 `STANDARD_SALE_COUNTED` | 商品 | `BARCODE / MNEMONIC` | `PLU`、SKU owner |
| 称重销售商品 `STANDARD_SALE_WEIGHED` | 商品 | `BARCODE / PLU / MNEMONIC` | SKU owner |
| 按 SKU 管理商品 `SKU_VARIANT_SALE_COUNTED` | 每个具体 SKU | `BARCODE / MNEMONIC` | 父商品 identifier、`PLU` |
| 原材料/半成品/包装物 `MATERIAL` | 商品 | `BARCODE / MNEMONIC` | `PLU` |
| 商品型套餐 `COMPOSITE` | 商品 | `BARCODE / MNEMONIC` | `PLU` |
| 服务/费用商品 `SERVICE` | 商品 | `MNEMONIC` | `BARCODE / PLU` |
| 权益商品壳 `BENEFIT_SHELL` | 本期无可编辑 identifier | 无 | 任意新 identifier |

按 SKU 管理商品不允许父商品识别码。若未来出现“扫父码再选规格”，由销售入口显式提供选择任务并重开需求；catalog 不得挑默认 SKU。

### 3.4 唯一性、规范化和反查

1. 唯一键为 `dataNodeRef + brandRef + identifierType + normalizedValue`。
2. BARCODE 与 PLU 按字符串保存，保留前导零；不得转为 number。
3. 三种类型均先去除首尾空白、拒绝 Unicode 控制字符，trim 后长度为 1..160 个字符。BARCODE/PLU 的 normalizedValue 保持 trim 后原值且大小写敏感；MNEMONIC 的 normalizedValue 使用大小写不敏感比较值，但 identifierValue 保留用户录入大小写用于展示。contract 声明这些规则，owner 使用同一规则重新计算 normalizedValue。
4. 同一 owner 可有多个同类型识别值，但同一唯一域内一个 type/value 只能指向一个 owner。
5. 唯一索引和 owner 设计必须保留未来按 `dataNodeRef + brandRef + type + value` 唯一查询 item 或具体 SKU 的边界；本批不创建生产 owner 方法或 HTTP operation。真实销售/扫码 Journey 出现后再实现并验收该读取能力。
6. 不校验 EAN/UPC checksum，除非未来设备/销售入口需求另行裁定。
7. 多品牌同址场景由调用方提供 brand 上下文；catalog 在缺少 brand 时拒绝歧义解析，不猜测。

### 3.5 生命周期

1. identifier 不暴露或持久化独立启停状态。
2. whole-save 中移除 identifier 后，它不再用于新的识别与候选。
3. 历史订单、工作单与审计使用已冻结快照，不因 identifier 后续移除、改值或重建而重解释。
4. 需要换码时提交“删除旧值 + 新增新值”；任一保存失败则整体不改变。

## 4. 制作信息正式模型

### 4.1 命名对账

领域概念统一叫“预计制作时长”，对应 V6 `estimatedDuration`。为避免无单位字段，本期 contract 使用 `estimatedPreparationSeconds`；选项 effect 使用 `preparationSecondsDelta`。二者均以秒为单位。文档不得再把 `estimatedDuration` 作为另一个并行 contract 字段。

用户可见术语：

- `productionDisplayName` → “制作单显示名称”；
- `estimatedPreparationSeconds` → “预计制作时长（秒）”；
- `preparationNotes` → “制作说明”；
- `productionTagRefs` → “制作处理标签”。

### 4.2 商品制作默认值

```text
ItemPreparationProfile
  productionTagRefs[]
  productionDisplayName?
  estimatedPreparationSeconds?
  preparationNotes?
```

1. `productionTagRefs` 只能引用当前 owner scope 中可供新绑定的 production tag；既有停用引用继续读回并显示停用状态。
2. “制作单显示名称”只是商品提供的内容参数，不选择 printScene、模板、份数、打印机或终端。
3. 预计制作时长是非负整数；空表示未维护，0 是明确的零秒值，不设置业务上限。
4. 制作单显示名称最多 120 个字符；制作说明最多 1000 个字符。字符数规则由 contract 声明并由 owner 最终复核。

### 4.3 SKU 继承与完整覆盖

```text
SkuPreparationOverride
  mode = INHERIT_ITEM | OVERRIDE
  profile? // OVERRIDE 时为完整 ItemPreparationProfile
```

1. SKU 默认继承商品 profile。
2. `OVERRIDE` 必须提交完整 profile，不做逐字段隐式合并。
3. 清除覆盖后立即恢复 item 默认；readback 同时返回 effective profile 与 `source=ITEM_DEFAULT | SKU_OVERRIDE`。
4. 两个 SKU 的覆盖互不影响，不能再由一份 generic `productionProfiles.sku` 共同承载。

### 4.4 点单选项值增量 effect

```text
OptionValuePreparationEffect
  addProductionTagRefs[]
  instruction?
  preparationSecondsDelta? // 非负整数
```

1. 选项值不能保存完整 profile，也不能移除基础 production tag。
2. 多选项解析顺序固定为：商品默认 → 可选 SKU 完整覆盖 → 选中 option effects。
3. 标签按集合并集去重，时长 delta 求和；二者可交换。
4. `instruction` 按 `(选项组 displayOrder, 选项值 displayOrder, definitionValueRef)` 排序后追加。前两项是业务顺序，UUID 只作同序兜底；不得按 UUID 直接排序。
5. effect readback 必须绑定具体 `definitionValueRef`，并能说明其所属选项组和显示顺序。
6. “改变制作岗位”不由 option effect 表达；使用 SKU 完整覆盖，或未来重开需求。
7. `instruction` 最多 1000 个字符；`preparationSecondsDelta` 只允许为空或非负整数，不设置业务上限。

### 4.5 Shape 准入

| Shape | 商品默认 | SKU 覆盖 | 选项 effect | 禁止项 |
| --- | --- | --- | --- | --- |
| `STANDARD_SALE_COUNTED` | 允许 | 不适用 | 允许 | SKU profile |
| `STANDARD_SALE_WEIGHED` | 允许 | 不适用 | 允许 | SKU profile |
| `SKU_VARIANT_SALE_COUNTED` | 允许 | 每个 SKU 允许继承/完整覆盖 | 不适用 | 点单选项 effect |
| `MATERIAL` | 不适用 | 不适用 | 不适用 | 任意制作信息 |
| `COMPOSITE` | 不适用 | 不适用 | 不适用 | 套餐主壳制作信息 |
| `SERVICE` | 不适用 | 不适用 | 不适用 | 任意制作信息 |
| `BENEFIT_SHELL` | 不适用 | 不适用 | 不适用 | 任意制作信息 |

### 4.6 Production tag 与相邻 owner

1. production tag 表达真实制作处理语义，例如热厨、冷菜、饮品、烘焙、打包处理。
2. “招牌推荐、午餐常用、晚餐常用、适合外卖”不是 production tag，分别归商品标签、销售集合/餐段或经营渠道。
3. 商品编辑只选择/查看 production tag，不内联创建共享标签；有权限用户可前往独立标签维护面。
4. `stationTags`、`printTags`、`allergens` 和 `productionProfiles.*.materialRole` 不属于新 profile；旧请求必须被拒绝，不能用 `additionalProperties` 或 fallback 继续保存。
5. `materialRole` 只从 catalog draft 顶层 typed 字段读取。

## 5. Contract 与 owner 要求

### 5.1 单一声明源

既有 catalog 生成源必须一次性声明并生成：

1. identifier 类型、规范化规则、shape × owner × type 矩阵、唯一域和 typed problems；
2. item/SKU identifier save/readback contract；本批不生成 identifier resolve HTTP operation；
3. ItemPreparationProfile、SkuPreparationOverride、OptionValuePreparationEffect；
4. shape 准入、具体 target identity、三级 effect 排序、合并和 effective source；
5. 字段可用性、必填/可空、类型、格式、长度/范围、枚举与 problem 定位元数据；用户文案、布局、控件和交互顺序不进入 HTTP contract。

不得手改 generated OpenAPI、generated TS/Java 或 fixture；不得保留旧 `identifiers kind/code/value`、`skuBarcode` 或 generic `productionProfiles` 作为 fallback。

### 5.2 Catalog owner

Catalog owner 在商品保存事务内必须：

1. 从当前 shape、item/SKU/option structure 重新派生合法 owner，不信任请求提交的归属；
2. 校验 identifier type、normalized value、唯一域、重复提交、SKU 归属和 shape 准入；
3. 校验 profile/effect 闭合结构、字段长度、秒数范围、target 归属与 shape；
4. 经 production owner 校验新 production tag ref 的 scope、状态和可绑定性；
5. 以业务 displayOrder 解析 option instructions，并返回 effective profile + source trace；
6. 使用 catalog version/CAS 完成 whole-save；任一非法 identifier/profile/effect 使整个商品保存失败且版本不变；
7. 只从顶层 typed 字段读取 `materialRole`，删除 opaque profile 提升路径。

### 5.3 持久化

新增 owner-local `catalog.product_identifier` 关系事实，至少保存：identifierRef、dataNodeRef、brandRef、itemRef、可空 productSkuRef、identifierType、identifierValue、normalizedValue、displayOrder。

约束：

1. productSkuRef 非空时必须通过复合约束归属于同一 item；
2. 唯一键和反查索引覆盖 `dataNodeRef + brandRef + identifierType + normalizedValue`；
3. 不保存第二个归属 scope 或独立 status；
4. displayOrder 只服务稳定编辑/读回，不参与唯一性；
5. 制作信息继续随 item/SKU/option parent 保存 typed JSON 或等价父对象结构；production tag 派生引用边覆盖三种来源。

### 5.4 Contract、界面与 owner 的责任边界

| 责任层 | 必须定义的事实 | 明确不负责 |
| --- | --- | --- |
| generated contract | identifier/profile/effect 的字段结构；枚举闭集；shape/owner 可用性；required/nullable；字符串格式、长度、数组和数值范围；candidate/readback 结构；problem code、reason code、field path 与目标行定位；effective source 等机器语义 | 中文页面标题、字段名称、按钮、帮助文案、布局、Drawer/Modal/Tab、响应式、键盘路径、草稿交互和刷新时机 |
| operations-admin 界面 | 把 generated contract 的机器语义映射成已批准的业务语言；按 allowed/required/constraint 元数据呈现控件；处理草稿、级联清理、loading/empty/error、可达性、布局和精确缓存失效；对 problem/reason 闭集做穷尽业务文案映射 | 发明 identifier type、shape 准入、格式/长度/范围、唯一域、owner 归属、权限、版本或历史解释；不得把隐藏/disabled 当安全防线 |
| catalog/production owner | 在命令事务内按当前真实商品结构、范围、权限、状态、唯一域和版本重新派生并复核；校验 production tag 新绑定；返回 typed problem 与安全定位元数据 | 决定页面结构、控件、中文文案或把前端提交的 hidden identity 当权威 |

边界规则：

1. 前端可以依据 contract 元数据做即时校验，但相同规则必须由 owner 最终复核；客户端通过不等于业务成立。
2. contract 返回稳定 code/reason/field path，不返回要求界面原样展示的技术句子；前端以穷尽映射输出业务文案，未知结果使用已批准的“结果暂时无法确认”恢复语义，不能展示 raw exception、problem code 或 payload。
3. 界面是否显示某个控件由 contract 的业务可用性驱动，具体显示成 Tab、Modal、Select 或 Input 由交互/IA 决定；二者不能互相越权。
4. 中文文案只描述“当前商品类型不支持”“该识别码已被其他商品或规格使用”“设置已被其他操作更新”等业务事实，不出现 `shape`、`owner`、`scope`、`ref`、`profile`、`effect`、`source`、`CAS`、HTTP、schema 或内部枚举。
5. 所有 generated contract code 与前端业务文案映射必须 exact-set 对账：新增一个 code/reason 而没有业务文案时，前端静态验证必须失败；删除 code 后遗留文案同样失败。

## 6. Typed problem 语义

正式 contract 至少需要可定位以下失败族，最终 code 在详设中与既有 namespace 对账：

1. identifier type 不在闭集或不适用于当前 shape/owner；
2. 同唯一域的 type/normalizedValue 已指向其他 owner；
3. identifier owner 不属于当前商品或父商品/SKU粒度矛盾；
4. SKU/option target 不存在、已作废或不属于当前商品；
5. 当前 shape 不允许 profile/override/effect；
6. 新 production tag 不存在、停用或越 scope；
7. 旧自由字段、未知 profile 字段或 `materialRole` fallback 请求；
8. version/CAS 冲突与权限拒绝。

错误必须定位具体 identifier 行、SKU 或选项值；前端隐藏、disabled 或本地校验不能替代 owner 拒绝。

## 7. 数据迁移

1. 扫描当前 `sections.identifiers` 全集，按 kind/code/value 分类；未知 `code` 含义不得猜成 value。
2. 合法 BARCODE/PLU/MNEMONIC 迁入 product_identifier；`BARCODE4` 等非法类型进入阻断报告，由明确数据处置解决。
3. SKU 单值 `skuBarcode` 迁为对应 SKU 的 BARCODE 行；空值不造行；迁移后退役旧列/字段和读取路径。
4. `productionProfiles.sku` 与 `.optionValue` 没有具体 target，任何非空数据都不能自动归属；存在时停止迁移并出具 item/原值报告。
5. item profile 中可明确映射的显示名称、秒数和说明迁入 typed item profile。
6. stationTags、printTags、allergens 按正确 owner 处置，不原样塞入新 profile。
7. 若 `productionProfiles.item.materialRole` 与顶层 materialRole 同时存在：一致值只保留顶层；冲突值停止迁移交 Dexter 处理；运行时不得继续提升。
8. 迁移后旧字段、旧列、generic map 和 coordinator fallback 全部退役，不建立兼容双写。

## 8. Acceptance 场景

### 8.1 Identifier

1. 普通商品可保存多个 BARCODE/MNEMONIC，whole-save/readback 保持类型、原值和目标归属，唯一索引只允许一个 owner 占用同一规范化值。
2. 称重商品可保存 PLU；普通计件、SKU、物料、套餐、服务提交 PLU 均拒绝且版本不变。
3. SKU shape 父商品提交 identifier 被拒绝；每个具体 SKU 可保存多个 BARCODE/MNEMONIC。
4. 服务/费用商品保存 MNEMONIC 成功，提交 BARCODE/PLU 由 contract/owner 拒绝，不只依赖 UI 隐藏。
5. 同唯一域重复值第二次保存失败；不同 brand 同值可以各自保存且 readback 互不污染。
6. 前导零保存和读回均不丢失；BARCODE/PLU 大小写敏感，MNEMONIC 大小写碰撞被唯一性拒绝且展示保留原始大小写；三类控制字符均被拒绝。
7. BARCODE4、空 type、越商品 skuRef、code/skuCode/externalIdentity 双写均被拒绝。
8. 移除 identifier 后该值不再存在于当前 readback/唯一索引，历史快照不被重解释。
9. 删旧码+加新码在一次 whole-save 中原子成功或原子失败。

### 8.2 制作信息

1. item profile typed round-trip，未知字段与旧自由字段拒绝。
2. SKU 默认继承 item；建立完整覆盖后 source=SKU_OVERRIDE；清除后恢复 item 且无残留字段。
3. 两个 SKU 覆盖互不污染，不存在共享 SKU generic profile。
4. 两个具体 option effects 绑定各自 definitionValueRef；选择一个不会应用另一个。
5. 多选项标签并集去重、时长非负求和；负 delta 和 tag remove 请求拒绝。
6. instruction 按组 displayOrder、值 displayOrder、definitionValueRef 三级排序；构造 UUID 顺序与业务顺序相反的 fixture，readback 仍输出正确业务顺序。
7. 越商品 SKU/option ref 和不准入 shape 请求失败且 catalog version 不变。
8. 停用 production tag 不进入新候选，既有绑定和历史快照仍可见并标停用。
9. 套餐、物料、服务、权益壳提交制作信息被 owner 拒绝。
10. `productionProfiles.item.materialRole` 不再提升；顶层 materialRole 是唯一输入与 readback。
11. 商品页不出现工作台、队列、KDS、打印机、topic、模板或打印规则配置。
12. 制作单显示名称第 121 个字符、两类说明第 1001 个字符均被拒绝且版本不变；时长接受一个显著大于一日秒数的非负整数正例（如 100000），负数和小数仍拒绝。

## 9. Seed 要求

正式 seed 计划至少覆盖：

1. 普通商品多条码与助记码；称重商品 PLU；按 SKU 商品每行多个识别码；服务商品只有助记码；
2. 相同 dataNode 下两个 brand 使用相同 BARCODE，分别保存并按各自商品 readback，证明唯一域包含 brand；
3. 商品制作默认、SKU 继承/完整覆盖/清除；
4. 两个选项 effect 同时增加标签、说明与时长，UUID 顺序故意与业务 displayOrder 相反；
5. 已停用 production tag 的既有绑定可见但不能新选；
6. production tag 仅使用热厨、冷菜、饮品、烘焙、打包处理等真实语义；营销/餐段/渠道标签留在正确 owner；
7. 非法类型、服务 BARCODE、负时长、tag remove、越商品 target 和旧 fallback 的拒绝场景。
8. MNEMONIC 大小写碰撞、三类控制字符、121 字显示名称、1001 字两类说明，以及一个显著大于一日秒数的合法非负时长（如 100000）。

不得把本专题 seed 塞入其他域 plan，不得只造 happy path。

## 10. 非目标与禁止推导

1. 不建设扫码枪、电子秤、标签秤的设备注册、协议或在线状态。
2. 不定义称重条码中的重量/价格编码、销售下单输入或价差确认。
3. 不支持扫码父商品后选 SKU；不得由 catalog 选默认 SKU。
4. 不建设外部平台商品/SKU/选项映射。
5. 不建设打印场景、模板、份数、打印机、KDS、队列、工作台和履约路由。
6. 本批不建设销售/扫码调用的识别码解析 HTTP 接口；未来必须由真实销售 Journey 携带品牌上下文重新设计。
6. 不建设新的过敏原库，只把旧字段移回商品属性/标签边界。
7. 不改变商品 shape、SKU 销售属性、点单选项选择、库存/BOM、单位、菜单和可售模型。
8. 不建立可配置的任意识别类型库。
9. 不给 option effect 开放 production tag remove 或负时长；改变制作岗位使用 SKU 完整覆盖。
10. 不把同 dataNode 不同 brand 的同码冲突交给 catalog 猜测；销售入口缺 brand 上下文时必须拒绝或重开裁定。
11. 不保留旧 kind/code/value、skuBarcode、generic productionProfiles、自由标签或 materialRole fallback。

## 11. Review finding 辩证 intake

| Finding | 分类 | 当前核验与处置 |
| --- | --- | --- |
| S-01 instruction 以 UUID 排序 | `CONFIRMED` | 当前契约已有选项组和值 displayOrder；采用 `(group displayOrder,value displayOrder,definitionValueRef)`，不新增 instructionOrder。 |
| S-02 identifier status 收窄理由错误 | `CONFIRMED + DEXTER_DECISION` | 不采用“无真实任务”假设；按“新候选变化不重解释历史快照”语义重写，无独立 status。 |
| N-01 决策项未分层 | `CONFIRMED_CLOSED` | 本文把来源可定与 Dexter 裁定分节，全部结论已收口。 |
| N-02 estimatedDuration 命名漂移 | `CONFIRMED` | 领域概念对账 V6；contract 明确秒单位，使用 estimatedPreparationSeconds/preparationSecondsDelta。 |
| N-03 V6 scope 关系不明 | `CONFIRMED` | scope 落地为 dataNodeRef+brandRef 唯一/反查域；owner 归属另由 ownerType/ownerRef/FK 表达，不存第二个 scope。 |

更大替代均未采用：不为制作信息新建独立生命周期表；不为 instruction 新建排序字段；不为 identifier 保留状态或代码双写；不把运行时 fallback 当迁移。

## 12. 后续设计边界

本文授权来源只允许继续 Journey、交互工件、低保真线框，并在 Dexter 看图确认后编写 IA 与 implementation-facing design。本文不授权 contract、数据库、后端、前端、测试、DEV、reset、seed、browser L2、UAT、部署或数据操作。
