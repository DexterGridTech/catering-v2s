REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-design-granularity-manifest.json
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-design-review-round2.md

## 背景

Claude 已对 BP-U05 剩余 13 条 owner projection 的前一轮 POST_REMEDIATION_V1 修订给出 `GO (M=0/S=1/N=1)`。本次仅关闭其遗留的 S-01/N-01：R5 group-workspace 的 manifest 缺少 workspace-IAM aggregate 与组织初始化投影 surface，且一条前瞻性 forbidden-edge 规则此前不能与拼写错误的死规则区分。

本次作者修订没有生产 reader 实施、动态运行、SQL 数值优化、BP-U06、schema/DML 或 HTTP 行为变更。`implementationAuthority=false`；`BP_U05_READ_BUDGET_STATUS=BLOCKED_UNMEASURED` 与 `BP_U07_SQL_MERGE_SUCCESS=BLOCKED_UNMEASURED` 保持不变。独立 DESIGN Round 2 已硬停止，本次仍是 `POST_REMEDIATION_V1` 定向复核，不是第三轮独立审查。

## 评审目标

请独立确认以下两项修订真实、最小且没有把 R5 的同一事实读取叠加两次：

1. R5 `listPlatformGroupWorkspaces` 必须以 organization owner 初始化批替换 `WorkspaceAdministrationService#list` 内的 `EXISTS organization.commercial_group`，而不是保留 EXISTS 再调用新 port；detail 的 account/role 必须通过 `WorkspaceIamSummaryReadService#accountAndRoleSummary` 的单 owner statement 聚合。
2. forbidden-edge 分母真实为 15（13 条当前旧链、1 条已实现 contract 的正确空集、1 条前瞻 `initializationFacts.list(...)`）；仅前瞻规则可不命中当前 source，所有 blocked row 的非前瞻规则必须有 source liveness 证明。

## 需阅读文件

- `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-recheck-claude.md`：上一轮 Claude GO 与本次 S-01/N-01 原始依据。
- `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-author-intake.md`：本次逐项 `CONFIRMED` 处置、有限分母与替代方案。
- `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md`：`BP-U05 剩余 owner-projection delivery` 的 R5 replacement/retain 约束。
- `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-design-granularity-manifest.json`：当前 exact surface 与新的 `POST_REMEDIATION_V1` binding。
- `contracts/registry/task-read-surface-policy.json`、`scripts/generate/task-read-surface-policy.mjs`：15-rule object schema、liveness、admission 和真实 red mutations。
- `apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/application/WorkspaceAdministrationService.java`、`.../api/GroupWorkspaceTaskQuery.java`、`.../api/WorkspaceIamSummaryLookup.java`、`apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceIamSummaryReadService.java`：现有 owner/source 反例；只读核验，不授权修改。
- `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-design-review-round2.md`：本 cycle 独立 Round 2 硬停止的原 verdict。

## 独立核验重点

1. manifest 是否精确列出 R5 的 update/create surface：`WorkspaceAdministrationService` 与其 page test、`WorkspaceIamSummaryLookup`、`WorkspaceIamSummaryReadService` 与新 focused test、`GroupWorkspaceTaskQuery`、`PlatformWorkspaceService`、组织 initialization reader 与其 focused test，以及既有四条 R5 reader/edge surface；`create` 目标须确实尚不存在。
2. 现有 `WorkspaceAdministrationService#list` 是否确有跨 schema EXISTS；当前 `GroupWorkspaceTaskQuery` 是否还不是 organization owner projection；设计是否明确拒绝“保留 EXISTS 再加 port”的双读伪修复，并保留 command-only `PlatformWorkspaceService#initializeCommercialGroup` 于本批之外。
3. `WorkspaceIamSummaryReadService#accountAndRoleSummary` 是否是唯一正确承重边界：未来 single statement aggregate，而非把 `accountCount` 与 `roleCount` 两个调用藏进 task reader。
4. policy/generator 是否把 forbidden rules 建模为 `{pattern, prospective?: true}`；精确 `RULES=15`、`PROSPECTIVE=1`，唯一 prospective 是 `initializationFacts.list(...)`；13 条 blocked legacy chain 必须当前命中，而已实施 contract 的 absence 不得被误报为 dead rule。
5. source mutation 删除 `workspaces.list(...)` 是否命中 `BP_U05_FUTURE_READER_FORBIDDEN_EDGE_READ_NOT_LIVE`；把 prospective 标记撤掉是否红；旧 `reads.view(...)` 假绿插入是否仍命中 `BP_U05_FUTURE_READER_FORBIDDEN_EDGE_READ`。
6. `POST_REMEDIATION_V1` 是否仍绑定独立 Round 2 的 immutable hash，明确当前 bytes 未由独立 reviewer 审过、`implementationAuthority=false` 且需要 Claude recheck；不得把本次复核写成数值优化成功或 BP-U06 准入。

