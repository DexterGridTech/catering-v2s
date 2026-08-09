# 后台性能重构整体第一阶段实施复核请求

## 背景

本次交付是后台性能重构的整体第一阶段，仅覆盖 BP-U01 与 BP-U02：请求级 DB 观测、同 run 内容寻址快照、44 门处置账本，以及 196 route 的 owner-local 静态 binding。它不进入第二阶段 BP-U03/BP-U04、第三阶段 BP-U07 或第四阶段 BP-U05/BP-U06。

先前两轮独立实施审查分别发现 phase/readback、commercial-group replay 与 verify 接线错误。前两类已经由新受管 seed 与 snapshot 验证；Round 2 的 verify 接线 finding 已做最小 exact-set 修复。按两轮硬停治理，当前字节以 `POST_REMEDIATION_V1` 诚实标记为等待 Claude recheck，不把修复伪称为第三轮独立审查已覆盖。

## 评审目标

请独立确认整体第一阶段是否真的具备：

- 可信的 request-local DB operation 证据与同 run snapshot；
- 不会把 receipt replay、异常 readback 或无关 JDBC 往返伪造为 fresh command/readback；
- 44 历史门与 4 个一期新增门的真实处置、verify 接线与既有红门状态；
- 196 static binding 的 exact-set、上下文 kind 与 JDK negative compilation；
- 一期 implementation package 输入与 exit 是否诚实、是否未越权进入后续 BP-U03～BP-U07。

## 需阅读文件

- `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md`：一期范围与验收约束。
- `doc/evidence/platform/2026-08-09-v2s-backend-performance-phase1-package-input.json`：一期六类 source denominator、范围与禁止项。
- `doc/evidence/platform/2026-08-09-v2s-backend-performance-phase1-package-exit.json`：实际变更路径、受管证据与 post-remediation 绑定。
- `doc/evidence/platform/2026-08-09-v2s-backend-performance-phase1-gate-dispositions.json`：44 历史门和 4 个一期新增门的处置。
- `scripts/check/backend-performance-gate-dispositions`：44+4 exact-set、verify 命令接线和红变异。
- `scripts/check/backend-performance-evidence-snapshot` 与 `scripts/check/backend-performance-observability`：同 run snapshot 和可测性验收。
- `scripts/check/operation-handler-bindings`、`scripts/generate/operation-handler-bindings.mjs`、`contracts/registry/operation-handler-bindings.json`：196 static binding input/output/JDK negative proof。
- `doc/review/platform/2026-08-09-v2s-backend-performance-phase1-independent-review-round2.md`：第二轮独立审查的历史 NO-GO。
- `doc/review/platform/2026-08-09-v2s-backend-performance-phase1-post-remediation-intake-codex.md`：Round 2 finding 的最小修复与回读。

## 独立核验重点

1. 运行：
   - `scripts/check/backend-performance-gate-dispositions --self-test`
   - `scripts/check/backend-performance-observability --run-dir .runtime/r5`
   - `scripts/check/backend-performance-evidence-snapshot --check .runtime/r5/snapshots/a296fc19a9f5d6caf6f8afb593e75c498c3b61f74f510aa6b060c51b69d651bb`
   - `scripts/check/operation-handler-bindings`
   - `node tools/compliance-control/cli.mjs validate-package-exit doc/evidence/platform/2026-08-09-v2s-backend-performance-phase1-package-exit.json`
2. Snapshot 的 selectedRunId 应为 `rm1-seed-e91d3f07-63f9-410d-8933-fb30aef18f9b`，且应为 173 request events / 4177 DB operations、`missingPhases=[]`、`unclassifiedRatio=0`、owner command phase 缺失为空。
3. `EXISTING_VERIFY` 必须恰等于 `tools/verify-gates/verify.mjs` 内的 10 个 `scripts/check/*` command；不要因既有 verify 全链首败而将未接线门写为已接线。
4. 复核 `OwnerOperationDiagnostics` 的 command 开始点在 receipt replay 判定之后，`readback` 只在 supplier 成功返回后发 `READBACK_END`；不得接受 finally 伪 phase。
5. 保留 U06 runtime cutover 为 `DEFERRED_TO_BP_U06`；一期不得因静态 binding 产物而误称已替换旧 runtime dispatcher。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。

- `M`：阻断一期真实性、证据闭合、分母或越权范围；
- `S`：不阻断但必须进入后续 delivery unit 的具体问题；
- `N`：观察项或既有范围外红门。

每项请标明精确文件与行号、影响面、最小修复，以及是否需要 Dexter 产品裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次后台性能重构整体第一阶段（BP-U01/BP-U02）实施收口。

背景：本轮只完成请求级数据库观测、同 run 内容寻址 evidence snapshot、44 门处置和 196 owner-local 静态 binding。此前两轮独立实施审查已发现并修复 phase/readback、receipt replay 与 verify 接线问题；最后一项是 Round 2 后修复，已按 POST_REMEDIATION_V1 诚实声明，等待您的 recheck，不伪称第三轮独立审查。
目标：请独立核验一期是否真正闭合证据、门处置和静态 binding，同时确认没有越权进入 BP-U03～BP-U07。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md：一期范围与验收；
- doc/evidence/platform/2026-08-09-v2s-backend-performance-phase1-package-input.json：一期 source denominator；
- doc/evidence/platform/2026-08-09-v2s-backend-performance-phase1-package-exit.json：实际变更与证据；
- doc/evidence/platform/2026-08-09-v2s-backend-performance-phase1-gate-dispositions.json：44+4 门处置；
- scripts/check/backend-performance-gate-dispositions、scripts/check/backend-performance-evidence-snapshot、scripts/check/backend-performance-observability：一期治理与证据门；
- contracts/registry/operation-handler-bindings.json、scripts/generate/operation-handler-bindings.mjs、scripts/check/operation-handler-bindings：196 static binding；
- doc/review/platform/2026-08-09-v2s-backend-performance-phase1-independent-review-round2.md 与 doc/review/platform/2026-08-09-v2s-backend-performance-phase1-post-remediation-intake-codex.md：Round 2 和定向修复 provenance。

请重点独立核验：snapshot a296fc19a9f5d6caf6f8afb593e75c498c3b61f74f510aa6b060c51b69d651bb 是否同 run、173 request events/4177 DB operations、missingPhases 为空且 unclassifiedRatio 为 0；44 历史门与 4 个一期新增门是否 exact-set；EXISTING_VERIFY 是否精确等于 tools/verify-gates/verify.mjs 的 10 个 scripts/check 命令；receipt replay 与异常 readback 是否不会伪造命令/完成 phase；196 binding 是否仍保留 U06 runtime cutover deferred。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次评审只覆盖整体第一阶段 BP-U01/BP-U02 的实施与验收；不授权进入 BP-U03～BP-U07、SQL 合并或业务优化、DEV/reset/seed/L2/UAT，也不授权仓库控制动作。谢谢。
```
