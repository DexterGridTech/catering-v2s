# 销售菜单实现结果 · 独立静态 review（第二轮 · 本 cycle 硬停止）

- reviewerKind: `EXTERNAL_INDEPENDENT_REVIEWER_CLAUDE`
- 会话性质: fresh v2s-rooted，**纯静态**。未运行任何命令，未起 DEV / Testcontainers / 浏览器，未 reset/seed/UAT。
- 判定: **GO**
- findings: **M=0, S=1, N=3**
- 授权边界: 只覆盖当前销售菜单实现结果。不授权任何修改、动态运行、UAT、部署、切流，不扩大到 `apps/terminal`/TDP；不等于产品批准；SM-06 至 SM-12 不因本轮自动完成。

---

## 1. 第一轮两条 finding 的闭合判定

### S-2（修复后缺 fresh L2）—— **已闭合，`CONFIRMED`**

fresh run `l2-1788516930685-55751-c1d57da4-83fd-475a-af70-e5fc13f85c0b`：

| 项 | 值 |
| --- | --- |
| `business` | `PASS` |
| `firstFailure` / `brokenBoundary` | `null` / `null` |
| `lastKnownGood` | `L2_18_CASES_PASS` |
| `selectedCaseIds` / `resultCaseIds` / `notRunCaseIds` | 18 / 18 / **0** |
| `stoppedAfterFirstFailure` | `false` |
| `cleanupErrors` | 0 |
| 起止 | 2026-09-04T10:21:58 → 10:26:36 |

**关键：我没有采信 manifest 顶层字段。** 第三轮诊断时出现过「manifest 声称完成、
Playwright 报告本体为空」的情况，因此本轮直接解析
`playwright-results.json`（注意 spec 层有 `title`、test 层有 `results`，不在同一层）：

```
status 分布: {'passed': 18} | test 数: 18 | 非 passed: 无
```

**报告本体与 manifest 一致，fresh 动态证据成立。**

join artifact 独立核验：`joinStatus=COMPLETE`、`declaredActionCount=18`、
`missingDeclaredControlKeyCount=0`、`unexpectedTouchedControlKeyCount=0`、
`invalidCaseScopedEventCount=0`。cleanup manifest：`business=PASS`、`cleanup=PASS`、
`cleanupErrors` 长度 0。

### N-1（`adminListState` 未复用）—— **已闭合，`CONFIRMED`**

`SalesMenuPage.tsx` 中 `adminListState({` 恰 **5 处**：第 1469、1603、1951、2054、2103 行。
第一轮点名的 6 处手写 `locale={{emptyText: …}}` 组合，现存 **0 处**。
文件内 `<Table` 共 7 个 = 5 个 query-backed 表 + 2 个本地 SKU editor 表；
后两个保持不变，符合要求（它们没有 query 失败态，不该套 `adminListState`）。

修复落在既有 foundation 边界内，没有新增抽象，没有新增控制面。

---

## 2. 分母复算：Codex 报的每一个数字都精确命中

我按 Codex 给的口径逐个独立复算。**全部一致，无一例外。**

| 项 | Codex 报 | 我独立复算 | 依据 |
| --- | --- | --- | --- |
| operations | 31 | **31** | `sales-menu-l2-case-blueprint.json` 唯一 `operationCoverage[].operationId` |
| 31/31 出现 | 全覆盖 | **31/31，未出现 0 个** | fresh `http-request-events.jsonl` 交叉 |
| 相关 HTTP 事件 | 466 | **466** | 按上述 31 个 operation 过滤 |
| 200 / 201 | 410 / 54 | **410 / 54** | 同上 |
| 404 / 409 | 1 / 1 | **1 / 1** | 同上 |
| control touches | 342 | **342** | `l2-join-events.jsonl` 中 `CONTROL_TOUCH` |
| action start / complete | 18 / 18 | **18 / 18** | 同上 `ACTION_START` / `ACTION_COMPLETE` |
| binding input files | 1451 | **1451** | `repository-byte-binding.json` 的 `files` 长度 |
| binding bytes | 12555992 | **12555992** | 逐条 `bytes` 求和 |
| outsideScope | 0 | **0** | 逐条 `path` 前缀检查 |
| includedDirectories | 两目录 | **`['apps/backend','apps/frontend']`** | 同上；全文无 `apps/terminal` |
| commands | 19 | **19** | `iam-org-governance-manifest.json` 中含 `SalesMenu` 的标识符 |
| operation set | 268/268 | **268 = 268** | backend run manifest 四处独立字段全部相等 |

全局 HTTP 流量是 734 条（200:659、201:72、204:1、404:1、409:1）；
466 是按 31 个 operation 过滤后的口径，两者不矛盾，已核实。

### secret / HMAC 剥离 —— `CONFIRMED`

fresh 产物 `runtime-state.json`、`l2-execution-manifest.json`、`l2-join-artifact.json`、
`l2-cleanup-manifest.json` 四份文件中 `secret` 与 `hmac` 出现次数**均为 0**。

