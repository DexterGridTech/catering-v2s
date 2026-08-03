---
title: RM1-SEED-REPORT-U12 seed-report 与联合 L2 收口最终实现裁决（Claude）
reviewTarget: IMPLEMENTATION
scope: RM1 P6-3 minimal owner-command seed、19-spec 本机 joint L2、远端非生产中间件 namespace、business/cleanup evidence
verdict: GO
findings: M=0 / S=1 / N=2
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅覆盖当前 minimal owner-command seed 与 19-spec joint L2；不包含 reset、UAT、Roadmap 状态变更或未来完整 32 场景 r5-full seed
createdAt: 2026-08-01
---

# RM1-SEED-REPORT-U12 最终实现裁决

## 0. 结论

**GO — `M=0 / S=1 / N=2`。**

round-2 的 **`S2`（owning-source denominator）我确认已真实闭合**；
**`S1` 的四项主体（正向 activation、canonical mismatch、DataSource/JDBC、zero-vs-missing）也已真实落地，
且我用红变异证明它们会红**。

唯一的 `S` 是 `S1` **被整体记为 `CONFIRMED_AND_REMEDIATED`，但其列举清单里的两项 secret 负面用例仍未覆盖**——
其中报告写入侧那一项我已**机器证明未被覆盖**（删掉守卫，5/5 仍全绿）。
两处守卫的**实现本身是对的**（我逐行读过），缺的是证明，且面向非生产、默认关闭，故不阻断实现裁决。

## 1. 我独立复核到的事实

### 1.1 package 与 hash 链

| 项 | 结果 |
| --- | --- |
| active package | `RM1-SEED-REPORT-U12`，predecessor `RM1P6-JOINT-REMOTE-L2-U11` |
| `packageId` | active / input / exit **三处一致** |
| `PACKAGE_EXIT` | **`PASS`**，`CHANGED=455`（changedPaths 455 条、无重复，与 receipt delta 双向 exact-set） |
| `deliveryManifestSha256` | 声明 `1fc53e38…` vs 实算 `1fc53e38…` **一致** |
| `predecessorExitSha256` | 声明 `01d3c056…` vs U11 exit 实算 `01d3c056…` **一致** |
| `currentSourceHashes` | **12/12 与当前字节一致，0 漂移** |
| controls | 三条均 `ACTIVE_RED_VERIFIED`，**redProof 路径互不相同且 hash 逐条复算一致** |

其余门 fresh 复跑：`R5_CONTRACT=PASS; STATE=POST_GATE_0`、`R5_AFFECTED_L2=PASS`、
`CAPABILITY_INVARIANTS=PASS`、`R5_FRONTEND_ARCHITECTURE=PASS`、`R5_SECURITY_BOUNDARIES=PASS`、
`R5_OPENAPI_CONTRACTS=PASS`、`CODE_LAYOUT=PASS`、`STANDARDS_COVERAGE=PASS`、
static-scan `MODE=RM1_STATIC_ADMISSION`，exit code 均为 0。

> 说明：直接对 `rm1p6-u11-…-package-exit.json` 跑 `validate-package-exit` 会得到
> `PACKAGE_EXIT_INVALID`，这是**正常的**——U11 已不是 active package，
> 该校验以 `packageState.packageId` 比对。不是缺陷。

### 1.2 seed-report（按真实 schema 重算，不采信自报值）

最新 run `rm1p6-joint-local-l2-1785562067060-28729-51a5d4bd`，三份工件的 sha256 我逐个复算，
与 `dynamicEvidence` 声明**全部一致**：`terminal-report.json`(`caea6837…`)、
`results/seed-report.json`(`b28e956b…`)、`evidence/phases.jsonl`(`1962dca6…`)。

`completeness` 实测：

```
seedProfile=r5-full   status=PASS   firstFailure=null
apiCallCount=63       reportedApiCallCount=63       endpointGroupCount=26
unmatchedHttpEvents=[]                unmatchedDatabaseEvents=[]
nonApiStageIds == expectedNonApiStageIds   (8 == 8，双向差集为空)
```

