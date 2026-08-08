---
title: 商品目录与门店轻库存 P1 实施 · Claude 独立评审
reviewTarget: IMPLEMENTATION
scope: P1 静态实施（契约、fixture、media、generated wire、门与证据）
verdict: NO-GO → GO（6. POST_REMEDIATION recheck）
findings: M=2 / S=2 / N=1
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅静态 P1 实施评审；不授权 owner runtime、数据库/schema/migration、reset/seed 执行、DEV/UAT/L2、部署或 Git
createdAt: 2026-08-06
---

# P1 实施独立评审

## 0. 结论

**`NO-GO` — `M=2 / S=2 / N=1`。**

**媒体资产那部分做得非常扎实**，我三方比对全部通过。
**但 P1 最核心的交付——契约——是个空壳：42 个 operation 的信封齐全，业务载荷几乎全缺。**

**并且这不是详设的问题，是实现没有落。** 详设 §3.4「读模型一次定全」写得相当具体，
逐个读模型点名了要返回什么字段；P1 契约把这些字段整片丢了，而 15 个门全绿。

## 1. 先回答 Dexter 的两个直接问题

### 「商品价格存在哪里？」——**不在任何地方**

我对 `contracts/openapi/catalog-inventory.openapi.yaml` 做全文原文检索
（大小写不敏感，匹配带引号的标识符 `price|cents|amount|fee`）：**零命中**。

逐个确认设计与需求点名的价格字段：

```
standardSalePrice     0        priceGranularity      0
listedSalePrice       0        standardPriceDelta    0
standardExtraPrice    0
```

而 `CatalogItemPage.items[]` 的实际字段只有
`code / name / shapeKey / status / skuCount` 五个——**没有价格列的任何数据来源**，
尽管 IA §5.1 线框里明确画了「¥68/商品」「¥28~34 / SKU 定价」这一列。

### 「时间是否用 long、金额是否用分」

**时间：不合规，有一处实证违反。** 契约里时间字段只有两个：
`durationMillis` 是 `integer`（正确），
**`occurredAt` 是 `{"type": "string", "description": "event time"}`，出现 6 次**。

这不是口味问题，是与仓内既有字节直接冲突：既有 generated wire 中
时间字段**全部为 `Long`**——`Long updatedAt`×23、`Long createdAt`×21、`Long expiresAt`×10……
其中**恰好就有 `Long occurredAt`**。同名字段在仓内已是 `Long`，新契约却定成 `string`。
数据库侧同样是 `*_at_epoch_millis BIGINT`。

**金额：无法评价，因为契约里根本没有金额字段**（见上）。
所以"是否用分"这个问题在当前字节下不成立——它连字段都还没有。

## 2. 做得扎实、我确认无误的部分

### 2.1 v4 媒体资产 34/34 —— **三方一致，通过**

我做的是三方比对而不是只看登记值：

| 校验 | 结果 |
| --- | --- |
| 本地 `contracts/policy/catalog-inventory-p1-media` 文件存在 | **34/34** |
| 本地文件 sha256 == 登记 sha256 | **34/34** |
| 本地文件 sha256 == v4 源文件 sha256 | **34/34** |

v4 源目录实有 35 张图，登记 34 张，**未登记的那张是 `cr-mixc-life-logo.png`**——
logo 不是商品图，**排除正确**。

> **方法自陈**：我第一次比对时用了 `sourceName`（Wikimedia 原始标题）去匹配 v4 文件名，
> 得到"34 张源文件全部找不到"的错误结论。实际应匹配 `fileName`。
> **这是我的假阴性，本轮第四次同类取错字段的错误**，如实记录。

### 2.2 73/34 parity 已登记为 P2 硬约束 —— 通过

`coverage` 显式声明 `v4CatalogItemCount=73`、`v4MediaAssetCount=34`、
`fullCatalogParityRequiredInP2=true`、`reductionIsNotFinalSeedPolicy=true`；
证据 `notes` 进一步写明「**P2 full seed must preserve v4 business coverage of 73 catalog items
and 34 media assets…a smaller final seed is not accepted**」。

