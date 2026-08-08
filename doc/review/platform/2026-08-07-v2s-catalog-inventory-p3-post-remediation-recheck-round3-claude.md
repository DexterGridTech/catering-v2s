# P3 post-remediation 独立静态复核（第三次，Claude）

会话出处：fresh v2s-rooted 评审会话。历史全部保留、不改写：两轮 independent-subagent 对抗复核，
以及我的四份 review（`p3-static-implementation`、`p3-current-byte-implementation`、
`p3-post-remediation-recheck`、`p3-post-remediation-recheck-round2`）。
本文不因换文件名或换哈希重置任何上限。

授权边界：仅 P3 current-byte 静态 implementation、IA 对账、生成物与 evidence。
不授权也不背书 API/HTTP runtime、数据库/migration、seed/reset、DEV/UAT、managed L2、
deployment、cleanup。

---

## 0. 结论

**GO — M=0 / S=0 / N=1**

上轮 S-01（3 条存留 blocker 的模板理由）与 N-01（BLOCKED 无 retained 留痕结构）
**均真实闭合**，且闭合方式比我建议的更彻底：不仅补了 `retainedBlockedReasons`，
还一并补了 `retainedPartialReasons` 与 `previousByteBeforeRound2RemediationCounts`。

唯一的 N 是 `IA-INV-001` 缺口描述的一处措辞不准（多说了两个字段），结论本身正确。

**本轮我需要先更正我自己上一轮的一个判断**，见 §2。

---

## 1. 核验结果

### ① 分母 37/42/0/7/3 —— **属实**

我独立复算 `controls` 数组：`IMPLEMENTED_STATIC=37`、`PARTIAL_STATIC=42`、
`BLOCKED_UPSTREAM_CONTRACT=0`、`NOT_IMPLEMENTED=7`、`OUT_OF_SCOPE_STATIC=3`，合计 89，
与 `counts` 字段、`iaIdCount=89`、`exactSet=true` 三者一致；
`statusLedger.currentByteAfterLatestRemediationCounts` 与实际控件分布**逐键相等**。
本轮迁移算术自洽：36→37（+1）、40→42（+2）、3→0，
`latestRemediationChanges` 累计 10 条 from/to/basis，覆盖前后两轮全部迁移。

三条目标控件的判定我逐条验过源码：

- **`IA-INV-002` → `IMPLEMENTED_STATIC`，判定正确。**
  IA 原文只要求"需处理由低/无/负/未知派生、只是视图、不进入 `stockState`"；
  实现上 `stock_state` 是独立五态 CASE，需处理是
  `COUNT(*) FILTER (WHERE stock_state <> 'OK')` 的派生计数，前端经 `page.counts` 消费。约束已满足。
- **`IA-CAT-LIFECYCLE-002` → `PARTIAL_STATIC`，判定与缺口描述均正确。**
  新理由先承认 `CatalogOwnerService` 已实现按 priceGranularity 的启用前价格校验并在
  `transitionItem` 调用（与我核到的 `validateItemActivation` 第 627–643 行、
  `transitionItem` 第 620 行调用点一致），再点名真实缺口：
  首错摘要、页签错误数/字段定位、启停/归档二次确认与写后 owner readback 尚未在
  `CatalogItemDrawer` 取得静态行为证明。**这正是"具名真实缺口"的正确写法。**
- **`IA-INV-001` → `PARTIAL_STATIC`，判定正确**（缺口描述的措辞见 N-01）。

### ② 主门与自测 —— **通过**

fresh 复跑：`node tools/catalog-inventory-p3/cli.mjs --self-test` → **10 个红变异全部触发**
（LOCATOR_EXACT_SET / LOCATOR_SOURCE / BUSINESS_ASSERTION_METADATA / TYPED_SCHEMA /
QUERY_TYPE / IA_CONTROL_EXACT_SET / IA_LOCATOR_SOURCE / CONTRACT_LOCATOR /
IA_STATUS_LEDGER / **IA_BLOCKED_REASON_LEDGER**），`CATALOG_INVENTORY_P3_SELF_TEST=PASS`，exit=0；
主门 `CATALOG_INVENTORY_P3_STATIC=PASS`，`{pages:3, scenarios:18, cases:43, locatorBindings:43}`，exit=0。

### ③ 重复 BLOCKED reason 的红门拦截 —— **通过，且我做了差分实验精确隔离**

校验实现（`cli.mjs` 第 138–149 行）含三项：
数量匹配（`blockedReasonIds.length === blockedControls.length`）、
**值互异**（`new Set(Object.values(blockedReasons)).size === blockedReasonIds.length`）、
以及逐条与 `control.reason` 一致。三项与作者声称的"缺失、重复、不一致"对应。

红变异（第 237–247 行）把两个控件改为 BLOCKED、理由都设为「同一阻塞理由」、
两条 `retainedBlockedReasons` 也设为同值，并同步调整 counts，期望
`P3_IA_STATUS_LEDGER_BLOCKED_REASONS_INVALID`。

**由于 counts 被同步调整，数量校验会通过，因此拒绝只可能来自"值互异"这一项——
但这需要证明，不能靠推断。** 我在 scratchpad 完整仓拷贝上做了差分实验
（基线 self-test 先确认 exit=0）：**只把第二条理由改成互异值，其余变异一字不动**，
门随即不再拒绝，自测报 `P3_SELF_TEST_BLOCKED_REASON_MUTATION_NOT_REJECTED`。
**这精确隔离出拒绝原因就是理由重复本身**，而非数量不匹配或多余条目。实验用后即弃。

