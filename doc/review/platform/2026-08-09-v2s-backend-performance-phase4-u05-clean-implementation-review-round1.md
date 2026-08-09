---

REVIEW_CYCLE_ID=OVERALL_PHASE_4_U05_CLEAN_IMPLEMENTATION_20260809
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_CYCLE_ID: OVERALL_PHASE_4_U05_CLEAN_IMPLEMENTATION_20260809
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 1
REVIEW_ROUND_LIMIT: 2
reviewerKind: INDEPENDENT_SUBAGENT
status: ARCHIVED_ROUND_1
---

# BP-U05 clean implementation adversarial review — Round 1

## Blind-review declaration and input binding

This verdict was formed from the current production sources, policy/generator, package input and
contract paths listed below before consulting any author self-review, finding disposition or Claude
interpretation. Earlier design reviews were not used as an implementation conclusion.

| Input | SHA-256 |
| --- | --- |
| `AGENTS.md` | `4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda` |
| `PLATFORM-BLUEPRINT.md` | `38d6138be17a514ded4188f8f71555c480eb3582abcb4f265ffa757792d9b039` |
| `doc/evidence/platform/2026-08-09-v2s-backend-performance-phase4-u05-clean-implementation-package-input.json` | `1199fae0b39019ae9285e483f733dfb51d91c555dcc8de4f5e0cee1fb11e2da8` |
| `doc/decisions/2026-08-09-v2s-backend-performance-phase4-owner-projection-rebaseline.md` | `cd475e35288e9ebdafd3380d7756e27daeab0f17fdcf15e193cf92e9c8b30759` |
| `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md` | `79ecbd69629f764529aa647cafa9efeea12f0cfe4a34a9904d87027b161c6f69` |
| `contracts/registry/task-read-surface-policy.json` | `a1f54fc79621ab204f6c6921fe8b4142cd6e1f420325c730bacc22d589bd6617` |
| `scripts/generate/task-read-surface-policy.mjs` | `888db8289f17ce6f3f9e1e6a31e7a101298d12f45b70002344758eed8d08a9be` |

## Verdict

`M=0 / S=1 / N=2` — **NO-GO pending the S finding.**

### S-01 — audit GET validation escaped the contract Problem boundary

`OperationsAuditHistoryController#history` and `PlatformAuditHistoryController#history` forwarded raw
entity identifiers and pagination into typed readers. Owner projections throw `IllegalArgumentException`
for invalid UUIDs or page bounds, but `ContractProblemAdvice` has no corresponding handler. This can
surface a default 500 instead of the documented `ProblemResponse`.

- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/audit/OperationsAuditHistoryController.java:33`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/audit/PlatformAuditHistoryController.java:29`
- `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceIamAuditHistoryService.java:97`
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationAuditHistoryService.java:89`
- `apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/ContractAuditHistoryService.java:67`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java:153`

Required minimal repair: validate the wire input at the applicable edge/typed-query boundary and throw
the existing `InvalidEdgeRequestException`; retain typed owner 403/404 behavior.

### N-01 — platform audit projection test did not prove its current owner call

The test stubbed former `readWorkspaceRole/readWorkspaceAccount/readWorkspaceInvitation` methods while
production used `readPlatformAuditProjection`; it did not verify the owner invocation or no extra
interactions.

- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/application/audit/PlatformAuditHistoryTaskReadServiceTest.java:51`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/application/audit/PlatformAuditHistoryTaskReadService.java:56`

### N-02 — workspace-key negative test was not executable

The method that asserted a hosted platform-audit target without `groupWorkspaceKey` had no `@Test`.

- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/platform/audit/PlatformAuditHistoryControllerTest.java:60`

## Independently confirmed non-findings

- 78 task reads plus 5 protocol exemptions over 83 GET routes, and the exact ten multi-owner exceptions,
  passed the policy generator; its outcome remained `BLOCKED_UNMEASURED`.
- Operations audit used a closed nine-type edge switch and a typed owner-reader coordinator without the
  former authorization/detail/view chain.
- `PLATFORM_ADMIN` used only the platform-IAM branch; workspace-hosted variants alone resolved an enabled
  selected workspace.
- BP-U06 remained deferred, and the clean package did not claim runtime, L2/UAT, seed/reset or SQL
  numeric success. The package exit was still PENDING, so this review did not treat it as closure.

## 用户任务

业务用户需要两个审计 GET edge 在读路径进入 typed task reader 前，对无效 wire 输入返回契约化
ProblemResponse；此 clean package 的范围是 78 个 task-read reader 的静态实施核验，不含 runtime。

## Dexter 立场

Dexter 已限定 BP-U05 clean package 以及无 runtime、DEV、seed、reset、L2、UAT 和 BP-U06
cutover 的授权边界。本轮不把静态 gate 当作业务或 cleanup 完成。

## 替代方案

替代方案是由 owner reader 接收并转换所有原始参数，或由 edge 作最小 typed validation。前者会把
HTTP 契约责任和跨 owner 语义下推，代价更高；不选该方案是明确取舍，故建议在 edge 使用既有
`InvalidEdgeRequestException`。

## 方案合理性

问题本质是契约输入在 controller 到 owner 的边界失去明确的 client-error 映射。最小方案保留 owner
的 403/404 及 query 事实，只在读入参处阻断非法 UUID/分页，复杂度低且不改变 owner 权限语义。

## UI 与交互

NOT_APPLICABLE：理由是本次为后台 HTTP reader 静态审查，没有获批 UI-bearing Journey 或页面交互变更。

## 审查意见复核

NOT_APPLICABLE：此为 fresh independent blind Round 1，未收到外部 finding；形成 verdict 时未使用作者
处置或外部审查结论，finding 仅作为后续作者重新打开 owning source 的输入。

## 实施代码核验

已重开 operations/platform edge、三个 owner projection、Problem advice 和相应 focused tests 的生产源码；
未启动 runtime。业务用户行为是无效审计 GET 要取得 client Problem 而非默认 500；静态测试的 policy
生成证明 83/78/5，不能替代此处 client-error 行为核验。

## 闭环核验

S-01 需要在 applicable edge 增加 typed validation 与 focused negative proof 后重新核验；clean package
exit 当时仍为 PENDING，业务和 cleanup 均未运行，故没有将 package 判定为关闭。

## 结论

VERDICT=NO_GO。M=0 / S=1 / N=2；Round 1 归档为独立盲审 verdict，不是 implementation exit。
