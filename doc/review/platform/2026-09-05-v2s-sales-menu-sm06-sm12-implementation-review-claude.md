# 销售菜单 SM-06～SM-12 · 独立静态 implementation review

- reviewerKind: `EXTERNAL_INDEPENDENT_REVIEWER_CLAUDE`
- 会话性质: fresh v2s-rooted，**纯静态**。未运行任何命令，未起 DEV / Testcontainers / 浏览器，未 reset/seed/UAT。
- 判定: **NO-GO**（阻断项只有一条，见 S-1；零代码改动可闭合）
- findings: **M=0, S=2, N=2**
- 授权边界: 只判断 SM-06～SM-12 的实现与证据闭合。不授权新增产品语义/权限/数据模型/operation，不授权修改代码或数据，不授权 UAT、部署、切流，不扩展到 `apps/terminal`/TDP，不等于生产全产品验收。

---

## 1. 先说结论的形状

**M=0：没有发现任何 major 缺陷。** 业务语义、owner 边界、契约生成物、fixture/oracle、
testId/source binding、operation completion/join、cleanup 分离，本轮逐项核过，
可复算的分母**全部精确命中**。

NO-GO 的唯一依据是 S-1：**backend acceptance 证据早于它所证明的字节**。
这与第一轮的 S-2（修复后缺 fresh L2）是同一形状的问题，因此按同一标准判定。

---

## 2. 可复算分母：逐项独立核验结果

| 项 | 声称 | 我独立复算 | 依据 |
| --- | --- | --- | --- |
| 目标 acceptance scenario | 15 | **15**（13+1+1） | 按点分 scenario ID 精确枚举 |
| —— 三维判定 | 全 PASS | **15/15 contract=business=status=PASS** | `backend-acceptance-result.jsonl.gz` |
| —— businessMode | REAL | **15/15 REAL**，全为 `HAND_WRITTEN_BUSINESS_ORACLE` | 同上 |
| 全仓 acceptance | 99 | **discovered=99, selected=99，99 条全 PASS** | 同上 discovery 行 |
| operations | 31 | **31** | blueprint 唯一 `operationCoverage[].operationId` |
| —— 实际覆盖 | 31/31 | **31/31，未出现 0 个** | 本批 run `http-request-events.jsonl` |
| —— 相关事件 | — | **466**；200×410、201×54、404×1、409×1 | 同上 |
| commands | 19 | **19** | 治理 manifest 含 `SalesMenu` 的标识符 |
| owner rules | 38 | **38** | 详设 SM-01～SM-38 唯一编号 |
| L2 cases | 18 | **18/18，notRun=0** | execution manifest |
| —— 报告本体 | — | **18 passed / 18 tests** | `playwright-results.json` 直接解析 |
| 控件分母 | 236 / 68 / 78 | **236 / 68 / 78** | join artifact + locator bindings `controls` 键数 |
| —— join 异常计数 | 0 | **missing=0, unexpected=0, invalidCaseScoped=0**，`joinStatus=COMPLETE` | join artifact |
| UI | UI-01～UI-31 | **31 个唯一 UI-ID，连续 01–31** | `SalesMenuPage.static.test.ts` |
| source binding | 1459 / 12564616 | **1459 文件 / 12564616 字节**（逐条求和） | `repository-byte-binding.json` |
| —— 目录 | 两个 | **`['apps/backend','apps/frontend']`**；`apps/terminal`=**0**；越界=**0** | 逐条 path 前缀检查 |
| —— digest | `f48164a7…` | **完全一致** | artifact 与证据文档比对 |

**business 与 cleanup 分离：** cleanup manifest 中 `business=PASS` 与 `cleanup=PASS`
是两个独立字段，`cleanupErrors` 长度 0，`firstFailure=None`。分离成立。

**特别说明：** 我在前两轮把「15 个 scenario」「38 owner rules」「99/99」标为
`UNVERIFIED_REQUIRES_EVIDENCE`，原因是我找不到权威分母的判定惯例。
本批证据第 39 行给出了精确枚举口径，据此三项**本轮全部闭合**。
不可靠的确实是我此前的探针。

**第一轮 S-1（3209 行单文件）已落实：** `SalesMenuPage.tsx` 降至 **1541 行**，
feature 从 9 个文件拆到 **17 个**，按 Drawer 边界拆出 ItemEditor(500)、MediaEditor(490)、
Candidate(308)、Manager(163)、ItemDetail(156)、Publish(78) 与共享(116)。
foundation 符号从 13 增至 **14**（新增 `adminListState`），复用未因拆分退化。
时机也对——我上轮建议排在 SM-06 之前，正是此处。

---

## S-1 backend acceptance 证据早于它所证明的字节 · `CONFIRMED` · 本轮唯一阻断项

**事实。**

