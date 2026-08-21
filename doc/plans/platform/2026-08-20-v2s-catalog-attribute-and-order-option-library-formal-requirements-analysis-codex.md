# 商品属性库、点单选项库与两步新建：正式需求分析

> 日期：2026-08-20  
> 状态：`FORMAL_REQUIREMENTS_ANALYSIS`  
> 性质：需求分析与概要设计。**不**是 implementation-facing 详设、实施计划、Journey、接口/数据库设计、代码或运行授权。  
> 产品真相源：[已裁定需求讨论稿](2026-08-20-v2s-catalog-attribute-and-order-option-library-requirements-discussion-codex.md) §6（Dexter 决策 1–12）。  
> `SKILL_USED=cs-spec-to-plan`（仅用于恢复需求分析的业务任务、现有能力与边界纪律；Dexter 已明确本文件不进入详设或计划）。

## 1. 文档目的、范围与判定方法

### 1.1 要解决的真实问题

现有商品页让操作者在每个商品中重复发明描述属性、点单组和值；相同业务事实（如“过期时间”“蘸料”）会产生不一致的名称、取值、顺序和扣料规则。用户的真实任务是：先在当前总部或门店商品库中维护可复用的定义，再在商品上填写该商品独有的值、选用策略和实际消耗量；创建商品时先确定不可回退的最小身份与形态，再进入完整编辑。

本期只覆盖 **operations-admin 的交易前商品配置**。它不让顾客点单、不读取菜单、不执行订单扣减/恢复，也不改变 `platform-admin`。

### 1.2 权威与冲突标记

- 用户直接裁定及讨论稿 §6 是本文件的产品真相；旧 D-07/D-08 仅在本需求涉及的商品属性、点单选项范围内被替代。
- `CONFIRMED — SUPERSEDED`：旧需求/详设或现有实现与新裁定直接相反，必须不再作为本功能依据。
- `CONFIRMED — MISSING`：新需求所需能力在当前实现不存在。
- `CONFIRMED — NARROW_EXCEPTION`：旧的通用规则仍有效，但新裁定对一个精确对象作了有限例外。
- `RETAIN`：当前能力已经满足新需求的边界，应保留，不能因本需求被误删。
- `UNRESOLVED`：用户尚未指定的精度；本文件不以旧实现或推测补作产品裁定。

### 1.3 “所有冲突”的有限检索面

本轮已对下列有限面逐项搜索、重开并由前端、后端、需求材料三路独立核验：

1. 原始需求、合并需求、IA、三阶段旧详设、商品元数据 Modal 决定；
2. `contracts/openapi/components/catalog/catalog-item.schemas.json`、`contracts/catalog/catalog-item-editor-manifest.json` 与 operations 生成 client；
3. `operations-admin` 的商品创建、商品 Drawer、字典、品牌复制、领域模型与对应测试；`platform-admin` 的商品入口反查；
4. catalog owner、order-option facts、category facts、inventory owner、brand-copy coordinator 与公开 API；
5. `catalog_item`、dictionary、order option、category、inventory BOM 的迁移；
6. 直接命中的 brand-copy closure、compatibility、引用重写与现有测试。

“未发现”只适用于以上有限面；不用于声称其他尚未实现的消费端、订单端或未来历史数据没有影响。

## 2. 术语与不可混同边界

| 术语 | 本需求中的含义 | 明确不能混同为 |
| --- | --- | --- |
| 商品属性定义 | 总部或门店私有、可被多个商品引用的描述属性定义 | `SKU_ATTRIBUTE`、商品标签、自由 JSON map |
| 商品属性赋值 | 一个商品对一个属性定义填写的文本或选择项值 | 以可变 `code` 作关系键 |
| SKU 销售属性 | 用于生成 SKU 矩阵的既有父子字典 | 商品描述属性库 |
| 点单选项组/值定义 | 私有库中定义的组选项、选择方式、消费者顺序与强制原材料组件 | 当前 `ORDER_OPTION_VALUE` 无父级字典值，或每商品内联组 |
| 商品点单选项配置 | 商品选择库组后维护的必选、默认、加价与实际消耗数量 | 对组名、值名、顺序、选项集合或原材料组件的本地副本 |
| 原材料商品 | 选项值强制组件所指向的 catalog 商品事实 | 可直接扣减的库存对象 |
| `StockTarget` / option-value BOM | inventory owner 的实际扣料对象、单位和数量真相 | 商品属性或点单选项定义 |

