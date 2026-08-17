# D-3 关系族守卫盘点

> 盘点日期：2026-08-17  
> 盘点范围：catalog owner 当前生产源码；D-3 需求与 CP-INV-3 详设  
> 盘点结论：这是静态盘点，不是 D-3 设计或实施授权。本文不修改关系模型、不补运行期守卫。

## 1. 判定口径

分母固定为 12 张关系表与 3 类写入路径：

1. 常规创建/更新：`CatalogOwnerService.createItem` 与 `saveItem`；
2. copy：全局 `executeCopy` 与同作用域 `copyLocal`；
3. promotion：`promotionExecute`。

“有守卫”只在源码中能指出具名方法和具体形态时成立。单纯依赖一个裸单列 FK、调用方已经有一个
`item_ref`、或“上游应该已经校验过”均不算 scope 守卫。

本盘点把“源码中存在守卫链”和“已经用跨 scope 运行证据证明”分开记录：源码事实可以是
`CONFIRMED`，没有对应运行证据的行为结论只能是 `UNVERIFIED_REQUIRES_EVIDENCE`。

## 2. 逐表逐路径盘点

| # | 关系表 | 写入路径 | 父 ref 来源 | scope 守卫（具名方法） | 守卫形态 | 结论 |
|---:|---|---|---|---|---|---|
| 1 | `catalog_item_category` | 常规：`saveItem` → `categoryFacts.replace`；`createItem` 不写关系表 | `sections.categoryRefs`，父 item 为当前 `catalog_item.item_ref` | `lockAndValidateCategoryRefs` → `lockCategories` | `lockCategories` 按 `data_node_ref + brand_ref + category_ref` 查询，非 VOIDED 且计数必须相等；当前 item 更新也带 scope 谓词 | 静态 `CONFIRMED`；未单独运行每张关系表的 cross-scope proof |
| 2 | `catalog_item_category` | copy：全局 `executeCopy` → `categoryFacts.insertForCopy`；`copyLocal` 不写该表 | 全局 copy 从 source graph 的 category ref，经 `validateCopyCompatibility` 映射为 target category ref；local copy 无写入 | `requireScope`、`catalogCopyPlan`、`validateCopyCompatibility`、`assertNoOwnerReferenceLeak`、`verifyTargetNoOwnerReferenceLeak`；local 为 `localCopyPlan` 的 source/target `requireItem` | 全局按 source/target scope 建图、映射并拒绝 owner ref 泄漏；local 不复制 category 关系 | 全局静态 `PARTIALLY_CONFIRMED`；local 为 N/A；未有该表 cross-scope 动态 proof |
| 3 | `catalog_item_category` | promotion：`promotionExecute` → `categoryFacts.replace`（仅 formal code 变化时） | `promotedItemRef` 与 source `promotedSections.categoryRefs` | 只有 source `requireItem(dataNodeRef, brandRef, code)`；未调用 `lockAndValidateCategoryRefs` | source item 有 scope；promotion 写入前没有对 category refs 按 scope/状态重新锁定 | 缺口静态 `CONFIRMED`；跨 scope 行为 `UNVERIFIED_REQUIRES_EVIDENCE` |
| 4 | `catalog_composite_group` | 常规：`saveItem` → `compositeFacts.replace`；`createItem` 不写关系表 | `sections.compositeGroups`，group parent 为当前 item | `saveItem` 的 scoped current item；`validateCatalogRelationRefs` | 当前 item update 由 `data_node_ref + brand_ref + code + version` 保护；关系引用由 `validateCatalogRelationRefs` 检查 | 静态 `PARTIALLY_CONFIRMED`；该关系自身没有独立 composite FK |
| 5 | `catalog_composite_group` | copy：全局 `executeCopy` → `compositeFacts.insertForCopy`；`copyLocal` 在 `PACKAGE_STRUCTURE` 选择下写入 | 全局 group 由 source graph 映射到 target item；local group 以 target item ref 重建 | 全局：`validateCopyCompatibility`、`assertNoOwnerReferenceLeak`；local：`localCopyPlan` 的 source/target `requireItem` | 全局使用 item/dictionary/SKU 映射；local 只允许同 scope source/target item | 全局静态 `PARTIALLY_CONFIRMED`；local 静态 `PARTIALLY_CONFIRMED`；无逐表动态 proof |
| 6 | `catalog_composite_group` | promotion：`promotionExecute` → `compositeFacts.replace`（formal code 变化时） | 新 `promotedItemRef` | 仅 `requireItem` 读取 source；无 `validateCatalogRelationRefs` | 新 item 在同 scope 创建，但 source sections 的 group 关系没有 promotion 前复核 | 缺口静态 `CONFIRMED`；跨 scope 行为 `UNVERIFIED_REQUIRES_EVIDENCE` |
| 7 | `catalog_composite_component` | 常规：`saveItem` → `compositeFacts.replace` → `replaceComponents`；`createItem` 不写关系表 | `component_item_ref` / `product_sku_ref` 来自 `sections.compositeGroups.components` | `validateCatalogRelationRefs` | 按当前 scope/brand 查询 component item 与 SKU；拒绝不存在、VOIDED、属于其他 item 的关系 | 静态 `CONFIRMED`；未单独运行 component 关系 cross-scope proof |
| 8 | `catalog_composite_component` | copy：全局 `executeCopy` → `compositeFacts.insertForCopy`；local 在 `PACKAGE_STRUCTURE` 下写入 | 全局来自 source graph 的 item/SKU 映射；local 来自 local source 的组件引用与 item ref 映射 | 全局：`validateCopyCompatibility`、`assertNoOwnerReferenceLeak`、`verifyTargetNoOwnerReferenceLeak`；local：`localCopyPlan` 与 `itemExistsByRef` | 全局重写组件 item/SKU ref；local 对 BOM item ref 做同 scope `itemExistsByRef` 检查，但不走通用 opaque reference validator | 全局静态 `PARTIALLY_CONFIRMED`；local 静态 `PARTIALLY_CONFIRMED`；运行证据未验 |
| 9 | `catalog_composite_component` | promotion：`promotionExecute` → `compositeFacts.replace` → `replaceComponents`（formal code 变化时） | source sections 中的 component item/SKU ref，经新 group/item 写入 | 仅 source `requireItem`；无 `validateCatalogRelationRefs` | promotion 不重新确认 component item 与 SKU 是否仍在当前 scope/owner 下 | 缺口静态 `CONFIRMED`；跨 scope 行为 `UNVERIFIED_REQUIRES_EVIDENCE` |
| 10 | `catalog_sku` | 常规：`saveItem` → `skuFacts.replace`；`createItem` 不写 SKU facts | `sections.skus` 的 `productSkuRef`，父 item 为当前 item | `saveItem` scoped update；`CatalogSkuFacts.replace` changed-row guard | SKU upsert 的 changed-row guard 在已有 SKU 属于另一 item 时抛 `REFERENCE_MAPPING_UNRESOLVED`；当前 item 更新有 scope 谓词 | 静态 `CONFIRMED`；已有代表性 SKU ownership cross-scope 测试 |
| 11 | `catalog_sku` | copy：全局 `executeCopy` → `skuFacts.insertForCopy`；local 在 `SKU_STRUCTURE` 下写入 | 全局 source SKU 映射为新 target SKU ref；local 以 target item 重建 SKU | 全局：`validateCopyCompatibility`、`assertNoOwnerReferenceLeak`；local：source/target `requireItem` | 全局校验 source/target scope 与 SKU mapping；local 不允许跨 scope item source/target | 静态 `PARTIALLY_CONFIRMED`；local 仅有同 scope guard；逐表动态 proof 未验 |
| 12 | `catalog_sku` | promotion：`promotionExecute` → `skuFacts.replace` | `clonedSkuFacts` 生成新的 SKU refs，父为 `promotedItemRef` | 仅 `requireItem`；无 promotion 前 relation/opaque ref 全量校验 | 新 SKU 父 item 是同 scope 新 item，但 source SKU 的属性值、媒体等引用未由 promotion 重新验证 | 父 item 静态 `CONFIRMED`；引用链缺口静态 `CONFIRMED`；行为 `UNVERIFIED_REQUIRES_EVIDENCE` |
| 13 | `catalog_sku_attribute_value` | 常规：`saveItem` → `skuFacts.replace` 的 attribute rows | `productSkuRef` 与 `attributeRef`/`attributeValueRef` 来自 `sections.skus` | `validateDeclaredOpaqueReferences` → `lockDictionaryRefs`；SKU parent 由 `CatalogSkuFacts.replace` guard | dictionary query 同时按 scope、brand、kind、status、ref 锁定；SKU parent 受 ownership guard | 静态 `CONFIRMED`；未单独运行该关系表的 cross-scope proof |
| 14 | `catalog_sku_attribute_value` | copy：全局 `executeCopy` → `skuFacts.insertForCopy`；local 在 `SKU_STRUCTURE` 下写入 | 全局 SKU ref 与 dictionary attribute/value ref 经 compatibility mapping；local 保留同 scope SKU 结构 | 全局：`validateCopyCompatibility`、`assertNoOwnerReferenceLeak`；local：source/target `requireItem` | 全局重写 dictionary refs；local 不复制新的外部 dictionary identity，依赖同 scope source/target | 全局静态 `PARTIALLY_CONFIRMED`；local 静态 `PARTIALLY_CONFIRMED`；动态 proof 未验 |
| 15 | `catalog_sku_attribute_value` | promotion：`promotionExecute` → `skuFacts.replace` | cloned SKU refs + source dictionary refs | 仅 `requireItem`；无 `validateDeclaredOpaqueReferences` | source dictionary refs 不在 promotion 写前按 scope、kind、status 重锁 | 缺口静态 `CONFIRMED`；行为 `UNVERIFIED_REQUIRES_EVIDENCE` |
| 16 | `catalog_sku_variant_axis` | 常规：`saveItem` → `skuVariantAxisFacts.replace` | `sections.skuVariantAxes`，父 item 为 current item | scoped current item；`validateDeclaredOpaqueReferences` 锁定相关 dictionary refs | current item 更新有 scope；dictionary refs 由 `lockDictionaryRefs` 按 scope/brand/kind 锁定 | 静态 `PARTIALLY_CONFIRMED`；未有该表独立动态 proof |
| 17 | `catalog_sku_variant_axis` | copy：全局 `executeCopy` → `skuVariantAxisFacts.insertForCopy`；local 不写该表 | 全局 source axis 映射到 target item/attribute；local 无写入 | 全局：`validateCopyCompatibility`、`assertNoOwnerReferenceLeak`；local N/A | 全局使用 target item 与 dictionary mapping；未有该表运行 proof | 全局静态 `PARTIALLY_CONFIRMED`；local N/A |
| 18 | `catalog_sku_variant_axis` | promotion：`promotionExecute` → `skuVariantAxisFacts.replace` | `promotedItemRef` + source axis refs | 仅 `requireItem`；无 `validateDeclaredOpaqueReferences` | promotion 写前未重验 attribute refs 或 axis owner scope | 缺口静态 `CONFIRMED`；行为 `UNVERIFIED_REQUIRES_EVIDENCE` |
| 19 | `catalog_sku_variant_axis_value` | 常规：`saveItem` → `skuVariantAxisFacts.replace` 的 axis-value rows | axis ref 来自当前 item 的 axis；value ref 来自 `sections` | `validateDeclaredOpaqueReferences` → `lockDictionaryRefs`；axis parent 由 current item 写入 | dictionary value 按 scope/brand/kind/status/ref 锁定；axis 以当前 item 为根 | 静态 `PARTIALLY_CONFIRMED`；独立动态 proof 未验 |
| 20 | `catalog_sku_variant_axis_value` | copy：全局 `executeCopy` → `skuVariantAxisFacts.insertForCopy`；local 不写该表 | 全局 source axis/value 经 mapping；local N/A | `validateCopyCompatibility`、`assertNoOwnerReferenceLeak`；local N/A | 全局重建 target axis/value relation；无逐表运行 proof | 全局静态 `PARTIALLY_CONFIRMED`；local N/A |
| 21 | `catalog_sku_variant_axis_value` | promotion：`promotionExecute` → `skuVariantAxisFacts.replace` | 新 axis refs + source value refs | 仅 `requireItem`；无 promotion 前 dictionary ref revalidation | value ref 可来自 source sections，未重新按 target scope/owner 检查 | 缺口静态 `CONFIRMED`；行为 `UNVERIFIED_REQUIRES_EVIDENCE` |
| 22 | `catalog_order_option_group` | 常规：`saveItem` → `orderOptionFacts.replace` | `sections.orderOptions`，父 group 为当前 item | scoped current item；`validateDeclaredOpaqueReferences` | current item scope update；option value refs 由 `lockDictionaryRefs` 的 `ORDER_OPTION_VALUE` 分支锁定 | 静态 `PARTIALLY_CONFIRMED`；独立动态 proof 未验 |
| 23 | `catalog_order_option_group` | copy：全局 `executeCopy` → `orderOptionFacts.insertForCopy`；local 在 `ORDER_OPTIONS` 下写入 | 全局 source group 映射到 target item；local 以 target item 重建 | 全局：`validateCopyCompatibility`、`assertNoOwnerReferenceLeak`；local：source/target `requireItem` | 全局映射 option group/value；local 只在同 scope item 间复制选定结构 | 全局静态 `PARTIALLY_CONFIRMED`；local 静态 `PARTIALLY_CONFIRMED`；动态 proof 未验 |
| 24 | `catalog_order_option_group` | promotion：`promotionExecute` → `orderOptionFacts.replace` | `promotedItemRef` + source option groups | 仅 `requireItem`；无 `validateDeclaredOpaqueReferences` | promotion 不重新确认 option group/value 的 target scope 与 kind | 缺口静态 `CONFIRMED`；行为 `UNVERIFIED_REQUIRES_EVIDENCE` |
| 25 | `catalog_order_option_value` | 常规：`saveItem` → `orderOptionFacts.replace` 的 value rows | option group ref + `attributeValueRef`/option value ref 来自 sections | `validateDeclaredOpaqueReferences` → `lockDictionaryRefs`，kind 包含 `ORDER_OPTION_VALUE` | 按 scope、brand、kind、status、ref 锁定；父 group 随当前 item facts 写入 | 静态 `PARTIALLY_CONFIRMED`；独立动态 proof 未验 |
| 26 | `catalog_order_option_value` | copy：全局 `executeCopy` → `orderOptionFacts.insertForCopy`；local 在 `ORDER_OPTIONS` 下写入 | 全局 dictionary option value 经 mapping；local 使用同 scope option structure | 全局：`validateCopyCompatibility`、`assertNoOwnerReferenceLeak`；local：source/target `requireItem` | 全局区分 dictionary kind 并重写 refs；local 不走全量 dictionary validator | 全局静态 `PARTIALLY_CONFIRMED`；local 静态 `PARTIALLY_CONFIRMED`；动态 proof 未验 |
| 27 | `catalog_order_option_value` | promotion：`promotionExecute` → `orderOptionFacts.replace` | new group refs + source option value refs | 仅 `requireItem`；无 `validateDeclaredOpaqueReferences` | promotion 写入前不检查 `ORDER_OPTION_VALUE` 的 scope/kind/status | 缺口静态 `CONFIRMED`；行为 `UNVERIFIED_REQUIRES_EVIDENCE` |
| 28 | `catalog_item_image` | 常规：`saveItem` → `itemMediaFacts.replace` | current item + `assetRef` 来自 sections | scoped current item；`lockCatalogAssetRefs` | current item 受 owner scope update 保护；asset refs 通过资产 owner 的 lock/validation 链 | 静态 `PARTIALLY_CONFIRMED`；资产 scope 与 item scope 不是同一模型，未作 D-3 composite-FK 结论 |
| 29 | `catalog_item_image` | copy：全局 `executeCopy` → `itemMediaFacts.insertForCopy`；local 不写该表 | 全局 target item + mapped/validated asset refs；local N/A | 全局：`lockCatalogAssetRefs`、`validateCopyCompatibility`、`verifyTargetNoOwnerReferenceLeak`；local N/A | asset 走现有资产机制，item parent 走 target mapping | 全局静态 `PARTIALLY_CONFIRMED`；local N/A；动态 proof 未验 |
| 30 | `catalog_item_image` | promotion：`promotionExecute` → `itemMediaFacts.replace` | promoted item + source asset refs | 只调用 `lockCatalogAssetRefs`；无 declared reference scope revalidation | asset locks 存在，但 promotion 没有把 source item relation refs 作为完整声明重新校验 | 缺口静态 `CONFIRMED`；行为 `UNVERIFIED_REQUIRES_EVIDENCE` |
| 31 | `catalog_item_reference` | 常规：`saveItem` → `itemReferenceFacts.replace` | production tag、catalog tag、sales unit refs 来自 sections | `validateDeclaredOpaqueReferences` → `lockDictionaryRefs`；`validateProductionTagRefs` | dictionary refs 按 scope/brand/kind 锁定；production tag 通过 owner `read(scope, brand, ...)` 检查可用/非 VOIDED | 静态 `CONFIRMED`；未分别运行三种 reference kind 的 cross-scope proof |
| 32 | `catalog_item_reference` | copy：全局 `executeCopy` → `itemReferenceFacts.insertForCopy`；local 不写该表 | catalog tag/sales unit 走 compatibility mapping；production tag 由 `CatalogInventoryCoordinator.copyReferencePlan` 提供并合入 mapping | `executeCopy` 的 `validateCopyCompatibility`、`assertNoOwnerReferenceLeak`；production tag 另有 coordinator mapping；local N/A | 全局 copy 对 declared refs 重写并检查 owner reference leak；production tag 不从裸 source ref 直接落 target | 全局静态 `PARTIALLY_CONFIRMED`；local N/A；大 copy 行为 test 当前非活动/未作证据 |
| 33 | `catalog_item_reference` | promotion：`promotionExecute` → `itemReferenceFacts.replace` | promoted item + source production/tag/sales refs | 仅 `requireItem`；无 `validateDeclaredOpaqueReferences`、`validateProductionTagRefs` | promotion 可把 source relation refs 原样带入新 item，写入前没有按 target owner scope/kind 重验 | 缺口静态 `CONFIRMED`；行为 `UNVERIFIED_REQUIRES_EVIDENCE` |
| 34 | `catalog_sku_media` | 常规：`saveItem` → `skuMediaFacts.replace` | `productSkuRef` + `assetRef` 来自 SKU sections | SKU parent 由 `CatalogSkuFacts.replace` ownership guard；asset 由 `lockCatalogAssetRefs` | SKU owner 与当前 item scope 受 guard；asset 走现有资产机制 | 静态 `PARTIALLY_CONFIRMED`；未作该关系独立动态 proof |
| 35 | `catalog_sku_media` | copy：全局 `executeCopy` → `skuMediaFacts.insertForCopy`；local 在 `SKU_STRUCTURE` 下写入 | 全局 target SKU mapping + asset refs；local target SKU 重建 + source asset refs | 全局：`validateCopyCompatibility`、`assertNoOwnerReferenceLeak`、`lockCatalogAssetRefs`；local：source/target `requireItem` 与 asset lock | SKU ref 不直接复用 source；local 同 scope；asset 由既有资产机制处理 | 全局静态 `PARTIALLY_CONFIRMED`；local 静态 `PARTIALLY_CONFIRMED`；动态 proof 未验 |
| 36 | `catalog_sku_media` | promotion：`promotionExecute` → `skuMediaFacts.replace` | cloned SKU refs + source asset refs | `lockCatalogAssetRefs`；没有 promotion 前完整 declared-reference validator | 新 SKU parent 已生成，但 source asset/reference 链未按 promotion target 重新验证 | 缺口静态 `CONFIRMED`；行为 `UNVERIFIED_REQUIRES_EVIDENCE` |

