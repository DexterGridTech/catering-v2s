---
title: RM1 P4 整改后实现复核（Claude，round-2）
reviewTarget: IMPLEMENTATION
scope: RM1-P4 current bytes（M1/S1 整改）
verdict: GO
findings: M=0 / S=0 / N=4
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅复审 P4；不进入 P5、不改 Roadmap、不做 DEV/seed/reset
createdAt: 2026-07-29
---

# RM1 P4 整改后实现复核（round-2）

## 0. 结论

**GO**，`M=0 / S=0 / N=4`。

上轮 **M1 与 S1 均真实关闭**，且关闭方式比我建议的更强。

| 上轮 finding | 关闭方式 |
| --- | --- |
| **M1** ledger budget 与测试常量两套账、已漂移（O5：4 vs 5） | ledger 成为唯一权威：26/26 行改结构化 `EXACT_SQL_STATEMENTS`（散文预算归零），测试**直接读 ledger**，`rowId`/`callerSymbol`/`caseId`/`expectedStatements`/`actualStatements` 五项逐条对账，case-set 由 ledger 派生做 exact equality。O5 统一为 **5**（实测值） |
| **S1** 26 行无逐行 red mutation | 改为**紧断言**：每 case `assertEquals(ledgerExpected, actual)`，任一 ±1 回归立即红——**强于 26 条松上界变异**；真实 N+1 红仍在，独立证明计数器有效 |

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）；变异在 scratchpad 完整拷贝上做。

**授权边界**：仅复审 P4。不进入 P5、不改 Roadmap、不做 DEV/seed/reset。

---

## 1. ledger 是否已成为唯一权威 —— `CONFIRMED`

**owning source**：`doc/evidence/platform/rm1/p4/canonical-performance-ledger.json`；
`apps/backend/catering-business-server/src/test/java/database/P4SqlOperationBudgetTest.java:80`、`:438-450`；
`tools/performance/canonical-ledger-scanner.mjs:150-170`

**结构**：26 行**全部** `budget.mode === "EXACT_SQL_STATEMENTS"`，
`expectedStatements` 全为整数，**散文预算 0 条**（上轮 S3/S6/M13/R8 的散文已消除）。

**测试确实读 ledger**（`:80` `LEDGER_RELATIVE_PATH`，解析为 `LedgerRow(callerSymbol, exactStatements)`），
`assertExactLedgerBudget`（`:438-447`）逐条对账：

```java
if (row == null) throw new AssertionError("canonical ledger row missing: " + id);
assertEquals(NAMED_LEDGER_OPERATIONS.get(id), row.callerSymbol(), "ledger caller identity drift: " + id);   // caller 漂移红
Integer ledgerExpected = row.exactStatements().get(caseId);
if (ledgerExpected == null) throw new AssertionError("canonical ledger case missing: " + id + "#" + caseId); // case 漂移红
assertEquals(ledgerExpected.intValue(), localExpected, "local test budget drift: " + id + "#" + caseId);     // 常量漂移红
if (ledgerExpected.intValue() != actual) exactBudgetDrifts.add(…);                                           // 实测漂移收集
```

`exactBudgetDrifts` 在 `:348` **被断言抛出**
（`if (!exactBudgetDrifts.isEmpty()) throw new AssertionError("exact SQL budget drifts: " + …)`）
——不是收集后无人过问。

**case-set 由 ledger 派生**（`:450` `requiredLedgerCases()` 从 `canonicalLedger` 展开 `id#caseId`），
`:346` `assertEquals(requiredLedgerCases(), executed.keySet(), …)`。
故 ledger 增行 / 减行 / 增删 case 均使两侧集合不等 → 红。

**上轮的 O5 漂移已修**：ledger `O5.cases = [{FIRST_CALL,5},{SECOND_CALL,5}]`，
测试 `assertFixed(executed,"O5",5,…)`，两侧一致。

**scanner `check` 对 budget schema fail-closed（scratchpad 独立变异）**：

| 变异 | `canonical-ledger-scanner.mjs check` |
| --- | --- |
| 把 `O5.budget` 改回散文字符串 | `FAIL / CANONICAL_LEDGER_ROW_BUDGET_CONTRACT_INVALID:O5` |
| 删掉某 case 的 `expectedStatements` | `FAIL / …BUDGET_CONTRACT_INVALID:O5` |
| `expectedStatements = 0` | `FAIL / …BUDGET_CONTRACT_INVALID:O5` |
| 改 `callerSymbol` | PASS（由测试 `:441` 兜住，见 N2） |
| 新增第 27 行 | PASS（由测试 case-set 兜住，见 N2） |

scanner 另有 `candidateScan.count/fingerprint` 与**当场重新 derive** 的结果比对
（`:167-169`），故 ledger 的候选扫描锚点不会静默变陈旧。
实跑 `check` → `PASS / ROWS=26 / CANDIDATES=393`；`--self-test` → 三类 RED 全 PASS。

> **披露**：我首轮变异用了默认命令（`scan`，只派生输出、不校验），四类变异全部 EXIT=0，
> 一度得出"scanner 不 fail-closed"的结论。**那是我的命令用错，不是缺陷。**
> 改用 `check` 后 A/B/C 正确变红。记录以免后续会话误判。

---

## 2. exact equality 是否足以替代 26 次逐行 mutation —— `CONFIRMED`

