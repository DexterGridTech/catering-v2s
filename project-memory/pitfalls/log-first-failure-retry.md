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
sourceRefs: ["doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md"]
---
# Log-first failure retry

- `READ_FIRST_FAILURE_LOG`: 首败先读取 command/service/browser/cleanup 日志。
- `SECOND_RETRY_REQUIRES_DIAGNOSIS`: 同一 failure signal 第二次尝试前必须判定首个破损边界。
- `NO_TIMEOUT_OR_POLLING_PSEUDOFIX`: 不得用加 timeout、DOM/状态轮询或魔法等待替代日志诊断。
