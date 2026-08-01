---
title: RM1 P6 physical screen import contracts
status: AUTHOR_FINAL_REMEDIATION_AWAITING_CLAUDE_RECHECK
reviewTarget: DESIGN
implementationAuthority: false
---

# RM1 P6 physical screen import contracts

This is the screen-level expansion of the final surface roster.  It supersedes every multi-screen shorthand in
that roster.  Each line is one physical UI surface, even where several accepted IA screen IDs share the exact
same component path and primitive set.  IA01…IA05 hashes and every screen's actor, scenario, business goal,
visible copy, form dependency map and typed-failure wording are the hash-bound source declarations in
`rm1-u09-final-ui-surface-roster.md` §1; this file freezes only the missing current-to-final consumer/import
contract.  `F` means focused test at the exact sibling `*.test.tsx` path; every row also uses the common failure,
readback and receipt rule from that roster §1.

**Executable screen-import denominator.** For every accepted screen ID in a row, its accepted IA
`FOUNDATION_PRIMITIVE` set is the immutable behavioral lower bound. The third column assigns that behavior to the
actual consumer which owns it: a list controller owns `useDetailDrawer`; a prop-controlled Drawer owns
`adminDrawerSurfaceProps` and `useOverlayLock`. A grouped controller/Drawer row therefore satisfies the IA set as a
pair; a controlled Drawer must not import an unattached `useDetailDrawer` merely to manufacture import equality.
The required set is the IA lower bound plus the third-column additions, with each primitive placed at its real owner,
and every name resolving in `libraries/frontend/admin-ui-foundation/src/index.ts`. A physical contract may add an
exported screen primitive but may never erase an IA behavior. This rule applies to all 94 accepted IA screens,
including grouped rows; `NONE_WITH_REASON` is valid only when the IA lower bound is itself empty and the screen has
no reusable lifecycle, Drawer, Modal, overlay or list-context behavior.

**App-substrate exclusion.** `createObservedBaseQuery` is allowed only in `PlatformApi.ts` and `OperationsApi.ts`,
where the one generated `createApi` is configured. `platformHttpProtocol` is foundation-internal; it has no page,
shell or app consumer. Neither name is a screen primitive and no import-equality gate may require either in a UI
surface. Moving either into a page, adding another API/store, or constructing protocol headers outside the existing
transport boundary is a red mutation.

