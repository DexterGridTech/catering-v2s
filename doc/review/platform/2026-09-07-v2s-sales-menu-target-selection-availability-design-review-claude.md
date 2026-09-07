# 销售菜单目标选择与细粒度沽清 · 独立 DESIGN review

- reviewerKind: `EXTERNAL_INDEPENDENT_REVIEWER_CLAUDE`
- 会话性质: fresh v2s-rooted，**纯静态**。未运行动态验证、未起 DEV/Testcontainers/浏览器、未 reset/reseed、未改任何生产源码。
- 判定: **NO-GO**
- findings: **M=1, S=3, N=1**
- 授权边界: 只表示当前 DESIGN 草案是否具备进入 Dexter 单独决定的实施阶段的条件。不授权生产代码、契约生成物、Flyway、reset/reseed、DEV、acceptance、L2、UAT、部署、切流。**本 review 不替代本 cycle 必须单独完成的 fresh `INDEPENDENT_SUBAGENT` 盲审**，请求方也未声称该轮已完成。

---

## 0. 关于评审入口的一处更正

请求要求我按相对路径 + SHA-256 建立输入台账。`CLAUDE.md` 明确写：
**evidence/package/hash-chain 的台账、分母和交叉对账控制已退役，不得以其替代亲验。**
因此本轮不产出哈希台账，改为对每条 load-bearing 断言回 owning source 逐条证伪。
下文每个结论都带精确路径与行号。

---

## 1. 方案合理性（先于闭环正确性）

### 1.1 问题对不对 —— **对，三个根因都真实存在，且已回源码确认**

| 根因 | 亲验结论 | 依据 |
| --- | --- | --- |
| SKU 子集无法表达 | **部分不成立：owner 早已支持** | 见下 |
| 普通商品选项只有只读投影 | **成立** | `SalesMenuSaleContent.java` 全文 18 行，字段只有 `kind/listedPriceCents/skuPrices/salesUnit`，无任何 option 承载 |
| 人工沽清只能到 SalesItem | **成立** | `V20260901_000000_000__sales_menu_owner.sql` 第 222 行起，PK 为 `(sales_item_ref, channel_ref)`，无 target 维度 |

**SKU 这一条需要更正设计稿之外的一个误解，但设计稿本身没有犯这个错。**
`SalesMenuOwnerService.java` 第 2681–2698 行**已经完整实现 SKU 子集语义**：
第 2682 行要求 `skuPrices` 非空；第 2687–2689 行拒重复 `skuRef`；
第 2690–2694 行拒不属于当前商品的陌生 ref；第 2695–2697 行拒 VOIDED 或无标准价的 SKU；
第 2711–2713 行拒 DIRECT/COMPOSITE 携带 `skuPrices`（shape 混用反例）。
第 2724–2745 行 `authoritativeSkuRows` 只从请求取 `listedPriceCents`，
`skuName`/`skuCode`/`standardSalePrice` 全部回读 Catalog owner 事实。

因此评审目标第 2 项（多 SalesItem 绑定互不串写子集、selected price 与 owner 事实一致、
新增 candidate 不自动进入）**在 SKU 侧当前代码已全部成立**。

设计稿对此判断准确：第 21 行「UI 没有 SKU checkbox，虽然 owner 已有 `sales_version_item_sku` 子集存储」，
第 54 行保留现有 `skuPrices` 作为选中子集快照，第 421 行明确 **`no new table`**。
**SKU 半边被正确收窄为 UI 缺口，没有制造多余的 owner/迁移工作。这是本设计做得好的地方。**

### 1.2 方案优不优 —— **option 侧的规范化表选择站得住，但理由应写进设计**

设计给 option 新增 group/value snapshot 表（第 322、433 行），而没有用 JSON 列。
更小替代确实存在：本仓 D-06 裁定「约束闭集由 contract 定义、销售项用 JSON 承载」，
Dexter 也偏好简单数据模型。所以「为什么这里不用 JSON」必须回答。

我认为**规范化在这里是对的**，理由有二，且这两条设计稿只隐含没有明说：