回归门是可证伪的真门，不是关键词匹配：
`scripts/test/browser-l2-runtime.test.mjs` 第 1484–1485 行注入红夹具
`diagnostic-secret-must-not-persist` / `diagnostic-hmac-must-not-persist`，
第 1496 行断言其不落盘，第 1497 行再断言不存在 `"secret"` / `"hmac"` 键。
**注入—断言不存在**的形态正确。

（该文件我用 `test(` 计得 68 个入口，与 Codex 报的 65 不同。差异极可能是我的探针把
嵌套或字符串内的 `test(` 计入。不可靠的是我的探针，不据此开 finding。）

**历史与修复后 artifact 分开定级：** 第一轮引用的 `l2-1788510438441-…` 是修复前 run，
其 secret 状态不在本轮结论内；本轮结论只覆盖 `l2-1788516930685-…`。

---

## S-1 `SalesMenuPage.tsx` 3209 行单文件（第一轮沿用）· `CONFIRMED`

**事实。** 当前 3209 行（第一轮 3179 行，增量来自 5 处 `adminListState` 接入）。
feature 共 9 个文件。同侪最大单文件 `catalog-management/ui/CatalogDictionaryDrawerState.tsx` 1675 行，
而该 feature 把复杂度摊在 109 个文件。单文件内含 8 个 Drawer。

**推论。** 与 `frontend-coding-standard.md` 的职责清晰取向相悖。不影响正确性，
本轮 18/18 全绿已证明运行行为无缺陷。

**影响面。** 可维护性与后续 review 成本。

**最小修复。** 按 Drawer 边界拆分，对齐 `catalog-management` 既有做法。

**建议时机。** **不要现在做。** L2 刚刚首次全绿，拆分会让 18 条全部需要重新验证。
排入 SM-06 之前。

**是否需 Dexter 裁决。** 否。

---

## N-1 那条 404 没有负向 oracle，与 Codex 的表述不符 · `CONFIRMED`

**事实。** Codex 的交接写「由通过负向 oracle 覆盖的 1x404、1x409」。逐条核验：

- **409 成立。** `sales-menu.spec.ts` 第 1580 行
  `waitForFailedOperation(runtime, 'deleteOperationsSalesMenuSection')`，
  第 1581–1584 行断言 `responseErrorCode(...) === 'SECTION_NOT_EMPTY'`，
  错误码不符即抛。这是**带业务错误码的真断言**，不是「失败即通过」。
- **404 不成立。** 该事件的 `operationId` 是
  `getOperationsSalesMenuDraftItem`（**单数**）。该标识符在 spec 中**零命中**
  （只有复数 `…DraftItems` 出现在第 720、1635、1639 行）。
  四处 `waitForFailedOperation` 分别针对
  `deleteOperationsSalesMenuSection`、`moveOperationsSalesMenuItem`、
  `stageOperationsSalesMenuAsset`、`publishOperationsSalesMenu`，不含它。
  `sales-menu-l2-scenarios.json` 第 1196–1199 行只声明该 operation 的 method 与 path，
  policy 全文无 `expectedStatus` / 负向期望字段。

**推论。** 这条 404 是**未被断言的顺带流量**，不是 oracle 覆盖。
从事件本身看后台行为是正确的：`databaseOperationCount=14`、`OWNER_READ=7`、
`durationMillis=927`，即 owner 真实查询后正确返回 404；
前端第 860 行 `if (detailQuery.isError || detailQuery.isFetching) return undefined;` 也吞掉了它。
最可能是删除销售项后，详情查询对已删除资源发起了一次陈旧重取。

**影响面。** 不影响用户，不影响本轮判定。影响的是**证据表述的准确性**：
把它写成「oracle 覆盖」会让后续 reviewer 以为存在一条并不存在的负向断言。

**最小修复。** 二选一：给它补一条 `waitForFailedOperation` 负向断言，
或让前端在删除后不再对已删除项发起详情重取。**推荐后者**——
少发一个必然 404 的请求，比补一条断言去守护它更简单。

**是否需 Dexter 裁决。** 否。

---

## N-2 byte binding 的 `kind` 字段写成 catalog-inventory · `CONFIRMED`

**事实。** 销售菜单 run 的 `repository-byte-binding.json` 中
`"kind": "catalog-inventory-l2-repository-byte-binding"`。
同目录其他产物的 `kind` 都是销售菜单自己的
（`sales-menu-l2-join-artifact`、`sales-menu-l2-cleanup-manifest`）。

**推论。** 复制既有实现时遗留的标签。内容本身正确（1451 文件、两目录、outsideScope=0 均已复算通过），
但 artifact 自称的类型是错的。若日后按 `kind` 归集或检索证据，销售菜单的 binding 会被归到 catalog-inventory 名下。

**影响面。** 证据可检索性；不影响运行与判定。

**最小修复。** 改这一处字符串常量。