## 3. 交叉核验与证据边界

### 3.1 已能从源码确认的守卫链

- 常规 `saveItem` 在 facts 写入前执行 `validateDeclaredOpaqueReferences` 与
  `lockAndValidateCategoryRefs`；其中 `lockCategories` 使用 `data_node_ref + brand_ref`，
  `lockDictionaryRefs` 使用 `data_node_ref + brand_ref + kind`，生产标签走 owner 的带 scope
  读取。该链不是单个 caller 的模糊前置条件。
- `validateCatalogRelationRefs` 对 composite/BOM 中的 item 与 SKU 引用进行 scope、owner、
  非 VOIDED 检查；`CatalogSkuFacts.replace` 另有 changed-row ownership guard。
- 全局 copy 有独立的 source/target graph、compatibility mapping、owner-reference-leak
  检查与 target readback；生产标签 mapping 由 `CatalogInventoryCoordinator.copyReferencePlan`
  提供并显式合入，而不是用裸 ref 猜测。
- local copy 只复制声明允许的结构，source/target item 必须由同一 `data_node_ref + brand_ref`
  范围解析；其 BOM item ref 使用 `itemExistsByRef`。这不是全量关系引用 validator，不能把
  local copy 的 guard 泛化为所有关系表均已验证。

### 3.2 已确认的缺口

