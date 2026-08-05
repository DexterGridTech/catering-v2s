// Generated from accepted R5 edge catalog; do not edit.

export const OPERATIONS_ADMIN_OPERATIONS = [
  {
    "operationId": "addOperationsOrganizationHeadCompanyBrandAuthorization",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "cancelOperationsWorkspaceGroupInvitation",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations/{invitationId}/cancel",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "cancelOperationsWorkspaceHeadCompanyInvitation",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations/{invitationId}/cancel",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "cancelOperationsWorkspaceProjectInvitation",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations/{invitationId}/cancel",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "cancelOperationsWorkspaceRegionInvitation",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations/{invitationId}/cancel",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "cancelOperationsWorkspaceStoreInvitation",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations/{invitationId}/cancel",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "changeCurrentWorkspacePassword",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/session/password",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "createOperationsContract",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts",
    "owner": "contract",
    "requiresSession": true
  },
  {
    "operationId": "createOperationsOrganizationBrand",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "createOperationsOrganizationHeadCompany",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "createOperationsOrganizationProject",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/regions/{regionId}/projects",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "createOperationsOrganizationRegion",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/regions",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "createOperationsOrganizationStore",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "createOperationsOrganizationTenant",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "createOperationsWorkspaceGroupInvitation",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "createOperationsWorkspaceHeadCompanyInvitation",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "createOperationsWorkspaceProjectInvitation",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "createOperationsWorkspaceRegionInvitation",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "createOperationsWorkspaceStoreInvitation",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsContract",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId}",
    "owner": "contract",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsContractCandidates",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/candidates",
    "owner": "contract",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsContractExtensionDefinition",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/extension-definition",
    "owner": "contract",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsContracts",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts",
    "owner": "contract",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsEntityAuditHistory",
    "method": "GET",
    "path": "/api/operations/audit-history",
    "owner": "platform-workspace",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsFixedStoreContracts",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/store/profile/contracts",
    "owner": "contract",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsOrganizationBrand",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId}",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsOrganizationBrands",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsOrganizationBusinessEntityExtensionDefinition",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/business-entities/extension-definition",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsOrganizationCandidates",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/candidates",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsOrganizationHeadCompanies",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsOrganizationHeadCompany",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsOrganizationHierarchy",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsOrganizationHierarchyExtensionDefinition",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/hierarchy/extension-definition",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsOrganizationStore",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsOrganizationStoreCandidates",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/candidates",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsOrganizationStoreExtensionDefinition",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/extension-definition",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsOrganizationStores",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsOrganizationTenant",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants/{tenantId}",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsOrganizationTenants",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsStoreProfile",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/store/profile",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceGroupInvitationCandidates",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations/candidates",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceGroupInvitations",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceGroupUser",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/user",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceGroupUserAccount",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/user/accounts/{accountId}",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceHeadCompanyInvitationCandidates",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations/candidates",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceHeadCompanyInvitations",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceHeadCompanyUser",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/user",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceHeadCompanyUserAccount",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/user/accounts/{accountId}",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceLoginEntry",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/login-entry",
    "owner": "workspace-iam",
    "requiresSession": false
  },
  {
    "operationId": "getOperationsWorkspaceProjectInvitationCandidates",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations/candidates",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceProjectInvitations",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceProjectUser",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/user",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceProjectUserAccount",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/user/accounts/{accountId}",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceRegionInvitationCandidates",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations/candidates",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceRegionInvitations",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceRegionUser",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/user",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceRegionUserAccount",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/user/accounts/{accountId}",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceSessionEntry",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/session/entry",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceStoreInvitationCandidates",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations/candidates",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceStoreInvitations",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceStoreUser",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/user",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsWorkspaceStoreUserAccount",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/user/accounts/{accountId}",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "invalidateOperationsContract",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId}/invalidate",
    "owner": "contract",
    "requiresSession": true
  },
  {
    "operationId": "operationsWorkspaceLogout",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/logout",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "operationsWorkspacePasswordLogin",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/password-login",
    "owner": "workspace-iam",
    "requiresSession": false
  },
  {
    "operationId": "reissueOperationsWorkspaceGroupInvitation",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations/{invitationId}/reissue",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "reissueOperationsWorkspaceHeadCompanyInvitation",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations/{invitationId}/reissue",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "reissueOperationsWorkspaceProjectInvitation",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations/{invitationId}/reissue",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "reissueOperationsWorkspaceRegionInvitation",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations/{invitationId}/reissue",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "reissueOperationsWorkspaceStoreInvitation",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations/{invitationId}/reissue",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "removeOperationsOrganizationHeadCompanyBrandAuthorization",
    "method": "DELETE",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations/{brandId}",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "revokeOperationsWorkspaceGroupUserAssignment",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/user/assignments/{assignmentId}/revoke",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "revokeOperationsWorkspaceHeadCompanyUserAssignment",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/user/assignments/{assignmentId}/revoke",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "revokeOperationsWorkspaceProjectUserAssignment",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/user/assignments/{assignmentId}/revoke",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "revokeOperationsWorkspaceRegionUserAssignment",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/user/assignments/{assignmentId}/revoke",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "revokeOperationsWorkspaceStoreUserAssignment",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/user/assignments/{assignmentId}/revoke",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "selectOperationsWorkspaceSessionContext",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/session/context",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "selectOperationsWorkspaceSessionDataNode",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/session/data-node",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "sendOperationsWorkspaceOtp",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/otp/send",
    "owner": "workspace-iam",
    "requiresSession": false
  },
  {
    "operationId": "transitionOperationsOrganizationBrandStatus",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId}/status",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "transitionOperationsOrganizationHeadCompanyStatus",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/status",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "transitionOperationsOrganizationNodeStatus",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/{nodeId}/status",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "transitionOperationsOrganizationStoreStatus",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}/status",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "transitionOperationsOrganizationTenantStatus",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants/{tenantId}/status",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "updateOperationsCommercialGroup",
    "method": "PATCH",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/commercial-group",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "updateOperationsContract",
    "method": "PATCH",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId}",
    "owner": "contract",
    "requiresSession": true
  },
  {
    "operationId": "updateOperationsOrganizationBrand",
    "method": "PATCH",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId}",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "updateOperationsOrganizationHeadCompany",
    "method": "PATCH",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "updateOperationsOrganizationNode",
    "method": "PATCH",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/{nodeId}",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "updateOperationsOrganizationStore",
    "method": "PATCH",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "updateOperationsOrganizationTenant",
    "method": "PATCH",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants/{tenantId}",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "verifyOperationsWorkspaceOtp",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/otp/verify",
    "owner": "workspace-iam",
    "requiresSession": false
  }
] as const;

export const OPERATIONS_ADMIN_OPERATION_IDS = {
  "addOperationsOrganizationHeadCompanyBrandAuthorization": "addOperationsOrganizationHeadCompanyBrandAuthorization",
  "cancelOperationsWorkspaceGroupInvitation": "cancelOperationsWorkspaceGroupInvitation",
  "cancelOperationsWorkspaceHeadCompanyInvitation": "cancelOperationsWorkspaceHeadCompanyInvitation",
  "cancelOperationsWorkspaceProjectInvitation": "cancelOperationsWorkspaceProjectInvitation",
  "cancelOperationsWorkspaceRegionInvitation": "cancelOperationsWorkspaceRegionInvitation",
  "cancelOperationsWorkspaceStoreInvitation": "cancelOperationsWorkspaceStoreInvitation",
  "changeCurrentWorkspacePassword": "changeCurrentWorkspacePassword",
  "createOperationsContract": "createOperationsContract",
  "createOperationsOrganizationBrand": "createOperationsOrganizationBrand",
  "createOperationsOrganizationHeadCompany": "createOperationsOrganizationHeadCompany",
  "createOperationsOrganizationProject": "createOperationsOrganizationProject",
  "createOperationsOrganizationRegion": "createOperationsOrganizationRegion",
  "createOperationsOrganizationStore": "createOperationsOrganizationStore",
  "createOperationsOrganizationTenant": "createOperationsOrganizationTenant",
  "createOperationsWorkspaceGroupInvitation": "createOperationsWorkspaceGroupInvitation",
  "createOperationsWorkspaceHeadCompanyInvitation": "createOperationsWorkspaceHeadCompanyInvitation",
  "createOperationsWorkspaceProjectInvitation": "createOperationsWorkspaceProjectInvitation",
  "createOperationsWorkspaceRegionInvitation": "createOperationsWorkspaceRegionInvitation",
  "createOperationsWorkspaceStoreInvitation": "createOperationsWorkspaceStoreInvitation",
  "getOperationsContract": "getOperationsContract",
  "getOperationsContractCandidates": "getOperationsContractCandidates",
  "getOperationsContractExtensionDefinition": "getOperationsContractExtensionDefinition",
  "getOperationsContracts": "getOperationsContracts",
  "getOperationsEntityAuditHistory": "getOperationsEntityAuditHistory",
  "getOperationsFixedStoreContracts": "getOperationsFixedStoreContracts",
  "getOperationsOrganizationBrand": "getOperationsOrganizationBrand",
  "getOperationsOrganizationBrands": "getOperationsOrganizationBrands",
  "getOperationsOrganizationBusinessEntityExtensionDefinition": "getOperationsOrganizationBusinessEntityExtensionDefinition",
  "getOperationsOrganizationCandidates": "getOperationsOrganizationCandidates",
  "getOperationsOrganizationHeadCompanies": "getOperationsOrganizationHeadCompanies",
  "getOperationsOrganizationHeadCompany": "getOperationsOrganizationHeadCompany",
  "getOperationsOrganizationHierarchy": "getOperationsOrganizationHierarchy",
  "getOperationsOrganizationHierarchyExtensionDefinition": "getOperationsOrganizationHierarchyExtensionDefinition",
  "getOperationsOrganizationStore": "getOperationsOrganizationStore",
  "getOperationsOrganizationStoreCandidates": "getOperationsOrganizationStoreCandidates",
  "getOperationsOrganizationStoreExtensionDefinition": "getOperationsOrganizationStoreExtensionDefinition",
  "getOperationsOrganizationStores": "getOperationsOrganizationStores",
  "getOperationsOrganizationTenant": "getOperationsOrganizationTenant",
  "getOperationsOrganizationTenants": "getOperationsOrganizationTenants",
  "getOperationsStoreProfile": "getOperationsStoreProfile",
  "getOperationsWorkspaceGroupInvitationCandidates": "getOperationsWorkspaceGroupInvitationCandidates",
  "getOperationsWorkspaceGroupInvitations": "getOperationsWorkspaceGroupInvitations",
  "getOperationsWorkspaceGroupUser": "getOperationsWorkspaceGroupUser",
  "getOperationsWorkspaceGroupUserAccount": "getOperationsWorkspaceGroupUserAccount",
  "getOperationsWorkspaceHeadCompanyInvitationCandidates": "getOperationsWorkspaceHeadCompanyInvitationCandidates",
  "getOperationsWorkspaceHeadCompanyInvitations": "getOperationsWorkspaceHeadCompanyInvitations",
  "getOperationsWorkspaceHeadCompanyUser": "getOperationsWorkspaceHeadCompanyUser",
  "getOperationsWorkspaceHeadCompanyUserAccount": "getOperationsWorkspaceHeadCompanyUserAccount",
  "getOperationsWorkspaceLoginEntry": "getOperationsWorkspaceLoginEntry",
  "getOperationsWorkspaceProjectInvitationCandidates": "getOperationsWorkspaceProjectInvitationCandidates",
  "getOperationsWorkspaceProjectInvitations": "getOperationsWorkspaceProjectInvitations",
  "getOperationsWorkspaceProjectUser": "getOperationsWorkspaceProjectUser",
  "getOperationsWorkspaceProjectUserAccount": "getOperationsWorkspaceProjectUserAccount",
  "getOperationsWorkspaceRegionInvitationCandidates": "getOperationsWorkspaceRegionInvitationCandidates",
  "getOperationsWorkspaceRegionInvitations": "getOperationsWorkspaceRegionInvitations",
  "getOperationsWorkspaceRegionUser": "getOperationsWorkspaceRegionUser",
  "getOperationsWorkspaceRegionUserAccount": "getOperationsWorkspaceRegionUserAccount",
  "getOperationsWorkspaceSessionEntry": "getOperationsWorkspaceSessionEntry",
  "getOperationsWorkspaceStoreInvitationCandidates": "getOperationsWorkspaceStoreInvitationCandidates",
  "getOperationsWorkspaceStoreInvitations": "getOperationsWorkspaceStoreInvitations",
  "getOperationsWorkspaceStoreUser": "getOperationsWorkspaceStoreUser",
  "getOperationsWorkspaceStoreUserAccount": "getOperationsWorkspaceStoreUserAccount",
  "invalidateOperationsContract": "invalidateOperationsContract",
  "operationsWorkspaceLogout": "operationsWorkspaceLogout",
  "operationsWorkspacePasswordLogin": "operationsWorkspacePasswordLogin",
  "reissueOperationsWorkspaceGroupInvitation": "reissueOperationsWorkspaceGroupInvitation",
  "reissueOperationsWorkspaceHeadCompanyInvitation": "reissueOperationsWorkspaceHeadCompanyInvitation",
  "reissueOperationsWorkspaceProjectInvitation": "reissueOperationsWorkspaceProjectInvitation",
  "reissueOperationsWorkspaceRegionInvitation": "reissueOperationsWorkspaceRegionInvitation",
  "reissueOperationsWorkspaceStoreInvitation": "reissueOperationsWorkspaceStoreInvitation",
  "removeOperationsOrganizationHeadCompanyBrandAuthorization": "removeOperationsOrganizationHeadCompanyBrandAuthorization",
  "revokeOperationsWorkspaceGroupUserAssignment": "revokeOperationsWorkspaceGroupUserAssignment",
  "revokeOperationsWorkspaceHeadCompanyUserAssignment": "revokeOperationsWorkspaceHeadCompanyUserAssignment",
  "revokeOperationsWorkspaceProjectUserAssignment": "revokeOperationsWorkspaceProjectUserAssignment",
  "revokeOperationsWorkspaceRegionUserAssignment": "revokeOperationsWorkspaceRegionUserAssignment",
  "revokeOperationsWorkspaceStoreUserAssignment": "revokeOperationsWorkspaceStoreUserAssignment",
  "selectOperationsWorkspaceSessionContext": "selectOperationsWorkspaceSessionContext",
  "selectOperationsWorkspaceSessionDataNode": "selectOperationsWorkspaceSessionDataNode",
  "sendOperationsWorkspaceOtp": "sendOperationsWorkspaceOtp",
  "transitionOperationsOrganizationBrandStatus": "transitionOperationsOrganizationBrandStatus",
  "transitionOperationsOrganizationHeadCompanyStatus": "transitionOperationsOrganizationHeadCompanyStatus",
  "transitionOperationsOrganizationNodeStatus": "transitionOperationsOrganizationNodeStatus",
  "transitionOperationsOrganizationStoreStatus": "transitionOperationsOrganizationStoreStatus",
  "transitionOperationsOrganizationTenantStatus": "transitionOperationsOrganizationTenantStatus",
  "updateOperationsCommercialGroup": "updateOperationsCommercialGroup",
  "updateOperationsContract": "updateOperationsContract",
  "updateOperationsOrganizationBrand": "updateOperationsOrganizationBrand",
  "updateOperationsOrganizationHeadCompany": "updateOperationsOrganizationHeadCompany",
  "updateOperationsOrganizationNode": "updateOperationsOrganizationNode",
  "updateOperationsOrganizationStore": "updateOperationsOrganizationStore",
  "updateOperationsOrganizationTenant": "updateOperationsOrganizationTenant",
  "verifyOperationsWorkspaceOtp": "verifyOperationsWorkspaceOtp"
} as const;

