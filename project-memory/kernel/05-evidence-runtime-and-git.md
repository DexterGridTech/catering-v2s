---
id: kernel.evidence-runtime
status: active
layer: kernel
taskKinds: ["all"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["all"]
triggers: ["all"]
assertions: ["LOG_FIRST_RETRY","BUSINESS_CLEANUP_SEPARATE","DEV_START_NO_SEED","NO_GIT_WRITE"]
sourceRefs: ["doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md","doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md","doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md"]
---
# Evidence, runtime and Git kernel

- `LOG_FIRST_RETRY`: 首败必须保留并读取 run-scoped 日志；同一 signal 第二次尝试前完成诊断。
- `BUSINESS_CLEANUP_SEPARATE`: business 与 cleanup 分开判定，cleanup 非 PASS 不得完成。
- `DEV_START_NO_SEED`: DEV start/restart 不得 seed。
- `NO_GIT_WRITE`: agent 不执行任何 Git 写操作。
