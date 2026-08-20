---
id: pitfalls.log-first-failure-retry
status: active
layer: routed
taskKinds: ["diagnostics","testing","runtime-management"]
domains: ["platform","backend","contract","admin-ui"]
consumerFaces: ["all"]
owners: ["platform","backend"]
impacts: ["evidence","runtime","cleanup"]
triggers: ["failure","runtime"]
assertions: ["READ_FIRST_FAILURE_LOG","SECOND_RETRY_REQUIRES_DIAGNOSIS","NO_TIMEOUT_OR_POLLING_PSEUDOFIX"]
sourceRefs: ["doc/heritage/frozen/catering-all-v2/project-memory/decisions/logging-and-debugging-foundation-standard.md","doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md"]
---
# Log-first failure retry

- `READ_FIRST_FAILURE_LOG`: 首败先读取 command/service/browser/cleanup 日志。
- `SECOND_RETRY_REQUIRES_DIAGNOSIS`: 同一 failure signal 第二次尝试前必须判定首个破损边界。
- `NO_TIMEOUT_OR_POLLING_PSEUDOFIX`: 不得用加 timeout、DOM/状态轮询或魔法等待替代日志诊断。
- `TESTCONTAINERS_REPEAT_FAILURE_ESCALATES_TO_STRUCTURED_DIAGNOSTICS`: 同一受管 Testcontainers 场景/失败信号在无新增诊断的情况下最多尝试两次；准备第三次尝试前，必须在现有结构化、脱敏、run-scoped 日志边界增加临时可关联诊断，至少记录 first failure、last known good、broken boundary 以及该分支的关键判定事实。读取诊断日志并确认根因后，先做一次最小修复验证，再移除一次性诊断代码；不得用重复重跑、延长 timeout、等待、轮询、改响应码或吞错代替诊断。
- 适用边界：这里的“同一失败信号”指同一受管场景在同一代码假设下重复出现的相同根因候选；若失败信号已变化，仍须按首败规则读取日志，但不把不同问题机械合并计数。纯静态/unit 测试不进入本阈值。日志能力缺失时必须保留 `LOG_NOT_AVAILABLE` 并先修复日志可读性。
- 回读边界：本条是失败重试的压缩入口；涉及日志能力、run manifest、敏感字段、诊断事件或 `LOG_NOT_AVAILABLE` 时，必须回读冻结 Heritage 全文，不能以此三条省略完整标准。
