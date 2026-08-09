# BP-U05 owner-projection rebaseline Claude 定向 recheck

REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN  
DESIGN_GRANULARITY_MANIFEST=doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-rebaseline-design-granularity-manifest.json  
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-08-09-v2s-backend-performance-phase4-owner-projection-rebaseline-design-review-round2.md

## 背景

BP-U05 的 B=78 task-read 预算重基线在独立 DESIGN Round 2/2 后仍有 M=1、S=1。作者没有发起
第三轮：按 `POST_REMEDIATION_V1` 只补了最小的可执行 design binding。现有 operations audit edge
实际先进行 host authorization lookup 再读 audit，不能诚实称为 cap=1；同时，未来 platform/group-
workspace readers 未被 package/manifest 承认。当前 granularity gate 的 `PASS` 只表示 provenance
闭合，输出明确为 `DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`，不是设计 GO 或 implementation
authority。

## 评审目标

请独立判断本次最小修订是否真实关闭 Round 2 的 M/S：

1. `getOperationsEntityAuditHistory` 是否以正确的**实际九类型**分母（而非早期“八 branch”摘要）建立
   静态 typed reader contract，且仍保持 cap=1、owner sovereignty、typed absent/mismatch/scope 行为；
2. future reader/source/test surface 是否在实现前已精确进入 manifest/package；
3. `modules/audit` 不存在时选择 app application 静态 coordinator 是否比跨 schema SQL、通用 dispatcher
   或虚构 module 更小且符合 owner 边界；
4. 当前状态是否仍诚实为 `BLOCKED_UNMEASURED`、BP-U06 零进入。

## 需阅读文件

- `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-rebaseline-design-granularity-manifest.json`：当前 POST_REMEDIATION_V1 binding，SHA-256 `3183260539c9da8785aae8c4f407c606578b500d6d5c2e21a5789709b15b801b`。
- `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-owner-projection-rebaseline-design-review-round2.md`：独立 DESIGN Round 2 的原始 NO-GO，SHA-256 `cb55d66ae20f3c7ba53e670c3309a7f9efd8bb8cee7a02c2cc4d296adfadd9b0`。
- `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-owner-projection-rebaseline-author-intake.md`：作者逐项重新打开源码后的 disposition，SHA-256 `b4c79c61d999efe83c55c88c0d2e9c9d71cdca3d0961ac098f56748e6ad7f399`。
- `doc/decisions/2026-08-09-v2s-backend-performance-phase4-owner-projection-rebaseline.md`：10 个跨 owner cap exception 及 operations-audit cap-one contract，SHA-256 `cd475e35288e9ebdafd3380d7756e27daeab0f17fdcf15e193cf92e9c8b30759`。
- `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md`：BP-U05 78-row/owner-local/read-budget 详设，SHA-256 `3c83b0e587b57587e18602de05e4df27ceb1a9bae1bd022e233e653b23e133c1`。
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/audit/OperationsAuditHistoryController.java`：旧 lookup chain 与真实九 type 分母。
- `contracts/registry/task-read-surface-policy.json`、`scripts/generate/task-read-surface-policy.mjs`、`scripts/check/backend-performance-read-budget`：83/78/5 分母、status 与 red control。

## 独立核验重点

- 从 controller 自己重数 entity type，不依赖作者文字；检查九 type 是否覆盖原 switch，且所有原 typed
  failure/host-scope 结果有明确归属。
- 验证 `OperationsAuditTaskReadService` 是 compile-time closed typed coordinator，不拥有表、不接受
  operationId/表名/字段名、不引入跨 schema SQL，也不让 edge 保留 detail/view/authorization lookup。
- 核验三个尚未实现 reader 的 production/test path 均进入 manifest 与 active package；它们必须仍为
  `SOURCE_NOT_IMPLEMENTED_BLOCKED`，不应被统计为已完成。
- 新鲜运行：
  `scripts/check/implementation-design-granularity --manifest doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-rebaseline-design-granularity-manifest.json --review doc/review/platform/2026-08-09-v2s-backend-performance-phase4-owner-projection-rebaseline-design-review-round2.md`；
  `scripts/check/backend-performance-read-budget --check`；
  `scripts/check/backend-performance-read-budget --self-test`；
  `scripts/check/standards-coverage --phase R5`。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。如有 finding，请按 `M` / `S` / `N` 给出精确文件与行号、影响面、最小修复建议及是否需要 Dexter 产品裁决。尤其请区分：机器门 provenance PASS、设计 recheck GO、以及尚未发生的 SQL 数值优化/动态业务证据。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 BP-U05 owner-projection rebaseline 的 POST_REMEDIATION_V1 定向 recheck。

背景：独立 DESIGN Round 2/2 对 BP-U05 给出 NO-GO（operations audit cap-one 缺少可执行 typed reader contract，且未来 reader source/test surface 未承认）。Codex 未启动第三轮，而是按 POST_REMEDIATION_V1 重新打开源码并补最小 binding；当前机器门只表示 DECLARED_POST_REMEDIATION_AWAITING_CLAUDE，不是设计 GO 或 implementation authority。
目标：请独立核验该修订是否真正闭合两项 finding，尤其是 operations audit 的真实九类型分母、cap=1 owner-local projection、未来 reader/test surface、以及 BP-U06/动态范围仍未扩张。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-rebaseline-design-granularity-manifest.json：当前 POST_REMEDIATION_V1 binding；
- doc/review/platform/2026-08-09-v2s-backend-performance-phase4-owner-projection-rebaseline-design-review-round2.md：独立 Round 2 原始 NO-GO；
- doc/review/platform/2026-08-09-v2s-backend-performance-phase4-owner-projection-rebaseline-author-intake.md：作者辩证处置；
- doc/decisions/2026-08-09-v2s-backend-performance-phase4-owner-projection-rebaseline.md：10 个 exception 与 cap-one audit contract；
- doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md：BP-U05 详设；
- apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/audit/OperationsAuditHistoryController.java：真实旧链与 type 分母；
- contracts/registry/task-read-surface-policy.json、scripts/generate/task-read-surface-policy.mjs、scripts/check/backend-performance-read-budget：控制与状态。

请重点独立核验：controller 实际九 type 是否全被 typed reader contract 覆盖；新 coordinator 是否没有 operationId dispatch、跨 schema SQL 或 edge legacy lookup；尚未实现的 reader/test paths 是否都已进入 manifest/package 且仍诚实 BLOCKED；并新鲜复跑 granularity、read-budget check/self-test 与 standards R5。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次 GO 仅可恢复 BP-U05 的剩余 implementation-facing design 与实现准备；不授权 BP-U06、SQL 数值优化成功声明、DEV、reset/seed、L2/UAT、部署或仓库控制动作。谢谢。
```