1. option value 要成为人工沽清的 `target_ref`，需要可被引用与校验的行；JSON 内的值无法承载 membership 约束。
2. 它与同模块既有的 `sales_version_item_sku` 是同一形态，不是新发明。

**建议在设计稿中显式写出这段取舍**，否则后续 reviewer 会重复问同一个问题。
这一条不单列 finding。

### 1.3 代价配不配 —— **配，但被 M-1 拖住**

结构改动集中在 option 快照与 manual status 目标扩展两处，SKU 与既有发布冻结、
库存独立、权限边界全部不动。复杂度与阶段匹配。
真正不匹配的是**验证代价**：见 M-1 与 S-2，两个关键负向分支在当前 fixture 上无法构造。

### 1.4 对裁定稿 §4 请求确认的 supersede 的意见

裁定稿 §4 就「普通商品选项当前只读」被本 Journey supersede 一事，请求 Claude/Dexter 确认。

**我支持这个 supersede。** 理由：只读投影使「菜单向顾客暴露哪些选项值」这一事实无处安放，
只能由消费端各自推断，属于 owner 缺位而非有意约束。改为 menu-owned selected subset、
Catalog 保留定义事实，与本仓「谁的规则归谁」的既有边界一致
（`SalesMenuOrderOptionFact` 第 124–132 行的 `selectionMode`/`required`/`min/max` 仍留在 Catalog，
菜单不得改写，设计稿也如此写）。
**最终裁决权仍在 Dexter。**

---

## M-1 SKU 场景的 fixture candidate 断言不成立，命名场景无法构造 · `CONFIRMED`

**位置。** `doc/plans/platform/2026-09-07-...-implementation-design-codex.md` 第 309 行、第 454 行。

**事实。** 第 309 行写：

> SKU：使用当前 Catalog owner readback 的 `BEV-LATTE-001`（V4 fixture 有 3 个 SKU）
> 或 `PASTA-BOLOGNESE-001`（有 2 个 SKU）……该路径已有足够 candidate，不需要修改 Heritage fixture。

回 `contracts/policy/catalog-inventory-fixture-catalog.json` 亲验：

- `BEV-LATTE-001` 命中 **0**；`PASTA-BOLOGNESE-001` 命中 **0**。
- 全 fixture **只有一个带 SKU 的商品**：`LATTE-001`（`SKU_VARIANT_SALE_COUNTED`），
  3 个 SKU 的状态是 `LATTE-SKU-S=ENABLED`、`LATTE-SKU-M=DISABLED`、`LATTE-SKU-L=VOIDED`。
- 即 **ENABLED 只有 1 个**。

第 454 行的验收场景 `sales-menu.sku-subset-selection-and-repeat-item` 要求
「Catalog item with **≥2 enabled SKU** + same product twice」，并「update two SalesItems with **disjoint** `skuPrices`」。
owner 第 2682 行要求 `skuPrices` 非空，两个互斥非空子集至少需要 2 个可选 SKU。

**可复现反例。** 以 `LATTE-001` 构造两个 SalesItem 各选一个 ENABLED SKU 时，
可选 ENABLED 集合的基数为 1，第二个 SalesItem 无 ENABLED SKU 可选，
场景按其字面前置条件不可构造。

**影响面。** SM 交付计划中该 acceptance 场景、对应 L2 SKU 动作与 seed 表达全部落空；
第 309 行「不需要修改 Heritage fixture」的结论亦不成立。

**为什么更小替代不足。** 「把场景改写成 ENABLED+DISABLED 组合」是最小改动，
但它把结论压在 S-1 那个尚未裁决的产品语义上（DISABLED SKU 能否上顾客菜单），
在 Dexter 裁决前不能作为设计前提。

**最小修复建议。** 二选一，并在设计稿中写明选哪个：
(a) 在 Catalog fixture 为 `LATTE-001` 增加第二个 ENABLED SKU（或新增一个双 ENABLED SKU 商品）；
(b) 若采纳 S-1 中「DISABLED 不可上菜单」的收紧，则必须走 (a)。
无论哪种，第 309 行的 candidate 名称与「不需改 fixture」的断言都要更正。