### 2.3 multipart 真实二进制上传 —— 通过

`stageOperationsCatalogAsset` 的 `requestBody` 是
`{"required": true, "content": {"multipart/form-data": {...}}}`，非 base64 或 JSON 字符串。

### 2.4 createOperationsCatalogItem 使用返回的 assetRef —— 政策层通过

证据 `notes` 明写「Seed must upload real bytes through `stageOperationsCatalogAsset`
multipart/form-data, create products through `createOperationsCatalogItem` **using returned assetRefs**,
and **never fall back to SQL**」。P1 为静态定义阶段，该约束的执行证明属 P2。

### 2.5 P1 代表 seed 不被误当最终 DEV seed —— 通过，表述清楚

`notes` 第 2 条：「its 5 seed datasets and 8 bound media keys are **representative definition graphs,
not the final DEV seed denominator**」。`coverage.reductionIsNotFinalSeedPolicy=true` 呼应。
**无歧义。**

## 3. Findings

### M-01｜P1 契约的业务载荷整片缺失：13 个读/写模型的 `data` 只有两个元字段

**位置**：`contracts/openapi/catalog-inventory.openapi.yaml` 的 `components.schemas`。
**依据类型**：仓内事实（我对 72 个 schema 逐个统计）。

**统计结果**：72 个 schema 中 **40 个的业务字段 ≤2**。其中 **13 个的 `data` 载荷
逐字都是 `{factType, revision}`**——两个元字段，零业务内容：

```
CatalogDictionaryView.data        ProductionTagPage.data
LocalCopyCandidatePage.data       LocalCopyPreflight.data
LocalCopyReadback.data            TemporaryPromotionPreflight.data
CatalogItemCommandReadback.data   BrandCopyCandidatePage.data
BrandCatalogCopyReadback.data     InventoryTargetPage.data
InventoryWriteReadback.data       StagedCatalogAsset.data
CatalogAssetReleaseReadback.data
```

14 个带 `data` 的 schema 中，**只有 `CatalogWorkbenchContext.data` 有真实内容**
（`pageKeys / dataNodeKinds / roleKeys`）。

`CatalogItemSaveRequest.sections` 同样只有 `{factType, revision}`——
**整个 whole-save 命令没有任何业务内容字段**，而详设 §3.3 明确要求它内部分为
`catalogDraft`、`inventoryConfiguration`、`expectedCatalogVersion`、`expectedInventoryVersions[]`。

**这是详设问题还是实现问题？我查了，是实现问题。** 详设 §3.4 写得很具体：

- `CatalogItemPage` 每个 summary 要求「主图 ref、名码/短名、分类/标签、shape/status/governance/source、
  SKU 启用/非归档/总数与维度、**商品/SKU 价格摘要与 `priceGranularity`/缺价数**、
  StockTarget/BOM 数与风险、version/updatedAt」；
- `BrandCatalogCopyPreflight` 要求返回「`closureItems[]`、`closureEdges[]`、双侧 `objectVersions[]`、
  `mappingPreview[]`、**九类 `compatibilityResults[]`**、`referenceRewritePreview[]`、
  `preflightDigest`、blocking count 与 confirmation-required count」；
- 库存列表 summary 要求「余额与 `stockState`、stale/unknown、**threshold/gap**、
  **今日/7日/30日变化**、最近变化 source/time、`authorityType`」。

**逐条对照 P1 契约**：`priceGranularity` 0、`compatibilityResults` 0、`closureObjectCount` 0、
`lowStockThreshold` 0、`allowNegative` 0、`beforeQty`/`afterQty` 0、`ledgerRef` 0。

**影响**：P1 的立身之本是"契约与读模型一次定全，P2 只能实现 P1 字节、不得扩契约、
发现缺口必须显式重开 P1"。当前字节下 P2 **必然**要重开 P1，
因为它拿不到任何可实现的业务形状。等于 P1 尚未完成其唯一职责。