总部与门店都各自拥有私有商品库。品牌商品复制到门店后，门店事实独立；“同 scope 的定义变更影响商品”不等于总部之后的变更自动影响已复制的门店商品。

## 3. 正式功能需求

### 3.1 商品属性库与商品属性赋值

| ID | 要求 |
| --- | --- |
| FR-ATTR-01 | 总部和门店分别维护私有商品属性库；任一属性定义至少有稳定引用、名称、编码和值类型。 |
| FR-ATTR-02 | 值类型只有 `TEXT`、`SINGLE_SELECT`、`MULTI_SELECT`；`TEXT` 是普通展示文本，不引入数值、单位、正则或公式体系。选择型定义拥有自己的选项集合。 |
| FR-ATTR-03 | 商品可从本 scope 的属性库选择多个定义。文本型填写文本；单选型选择一个定义选项；多选型选择多个定义选项。商品关系必须保存稳定定义引用，不能以编码或名称识别。 |
| FR-ATTR-04 | **商品属性定义编码可以修改**，但在总部或门店各自的 scope 内唯一。这是仅针对商品属性定义的有限例外，不扩展到商品、分类、SKU 属性、SKU、点单组选项定义或其他既有编码。 |
| FR-ATTR-05 | 删除商品属性定义时，级联删除本 scope 所有商品属性赋值及其值；不得删除商品本身。商品属性不再以商品内 JSON 保存。 |
| FR-ATTR-06 | 从总部品牌商品复制到门店时，复制该商品关联的属性定义、选择项和商品属性赋值，并把引用重写为门店定义引用；不得保留跨 scope 引用。 |

### 3.2 点单选项库与商品级策略

| ID | 要求 |
| --- | --- |
| FR-OPT-01 | 总部和门店分别维护私有点单选项库。库定义组、组内值、消费者展示顺序、选择方式和强制原材料组件。建立或编辑库值的强制原材料组件时，只能关联同 scope、inventory owner 可解析的既有 `StockTarget`；该前置使商品侧只填写实际消耗数量，不再判断库存对象是否已就绪。 |
| FR-OPT-01a | **点单选项组编码和组内可选项编码在创建后均不可修改**；创建时各自必须在其适用范围内唯一。该规则不同于 FR-ATTR-04 的商品属性定义编码可修改，不得互相类推。 |
| FR-OPT-02 | 选择方式只有 `SINGLE` 与 `MULTIPLE`；不再提供或接受 `FIXED` 点单方式。多选必须具备最小/最大可选数。 |
| FR-OPT-03 | 一个商品可从本 scope 的点单选项库选择多个组。商品只能维护组是否必选；对 `MULTIPLE` 组维护最小/最大可选数；以及对每个库值维护是否默认、加价多少和其强制组件的实际消耗数量。最小/最大可选数属于商品配置，不属于库定义。 |
| FR-OPT-04 | 商品不得隐藏库值、重排组或值、修改组名/值名、替换选择方式，亦不得添加、移除或替换某库值的强制原材料组件。消费者顺序只由库控制。 |
| FR-OPT-05 | 一个库值可拥有 1..n 个强制原材料组件。商品使用该组选项时，必须对每个组件维护实际消耗数量；它不能替换或删除组件，也不能添加额外组件。 |
| FR-OPT-06 | 删除点单选项组/值时，级联删除其全部商品组选项配置、值覆盖和对应 option-value BOM；不得删除商品、库存 target 或原材料商品。 |
| FR-OPT-07 | 总部商品复制到门店时，复制相关组选项定义、值、强制组件、商品配置与 BOM 关联，并改写为门店 scope 的引用。 |

### 3.3 扣料事实与 owner 边界

1. 库定义中的“原材料商品”表达强制组件意图，并且建立/编辑该组件时必须已绑定同 scope、inventory owner 可解析的 `StockTarget`；实际扣料仍落到该 inventory owner 的 `StockTarget`、库存真相单位和 option-value BOM。商品侧不另行承担库存对象就绪度判断。
2. 一个 option value 只能作为 BOM owner，不能成为独立库存对象。
3. 新的强制模板约束不允许 catalog 直接拥有或写入 inventory 事实；它只要求保存时以既有公开 owner command 在同一业务动作内校验/维护实际 BOM。
4. 未配置库存 target 不得被掩盖成“已可扣料”；本期也不得由配置完成推导订单扣减已实现。

