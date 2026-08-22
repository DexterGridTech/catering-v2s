# 商品库存与 BOM · implementation review(Claude 独立复核)

- 日期:2026-08-22 · 作者:Claude · 被审:CP-01..CP-07 当前生产源码 + 本轮 evidence
- 会话出处:**续接会话**。按亲验纪律声明:本轮不冒充 fresh acceptance;
  全部结论由本轮重开源码、重跑静态门、复核原始 evidence 得出,未采信设计 review 的 GO。

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取(137 条渲染事实,非空)
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0 / 4 / 1
```

---

## 1 · 亲验通过的部分(逐项开源码/跑门,非采信自报)

| 项 | 亲验结论 |
|---|---|
| **全量 acceptance** | `r5-tc-1787357296043-49946`:`discovered=selected=results=80`,**零失败**;run 起于 09:11,晚于全部后端代码(最晚 09:04)✅ |
| **静态门** | 本会话 fresh 跑 `test-health-entry-runner.mjs --node` **exit=0**,21/21,磁盘与登记分母对齐 ✅ |
| **生成链** | `catalog-inventory-p1.mjs --check` **exit=0**,产物与唯一生成源一致 ✅ |
| **63 格准入矩阵** | 第 125–131 行是 7 shape × 3 ownerType × 3 mode 的**真实嵌套循环**,每 case 走真实 HTTP 建商品(含为 OPTION_VALUE case 真实创建选项定义与值),逐 case 断言。不是形式化清单 ✅ |
| **0.3567kg→356g** | 第 920–944 行断言 `after`/`change`/`balance` 均为 `356`,断言消息逐字点名 357 为禁止值;并断言消耗单位快照仍为 g ✅ |
| **A-05 四维** | `BALANCE`/`LEDGER`/`BOM_REFERENCE`/`HISTORICAL_DEFINITION` 在验收中分别命中 5/8/4/5 次 ✅ |
| **U-UNIT-DESIGN-01 守卫** | `CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED` 在 owner 2 处、验收 1 处 ✅ |
| **seed executor 单位快照修复** | 第 211–217 行 `sameUnitSnapshot` 逐字段比 `unitRef/code/name/unitDimension/precision` **五项齐全**,且以 `Boolean(actual && expected)` 开头防 null 假通过;**未降级为只比 targetRef/quantity**(第 1544–1546 行仍同时比 targetRef、quantity、完整快照)✅ |
| **IA testId** | IA 声明的 8 个 testId **全部落地**(kebab-case + `catalog-` 前缀,如 `catalog-inventory-owner-tree`)。⚠️ 我先按 IA 原文大写形式搜得 0 命中,松开匹配后确认存在 —— **这是测量假象不是缺陷**,已按亲验纪律纠正 ✅ |
| **workbench 落地** | `CatalogInventoryBomWorkbench.tsx` 592 行,`useInventoryConsumptionTargetCandidates.ts` 存在 ✅ |

---

## 2 · Findings

### S-1 · seed readback 的同族断言不对称:各缺对方有的那一项 —— `CONFIRMED`

- **事实链(三个 readback 断言点,全部亲验)**:
  1. `scripts/dev/catalog-inventory-seed-executor.mjs` 第 **1544–1546** 行(item/SKU BOM 行):
     比 `targetRef` + `quantity` + `sameUnitSnapshot(...)`,**不比 `lineSign`** ——
     而 `expectedRow` 在第 **1425**、**1486** 行明确带了 `lineSign: "POSITIVE"`,构造了却没用。
  2. 第 **1627–1628** 行(option BOM 行):比 `targetRef` + `lineSign` + `quantity`,
     **不比 `consumptionUnitSnapshot`**。
  3. 第 **989** 行(option 定义 material):完整比 `sameUnitSnapshot` ✅。
- **也就是说**:本次单位快照修复应用到了 3 个 readback 点中的 **2 个**;第 3 个(option BOM 行)仍缺。
  而 item/SKU BOM 行则缺正负号 —— **两处各缺对方有的那一项**。
- **失败场景**:owner 若把 item BOM 行写成 `NEGATIVE`,或把 option BOM 行的消耗单位快照写错单位,
  seed readback **都会通过**。option 行的单位错写尤其要紧 —— 换燕麦奶的负向行正是单位敏感场景。
- **区分**:行号与字段为【事实】;"会漏过错写"为【推论】(未构造红夹具验证,本批不授权改动)。
- **适用边界**:只影响 seed readback 的严格度,不影响运行时正确性;acceptance 侧另有断言。
- **最小修复**:第 1546 行加 `&& line.lineSign === expectedRow.lineSign`;
  第 1628 行加 `&& sameUnitSnapshot(line.consumptionUnitSnapshot, expectedLine.consumptionUnitSnapshot)`
  (需在第 1570 行的 `targetLines.push` 一并带上快照)。
- **同根 sibling 范围**:BOM/material readback 断言点共 **3 个**,已逐个核对(见上),其余无第四处。
- **需 Dexter 裁决?** 否。

### S-2 · `INVENTORY_BOM_EMPTY` 已实现但零验收覆盖 —— `CONFIRMED`

- **事实**:5 个新 typed problem 的 owner 实现 vs 验收覆盖(本会话逐个计数):

  | code | owner 实现 | 验收命中 |
  |---|---:|---:|
  | `INVENTORY_DEDUCTION_MODE_NOT_ALLOWED` | 5 | 1 |
  | `INVENTORY_DEDUCTION_MODE_CHANGE_BLOCKED` | 1 | 1 |
  | **`INVENTORY_BOM_EMPTY`** | **2** | **0** |
  | `INVENTORY_BOM_SELF_REFERENCE` | 1 | 1 |
  | `INVENTORY_BOM_COMPONENT_NOT_ELIGIBLE` | 2 | 5 |

- **对照设计**:详设 §11.2 场景 13 明写「无 BOM 正常保存;**BOM+0 行拒绝**」,
  §11.3 亦把"空 BOM"列入强制 case;IA §4 把它列为 15 个 typed problem 之一。
  **owner 里有守卫,但没有任何真实 HTTP 证明它会触发。**
- **失败场景**:守卫若因条件写反而永不触发(或永远触发),当前证据无法发现。
- **最小修复**:在 `catalog.inventory-rule-admission-matrix` 内补一个 case:
  提交 `mode=BOM` 且 `bom.lines=[]`,断言 `INVENTORY_BOM_EMPTY` 且 catalog version 不变。
- **同根 sibling 范围**:5 个新 code 已逐个核对(表见上),仅此一个为 0。
- **需 Dexter 裁决?** 否。

### S-3 · workbench 的 focused test 只覆盖两个纯函数,设计要求的六项行为零覆盖 —— `CONFIRMED`

- **事实**:`CatalogInventoryBomWorkbench.test.tsx` **共 34 行**,只测两个导出纯函数
  (`truncateDecimalTowardZero`、`inventoryRuleOwnerKey`);被测组件本体 592 行。
- **对照设计**:详设 §4 CP-04 的可证伪观察逐字要求
  「focused component/model tests 证明**三个布局分支**、**非法 mode 无入口**、**cursor 两页**、
  **typed problem 定位**、**关闭后草稿清空**、**保存后 item detail/candidate 精确失效**」——
  **六项一项未测**。
- **影响面**:这六项正是 UI 层唯一的自动化防线;缺失后它们全部落入 L3 未验证清单(见 §3),
  而本批不授权 browser L2 ⇒ **无人验证**。
- **最小修复**:补齐六项 focused test。截断函数已有的测试形态可直接复用。
- **需 Dexter 裁决?** 否。

### S-4 · 全量 acceptance run 早于最终生成产物 —— `PARTIALLY_CONFIRMED`

- **事实(mtime 对账)**:全量 run 目录 `09:11`;而
  `scripts/generate/catalog-inventory-p1.mjs` = **09:19**、
  `contracts/openapi/catalog-inventory.openapi.json` 与 `CatalogInventoryShapeManifest.java` = **09:20**、
  前端 generated `catalog-inventory-edge.ts` = **11:22**。⇒ **80/80 跑在 09:11 的契约上,不是当前契约。**
- **已排除的部分**:`catalog-inventory-edge-route-registry.json` 的 build 副本(06:28)与当前源(11:30)
  **内容一致**,故 route 集合未变;`--check` 亦 exit=0 说明产物与源自洽。
- **未排除的部分**:schema、fixture、problem enum 的内容增量**无法从工件判定**
  (需 git diff,本轮不授权)。故标 `PARTIALLY_CONFIRMED`。
- **最小修复**:在当前产物上再跑一次 80/80 并留证;或给出 09:19 那次编辑的内容差异说明。
- **需 Dexter 裁决?** 否(但需要一次运行授权)。

### N-1 · IA testId 命名约定与代码不一致

IA 写 `CATALOG_INVENTORY_OWNER_TREE` 等大写形式,代码为 `catalog-inventory-owner-tree`。
**8 个语义全部落地**,仅书写约定不同。建议 IA 与代码取齐一种写法,避免下一轮又被当成缺失。

### N-2 · seed 未完成是 Dexter 主动中止,不是缺陷 —— `REJECTED_WITH_EVIDENCE`(本条已撤回)

**Dexter 2026-08-22 说明**:seed 是**他本人叫停的**,原因是
**后台性能优化之前先不做 seed**(见性能整改需求分析:当前 DEV 拓扑下每次 DB 操作 42.7ms,
一次完整 seed 要跑约 30 分钟,在拓扑修好前跑 seed 是纯浪费)。

因此:
- 最新报告 `complete-seed-7d36ce5b` 的 `business=FAIL` / `firstFailure=COMPLETE_SEED_STAGE_EXIT_NONZERO:catalog-inventory`
  是**受控中止的记录形态**,不是实现缺陷;`cleanup=PASS_PRESERVED_DEV_STATE` 与之一致。
- 我原先记录的"失败点与话术描述不一致"**予以撤回** —— 那是我从工件反推中止原因,
  而中止原因不在工件里,在 Dexter 的决定里。这正是"工件不足以判定意图"的一例。
- **本轮不因 seed 未 PASS 扣分**;它作为已知待办留在 L3,**解除条件是性能整改(L1 拓扑)完成后再跑**,
  而不是现在补跑。

⚠️ 连带影响 S-4:S-4 建议"在当前产物上再跑一次 80/80"仍然成立(那是 Testcontainers,
与 DEV seed 是两条不同的证据线,不受本条影响)。

---

## 3 · L3 未验证清单(非空,故不给 bare GO)

**静态已证**:契约/生成链自洽、owner 守卫存在、seed 断言字段构成、UI 结构与文案、testId 落地。

**测试已证**:80/80 真实 HTTP acceptance(含 63 格矩阵、A-05 四维、截断、组件资格、自引用);
静态门 21/21;两个纯函数的 focused test。

**无人验证**:
1. workbench 的**六项 UI 行为**(三布局分支、非法 mode 无入口、cursor 两页、typed problem 定位、
   关闭清草稿、保存后精确失效)—— S-3 所指,且本批不授权 browser L2;
2. `INVENTORY_BOM_EMPTY` 守卫是否真会触发 —— S-2;
3. `lineSign`(item/SKU BOM)与 option BOM 行单位快照的 readback 严格性 —— S-1;
4. **完整 seed business PASS** —— 由 Dexter 主动中止(性能整改前不 seed),**非缺陷**;解除条件是 L1 拓扑改造完成后再跑;
5. **browser L2 / UAT** —— 本轮未授权、未执行;
6. 当前契约(09:20 后)上的 80/80 —— S-4。

---

## 4 · 收口

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取(137 条)
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0 / 4 / 1
L1_ENGINEERING=PASS —— 80/80 零失败且晚于后端代码;静态门 exit=0;生成链 --check 绿。唯一保留项为 S-4(run 早于最终产物,route 集合已排除)
L2_USER_VISIBLE=findings —— S-3(六项 UI 行为零 focused 覆盖);N-1(testId 命名约定)。IA 声明的 testId 与文案本身已落地
L3_UNVERIFIED=非空(6 组,见 §3)⇒ 结论只能是 GO_WITH_UNVERIFIED_UI
SAME_ROOT_SCAN=seed readback 断言点 3/3 已判(1 完整、2 各缺一项)· 新 typed problem 5/5 已判(4 有验收、1 为零)· IA testId 8/8 已判(全部落地)
EVIDENCE_TIER=静态读源码 + 本会话 fresh 跑 node-tests 门与 p1 --check + 复核既有 80/80 run 原始 jsonl 与 manifest + mtime 对账。⛔ 未跑 acceptance、未跑 DEV/seed、未开浏览器、未做任何写入(本文件除外)
```

**授权边界**:本文只是独立复核意见。不授权新增产品语义、不解除任何未决裁定、
不授权下一 Roadmap step、reset、seed、DEV 生命周期、browser L2、UAT、部署或任何 Git 操作。
四条 S 在既有批准边界内自主修复即可;其中 S-4 的复跑需要一次运行授权。
