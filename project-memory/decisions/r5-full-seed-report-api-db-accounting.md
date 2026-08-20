---
id: decisions.r5-full-seed-report-api-db-accounting
status: active
layer: routed
taskKinds: ["design", "implementation", "review", "testing"]
domains: ["platform", "backend"]
consumerFaces: ["backend"]
owners: ["platform", "backend"]
impacts: ["evidence", "database", "governance", "owner"]
triggers: ["task-start", "implementation", "review"]
assertions: ["SEED_REPORT_PER_RUN", "SEED_API_DB_ACCOUNTING", "SEED_REPORT_CORRELATION", "SEED_REPORT_NO_SECRETS"]
sourceRefs: ["project-memory/decisions/r5-full-seed-report-api-db-accounting.md"]
---
# R5 `r5-full` Seed 报告与 API/数据库操作统计

## 规则

- 每次显式执行 `scripts/dev/seed --profile r5-full` 都必须生成完整组合父报告及两个子阶段报告。
  父报告在 `.runtime/r5/seed/complete/<run-id>/`，只以有序精确集合
  `owner-command` → `catalog-inventory` 校验并链接 receipt；两个子报告各自保留 API/数据库计量
  的唯一真相。JSON 是机器校验真相，Markdown 是给 Dexter 的可读交付投影。成功、预期业务拒绝、
  半途失败和执行器异常都必须保留相应报告，父报告不得把两个 owner 的 API 计量合并为第二套统计。
- 报告的 API 分母是 Seed 实际发出的全部 HTTP/API 调用。每个 endpoint 按
  `owner + operationId + method + normalized routeTemplate` 聚合，并至少输出：
  `callCount`、HTTP 耗时 `average/min/max`、数据库逻辑操作次数
  `average/min/max`，以及数据库累计耗时 `average/min/max`。单次调用时三项相等，
  多次调用时按全部实际调用计算。
- `operationId` 必须来自当前 generated contract；缺 operationId 或
  `route.unresolved` 是 `SEED_REPORT_INCOMPLETE`，不得用时间窗口或 route 猜测归并。
- 数据库计量沿用 all-v2 的 `CountingJdbcTemplate` + `DatabaseOperationTracker` 形状：
  一次 JdbcTemplate query/update/batch execution 计一次 logical database operation，
  由 request-local tracker 记录 count/duration/kind；不解析 SQL，不记录 SQL/bind value。
- Seed client 的 API call event 必须与 backend request-completed event 通过同一
  `runId + correlationId/requestId` 一一关联。未关联 HTTP event、未关联 database event、
  实际调用数与报告调用数不等，均写入 FAIL 报告并保留 `firstFailure`。
- 数据库操作次数为零是合法结果；缺少 request-completed 观测不是“零次调用”。
- 唯一允许的 DEV bootstrap SQL 不是 HTTP endpoint，单独记录 stage duration、结果和
  receipt，不得伪装为 API 统计；普通业务事实仍必须经过真实 edge/owner command。
- 报告、日志和 evidence 不得包含 SQL、bind value、raw payload、密码、密码 hash、OTP、
  token、cookie、Authorization、手机号、登录名、原始 IP 或其他 account identifier。
- report 必须在 `finally` 中写出；报告是 Seed 执行证据，不替代 owner readback、32 项
  business PASS 或 cleanup PASS。`p50/p95` 可以作为补充，但不能替代强制的
  `average/min/max`。

## 必须实现的报告结构

```text
kind: r5-full-seed-report
schemaVersion: 1
runId / seedProfile / status / startedAt / finishedAt / durationMs
apiEndpoints[]:
  owner, operationId, method, routeTemplate, stageIds, callCount
  httpDurationMs.average/min/max
  databaseOperationCount.average/min/max
  databaseDurationMs.average/min/max
  outcomes.success/rejected/error
nonApiStages[]
completeness:
  apiCallCount, reportedApiCallCount, endpointGroupCount
  unmatchedHttpEvents, unmatchedDatabaseEvents
firstFailure
```

Markdown 报告至少展示结论、Seed profile/run ID、API 调用总数、endpoint 分组数、关联/未关联
事件数、每个 endpoint 的 HTTP 与数据库 average/min/max、非 API 阶段，以及业务 PASS/cleanup
PASS 的边界说明；不得另行计算或持有第二套统计真相。

## 固化状态

当前规则已接入正式 `r5-full` seed 流程：`scripts/dev/seed --profile r5-full` 委托
`scripts/dev/r5-complete-seed-executor.mjs`，每次运行自动生成同目录的 JSON 机器报告和 Markdown
可读报告，父报告只链接两个子报告的计量真相，不再由人工拼接或重新汇总。executor focused tests
覆盖父报告的 endpoint 计量、Catalog 数据计划、缺失子报告可见性和 JSON/Markdown 成对路径；
`scripts/README.md` 是对外执行入口说明。
