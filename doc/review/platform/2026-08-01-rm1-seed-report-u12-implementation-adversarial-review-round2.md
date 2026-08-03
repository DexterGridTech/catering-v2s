---
title: RM1 Seed Report U12 implementation adversarial review round 2
REVIEW_CYCLE_ID: RM1-R5-SEED-REPORT-IMPLEMENTATION-20260801
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 2
REVIEW_ROUND_LIMIT: 2
reviewerKind: INDEPENDENT_SUBAGENT
reviewerStance: BLIND_FALSIFICATION_FIRST
ROUND_FINAL_DECISION: SELF_DECIDED
verdict: NO-GO
findings: M=0 / S=2 / N=2
---

# RM1-SEED-REPORT-U12 implementation review — final round

本轮按同一 review cycle 重开实际生产源码、U12 design/package input、最新 package-exit、最新 fresh L2 evidence 以及 round-1 finding。仍以证伪为优先；没有执行 DEV、seed、reset，也没有修改源码。`ROUND_FINAL_DECISION=SELF_DECIDED` 表示本轮是 review governance 允许的最终独立裁决，不是第三轮审查。

## 复核输入

- `doc/evidence/platform/rm1/p6/rm1-seed-report-package-design.md`
- `doc/evidence/platform/rm1/p6/rm1-seed-report-package-input.json`
- `doc/evidence/platform/rm1/p6/rm1-seed-report-package-exit.json`
- `doc/review/platform/rm1-seed-report-u12-delivery-manifest.json`
- `doc/review/platform/2026-08-01-rm1-seed-report-u12-implementation-adversarial-review-round1.md`
- `scripts/test/seed-report.mjs`, `scripts/test/seed-report.test.mjs`
- `scripts/test/r5-joint-remote-l2-fixture.mjs`, `scripts/test/r5-joint-remote-l2.mjs`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/diagnostic/SeedRequestMetricsInterceptor.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/configuration/BusinessDataConfiguration.java`
- `apps/backend/catering-business-server/modules/foundation/src/main/java/com/catering/v2s/platform/foundation/persistence/{CountingDataSource,DatabaseOperationTracker}.java`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/configuration/SeedDiagnosticConfigurationTest.java`
- `apps/backend/catering-business-server/modules/foundation/src/test/java/com/catering/v2s/platform/foundation/persistence/DatabaseOperationTrackerTest.java`

## Fresh evidence independently confirmed

最新 run 为 `.runtime/r5/joint-local-l2/rm1p6-joint-local-l2-1785561443749-14291-90c3284a`：

- `results/seed-report.json` 为 `PASS`，`apiCallCount=63`、`reportedApiCallCount=63`、`endpointGroupCount=26`，unmatched HTTP/database event 均为空；`nonApiStageIds` 与 `expectedNonApiStageIds` exact-set 相等。
- `evidence/terminal-report.json` 的 business 与 cleanup 分栏且均 `PASS`，无 first failure。
- package dynamic evidence 当前绑定 12 个 source/test path；三条 control 的 red proof 分别指向 `seed-report.test.mjs`、`DatabaseOperationTrackerTest.java`、`SeedDiagnosticConfigurationTest.java`，不再复用一个 SHA。
- `node --test scripts/test/seed-report.test.mjs` 当前 4 项均 PASS。

这些事实证明最新受管运行及 source-hash ledger 的大部分 round-1 修复已落地；它们不自动证明 focused proof 覆盖了详设声明的所有边界。

## Round-1 finding dispositions

### M1（round-1）— PARTIALLY_CONFIRMED，核心阻断已修复但路径清单仍不完整

round-1 指出的“dynamic source hashes 缺少 DB wiring/tracker/tests、三个 control 共用一个 red proof”已经修复：12 个当前 source hashes 可独立复算，三条 control 的 proof path distinct，且最新报告指向这些源码。

但 package exit 的 `changedPaths` 仍不包含当前实际修改的 `BusinessDataConfiguration.java` 与 `scripts/dev/r5-dev-runner.mjs`；delivery manifest 也没有列出这两个 owning source。`BusinessDataConfiguration` 是 DB `CountingDataSource` post-processor 的实际接线点，不能只出现在动态 hash 而从包的实际变更文件清单/manifest 缺席。该残余是 evidence/path-ledger 问题，不再把它计为 M（source binding 的核心缺口已关闭），但列为 S2。

### S1（round-1）— REJECTED_WITH_EVIDENCE：SIGTERM 已有受控 handler

fixture 现在注册 `process.on('SIGTERM', ...)`，设置受控失败原因、同步调用 `finalizeSeedReport(2)` 并设置非零 exit code；与 `exit`/异常路径的幂等 `reportWritten` 配合，round-1 的“完全没有 SIGTERM 路径”已不成立。

### N1（round-1）— REJECTED_WITH_EVIDENCE：网络失败已进入 API 分母

`request` 在 fetch 抛错时记录一次 status `0` 的失败 call、耗时和安全诊断，再 fail-closed。由于 requestId 缺失，报告会保持 FAIL，而不会把失败冒充为完成；该行为同时满足“调用进入分母”和“completion 缺失不可 PASS”。

