---
title: RM1 P6-2 admin catalog truth model POST_REMEDIATION_V1 Claude review request
REVIEW_CYCLE_ID: RM1P6-ADMIN-CATALOG-TRUTH-MODEL-20260730
REVIEW_TARGET: DESIGN
REVIEW_KIND: CONCEPTUAL_CATALOG_DESIGN
binding: POST_REMEDIATION_V1
status: DECLARED_POST_REMEDIATION_AWAITING_CLAUDE
implementationAuthority: false
---

# RM1 P6-2 admin catalog truth model POST_REMEDIATION_V1 Claude review request

## 背景

Dexter 将问题明确为管理后台目录的统一真相与统一模型，而非页面标题治理。当前
`admin-catalog.json` 将 25 PAGE、4 navigation group、4 action group、34 ACTION、17 page experience 和
10 user-management relation 拆为 tuple/map；同时 role-node type 到首页仍有 Java switch 旁路。ACTION 已实际
驱动角色可授予校验、session action grant、运营端按钮、邀请/撤销 capability 选择和 owner-side capability
反查，因此必须与 PAGE 一起设计。

本 cycle 已完成两轮 fresh independent DESIGN 盲审。round 2 历史结论为 `NO-GO (M=0/S=3/N=1)`；三项 S 已由
作者按 owning source 最小修订，并以 `POST_REMEDIATION_V1` 诚实绑定。当前字节未被独立 subagent 重审，不能
称为 historical GO，必须由 Claude recheck。

## 评审目标

独立判断唯一 `AdminCatalogNode[]` 是否能成为静态管理目录关系的单一真相：PAGE、navigation/action group、
ACTION、role-home、角色/数据节点要求、page experience 与用户管理 relation 是否无损且最小；并核验它没有
吞并 app router、动态 owner facts 或 request-level security。

## 需阅读文件

- `AGENTS.md`：独立评审、owner/app 边界和两轮 hard-stop；
- `doc/decisions/2026-07-30-v2s-admin-catalog-semantic-copy-model.md`：当前统一模型与 generator 不变量；
- `doc/review/platform/2026-07-30-v2s-rm1-p6-2-admin-catalog-truth-model-independent-round-2.md`：不可变 round-2 `NO-GO`；
- `doc/review/platform/2026-07-30-v2s-rm1-p6-2-admin-catalog-truth-model-post-remediation-intake.md`：作者修订与未审声明；
- `contracts/catalog/admin-catalog.json`：现有 25/34/4/4/17/10 分母；
- `scripts/generate/edge-codegen.mjs`：当前 catalog 至前端/Java 的生成链；
- `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceAuthenticationService.java`：role-home switch；
- `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceRoleService.java`、`apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceCapabilityScopeResolver.java`：可授予与请求级 owner boundary；
- `apps/frontend/operations-admin/src/features/workspace-user/ui/WorkspaceUserPage.tsx`、`apps/frontend/operations-admin/src/features/workspace-user/ui/WorkspaceInvitationPanel.tsx`：binding 的实际 consumer；
- `doc/evidence/platform/rm1/p6/rm1p6-u02-package-input.json`、`doc/evidence/platform/rm1/p6/rm1p6-u02-implementation-amendment.md`：P6-2 与 P6-3 实施边界。

## 独立核验重点

1. 重算 25 PAGE（5 role-home、12 operations business、8 platform）、34 ACTION、4+4 group、17 experience、10 user-management relation；
2. 判断三种 PAGE 判别、ACTION 单 target/同 face、`userManagementFor(pageKey)` projection 是否真正闭合前后端 consumer；
3. 核验 role-home lookup 只替换 Java switch，既有 page/capability/binding resolved value 不漂移；
4. 核验 catalog 只保有静态关系，动态 grants/candidates/context、router 和 request-level capability scope 仍由其 owner 保有；
5. 判断当前 P6-2 只可保留设计、不能实施跨 app catalog/generator/operations/Java migration 的范围是否正确。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。每项 finding 使用 `M` / `S` / `N`，包含精确文件与行号、影响面、最小修复，
并标明是否需 Dexter 产品裁决。请先从 owning source 独立推导；不要把 post-remediation intake 视为独立审查。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助复核本次“管理后台目录单一关系真相模型”的 POST_REMEDIATION_V1 设计。

背景：Dexter 明确要求解决 catalog 与 action 的统一真相/统一模型，不是标题治理。当前 admin-catalog.json 将 25 PAGE、4 navigation group、4 action group、34 ACTION、17 page experience、10 用户管理关系拆为多份 tuple/map，且 role-node type 到首页仍有 Java switch 旁路。ACTION 已实际驱动角色可授予校验、session grant、运营端按钮和邀请/撤销 capability。两轮 fresh 独立 DESIGN 盲审已封顶；round 2 历史结论为 NO-GO（M=0/S=3/N=1）。Codex 已做最小修订，但当前字节未被独立 subagent 重审，必须由您 recheck，不能称 historical GO。

目标：请独立判断唯一 AdminCatalogNode[] 是否无损且最小地承载静态 PAGE/navigation/action/role-home/access/experience/user-management 关系，同时不吞并 app router、动态 owner facts 或 request-level security；并确认当前 P6-2 不得实施跨 app catalog/generator/operations/Java migration。

请从 catering-v2s 仓库根阅读：
- doc/decisions/2026-07-30-v2s-admin-catalog-semantic-copy-model.md：当前模型与不变量；
- doc/review/platform/2026-07-30-v2s-rm1-p6-2-admin-catalog-truth-model-independent-round-2.md：不可变 round-2 verdict；
- doc/review/platform/2026-07-30-v2s-rm1-p6-2-admin-catalog-truth-model-post-remediation-intake.md：作者最小修订与未审声明；
- contracts/catalog/admin-catalog.json、scripts/generate/edge-codegen.mjs：当前分母与生成链；
- apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceAuthenticationService.java、WorkspaceRoleService.java、WorkspaceCapabilityScopeResolver.java：owner 入口、可授予与请求级安全；
- apps/frontend/operations-admin/src/features/workspace-user/ui/WorkspaceUserPage.tsx、apps/frontend/operations-admin/src/features/workspace-user/ui/WorkspaceInvitationPanel.tsx：用户管理关系的实际 consumer；
- doc/evidence/platform/rm1/p6/rm1p6-u02-package-input.json、doc/evidence/platform/rm1/p6/rm1p6-u02-implementation-amendment.md：当前实施授权边界。

请重点独立核验：5/12/8 PAGE 判别、34 ACTION 单 target/同 face、10 relation 生成的 userManagementFor(pageKey) projection、role-home lookup diff allowlist、owner/router/security 的不可吞并边界，以及 P6-2/P6-3 范围。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次结论只裁决统一目录关系模型与未来实施 package 的边界；不授权 catalog、generator、Java 或任何 generated output、platform-admin/operations-admin 生产改动、P6-3、DEV、seed、reset、L2 或动态业务 PASS。谢谢。
```