`promotionExecute` 在 formal code 变化分支写入上述关系 facts 前，只读取了带 scope 的 source
item，并调用 `lockCatalogAssetRefs`；没有调用 `validateDeclaredOpaqueReferences` 或
`lockAndValidateCategoryRefs`。因此“source item 是当前 scope”不能推出“source sections 中的
每个 relation parent/ref 都仍符合 target owner scope”。这是一条源码静态确认的 D-3 盘点缺口，
本轮不改码，因为 D-3 属于详设明确标记的 `[未定]` 项。

### 3.3 动态证据边界

现有 `CatalogCategoryOwnerIntegrationTest` 已覆盖常规路径中 category、SKU ownership、
dictionary reference 的代表性 cross-scope rejection；它不能证明 12 张关系表 × 3 条路径
的全覆盖。

global copy 的大范围测试当前是注释状态，local copy 的已有测试证明同 scope 结构复制，未证明
跨 scope 父 ref 的全部负例；当前没有 promotion 携带跨 scope relation ref 的活动测试。
因此本文件不把“静态有映射/守卫”写成“完整运行期 PASS”，也不以 Testcontainers 缺失的场景
补写结论。

## 4. 三方结论

| 范围 | 需求/详设要求 | 当前源码结论 | 状态 |
|---|---|---|---|
| 常规创建/更新 | 每一关系族逐路径盘点，不可用一条路径覆盖全族 | `saveItem` 的常规更新有具名守卫链；`createItem` 不写关系 facts | `PARTIALLY_CONFIRMED`（静态确认；逐表动态 proof 未完成） |
| global copy | 逐关系确认 source→target 映射、scope 与 owner-reference leak | 有完整的具名 mapping/泄漏检查链，生产标签有 coordinator mapping；活动逐表 cross-scope proof 不足 | `PARTIALLY_CONFIRMED` |
| local copy | 逐关系确认实际写入集合与同 scope 约束 | 实际只写 SKU/package/order-option 相关集合；有同 scope item guard，但不是全量 opaque validator | `PARTIALLY_CONFIRMED` |
| promotion | 逐关系确认父 ref 与 scope 守卫 | source item scope 存在，但 facts 写入前缺完整 relation/dictionary/category revalidation | `CONFIRMED` 缺口；行为失败路径 `UNVERIFIED_REQUIRES_EVIDENCE` |
| D-3 本身 | 以 `dictionary_entry` 的模式补关系表 scope 复合 FK | 当前关系表仍主要是单列 FK；`catalog_sku` 也没有直接承载 scope 列，无法仅靠简单加 FK 达成闭集 | `DEXTER_DECISION`：需后续详设决定模型/守卫方向，本盘点不改码 |

## 5. 不应从本盘点推出的结论

- 不能把 promotion 缺口直接扩大成“立刻为 12 张表全部改迁移”；D-3 详设仍是未定项。
- 不能把全局 copy 的静态 mapping 链当成完整 HTTP、seed、L2 或 UAT PASS。
- 不能因为 local copy 目前只写三类结构，就把未写入的关系表误报成“已验证安全”；它们的
  “N/A” 仅表示该路径当前没有该表写入。
