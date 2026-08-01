---
title: RM1 P6 final UI surface and screen implementation binding roster
status: DESIGN_REMEDIATION_DRAFT_FOR_INDEPENDENT_ROUND_2
reviewTarget: DESIGN
implementationAuthority: false
---

# RM1 P6 final UI surface and screen implementation binding roster

## 1. Purpose, denominator, and binding rules

This roster is the final-design binding omitted from the first implementation-facing plan.  It closes the
finite denominator of **22 carry-over surfaces / 25 catalog pageDesignKeys / 7 non-catalog surfaces** without
inventing a user task.  The interaction is final: a row may refine only owner/contract truth or an exact consumer
path; it may not change the accepted UI task, visible business copy, control cascade, physical surface, or
approved action.

The detailed physical-screen denominator is `rm1-u09-physical-screen-import-contracts.md`.  A surface row in
this document never permits a union of different Drawer/Modal/content-page imports: that companion file is the
exact import and test contract whenever a surface contains more than one physical screen.

Input hashes: IA01 `7e2ae73f810b8a7ad75a8f0a8800f873b5ea0c9f582648b8002d5258f6bb3a67`,
IA02 `8d3821c8deaa5a7c0fa460e570b96247842d305daf387d6c59298d2fea442813`,
IA03 `88a26ba14ad8f0f4d314eab85f8848f49eb32592dae908edaca932f0fdc45d17`,
IA04 `98b58f61d113a61cf1aad367d3cde812b8e6689fca465a0197fdb2e1bd280f6c`,
IA05 `7f2a8f2447eb7b0e40f2556b5f4361e68197e74713c5f5220e8dace7742ad960`, and the
carry-over denominator `contracts/policy/frontend-asset-carryover-manifest.json@
6b531d3bba676f5cc24e3121f482f7920abfe0b4c476081c1ce0478a17ee3974`.

Every row has a `CARRY` or `ADAPT` disposition, exact final consumer and focused-test path, owner prerequisite,
generated operation or exact non-applicability reason, failure/recovery, foundation contract, incremental check,
and package-exit assertion.  A listed `screen set` is a set of separately declared accepted IA screens that has
the same final owner, feature file, operation set and foundation imports; the source IA retains the individual
physical surface, actor, scenario, business goal, user-visible copy and form cascade.  Where those differ, rows
are separated.  No record permits a shared host to merge a Drawer, Modal, content Tab, header control or public
step into another screen.

Common package-exit assertion: the actual changed-file set must equal the non-empty incremental receipt set; the
row's test path, generated operation binding and foundation imports are checked against its stated final path.
For every UI row: typed problem keeps the owner readback/context; unknown command result reads owner truth before
replay; an authorization/validation failure keeps only non-sensitive permitted draft input; context change obeys
the accepted dirty/overlay guard.  `testId` is required in every row; it is omitted from repeated primitive lists.

**RTK / transport invariant.** Each app owns exactly one generated `createApi`; its store installs only that API
reducer and middleware. Reads use generated `use<OperationId>Query` hooks. Writes use the generated client through
the existing `*Transport.ts` command boundary. A page must not construct a base query, protocol header, `fetch`,
second API/store, Redux slice, `refetch()` loop or local `refreshKey`.

**Two independent refresh mechanisms.** Generated writes invalidate `[{wire, operationId}, {wire, LIST}]` and
refresh subscribed reads. A valid owner context mutation increments and returns `contextVersion`; every
owner-scoped query carries `expectedContextVersion`, giving the new context a new cache generation. `scopeRef` is
an additional business input only for operations whose schema declares it; it never replaces the version increment.
On an operations context-generation change, the shared content boundary resets local visual state such as page,
filters, expanded rows and drawers. Page code implements neither refresh mechanism.

**State and proof boundary.** Platform workspace selection remains the existing app-owned React state in
`app/state/WorkspaceScope.tsx`, hosted by `PlatformApp.tsx`; it adds no slice or store reducer. `identityKey` is
`DORMANT_WITH_REASON`: no current generated operation consumes it, so no screen may invent a consumer. Planned
`*.test.tsx` paths are not current proof; a future UI implementation must first provide an executable component or
browser harness before claiming user-interaction coverage.

## 2. P6-1 — non-catalog contract/owner inputs only

