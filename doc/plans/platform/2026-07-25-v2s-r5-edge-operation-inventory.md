---
title: R5 edge operation inventory
status: PROPOSED_REVIEW_ONLY
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
reviewTarget: DESIGN
implementationAuthority: false
---

# R5 edge operation inventory

## 1. 分母与迁移规则

本清单是 R5 全范围 implementation-facing design 的 edge operation 分母，不是已创建
OpenAPI。all-v2 现存 105 项先作为候选，经
`doc/plans/platform/2026-07-25-v2s-r5-edge-contract-dialectical-assessment.md`
逐组辩证评估后，删除 2 项重复/未消费 operation，新增 1 项 G-07 要求的 platform revoke，
最终分母为 **104 项**。

本文件冻结 operationId/method/path/face；逐项 `Scenario/owner/page/security/query/request/
response/status/idempotency/CAS/error/test` 与 DTO 字段闭包冻结于
`doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`。两者必须
104/104 对账；开发 agent 不得只读本表后自行设计 wire。

- `platform-admin=38`、`operations-admin=55`、`public=11`；
- R3 已实现的 `listPlatformGroupWorkspaces`、`getPlatformGroupWorkspaceDetail`、
  `initializeCommercialGroup` 原位保留并按 R5 契约惯例校正，不生成同义 endpoint；
- 所有外部 `workspaceKey` 改为 `groupWorkspaceKey`，不保留 alias 或双形状；
- `/api/platform/workspaces/**` 与 `/api/operations/workspaces/**` 分别改为
  `/api/platform/group-workspaces/**` 与 `/api/operations/group-workspaces/**`；
- 简单 lifecycle 使用 `POST .../status`；具名业务命令保留具名路径；
- 每项在正式 OpenAPI 中必须声明非空闭集 `x-consumer-faces`；治理允许有理由的 multi-face，
  当前 104 项经任务分析均收敛为一个明确 face；
- 写命令统一使用 `Idempotency-Key` header；聚合 CAS 统一 `expectedVersion`；
- operationId 保持 v2 已有语义，只有 R3 已冻结的两个名称替换和一项新增撤销命令。

## 2. 逐项清单

