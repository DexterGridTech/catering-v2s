# 销售菜单目标选择与细粒度沽清 · S-1 裁决 follow-up DESIGN review

- reviewerKind: `EXTERNAL_INDEPENDENT_REVIEWER_CLAUDE`
- 会话性质: fresh v2s-rooted，**纯静态 DESIGN follow-up**。未运行动态验证、未起 DEV/Testcontainers/浏览器、未 reset/reseed、未改任何生产源码。
- 判定: **NO-GO**
- findings: **M=0, S=2, N=1**
- 授权边界: 只判断 S-1 裁决的设计吸收与原报告 findings 的闭合状态。不授权生产代码、生成契约、migration、reset/reseed、DEV、acceptance、browser L2、UAT 或任何仓库控制动作。

---

## 0. 结论摘要

**S-1 裁决的设计吸收是完整、精确的，没有偷工。** 原 M-1 与 N-1 均已闭合，
第 7 项（已发布 immutable snapshot 遇到后续 DISABLED）设计的处理**恰好正确**——
它划出边界并明确拒绝代为推断。

NO-GO 的依据只有两条**本轮完全没有被触碰**的旧 finding：S-2 与 S-3。
两条都是机械修复，不涉及方案争议。

**先更正我自己上一轮的一处不精确引用。** 我在原报告 S-1 中引用
`CatalogOwnerService.java` 第 191、231 行作为「Catalog 为销售菜单投影 SKU 候选」的依据。
本轮逐方法核对后确认：第 191 行属于 `readInventoryDisplayFacts`（第 175 行），
第 231 行属于 `readInventoryTargetDisplayFact`（第 224 行），
**两者都是库存展示查询，不是销售菜单候选读**。
销售菜单的候选读是第 324 行 `readSalesMenuItemFacts` → 第 454 行 `salesMenuSkuFacts`。
我的结论（DISABLED 可被选入）不变且成立，但行号依据要以第 459 行为准。

---

## 1. 逐项核验结果

### 第 1 项 · Catalog task read 只返回 ENABLED 且不误伤其他查询 —— **CONFIRMED 闭合**

**当前事实。** `CatalogOwnerService.java` 第 454 行 `salesMenuSkuFacts(ArrayNode)`，
第 459 行 `if ("VOIDED".equals(status)) continue;`——**只跳过 VOIDED，保留 DISABLED**。
这正是缺陷所在。

**设计定位准确。** 实施详设第 158 行点名
`CatalogOwnerService.salesMenuSkuFacts(...)`，说明它是
「SalesMenu task-shaped candidate projection，当前只跳过 VOIDED；本批改为只把 ENABLED
暴露为可选 candidate，**不改变 Catalog 其他通用 SKU 查询对 DISABLED 的管理事实表达**」。

**该承诺可实现，已亲验。** `salesMenuSkuFacts` 是 `private`，全文件仅两处调用
（第 368、385 行），**都在 `readSalesMenuItemFacts` 内部**。改它在结构上不可能波及
第 3908、4368、9589 行等其他 SKU 查询。

**仓内已有同形先例。** 第 4360 行 `itemSkus` 第 4367–4368 行：
`"COMPOSITE_COMPONENT".equals(candidateUsage) ? "sku.status = 'ENABLED'" : "sku.status <> 'VOIDED'"`
——按用途区分候选严格度已是既有模式，本设计不是新发明。

### 第 2 项 · 保存与发布双侧拒绝、失败无部分写入 —— **CONFIRMED 闭合**

- **保存侧**：详设第 159 行，`authoritativeSkuRows(...)` 同根修复——
  非空、无重复、属于 item、**当前状态必须为 ENABLED**、standard price readback 一致；
  `DISABLED`/`VOIDED` 统一返回 `SALES_MENU_SKU_REFERENCE_INVALID`。
- **发布侧**：第 181 行，publish 前**重新验证**当前 Catalog target membership 与 `status=ENABLED`，
  明确覆盖「草稿长期未发布期间 SKU 被 DISABLED」的时间窗。