P6-1 does **not** implement a UI page.  It is the only phase permitted to establish the public owner truth that
the later consumer rows use.  Its focused tests are backend service/controller unit tests under
`apps/backend/catering-business-server/**/src/test/java/`; no UI test is claimed in this phase.

| non-catalog surface / accepted screens | owner prerequisite and generated operation disposition | consumer phase / final path | failure and proof |
| --- | --- | --- | --- |
| `PLATFORM-AUTH`; `IA01-PLATFORM-LOGIN`, `IA01-PLATFORM-RECOVERY-VERIFY/PASSWORD/COMPLETE` | platform-IAM owns normalized mobile + opaque recovery grant; retain `platformPasswordLogin`, add `sendPlatformLoginOtp`, `verifyPlatformLoginOtp`, `startPlatformPasswordRecovery`, `sendPlatformPasswordRecoveryOtp`, `verifyPlatformPasswordRecoveryOtp`, `completePlatformPasswordRecovery`. | P6-2 consumers: `apps/frontend/platform-admin/src/features/authentication/ui/PlatformLoginPage.tsx`, `PlatformPasswordRecoveryVerifyPage.tsx`, `PlatformPasswordRecoveryPasswordPage.tsx`, `PlatformPasswordRecoveryCompletePage.tsx`; accepted IA lower bound plus physical additions. | identical anti-enumeration response; expired/consumed grant cannot set password; success revokes platform sessions.  Unit tests: `PlatformAuthenticationServiceTest`, `PlatformAuthenticationControllerTest`; red: use `mobile_mask_source` or reuse an admin reset grant. |
| `OPERATIONS-AUTH`; `IA01-OPERATIONS-LOGIN` | workspace-IAM owner returns approved `workspaceName`, `operationsTitle`, nullable public `logoUrl`; retain `getOperationsWorkspaceLoginEntry`, `operationsWorkspacePasswordLogin`, `sendOperationsWorkspaceOtp`, `verifyOperationsWorkspaceOtp`; extend only their approved readback/schema. | P6-3 consumer: `apps/frontend/operations-admin/src/features/authentication/ui/OperationsLoginPage.tsx`; screen primitive `useOverlayLock`; generated base-query setup remains app-substrate-only. | absent/invalid public asset returns `logoUrl=null`; no URL/ref/session inference.  Unit tests: login-entry controller response and asset public-reference tests; red: return `logoAssetRef` or client-built URL. |
| `PUBLIC-ACCESS-RECOVERY`; `IA05-RECOVERY-VERIFY/PASSWORD/COMPLETE` | workspace-IAM owns a new anonymous flow; retain the distinct administrator-issued `send/verify/completeWorkspacePasswordReset` chain without exposing `resetGenerationKey`; add `start/send/verify/completeOperationsPasswordRecovery`. | P6-3 consumers: `apps/frontend/operations-admin/src/features/authentication/ui/OperationsPasswordRecoveryVerifyPage.tsx`, `OperationsPasswordRecoveryPasswordPage.tsx`, `OperationsPasswordRecoveryCompletePage.tsx`; accepted IA lower bound plus physical additions. | workspace mismatch, disabled account and unknown account are indistinguishable; complete is one-time and revokes operations sessions. Unit tests: `WorkspacePasswordRecoveryServiceTest`, public controller test; red: login page accepts generation key. |

P6-1 D5 assertion: these three non-catalog surfaces are `ADAPT` and owner/contract-complete before their later
consumer phases; no consumer phase may silently replace or retire their public protocol.

## 3. P6-2 — platform-admin screen contracts

All rows are **运维管理后台** except the explicitly public/authenticated boundary described in the source IA.
The actor is a platform user; `groupWorkspaceKey` is a locator/context prerequisite where the IA says selected
workspace is required, never a client authorization substitute.

