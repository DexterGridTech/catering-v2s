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
- `R1_ONLY`: R1 已关闭且不再提供写入授权；当前 R2 只等待 fresh-session 静态验收。
- `GIT_BY_DEXTER`: Git stage、commit、push、branch 与 worktree 由 Dexter 负责。
- `NO_R2_W1`: Dexter 仅授权 standards coverage、R1 review resolution 与相应 current-truth 导航修订；完成后停在 R2 `IN_REVIEW`。除此以外，R2 fresh-session acceptance 未获写入授权，W1 业务 runtime 仍由前置门阻断。
