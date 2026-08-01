# RM1 P6-3 joint local L2 implementation review request

## 背景

本轮是 RM1 P6-3 的两个管理后台实现与联合受管 L2 收口。上一轮独立 implementation post-L2 review（round 2，hard stop）记录了 stale scope 与平台写面 request/readback 证据缺口；作者已按独立 finding 重新打开 IA、owner 源码、当前前端与 fresh run，而不是把历史 `NO_GO` 改写为 GO。详情 action handoff 的新发现也已登记为 `RM1P6-U11-F-JOINT-L2-10`，并修复为共享 Drawer 生命周期根因。

## 评审目标

请独立确认：

1. platform-admin 与 operations-admin 是否仍遵循 IA03/IA04/IA05 的 detail-first、owner readback、无列表操作列与双 app 边界；
2. GROUP→HEAD_COMPANY 固定目标是否由 owner 端而非前端 scope omission 保证；
3. 五个 platform 写面是否都形成 control → generated client request → owner response/readback → rendered state 闭环；
4. 详情 Drawer 关闭动画后再开独立面是否由真实生命周期保证，而非 ref、延迟或测试定位绕过；
5. fresh joint L2 的 19-file denominator、business/cleanup 分离和证据绑定是否真实可复验。

## 需阅读文件

从 `catering-v2s` 仓库根打开：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`：执行边界与环境矩阵；
- `doc/decisions/2026-07-29-v2s-rm1-ia-03-platform-governance-and-self-service-interaction.md`、`doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md`、`doc/decisions/2026-07-29-v2s-rm1-ia-05-operations-users-recovery-and-home-interaction.md`：批准交互与 owner 任务；
- `doc/evidence/platform/rm1/p6/rm1p6-u11-joint-remote-l2-implementation-amendment.md`：19-file L2 与 request/readback 证据边界；
- `doc/evidence/platform/rm1/p6/rm1p6-u11-joint-remote-l2-problem-family.json`：finding 及通用预防；
- `doc/review/platform/rm1p6-u11-joint-remote-l2-implementation-post-l2-adversarial-review-round2.json`：独立 round-2 原始 verdict（不得改写）；
- `doc/review/platform/rm1p6-u11-joint-remote-l2-implementation-post-l2-author-resolution.md`：作者逐项重核与处置；
- `doc/evidence/platform/rm1/p6/rm1p6-u11-joint-remote-l2-package-exit.json`：当前 package、source hash、fresh run 绑定；
- `apps/frontend/platform-admin/src/features/workspace-management/ui/WorkspaceManagementPage.tsx`、`apps/frontend/platform-admin/src/features/workspace-management/ui/WorkspaceDetailDrawer.tsx`、`apps/frontend/platform-admin/src/features/workspace-iam/ui/RolesPage.tsx`、`apps/frontend/platform-admin/src/features/workspace-iam/ui/RoleDetailDrawer.tsx`、`apps/frontend/platform-admin/src/features/workspace-iam/ui/AccountsPage.tsx`、`apps/frontend/platform-admin/src/features/workspace-iam/ui/WorkspaceAccountDetailDrawer.tsx`、`apps/frontend/platform-admin/src/features/platform-administration/ui/AdministratorsPage.tsx`、`apps/frontend/platform-admin/src/features/platform-administration/ui/AdministratorDetailDrawer.tsx`：详情 handoff 与独立写面；
- `apps/frontend/platform-admin/src/tests/l2/platform-admin-management.spec.ts`、`workspace-management.spec.ts`、`role-management.spec.ts`、`workspace-account-management.spec.ts`、`extension-field-management.spec.ts`、`platformL2.ts`：五个请求/读回 proof 与 cleanup helper；
- `apps/frontend/operations-admin/src/features/workspace-user/ui/WorkspaceUserPage.tsx`、`apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceUserService.java`、`apps/backend/catering-business-server/modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceUserTaskScopeTest.java`：固定目标与 stale scope 根修复；
- `.runtime/r5/joint-local-l2/rm1p6-joint-local-l2-1785531940251-78105-88376fed/evidence/terminal-report.json`：fresh managed L2 terminal evidence。

## 独立核验重点

- `node tools/compliance-control/cli.mjs validate-package-exit doc/evidence/platform/rm1/p6/rm1p6-u11-joint-remote-l2-package-exit.json` 应为 `PACKAGE_EXIT=PASS`；
- `scripts/check/affected-l2`、`scripts/check/frontend-architecture`、`scripts/check/security-boundaries`、`scripts/check/openapi-contracts`、`scripts/check/capability-invariants`、`scripts/check/edge-codegen --check`、`scripts/check/code-layout`、`scripts/check/standards-coverage --phase R5` 均为 PASS；
- fresh report 必须同时有 `PLATFORM_PLAYWRIGHT=PASS`（9/9）、`OPERATIONS_PLAYWRIGHT=PASS`（10/10）、`business.status=PASS` 与 `cleanup.status=PASS`，并显示隔离 remote database/role/asset namespace 已移除；
- 详情 Drawer 不得使用 `destroyOnHidden` 破坏 `afterOpenChange(false)` handoff；不可用 arbitrary delay、并发 overlay 或 Redux `store.getState()` 伪造闭环；
- 历史 authority ledger `ST-11` denominator 仍是未关闭的历史治理事项，不得被本 package 的 L2/static PASS 掩盖。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。如有问题，请按 `M` / `S` / `N` 标注精确相对路径与行号、影响面、最小根因修复建议，以及是否需要 Dexter 产品裁决。没有产品歧义时请明确写 `无需 Dexter 裁决`。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助独立评审 RM1 P6-3 两个管理后台的 joint local L2 implementation 收口。

背景：上一轮独立 post-L2 implementation review round 2 是 hard-stop `NO_GO`，指出 stale scope 与五个 platform write surface 缺少 request/readback 证据；作者已逐点重开 IA、owner、当前源码与 fresh run，并在 `doc/review/platform/rm1p6-u11-joint-remote-l2-implementation-post-l2-author-resolution.md` 记录处置。请不要把该历史 verdict 改写为历史 GO，也不要发起第三轮 adversarial review。

目标：独立确认 IA03/IA04/IA05 交互、owner 权限与固定目标边界、四处详情 Drawer close→independent action lifecycle、五个 platform write request→owner readback→rendered state 闭环，以及 19-file managed L2 的 business/cleanup 证据是否真实闭合。

请从 catering-v2s 仓库根阅读：
- `doc/evidence/platform/rm1/p6/rm1p6-u11-joint-remote-l2-package-exit.json`：当前 package 与 fresh evidence binding；
- `doc/evidence/platform/rm1/p6/rm1p6-u11-joint-remote-l2-implementation-amendment.md`：L2 denominator 与证据边界；
- `doc/review/platform/rm1p6-u11-joint-remote-l2-implementation-post-l2-adversarial-review-round2.json`：原始 round-2 独立 finding；
- `doc/review/platform/rm1p6-u11-joint-remote-l2-implementation-post-l2-author-resolution.md`：逐项作者处置；
- `doc/decisions/2026-07-29-v2s-rm1-ia-03-platform-governance-and-self-service-interaction.md`、`doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md`、`doc/decisions/2026-07-29-v2s-rm1-ia-05-operations-users-recovery-and-home-interaction.md`：批准 IA；
- `apps/frontend/platform-admin/src/features/workspace-management/ui/WorkspaceManagementPage.tsx`、`WorkspaceDetailDrawer.tsx`、`apps/frontend/platform-admin/src/features/workspace-iam/ui/RolesPage.tsx`、`RoleDetailDrawer.tsx`、`AccountsPage.tsx`、`WorkspaceAccountDetailDrawer.tsx`、`apps/frontend/platform-admin/src/features/platform-administration/ui/AdministratorsPage.tsx`、`AdministratorDetailDrawer.tsx`：详情 action 生命周期；
- `apps/frontend/platform-admin/src/tests/l2/platform-admin-management.spec.ts`、`workspace-management.spec.ts`、`role-management.spec.ts`、`workspace-account-management.spec.ts`、`extension-field-management.spec.ts`、`platformL2.ts`：真实请求/读回与 cleanup；
- `apps/frontend/operations-admin/src/features/workspace-user/ui/WorkspaceUserPage.tsx`、`apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceUserService.java`、`WorkspaceUserTaskScopeTest.java`：stale scope 根修复；
- `.runtime/r5/joint-local-l2/rm1p6-joint-local-l2-1785531940251-78105-88376fed/evidence/terminal-report.json`：fresh run。

请重点独立核验：`PACKAGE_EXIT=PASS`；9/9 platform 与 10/10 operations；`business=PASS` 与 `cleanup=PASS` 分离；远端隔离 database/role/assets 已回收；不以静态/typecheck 代替动态业务结果；不要求 Redux 内部断言；不把历史 ST-11 authority-ledger FAIL 说成已关闭。

烦请给出明确 `GO` 或 `NO-GO`。如有问题，请按 `M` / `S` / `N` 给出精确相对路径与行号、影响面、最小根因修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次评审只覆盖 RM1 P6-3 当前实现、19-file 本机 Spring Boot + 双本机 Web + Playwright over isolated remote non-production middleware 的 L2 与 package evidence；不授权 UAT、DEV seed/reset、Roadmap 状态变更、第三轮 adversarial review 或 Git 操作。谢谢。
```
