---
title: RP-02a-U01 implementation review request (Claude)
reviewTarget: IMPLEMENTATION
reviewCycleId: WHOLE-ENGINEERING-RP-02A-IMPLEMENTATION-20260805
reviewRound: 2
status: AWAITING_CLAUDE_REVIEW
codexIndependentVerdict: NO-GO
codexCounts: M=0 / S=1 / N=0
authorizationBoundary: 仅复核 RP-02a-U01 静态实施与当前 deferred blocker；不授权修改 contracts/openapi/generated wire、backend/frontend/database、DEV/UAT/runtime、HTTP/L2、seed/reset、Roadmap 或 Git
---

# 给 Claude 的可复制复核 brief

## 背景

RP-02a-U01 依据已接受的 RP-02a implementation-facing 详设，修复 generated route-face
denominator 演进后未同步的静态消费者：154 个 concrete catalog/facts 对账、projection identity、
diagnostic/fixture payload-query 边界和 RM1 recovery assertion。实施没有改生产契约、后端、前端、
数据库，也没有启动 DEV/HTTP/L2/seed/reset。

## Codex 独立复核结果

独立 Round 1：`NO-GO M=1/S=1/N=0`；独立 Round 2（final）：`NO-GO M=0/S=1/N=0`。

- M-01 已关闭：七个 operations command body 不再发送 catalog 全局禁止的
  `expectedContextVersion`；focused test 从 catalog `forbiddenProperties` 派生禁止字段并逐 request body
  断言，Round 2 11/11 workload tests PASS。
- S-01 控制已修复但 gate 仍被外部漂移阻断：`r5-edge-materialize --check` 现在比较完整的
  `contracts/openapi` path/component 文件集合与字节，并对 path/component drift 做真实 red mutation；
  当前真实输出为
  `R5_EDGE_GENERATED_OUTPUT_DRIFT:components/contract/contract.schemas.yaml`。
  scratch materialization 对 `StoreContractCreateRequest` 新增 `projectId`，当前文件 SHA
  `19ed2f73619366e935b7eb4371fdc71cb29c68006b2e85d084eac76cd7970911`，确定性 materialized SHA
  `547092d02328a69672475e6c2a0a44f3f8fcca9d8c6d849a7ae666c521c50961`。
- 详设明确禁止本单元改 `contracts/openapi`/generated wire（见
  `doc/plans/platform/2026-08-05-v2s-whole-engineering-rp-02a-implementation-design.md:50-53`），
  所以 S-01 记录为 `CONFIRMED + controlFix PRESENT + OUT_OF_SCOPE_DEFERRED`，没有伪造 PASS。

## 请独立核查

请先读取并核对以下仓根相对路径与真实源码，再给 `GO/NO-GO` 及 `M/S/N`：

1. `doc/plans/platform/2026-08-05-v2s-whole-engineering-rp-02a-implementation-design.md`
2. `doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-implementation-independent-review-round1-fresh.md`
3. `doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-implementation-independent-review-round2.md`
4. `doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-implementation-intake-codex.md`
5. `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`
6. `scripts/test/http-diagnostic-workload.mjs` 与 `.test.mjs`
7. `scripts/generate/r5-edge-materialize.mjs`、`scripts/check/r5-edge-materialize`
8. `contracts/openapi/components/contract/contract.schemas.yaml`

重点判断：M-01 是否确实关闭；S-01 的控制修复是否真实覆盖缺失/额外/字节漂移；当前
`contracts/openapi` 漂移是否属于本包明确禁止的 generated-wire 范围；若不授权扩大范围，是否接受
`NO-GO M=0/S=1/N=0` 与下一包 contract reconciliation blocker，而不是把 package exit 判为 PASS。

## 期望输出

- `VERDICT=GO|NO-GO`
- `COUNTS=M/S/N`
- 每条 finding 的 `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / DEXTER_DECISION`
- 若保持 NO-GO，给出最小 contract/generated-wire reconciliation 入口；不得建议 DEV/HTTP/L2/seed/reset
  来掩盖静态 contract drift。

授权边界：仅复核 RP-02a-U01 静态实施和 S-01 deferred blocker；不授权任何生产契约、generated wire、
应用、数据库、动态环境、seed/reset 或 Git 变更。

