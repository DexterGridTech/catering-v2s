---
reviewCycleId: OVERALL_PHASE_4_U05_REBASELINE_DESIGN_20260809
reviewRound: 1
reviewRoundLimit: 2
reviewTarget: DESIGN
reviewerKind: INDEPENDENT_SUBAGENT
authorMaterialExcludedUntilVerdict: true
---

# BP-U05 读侧重划独立盲审输入｜Round 1

## 盲审任务

先证伪，不读取作者 intake 或 disposition。审查本轮重划是否把未完成的 read-side SQL-M1/M2
如实移入 BP-U05，并在不改变 HTTP 行为、不给 command 调 task reader、不让 protocol GET 进入
workspace facts、也不触碰 BP-U06 的前提下，形成可实施且可机械验证的 83 GET policy。

## 已重开输入

| 输入 | path | SHA-256 | 已读用途 |
| --- | --- | --- | --- |
| 仓库约束 | `AGENTS.md` | `4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda` | owner、事务、独立审查和范围边界 |
| Claude 交接 | `CLAUDE.md` | `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f` | 后续外部 review 约束 |
| 蓝图 | `PLATFORM-BLUEPRINT.md` | `38d6138be17a514ded4188f8f71555c480eb3582abcb4f265ffa757792d9b039` | owner 与 task-read 边界 |
| program registry | `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | `V2S_W0_W4_EXECUTION` 选择 |
| current Roadmap | `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `d2490f5038f02ad40b19150a377a2188f313350d965460c3a07ab4c1c3f4eb73` | current-state 与外部范围反例 |
| 重划裁定 | `doc/decisions/2026-08-09-v2s-backend-performance-phase3-to-phase4-rebaseline.md` | `1ff0686885de919c4ed0d1b2721bd447231eb47e8cf3f6592958e710529d9c40` | 58/60 分母和 phase ownership |
| 被审详设 | `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md` | `cc38b3e389e1e32300d59170f18b155fcbc1d4f812efaabad7f0db4a1545da46` | BP-U05、M1/M2、audit branch 约束 |
| 被审 manifest | `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-rebaseline-design-granularity-manifest.json` | `bb60f8f08684187200d78d8177dded767bc933ccaef73bd8c6c15951335187e8` | delivery path/denominator 绑定 |
| design package input | `doc/evidence/platform/2026-08-09-v2s-backend-performance-phase4-u05-rebaseline-design-package-input.json` | `03d001576f35f06401979a83145270c2d1cb994d152c114d191a3fbab9fa418a` | 当前设计授权边界 |
| M1/M2 control | `contracts/registry/backend-performance-sql-merge-applicability.json` | `010ab495f87a0cf4da4b81592fd88a343d991317c199684e0b5b965d0274321c` | 126/60 source-proven partitions |
| route binding | `contracts/registry/operation-handler-bindings.json` | `23d46ffcc3ae4e6d05065a29b81c57b90b6ad29dfc0c98ab3bfa302df02d1b4f` | 196/83/68/7/58 exact binding |
| M1/M2 generator | `scripts/generate/backend-performance-sql-merge-applicability.mjs` | current bytes | exact-set derivation and fact implementation control |
| operations edge source | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/session/OperationsSessionResolver.java` | `d026fa560075fe5b9de97ce39141f570693a7d4f5d70587a4579b0a23b8d3b4a` | current session/cache call boundary |
| C5 owner source | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceAuthenticationService.java` | `58933ed7c236e311d2b43af520f57bc1530b1089c1dba2f9007a2ad0f10bb76a` | `selectContext` / `selectDataNode` transaction path |
| organization facts | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationVisibilityService.java` | `045759848c6c17d881a36830b6f266802f2d42aff0936f4f995840c424242bf3` | visible-fact source and current multi-query shape |
| platform audit branch | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/audit/PlatformAuditHistoryController.java` | `7dd2df46272a3ef6ecc4e74e7170feeeedba7cd81fcf5e9fb734d16a5af7b44e` | branch-specific enabled-workspace counterexample |
| deterministic context memory | `project-memory/decisions/deterministic-context-only.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20` | real gate/review destination |
| HTTP efficiency memory | `project-memory/decisions/http-crud-efficiency-design-redlines.md` | `80efcb002dde542c9cbcc08f19b0cec62f20e66c54d6d581650809ef8f33c876` | per-operation contract and owner-local repair |
| independent review memory | `project-memory/decisions/independent-subagent-adversarial-review.md` | `891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf` | blind-review protocol |
| standards matrix | `contracts/policy/standards-coverage-matrix.json` | `3ccb1f7c1913e86a36fc6f39e3b1155478654a3cf41e5531d9bcbb79be2825a8` | due standard source anchors |

## Independent derivations and red boundaries

- Two generated route registries and bindings yield `196` routes, `83` GET, `78` task-read candidates,
  five closed protocol/content exemptions, operations-admin `68 OWNER_COMMAND + 7 PROTOCOL command +
  58 task-read + 1 protocol GET`; M1 is `68 + 58 = 126`, M2 is `2 C5 + 58 = 60`.
- The five exemptions are `getCurrentPlatformSession`, `getOperationsWorkspaceLoginEntry`,
  `getPublicInvitationView`, `getPublicInvitationCompletion`, and `getPublicAssetContent`; the pre-login
  operations workspace entry must never load workspace authorization or organization visibility facts.
- The audit controller currently sends `GROUP_WORKSPACE` and five workspace-host target branches through
  the same `scope()` → `requireEnabled` path. The design claims only the five workspace-host branches may
  use `EnabledSelectedWorkspaceFact`; that is a direct counterexample, not a naming concern.
- C5 commands mutate session context in `WorkspaceAuthenticationService#selectContext/#selectDataNode`,
  and only their resulting `sessionEntry` invokes `OrganizationVisibilityService`; this cannot be solved
  by moving a task reader into the command transaction.
- Corpus query terms `backend performance`, `task read`, `SQL-M1`, `SQL-M2`, and `read-side rebaseline`
  have no confirmed product/Journey corpus entry; this is technical maintenance and no user behavior may
  be inferred.

## Required output

Write a source-first `GO` or `NO_GO` with M/S/N findings, finite denominators, counterexamples and
smaller repairs. The review must not change plan, implementation, contract, generator, or test sources.
It may create only this checklist and its review artifact.