**关键交叉验算（非自报）**：我对 `apiEndpoints` 的 26 个分组逐个取 `callCount` 求和 = **63**，
与 `apiCallCount` 一致；`apiEndpoints` 数组长度 = **26**，与 `endpointGroupCount` 一致；
`nonApiStages` 实际条目 = 8，`stageId` 与两个集合逐一对应。
每个 endpoint 同时带 HTTP 与 **DB** 的 average/min/max（如 `platformPasswordLogin`：
`databaseOperationCount {8,8,8}`、`databaseDurationMs {222,222,222}`），
说明 DB 计数链路真实产出了非零数据，不是占位。

### 1.3 联合 L2 与 cleanup

`exactSpecs=19`，`platform 9 passed (44.9s)` / `operations 10 passed (1.2m)`（真实 Playwright 输出）；
`business` 与 `cleanup` **分栏且各自 PASS**，`firstFailure=null`；
远端三项 absence readback `databaseAbsentAfterCleanup / roleAbsentAfterCleanup / assetAbsentAfterCleanup`
**均为 true**，`removed=true`。

### 1.4 round-2 `S2`（owning-source denominator）—— CLOSED

`BusinessDataConfiguration.java` 与 `scripts/dev/r5-dev-runner.mjs`
**同时出现在** `changedPaths`、U12 delivery manifest、以及 12 条 `currentSourceHashes` 中。
`changedPaths` 的完整性由门本身以 exact-set 对账（`CHANGED=455` 通过），不是人工清单。

### 1.5 round-2 `S1` 的主体 —— 已落地且**红变异可证**

**`DatabaseOperationTrackerTest.dataSourceDecoratorRecordsStatementExecution`** 是真集成断言：
构造 `DataSource → Connection → Statement` 三层 JDBC 代理，经
`new CountingDataSource(delegate)` 包装后调用 `executeUpdate("ignored")`，断言
`snapshot().count() == 1` 且 `operations().getFirst().kind() == "UPDATE"`。
装饰器不生效或记错类型都会红。这正是 round-2 指出缺失的那一项。

**`SeedDiagnosticConfigurationTest`** 三例：default-off、
`validSeedActivationUsesSecretAndServerCanonicalMetadata`（非生产 `r5-full` + 正确 secret，
断言 `preHandle` 激活、`X-Correlation-Id` 生成、**事件文件中写入服务端 canonical 的
`operationId` 与 `routeTemplate`**）、
`serverCanonicalMismatchIsRecordedAsFailedObservation`（客户端谎报 `wrongOperation`，
断言事件含 `SEED_OPERATION_METADATA_MISMATCH`）。

**两个 Java 测试都是普通单元测试（无 Testcontainers），并且确实执行过**：
本地 JUnit XML 于 `14:31:43`/`14:31:44` 生成，各 `tests=3 failures=0 errors=0 skipped=0`。

**`seed-report.test.mjs` 我本地实跑 5/5 PASS，并做了四类红变异**（scratchpad 拷贝，本仓零写入）：

| 变异 | 结果 |
| --- | --- |
| baseline | 5 pass / 0 fail |
| `complete` 恒真（废掉 unmatched 与 missing-completion） | **3 fail → RED** |
| `nonApiStagesMatch` 恒真（废掉 non-API exact-set） | **1 fail → RED** |
| `0o600` → `0o644`（废掉原子写权限） | **1 fail → RED** |
| **删除 `SEED_REPORT_SECRET_FIELD` 守卫** | **5 pass / 0 fail → 未覆盖** |

前三项证明这些控制真会红；第四项就是下面的 `S1`。

## 2. S1 ｜两处 secret 守卫已实现但**无任何证明**，而 `S1` 被整体记为已修复

round-2 `S1` 列举的清单里包含**「错误 secret」**（interceptor 侧）与**「secret-field rejection」**（report writer 侧）。
post-remediation resolution 把 `S1` 整体记为 `CONFIRMED_AND_REMEDIATED`，
但这两项**都没有对应用例**：

**(a) report writer —— 机器证明未覆盖**

`scripts/test/seed-report.mjs:115` 与 `:120` 实现了守卫：

```js
if (SECRET_KEY.test(name)) throw new Error('SEED_REPORT_SECRET_FIELD');
...
throw new Error(`SEED_REPORT_SECRET_VALUE:${key}`);
```

但 `grep -i secret scripts/test/seed-report.test.mjs` → **零命中**。
我把 `SEED_REPORT_SECRET_FIELD` 那一行整条删除后重跑，**5 项仍然全绿**（见上表 MUT-4）。
即：`U12-SERVER-CANONICAL-SEED-REPORT` 这条 control 的 redProof 无法拒绝
「报告把 password/secret/token/cookie/authorization/otp/mobile/login 等字段写进产物」这类失效。