export const EDGE_PROBLEM_CODES = [
  "CONTRACT_ALREADY_INVALID",
  "CONTRACT_DATE_RANGE_INVALID",
  "CONTRACT_ITEM_CODE_DUPLICATE",
  "CONTRACT_ITEM_CODE_REQUIRED",
  "CONTRACT_NUMBER_CONFLICT",
  "CONTRACT_REFERENCE_UNRESOLVED",
  "CONTRACT_VERSION_CONFLICT",
  "ORGANIZATION_BUSINESS_ENTITY_CODE_CONFLICT",
  "ORGANIZATION_BUSINESS_ENTITY_NAME_CONFLICT",
  "ORGANIZATION_BUSINESS_ENTITY_REFERENCE_CONFLICT",
  "ORGANIZATION_BUSINESS_ENTITY_REFERENCE_UNRESOLVED",
  "ORGANIZATION_BUSINESS_ENTITY_STATUS_TRANSITION_INVALID",
  "ORGANIZATION_BUSINESS_ENTITY_VERSION_CONFLICT",
  "ORGANIZATION_COMMERCIAL_GROUP_NOT_INITIALIZED",
  "ORGANIZATION_COMMERCIAL_GROUP_REQUIRED",
  "ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_IN_USE",
  "ORGANIZATION_NODE_CODE_CONFLICT",
  "ORGANIZATION_NODE_NAME_CONFLICT",
  "ORGANIZATION_NODE_PARENT_INVALID",
  "ORGANIZATION_NODE_STATUS_TRANSITION_INVALID",
  "ORGANIZATION_NODE_VERSION_CONFLICT",
  "ORGANIZATION_STORE_CODE_CONFLICT",
  "ORGANIZATION_STORE_EXTENSION_VERSION_CONFLICT",
  "ORGANIZATION_STORE_FIXED_SCOPE_FORBIDDEN",
  "ORGANIZATION_STORE_HEAD_COMPANY_AUTHORIZATION_REQUIRED",
  "ORGANIZATION_STORE_NAME_CONFLICT",
  "ORGANIZATION_STORE_PROJECT_REQUIRED",
  "ORGANIZATION_STORE_RELATION_INVALID",
  "ORGANIZATION_STORE_RELATION_LOCKED",
  "ORGANIZATION_STORE_STATUS_TRANSITION_INVALID",
  "ORGANIZATION_STORE_VERSION_CONFLICT",
  "PLATFORM_COMMON_ACCESS_DENIED",
  "PLATFORM_COMMON_AUTHENTICATION_REQUIRED",
  "PLATFORM_COMMON_CONTEXT_STALE",
  "PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED",
  "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT",
  "PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION",
  "PLATFORM_COMMON_RESOURCE_NOT_FOUND",
  "PLATFORM_COMMON_RESULT_UNKNOWN",
  "PLATFORM_COMMON_VALIDATION_FAILED",
  "PLATFORM_COMMON_VERSION_CONFLICT",
  "WORKSPACE_IAM_ACCOUNT_DISABLED",
  "WORKSPACE_IAM_CREDENTIAL_LOCKED",
  "WORKSPACE_IAM_INVALID_CREDENTIALS",
  "WORKSPACE_IAM_OTP_EXPIRED",
  "WORKSPACE_IAM_OTP_INVALID",
  "WORKSPACE_IAM_PASSWORD_POLICY_FAILED",
  "WORKSPACE_IAM_RATE_LIMITED",
  "WORKSPACE_IAM_RESULT_UNKNOWN",
  "WORKSPACE_IAM_WORKSPACE_DISABLED",
  "WORKSPACE_IAM_WORKSPACE_NOT_FOUND"
] as const;
export type EdgeProblemCode = (typeof EDGE_PROBLEM_CODES)[number];
export type OperationsAdminOperationId = (typeof OPERATIONS_ADMIN_OPERATIONS)[number]["operationId"];

export type JsonValue = string | number | boolean | null | Array<JsonValue> | { [key: string]: JsonValue };

export type AuditChange = {
  fieldKey: string;
  beforeValue: string;
  afterValue: string;
};

export type AuditHistoryItem = {
  id: string;
  occurredAt: EpochMillis;
  actorDisplayName: string;
  actionSummary: string;
  action: string;
  target: AuditTarget;
  changes: Array<AuditChange>;
};

export type AuditHistoryPage = {
  items: Array<AuditHistoryItem>;
  page: number;
  pageSize: number;
  total: number;
};

export type AuditTarget = {
  entityType: string;
  entityId: string;
};

export type Brand = {
  id: string;
  groupWorkspaceKey: string;
  code: string;
  name: string;
  alias?: (string) | null;
  remark?: (string) | null;
  extensionValues: Record<string, JsonValue>;
  extensionRuleRevision: number;
  status: BusinessEntityStatus;
  revision: number;
  createdAt: number;
  updatedAt: number;
};

export type BrandCreateRequest = {
  code: string;
  name: string;
  alias?: (string) | null;
  remark?: (string) | null;
  extensionValues?: (Record<string, JsonValue>) | null;
  expectedExtensionRuleRevision?: (number) | null;
};

export type BrandPage = {
  metadata: {
  groupWorkspaceKey: string;
  page: number;
  pageSize: number;
  total: number;
  sort: BusinessEntitySortKey;
  direction: BusinessEntitySortDirection;
};
  items: Array<Brand>;
};

export type BrandUpdateRequest = (BrandCreateRequest) & ({
  expectedVersion: number;
});

export type BusinessEntitySortDirection = "ASC" | "DESC";

export type BusinessEntitySortKey = "NAME" | "CODE" | "UPDATED_AT";

export type BusinessEntityStatus = "ENABLED" | "DISABLED";

export type BusinessEntityStatusRequest = {
  targetStatus: BusinessEntityStatus;
  expectedVersion: number;
};

export type CommercialGroupRoot = {
  id: string;
  groupWorkspaceKey: string;
  groupCode: string;
  groupName: string;
  version: number;
  createdAt: EpochMillis;
  updatedAt: EpochMillis;
  extensionValues: Record<string, JsonValue>;
  extensionRuleRevision: number;
};

export type CommercialGroupUpdateRequest = {
  groupCode: string;
  groupName: string;
  extensionValues?: (Record<string, JsonValue>) | null;
  expectedVersion: number;
};

export type EpochMillis = number;

export type ExtensionDefinition = {
  groupWorkspaceKey: string;
  entityType: ExtensionEntityType;
  definitions: Array<{
  key: string;
  label: string;
  type: "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT";
  required: boolean;
  options: Array<string>;
  status?: "ENABLED" | "DISABLED";
  displayOrder?: number;
  displaySuffix?: string;
}>;
  revision: number;
  updatedAt: EpochMillis;
};

export type ExtensionEntityType = "BRAND" | "TENANT" | "HEAD_COMPANY" | "STORE" | "CONTRACT" | "COMMERCIAL_GROUP" | "REGION" | "PROJECT";

export type GroupWorkspaceStatus = "ENABLED" | "DISABLED";

export type HeadCompany = {
  id: string;
  groupWorkspaceKey: string;
  code: string;
  name: string;
  legalName: string;
  unifiedSocialCreditCode: string;
  remark?: (string) | null;
  authorizedBrands: Array<{
  id: string;
  code: string;
  name: string;
  status: BusinessEntityStatus;
}>;
  extensionValues: Record<string, JsonValue>;
  extensionRuleRevision: number;
  status: BusinessEntityStatus;
  revision: number;
  createdAt: number;
  updatedAt: number;
};

