# RM1 Seed 报告实施设计（P6 minimal owner-command seed）

## 目的与边界

本包只闭合当前 Roadmap `RM1-P6-3` 已授权的 minimal owner-command seed 与联合受管 L2
fixture 的可审计统计，不把 P6 fixture 宣称为未来 `r5-full` 全量 seed。reset 仍不执行；DEV
start/restart 仍不隐式 seed。未来 `scripts/dev/seed --profile r5-full` 的 32 场景 owner
workflow 仍由其独立 package 负责，本包只让当前已执行的 seed path 具备同一份强制报告形状。

## 统一报告模型

当前 P6 fixture run 在 `finally` 写出 run-scoped `seed-report.json` 与面向 Dexter 的
`seed-report.md`；未来显式
`scripts/dev/seed --profile r5-full` 也必须复用此报告模型，但其 32 场景 owner workflow
不在本包内实现或宣称完成。每个真实 HTTP 调用在发送前携带由当前生成的
`apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json`
校验过的 `X-Seed-Operation-Id`、规范化 `X-Seed-Route-Template`、`X-Seed-Run-Id` 与
`X-Correlation-Id`。客户端记录 HTTP duration，后端 seed-mode completion event 从实际
`HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE`、HTTP method 与 server generated registry
推导 canonical operation/owner/route；client metadata 只作为断言，任一 mismatch 使报告 FAIL。
后端记录同一 correlation/request id、status、operationId、route、
logical database operation count 和 database duration；聚合键为
`owner + operationId + method + normalized routeTemplate`。

报告的每个 endpoint 输出 `callCount`、HTTP duration average/min/max、数据库操作次数
average/min/max、数据库 duration average/min/max 与 success/rejected/error outcome。缺少
operation registry、completion event、关联 id 或 event 数量不一致时，报告仍在 finally 写出但
状态为 `FAIL`，并保留脱敏 `firstFailure`；不能把缺失观测当作数据库零次调用。

`seed-report.json` 是机器校验真相；`seed-report.md` 是由同一对象投影出的 Dexter 可读交付物，
不得新增独立统计来源、秘密字段或替代 JSON 的 fail-closed 判定。两者必须在同一 finally/异常
路径中成对写出，均使用原子临时文件 rename 与 `0600` 权限。

## 后端观测形状

foundation 提供 request-local `DatabaseOperationTracker` 与 DataSource/Statement 代理。每次
JdbcTemplate query/update/batch 的 statement execution 计为一次 logical operation，记录
执行 duration 和 kind，不解析 SQL、不记录 SQL/bind value。仅在 seed mode 打开 completion
event 文件写入；普通请求继续走既有业务行为与安全日志边界。seed mode 只有在
`V2S_RUNTIME_ENVIRONMENT=non-production`、`V2S_DEV_PROFILE=r5-full` 或当前受控 P6 profile、
`V2S_SEED_REPORT_RUN_ID` 与 `V2S_SEED_REPORT_SECRET` 同时存在且与 run manifest 绑定时才启用；
默认关闭，伪造 header 不会打开它。`EdgeWebConfiguration` 的 request interceptor 从实际
handler 建立上下文、在 finally 写一条 JSONL completion event，并回写 correlation/request id
headers。Flyway/bootstrap 线程不带 seed headers，故不进入 API denominator；bootstrap SQL
继续单独记 nonApiStage。

## 客户端与安全

fixture 的请求 helper 从当前 `contracts/openapi` operation registry 校验 operationId、HTTP
method 和 normalized route template，再发请求并收集 response correlation/request id。公共
fixture、日志和报告不写 password、OTP、token、cookie、Authorization、手机号、登录名、raw
payload、SQL 或 bind value；private credential/token 文件继续 `0600`，只留在进程边界。

## 验收

focused proof 覆盖：单次与多次调用的 min/average/max 相等性/聚合性；零 DB operation 是合法
结果但缺 event 必须 FAIL；operation/method/route drift、correlation drift、secret leakage、
异常退出、事件文件 flush/0600 权限与 cleanup 仍分别可判。报告由
`scripts/test/seed-report.mjs` 统一写出，使用原子临时文件 rename，
`finally`、uncaughtException、unhandledRejection 和受控 SIGTERM 都尝试写出终态；runner
崩溃仍由缺失 completion/报告被 fail-closed，不能冒充 PASS。bootstrap/nonApi stage 记录
stage id、status、duration 和安全摘要，绝不把 SQL 当 API。动态 evidence 只在 static/focused
proof 通过后执行，并继续区分 business 与 cleanup。当前 RM1 P6 profile 的闭集值为 `r5-full`
（受管 P6 fixture 只使用其中的 owner-command subset）；不接受任意 profile 字符串。

## Owning source 与 focused proof

- server canonical completion source：`SeedRequestMetricsInterceptor.java`；server registry：
  generated `edge-route-face-registry.json`；DB wiring：`BusinessDataConfiguration` 的
  `CountingDataSource` post-processor。
- report writer/aggregator：`scripts/test/seed-report.mjs`；其单元 proof 覆盖单/多次聚合、
  missing completion、metadata mismatch、atomic write、0600 与 secret rejection。
- backend proof：`DatabaseOperationTrackerTest` 与 `SeedDiagnosticConfigurationTest` 覆盖
  statement execute 计数、zero-vs-missing、seed activation/default-off 和 canonical route
  mismatch。
- bootstrap owning source：`scripts/dev/r5-seed-bootstrap.mjs`；stdout 只输出非敏感 stage/result，
  不再输出 login 或 UUID。fixture diagnostic 只记录 status/errorCode/correlation/operation，
  不记录 raw response body。

当前 P6 profile 不启用 future `DEV_FIXED_OTP_ISSUER`/fixed-clock full-r5 wiring；这是未来 r5-full
package 的独立 obligation，不在本包宣称完成，且本包不会把 `SystemTimeProvider` 改成伪 fixed clock。
