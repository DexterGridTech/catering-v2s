---
id: kernel.workspace-roadmap
status: active
layer: kernel
taskKinds: ["all"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["all"]
triggers: ["all"]
assertions: ["PROGRAM_SCOPED_CURRENT_ONLY","R1_ONLY","GIT_BY_DEXTER","NO_R2_W1"]
sourceRefs: ["doc/decisions/2026-07-24-v2s-r1-authorization.md","doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md"]
---
# Workspace and Roadmap kernel

- `PROGRAM_SCOPED_CURRENT_ONLY`: 每次先从 Registry 选择显式 program，只消费该程序 Roadmap 的 `CURRENT_*`。
- `R1_ONLY`: R1 的授权只覆盖已关闭的 R1；R2 也已由 fresh v2s-rooted evidence 与 Dexter 接受关闭，二者均不提供 R3/W1 实现授权。
- `GIT_BY_DEXTER`: 项目只有 Codex 与 Claude 两个 AI 在 Dexter 的分工下协调；仓库控制权由 Dexter 自主决定，Codex 与 Claude 不得要求或等待 Dexter 执行任何仓库控制动作，且该决定不影响任何设计与开发工作。
- `NO_R2_W1`: R2 已关闭且不再接受写入；Dexter 已暂停 R3-J02 implementation-facing design，其既有资产为 `PENDING_RECOVERY`。第一批、`DESIGN_GOVERNANCE_BATCH_1_5` 与 Batch 2 inventory 已由 Dexter 接受；R3-C01 carry-over-first 低保真线框已获 Dexter 接受。当前可一次性形成整个 R3 的 implementation-facing 详设与实施计划：C-01 是唯一业务 Journey，整体覆盖 R3-TECH、契约、脚本、后端、数据库、双 app 边界、测试与证据；不得实现、代码搬运或恢复 J02/C-02，禁止 W1 业务实现与 runtime。