**(b) interceptor —— 由源码构造可证未覆盖**

`SeedRequestMetricsInterceptor.java:52`：

```java
if (!active || !validSecret(request.getHeader("X-Seed-Report-Secret"))) return true;
```

三个用例中：
- `seedObservationIsDefaultOffOutsideTheManagedNonProductionProfile` 用**无参构造**
  （interceptor 未激活），虽然传了 `"not-a-valid-secret"`，但 `!active` **先短路**，
  secret 分支根本没被走到；
- 另两个用例都提供**正确** secret。

因此把 `|| !validSecret(...)` 整段删掉，三个用例**仍会全绿**——
即「激活状态下拒绝错误 secret」没有任何红控制。
（此项我无法在本会话机器验证：本机 `gradle` 不在 PATH，Java 侧红变异跑不了；
以上是**源码构造推论**，与 (a) 的机器证明性质不同，特此区分。）

**实现本身是对的**（我逐行读过）：`:45` 要求 `secret.length >= 24` 才可能 `active`，
`:96-97` 用 `MessageDigest.isEqual` 做常时比较且 null-safe。**缺的是证明，不是行为。**

**影响面**：该诊断面默认关闭（受 `non-production` + `r5-full` 双重门控），
血量限于非生产；但它写的是 `0600` 的请求元数据文件，两处守卫正是防「伪造观测」
与「把密钥写进产物」的那道边界。

**最小修复（各一个用例）**：
Node 侧加一条断言「含 `password`/`secret` 键名或 `jdbc:` 值的输入抛
`SEED_REPORT_SECRET_FIELD` / `SEED_REPORT_SECRET_VALUE`」；
Java 侧加一条**激活态 + 错误 secret** 的用例，断言不写事件、不产出 `X-Correlation-Id`。
或者——把 resolution 中 `S1` 的措辞收窄为「activation/canonical/DB/zero-vs-missing 已闭合，
secret 负面用例仍未覆盖」，不要整体宣布 `CONFIRMED_AND_REMEDIATED`。

**是否需要 Dexter 产品裁决**：否。

## 3. N

**N1 ｜`SeedDiagnosticConfigurationTest` 的目录与包名不一致**

文件位于 `src/test/java/com/catering/v2s/app/configuration/SeedDiagnosticConfigurationTest.java`，
但首行是 `package com.catering.v2s.app.edge.diagnostic;`。
它能编译能跑（JUnit XML 名为 `…app.edge.diagnostic.SeedDiagnosticConfigurationTest`），
`code-layout` 也 PASS，但**文件不在它自己声明的包路径下**，
而被测类 `SeedRequestMetricsInterceptor` 恰恰在 `app/edge/diagnostic/`。
按包名去找的人找不到它。建议移动到 `app/edge/diagnostic/` 并同步
control 的 `redProof.path` 与 delivery manifest。

**N2 ｜round-2 `N1` 以「委托给生成门」关闭，但该委托只写在 resolution 散文里**

resolution 称 operationId 重复由 edge-codegen invariant 与 server loader 的重复 route-key
fail-closed 承担。我实测当前 registry **147 条、operationId 无重复**，前提成立。
但这条依赖没有写进 package 的 control/assumption 记录；将来若生成门口径变化，
没有任何工件指回这条假设。建议在 package-exit 或 problem-family 里记一条显式 assumption。

## 4. 处置

- **`S1`** 在既有批准边界内，Codex 可自主处置（两个用例，或收窄 resolution 措辞）。
- **`N1`/`N2`** 为定位性/可追溯性建议。
- **不得回退**：455 条 changedPaths 的 exact-set、12/12 source hash、三条 distinct redProof、
  seed-report 的 63 = Σ26 组交叉验算与 8/8 non-API exact-set、
  三份工件 sha256 绑定、19-spec 9+10 PASS、business/cleanup 分栏、三项 absence readback、
  `dataSourceDecoratorRecordsStatementExecution` 的 JDBC 集成断言、
  以及 Node control 三类红变异能力。
- **本裁决不覆盖**：reset、UAT、Roadmap 状态变更、未来完整 32 场景 r5-full seed。
  ST-11 仍是未关闭的继承债务；本文件不开启新的对抗审查轮次。