### N2（round-1）— REJECTED_WITH_EVIDENCE：non-API stage 已做 exact-set

fixture 将闭集 `expectedNonApiStageIds` 传入 `buildSeedReport`；aggregator 对排序后的实际/期望集合做比较，focused test 覆盖 mismatch，最新 run 的两者完全相等。

### N3（round-1）— PARTIALLY_CONFIRMED：canonical path 与 route-key duplicate 已修复，operationId duplicate 仍无本地断言

服务端事件现在优先写 `state.actual().path()`；Java loader 对重复 `METHOD + path` 已 fail-closed。当前 generated registry 的 operationId 实测无重复，且生成门可提供额外保护，但 `SeedRequestMetricsInterceptor.loadDefinitions` 本身没有对重复 `operationId` 做断言；Node `loadGeneratedOperationRegistry` 也只校验字段存在。该边界不影响当前 registry run，降为 N1。

### S3（round-1）— REJECTED_WITH_EVIDENCE（同 JVM 边界）

`SeedRequestMetricsInterceptor.append` 现在使用静态 `EVENT_LOCK` 包住目录创建、权限设置和 JSONL append，同一 Spring JVM 内的并发 completion 不会因多个 interceptor 实例而交错。当前 package 是单业务 deployable；没有证据表明它需要跨进程共享同一个 events file。并发 focused test 仍可作为增强项，但 round-1 的“没有 mutex”已不成立。

## Remaining findings

### S1 — focused proof 与详设声明不一致（CONFIRMED）

详设声明 backend proof 覆盖 statement execute 计数、zero-vs-missing、seed activation/default-off 和 canonical route mismatch；report writer 还声明 secret rejection、atomic write、`0600` 与异常生命周期。实际 focused proof 仍只有：

- `SeedDiagnosticConfigurationTest`：一个 default-off 测试；没有可注入环境的正向 `r5-full` 激活、错误 secret、canonical mismatch 或事件输出验证。
- `DatabaseOperationTrackerTest`：只直接调用 `DatabaseOperationTracker.record`；没有 `CountingDataSource`/JDBC statement execute 集成断言，也没有 zero-vs-missing 事件语义。
- `seed-report.test.mjs`：聚合、missing completion、metadata drift、non-api exact-set/atomic permission 四项；没有 secret-field rejection、并发 append 或 server-side interceptor red mutation。

最新 63/63 run 证明了一次真实请求链能产出非零 DB metrics，但不能替代这些 focused boundary proof；三个 control 不能仅凭 distinct redProof 文件名即视为其声明的全部失效模式均已被机器红变异覆盖。最小修复是补齐与实际控制一一对应的 focused tests，或把详设/控制声明收窄到当前真正证明的边界。

### S2 — package changed-path/manifest 清单仍漏 owning source（CONFIRMED）

本包的变更路径清单应能让 reviewer 定位本包实际改过的文件。当前 `git status` 显示 `BusinessDataConfiguration.java` 与 `scripts/dev/r5-dev-runner.mjs` 被修改，但 `rm1-seed-report-package-exit.json.changedPaths` 和 U12 delivery manifest 都没有它们；前者是 DB 计数接线根因文件，后者负责生成 run-scoped secret/run/event wiring。动态 hash 虽已包含二者，路径清单与 manifest 仍不一致，reviewer 若仅按 package declared surface 会漏读真实 owner source。最小修复是补齐 manifest/changedPaths 并重新复核其 source scope，不应删除动态 hash 来掩盖差异。

## Non-blocking observations

### N1 — operationId duplicate 的本地 fail-closed 断言缺失（PARTIALLY_CONFIRMED）

当前 registry 实测 147 entries 无重复 operationId，generated edge-codegen 也有集合型 gate；因此没有当前数据缺陷。但 server loader 与 Node helper 本身只拒绝空字段/重复 route key，不拒绝重复 operationId。若希望报告层在生成门失效时仍保持独立 fail-closed，应增加 operationId uniqueness assertion；否则必须在 package 文档明确由 generated gate 单独承担该前提。

### N2 — 跨进程共享 events file 未纳入本包（UNVERIFIED_REQUIRES_EVIDENCE）

静态锁只保护同 JVM；若未来多个业务进程共同写同一 `V2S_SEED_REPORT_EVENTS`，仍需 OS file lock 或单 writer。当前环境矩阵是一个本机业务 deployable、单 runner，未发现该场景实际存在，故不作为本轮阻断。

## Final verdict

**NO-GO — M=0 / S=2 / N=2**

round-1 的 source hash/proof 绑定、SIGTERM、网络失败分母、nonApi exact-set、canonical route 和同 JVM mutex 反例均已处理或被证伪；但 focused proof 仍没有覆盖详设列明的 activation/DB integration/secret/lifecycle 失效模式，且 package path/manifest 仍遗漏两个实际 owning source。两项 S finding 关闭前，不接受 U12 implementation package PASS。`ROUND_FINAL_DECISION=SELF_DECIDED`；本 review cycle 已达到 `REVIEW_ROUND_LIMIT=2`，不得再召集第三轮，仅可由作者基于 findings 修复后进入新的批准 review cycle。