| accepted physical screen(s) | exact final consumer path | exact foundation primitive contract | generated operation / exact N/A | F |
| --- | --- | --- | --- | --- |
| IA01-PLATFORM-LOGIN | `platform-admin/src/features/authentication/ui/PlatformLoginPage.tsx` | `useOverlayLock` | `platformPasswordLogin`, future platform OTP operations | `PlatformLoginPage.test.tsx` |
| IA01-PLATFORM-RECOVERY-VERIFY | `platform-admin/src/features/authentication/ui/PlatformPasswordRecoveryVerifyPage.tsx` | `useOverlayLock` | future `start/send/verifyPlatformPasswordRecovery` | `PlatformPasswordRecoveryVerifyPage.test.tsx` |
| IA01-PLATFORM-RECOVERY-PASSWORD | `platform-admin/src/features/authentication/ui/PlatformPasswordRecoveryPasswordPage.tsx` | `useOverlayLock` | future `completePlatformPasswordRecovery` | `PlatformPasswordRecoveryPasswordPage.test.tsx` |
| IA01-PLATFORM-RECOVERY-COMPLETE | `platform-admin/src/features/authentication/ui/PlatformPasswordRecoveryCompletePage.tsx` | `useOverlayLock` | future completion readback; no authenticated shell | `PlatformPasswordRecoveryCompletePage.test.tsx` |
| IA02-PLATFORM-AUTHENTICATED-SHELL | `platform-admin/src/app/PlatformApp.tsx` | `useOverlayLock, contextScopedQueryArgs` | supporting app-shell contract, `NOT_APPLICABLE_WITH_REASON`: no `PLATFORM-SHELL` exists in the frozen 22-surface catalog denominator; this is required host chrome, not a 23rd catalog surface | `PlatformApp.test.tsx` |
| IA02-PLATFORM-WORKSPACE-CONTEXT / IA02-PLATFORM-WORKSPACE-SIDER-CONTROL | `platform-admin/src/app/PlatformApp.tsx` shell host + `platform-admin/src/app/state/WorkspaceScope.tsx` state owner | `contextScopedQueryArgs, useOverlayLock` | selected workspace app-owned React state; no Redux slice/reducer or N/A business command | `PlatformApp.test.tsx` |
| IA02-PLATFORM-WORKSPACES-ACTIONS | `platform-admin/src/features/workspace-management/ui/WorkspaceManagementPage.tsx` | `useDetailDrawer, useOverlayLock` | `list/createPlatformGroupWorkspace`, asset staging; platform-wide management list must not inherit selected-workspace query context | `WorkspaceManagementPage.test.tsx` |
| IA02-PLATFORM-WORKSPACE-DETAIL-DRAWER | `platform-admin/src/features/workspace-management/ui/WorkspaceDetailDrawer.tsx` | `adminDrawerSurfaceProps, useOverlayLock` | group-workspace detail readback | `WorkspaceDetailDrawer.test.tsx` |
| IA02-PLATFORM-WORKSPACE-CREATE-DRAWER / IA02-PLATFORM-COMMERCIAL-GROUP-INIT-DRAWER / IA02-PLATFORM-WORKSPACE-EDIT-DRAWER | `platform-admin/src/features/workspace-management/ui/WorkspaceCreateDrawer.tsx`, `CommercialGroupInitializationDrawer.tsx`, `WorkspaceEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | create/init/update workspace command respectively | each sibling test |
| IA02-PLATFORM-WORKSPACE-STATUS-MODAL | `platform-admin/src/features/workspace-management/ui/WorkspaceStatusModal.tsx` | `useSubmissionLifecycle, useOverlayLock` | `transitionPlatformGroupWorkspaceStatus` | `WorkspaceStatusModal.test.tsx` |
| IA02-PLATFORM-WORKSPACE-OVERVIEW | `platform-admin/src/features/workspace-administration/ui/WorkspaceAdministrationPage.tsx` | `contextScopedQueryArgs, testId` | task read only; N/A mutation | `WorkspaceAdministrationPage.test.tsx` |
| IA03-ADMIN-LIST / IA03-ADMIN-DETAIL | `platform-admin/src/features/platform-administration/ui/AdministratorsPage.tsx`, `AdministratorDetailDrawer.tsx` | page `useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock` | administrator list/detail | sibling tests |
| IA03-ADMIN-CREATE / IA03-ADMIN-EDIT | `platform-admin/src/features/platform-administration/ui/AdministratorCreateDrawer.tsx`, `AdministratorEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | administrator create/update | sibling tests |
| IA03-ADMIN-CREDENTIAL / IA03-ADMIN-STATUS | `platform-admin/src/features/platform-administration/ui/AdministratorCredentialDrawer.tsx`, `AdministratorStatusModal.tsx` | Drawer `useDrawerFormLifecycle, useOverlayLock`; Modal `useSubmissionLifecycle, useOverlayLock` | administrator-issued credential action / status | sibling tests |
| IA03-ORG-OVERVIEW / IA03-ORG-HIERARCHY / IA03-ORG-DETAIL | `platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`, `OrganizationOverviewDetailDrawer.tsx` | page `contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock` | organization overview page/detail | sibling tests |
| IA03-CONTRACT-OVERVIEW / IA03-CONTRACT-DETAIL | `platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`, `ContractOverviewDetailDrawer.tsx` | page `contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock` | contract overview page/detail | sibling tests |
| IA03-ROLE-LIST / IA03-ROLE-DETAIL | `platform-admin/src/features/workspace-iam/ui/RolesPage.tsx`, `RoleDetailDrawer.tsx` | page `useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock` | role list/detail | sibling tests |
| IA03-ROLE-CREATE / IA03-ROLE-EDIT | `platform-admin/src/features/workspace-iam/ui/RoleCreateDrawer.tsx`, `RoleEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | create/update workspace role; separate page/capability trees | sibling tests |
| IA03-ROLE-STATUS | `platform-admin/src/features/workspace-iam/ui/RoleStatusModal.tsx` | `useSubmissionLifecycle, useOverlayLock` | `transitionWorkspaceRoleStatus` | `RoleStatusModal.test.tsx` |
| IA03-ACCOUNT-TAB / IA03-ACCOUNT-DETAIL | `platform-admin/src/features/workspace-iam/ui/AccountsPage.tsx`, `WorkspaceAccountDetailDrawer.tsx` | page `useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock` | workspace account list/detail | sibling tests |
| IA03-ACCOUNT-ACTION | `platform-admin/src/features/workspace-iam/ui/WorkspaceAccountActionModal.tsx` | `useSubmissionLifecycle, useOverlayLock` | account status/recovery/revoke command selected by owner readback | sibling test |
| IA03-EXTENSION-PAGE / IA03-EXTENSION-EDIT / IA03-EXTENSION-SAVE | `platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx`, `ExtensionDefinitionEditDrawer.tsx`, `ExtensionDefinitionSaveModal.tsx` | page `contextScopedQueryArgs, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useDrawerFormLifecycle, useSubmissionLifecycle, useOverlayLock`; Modal `useOverlayLock` | catalog/readback/replace definition | sibling tests |
| IA03-PASSWORD-DRAWER / IA03-PASSWORD-RESULT | `platform-admin/src/features/authentication/ui/PlatformPasswordChangeDrawer.tsx`, `PlatformPasswordChangeResult.tsx` | Drawer `adminDrawerSurfaceProps, useDrawerFormLifecycle, useSubmissionLifecycle, useOverlayLock`; result `useOverlayLock` | `changeCurrentPlatformPassword` / completion N/A | sibling tests |
| IA02-OPERATIONS-AUTHENTICATED-SHELL / IA02-OPERATIONS-SHELL-HEADER / IA02-OPERATIONS-INITIAL-ROLE-SELECTION / IA02-OPERATIONS-DATA-SCOPE / IA02-OPERATIONS-DATA-SCOPE-SIDER-TRIGGER | `operations-admin/src/app/OperationsApp.tsx`, `features/role-home-bootstrap/ui/RoleContextSelector.tsx`, `DataScopeSelector.tsx` | shell `contextScopedQueryArgs, useOverlayLock`; each selector `contextScopedQueryArgs, useOverlayLock` | `get/selectOperationsWorkspaceSessionContext`, `selectOperationsWorkspaceSessionDataNode` | sibling tests |
| IA01-OPERATIONS-LOGIN | `operations-admin/src/features/authentication/ui/OperationsLoginPage.tsx` | `useAsyncGenerationGuard, useSubmissionLifecycle, useOverlayLock` | login entry/password/OTP operations | `OperationsLoginPage.test.tsx` |
| IA05-RECOVERY-VERIFY / IA05-RECOVERY-PASSWORD / IA05-RECOVERY-COMPLETE | `operations-admin/src/features/authentication/ui/OperationsPasswordRecoveryVerifyPage.tsx`, `OperationsPasswordRecoveryPasswordPage.tsx`, `OperationsPasswordRecoveryCompletePage.tsx` | each `useOverlayLock` | future anonymous operations recovery operations | sibling tests |
| IA01-PUBLIC-INVITATION / IA01-PUBLIC-INVITATION-OTP / IA01-PUBLIC-INVITATION-CREDENTIALS / IA01-PUBLIC-INVITATION-COMPLETE | `operations-admin/src/features/invitation-acceptance/ui/PublicInvitationEntry.tsx`, `PublicInvitationOtpStep.tsx`, `PublicInvitationCredentialsStep.tsx`, `PublicInvitationCompleteStep.tsx` | every step `useOverlayLock`; no authenticated app context | existing public invitation operation sequence | sibling tests |
| IA04-ORG-TREE | `operations-admin/src/features/organization-structure/ui/OrganizationStructurePage.tsx` | `adminDrawerSurfaceProps, contextScopedQueryArgs, useOverlayLock` | hierarchy read | `OrganizationStructurePage.test.tsx` |
| IA04-REGION-CREATE / IA04-PROJECT-CREATE / IA04-ORG-EDIT | `operations-admin/src/features/organization-structure/ui/RegionCreateDrawer.tsx`, `ProjectCreateDrawer.tsx`, `OrganizationEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | create/update organization commands | sibling tests |
| IA04-ORG-STATUS | `operations-admin/src/features/organization-structure/ui/OrganizationStatusModal.tsx` | `useSubmissionLifecycle, useOverlayLock` | transition organization status | sibling test |
| IA04-BRAND-PAGE / IA04-TENANT-PAGE / IA04-HEAD-COMPANY-PAGE | `operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx` | `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useOverlayLock` | entity-specific list operations | `BusinessEntityManagementPage.test.tsx` |
| IA04-BUSINESS-DETAIL / IA04-BUSINESS-CREATE / IA04-BUSINESS-EDIT | `operations-admin/src/features/business-entity-management/ui/BusinessEntityDetailDrawer.tsx`, `BusinessEntityCreateDrawer.tsx`, `BusinessEntityEditDrawer.tsx` | detail `useDetailDrawer, useOverlayLock`; create/edit `useDrawerFormLifecycle, useOverlayLock` | entity-specific detail/create/update | sibling tests |
| IA04-HEAD-COMPANY-BRANDS | `operations-admin/src/features/business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx` | `adminDrawerSurfaceProps, useDrawerFormLifecycle, useSubmissionLifecycle, useOverlayLock` | add/remove head-company brand authorization | sibling test |
| IA04-BUSINESS-STATUS | `operations-admin/src/features/business-entity-management/ui/BusinessEntityStatusModal.tsx` | `useSubmissionLifecycle, useOverlayLock` | entity-specific status operation | sibling test |
| IA04-STORE-PAGE / IA04-STORE-DETAIL | `operations-admin/src/features/store-management/ui/StoreManagementPage.tsx`, `StoreDetailDrawer.tsx` | page `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `useDetailDrawer, useOverlayLock` | store page/detail | sibling tests |
| IA04-STORE-CREATE / IA04-STORE-EDIT | `operations-admin/src/features/store-management/ui/StoreCreateDrawer.tsx`, `StoreEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | create/update store + owner candidates/definition | sibling tests |
| IA04-STORE-STATUS | `operations-admin/src/features/store-management/ui/StoreStatusModal.tsx` | `useSubmissionLifecycle, useOverlayLock` | transition store status | sibling test |
| IA04-CONTRACT-PAGE / IA04-CONTRACT-DETAIL | `operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx`, `ContractDetailDrawer.tsx` | page `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `useDetailDrawer, useOverlayLock` | contract page/detail | sibling tests |
| IA04-CONTRACT-CREATE / IA04-CONTRACT-EDIT | `operations-admin/src/features/contract-management/ui/ContractCreateDrawer.tsx`, `ContractEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | create/update contract; tenant derives from selected store | sibling tests |
| IA04-CONTRACT-INVALIDATE | `operations-admin/src/features/contract-management/ui/ContractInvalidateModal.tsx` | `useSubmissionLifecycle, useOverlayLock` | `invalidateOperationsContract` | sibling test |
| IA04-STORE-PROFILE / IA04-STORE-PROFILE-CONTRACT | `operations-admin/src/features/store-profile/ui/StoreProfilePage.tsx`, `FixedStoreContractDetailDrawer.tsx` | page `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer`; Drawer `useDetailDrawer` | profile/fixed-contract task reads; N/A mutation | sibling tests |
| IA05-GROUP-USERS / IA05-REGION-USERS / IA05-PROJECT-USERS / IA05-HEAD-COMPANY-USERS / IA05-STORE-USERS | `operations-admin/src/features/workspace-user/ui/WorkspaceUserPage.tsx` with one generated target-specific operation binding per pageDesignKey | `contextScopedQueryArgs` only | five target-specific user page/detail operation families; target is capability-derived | `WorkspaceUserPage.test.tsx` parameterized by five keys |
| IA05-USER-DETAIL | `operations-admin/src/features/workspace-user/ui/WorkspaceUserDetailDrawer.tsx` | `useDetailDrawer, useOverlayLock` | corresponding target-specific user detail | sibling test |
| IA05-USER-REVOKE | `operations-admin/src/features/workspace-user/ui/WorkspaceUserRevokeModal.tsx` | `useSubmissionLifecycle, useOverlayLock` | corresponding target-specific revoke operation | sibling test |
| IA01-USER-INVITATION-ACTIONS | `operations-admin/src/features/workspace-user/ui/WorkspaceInvitationPanel.tsx` | `adminDrawerSurfaceProps, contextScopedQueryArgs, useOverlayLock` | five target-specific invitation page/candidate operations | `WorkspaceInvitationPanel.test.tsx` |
| IA01-USER-INVITATION-CREATE-DRAWER | `operations-admin/src/features/workspace-user/ui/WorkspaceInvitationCreateDrawer.tsx` | `adminDrawerSurfaceProps, contextScopedQueryArgs, useDrawerFormLifecycle, useAsyncGenerationGuard, useOverlayLock` | corresponding target-specific create invitation operation | sibling test |
| IA01-USER-INVITATION-DETAIL-DRAWER | `operations-admin/src/features/workspace-user/ui/WorkspaceInvitationDetailDrawer.tsx` | `adminDrawerSurfaceProps, useDetailDrawer, useOverlayLock` | corresponding target-specific invitation detail readback | sibling test |
| IA01-USER-INVITATION-ACTION-MODAL | `operations-admin/src/features/workspace-user/ui/WorkspaceInvitationActionModal.tsx` | `useSubmissionLifecycle, useOverlayLock` | corresponding target-specific cancel/reissue operation | sibling test |
| IA05-PASSWORD-DRAWER | `operations-admin/src/features/authentication/ui/OperationsPasswordChangeDrawer.tsx` | `adminDrawerSurfaceProps, useDrawerFormLifecycle, useOverlayLock` | `changeCurrentWorkspacePassword` | sibling test |
| IA05-PASSWORD-RESULT | `operations-admin/src/features/authentication/ui/OperationsPasswordChangeResult.tsx` | `useOverlayLock` | N/A completion screen | sibling test |
| IA05-HOME-GROUP / IA05-HOME-REGION / IA05-HOME-PROJECT / IA05-HOME-HEAD-COMPANY / IA05-HOME-STORE | `operations-admin/src/features/role-home-bootstrap/ui/RoleHomeBootstrapPage.tsx` with five catalog page keys | `contextScopedQueryArgs` | N/A: shell/content outlet only, no dashboard query or command | parameterized sibling test |

For every `useAsyncGenerationGuard` row, the red mutation is removal of the guard while a candidate request is
outstanding; for every `useSubmissionLifecycle` row, it is replacing the lifecycle with app-local submitting state;
for every `useDrawerFormLifecycle` row, it is replacing dirty/close handling with app-local form state.  Those are
the per-screen expansion of the two import-equality mutations required by the final roster, and do not add a
generic UI framework.