**是否需 Dexter 裁决。** 修法本身不需要；但与 S-1 耦合，S-1 需要。

---

## S-1 DISABLED SKU 当前可被选入面向顾客的销售菜单 · `CONFIRMED` · `DEXTER_DECISION`

**位置。** `CatalogOwnerService.java` 第 191、231 行；
`SalesMenuOwnerService.java` 第 2695–2697 行。

**事实。** Catalog 侧投影 SKU candidate 的谓词是 `catalog_sku.status <> 'VOIDED'`
（第 191、231 行），即 **DISABLED 会作为 candidate 返回**。
SalesMenu owner 侧只拒绝 `standardSalePrice == null` 或 `"VOIDED".equals(status)`（第 2695 行），
**没有拒绝 DISABLED**。

**推论。** 一个 DISABLED SKU 目前可以被写入草稿、随发布冻结进入 published 快照、
最终出现在顾客可见菜单上。

**为什么现在才要紧。** 本批之前没有真实的 SKU 选择控件，这条路径是潜在的；
本设计要新增「勾选要暴露的 SKU」的显式用户动作，选择表**将会把 DISABLED SKU 列给运营人员勾**。
一个在 Catalog 中被停用的规格出现在点单菜单上，是否符合业务语义，
不是实现细节，是产品裁决。

**影响面。** 选择表候选集语义、owner 校验、验收负向用例，以及 M-1 的可构造性。

**最小修复建议。** 若 Dexter 裁定「DISABLED 不可上菜单」：
在 owner 校验（第 2695 行同处）与选择表候选集两侧同时加过滤，
**两侧都要**，不能只改 UI——只改 UI 会留下可被直接调用 API 绕过的缺口。
若 Dexter 裁定「可以上，但要显式提示」，则设计需补该提示的形态与文案。

**是否需 Dexter 裁决。** **是。**

---

## S-2 fixture 中不存在 required 选项组，「required 空集合必须拒绝」分支无法构造 · `CONFIRMED`

**位置。** `contracts/policy/catalog-inventory-fixture-catalog.json`
`catalogDefinitionSeed.itemAssignments[*].orderOptions[*]`；
设计稿第 261 行。

**事实。** fixture 中三个 item-option assignment 的约束分别是：

| 组 | selectionMode | 值个数 | required | min | max |
| --- | --- | --- | --- | --- | --- |
| `CAESAR_DRESSING` | SINGLE | 2 | **false** | null | null |
| `CAESAR_TOPPINGS` | MULTIPLE | 3 | **false** | 0 | 2 |
| `MILK_SWAP` | SINGLE | 2 | **false** | null | null |

**三个 assignment 全部 `required=false`，全 fixture 没有必选组。**

设计稿第 261 行的负向场景 `sales-menu.selection-negative-boundaries`
明确包含「required 零值」。该分支在当前 fixture 上没有可构造的输入。

**同时也影响裁定稿 §4 的未决项。** 「optional 组可零暴露」这条待裁决规则，
在当前 fixture 上覆盖 100% 的可测面，而其对偶（required 组至少保留一个值）
**一条都测不到**。裁决完成后仍会留下一个完全未验证的分支。

**顺带确认一条设计做对的地方。** 裁定稿 §3.3 的禁推
「`MULTIPLE max=2` 可以暴露 3 个候选值，但顾客一次最多选 2 个」，
在 `CAESAR_TOPPINGS`（MULTIPLE、3 值、max=2）上**恰好有活样本**，
这条语义区分是可测的。option 子集选择本身也可测（3 值组可暴露真子集）。

**影响面。** 负向验收完整性；裁定稿未决项裁决后的可验证性。

**为什么更小替代不足。** 「把 required 分支只做单元测试」不足以覆盖
owner→edge→前端的完整拒绝路径，而这正是该分支的价值所在。

**最小修复建议。** 在 fixture 的 item assignment 中把一个组
（建议 `CAESAR_DRESSING`，SINGLE 2 值，语义上最像必选）改为 `required=true, minSelectionCount=1`，
使 required/optional 两侧都有样本。改动落在 fixture，不触生产语义。

