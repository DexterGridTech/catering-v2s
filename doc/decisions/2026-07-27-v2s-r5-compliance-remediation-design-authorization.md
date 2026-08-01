---
title: R5 合规整改 Roadmap 与详设编制授权
status: DEXTER_AUTHORIZED_DESIGN_ONLY
createdAt: 2026-07-27
programId: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
reviewTarget: DESIGN
implementationAuthority: false
runtimeAuthority: false
seedResetAuthority: false
---

# R5 合规整改 Roadmap 与详设编制授权

## 1. 精确授权

Dexter 授权 Codex 以
`doc/review/platform/2026-07-27-v2s-r5-current-code-comprehensive-diagnostic-claude.md`
为整改范围输入，形成新的 R5 合规整改 Roadmap、implementation-facing 详设、实施计划及可送审设计包。

本轮允许：

1. 只读重开当前源码、冻结设计、项目记忆、契约、控制与诊断证据；
2. 独立复核诊断中的推论，并按
   `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE /
   UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION` 登记；
3. 写入本轮 decision、Roadmap 候选、design/plan、granularity manifest、
   独立子 agent 对抗审查及 Claude handoff；
4. 运行不构建、不访问动态环境、不改变业务数据的静态治理检查。

## 2. 明确不授权

在 Dexter 接受新 Roadmap 与详设之前，本授权不允许恢复业务实施，不允许修改业务源码、契约、
migration、测试或 `scripts/`，也不允许构建、DEV、seed/reset、数据库或其他动态验证。
旧 R5 implementation authorization 被本轮受控暂停；它不能作为绕过新设计评审的入口。

## 3. 冻结输入与待裁决

- 继续冻结：106 operation（39/56/11）、32 scenario、22 surface、25 pageDesignKey、
  7 owner schema、G-01～G-12、D-01～D-11、已接受 Journey 与交互工件。
- 已裁决：R-15 多任职选择时机、seed 量级、包级串行与“做一点、验一点”。
- 仍由 Dexter 裁决：本设计中的 D-1～D-7。Codex 只能给候选与推荐，不得把推荐写成既定事实。

## 4. 评审纪律

本轮建立新的 `REVIEW_CYCLE_ID=R5-COMPLIANCE-REMEDIATION-DESIGN-20260727`。
必须先由 fresh 独立子 agent 盲审，再送 Claude 与 Dexter；两轮上限不变。

