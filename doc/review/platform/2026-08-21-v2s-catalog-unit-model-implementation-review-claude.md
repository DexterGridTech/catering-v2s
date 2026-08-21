# R5 · 商品计量/销售单位/库存单位优化 —— implementation review(Claude 独立复核)

- 日期:2026-08-21 · 作者:Claude · 被审对象:当前生产源码 + 本轮 evidence
- 会话出处:**fresh v2s-rooted 评审会话**,非续接、非它仓。全部结论由本会话重开源码与新鲜运行输出亲验。
- 本轮未采信任何设计结论、自报数字或既往 verdict;DESIGN 轮的 `GO_WITH_UNVERIFIED_UI` 不作为本轮输入。

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取(提取 495 条渲染事实,非空)
VERDICT=NO-GO
M/S/N=3 / 5 / 5
```

---

## 0 · 方案合理性(先于闭环正确)

**问题对不对 —— 是。** 销售单位被做成多选数组、库存消费单位靠 `measureMode` 伪装、历史流水按当前定义重解释,
这三件都是真问题。选择「写入时快照 + 库存不持 catalog 外键」是对的形状:它让历史行自带单位,
不依赖之后的定义,从根上消掉重解释。这一点本轮亲验属实(见 §2 做对的部分)。

**方案优不优 —— 主体成立,但有一处该由我构造的替代未被比较。**
作者未列替代方案。我构造两个:
- **替代 A:不建单位库,商品上存自由单位串 + 一个精度整数。** 这正是旧模型,`0.3567kg→356g` 无法表达
  (没有维度就没有换算),且改名会重写历史。**淘汰正确。**
- **替代 B:建单位库但不给每个单位 `precision`,全局一个小数位。** 这会让「g 只能整数、kg 允许三位」
  无法共存,而这恰是 Dexter 的裁定。**每单位一个 int 列的代价极小,收益是裁定得以成立。做对了。**
- **一处复杂度略超需要**:`catalog_sku` 同时存 override ref(2)与 effective 快照(10),共 12 列。
  effective 可由 item + override 推导。但「写入时快照」正是本设计的立论,推导会把重解释放回来。**接受。**

**代价配不配 —— 主体配,但两处不配:**
本批把两个**明确挂起等 Dexter 裁定**的语义,用代码替 Dexter 做了决定(M-1、M-2)。
这不是复杂度问题,是**把"等一句话"变成了"已经跑错的行为"** —— 代价从零变成了返工。

---

## 1 · L1 工程不变量

### M-1 · 源数量输入框写死 `precision={3}`,跨过 `U-UNIT-DESIGN-02` 停机条件,并使 Dexter 的样例算错

- **位置**:`apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryActionModal.tsx` 第 486 行
  (`name="quantity"`,testId `inventory-action-quantity`)
- **仓内事实**:详设第 253 行停机条件 2 写明「源数量精度语义未裁:不实现…固定数量输入控件的精度限制」;
  第 248 行 `U-UNIT-DESIGN-02` 处置写明「不固定 InputNumber 小数位上限,不把 target precision 当源输入精度」。
- **行为事实(本会话实跑,非推断)**:该控件由 `@rc-component/input-number@1.6.2` 实现,取值经
  `@rc-component/mini-decimal` 的 `toFixed`。实跑结果:
  `toFixed('0.3567','.',3) = 0.357`、`toFixed('0.3564','.',3) = 0.356` —— **四舍五入,不是截断**。
- **失败场景(即 Dexter 的原样例)**:用户在 kg 输入 `0.3567`,盘点单位 kg,换算 1000,消耗单位 g `precision=0`。
  控件先把输入规整为 `0.357` → 后端 `0.357 × 1000 = 357.000` →
  `InventoryOwnerService.java:551` `setScale(0, RoundingMode.DOWN)` = **357**。
  IA 第 180 行要求 **356**,并把 357 逐字点名为失败值:「任何357…均失败」。
- **同时触犯**:IA 第 184 行 `forbiddenUI`「禁止四舍五入、输入与计算两套规则」——
  现状恰是前端四舍五入、后端向零截断,**两套规则**。
- **区分**:以上全为事实(源码行 + 库实跑)。推论只有一处:用户实际键入 `0.3567` 后控件在 blur 规整——
  这是该库的既定行为,未在浏览器复现(本批不授权 L2),标 `[静态+库实跑]`。
- **适用边界**:仅当消耗单位 precision 低于输入位数时可见。precision≥3 时不显现。
- **反例(会推翻本条的证据)**:若该控件被包裹层改写了 `parser`/`formatter` 使其截断而非进位。
  本会话已查:第 484–490 行无 `parser`/`formatter`/`stringMode`,不存在此反例。
- **最小修复**:移除第 486 行 `precision={3}`(BOM 用量已经是这么做的,见同族扫描),
  在 `U-UNIT-DESIGN-02` 裁定前不设客户端小数位上限。
- **需要 Dexter 裁决?** 修复本身不需要(回到"不实现"即可)。
  但 `U-UNIT-DESIGN-02` 本体仍是 `DEXTER_DECISION`。

**SAME_ROOT_SCAN(数量类输入全集 = 3)**
| # | 位置 | 现状 | 判定 |
|---|---|---|---|
| 1 | `InventoryActionModal.tsx:486` 数量 | `precision={3}` | ❌ 违规 |
| 2 | `InventoryActionModal.tsx:599` 低库存阈值 | `precision={3}` | ❌ 同根:阈值也以消耗单位计,g precision=0 时可存 0.5 |
| 3 | `CatalogItemDrawer.tsx:3960` 区 BOM 每份消耗 | 纯 `<Input>`,无上限 | ✅ 合规 |

⚠️ 三者是同一类字段却有两种写法 —— **同一件事两种写法**本身即 `frontend-coding-standard` §3-A 所指。
非数量类的 8 处 `precision=`(货币 ×4、单位精度字段 ×2、换算因子 ×1、计数 ×2)已逐个核对,不在本条范围。

---

### M-2 · `U-UNIT-DESIGN-01` 过渡守卫全仓不存在,改基础计量单位在两个 owner 之间静默分叉

- **设计要求(三份文档一致)**:IA 第 85–86 行、交互工件第 181/196 行 ——
  已关联非零余额 `StockTarget` 时基础计量单位**固定只读**,显示
  「商品已有库存余额,暂不能修改基础计量单位」,不提供变更/清除/重选入口,**owner 仍拒绝绕过请求**;
  详设第 247 行:「没有此决定,**不实现该变更路径**」。
- **仓内事实(逐层亲验,全为 0 命中)**:
  - 文案「商品已有库存余额」:全仓 **0**
  - typed problem `BASE_MEASURE_UNIT_LOCKED` / `BASE_UNIT_IN_USE` / `UNIT_CHANGE`:全仓 **0**
  - `CatalogOwnerService` 中任何基于余额的守卫:**0**
  - UI 第 2347 行该字段只有 `disabled={denied('baseMeasureUnitRef')}` ——
    那是治理/上游锁定机制,**与库存余额无关**
- **实际行为(读写路径已打开亲验,非从字段名推断)**:
  1. catalog 侧 `writeItemUnitSnapshots` 是**无条件** `UPDATE catalog.catalog_item SET base_measure_unit_*`;
  2. coordinator 每次保存都把**新**基础单位作为 `consumptionUnitSnapshot` 送给 inventory 的 ensure;
  3. inventory ensure 对**已存在** target 走早返回分支
     (`InventoryOwnerService.java:1812–1859`):该分支读的是
     `consumptionUnitSnapshot(existing.ref())` 即**旧**快照,`UPDATE` 只写
     `configuration` 与 `counting_unit_*`,**从不写 `consumption_unit_*`**;送进来的新快照在此分支被丢弃;
  4. 新建分支的 INSERT 带 `ON CONFLICT … DO NOTHING`,对既有 target 同样无效。
- **失败场景**:某原料基础计量单位由 g 改为 kg,该商品已有余额 1200 的 StockTarget。
  保存成功、无任何报错。此后:商品详情显示基础计量单位 = kg;库存对象与全部流水仍以 g 记账并继续以 g 扣减;
  余额数字不变。**两个后台屏幕对同一事实给出互相矛盾的单位,且没有任何一处告诉用户发生了什么。**
- **区分**:1–4 为事实(源码行);"用户会因此读错库存"为**推论**(合理但未经 UAT 观察)。
- **适用边界**:仅在 target 已存在时。首次保存(尚无 target)走 INSERT 分支,快照正确,无此问题。
- **反例**:若上游存在一道我未找到的守卫拒绝该保存。已按 owner→coordinator→inventory 三层穷举,未发现;
  若作者能指出一处,本条应降级。标 `CONFIRMED`,但欢迎以该路径反驳。
- **最小修复**:在 `U-UNIT-DESIGN-01` 裁定前,**关闭该变更路径** ——
  catalog 保存时若 item/SKU 已有 target 且新基础单位 ≠ target 现消耗单位,返回 typed problem 拒绝。
  ⛔ 不要改成"静默同步 target 快照",那会重解释既有余额,是详设第 247 行同一句话禁止的另一半。
- **需要 Dexter 裁决?** **修复不需要**(拒绝 = 详设已写的"不实现")。`U-UNIT-DESIGN-01` 本体仍是 `DEXTER_DECISION`。

**SAME_ROOT_SCAN**:同类"跨 owner 快照在上游变更后不同步"的字段全集 = 3 ——
`consumption_unit_*`(❌ 本条)、`counting_unit_*`(✅ 由 target 自身命令维护,不受 catalog 影响)、
`catalog_order_option_definition_material.consumption_unit_*`(✅ 每次保存整段重写,见 coordinator 第 1012 行)。**其余 2 个已核对,无同类缺陷。**

---

### M-3 · 交付所附 evidence 不支持"本轮已验证",且当前仓库静态门是红的

三件独立事实,任一单独成立即足以否定"静态 PASS / fresh evidence"的表述:

**(a) 无任何一次全量 acceptance 跑在本批代码上。**
按 mtime 对账(同一时钟):

| 时间 | 对象 |
|---|---|
| 08-20 21:57 | 最后一次**全量** run(`r5-tc-1787230542611-7994`,discovered=72 selected=72) |
| 08-21 16:16 → 18:41 | **本批全部代码**(migration → 契约 → 两个 owner → coordinator → 验收 → seed) |
| 08-21 19:15 | 交付所引 run(`r5-tc-1787307256719-56640`)—— **discovered=74, selected=1** |

74 条全量 run:**不存在**(已枚举全部 124 次 run 确认)。
⇒ 本批改了两个 owner、coordinator、迁移与契约,而**既有 72 条场景从未在改后代码上执行过**。
交付所引 run 只跑了 `catalog.unit-list-boolean-query-and-status-filter` 一条。

**(b) 静态测试 5 个文件为红(本会话 fresh 跑,精确分母 20 个已登记文件)。**

| 文件 | mtime | 归因 |
|---|---|---|
| `scripts/test/catalog-p3-model-migration.test.mjs` | 08-18(本批未动) | **CONFIRMED 本批打红**:它断言 `KINDS = List.of(PRODUCTION_TAG, CATALOG_TAG, SALES_UNIT)`,而本批 08-21 15:07 把 `CatalogItemReferenceFacts.java:22` 改成了 `List.of(PRODUCTION_TAG, CATALOG_TAG)` |
| `scripts/test/frontend-idempotency-boundary.test.mjs` | 08-17(本批未动) | PARTIALLY_CONFIRMED:失败项为「inventory quantity changes keep one retry key while configuration uses content」,正是本批改动面;未逐行追断言 |
| `scripts/test/catalog-inventory-query-envelope.test.mjs` | 08-21 10:53(本批已动) | 本批留红 |
| `scripts/test/frontend-transport-cache-lifecycle.test.mjs` | 08-21 10:25(本批已动) | 本批留红 |
| `scripts/test/catalog-inventory-definition-seed.test.mjs` | 08-21 11:03(本批已动) | 本批留红:第 27 行仍断言 `caesar.salesUnitCodes === ['SERVING']`,该字段已随本批退休 → `actual: undefined` |

**(c) `scripts/verify` 的 node-tests 门当前 exit=1。**
本会话直接跑 `node scripts/test/test-health-entry-runner.mjs --node`:
`THCL_NODE_TEST_ENTRY_DENOMINATOR_MISMATCH:missing=scripts/test/catalog-inventory-definition-seed.test.mjs`。
成因:该文件在磁盘上(13 个),但不在 runner 第 15–35 行硬编码的 12 个分母里 ——
**门因此连跑都没跑到就退出**,而它内部还是红的。
⚠️ 详设第 140 行**明确列出**要更新 `catalog-inventory-definition-seed.test.mjs`。未做。

- **区分**:(a)(b)(c) 全为事实(mtime、退出码、断言输出)。"作者未跑"是**推论** ——
  也可能跑了但未把红当红;两种情形结论相同。
- **最小修复**:三条红测试改到与新事实一致(不是删断言,是改成断言新语义);
  把 `catalog-inventory-definition-seed.test.mjs` 加进 runner 分母;
  然后跑一次 **74/74 全量** acceptance 并留证。
- **需要 Dexter 裁决?** 否。

---

## 2 · 做对的部分(逐项亲验,非采信自报)

这些我逐个打开了源码,确认是**行为**而非声称:

| 项 | 亲验结论 |
|---|---|
| 迁移形态 | 快照列齐;`inventory` 无指向 `catalog` 的外键;`measure_mode` 的模式语义拆成 `inventory_mode`;`catalog_item_reference` 的 `SALES_UNIT` 连 CHECK 约束一起收窄 ✅ |
| **生命周期跨 owner 强制** | `CatalogOwnerService.java:246/271/283` 三个写命令均 `@Transactional`,且**在同一事务内**调 `inventory.validateCatalogUnitLifecycle`;后者(`InventoryOwnerService.java:377+`)取 advisory lock、对 target 行 `FOR UPDATE`、统计台账与 BOM JSONB 引用,`UPDATE_DEFINITION`/`DELETE` 在被引用时抛 `CATALOG_UNIT_IN_USE` 409,`RENAME`/`DISABLE` 放行。**事务边界与 owner 归属都正确。** ✅ |
| 双重守卫 | catalog 侧 `CatalogUnitDefinitionFacts.update` 另有 `isReferenced` 拒绝 —— 两侧都拒,不是只靠一侧 ✅ |
| **集合形态是真不变量** | 读侧 `ORDER BY name,code,unit_ref LIMIT 100` + `rows.size()==100` 抛 typed problem(**不静默截断**);写侧 `create` 在 advisory lock 内 count-and-insert 拒绝越界。上界来源 = `MAX_UNITS=99` 常量,不是当前行数。符合 charter §1-J 三项义务 ✅ |
| 向零截断本体 | `InventoryOwnerService.java:551` `setScale(precision, RoundingMode.DOWN)`,与 Dexter 裁定一致 ✅(**但无人测,且被 M-1 在前端抵消**) |
| SKU 覆盖清除后继承 | 第 3399–3410 行 `effectiveBase = baseOverride == null ? itemBase : baseOverride`,清除 override 即回落 item 默认 ✅ |
| copy rewrite | closure 图含 `CATALOG_UNIT` 边,并从 `material.consumptionUnitSnapshot()` 收集单位一并重映射 ✅ |
| **退休核验(话术点名四项)** | `salesUnitRefs`:运行链 0(仅存于历史 migration 与 generator 的 `delete` 补丁,属既定写法);`SALES_UNIT` item reference:`KINDS` 已摘除、CHECK 已收窄;自由单位串/JSON fallback:未见;`measureMode` 当消费单位:**已退出**(`consumptionUnit = row.measureMode()` 不复存在,`measureMode` 仅余商品形态语义)✅ |
| **未误伤三项** | `MULTI_VALUE_FIELDS = new Set(['tagRefs'])` —— 标签多选保住、`salesUnitRefs` 正确移除;`skuVariantDimensions` 19 处、`attributeAssignments` 22 处、`orderOptionConfigs` 22 处、`selectionMode` 25 处均在 ✅ |
| seed 已迁到单值 | `catalog-inventory-seed-executor.mjs` 第 319/375/398 行已写 `salesUnitRef`/`baseMeasureUnitOverrideRef` 单值;旧 `salesUnitCodes.map(...)` 已不存在。seed-report 显示 28 次建单位、8 次列单位、2 次改名、2 次停用,`business=PASS` ✅ |

---

## 3 · L2 用户可见事实对账(动作 1-A 提取 495 条 → 动作 2 逐条对账)

### S-1 · 本批的核心业务规则零测试覆盖

IA 第 180 行把它写成了一条 `[backend-acceptance]` 观察:「0.3567kg 转为目标 g precision=0 时,
target/ledger readback 数值为 356 且单位快照仍为 g」。

本会话穷举:`0.3567`、`356`、`truncateTowardZero`、`RoundingMode.DOWN` 在
**全部后端测试树(modules/*/src/test + src/test)命中 0**;acceptance 中唯一触到换算的场景
(`inventory.current-readback-separates-lazy-zones`,第 1527–1560 行)用 `conversionFactor:"1"`,
断言的是 lazy-zone 契约,**与截断无关**。前端亦无对应 focused 测试。

⇒ **本批立论的那条规则,由任何档位的任何测试验证过 0 次。** 而 M-1 证明它当前是错的。
- **最小修复**:补一条 acceptance,断言 356 且单位快照为 g(IA 已把判据写好,照抄即可)。
- **需要 Dexter 裁决?** 否。

### S-2 · 商品详情读路径引入 N+1,对已在内存的同一行重复查库

- **位置**:`InventoryOwnerService.java:1535` 与 `:1592`(`readCatalogInventoryDefinition`)
- **事实**:`loadTargetsByItemRef`(第 3720 行区)已 `SELECT … FROM inventory.stock_target`,
  但 `TargetRow`(第 4469 行)不含 5 个 `consumption_unit_*` 列;于是循环体内对**每一行**再调
  `consumptionUnitSnapshot(row.ref())`,而它是
  `SELECT consumption_unit_* FROM inventory.stock_target WHERE target_ref=?` ——
  **同一张表、同一行、刚读过。**
- **失败场景**:一个 10 SKU 的商品,打开详情多发 10 条 SQL;第 1592 行的组件循环再叠加一轮。
- **判据出处**:`project-memory` 已登记的读管线成本裁定 ——「每次读 7-10 条 SQL 才是真问题」。
  本条正落在被裁定过的那条读路径上。
- **最小修复**:把 5 个列加进 `loadTargetsByItemRef` 的 SELECT 与 `TargetRow`,循环内直接用。**零额外查询成本。**
- **同族全集**:`consumptionUnitSnapshot` 共 14 处调用,其中**循环内** 2 处(1535、1592)= 本条;
  其余 12 处为单行路径,**已逐个核对,不构成 N+1**。

### S-3 · IA 声明的用户可见文案 5/5 不存在,owner 实际返回另一套中文

| IA 声明(逐字) | 代码现状 |
|---|---|
| 「计量单位数量超过可维护范围,请先整理单位库」(IA 50) | 0 命中;owner 实际返回「单位库最多99条,请先整理后再查看」 |
| 「该单位已被使用;如需改变此项,请新建计量单位后在后续配置中选择」(IA 68) | 0 命中;owner 实际返回「已引用单位只能更新名称或停用,不能修改编码、类别或精度」 |
| `precision=0` 显示「只能填写整数」(IA 67) | **0 命中** —— 这是 Dexter 亲自裁定的语义,其用户可见表达缺失 |
| 列表「正在使用」列(IA 49) | **0 命中**,见 S-4 |
| 「商品已有库存余额,暂不能修改基础计量单位」(IA 86) | 0 命中,见 M-2 |

判据住址:交互工件 `USER_VISIBLE_COPY` 与本批 IA(评审规范动作 2)。**不一致即 finding。**
- **最小修复**:两条 owner 文案改成 IA 逐字文案(或反过来改 IA,二选一但必须一致);
  补 `precision=0` 的整数提示。
- **需要 Dexter 裁决?** 若他更偏好 owner 现有措辞,则改 IA —— 这属产品文案,标 `DEXTER_DECISION`(轻)。

### S-4 · 单位库列表缺「正在使用」列,用户看不到引用状态却被给了停用/删除

- **IA 第 49 行**:列 = 名称、编码、单位类别、小数位数、状态、**正在使用**;且「首列"名称"**可点进详情**」。
- **代码**(`CatalogDictionaryDrawer.tsx` 列定义区):名称、编码、维度、精度、状态、操作 ——
  **无「正在使用」列**;首列 `{title:'名称', dataIndex:'name'}` **无 render/无链接/无 onClick**;
  IA 要求的 `unit-library-list`、`unit-library-open-{unitRef}` testId **均为 0**。
- **失败场景**:用户点「删除」→ 后端 409 `CATALOG_UNIT_IN_USE`。IA 之所以要这列,
  就是让用户**在点之前**知道。现状把可预知的拒绝推迟到提交后。
- **适用边界**:单位行的全部事实(名称/编码/维度/精度/状态)确实已在行内,
  ⇒「可点进详情」在**没有详情页可去**时不成立。**这一半我判为 IA 侧应澄清,不算实施缺陷**;
  但「正在使用」列是纯缺失,算。
- **最小修复**:列表增加引用状态列(owner 已有 `isReferenced`,数据现成)。
- **需要 Dexter 裁决?** 「单位是否需要详情页」→ `DEXTER_DECISION`(产品语义)。

### S-5 · 零引用单位的编码/类别/精度在界面上不可编辑,与 IA 及 owner 能力都不符

- **IA 第 67 行**:「新建/**零引用**:名称、编码、单位类别、小数位数**均可编辑**;已引用:仅名称可编辑」。
- **代码**:行内动作只有「编辑名称」(`openNameEdit`)/「停用」/「删除」,**无论是否被引用**。
- **owner 侧**:`CatalogUnitDefinitionFacts.update` **支持**改 code/dimension/precision,仅在
  `isReferenced` 时才拒。⇒ 后端有能力、IA 有要求、**前端没给入口**。
- **失败场景**:新建单位时把精度填错(如 g 填了 2),该单位尚未被任何商品引用,
  用户**无法改正**,只能删掉重建。
- **最小修复**:`openNameEdit` 在零引用时开放三个字段(owner 已会拒绝被引用的情形,前端不需自己判)。
- **需要 Dexter 裁决?** 否。

---

## 4 · N(记录,不阻断)

| # | 事实 | 位置 |
|---|---|---|
| N-1 | `configurationReadback(JsonNode, String measureMode)` 的 `measureMode` **形参声明后从未使用**,3 处调用仍在传 —— 退休机制的残骸,且落在本批声称已退休的那个机制上 | `InventoryOwnerService.java:715` |
| N-2 | `ledgerCount` 与 `bomCount` 两条 count 查询**无 scope 过滤**,而紧邻的 target 查询是 scoped 的。因 `unitRef` 是全局唯一 UUID,当前**不可利用**;记为一致性问题 | 同上 `:389`、`:391` |
| N-3 | 换算因子 UI `precision={6}`,而 DB 为 `NUMERIC(24,12)` —— 需要 6 位以上因子(如 1/3)时被静默进位 | `InventoryActionModal.tsx:627` |
| N-4 | testId 命名整体偏离 IA:IA 写 `item-base-unit`,实际 `catalog-item-base-measure-unit`;IA 写 `sku-unit-row-{skuRef}`,实际按 **index** 而非 skuRef 命名(`catalog-item-sku-base-measure-unit-override-{skuIndex}`)。索引键在排序变化时不稳定 | 多处 |
| N-5 | `list` 的 `rows.size()==100` 分支在 `MAX_UNITS=99` 下**不可达**(写侧已拦在 99)。属纵深防御,无害,记录以免后人误读为活路径 | `CatalogUnitDefinitionFacts.java:30` |

---

## 5 · L3 未验证清单(本轮无人验证的用户可见事实)

按证据档位诚实分账,**不升档**:

**静态已证**:表格列与首列形态 · 表单字段与校验提示 · 文案存在性 · testId 存在性 ·
所有 SQL 与事务注解 · 退休核验 · 集合上界的读写两侧实现。

**测试已证**:仅 `catalog.unit-list-boolean-query-and-status-filter` 一条(建单位 → 列出 → 停用 → 从候选消失),
**且该条是本批唯一在改后代码上执行过的场景**。

**无人验证(本轮任何档位都没验过)**:
1. `0.3567kg → 356g` 的端到端结果 —— 且据 M-1,当前实际会得到 357
2. 改基础计量单位对既有 StockTarget 的后果 —— 据 M-2,当前静默分叉
3. 既有 72 条 acceptance 场景在本批代码上的通过与否(**从未执行**)
4. 九屏界面的任何**渲染与交互**:单位库六 Tab 切换、候选下拉、SKU 继承/覆盖两态、
   盘点换算显示、截断反馈(该反馈的 testId 本就不存在)
5. `containerBehaviorUnderLoad` 全部条款(99 条单位时抽屉滚动、长单位名截断、1280px 无横向滚动)
6. 空态/加载态/读取失败保留旧值 —— IA 有声明,本轮未验
7. 键盘可达性与「状态不只靠颜色」

⚠️ 第 3 条尤其要说清:这不是"没来得及验",是**分母从 72 降到 1**。

---

## 6 · DESIGN_GAPS(正本里缺判据,交回设计侧,⛔ 未就地立规则)

1. **「列表首列可点进详情」在没有详情页的实体上如何适用** —— `frontend-coding-standard` §3-I 未写例外。
   单位的全部事实已在行内,强行造详情页是过度设计。**建议在 §3-I 补一句适用条件**,由设计侧决定措辞。
2. **快照类字段在上游变更后的同步义务,无正本** —— 本批出现三处快照(消耗/盘点/选项物料),
   三处各自决定同步与否(M-2 即由此而来),而 charter 未规定"上游改了、下游快照怎么办"的判别式。
   **建议进 `backend-coding-standard`**。

---

## 7 · 收口

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取(495 条渲染事实)
VERDICT=NO-GO
M/S/N=3 / 5 / 5
L1_ENGINEERING=findings — M-1(跨停机条件写死输入精度) · M-2(未决项守卫全缺,跨 owner 静默分叉) · M-3(无全量 run + 5 个红静态测试 + node-tests 门 exit=1)
L2_USER_VISIBLE=findings — S-3(IA 文案 5/5 缺失) · S-4(缺「正在使用」列) · S-5(零引用单位不可改编码/类别/精度)
L3_UNVERIFIED=非空(7 组,见 §5;其中"既有 72 条场景从未在本批代码上执行"为最重一条)
SAME_ROOT_SCAN=M-1 数量输入 3/3 已判(2 违规 1 合规) · M-2 跨 owner 快照 3/3 已判(1 缺陷 2 正常) · S-2 consumptionUnitSnapshot 14/14 已判(2 循环内 12 单行)
DESIGN_GAPS=2(首列可点的适用条件 · 快照上游同步义务)
EVIDENCE_TIER=静态读源码 + 库实跑(mini-decimal toFixed)+ fresh 跑 20 个已登记静态测试 + fresh 跑 node-tests 门。⛔ 未跑 acceptance、未跑 DEV、未开浏览器、未做任何写入(本文件除外)
```

**授权边界**:本文只是独立复核意见。它不授权产品新增语义、不解除
`U-UNIT-DESIGN-01`/`U-UNIT-DESIGN-02` 未决、不授权下一 Roadmap step、
不授权 remediation 之外的实现选择、不授权 Git、reset、seed、DEV 生命周期、browser L2、UAT、部署或数据操作。

**给 Codex 的处置提示**:M-1 与 M-2 的修复方向都是**回到"不实现"**,不是补语义 ——
两条未决项裁定前,正确形态是拒绝/不设限,而不是替 Dexter 选一个。
M-3 是把红改绿并跑一次 74/74。S-1..S-5 与 N-1..N-5 在既有批准边界内自主修即可。
