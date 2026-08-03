---
title: RM1 Seed Report U12 implementation adversarial review
REVIEW_CYCLE_ID: RM1-R5-SEED-REPORT-IMPLEMENTATION-20260801
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 1
REVIEW_ROUND_LIMIT: 2
reviewerKind: INDEPENDENT_SUBAGENT
reviewerStance: BLIND_FALSIFICATION_FIRST
verdict: NO-GO
findings: M=1 / S=3 / N=3
---

# RM1-SEED-REPORT-U12 implementation review

本轮为独立、源码优先的反证审查。我没有执行 DEV、seed、reset，也没有修改生产代码。先独立读取实现、测试和最终 evidence，再对作者的 PASS 结论寻找可复现的反例；本文件不是对作者材料的复述。

## 输入与边界

- `doc/evidence/platform/rm1/p6/rm1-seed-report-package-design.md`
- `doc/review/platform/rm1-seed-report-u12-delivery-manifest.json`
- `doc/evidence/platform/rm1/p6/rm1-seed-report-package-exit.json`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/diagnostic/SeedRequestMetricsInterceptor.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/configuration/BusinessDataConfiguration.java`
- `apps/backend/catering-business-server/modules/foundation/src/main/java/com/catering/v2s/platform/foundation/persistence/{CountingDataSource,DatabaseOperationTracker}.java`
- `scripts/test/seed-report.mjs`, `scripts/test/seed-report.test.mjs`
- `scripts/test/r5-joint-remote-l2-fixture.mjs`, `scripts/test/r5-joint-remote-l2.mjs`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/configuration/SeedDiagnosticConfigurationTest.java`
- `apps/backend/catering-business-server/modules/foundation/src/test/java/com/catering/v2s/platform/foundation/persistence/DatabaseOperationTrackerTest.java`

## 独立确认的正向证据

当前指向的动态 run 可以复算：报告为 `PASS`，`apiCallCount=63`、`reportedApiCallCount=63`、`endpointGroupCount=26`，unmatched 集合为空；报告和 terminal report 的 SHA 与 package exit 一致。报告中的业务结果与 cleanup 结果分栏，19 个 spec 也实际存在。已观察到的 DB 计数均为非零，且输出没有发现当前 run 的敏感值泄露。因此本 verdict 不否定这一次运行本身，而是针对“实现/控制已经被 package exit 完整证明”的更强声明。

## Findings

### M1 — package PASS 没有绑定它声称验证的实现与测试来源（CONFIRMED）

`rm1-seed-report-package-exit.json` 的 `changedPaths` 不包含当前已修改的 `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/configuration/BusinessDataConfiguration.java`；其 dynamic evidence 的 `currentSourceHashes` 也没有该文件。该动态 ledger 同样没有绑定 `CountingDataSource.java`、`DatabaseOperationTracker.java`、两份 foundation/diagnostic focused test、`scripts/test/seed-report.test.mjs` 或 `scripts/dev/r5-dev-runner.mjs`。然而三个 ACTIVE_RED_VERIFIED control 都把同一个仅含三项测试的 `scripts/test/seed-report.test.mjs` SHA 当作 red proof。

这使得 package 的 PASS 不能审计地回答“本次运行使用的 DataSource 装饰、request-local tracker、激活边界和生命周期测试，是否就是当前源码所证明的那一组”。63/63 是一个有效运行结果，但不是未绑定 source 的实现集合的证明。最小根因修复是：重新生成 package source/changed-path ledger，将实际 owner wiring、tracker、fixture、runner 与 focused red tests 逐一绑定；如果某些控制没有对应红变异或 focused proof，就缩小控制声明而不是继续复用同一测试 SHA。

### S1 — 设计声称受控 SIGTERM 会尝试落盘，但 fixture 没有 SIGTERM handler（CONFIRMED）

`r5-joint-remote-l2-fixture.mjs` 只注册 `exit`、`uncaughtException`、`unhandledRejection`。没有 `process.on('SIGTERM', ...)`。Node 默认收到 SIGTERM 时直接终止，不能依赖 `exit` handler 完成异步 `readSeedEvents()`/`writeSeedReport()`。因此受管 runner 在超时、回收或外部停止边界触发 SIGTERM 时，可能没有最终 report；这与详设中的“受控 SIGTERM 尝试写出并 fail-closed”不一致。最小修复是注册同步可完成的 SIGTERM 终结路径，并增加真实红变异 focused proof。