**足以，且更强。**

上轮的形态是 `assertAtMost(budget, actual)` + 松上界，风险是"预算松于实测则永不红"。
现在是**每 case 精确相等**：`assertEquals(ledgerExpected, actual)`（经 `exactBudgetDrifts` 汇总后抛）。

- 任一 case 的实际 SQL 数 **+1 或 −1 都会红**，无需为每行单独构造 N+1 变异；
- 逐行变异只能证明"该行能红一次"，精确断言证明"该行**任何**偏移都红"——覆盖面更大；
- 51 个 case 全部落在这一机制下。

**真实 N+1 红仍在且仍验证计数器**（`:396-397`）：

```java
AssertionError red = assertThrows(AssertionError.class,
    () -> assertAtMost(1, measure("COUNTER-RED",
        () -> storeIds.forEach(storeId -> contracts.derivedStoreStatus(workspace, KEY, storeId)))));
assertTrue(red.getMessage().contains("SQL budget exceeded"));
```

这条用**真实的 100 次逐行调用**证明计数器看得见全部 JDBC 执行、断言确实会抛
（`:484` 抛出点）。**不是 scanner 自测，也不是整套绿。**
两者分工正确：精确断言守每一行，真实 N+1 守计数装置本身。

---

## 3. S3/S6 未回退 —— `CONFIRMED`

```java
assertFixed(executed, "S3", 7,
    () -> assertInvitationPage(invitations.managementPage(workspace, KEY, invitationPageRequest(1)),   1,   103),
    () -> assertInvitationPage(invitations.managementPage(workspace, KEY, invitationPageRequest(100)), 100, 103));
assertFixed(executed, "S6", 11,
    () -> assertInvitationPage(invitations.managementPageForOperations(regionSession, "REGION", regionId, invitationPageRequest(1)),   1,   102),
    () -> assertInvitationPage(invitations.managementPageForOperations(regionSession, "REGION", regionId, invitationPageRequest(100)), 100, 102));
```

- **pageSize 1/100 双点**保留；
- `assertInvitationPage` 同时校验 `items().size()` 与 `total()`；
- **`total` 仍为 103（platform）/ 102（operations）** ——授权范围过滤未回退，
  这个差值仍是本包最有说服力的一条证据；
- 预算从上轮的 8/12 **收紧为 7/11**（ledger 与测试一致）。

**无界方法已删除**：`managementList` / `managementListForOperations` 全仓命中 **0**；
两个 controller 仅调 `managementPage` / `managementPageForOperations`（`managementView` 为单条读，不涉分页）。

---

## 4. package exit 的动态证据绑定 final bytes —— `CONFIRMED`

```
business = "PASS"        dynamicEvidence = 1 条
currentSourceHashes 与当前字节不符 : 0
log 文件缺失或 hash 不符            : 0
actualChangedPaths 38 == incrementalChecks 38，exact-set : True
afterSha256 与当前字节不符 : 0
```

---

## 5. N（观察项，不阻塞）

**N1 ｜来件称"52 个 case"，ledger 实为 51**

25 行 × 2 case + `M13` × 1 case = **51**。`requiredLedgerCases()` 由 ledger 派生，
故测试与 ledger 自洽于 51；差异只在来件表述。
建议后续文档统一为 51，以免该数字被继续传播。

**N2 ｜漂移检测分布在两个工件上，单跑 scanner 不足**

`callerSymbol` 漂移与"新增一行 ledger"两类，`scanner check` **不红**，
由测试 `:441` 与 `:346` 的 case-set equality 兜住。覆盖是完整的，但**必须两者都跑**。
建议在 P8 前把这两类也纳入 scanner `check`，使单一工具即可判定，
或在 exit 中显式声明"漂移检测由 scanner + budget test 共同构成"。

**N3 ｜测试内 `REQUIRED_LEDGER_IDS` 已冗余，且注释陈旧**

`:85` 的硬编码 id Set 现已被 `requiredLedgerCases()`（ledger 派生）覆盖，
`:262` 的 `assertEquals(REQUIRED_LEDGER_IDS, NAMED_LEDGER_OPERATIONS.keySet())` 退化为测试内部自洽检查。
`:82` 仍留有上一形态的注释「The prospective S6 is deliberately included before the ledger file is amended」——
该情形已不存在，建议删除以免误导。

**N4 ｜本会话未重跑 JUnit 预算测试**

`./gradlew` 仍不存在（P0 遗留欠账）。本复核对预算测试的判断基于**逐行读源码**
（断言语义、ledger 解析、drift 抛出点）与 **ledger/scanner 的实跑与变异**；
预算测试本身的运行结果由 package-exit 的 `dynamicEvidence`（log 与源码 hash 均已复算一致）承担。
标 `VERIFIED_BY_SOURCE_AND_ARTIFACT_NOT_BY_RERUN`。
本轮结论中**不依赖运行**的部分：ledger 结构、测试是否读 ledger、drift 断言存在性、
scanner 变异行为、无界方法删除——均为静态可判。

---

## 6. 处置

**M=0 / S=0 / N=4。** 无需 Dexter 产品裁决。**RM1 P4 可 GO。**

**本复核不授权**：进入 P5、修改 Roadmap 状态、DEV、seed、reset、动态环境操作。
