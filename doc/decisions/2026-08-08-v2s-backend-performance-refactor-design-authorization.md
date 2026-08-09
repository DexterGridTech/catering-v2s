---
id: decisions.backend-performance-refactor-design-authorization
title: 后台性能重构详设授权与非 UI 技术任务裁决
status: DEXTER_ACCEPTED
type: technical-maintenance-decision
programId: V2S_W0_W4_EXECUTION
implementationAuthority: false
runtimeAuthority: false
seedResetAuthority: false
acceptedAt: 2026-08-08
acceptedBy: Dexter
---

# 后台性能重构详设授权与非 UI 技术任务裁决

## 1. 用户任务与成功结果

- **Actor**：维护后端、契约和运行证据的工程团队。
- **此刻任务**：在不删减授权重核、幂等、CAS、审计、锁、typed failure 或必要 readback 的前提下，消除可证明的重复数据库往返，并让每个生成路由拥有可审查的 owner-local 处理边界。
- **可观察成功结果**：同一受控 workload 下，任务型 read 的数据库操作数满足明确预算；本轮触及 command 只相对具名 fixture 的实测基线不回归；请求级证据可以把重复/N+1 定位到 owner 内代码行。
- **失败时仍成立的事实**：任何命令都不会因性能改造失去 server-minted authorization、对象事实重核、receipt replay 保护、CAS、审计或 owner 主权。

## 2. 范围、替代与裁决

这是**非 UI-bearing 的技术维护任务**。它不新增用户功能、页面、按钮或 HTTP operation；两个 admin app 的体验变更只会在既有 operation 语义/错误形态确有变更且被行为变更表登记时发生。

比较过的替代：

1. 只加索引或缓存：不能消除同请求相同事实的重复读，也会把撤权、版本和 replay 的正确性风险转为缓存一致性风险。
2. 建全局 query/handler registry：能减少表面代码，但违反模块 owner 主权并形成新的跨 owner 编排中心。
3. 保留现状、仅优化最慢 SQL：无法解决已观测的重复授权/上下文/owner read 链，也无法把 196 个 route 的处理责任变为可编译对账。

**裁决**：采用 owner-local 静态 operation binding、命令事务内不可伪造上下文、任务型 read 受控组件和逐 operation 证据基线；禁止全局 dispatcher、service locator、动态 handler lookup、跨 schema 写和跨请求性能缓存。

## 3. 前提与授权边界

| 前提 | 来源类型 | 来源 | 未满足时的行为 |
|---|---|---|---|
| 当前 196 route 分母 | ESTABLISHED_SOURCE | 两份 generated route registry | exact-set 不一致即设计/实施失败 |
| 性能问题与样本边界 | ESTABLISHED_SOURCE | `doc/review/platform/2026-08-08-v2s-http-performance-problem-description-codex.md` | 不把 seed 样本泛化为全接口结论 |
| 重构原则与批次 | ESTABLISHED_SOURCE | Claude 性能重构方案 | 不以预估数替代实测基线 |
| 详设阶段 | IN_SCOPE_PRODUCED | 本 decision + implementation design | 完成 Claude review 前不得实施 |

本裁决仅授权**详设、静态审查工件与 Claude review 材料**。它不授权代码、契约、数据库、DEV、reset、seed、L2、UAT 或任何仓库控制动作。
