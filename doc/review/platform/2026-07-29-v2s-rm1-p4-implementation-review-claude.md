---
title: RM1 P4（RM1-U07）实现复核（Claude）
reviewTarget: IMPLEMENTATION
scope: RM1-P4 current bytes
verdict: NO-GO
findings: M=1 / S=1 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅评审 P4；不进入 P5、不改 Roadmap 状态、不做 DEV/seed/reset/动态环境操作
createdAt: 2026-07-29
---

# RM1 P4（RM1-U07）实现复核

## 0. 结论

**NO-GO**，`M=1 / S=1 / N=3`。

按要求先回到 **P4 要解决什么**：数据增长时两个后台仍返回同样的已授权 owner facts，
且服务端读取保持有界。

**业务目标基本达成，而且达成方式是对的**——`assertFixed` 断言的不是"查询少一点"，
而是 **P=1 与 P=100 的查询条数相等**；S3/S6 的 `total` 分别为 103 与 102，
这个差值本身就在证明分页优化后**授权范围过滤仍然生效**。E-0 形状（RowMapper 内发查询）
全仓已清零。

**但两条证据体系缺陷使"有界"这个结论无法被机械守住**：

| # | finding | 实质 |
| --- | --- | --- |
| **M1** | ledger 的 `budget` 与预算测试的常量是**两套独立硬编码、无交叉对账，且已经漂移**（O5：ledger `≤4`，测试 `5`） | 权威工件与执行断言互不认账 |
| S1 | "每条 ledger 行均有真实 red mutation"**不成立**——26 行全部被度量，但显式 red 只有 1 条，证明的是度量装置有效，不是每行预算紧 | 核验点 5 未满足 |

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）。
不采信作者结论，直接重开生产源码、测试与 ledger 判断。

**授权边界**：仅评审 P4。不进入 P5、不改 Roadmap 状态、不做 DEV/seed/reset/动态环境操作。

---

## 1. M（必须修复）

### M1 ｜ledger budget 与预算测试常量互不认账，且已漂移

**owning source**
- `doc/evidence/platform/rm1/p4/canonical-performance-ledger.json`（26 行的 `budget` 字段）
- `apps/backend/catering-business-server/src/test/java/database/P4SqlOperationBudgetTest.java:75-79`（`REQUIRED_LEDGER_IDS` 硬编码 Set）、`:299`（O5 常量）

**反例搜索范围**：ledger 全部 26 行的 `budget` 与测试中全部
`assertFixed(executed, "<id>", <n>, …)` / `assertAtMost(<n>, measure("<id>"…))` 常量，逐条比对。

**已发生的漂移（唯一数值直接矛盾，本会话逐字复核）**：

```
ledger O5 :  "callerSymbol": "OrganizationAssignmentCandidateService#listEnabled"
             "fixture": "100 candidates"
             "budget" : "fixed <= 4 SQL"

测试 O5   :  P4SqlOperationBudgetTest.java:299
             assertFixed(executed, "O5", 5,
               () -> assertEquals(100, assignmentCandidates.listEnabled(workspace, KEY, "STORE").size()),
               () -> assertEquals(100, assignmentCandidates.listEnabled(workspace, KEY, "STORE").size()));

同一 id、同一 callerSymbol（测试 :106 的 Map.entry 亦为 listEnabled）、同一 fixture 规模，
**声明预算 4，执行预算 5**。
```

**为何无人发现——结构性原因**：

```
测试源码中检索 "canonical-performance-ledger" : 0 命中   ← 测试从不读 ledger 文件
REQUIRED_LEDGER_IDS 是测试内硬编码 Set（:75-79），与 ledger 的 26 行独立维护
测试 :75 的注释原文：
  "The prospective S6 is deliberately included before the ledger file is amended."
  ← 作者自己记录了两份清单会脱节
```

`executed` map 的**唯一**最终用途是 `:336`
`assertEquals(REQUIRED_LEDGER_IDS, executed.keySet(), "every canonical row must execute a real production call")`
——只对账**id 集合**，**从不对账 budget 数值**。

**为何是 M（而非 S）**：核验点 4 要求「26 行 ledger、实际生产调用集合、动态 SQL budget……是否一致」。
id 集合一致（26/26 均被度量，这点做到了），但**budget 数值不一致且无控制**。
后果不是当下功能错误，而是：**ledger 作为权威分母失效**——
将来把某行预算从 2 改到 20，ledger 仍写着 2，没有任何门会红；
O5 就是这条路径已经走过一次的证据。

**最小修复**
1. 修正 O5：确定真实观测值，把 ledger 与测试统一到同一个数（并说明为何是那个数）；
2. **测试直接从 `canonical-performance-ledger.json` 读取 `id` 与 `budget`**，
   删除 `REQUIRED_LEDGER_IDS` 与各处内联常量——分母与预算只保留一份；
