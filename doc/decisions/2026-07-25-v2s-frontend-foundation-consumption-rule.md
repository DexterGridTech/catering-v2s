---
title: v2s 后续 UI 功能必须优先消费 shared admin-ui-foundation
status: ACCEPTED
createdAt: 2026-07-25
acceptedBy: Dexter
scope: future UI implementation
---

# v2s 后续 UI 功能必须优先消费 shared admin-ui-foundation

`libraries/frontend/admin-ui-foundation/` 已从 all-v2 原样复制到 v2s，作为后续 UI 实现的共享基础层保留。当前 R3 只完成物理复制，不接入两个 admin App，也不把该目录当作 C-01 业务闭环证据。

从后续 UI 功能开始，任何实现必须先检查 foundation 已有能力并优先对接；不得在 `apps/frontend/*` 重复实现相同的生命周期、Drawer surface、overlay lock、列表上下文、HTTP protocol、observability 或 automation primitive。两个 App 继续各自拥有 shell、router、store、baseApi、theme、generated API、业务 feature、业务文案与 Journey 行为。

只有 foundation 未覆盖、且设计中说明不适合共享的能力，才可保留为 App-local 实现；该判断必须配套 focused test/evidence。foundation 的接入不得绕过已批准 Journey、App 独立边界或 v2s edge contract。

<a id="design-admission-before-implementation"></a>

## 设计准入先于实现

在任何 UI 实现前，每个 screen 的详设必须声明将复用的确切
`@catering-v2s/admin-ui-foundation` export，或 `NONE_WITH_REASON` 的具体理由；名称必须能从
`libraries/frontend/admin-ui-foundation/src/index.ts` 重新打开。最终详设还必须绑定 exact target path、
唯一 shared owner 与 focused evidence，避免 app-local 机制在不知情下重做已存在的 shared primitive。

只有 target path 已确定、规则能一行说清并且能证明真实 red mutation 时，才建立 declaration-to-import
equality 或其它机器门。IA/线框阶段没有实现路径时，这一要求是人工设计准入，不能伪称机器门已执行。
