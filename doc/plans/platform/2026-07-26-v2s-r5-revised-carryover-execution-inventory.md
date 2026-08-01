---
title: R5 修订前端 carry-over 执行清单
status: DESIGN_ONLY_FROZEN_INPUT
createdAt: 2026-07-26
implementationAuthority: false
sourceManifest: contracts/policy/frontend-asset-carryover-manifest.json@5ccaa5208a9f421f928916c795e36b1fa6eaec76499dd79f4d3e6c75047b8273
---

# R5 前端 carry-over 执行清单

本清单把已接受的 22 surface、25 pageDesignKey 和 v2 静态资产基线变为 R5-U06/U07 的执行输入。
它不重画线框、不更改 22/25 分母、不授权实现。每行的 source path/hash、target、route、generated
slice、foundation 与 focused evidence 是实施时不可自行选择的 disposition；Heritage 只读，wire
必须按 v2s edge 重新生成。`ADAPT` 表示保留任务和 v2 视觉基线但按冻结 contract/owner/术语修正；
`CARRY_ROUTE_BOOTSTRAP_ONLY` 明确不搬造首页指标；`NOT_CARRIED` 见 §4。

## 1. 22 surface 执行表

| surface | app / disposition | v2 source path@hash → v2s target | route / generated slice | foundation 必消费 | focused evidence / audit attachment |
| --- | --- | --- | --- | --- | --- |
| PLATFORM-AUTH | platform-admin / ADAPT | `features/authentication/ui/PlatformLoginPage.tsx@83aa1c365ab84df20d37a1256d445b8b0a8775223b0721c19d51878a91aa8a2b` → 同路径 | `/platform/login` / `platform-auth` | platformHttpProtocol, observedBaseQuery, overlayLock, testId | platform-auth-login-session-password-logout |
| PLATFORM-WORKSPACES | platform-admin / ADAPT | `features/workspace-management/ui/WorkspaceManagementPage.tsx@0af9be8c884de227c28b875f4e41626f6a20d932b43e4ab6064289e7cbfe63dc` → 同路径 | `/platform/workspaces` / workspace+asset+organization | useDetailDrawer, useDrawerFormLifecycle, overlayLock, contextScopedQueryArgs, testId | workspace-list-create-detail-edit-status-logo-commercial-group / `AUDIT-HISTORY-MODAL:getPlatformEntityAuditHistory` |
| PLATFORM-ADMIN-USERS | platform-admin / ADAPT | `features/platform-admin-governance/ui/PlatformAdminGovernancePage.tsx@c0a872918f604834f56fa3b45e92b59ef3f6cffb310bb3c29f47c732768188cd` → 同路径 | `/platform/admin-users` / platform-iam | useDetailDrawer, useDrawerFormLifecycle, overlayLock, testId | platform-admin-list-create-detail-profile-status-reset / `AUDIT-HISTORY-MODAL:getPlatformEntityAuditHistory` |
| PLATFORM-WORKSPACE-OVERVIEW | platform-admin / ADAPT | `features/workspace-overview/ui/WorkspaceOverviewPage.tsx@cb1de9be62db383895141c9014f4b363906f967be0d32a3b4c2e596bae1f8d4f` → 同路径 | `/platform/workspace-overview` / workspace-overview | contextScopedQueryArgs, useDetailDrawer, testId | workspace-overview-owner-task-read-no-projection |
| PLATFORM-ORGANIZATION-OVERVIEW | platform-admin / ADAPT | `features/organization-overview/ui/OrganizationOverviewPage.tsx@72f5ab9beb8f9eb58b1f44effcaaad924d7fcd2dba00e96b93ad21b43c408829` → 同路径 | `/platform/organization-overview` / organization | adminDrawerSurfaceProps, useDetailDrawer, overlayLock, contextScopedQueryArgs, testId | organization-overview-search-detail |
| PLATFORM-CONTRACT-OVERVIEW | platform-admin / ADAPT | `features/contract-overview/ui/ContractOverviewPage.tsx@932784738052ab15f1733900b6d47e29718e0334b8f3e0a32fac8b76f363dfe0` → 同路径 | `/platform/contract-overview` / contract | adminDrawerSurfaceProps, useDetailDrawer, overlayLock, contextScopedQueryArgs, testId | contract-overview-filter-item-pair-detail / `AUDIT-HISTORY-MODAL:getPlatformEntityAuditHistory` |
| PLATFORM-ROLES | platform-admin / ADAPT | `features/role-management/ui/RoleManagementPage.tsx@45111b3d93310ffdbe7a3700822bf76a3d0630ac3917b21ede091996dea7efe0` → 同路径 | `/platform/roles` / workspace-iam-role | adminDrawerSurfaceProps, useDetailDrawer, useDrawerFormLifecycle, overlayLock, testId | role-list-detail-page-access-capability-status-no-candidates-endpoint / `AUDIT-HISTORY-MODAL:getPlatformEntityAuditHistory` |
| PLATFORM-WORKSPACE-ACCOUNTS | platform-admin / ADAPT | `features/workspace-account-management/ui/WorkspaceAccountManagementPage.tsx@f91df607180aebc2354e7e811c9abcb316121f24bc121b711314280cb207011e` → 同路径 | `/platform/workspace-accounts` / account-invitation | adminDrawerSurfaceProps, useDetailDrawer, useDrawerFormLifecycle, overlayLock, testId | account-detail-status-reset-assignment-revoke-invitation / `AUDIT-HISTORY-MODAL:getPlatformEntityAuditHistory` |
| PLATFORM-EXTENSION-FIELDS | platform-admin / ADAPT | `features/extension-field-management/ui/ExtensionFieldManagementPage.tsx@4d23ecd15dcfe641c38c3292076c1ebb452f309fb36a4e1d59c9729ee554cc4e` → 同路径 | `/platform/extension-fields` / extension | adminDrawerSurfaceProps, useDetailDrawer, useDrawerFormLifecycle, overlayLock, testId | five-host-definition-catalog-detail-replace-cas / `AUDIT-HISTORY-MODAL:getPlatformEntityAuditHistory` |
| PLATFORM-PASSWORD | platform-admin / ADAPT | `features/authentication/ui/PlatformPasswordChangeDrawer.tsx@7f628b6e14e5b4965d59db9282b6e3aa78a85cf851b823e2f182f381c143dc57` → 同路径 | `DRAWER@/platform` / platform-auth | adminDrawerSurfaceProps, useDrawerFormLifecycle, overlayLock, testId | platform-current-password-change-secret-clear-and-other-session-revoke |
| OPERATIONS-AUTH | operations-admin / ADAPT | `features/authentication/ui/WorkspaceLoginPage.tsx@d04db79096a1f474aac00b0de3f67e07a9848dd38c388a06b2a2f3daf28a3f0f` → 同路径 | `/operations/:groupWorkspaceKey/login` / workspace-iam-auth | platformHttpProtocol, observedBaseQuery, overlayLock, testId | keyed-login-single-multi-no-role-disabled |
| PUBLIC-INVITATION | operations-admin / ADAPT | `features/invitation-acceptance/ui/InvitationAcceptancePage.tsx@0a9973f2c8f4f94cf76f5c82b61fc2987e13205e364ca0e30f97d74016c5cafd` → 同路径 | `/operations/invitations/:groupWorkspaceKey/:invitationToken` / `public-invitation` | overlayLock, platformHttpProtocol, testId | invitation-view-accept-otp-credential-complete-recovery |
| PUBLIC-ACCESS-RECOVERY | operations-admin / ADAPT | `features/access-recovery/ui/AccessRecoveryPage.tsx@2c7d8ecde8aeb446734a2606e563260a58195a01b4a05731b99236361d1e6bd6` → 同路径 | `/operations/:groupWorkspaceKey/password-recovery/:resetGenerationKey` / `public-password-reset` | overlayLock, platformHttpProtocol, testId | reset-send-verify-complete-secret-clearing / none |
| OPERATIONS-SHELL | operations-admin / ADAPT | `features/work-context/ui/OperationsContextShell.tsx@ac41148c6a40d0abde90611e6c06a718738634dd5f9dcdab170b1667dc257be6` → 同路径 | `/operations/:groupWorkspaceKey` / session-navigation | contextScopedQueryArgs, overlayLock, observedBaseQuery, testId | context-role-data-node-tabs-cache-late-response |
| OPERATIONS-PASSWORD | operations-admin / ADAPT | `features/work-context/ui/OperationsPasswordChangeDrawer.tsx@eeaf97cdbe180f5855ac68932c62e22caa8615cdb51861db797faa0243fa0432` → 同路径 | `DRAWER@/operations/:groupWorkspaceKey` / `workspace-iam-session` | adminDrawerSurfaceProps, useDrawerFormLifecycle, overlayLock, testId | operations-current-password-change-secret-clear-and-other-session-revoke / none |
| OPERATIONS-ORG-STRUCTURE | operations-admin / ADAPT | `features/organization-hierarchy/ui/OrganizationHierarchyPage.tsx@116c878d01954e1642df7a6c2b5b7fc4524cefd0da7aa01e3b83c942e96d2626` → 同路径 | `/operations/:groupWorkspaceKey/organization/structure` / `organization-hierarchy` | adminDrawerSurfaceProps, contextScopedQueryArgs, useDrawerFormLifecycle, overlayLock, testId | group-region-project-phase-tree / `AUDIT-HISTORY-MODAL:getOperationsEntityAuditHistory` |
| OPERATIONS-BUSINESS-ENTITIES | operations-admin / ADAPT | `features/business-entity-management/ui/BusinessEntityManagementPage.tsx@ce3ff54d22af79f5e973c42cfa8040199b1feb4d11f0dae03464fc417340276f` → 同路径 | `/operations/:groupWorkspaceKey/organization/{brands|tenants|head-companies}` / `organization-management+business-entity-extension` | adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useDrawerFormLifecycle, overlayLock, testId | brand-tenant-head-company-auth-extension-fields / `AUDIT-HISTORY-MODAL:getOperationsEntityAuditHistory` |
| OPERATIONS-STORES | operations-admin / ADAPT | `features/store-management/ui/StoreManagementPage.tsx@4a4d270aefd097cd6f842327439c56180af396c63c642300997fb553e5d292a5` → 同路径 | `/operations/:groupWorkspaceKey/organization/stores` / `store-management` | adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useDrawerFormLifecycle, overlayLock, testId | store-list-candidates-create-detail-update-status / `AUDIT-HISTORY-MODAL:getOperationsEntityAuditHistory` |
| OPERATIONS-CONTRACTS | operations-admin / ADAPT | `features/contract-management/ui/ContractManagementPage.tsx@7bd2bd086555904ba4a33c9350a7af8fb28a220f2bff5b1e54efacffc5a6c3e3` → 同路径 | `/operations/:groupWorkspaceKey/contracts` / `contract-management` | adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useDrawerFormLifecycle, overlayLock, testId | contract-list-create-detail-update-invalidate-item-pair / `AUDIT-HISTORY-MODAL:getOperationsEntityAuditHistory` |
| OPERATIONS-USERS | operations-admin / ADAPT | `features/user-management/ui/UserManagementPage.tsx@c811961086741b0da5a53f8a38dcc4ef7d7df9a3589be466bb95ea58e7f44265` → 同路径 | `/operations/:groupWorkspaceKey/access/{group|region|project|head-company|store}-users` / `workspace-access+workspace-invitation` | adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useDrawerFormLifecycle, overlayLock, testId | five-user-pages-membership-invitation-revoke-no-direct-add / `AUDIT-HISTORY-MODAL:getOperationsEntityAuditHistory` |
| OPERATIONS-STORE-PROFILE | operations-admin / ADAPT | `features/store-profile/ui/StoreProfilePage.tsx@24511b42b2f589c6034a16ae12abacd4e41c2cea7915cf949fd63e5673c1e3c9` → 同路径 | `/operations/:groupWorkspaceKey/store/profile` / `store-profile+contract-management` | adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, testId | fixed-store-profile-contracts-three-state / `AUDIT-HISTORY-MODAL:getOperationsEntityAuditHistory` |
| OPERATIONS-FIVE-HOME-BOOTSTRAPS | operations-admin / CARRY_ROUTE_BOOTSTRAP_ONLY | `app/OperationsAdminSeed.tsx@535e7b1d7c1550f45491a3f49a96af0399d71d1450a83caf0a908028c9d93cb9` → 同路径 | `/operations/:groupWorkspaceKey/home/{group|region|project|head-company|store}` / `workspace-iam-session` | contextScopedQueryArgs, testId | five-routes-render-bootstrap-only-no-dashboard-no-new-operation |