### S2 — focused proof 没有覆盖正向激活、服务端 canonical mismatch、DataSource 集成和报告文件安全边界（CONFIRMED）

`SeedDiagnosticConfigurationTest` 目前只有 default-off 测试；`DatabaseOperationTrackerTest` 只直接调用 ThreadLocal tracker，没有用 `CountingDataSource` 验证 JDBC 执行被计数；`seed-report.test.mjs` 只有聚合、缺 completion、metadata drift 三项。缺少至少这些可证伪测试：有效 `r5-full` 激活与错误 secret 拒绝、服务端生成 route/operation 与客户端断言不一致时的事件结果、真实 DataSource/statement 计数、原子写与 `0600` 权限、敏感字段拒绝及零次 DB 与缺失事件的区分。现有运行通过不能替代这些边界 proof，也不能把同一个 Node 聚合测试 SHA 作为所有 server/lifecycle 控制的红证明。

### S3 — 并发 request 的 JSONL completion 写入没有互斥或原子行保证，且没有并发红变异证明（CONFIRMED）

`SeedRequestMetricsInterceptor.append` 以 `Files.writeString(..., CREATE, APPEND)` 直接追加 JSONL，没有文件锁、单写者队列或临时文件合并。当前 63 个请求是顺序 fixture，不能证明并发 handler 下每行完整且不交错；一旦 completion event 被截断，客户端只会看到缺失/解析失败并 fail-closed，无法保证“所有接口调用都有报告”。最小修复是采用受支持的单写者/锁定策略并加入并发 append 红变异；若明确把 U12 限定为串行 seed，则应在详设和 runner 中显式禁止并发并由机器门执行，而非默认为安全。

### N1 — fetch/network failure 不进入 API call 分母（CONFIRMED）

fixture 的 `request` 只在 `await fetch` 成功并取得 response 后才 `calls.push(...)`。网络异常、连接拒绝或超时前发生的接口尝试不会出现在 `apiCallCount` 或 endpoint grouping 中；虽然最终可能因 first failure 变成 FAIL，但报告不能显示该接口的平均/最低/最高耗时，也不能证明“所有接口调用”均被统计。建议在 fetch 前记录 attempted call，失败时补充受控 unresolved completion，并保持报告 fail-closed。

### N2 — non-API stage 没有 exact-set 校验（CONFIRMED）

`buildSeedReport` 对 API calls/events 做完整性校验，但不会校验 `nonApiStages` 的预期 stage ID 集合。只要 API 部分完整，缺少一个 owner bootstrap stage 仍可能得到 `PASS`。当前 run 观察到 8 个 stage 是事实，但不是“全部必需 stage 已执行”的控制。建议由同一 owner manifest 声明 expected stage set 并做 exact-set；否则把 non-API stage 明确降级为 informational，不能作为完整 seed PASS 的依据。

### N3 — canonical route 写入与 registry 唯一性仍有边界缺口（CONFIRMED）

服务端在查到 generated definition 后，事件写入的是 `state.pattern()` 而非 `state.actual().path()`。两者在当前映射上相同，但 canonical registry 是唯一真相时事件应直接写 canonical path，避免 Spring pattern 归一化或代理层差异造成分组漂移。同时 Java registry loader 对重复 `operationId` 或重复 `METHOD + path` 不做 fail-closed 重复断言，后插入项会静默覆盖前项。建议事件统一写 definition.path，并在 loader/生成门增加重复键与重复 operationId 断言。

## Scope / boundary disposition

未来完整 `scripts/dev/seed --profile r5-full` 尚未实现，但当前 U12 详设把它明确排除在本 package 的业务交付之外；本轮不把该边界本身升格为 finding。当前 63/63 动态报告、business PASS 与 cleanup PASS 也不等于上述实现来源绑定和生命周期边界已经关闭。

## Verdict

**NO-GO — M=1 / S=3 / N=3**

M1 必须先关闭，否则 package exit 的 PASS 对实现控制集合不可审计；S1–S3 必须在进入下一轮前分别补齐根因修复与 focused red proof。N1–N3 可在同一 implementation 修复中处理。按 review governance，本轮为 `REVIEW_ROUND=1`，不构成第三轮审查授权。