| surface / screen set / page keys | exact final consumer and foundation primitive | operation / owner prerequisite | focused test and row-specific recovery |
| --- | --- | --- | --- |
| `PLATFORM-AUTH`; IA01 platform login/recovery | `PlatformLoginPage.tsx`, `PlatformPasswordRecoveryVerifyPage.tsx`, `PlatformPasswordRecoveryPasswordPage.tsx`, `PlatformPasswordRecoveryCompletePage.tsx`; accepted IA lower bound plus physical additions. | P6-1 platform-IAM operations above; no UI fallback that changes the protocol. | corresponding sibling tests; owner rejects indistinguishably and the user restarts only after a verified recovery readback. |
| supporting `PLATFORM-SHELL`; IA02 platform authenticated shell | `apps/frontend/platform-admin/src/app/PlatformApp.tsx`; accepted IA lower bound plus physical additions. `NOT_APPLICABLE_WITH_REASON`: not a separate frozen carry-over surface; it is the shared chrome host for platform catalog surfaces. | selected workspace remains context only, not client authorization. | `PlatformApp.test.tsx`; menu icon map, multi-tab refresh/fullscreen and sole tab-body scroll; red: route without the shell contract. |
| `PLATFORM-WORKSPACES`; IA02 workspace context/actions/detail/create/init/edit/status | `workspace-management/ui/WorkspaceManagementPage.tsx`, `workspace-administration/ui/WorkspaceAdministrationPage.tsx`; `useDetailDrawer, useDrawerFormLifecycle, useOverlayLock, contextScopedQueryArgs`. `PlatformApp.tsx` hosts the existing `app/state/WorkspaceScope.tsx` React selection owner; no slice/reducer is added. | generated `list/create/update/transitionPlatformGroupWorkspace*`, `uploadPlatformAsset`; workspace-management + asset owners; staged asset must be consumed/released by owner. | `WorkspaceManagementPage.test.tsx`, `WorkspaceAdministrationPage.test.tsx`; optimistic conflict reopens owner detail; red: action column or client-held staged asset release. |
| `PLATFORM-WORKSPACE-OVERVIEW`; IA02 overview | `workspace-administration/ui/WorkspaceAdministrationPage.tsx`; `contextScopedQueryArgs, useDetailDrawer`. | generated task read only; workspace owner supplies selected-workspace readback. | `WorkspaceAdministrationPage.test.tsx`; no management action in overview; red: surface exposes update/status. |
| `PLATFORM-ADMIN-USERS`; IA03 admin list/detail/create/edit/credential/status | `platform-administration/ui/AdministratorsPage.tsx`; `useDetailDrawer, useDrawerFormLifecycle, useOverlayLock`. | platform-IAM administrator command/readback operations; administrator credential recovery remains distinct from anonymous recovery. | `AdministratorsPage.test.tsx`; no unauthorized action render and owner repeats authorization; red: credential drawer calls anonymous recovery operation. |
| `PLATFORM-ORGANIZATION-OVERVIEW`; IA03 organization overview/hierarchy/detail | `organization-contract-overview/ui/PlatformReadPage.tsx`; `adminDrawerSurfaceProps, useDetailDrawer, useOverlayLock, contextScopedQueryArgs`. | generated organization overview page/detail/candidates; organization task-read owner owns filters and total. | `PlatformReadPage.test.tsx`; empty/error/retry retains selected workspace; red: full list then client filter. |
| `PLATFORM-CONTRACT-OVERVIEW`; IA03 contract overview/detail | `organization-contract-overview/ui/PlatformReadPage.tsx`; `adminDrawerSurfaceProps, useDetailDrawer, useOverlayLock, contextScopedQueryArgs`. | generated contract overview page/detail/candidates; contract task-read owner owns same-predicate items/total. | `PlatformReadPage.test.tsx`; detail opens from name and does not create/edit; red: list total differs from filter predicate. |
| `PLATFORM-ROLES`; IA03 role list/detail/create/edit/status | `workspace-iam/ui/RolesPage.tsx`; `adminDrawerSurfaceProps, useDetailDrawer, useDrawerFormLifecycle, useOverlayLock`. | generated role create/update/status + page/capability catalogs; workspace-IAM owner maintains separate trees. | `RolesPage.test.tsx`; detail precedes edit/status; red: merge page keys with capability keys. |
| `PLATFORM-WORKSPACE-ACCOUNTS`; IA03 account tab/detail/action | `workspace-iam/ui/AccountsPage.tsx`; `adminDrawerSurfaceProps, useDetailDrawer, useDrawerFormLifecycle, useOverlayLock`. | generated account/readback/administrator command operations; owner rechecks selected workspace and version. | `AccountsPage.test.tsx`; unknown submit readback and context change clears child state; red: action without detail owner readback. |
| `PLATFORM-EXTENSION-FIELDS`; IA03 extension page/edit/save | `extension-management/ui/ExtensionsPage.tsx`; `adminDrawerSurfaceProps, useDetailDrawer, useDrawerFormLifecycle, useOverlayLock`. | retain generated `getExtensionEntityCatalog`, `replaceExtensionDefinition`; definition owner retains whole-set replace and revision. | `ExtensionsPage.test.tsx`; conflict reopens definition readback; red: entity request sends definition revision. |
| `PLATFORM-PASSWORD`; IA03 password drawer/result | `authentication/ui/PlatformPasswordChangeDrawer.tsx`; `adminDrawerSurfaceProps, useDrawerFormLifecycle, useOverlayLock`. | retain generated `changeCurrentPlatformPassword`; platform-IAM owns session invalidation. | `PlatformPasswordChangeDrawer.test.tsx`; success leads to sign-in result, failure retains non-sensitive draft; red: app-local modal lifecycle. |