### 3.4 品牌复制、同编码冲突与级联范围

1. 复制必须将新定义族加入现有 copy closure、引用重写和结果 readback；门店取得自己的定义引用、商品配置和实际 BOM 引用。
2. 若目标门店已有同编码但**类型、选择项或强制原材料组件不同**的商品属性/点单选项定义，预检必须阻止复制、列出冲突定义，要求先整理；不得自动复用、覆盖或把阻断变成可确认项。
3. 属性或点单选项的级联删除仅删除本需求界定的当前配置引用事实。它不授权删除未来订单、计划、库存流水、审计历史或其他未在本期实现的事实。

### 3.5 商品两步新建与分类

1. 第一步使用 **Modal**，仅填写商品编码、商品名称、分类、商品形态；不得是 Drawer，也不得出现 JSON 属性输入。
2. 分类使用树形选择器，可不选，但只能选一个分类；该单选规则适用于商品分类关联，而非仅改变第一步文案。
3. 商品形态必须展示其销售/原材料/套餐/服务用途、SKU 管理、计量方式、库存/BOM 可配置性及“创建后不可修改”。未开放形态应可见、禁用并说明原因。
4. 提交第一步时，编码、名称、可空单分类和形态必须原子创建 `DRAFT`。成功后关闭 Modal 并打开同一商品的完整编辑 Drawer；不得把分类推迟到第二步。
5. 第二步沿用商品详情 Drawer，关闭但未继续编辑时保留 DRAFT。

### 3.6 消费面与范围

- 商品库、属性库、点单选项库、商品编辑和品牌复制仅在 `operations-admin`；不向 `platform-admin` 增加入口或合并两个 app。
- 商品工作台取消整个顶层 Tab 容器、商品主面直出；商品属性库与点单选项库必须位于既有“商品元数据”Modal，和商品标签、销售单位、SKU 销售属性、商品处理标签并列。它们仍是不同业务资料，不能并入 SKU 销售属性。
- 继续使用项目生成 client 与共享 `admin-ui-foundation` 的 Drawer、dirty-close、overlay lock、列表上下文与日志能力；不在 app 内重造同类基础设施。
- 本期不新增对客展示、菜单发布、订单提交、库存扣减/恢复、采购、仓库、批次、调拨或供应链功能。

## 4. 概要设计（概念边界，非详设）

```text
总部/门店私有 catalog scope
  商品属性定义 ──< 商品属性赋值 >── CatalogItem
  点单选项组定义 ──< 商品组选项配置 >── CatalogItem
         └─ 点单选项值定义（唯一消费者顺序、强制组件）
                    └─ 商品值覆盖（default / extraPrice / N）
                                      └─ option-value BOM ──> inventory StockTarget
```

本需求将“定义事实”与“商品个别事实”拆开：定义包括属性类型、选择项、点单组和值、顺序和强制组件；商品只保存属性值或被允许的策略覆盖。`CatalogItem` 与库存事实仍由各自 owner 管理，跨 owner 写保持公开 command 的同一 `REQUIRED` 事务。该图只界定业务事实归属，不规定表、API、类、迁移或操作顺序。

### 4.1 定义库承载方案比较与选择

“新建定义族”不是因为既有 `catalog.dictionary_entry` 在技术上无法扩展，而是经过以下两案比较后的需求层选择；本节不把选择下沉成表、API 或迁移方案。

| 方案 | 可复用之处 | 主要代价与不匹配 | 本需求结论 |
| --- | --- | --- | --- |
| 扩展通用 dictionary | 已有按 scope 隔离的编码、父子引用及部分复制模式；现有 SKU 属性父子约束证明这一路径技术上可行。 | 必须扩展五值封闭 kind、SKU 专属父子 check/trigger/查询、对象类型映射、复制策略与 `VOIDED` 生命周期。属性值类型、组选项规则、消费者顺序和强制组件会把通用 dictionary 扩展为多态商品领域容器；商品赋值、商品覆盖和实际 BOM 关系仍须另建。 | 可行，但会把本需求专属语义反向耦合进通用字典生命周期。 |
| 新建 catalog 专属定义族 | 属性定义/选项、点单组/值、强制组件及其级联语义可保持清晰的领域边界；SKU 销售属性与既有 `ORDER_OPTION_VALUE` 的语义无需重解释。 | 仍需建立 scope、稳定引用、复制闭包和引用重写；这些成本不能被既有 dictionary 掩盖。 | **选择本案**：它没有为未来预设通用框架，只把当前已裁定的专属事实与商品覆盖明确分开。 |

