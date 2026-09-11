---
title: v2s 经营渠道模板门店可见范围 implementation review round 1 input checklist
status: READY_FOR_FRESH_INDEPENDENT_SUBAGENT
reviewTarget: IMPLEMENTATION
reviewCycleId: BUSINESS_CHANNEL_STORE_VISIBILITY_IMPLEMENTATION_20260909
reviewRound: 1
reviewRoundLimit: 2
reviewerKind: INDEPENDENT_SUBAGENT
---

# Review boundary

本文件只定义 fresh independent implementation review 的输入，不是作者自审结论，也不授予额外实现或运行授权。reviewer 必须以“找出当前实现为什么不成立”为起点，不能把 Claude follow-up DESIGN `GO` 当作 implementation review，也不能把静态 PASS 当作运行期行为证据。

本轮优先复核 CP-01 已变更的契约、生成链和 migration，并指出是否可以进入 CP-02。主 agent 是唯一写入者；reviewer 只读，不得修改文件、启动 DEV、reset、seed、backend acceptance、browser L2 或调用 Git。

# Required inputs

1. `AGENTS.md`
2. `PLATFORM-BLUEPRINT.md`
3. `doc/platform/README.md`
4. `doc/platform/roadmap-program-registry.json` 与当前 `V2S_W0_W4_EXECUTION` 授权字段
5. `scripts/README.md`
6. `CLAUDE.md`
7. `project-memory/index.md` 全部 kernel，以及六维 `scripts/context/recall-memory` 命中原文
8. `.agents/skills/cs-review/SKILL.md`、`.agents/skills/cs-semantic-source-reconciliation/SKILL.md`、`.agents/skills/cs-code-structure-recall/SKILL.md`
9. `doc/decisions/2026-09-08-v2s-business-channel-store-visibility-journey-amendment.md`
10. `doc/decisions/2026-09-08-v2s-business-channel-store-visibility-ia.md`
11. `doc/decisions/2026-09-08-v2s-business-channel-store-visibility-ui-interaction.md`
12. `doc/plans/platform/2026-09-08-v2s-business-channel-store-visibility-implementation-design.md`
13. `doc/plans/platform/2026-09-08-v2s-business-channel-store-visibility-implementation-plan.md`
14. `doc/review/platform/2026-09-09-v2s-business-channel-store-visibility-design-review-followup-claude.md`
15. `contracts/openapi-source/business-channel.schemas.json`
16. `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`
17. `doc/plans/platform/2026-07-26-v2s-r5-edge-contract-file-placement-catalog.json`
18. `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json`
19. `contracts/registry/operation-handler-bindings.json`
20. `scripts/generate/r5-edge-materialize.mjs`
21. `scripts/generate/edge-codegen.mjs`
22. `scripts/generate/operation-handler-bindings.mjs`
23. `apps/backend/catering-business-server/src/main/resources/db/migration/V20260908_000000_003__business_channel_template_store_visibility.sql`
24. current materialized OpenAPI, generated route/binding/wire outputs corresponding to items 15–22

# Blind review assertions

- 对比 Journey、IA、interaction、implementation design、implementation plan 与当前 bytes，逐点核对 scope、最终 refs、PROJECT/STORE 互斥、空集合、VOIDED 保存、非 VOIDED count、ALL/NON_VOIDED read filter、候选/创建 ENABLED 门禁、既有 channel 保留与 operation 边界。
- 重点找反例：source 与 generated 漂移、placement/denominator 不闭合、operation binding 缺失或错误、错误码不在 active registry、migration 回填/约束/外键/索引错误、跨 owner FK 或关系级联错误、把 VOIDED ref 错误拒绝、只读详情与编辑 ALL 读取混淆。
- 对每条 finding 标记 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`，并给出最小修复与适用边界。
- 输出固定声明：`REVIEW_CYCLE_ID=BUSINESS_CHANNEL_STORE_VISIBILITY_IMPLEMENTATION_20260909`、`REVIEW_TARGET=IMPLEMENTATION`、`REVIEW_ROUND=1`、`REVIEW_ROUND_LIMIT=2`、`reviewerKind=INDEPENDENT_SUBAGENT`、`BLIND_REVIEW_DECLARATION=TRUE`，以及 `MATCHED` 或 `OPEN` 的 CP-01 步骤结论。