| operationId | method / path | consumer face |
| --- | --- | --- |
| `getPlatformContractOverviewPage` | GET `/api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview` | `platform-admin` |
| `getPlatformContractOverviewDetail` | GET `/api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview/{contractId}` | `platform-admin` |
| `getOperationsWorkspaceLoginEntry` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/login-entry` | `operations-admin` |
| `operationsWorkspacePasswordLogin` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/password-login` | `operations-admin` |
| `sendOperationsWorkspaceOtp` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/otp/send` | `operations-admin` |
| `verifyOperationsWorkspaceOtp` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/otp/verify` | `operations-admin` |
| `getOperationsWorkspaceSessionEntry` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/session/entry` | `operations-admin` |
| `selectOperationsWorkspaceSessionContext` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/session/context` | `operations-admin` |
| `changeCurrentWorkspacePassword` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/session/password` | `operations-admin` |
| `selectOperationsWorkspaceSessionDataNode` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/session/data-node` | `operations-admin` |
| `operationsWorkspaceLogout` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/logout` | `operations-admin` |
| `getPlatformGroupWorkspaceDetail` | GET `/api/platform/group-workspaces/{groupWorkspaceKey}` | `platform-admin` |
| `transitionPlatformGroupWorkspaceStatus` | POST `/api/platform/group-workspaces/{groupWorkspaceKey}/status` | `platform-admin` |
| `updatePlatformGroupWorkspaceDisplay` | PATCH `/api/platform/group-workspaces/{groupWorkspaceKey}` | `platform-admin` |
| `getPlatformOrganizationOverviewPage` | GET `/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview` | `platform-admin` |
| `getPlatformOrganizationOverviewDetail` | GET `/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/{category}/{itemId}` | `platform-admin` |
| `initializeCommercialGroup` | POST `/api/platform/group-workspaces/{groupWorkspaceKey}/commercial-group` | `platform-admin` |
| `getWorkspaceRoles` | GET `/api/platform/group-workspaces/{groupWorkspaceKey}/roles` | `platform-admin` |
| `createWorkspaceRole` | POST `/api/platform/group-workspaces/{groupWorkspaceKey}/roles` | `platform-admin` |
| `updateWorkspaceRole` | PATCH `/api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}` | `platform-admin` |
| `transitionWorkspaceRoleStatus` | POST `/api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}/status` | `platform-admin` |
| `getWorkspaceAccounts` | GET `/api/platform/group-workspaces/{groupWorkspaceKey}/accounts` | `platform-admin` |
| `getWorkspaceAccount` | GET `/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}` | `platform-admin` |
| `transitionWorkspaceAccountStatus` | POST `/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/status` | `platform-admin` |
| `requestWorkspaceCredentialReset` | POST `/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/credential-reset` | `platform-admin` |
| `revokePlatformWorkspaceAssignment` | POST `/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/assignments/{assignmentId}/revoke` | `platform-admin` |
| `getWorkspaceInvitations` | GET `/api/platform/group-workspaces/{groupWorkspaceKey}/invitations` | `platform-admin` |
| `createWorkspaceInvitation` | POST `/api/platform/group-workspaces/{groupWorkspaceKey}/invitations` | `platform-admin` |
| `getWorkspaceInvitationCandidates` | GET `/api/platform/group-workspaces/{groupWorkspaceKey}/invitation-candidates` | `platform-admin` |
| `cancelWorkspaceInvitation` | POST `/api/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}/cancel` | `platform-admin` |
| `reissueWorkspaceInvitation` | POST `/api/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}/reissue` | `platform-admin` |
| `getExtensionEntityCatalog` | GET `/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions` | `platform-admin` |
| `getExtensionDefinition` | GET `/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions/{entityType}` | `platform-admin` |
| `replaceExtensionDefinition` | PUT `/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions/{entityType}` | `platform-admin` |
| `platformPasswordLogin` | POST `/api/platform/auth/password-login` | `platform-admin` |
| `getCurrentPlatformSession` | GET `/api/platform/auth/session` | `platform-admin` |
| `changeCurrentPlatformPassword` | POST `/api/platform/auth/password` | `platform-admin` |
| `platformLogout` | POST `/api/platform/auth/logout` | `platform-admin` |
| `listPlatformGroupWorkspaces` | GET `/api/platform/group-workspaces` | `platform-admin` |
| `createPlatformGroupWorkspace` | POST `/api/platform/group-workspaces` | `platform-admin` |
| `stagePlatformAsset` | POST `/api/platform/assets/staging` | `platform-admin` |
| `getPublicAssetContent` | GET `/api/public/assets/{assetRef}/content` | `public` |
| `getPlatformAdminPage` | GET `/api/platform/admin-users` | `platform-admin` |
| `createPlatformAdmin` | POST `/api/platform/admin-users` | `platform-admin` |
| `getPlatformAdminDetail` | GET `/api/platform/admin-users/{platformAdminId}` | `platform-admin` |
| `updatePlatformAdminProfile` | PATCH `/api/platform/admin-users/{platformAdminId}/profile` | `platform-admin` |
| `transitionPlatformAdminStatus` | POST `/api/platform/admin-users/{platformAdminId}/status` | `platform-admin` |
| `resetPlatformAdminCredential` | POST `/api/platform/admin-users/{platformAdminId}/credential-reset` | `platform-admin` |
| `getOperationsOrganizationBrands` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands` | `operations-admin` |
| `createOperationsOrganizationBrand` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands` | `operations-admin` |
| `getOperationsOrganizationBrand` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId}` | `operations-admin` |
| `updateOperationsOrganizationBrand` | PATCH `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId}` | `operations-admin` |
| `transitionOperationsOrganizationBrandStatus` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId}/status` | `operations-admin` |
| `getOperationsOrganizationTenants` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants` | `operations-admin` |
| `createOperationsOrganizationTenant` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants` | `operations-admin` |
| `getOperationsOrganizationTenant` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants/{tenantId}` | `operations-admin` |
| `updateOperationsOrganizationTenant` | PATCH `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants/{tenantId}` | `operations-admin` |
| `transitionOperationsOrganizationTenantStatus` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants/{tenantId}/status` | `operations-admin` |
| `getOperationsOrganizationHeadCompanies` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies` | `operations-admin` |
| `createOperationsOrganizationHeadCompany` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies` | `operations-admin` |
| `getOperationsOrganizationHeadCompany` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}` | `operations-admin` |
| `updateOperationsOrganizationHeadCompany` | PATCH `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}` | `operations-admin` |
| `transitionOperationsOrganizationHeadCompanyStatus` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/status` | `operations-admin` |
| `replaceOperationsOrganizationHeadCompanyBrandAuthorizations` | PUT `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations` | `operations-admin` |
| `getOperationsOrganizationBusinessEntityExtensionDefinition` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/business-entities/extension-definition` | `operations-admin` |
| `getOperationsWorkspaceInvitations` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/invitations` | `operations-admin` |
| `createOperationsWorkspaceInvitation` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/invitations` | `operations-admin` |
| `getOperationsWorkspaceInvitationCandidates` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/invitations/candidates` | `operations-admin` |
| `cancelOperationsWorkspaceInvitation` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}/cancel` | `operations-admin` |
| `reissueOperationsWorkspaceInvitation` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}/reissue` | `operations-admin` |
| `getOperationsOrganizationHierarchy` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy` | `operations-admin` |
| `getOperationsWorkspaceMembership` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/membership` | `operations-admin` |
| `getOperationsWorkspaceMembershipAccount` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/membership/accounts/{accountId}` | `operations-admin` |
| `revokeOperationsWorkspaceMembershipAssignment` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/membership/assignments/{assignmentId}/revoke` | `operations-admin` |
| `createOperationsOrganizationRegion` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/regions` | `operations-admin` |
| `createOperationsOrganizationProject` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/regions/{regionId}/projects` | `operations-admin` |
| `updateOperationsOrganizationNode` | PATCH `/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/{nodeId}` | `operations-admin` |
| `transitionOperationsOrganizationNodeStatus` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/{nodeId}/status` | `operations-admin` |
| `getOperationsOrganizationStores` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores` | `operations-admin` |
| `createOperationsOrganizationStore` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores` | `operations-admin` |
| `getOperationsOrganizationStoreCandidates` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/candidates` | `operations-admin` |
| `getOperationsOrganizationStoreExtensionDefinition` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/extension-definition` | `operations-admin` |
| `getOperationsOrganizationStore` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}` | `operations-admin` |
| `updateOperationsOrganizationStore` | PATCH `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}` | `operations-admin` |
| `transitionOperationsOrganizationStoreStatus` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}/status` | `operations-admin` |
| `getOperationsStoreProfile` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/store/profile` | `operations-admin` |
| `getOperationsContracts` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/contracts` | `operations-admin` |
| `createOperationsContract` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/contracts` | `operations-admin` |
| `getOperationsContractExtensionDefinition` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/extension-definition` | `operations-admin` |
| `getOperationsContractCandidates` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/candidates` | `operations-admin` |
| `getOperationsFixedStoreContracts` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/store/profile/contracts` | `operations-admin` |
| `getOperationsContract` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId}` | `operations-admin` |
| `updateOperationsContract` | PATCH `/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId}` | `operations-admin` |
| `invalidateOperationsContract` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId}/invalidate` | `operations-admin` |
| `getPublicInvitationView` | GET `/api/public/invitations/{groupWorkspaceKey}/{invitationToken}` | `public` |
| `acceptPublicInvitation` | POST `/api/public/invitations/{groupWorkspaceKey}/{invitationToken}` | `public` |
| `sendPublicInvitationOtp` | POST `/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/send` | `public` |
| `verifyPublicInvitationOtp` | POST `/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/verify` | `public` |
| `savePublicInvitationCredentials` | POST `/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/credentials` | `public` |
| `completePublicInvitation` | POST `/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/complete` | `public` |
| `getPublicInvitationCompletion` | GET `/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/completion` | `public` |
| `sendWorkspacePasswordResetOtp` | POST `/api/public/password-reset/{resetGenerationKey}/otp/send` | `public` |
| `verifyWorkspacePasswordResetOtp` | POST `/api/public/password-reset/{resetGenerationKey}/otp/verify` | `public` |
| `completeWorkspacePasswordReset` | POST `/api/public/password-reset/{resetGenerationKey}/complete` | `public` |

