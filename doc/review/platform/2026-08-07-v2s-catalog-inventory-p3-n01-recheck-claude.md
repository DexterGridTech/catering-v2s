# P3 N-01 处置独立复核（Claude）

会话出处：fresh v2s-rooted 评审会话。历史全部保留、不改写：两轮 independent-subagent 对抗复核，
以及我的五份 review（`p3-static-implementation`、`p3-current-byte-implementation`、
`p3-post-remediation-recheck`、`...-round2`、`...-round3`）。
本文不因换文件名或换哈希重置任何上限。

授权边界：仅 P3 current-byte 静态 implementation、IA 对账、生成物与 evidence。
不授权也不背书 API/HTTP runtime、数据库/migration、seed/reset、DEV/UAT、managed L2、
deployment、cleanup。

---

## 0. 结论

**GO — M=0 / S=0 / N=0**

round-3 的 N-01 真实闭合。六个核验点逐项独立复算通过，无新增 finding。
P3 静态包在我这边收口。

---

## 1. 六项核验

### ① owner 置空 —— 确认

`InventoryOwnerService.targetListRow`（第 597 行）显式
`putNull("productName")`、`putNull("categoryName")`、`putNull("materialRole")`
（另有 `putNull("skuName")`）。只有 `targetType`（硬编码 `"PRODUCT"`）与 `productCode` 携带值。

### ② 协调器回填 —— 确认

`CatalogInventoryApplicationService` 富化区（第 309–317 行）：
第 313 行回填 `productName`（取 `catalogItem.name`）、
第 314 行回填 `categoryName`（取 `categoryRefs` 首项，无则 null）、
第 316 行回填 `skuName`。

### ③ `materialRole` 无端到端回填点 —— 确认

富化区第 309–317 行完整读过，**不触及 `materialRole`**。
我另对全部后端主源码检索 `materialRole` 的写入点：
`CatalogOwnerService` 有多处（第 713 行 `proposed`、第 841 行 `snapshot`、第 854 行 `sections`），
但这些属临时商品预检、来源快照与 item sections 路径，**不进入库存列表富化链**；
`InventoryOwnerService` 侧唯一一处即 §① 的 `putNull`。
**端到端确实无回填点，次级行的物料标记恒空。**

### ④ `IA-INV-001` 状态与理由 —— 确认

状态仍为 `PARTIAL_STATIC`。理由现为：
「InventoryOwnerService 先将 productName、categoryName、materialRole 置空，
CatalogInventoryApplicationService 随后回填 productName 与 categoryName；
当前 materialRole 端到端没有回填点，次级行的物料标记恒空，
尚未满足 IA 的复合主列与筛选语义可见性要求。」

**与我 §①–③ 的实测链路逐环吻合**，round-3 N-01 指出的"多点名两个字段"已订正。
`statusLedger.retainedPartialReasons["IA-INV-001"]` 与 `control.reason` **逐字相等**（门亦校验此项）。

理由未提 `skuName` 是正确的取舍：IA-INV-001 要求的是"对象形态、分类和物料标记在次级行可见"，
`skuName` 不在该要求内，不属于本控件的缺口。

### ⑤ 分母与哈希 —— 全部独立复算通过

- `IMPLEMENTED_STATIC=37`、`PARTIAL_STATIC=42`、`BLOCKED_UPSTREAM_CONTRACT=0`、
  `NOT_IMPLEMENTED=7`、`OUT_OF_SCOPE_STATIC=3`，合计 **89**；
  与 `counts` 字段、`iaIdCount=89`、`exactSet=true` 一致；
  `statusLedger.currentByteAfterLatestRemediationCounts` 与实际控件分布**逐键相等**。
- L2：`bindings` 43 = `caseCount` 43 = scenarios 中 `caseId` 43。
- artifacts：声明 **47** 条，逐条独立复算 SHA-256，**47/47 命中当前字节，零漂移**。
- 89 个控件 `runtimeStatus` 仍全为 `UNVERIFIED_REQUIRES_EVIDENCE`。

### ⑥ 四个门 fresh 复跑 —— 全部通过

- `node tools/catalog-inventory-p3/ia-reconciliation.mjs`：exit=0。
- `node tools/catalog-inventory-p3/cli.mjs --self-test`：`CATALOG_INVENTORY_P3_SELF_TEST=PASS`，
  **10 个红变异全部触发**（含 `IA_STATUS_LEDGER`、`IA_BLOCKED_REASON_LEDGER`）。
- `node tools/catalog-inventory-p3/cli.mjs`：`CATALOG_INVENTORY_P3_STATIC=PASS`，
  `{pages:3, scenarios:18, cases:43, locatorBindings:43}`。
- `scripts/check/claude-review-handoff`：`PASS`，对象为本轮 review-request
  `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-post-remediation-recheck-round3-review-intake-codex.md`。

**过程更正（如实记录）**：我首次运行 handoff checker 时把 `--file` 指向了我自己的评审交付物，
得到 `FAIL / MISSING_SECTION:背景`。该 checker 的用法是
`--file <review-request-relative-path>`，校验的是评审请求文档而非评审结论文档；
指向正确对象后为 PASS。**这是我的调用错误，不是门或材料的问题。**

---

## 2. 一处观察（不计 finding，供修 `materialRole` 时一并处理）

第 314 行的回填是 `categoryName ← categoryRefs[0]`，而 `categoryRefs` 承载的是**分类编码**
（catalog 侧 `loadCategories` 即以这些值匹配 `catalog_category.code`）。
也就是说名为 `categoryName` 的字段实际显示的是编码，且多分类时静默只取首项。

不计 finding 的理由：`IA-INV-001` 已正确标为 `PARTIAL_STATIC`，
其 reason 已声明"尚未满足 IA 的复合主列与筛选语义可见性要求"，本观察落在同一未满足项内，
再单列一条属于重复计数。建议在补 `materialRole` 链路时一并处理：
把 `categoryName` 取成真实名称，并明确多分类的展示规则（截断加计数，或改为 refs 列表）。

## 3. 方案合理性

本轮是一次窄范围的事实订正，处置精准：只改了 reason 文本、未动源码、未调状态、未碰门，
且同步更新了 `retainedPartialReasons` 以满足逐字相等的门约束。
**没有借修 reason 之机扩大改动，也没有把 `materialRole` 匆忙补上去以求把状态调成 IMPLEMENTED**——
在缺口真实存在时保持 `PARTIAL` 并如实描述，比凑一个好看的分母更有价值。

## 4. 明确不背书

`businessStatus`、`cleanupStatus`、managed L2 与 89 个控件的 `runtimeStatus` 均未执行，
本文一律不背书。静态门与 fixture PASS 不构成业务或 L2 PASS。

`doc/review/platform/2026-08-07-v2s-catalog-inventory-p4-acceptance-judgment-spec-codex.md`
已存在（10699 字节）。**本轮授权边界不含该文件，我未对其做任何复核**，
其内容是否满足 P4 验收判定所需，需在获得相应授权后单独评审。
本文亦不构成 P4 启动授权。

## 5. 授权边界

本文仅授权「P3 current-byte 静态 implementation、IA 对账、生成物与 evidence」的复核。
不授权 API/HTTP runtime、数据库/migration、seed/reset、DEV/UAT、managed L2、
deployment、cleanup。无 finding，无需 Dexter 裁决。
