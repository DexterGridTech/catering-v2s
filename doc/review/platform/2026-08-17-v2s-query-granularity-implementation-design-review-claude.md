# 查询粒度与重复读取整改 · implementation-facing 详设 · 独立复核

- 日期:2026-08-17 · 评审:Claude · 会话:fresh v2s-rooted(续接同一会话,已声明)
- 被审:`doc/plans/platform/2026-08-17-v2s-query-granularity-implementation-design-codex.md`(376 行,15 CP,5 批)
- 结论:**NO-GO** · **M=1 · S=1 · N=3**

---

## 0 · 这份工作到底解决什么问题

详设 §0.1 自述目标:让一个用户任务只读取其稳定事实闭包;同一任务内已可由一次读取得到的事实不再读第二次;集合读取不随选择数退化为逐项查询。

**这个目标本身是对的**,而且与 2026-08-13 裁定的方向一致(「先降 QUERY 再谈包装」)。

**但它只覆盖了叶子级的 15 个已定位成员。** 裁定认定的真问题 —— 共享读管线**每次读的固定开销** —— 在本详设与其源头 review 中**双双零提及**。见 M-1。

## 1 · 解决了没有:分项判定

| 问题族 | 判定 | 依据 |
|---|---|---|
| 前端拼装式批量(QG-03) | ✅ 判据可证伪 | 失败条件「仍对每个已选 item 先请求详情」,空实现会红 |
| 详情抽屉重复取 summary(QG-04) | ✅ 前端侧解决 | 源码证实 `currentTyped` 已算 3 个 period,抽屉又请求三个 endpoint |
| owner 内逐项/闭包读取(QG-09/10) | ✅ 判据可证伪 | 「输入集合增加时 owner 内按元素 query」「逐 SKU 读取 inbound reference」 |
| 同请求双读(QG-05/06) | ✅ 判据可证伪 | 「对同一 store 运行两次」「再按同一 key/id 读取 workspace UUID」 |
| RTK 全局失效(QG-13) | ✅ 判据可证伪 | 43 operation 闭集表 + 「未归类 operation 使 generator check fail」 |
| CTE wildcard(QG-15) | ✅ 判据可证伪 | 「5 个 wildcard 中任一仍存在」,静态 SQL check 可判 |
| **共享读管线固定开销** | ❌ **未处置、未提及** | 见 M-1 |

**我先前的假设已证伪并撤回**:我原以为这些失败条件是「不破坏即通过」,空实现也能过。逐条读完不成立 —— 它们大多点名了**错误的读取形状**本身(「仍读取完整 catalog detail」「仍逐 SKU」「仍只共享单一 `wire/LIST`」),空实现会红。这一点详设做得比平均水平好。

## 2 · 符合性核验

| 对象 | 结论 |
|---|---|
| `project-memory/decisions/http-crud-efficiency-design-redlines.md` | `SET_BASED_COLLECTION_READS`、`OWNER_LOCAL_EFFICIENCY_REPAIR`、`COMMAND_CORRECTNESS_COST_PRESERVED`、`MEASURED_PERFORMANCE_NOT_STATEMENT_COUNT` **实质满足**(未按名引用,不构成缺陷) |
| `project-memory/practices/*` 四条 | QG-08↔`read-model-granularity`、QG-03↔`set-interaction-not-n-times-single`、QG-13↔`cache-invalidation-granularity`、QG-05/06↔`reuse-projection-within-request`,**逐条对得上** |
| `doc/platform/agent-operating-model.md` §7 | 设计期盲审要求齐备(§5 六样 prompt 要素、两轮上限、`SELF_DECIDED` 收口、作者 intake 五档) |
| `implementation-task-template.md` 的 `RECALL` | **15/15 落地**,且每项另带「本项失败条件」。这是切换操作模型后第一份带它的详设,自主权前提成立 |
| CLAUDE.md「DB 调用数不设门」 | **符合**。详设写「`DB_OPERATIONS` 不作为通过条件」是照规矩做 |

**已撤回的一条 finding**:我原拟就红线 `PER_OPERATION_DESIGN_CONTRACT`(要求每 operation 声明 `databaseOperationCount` 并在 exit 精确比对)立案。核实后不成立 —— CLAUDE.md 明写「另打印**不设门**的 DB 调用数」,并点名退役其执行门 `scripts/check/implementation-design-granularity`(已确认删除),且禁止把退役控制列为 finding。**不予立案。**

## 3 · 是不是只为凑 GO

**不是,而且是反面。** 详设系统性地拒绝宣称自己证明不了的东西:

- §0.4:静态阅读不能证明实际发几次 HTTP / RTK 是否去重 / SQL 计划
- QG-13 验证:「动态观测未授权前不能关闭成效」
- QG-14 验证:「没有动态授权时只保留静态 disposition,不宣称消除重复请求」
- QG-15 不变量:「不是 round-trip 优化声明」
- §7:`DB_OPERATIONS` 不得当 business oracle 或性能基线

凑 GO 的写法会反过来 —— 宣称性能收益。这份没有。**证据档位纪律合格。**

---

## M-1 · 2026-08-13 裁定认定的真问题未处置也未说明(major)

**仓内事实(已亲验)**

`InventoryOwnerService.currentTyped`(第 484 行)一次详情打开发出:

- 1 次 target row 读
- **3 次** `changePeriodReadback(targetRef, "TODAY"/"7D"/"30D")`(第 502–504 行)—— 三条独立查询
- 1 次 `ledgerReadbacks`(第 507 行,`LIMIT 100`)

**QG-04 删的是前端重复请求这三个 summary;后端 3 条查询合并为 1 条,15 个 CP 无一覆盖。**

**外部事实(Dexter 2026-08-13 裁定,授权 Claude 决策)**

- 真问题:「读一个 catalog item 发 **10 条 SQL**…3.0/4.0 的高度整齐说明是**共享读管线的固定开销**,不是业务需要 —— **修一次管线 6 条同时受益**」
- 方向:「**先降 QUERY 再谈包装**」
- 要求:「`QUERY/次` 必须单独 disposition:`QUERY_REDUCED_TO_<n>` 或 `QUERY_ALREADY_MINIMAL` 附逐条业务必要性。**7–10 条 SQL 读一个条目默认是待证明项,不是既定事实**」
- 兜底:「管线有真实约束达不到就**记录**,**记录了就接受,不追加返工**」

**核验结果**:详设与源头 review 对 `DBCR`、`共享读管线`、`固定开销`、`只读事务`、`QUERY_ALREADY_MINIMAL` **全部零命中**。

**这不是要求扩范围。** 同一裁定明写「不重启 DBCR package」「不扩展到其余 15 族 HTTP」—— 扩范围反而违裁定。裁定自带的低成本兜底是**记录**:一段 disposition 说明本轮对管线固定开销做/不做/为什么。详设缺的是这一段。

**为什么是 major**:15 个 CP 全部落地后,Dexter 仍然无法回答他自己 2026-08-13 提出的那个问题 —— 读一个条目还要不要 10 条 SQL。而源头 review 同样零命中,说明更可能是**从未看见**,不是**有意排除**;读者无从区分这两者。

**验收判据**:详设出现一段对「单次读固定开销」的显式 disposition,内容为下列之一并附理由 —— 本轮不做(为什么)/ 已被某 CP 覆盖(哪个)/ `QUERY_ALREADY_MINIMAL`(逐条业务必要性)。**不要求任何测量运行,不要求扩批次。**

**适用条件与反例**:裁定数据来自 DBCR 期的 6 条 catalog/inventory GET,距今 4 天,我未在本轮复跑动态测量,**不主张当前运行时数值**。若已有其他批次处置过管线固定开销,本条自动降为 N(请指出该处置的 owning source)。

## S-1 · 最贵的 CP 买到的收益未摆出取舍(significant)

QG-11 要改 HTTP response 形状,牵动 OpenAPI → generated Java/TS → edge → 全部 consumer → 新增 acceptance 场景,**五层契约破坏**,是 15 个 CP 里最贵的一个。

它买到的是:停止在 `current` 里预取 UI 初始不展开的 ledger/reference。

**仓内事实**:该预取是**有界的** —— `ledgerReadbacks` 为 `LIMIT 100`(第 566–570 行),另一处 recent 为 `LIMIT 20`(第 559–560 行)。**不是无界读取,不构成规模悬崖。**

而详设 §0.3 自陈:源头 review 的业务 `GO` 仅表示「候选问题**不是立即的产品阻断**」。

⇒ 五层契约破坏 × 非阻断问题 × 有界 100 行 —— 这个取舍**可能是对的**(契约干净、语义正确、越早改越便宜),但详设没有把它摆出来让人裁。

**验收判据**:QG-11 增加一段代价说明,写明「改的是契约、影响 N 个 consumer、买到的是停止预取 ≤100 行有界数据」,并标注这是 `DEXTER_DECISION` 还是作者判断。

**这条是 `DEXTER_DECISION`** —— 范围与代价是他裁,不是我裁。

## N-1 · `RECALL` 首次全量落地(note)

15/15 CP 均带 `RECALL` + 「本项失败条件」。这是 `agent-operating-model.md` §9 登记的「已定,待首次落地」项,**现已落地**,实施方自主权前提成立。

## N-2 · 失败条件的结构性写法值得固定(note)

多数失败条件点名**错误的读取形状**而非「不破坏」,使空实现会红。建议把这个写法沉淀进 `project-memory/practices/`(现有 `evidence-falsifiable-criterion` 系记忆只讲了判据要可证伪,没给这个具体形状)。

## N-3 · QG-08 的「只由单一调用方使用」不可机械保证(note)

QG-08 不变量称新 typed read「只由 `enrichInventoryTargets` 调用」。这是设计声明,无机制阻止未来新增调用方。不影响本轮正确性,记为未来同根扫描点。

---

## 授权边界

- 本结论是**静态设计复核**。不授权实施、不授权契约/生成物/迁移改动、不授权 DEV/reset/seed/HTTP/L2/UAT。
- 我**未复跑**任何动态测量,不主张当前运行时 QUERY/CONNECTION/TRANSACTION 数值。
- M-1 的修复是**一段 disposition**,不是新增工作量,不改批次划分。
- S-1 属 `DEXTER_DECISION`,我不代裁。
- 本轮**未设计任何方案** —— 依 `agent-operating-model.md` §8,评审方给「这批做到没做到」,不给「怎么做」。