**是否需 Dexter 裁决。** 否；但与裁定稿 §4「optional 零暴露」的裁决结果一并落地更省事。

---

## S-3 交互设计未枚举测试控件，违反本轮路由命中的 memory 断言 · `CONFIRMED`

**位置。** `doc/plans/platform/2026-09-07-...-interaction-design-codex.md`；
`project-memory/operations/ui-testid-preflight-before-l2.md` 第 11 行。

**事实。** 该 memory 的 assertions 明确包含
`UI_INTERACTION_DESIGN_MUST_ENUMERATE_TEST_CONTROLS` 与
`IMPLEMENTATION_DESIGN_MUST_RECORD_UI_PREFLIGHT`，
并要求 testId「必须标在真实动作节点，不得以外层 wrapper 或宽 locator 替代」。

而该交互设计全文提及 testId 仅 5 次，**没有给出新增控件的 testId 清单**；
我按 `SALES_MENU_[A-Z_]+` 与 `salesMenuTestIds.<key>` 两种命名法扫描，
唯一命中是 `SALES_MENU_MANUAL_TARGET_INVALID`——那是错误码，不是控件。

本批新增的 UI 面至少包括：SKU 选择表（含勾选与逐 SKU 价格输入）、
选项组/选项值选择表、目标级状态 Modal 的目标定位控件。这些控件的 testId
一个都没有在设计阶段定下来。

**影响面。** 按同一 memory，L2 spec / locator binding / blueprint 控件声明
在 UI 预检完成前处于阻断态；控件分母将只能在实施期临时确定，
这正是本仓此前反复出现「控件分母遗漏」的来源。

**为什么更小替代不足。** 「实施时再补」正是该 memory 要禁止的顺序。

**最小修复建议。** 在交互设计中补一张新增控件表：控件键、testId、
所在真实动作节点、以及是否 `COMPOSITE_OPTION_ANCHOR`。

**是否需 Dexter 裁决。** 否。

---

## N-1 `target_ref` 多态化会丢失现有外键完整性，设计应显式声明补偿边界 · `CONFIRMED`

**位置。** `V20260901_000000_000__sales_menu_owner.sql` 第 248–250 行；设计稿第 433 行。

**事实。** 现表有 `CONSTRAINT fk_sales_manual_status_item FOREIGN KEY (sales_item_ref)
REFERENCES sales_menu.sales_item(sales_item_ref) ON DELETE RESTRICT`。
扩展为 `(salesItemRef, channelRef, targetKind, targetRef)` 后，
`target_ref` 需同时指向 SKU 快照行与 option value 快照行，**无法再用单一外键**。
设计以「published child trigger」（第 433 行）补偿。

**推论。** 触发器与外键的保证强度不同：外键在任何 DML 路径上都成立且带 `ON DELETE RESTRICT` 语义，
触发器需要自己覆盖 INSERT/UPDATE/DELETE 与批量路径。设计目前只写了会有触发器，
没有写它保证什么、不保证什么。

**影响面。** 数据完整性论证的可评审性；实施期容易只做 INSERT 校验而漏 UPDATE。

**最小修复建议。** 在设计中写明：ITEM 行的 `target_ref` 取值约定
（第 433 行已暗示为 `sales_item_ref`，应明写）、触发器覆盖哪些 DML、
以及 published 快照行删除时子目标行的处置，对齐原 `ON DELETE RESTRICT` 的强度。

**是否需 Dexter 裁决。** 否。

---

## 2. UI 合理性

- **动作是否来自批准用户任务：是。** 裁定稿 §1 的 actor、此刻任务与成功结果，
  与「在已加入菜单的商品上决定暴露哪些 SKU/选项值」「发布后单独沽清某目标」直接对应，
  不是从接口或表结构反推。
- **是否有更短路径：** 目标级沽清入口复用已发布销售项的既有状态入口，未新开页面，
  路径是短的。SKU/选项选择放在既有 `SalesMenuItemEditorDrawer` 内，也未新增层级。