P6-2 D5 assertion: eight platform catalog page keys and the two platform non-catalog surfaces have a final path,
accepted IA screen binding, generated operation or explicit protocol handoff, owner readback and primitive import.
The two import-equality red mutations are (1) remove a declared foundation import and (2) replace it with app-local
state/lifecycle; each must fail the future manifest-backed frontend architecture check.

## 4. P6-3 — operations-admin and public screen contracts

`operations-admin` rows are **运营管理后台** and consume the selected assignment and data scope only as owner
validated query context.  `public` rows are affiliated with operations-admin but do not create a logged-in session.
No surface may expose technical terms in its `USER_VISIBLE_COPY`; the exact Chinese copy and every form dependency
are the accepted IA source screen fields referenced in the first column.

**P6-3 corrective slice — IA04 total-company brand authorization.** `PG-ORG-HEAD-COMPANY` includes only the final
`business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx`, with its nonvisual
`business-entity-management/application/HeadCompanyBrandAuthorizationActionAdapter.ts`; it is not an extra P6-2
surface or a second management page. The adapter is nonvisual and therefore is outside the physical-screen import
denominator: its sole UI consumer is this Drawer, its permitted protocol boundary is `OperationsTransport` plus
the four declared generated operations, and its focused adapter test must reject raw HTTP, `OperationsApi`,
`operationsRtk`, a new API slice or another UI consumer. The precise legacy removal denominator is
`head-company-management/ui/HeadCompanyManagementPage.tsx` and
`src/tests/architecture/static-boundary.test.mjs`; the nested collection-replace Drawer and the assertion requiring
that retired operation are removed or rewritten in the same P6-3 receipt set, so no legacy authorization path
survives. The
Drawer's accepted business task is current owner-confirmed brand rows, one searchable enabled candidate Select,
one immediate add and one immediate row remove.  Its exact generated-operation set is
`getOperationsOrganizationHeadCompany`, `getOperationsOrganizationBrands`,
`addOperationsOrganizationHeadCompanyBrandAuthorization`, and
`removeOperationsOrganizationHeadCompanyBrandAuthorization`. Current bytes are
`GAP-BRAND-CANDIDATE-OWNER-PAGINATION`: the contract receives `name`, `status=ENABLED`,
`expectedContextVersion`, `page`, `pageSize`, but the edge currently materializes the owner List before local
filter/sort/page. P6-3 changes `OperationsBusinessEntityController#brands` only, moves the same predicate and
total to the owner, and then passes only a bounded result;
the browser never materializes a full candidate set. A 204 causes owner detail readback. Each fresh user intent gets a fresh idempotency key; only an indeterminate
result may read back and then replay its exact original request/key if the membership predicate remains
unsatisfied. Known 4xx never replay. Current bytes also have
`GAP-BRAND-IN-USE-TYPED-PROJECTION`: the owner subclass currently reaches generic conflict fallback. P6-3 must
map that exact subclass to the declared safe code before generated wire/transport render fixed copy
“该品牌仍被门店使用”; adapter/Drawer state admits `errorCode` only, never raw server detail or a blocker-derived
field. See
`2026-07-30-v2s-rm1-p6-3-head-company-brand-authorization-corrective-design.md`.

