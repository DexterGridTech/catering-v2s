# P3 post-remediation 独立静态复核（第二次，Claude）

会话出处：fresh v2s-rooted 评审会话。历史全部保留、不改写：两轮 independent-subagent 对抗复核，
以及我的三份 review（`p3-static-implementation`、`p3-current-byte-implementation`、
`p3-post-remediation-recheck`）。本文不因换文件名或换哈希重置任何上限。

授权边界：仅 P3 current-byte 静态 implementation、IA 对账、生成物与 evidence。
不授权也不背书 API/HTTP runtime、数据库/migration、seed/reset、DEV/UAT、managed L2、
runtime deployment、cleanup。

---

## 0. 结论

**NO-GO — M=0 / S=1 / N=1**

上轮 M-01 的**系统性根因已修好**：statusLedger 建立、逐条 from/to/basis 留痕、
红变异门可拦截 ledger 篡改、7 条被证伪 blocker 已迁移、7 条 NOT_IMPLEMENTED 改为逐条具体理由。
这些我全部独立复算确认。

NO-GO 只卡在一处：**「3 个真实 blocker 仍有依据」这个待验命题不成立**——
三条仍共用一句模板理由，其中至少 `IA-INV-002` 已完整实现，另两条的**具名阻塞点也已实现**，
真实缺口在别处。这是连续第二轮出现"BLOCKED 理由与当前字节冲突"，
虽然规模已从 10 条降到 3 条、方向仍是保守低报，但同一命题不宜再放行。
修复面很小，见 S-01。

---

## 1. 四个核验点

### ① 分母 36/40/3/7/3 —— **数字属实，但 3 条 blocker 的依据不成立**

我独立复算：`BLOCKED_UPSTREAM_CONTRACT=3`、`IMPLEMENTED_STATIC=36`、`NOT_IMPLEMENTED=7`、
`OUT_OF_SCOPE_STATIC=3`、`PARTIAL_STATIC=40`，合计 89，与 `counts` 字段一致。
迁移算术自洽：29+7=36、10−7=3。
7 条迁移逐条有 `from`/`to`/`basis`，且 basis 我抽验对得上源码
（如 `IA-INV-ACTION-CONFIG-001` 的 basis 称 typed configuration request 提交
threshold/negative/counting-unit/conversion 字段，与 `InventoryActionModal` 第 145 行起的
`updateOperationsInventoryTargetConfiguration` 一致）。**7 条迁移判定正确。**

存留 3 条的依据见 S-01。

### ② statusLedger 与红变异门 —— **通过**

`statusLedger` 含 `policy`、`historicalReviewDeclaredCounts`（86/0/0/0/3，
与我上上轮的实测一致）、`currentByteBeforeLatestRemediationCounts`（29/40/10/7/3，
与我上轮实测一致）、`latestRemediationChanges`（7 条逐 ID from/to/basis）、
`retainedNotImplementedReasons`、`currentByteAfterLatestRemediationCounts`。
**两组历史分母与我两轮独立观测逐一吻合，没有粉饰。**

门侧：`tools/catalog-inventory-p3/cli.mjs` 第 114–135 行校验
`P3_IA_STATUS_LEDGER_MISSING` / `COUNTS_INVALID` / `CHANGE_INVALID` / `REASON_INVALID`；
第 216–224 行的红变异篡改 `latestRemediationChanges[0].to` 并要求精确命中
`P3_IA_STATUS_LEDGER_CHANGE_INVALID`。
fresh 复跑 `--self-test` 得 **9 个红变异全部触发**
（LOCATOR_EXACT_SET / LOCATOR_SOURCE / BUSINESS_ASSERTION_METADATA / TYPED_SCHEMA /
QUERY_TYPE / IA_CONTROL_EXACT_SET / IA_LOCATOR_SOURCE / CONTRACT_LOCATOR / **IA_STATUS_LEDGER**），
`CATALOG_INVENTORY_P3_SELF_TEST=PASS`，主门 `CATALOG_INVENTORY_P3_STATIC=PASS`。

