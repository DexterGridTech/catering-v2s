---
id: operations.dev-command-separation
status: active
layer: routed
taskKinds: ["runtime-management","testing"]
domains: ["platform","backend"]
consumerFaces: ["all"]
owners: ["platform"]
impacts: ["runtime","database","cleanup"]
triggers: ["runtime","failure"]
assertions: ["START_RESTART_MIGRATE","START_RESTART_NO_SEED","RESET_SEPARATE_DESTRUCTIVE","LOCAL_EXECUTION_REMOTE_MIDDLEWARE","CURRENT_L2_LOCAL_EXECUTION_ISOLATED_REMOTE_CLEANUP","UAT_ALL_REMOTE_EXECUTION","REMOTE_TESTCONTAINERS_NOT_BROWSER_L2"]
sourceRefs: ["AGENTS.md","doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md"]
---
# DEV command separation

- `START_RESTART_MIGRATE`: start/restart 允许 additive Flyway migration。
- `START_RESTART_NO_SEED`: start/restart 永不 seed。
- `RESET_SEPARATE_DESTRUCTIVE`: reset/seed 必须是单独、显式、破坏性且受授权的动作。
- 每次显式 `seed --profile r5-full` 都必须生成 run-scoped Seed 报告；报告按
  `owner + operationId + method + normalized routeTemplate` 汇总全部 API 调用，展示调用数、
  HTTP 耗时 average/min/max、logical database operation 次数 average/min/max 与数据库累计
  耗时 average/min/max。统计沿用 `CountingJdbcTemplate` + `DatabaseOperationTracker` 的
  request-local 口径；报告必须与 backend request-completed event 通过 correlation/request id
  关联，缺失/断关联或敏感字段泄漏均 FAIL。该报告是 Seed evidence，不替代 business/cleanup
  PASS；DEV bootstrap SQL 单独记 stage receipt，不伪装成 API endpoint。
- `LOCAL_EXECUTION_REMOTE_MIDDLEWARE`: DEV 的执行面固定在本机：Spring Boot、platform-admin 与 operations-admin Web 在本机运行；数据库、对象存储等非生产中间件可经受管 tunnel 位于远端。不得因远端中间件而把应用或浏览器 runner 迁到远端。
- `CURRENT_L2_LOCAL_EXECUTION_ISOLATED_REMOTE_CLEANUP`: 当前受管浏览器 L2 与 DEV 共享本机执行面，但不是持久 DEV 的副本；每 run 使用隔离远端数据库/资产命名空间，记录本机受控 PID/日志与 tunnel identity，business 与本机/远端 cleanup 分开判定。
- `UAT_ALL_REMOTE_EXECUTION`: 只有后续获得单独授权的 UAT 才允许应用和浏览器执行面全量远端部署/运行；本机 DEV/L2 不得冒充 UAT。
- `REMOTE_TESTCONTAINERS_NOT_BROWSER_L2`: 为 JVM 与 Docker 同平面而在远端运行的 Testcontainers 仅是技术验证；它不启动本机/远端浏览器 UI，也不构成浏览器 L2 或 UAT。
