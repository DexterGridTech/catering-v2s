# 后台接口性能整改 · implementation review Round 3(Claude 独立复核)

- 日期:2026-08-23 · 作者:Claude · 被审:CP-00..CP-13 当前生产源码 + `r5-tc-1787440276179-62850`
- 会话出处:**续接会话**。按亲验纪律声明:本轮不冒充 fresh acceptance;
  全部结论由本轮重开源码、fresh 跑静态门、从原始 `http-request-events.jsonl` **独立复算**得出,
  **未采信任何自报数字**,也未采信 Round 2 的 verdict。

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0 / 0 / 2
DEV_RESET_SEED_BROWSER_L2_UAT_DEPLOY_USED=NO
```

---

## 1 · Round 1 三条 M 的根因复验

### M-01 · 未知 RuntimeException 伪造 2xx item receipt —— `CONFIRMED`(已根因修复)

- **修法**:`CatalogOwnerService.java` 第 705–747 行。逐项 catch 后交给
  `batchItemFailureOrThrow`,只有**同时满足**三条才降级为 item result:
  能从 cause 链找到 `CatalogOwnerApi.Problem`、code 在 `BATCH_ITEM_PROBLEM_CODES` 闭集内、
  `400 ≤ status < 500`;**否则 `throw failure` 原样上抛**。
- **闭集亲验**(第 ~660 行):八项全部是 4xx 业务问题 —— `DEPENDENT_FACTS_BLOCK_VOID`、
  `NOT_FOUND`、`REFERENCE_BLOCKS_VOID`、`REFERENCE_MAPPING_UNRESOLVED`、`SCOPE_FORBIDDEN`、
  `VALIDATION_ERROR`、`VERSION_CONFLICT`、`VOIDED_RECORD_IMMUTABLE`。无兜底项。
- **回归亲验**:`CatalogBatchStatusTransitionIntegrationTest.java` 第 88–125 行
  `unknownItemFailureEscapesWithoutCreatingReceiptButKeepsEarlierItemCommit` ——
  真实 Testcontainers,用 `sections='null'::jsonb` 造出真实损坏 owner 事实,断言
  `RESULT_UNKNOWN` **上抛**、已提交项保留 `ENABLED`/version 2、损坏项停在 `DRAFT`/version 1、
  且 `command_receipt` 计数 **为 0**。这是可证伪判据,不是存在性断言。
- **比要求的更严**:详设只要求"不降级",实现额外把 5xx 一并排除在闭集之外。

### M-02 · 批量后刷新范围过大且失败不可见 —— `CONFIRMED`(已闭合)

- **修法**:`CatalogWorkbenchPage.tsx` 第 619–629 行新增独立 `refreshAfterBatch`,
  **只 refetch `itemsQuery` 与 `navigationQuery` 两条**;通用 `refresh`(第 599–618 行,
  会广播 headCompany/context/manifest/tagDictionary)保留给 Tab 切换,**不再被批量路径调用**。
- **失败可见性**:`try/catch` 之外还检查 `results.some(queryRefetchFailed)`
  (第 112–114 行:判定 RTK 返回对象里是否含 `error`),两条路径都置
  `batchRefreshProblem='列表刷新失败，请手动刷新'`。⇒ **refetch 以 rejected 值返回而非 throw 时也可见**,
  这正是 Round 1 该条的核心。
- **权威性**:`batchResults` 与 `batchRefreshProblem` 是两个独立 state,刷新失败不改写 receipt。

### M-03 · B-05 结果 Modal 六项 UI 行为无 focused 覆盖 —— `CONFIRMED`(已闭合)

`CatalogManagementPage.test.tsx`(1115 行 / 39 条)中,B-05 六项**逐项存在**:

| 要求 | 测试名 |
|---|---|
| 全成功结果层 | `renders the approved full-success result layer and close affordance` |
| 部分失败层级与表头列 | `renders partial failures with the approved heading and table columns` |
| 有界滚动容器 | `keeps the 100-item failure result inside the bounded scroll container` |
| 空/协议非法不伪造结果层 | `does not fabricate a result layer for an empty or protocol-invalid receipt` |
| 刷新失败可见且不改权威 receipt | `keeps a list refresh failure visible without changing the authoritative receipt` |
| 不暴露技术字段 | `does not expose itemRef, problemCode, version, or raw exception as user fields` |

- **抽验两条的断言质量**:均用 `renderToStaticMarkup` 做**真实渲染断言**,且带负向 ——
  脱敏那条同时断言 `toContain('已脱敏的业务失败原因')` 与
  `not.toContain('hidden-item-ref' / 'INTERNAL_PROBLEM_CODE' / '>42<' / 'raw exception')`。
  不是只加了标题。
- **顺带确认**:上一批我提的 workbench 六项也已补齐
  (`CatalogInventoryBomWorkbench.test.tsx` 8 条,含三布局分支、非法 mode 无入口、
  cursor 两页、typed problem 定位、关闭清草稿、精确失效)。

---

## 2 · 门与分母的独立复算(不采信自报)

| 项 | 自报 | 我的独立复算 | 判定 |
|---|---|---|---|
| Testcontainers | 80/80 | `discovered=selected=results=80`,失败 0,`cleanup` 五项全 PASS,`firstFailure=None` | ✅ |
| run 时序 | —— | run 目录 `08-23 08:16`,晚于**全部**改动代码(最晚 `CatalogOwnerService` 07:54) | ✅ |
| node 静态门 | 24/24、131/131 | 本会话 fresh 跑 `test-health-entry-runner --node` **exit=0**,`DISCOVERED=EXECUTED=24` | ✅ |
| operation exact-set | 238/238 | 从 `http-request-events.jsonl` 4060 条事件去重得 **238** 个 operationId | ✅ |
| UNCLASSIFIED_SQL | 0 | 逐事件累加 `sectionCounts.UNCLASSIFIED` = **0**;非连接/事务语句 **53775** 条 ⇒ 比例 **0.00%** | ✅ |
| budget exceeded | 0 | 逐事件检查超限标记 = **0** | ✅ |
| connection gate | —— | **GET 借连接 >1 的 operation 数 = 0** | ✅ |

**负控制未被做假**:`DatabaseOperationTracker.defaultSection`(foundation)第 ~430 行仍保留
`return Section.UNCLASSIFIED`,且 `isOwnerImplementation` 明确排除 `com.catering.v2s.app.`
与 `platform.foundation.` 前缀 —— **edge/foundation 语句继续可见地未分类**,
默认值没有被改成 OWNER 来换取 0%。这是本条 0% 可信的前提。

---

## 3 · 你点名的六项

1. **unknown RuntimeException 不伪造 2xx item receipt** —— `CONFIRMED`,见 §1 M-01,含真实容器回归。
2. **刷新只更新必要查询、失败仍可见** —— `CONFIRMED`,见 §1 M-02,两条 query + 双路径可见。
3. **B-05 六项是真实行为断言** —— `CONFIRMED`,见 §1 M-03,`renderToStaticMarkup` 正负向。
4. **budget 只有两个 owning generator、无第三份 registry** —— `CONFIRMED`。
   全仓 `databaseOperationBudget` 命中 10 处,其中生成器 3 个;
   第三个 `scripts/generate/backend-performance-budget.mjs`(511 行)经亲验**不写任何文件**
   (`writeFileSync` 零命中),只导出 schema 与 11 个 validator,被两个真 generator
   (`edge-codegen.mjs`、`catalog-inventory-p1.mjs`)与四个门共同 import。
   ⇒ 是**共享校验库**,不是第三份 registry;这恰是"同一事实一个住址"的正确形态。
5. **不把 static/focused/Testcontainers 冒充 browser L2/UAT** —— `CONFIRMED`。
   Round 2 交付件第 11、25、71、75 行逐处声明未授权未运行;本轮同样标注,见收口块。
6. **L1-05 同一 workload 的 before/after 未验证** —— `CONFIRMED`,如实保留为 N-01,见 §4。
   我搜遍 `.runtime/r5` 的 before/after/baseline 工件,唯一命中是无关的
   `evidence/formatting/bytecode-{before,after}.json`。**没有用不同 workload 拼性能结论。**

---

## 4 · N(证据边界,非实现缺陷)

### N-01 · L1-05 的 before/after 性能对比未取得 —— `UNVERIFIED_REQUIRES_EVIDENCE`

需求 L1-05 与串行计划 §10 第 4 条要求「L1 改造前留存的同 workload baseline 与 AFTER 同 workload 对比;
`saveOperationsCatalogItem` avg 下降 ≥90%,并报告 avg/p95、DB count、DB duration/operation」。
本轮**无该工件**。这不是实现缺陷 —— 取得它需要 DEV/seed 运行授权,本轮未授权。
⚠️ **解除条件**:在获得 reset/start/seed 授权后,用**同一份 seed workload** 各跑一次并留证;
⛔ 不得用 Testcontainers 数字与 DEV 数字互相替代 —— 两者拓扑不同,是本批要解决的那个变量本身。

### N-02 · browser L2 / UAT / DEV 生命周期未验证 —— `UNVERIFIED_REQUIRES_EVIDENCE`

本轮未授权、未运行 reset、seed、DEV lifecycle、browser L2、UAT、部署。
B-05 结果 Modal 的**浏览器真实交互**(键盘可达、焦点归还、真实滚动)仍无人验证;
focused test 证明的是渲染输出,不是浏览器行为。两者不可互相代称。

---

## 5 · 收口

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0 / 0 / 2
L1_ENGINEERING=PASS —— 80/80 零失败且晚于全部代码;静态门 exit=0(24/24);238/238 exact-set;UNCLASSIFIED 0.00%(53775 条语句实算);预算与连接门均 0 超限;负控制保留
L2_USER_VISIBLE=PASS —— B-05 六项 focused 真实渲染断言齐全;刷新范围收敛且失败可见;技术字段不外泄
L3_UNVERIFIED=非空(2 组:L1-05 before/after 性能对比;browser L2/UAT/DEV 生命周期)⇒ 结论只能是 GO_WITH_UNVERIFIED_UI
SAME_ROOT_SCAN=Round1 三条 M 逐条重开源码 3/3 闭合 · databaseOperationBudget 生成器 3/3 已判(2 真源 + 1 共享库)· B-05 六项 6/6 · workbench 六项 6/6
EVIDENCE_TIER=静态读源码 + fresh 跑 node 静态门 + 从 4060 条原始 HTTP event 独立复算四项门 + 复核 run manifest 与 mtime 对账。⛔ 未跑 acceptance(复核既有输出)、未跑 DEV/reset/seed、未开浏览器、未做任何写入(本文件除外)
```

**授权边界**:本轮**未执行** reset、seed、DEV 生命周期、browser L2、UAT、部署或任何 Git 操作。
本结论只是独立复核意见,不授权产品新增语义、不解除任何未决裁定、不授权下一 Roadmap step。
N-01 的解除需要一次 DEV/seed 运行授权;N-02 需要 browser L2/UAT 授权。