3. 加机械控制：ledger 的 `budget` 必须可解析为数值上界（现有 S3/S6/M13/R8 为散文，
   见 §4-N2），且与实测值做 exact 比较或 `<=` 比较后**回写实测值**，任一不符具名红。
   红变异 = 把 ledger 任一 budget 改一个数，测试必须红。

**是否需要 Dexter 产品裁决**：**否**。

---

## 2. S（应修复）

### S1 ｜"每条 ledger 行均有真实 red mutation"不成立

**owning source**：`P4SqlOperationBudgetTest.java`
（`counterSeesAllJdbcStatementExecutionAndTheExistingRepeatedReadMutationIsRed`）；
`doc/evidence/platform/rm1/p4/canonical-performance-ledger.json`（行 schema）

**事实**：

- ledger 行 schema 为
  `{id, roots, identity, classification, owner, testClass, fixture, budget, disposition}`
  ——**没有 `redMutation` 字段**，26 行无一携带红证据。
- 测试中**唯一**的显式红：

```java
AssertionError red = assertThrows(AssertionError.class,
    () -> assertAtMost(1, measure("COUNTER-RED",
        () -> storeIds.forEach(storeId -> contracts.derivedStoreStatus(workspace, KEY, storeId)))));
assertTrue(red.getMessage().contains("SQL budget exceeded"));
```

**这条红是有价值的**——它用一个**真实的 N+1**（对 100 个 store 逐个调用）证明
计数器看得见全部 JDBC 执行、且 `assertAtMost` 确实会抛。
**它不是 scanner 自测**，这点符合核验点 5 的下限要求。

**但它证明的是度量装置有效，不是 26 行各自的预算是紧的。** 核验点 5 原文要求
「每条 ledger 行均有真实 red mutation……不能用 scanner 自测或整套测试绿替代」，
当前形态恰是「整套测试绿 + 一条装置红」。

**具体风险**：预算若设得松于实测值，该行的断言永远不会红。
M1 的 O5（声明 4、执行 5）正是这一风险的实例——
若真实观测为 4，则测试的 5 是一格松弛，任何回归到 5 都不会被发现。

**最小修复**（两条二选一，或并用）
1. **收紧到实测值**：把每行 budget 设为**实测的精确值**并断言 `assertEquals`（而非 `assertAtMost`），
   使任何 +1 回归立即红。这样无需 26 条变异——断言本身即是紧的。
2. 若保留 `assertAtMost`，则为每行补一条**该行自己的**真实回归变异
   （例如把该 caller 的批量解析改回逐行），证明该行预算能红。

作者若采用方案 1，请在 exit 中说明「以紧断言替代逐行变异」的理由，
以免后续复核按核验点 5 的字面要求再次判红。

---

## 3. 达成的部分（不得在整改中回退）

### 3.1 核验点 1 ｜两侧邀请读取均在 owner 内闭合，mapper 纯映射

**平台侧**（`PlatformWorkspaceInvitationController:35` → `invitations.managementPage(...)`）与
**运营侧**（`OperationsWorkspaceInvitationController:59` → `invitations.managementPageForOperations(...)`）
最终都进入 `WorkspaceInvitationService.managementPage(...)`（`:174-195`）：

```java
long total = jdbc.queryForObject("SELECT COUNT(*) FROM workspace_iam.invitation i WHERE " + sql.where(), …);
if (total == 0) return new ManagementInvitationPage(List.of(), …, 0L, …);
List<...> rows = jdbc.query(
    "SELECT … FROM workspace_iam.invitation i WHERE " + sql.where()
  + " ORDER BY i." + page.orderColumn() + " " + page.direction() + ", i.id " + page.direction()
  + " LIMIT ? OFFSET ?", …);
return new ManagementInvitationPage(managementViews(rows), …, total, …);
```

count / filter（`sql.where()`）/ sort（SQL `ORDER BY`，含 `i.id` 稳定次序）/ `LIMIT` `OFFSET`
**全部在 owner 内**；`managementViews(rows)` 只 bundle **当页**行。

**mapper 纯 DTO→wire**（`WorkspaceInvitationPageWireMapper.java`，27 行全文已读）：
无 `subList`、无 `skip/limit`、无 service 调用；类注释自陈
「Maps an already filtered, sorted and bounded owner page; it never paginates an unbounded list.」
——与实现一致。

### 3.2 核验点 2 ｜operations target 由 endpoint 写死

`OperationsWorkspaceInvitationController` 每条路由把类型作为**字面量**传入
（`"REGION"` / `"PROJECT"` / `"HEAD_COMPANY"` / `"STORE"` 等），
再由 `managementPageForOperations(session, expectedTargetType, requestedScopeRef, …)`
交 `user.resolveTaskScope(session, expectedTargetType, requestedScopeRef)` 做服务端 scope 解析。
方法注释：「the endpoint-fixed type is never inferred from the session」——与实现一致。
**不从 pageKey、session assignment type 或客户端提交的类型推导。**