**最小修复**：按详设 §3.4 逐个读模型把字段落进 schema——
不是补几个字段，而是把 13 个 `data` 载荷与 `CatalogItemSaveRequest.sections` 的真实结构写出来。

### M-02｜设计阶段已判定关闭的 `voidAvailability` 修复，未进入实现

**位置**：同上。**依据类型**：仓内事实 + 跨阶段一致性。

上一轮设计评审中，Round 2 的 M-02 要求四个既有 GET
（`CatalogItemDetail` 的 action availability、`CatalogNavigationView` 每个 category node、
`CatalogDictionaryView` 每个 entry、`ProductionTagPage` 每个 row）
携带同一 typed `voidAvailability={canVoid, blockingReferences[], dependentFacts[]}`。
**我当时在详设中逐条核实并确认关闭。**

**P1 契约中这四个标识符全部为 0**：

```
voidAvailability  0    canVoid  0    blockingReferences  0    dependentFacts  0
```

**影响**：这是"设计层判定关闭、实现层未落地"的典型断链，比单纯漏字段更值得警惕——
它说明设计到实现之间**没有逐条回读设计条款的动作**。
后果是 C-17「零引用可整体作废重建」这条 Dexter 裁决在 P1 契约里没有任何承载。

**最小修复**：把该 typed 结构补进四个读模型，并在 P1 exit 增加一条针对
**已关闭 finding 的回归检查**（设计阶段关闭的每条修复，必须在实现阶段可定位）。

### S-01｜`occurredAt` 用 `string`，与仓内 `Long` 惯例及项目时间规范冲突

**位置**：契约中 6 处 `"occurredAt": {"type": "string"}`。
**依据类型**：仓内既有字节对照。

既有 generated wire 时间字段**全部 `Long`**，其中包含同名的 `Long occurredAt`；
数据库列为 `*_at_epoch_millis BIGINT`。

**影响**：generated Java/TS 会产出 `String occurredAt`，与既有 wire 同名字段类型不一致；
前端排序、区间筛选与"三周期变化"聚合都要在前端解析字符串。

**最小修复**：改为 `integer`（epoch millis），并统一命名为
`occurredAtEpochMillis` 以与仓内既有列名对齐。

### S-02｜15 个门全绿却没拦住 M-01，`typedSchemas` 是形状检查不是设计符合性检查

**位置**：`doc/evidence/…-p1-implementation-evidence-codex.json` 的 `checks`。
**依据类型**：仓内事实 + 推论。

15 项全部 `PASS`，含 `typedSchemas`、`openapiReachability`、`shapeSurfaces`、
`fixtureScenarioExactSet`、`javaCompile`、`typescriptSyntax`。
但 `{factType, revision}` 这样的空载荷**完全能通过**上述每一项：
它是合法 typed schema、可达、能生成、能编译。

**门测的是"形状合法"，不是"字段与详设 §3.4 一致"**。
denominators 报的也是 operations 42 / shapes 7 / cases 100 等**数量**分母，
**没有任何一项对应"读模型字段完整性"**。

**影响**：这是一个可复用的假绿模式——**只要信封齐全，载荷为空也能全绿**。
不修的话 P2、P3 会继续在这个模式下"通过"。

**最小修复**：为 P1 增加一条读模型字段对账门——
以详设 §3.4 逐读模型点名的字段为分母，校验 schema 中存在且类型合法；
并配真实红变异（删掉某个读模型的一个必需字段必须红）。

### N-01｜cleanup 的 media namespace 与 absence readback 只各出现一次

`contracts/policy/catalog-inventory-fixture-catalog.json` 中
`mediaNamespace` 与 `absence` **各仅 1 次命中**。方向正确（要求确实存在），
但对"reset/run cleanup 必须清空 run-scoped media namespace 并 readback absence"
这条要求而言，**单点声明不足以支撑 P2 的执行与证明**。