- **原子性**：第 174 行「失败时 rollback 全部 child rows；**不先删后校验**，
  不把 Catalog/Inventory 写入事务」。删除并重插 child rows（第 170 行）在同一事务内。

三条合起来满足裁决要求的「候选读取与 owner 保存/发布校验双重闭合」。

### 第 3 项 · stale draft 读回、移除与发布失败语义 —— **PARTIALLY_CONFIRMED**

- **读回**：第 81、138 行新增 `staleSelectedSkuRefs[]`（已保存但当前变为 DISABLED/VOIDED 的 SKU）。闭合。
- **发布失败**：第 181 行拒绝。闭合。
- **移除**：见下 N-1，存在一个未写明的终态。

### 第 4 项 · acceptance / frontend / L2 / seed 覆盖 —— **CONFIRMED 闭合（以 fixture 前提为条件）**

- **acceptance**：第 462 行新增场景 `sales-menu.disabled-sku-is-not-selectable`，
  判据是「omit disabled/voided from candidate；mutate request with each invalid ref」→
  「typed `SALES_MENU_SKU_REFERENCE_INVALID`, **no draft/publication mutation**」。
  candidate omission、direct-ref rejection、no-write 三项齐全。
- **frontend**：第 138 行 `skuCandidates` 只含 ENABLED，前端消费的是已过滤载荷，
  **结构上不可能显示 DISABLED**。这比在前端加过滤更可靠。
- **L2 / seed**：第 450 行覆盖清单含「`DISABLED`/`VOIDED` candidate omission 与 direct-ref rejection」。

### 第 5 项 · M-1 的 fixture —— **设计缺陷已闭合；fixture 本体未改，已正确降级为实施前提**

**fixture 本体未变，我亲验过：** `contracts/policy/catalog-inventory-fixture-catalog.json`
中 `LATTE-001` 仍是 `LATTE-SKU-S=ENABLED`、`LATTE-SKU-M=DISABLED`、`LATTE-SKU-L=VOIDED`，
**ENABLED 仍只有 1 个**。

**但这不再是设计缺陷。** 原 M-1 的两个具体defect——引用不存在的商品码、
断言「不需要修改 fixture」——**都已被删除并改写为相反表述**。详设第 311 行现在写：

> 当前 fixture 只有 `LATTE-001` 且仅有一个 `ENABLED` SKU，不能支撑两个互斥非空 SKU subset；
> 实施 CP-06 必须在 Catalog fixture/seed source 中增加第二个 `ENABLED` SKU
> （并保留至少一个 `DISABLED` 与一个 `VOIDED` 反例），再由两个 SalesItem 各选一个。
> **不得把 `DISABLED` 当作第二个可选 SKU**，也不得继续引用不存在的
> `BEV-LATTE-001`/`PASTA-BOLOGNESE-001`。

并在第 448 行的变更面表中登记为 Catalog fixture 同批修改前提。

**这是一次完整、诚实的 intake。** 它还主动堵死了我上轮提到的那个变通
（用 ENABLED+DISABLED 凑两个单元素子集）——Dexter 的裁决使该变通非法，设计正确地跟上了。

fixture 的实际修改属于 CP-06 实施动作，本轮未授权，**不作为本次 DESIGN review 的阻断项**。

### 第 6 项 · S-2 / S-3 / N-1 —— **N-1 闭合；S-2、S-3 仍然成立**

**N-1（`target_ref` 多态化丢失外键完整性）—— CONFIRMED 闭合。** 详设现在给出：

- 第 123 行 `PRIMARY KEY (sales_item_ref, channel_ref, target_kind, target_ref)`；
- 第 124 行 **`CHECK (target_kind <> ITEM OR target_ref = sales_item_ref)`**
  ——我要求明写的 ITEM 取值约定，现在是数据库级约束，比文字说明更强；
- 第 127 行「Catalog ref 不建跨 schema FK，**SalesMenu owner 在 command 内验证 published snapshot membership**」
  ——明确了替代外键的机制；