### 3.3 核验点 3 ｜S3/S6 的规模与授权双重验证

```java
private static void assertFixed(Map<String,Integer> executed, String id, int budget, SqlOperation one, SqlOperation hundred) {
    int oneCount = measure(id, one);
    int hundredCount = measure(id, hundred);
    assertAtMost(budget, oneCount);
    assertAtMost(budget, hundredCount);
    assertEquals(oneCount, hundredCount, () -> id + " SQL count grew from P=1 to P=100");   // ← 真有界性
}
```

S3（platform）与 S6（operations）各自以 `pageSize=1` 与 `pageSize=100` 度量，
并经 `assertInvitationPage(page, itemCount, total)` 同时校验 `items().size()` 与 `total()`：

```
S3  platform  : items 1/100,  total 103
S6  operations: items 1/100,  total 102   ← 少 1，范围过滤仍生效
```

**这个 103 vs 102 的差值是本次复核认为最有说服力的一条**——
它同时证明了「分页正确」与「授权范围未被优化破坏」，
而后者正是 P4 这类改动最容易悄悄弄坏的东西。

### 3.4 E-0 形状清零与批量化落实

```
全仓 src/main 中「RowMapper lambda 体内出现 jdbc.」：0 命中
```

`OrganizationAssignmentCandidateService.listEnabled`（原 P-E8 的逐行 `describePath`）
现在 RowMapper 只取 UUID，随后 `candidates(...)` 用
`taskPaths.requireTaskPaths(workspaceUuid, key, targets)` **一次批量解析**全部路径。

26/26 ledger 行均在预算测试中执行了**真实生产调用**（`:336` 的 id 集合 exact 对账）。

---

## 4. N（观察项）

**N1 ｜`managementListForOperations` 是无界方法且零生产调用方**

`WorkspaceInvitationService.java:149` 的 `managementListForOperations` 内部调用
`list(...)`（`:124`，`SELECT … FROM invitation WHERE workspace_uuid=? AND group_workspace_key=?
ORDER BY …`，**无 LIMIT**），随后全量物化、在 Java 侧过滤。

**本会话确认其生产调用方为 0**（唯一命中是自身定义），两个 controller 均走有界分页路径，
故**不构成当前缺陷**。但它是一条随时可被重新接线的无界路径，
且与 P4-F「消除全量物化」的目标形状相悖。建议删除或标注为禁止接线。

**N2 ｜4 条 ledger budget 是散文，不可机械比较**

`S3` / `S6` 为 `"fixed owner page budget with no record-count or page-size amplification"`；
`M13` 为 `"<= 1 SQL; object I/O after cursor"`；`R8` 为 `"<= 2 SQL; nested extractor query = 0"`。
这四条无法与测试常量做数值对账（与 M1 的修复第 3 项相关）。
其中 M13/R8 的附加语义（游标关闭、嵌套查询为 0）确有对应测试
（`m13ClosesTheJdbcResultSetBeforeTheAssetObjectProbe`、R8 的 nested extractor 断言），
故语义未丢，只是不可数值对账。

**N3 ｜多条 `assertFixed` 的两个 lambda 完全相同，规模不变性断言恒真**

例如 M1、M5、M6、O5 的 `one` 与 `hundred` 是同一调用（同参数），
`assertEquals(oneCount, hundredCount)` 对这些行**恒成立**、不提供信息。
**不构成缺陷**——这些是非分页读取，其有界性由「fixture 已在 100 规模下
`assertAtMost(budget, count)`」证明（如 M5 断言 `list(...).size() == 100` 而预算 1 SQL）。
仅记录以免后续复核误读为"已验证规模不变性"。

**N4 ｜本会话未重跑测试**

`./gradlew` 仍不存在（P0 遗留欠账），故本复核对 `P4SqlOperationBudgetTest` 的判断
基于**逐行读源码**（断言语义、budget 常量、fixture 规模），
**非本会话重跑**。标 `VERIFIED_BY_SOURCE_NOT_BY_RERUN`。
M1 的 O5 矛盾是**静态可判**的（两个工件的字面量直接比对），不依赖运行。

---

## 5. 处置与再复核条件

| finding | 性质 | 处置 |
| --- | --- | --- |
| M1 | 权威工件与执行断言无对账且已漂移 | Codex 自主修复；不需要 Dexter 裁决 |
| S1 | 红证据充分性 | Codex 自主修复；若采用"紧断言替代逐行变异"，须在 exit 说明理由 |
| N1–N4 | 观察 | 不阻塞 |

**再复核条件**：M1（修正 O5、测试直接读 ledger、budget 数值对账并配红变异）与
S1（收紧断言或补逐行变异）闭合后可复评。

**本复核不授权**：进入 P5、修改 Roadmap 状态、DEV、seed、reset、动态环境操作。