因此，后文的“现状冲突”只说明当前实现的事实与改造成本，不将“当前不是该模型”误写成“技术上不可扩展”。

## 5. 与现有需求、IA 和旧详设的冲突

| ID | 状态 | 现有材料与证据 | 冲突与本需求处理 |
| --- | --- | --- | --- |
| DOC-01 | `CONFIRMED — SUPERSEDED` | 合并需求 D-07 将描述属性定为自由 map：`2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md:1263-1268`；旧分析 F09 同义：`2026-08-05-v2s-catalog-store-light-inventory-requirements-analysis-codex.md:80-84,135`。 | 改为定义库与商品赋值，旧 map 不再是商品属性事实。 |
| DOC-02 | `CONFIRMED — SUPERSEDED` | 合并需求 D-08 明定每商品内联、无共享选项库：同文件 `:1270-1274`。 | 改为私有库定义与商品策略分离。 |
| DOC-03 | `CONFIRMED — SUPERSEDED` | IA 要求属性页是自由键值和不存在属性字典：`2026-08-06-v2s-catalog-inventory-information-architecture-codex.md:466-470,512-523`。 | 属性页改为选择定义后按类型赋值。 |
| DOC-04 | `CONFIRMED — SUPERSEDED` | IA/旧详设允许商品内新增、改名、排序组选项：IA `:512-523`；三阶段设计将它写为 typed JSON：`2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md:359-365,454-462`。 | 三栏任务形态可保留，商品内定义编辑必须替换为从库添加和受限覆盖。 |
| DOC-05 | `CONFIRMED — SUPERSEDED` | 旧详设以 `VOIDED`+引用阻断为字典删除规则：三阶段设计 `:423-425,731-735`。 | 对两类新定义实施 Dexter 裁定的有限级联；不扩展到商品、target、材料或未来历史事实。 |
| DOC-06 | `CONFIRMED — NARROW_EXCEPTION` | 旧材料将商品、分类、字典、SKU 等 code 统一视作创建后不可改：合并需求 `:1321-1333`。 | 仅商品属性定义 code 可改；点单选项组与组内可选项 code 维持创建后不可改。 |
| DOC-07 | `CONFIRMED — SUPERSEDED` | 旧品牌复制矩阵不含新定义族，且允许非结构差异确认复用：合并需求 `:705-836`。 | 新定义、赋值、模板与 BOM 引用必须进入闭包；同编码语义不同为 hard block。 |
| DOC-08 | `CONFIRMED — MISSING` | 旧 IA 是同一创建/编辑 Drawer，未要求首步 Modal、原子分类或 DRAFT→Drawer：IA `:213-216,478-489`。 | 新建改为两个不同 surface；只保留成功后打开同一详情 Drawer 的体验。 |

## 6. 前端现状冲突矩阵