### 1.1 `AUDIT-HISTORY-MODAL` action attachment（不新增 surface / pageDesignKey）

这个 action 不是第 23 个 surface，而是下列既有详情中的共同 app-local composition。每行只加详情右上
“操作历史”按钮；list 不加操作列，Modal 必消费 `overlayLock`、`testId` 与 generated face endpoint，
不得消费/重造 Drawer primitive。`changes[].fieldKey` 的中文 label 仅由所属 app 的 feature text map 输出。

| entity type | host surface / app | scalar operation | focused evidence |
| --- | --- | --- | --- |
| `GROUP_WORKSPACE` | PLATFORM-WORKSPACES / platform-admin | `getPlatformEntityAuditHistory` | group workspace detail includes commercial-group initialization fact |
| `PLATFORM_ADMIN` | PLATFORM-ADMIN-USERS / platform-admin | `getPlatformEntityAuditHistory` | platform admin detail actor/status history |
| `WORKSPACE_ROLE` | PLATFORM-ROLES / platform-admin | `getPlatformEntityAuditHistory` | role page-access/capability closed-key history |
| `WORKSPACE_ACCOUNT`,`WORKSPACE_INVITATION` | PLATFORM-WORKSPACE-ACCOUNTS / platform-admin | `getPlatformEntityAuditHistory` | account/invitation lifecycle without contact or token values |
| `EXTENSION_DEFINITION` | PLATFORM-EXTENSION-FIELDS / platform-admin | `getPlatformEntityAuditHistory` | five-host definition revision history |
| `STORE_CONTRACT` | PLATFORM-CONTRACT-OVERVIEW / platform-admin; OPERATIONS-CONTRACTS / operations-admin | `getPlatformEntityAuditHistory`; `getOperationsEntityAuditHistory` | same owner fact, each face only through its own host scope |
| `ORGANIZATION_NODE` | OPERATIONS-ORG-STRUCTURE / operations-admin | `getOperationsEntityAuditHistory` | region/project history, group is not an organization node |
| `BRAND`,`TENANT`,`HEAD_COMPANY` | OPERATIONS-BUSINESS-ENTITIES / operations-admin | `getOperationsEntityAuditHistory` | business entity/brand authorization history without hidden fields |
| `STORE` | OPERATIONS-STORES; OPERATIONS-STORE-PROFILE / operations-admin | `getOperationsEntityAuditHistory` | status/profile history, same selected target only |
| `WORKSPACE_ACCOUNT`,`WORKSPACE_INVITATION` | OPERATIONS-USERS / operations-admin | `getOperationsEntityAuditHistory` | role-node scoped account/invitation history |