- 第 111 行 option group snapshot 保留对 group snapshot/version/item 的 FK；
- 第 114 行 published-child mutation trigger 保护不可变边界；
- 第 183 行「删除不再属于新 published set 的 child current status」
  ——published 行删除时子目标的处置也写了。

我提的三点全部得到回答。

**S-2、S-3 见下，两条本轮完全未被触碰。**

### 第 7 项 · 已发布 immutable snapshot 后续遇到 DISABLED —— **CONFIRMED，设计处理正确**

Journey 裁决稿第 62 行：

> 本次「不可选入」裁决约束候选展示、草稿保存和发布复核；**不自动回写已经发布的 immutable snapshot**。
> 已发布目标在 Catalog 后续变为 `DISABLED` 后是否自动下架，**是另一个发布生命周期裁决，本轮不代为推断**。

与详设第 182 行「发布后 published readback 只用 snapshot，不实时替换名字/选项值」一致。

**回答提问：是，仍需独立产品裁决，而设计已经这样说了，并且没有越界推断。**
这是本轮做得最好的一处——面对一个顺手就能"推导"的相邻语义，它选择停下来标记未决。

---

## S-2 fixture 中仍无 required 选项组，且未像 SKU 那样登记为实施前提 · `CONFIRMED`

**位置。** `contracts/policy/catalog-inventory-fixture-catalog.json`
`catalogDefinitionSeed.itemAssignments[*].orderOptions[*]`；
实施详设第 263、393、448 行。

**事实。** 本轮复算：fixture 中共 3 个 item-option assignment，
**`required=true` 的数量为 0**，与上一轮完全一致，未做任何改动。

而详设仍然要求测试该分支：

- 第 263 行 `sales-menu.selection-negative-boundaries` 判据含「**required 零值**」；
- 第 393 行「required option group 至少一个 exposed value | SalesMenu owner；不由前端唯一保证」；
- 第 114 行「required 组必须至少有一个 value 行」。

**反例。** 以当前 fixture 的任一 item 构造「required 组被清空应被拒绝」的用例时，
不存在 `required=true` 的组作为输入，该负向分支无输入可构造。

**为什么本轮升为更尖锐的问题。** SKU 侧遇到同类缺口时，设计在第 311、448 行
**明确登记为 CP-06 实施前提并写明具体做法**；option 侧遇到同类缺口，
第 448 行只写「CAESAR/MILK-TEA option facts 仍需按 owning source 复核」——
**没有说要新增一个 required 组**。同一份设计对两个同构缺口采取了不同的严谨度。

**影响面。** 负向验收完整性；裁定稿 §4「optional 组零暴露」裁决落地后，
其对偶分支仍将完全未验证。

**最小修复建议。** 在第 448 行同一张表中，为 option 侧补一条与 SKU 侧同等具体的前提：
把一个 assignment（建议 `CAESAR_DRESSING`，SINGLE、2 值，语义上最像必选）
改为 `required=true, minSelectionCount=1`，并保留其余 optional 组作为对照。
改动落在 fixture，不触生产语义。

**是否需 Dexter 产品裁决。** 否。

---

## S-3 交互设计仍未枚举测试控件，违反路由命中的 memory 硬性顺序 · `CONFIRMED`

**位置。** `doc/plans/platform/2026-09-07-...-interaction-design-codex.md`；
`project-memory/operations/ui-testid-preflight-before-l2.md` 第 11 行。

**事实。** 该交互设计本轮**确有修改**（mtime 晚于我的上轮报告），
但复算结果与上轮一致：全文提及 testId 共 6 次（上轮 5 次），
唯一控件键仍只有 **1 个**（`SALES_MENU_MANUAL_TARGET_INVALID`，且它是错误码不是控件）。
**新增控件的 testId 清单仍未给出。**

