# 性能门根因修复计划 · 第三轮独立复核

`REVIEW_CYCLE_ID=CATALOG_WORKBENCH_PERFORMANCE_GATE_ROOT_CAUSE_20260825`
`REVIEW_ROUND=3`
`REVIEW_ROUND_LIMIT=3`
`reviewerKind=INDEPENDENT_SUBAGENT`
`BLIND_REVIEW_DECLARATION=true`
`ROUND_FINAL_DECISION=SELF_DECIDED`
`INPUTS=AGENTS.md; project-memory/decisions/deterministic-context-only.md; root-cause plan; performance implementation design; serial plan; reconciliation verifier; event verifier; managed runner; coverage fixture; interceptor; P1; edge-codegen; shared budget validator; budget tests; generated registries`

## Verdict

`REVIEW_TARGET=DESIGN`
`VERDICT=NO-GO`
`M/S/N=1/2/0`
`EVIDENCE_TIER=STATIC_SOURCE_AND_DOCUMENT_ONLY`

## Independent findings

1. 文档层的历史分母已关闭：`238=181+57`、`57` 与 `108` 均已降为历史快照；当前生成 registry 静态复算为 `181+59=240`，无重复。80 条 `@AcceptanceScenario` 与 240 个 run-level operation 的分母已分离。
2. 唯一 M 是待实施的专用 fixed-budget 上调门：当前共享 `validateBudgetChange` 允许带 `decisionRef` 的上调，两个 generator 的现有 red fixture 也只验证无 `decisionRef` 的上调。计划要求的 remediation 专用拒绝尚未进入执行源；实施必须新增 `PERFORMANCE_REMEDIATION_FIXED_BUDGET_INCREASE_FORBIDDEN` 的机械 verifier，并在共享测试和两个 generator self-test 各留带 `decisionRef` 的独立红夹具。
3. 两条 S 是待实施计量链的精确落点：`ScenarioContext` 注入 measurement header、coverage fixture 区分 normal/coverage、interceptor 写 event、event verifier 要求字段、operation reconciliation 只消费 `SUCCEEDED + allowed normal`；coverage fixture 的 `108` runtime assertion 必须由 current exact-set matrix 替换。

## Evidence matrix

| Check | Result | Evidence |
|---|---|---|
| current denominator | PASS | generated registries: edge=181, catalog=59, union=240 |
| historical denominator no longer executable in docs | PASS | implementation design §1 addendum; serial plan §0.1 |
| 80 scenario vs 240 operation | PASS | `BackendAcceptanceTest` discovery and non-scenario coverage test |
| decisionRef fixed increase rejected now | FAIL / implementation work | `backend-performance-budget.mjs`, `backend-performance-budget.test.mjs`, `edge-codegen.mjs`, `catalog-inventory-p1.mjs` |
| normal/coverage design | PASS / implementation pending | root-cause plan §3A-B; detailed design addendum; serial plan §0.1 |
| normal/coverage execution | PENDING IMPLEMENTATION | interceptor, parser, reconciliation, context, coverage fixture |

## Author intake boundary

本 verdict 的 M 指向尚未开始的实现源，而非已批准模型的产品矛盾。Dexter 已明确授权第三轮后按修复计划实施；因此作者会先在写入前回读本 verdict、详设和 owning source，再按单一计量契约实现，完成每个改点即做设计对账和静态 proof，之后才进入动态 Testcontainers。