export type HeadCompanyBrandAuthorizationAddRequest = {
  brandId: string;
};

export type HeadCompanyCreateRequest = {
  code: string;
  name: string;
  legalName: string;
  unifiedSocialCreditCode: string;
  remark?: (string) | null;
  extensionValues?: (Record<string, JsonValue>) | null;
  expectedExtensionRuleRevision?: (number) | null;
};

export type HeadCompanyPage = {
  metadata: {
  groupWorkspaceKey: string;
  page: number;
  pageSize: number;
  total: number;
  sort: BusinessEntitySortKey;
  direction: BusinessEntitySortDirection;
};
  items: Array<HeadCompanySummary>;
};

export type HeadCompanySummary = {
  id: string;
  groupWorkspaceKey: string;
  code: string;
  name: string;
  legalName: string;
  unifiedSocialCreditCode: string;
  remark: (string) | null;
  status: BusinessEntityStatus;
  revision: number;
  createdAt: number;
  updatedAt: number;
};

export type HeadCompanyUpdateRequest = (HeadCompanyCreateRequest) & ({
  expectedVersion: number;
});

export type NoBody = Record<string, never>;

export type NoContent = null;

export type OrganizationCandidatePage = {
  metadata: OrganizationCandidatePageMetadata;
  items: Array<OrganizationCandidatePageItemsItem>;
};

export type OrganizationCandidatePageItemsItem = {
  id: string;
  code: string;
  name: string;
};

export type OrganizationCandidatePageMetadata = {
  subjectType: OrganizationCandidateQuerySubjectType;
  queryText: (string) | null;
  page: number;
  pageSize: number;
  total: number;
  selectedId: (string) | null;
};

export type OrganizationCandidateQuerySubjectType = "PROJECT" | "BRAND" | "TENANT" | "HEAD_COMPANY" | "STORE";

export type OrganizationHierarchySnapshot = {
  groupWorkspaceKey: string;
  commercialGroup: CommercialGroupRoot;
  items: Array<OrganizationNode>;
};

export type OrganizationNode = {
  id: string;
  groupWorkspaceKey: string;
  nodeType: "GROUP" | "REGION" | "PROJECT";
  parentId: (string) | null;
  code: string;
  name: string;
  notes?: (string) | null;
  status: "ENABLED" | "DISABLED";
  phases: Array<{
  name: string;
}>;
  revision: number;
  createdAt: number;
  updatedAt: number;
  extensionValues: Record<string, JsonValue>;
  extensionRuleRevision: number;
};

export type OrganizationNodeCreateRequest = {
  code: string;
  name: string;
  notes?: (string) | null;
  extensionValues?: (Record<string, JsonValue>) | null;
};

export type OrganizationNodeStatusTransitionRequest = {
  targetStatus: "ENABLED" | "DISABLED";
  expectedVersion: number;
};

export type OrganizationNodeUpdateRequest = {
  code: string;
  name: string;
  parentId: (string) | null;
  phases: Array<{
  name: string;
}>;
  notes?: (string) | null;
  expectedVersion: number;
  extensionValues?: (Record<string, JsonValue>) | null;
};

export type OrganizationProjectCreateRequest = (OrganizationNodeCreateRequest) & ({
  phases?: Array<{
  name: string;
}>;
});

export type OrganizationStore = {
  id: string;
  groupWorkspaceKey: string;
  code: string;
  name: string;
  project: {
  id: string;
  code: string;
  name: string;
  path?: (string) | null;
};
  brand: {
  id: string;
  code: string;
  name: string;
  path?: (string) | null;
};
  tenant: {
  id: string;
  code: string;
  name: string;
  path?: (string) | null;
};
  headCompany?: {
  id: string;
  code: string;
  name: string;
  path?: (string) | null;
};
  notes?: (string) | null;
  status: OrganizationStoreStatus;
  extensionValues: Record<string, JsonValue>;
  extensionRuleRevision: number;
  revision: number;
  createdAt: number;
  updatedAt: number;
  contractDerivedStatus: "OPERATING" | "PREPARING" | "NOT_OPERATING";
};

export type OrganizationStoreCandidatePage = {
  groupWorkspaceKey: string;
  dataScope: {
  nodeType: "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  nodeRef: string;
  nodeName: string;
};
  projects: Array<{
  id: string;
  code: string;
  name: string;
  path?: (string) | null;
}>;
  brands: Array<{
  id: string;
  code: string;
  name: string;
  path?: (string) | null;
}>;
  tenants: Array<{
  id: string;
  code: string;
  name: string;
  path?: (string) | null;
}>;
  headCompanies: Array<{
  id: string;
  code: string;
  name: string;
  path?: (string) | null;
}>;
};

export type OrganizationStoreCreateRequest = {
  brandId: string;
  tenantId: string;
  headCompanyId?: (string) | null;
  code: string;
  name: string;
  notes?: (string) | null;
  extensionValues?: Record<string, JsonValue>;
};

export type OrganizationStorePage = {
  metadata: {
  groupWorkspaceKey: string;
  dataScope: {
  nodeType: "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  nodeRef: string;
  nodeName: string;
};
  page: number;
  pageSize: number;
  total: number;
  sort: OrganizationStoreSortKey;
  direction: OrganizationStoreSortDirection;
};
  items: Array<OrganizationStore>;
};

export type OrganizationStoreSortDirection = "ASC" | "DESC";

export type OrganizationStoreSortKey = "NAME" | "CODE" | "UPDATED_AT";

export type OrganizationStoreStatus = "ENABLED" | "DISABLED";

export type OrganizationStoreStatusRequest = {
  targetStatus: OrganizationStoreStatus;
  expectedVersion: number;
};

export type OrganizationStoreUpdateRequest = {
  name: string;
  headCompanyId?: (string) | null;
  notes?: (string) | null;
  extensionValues: Record<string, JsonValue>;
  extensionRuleRevision: number;
  expectedVersion: number;
};

export type Problem = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: (string) | null;
  errorCode: EdgeProblemCode;
  correlationId: string;
};

export type ServiceNodeType = "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";

export type SortDirection = "ASC" | "DESC";

export type StoreContract = {
  id: string;
  groupWorkspaceKey: string;
  project: {
  id: string;
  code: string;
  name: string;
};
  store: {
  id: string;
  code: string;
  name: string;
};
  tenant: {
  id: string;
  code: string;
  name: string;
};
  phaseName: string;
  contractNo: string;
  effectiveFrom: string;
  effectiveTo: (string) | null;
  note?: (string) | null;
  extensionValues: Record<string, JsonValue>;
  extensionRuleRevision: number;
  status: StoreContractStatus;
  revision: number;
  source: "MANUAL";
  createdAt: number;
  updatedAt: number;
  items: Array<StoreContractItem>;
  phaseNameSnapshot?: (string) | null;
};

export type StoreContractCandidatePage = {
  groupWorkspaceKey: string;
  project: {
  id: string;
  code: string;
  name: string;
};
  metadata: {
  storeSearch: (string) | null;
  page: number;
  pageSize: number;
  total: number;
};
  stores: Array<StoreContractStoreCandidate>;
  phases: Array<string>;
  selectedStoreTenant?: ((StoreContractSelectedTenant)) | null;
};

export type StoreContractCreateRequest = {
  storeId: string;
  phaseName: string;
  contractNo: string;
  effectiveFrom: string;
  effectiveTo: (string) | null;
  note?: (string) | null;
  extensionValues?: (Record<string, JsonValue>) | null;
  expectedExtensionRuleRevision?: (number) | null;
  items: Array<StoreContractItem>;
  phaseNameSnapshot?: (string) | null;
};

export type StoreContractInvalidateRequest = {
  expectedVersion: number;
};

export type StoreContractItem = {
  code: string;
  name: string;
};

export type StoreContractPage = {
  metadata: {
  groupWorkspaceKey: string;
  projectRef: string;
  projectName: string;
  page: number;
  pageSize: number;
  total: number;
  sort: StoreContractSortKey;
  direction: StoreContractSortDirection;
};
  items: Array<StoreContract>;
};

export type StoreContractSelectedTenant = {
  id: string;
  code: string;
  name: string;
};

export type StoreContractSortDirection = "ASC" | "DESC";

export type StoreContractSortKey = "CONTRACT_NO" | "EFFECTIVE_FROM" | "UPDATED_AT";

export type StoreContractStatus = "VALID" | "INVALID";

export type StoreContractStoreCandidate = {
  id: string;
  code: string;
  name: string;
  storeStatus: "ENABLED" | "DISABLED";
};

export type StoreContractUpdateRequest = {
  phaseName: string;
  effectiveFrom: string;
  effectiveTo: (string) | null;
  note?: (string) | null;
  extensionValues?: (Record<string, JsonValue>) | null;
  expectedExtensionRuleRevision?: (number) | null;
  expectedVersion: number;
  items: Array<StoreContractItem>;
  phaseNameSnapshot?: (string) | null;
};

export type StoreContractViewState = "CURRENT" | "PENDING_EFFECTIVE" | "HISTORY" | "INVALID";

export type Tenant = {
  id: string;
  groupWorkspaceKey: string;
  code: string;
  name: string;
  legalName: string;
  unifiedSocialCreditCode: string;
  remark?: (string) | null;
  extensionValues: Record<string, JsonValue>;
  extensionRuleRevision: number;
  status: BusinessEntityStatus;
  revision: number;
  createdAt: number;
  updatedAt: number;
};

export type TenantCreateRequest = {
  code: string;
  name: string;
  legalName: string;
  unifiedSocialCreditCode: string;
  remark?: (string) | null;
  extensionValues?: (Record<string, JsonValue>) | null;
  expectedExtensionRuleRevision?: (number) | null;
};

export type TenantPage = {
  metadata: {
  groupWorkspaceKey: string;
  page: number;
  pageSize: number;
  total: number;
  sort: BusinessEntitySortKey;
  direction: BusinessEntitySortDirection;
};
  items: Array<Tenant>;
};

export type TenantUpdateRequest = (TenantCreateRequest) & ({
  expectedVersion: number;
});

export type WorkspaceAccountStatus = "ENABLED" | "DISABLED";

export type WorkspaceCurrentPasswordChangeRequest = {
  currentPassword: string;
  newPassword: string;
  expectedSessionVersion: number;
};

export type WorkspaceCurrentPasswordChangeResult = {
  status: "COMPLETED";
  sessionsRevoked: boolean;
  reauthenticationRequired: boolean;
};

export type WorkspaceInvitation = {
  id: string;
  groupWorkspaceKey: string;
  maskedMobile: string;
  targetOrganizationType: "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  targetOrganizationPath: string;
  roleNames: Array<string>;
  status: WorkspaceInvitationStatus;
  generation: number;
  expiresAt: EpochMillis;
  revision: number;
  createdAt: EpochMillis;
  consentedAt?: (EpochMillis) | null;
  completedAt?: (EpochMillis) | null;
  cancelledAt?: (EpochMillis) | null;
  invitationPageUrl: string;
};

export type WorkspaceInvitationCandidatePage = {
  organizations: Array<{
  serviceNodeType: "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  organizationRef: string;
  path: string;
}>;
  roles: Array<WorkspaceRole>;
  metadata: ({
  subjectType: string;
  queryText?: (string) | null;
  page: number;
  pageSize: number;
  total: number;
  selectedOrganizationRef?: (string) | null;
}) | null;
};