| ID | 状态 | 当前前端证据 | 冲突标记 |
| --- | --- | --- | --- |
| FE-ATTR-01 | `CONFIRMED — SUPERSEDED` | `CatalogItemCreateDrawer.tsx:74-86,159-204` 解析 JSON；`CatalogItemDrawer.tsx:2443-2470,5120-5181` 编辑 key/value；`catalogModel.ts:943-979` 使用 `Record<string, JsonValue>`。 | 无 definitionRef、类型化值或级联定位能力。 |
| FE-ATTR-02 | `CONFIRMED — DUPLICATED_ENTRY` | `CatalogDictionaryDrawer.tsx#dictionaryTabs` 现有商品标签、销售单位、SKU 销售属性、商品处理标签，并在同一 Modal 加入商品属性库、点单选项库；`CatalogWorkbenchPage` 同时仍有顶层 `catalogArea` Tab 容器。SKU 属性在 `CatalogItemDrawer.tsx` 服务规格矩阵。 | 直接裁定要求保留商品元数据 Modal 的六个并列 Tab、删除工作台整个顶层 Tab 容器；商品属性库与 SKU 销售属性保持分离。 |
| FE-ATTR-03 | `CONFIRMED — SUPERSEDED` | 生成 client `catalog-inventory-edge.ts:110,126-127` 与 manifest `catalog-item-editor-manifest.json:923-933` 固定开放 `attributes`。 | 不能只改组件；wire/model/manifest 必须同步替换。 |
| FE-OPT-01 | `CONFIRMED — SUPERSEDED` | `CatalogItemDrawer.tsx:3626-3805,3810-3874` 可在商品内创建、改名、删组和值；`:642-653,746-750` 原样提交。 | 与“从库选择、商品仅维护覆盖”逐项相反。 |
| FE-OPT-02 | `CONFIRMED — SUPERSEDED` | `CatalogItemDrawer.tsx:3742-3765` 仍暴露 `FIXED`；`catalogModel.ts:223-229` 无 min/max。 | 旧 enum 与字段模型均不满足仅单/多选及多选边界。 |
| FE-OPT-03 | `CONFIRMED — SUPERSEDED` | 本地值使用 `attributeValueRef`，新值临时生成：`CatalogItemDrawer.tsx:3774-3786`；BOM 候选取本地 `orderOptions`：manifest `:1939-1952`。 | 没有组/值定义身份、库顺序或模板身份，且命名误导为属性。 |
| FE-BOM-01 | `CONFIRMED — SUPERSEDED` | `CatalogItemDrawer.tsx:4090-4244` 允许随意增 BOM、换 option value/target；`:689-700` 只校验基础字段。 | 不会强制每个库组件，也未禁止替换、删除、额外组件。 |
| FE-CREATE-01 | `CONFIRMED — SUPERSEDED` | `CatalogItemCreateDrawer.tsx:1,110-196` 是 Drawer，含 JSON 属性、没有分类。 | 首步 surface、字段集和原子提交均冲突。 |
| FE-CREATE-02 | `CONFIRMED — MISSING` | `CatalogItemCreateDrawer.tsx:131-157` 只有形态标签；现有提示把 code 一并说为不可改。 | 缺各形态解释；商品 code 是否可改未裁定，不能沿用该文案断言。 |
| FE-CAT-01 | `CONFIRMED — SUPERSEDED` | manifest `:213-230`、schema `:306-313`、`CatalogItemDrawer.tsx:2662-2774` 都是 `categoryRefs[]` 多选。 | 需可空单选树，不能只改标签。 |
| FE-COPY-01 | `CONFIRMED — MISSING` | `BrandCatalogCopyDrawer.tsx:380-490,565-603` 只处理一般 confirmation/reused。 | 缺少“同编码语义冲突即阻断且定位定义”的 readback/呈现。 |
| FE-DEL-01 | `CONFIRMED — MISSING` | 商品行移除只改本商品 draft：`CatalogItemDrawer.tsx:3794-3804,3862-3874`；字典生命周期见 `CatalogDictionaryDrawer.tsx:787-815`。 | 没有新库删除、级联影响确认与结果 readback。 |
| FE-TEST-01 | `CONFIRMED — SUPERSEDED` | `CatalogManagementPage.test.tsx:97-115` 断言 JSON 属性；`catalogFieldRuntime.test.ts:73-105` 断言本地点单候选。 | 测试正保护旧模型，不能作为新需求证据。 |

### 6.1 前端可复用且必须保留

- `operations-admin` 已有且应继续作为唯一商品入口：`operations-admin/src/app/routing/pageRegistry.tsx:159-173`；反查 `platform-admin/src/app/routing/pageRegistry.tsx:1-33` 无商品维护路由，符合本需求。
- 创建成功后 `detail.open(createdCode)`：`CatalogWorkbenchPage.tsx:1436-1450`，符合首步成功后进入同一详情 Drawer。
- 现有 Drawer 已接 foundation 生命周期：`CatalogItemCreateDrawer.tsx:1-8`、`CatalogItemDrawer.tsx:479-487`；树形分类候选也已有可复用解析：`CatalogItemDrawer.tsx:2683-2739`。这些不是继续使用旧多选 wire 的理由。

## 7. 后端、契约、数据库与复制现状冲突矩阵