- 本批引用的 `backendAcceptanceRunId` 是 `r5-tc-1788513077533-56187`，
  `finishedAt = 2026-09-04T09:16:36.392Z`——与上一批是**同一次 run**，不是本批新跑的。
- `apps/backend/.../acceptance/SalesMenuAcceptanceScenarios.java`
  的 mtime 是 **2026-09-04T14:59:32Z**，比该 run 结束**晚 5 小时 43 分**。
  该文件承载 15 个目标场景中的 13 个。
- 同期 `CollaborationAcceptanceScenarios.java` mtime 为 14:34:01Z；`contracts` 下 37 个文件同期变动。
- 该 run 的 manifest **没有逐文件源码摘要**：`sourceSync` 只记 `status`/`workspace`/`stagingRoot`，
  `workload.fingerprint` 是 operation identity descriptor 的指纹，不是源码树指纹。

**推论。** 从 artifact 无法证明「被测源码 == 当前源码」。
这正是 L2 lane 用 `repository-byte-binding.json`（1459 文件、逐条 sha256）解决的问题；
**backend acceptance lane 没有等价物**。仓内已有正确做法，只是这条 lane 没接上。

**风险边界（诚实缩小）。** 我做了两项限缩核验：

1. **场景集可证未变** —— 当前文件里的 13 个 scenario ID 在该 run 的输出中**全部存在**，
   无新增、无重命名、无删除。所以这次改动没有动分母。
2. **当前字节确实跑过一次真实动态** —— 本批 L2 run（16:01:54，晚于 14:59 的改动）
   以真实 HTTP 打穿同一后台，31/31 operation 实际覆盖、466 条事件；
   且该 run 的 binding 记录的 `SalesMenuAcceptanceScenarios.java` sha256
   与当前文件**逐字节一致**，说明此后未再变动。

因此**未被排除的风险很窄**：仅限「scenario 方法体内部的断言在 09:16 之后被改动」这一种。
但它无法从产物排除，而 acceptance 的价值恰在这些手写业务断言本身。

**影响面。** SM-10 与 SM-12 的 backend business 结论。不影响 L2、seed、cleanup、静态维度。

**最小修复。** 重跑一次 backend acceptance，**零代码改动**。
上一次 run 从 09:11 到 09:16，约五分钟。

**结构性建议（可后置）。** 给 acceptance lane 补一份与 L2 同形的 byte binding，
使「证据覆盖当前字节」可机器判定，而不是靠 mtime 推断。这一条不阻断本批。

**是否需 Dexter 裁决。** 否。

---

## S-2 「409/404 均为已通过 oracle 的负向分支」表述仍不成立，且跨轮未处置 · `CONFIRMED`

**事实。**

- 证据文档第 131 行：「失败恢复场景内声明的 409/404 是已通过 oracle 的业务负向分支」。
- 第 32 行同时写：「独立 review 两轮 finding 已完成处置」。
- 逐条核验：**409 成立**——`sales-menu.spec.ts` 中
  `waitForFailedOperation(runtime, 'deleteOperationsSalesMenuSection')` 后断言
  `responseErrorCode(...) === 'SECTION_NOT_EMPTY'`，是带业务错误码的真断言。
- **404 不成立**——该事件的 operationId 是 `getOperationsSalesMenuDraftItem`（**单数**），
  该标识符在 spec 中**零命中**（只有复数 `…DraftItems`）。
  文件中 5 处 `waitForFailedOperation` 只覆盖 4 个 operation：
  `deleteOperationsSalesMenuSection`、`moveOperationsSalesMenuItem`、
  `stageOperationsSalesMenuAsset`、`publishOperationsSalesMenu`，均非它。
  `sales-menu-l2-scenarios.json` 也只声明该 operation 的 method 与 path，无期望状态字段。
- 11 维对账表「失败/恢复」行把它表述为「删除后读取」负向路径，
  说明作者确实是当作有意负向分支写的——但**代码里没有对应的断言**。

**推论。** 这条 404 是未被断言的顺带流量。后台行为本身正确
（`databaseOperationCount=14`、`OWNER_READ=7`，真实查询后正确返回 404），
前端也吞掉了它，**不影响用户，不影响本轮任何判定**。

问题在于：这是我第二轮 N-1 的原样重复，在一轮宣称「已完成处置」之后，
代码与表述**都未改动**。正式交付证据是下游 reviewer 的依据，
其中一条可被证伪的断言若长期保留，会让后续评审误以为存在一条并不存在的负向 oracle。
本轮据此从 N 升为 S。

**影响面。** 证据可信度与后续评审判断，不影响运行。

**最小修复。** 二选一：给它补一条 `waitForFailedOperation` 负向断言，
或让前端删除销售项后不再对已删除项发起详情重取。
**推荐后者**——少发一个必然 404 的请求，比补断言去守护它更简单。
若两者都不做，则必须把第 131 行改成只主张 409。