### ③ 7 条 NOT_IMPLEMENTED 的理由 —— **通过，质量明显好转**

7 条理由**去重后仍是 7 条**，无共享模板，且每条都先说清已有什么、再说缺什么，
并正确区分了「行为缺口」与「proof 缺口」。举两例：
`IA-CAT-SOURCE-AUTO-002` 写「当前没有同步执行按钮，符合本期边界；但尚无 focused proof 证明
"仅模型/视图、不建设同步链"在所有入口均无误触发路径」——这是诚实的 proof 缺口声明；
`IA-CAT-TAB-004` 写「点单选项已有内联编辑器和读模型，但尚未实现 IA 要求的左组/右详情/实时预览三栏」——
这是明确的行为缺口。**没有用 locator 存在性冒充完成。**

### ④ 89 / 43 / hash —— **通过**

`controls` 89 条、`iaIdCount` 89、`exactSet` 为 true；
L2 `bindings` 43 = `caseCount` 43 = scenarios 中 `caseId` 43；
P3 implementation evidence 的 `artifacts` 43 条，逐条独立复算 SHA-256，
**43/43 命中当前字节，零漂移**。
89 个控件 `runtimeStatus` 仍全为 `UNVERIFIED_REQUIRES_EVIDENCE`，未升级为业务 PASS。

---

## 2. Findings

### S-01｜3 条存留 blocker 共用模板理由，其中至少 1 条已完整实现、另 2 条的具名阻塞点也已实现

**路径**：`doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json`
中 `IA-CAT-LIFECYCLE-002`、`IA-INV-001`、`IA-INV-002` 三条，
状态源自 `tools/catalog-inventory-p3/ia-reconciliation.mjs` 的 `upstreamBlocked` 集合，
三条共用同一句理由：「当前 P1 契约仍未提供该控件所需的**生命周期/激活校验或库存列表事实**；P3 不擅自重开契约」。

**依据类型**：仓内事实，逐条读完整 IA 原文后对源码亲验。

- **`IA-INV-002` —— 理由确凿为假，控件已完整实现。**
  IA 原文（第 670 行）全文仅一句：「"需处理"由低/无/负/未知和其他规则派生，只是视图，
  不进入 `stockState`」。当前实现：`stock_state` 是独立的五态 CASE
  （UNKNOWN/NEGATIVE/OUT/LOW/OK），"需处理"是
  `COUNT(*) FILTER (WHERE stock_state <> 'OK') AS attention_count` 的派生计数，
  前端经 `page.counts` 消费为 Segmented 视图。**该要求是一条纯派生约束，且约束已满足，
  不存在"P1 契约未提供"的解读空间。**
- **`IA-CAT-LIFECYCLE-002` —— 具名阻塞点已实现，真实缺口在别处。**
  理由点名的是"生命周期/激活校验"，但 `CatalogOwnerService.validateItemActivation`
  （第 627–643 行）正是 IA 原文（第 592 行）要求的那条：SKU 粒度要求每个启用 SKU 有整数
  `standardSalePrice` 且至少一个启用 SKU，ITEM 粒度要求商品标准价齐；
  且在 `transitionItem` 第 620 行以
  `if ("ENABLED".equals(target) && !"ENABLED".equals(current.status())) validateItemActivation(current);` 调用。
  该 IA-ID 的其余部分（首错摘要、页签错误数与字段定位、启停归档二次确认、归档阻断类型）
  确实尚未完成——**但那些是前端行为缺口，不是上游契约缺口**，正确状态应为
  `PARTIAL_STATIC` 并写明真实缺口。
- **`IA-INV-001` —— 具名阻塞点与当前字节冲突。**
  理由点名"库存列表事实"，但 owner 已产出 `targetType`、`categoryName`、`materialRole` 三个字段，
  前端 `InventoryManagementPage` 第 52 行用 `NameCodeText` 渲染身份行、
  第 53 行渲染次级复合行——正是 IA 原文（第 666–668 行）要求的形态。
  其余要求（"每个筛选语义均有对应可见事实"）是否留有缺口需逐项核，但**理由本身已不成立**。

