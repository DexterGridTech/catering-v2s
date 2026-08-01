---
id: decisions.logging-and-debugging-foundation-standard
title: all-v2 日志与开发调试基础能力标准
type: decision
status: active
layer: routed
taskKinds: [architecture-design, backend-design, backend-implementation, frontend-implementation, diagnostics, testing, implementation-review]
domains: [platform, backend, admin-ui]
consumerFaces: [backend, operations-admin, platform-admin, all]
owners: [platform, frontend-platform]
impacts: [architecture, evidence, gate, process, resource, test]
triggers: [api, base-api, check, client, dev-server, failure, frontend, gate, long-run, runtime, service, task-start]
sourceRefs:
  - doc/reports/platform/2026-07-19-all-v2-v1-logging-capability-comparison.md
  - doc/specs/platform/2026-07-19-logging-and-debugging-foundation-spec.md
  - doc/plans/platform/2026-07-19-logging-and-debugging-foundation-plan.md
---

# 长期约束

- 后端日志必须经过 `platform-foundation` 的统一 correlation/request context 和安全结构化 logger；业务 service 不得新增 `System.out/err`、手工 JSON、自由 logger 或把 raw request/response 写入日志。
- 两个 admin 的请求/错误诊断必须经过 `admin-ui-foundation` shared logger/base query；feature 不得直接 `console.*`。生产默认关闭 debug；DEV/测试显式开启时仍执行字段白名单和脱敏。
- 最小跨层字段是 `timestamp, level, service, environment, event, correlationId, requestId, traceId, routeTemplate/operationId, outcome`；失败补 `status/errorCode`，依赖补 `dependency/retryAttempt`。不记录 password、password hash、OTP、token、cookie、Authorization、service credential、手机号明文或 raw payload。
- 面向 AI 的诊断事件必须带 `eventId, sequence, runId, service, owner, instanceId, layer, phase, parentEventId, attempt, outcome`；operation 必须声明 expected phases，缺失阶段输出 `MISSING_PHASE`，证据不足输出 `INSUFFICIENT_EVIDENCE`，不得让 AI 从自由文本猜根因。
- 事件 envelope、expected phases、diagnostic bundle 和脱敏/parent-event policy 必须有机器可读的平台 contract；跨服务使用受信任的内部 parent-event propagation，Gateway 在构造内部请求前丢弃外部伪造值，且剥离与注入必须同一条实现路径原子完成，不进入公开业务 wire。必须有独立 bad fixture 证明伪造值不出现在任何 downstream event 的 parentEventId 中。
- parent-event 剥离的 Gateway 角色必须由显式语义属性 `platform.observability.role=gateway` 派生；缺省、未知值和其他环境属性只能按 owner 安全降级。角色派生必须有 gateway/owner 正负单测和可失败 gate，不能以某个 gateway 环境配置项的存在性作为安全开关。
- correlationId 是可碰撞的诊断查找键，不是全局唯一标识、认证凭据或信任依据；expected phases 采用跨层粗粒度最小集合，仅在无法判定责任边界时扩展，避免 profile 膨胀。
- 标准诊断包必须给出 `firstFailure, lastKnownGood, brokenBoundary, missingPhases, evidenceRefs, nextCommands, confidence`；每个结论都要能回到 manifest、结构化事件或脱敏 log line，nextCommands 只能来自有界只读/受管命令。
- log、audit、用户反馈三者分离：日志用于运行排障，audit 由业务 owner 在事务内记录业务事实，feedback 负责用户可行动文案；不得以日志替代 owner readback、business PASS、cleanup PASS 或 audit。
- correlation 在 Gateway/owner 入站、出站和响应中保持可串联，并在 finally/线程复用边界清理；缺少请求上下文的后台任务必须显式标记 unassigned，不伪造用户请求。
- 运行日志必须绑定 runId/service/logPath/process identity/config profile/dependency identity；诊断脚本只读、有界、run-scoped，不按端口模糊 kill。长于 30 秒的动态诊断按现有 30 秒进度、停滞诊断和 business/cleanup 双账规则执行。
- 新模块 preflight 必须回读本标准及其 spec/plan；通过静态 gate 不等于技术链完成，必须补 unit/integration、必要的 managed smoke、敏感字段负例和 cleanup evidence。
- 统一日志能力的实现入口固定为 `platform-foundation`、`admin-ui-foundation`、`run-managed`、`find-correlation` 和登记过的 conformance gates；新模块不得自行创建 logger、MDC/context filter、base query 观测器、header 拼接或诊断包解析器。
- 每个 machine gate 的 `--self-test` 必须实际运行 validator/parser 对 bad fixture 的拒绝路径；仅打印 `BAD_FIXTURE=PASS` 不构成门。诊断输入必须验证 manifest `runId`、run-scoped log path、结构化 event 身份字段和 evidenceRefs 可回溯性。
- 诊断 parser 必须按实际 structured appender 输出（包括 SLF4J `%kvp` 的引号值）做归一化，并把 `ERROR`/`REJECTED` 的明确首败与“缺少事件、无法判责”的 `INSUFFICIENT_EVIDENCE` 分开；Gateway 在 owner 尚未被调用时的失败不能因缺 owner phase 被降级。
- 技术日志阶段收口必须把动态证据按 backend/frontend/managed、business/cleanup 和环境限制分账；Docker/Testcontainers 或远端中间件不可用时只能登记为明确 N 级环境边界，不能把静态 compile/typecheck 或旧 manifest 升格为完整 owner integration PASS。

# 设计取舍

继承 all-v1 的统一上下文、MDC、请求 latency/metrics、出站 header facade、诊断脚本和 run 监控思想；拒绝手工 JSON logger、页面长期 console 诊断和把 audit writer 当普通日志出口。当前不要求完整 OTel/日志平台。

MEMORY_DELTA=UPDATE
