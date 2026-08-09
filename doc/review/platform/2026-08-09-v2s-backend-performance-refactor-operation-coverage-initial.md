---
kind: backend-performance-refactor-operation-coverage-initial
status: PRE_FREEZE_DISCOVERY_BASELINE_NOT_ACCEPTANCE_EVIDENCE
goalId: BACKEND_PERFORMANCE_REFACTOR_20260808
---

# 后台性能重构 196 operation 初版覆盖矩阵（冻结前 discovery baseline）

本矩阵逐行绑定两份 generated registry 的 operation。它不是运行成功证据；任何 UNMEASURED_BLOCKS_OPTIMIZATION 行禁止对该 operation 或包含它的 SQL-M 项作成功声明。当前分类只能作为冻结前 discovery，不得因 live runtime 文件追加而自动改变。

## Discovery input 与未来 accepted snapshot

- general registry: apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json sha256 1f7900fb24b930dfb41fd5c73659a094c75f7e4e827de1ecd2e763596d7e2824
- catalog registry: apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json sha256 fe3c3f7bbc5dda2b1289d4ce81b61d93f9ac52d94845acae7fb3505180117118
- historical diagnostic: .runtime/rm1/http-diagnostic/rm1-http-diagnostic-1785592416417-9e221440/evidence/http-diagnostic-report.json sha256 bd8ebf427da5c0436bdac045d0708a17d2057e0336b80d37a93cac0499061dba
- current seed DB evidence (live discovery only): .runtime/r5/evidence/db-operations.jsonl; its digest is intentionally not frozen here and is recorded only by the later BP-U01 snapshot manifest

Join key is operationId + method + normalizedRouteTemplate + owner + consumerFace; catalog contract-relative paths are normalized by prefixing /api, matching EdgeRouteFaceRegistry.loadExtended() behavior. MEASURED_SEED takes precedence; H/S retain both provenances. MEASURED_NEW_FIXTURE is a closed value reserved for BP-U07 execution and has zero rows initially.

BP-U01 must later create `<run-evidence>/snapshots/<sha256>/snapshot-manifest.json` atomically, with immutable DB operations, statement dictionary, request events, seed report and run manifest references; it must record input paths/digests/byte sizes, run/request range, schema/basis and event counts. Coverage gates must reject this live path and accept only that snapshot. No snapshot is created by this design-only package.

**Exact initial counts:** 196 total = **55** MEASURED_SEED + **105** MEASURED_HISTORICAL + **0** MEASURED_NEW_FIXTURE + **36** UNMEASURED_BLOCKS_OPTIMIZATION; H+S=39, seed-only=16. The two seed reports expose only 54 unique API endpoint groups; getOperationsWorkspaceLoginEntry is correctly counted as seed evidence from DB JSONL (and H), not silently discarded.

**Columns:** operationId | owner | method | consumerFace | normalized route | coverage | H | S | read class | initial static merges excluding SQL-M4.

本 discovery 表没有 M5 列。SQL-M5 的唯一真相是详设 `BP-U07｜SQL-M5 六表逐行处置` 与未来 `backend-performance-sql-merge-applicability.json` 的六条 versioned mapping；新 gate 必须拒绝任何 `PENDING`、空 operation set 或全 owner 泛化。

SQL-M4 也不占 196 operation 的适用列：它是非空的 source-retirement control，必须从 `WorkspaceStatusLookup.isEnabled` 的五个 post-auth group 退役、五个 pre-auth expression 保留与行为 fixture 三组 exact evidence 验收。平台 task-read 的 `EnabledSelectedWorkspaceFact` 由 task-read policy 的 source-bound fixed/branch set 管理，不从本表按 consumer face 推断。