**是否需 Dexter 裁决。** 否。

---

## N-3 「HTTP 事件计数不再作为 UI 就绪判据」的表述略微过头 · `PARTIALLY_CONFIRMED`

**事实。** 第三轮我要求「快照计数 + 1」构造归零。当前：

- 该构造从 5 处降到 **2 处**：`sales-menu.spec.ts` 第 1589、1595 行；
- `runtime.observations.filter` 从 23 处降到 **8 处**，且这 8 处**全部位于 helper 内部**
  （第 660、662、676、733、775、777、793、812 行），不再散落在调用点。

**推论。** 收敛方向与幅度都对，形态也对（语义收进 helper，调用点无法写错）。
但「不再作为就绪判据」这句话，对第 1589、1595 两处并不成立。

**风险评估：低。** 这两处紧跟在**已断言失败**的 delete 之后，
失败会触发 RTK Query 失效重取，网络请求是必然发生的，
与第三轮那种「缓存命中就不发请求」的场景不同。本轮 18/18 全绿也支持这一判断。

**最小修复。** 要么把这两处也改为读模型断言，要么把表述改成
「就绪判据已收敛进 helper，仅保留两处必然重取场景」。**推荐后者**——
改表述比改代码更贴合事实，也不动刚绿的 case。

**是否需 Dexter 裁决。** 否。

---

## 3. 无法可靠复算的项（按要求写 UNVERIFIED，不猜数字）

- **38 owner rules** —— `UNVERIFIED_REQUIRES_EVIDENCE`。
  我未能确定「owner rule」在代码中的判定惯例；按 `problem(` 抛出点计得 66，与 38 不同，
  但这两者显然不是同一口径。不可靠的是我的探针。
- **15 个 backend scenario** —— `UNVERIFIED_REQUIRES_EVIDENCE`（第一轮同结论）。
  三种探针给出 13 / 23 / 35；`BackendAcceptanceScenarioCatalog.java` 第 20 行只登记类
  （`new SalesMenuAcceptanceScenarios(host)`），不逐条登记场景。
  要证实需要场景声明的确切代码惯例，或一次 fresh acceptance 输出的场景清单。
- **99/99 backend 回归** —— `UNVERIFIED_REQUIRES_EVIDENCE`。
  run manifest 中未见 99 这一数值字段；`business=PASS`、`testExecution.status=PASS`、
  `measurementEvidence.status=PASS`、`verificationMode=ACCEPTANCE` 已核实，
  但 99/99 这个具体分母本轮无法从该 manifest 复算。

以上三项不构成阻断：它们是**我的复算能力边界**，不是已发现的偏差。

---

## 4. 分层判读

| 维度 | 判定 | 依据 |
| --- | --- | --- |
| 静态 | **PASS** | 5 处 `adminListState`、0 处残留手写空态、helper 收敛、红夹具回归成立 |
| backend business | **PASS** | run manifest `business=PASS`、268/268 四处相等（99/99 分母未复算） |
| seed business | **未独立复算** | 本轮未打开 seed 产物做逐条核对 |
| L2 business | **PASS** | Playwright 报告本体 18 passed / 18 tests；join COMPLETE；missing/unexpected 均 0 |
| cleanup | **PASS** | `cleanup=PASS`、`cleanupErrors` 长度 0 |
| 未执行项 | SM-06 至 SM-12、UAT、部署、切流 | 不因本轮完成 |

---

## 5. 方案合理性与判定

**方案合理（第一轮结论维持）。** 三条核心裁定——范围限 `INTERNAL` 加 `DINE_IN`/`TAKEAWAY`、
两个可售维度且库存维度派生不落库、约束闭集由 typed record 定义而销售项用 JSON 承载——
第一轮已逐条核过实际代码路径，本轮无新增反证。
复杂度与阶段匹配，没有为将来的外部渠道对应关系提前造抽象。
foundation 复用达标，无重复造轮子，无自成体系（第一轮四个「另起炉灶」假设全部被证伪）。

**判定 GO，M=0 / S=1 / N=3。**

第一轮唯一的阻断项 S-2 已由真实 fresh 动态证据闭合，且我核到了 Playwright 报告本体
而非仅采信 manifest。N-1 已完整修复。所有可复算的数字全部精确命中。

S-1 是结构性欠账，建议排在 SM-06 之前，**不要现在动**。
N-1、N-2、N-3 都是小修，可与 S-1 同批。

**OPEN mismatch：** 除 Dexter 已明确排除的 DEV 页面可见性外，
本轮新增一处表述层面的 mismatch（本报告 N-1：404 的 oracle 覆盖表述与代码不符），
以及一处 artifact 标签 mismatch（N-2）。两者都不构成阻断。
除此之外未发现其他 OPEN mismatch。

**本 GO 的边界：** 不授权下一 Roadmap step，不授权 DEV 或数据操作，
不等于产品批准或交付完成，不覆盖 SM-06 至 SM-12。