**是否需 Dexter 裁决。** 否。

---

## N-1 byte binding 的 `kind` 字段仍写成 catalog-inventory · `CONFIRMED`

**事实。** 本批 `repository-byte-binding.json` 的
`"kind": "catalog-inventory-l2-repository-byte-binding"`；
同目录 join 与 cleanup 产物的 `kind` 都是销售菜单自己的。第二轮 N-2 原样保留。

**推论。** 内容正确（1459/12564616/两目录/越界 0/digest 一致均已复算通过），
但 artifact 自称类型错误；按 `kind` 归集证据时会归错模块。

**影响面。** 证据可检索性。不影响判定。

**最小修复。** 改一处字符串常量。

**是否需 Dexter 裁决。** 否。

---

## N-2 UI-01～UI-31 的编号只存在于测试文件，与批准交互设计无 ID 级可追溯 · `CONFIRMED`

**事实。** 证据第 41 行称 UI 分母「由需求/IA/交互设计、`SalesMenuPage.static.test.ts`、
blueprint case/action 与受管 L2 join 共同核对」。
`SalesMenuPage.static.test.ts` 中确有 **31 个唯一 UI-ID，连续 UI-01 至 UI-31**。
但 `doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`（216 行）
中**不含任何 ID 形态标记**——不只是没有 `UI-NN`，任何 `XX-NN` 形态均为 0 命中。

**推论。** UI-NN 这套编号是测试文件自行分配的，与批准交互设计之间**只能靠人工读文对应**，
不存在 ID 级可机器核对的映射。证据第 41 行的措辞会让读者以为存在这种映射。

这不等于 UI 覆盖有缺口——31 项本身与 blueprint、join 都能对上；
缺的是「到批准设计」这一段的可追溯性。

**影响面。** 需求到实现的可追溯性；不影响运行与本轮判定。

**最小修复。** 二选一：在交互设计文档中标注 UI-NN，或把第 41 行措辞改为
「UI-NN 编号由 static test 定义，与交互设计的对应关系为人工核对」。
**推荐前者**，成本很低且一次性受益。

**是否需 Dexter 裁决。** 否——除非 Dexter 认为交互设计文档不应承载编号。

---

## 3. 无法证明的范围（明确划出，不猜）

- **seed / readback 逐条业务正确性** —— 本轮未打开 seed 产物做逐条业务核对。
  `seed-report.json` 与 `r5/run-manifest.json` 的存在性与顶层状态未构成我对
  SM-10/SM-11 业务内容的独立结论。记为**未独立复算**，不是已发现偏差。
- **acceptance 场景方法体内部断言在 09:16 之后是否变化** —— 见 S-1，产物无法排除。
- **DEV 页面可见性、UAT、部署、切流、`apps/terminal`** —— 按要求不在本轮范围。

---

## 4. 分层判读

| 维度 | 判定 | 依据 |
| --- | --- | --- |
| 静态 | **PASS** | 分母全部精确命中；拆分后 foundation 复用未退化 |
| backend business | **PASS（但证据早于当前字节）** | 15/15 与 99/99 三维全 PASS；证据时序问题见 S-1 |
| L2 business | **PASS** | 报告本体 18 passed/18；join COMPLETE；31/31 实际覆盖 |
| seed business | **未独立复算** | 见第 3 节 |
| cleanup | **PASS** | `cleanup=PASS`、`cleanupErrors` 长度 0，与 business 字段分离 |
| 未执行项 | UAT、部署、切流、terminal/TDP | 不在范围，不因本轮完成 |

---

## 5. 判定

**NO-GO，M=0 / S=2 / N=2。**

实现本身没有发现 major 缺陷；本批相对上一轮有实质进步：
第一轮 S-1 的单文件拆分已按建议完成且未损失 foundation 复用，
三个我此前无法复算的分母（15 / 38 / 99）本轮全部闭合。

阻断只有 S-1 一条：**backend acceptance 证据早于当前字节，且该 lane 没有 byte binding 可证同一性。**
一次 backend acceptance 重跑即可闭合，零代码改动，约五分钟。
我把它判为阻断，是为了与第一轮 S-2（修复后缺 fresh L2）保持同一标准——
两者都是「证据不覆盖交付字节」，不能因为这次风险面更窄就换判据。

S-2 与两条 N 都不阻断，建议与上述重跑一并处理。

**OPEN mismatch：** 11 维对账表本身未标 OPEN，本轮亦未在 11 维中发现新的 OPEN；
但 S-2（404 表述）与 N-2（UI 编号可追溯性）属于**证据与代码之间的 mismatch**，
应在下一次证据修订中一并收口。除此之外未发现其他 OPEN。