## 3. 关键差异 disposition

| 差异 | 处置 |
| --- | --- |
| all-v2 `getPlatformGroupWorkspacePage` | 用 R3 已冻结的 `listPlatformGroupWorkspaces` 替换；不保留两个列表 operation |
| all-v2 `initializePlatformCommercialGroupRoot` | 用 R3 已冻结的 `initializeCommercialGroup` 替换 |
| all-v2 platform workspace status POST 到资源根 | 改为 `/status` |
| platform account 任职撤销缺口 | 新增 `revokePlatformWorkspaceAssignment`；新增任职仍只能经邀请 |
| `getWorkspaceRoleCandidates` | 不搬；真实 role page 未消费，catalog 已由 role list read model 提供 |
| `checkOperationsPageEntryGuard` | 不搬；真实前端未消费，session navigation 负责 UX，每个 task endpoint 负责最终授权 |
| asset content | 改成 PUBLIC content route；stage 保持 platform-only |
| contract 挂在 organization path | 移到 workspace-scoped `/contracts`，owner 边界不再被旧服务路径误导 |
| `workspaceKey` | 全量改 `groupWorkspaceKey`，无兼容 alias |
| `itemCodes[]` | contract wire 改为 `{code,name}[]` |
| `logoBindGrant` | 删除；asset claim 与 workspace command 在本地同事务完成 |
| operations session/context | command readback 是完整 owner fact；删除 mutation 后补 `refetch()` |
| candidates/overview | 按独立用户任务提供单次组合查询；不让前端跨 owner 扇出拼装 |
| 五类首页 | 不增加 operation；沿用 v2 route/bootstrap 与 shell navigation |

## 4. 实施期闭合

正式实施时必须由同一 OpenAPI 生成 server interface、route-face registry 和两个 app 各自的
operation 可达闭包，并由 R4 既有 contract/face/generated gate 对账。任何 operation 缺失、
额外、face 错配、不可达 schema、手写 generated wire 或两个 app 共享 generated slice 均失败。
