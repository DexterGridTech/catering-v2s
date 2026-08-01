---
title: Admin catalog truth model independent adversarial review round 2
REVIEW_CYCLE_ID: RM1P6-ADMIN-CATALOG-TRUTH-MODEL-20260730
REVIEW_TARGET: DESIGN
REVIEW_ROUND: 2
REVIEW_ROUND_LIMIT: 2
reviewerKind: INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION: SELF_DECIDED
status: IMMUTABLE_HISTORICAL_VERDICT
---

# Admin catalog truth model independent adversarial review round 2

This records the fresh independent subagent's round-2 verdict before author
post-remediation. It is immutable historical review evidence; it does not
represent the later repaired design bytes as independently reviewed.

`GO/NO-GO=NO-GO (M=0 / S=3 / N=1)`

`BLIND_REVIEW=先重开 current catalog、generator、后端 IAM 与 operations consumers，再读取设计的 round-1 intake；没有把作者处置当作证据。`

## Confirmed direction

- `ROLE_HOME` 与可授予的 `BUSINESS` page 的概念分离与当前 `managedPageCatalog()` 一致；以 generated
  role-home lookup 取代 `WorkspaceAuthenticationService.homePage()` switch 合理。
- P6-2 只禁止本次跨 app catalog migration、但不撤销既有 platform 实施授权的边界正确。
- ACTION 单 target PAGE、同 face、role-node type 为 target PAGE 子集的方向正确；当前 34 action 均满足。
- request-level security 继续由 `WorkspaceCapabilityScopeResolver`、session、assignment、owner target 与
  IAM registry 决定，不能被 catalog 取代。

## Findings

| ID | 状态 | owning evidence | 最小修复 |
| --- | --- | --- | --- |
| S-1 | `CONFIRMED` | `PageNode.pageAccess` 在被审设计中为 optional；current generator/`WorkspaceRoleService` 依赖它闭合 PAGE/ACTION/role-save。 | 将 PAGE 判别为 5 `OperationsRoleHomePage`、12 `OperationsBusinessPage`、8 `PlatformPage`；后者两个分别强制完整 fields 或禁止 operations authorization fields。 |
| S-2 | `CONFIRMED` | `WorkspaceUserPage.tsx` 与 `WorkspaceInvitationPanel.tsx` 都需要 target organization 与 invite/revoke action；只有 `userManagementActionFor(page,purpose)` 不足以收口 feature 遍历。 | 生成 `userManagementFor(pageKey) -> {targetOrganizationType, inviteActionKey, roleRevokeActionKey}`，两个 feature 只消费该 projection。 |
| S-3 | `CONFIRMED` | 任意 `labelRef` 要求生成器判断“同一显示语义”，不是可机械的合同谓词；navigation/action group 同名不等价。 | 删除 `labelRef`；每个业务节点直接持有 non-empty `display.label`，仅同节点的多 surface 复用。 |
| N-1 | `CONFIRMED` | `WorkspaceAuthorizationCatalog.java` 当前同时投影 home 与 business pages，home switch 在 authentication service。 | future package 冻结现有 resolved projection；仅允许新增 `homePageForRoleNodeType` 与替换 switch 的 diff allowlist。 |

## Boundary

This review authorizes no catalog, generator, Java, frontend, API, runtime,
seed/reset, L2, P6-3, or dynamic-business change. The two independent rounds
are exhausted. Any author repair must use `POST_REMEDIATION_V1` provenance and
Claude recheck; no third independent subagent round is permitted.