| surface / screen set / page keys | exact final consumer and foundation primitive | operation / owner prerequisite | focused test and row-specific recovery |
| --- | --- | --- | --- |
| `OPERATIONS-AUTH`, `PUBLIC-ACCESS-RECOVERY`; IA01 operations login; IA05 recovery steps | `authentication/ui/OperationsLoginPage.tsx`, `OperationsPasswordRecoveryVerifyPage.tsx`, `OperationsPasswordRecoveryPasswordPage.tsx`, `OperationsPasswordRecoveryCompletePage.tsx`; accepted IA lower bound plus physical additions. | P6-1 workspace-IAM operations/readback; UI never derives branding or reset authority. | corresponding sibling tests; invalid/expired flow restarts without a session; red: use URL/asset ref/generation key. |
| `PUBLIC-INVITATION`; IA01 public invitation, OTP, credentials, complete | `invitation-acceptance/ui/PublicInvitationEntry.tsx`; `useOverlayLock`. | retain generated `get/accept/sendOtp/verifyOtp/saveCredentials/complete/getCompletionPublicInvitation`; invitation owner produces brand/readiness and no session before completion. | `PublicInvitationEntry.test.tsx`; title is dynamic `加入{运营管理后台标题}`; red: fixed title or early assignment/session. |
| `OPERATIONS-SHELL`; IA02 authenticated shell/header/role selection/data scope/sider trigger | `apps/frontend/operations-admin/src/app/OperationsApp.tsx`; `contextScopedQueryArgs, useOverlayLock`. | retain `getOperationsWorkspaceSessionEntry`, `selectOperationsWorkspaceSessionContext`, `selectOperationsWorkspaceSessionDataNode`; workspace-IAM owner separates assignment from data scope. Every mutation of assignment or visible data node is owner CAS + `contextVersion` increment and returns the entry; contextVersion is mandatory read cache generation, while scopeRef remains only an operation-declared business input. | `OperationsApp.test.tsx`; dirty guard and upstream selection clear dependent state. Context-generation change remounts content and resets pagination/local view state; same generation retains it. Red: remove the keyed content boundary, use full-page takeover, or infer scope from assignment. |
| `OPERATIONS-ORG-STRUCTURE`; IA04 tree/create/edit/status; `PG-ORG-STRUCTURE` | `organization-structure/ui/OrganizationStructurePage.tsx`; `adminDrawerSurfaceProps, contextScopedQueryArgs, useDrawerFormLifecycle, useOverlayLock`. | retain `get/create/update/transitionOperationsOrganization*`; organization owner validates parent/type/project phases. | `OrganizationStructurePage.test.tsx`; parent change clears dependent phase controls; red: client-only parent authorization. |
| `OPERATIONS-BUSINESS-ENTITIES`; IA04 brand/tenant/head-company/detail/create/edit/brands/status; `PG-ORG-BRAND`, `PG-ORG-TENANT`, `PG-ORG-HEAD-COMPANY` | new `business-entity-management/ui/BusinessEntityManagementPage.tsx` and final `HeadCompanyBrandAuthorizationDrawer.tsx`; the final Drawer is the sole UI consumer of nonvisual `business-entity-management/application/HeadCompanyBrandAuthorizationActionAdapter.ts`. Its import contract is generated-client/error-code via `OperationsTransport` only, with no raw HTTP, `OperationsApi`, `operationsRtk`, API slice or second consumer. Exact legacy removal is `head-company-management/ui/HeadCompanyManagementPage.tsx` plus `src/tests/architecture/static-boundary.test.mjs`; `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useDrawerFormLifecycle, useOverlayLock`. | retain brand/tenant/head-company generated operations; the authorization subset is owner detail + enabled candidate search + one add/remove resource command. `OperationsBusinessEntityController#brands` alone becomes owner-page pass-through; tenant/head-company branches stay outside this corrective slice. Current gaps are owner pagination and most-specific in-use typed projection; P6-3 closes both before UI binding. Each owner validates entity type. | `BusinessEntityManagementPage.test.tsx`, adapter-focused proof, and concrete `OperationsBusinessEntityControllerTest`; red: one generic command treats entity type as client authorization, retired bulk replace, edge-local candidate paging, superclass/generic in-use mapping, shared key across two brands, raw in-use detail, or any blocker-derived field. |
| `OPERATIONS-STORES`; IA04 store list/detail/create/edit/status; `PG-ORG-STORE-MANAGE` | `store-management/ui/StoreManagementPage.tsx`; `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useDrawerFormLifecycle, useOverlayLock`. | retain generated store page/create/candidates/definition/detail/update/status; business-entity/store owners close project filter and cascade. | `StoreManagementPage.test.tsx`; project candidate follows selected organization and reset cascades; red: static text/project id or client list filter. |
| `OPERATIONS-CONTRACTS`; IA04 contract list/detail/create/edit/invalidate; `PG-CONTRACT-STORE-MANAGE` | `contract-management/ui/ContractManagementPage.tsx`; `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useDrawerFormLifecycle, useOverlayLock`. | retain generated contract page/create/definition/candidates/detail/update/invalidate; contract owner derives tenant from selected store and authorizes project scope. | `ContractManagementPage.test.tsx`; selected store determines read-only tenant and stale candidate reopens; red: tenant mutation or scope from UI selection. |
| `OPERATIONS-USERS`; IA05 five target user tabs/detail/revoke plus IA01 invitation drawer/detail/modal; `PG-IAM-GROUP-USERS`, `PG-IAM-REGION-USERS`, `PG-IAM-PROJECT-USERS`, `PG-IAM-HEAD-COMPANY-USERS`, `PG-IAM-STORE-USERS` | `workspace-user/ui/WorkspaceUserPage.tsx`, `WorkspaceInvitationPanel.tsx`; `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useDrawerFormLifecycle, useOverlayLock`. | retain five target-specific invitation/candidate/user/detail/revoke operation sets; capability→target resolver is owner fact. | `WorkspaceUserPage.test.tsx`, `WorkspaceInvitationPanel.test.tsx`; target switch reloads candidate and list; red: derive target from assignment/page key or use one generic operation. |
| `OPERATIONS-STORE-PROFILE`; IA04 store profile/contracts; `PG-STORE-PROFILE` | `store-profile/ui/StoreProfilePage.tsx`; `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer`. | retain `getOperationsStoreProfile`, `getOperationsFixedStoreContracts`; store/contract task-read owner supplies only role-visible facts. | `StoreProfilePage.test.tsx`; no mutation controls; red: profile exposes status/contract command. |
| `OPERATIONS-PASSWORD`; IA05 password drawer/result | new `authentication/ui/OperationsPasswordChangeDrawer.tsx`; `adminDrawerSurfaceProps, useDrawerFormLifecycle, useOverlayLock`. | retain `changeCurrentWorkspacePassword`; workspace-IAM owner invalidates sessions. | `OperationsPasswordChangeDrawer.test.tsx`; success returns to sign-in result; red: reuse public recovery flow. |
| `OPERATIONS-FIVE-HOME-BOOTSTRAPS`; IA05 home group/region/project/head-company/store; `HOME-GROUP`, `HOME-REGION`, `HOME-PROJECT`, `HOME-HEAD-COMPANY`, `HOME-STORE` | `role-home-bootstrap/ui/RoleHomeBootstrapPage.tsx`; `contextScopedQueryArgs`. | exact N/A: catalog-directed shell/content outlet only; no new business read/write operation. | `RoleHomeBootstrapPage.test.tsx`; role switch changes only catalog target; red: home adds dashboard query or reimplements context. |

P6-3 D5 assertion: twelve operations catalog page keys, five home page keys and five remaining non-catalog surfaces,
including the single named `PG-ORG-HEAD-COMPANY` / IA04 brand-authorization corrective slice above,
are bound to their public/operations user task, source screen, final consumer, owner operation, error recovery and
foundation primitive.  The same two foundation import-equality mutations are required for each primitive-bearing
surface; a `NONE_WITH_REASON` is forbidden here because every required primitive is named by the carry-over
manifest.

## 5. Review and implementation boundary

This roster completes design only.  Before code starts, P6-1 must be separately authorized and then reviewed by
Dexter and Claude after its contract/owner tests.  P6-2 and P6-3 remain serial and cannot start without the
previous phase's implementation GO.  Any future exact path whose current file does not exist is a planned
capability-named create path, not permission to create it now.