Rows (one operation per line):
acceptPublicInvitation | workspace-iam | POST | public | /api/public/invitations/{groupWorkspaceKey}/{invitationToken} | MEASURED_SEED | H | S | NOT_GET | -
addOperationsOrganizationHeadCompanyBrandAuthorization | organization | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations | MEASURED_SEED | H | S | NOT_GET | SQL-M1,SQL-M2
cancelOperationsWorkspaceGroupInvitation | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations/{invitationId}/cancel | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
cancelOperationsWorkspaceHeadCompanyInvitation | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations/{invitationId}/cancel | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
cancelOperationsWorkspaceProjectInvitation | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations/{invitationId}/cancel | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
cancelOperationsWorkspaceRegionInvitation | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations/{invitationId}/cancel | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
cancelOperationsWorkspaceStoreInvitation | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations/{invitationId}/cancel | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
cancelWorkspaceInvitation | workspace-iam | POST | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}/cancel | MEASURED_SEED | - | S | NOT_GET | -
changeCurrentPlatformPassword | platform-iam | POST | platform-admin | /api/platform/auth/password | MEASURED_HISTORICAL | H | - | NOT_GET | -
changeCurrentWorkspacePassword | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/session/password | MEASURED_HISTORICAL | H | - | NOT_GET | -
completeOperationsPasswordRecovery | workspace-iam | POST | public | /api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/complete | MEASURED_HISTORICAL | H | - | NOT_GET | -
completePlatformPasswordRecovery | platform-iam | POST | platform-admin | /api/platform/auth/password-recovery/complete | MEASURED_HISTORICAL | H | - | NOT_GET | -
completePublicInvitation | workspace-iam | POST | public | /api/public/invitations/{groupWorkspaceKey}/{invitationToken}/complete | MEASURED_SEED | H | S | NOT_GET | -
createOperationsContract | contract | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/contracts | MEASURED_SEED | H | S | NOT_GET | SQL-M1,SQL-M2
createOperationsOrganizationBrand | organization | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands | MEASURED_SEED | H | S | NOT_GET | SQL-M1,SQL-M2
createOperationsOrganizationHeadCompany | organization | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies | MEASURED_SEED | H | S | NOT_GET | SQL-M1,SQL-M2
createOperationsOrganizationProject | organization | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/regions/{regionId}/projects | MEASURED_SEED | H | S | NOT_GET | SQL-M1,SQL-M2
createOperationsOrganizationRegion | organization | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/regions | MEASURED_SEED | H | S | NOT_GET | SQL-M1,SQL-M2
createOperationsOrganizationStore | organization | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores | MEASURED_SEED | H | S | NOT_GET | SQL-M1,SQL-M2
createOperationsOrganizationTenant | organization | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants | MEASURED_SEED | H | S | NOT_GET | SQL-M1,SQL-M2
createOperationsWorkspaceGroupInvitation | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
createOperationsWorkspaceHeadCompanyInvitation | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
createOperationsWorkspaceProjectInvitation | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
createOperationsWorkspaceRegionInvitation | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
createOperationsWorkspaceStoreInvitation | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
createPlatformAdmin | platform-iam | POST | platform-admin | /api/platform/admin-users | MEASURED_SEED | H | S | NOT_GET | -
createPlatformGroupWorkspace | platform-workspace | POST | platform-admin | /api/platform/group-workspaces | MEASURED_SEED | H | S | NOT_GET | -
createWorkspaceInvitation | workspace-iam | POST | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/invitations | MEASURED_SEED | - | S | NOT_GET | -
createWorkspaceRole | workspace-iam | POST | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/roles | MEASURED_SEED | H | S | NOT_GET | -
getCurrentPlatformSession | platform-iam | GET | platform-admin | /api/platform/auth/session | MEASURED_SEED | H | S | PROTOCOL_READ_EXEMPT | -
getExtensionDefinition | extension | GET | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions/{entityType} | MEASURED_SEED | H | S | TASK_READ | -
getExtensionEntityCatalog | extension | GET | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions | MEASURED_HISTORICAL | H | - | TASK_READ | -
getOperationsContract | contract | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId} | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsContractCandidates | contract | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/contracts/candidates | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsContractExtensionDefinition | contract | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/contracts/extension-definition | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsContracts | contract | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/contracts | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsEntityAuditHistory | platform-workspace | GET | operations-admin | /api/operations/audit-history | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsFixedStoreContracts | contract | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/store/profile/contracts | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsOrganizationBrand | organization | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId} | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsOrganizationBrands | organization | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsOrganizationBusinessEntityExtensionDefinition | organization | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/business-entities/extension-definition | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsOrganizationCandidates | organization | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/candidates | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | TASK_READ | SQL-M1,SQL-M2
getOperationsOrganizationHeadCompanies | organization | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsOrganizationHeadCompany | organization | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId} | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsOrganizationHierarchy | organization | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsOrganizationHierarchyExtensionDefinition | organization | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/hierarchy/extension-definition | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | TASK_READ | SQL-M1,SQL-M2
getOperationsOrganizationStore | organization | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId} | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsOrganizationStoreCandidates | organization | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/candidates | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsOrganizationStoreExtensionDefinition | organization | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/extension-definition | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsOrganizationStores | organization | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsOrganizationTenant | organization | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants/{tenantId} | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsOrganizationTenants | organization | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsStoreProfile | organization | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/store/profile | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceGroupInvitationCandidates | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations/candidates | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceGroupInvitations | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceGroupUser | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/user | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceGroupUserAccount | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/user/accounts/{accountId} | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceHeadCompanyInvitationCandidates | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations/candidates | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceHeadCompanyInvitations | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceHeadCompanyUser | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/user | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceHeadCompanyUserAccount | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/user/accounts/{accountId} | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceLoginEntry | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/login-entry | MEASURED_SEED | H | S | PROTOCOL_READ_EXEMPT | -
getOperationsWorkspaceProjectInvitationCandidates | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations/candidates | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceProjectInvitations | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceProjectUser | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/user | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceProjectUserAccount | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/user/accounts/{accountId} | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceRegionInvitationCandidates | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations/candidates | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceRegionInvitations | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceRegionUser | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/user | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceRegionUserAccount | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/user/accounts/{accountId} | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceSessionEntry | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/session/entry | MEASURED_SEED | H | S | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceStoreInvitationCandidates | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations/candidates | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceStoreInvitations | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceStoreUser | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/user | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getOperationsWorkspaceStoreUserAccount | workspace-iam | GET | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/user/accounts/{accountId} | MEASURED_HISTORICAL | H | - | TASK_READ | SQL-M1,SQL-M2
getPlatformAdminDetail | platform-iam | GET | platform-admin | /api/platform/admin-users/{platformAdminId} | MEASURED_HISTORICAL | H | - | TASK_READ | -
getPlatformAdminPage | platform-iam | GET | platform-admin | /api/platform/admin-users | MEASURED_HISTORICAL | H | - | TASK_READ | -
getPlatformContractOverviewDetail | contract | GET | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview/{contractId} | MEASURED_HISTORICAL | H | - | TASK_READ | -
getPlatformContractOverviewPage | contract | GET | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview | MEASURED_HISTORICAL | H | - | TASK_READ | -
getPlatformEntityAuditHistory | platform-workspace | GET | platform-admin | /api/platform/audit-history | MEASURED_HISTORICAL | H | - | TASK_READ | -
getPlatformGroupWorkspaceDetail | platform-workspace | GET | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey} | MEASURED_HISTORICAL | H | - | TASK_READ | -
getPlatformOrganizationCandidates | organization | GET | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/candidates | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | TASK_READ | -
getPlatformOrganizationHierarchyTree | organization | GET | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/hierarchy | MEASURED_HISTORICAL | H | - | TASK_READ | -
getPlatformOrganizationOverviewDetail | organization | GET | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/{category}/{itemId} | MEASURED_HISTORICAL | H | - | TASK_READ | -
getPlatformOrganizationOverviewPage | organization | GET | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview | MEASURED_HISTORICAL | H | - | TASK_READ | -
getPublicAssetContent | platform-asset | GET | public | /api/public/assets/{assetRef}/content | MEASURED_HISTORICAL | H | - | PROTOCOL_READ_EXEMPT | -
getPublicInvitationCompletion | workspace-iam | GET | public | /api/public/invitations/{groupWorkspaceKey}/{invitationToken}/completion | MEASURED_HISTORICAL | H | - | PROTOCOL_READ_EXEMPT | -
getPublicInvitationView | workspace-iam | GET | public | /api/public/invitations/{groupWorkspaceKey}/{invitationToken} | MEASURED_HISTORICAL | H | - | PROTOCOL_READ_EXEMPT | -
getWorkspaceAccount | workspace-iam | GET | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId} | MEASURED_HISTORICAL | H | - | TASK_READ | -
getWorkspaceAccounts | workspace-iam | GET | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/accounts | MEASURED_SEED | H | S | TASK_READ | -
getWorkspaceInvitation | workspace-iam | GET | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId} | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | TASK_READ | -
getWorkspaceInvitationCandidates | workspace-iam | GET | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/invitation-candidates | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | TASK_READ | -
getWorkspaceInvitations | workspace-iam | GET | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/invitations | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | TASK_READ | -
getWorkspaceRole | workspace-iam | GET | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId} | MEASURED_HISTORICAL | H | - | TASK_READ | -
getWorkspaceRoles | workspace-iam | GET | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/roles | MEASURED_HISTORICAL | H | - | TASK_READ | -
initializeCommercialGroup | organization | POST | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/commercial-group | MEASURED_SEED | H | S | NOT_GET | -
invalidateOperationsContract | contract | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId}/invalidate | MEASURED_SEED | H | S | NOT_GET | SQL-M1,SQL-M2
listPlatformGroupWorkspaces | platform-workspace | GET | platform-admin | /api/platform/group-workspaces | MEASURED_HISTORICAL | H | - | TASK_READ | -
operationsWorkspaceLogout | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/logout | MEASURED_HISTORICAL | H | - | NOT_GET | -
operationsWorkspacePasswordLogin | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/password-login | MEASURED_SEED | H | S | NOT_GET | -
platformLogout | platform-iam | POST | platform-admin | /api/platform/auth/logout | MEASURED_HISTORICAL | H | - | NOT_GET | -
platformPasswordLogin | platform-iam | POST | platform-admin | /api/platform/auth/password-login | MEASURED_SEED | H | S | NOT_GET | -
reissueOperationsWorkspaceGroupInvitation | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations/{invitationId}/reissue | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
reissueOperationsWorkspaceHeadCompanyInvitation | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations/{invitationId}/reissue | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
reissueOperationsWorkspaceProjectInvitation | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations/{invitationId}/reissue | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
reissueOperationsWorkspaceRegionInvitation | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations/{invitationId}/reissue | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
reissueOperationsWorkspaceStoreInvitation | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations/{invitationId}/reissue | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
reissueWorkspaceInvitation | workspace-iam | POST | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}/reissue | MEASURED_SEED | - | S | NOT_GET | -
releasePlatformStagedAsset | platform-asset | POST | platform-admin | /api/platform/assets/staging/{assetRef}/release | MEASURED_HISTORICAL | H | - | NOT_GET | -
removeOperationsOrganizationHeadCompanyBrandAuthorization | organization | DELETE | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations/{brandId} | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
replaceExtensionDefinition | extension | PUT | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions/{entityType} | MEASURED_SEED | H | S | NOT_GET | -
requestWorkspaceCredentialReset | workspace-iam | POST | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/credential-reset | MEASURED_SEED | H | S | NOT_GET | -
resetPlatformAdminCredential | platform-iam | POST | platform-admin | /api/platform/admin-users/{platformAdminId}/credential-reset | MEASURED_HISTORICAL | H | - | NOT_GET | -
revokeOperationsWorkspaceGroupUserAssignment | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/user/assignments/{assignmentId}/revoke | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
revokeOperationsWorkspaceHeadCompanyUserAssignment | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/user/assignments/{assignmentId}/revoke | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
revokeOperationsWorkspaceProjectUserAssignment | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/user/assignments/{assignmentId}/revoke | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
revokeOperationsWorkspaceRegionUserAssignment | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/user/assignments/{assignmentId}/revoke | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
revokeOperationsWorkspaceStoreUserAssignment | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/user/assignments/{assignmentId}/revoke | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
revokePlatformWorkspaceAssignment | workspace-iam | POST | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/assignments/{assignmentId}/revoke | MEASURED_SEED | H | S | NOT_GET | -
savePublicInvitationCredentials | workspace-iam | POST | public | /api/public/invitations/{groupWorkspaceKey}/{invitationToken}/credentials | MEASURED_SEED | H | S | NOT_GET | -
selectOperationsWorkspaceSessionContext | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/session/context | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
selectOperationsWorkspaceSessionDataNode | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/session/data-node | MEASURED_SEED | H | S | NOT_GET | SQL-M1,SQL-M2
sendOperationsPasswordRecoveryOtp | workspace-iam | POST | public | /api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/otp/send | MEASURED_HISTORICAL | H | - | NOT_GET | -
sendOperationsWorkspaceOtp | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/otp/send | MEASURED_HISTORICAL | H | - | NOT_GET | -
sendPlatformLoginOtp | platform-iam | POST | platform-admin | /api/platform/auth/login-otp/send | MEASURED_HISTORICAL | H | - | NOT_GET | -
sendPlatformPasswordRecoveryOtp | platform-iam | POST | platform-admin | /api/platform/auth/password-recovery/otp/send | MEASURED_HISTORICAL | H | - | NOT_GET | -
sendPublicInvitationOtp | workspace-iam | POST | public | /api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/send | MEASURED_SEED | H | S | NOT_GET | -
stagePlatformAsset | platform-asset | POST | platform-admin | /api/platform/assets/staging | MEASURED_SEED | H | S | NOT_GET | -
startOperationsPasswordRecovery | workspace-iam | POST | public | /api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/start | MEASURED_HISTORICAL | H | - | NOT_GET | -
startPlatformPasswordRecovery | platform-iam | POST | platform-admin | /api/platform/auth/password-recovery/start | MEASURED_HISTORICAL | H | - | NOT_GET | -
transitionOperationsOrganizationBrandStatus | organization | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId}/status | MEASURED_SEED | H | S | NOT_GET | SQL-M1,SQL-M2
transitionOperationsOrganizationHeadCompanyStatus | organization | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/status | MEASURED_SEED | H | S | NOT_GET | SQL-M1,SQL-M2
transitionOperationsOrganizationNodeStatus | organization | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/{nodeId}/status | MEASURED_SEED | H | S | NOT_GET | SQL-M1,SQL-M2
transitionOperationsOrganizationStoreStatus | organization | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}/status | MEASURED_SEED | H | S | NOT_GET | SQL-M1,SQL-M2
transitionOperationsOrganizationTenantStatus | organization | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants/{tenantId}/status | MEASURED_SEED | H | S | NOT_GET | SQL-M1,SQL-M2
transitionPlatformAdminStatus | platform-iam | POST | platform-admin | /api/platform/admin-users/{platformAdminId}/status | MEASURED_SEED | H | S | NOT_GET | -
transitionPlatformGroupWorkspaceStatus | platform-workspace | POST | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/status | MEASURED_SEED | H | S | NOT_GET | -
transitionWorkspaceAccountStatus | workspace-iam | POST | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/status | MEASURED_SEED | H | S | NOT_GET | -
transitionWorkspaceRoleStatus | workspace-iam | POST | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}/status | MEASURED_HISTORICAL | H | - | NOT_GET | -
updateOperationsCommercialGroup | organization | PATCH | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/commercial-group | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2
updateOperationsContract | contract | PATCH | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId} | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
updateOperationsOrganizationBrand | organization | PATCH | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId} | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
updateOperationsOrganizationHeadCompany | organization | PATCH | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId} | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
updateOperationsOrganizationNode | organization | PATCH | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/{nodeId} | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
updateOperationsOrganizationStore | organization | PATCH | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId} | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
updateOperationsOrganizationTenant | organization | PATCH | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants/{tenantId} | MEASURED_HISTORICAL | H | - | NOT_GET | SQL-M1,SQL-M2
updatePlatformAdminProfile | platform-iam | PATCH | platform-admin | /api/platform/admin-users/{platformAdminId}/profile | MEASURED_HISTORICAL | H | - | NOT_GET | -
updatePlatformGroupWorkspaceDisplay | platform-workspace | PATCH | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey} | MEASURED_SEED | H | S | NOT_GET | -
updateWorkspaceRole | workspace-iam | PATCH | platform-admin | /api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId} | MEASURED_HISTORICAL | H | - | NOT_GET | -
verifyOperationsPasswordRecoveryOtp | workspace-iam | POST | public | /api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/otp/verify | MEASURED_HISTORICAL | H | - | NOT_GET | -
verifyOperationsWorkspaceOtp | workspace-iam | POST | operations-admin | /api/operations/group-workspaces/{groupWorkspaceKey}/otp/verify | MEASURED_HISTORICAL | H | - | NOT_GET | -
verifyPlatformLoginOtp | platform-iam | POST | platform-admin | /api/platform/auth/login-otp/verify | MEASURED_HISTORICAL | H | - | NOT_GET | -
verifyPlatformPasswordRecoveryOtp | platform-iam | POST | platform-admin | /api/platform/auth/password-recovery/otp/verify | MEASURED_HISTORICAL | H | - | NOT_GET | -
verifyPublicInvitationOtp | workspace-iam | POST | public | /api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/verify | MEASURED_SEED | H | S | NOT_GET | -
getOperationsCatalogWorkbenchContext | catalog | GET | operations-admin | /api/operations/catalog-inventory/workbench/context | MEASURED_SEED | - | S | TASK_READ | SQL-M1,SQL-M2,SQL-M3
getOperationsCatalogNavigation | catalog | GET | operations-admin | /api/operations/catalog-inventory/navigation | MEASURED_SEED | - | S | TASK_READ | SQL-M1,SQL-M2,SQL-M3
getOperationsCatalogItems | catalog | GET | operations-admin | /api/operations/catalog-inventory/items | MEASURED_SEED | - | S | TASK_READ | SQL-M1,SQL-M2,SQL-M3
getOperationsCatalogItem | catalog | GET | operations-admin | /api/operations/catalog-inventory/items/{itemCode} | MEASURED_SEED | - | S | TASK_READ | SQL-M1,SQL-M2,SQL-M3
createOperationsCatalogItem | catalog | POST | operations-admin | /api/operations/catalog-inventory/items | MEASURED_SEED | - | S | NOT_GET | SQL-M1,SQL-M2,SQL-M3
saveOperationsCatalogItem | catalog | PATCH | operations-admin | /api/operations/catalog-inventory/items/{itemCode} | MEASURED_SEED | - | S | NOT_GET | SQL-M1,SQL-M2,SQL-M3
transitionOperationsCatalogItemStatus | catalog | POST | operations-admin | /api/operations/catalog-inventory/items/{itemCode}/status | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2,SQL-M3
createOperationsCatalogCategory | catalog | POST | operations-admin | /api/operations/catalog-inventory/categories | MEASURED_SEED | - | S | NOT_GET | SQL-M1,SQL-M2,SQL-M3
updateOperationsCatalogCategory | catalog | PATCH | operations-admin | /api/operations/catalog-inventory/categories/{categoryRef} | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2,SQL-M3
moveOperationsCatalogCategory | catalog | POST | operations-admin | /api/operations/catalog-inventory/categories/{categoryRef}/move | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2,SQL-M3
deleteOperationsCatalogCategory | catalog | DELETE | operations-admin | /api/operations/catalog-inventory/categories/{categoryRef} | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2,SQL-M3
getOperationsCatalogDictionary | catalog | GET | operations-admin | /api/operations/catalog-inventory/dictionaries/{dictionaryKind} | MEASURED_SEED | - | S | TASK_READ | SQL-M1,SQL-M2,SQL-M3
createOperationsCatalogDictionaryEntry | catalog | POST | operations-admin | /api/operations/catalog-inventory/dictionaries/{dictionaryKind}/entries | MEASURED_SEED | - | S | NOT_GET | SQL-M1,SQL-M2,SQL-M3
updateOperationsCatalogDictionaryEntry | catalog | PATCH | operations-admin | /api/operations/catalog-inventory/dictionaries/{dictionaryKind}/entries/{entryCode} | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2,SQL-M3
reorderOperationsCatalogDictionaryEntry | catalog | POST | operations-admin | /api/operations/catalog-inventory/dictionaries/{dictionaryKind}/entries/reorder | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2,SQL-M3
transitionOperationsCatalogDictionaryEntryStatus | catalog | POST | operations-admin | /api/operations/catalog-inventory/dictionaries/{dictionaryKind}/entries/{entryCode}/status | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2,SQL-M3
getOperationsProductionTags | fulfillment-production | GET | operations-admin | /api/operations/catalog-inventory/production-tags | MEASURED_SEED | - | S | TASK_READ | SQL-M1,SQL-M2
createOperationsProductionTag | fulfillment-production | POST | operations-admin | /api/operations/catalog-inventory/production-tags | MEASURED_SEED | - | S | NOT_GET | SQL-M1,SQL-M2
updateOperationsProductionTag | fulfillment-production | PATCH | operations-admin | /api/operations/catalog-inventory/production-tags/{tagCode} | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2
transitionOperationsProductionTagStatus | fulfillment-production | POST | operations-admin | /api/operations/catalog-inventory/production-tags/{tagCode}/status | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2
getOperationsLocalCatalogCopyCandidates | catalog | GET | operations-admin | /api/operations/catalog-inventory/copy/local/candidates | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | TASK_READ | SQL-M1,SQL-M2,SQL-M3
preflightOperationsLocalCatalogCopy | catalog | POST | operations-admin | /api/operations/catalog-inventory/copy/local/preflight | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2,SQL-M3
executeOperationsLocalCatalogCopy | catalog | POST | operations-admin | /api/operations/catalog-inventory/copy/local/execute | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2,SQL-M3
preflightOperationsTemporaryCatalogItemPromotion | catalog | POST | operations-admin | /api/operations/catalog-inventory/items/{itemCode}/temporary-promotion/preflight | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2,SQL-M3
executeOperationsTemporaryCatalogItemPromotion | catalog | POST | operations-admin | /api/operations/catalog-inventory/items/{itemCode}/temporary-promotion/execute | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2,SQL-M3
getOperationsBrandCatalogCopyCandidates | catalog | GET | operations-admin | /api/operations/catalog-inventory/copy/brand/candidates | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | TASK_READ | SQL-M1,SQL-M2,SQL-M3
preflightOperationsBrandCatalogCopy | catalog | POST | operations-admin | /api/operations/catalog-inventory/copy/brand/preflight | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2,SQL-M3
executeOperationsBrandCatalogCopy | catalog | POST | operations-admin | /api/operations/catalog-inventory/copy/brand/execute | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2,SQL-M3
getOperationsInventoryTargets | inventory | GET | operations-admin | /api/operations/catalog-inventory/inventory-targets | MEASURED_SEED | - | S | TASK_READ | SQL-M1,SQL-M2,SQL-M6
getOperationsInventoryTarget | inventory | GET | operations-admin | /api/operations/catalog-inventory/inventory-targets/{targetRef} | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | TASK_READ | SQL-M1,SQL-M2,SQL-M6
getOperationsInventoryTargetChangeSummary | inventory | GET | operations-admin | /api/operations/catalog-inventory/inventory-targets/{targetRef}/changes | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | TASK_READ | SQL-M1,SQL-M2,SQL-M6
getOperationsInventoryTargetBusinessHistory | inventory | GET | operations-admin | /api/operations/catalog-inventory/inventory-targets/{targetRef}/business-history | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | TASK_READ | SQL-M1,SQL-M2,SQL-M6
getOperationsInventoryTargetConsumptionReferences | inventory | GET | operations-admin | /api/operations/catalog-inventory/inventory-targets/{targetRef}/consumption-references | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | TASK_READ | SQL-M1,SQL-M2,SQL-M6
getOperationsInventoryTargetLedger | inventory | GET | operations-admin | /api/operations/catalog-inventory/inventory-targets/{targetRef}/ledger | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | TASK_READ | SQL-M1,SQL-M2,SQL-M6
getOperationsInventoryTargetDiagnostics | inventory | GET | operations-admin | /api/operations/catalog-inventory/inventory-targets/{targetRef}/diagnostics | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | TASK_READ | SQL-M1,SQL-M2,SQL-M6
countOperationsInventoryTarget | inventory | POST | operations-admin | /api/operations/catalog-inventory/inventory-targets/{targetRef}/count | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2,SQL-M6
increaseOperationsInventoryTarget | inventory | POST | operations-admin | /api/operations/catalog-inventory/inventory-targets/{targetRef}/increase | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2,SQL-M6
adjustOperationsInventoryTarget | inventory | POST | operations-admin | /api/operations/catalog-inventory/inventory-targets/{targetRef}/adjust | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2,SQL-M6
updateOperationsInventoryTargetConfiguration | inventory | PATCH | operations-admin | /api/operations/catalog-inventory/inventory-targets/{targetRef}/configuration | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2,SQL-M6
stageOperationsCatalogAsset | asset | POST | operations-admin | /api/operations/catalog-inventory/assets/stage | MEASURED_SEED | - | S | NOT_GET | SQL-M1,SQL-M2
releaseOperationsCatalogStagedAsset | asset | POST | operations-admin | /api/operations/catalog-inventory/assets/{assetRef}/release | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | NOT_GET | SQL-M1,SQL-M2
getOperationsCatalogShapeManifest | catalog | GET | operations-admin | /api/operations/catalog-inventory/shape-manifest | UNMEASURED_BLOCKS_OPTIMIZATION | - | - | TASK_READ | SQL-M1,SQL-M2,SQL-M3