export type WorkspaceInvitationPage = {
  items: Array<WorkspaceInvitation>;
  page: number;
  pageSize: number;
  total: number;
  criteria: {
  mobile?: (string) | null;
  organizationQuery?: (string) | null;
  roleQuery?: (string) | null;
  status?: (WorkspaceInvitationStatus) | null;
  expiresFrom?: (EpochMillis) | null;
  expiresTo?: (EpochMillis) | null;
  sort: WorkspaceInvitationSortKey;
  direction: SortDirection;
};
};

export type WorkspaceInvitationSortKey = "CREATED_AT" | "EXPIRES_AT";

export type WorkspaceInvitationStatus = "ACTIVE" | "CANCELLED" | "EXPIRED" | "COMPLETED";

export type WorkspaceLoginEntry = {
  groupWorkspaceKey: string;
  workspaceName: string;
  operationsTitle: string;
  status: GroupWorkspaceStatus;
  sessionState: "NONE" | "AUTHENTICATED";
  logoUrl?: (string) | null;
};

export type WorkspaceOperationsInvitationActionRequest = {
  scopeRef?: (string) | null;
  expectedContextVersion: number;
  expectedVersion: number;
  idempotencyKey: string;
};

export type WorkspaceOperationsInvitationCreateRequest = {
  scopeRef?: (string) | null;
  mobile: string;
  roleIds: Array<string>;
  idempotencyKey: string;
};

export type WorkspaceOtpSendRequest = {
  mobile: string;
};

export type WorkspaceOtpSendResponse = {
  expiresAt: number;
  debugVerificationCode?: (string) | null;
};

export type WorkspaceOtpVerifyRequest = {
  mobile: string;
  code: string;
};

export type WorkspacePasswordLoginRequest = {
  loginName: string;
  password: string;
};

export type WorkspaceRole = {
  id: string;
  groupWorkspaceKey: string;
  name: string;
  description?: (string) | null;
  serviceNodeType: "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  capabilityKeys: Array<"BC-ORG-GROUP-EDIT" | "BC-ORG-GROUP-STATUS" | "BC-ORG-REGION-CREATE" | "BC-ORG-REGION-EDIT" | "BC-ORG-REGION-STATUS" | "BC-ORG-PROJECT-CREATE" | "BC-ORG-PROJECT-EDIT" | "BC-ORG-PROJECT-STATUS" | "BC-ORG-BRAND-CREATE" | "BC-ORG-BRAND-EDIT" | "BC-ORG-BRAND-STATUS" | "BC-ORG-TENANT-CREATE" | "BC-ORG-TENANT-EDIT" | "BC-ORG-TENANT-STATUS" | "BC-ORG-HEAD-COMPANY-CREATE" | "BC-ORG-HEAD-COMPANY-EDIT" | "BC-ORG-HEAD-COMPANY-STATUS" | "BC-ORG-HEAD-COMPANY-BRAND" | "BC-ORG-STORE-CREATE" | "BC-ORG-STORE-EDIT" | "BC-ORG-STORE-STATUS" | "BC-IAM-GROUP-ROLE-REVOKE" | "BC-IAM-REGION-ROLE-REVOKE" | "BC-IAM-PROJECT-ROLE-REVOKE" | "BC-IAM-HEAD-COMPANY-ROLE-REVOKE" | "BC-IAM-STORE-ROLE-REVOKE" | "BC-IAM-GROUP-INVITE" | "BC-IAM-REGION-INVITE" | "BC-IAM-PROJECT-INVITE" | "BC-IAM-HEAD-COMPANY-INVITE" | "BC-IAM-STORE-INVITE" | "BC-CONTRACT-CREATE" | "BC-CONTRACT-EDIT" | "BC-CONTRACT-INVALIDATE">;
  pageAccessKeys: Array<string>;
  status: WorkspaceRoleStatus;
  revision: number;
  createdAt: EpochMillis;
  updatedAt: EpochMillis;
};

export type WorkspaceRoleStatus = "ENABLED" | "DISABLED";

export type WorkspaceScopeContext = {
  region: (WorkspaceScopeNode) | null;
  project: (WorkspaceScopeNode) | null;
  store: (WorkspaceScopeNode) | null;
  headCompany: (WorkspaceScopeNode) | null;
};

export type WorkspaceScopeNode = {
  dataNodeType: "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  dataNodeRef: string;
  dataNodeName: string;
  dataNodeCode: string;
  ancestorPath: Array<string>;
  regionRef?: (string) | null;
  projectRef?: (string) | null;
  storeRef?: (string) | null;
  headCompanyRef?: (string) | null;
};

export type WorkspaceSelectContextRequest = {
  roleAssignmentRef: string;
  requiredContextVersion: number;
};

export type WorkspaceSelectDataNodeRequest = {
  dataNodeRef: string;
  dataNodeType: "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  requiredContextVersion: number;
};

export type WorkspaceSessionEntry = {
  groupWorkspaceKey: string;
  accountId: string;
  displayName: string;
  contextVersion: number;
  mode: "DIRECT" | "SELECT" | "EMPTY";
  outcome: "HOME" | "SELECT_IDENTITY" | "SELECT_SCOPE" | "EMPTY_WORKBENCH" | "PASSWORD_CHANGE_REQUIRED";
  candidates: Array<{
  roleAssignmentRef: string;
  roleId: string;
  roleName: string;
  roleNodeRef: string;
  roleNodeType: "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  roleNodeName: string;
  homePageDesignKey: string;
  pageDesignKeys: Array<string>;
  navigation: Array<{
  pageDesignKey: string;
  title: string;
  menuGroup: string;
  menuOrder: number;
  kind: "ROLE_HOME" | "BUSINESS";
  pageAccessManaged: boolean;
  requiredDataNodeType: "NONE" | "REGION" | "PROJECT" | "STORE" | "HEAD_COMPANY";
}>;
}>;
  actionGrants: Array<"BC-ORG-GROUP-EDIT" | "BC-ORG-GROUP-STATUS" | "BC-ORG-REGION-CREATE" | "BC-ORG-REGION-EDIT" | "BC-ORG-REGION-STATUS" | "BC-ORG-PROJECT-CREATE" | "BC-ORG-PROJECT-EDIT" | "BC-ORG-PROJECT-STATUS" | "BC-ORG-BRAND-CREATE" | "BC-ORG-BRAND-EDIT" | "BC-ORG-BRAND-STATUS" | "BC-ORG-TENANT-CREATE" | "BC-ORG-TENANT-EDIT" | "BC-ORG-TENANT-STATUS" | "BC-ORG-HEAD-COMPANY-CREATE" | "BC-ORG-HEAD-COMPANY-EDIT" | "BC-ORG-HEAD-COMPANY-STATUS" | "BC-ORG-HEAD-COMPANY-BRAND" | "BC-ORG-STORE-CREATE" | "BC-ORG-STORE-EDIT" | "BC-ORG-STORE-STATUS" | "BC-IAM-GROUP-ROLE-REVOKE" | "BC-IAM-REGION-ROLE-REVOKE" | "BC-IAM-PROJECT-ROLE-REVOKE" | "BC-IAM-HEAD-COMPANY-ROLE-REVOKE" | "BC-IAM-STORE-ROLE-REVOKE" | "BC-IAM-GROUP-INVITE" | "BC-IAM-REGION-INVITE" | "BC-IAM-PROJECT-INVITE" | "BC-IAM-HEAD-COMPANY-INVITE" | "BC-IAM-STORE-INVITE" | "BC-CONTRACT-CREATE" | "BC-CONTRACT-EDIT" | "BC-CONTRACT-INVALIDATE">;
  dataNodeCandidates?: Array<WorkspaceScopeNode>;
  selected?: ((({
  roleAssignmentRef: string;
  roleId: string;
  roleName: string;
  roleNodeRef: string;
  roleNodeType: "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  roleNodeName: string;
  homePageDesignKey: string;
  pageDesignKeys: Array<string>;
  navigation: Array<{
  pageDesignKey: string;
  title: string;
  menuGroup: string;
  menuOrder: number;
  kind: "ROLE_HOME" | "BUSINESS";
  pageAccessManaged: boolean;
  requiredDataNodeType: "NONE" | "REGION" | "PROJECT" | "STORE" | "HEAD_COMPANY";
}>;
}) & ({
  contextVersion: number;
}))) | null;
  scopeContext: (WorkspaceScopeContext) | null;
  workspaceName: string;
  operationsTitle: string;
  logoUrl: (string) | null;
};

export type WorkspaceUser = {
  accountId: string;
  displayName: string;
  maskedMobile: string;
  loginName: string;
  status: WorkspaceAccountStatus;
  credentialStatus: "SET" | "CHANGE_REQUIRED";
  activeAssignmentCount: number;
  lastLoginAt?: (EpochMillis) | null;
  createdAt: EpochMillis;
  assignments: Array<{
  id: string;
  accountId: string;
  roleId: string;
  roleName: string;
  serviceNodeType: ServiceNodeType;
  organizationPath: string;
  status: "ACTIVE" | "REVOKED";
  source: "INVITATION" | "ADMINISTRATION";
  revision: number;
  createdAt: EpochMillis;
  updatedAt: EpochMillis;
}>;
  invitationHistory: Array<{
  invitationId: string;
  status: WorkspaceInvitationStatus;
  generation: number;
  expiresAt: EpochMillis;
}>;
  revision: number;
};

export type WorkspaceUserPage = {
  items: Array<WorkspaceUser>;
  page: number;
  pageSize: number;
  total: number;
  targetOrganizationType: ServiceNodeType;
  scopeRef?: (string) | null;
  scopeName?: (string) | null;
  contextVersion: number;
  criteria: {
  sort: WorkspaceUserSortKey;
  direction: SortDirection;
};
};

export type WorkspaceUserRevokeRequest = {
  expectedVersion: number;
};

export type WorkspaceUserRevokeResult = {
  revokedAssignmentId: string;
  accountRetained: boolean;
  user: WorkspaceUser;
  contextVersion: number;
  sessionEntryRequired: boolean;
  sessionEntry?: (WorkspaceSessionEntry) | null;
};

export type WorkspaceUserSortKey = "DISPLAY_NAME" | "LOGIN_NAME";

