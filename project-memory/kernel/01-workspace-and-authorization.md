---
id: kernel.workspace-authorization
status: active
layer: kernel
taskKinds: ["all"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["all"]
triggers: ["all"]
assertions: ["DEXTER_SESSION_AUTHORITY","EXPLICIT_EXPENSIVE_ACTION_AUTHORITY","BATCH_ATOMIC_DELIVERY","GIT_BY_DEXTER"]
sourceRefs: ["doc/decisions/2026-09-25-v2s-roadmap-mechanism-retirement.md"]
---
# Workspace and authorization kernel

- `DEXTER_SESSION_AUTHORITY`: 当前任务与授权只来自 Dexter 在会话中的明确指派；仓内没有 registry 或过期状态源。跨会话批次的授权原文必须写入该批次需求、详设或实施计划的授权段。
- `EXPLICIT_EXPENSIVE_ACTION_AUTHORITY`: L2、reset、seed、UAT、设备数据清除及其他昂贵或破坏性动作，必须由 Dexter 逐项明确授权；本 kernel 不提供隐含授权。
- `BATCH_ATOMIC_DELIVERY`: Dexter 指派的每个交付批次一次性完成设计、一次性完成实施、一次性完成全范围复核；不得按 Journey、模块、文件、App 或单项 gate 拆成独立 review。
- `GIT_BY_DEXTER`: 项目只有 Codex 与 Claude 两个 AI 在 Dexter 的分工下协调；仓库控制权由 Dexter 自主决定，Codex 与 Claude 不得要求或等待 Dexter 执行任何仓库控制动作，且该决定不影响任何设计与开发工作。