**最小修复**：把它展开为可执行约束——namespace 命名规则、清理时机、
absence readback 的断言对象与失败码，并在 P2 exit 挂 cleanup 证据。
**本条不阻断 P1**。

## 4. 方案合理性判断

**这活儿要解决什么**：P1 要一次性冻结契约、seed、测试场景与测试数据，
使 P2/P3 只能实现而不能发明。

**解决了吗**：**媒体与 seed 分层这两块解决得好**——34 张图三方一致、
73/34 parity 登记为 P2 硬约束、代表 seed 与最终 seed 的边界表述清楚无歧义。
**但契约这块没解决**，而契约恰是 P1 的第一职责。

**是不是只为了凑 GO**：我判断**不是刻意凑**，证据是 `notes` 主动写了
"P1 does not claim HTTP, DB, seed runtime or browser L2 PASS"、
"a smaller final seed is not accepted"这类给自己加约束的话。
更像是**把"生成出结构合法的契约骨架"误当成了"契约定全"**，
而 15 个门恰好只测前者，没有任何一个门能证伪后者——**假绿是机制性的，不是意图性的**。

## 5. 授权边界

本 `NO-GO` 仅针对 P1 静态实施字节。
不授权 owner runtime、数据库/schema/migration、reset/seed 执行、DEV/UAT/L2、部署或 Git。
`M-01`/`M-02`/`S-01` 属 Codex 既有批准边界内的实现修复；
`S-02` 涉及新增门，若需要动 `scripts/check/` 请另取范围授权。

---

# 6. POST_REMEDIATION current-byte recheck（2026-08-06）

**历史 verdict 未改写**：本文件 §0 的 `NO-GO — M=2 / S=2 / N=1` 与全部历史论证原样保留，
本节为整改后当前字节的独立复核追加。

## 6.0 结论：`GO — M=0 / S=1 / N=2`

**M-01、M-02、S-01 三条真实关闭**，且关闭方式是补齐字节而非改写措辞——我逐条独立复算。
S-02（门只测形状不测设计符合性）也已由新增的 design-byte coverage 机制关闭。
新增一条 `S` 与两条 `N`，均**不阻塞 P1 静态 package 收口**。

## 6.1 我的独立复算（不采信作者声明）

| 复算项 | 结果 |
| --- | --- |
| 详设绑定是否新鲜 | coverage spec 声明 designSha256 `a31a558b…` = 详设实算，**绑定新鲜** |
| 矩阵路径总数 | rows **608** + requestRows **19** = **627**；"608" 对 rows 精确 |
| 627 条路径能否在 OpenAPI 解析 | **627/627 全部解析成功** |
| type 一致 | **零不符** |
| format 一致 | **零不符** |
| 反向 orphan（OpenAPI 有而矩阵无） | **0**，矩阵是双向完整分母 |
| `voidAvailability` 四处 | `CatalogNavigationView` / `CatalogItemDetail` / `CatalogDictionaryView` / `ProductionTagPage` **各 8 条子路径，结构完全一致**（`canVoid`、`blockingReferences[].referenceKind/referenceRef`、`dependentFacts[].factKind/factRef`） |
| `occurredAt` | OpenAPI 实为 `"type": "integer"` + `format: epoch-millis`，**S-01 关闭** |
| 金额 | 11 条价格路径全部 `["integer","null"]` + `format: cents`（`standardSalePrice`/`listedSalePrice`/`standardPriceDelta`/`standardExtraPrice`/`priceGranularity`/`missingPriceCount`），**M-01 的"零金额字段"关闭** |
| 数量 | `quantity`/`countedQuantity`/`before-change-after`/`balance`/`increase`/`decrease`/`netChange` 均 `string` + `format: decimal`；`threshold`/`gap` 为 `["string","null"]` + decimal |
| 形态契约 | `shapeRules[]` 含 `priceGranularity`、`modeRules[]` 四条 typed；生成 Java 为 `record ShapeRule(...)` 且带 `visibleButDisabled`/`disabledReason`——**C-16 已落到生成码** |