export type FaceOperationContracts = {
  "addOperationsOrganizationHeadCompanyBrandAuthorization": {
    request: HeadCompanyBrandAuthorizationAddRequest;
    response: NoContent;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    headCompanyId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "cancelOperationsWorkspaceGroupInvitation": {
    request: WorkspaceOperationsInvitationActionRequest;
    response: WorkspaceInvitation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    invitationId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "cancelOperationsWorkspaceHeadCompanyInvitation": {
    request: WorkspaceOperationsInvitationActionRequest;
    response: WorkspaceInvitation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    invitationId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "cancelOperationsWorkspaceProjectInvitation": {
    request: WorkspaceOperationsInvitationActionRequest;
    response: WorkspaceInvitation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    invitationId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "cancelOperationsWorkspaceRegionInvitation": {
    request: WorkspaceOperationsInvitationActionRequest;
    response: WorkspaceInvitation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    invitationId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "cancelOperationsWorkspaceStoreInvitation": {
    request: WorkspaceOperationsInvitationActionRequest;
    response: WorkspaceInvitation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    invitationId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "changeCurrentWorkspacePassword": {
    request: WorkspaceCurrentPasswordChangeRequest;
    response: WorkspaceCurrentPasswordChangeResult;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createOperationsContract": {
    request: StoreContractCreateRequest;
    response: StoreContract;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createOperationsOrganizationBrand": {
    request: BrandCreateRequest;
    response: Brand;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createOperationsOrganizationHeadCompany": {
    request: HeadCompanyCreateRequest;
    response: HeadCompany;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createOperationsOrganizationProject": {
    request: OrganizationProjectCreateRequest;
    response: OrganizationNode;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    regionId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createOperationsOrganizationRegion": {
    request: OrganizationNodeCreateRequest;
    response: OrganizationNode;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createOperationsOrganizationStore": {
    request: OrganizationStoreCreateRequest;
    response: OrganizationStore;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createOperationsOrganizationTenant": {
    request: TenantCreateRequest;
    response: Tenant;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createOperationsWorkspaceGroupInvitation": {
    request: WorkspaceOperationsInvitationCreateRequest;
    response: WorkspaceInvitation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createOperationsWorkspaceHeadCompanyInvitation": {
    request: WorkspaceOperationsInvitationCreateRequest;
    response: WorkspaceInvitation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createOperationsWorkspaceProjectInvitation": {
    request: WorkspaceOperationsInvitationCreateRequest;
    response: WorkspaceInvitation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createOperationsWorkspaceRegionInvitation": {
    request: WorkspaceOperationsInvitationCreateRequest;
    response: WorkspaceInvitation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createOperationsWorkspaceStoreInvitation": {
    request: WorkspaceOperationsInvitationCreateRequest;
    response: WorkspaceInvitation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "getOperationsContract": {
    request: NoBody;
    response: StoreContract;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    contractId: string;
  };
    query: {
    expectedContextVersion: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsContractCandidates": {
    request: NoBody;
    response: StoreContractCandidatePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    expectedContextVersion: number;
    storeSearch?: string;
    selectedStoreId?: string;
    page?: number;
    pageSize?: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsContractExtensionDefinition": {
    request: NoBody;
    response: ExtensionDefinition;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    expectedContextVersion: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsContracts": {
    request: NoBody;
    response: StoreContractPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    expectedContextVersion: number;
    storeId?: string;
    contractNo?: string;
    phaseName?: string;
    tenantId?: string;
    itemCode?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: StoreContractStatus;
    sort?: StoreContractSortKey;
    direction?: StoreContractSortDirection;
    page?: number;
    pageSize?: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsEntityAuditHistory": {
    request: NoBody;
    response: AuditHistoryPage;
    requestRequired: false;
    requiresSession: true;
    path: Record<string, never>;
    query: {
    groupWorkspaceKey: string;
    entityType: "WORKSPACE_ACCOUNT" | "WORKSPACE_INVITATION" | "COMMERCIAL_GROUP" | "ORGANIZATION_NODE" | "BRAND" | "TENANT" | "HEAD_COMPANY" | "STORE" | "STORE_CONTRACT";
    entityId: string;
    page?: number;
    pageSize?: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsFixedStoreContracts": {
    request: NoBody;
    response: StoreContractPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    expectedContextVersion: number;
    state: StoreContractViewState;
    page?: number;
    pageSize?: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsOrganizationBrand": {
    request: NoBody;
    response: Brand;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    brandId: string;
  };
    query: {
    expectedContextVersion: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsOrganizationBrands": {
    request: NoBody;
    response: BrandPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    expectedContextVersion: number;
    queryText?: string;
    status?: BusinessEntityStatus;
    sort?: BusinessEntitySortKey;
    direction?: BusinessEntitySortDirection;
    page?: number;
    pageSize?: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsOrganizationBusinessEntityExtensionDefinition": {
    request: NoBody;
    response: ExtensionDefinition;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    expectedContextVersion: number;
    entityType: "BRAND" | "TENANT" | "HEAD_COMPANY";
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsOrganizationCandidates": {
    request: NoBody;
    response: OrganizationCandidatePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    expectedContextVersion: number;
    subjectType: OrganizationCandidateQuerySubjectType;
    candidateUsage?: "DEFAULT" | "CONTRACT_LIST";
    queryText?: string;
    page?: number;
    pageSize?: number;
    selectedId?: string;
    projectId?: string;
    brandId?: string;
    tenantId?: string;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsOrganizationHeadCompanies": {
    request: NoBody;
    response: HeadCompanyPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    expectedContextVersion: number;
    name?: string;
    code?: string;
    legalName?: string;
    unifiedSocialCreditCode?: string;
    brandId?: string;
    status?: BusinessEntityStatus;
    sort?: BusinessEntitySortKey;
    direction?: BusinessEntitySortDirection;
    page?: number;
    pageSize?: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsOrganizationHeadCompany": {
    request: NoBody;
    response: HeadCompany;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    headCompanyId: string;
  };
    query: {
    expectedContextVersion: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsOrganizationHierarchy": {
    request: NoBody;
    response: OrganizationHierarchySnapshot;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsOrganizationHierarchyExtensionDefinition": {
    request: NoBody;
    response: ExtensionDefinition;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    expectedContextVersion: number;
    entityType: "COMMERCIAL_GROUP" | "REGION" | "PROJECT";
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsOrganizationStore": {
    request: NoBody;
    response: OrganizationStore;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeId: string;
  };
    query: {
    expectedContextVersion: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsOrganizationStoreCandidates": {
    request: NoBody;
    response: OrganizationStoreCandidatePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    expectedContextVersion: number;
    brandId?: string;
    tenantId?: string;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsOrganizationStoreExtensionDefinition": {
    request: NoBody;
    response: ExtensionDefinition;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    expectedContextVersion: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsOrganizationStores": {
    request: NoBody;
    response: OrganizationStorePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    expectedContextVersion: number;
    name?: string;
    code?: string;
    status?: OrganizationStoreStatus;
    sort?: OrganizationStoreSortKey;
    direction?: OrganizationStoreSortDirection;
    page?: number;
    pageSize?: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsOrganizationTenant": {
    request: NoBody;
    response: Tenant;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    tenantId: string;
  };
    query: {
    expectedContextVersion: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsOrganizationTenants": {
    request: NoBody;
    response: TenantPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    expectedContextVersion: number;
    name?: string;
    code?: string;
    legalName?: string;
    unifiedSocialCreditCode?: string;
    status?: BusinessEntityStatus;
    sort?: BusinessEntitySortKey;
    direction?: BusinessEntitySortDirection;
    page?: number;
    pageSize?: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsStoreProfile": {
    request: NoBody;
    response: OrganizationStore;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    expectedContextVersion: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceGroupInvitationCandidates": {
    request: NoBody;
    response: WorkspaceInvitationCandidatePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    scopeRef?: string;
    subjectType: "ORGANIZATION" | "ROLE";
    candidateUsage: "INVITATION_TARGET" | "LIST_FILTER";
    queryText?: string;
    page?: number;
    pageSize?: number;
    selectedOrganizationRef?: string;
    expectedContextVersion: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceGroupInvitations": {
    request: NoBody;
    response: WorkspaceInvitationPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    scopeRef?: string;
    mobile?: string;
    organizationRef?: string;
    roleId?: string;
    status?: WorkspaceInvitationStatus;
    expiresFrom?: number;
    expiresTo?: number;
    page?: number;
    pageSize?: number;
    expectedContextVersion: number;
    sort?: WorkspaceInvitationSortKey;
    direction?: SortDirection;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceGroupUser": {
    request: NoBody;
    response: WorkspaceUserPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    scopeRef?: string;
    userName?: string;
    mobile?: string;
    roleId?: string;
    status?: WorkspaceAccountStatus;
    page?: number;
    pageSize?: number;
    expectedContextVersion: number;
    sort?: WorkspaceUserSortKey;
    direction?: SortDirection;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceGroupUserAccount": {
    request: NoBody;
    response: WorkspaceUser;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    accountId: string;
  };
    query: {
    expectedContextVersion: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceHeadCompanyInvitationCandidates": {
    request: NoBody;
    response: WorkspaceInvitationCandidatePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    scopeRef?: string;
    subjectType: "ORGANIZATION" | "ROLE";
    candidateUsage: "INVITATION_TARGET" | "LIST_FILTER";
    queryText?: string;
    page?: number;
    pageSize?: number;
    selectedOrganizationRef?: string;
    expectedContextVersion: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceHeadCompanyInvitations": {
    request: NoBody;
    response: WorkspaceInvitationPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    scopeRef?: string;
    mobile?: string;
    organizationRef?: string;
    roleId?: string;
    status?: WorkspaceInvitationStatus;
    expiresFrom?: number;
    expiresTo?: number;
    page?: number;
    pageSize?: number;
    expectedContextVersion: number;
    sort?: WorkspaceInvitationSortKey;
    direction?: SortDirection;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceHeadCompanyUser": {
    request: NoBody;
    response: WorkspaceUserPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    scopeRef?: string;
    userName?: string;
    mobile?: string;
    roleId?: string;
    status?: WorkspaceAccountStatus;
    page?: number;
    pageSize?: number;
    expectedContextVersion: number;
    sort?: WorkspaceUserSortKey;
    direction?: SortDirection;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceHeadCompanyUserAccount": {
    request: NoBody;
    response: WorkspaceUser;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    accountId: string;
  };
    query: {
    expectedContextVersion: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceLoginEntry": {
    request: NoBody;
    response: WorkspaceLoginEntry;
    requestRequired: false;
    requiresSession: false;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceProjectInvitationCandidates": {
    request: NoBody;
    response: WorkspaceInvitationCandidatePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    scopeRef?: string;
    subjectType: "ORGANIZATION" | "ROLE";
    candidateUsage: "INVITATION_TARGET" | "LIST_FILTER";
    queryText?: string;
    page?: number;
    pageSize?: number;
    selectedOrganizationRef?: string;
    expectedContextVersion: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceProjectInvitations": {
    request: NoBody;
    response: WorkspaceInvitationPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    scopeRef?: string;
    mobile?: string;
    organizationRef?: string;
    roleId?: string;
    status?: WorkspaceInvitationStatus;
    expiresFrom?: number;
    expiresTo?: number;
    page?: number;
    pageSize?: number;
    expectedContextVersion: number;
    sort?: WorkspaceInvitationSortKey;
    direction?: SortDirection;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceProjectUser": {
    request: NoBody;
    response: WorkspaceUserPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    scopeRef?: string;
    userName?: string;
    mobile?: string;
    roleId?: string;
    status?: WorkspaceAccountStatus;
    page?: number;
    pageSize?: number;
    expectedContextVersion: number;
    sort?: WorkspaceUserSortKey;
    direction?: SortDirection;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceProjectUserAccount": {
    request: NoBody;
    response: WorkspaceUser;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    accountId: string;
  };
    query: {
    expectedContextVersion: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceRegionInvitationCandidates": {
    request: NoBody;
    response: WorkspaceInvitationCandidatePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    scopeRef?: string;
    subjectType: "ORGANIZATION" | "ROLE";
    candidateUsage: "INVITATION_TARGET" | "LIST_FILTER";
    queryText?: string;
    page?: number;
    pageSize?: number;
    selectedOrganizationRef?: string;
    expectedContextVersion: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceRegionInvitations": {
    request: NoBody;
    response: WorkspaceInvitationPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    scopeRef?: string;
    mobile?: string;
    organizationRef?: string;
    roleId?: string;
    status?: WorkspaceInvitationStatus;
    expiresFrom?: number;
    expiresTo?: number;
    page?: number;
    pageSize?: number;
    expectedContextVersion: number;
    sort?: WorkspaceInvitationSortKey;
    direction?: SortDirection;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceRegionUser": {
    request: NoBody;
    response: WorkspaceUserPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    scopeRef?: string;
    userName?: string;
    mobile?: string;
    roleId?: string;
    status?: WorkspaceAccountStatus;
    page?: number;
    pageSize?: number;
    expectedContextVersion: number;
    sort?: WorkspaceUserSortKey;
    direction?: SortDirection;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceRegionUserAccount": {
    request: NoBody;
    response: WorkspaceUser;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    accountId: string;
  };
    query: {
    expectedContextVersion: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceSessionEntry": {
    request: NoBody;
    response: WorkspaceSessionEntry;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceStoreInvitationCandidates": {
    request: NoBody;
    response: WorkspaceInvitationCandidatePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    scopeRef?: string;
    subjectType: "ORGANIZATION" | "ROLE";
    candidateUsage: "INVITATION_TARGET" | "LIST_FILTER";
    queryText?: string;
    page?: number;
    pageSize?: number;
    selectedOrganizationRef?: string;
    expectedContextVersion: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceStoreInvitations": {
    request: NoBody;
    response: WorkspaceInvitationPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    scopeRef?: string;
    mobile?: string;
    organizationRef?: string;
    roleId?: string;
    status?: WorkspaceInvitationStatus;
    expiresFrom?: number;
    expiresTo?: number;
    page?: number;
    pageSize?: number;
    expectedContextVersion: number;
    sort?: WorkspaceInvitationSortKey;
    direction?: SortDirection;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceStoreUser": {
    request: NoBody;
    response: WorkspaceUserPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    scopeRef?: string;
    userName?: string;
    mobile?: string;
    roleId?: string;
    status?: WorkspaceAccountStatus;
    page?: number;
    pageSize?: number;
    expectedContextVersion: number;
    sort?: WorkspaceUserSortKey;
    direction?: SortDirection;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsWorkspaceStoreUserAccount": {
    request: NoBody;
    response: WorkspaceUser;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    accountId: string;
  };
    query: {
    expectedContextVersion: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "invalidateOperationsContract": {
    request: StoreContractInvalidateRequest;
    response: StoreContract;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    contractId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "operationsWorkspaceLogout": {
    request: NoBody;
    response: NoContent;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "operationsWorkspacePasswordLogin": {
    request: WorkspacePasswordLoginRequest;
    response: WorkspaceSessionEntry;
    requestRequired: true;
    requiresSession: false;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "reissueOperationsWorkspaceGroupInvitation": {
    request: WorkspaceOperationsInvitationActionRequest;
    response: WorkspaceInvitation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    invitationId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "reissueOperationsWorkspaceHeadCompanyInvitation": {
    request: WorkspaceOperationsInvitationActionRequest;
    response: WorkspaceInvitation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    invitationId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "reissueOperationsWorkspaceProjectInvitation": {
    request: WorkspaceOperationsInvitationActionRequest;
    response: WorkspaceInvitation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    invitationId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "reissueOperationsWorkspaceRegionInvitation": {
    request: WorkspaceOperationsInvitationActionRequest;
    response: WorkspaceInvitation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    invitationId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "reissueOperationsWorkspaceStoreInvitation": {
    request: WorkspaceOperationsInvitationActionRequest;
    response: WorkspaceInvitation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    invitationId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "removeOperationsOrganizationHeadCompanyBrandAuthorization": {
    request: NoBody;
    response: NoContent;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    headCompanyId: string;
    brandId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "revokeOperationsWorkspaceGroupUserAssignment": {
    request: WorkspaceUserRevokeRequest;
    response: WorkspaceUserRevokeResult;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    assignmentId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "revokeOperationsWorkspaceHeadCompanyUserAssignment": {
    request: WorkspaceUserRevokeRequest;
    response: WorkspaceUserRevokeResult;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    assignmentId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "revokeOperationsWorkspaceProjectUserAssignment": {
    request: WorkspaceUserRevokeRequest;
    response: WorkspaceUserRevokeResult;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    assignmentId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "revokeOperationsWorkspaceRegionUserAssignment": {
    request: WorkspaceUserRevokeRequest;
    response: WorkspaceUserRevokeResult;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    assignmentId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "revokeOperationsWorkspaceStoreUserAssignment": {
    request: WorkspaceUserRevokeRequest;
    response: WorkspaceUserRevokeResult;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    assignmentId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "selectOperationsWorkspaceSessionContext": {
    request: WorkspaceSelectContextRequest;
    response: WorkspaceSessionEntry;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "selectOperationsWorkspaceSessionDataNode": {
    request: WorkspaceSelectDataNodeRequest;
    response: WorkspaceSessionEntry;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "sendOperationsWorkspaceOtp": {
    request: WorkspaceOtpSendRequest;
    response: WorkspaceOtpSendResponse;
    requestRequired: true;
    requiresSession: false;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "transitionOperationsOrganizationBrandStatus": {
    request: BusinessEntityStatusRequest;
    response: Brand;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    brandId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "transitionOperationsOrganizationHeadCompanyStatus": {
    request: BusinessEntityStatusRequest;
    response: HeadCompany;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    headCompanyId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "transitionOperationsOrganizationNodeStatus": {
    request: OrganizationNodeStatusTransitionRequest;
    response: OrganizationNode;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    nodeId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "transitionOperationsOrganizationStoreStatus": {
    request: OrganizationStoreStatusRequest;
    response: OrganizationStore;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "transitionOperationsOrganizationTenantStatus": {
    request: BusinessEntityStatusRequest;
    response: Tenant;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    tenantId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "updateOperationsCommercialGroup": {
    request: CommercialGroupUpdateRequest;
    response: CommercialGroupRoot;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "updateOperationsContract": {
    request: StoreContractUpdateRequest;
    response: StoreContract;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    contractId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "updateOperationsOrganizationBrand": {
    request: BrandUpdateRequest;
    response: Brand;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    brandId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "updateOperationsOrganizationHeadCompany": {
    request: HeadCompanyUpdateRequest;
    response: HeadCompany;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    headCompanyId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "updateOperationsOrganizationNode": {
    request: OrganizationNodeUpdateRequest;
    response: OrganizationNode;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    nodeId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "updateOperationsOrganizationStore": {
    request: OrganizationStoreUpdateRequest;
    response: OrganizationStore;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "updateOperationsOrganizationTenant": {
    request: TenantUpdateRequest;
    response: Tenant;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    tenantId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "verifyOperationsWorkspaceOtp": {
    request: WorkspaceOtpVerifyRequest;
    response: WorkspaceSessionEntry;
    requestRequired: true;
    requiresSession: false;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
};

type RequestPart<I extends OperationsAdminOperationId> = FaceOperationContracts[I]["requestRequired"] extends true
  ? {body: FaceOperationContracts[I]["request"]}
  : {body?: never};
type QueryPart<I extends OperationsAdminOperationId> = FaceOperationContracts[I]["queryRequired"] extends true
  ? {query: FaceOperationContracts[I]["query"]}
  : {query?: FaceOperationContracts[I]["query"]};
type HeaderPart<I extends OperationsAdminOperationId> = FaceOperationContracts[I]["headersRequired"] extends true
  ? {headers: FaceOperationContracts[I]["headers"]}
  : {headers?: never};
export type FaceOperationOptions<I extends OperationsAdminOperationId> = RequestPart<I> & QueryPart<I> & HeaderPart<I>;
export type FaceOperationRequest<I extends OperationsAdminOperationId> = FaceOperationOptions<I> & {
  operationId: I;
  method: (typeof OPERATIONS_ADMIN_OPERATIONS)[number]["method"];
  path: (typeof OPERATIONS_ADMIN_OPERATIONS)[number]["path"];
  pathParameters: FaceOperationContracts[I]["path"];
  requiresSession: FaceOperationContracts[I]["requiresSession"];
};
export type FaceExecutor = <I extends OperationsAdminOperationId>(request: FaceOperationRequest<I>) => Promise<FaceOperationContracts[I]["response"]>;

export function createOperationsAdminClient(execute: FaceExecutor) {
  return {
    addOperationsOrganizationHeadCompanyBrandAuthorization: (pathParameters: FaceOperationContracts["addOperationsOrganizationHeadCompanyBrandAuthorization"]["path"], options: FaceOperationOptions<"addOperationsOrganizationHeadCompanyBrandAuthorization">) => execute({
      operationId: "addOperationsOrganizationHeadCompanyBrandAuthorization",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    cancelOperationsWorkspaceGroupInvitation: (pathParameters: FaceOperationContracts["cancelOperationsWorkspaceGroupInvitation"]["path"], options: FaceOperationOptions<"cancelOperationsWorkspaceGroupInvitation">) => execute({
      operationId: "cancelOperationsWorkspaceGroupInvitation",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations/{invitationId}/cancel",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    cancelOperationsWorkspaceHeadCompanyInvitation: (pathParameters: FaceOperationContracts["cancelOperationsWorkspaceHeadCompanyInvitation"]["path"], options: FaceOperationOptions<"cancelOperationsWorkspaceHeadCompanyInvitation">) => execute({
      operationId: "cancelOperationsWorkspaceHeadCompanyInvitation",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations/{invitationId}/cancel",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    cancelOperationsWorkspaceProjectInvitation: (pathParameters: FaceOperationContracts["cancelOperationsWorkspaceProjectInvitation"]["path"], options: FaceOperationOptions<"cancelOperationsWorkspaceProjectInvitation">) => execute({
      operationId: "cancelOperationsWorkspaceProjectInvitation",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations/{invitationId}/cancel",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    cancelOperationsWorkspaceRegionInvitation: (pathParameters: FaceOperationContracts["cancelOperationsWorkspaceRegionInvitation"]["path"], options: FaceOperationOptions<"cancelOperationsWorkspaceRegionInvitation">) => execute({
      operationId: "cancelOperationsWorkspaceRegionInvitation",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations/{invitationId}/cancel",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    cancelOperationsWorkspaceStoreInvitation: (pathParameters: FaceOperationContracts["cancelOperationsWorkspaceStoreInvitation"]["path"], options: FaceOperationOptions<"cancelOperationsWorkspaceStoreInvitation">) => execute({
      operationId: "cancelOperationsWorkspaceStoreInvitation",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations/{invitationId}/cancel",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    changeCurrentWorkspacePassword: (pathParameters: FaceOperationContracts["changeCurrentWorkspacePassword"]["path"], options: FaceOperationOptions<"changeCurrentWorkspacePassword">) => execute({
      operationId: "changeCurrentWorkspacePassword",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/session/password",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createOperationsContract: (pathParameters: FaceOperationContracts["createOperationsContract"]["path"], options: FaceOperationOptions<"createOperationsContract">) => execute({
      operationId: "createOperationsContract",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createOperationsOrganizationBrand: (pathParameters: FaceOperationContracts["createOperationsOrganizationBrand"]["path"], options: FaceOperationOptions<"createOperationsOrganizationBrand">) => execute({
      operationId: "createOperationsOrganizationBrand",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createOperationsOrganizationHeadCompany: (pathParameters: FaceOperationContracts["createOperationsOrganizationHeadCompany"]["path"], options: FaceOperationOptions<"createOperationsOrganizationHeadCompany">) => execute({
      operationId: "createOperationsOrganizationHeadCompany",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createOperationsOrganizationProject: (pathParameters: FaceOperationContracts["createOperationsOrganizationProject"]["path"], options: FaceOperationOptions<"createOperationsOrganizationProject">) => execute({
      operationId: "createOperationsOrganizationProject",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/regions/{regionId}/projects",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createOperationsOrganizationRegion: (pathParameters: FaceOperationContracts["createOperationsOrganizationRegion"]["path"], options: FaceOperationOptions<"createOperationsOrganizationRegion">) => execute({
      operationId: "createOperationsOrganizationRegion",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/regions",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createOperationsOrganizationStore: (pathParameters: FaceOperationContracts["createOperationsOrganizationStore"]["path"], options: FaceOperationOptions<"createOperationsOrganizationStore">) => execute({
      operationId: "createOperationsOrganizationStore",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createOperationsOrganizationTenant: (pathParameters: FaceOperationContracts["createOperationsOrganizationTenant"]["path"], options: FaceOperationOptions<"createOperationsOrganizationTenant">) => execute({
      operationId: "createOperationsOrganizationTenant",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createOperationsWorkspaceGroupInvitation: (pathParameters: FaceOperationContracts["createOperationsWorkspaceGroupInvitation"]["path"], options: FaceOperationOptions<"createOperationsWorkspaceGroupInvitation">) => execute({
      operationId: "createOperationsWorkspaceGroupInvitation",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createOperationsWorkspaceHeadCompanyInvitation: (pathParameters: FaceOperationContracts["createOperationsWorkspaceHeadCompanyInvitation"]["path"], options: FaceOperationOptions<"createOperationsWorkspaceHeadCompanyInvitation">) => execute({
      operationId: "createOperationsWorkspaceHeadCompanyInvitation",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createOperationsWorkspaceProjectInvitation: (pathParameters: FaceOperationContracts["createOperationsWorkspaceProjectInvitation"]["path"], options: FaceOperationOptions<"createOperationsWorkspaceProjectInvitation">) => execute({
      operationId: "createOperationsWorkspaceProjectInvitation",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createOperationsWorkspaceRegionInvitation: (pathParameters: FaceOperationContracts["createOperationsWorkspaceRegionInvitation"]["path"], options: FaceOperationOptions<"createOperationsWorkspaceRegionInvitation">) => execute({
      operationId: "createOperationsWorkspaceRegionInvitation",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createOperationsWorkspaceStoreInvitation: (pathParameters: FaceOperationContracts["createOperationsWorkspaceStoreInvitation"]["path"], options: FaceOperationOptions<"createOperationsWorkspaceStoreInvitation">) => execute({
      operationId: "createOperationsWorkspaceStoreInvitation",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsContract: (pathParameters: FaceOperationContracts["getOperationsContract"]["path"], options: FaceOperationOptions<"getOperationsContract">) => execute({
      operationId: "getOperationsContract",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsContractCandidates: (pathParameters: FaceOperationContracts["getOperationsContractCandidates"]["path"], options: FaceOperationOptions<"getOperationsContractCandidates">) => execute({
      operationId: "getOperationsContractCandidates",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/candidates",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsContractExtensionDefinition: (pathParameters: FaceOperationContracts["getOperationsContractExtensionDefinition"]["path"], options: FaceOperationOptions<"getOperationsContractExtensionDefinition">) => execute({
      operationId: "getOperationsContractExtensionDefinition",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/extension-definition",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsContracts: (pathParameters: FaceOperationContracts["getOperationsContracts"]["path"], options: FaceOperationOptions<"getOperationsContracts">) => execute({
      operationId: "getOperationsContracts",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsEntityAuditHistory: (pathParameters: FaceOperationContracts["getOperationsEntityAuditHistory"]["path"], options: FaceOperationOptions<"getOperationsEntityAuditHistory">) => execute({
      operationId: "getOperationsEntityAuditHistory",
      method: "GET",
      path: "/api/operations/audit-history",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsFixedStoreContracts: (pathParameters: FaceOperationContracts["getOperationsFixedStoreContracts"]["path"], options: FaceOperationOptions<"getOperationsFixedStoreContracts">) => execute({
      operationId: "getOperationsFixedStoreContracts",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/store/profile/contracts",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsOrganizationBrand: (pathParameters: FaceOperationContracts["getOperationsOrganizationBrand"]["path"], options: FaceOperationOptions<"getOperationsOrganizationBrand">) => execute({
      operationId: "getOperationsOrganizationBrand",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsOrganizationBrands: (pathParameters: FaceOperationContracts["getOperationsOrganizationBrands"]["path"], options: FaceOperationOptions<"getOperationsOrganizationBrands">) => execute({
      operationId: "getOperationsOrganizationBrands",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsOrganizationBusinessEntityExtensionDefinition: (pathParameters: FaceOperationContracts["getOperationsOrganizationBusinessEntityExtensionDefinition"]["path"], options: FaceOperationOptions<"getOperationsOrganizationBusinessEntityExtensionDefinition">) => execute({
      operationId: "getOperationsOrganizationBusinessEntityExtensionDefinition",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/business-entities/extension-definition",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsOrganizationCandidates: (pathParameters: FaceOperationContracts["getOperationsOrganizationCandidates"]["path"], options: FaceOperationOptions<"getOperationsOrganizationCandidates">) => execute({
      operationId: "getOperationsOrganizationCandidates",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/candidates",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsOrganizationHeadCompanies: (pathParameters: FaceOperationContracts["getOperationsOrganizationHeadCompanies"]["path"], options: FaceOperationOptions<"getOperationsOrganizationHeadCompanies">) => execute({
      operationId: "getOperationsOrganizationHeadCompanies",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsOrganizationHeadCompany: (pathParameters: FaceOperationContracts["getOperationsOrganizationHeadCompany"]["path"], options: FaceOperationOptions<"getOperationsOrganizationHeadCompany">) => execute({
      operationId: "getOperationsOrganizationHeadCompany",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsOrganizationHierarchy: (pathParameters: FaceOperationContracts["getOperationsOrganizationHierarchy"]["path"], options: FaceOperationOptions<"getOperationsOrganizationHierarchy">) => execute({
      operationId: "getOperationsOrganizationHierarchy",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsOrganizationHierarchyExtensionDefinition: (pathParameters: FaceOperationContracts["getOperationsOrganizationHierarchyExtensionDefinition"]["path"], options: FaceOperationOptions<"getOperationsOrganizationHierarchyExtensionDefinition">) => execute({
      operationId: "getOperationsOrganizationHierarchyExtensionDefinition",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/hierarchy/extension-definition",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsOrganizationStore: (pathParameters: FaceOperationContracts["getOperationsOrganizationStore"]["path"], options: FaceOperationOptions<"getOperationsOrganizationStore">) => execute({
      operationId: "getOperationsOrganizationStore",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsOrganizationStoreCandidates: (pathParameters: FaceOperationContracts["getOperationsOrganizationStoreCandidates"]["path"], options: FaceOperationOptions<"getOperationsOrganizationStoreCandidates">) => execute({
      operationId: "getOperationsOrganizationStoreCandidates",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/candidates",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsOrganizationStoreExtensionDefinition: (pathParameters: FaceOperationContracts["getOperationsOrganizationStoreExtensionDefinition"]["path"], options: FaceOperationOptions<"getOperationsOrganizationStoreExtensionDefinition">) => execute({
      operationId: "getOperationsOrganizationStoreExtensionDefinition",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/extension-definition",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsOrganizationStores: (pathParameters: FaceOperationContracts["getOperationsOrganizationStores"]["path"], options: FaceOperationOptions<"getOperationsOrganizationStores">) => execute({
      operationId: "getOperationsOrganizationStores",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsOrganizationTenant: (pathParameters: FaceOperationContracts["getOperationsOrganizationTenant"]["path"], options: FaceOperationOptions<"getOperationsOrganizationTenant">) => execute({
      operationId: "getOperationsOrganizationTenant",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants/{tenantId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsOrganizationTenants: (pathParameters: FaceOperationContracts["getOperationsOrganizationTenants"]["path"], options: FaceOperationOptions<"getOperationsOrganizationTenants">) => execute({
      operationId: "getOperationsOrganizationTenants",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsStoreProfile: (pathParameters: FaceOperationContracts["getOperationsStoreProfile"]["path"], options: FaceOperationOptions<"getOperationsStoreProfile">) => execute({
      operationId: "getOperationsStoreProfile",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/store/profile",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceGroupInvitationCandidates: (pathParameters: FaceOperationContracts["getOperationsWorkspaceGroupInvitationCandidates"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceGroupInvitationCandidates">) => execute({
      operationId: "getOperationsWorkspaceGroupInvitationCandidates",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations/candidates",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceGroupInvitations: (pathParameters: FaceOperationContracts["getOperationsWorkspaceGroupInvitations"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceGroupInvitations">) => execute({
      operationId: "getOperationsWorkspaceGroupInvitations",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceGroupUser: (pathParameters: FaceOperationContracts["getOperationsWorkspaceGroupUser"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceGroupUser">) => execute({
      operationId: "getOperationsWorkspaceGroupUser",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/user",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceGroupUserAccount: (pathParameters: FaceOperationContracts["getOperationsWorkspaceGroupUserAccount"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceGroupUserAccount">) => execute({
      operationId: "getOperationsWorkspaceGroupUserAccount",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/user/accounts/{accountId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceHeadCompanyInvitationCandidates: (pathParameters: FaceOperationContracts["getOperationsWorkspaceHeadCompanyInvitationCandidates"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceHeadCompanyInvitationCandidates">) => execute({
      operationId: "getOperationsWorkspaceHeadCompanyInvitationCandidates",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations/candidates",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceHeadCompanyInvitations: (pathParameters: FaceOperationContracts["getOperationsWorkspaceHeadCompanyInvitations"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceHeadCompanyInvitations">) => execute({
      operationId: "getOperationsWorkspaceHeadCompanyInvitations",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceHeadCompanyUser: (pathParameters: FaceOperationContracts["getOperationsWorkspaceHeadCompanyUser"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceHeadCompanyUser">) => execute({
      operationId: "getOperationsWorkspaceHeadCompanyUser",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/user",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceHeadCompanyUserAccount: (pathParameters: FaceOperationContracts["getOperationsWorkspaceHeadCompanyUserAccount"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceHeadCompanyUserAccount">) => execute({
      operationId: "getOperationsWorkspaceHeadCompanyUserAccount",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/user/accounts/{accountId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceLoginEntry: (pathParameters: FaceOperationContracts["getOperationsWorkspaceLoginEntry"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceLoginEntry">) => execute({
      operationId: "getOperationsWorkspaceLoginEntry",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/login-entry",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    getOperationsWorkspaceProjectInvitationCandidates: (pathParameters: FaceOperationContracts["getOperationsWorkspaceProjectInvitationCandidates"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceProjectInvitationCandidates">) => execute({
      operationId: "getOperationsWorkspaceProjectInvitationCandidates",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations/candidates",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceProjectInvitations: (pathParameters: FaceOperationContracts["getOperationsWorkspaceProjectInvitations"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceProjectInvitations">) => execute({
      operationId: "getOperationsWorkspaceProjectInvitations",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceProjectUser: (pathParameters: FaceOperationContracts["getOperationsWorkspaceProjectUser"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceProjectUser">) => execute({
      operationId: "getOperationsWorkspaceProjectUser",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/user",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceProjectUserAccount: (pathParameters: FaceOperationContracts["getOperationsWorkspaceProjectUserAccount"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceProjectUserAccount">) => execute({
      operationId: "getOperationsWorkspaceProjectUserAccount",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/user/accounts/{accountId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceRegionInvitationCandidates: (pathParameters: FaceOperationContracts["getOperationsWorkspaceRegionInvitationCandidates"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceRegionInvitationCandidates">) => execute({
      operationId: "getOperationsWorkspaceRegionInvitationCandidates",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations/candidates",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceRegionInvitations: (pathParameters: FaceOperationContracts["getOperationsWorkspaceRegionInvitations"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceRegionInvitations">) => execute({
      operationId: "getOperationsWorkspaceRegionInvitations",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceRegionUser: (pathParameters: FaceOperationContracts["getOperationsWorkspaceRegionUser"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceRegionUser">) => execute({
      operationId: "getOperationsWorkspaceRegionUser",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/user",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceRegionUserAccount: (pathParameters: FaceOperationContracts["getOperationsWorkspaceRegionUserAccount"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceRegionUserAccount">) => execute({
      operationId: "getOperationsWorkspaceRegionUserAccount",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/user/accounts/{accountId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceSessionEntry: (pathParameters: FaceOperationContracts["getOperationsWorkspaceSessionEntry"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceSessionEntry">) => execute({
      operationId: "getOperationsWorkspaceSessionEntry",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/session/entry",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceStoreInvitationCandidates: (pathParameters: FaceOperationContracts["getOperationsWorkspaceStoreInvitationCandidates"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceStoreInvitationCandidates">) => execute({
      operationId: "getOperationsWorkspaceStoreInvitationCandidates",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations/candidates",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceStoreInvitations: (pathParameters: FaceOperationContracts["getOperationsWorkspaceStoreInvitations"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceStoreInvitations">) => execute({
      operationId: "getOperationsWorkspaceStoreInvitations",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceStoreUser: (pathParameters: FaceOperationContracts["getOperationsWorkspaceStoreUser"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceStoreUser">) => execute({
      operationId: "getOperationsWorkspaceStoreUser",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/user",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsWorkspaceStoreUserAccount: (pathParameters: FaceOperationContracts["getOperationsWorkspaceStoreUserAccount"]["path"], options: FaceOperationOptions<"getOperationsWorkspaceStoreUserAccount">) => execute({
      operationId: "getOperationsWorkspaceStoreUserAccount",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/user/accounts/{accountId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    invalidateOperationsContract: (pathParameters: FaceOperationContracts["invalidateOperationsContract"]["path"], options: FaceOperationOptions<"invalidateOperationsContract">) => execute({
      operationId: "invalidateOperationsContract",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId}/invalidate",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    operationsWorkspaceLogout: (pathParameters: FaceOperationContracts["operationsWorkspaceLogout"]["path"], options: FaceOperationOptions<"operationsWorkspaceLogout">) => execute({
      operationId: "operationsWorkspaceLogout",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/logout",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    operationsWorkspacePasswordLogin: (pathParameters: FaceOperationContracts["operationsWorkspacePasswordLogin"]["path"], options: FaceOperationOptions<"operationsWorkspacePasswordLogin">) => execute({
      operationId: "operationsWorkspacePasswordLogin",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/password-login",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    reissueOperationsWorkspaceGroupInvitation: (pathParameters: FaceOperationContracts["reissueOperationsWorkspaceGroupInvitation"]["path"], options: FaceOperationOptions<"reissueOperationsWorkspaceGroupInvitation">) => execute({
      operationId: "reissueOperationsWorkspaceGroupInvitation",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations/{invitationId}/reissue",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    reissueOperationsWorkspaceHeadCompanyInvitation: (pathParameters: FaceOperationContracts["reissueOperationsWorkspaceHeadCompanyInvitation"]["path"], options: FaceOperationOptions<"reissueOperationsWorkspaceHeadCompanyInvitation">) => execute({
      operationId: "reissueOperationsWorkspaceHeadCompanyInvitation",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations/{invitationId}/reissue",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    reissueOperationsWorkspaceProjectInvitation: (pathParameters: FaceOperationContracts["reissueOperationsWorkspaceProjectInvitation"]["path"], options: FaceOperationOptions<"reissueOperationsWorkspaceProjectInvitation">) => execute({
      operationId: "reissueOperationsWorkspaceProjectInvitation",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations/{invitationId}/reissue",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    reissueOperationsWorkspaceRegionInvitation: (pathParameters: FaceOperationContracts["reissueOperationsWorkspaceRegionInvitation"]["path"], options: FaceOperationOptions<"reissueOperationsWorkspaceRegionInvitation">) => execute({
      operationId: "reissueOperationsWorkspaceRegionInvitation",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations/{invitationId}/reissue",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    reissueOperationsWorkspaceStoreInvitation: (pathParameters: FaceOperationContracts["reissueOperationsWorkspaceStoreInvitation"]["path"], options: FaceOperationOptions<"reissueOperationsWorkspaceStoreInvitation">) => execute({
      operationId: "reissueOperationsWorkspaceStoreInvitation",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations/{invitationId}/reissue",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    removeOperationsOrganizationHeadCompanyBrandAuthorization: (pathParameters: FaceOperationContracts["removeOperationsOrganizationHeadCompanyBrandAuthorization"]["path"], options: FaceOperationOptions<"removeOperationsOrganizationHeadCompanyBrandAuthorization">) => execute({
      operationId: "removeOperationsOrganizationHeadCompanyBrandAuthorization",
      method: "DELETE",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations/{brandId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    revokeOperationsWorkspaceGroupUserAssignment: (pathParameters: FaceOperationContracts["revokeOperationsWorkspaceGroupUserAssignment"]["path"], options: FaceOperationOptions<"revokeOperationsWorkspaceGroupUserAssignment">) => execute({
      operationId: "revokeOperationsWorkspaceGroupUserAssignment",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/user/assignments/{assignmentId}/revoke",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    revokeOperationsWorkspaceHeadCompanyUserAssignment: (pathParameters: FaceOperationContracts["revokeOperationsWorkspaceHeadCompanyUserAssignment"]["path"], options: FaceOperationOptions<"revokeOperationsWorkspaceHeadCompanyUserAssignment">) => execute({
      operationId: "revokeOperationsWorkspaceHeadCompanyUserAssignment",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/user/assignments/{assignmentId}/revoke",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    revokeOperationsWorkspaceProjectUserAssignment: (pathParameters: FaceOperationContracts["revokeOperationsWorkspaceProjectUserAssignment"]["path"], options: FaceOperationOptions<"revokeOperationsWorkspaceProjectUserAssignment">) => execute({
      operationId: "revokeOperationsWorkspaceProjectUserAssignment",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/user/assignments/{assignmentId}/revoke",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    revokeOperationsWorkspaceRegionUserAssignment: (pathParameters: FaceOperationContracts["revokeOperationsWorkspaceRegionUserAssignment"]["path"], options: FaceOperationOptions<"revokeOperationsWorkspaceRegionUserAssignment">) => execute({
      operationId: "revokeOperationsWorkspaceRegionUserAssignment",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/user/assignments/{assignmentId}/revoke",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    revokeOperationsWorkspaceStoreUserAssignment: (pathParameters: FaceOperationContracts["revokeOperationsWorkspaceStoreUserAssignment"]["path"], options: FaceOperationOptions<"revokeOperationsWorkspaceStoreUserAssignment">) => execute({
      operationId: "revokeOperationsWorkspaceStoreUserAssignment",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/user/assignments/{assignmentId}/revoke",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    selectOperationsWorkspaceSessionContext: (pathParameters: FaceOperationContracts["selectOperationsWorkspaceSessionContext"]["path"], options: FaceOperationOptions<"selectOperationsWorkspaceSessionContext">) => execute({
      operationId: "selectOperationsWorkspaceSessionContext",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/session/context",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    selectOperationsWorkspaceSessionDataNode: (pathParameters: FaceOperationContracts["selectOperationsWorkspaceSessionDataNode"]["path"], options: FaceOperationOptions<"selectOperationsWorkspaceSessionDataNode">) => execute({
      operationId: "selectOperationsWorkspaceSessionDataNode",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/session/data-node",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    sendOperationsWorkspaceOtp: (pathParameters: FaceOperationContracts["sendOperationsWorkspaceOtp"]["path"], options: FaceOperationOptions<"sendOperationsWorkspaceOtp">) => execute({
      operationId: "sendOperationsWorkspaceOtp",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/otp/send",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    transitionOperationsOrganizationBrandStatus: (pathParameters: FaceOperationContracts["transitionOperationsOrganizationBrandStatus"]["path"], options: FaceOperationOptions<"transitionOperationsOrganizationBrandStatus">) => execute({
      operationId: "transitionOperationsOrganizationBrandStatus",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId}/status",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    transitionOperationsOrganizationHeadCompanyStatus: (pathParameters: FaceOperationContracts["transitionOperationsOrganizationHeadCompanyStatus"]["path"], options: FaceOperationOptions<"transitionOperationsOrganizationHeadCompanyStatus">) => execute({
      operationId: "transitionOperationsOrganizationHeadCompanyStatus",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/status",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    transitionOperationsOrganizationNodeStatus: (pathParameters: FaceOperationContracts["transitionOperationsOrganizationNodeStatus"]["path"], options: FaceOperationOptions<"transitionOperationsOrganizationNodeStatus">) => execute({
      operationId: "transitionOperationsOrganizationNodeStatus",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/{nodeId}/status",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    transitionOperationsOrganizationStoreStatus: (pathParameters: FaceOperationContracts["transitionOperationsOrganizationStoreStatus"]["path"], options: FaceOperationOptions<"transitionOperationsOrganizationStoreStatus">) => execute({
      operationId: "transitionOperationsOrganizationStoreStatus",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}/status",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    transitionOperationsOrganizationTenantStatus: (pathParameters: FaceOperationContracts["transitionOperationsOrganizationTenantStatus"]["path"], options: FaceOperationOptions<"transitionOperationsOrganizationTenantStatus">) => execute({
      operationId: "transitionOperationsOrganizationTenantStatus",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants/{tenantId}/status",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    updateOperationsCommercialGroup: (pathParameters: FaceOperationContracts["updateOperationsCommercialGroup"]["path"], options: FaceOperationOptions<"updateOperationsCommercialGroup">) => execute({
      operationId: "updateOperationsCommercialGroup",
      method: "PATCH",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/commercial-group",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    updateOperationsContract: (pathParameters: FaceOperationContracts["updateOperationsContract"]["path"], options: FaceOperationOptions<"updateOperationsContract">) => execute({
      operationId: "updateOperationsContract",
      method: "PATCH",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    updateOperationsOrganizationBrand: (pathParameters: FaceOperationContracts["updateOperationsOrganizationBrand"]["path"], options: FaceOperationOptions<"updateOperationsOrganizationBrand">) => execute({
      operationId: "updateOperationsOrganizationBrand",
      method: "PATCH",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    updateOperationsOrganizationHeadCompany: (pathParameters: FaceOperationContracts["updateOperationsOrganizationHeadCompany"]["path"], options: FaceOperationOptions<"updateOperationsOrganizationHeadCompany">) => execute({
      operationId: "updateOperationsOrganizationHeadCompany",
      method: "PATCH",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    updateOperationsOrganizationNode: (pathParameters: FaceOperationContracts["updateOperationsOrganizationNode"]["path"], options: FaceOperationOptions<"updateOperationsOrganizationNode">) => execute({
      operationId: "updateOperationsOrganizationNode",
      method: "PATCH",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/{nodeId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    updateOperationsOrganizationStore: (pathParameters: FaceOperationContracts["updateOperationsOrganizationStore"]["path"], options: FaceOperationOptions<"updateOperationsOrganizationStore">) => execute({
      operationId: "updateOperationsOrganizationStore",
      method: "PATCH",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    updateOperationsOrganizationTenant: (pathParameters: FaceOperationContracts["updateOperationsOrganizationTenant"]["path"], options: FaceOperationOptions<"updateOperationsOrganizationTenant">) => execute({
      operationId: "updateOperationsOrganizationTenant",
      method: "PATCH",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants/{tenantId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    verifyOperationsWorkspaceOtp: (pathParameters: FaceOperationContracts["verifyOperationsWorkspaceOtp"]["path"], options: FaceOperationOptions<"verifyOperationsWorkspaceOtp">) => execute({
      operationId: "verifyOperationsWorkspaceOtp",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/otp/verify",
      pathParameters,
      requiresSession: false,
      ...options,
    })
  } as const;
}