## Part B / Part C / Part D 命中对照

| 规范章节 | 命中 | 设计落点 |
| --- | --- | --- |
| Part B package-exit 分母 | 命中 | R5 的全部 owner/source/test create/update path 进入 exact manifest surface；未来实际变更仍须 Pre/Post receipt 对账。 |
| Part C owner / read boundary | 命中 | list 从 platform base page 转交 organization initialization projection；workspace-IAM summary 保持 owner-local aggregate；不引入跨 schema task join。 |
| Part C measurement truthfulness | 命中 | 15-rule liveness 仅为 source control；无 runtime evidence 时仍 `BLOCKED_UNMEASURED`。 |
| Part D review binding | 命中 | 独立 Round 2 不重开；当前字节以新的 POST_REMEDIATION_V1 intake/hash 请求 Claude 定向复核。 |
| UI interaction clauses | `NOT_APPLICABLE` | 保留现有 GET response 合同与两 admin app；本次只修 internal implementation-facing design。 |

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M/S/N`。如有 finding，请列出精确文件/行号、有限适用面、最小修复和是否需要 Dexter 产品裁决。请勿把静态门通过当成 SQL 数值优化成功。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 BP-U05 剩余 owner projection 做第二次 POST_REMEDIATION_V1 定向复核。

背景：你上次给出 GO（M=0/S=1/N=1），本次仅关闭当时的 S-01/N-01。R5 现已补齐 workspace-IAM aggregate、组织 initialization projection 和 focused tests 的 exact implementation surface；设计明确要求以 organization owner batch 替换 WorkspaceAdministrationService#list 的跨 schema EXISTS，禁止保留旧 EXISTS 再增加新 port。forbidden-edge 规则也已对象化：真实分母 15=13 条当前旧链+1 条已实现 contract 的正确空集+1 条 prospective initializationFacts.list；blocked legacy 规则均有 source liveness guard。

目标：请核验 R5 的 owner replacement、精确 source/test surface 和 15-rule liveness 修订真实闭合，且仍不构成实现或性能成功。

请从 catering-v2s 仓根阅读：
- doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-recheck-claude.md：上次 GO 与 S/N 原始依据；
- doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-author-intake.md：本次处置；
- doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md：R5 owner replacement 设计；
- doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-design-granularity-manifest.json：exact surfaces 与 POST_REMEDIATION_V1；
- contracts/registry/task-read-surface-policy.json 与 scripts/generate/task-read-surface-policy.mjs：15-rule/liveness/red fixtures；
- WorkspaceAdministrationService、GroupWorkspaceTaskQuery、WorkspaceIamSummaryLookup、WorkspaceIamSummaryReadService：现有 owner/source 反例（只读）。

请重点独立验证：R5 不是双读；所有新增/更新 surface 和 create/update 状态准确；accountAndRoleSummary 是单 statement aggregate；15/1 前瞻分母与 liveness 闭合；删除 workspaces.list、撤 prospective 或在 typed reader 旁插 reads.view 都必红；POST_REMEDIATION_V1 如实保留 implementationAuthority=false。请确认 BP-U06、动态环境和 SQL 数值优化均零进入。

请给出明确 GO 或 NO-GO；如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次仅复核 BP-U05 剩余 implementation-facing design 的 S-01/N-01 修订；不授权 BP-U06、DEV、reset/seed、L2/UAT、部署、仓库控制、生产 reader 实施或 SQL 数值优化成功声明。谢谢。
```
