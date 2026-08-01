---
title: RM1 implementation-facing design authorization
status: DEXTER_AUTHORIZED_DESIGN_ONLY
createdAt: 2026-07-28
programId: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
implementationAuthority: false
---

# RM1 implementation-facing design authorization

Dexter 于 2026-07-28 明确授权 Codex 把 RM1 候选 Roadmap 收敛为 implementation-facing
详设、串行实施计划及可审设计包，并在完成后交由 Dexter 与 Claude 评审。

本授权只覆盖下列设计产物：

- `doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md`
- `doc/review/platform/2026-07-28-v2s-rm1-design-granularity-manifest.json`
- 配套 chapter-hit map、输入清单、独立盲审与 Claude handoff。

它不改变现行 Roadmap 的 `CURRENT_*`，不授权业务源码、contract、migration、测试、脚本、
构建、DEV、seed/reset 或动态运行。实施必须在本详设经独立盲审、Claude review 与 Dexter
接受后另获明确授权。

## 设计中已作出的收敛裁决

这些是候选 Roadmap 内部矛盾的实现级收敛，不改变 G-01~G-12、R-22~R-30、已接受 Journey
或 operation-history 交互：

1. `x-required-capability` 升格为每 operation **恰一个** generated `CapabilityRequirement`；
   对多 target-type operation，它是一个 server-owned resolver reference，而不是由客户端
   pageKey 或 body 决定的第二把钥匙。
2. `updateOperationsOrganizationNode` 保持一个 operation；其唯一 requirement 是
   `ORG_NODE_EDIT`，server resolver 按已读取的 REGION/PROJECT 事实映射至既有
   `BC-ORG-REGION-EDIT` 或 `BC-ORG-PROJECT-EDIT`，前端只消费生成的可用动作，不推导能力。
3. R-24 的 receipt identity 在 P3-B 先演进为 workspace-scoped identity，再接 POST/DELETE；
   不把该 schema 前提拖到 P3-C。
4. 品牌授权 readback 不再含 `referencingStoreCount` 或 `canRevoke`。撤销由 owner 对全部
   store 不变量判定；Problem 只可列当前 actor 可见的最多 20 个 blocker，不返回总数、隐藏
   引用数量或“还有隐藏项”布尔值。
5. P4 的 N+1 分母先由扫描器生成 canonical call-path ledger；实现和预算只消费该 ledger，
   不接受 M/S 编号、"原 6 处"或手写计数作为完成判据。