| ID | 状态 | 当前后端/契约/数据证据 | 冲突标记 |
| --- | --- | --- | --- |
| BE-ATTR-01 | `CONFIRMED — SUPERSEDED` | `catalog.catalog_item.attributes` 是 JSONB：`V20260806_120000_000__catalog_inventory_backend.sql:7-25`；create schema 为 required free map：`catalog-item.schemas.json:1724-1766`；owner 原样保存：`CatalogOwnerService.java:3016-3047`。 | 不能承载定义、类型选项、赋值或级联。 |
| BE-ATTR-02 | `CONFIRMED — RETAIN_SEPARATE` | SKU 值以 SKU/attribute 父关系保存：`V20260814_100000_000__catalog_p3_model.sql:30-37`；父子约束见 `V20260816_010000_000__catalog_dictionary_attribute_parent_and_order_option_kind.sql:196-229`。 | 规格属性可保留但绝不可作为商品属性库。 |
| BE-ATTR-03 | `CONFIRMED — MISSING` | dictionary kind 是五值封闭集合：`V20260817_010000_000__catalog_dictionary_kind_closed_set.sql:1-3`；parent 查询只容 SKU 值：`CatalogOwnerService.java:2727-2737`。 | 当前闭集及 SKU 专属父子规则不足以直接承载本需求；若扩展须承担 §4.1 的通用 dictionary 生命周期扩张成本，故本需求选择新建专属定义族。 |
| BE-ATTR-04 | `CONFIRMED — NARROW_EXCEPTION` | dictionary update 按 code 定位且只改 name：`CatalogOwnerService.java:3913-3938`。 | 商品属性定义需可改 code、scope 唯一及稳定引用关系。 |
| BE-ATTR-05 | `CONFIRMED — SUPERSEDED` | `CatalogOwnerService#transitionDictionary` 在 `VOIDED` 时调用 `#dictionaryReferenced`，命中即抛 `REFERENCE_BLOCKS_VOID`；`#requireInventoryDictionaryReferenceUnreferenced` 对 inventory 依赖也抛同码。 | 属性定义删除需级联 assignment/value，不是 VOIDED 阻断。 |
| BE-OPT-01 | `CONFIRMED — SUPERSEDED` | group 以 `item_ref` 为父，value 以 group 为父：`V20260814_101000_000__catalog_order_option_relations.sql:4-32`；读模型从 item 重建：`CatalogOrderOptionFacts.java:28-94`。 | 没有库定义与商品配置分层。 |
| BE-OPT-02 | `CONFIRMED — SUPERSEDED` | `replace()` 接收/保存组名、值名、模式、顺序并删除未提交行：`CatalogOrderOptionFacts.java:97-152,303-356`。 | 商品当前能改定义，与新限制相反。 |
| BE-OPT-03 | `CONFIRMED — MISSING` | schema 裸 `selectionMode`+`required`：`catalog-item.schemas.json:485-565,2048-2128`；DB 无闭集 CHECK：`V20260814_101000_000__catalog_order_option_relations.sql:4-15`。 | 缺仅 SINGLE/MULTIPLE 与 MULTIPLE min/max。 |
| BE-OPT-04 | `CONFIRMED — RETAIN_SEPARATE` | `ORDER_OPTION_VALUE` 只验证无父、同 scope dictionary：`V20260816_010000_000__catalog_dictionary_attribute_parent_and_order_option_kind.sql:377-404`。 | 它当前是商品内联组选项使用的叶子语义，不能直接改名或重解释为新库值；若选择扩展 dictionary，仍须重构组层、模式、顺序、组件和生命周期，故本需求选择新定义族。 |
| BE-OPT-05 | `CONFIRMED — MISSING` | 现有值同时存 code/name/default/ref/price/effects/order：`CatalogOrderOptionFacts.java:71-90,225-301`。 | 缺 groupDefinitionRef/valueDefinitionRef 与商品覆盖边界。 |
| BE-INV-01 | `CONFIRMED — PARTIAL_REUSE` | `stock_bom` identity 已含 item/SKU/option value：`V20260808_160000_000__inventory_opaque_catalog_identity_refs.sql:162-168`；保存需 target/quantity/unit：`InventoryOwnerService.java:1809-1865`。 | 可保留多 BOM 底座；缺强制模板、完整性校验和组件不可替换规则。 |
| BE-INV-02 | `CONFIRMED — MISSING` | 商品内删组选项只删 catalog 行：`CatalogOrderOptionFacts.java:143-151,296-301`；被 BOM 引用的 dictionary 又会阻止 void：`CatalogOwnerService.java:3982-4055`。 | 新库删除需受控跨 owner 级联配置与 option-value BOM。 |
| BE-COPY-01 | `CONFIRMED — MISSING` | closure 只收现有 typed/dictionary refs：`CatalogOwnerService.java:6151-6224,7481-7495`。 | 新定义、赋值、模板未进入闭包，无法深复制和重写。 |
| BE-COPY-02 | `CONFIRMED — SUPERSEDED` | 当前按 `(kind,code)` 找 target 并复用：`CatalogOwnerService.java:7033-7068,7117-7130`；compatibility 未比较新语义：`:7164-7209`。 | 同 code 但类型/选项/组件不同必须阻断。 |
| BE-COPY-03 | `CONFIRMED — SUPERSEDED` | copy 时重建每商品内联组选项：`CatalogOrderOptionFacts.java:154-203`。 | 应复制一次库定义，再让多个商品配置引用它。 |
| BE-CREATE-01 | `CONFIRMED — SUPERSEDED` | create 只含 `dataNodeRef/name/code/shapeKey/attributes`：schema `:1724-1766`；`CreateOperationsCatalogItemOperation.java:37-46`；create 不写分类：`CatalogOwnerService.java:2893-2930`。 | 缺首步可空单分类的原子 DRAFT 创建。 |
| BE-CAT-01 | `CONFIRMED — SUPERSEDED` | category 树已存在：`V20260808_140000_000__catalog_category_opaque_refs_and_order.sql:1-15`；商品关系为多对多：`V20260814_100000_000__catalog_p3_model.sql:39-45`；save 接受数组且不限制：`CatalogOwnerService.java:3381-3392,4814-4833`。 | 树可复用，商品关联 cardinality 必须改为可空单选。 |
| BE-CREATE-02 | `RETAIN` | create 初始 `DRAFT` 与 shape createAllowed 已存在：`CatalogOwnerService.java:2893-2930`。 | 可作为新流程底座，但不消除创建字段/分类冲突。 |