**独立红变异**（我在 scratchpad 完整镜像上做，先确认绿基线，用后即弃，仓内零写入）：

| 变异 | 结果 |
| --- | --- |
| 绿基线 | `PASS` ✓（第一次镜像不全导致基线就红，已重建） |
| `occurredAt` 改回 `string` | **红** ✓ |
| 删 `ProductionTagPage` 的一处 `voidAvailability` | **红** ✓ |
| `CatalogItemSaveRequest.sections` 退回 `{factType, revision}` 空壳 | **红** ✓ |
| 删 `item.ordering.standardSalePrice` | **红** ✓ |
| 金额 `cents` 改成 `decimal string` | **红** ✓ |

五类真实变异全部被拦截，覆盖 Dexter 点名的设计字段、`voidAvailability`、时间类型与 whole-save 空壳回归四类。

## 6.2 三条历史 finding 的关闭核验

- **M-01（契约空壳）关闭**：13 个曾为 `{factType, revision}` 的 `data` 载荷现已展开；
  我按详设 §3.4 逐条抽查，`priceGranularity`、`compatibilityResults`、`closureItems`、
  `threshold/gap`、三周期变化、`before/change/after` 均已进契约。
- **M-02（`voidAvailability` 断链）关闭**：四处齐备且结构一致，见上表。
- **S-01（`occurredAt` 用 string）关闭**：现为 `integer` + `epoch-millis`。
- **S-02（门只测形状）关闭**：新增 design-byte coverage 以详设 §3.4 为语义分母，
  checker 输出 `designFieldCoverage` / `closedFindingRegression` / `typeConventions`
  三项独立结论，且我实测其中三类能真红。

## 6.3 新增 findings

### S-03｜矩阵内 5 条重复 path，严格定义被静默覆盖为放宽定义（**不阻塞**）

**位置**：`contracts/policy/catalog-inventory-design-byte-coverage.json` 的 `CatalogItemDetail` 行；
`tools/catalog-inventory-p1/cli.mjs:98` `coverageFieldMap`。
**依据类型**：仓内事实。

`CatalogItemDetail` 有 5 条 path 各出现两次，且两次定义**互相冲突**——
一次严格（无 `additionalProperties`），一次放宽（`additionalProperties: true`）：

```
item.productionProfiles.item / .sku / .optionValue
item.externalIdentity        governance.externalIdentity
```

`coverageFieldMap` 用 `new Map((row.fields||[]).map(...))`，**后写覆盖先写**，
因此**放宽版胜出，严格版永远不可能失败**——它是矩阵里的死行。

**影响**：一是 608 这个分母被这 5 条重复虚增；
二是读矩阵的人会以为这些路径被严格约束，实际执行的是自由 map。
**不阻塞收口**，因为放宽版与 OpenAPI 当前字节一致，不产生漂移。

**最小修复**：删掉 5 条严格重复行（或删放宽行并同步收紧 OpenAPI），
并在 checker 增加一条"同一 model 内 path 唯一"的机械断言，防止再次出现死行。

### N-02｜11 处自由 map 中有 8 处不属于已批准的豁免（**不阻塞**）

全契约 `additionalProperties: true` 共 **14 处**。其中 **3 处合法**——
`CatalogItemDetail.item.attributes`、`CatalogItemCreateRequest.attributes`、
`CatalogItemSaveRequest.sections.catalogDraft.attributes`，
即需求 `D-07`/`DR-2` 明确批准的**唯一**裸 map（商品描述属性）。

其余 11 处均为 `{"additionalProperties": true, "properties": {}, "required": []}` 空壳：

