---
id: operations.dev-command-separation
status: active
layer: routed
taskKinds: ["runtime-management","testing","backend-acceptance"]
domains: ["platform","backend"]
consumerFaces: ["all"]
owners: ["platform"]
impacts: ["runtime","database","cleanup"]
triggers: ["runtime","failure"]
assertions: ["START_RESTART_MIGRATE","START_RESTART_NO_SEED","RESET_SEPARATE_DESTRUCTIVE","LOCAL_EXECUTION_REMOTE_MIDDLEWARE","CURRENT_L2_LOCAL_EXECUTION_ISOLATED_REMOTE_CLEANUP","UAT_ALL_REMOTE_EXECUTION","REMOTE_TESTCONTAINERS_NOT_BROWSER_L2","ROUTINE_RUNTIME_COMMANDS_NOT_IMPLEMENTATION","BACKEND_ACCEPTANCE_OPERATION_DISCOVERY_AND_PROGRESS"]
sourceRefs: ["AGENTS.md","doc/decisions/2026-08-11-v2s-routine-runtime-command-classification.md","doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md","scripts/README.md"]
---
# DEV command separation

- `START_RESTART_MIGRATE`: start/restart 允许 additive Flyway migration。
- `START_RESTART_NO_SEED`: start/restart 永不 seed。
- `RESET_SEPARATE_DESTRUCTIVE`: reset/seed 必须是单独、显式、破坏性且受授权的动作。
- `FULL_SEED_COMPOSITION`: 用户所说的 `seed` 唯一是 `scripts/dev/seed --profile r5-full` 的完整体验数据装载，不是基础 fixture 或 catalog/inventory 的任选其一。它必须按 `owner-command` → `catalog-inventory` 的有序精确集合完成：前者覆盖 32 项 R5 基础事实，后者覆盖 73 条 catalog 来源项、72 条创建项、1 条有据排除项和 34 个媒体的双 scope readback。父 receipt 必须引用并校验两个子阶段的同一 managed DEV run、business、cleanup、manifest 和 report；任一缺失、顺序漂移或非 PASS 都令完整 seed FAIL。catalog/inventory 的 fixture、loader 和单阶段报告保留为内部组件，不再是对外完整 seed profile；部分体验状态由下一次显式 reset 清理。
- 受管破坏性/长期命令不得把未知参数当作普通启动：`scripts/dev/start` 只接受零参数；`--help`、profile 或其他未声明参数必须在启动任何资源前拒绝。反例是明确声明并被解析的 `seed --profile r5-full` 与 `reset --dry-run`。这避免“查看用法”意外创建 DEV 数据库或进程树。
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
- `ROUTINE_RUNTIME_COMMANDS_NOT_IMPLEMENTATION`: managed DEV、显式 reset、显式 `r5-full` seed 与 `backend-acceptance` 都是可独立请求的受管命令。运行命令不放宽授权、资源预检、日志、首败诊断或 cleanup；2026-08-13 起不再依赖 implementation package、per-edit 影响面或 package-exit。
- `BACKEND_ACCEPTANCE_OPERATION_DISCOVERY_AND_PROGRESS`: 当前唯一入口为 `scripts/test/backend-acceptance --operation getPublicInvitationView`：串行运行真实容器、真实 HTTP、手写 fixture/request/业务断言，并打印不设门的 DB 调用数。197 provider 与 registry 保留为未来待办目录；PERFORMANCE/CLEANUP verdict、exact-set、lane 和 receipt 协议已退役。
- `TESTCONTAINERS_TASK_MUST_EXECUTE_FRESH`: 有限分母是所有由 `@Testcontainers` 发现的 Gradle `:test` task。它们观察外部 Docker/数据库状态，不能接受 Gradle `FROM-CACHE`、`UP-TO-DATE`、`NO-SOURCE` 或 `SKIPPED` 作为本次测试结果；build 配置必须只关闭该 Test task 的 up-to-date/cache 复用，编译和依赖准备仍可复用，受管 runner 还必须读取本次 Gradle log 并对目标 task 做 fail-closed 执行判定。目标 task 必须按完整 task token 匹配，`testClasses` 等相似任务名不能被当作 `test` 已执行；缺失目标 task 行或缓存跳过是 runner failure，不得转译为业务 PASS、缺失结果重试或延长 timeout。反例是纯 unit/static 测试，它们不进入 Testcontainers 分母。