## 8. 必须保留的架构、运行与产品边界

1. 一个业务 deployable、一个 PostgreSQL、多 owner schema、单 Flyway history。
2. catalog 拥有商品与新定义/配置事实；inventory 拥有库存 target 与 BOM。跨 owner 写只能调公开 command，并在同一 `REQUIRED` 事务，不由 read edge 或前端补偿反推。
3. `x-consumer-faces` 和生成 client 仍是 operations API 消费真相；两个后台保持独立。
4. 选项值不能成为库存对象；库存单位和 target 是库存真相。无库存/BOM不推导可售、订单执行或库存扣减。
5. 商品形态创建后不可改；本文件不放宽它。商品 code、点单组选项组/值 code 以及属性类型/选择项后续变更语义未因属性 definition code 可改而自动放宽；其中点单组选项组/值 code 已由 FR-OPT-01a 明确为创建后不可改。

## 9. 不在本文件中擅自裁定的精度

| ID | 状态 | 原因与禁止推导 |
| --- | --- | --- |
| U-03 | `UNRESOLVED` | 商品属性 definition 的值类型、选择项名称/集合在已被商品使用后的更新规则未指定；不能以旧 VOIDED 阻断或强级联规则代替。 |
| U-05 | `PARTIALLY_DECIDED` | 后续定义库列表、候选与详情子集合的形态已由 `doc/platform/foundation-charter.md` §1-J 与 `project-memory/practices/collection-boundary-modes.md` 决定：必须按事实先判为 Detail、Bounded、Page 或 Cursor，不能把形态本身留作产品裁定。尚未知的是预期规模，以及管理员实际浏览、搜索和筛选需求；裁定前不得预设分页、游标或人为上限。 |
| U-06 | `UNRESOLVED` | 级联删除遇到未来订单、计划、流水、审计等尚未在本期实现/授权的历史事实时的长期保留策略未裁定；本期不得假装已解决。 |

## 10. 业务验收语义（非测试计划）

下列是正式需求完成时必须能由业务用户观察的结果，不包含命令、测试框架或实现步骤：

1. 总部或门店可维护“过期时间”属性定义；面包填写“三个月”、可乐填写“六个月”。单/多选属性只能使用该定义的选择项。
2. 修改商品属性定义编码后，既有商品仍显示同一属性和值；删除该定义后，相关商品保留，但不再拥有该属性赋值。
3. “蘸料”库组可被多个商品选择；对同一库组，薯条可设置必选、蛋黄酱默认、黑松露酱加价。商品不能改“蘸料”名称、值集合或消费者顺序。
4. 多选组按其最小/最大选择数约束；`FIXED` 不再作为点单选项方式出现或被接受。
5. 黑松露酱定义有多个强制原材料组件时，商品必须填写每个组件的实际数量，不能换料、删料或增加额外组件；实际库存对象与单位仍可被清楚核对。
6. 删除点单选项定义后，商品仍存在，但其组配置、值覆盖和关联 option-value BOM 不再存在；库存 target 与原材料商品保留。
7. 品牌复制到门店后，新定义和商品配置为门店私有；若本地同编码定义的类型、选项或组件不同，复制被阻止且冲突可定位。
8. 新建商品先出现 Modal；用户只填编码、名称、可空树形单分类和形态。成功创建 DRAFT 后进入 Drawer；关闭 Drawer 后草稿仍在。
9. 上述结果只证明运营端配置完成，不证明顾客端展示、菜单发布、订单执行或实际扣减已经完成。