当前 `BLOCKED=0`，故 `retainedBlockedReasons` 为 `{}`，生产态下该校验暂为真空；
但机制已就位且经红变异证明可红，日后再出现 blocker 时即刻生效。这个设计是对的。

### ④ ledger 与哈希一致性 —— **通过**

`statusLedger` 现含 9 个键，新增 `retainedBlockedReasons`、`retainedPartialReasons`、
`previousByteBeforeRound2RemediationCounts`。
两条新 `PARTIAL` 的理由在 `retainedPartialReasons` 中均存在，且与 `control.reason` **逐字相等**。
P3 implementation evidence 的 `artifacts` 45 条，逐条独立复算 SHA-256，
**45/45 命中当前字节，零漂移**。
89 个控件 `runtimeStatus` 仍全为 `UNVERIFIED_REQUIRES_EVIDENCE`，未升级为业务 PASS。

---

## 2. 我对自己上一轮判断的更正（如实记录）

上一轮我在 S-01 中写道：`IA-INV-001` 的阻塞理由与当前字节冲突，依据是
「owner 已产出 `targetType`、`categoryName`、`materialRole` 三个字段」。

**这个依据是错的。** 我当时只用 `grep` 确认了这三个 JSON **键**存在，
没有验证它们是否**携带值**。本轮读 `InventoryOwnerService.targetListRow`（第 597 行）发现：
`.putNull("productName")` … `.putNull("categoryName").putNull("materialRole")`——
owner 是**显式置空**这几个字段的，只有 `targetType`（硬编码 `"PRODUCT"`）与 `productCode` 有值。

**作者本轮把 `IA-INV-001` 判为 `PARTIAL_STATIC` 是正确的，比我上一轮的判断更准确。**
我上一轮推动的"迁出 BLOCKED"这一动作结论上仍成立（它确实不是上游契约阻塞），
但我给出的依据不成立，特此更正。这也再次说明"键存在"不等于"事实可见"——
我此前多次提醒他人的错误类型，这次发生在我自己身上。

---

## 3. Findings

### N-01｜`IA-INV-001` 缺口描述多点名了两个字段，结论正确但会误导修复范围

**路径**：`doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json`
中 `IA-INV-001` 的 `reason`（同一字符串亦存于 `statusLedger.retainedPartialReasons`）。

**依据类型**：仓内事实，端到端追链。

理由写「`targetListRow` 当前将 **productName、categoryName、materialRole** 明确置空」。
owner 侧确如此（第 597 行三者皆 `putNull`），但**协调器随后回填了其中两个**：
`CatalogInventoryApplicationService` 第 313 行
`row.put("productName", catalogItem.path("name").asText(...))`、
第 314 行 `row.put("categoryName", ...categoryRefs 首项...)`。
我全仓检索 `materialRole` 的写入点，**只有 owner 的那处 `putNull`，无任何回填**——
所以端到端真正为空的只有 `materialRole` 一个字段。

**影响范围**：`PARTIAL_STATIC` 的判定不受影响（IA 要求"对象形态、分类和**物料标记**在次级行可见"，
`materialRole` 恒空即不满足），但缺口清单多列了两个字段。
按此清单排 P4 工作会以为要修三个字段，实际只需补 `materialRole` 一条链路——
在本项目里 reason 是驱动决策的，所以值得订正。

**最小修复**：把该 reason 改为「owner 置空后协调器回填了 productName 与 categoryName，
但 `materialRole` 端到端无回填点，次级行的物料标记恒空」，
`retainedPartialReasons` 同步更新（门会校验两者逐字相等）。

**是否需 Dexter 裁决**：否。

---

## 4. 方案合理性

本轮闭合方式比我建议的更彻底：我只提了补 `retainedBlockedReasons`，
作者一并补了 `retainedPartialReasons` 与 `previousByteBeforeRound2RemediationCounts`——
前者让 PARTIAL 这一最大的桶（42 条）也进入留痕约束，后者让每一轮迁移都有可复算的前值。
**这是把"逐条留痕"从个案修复升格为通用机制，方向正确且没有过度设计**：
没有新增实体、没有改契约、没有把门写复杂，只是补齐了同一套结构的缺失分支。

红变异的构造也值得肯定：同步调整 counts 使数量校验通过，让拒绝只可能来自目标条件——
这正是可隔离的红变异该有的样子，而不是"改坏一堆再看它红"。

## 5. 明确不背书

`businessStatus`、`cleanupStatus`、managed L2 与 89 个控件的 `runtimeStatus`
（本轮复算 89/89 `UNVERIFIED_REQUIRES_EVIDENCE`）均未执行，本文一律不背书。
静态门与 fixture PASS 不构成业务或 L2 PASS。P4 的运行时验收仍按
`doc/review/platform/2026-08-06-v2s-catalog-inventory-p4-scope-registry-claude.md` 登记执行。

## 6. 授权边界

本文仅授权「P3 current-byte 静态 implementation、IA 对账、生成物与 evidence」的复核，
不构成 P4 启动授权。不授权 API/HTTP runtime、数据库/migration、seed/reset、DEV/UAT、
managed L2、deployment、cleanup。
N-01 在既有批准边界内，可交 Codex 自主处置，不需要 Dexter 裁决。