**影响范围**：连续第二轮出现 evidence 的 BLOCKED 理由与当前字节冲突。方向仍是保守低报，
不产生假绿，也不影响源码正确性；但 `BLOCKED_UPSTREAM_CONTRACT` 在本项目里是
"需 Dexter 裁定是否重开契约"的信号，误报会触发不必要的裁决；同时它会让 P4 范围
把已完成的上游工作再排一遍。

**为什么这轮记 S 而非上轮的 M**：系统性根因已修（ledger + 逐条 basis + 红变异门），
规模由 10 条降至 3 条，且 7 条迁移的判定全部正确——说明重判方法本身是有效的，
只是最后 3 条没有走完同一遍流程。

**最小修复**：对这 3 条各自做一次与那 7 条同规格的复判——
`IA-INV-002` 直接迁 `IMPLEMENTED_STATIC` 并入 ledger 的 `latestRemediationChanges`；
`IA-CAT-LIFECYCLE-002` 与 `IA-INV-001` 若确有缺口则迁 `PARTIAL_STATIC`，
并按 §③ 的 7 条标准写出**具名真实缺口**，不再沿用"契约未提供"这条已被两轮证伪的表述。
若复判后认为仍确有上游契约缺口，请写明缺的是哪个 operation 的哪个字段。

**是否需 Dexter 裁决**：否。事实订正，不涉范围或产品语义。

### N-01｜`retainedNotImplementedReasons` 有逐条留痕，`retained blocked` 无对应机制

**路径**：同上 `statusLedger`。

**依据类型**：仓内事实。ledger 的 `policy` 写明「每次集合变更必须在 disposition 中列逐条 ID、
from/to、依据与**当前缺口**」，并已为 NOT_IMPLEMENTED 建立 `retainedNotImplementedReasons` 留痕字段；
但**存留的 BLOCKED 条目没有对应的 retained 留痕结构**，所以它们能长期停留在共享模板理由上而不被门发现——
S-01 正是从这个缺口漏过来的。

**影响范围**：机制不对称，是 S-01 复发的结构性原因，而非新的事实错误。

**最小修复**：新增 `retainedBlockedReasons`（与 `retainedNotImplementedReasons` 同规格，
逐条写具名上游缺口），并在门里加一条断言：`BLOCKED_UPSTREAM_CONTRACT` 条目的 reason
必须在该结构中逐条存在且互不相同；配一个红变异（把两条 blocked 理由改成同一串应被拒）。

**是否需 Dexter 裁决**：否。

---

## 3. 方案合理性

本轮做法正确且有进步：ledger 把"人工名单"这一风险从隐性变为显性并接受门约束，
`policy` 字段明确写出"不由 locator 存在性推导"——**这恰好回应了我上轮担心的两个方向的漂移**；
`historicalReviewDeclaredCounts` 如实记下 86 这个曾被我核出的数字，没有回避；
7 条 NOT_IMPLEMENTED 的理由质量是本轮最大的改进，区分行为缺口与 proof 缺口是专业做法。

唯一的问题是重判没有走完最后 3 条。这不是能力问题，是"迁移哪些"的边界选得保守了一点点，
而保守的代价恰好落在最容易被忽视的地方——没有 retained 留痕结构的那一类。

## 4. 明确不背书

`businessStatus`、`cleanupStatus`、managed L2、89 个控件的 `runtimeStatus`
（本轮复算 89/89 `UNVERIFIED_REQUIRES_EVIDENCE`）均未执行，本文一律不背书。
作者未把静态或 fixture PASS 写成业务 PASS，确认无误。

## 5. 授权边界

本文仅授权「P3 current-byte 静态 implementation、IA 对账、生成物与 evidence」的复核。
不授权 API/HTTP runtime、数据库/migration、seed/reset、DEV/UAT、managed L2、
runtime deployment、cleanup。S-01 与 N-01 均在既有批准边界内，可交 Codex 自主处置，
不需要 Dexter 裁决。
