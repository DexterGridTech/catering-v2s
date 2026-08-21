# R5 · 商品计量/销售单位/库存单位优化 —— implementation review 第二轮(Claude 独立复核)

- 日期:2026-08-22 · 作者:Claude · 被审对象:当前生产源码 + 本轮 fresh evidence
- 会话出处:**续接会话**(与第一轮同一会话)。⚠️ 按亲验纪律声明:本轮不冒充 fresh acceptance;
  下列全部结论由本轮**重新打开源码、重新跑门**得出,未复用上一轮任何测量值。
- 上一轮结论 `NO-GO`(3M/5S/5N)不作为本轮输入,逐条重验。

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取(80 条渲染事实,非空)
VERDICT=NO-GO
M/S/N=1 / 2 / 4
```

---

## 0 · 上一轮 findings 的复验(逐条重开源码,不采信自报)

| 上轮 | 本轮实测 | 判定 |
|---|---|---|
| M-1 源数量输入框写死 `precision={3}` | 已撤。改为 `normalize` 按**源单位实际精度**截断,且前端 `truncateTowardZero` 用 `Math.trunc`(**真截断,非进位**),并新增明示提示「录入单位精度为N位小数;超出精度时向零截断」 | ✅ 闭合,且修法比要求的更好 |
| M-2 `U-UNIT-DESIGN-01` 守卫全缺 | 已实现。`validateCatalogItemBaseMeasureUnitTransition` 取 advisory lock、对 target `FOR UPDATE`、逐 target 比对后抛 `CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED` 409;调用链为公共 `@Transactional` 命令 → `saveItem` → `validateUnitAssignments` → inventory,同事务同线程 | ✅ 闭合 |
| M-3 无全量 run + 5 个红测试 + 门 exit=1 | 本轮 run `discovered=76 selected=76 results=76`,零失败,起于 23:12 而最后一次代码改动 23:09;`node scripts/test/test-health-entry-runner.mjs --node` **exit=0**,21/21 PASS,磁盘与登记分母差集为空 | ✅ 闭合 |
| S-1 截断规则零测试 | 新增 `inventory.count-truncates-converted-quantity-toward-zero`:kg(precision 3)/g(precision 0)/换算 1000,POST `0.3567`,断言 after=356、change=356、balance=356、消耗快照仍为 g,断言消息逐字点名 357 为禁止值 | ✅ 闭合 |
| S-2 读路径 N+1 | `TargetRow` 已带 `consumptionUnitSnapshot`,`TARGET_SELECT_COLUMNS` 已含 5 列;两处循环(第 1597、1654 行)改用内存快照,不再逐行查库 | ✅ 闭合 |
| S-3 IA 文案 5 条缺失 | 4 条已补(超限、只能填写整数、该单位已被使用、正在使用);第 5 条见本轮 S-1 | 🟡 部分 |
| S-4 缺「正在使用」列 | 已补(第 1614 行),`isReferenced` 贯通到 readback | ✅ 闭合 |
| S-5 零引用单位不可改编码/类别/精度 | 已补:第 1644 行按 `isReferenced` 分流「编辑名称」/「编辑单位」,新增 `catalog-unit-edit-dimension-{code}`、`catalog-unit-edit-precision-{code}` | ✅ 闭合 |
| N-1/N-2/N-3 | 三条**均未处理**(见 §3) | ❌ 未动 |

**上一轮三条 M 全部真实闭合,修法我逐个开源码看过,不是改了个名字。**

---

## 1 · 本轮唯一 M —— 修 `U-UNIT-DESIGN-02` 时引入的回归

### M-1 · 未配盘点单位的库存对象,一切数量被静默截成整数;前端还在向用户承诺小数位

- **位置**:`modules/inventory/.../InventoryOwnerService.java` 第 527–528 行(取值)、
  第 580–586 行(缺守卫的 mapper)
- **链路(五环逐个亲验,无一环靠推断)**:
  1. `writeCountingConfiguration` 第 671–675 行在**没有盘点单位**时显式写
     `putNull("countingUnitRef")`、`putNull("countingUnitSnapshot")` ——
     即"无盘点单位"是**设计支持的正常状态**,不是异常;UI 第 640–644 行该 Select 是
     `allowClear` 且 placeholder 写着「可选」,用户可自行清空。
  2. 迁移未给 `counting_unit_*` 任何 `NOT NULL` 或 `DEFAULT`,该行以 NULL 落库。
  3. `countingUnitConfiguration(UUID targetRef, …)` 第 580–586 行的行映射
     **没有任何 null 守卫**,直接 `new UnitSnapshot(getObject(1), getString(2), getString(3), getString(4), getInt(5))`。
     `ResultSet.getInt` 对 SQL NULL 按 JDBC 契约返回 **0**。
  4. `record UnitSnapshot(...)`(`InventoryOwnerApi.java` 第 15 行)**无紧凑构造器、无校验**,
     `new UnitSnapshot(null,null,null,null,0)` 正常构造,`precision()` 为 **0**。
  5. 第 591 行的 `.orElse(consumption)` 只在**查不到行**时兜底;行存在而列为 NULL 时**不生效**。
  ⇒ 第 527 行 `source = counting.countingUnitSnapshot()` 拿到这个 precision=0 的空快照,
  第 528 行 `truncateTowardZero(input, 0)` 把输入截成整数;第 530 行再按消耗精度截一次已无意义。
- **失败场景**:原料「黑松露酱」消耗单位 kg、precision 3、未配盘点单位(默认状态)。
  收货 2.5 kg → 前端 `sourcePrecision` 正确回落到消耗精度 3,保留 2.5,
  并显示「录入单位精度为3位小数」→ 后端存 **2**。报损 0.75 kg → 后端算得 **0**,
  写入一条 delta 为 0 的流水。**用户被明确告知可以填三位小数,系统把小数全部丢弃且不报错。**
- **对比**:上一轮的代码是 `truncateTowardZero(input, consumption.precision())`,这条路径**当时是对的**。
  ⇒ **本条是本轮修复引入的回归**,不是遗留缺陷。
- **前后端不一致**:前端第 207–211 行 `selectedInputUnit?.precision ?? countingUnitSnapshot?.precision ??
  consumptionUnitSnapshot.precision ?? 0` —— **正确地**在无盘点单位时回落到消耗精度;
  后端第 527 行**不回落**。两端对同一个数用两套规则,正是 IA 第 184 行 `forbiddenUI`
  「输入与计算两套规则」所禁止的状态,只是换了个位置重现。
- **影响面(实测,非估计)**:本轮 seed plan 中 `nodeType` 出现 130 次,而
  `countingUnitRef` 有值仅 **10** 处。⇒ **约 120 个已 seed 的库存对象走的正是这条路径。**
  这不是边角情形,是 Dexter 即将在页面上点到的多数对象。
- **为什么 76/76 全绿没抓到**:新增的截断场景**配置了 kg 盘点单位**,
  因此结构上不可能覆盖"无盘点单位"分支。绿是真的,只是分母里没有这一格。
- **事实/推论区分**:五环全部是仓内事实(行号可核)+ JDBC `getInt` 的规范行为;
  「约 120 个对象受影响」是**基于 seed plan 的实测计数**;
  「用户会因此少记库存」是**推论**(未在浏览器或 DEV 复现,本批不授权)。
- **适用边界**:仅当 target 未配盘点单位**且**其消耗单位 precision > 0。
  消耗单位 precision=0(如"个""份")时结果恰好相同,不显现。
- **反例(会推翻本条)**:若某处在建 target 时强制把 `counting_unit_*` 写成消耗单位快照而非 NULL。
  已查 `writeCountingConfiguration` 与 ensure 的 INSERT 两处,均显式写 NULL;若作者能指出第三处写入点,本条应重估。
- **最小修复**:第 527 行改为在盘点单位快照不完整时回落到消耗单位快照 ——
  与前端第 208–210 行**同一条回落链**。⛔ 不要在 mapper 里抛错:
  "无盘点单位"是合法状态,抛错会让 120 个对象直接读不出来。
  建议顺手给第 580–586 行的 mapper 补上与同文件第 602–608 行 `unitSnapshot(result, firstColumn)`
  **一致的 null 守卫**(那个helper返回 null,正是此处需要的语义)。
- **需要 Dexter 裁决?** **否。** 裁定已经写死「源数量按源单位 precision 截断」,
  无盘点单位时源单位**就是**消耗单位,这是裁定的直接推论,不需要新语义。

**SAME_ROOT_SCAN(取 `countingUnitSnapshot()` 后直接解引用的全集 = 4)**
第 527 行(❌ 本条)· 第 545 行(✅ 前有 null 判断)· 第 549 行(✅ 同上)·
第 552 行(✅ 在 null 判断之后)。**其余 3 处已逐个核对,均在守卫之后取值。**
另:`countingUnitConfiguration` 的另一个重载(第 640 行,入参 `ObjectNode`)**有**完整 null 处理,
只有 targetRef 重载缺 —— 两个同名重载对同一件事两种写法。

---

## 2 · S

### S-1 · IA 未随裁定更新,且它声明的前端只读半边未实现

Dexter 本轮裁定:「已有 StockTarget 且基础单位变化会导致消费单位快照漂移时,在 catalog 保存事务内拒绝」,
并裁定「owner 与前端错误文案**以 IA 为准**」。两条合在一起,IA 就成了正本,而 IA 现在与实现有两处不符:

- **条件不符**:IA 第 85、86 行仍写「已关联存在**非零余额**的 StockTarget」;
  实现(第 447 行区)比对的是 `candidate.unitRef()` 与 `target.consumptionUnitRef()`,
  **与余额无关** —— 余额为 0 的 target 同样拒绝。实现符合裁定原文,**IA 落后于裁定**。
- **前端半边未实现**:IA 第 85 行要求「基础计量单位**固定只读**,不提供变更入口」,
  第 86 行要求显示「商品已有库存余额,暂不能修改基础计量单位」。
  实测:该文案全仓 **0 命中**;`CatalogItemDrawer` 中该 Select 只有 `denied('baseMeasureUnitRef')`
  (治理锁定,与库存无关),**无任何 target/余额相关的只读判定**。
  当前行为是"可选可提交,提交后由 owner 报错"。
- **区分**:两处不符均为事实。**哪一边该改是产品判断** ——
  后端拒绝已完全符合裁定;前端是"先让选再报错"还是"直接禁用",影响的是用户白填一遍的成本。
- **最小修复(二选一,需 Dexter 定)**:(a) 更新 IA 第 85、86 行为已裁定的语义
  (任何既有 target + 快照漂移即拒;前端不设只读,以 owner 错误提示为准);
  或 (b) 保留 IA,前端按"已有 target 且单位会变"禁用该字段并显示 IA 文案。
- **需要 Dexter 裁决?** **是,DEXTER_DECISION(轻)** —— 只需一句"改 IA"还是"补前端"。

### S-2 · 无盘点单位这条多数路径没有任何验收覆盖

新增的两条单位场景都**显式配置了盘点单位**,`inventory-consumption-reference-isolation` 亦不涉及精度。
⇒ 占 seed 约 120/130 的"无盘点单位"路径,在 76 条场景里覆盖为 **0**。M-1 正是从这个空格里漏出来的。
- **最小修复**:补一条 acceptance —— 消耗单位 precision≥2、**不配**盘点单位,
  录入带小数的数量,断言 readback 保留小数而非整数。这条断言在 M-1 修好前是红的,修好后转绿,
  正好是可证伪判据。
- **需要 Dexter 裁决?** 否。

---

## 3 · N(三条为上一轮原样未动,两条新增)

| # | 事实 | 位置 |
|---|---|---|
| N-1 | `configurationReadback(JsonNode, String measureMode)` 的 `measureMode` **形参仍未被使用**(上一轮已报) | `InventoryOwnerService.java` 第 777 行 |
| N-2 | `SELECT count(*) FROM inventory.stock_ledger WHERE consumption_unit_ref=?` **仍无 scope 过滤**,而紧邻的 target 查询是 scoped 的(上一轮已报)。因 unitRef 全局唯一,当前不可利用 | 同上 第 399 行 |
| N-3 | 换算因子仍是 `precision={6}`,而 DB 为 `NUMERIC(24,12)`;且同一文件其余数量字段已改用 `normalize` 截断,**只有它还用 antd 的进位式 `precision`** —— 同一文件内两种写法 | `InventoryActionModal.tsx` 第 663 行 |
| N-4 | 前端 `truncateTowardZero` 用 `Math.trunc(value * 10**p) / 10**p`,存在浮点边界(如 `0.29 × 100 = 28.999…` 截成 28 → 0.28)。后端 `BigDecimal` 是权威,故只影响输入框显示 | `InventoryActionModal.tsx` 第 102–108 行 |
| N-5 | `if (inventory != null)` 使 U01 守卫在 inventory 协作者缺失时被整体跳过。生产由 `@Autowired` 注入不会为 null,属模块测试便利;记录以免日后被误当作可选 | `CatalogOwnerService.java` 第 3390 行 |

---

## 4 · 逐项回答本轮九个核验点

1. **单值 + SKU 覆盖清除后继承** —— ✅ 第 3385–3386 行
   `effectiveBase = baseOverride == null ? itemBase : requireActive(baseOverride)`;
   前端字段说明「商品销售单位只能选择一个;原料可以留空。」与之一致。
2. **原料无销售单位但有基础计量单位可作 StockTarget/BOM** —— ✅
   `CATALOG_EFFECTIVE_SALES_UNIT_REQUIRED` 仅在 `SELLABLE` 能力下触发(第 3393–3396 行),
   原料不带该能力;`BASE_MEASURE_UNIT_REQUIRED` 由 coordinator 在建 target 时强制。
3. **counting unit 只用于录入换算,余额/流水仍用 snapshot** —— ✅ 设计与实现一致,
   验收断言了 balance 与 `consumptionUnitSnapshot.unitRef` 均为 g;
   ⚠️ 但 M-1 表明"没有 counting unit"时它反而污染了源精度。
4. **0.3567kg 是否真存为 356** —— ✅ 真实 HTTP 场景断言 356 且点名 357,在 76/76 中 PASS。
5. **U01 typed problem 且在 catalog 保存事务内** —— ✅ 且验收用了**可证伪判据**:
   拒绝后再读商品,断言 `version` 未变,证明拒绝发生在 catalog UPDATE **之前**而非事后补偿。
   这是本轮写得最好的一条断言。
6. **四项退休** —— ✅ `salesUnitRefs` 运行链 0;`SALES_UNIT` 仅余 2 处
   (`CopyLimitPolicyTest` 的**否定断言** `allowsDictionaryKind("SALES_UNIT")==false`,
   与 `CatalogOwnerService` 第 3396 行的 problem code 常量名),均非活引用;
   自由单位串与 JSON fallback 未见;`measureMode` 仅余商品形态语义。
7. **锁定/停用/精度/删除 + IA 一致性** —— 🟡 后端规则一致(引用后仅可改名或停用,零引用可改全部);
   单位详情页/Drawer 已按裁定**取消**(全仓 0 命中);「正在使用」列已补;
   **唯一不一致见 S-1**。
8. **copy closure / owner 边界 / N+1 / seed readback / 历史快照** —— ✅
   closure 第 6916 行含 `CATALOG_UNIT` 边;两处 N+1 已消;
   seed 报告 `business=PASS`、`cleanup=PASS_PRESERVED_DEV_STATE`;
   历史快照由行内 snapshot 承载,不从当前定义重解释。
9. **档位分账** —— ✅ 本轮可清楚分账:静态门 exit=0(21/21);
   真实 HTTP/Testcontainers 76/76 且 cleanup 全 PASS;managed DEV/seed 报告独立留证。
   ⚠️ **browser L2 本轮未执行**:话术把 `localhost:5175` 列为重点证据,但授权边界写明不授权 browser L2。
   我按授权边界执行,**未打开浏览器**,该页面的一切渲染与交互事实仍属 §5 未验证项。

---

## 5 · L3 未验证清单

**静态已证**:全部表格列/表单字段/校验提示/字段说明文案 · 全部 SQL 与事务注解 ·
两段截断的取值链 · 退休核验 · 前端截断助手的真实语义(读实现)。

**测试已证**:76 条真实 HTTP 场景全绿,其中 4 条与单位直接相关;静态 21/21。

**无人验证**:
1. 无盘点单位路径的实际数值结果(M-1 所指,约 120 个 seed 对象)
2. 九屏界面的渲染与交互(本批不授权 browser L2)
3. `containerBehaviorUnderLoad` 全部条款(99 条单位时的滚动/截断/1280px 无横向滚动)
4. 空态/加载态/读取失败保留旧值
5. 键盘可达性与「状态不只靠颜色」
6. 单位编辑表单(本轮新增)的实际可用性 —— 后端能力与前端入口已对齐,但无 focused test

---

## 6 · DESIGN_GAPS

1. **同一语义的两个重载写法不一致时,没有正本要求它们对齐** ——
   `countingUnitConfiguration` 两个重载对 null 盘点单位一个有处理一个没有,M-1 由此而来。
   建议进 `backend-coding-standard`:同名重载对同一边界条件必须同构。
2. **裁定落地后,谁负责回写 IA,无正本** —— S-1 的成因是裁定改了行为而 IA 未跟。
   建议在评审规范或详设模板补一条:裁定生效即回写受影响的设计文档,并在实施收口时对账。

---

## 7 · 收口

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取(80 条渲染事实)
VERDICT=NO-GO
M/S/N=1 / 2 / 4
L1_ENGINEERING=findings — M-1(无盘点单位时静默整数截断,本轮修复引入的回归)
L2_USER_VISIBLE=findings — S-1(IA 未随裁定更新,前端只读半边未实现);其余上轮 L2 findings 均已闭合
L3_UNVERIFIED=非空(6 组,见 §5;browser L2 按授权边界未执行)
SAME_ROOT_SCAN=M-1 countingUnitSnapshot 解引用 4/4 已判(1 缺陷 3 有守卫)· 两个重载已对照
DESIGN_GAPS=2(重载边界同构 · 裁定回写设计文档)
EVIDENCE_TIER=静态读源码 + fresh 跑 node-tests 门(exit=0,21/21) + 复核 76/76 真实 HTTP run 的原始 jsonl 与 manifest + 读 seed plan 实测计数。⛔ 未跑 acceptance(复核既有输出)、未跑 DEV、未开浏览器、未做任何写入(本文件除外)
```

**与上一轮的差别值得说清**:上一轮三条 M 全部真实闭合,修法质量高于最低要求
(前端改成按真实精度 `Math.trunc` 并明示提示,U01 验收用版本未变作可证伪判据)。
本轮唯一 M **是修复本身引入的**,且被"新场景恰好配了盘点单位"挡在覆盖之外 ——
这正是 S-2 要补那条场景的理由:**它是能让同类回归下次自己现形的那一格。**

**授权边界**:本文只是独立复核意见。不授权新增产品语义、不解除其他未决项、
不授权下一 Roadmap step、不授权 Git、reset、seed、DEV 生命周期、browser L2、UAT、部署或数据操作。
