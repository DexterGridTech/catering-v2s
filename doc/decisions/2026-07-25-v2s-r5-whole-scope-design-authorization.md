---
title: R5 全范围 implementation-facing design 精确授权
status: ACTIVE_AUTHORIZATION
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
authorizationOwner: Dexter
implementationAuthority: false
r5DesignAuthority: true
r5ImplementationAuthority: false
scopeDecisionRef: doc/decisions/2026-07-25-v2s-r5-scope-and-method-decisions.md
---

# R5 全范围 implementation-facing design 精确授权

## 授权原文

Dexter 于 2026-07-25 明确授权：

> 授权，设定goal，完成R5 全范围 implementation-facing design，然后给我和Claude做review

## 精确范围

本授权允许 Codex 以已冻结的 R5 范围与方法裁决为唯一范围 owner，一次性完成：

1. 32 项 source-backed inventory 的全范围 Journey decision；
2. UI-bearing Journey 的 all-v2 carry-over-first 盘点、交互工件与低保真视觉基线；
3. R5 全范围 implementation-facing design 与 granularity manifest；
4. `REVIEW_TARGET=DESIGN` 的两轮 fresh 独立子 agent 对抗盲审、作者辩证 intake；
5. 面向 Dexter 与 Claude 的一次性全范围 design review packet。

R5 仍是一个设计包、一个后续实施包、一个全范围复核单元。A/B/C 及其内部 group 只用于
依赖、验证、证据和失败定位，不形成单独 review target、verdict 或 closure。

## 未授权

本授权不允许 R5 implementation，不允许修改或创建业务 contract、app、数据库、Flyway、
测试源码或业务源码，不允许启动 DEV、连接远端中间件、执行 seed/reset 或任何动态业务运行。
设计通过、Claude GO 或 Dexter 看图均不自动产生实施授权。