## 11. 主要依据

- [已裁定需求讨论稿](2026-08-20-v2s-catalog-attribute-and-order-option-library-requirements-discussion-codex.md)
- `doc/plans/platform/2026-08-05-v2s-catalog-store-light-inventory-requirements-analysis-codex.md`
- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md`
- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md`
- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md`
- `doc/decisions/2026-08-17-v2s-catalog-metadata-central-modal.md`
- `doc/platform/foundation-charter.md` §1-J、§2-C
- `project-memory/decisions/deterministic-context-only.md`、`project-memory/decisions/confirmed-business-language-corpus.md`
- `project-memory/practices/frontend-capability-lookup.md`、`project-memory/practices/backend-capability-lookup.md`、`project-memory/practices/collection-boundary-modes.md`、`project-memory/practices/ordering-only-for-consumer-facing.md`

## 12. Claude review intake（2026-08-20）

本节记录对 Claude 静态 review 的逐项独立处置；它不构成新的产品裁定，也不进入 IA、详设或实施。

| Review 项 | 处置 | 依据与结果 |
| --- | --- | --- |
| S-1：没有比较扩展 dictionary 与新建定义族 | `CONFIRMED` | §4.1 已补两案比较。现有同 scope 父子约束说明扩展技术可行；选择新定义族的理由是避免把属性类型、选择规则、消费者顺序、强制组件和级联语义膨胀为通用 dictionary 的多态生命周期。 |
| S-2：强制组件的 StockTarget 前置缺失 | `DEXTER_DECISION` | §3.2 FR-OPT-01 与 §3.3 已写入：定义组件时必须绑定同 scope、inventory owner 可解析的既有 `StockTarget`；商品侧仅填数量。该前置是 Dexter 裁定的新需求，不冒充现有能力。 |
| S-2 附带断言：门店无 target 时当前复制必阻断 | `REJECTED_WITH_EVIDENCE` | `InventoryOwnerService` 当前复制预检对 target 缺失计划 `CREATE`，执行时创建 target 后重写 BOM；只有非法或无法映射的源引用才 fail closed。该断言未被引入正式需求。 |
| S-3：U-04 历史数据迁移未决 | `CONFIRMED` | 已删除 U-04；`foundation-charter.md` §2-C 已规定当前无业务数据、清库/reset+seed 的环境不保留兼容层、fallback 或迁移期双写。 |
| S-3：U-05 集合形态 | `PARTIALLY_CONFIRMED` | 形态判定已有 charter §1-J 与 collection-boundary 正本；业务规模和检索需求仍未知，已按二者拆开记录。 |
| N-1：`REFERENCE_BLOCKS_VOID` 行号漂移 | `CONFIRMED` | BE-ATTR-05 改用 `CatalogOwnerService#transitionDictionary` 与 `#requireInventoryDictionaryReferenceUnreferenced` 稳定锚点。 |
| N-2：多选 min/max 归属层 | `DEXTER_DECISION — CLOSED` | Dexter 已裁定归商品配置；FR-OPT-03 已补齐，U-01 已删除。 |
| 点单组选项组/值编码可修改性 | `DEXTER_DECISION — CLOSED` | Dexter 已裁定创建后不可修改；FR-OPT-01a 已固定该规则，U-02 已删除。商品属性定义编码可修改的窄例外仍只适用于 FR-ATTR-04。 |
| 商品属性库/点单选项库入口 | `DEXTER_DECISION` | 商品工作台取消整个顶层 Tab 容器、商品主面直出；两个库只位于既有商品元数据 Modal，和四类既有商品元数据并列。§3.6 与 FE-ATTR-02 已同步。 |
| 分类 cardinality 追认 | `DEXTER_DECISION` | §3.5 已与 Dexter 明确裁定一致：商品可未分类，或只关联树上的一个分类节点。 |
