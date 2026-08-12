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
assertions: ["START_RESTART_MIGRATE","START_RESTART_NO_SEED","RESET_SEPARATE_DESTRUCTIVE","LOCAL_EXECUTION_REMOTE_MIDDLEWARE","CURRENT_L2_LOCAL_EXECUTION_ISOLATED_REMOTE_CLEANUP","UAT_ALL_REMOTE_EXECUTION","REMOTE_TESTCONTAINERS_NOT_BROWSER_L2","ROUTINE_RUNTIME_COMMANDS_NOT_IMPLEMENTATION","TESTCONTAINERS_AUTO_DISCOVERY_AND_PROGRESS"]
sourceRefs: ["AGENTS.md","doc/decisions/2026-08-11-v2s-routine-runtime-command-classification.md","doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md","scripts/README.md"]
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
- `ROUTINE_RUNTIME_COMMANDS_NOT_IMPLEMENTATION`: focused Testcontainers、managed DEV、显式 reset 与显式 `r5-full` seed 是独立日常受管命令。Testcontainers 的本次运行只依赖当前权威测试契约和受管运行边界，不依赖 active package、BPF/static predecessor、设计/实施 review 或历史报告；此分类不放宽授权、资源预检、日志、首败诊断或 cleanup。
- `TESTCONTAINERS_AUTO_DISCOVERY_AND_PROGRESS`: 日常全量入口是 `scripts/test/r5-remote-testcontainers.mjs --all`。runner 每次从当前 Java `@Testcontainers` 源码推导 module/root `:test` task 与 fully-qualified selector，并从同一批源码解析容器镜像；新测试无需登记固定分母或手工镜像清单即在下一次 `--all` 被纳入，无法推导、重复目标或无法解析镜像必须红。镜像先在默认 daemon 缓存，后导入三个隔离 daemon；已缓存镜像不得再次外网拉取。全量运行固定使用三个 Engine ID 不同的受管 remote Docker daemon lane；每 lane 内串行、每 lane 只初始化一次，初始按当前分母均分（22 为 7/7/8），完成自有队列的健康 lane 必须确定性领取其他 lane 尚未开始的最长队列成员，不得空转。lane 只在自身首败停止，其余 lane 继续，parent 汇集至多三条 lane 首败；任一修复后的 `--all` 必须 fresh 全量复跑，不得复用历史 PASS。runner stdout 与 suite/child manifest 都必须记录开始、lane、Engine ID、阶段、心跳、当前/总数、结束、耗时、business、cleanup 与首败；196 只是 BPF 专项契约，不能取代可增长的日常发现分母。
- `TESTCONTAINERS_TASK_MUST_EXECUTE_FRESH`: 有限分母是所有由 `@Testcontainers` 发现的 Gradle `:test` task。它们观察外部 Docker/数据库状态，不能接受 Gradle `FROM-CACHE`、`UP-TO-DATE`、`NO-SOURCE` 或 `SKIPPED` 作为本次测试结果；build 配置必须只关闭该 Test task 的 up-to-date/cache 复用，编译和依赖准备仍可复用，受管 runner 还必须读取本次 Gradle log 并对目标 task 做 fail-closed 执行判定。目标 task 必须按完整 task token 匹配，`testClasses` 等相似任务名不能被当作 `test` 已执行；缺失目标 task 行或缓存跳过是 runner failure，不得转译为业务 PASS、缺失结果重试或延长 timeout。反例是纯 unit/static 测试，它们不进入 Testcontainers 分母。