## 2. 25 pageDesignKey 闭合

8 platform keys are their identically named platform surfaces. The remaining 17 map exactly as follows:
`PG-ORG-STRUCTURE→OPERATIONS-ORG-STRUCTURE`; `PG-ORG-BRAND|PG-ORG-TENANT|PG-ORG-HEAD-COMPANY→OPERATIONS-BUSINESS-ENTITIES`; `PG-ORG-STORE-MANAGE→OPERATIONS-STORES`; `PG-CONTRACT-STORE-MANAGE→OPERATIONS-CONTRACTS`; `PG-IAM-GROUP-USERS|PG-IAM-REGION-USERS|PG-IAM-PROJECT-USERS|PG-IAM-HEAD-COMPANY-USERS|PG-IAM-STORE-USERS→OPERATIONS-USERS`; `PG-STORE-PROFILE→OPERATIONS-STORE-PROFILE`; `HOME-GROUP|HOME-REGION|HOME-PROJECT|HOME-HEAD-COMPANY|HOME-STORE→OPERATIONS-FIVE-HOME-BOOTSTRAPS`.

The 7 remaining non-catalog surfaces are PLATFORM-AUTH, PLATFORM-PASSWORD, OPERATIONS-AUTH,
PUBLIC-INVITATION, PUBLIC-ACCESS-RECOVERY, OPERATIONS-SHELL and OPERATIONS-PASSWORD. This is the
exact 22-surface closure; no new audit page key is introduced.