- 3 处 `productionProfiles.item/sku/optionValue`——`D-05` 要求三层 production profile 是 **typed JSON**；
- 2 处 `externalIdentity`——需求侧该对象有确定形状（`sourceSystemRef`/`externalCatalogItemId`/
  `externalSkuId`/`syncMode`/`lastSyncedAt`）；
- 6 处 `CatalogShapeManifestView` 的 `fieldRules`/`tabRules`/`linkageRules`/`typeEffects`/
  `saveSections`/`detailSections`。

**最后 6 处我判定影响有限**，因为形态的 typed 真相不在这个 HTTP 视图里：
`contracts/catalog/catalog-item-editor-manifest.json` 已生成
`CatalogInventoryShapeManifest.java`（typed record）与 `catalogInventoryShapeManifest.ts`
（含真实 `fieldRules` 结构，按形态给出 `{field, visible, required, readonly, readonlyWhen}`），
**前后端绑定由生成的 manifest 承担，HTTP 视图只是同 revision/digest 的会话可读版本**。

**最小修复**：前 5 处（production profile 与 externalIdentity）按需求补 typed 形状；
后 6 处若维持 map 形态，建议改为 `additionalProperties: {<typed schema>}` 而非 `true`，
使键任意但值受约束。**均不阻塞 P1 收口。**

### N-03｜"与 generated Java/TypeScript exact-set 一致"的表述强于实际机制（**不阻塞**）

`completionRule` 写「OpenAPI **and generated wire** must match every path/type/format/required bit exactly」，
但 `CatalogInventoryEdgeWire.java` 实为 **operation registry**——
只有一个 `record Operation(operationId, method, path, requestComponent, responseComponent, problemCodes)`
与 42 条记录，**不含任何 read model 字段**，故 `occurredAt`/`standardSalePrice`/
`voidAvailability`/`priceGranularity` 在其中均为零命中。

实际机制是 **digest 绑定**：`cli.mjs:157` 校验生成 Java 内嵌
`READ_MODEL_COUNT`、`DESIGN_COVERAGE_SHA256`、`DESIGN_FIELD_DIGEST` 与当前 coverage 文件一致。
**这个机制本身是成立的**（矩阵一改、生成物不重生成即红），只是与"逐字段 exact-set"的措辞不符。

**最小修复**：把 `completionRule` 与交接话术改为准确表述——
「OpenAPI 逐字段 exact-match；generated wire 通过 coverage SHA 与 field digest 绑定防漂移」。

## 6.4 N-01 媒体 cleanup 的诚实性 —— 确认保留为 P2 义务

原 `N-01` 要求的 run-scoped media namespace 清理与 absence readback，
当前**仍诚实登记为 P2 runtime cleanup 义务**，未被伪装成 P1 已完成；
P1 证据的 `businessStatus`/`cleanupStatus` 均为 `NOT_APPLICABLE_WITH_REASON`，
`notes` 明写 "P1 does not claim HTTP, DB, seed runtime or browser L2 PASS"。**处置正确。**

## 6.5 我在本轮的方法错误（如实记录）

本轮我在"取错字段名/路径"上共犯 **两次**：
一是用 `sourceName`（Wikimedia 原始标题）匹配 v4 文件名，得出"34 张源文件全找不到"的假阴性，
实际应匹配 `fileName`；二是红变异时把价格路径写成 `item.standardSalePrice`，
实际在 `item.ordering.standardSalePrice`，导致一次无效变异被我误读为"门未拦住"。
两次均在同一会话内自查纠正，**结论以纠正后为准**。
加上历史轮次，这是我第五、六次同类错误——**从工具输出下结论前，必须先确认字段/路径口径与文档一致**。

## 6.6 授权边界

本 `GO` **仅表示 P1 静态 implementation 当前字节通过复核**，
**不得表述为业务或运行环境 PASS**。不授权 owner runtime、数据库/schema/migration、
reset/seed、DEV/UAT/L2、部署或 Git。`S-03`、`N-02`、`N-03` 属 Codex 既有边界内可自主处置。
