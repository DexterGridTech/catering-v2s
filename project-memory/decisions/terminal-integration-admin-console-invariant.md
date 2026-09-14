---
id: decisions.terminal-integration-admin-console-invariant
title: TER integration 的共享 admin console 基线
type: decision
status: active
layer: routed
taskKinds: ["design", "implementation", "review", "testing"]
domains: ["platform"]
consumerFaces: ["all"]
owners: ["platform", "frontend-platform"]
impacts: ["architecture", "runtime", "ui"]
triggers: ["task-start", "implementation", "review"]
assertions: ["TER_EVERY_INTEGRATION_HAS_ADMIN_CONSOLE"]
sourceRefs: ["doc/platform/terminal-coding-standard.md"]
---

# TER integration 的 admin console 基线

Dexter 2026-09-14 明确补充：`apps/terminal/ui/integration/*` 的每一个 integration 包都必须
集成共享 admin console。这是此前需求漏记的工程基线，不新增业务需求、Journey、独立门或
第二套实现。

唯一内容源与具体形态见 [`doc/platform/terminal-coding-standard.md` 的 `TR-13`](../../doc/platform/terminal-coding-standard.md)。
参照 `apps/terminal/ui/integration/sample-console`：integration 使用同一个 `UiCatalog` 与
renderer catalog，装入 `adminShellAssembly.parts`，并在生产 surface content frame 使用
`AdminLauncher`；admin 身份、layer、登录、关闭和输入行为仍由 `ui.base.admin-shell` 负责。

实现/复核时要盘点当前所有 integration 包，逐包确认 package/dependency 声明、catalog parts
和生产 launcher 三者同时存在。此记忆不复制 TR-13 的正文，避免规范漂移；它只提供路由锚点
与来源指针。