## 3. App shell and foundation boundary

Each app creates and owns only its own router, store, session boundary, generated face API facade,
theme/shell and feature text. `libraries/frontend/admin-ui-foundation` remains the sole source of
the table-listed protocol, observed-query, safe-logger, overlay, drawer lifecycle, detail drawer,
context helper and test primitives; a required primitive may be consumed but not reimplemented in
an app. The audit Master–Detail Modal is app-local feature composition over `overlayLock`/`testId`, not
a new Drawer/foundation duplicate. Normalization is closed: source `observedBaseQuery` is consumed as
`createObservedBaseQuery`; `safeLogger` is consumed as `createSafeLogger`; `drawerSurface` is consumed as
`adminDrawerSurfaceProps`; `useOverlayLock` is consumed as `overlayLock`. The foundation adaptation
inventory is five items: completed `contextScopedQueryArgs.ts` and `foundation.test.ts` groupWorkspaceKey
changes, plus the deliberate v2s-only `useSubmissionLifecycle.ts`, public `index.ts` export, and
`package.json` name/RTK/react-redux dependency adaptation. These are retained and verified before any
surface consumes them; none is described as an original v2/R3 byte-for-byte carry-over.

## 4. Explicit non-carry closure

The seven frozen `notCarriedAssets` entries remain NOT_CARRIED: client entry guard, role candidates
endpoint, `logoBindGrant`, transient logo retry, direct assignment add/edit, and Heritage generated
platform/operations wire. They are replaced only by the paths/semantics named in the frozen source
manifest; no runtime/build fallback is permitted.