## Required BP-U07 transitions and controls

1. A generated checker must rebuild the 196 row keys from both registries and reject missing, duplicate, hand-added, owner/face/normalized-path mismatch, a catalog /api-normalization drift, or any live `.runtime/r5/evidence/db-operations.jsonl` input.
2. MEASURED_NEW_FIXTURE may be assigned only with a fixture ID/digest, measurement schema/basis, run-manifest digest and successful current observation. Initial H data is aggregate-only and cannot substitute for callSite-level proof.
3. Every UNMEASURED_BLOCKS_OPTIMIZATION row blocks the acceptance of every listed SQL-M item. The unmeasured group contains **15 GET** rows (all TASK_READ, not in the five protocol/content exemptions); they block B=78 budget enablement until new fixtures measure them.
4. SQL-M1/M2 applicability is exactly operations-admin less the six listed protocol routes (128); SQL-M3 is catalog owner=25; SQL-M6 is inventory=11. SQL-M4 is deliberately not an operation-coverage claim: it is a nonempty source-retirement/retained-preauth control declared in BP-U07 and must not pass from an empty matrix set. Platform `EnabledSelectedWorkspaceFact` is a source-bound task-read policy fact, not a consumer-face projection. SQL-M5 is defined only by the six nonempty, versioned rows in the BP-U07 detailed mapping and future applicability registry; all owners is not an acceptable substitute.
5. A red mutation that changes an H/S status, removes an unmeasured row, or changes a listed SQL-M applicability without matching source evidence must fail the coverage gate.