- **foundation 复用：合格且有改进。** 交互设计第 19 行声明复用
  `adminWideDrawerSurfaceProps`、`useDrawerFormLifecycle`、`useSubmissionLifecycle`、
  `useDirtyFormLock`、`testId`。我按多行 export 解析核过
  `libraries/frontend/admin-ui-foundation/src/index.ts`（共 117 个导出符号），
  **五个全部真实存在**。其中 `useSubmissionLifecycle` 与 `useDirtyFormLock`
  在当前销售菜单 feature 中命中文件数均为 **0**，即本设计是**新增**复用，
  方向符合 `CLAUDE.md` 的 foundation 优先要求。
- **testId 落在真实动作节点：无法判定。** 见 S-3，设计未枚举。
- **loading/失败/焦点/无障碍：** 交互设计第 177 行声明 Drawer/Modal 使用 foundation overlay lock、
  关闭后焦点回到原 action node、未保存变更触发 dirty guard。形态正确；
  具体控件级验证需待 S-3 补齐后才能对账。

---

## 3. 动态证据边界

**当前静态可证明的事实**（本报告全部结论所依据）：owner 源码行为、迁移表结构、
Catalog fixture 内容、foundation 导出、项目记忆断言。

**尚未执行、本轮不可主张的事实**：backend acceptance、browser L2、DEV、reset/reseed、UAT。
设计稿第 11 行自己也标了 `NOT_AUTHORIZED`，姿态正确。
请特别注意：**本设计的多处结论最终依赖 reset/reseed 后的 fixture 物化**
（第 433 行明确「最终按 reset/reseed 重新物化」），
而 M-1、S-2 指出的两处 fixture 缺口会在那一步才显形。**先改 fixture，再谈动态。**

**需要 Dexter 裁决的产品语义**：S-1（DISABLED SKU 能否上菜单）；
裁定稿 §4 的三项未决（optional 组零暴露、`TARGET_DETACHED_BY_PUBLICATION` 审计事件、
未来混合 shape）；以及 §4 请求确认的 specification-display amendment supersede（我在 1.4 表态支持）。

---

## 4. 独立 review 治理检查

- 裁定稿 `STATUS=PROPOSED`、`IMPLEMENTATION_AUTHORITY=false`、`DEXTER_REVIEW=OPEN`，
  §5 声明在两项未决形成结论前不升级为 implementation-facing approved design。**姿态正确。**
- 请求方明确声明本 Claude review **不替代** 本 cycle 必须单独完成的
  fresh `INDEPENDENT_SUBAGENT` 盲审，也未声称该轮已完成。**符合治理要求。**
  按 `CLAUDE.md`，该盲审必须由 fresh 独立子 agent 以「找出它为什么不成立」的立场进行，
  且不得由作者会话自审替代；本报告不构成那一轮。
- 请求要求建立 SHA-256 输入台账 —— 该控制已退役，见第 0 节。

---

## 5. 判定

**NO-GO，M=1 / S=3 / N=1。**

设计的方向是对的，问题识别准确，SKU 半边被正确收窄为 UI 缺口而没有制造多余的 owner 工作，
foundation 复用不降反升，owner 归属（Catalog 拥有约束定义、菜单拥有暴露集合）划得清楚。
**这是一份质量不错的设计草案。**

阻断在于**验证面与真实 fixture 对不上**：

- M-1：SKU 场景引用了两个 v2s 不存在的商品码，并断言「不需要修改 fixture」，
  而实际可选 ENABLED SKU 只有 1 个，命名验收场景按其前置条件不可构造。
- S-2：全 fixture 无 required 选项组，负向分支同样不可构造。

这两条都落在 fixture 层，修起来不难，但**必须在实施前改**，
否则会在 reset/reseed 之后才暴露，重复本仓此前「动态运行当发现手段」的老路。

S-1 需要 Dexter 先裁：DISABLED 规格能否出现在顾客菜单上。该裁决同时决定 M-1 的修法。

S-3 要求交互设计补齐新增控件的 testId 清单，这是路由命中的 memory 断言的硬性顺序要求。

**本判定只表示当前草案尚不具备进入实施阶段的条件，不否定设计方向。**
上述四项处置完毕后，本设计可以再评。