memory 的 assertions 明确包含 `UI_INTERACTION_DESIGN_MUST_ENUMERATE_TEST_CONTROLS`、
`IMPLEMENTATION_DESIGN_MUST_RECORD_UI_PREFLIGHT` 与
`L2_SCRIPT_BLOCKED_UNTIL_UI_PREFLIGHT`——最后一条是**顺序门**：
UI 预检未完成前，L2 spec / locator binding / blueprint 控件声明处于阻断态。

本批新增 UI 面至少含：SKU 选择表（勾选 + 逐 SKU 价格输入）、
选项组/选项值选择表、目标级状态 Modal 的目标定位控件，以及本轮新增的
stale SKU 修复提示。这些控件的 testId 一个都没有在设计阶段定下来。

**影响面。** 按同一 memory，CP 中涉及 L2 的步骤无法启动；
控件分母只能在实施期临时确定，这正是本仓此前反复出现「控件分母遗漏」的来源。

**最小修复建议。** 在交互设计中补一张表：控件键、testId、所在**真实动作节点**、
是否 `COMPOSITE_OPTION_ANCHOR`。

**是否需 Dexter 产品裁决。** 否。

---

## N-1 stale SKU 存在一个无法修复的终态，设计未写明 · `CONFIRMED`

**位置。** 实施详设第 81 行、第 159 行；`SalesMenuOwnerService.java` 第 2682 行。

**事实与反例。** 设第 81 行把 `staleSelectedSkuRefs` 描述为「**仅用于修复提示**」。
考虑这条路径：

1. 某 SalesItem 只选了一个 SKU；
2. 该 Catalog 商品**只有这一个 ENABLED SKU**，之后它被置为 DISABLED；
3. 候选读按第 158 行改造后只返回 ENABLED，候选集为空；
4. 用户想保存修复：owner 第 2682 行要求 `skuPrices` 非空，
   而没有任何 ENABLED SKU 可选，**无法构造合法非空集合**；
5. 用户想发布：第 181 行重新校验拒绝。

结果是该销售项**既不能保存也不能发布**，`staleSelectedSkuRefs` 提示了问题
却没有可达的修复动作。唯一出路是删除该销售项。

**推论。** 删除销售项很可能就是正确的产品行为（该商品此刻确实无可售规格），
但「仅用于修复提示」的措辞承诺了一个在此终态下并不存在的修复。

**影响面。** 交互文案与用户预期；实施期可能被当作缺陷反复排查。

**最小修复建议。** 在详设与交互设计中写明该终态及其出路：
当商品无任何 ENABLED SKU 时，销售项进入不可保存/不可发布状态，
提示应引导删除销售项或先在 Catalog 恢复 SKU，而不是暗示可在本 Drawer 内修复。

**是否需 Dexter 产品裁决。** 否——除非 Dexter 认为此时应允许保存空 SKU 集合，
那属于产品语义变更，需另行裁决。

---

## 2. 判定

**NO-GO，M=0 / S=2 / N=1。**

**本轮进展是实质性的：** S-1 裁决被完整、精确地吸收进 Journey、需求、交互与实施详设四份文档；
原 M-1 的两个具体 defect 被删除并改写为相反表述，还主动堵死了变通路径；
原 N-1 三点全部回答，其中 ITEM 的 `target_ref` 约定被提升为数据库 CHECK 约束；
第 7 项面对一个顺手可推导的相邻语义，选择停下来标记为独立裁决。

**阻断只剩两条本轮完全未被触碰的旧 finding：**

- **S-2**：option 侧的 fixture 缺口与 SKU 侧同构，但只有 SKU 侧被登记为实施前提。
  补一条同等具体的前提即可。
- **S-3**：交互设计仍未枚举测试控件，而这是 routed memory 的**顺序门**，
  不是可以留到实施期补的项。

两条都不涉及方案争议，都是机械修复。处置后本设计即具备进入实施阶段的条件。

**M-1 的 fixture 本体（第二个 ENABLED SKU）未改，但这属于 CP-06 实施动作，
本轮未授权，不计为阻断。** 请在实施时不要漏掉——它同时是 S-2 的邻居，
两处 fixture 修改应当同批完成。
