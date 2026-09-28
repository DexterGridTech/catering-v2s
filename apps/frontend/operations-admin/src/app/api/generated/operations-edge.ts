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
    "operationId": "addOperationsSalesMenuItems",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/sections/{salesSectionRef}/items",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "archiveOperationsSalesMenu",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/archive",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "cancelOperationsStoreTerminalActivation",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals/{terminalRef}/activation/cancel",
    "owner": "terminal-binding",
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
    "operationId": "copyOperationsSalesMenu",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/copies",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "createOperationsBusinessChannel",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels",
    "owner": "business-channel",
    "requiresSession": true
  },
  {
    "operationId": "createOperationsBusinessChannelTemplate",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates",
    "owner": "business-channel",
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
    "operationId": "createOperationsOwnerBinding",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}/owner-binding",
    "owner": "collaboration",
    "requiresSession": true
  },
  {
    "operationId": "createOperationsSalesMenu",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "createOperationsSalesMenuSection",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/sections",
    "owner": "sales-menu",
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
    "operationId": "deleteOperationsOwnerBinding",
    "method": "DELETE",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}/owner-binding",
    "owner": "collaboration",
    "requiresSession": true
  },
  {
    "operationId": "deleteOperationsSalesMenuItem",
    "method": "DELETE",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/items/{salesItemRef}",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "deleteOperationsSalesMenuSection",
    "method": "DELETE",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/sections/{salesSectionRef}",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsBusinessChannelDetail",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}",
    "owner": "business-channel",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsBusinessChannelTemplates",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates",
    "owner": "business-channel",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsBusinessChannelTemplateVisibleStores",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates/{templateRef}/visible-stores",
    "owner": "business-channel",
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
    "operationId": "getOperationsExternalCapabilityDictionary",
    "method": "GET",
    "path": "/api/operations/external-capability-dictionary",
    "owner": "collaboration",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsExternalProviderCandidates",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/external-provider-candidates",
    "owner": "collaboration",
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
    "operationId": "getOperationsOrganizationStoreExtensionDefinition",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/extension-definition",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsOrganizationStoreOperatingRule",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}/operating-rule-switches",
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
    "operationId": "getOperationsOwnerBindingDetail",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}/owner-binding",
    "owner": "collaboration",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsProjectBusinessChannels",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/business-channels",
    "owner": "business-channel",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsSalesMenu",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsSalesMenuDraftItem",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/items/{salesItemRef}",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsSalesMenuDraftItems",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/sections/{salesSectionRef}/items",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsSalesMenuDraftSections",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/sections",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsSalesMenuItemCandidates",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/item-candidates",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsSalesMenuOperationRecords",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/sales-menu-operation-records",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsSalesMenuPublicationPreview",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/publication-preview",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsSalesMenuPublishedItem",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/published/items/{salesItemRef}",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsSalesMenuPublishedItems",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/published/sections/{salesSectionRef}/items",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsSalesMenuPublishedSections",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/published/sections",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsSalesMenus",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsStoreBusinessChannels",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/business-channels",
    "owner": "business-channel",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsStoreBusinessChannelTemplateCandidates",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-template-candidates",
    "owner": "business-channel",
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
    "operationId": "getOperationsStoreQrChannelCandidates",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/qr-channel-candidates",
    "owner": "business-channel",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsStoreQrConfiguration",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/qr-configuration",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsStoreServicePoint",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-points/{servicePointRef}",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsStoreServicePointAreas",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsStoreServicePoints",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas/{areaRef}/service-points",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsStoreTerminal",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals/{terminalRef}",
    "owner": "store-terminal",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsStoreTerminalAreaCandidates",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals/area-candidates",
    "owner": "store-terminal",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsStoreTerminals",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals",
    "owner": "store-terminal",
    "requiresSession": true
  },
  {
    "operationId": "getOperationsStoreTerminalTagCandidates",
    "method": "GET",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals/tag-candidates",
    "owner": "store-terminal",
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
    "operationId": "moveOperationsSalesMenuItem",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/items/{salesItemRef}/move",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "moveOperationsSalesMenuSection",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/sections/{salesSectionRef}/move",
    "owner": "sales-menu",
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
    "operationId": "patchOperationsStoreQrConfiguration",
    "method": "PATCH",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/qr-configuration",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "patchOperationsStoreServicePoint",
    "method": "PATCH",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-points/{servicePointRef}",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "patchOperationsStoreServicePointArea",
    "method": "PATCH",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas/{areaRef}",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "postOperationsStoreServicePoint",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas/{areaRef}/service-points",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "postOperationsStoreServicePointArea",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "postOperationsStoreServicePointAreaOrder",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas/{areaRef}/order",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "postOperationsStoreServicePointAreaStatus",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas/{areaRef}/status",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "postOperationsStoreServicePointOrder",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-points/{servicePointRef}/order",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "postOperationsStoreServicePointStatus",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-points/{servicePointRef}/status",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "postOperationsStoreTerminal",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals",
    "owner": "store-terminal",
    "requiresSession": true
  },
  {
    "operationId": "postOperationsStoreTerminalStatus",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals/{terminalRef}/status",
    "owner": "store-terminal",
    "requiresSession": true
  },
  {
    "operationId": "publishOperationsSalesMenu",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/publications",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "putOperationsStoreTerminal",
    "method": "PUT",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals/{terminalRef}",
    "owner": "store-terminal",
    "requiresSession": true
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
    "operationId": "releaseOperationsSalesMenuStagedAsset",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/items/{salesItemRef}/assets/stage/{assetRef}/release",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "releaseStagedStoreServicePointImage",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-assets/stage/{assetRef}/release",
    "owner": "platform-asset",
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
    "operationId": "renameOperationsSalesMenu",
    "method": "PATCH",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/name",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "renameOperationsSalesMenuSection",
    "method": "PATCH",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/sections/{salesSectionRef}/name",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "restoreOperationsSalesMenuItemSale",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/published/items/{salesItemRef}/channels/{channelRef}/manual-restore",
    "owner": "sales-menu",
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
    "operationId": "setOperationsSalesMenuActivation",
    "method": "PUT",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/channels/{channelRef}/activation",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "setOperationsSalesMenuItemSoldOut",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/published/items/{salesItemRef}/channels/{channelRef}/manual-sold-out",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "stageOperationsSalesMenuAsset",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/items/{salesItemRef}/assets/stage",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "stageStoreServicePointImage",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-assets/stage",
    "owner": "platform-asset",
    "requiresSession": true
  },
  {
    "operationId": "transitionOperationsBusinessChannelStatus",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}",
    "owner": "business-channel",
    "requiresSession": true
  },
  {
    "operationId": "transitionOperationsBusinessChannelTemplateStatus",
    "method": "POST",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates/{templateRef}/status",
    "owner": "business-channel",
    "requiresSession": true
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
    "operationId": "updateOperationsBusinessChannel",
    "method": "PATCH",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}",
    "owner": "business-channel",
    "requiresSession": true
  },
  {
    "operationId": "updateOperationsBusinessChannelTemplate",
    "method": "PATCH",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates/{templateRef}",
    "owner": "business-channel",
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
    "operationId": "updateOperationsSalesMenuItem",
    "method": "PUT",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/items/{salesItemRef}",
    "owner": "sales-menu",
    "requiresSession": true
  },
  {
    "operationId": "updateOperationsSalesMenuSchedule",
    "method": "PUT",
    "path": "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/schedule",
    "owner": "sales-menu",
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

export const OPERATIONS_ADMIN_DATABASE_OPERATION_BUDGETS = {
  "addOperationsOrganizationHeadCompanyBrandAuthorization": {
    "kind": "FIXED",
    "max": 18,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 18,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "addOperationsSalesMenuItems": {
    "kind": "FIXED",
    "max": 32,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 32,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "archiveOperationsSalesMenu": {
    "kind": "FIXED",
    "max": 27,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 27,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "cancelOperationsStoreTerminalActivation": {
    "kind": "FIXED",
    "max": 17,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 17,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "cancelOperationsWorkspaceGroupInvitation": {
    "kind": "FIXED",
    "max": 22,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 22,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "cancelOperationsWorkspaceHeadCompanyInvitation": {
    "kind": "FIXED",
    "max": 22,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 22,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "cancelOperationsWorkspaceProjectInvitation": {
    "kind": "FIXED",
    "max": 21,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 21,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "cancelOperationsWorkspaceRegionInvitation": {
    "kind": "FIXED",
    "max": 22,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 22,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "cancelOperationsWorkspaceStoreInvitation": {
    "kind": "FIXED",
    "max": 21,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 21,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "changeCurrentWorkspacePassword": {
    "kind": "FIXED",
    "max": 10,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 10,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "copyOperationsSalesMenu": {
    "kind": "FIXED",
    "max": 39,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 39,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "createOperationsBusinessChannel": {
    "kind": "FIXED",
    "max": 20,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 20,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "createOperationsBusinessChannelTemplate": {
    "kind": "FIXED",
    "max": 21,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 21,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "createOperationsContract": {
    "kind": "FIXED",
    "max": 20,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 20,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "createOperationsOrganizationBrand": {
    "kind": "FIXED",
    "max": 22,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 22,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "createOperationsOrganizationHeadCompany": {
    "kind": "FIXED",
    "max": 22,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 22,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "createOperationsOrganizationProject": {
    "kind": "FIXED",
    "max": 24,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 24,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "createOperationsOrganizationRegion": {
    "kind": "FIXED",
    "max": 23,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 23,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "createOperationsOrganizationStore": {
    "kind": "FIXED",
    "max": 25,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 25,
        "reason": "Dexter 2026-09-18 implementation authorization: retain the complete owner transaction, security boundaries and authoritative readback after three managed CP-05 measurements; no safe consolidation remains.",
        "decisionRef": "IMPLEMENTATION-AGENT-2026-09-18-STORE-CREATE-P3"
      }
    ]
  },
  "createOperationsOrganizationTenant": {
    "kind": "FIXED",
    "max": 22,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 22,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "createOperationsOwnerBinding": {
    "kind": "FIXED",
    "max": 22,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 22,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "createOperationsSalesMenu": {
    "kind": "FIXED",
    "max": 33,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 33,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "createOperationsSalesMenuSection": {
    "kind": "FIXED",
    "max": 30,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 30,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "createOperationsWorkspaceGroupInvitation": {
    "kind": "FIXED",
    "max": 21,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 21,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "createOperationsWorkspaceHeadCompanyInvitation": {
    "kind": "FIXED",
    "max": 21,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 21,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "createOperationsWorkspaceProjectInvitation": {
    "kind": "FIXED",
    "max": 20,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 20,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "createOperationsWorkspaceRegionInvitation": {
    "kind": "FIXED",
    "max": 21,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 21,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "createOperationsWorkspaceStoreInvitation": {
    "kind": "FIXED",
    "max": 20,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 20,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "deleteOperationsOwnerBinding": {
    "kind": "FIXED",
    "max": 22,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 22,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "deleteOperationsSalesMenuItem": {
    "kind": "FIXED",
    "max": 34,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 34,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "deleteOperationsSalesMenuSection": {
    "kind": "FIXED",
    "max": 31,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 31,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "getOperationsBusinessChannelDetail": {
    "kind": "FIXED",
    "max": 13,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 13,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsBusinessChannelTemplates": {
    "kind": "FIXED",
    "max": 12,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 12,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsBusinessChannelTemplateVisibleStores": {
    "kind": "FIXED",
    "max": 12,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 12,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsContract": {
    "kind": "FIXED",
    "max": 8,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 8,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsContractCandidates": {
    "kind": "FIXED",
    "max": 8,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 8,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsContractExtensionDefinition": {
    "kind": "FIXED",
    "max": 8,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 8,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsContracts": {
    "kind": "FIXED",
    "max": 12,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 12,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsEntityAuditHistory": {
    "kind": "FIXED",
    "max": 7,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 7,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsExternalCapabilityDictionary": {
    "kind": "FIXED",
    "max": 7,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 7,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsExternalProviderCandidates": {
    "kind": "FIXED",
    "max": 7,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 7,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsFixedStoreContracts": {
    "kind": "FIXED",
    "max": 9,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 9,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsOrganizationBrand": {
    "kind": "FIXED",
    "max": 8,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 8,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsOrganizationBrands": {
    "kind": "FIXED",
    "max": 11,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 11,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsOrganizationBusinessEntityExtensionDefinition": {
    "kind": "FIXED",
    "max": 8,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 8,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsOrganizationCandidates": {
    "kind": "FIXED",
    "max": 7,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 7,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsOrganizationHeadCompanies": {
    "kind": "FIXED",
    "max": 11,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 11,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsOrganizationHeadCompany": {
    "kind": "FIXED",
    "max": 10,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 10,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsOrganizationHierarchy": {
    "kind": "FIXED",
    "max": 9,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 9,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsOrganizationHierarchyExtensionDefinition": {
    "kind": "FIXED",
    "max": 8,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 8,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsOrganizationStore": {
    "kind": "FIXED",
    "max": 13,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 13,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsOrganizationStoreExtensionDefinition": {
    "kind": "FIXED",
    "max": 8,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 8,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsOrganizationStoreOperatingRule": {
    "kind": "FIXED",
    "max": 13,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 13,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsOrganizationStores": {
    "kind": "FIXED",
    "max": 16,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 16,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsOrganizationTenant": {
    "kind": "FIXED",
    "max": 8,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 8,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsOrganizationTenants": {
    "kind": "FIXED",
    "max": 11,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 11,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsOwnerBindingDetail": {
    "kind": "FIXED",
    "max": 15,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 15,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsProjectBusinessChannels": {
    "kind": "FIXED",
    "max": 10,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 10,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsSalesMenu": {
    "kind": "FIXED",
    "max": 14,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 14,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsSalesMenuDraftItem": {
    "kind": "FIXED",
    "max": 24,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 24,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsSalesMenuDraftItems": {
    "kind": "FIXED",
    "max": 24,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 24,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsSalesMenuDraftSections": {
    "kind": "FIXED",
    "max": 13,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 13,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsSalesMenuItemCandidates": {
    "kind": "FIXED",
    "max": 17,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 17,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsSalesMenuOperationRecords": {
    "kind": "FIXED",
    "max": 13,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 13,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsSalesMenuPublicationPreview": {
    "kind": "FIXED",
    "max": 24,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 24,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsSalesMenuPublishedItem": {
    "kind": "FIXED",
    "max": 22,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 22,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsSalesMenuPublishedItems": {
    "kind": "FIXED",
    "max": 21,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 21,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsSalesMenuPublishedSections": {
    "kind": "FIXED",
    "max": 13,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 13,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsSalesMenus": {
    "kind": "FIXED",
    "max": 13,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 13,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsStoreBusinessChannels": {
    "kind": "FIXED",
    "max": 13,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 13,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsStoreBusinessChannelTemplateCandidates": {
    "kind": "FIXED",
    "max": 14,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 14,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsStoreProfile": {
    "kind": "FIXED",
    "max": 12,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 12,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsStoreQrChannelCandidates": {
    "kind": "FIXED",
    "max": 8,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 8,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsStoreQrConfiguration": {
    "kind": "FIXED",
    "max": 10,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 10,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsStoreServicePoint": {
    "kind": "FIXED",
    "max": 12,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 12,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsStoreServicePointAreas": {
    "kind": "FIXED",
    "max": 11,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 11,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsStoreServicePoints": {
    "kind": "FIXED",
    "max": 11,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 11,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsStoreTerminal": {
    "kind": "FIXED",
    "max": 11,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 11,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsStoreTerminalAreaCandidates": {
    "kind": "FIXED",
    "max": 11,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 11,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsStoreTerminals": {
    "kind": "FIXED",
    "max": 10,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 10,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsStoreTerminalTagCandidates": {
    "kind": "FIXED",
    "max": 10,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 10,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceGroupInvitationCandidates": {
    "kind": "FIXED",
    "max": 13,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 13,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceGroupInvitations": {
    "kind": "FIXED",
    "max": 14,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 14,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceGroupUser": {
    "kind": "FIXED",
    "max": 18,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 18,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceGroupUserAccount": {
    "kind": "FIXED",
    "max": 17,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 17,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceHeadCompanyInvitationCandidates": {
    "kind": "FIXED",
    "max": 12,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 12,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceHeadCompanyInvitations": {
    "kind": "FIXED",
    "max": 14,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 14,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceHeadCompanyUser": {
    "kind": "FIXED",
    "max": 18,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 18,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceHeadCompanyUserAccount": {
    "kind": "FIXED",
    "max": 17,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 17,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceLoginEntry": {
    "kind": "FIXED",
    "max": 4,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 4,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceProjectInvitationCandidates": {
    "kind": "FIXED",
    "max": 10,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 10,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceProjectInvitations": {
    "kind": "FIXED",
    "max": 12,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 12,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceProjectUser": {
    "kind": "FIXED",
    "max": 16,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 16,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceProjectUserAccount": {
    "kind": "FIXED",
    "max": 15,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 15,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceRegionInvitationCandidates": {
    "kind": "FIXED",
    "max": 11,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 11,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceRegionInvitations": {
    "kind": "FIXED",
    "max": 13,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 13,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceRegionUser": {
    "kind": "FIXED",
    "max": 17,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 17,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceRegionUserAccount": {
    "kind": "FIXED",
    "max": 16,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 16,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceSessionEntry": {
    "kind": "FIXED",
    "max": 11,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 11,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceStoreInvitationCandidates": {
    "kind": "FIXED",
    "max": 11,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 11,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceStoreInvitations": {
    "kind": "FIXED",
    "max": 12,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 12,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceStoreUser": {
    "kind": "FIXED",
    "max": 17,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 17,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getOperationsWorkspaceStoreUserAccount": {
    "kind": "FIXED",
    "max": 15,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 15,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "invalidateOperationsContract": {
    "kind": "FIXED",
    "max": 19,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 19,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "moveOperationsSalesMenuItem": {
    "kind": "FIXED",
    "max": 34,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 34,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "moveOperationsSalesMenuSection": {
    "kind": "FIXED",
    "max": 34,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 34,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "operationsWorkspaceLogout": {
    "kind": "FIXED",
    "max": 4,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 4,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "operationsWorkspacePasswordLogin": {
    "kind": "FIXED",
    "max": 22,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 22,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "patchOperationsStoreQrConfiguration": {
    "kind": "FIXED",
    "max": 20,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 20,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "patchOperationsStoreServicePoint": {
    "kind": "FIXED",
    "max": 25,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 25,
        "reason": "Dexter 2026-09-18 implementation authorization: retain the complete owner transaction, security boundaries and authoritative readback after three managed CP-05 measurements; no safe consolidation remains.",
        "decisionRef": "IMPLEMENTATION-AGENT-2026-09-18-SERVICE-POINT-PATCH-P3"
      }
    ]
  },
  "patchOperationsStoreServicePointArea": {
    "kind": "FIXED",
    "max": 20,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 20,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "postOperationsStoreServicePoint": {
    "kind": "FIXED",
    "max": 27,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 27,
        "reason": "Dexter 2026-09-18 implementation authorization: retain the complete owner transaction, security boundaries and authoritative readback after three managed CP-05 measurements; no safe consolidation remains.",
        "decisionRef": "IMPLEMENTATION-AGENT-2026-09-18-SERVICE-POINT-CREATE-P3"
      }
    ]
  },
  "postOperationsStoreServicePointArea": {
    "kind": "FIXED",
    "max": 19,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 19,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "postOperationsStoreServicePointAreaOrder": {
    "kind": "FIXED",
    "max": 21,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 21,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "postOperationsStoreServicePointAreaStatus": {
    "kind": "FIXED",
    "max": 20,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 20,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "postOperationsStoreServicePointOrder": {
    "kind": "FIXED",
    "max": 22,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 22,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "postOperationsStoreServicePointStatus": {
    "kind": "FIXED",
    "max": 22,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 22,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "postOperationsStoreTerminal": {
    "kind": "FIXED",
    "max": 20,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 20,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "postOperationsStoreTerminalStatus": {
    "kind": "FIXED",
    "max": 23,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 18,
        "to": 23,
        "reason": "D-39 implementation-agent decision: preserve atomic store-terminal transition and terminal-binding owner closure after three current-byte CP-05 measurements; no safe owner fan-out can be removed.",
        "decisionRef": "IMPLEMENTATION-AGENT-2026-09-29-TERMINAL-VOID-STATUS-CP05"
      }
    ]
  },
  "publishOperationsSalesMenu": {
    "kind": "FIXED",
    "max": 48,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 48,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "putOperationsStoreTerminal": {
    "kind": "FIXED",
    "max": 21,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 21,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "reissueOperationsWorkspaceGroupInvitation": {
    "kind": "FIXED",
    "max": 29,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 29,
        "reason": "Dexter 2026-08-29: invitation and employment-assignment commands are inherently multi-table writes; preserve their complete business transaction.",
        "decisionRef": "DEXTER-2026-08-29-BASE1-INVITATION-ASSIGNMENT-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "reissueOperationsWorkspaceHeadCompanyInvitation": {
    "kind": "FIXED",
    "max": 29,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 29,
        "reason": "Dexter 2026-08-29: invitation and employment-assignment commands are inherently multi-table writes; preserve their complete business transaction.",
        "decisionRef": "DEXTER-2026-08-29-BASE1-INVITATION-ASSIGNMENT-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "reissueOperationsWorkspaceProjectInvitation": {
    "kind": "FIXED",
    "max": 28,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 28,
        "reason": "Dexter 2026-08-29: invitation and employment-assignment commands are inherently multi-table writes; preserve their complete business transaction.",
        "decisionRef": "DEXTER-2026-08-29-BASE1-INVITATION-ASSIGNMENT-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "reissueOperationsWorkspaceRegionInvitation": {
    "kind": "FIXED",
    "max": 29,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 29,
        "reason": "Dexter 2026-08-29: invitation and employment-assignment commands are inherently multi-table writes; preserve their complete business transaction.",
        "decisionRef": "DEXTER-2026-08-29-BASE1-INVITATION-ASSIGNMENT-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "reissueOperationsWorkspaceStoreInvitation": {
    "kind": "FIXED",
    "max": 28,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 28,
        "reason": "Dexter 2026-08-29: invitation and employment-assignment commands are inherently multi-table writes; preserve their complete business transaction.",
        "decisionRef": "DEXTER-2026-08-29-BASE1-INVITATION-ASSIGNMENT-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "releaseOperationsSalesMenuStagedAsset": {
    "kind": "FIXED",
    "max": 31,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 31,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "releaseStagedStoreServicePointImage": {
    "kind": "FIXED",
    "max": 18,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 18,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "removeOperationsOrganizationHeadCompanyBrandAuthorization": {
    "kind": "FIXED",
    "max": 19,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 19,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "renameOperationsSalesMenu": {
    "kind": "FIXED",
    "max": 27,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 27,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "renameOperationsSalesMenuSection": {
    "kind": "FIXED",
    "max": 30,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 30,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "restoreOperationsSalesMenuItemSale": {
    "kind": "FIXED",
    "max": 36,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 36,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "revokeOperationsWorkspaceGroupUserAssignment": {
    "kind": "FIXED",
    "max": 28,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 28,
        "reason": "Dexter 2026-08-29: invitation and employment-assignment commands are inherently multi-table writes; preserve their complete business transaction.",
        "decisionRef": "DEXTER-2026-08-29-BASE1-INVITATION-ASSIGNMENT-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "revokeOperationsWorkspaceHeadCompanyUserAssignment": {
    "kind": "FIXED",
    "max": 28,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 28,
        "reason": "Dexter 2026-08-29: invitation and employment-assignment commands are inherently multi-table writes; preserve their complete business transaction.",
        "decisionRef": "DEXTER-2026-08-29-BASE1-INVITATION-ASSIGNMENT-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "revokeOperationsWorkspaceProjectUserAssignment": {
    "kind": "FIXED",
    "max": 26,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 26,
        "reason": "Dexter 2026-08-29: invitation and employment-assignment commands are inherently multi-table writes; preserve their complete business transaction.",
        "decisionRef": "DEXTER-2026-08-29-BASE1-INVITATION-ASSIGNMENT-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "revokeOperationsWorkspaceRegionUserAssignment": {
    "kind": "FIXED",
    "max": 28,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 28,
        "reason": "Dexter 2026-08-29: invitation and employment-assignment commands are inherently multi-table writes; preserve their complete business transaction.",
        "decisionRef": "DEXTER-2026-08-29-BASE1-INVITATION-ASSIGNMENT-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "revokeOperationsWorkspaceStoreUserAssignment": {
    "kind": "FIXED",
    "max": 26,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 26,
        "reason": "Dexter 2026-08-29: invitation and employment-assignment commands are inherently multi-table writes; preserve their complete business transaction.",
        "decisionRef": "DEXTER-2026-08-29-BASE1-INVITATION-ASSIGNMENT-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "selectOperationsWorkspaceSessionContext": {
    "kind": "FIXED",
    "max": 16,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 16,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "selectOperationsWorkspaceSessionDataNode": {
    "kind": "FIXED",
    "max": 15,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 15,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "sendOperationsWorkspaceOtp": {
    "kind": "FIXED",
    "max": 10,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 10,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "setOperationsSalesMenuActivation": {
    "kind": "FIXED",
    "max": 32,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 32,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "setOperationsSalesMenuItemSoldOut": {
    "kind": "FIXED",
    "max": 36,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 36,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "stageOperationsSalesMenuAsset": {
    "kind": "FIXED",
    "max": 36,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 36,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "stageStoreServicePointImage": {
    "kind": "FIXED",
    "max": 25,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 25,
        "reason": "Dexter 2026-09-18 implementation authorization: retain the complete owner transaction, security boundaries and authoritative readback after three managed CP-05 measurements; no safe consolidation remains.",
        "decisionRef": "IMPLEMENTATION-AGENT-2026-09-18-SERVICE-POINT-ASSET-STAGE-P3"
      }
    ]
  },
  "transitionOperationsBusinessChannelStatus": {
    "kind": "FIXED",
    "max": 23,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 23,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "transitionOperationsBusinessChannelTemplateStatus": {
    "kind": "FIXED",
    "max": 23,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 23,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "transitionOperationsOrganizationBrandStatus": {
    "kind": "FIXED",
    "max": 23,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 23,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "transitionOperationsOrganizationHeadCompanyStatus": {
    "kind": "FIXED",
    "max": 19,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 19,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "transitionOperationsOrganizationNodeStatus": {
    "kind": "FIXED",
    "max": 23,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 23,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "transitionOperationsOrganizationStoreStatus": {
    "kind": "FIXED",
    "max": 18,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 18,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "transitionOperationsOrganizationTenantStatus": {
    "kind": "FIXED",
    "max": 23,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 23,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "updateOperationsBusinessChannel": {
    "kind": "FIXED",
    "max": 23,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 23,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "updateOperationsBusinessChannelTemplate": {
    "kind": "FIXED",
    "max": 24,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 24,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "updateOperationsCommercialGroup": {
    "kind": "FIXED",
    "max": 24,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 24,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "updateOperationsContract": {
    "kind": "FIXED",
    "max": 22,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 22,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "updateOperationsOrganizationBrand": {
    "kind": "FIXED",
    "max": 23,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 23,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "updateOperationsOrganizationHeadCompany": {
    "kind": "FIXED",
    "max": 23,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 23,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "updateOperationsOrganizationNode": {
    "kind": "FIXED",
    "max": 22,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 22,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "updateOperationsOrganizationStore": {
    "kind": "FIXED",
    "max": 23,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 23,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "updateOperationsOrganizationTenant": {
    "kind": "FIXED",
    "max": 23,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 23,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "updateOperationsSalesMenuItem": {
    "kind": "FIXED",
    "max": 51,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 51,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "updateOperationsSalesMenuSchedule": {
    "kind": "FIXED",
    "max": 29,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 29,
        "reason": "Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.",
        "decisionRef": "DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "verifyOperationsWorkspaceOtp": {
    "kind": "FIXED",
    "max": 21,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 21,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  }
} as const;

export const OPERATIONS_ADMIN_OPERATION_IDS = {
  "addOperationsOrganizationHeadCompanyBrandAuthorization": "addOperationsOrganizationHeadCompanyBrandAuthorization",
  "addOperationsSalesMenuItems": "addOperationsSalesMenuItems",
  "archiveOperationsSalesMenu": "archiveOperationsSalesMenu",
  "cancelOperationsStoreTerminalActivation": "cancelOperationsStoreTerminalActivation",
  "cancelOperationsWorkspaceGroupInvitation": "cancelOperationsWorkspaceGroupInvitation",
  "cancelOperationsWorkspaceHeadCompanyInvitation": "cancelOperationsWorkspaceHeadCompanyInvitation",
  "cancelOperationsWorkspaceProjectInvitation": "cancelOperationsWorkspaceProjectInvitation",
  "cancelOperationsWorkspaceRegionInvitation": "cancelOperationsWorkspaceRegionInvitation",
  "cancelOperationsWorkspaceStoreInvitation": "cancelOperationsWorkspaceStoreInvitation",
  "changeCurrentWorkspacePassword": "changeCurrentWorkspacePassword",
  "copyOperationsSalesMenu": "copyOperationsSalesMenu",
  "createOperationsBusinessChannel": "createOperationsBusinessChannel",
  "createOperationsBusinessChannelTemplate": "createOperationsBusinessChannelTemplate",
  "createOperationsContract": "createOperationsContract",
  "createOperationsOrganizationBrand": "createOperationsOrganizationBrand",
  "createOperationsOrganizationHeadCompany": "createOperationsOrganizationHeadCompany",
  "createOperationsOrganizationProject": "createOperationsOrganizationProject",
  "createOperationsOrganizationRegion": "createOperationsOrganizationRegion",
  "createOperationsOrganizationStore": "createOperationsOrganizationStore",
  "createOperationsOrganizationTenant": "createOperationsOrganizationTenant",
  "createOperationsOwnerBinding": "createOperationsOwnerBinding",
  "createOperationsSalesMenu": "createOperationsSalesMenu",
  "createOperationsSalesMenuSection": "createOperationsSalesMenuSection",
  "createOperationsWorkspaceGroupInvitation": "createOperationsWorkspaceGroupInvitation",
  "createOperationsWorkspaceHeadCompanyInvitation": "createOperationsWorkspaceHeadCompanyInvitation",
  "createOperationsWorkspaceProjectInvitation": "createOperationsWorkspaceProjectInvitation",
  "createOperationsWorkspaceRegionInvitation": "createOperationsWorkspaceRegionInvitation",
  "createOperationsWorkspaceStoreInvitation": "createOperationsWorkspaceStoreInvitation",
  "deleteOperationsOwnerBinding": "deleteOperationsOwnerBinding",
  "deleteOperationsSalesMenuItem": "deleteOperationsSalesMenuItem",
  "deleteOperationsSalesMenuSection": "deleteOperationsSalesMenuSection",
  "getOperationsBusinessChannelDetail": "getOperationsBusinessChannelDetail",
  "getOperationsBusinessChannelTemplates": "getOperationsBusinessChannelTemplates",
  "getOperationsBusinessChannelTemplateVisibleStores": "getOperationsBusinessChannelTemplateVisibleStores",
  "getOperationsContract": "getOperationsContract",
  "getOperationsContractCandidates": "getOperationsContractCandidates",
  "getOperationsContractExtensionDefinition": "getOperationsContractExtensionDefinition",
  "getOperationsContracts": "getOperationsContracts",
  "getOperationsEntityAuditHistory": "getOperationsEntityAuditHistory",
  "getOperationsExternalCapabilityDictionary": "getOperationsExternalCapabilityDictionary",
  "getOperationsExternalProviderCandidates": "getOperationsExternalProviderCandidates",
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
  "getOperationsOrganizationStoreExtensionDefinition": "getOperationsOrganizationStoreExtensionDefinition",
  "getOperationsOrganizationStoreOperatingRule": "getOperationsOrganizationStoreOperatingRule",
  "getOperationsOrganizationStores": "getOperationsOrganizationStores",
  "getOperationsOrganizationTenant": "getOperationsOrganizationTenant",
  "getOperationsOrganizationTenants": "getOperationsOrganizationTenants",
  "getOperationsOwnerBindingDetail": "getOperationsOwnerBindingDetail",
  "getOperationsProjectBusinessChannels": "getOperationsProjectBusinessChannels",
  "getOperationsSalesMenu": "getOperationsSalesMenu",
  "getOperationsSalesMenuDraftItem": "getOperationsSalesMenuDraftItem",
  "getOperationsSalesMenuDraftItems": "getOperationsSalesMenuDraftItems",
  "getOperationsSalesMenuDraftSections": "getOperationsSalesMenuDraftSections",
  "getOperationsSalesMenuItemCandidates": "getOperationsSalesMenuItemCandidates",
  "getOperationsSalesMenuOperationRecords": "getOperationsSalesMenuOperationRecords",
  "getOperationsSalesMenuPublicationPreview": "getOperationsSalesMenuPublicationPreview",
  "getOperationsSalesMenuPublishedItem": "getOperationsSalesMenuPublishedItem",
  "getOperationsSalesMenuPublishedItems": "getOperationsSalesMenuPublishedItems",
  "getOperationsSalesMenuPublishedSections": "getOperationsSalesMenuPublishedSections",
  "getOperationsSalesMenus": "getOperationsSalesMenus",
  "getOperationsStoreBusinessChannels": "getOperationsStoreBusinessChannels",
  "getOperationsStoreBusinessChannelTemplateCandidates": "getOperationsStoreBusinessChannelTemplateCandidates",
  "getOperationsStoreProfile": "getOperationsStoreProfile",
  "getOperationsStoreQrChannelCandidates": "getOperationsStoreQrChannelCandidates",
  "getOperationsStoreQrConfiguration": "getOperationsStoreQrConfiguration",
  "getOperationsStoreServicePoint": "getOperationsStoreServicePoint",
  "getOperationsStoreServicePointAreas": "getOperationsStoreServicePointAreas",
  "getOperationsStoreServicePoints": "getOperationsStoreServicePoints",
  "getOperationsStoreTerminal": "getOperationsStoreTerminal",
  "getOperationsStoreTerminalAreaCandidates": "getOperationsStoreTerminalAreaCandidates",
  "getOperationsStoreTerminals": "getOperationsStoreTerminals",
  "getOperationsStoreTerminalTagCandidates": "getOperationsStoreTerminalTagCandidates",
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
  "moveOperationsSalesMenuItem": "moveOperationsSalesMenuItem",
  "moveOperationsSalesMenuSection": "moveOperationsSalesMenuSection",
  "operationsWorkspaceLogout": "operationsWorkspaceLogout",
  "operationsWorkspacePasswordLogin": "operationsWorkspacePasswordLogin",
  "patchOperationsStoreQrConfiguration": "patchOperationsStoreQrConfiguration",
  "patchOperationsStoreServicePoint": "patchOperationsStoreServicePoint",
  "patchOperationsStoreServicePointArea": "patchOperationsStoreServicePointArea",
  "postOperationsStoreServicePoint": "postOperationsStoreServicePoint",
  "postOperationsStoreServicePointArea": "postOperationsStoreServicePointArea",
  "postOperationsStoreServicePointAreaOrder": "postOperationsStoreServicePointAreaOrder",
  "postOperationsStoreServicePointAreaStatus": "postOperationsStoreServicePointAreaStatus",
  "postOperationsStoreServicePointOrder": "postOperationsStoreServicePointOrder",
  "postOperationsStoreServicePointStatus": "postOperationsStoreServicePointStatus",
  "postOperationsStoreTerminal": "postOperationsStoreTerminal",
  "postOperationsStoreTerminalStatus": "postOperationsStoreTerminalStatus",
  "publishOperationsSalesMenu": "publishOperationsSalesMenu",
  "putOperationsStoreTerminal": "putOperationsStoreTerminal",
  "reissueOperationsWorkspaceGroupInvitation": "reissueOperationsWorkspaceGroupInvitation",
  "reissueOperationsWorkspaceHeadCompanyInvitation": "reissueOperationsWorkspaceHeadCompanyInvitation",
  "reissueOperationsWorkspaceProjectInvitation": "reissueOperationsWorkspaceProjectInvitation",
  "reissueOperationsWorkspaceRegionInvitation": "reissueOperationsWorkspaceRegionInvitation",
  "reissueOperationsWorkspaceStoreInvitation": "reissueOperationsWorkspaceStoreInvitation",
  "releaseOperationsSalesMenuStagedAsset": "releaseOperationsSalesMenuStagedAsset",
  "releaseStagedStoreServicePointImage": "releaseStagedStoreServicePointImage",
  "removeOperationsOrganizationHeadCompanyBrandAuthorization": "removeOperationsOrganizationHeadCompanyBrandAuthorization",
  "renameOperationsSalesMenu": "renameOperationsSalesMenu",
  "renameOperationsSalesMenuSection": "renameOperationsSalesMenuSection",
  "restoreOperationsSalesMenuItemSale": "restoreOperationsSalesMenuItemSale",
  "revokeOperationsWorkspaceGroupUserAssignment": "revokeOperationsWorkspaceGroupUserAssignment",
  "revokeOperationsWorkspaceHeadCompanyUserAssignment": "revokeOperationsWorkspaceHeadCompanyUserAssignment",
  "revokeOperationsWorkspaceProjectUserAssignment": "revokeOperationsWorkspaceProjectUserAssignment",
  "revokeOperationsWorkspaceRegionUserAssignment": "revokeOperationsWorkspaceRegionUserAssignment",
  "revokeOperationsWorkspaceStoreUserAssignment": "revokeOperationsWorkspaceStoreUserAssignment",
  "selectOperationsWorkspaceSessionContext": "selectOperationsWorkspaceSessionContext",
  "selectOperationsWorkspaceSessionDataNode": "selectOperationsWorkspaceSessionDataNode",
  "sendOperationsWorkspaceOtp": "sendOperationsWorkspaceOtp",
  "setOperationsSalesMenuActivation": "setOperationsSalesMenuActivation",
  "setOperationsSalesMenuItemSoldOut": "setOperationsSalesMenuItemSoldOut",
  "stageOperationsSalesMenuAsset": "stageOperationsSalesMenuAsset",
  "stageStoreServicePointImage": "stageStoreServicePointImage",
  "transitionOperationsBusinessChannelStatus": "transitionOperationsBusinessChannelStatus",
  "transitionOperationsBusinessChannelTemplateStatus": "transitionOperationsBusinessChannelTemplateStatus",
  "transitionOperationsOrganizationBrandStatus": "transitionOperationsOrganizationBrandStatus",
  "transitionOperationsOrganizationHeadCompanyStatus": "transitionOperationsOrganizationHeadCompanyStatus",
  "transitionOperationsOrganizationNodeStatus": "transitionOperationsOrganizationNodeStatus",
  "transitionOperationsOrganizationStoreStatus": "transitionOperationsOrganizationStoreStatus",
  "transitionOperationsOrganizationTenantStatus": "transitionOperationsOrganizationTenantStatus",
  "updateOperationsBusinessChannel": "updateOperationsBusinessChannel",
  "updateOperationsBusinessChannelTemplate": "updateOperationsBusinessChannelTemplate",
  "updateOperationsCommercialGroup": "updateOperationsCommercialGroup",
  "updateOperationsContract": "updateOperationsContract",
  "updateOperationsOrganizationBrand": "updateOperationsOrganizationBrand",
  "updateOperationsOrganizationHeadCompany": "updateOperationsOrganizationHeadCompany",
  "updateOperationsOrganizationNode": "updateOperationsOrganizationNode",
  "updateOperationsOrganizationStore": "updateOperationsOrganizationStore",
  "updateOperationsOrganizationTenant": "updateOperationsOrganizationTenant",
  "updateOperationsSalesMenuItem": "updateOperationsSalesMenuItem",
  "updateOperationsSalesMenuSchedule": "updateOperationsSalesMenuSchedule",
  "verifyOperationsWorkspaceOtp": "verifyOperationsWorkspaceOtp"
} as const;

export const EDGE_PROBLEM_CODES = [
  "ADAPTER_UNBIND_REQUIRED",
  "AUTHORIZATION_REQUIRED",
  "BINDING_EDIT_NOT_ALLOWED",
  "BINDING_NOT_EFFECTIVE",
  "BUSINESS_CHANNEL_STORE_NOT_IN_PROJECT",
  "BUSINESS_CHANNEL_STORE_VISIBILITY_DUPLICATE",
  "BUSINESS_CHANNEL_STORE_VISIBILITY_NOT_APPLICABLE",
  "BUSINESS_CHANNEL_STORE_VISIBILITY_SCOPE_REQUIRED",
  "BUSINESS_CHANNEL_STORE_VISIBILITY_STALE",
  "BUSINESS_SCOPE_EXCEEDED",
  "CONFIRMATION_REQUIRED",
  "CONTRACT_ALREADY_INVALID",
  "CONTRACT_DATE_RANGE_INVALID",
  "CONTRACT_ITEM_CODE_DUPLICATE",
  "CONTRACT_ITEM_CODE_REQUIRED",
  "CONTRACT_NUMBER_CONFLICT",
  "CONTRACT_REFERENCE_UNRESOLVED",
  "CONTRACT_VERSION_CONFLICT",
  "DELETE_NOT_ALLOWED",
  "DINE_IN_FORM_MISMATCH",
  "DUPLICATE_CODE",
  "EXTENSION_DEFINITION_REVISION_STALE",
  "EXTENSION_FILTER_INVALID",
  "EXTERNAL_OWNER_ID_MISMATCH",
  "IMMUTABLE_FIELD",
  "ORDER_KIND_MISMATCH",
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
  "ORGANIZATION_STORE_CATALOG_MANAGEMENT_DISABLED",
  "ORGANIZATION_STORE_CODE_CONFLICT",
  "ORGANIZATION_STORE_EXTENSION_VERSION_CONFLICT",
  "ORGANIZATION_STORE_FIXED_SCOPE_FORBIDDEN",
  "ORGANIZATION_STORE_HEAD_COMPANY_AUTHORIZATION_REQUIRED",
  "ORGANIZATION_STORE_NAME_CONFLICT",
  "ORGANIZATION_STORE_OPERATING_RULES_INVALID",
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
  "PROJECT_DINE_IN_EXTERNAL_NOT_ALLOWED",
  "PROVIDER_NOT_ENABLED",
  "SALES_ITEM_NOT_FOUND",
  "SALES_MENU_ARCHIVED",
  "SALES_MENU_ASSET_INVALID",
  "SALES_MENU_ASSET_LIFECYCLE_CONFLICT",
  "SALES_MENU_ASSET_TARGET_MISMATCH",
  "SALES_MENU_CAPABILITY_REQUIRED",
  "SALES_MENU_CHANNEL_DISABLED",
  "SALES_MENU_CHANNEL_INELIGIBLE",
  "SALES_MENU_CONSTRAINT_INVALID",
  "SALES_MENU_DRAFT_INVALID",
  "SALES_MENU_IDEMPOTENCY_CONFLICT",
  "SALES_MENU_ITEM_REFERENCE_INVALID",
  "SALES_MENU_MANUAL_REASON_REQUIRED",
  "SALES_MENU_MANUAL_TARGET_INVALID",
  "SALES_MENU_MOVE_BOUNDARY",
  "SALES_MENU_NOT_FOUND",
  "SALES_MENU_ORDER_OPTION_REFERENCE_INVALID",
  "SALES_MENU_ORDER_OPTION_SELECTION_INVALID",
  "SALES_MENU_ORDER_OPTION_SHAPE_UNSUPPORTED",
  "SALES_MENU_PRICE_REQUIRED",
  "SALES_MENU_PUBLICATION_REQUIRED",
  "SALES_MENU_RESULT_UNKNOWN",
  "SALES_MENU_SCHEDULE_INVALID",
  "SALES_MENU_SCOPE_MISMATCH",
  "SALES_MENU_SECTION_NOT_EMPTY",
  "SALES_MENU_SKU_REFERENCE_INVALID",
  "SALES_MENU_STORE_DISABLED",
  "SALES_MENU_VERSION_CONFLICT",
  "SALES_SECTION_NOT_FOUND",
  "STORE_TERMINAL_ACTIVATION_CODE_CONFLICT",
  "STORE_TERMINAL_ACTIVATION_CODE_EXHAUSTED",
  "STORE_TERMINAL_NAME_CONFLICT",
  "STORE_TERMINAL_REFERENCE_INVALID",
  "STORE_TERMINAL_RULE_INVALID",
  "STORE_TERMINAL_STATUS_TRANSITION_INVALID",
  "STORE_TERMINAL_VOIDED_IMMUTABLE",
  "TERMINAL_BINDING_CHANGED",
  "TERMINAL_BINDING_NOT_ACTIVE",
  "VERSION_CONFLICT",
  "VOIDED_RECORD_IMMUTABLE",
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

export type Uuid = string & { readonly __uuid: "Uuid" };

export type AuditChange = {
  fieldKey: string;
  fieldLabelSnapshot?: (string) | null;
  beforeState?: AuditValueState;
  beforeValue?: (string) | null;
  afterState?: AuditValueState;
  afterValue?: (string) | null;
};

export type AuditHistoryItem = {
  id: string & { readonly __uuid: "Uuid" };
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

export type AuditValueState = "MISSING" | "NULL" | "CLEARED" | "VALUE";

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
  definitionRevision?: (number) | null;
};
  items: Array<Brand>;
};

export type BrandUpdateRequest = (BrandCreateRequest) & ({
  expectedVersion: number;
});

export type BusinessChannelCreateRequest = {
  templateRef: string & { readonly __uuid: "Uuid" };
  ownerNodeType: "PROJECT" | "STORE";
  ownerNodeRef: string & { readonly __uuid: "Uuid" };
  channelCode: string;
  channelName: string;
  bindingRef?: string & { readonly __uuid: "Uuid" } | null;
};

export type BusinessChannelPage = {
  items: Array<BusinessChannelView>;
  cursor: (string) | null;
  nextCursor: (string) | null;
};

export type BusinessChannelSortKey = "CHANNEL_NAME" | "CHANNEL_CODE" | "TEMPLATE_NAME" | "STATUS" | "BINDING_STATUS";

export type BusinessChannelStatusRequest = {
  status: "DISABLED" | "ENABLED" | "VOIDED";
  expectedVersion: number;
};

export type BusinessChannelTemplateCandidatePage = {
  items: Array<BusinessChannelTemplateView>;
  nextCursor: string | null;
  total: number;
};

export type BusinessChannelTemplateCreateRequest = {
  projectRef: string & { readonly __uuid: "Uuid" };
  templateName: string;
  templateCode: string;
  accessKind: "INTERNAL" | "EXTERNAL";
  operatorKind: "PROJECT" | "STORE";
  orderKind: "DINE_IN" | "TAKEAWAY" | "GROUP_BUY";
  dineInForm?: "POS" | "QR" | "KIOSK" | null | null;
  providerCode?: string | null;
  urlRule?: string | null;
  storeVisibilityScope: BusinessChannelTemplateStoreVisibilityScope;
  visibleStoreRefs: Array<string & { readonly __uuid: "Uuid" }>;
};

export type BusinessChannelTemplatePage = {
  items: Array<BusinessChannelTemplateView>;
};

export type BusinessChannelTemplateSortKey = "TEMPLATE_NAME" | "TEMPLATE_CODE" | "ACCESS_KIND" | "OPERATOR_KIND" | "ORDER_KIND" | "STATUS";

export type BusinessChannelTemplateStatusRequest = {
  status: "ENABLED" | "DISABLED" | "VOIDED";
  expectedVersion: number;
};

export type BusinessChannelTemplateStoreVisibilityScope = "ALL_PROJECT_STORES" | "SELECTED_PROJECT_STORES" | null | null;

export type BusinessChannelTemplateUpdateRequest = {
  templateName: string;
  expectedVersion: number;
  storeVisibilityScope: BusinessChannelTemplateStoreVisibilityScope;
  urlRule?: string | null;
  visibleStoreRefs: Array<string & { readonly __uuid: "Uuid" }>;
};

export type BusinessChannelTemplateView = {
  templateRef: string & { readonly __uuid: "Uuid" };
  projectRef: string & { readonly __uuid: "Uuid" };
  templateName: string;
  templateCode?: string | null;
  accessKind: "INTERNAL" | "EXTERNAL";
  operatorKind: "PROJECT" | "STORE";
  orderKind: "DINE_IN" | "TAKEAWAY" | "GROUP_BUY";
  dineInForm?: "POS" | "QR" | "KIOSK" | null | null;
  providerCode?: string | null;
  urlRule?: string | null;
  storeVisibilityScope: BusinessChannelTemplateStoreVisibilityScope;
  visibleStoreCount: number;
  status: "ENABLED" | "DISABLED" | "VOIDED";
  statusDimensions: Array<{
  type: "BUSINESS_CHANNEL_TEMPLATE" | "GROUP_WORKSPACE" | "ORGANIZATION_GROUP" | "ORGANIZATION_REGION" | "ORGANIZATION_PROJECT" | "ORGANIZATION_STORE" | "ORGANIZATION_TENANT" | "ORGANIZATION_BRAND" | "COLLABORATION_EXTERNAL_SYSTEM" | "COLLABORATION_PROVIDER_PROFILE" | "COLLABORATION_BINDING";
  ref: string;
  status: "ENABLED" | "DISABLED" | "VOIDED";
}>;
  blockers: Array<{
  type: "BUSINESS_CHANNEL_TEMPLATE" | "GROUP_WORKSPACE" | "ORGANIZATION_GROUP" | "ORGANIZATION_REGION" | "ORGANIZATION_PROJECT" | "ORGANIZATION_STORE" | "ORGANIZATION_TENANT" | "ORGANIZATION_BRAND" | "COLLABORATION_EXTERNAL_SYSTEM" | "COLLABORATION_PROVIDER_PROFILE" | "COLLABORATION_BINDING";
  ref: string;
  status: "ENABLED" | "DISABLED" | "VOIDED";
}>;
  version: number;
};

export type BusinessChannelTemplateVisibleStore = {
  storeRef: string & { readonly __uuid: "Uuid" };
  storeCode: string;
  storeName: string;
  storeStatus: "ENABLED" | "DISABLED" | "VOIDED";
};

export type BusinessChannelTemplateVisibleStorePage = {
  items: Array<BusinessChannelTemplateVisibleStore>;
  nextCursor: string | null;
  total: number;
};

export type BusinessChannelUpdateRequest = {
  channelName: string;
  bindingRef?: string & { readonly __uuid: "Uuid" } | null;
  expectedVersion: number;
};

export type BusinessChannelView = {
  channelRef: string & { readonly __uuid: "Uuid" };
  templateRef: string & { readonly __uuid: "Uuid" };
  ownerNodeType: "PROJECT" | "STORE";
  ownerNodeRef: string & { readonly __uuid: "Uuid" };
  channelCode?: string | null;
  channelName: string;
  bindingRef?: string & { readonly __uuid: "Uuid" } | null;
  status: "DISABLED" | "ENABLED" | "VOIDED";
  bindingStatus: "NOT_REQUIRED" | "UNBOUND" | "BOUND";
  selfStatus: "ENABLED" | "DISABLED" | "VOIDED";
  statusDimensions: Array<{
  type: "BUSINESS_CHANNEL_TEMPLATE" | "GROUP_WORKSPACE" | "ORGANIZATION_GROUP" | "ORGANIZATION_REGION" | "ORGANIZATION_PROJECT" | "ORGANIZATION_STORE" | "ORGANIZATION_TENANT" | "ORGANIZATION_BRAND" | "COLLABORATION_EXTERNAL_SYSTEM" | "COLLABORATION_PROVIDER_PROFILE" | "COLLABORATION_BINDING";
  ref: string;
  status: "ENABLED" | "DISABLED" | "VOIDED" | "PENDING_AUTHORIZATION" | "EFFECTIVE" | "INVALID" | "DELETED";
}>;
  blockers: Array<{
  type: "BUSINESS_CHANNEL_TEMPLATE" | "GROUP_WORKSPACE" | "ORGANIZATION_GROUP" | "ORGANIZATION_REGION" | "ORGANIZATION_PROJECT" | "ORGANIZATION_STORE" | "ORGANIZATION_TENANT" | "ORGANIZATION_BRAND" | "COLLABORATION_EXTERNAL_SYSTEM" | "COLLABORATION_PROVIDER_PROFILE";
  ref: string;
  status: "ENABLED" | "DISABLED" | "VOIDED";
}>;
  version: number;
};

export type BusinessEntitySortDirection = "ASC" | "DESC";

export type BusinessEntitySortKey = "NAME" | "CODE" | "UPDATED_AT";

export type BusinessEntityStatus = "ENABLED" | "DISABLED" | "VOIDED";

export type BusinessEntityStatusRequest = {
  targetStatus: BusinessEntityStatus;
  expectedVersion: number;
};

export type CapabilityDictionary = {
  externalSystems: Array<ExternalSystemView>;
  providerProfiles: Array<ProviderProfileView>;
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
  type: ExtensionFieldType;
  listDisplay: (boolean) | null;
  searchable: (boolean) | null;
  required: boolean;
  options: Array<string>;
  status: "ENABLED" | "DISABLED";
  displayOrder?: number;
  displaySuffix?: (string) | null;
}>;
  revision: number;
  updatedAt: EpochMillis;
  workspaceStatus: GroupWorkspaceStatus;
  blockers: Array<ExtensionDefinitionBlocker>;
};

export type ExtensionDefinitionBlocker = {
  type: "WORKSPACE";
  status: GroupWorkspaceStatus;
};

export type ExtensionEntityType = "BRAND" | "TENANT" | "HEAD_COMPANY" | "STORE" | "CONTRACT" | "COMMERCIAL_GROUP" | "REGION" | "PROJECT" | "SERVICE_POINT";

export type ExtensionFieldType = "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT";

export type ExtensionFilter = {
  fieldKey: string;
  type: ExtensionFieldType;
  value: string;
};

export type ExtensionFilterQuery = string;

export type ExternalCapability = {
  capabilityClass: "MASTER_DATA_SYNC" | "MEMBER_BENEFIT" | "GROUP_BUY" | "TAKEAWAY" | "DINE_IN" | "INVENTORY_SYNC" | "TAKEAWAY_DELIVERY" | "ORDER_SYNC";
  displayName: string;
  attributeValues: {
  groupBuyMappingDirection?: "EXTERNAL_TO_INTERNAL" | "INTERNAL_TO_EXTERNAL";
  menuCollaborationDirection?: "PULL_ONLY";
};
};

export type ExternalProviderCandidatePage = {
  items: Array<ProviderProfileView>;
  nextCursor: string | null;
  total: number;
};

export type ExternalSystemView = {
  externalSystemCode: string;
  displayName: string;
  catalogStatus: "PLANNED" | "AVAILABLE";
  capabilities: Array<ExternalCapability>;
  enablementStatus: "ENABLED" | "DISABLED";
  version: number;
};

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
  brandId: string & { readonly __uuid: "Uuid" };
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
  definitionRevision?: (number) | null;
};
  items: Array<HeadCompany>;
};

export type HeadCompanyUpdateRequest = (HeadCompanyCreateRequest) & ({
  expectedVersion: number;
});

export type InventoryAvailabilityFact = {
  applicability: "NOT_APPLICABLE" | "APPLICABLE";
  state: "AVAILABLE" | "AUTO_UNAVAILABLE" | "UNKNOWN";
  reason: ("OUT_OF_STOCK" | "NEGATIVE_NOT_ALLOWED" | "READ_UNAVAILABLE") | null;
};

export type InvitationRouteFacts = {
  groupWorkspaceKey: string;
  invitationToken: string;
};

export type ManualSaleStatusFact = {
  state: "NORMAL" | "MANUAL_SOLD_OUT";
  reason: (string) | null;
  changedAt: (number) | null;
  changedByDisplayName: (string) | null;
};

export type NoBody = Record<string, never>;

export type NoContent = null;

export type OperationsTerminalActivationCancellationRequest = {
  expectedBindingGeneration: number;
};

export type OperationsTerminalActivationCancellationResult = {
  outcome: string;
};

export type OrganizationCandidatePage = {
  metadata: OrganizationCandidatePageMetadata;
  items: Array<OrganizationCandidatePageItemsItem>;
};

export type OrganizationCandidatePageItemsItem = {
  id: string & { readonly __uuid: "Uuid" };
  code: string;
  name: string;
};

export type OrganizationCandidatePageMetadata = {
  subjectType: OrganizationCandidateQuerySubjectType;
  queryText: (string) | null;
  page: number;
  pageSize: number;
  total: number;
  selectedId: (string & { readonly __uuid: "Uuid" }) | null;
};

export type OrganizationCandidateQuerySubjectType = "COMMERCIAL_GROUP" | "REGION" | "PROJECT" | "BRAND" | "TENANT" | "HEAD_COMPANY" | "STORE";

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

export type OrganizationPathNode = {
  ref: string & { readonly __uuid: "Uuid" };
  code: string;
  name: string;
  nodeType: ServiceNodeType;
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
  operatingRuleSwitches: OrganizationStoreOperatingRuleValues;
};

export type OrganizationStoreCreateRequest = {
  brandId: string;
  tenantId: string;
  headCompanyId?: (string) | null;
  code: string;
  name: string;
  notes?: (string) | null;
  extensionValues?: Record<string, JsonValue>;
  operatingRuleSwitches?: OrganizationStoreOperatingRuleValues;
};

export type OrganizationStoreOperatingRuleValues = {
  catalogManagementEnabled: boolean;
  externalCatalogSyncEnabled: boolean;
  openPlatformDeveloperCode: string;
  reservationEnabled: boolean;
  reservationDepositEnabled: boolean;
  queueCallEnabled: boolean;
  tableManagementEnabled: boolean;
  tableStatusEnabled: boolean;
  tableWaitCallEnabled: boolean;
  banquetOrderEnabled: boolean;
  pickupCallEnabled: boolean;
  receivableEnabled: boolean;
};

export type OrganizationStorePage = {
  metadata: {
  groupWorkspaceKey: string;
  dataScope: {
  nodeType: "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  nodeRef: string & { readonly __uuid: "Uuid" };
  nodeName: string;
};
  page: number;
  pageSize: number;
  total: number;
  sort: OrganizationStoreSortKey;
  direction: OrganizationStoreSortDirection;
  definitionRevision?: (number) | null;
};
  items: Array<OrganizationStore>;
};

export type OrganizationStoreSortDirection = "ASC" | "DESC";

export type OrganizationStoreSortKey = "NAME" | "CODE" | "UPDATED_AT";

export type OrganizationStoreStatus = "ENABLED" | "DISABLED" | "VOIDED";

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
  operatingRuleSwitches: OrganizationStoreOperatingRuleValues;
};

export type OwnerBindingCreateRequest = {
  providerCode: string;
  capabilityClass?: "MASTER_DATA_SYNC" | "MEMBER_BENEFIT" | "GROUP_BUY" | "TAKEAWAY" | "DINE_IN" | "INVENTORY_SYNC" | "TAKEAWAY_DELIVERY" | "ORDER_SYNC" | null | null;
  nodeType: string;
  nodeRef: string & { readonly __uuid: "Uuid" };
  bindingDisplayName?: string | null;
  externalOwnerId?: string | null;
};

export type OwnerBindingDeleteRequest = {
  expectedVersion: number;
};

export type OwnerBindingView = {
  bindingRef: string & { readonly __uuid: "Uuid" };
  providerCode: string;
  providerDisplayName: string;
  capabilityClass?: "MASTER_DATA_SYNC" | "MEMBER_BENEFIT" | "GROUP_BUY" | "TAKEAWAY" | "DINE_IN" | "INVENTORY_SYNC" | "TAKEAWAY_DELIVERY" | "ORDER_SYNC" | null | null;
  businessScope: Array<"TAKEAWAY" | "DINE_IN" | "GROUP_BUY" | "ORDER_SYNC" | "MEMBER_BENEFIT">;
  nodeType: "COMMERCIAL_GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  nodeRef: string & { readonly __uuid: "Uuid" };
  nodePath: Array<OrganizationPathNode>;
  bindingDisplayName?: string | null;
  externalOwnerId?: string | null;
  boundAt: number;
  statusChangedAt: number;
  status: "PENDING_AUTHORIZATION" | "EFFECTIVE" | "INVALID" | "DELETED";
  version: number;
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

export type ProviderProfileView = {
  providerCode: string;
  displayName: string;
  externalSystemCode: string;
  externalSystemDisplayName: string;
  businessScope: Array<"TAKEAWAY" | "DINE_IN" | "GROUP_BUY" | "ORDER_SYNC" | "MEMBER_BENEFIT">;
  bindableNodeTypes: Array<"COMMERCIAL_GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE">;
  authenticationKind: "EXTERNAL_GRANT" | "INTERNAL_MAPPING" | "NO_MAPPING";
  unbindKind: "LOCAL_ONLY" | "REQUIRES_ADAPTER_UNBIND";
  catalogStatus: "PLANNED" | "AVAILABLE";
  enablementStatus: "ENABLED" | "DISABLED";
  version: number;
};

export type SalesMenuActivation = {
  channelRef: string & { readonly __uuid: "Uuid" };
  status: "ENABLED" | "DISABLED";
  version: number;
};

export type SalesMenuActivationRequest = {
  status: "ENABLED" | "DISABLED";
  expectedVersion: number;
};

export type SalesMenuArchiveRequest = {
  expectedVersion: number;
};

export type SalesMenuAssetReleaseReadback = {
  assetRef: string & { readonly __uuid: "Uuid" };
  status: "RELEASED";
  version: number;
  target: SalesMenuAssetTargetReadback;
};

export type SalesMenuAssetReleaseRequest = {
  expectedAssetVersion: number;
};

export type SalesMenuAssetStageReadback = {
  assetRef: string & { readonly __uuid: "Uuid" };
  bindGrant: string;
  status: "STAGED";
  version: number;
  target: SalesMenuAssetTargetReadback;
};

export type SalesMenuAssetStageRequest = {
  expectedDraftVersion: number;
  fileName: string;
  mediaType: string;
  contentDigest: string;
  content: Blob;
};

export type SalesMenuAssetTargetReadback = {
  groupWorkspaceKey: string;
  storeRef: string & { readonly __uuid: "Uuid" };
  salesMenuRef: string & { readonly __uuid: "Uuid" };
  salesItemRef: string & { readonly __uuid: "Uuid" };
  usage: "SALES_MENU_ITEM_IMAGE";
  expectedDraftVersion: number;
};

export type SalesMenuCandidatePage = {
  items: Array<SalesMenuItemCandidate>;
  cursor: (string) | null;
  nextCursor: (string) | null;
};

export type SalesMenuCommandReadback = {
  operationKind: string;
  salesMenuRef: string & { readonly __uuid: "Uuid" };
  targetRef?: (string & { readonly __uuid: "Uuid" }) | null;
  version: number;
  readbackStatus: "APPLIED" | "RELEASED" | "ARCHIVED" | "PUBLISHED";
};

export type SalesMenuCopyRequest = {
  expectedVersion: number;
};

export type SalesMenuCreateRequest = {
  channelRef: string & { readonly __uuid: "Uuid" };
  name: string;
};

export type SalesMenuDeleteRequest = {
  expectedVersion: number;
};

export type SalesMenuDetail = {
  salesMenuRef: string & { readonly __uuid: "Uuid" };
  groupWorkspaceKey: string;
  storeRef: string & { readonly __uuid: "Uuid" };
  name: string;
  archived: boolean;
  version: number;
  draftRevision: number;
  latestPublishedRevision: (number) | null;
  draftDirty: boolean;
  activation: (SalesMenuActivation) | null;
  draftSchedule: SalesMenuSchedule;
  latestPublishedSchedule: (SalesMenuSchedule) | null;
};

export type SalesMenuDisplayMedia = {
  mode: "INHERIT_CATALOG" | "CUSTOM";
  assetRefs: Array<string & { readonly __uuid: "Uuid" }>;
  primaryAssetRef: (string & { readonly __uuid: "Uuid" }) | null;
};

export type SalesMenuDraftItemView = {
  salesItemRef: string & { readonly __uuid: "Uuid" };
  catalogItemRef: string & { readonly __uuid: "Uuid" };
  itemCode: string;
  displayName: string;
  productShape: "ORDINARY" | "SKU" | "WEIGHTED" | "COMPOSITE" | "SERVICE";
  catalogOrderOptions: Array<{
  definitionRef: string & { readonly __uuid: "Uuid" };
  name: string;
  selectionMode: "SINGLE" | "MULTIPLE";
  displayOrder: number;
  required: boolean;
  minSelectionCount: (number) | null;
  maxSelectionCount: (number) | null;
  values: Array<{
  definitionValueRef: string & { readonly __uuid: "Uuid" };
  name: string;
  displayOrder: number;
  defaultValue: boolean;
  extraPrice: (number) | null;
}>;
}>;
  skuCandidates: Array<{
  skuRef: string & { readonly __uuid: "Uuid" };
  skuName: string;
  skuCode: string;
  standardPriceCents: number;
}>;
  staleSelectedSkuRefs: Array<string & { readonly __uuid: "Uuid" }>;
  defaultPriceCents: (number) | null;
  catalogPrimaryImageAssetRef: (string & { readonly __uuid: "Uuid" }) | null;
  catalogImageAssetRefs: Array<string & { readonly __uuid: "Uuid" }>;
  saleContent: SalesMenuSaleContent;
  orderingConstraints: SalesMenuOrderingConstraints;
  displayMedia: SalesMenuDisplayMedia;
  displayOrder: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  version: number;
};

export type SalesMenuItemCandidate = {
  candidateRef: string & { readonly __uuid: "Uuid" };
  catalogItemRef: string & { readonly __uuid: "Uuid" };
  itemCode: string;
  displayName: string;
  productShape: "ORDINARY" | "SKU" | "WEIGHTED" | "COMPOSITE" | "SERVICE";
  categoryRefs: Array<string & { readonly __uuid: "Uuid" }>;
  categoryNames: Array<string>;
  defaultPriceCents: (number) | null;
  alreadyAddedCount: number;
};

export type SalesMenuItemMoveRequest = {
  direction: "UP" | "DOWN";
  expectedVersion: number;
};

export type SalesMenuItemPage = {
  items: Array<SalesMenuDraftItemView>;
  cursor: (string) | null;
  nextCursor: (string) | null;
};

export type SalesMenuItemUpdateRequest = {
  displayNameOverride: (string) | null;
  saleContent: {
  kind: "DIRECT" | "SKU_SELECTION" | "WEIGHTED" | "COMPOSITE";
  listedPriceCents: (number) | null;
  skuPrices: Array<SalesMenuSkuPrice>;
  orderOptionSelections: Array<{
  definitionRef: string & { readonly __uuid: "Uuid" };
  selectedValueRefs: Array<string & { readonly __uuid: "Uuid" }>;
}>;
};
  orderingConstraints: SalesMenuOrderingConstraints;
  displayMedia: SalesMenuDisplayMedia;
  expectedVersion: number;
};

export type SalesMenuItemsAddRequest = {
  catalogItemRefs: Array<string & { readonly __uuid: "Uuid" }>;
  expectedVersion: number;
};

export type SalesMenuManualRestoreRequest = {
  target: {
  targetKind: "ITEM" | "SKU" | "ORDER_OPTION_VALUE";
  targetRef: string & { readonly __uuid: "Uuid" };
};
  confirm: boolean;
  expectedVersion: number;
};

export type SalesMenuManualSoldOutRequest = {
  target: {
  targetKind: "ITEM" | "SKU" | "ORDER_OPTION_VALUE";
  targetRef: string & { readonly __uuid: "Uuid" };
};
  reason: string;
  expectedVersion: number;
};

export type SalesMenuOperationRecord = {
  operationRecordRef: string & { readonly __uuid: "Uuid" };
  occurredAt: number;
  operationKind: string;
  salesMenuRef: string & { readonly __uuid: "Uuid" };
  targetRef: (string & { readonly __uuid: "Uuid" }) | null;
  targetKind: "ITEM" | "SKU" | "ORDER_OPTION_VALUE";
  targetDisplaySnapshot: (string) | null;
  result: "SUCCESS" | "FAILED";
  failureCode: (string) | null;
  actorDisplayName: string;
};

export type SalesMenuOperationRecordPage = {
  items: Array<SalesMenuOperationRecord>;
  cursor: (string) | null;
  nextCursor: (string) | null;
};

export type SalesMenuOrderingConstraints = {
  minItemQuantity: (number) | null;
  quantityStep: (number) | null;
};

export type SalesMenuPage = {
  items: Array<SalesMenuSummary>;
  cursor: (string) | null;
  nextCursor: (string) | null;
};

export type SalesMenuPublicationBlocker = {
  kind: "STORE_DISABLED" | "CHANNEL_DISABLED" | "CHANNEL_INELIGIBLE" | "CATALOG_ITEM_INVALID" | "SKU_SELECTION_EMPTY" | "SKU_INVALID" | "ORDER_OPTION_SELECTION_INVALID" | "LISTED_PRICE_MISSING" | "ORDERING_CONSTRAINT_INVALID" | "DISPLAY_ASSET_PENDING_OR_INVALID" | "SCHEDULE_INVALID";
  salesItemRef: (string & { readonly __uuid: "Uuid" }) | null;
  messageKey: string;
};

export type SalesMenuPublicationPreview = {
  salesMenuRef: string & { readonly __uuid: "Uuid" };
  draftRevision: number;
  hasChanges: boolean;
  violations: Array<SalesMenuPublicationBlocker>;
};

export type SalesMenuPublishRequest = {
  expectedVersion: number;
};

export type SalesMenuPublishedItemPage = {
  items: Array<SalesMenuPublishedItemView>;
  cursor: (string) | null;
  nextCursor: (string) | null;
};

export type SalesMenuPublishedItemView = {
  salesItemRef: string & { readonly __uuid: "Uuid" };
  catalogItemRef: string & { readonly __uuid: "Uuid" };
  itemCode: string;
  displayName: string;
  productShape: "ORDINARY" | "SKU" | "WEIGHTED" | "COMPOSITE" | "SERVICE";
  saleContent: SalesMenuSaleContent;
  orderingConstraints: SalesMenuOrderingConstraints;
  displayMedia: SalesMenuDisplayMedia;
  publishedPrimaryImageAssetRef: (string & { readonly __uuid: "Uuid" }) | null;
  publishedCatalogImageAssetRefs: Array<string & { readonly __uuid: "Uuid" }>;
  displayOrder: number;
  inventoryAvailability: InventoryAvailabilityFact;
  manualSaleStatus: ManualSaleStatusFact;
  manualSaleTargetStatuses: Array<{
  targetKind: "ITEM" | "SKU" | "ORDER_OPTION_VALUE";
  targetRef: string & { readonly __uuid: "Uuid" };
  resolvedTargetDisplayName: string;
  state: "NORMAL" | "MANUAL_SOLD_OUT";
  reason: (string) | null;
  changedAt: (number) | null;
  changedByDisplayName: (string) | null;
}>;
  version: number;
};

export type SalesMenuPublishedSectionList = {
  items: Array<SalesMenuSectionView>;
};

export type SalesMenuRenameRequest = {
  name: string;
  expectedVersion: number;
};

export type SalesMenuSaleContent = {
  kind: "DIRECT" | "SKU_SELECTION" | "WEIGHTED" | "COMPOSITE";
  listedPriceCents: (number) | null;
  skuPrices: Array<SalesMenuSkuPrice>;
  selectedOrderOptions: Array<{
  definitionRef: string & { readonly __uuid: "Uuid" };
  name: string;
  selectionMode: "SINGLE" | "MULTIPLE";
  displayOrder: number;
  required: boolean;
  minSelectionCount: (number) | null;
  maxSelectionCount: (number) | null;
  values: Array<{
  definitionValueRef: string & { readonly __uuid: "Uuid" };
  name: string;
  displayOrder: number;
  defaultValue: boolean;
  extraPrice: (number) | null;
}>;
}>;
  salesUnit: {
  unitRef: string & { readonly __uuid: "Uuid" };
  code: string;
  name: string;
  unitDimension: "COUNT" | "WEIGHT" | "VOLUME" | "SERVICE_DURATION" | "PACKAGE";
  precision: number;
};
};

export type SalesMenuSchedule = {
  kind: "ALL_DAY" | "DAILY_TIME_RANGE";
  startLocalTime: (string) | null;
  endLocalTime: (string) | null;
};

export type SalesMenuScheduleUpdateRequest = {
  schedule: SalesMenuSchedule;
  expectedVersion: number;
};

export type SalesMenuSectionCreateRequest = {
  name: string;
  expectedVersion: number;
};

export type SalesMenuSectionList = {
  items: Array<SalesMenuSectionView>;
};

export type SalesMenuSectionMoveRequest = {
  direction: "UP" | "DOWN";
  expectedVersion: number;
};

export type SalesMenuSectionRenameRequest = {
  name: string;
  expectedVersion: number;
};

export type SalesMenuSectionView = {
  salesSectionRef: string & { readonly __uuid: "Uuid" };
  name: string;
  displayOrder: number;
  itemCount: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export type SalesMenuSkuPrice = {
  skuRef: string & { readonly __uuid: "Uuid" };
  skuName: string;
  skuCode: string;
  standardPriceCents: number;
  listedPriceCents: number;
};

export type SalesMenuSummary = {
  salesMenuRef: string & { readonly __uuid: "Uuid" };
  storeRef: string & { readonly __uuid: "Uuid" };
  name: string;
  archived: boolean;
  version: number;
  draftRevision: number;
  latestPublishedRevision: (number) | null;
  draftDirty: boolean;
  activation: (SalesMenuActivation) | null;
  draftSchedule: SalesMenuSchedule;
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
  phaseName: (string) | null;
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
  projectRef: string & { readonly __uuid: "Uuid" };
  projectName: string;
  page: number;
  pageSize: number;
  total: number;
  sort: StoreContractSortKey;
  direction: StoreContractSortDirection;
  definitionRevision?: (number) | null;
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

export type StoreQrChannelCandidate = {
  channelRef: string & { readonly __uuid: "Uuid" };
  templateRef: string & { readonly __uuid: "Uuid" };
  channelCode: string | null;
  channelName: string;
  templateName: string;
  status: "ENABLED" | "DISABLED" | "VOIDED";
  bindingStatus: "NOT_REQUIRED" | "UNBOUND" | "BOUND";
  urlRule: string | null;
};

export type StoreQrChannelCandidatePage = {
  items: Array<StoreQrChannelCandidate>;
  nextCursor: null;
  total: number;
};

export type StoreQrConfigurationUpdateRequest = {
  enabled: boolean;
  channelRef?: string & { readonly __uuid: "Uuid" } | null;
  expectedVersion: number;
};

export type StoreQrConfigurationView = {
  storeRef: string & { readonly __uuid: "Uuid" };
  enabled: boolean;
  channelRef?: string & { readonly __uuid: "Uuid" } | null;
  channelName?: string | null;
  version: number;
  updatedAt: number;
};

export type StoreServicePoint = {
  pointRef: string & { readonly __uuid: "Uuid" };
  storeRef: string & { readonly __uuid: "Uuid" };
  areaRef: string & { readonly __uuid: "Uuid" };
  name: string;
  code: string;
  pointType: StoreServicePointType;
  status: StoreServicePointStatus;
  displayOrder: number;
  seatCapacity?: number | null;
  tableShape?: ((StoreServicePointShape)) | null;
  reservable?: boolean | null;
  imageAssetRef?: string & { readonly __uuid: "Uuid" } | null;
  extensionValues: Record<string, JsonValue>;
  extensionRuleRevision?: number | null;
  effectiveAvailable: boolean;
  qrUrl?: string | null;
  version: number;
  createdAt: number;
  updatedAt: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export type StoreServicePointArea = {
  areaRef: string & { readonly __uuid: "Uuid" };
  storeRef: string & { readonly __uuid: "Uuid" };
  name: string;
  code: string;
  areaType: StoreServicePointAreaType;
  status: StoreServicePointStatus;
  displayOrder: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export type StoreServicePointAreaCreateRequest = {
  name: string;
  code: string;
  areaType: StoreServicePointAreaType;
};

export type StoreServicePointAreaOrderRequest = {
  direction: StoreServicePointOrderDirection;
  expectedVersion: number;
};

export type StoreServicePointAreaPage = {
  items: Array<StoreServicePointArea>;
  nextCursor: string | null;
  total: number;
};

export type StoreServicePointAreaStatusRequest = {
  status: StoreServicePointStatus;
  expectedVersion: number;
};

export type StoreServicePointAreaType = "TABLE_AREA" | "SCAN_AREA";

export type StoreServicePointAreaUpdateRequest = {
  name: string;
  code: string;
  areaType: StoreServicePointAreaType;
  status: StoreServicePointStatus;
  expectedVersion: number;
};

export type StoreServicePointAssetReleaseReadback = {
  assetRef: string & { readonly __uuid: "Uuid" };
  status: "RELEASED";
  version: number;
};

export type StoreServicePointAssetReleaseRequest = {
  expectedAssetVersion: number;
};

export type StoreServicePointAssetStageReadback = {
  assetRef: string & { readonly __uuid: "Uuid" };
  bindGrant: string;
  status: "STAGED";
  version: number;
};

export type StoreServicePointAssetStageRequest = {
  fileName: string;
  mediaType: string;
  contentDigest: string;
  content: Blob;
};

export type StoreServicePointCreateRequest = {
  name: string;
  code: string;
  pointType: StoreServicePointType;
  seatCapacity?: number | null;
  tableShape?: ((StoreServicePointShape)) | null;
  reservable?: boolean | null;
  imageAssetRef?: string & { readonly __uuid: "Uuid" } | null;
  imageBindGrant?: string | null;
  extensionValues: Record<string, JsonValue>;
  extensionRuleRevision?: number | null;
};

export type StoreServicePointDetail = (StoreServicePoint);

export type StoreServicePointOrderDirection = "UP" | "DOWN";

export type StoreServicePointOrderRequest = {
  direction: StoreServicePointOrderDirection;
  expectedVersion: number;
};

export type StoreServicePointPage = {
  items: Array<StoreServicePoint>;
  nextCursor: string | null;
  total: number;
};

export type StoreServicePointShape = "HALL" | "PRIVATE_ROOM" | "BOOTH" | "OUTDOOR";

export type StoreServicePointStatus = "ENABLED" | "DISABLED" | "VOIDED";

export type StoreServicePointStatusRequest = {
  status: StoreServicePointStatus;
  expectedVersion: number;
};

export type StoreServicePointType = "TABLE" | "SCAN";

export type StoreServicePointUpdateRequest = {
  name: string;
  code: string;
  pointType: StoreServicePointType;
  status: StoreServicePointStatus;
  seatCapacity?: number | null;
  tableShape?: ((StoreServicePointShape)) | null;
  reservable?: boolean | null;
  imageAssetRef?: string & { readonly __uuid: "Uuid" } | null;
  imageBindGrant?: string | null;
  extensionValues: Record<string, JsonValue>;
  extensionRuleRevision?: number | null;
  expectedVersion: number;
};

export type StoreTerminalAreaCandidate = {
  areaRef: string & { readonly __uuid: "Uuid" };
  name: string;
  code: string;
};

export type StoreTerminalAreaCandidatePage = {
  items: Array<StoreTerminalAreaCandidate>;
  nextCursor: string | null;
  total: number;
};

export type StoreTerminalAreaReference = {
  areaRef: string & { readonly __uuid: "Uuid" };
  name: string;
  code: string;
  areaType: string;
  status: StoreTerminalStatus;
};

export type StoreTerminalBinding = {
  status: StoreTerminalBindingStatus;
  activatedAt?: number;
  generation?: number;
};

export type StoreTerminalBindingStatus = "INACTIVE" | "ACTIVE";

export type StoreTerminalConfiguration = {
  printers: Array<StoreTerminalPrinter>;
  functions: Array<StoreTerminalFunction>;
};

export type StoreTerminalConfigurationInput = {
  printers: Array<StoreTerminalPrinterInput>;
  functions: Array<StoreTerminalFunctionInput>;
};

export type StoreTerminalCreateRequest = {
  name: string;
  deviceType: string;
  activationCode?: string;
  configuration: StoreTerminalConfigurationInput;
};

export type StoreTerminalDetail = {
  terminalRef: string & { readonly __uuid: "Uuid" };
  storeRef: string & { readonly __uuid: "Uuid" };
  name: string;
  deviceType: string;
  status: StoreTerminalStatus;
  version: number;
  createdAt: number;
  updatedAt: number;
  activationCode: string;
  configuration: StoreTerminalConfiguration;
  areaReferences: Array<StoreTerminalAreaReference>;
  tagReferences: Array<StoreTerminalTagReference>;
  binding: StoreTerminalBinding;
};

export type StoreTerminalFunction = {
  ref: string & { readonly __uuid: "Uuid" };
  functionKey: string;
  ranges: Array<StoreTerminalRange>;
  scenes: Array<StoreTerminalScene>;
};

export type StoreTerminalFunctionInput = {
  ref?: string & { readonly __uuid: "Uuid" };
  clientKey?: string;
  functionKey: string;
  ranges: Array<StoreTerminalRangeSelection>;
  scenes: Array<StoreTerminalSceneSelection>;
};

export type StoreTerminalMutation = {
  terminalRef: string & { readonly __uuid: "Uuid" };
  version: number;
  status: StoreTerminalStatus;
};

export type StoreTerminalPage = {
  items: Array<StoreTerminalSummary>;
  nextCursor: string | null;
  total: number;
};

export type StoreTerminalPrinter = {
  ref: string & { readonly __uuid: "Uuid" };
  name: string;
  brandKey: string;
  modelKey: string;
  paperSpecKey: string;
  connectionMethodKey: string;
  connectionParameter?: string | null;
};

export type StoreTerminalPrinterBinding = {
  printerRef?: string & { readonly __uuid: "Uuid" };
  printerClientKey?: string;
};

export type StoreTerminalPrinterInput = {
  ref?: string & { readonly __uuid: "Uuid" };
  clientKey?: string;
  name: string;
  brandKey: string;
  modelKey: string;
  paperSpecKey: string;
  connectionMethodKey: string;
  connectionParameter?: string | null;
};

export type StoreTerminalPrinterRef = {
  printerRef: string & { readonly __uuid: "Uuid" };
};

export type StoreTerminalRange = {
  key: string;
  all: boolean;
  refs: Array<string & { readonly __uuid: "Uuid" }>;
};

export type StoreTerminalRangeSelection = {
  key: string;
  all: boolean;
  refs: Array<string & { readonly __uuid: "Uuid" }>;
};

export type StoreTerminalReplaceRequest = {
  name: string;
  configuration: StoreTerminalConfigurationInput;
  expectedVersion: number;
};

export type StoreTerminalScene = {
  sceneKey: string;
  orderTypes: Array<string>;
  printers: Array<StoreTerminalPrinterRef>;
};

export type StoreTerminalSceneSelection = {
  sceneKey: string;
  orderTypes: Array<string>;
  printers: Array<StoreTerminalPrinterBinding>;
};

export type StoreTerminalStatus = "ENABLED" | "DISABLED" | "VOIDED";

export type StoreTerminalStatusRequest = {
  status: StoreTerminalStatus;
  expectedVersion: number;
};

export type StoreTerminalSummary = {
  terminalRef: string & { readonly __uuid: "Uuid" };
  name: string;
  deviceType: string;
  status: StoreTerminalStatus;
  version: number;
  updatedAt: number;
};

export type StoreTerminalTagCandidate = {
  tagRef: string & { readonly __uuid: "Uuid" };
  name: string;
  code: string;
  status: StoreTerminalStatus;
};

export type StoreTerminalTagCandidatePage = {
  items: Array<StoreTerminalTagCandidate>;
  nextCursor: string | null;
  total: number;
};

export type StoreTerminalTagReference = {
  tagRef: string & { readonly __uuid: "Uuid" };
  name: string;
  code: string;
  status: StoreTerminalStatus;
};

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
  definitionRevision?: (number) | null;
};
  items: Array<Tenant>;
};

export type TenantUpdateRequest = (TenantCreateRequest) & ({
  expectedVersion: number;
});

export type WorkspaceAccountStatus = "ENABLED" | "DISABLED" | "VOIDED";

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
  roleNames: Array<string>;
  status: WorkspaceInvitationStatus;
  generation: number;
  expiresAt: EpochMillis;
  revision: number;
  createdAt: EpochMillis;
  consentedAt?: (EpochMillis) | null;
  completedAt?: (EpochMillis) | null;
  cancelledAt?: (EpochMillis) | null;
  targetOrganizationPathNodes: Array<OrganizationPathNode>;
  invitationRouteFacts: (InvitationRouteFacts) | null;
};

export type WorkspaceInvitationCandidatePage = {
  organizations: Array<{
  serviceNodeType: "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  organizationRef: string & { readonly __uuid: "Uuid" };
  path: string;
  pathNodes: Array<OrganizationPathNode>;
}>;
  roles: Array<WorkspaceRole>;
  metadata: ({
  subjectType: string;
  queryText?: (string) | null;
  page: number;
  pageSize: number;
  total: number;
  selectedOrganizationRef?: (string & { readonly __uuid: "Uuid" }) | null;
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
  scopeRef?: (string & { readonly __uuid: "Uuid" }) | null;
  expectedContextVersion: number;
  expectedVersion: number;
  idempotencyKey: string;
};

export type WorkspaceOperationsInvitationCreateRequest = {
  scopeRef?: (string & { readonly __uuid: "Uuid" }) | null;
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

export type WorkspaceRoleStatus = "ENABLED" | "DISABLED" | "VOIDED";

export type WorkspaceScopeContext = {
  region: (WorkspaceScopeNode) | null;
  project: (WorkspaceScopeNode) | null;
  store: (WorkspaceScopeNode) | null;
  headCompany: (WorkspaceScopeNode) | null;
};

export type WorkspaceScopeNode = {
  dataNodeType: "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  dataNodeRef: string & { readonly __uuid: "Uuid" };
  dataNodeName: string;
  dataNodeCode: string;
  ancestorPath: Array<string>;
  regionRef?: (string & { readonly __uuid: "Uuid" }) | null;
  projectRef?: (string & { readonly __uuid: "Uuid" }) | null;
  storeRef?: (string & { readonly __uuid: "Uuid" }) | null;
  headCompanyRef?: (string & { readonly __uuid: "Uuid" }) | null;
};

export type WorkspaceSelectContextRequest = {
  roleAssignmentRef: string & { readonly __uuid: "Uuid" };
  requiredContextVersion: number;
};

export type WorkspaceSelectDataNodeRequest = {
  dataNodeRef: string & { readonly __uuid: "Uuid" };
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
  roleAssignmentRef: string & { readonly __uuid: "Uuid" };
  roleId: string;
  roleName: string;
  roleNodeRef: string & { readonly __uuid: "Uuid" };
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
  roleAssignmentRef: string & { readonly __uuid: "Uuid" };
  roleId: string;
  roleName: string;
  roleNodeRef: string & { readonly __uuid: "Uuid" };
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
  organizationPathNodes: Array<OrganizationPathNode>;
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
  scopeRef?: (string & { readonly __uuid: "Uuid" }) | null;
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
  "addOperationsSalesMenuItems": {
    request: SalesMenuItemsAddRequest;
    response: SalesMenuCommandReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
    salesSectionRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "archiveOperationsSalesMenu": {
    request: SalesMenuArchiveRequest;
    response: SalesMenuCommandReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "cancelOperationsStoreTerminalActivation": {
    request: OperationsTerminalActivationCancellationRequest;
    response: OperationsTerminalActivationCancellationResult;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    terminalRef: string & { readonly __uuid: "Uuid" };
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
  "copyOperationsSalesMenu": {
    request: SalesMenuCopyRequest;
    response: SalesMenuCommandReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createOperationsBusinessChannel": {
    request: BusinessChannelCreateRequest;
    response: BusinessChannelView;
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
  "createOperationsBusinessChannelTemplate": {
    request: BusinessChannelTemplateCreateRequest;
    response: BusinessChannelTemplateView;
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
  "createOperationsOwnerBinding": {
    request: OwnerBindingCreateRequest;
    response: OwnerBindingView;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    channelRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createOperationsSalesMenu": {
    request: SalesMenuCreateRequest;
    response: SalesMenuCommandReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createOperationsSalesMenuSection": {
    request: SalesMenuSectionCreateRequest;
    response: SalesMenuCommandReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
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
  "deleteOperationsOwnerBinding": {
    request: OwnerBindingDeleteRequest;
    response: OwnerBindingView;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    channelRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "deleteOperationsSalesMenuItem": {
    request: SalesMenuDeleteRequest;
    response: SalesMenuCommandReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
    salesItemRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "deleteOperationsSalesMenuSection": {
    request: SalesMenuDeleteRequest;
    response: SalesMenuCommandReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
    salesSectionRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "getOperationsBusinessChannelDetail": {
    request: NoBody;
    response: BusinessChannelView;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    channelRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsBusinessChannelTemplates": {
    request: NoBody;
    response: BusinessChannelTemplatePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    projectRef?: string & { readonly __uuid: "Uuid" };
    sortKey?: BusinessChannelTemplateSortKey;
    sortDirection?: SortDirection;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsBusinessChannelTemplateVisibleStores": {
    request: NoBody;
    response: BusinessChannelTemplateVisibleStorePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    templateRef: string & { readonly __uuid: "Uuid" };
  };
    query: {
    storeStatusFilter: "NON_VOIDED" | "ALL";
    cursor?: string;
    pageSize?: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
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
    tenantId?: string & { readonly __uuid: "Uuid" };
    itemCode?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: StoreContractStatus;
    sort?: StoreContractSortKey;
    direction?: StoreContractSortDirection;
    page?: number;
    pageSize?: number;
    extensionFilters?: ExtensionFilterQuery;
    definitionRevision?: number;
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
    entityType: "WORKSPACE_ACCOUNT" | "WORKSPACE_INVITATION" | "COMMERCIAL_GROUP" | "ORGANIZATION_NODE" | "BRAND" | "TENANT" | "HEAD_COMPANY" | "STORE" | "STORE_SERVICE_POINT_AREA" | "STORE_SERVICE_POINT" | "STORE_QR_CONFIGURATION" | "STORE_TERMINAL" | "STORE_CONTRACT";
    entityId: string;
    page?: number;
    pageSize?: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsExternalCapabilityDictionary": {
    request: NoBody;
    response: CapabilityDictionary;
    requestRequired: false;
    requiresSession: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsExternalProviderCandidates": {
    request: NoBody;
    response: ExternalProviderCandidatePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    capabilityClass?: "MASTER_DATA_SYNC" | "MEMBER_BENEFIT" | "GROUP_BUY" | "TAKEAWAY" | "DINE_IN" | "INVENTORY_SYNC" | "TAKEAWAY_DELIVERY" | "ORDER_SYNC";
    nodeType?: "PROJECT" | "STORE";
    cursor?: string;
    pageSize?: number;
  };
    queryRequired: false;
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
    extensionFilters?: ExtensionFilterQuery;
    definitionRevision?: number;
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
    entityType: "BRAND" | "TENANT" | "HEAD_COMPANY" | "SERVICE_POINT";
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
    extensionFilters?: ExtensionFilterQuery;
    definitionRevision?: number;
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
  "getOperationsOrganizationStoreOperatingRule": {
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
    extensionFilters?: ExtensionFilterQuery;
    definitionRevision?: number;
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
    extensionFilters?: ExtensionFilterQuery;
    definitionRevision?: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsOwnerBindingDetail": {
    request: NoBody;
    response: OwnerBindingView;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    channelRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsProjectBusinessChannels": {
    request: NoBody;
    response: BusinessChannelPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    projectRef: string & { readonly __uuid: "Uuid" };
  };
    query: {
    sortKey?: BusinessChannelSortKey;
    sortDirection?: SortDirection;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsSalesMenu": {
    request: NoBody;
    response: SalesMenuDetail;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
  };
    query: {
    channelRef: string & { readonly __uuid: "Uuid" };
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsSalesMenuDraftItem": {
    request: NoBody;
    response: SalesMenuDraftItemView;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
    salesItemRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsSalesMenuDraftItems": {
    request: NoBody;
    response: SalesMenuItemPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
    salesSectionRef: string & { readonly __uuid: "Uuid" };
  };
    query: {
    cursor?: string;
    pageSize?: number;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsSalesMenuDraftSections": {
    request: NoBody;
    response: SalesMenuSectionList;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsSalesMenuItemCandidates": {
    request: NoBody;
    response: SalesMenuCandidatePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
  };
    query: {
    categoryRef?: string & { readonly __uuid: "Uuid" };
    query?: string;
    cursor?: string;
    pageSize?: number;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsSalesMenuOperationRecords": {
    request: NoBody;
    response: SalesMenuOperationRecordPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
  };
    query: {
    channelRef: string & { readonly __uuid: "Uuid" };
    cursor?: string;
    pageSize?: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsSalesMenuPublicationPreview": {
    request: NoBody;
    response: SalesMenuPublicationPreview;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
  };
    query: {
    channelRef: string & { readonly __uuid: "Uuid" };
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsSalesMenuPublishedItem": {
    request: NoBody;
    response: SalesMenuPublishedItemView;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
    salesItemRef: string & { readonly __uuid: "Uuid" };
  };
    query: {
    channelRef: string & { readonly __uuid: "Uuid" };
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsSalesMenuPublishedItems": {
    request: NoBody;
    response: SalesMenuPublishedItemPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
    salesSectionRef: string & { readonly __uuid: "Uuid" };
  };
    query: {
    channelRef: string & { readonly __uuid: "Uuid" };
    cursor?: string;
    pageSize?: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsSalesMenuPublishedSections": {
    request: NoBody;
    response: SalesMenuPublishedSectionList;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsSalesMenus": {
    request: NoBody;
    response: SalesMenuPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
  };
    query: {
    channelRef: string & { readonly __uuid: "Uuid" };
    query?: string;
    cursor?: string;
    pageSize?: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsStoreBusinessChannels": {
    request: NoBody;
    response: BusinessChannelPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
  };
    query: {
    usage: "BUSINESS_CHANNEL" | "SALES_MENU";
    cursor?: string;
    pageSize?: number;
    sortKey?: BusinessChannelSortKey;
    sortDirection?: SortDirection;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsStoreBusinessChannelTemplateCandidates": {
    request: NoBody;
    response: BusinessChannelTemplateCandidatePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    projectRef?: string & { readonly __uuid: "Uuid" };
    storeRef?: string & { readonly __uuid: "Uuid" };
    sortKey?: BusinessChannelTemplateSortKey;
    sortDirection?: SortDirection;
    cursor?: string;
    pageSize?: number;
  };
    queryRequired: false;
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
  "getOperationsStoreQrChannelCandidates": {
    request: NoBody;
    response: StoreQrChannelCandidatePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsStoreQrConfiguration": {
    request: NoBody;
    response: StoreQrConfigurationView;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsStoreServicePoint": {
    request: NoBody;
    response: StoreServicePointDetail;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    servicePointRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsStoreServicePointAreas": {
    request: NoBody;
    response: StoreServicePointAreaPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
  };
    query: {
    cursor?: string;
    pageSize?: number;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsStoreServicePoints": {
    request: NoBody;
    response: StoreServicePointPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    areaRef: string & { readonly __uuid: "Uuid" };
  };
    query: {
    cursor?: string;
    pageSize?: number;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsStoreTerminal": {
    request: NoBody;
    response: StoreTerminalDetail;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    terminalRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsStoreTerminalAreaCandidates": {
    request: NoBody;
    response: StoreTerminalAreaCandidatePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
  };
    query: {
    query?: string;
    cursor?: string;
    pageSize?: number;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsStoreTerminals": {
    request: NoBody;
    response: StoreTerminalPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
  };
    query: {
    query?: string;
    cursor?: string;
    pageSize?: number;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getOperationsStoreTerminalTagCandidates": {
    request: NoBody;
    response: StoreTerminalTagCandidatePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
  };
    query: {
    query?: string;
    cursor?: string;
    pageSize?: number;
  };
    queryRequired: false;
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
    scopeRef?: string & { readonly __uuid: "Uuid" };
    subjectType: "ORGANIZATION" | "ROLE";
    candidateUsage: "INVITATION_TARGET" | "LIST_FILTER";
    queryText?: string;
    page?: number;
    pageSize?: number;
    selectedOrganizationRef?: string & { readonly __uuid: "Uuid" };
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
    scopeRef?: string & { readonly __uuid: "Uuid" };
    mobile?: string;
    organizationRef?: string & { readonly __uuid: "Uuid" };
    roleId?: string & { readonly __uuid: "Uuid" };
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
    scopeRef?: string & { readonly __uuid: "Uuid" };
    userName?: string;
    mobile?: string;
    roleId?: string & { readonly __uuid: "Uuid" };
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
    scopeRef?: string & { readonly __uuid: "Uuid" };
    subjectType: "ORGANIZATION" | "ROLE";
    candidateUsage: "INVITATION_TARGET" | "LIST_FILTER";
    queryText?: string;
    page?: number;
    pageSize?: number;
    selectedOrganizationRef?: string & { readonly __uuid: "Uuid" };
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
    scopeRef?: string & { readonly __uuid: "Uuid" };
    mobile?: string;
    organizationRef?: string & { readonly __uuid: "Uuid" };
    roleId?: string & { readonly __uuid: "Uuid" };
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
    scopeRef?: string & { readonly __uuid: "Uuid" };
    userName?: string;
    mobile?: string;
    roleId?: string & { readonly __uuid: "Uuid" };
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
    scopeRef?: string & { readonly __uuid: "Uuid" };
    subjectType: "ORGANIZATION" | "ROLE";
    candidateUsage: "INVITATION_TARGET" | "LIST_FILTER";
    queryText?: string;
    page?: number;
    pageSize?: number;
    selectedOrganizationRef?: string & { readonly __uuid: "Uuid" };
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
    scopeRef?: string & { readonly __uuid: "Uuid" };
    mobile?: string;
    organizationRef?: string & { readonly __uuid: "Uuid" };
    roleId?: string & { readonly __uuid: "Uuid" };
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
    scopeRef?: string & { readonly __uuid: "Uuid" };
    userName?: string;
    mobile?: string;
    roleId?: string & { readonly __uuid: "Uuid" };
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
    scopeRef?: string & { readonly __uuid: "Uuid" };
    subjectType: "ORGANIZATION" | "ROLE";
    candidateUsage: "INVITATION_TARGET" | "LIST_FILTER";
    queryText?: string;
    page?: number;
    pageSize?: number;
    selectedOrganizationRef?: string & { readonly __uuid: "Uuid" };
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
    scopeRef?: string & { readonly __uuid: "Uuid" };
    mobile?: string;
    organizationRef?: string & { readonly __uuid: "Uuid" };
    roleId?: string & { readonly __uuid: "Uuid" };
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
    scopeRef?: string & { readonly __uuid: "Uuid" };
    userName?: string;
    mobile?: string;
    roleId?: string & { readonly __uuid: "Uuid" };
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
    scopeRef?: string & { readonly __uuid: "Uuid" };
    subjectType: "ORGANIZATION" | "ROLE";
    candidateUsage: "INVITATION_TARGET" | "LIST_FILTER";
    queryText?: string;
    page?: number;
    pageSize?: number;
    selectedOrganizationRef?: string & { readonly __uuid: "Uuid" };
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
    scopeRef?: string & { readonly __uuid: "Uuid" };
    mobile?: string;
    organizationRef?: string & { readonly __uuid: "Uuid" };
    roleId?: string & { readonly __uuid: "Uuid" };
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
    scopeRef?: string & { readonly __uuid: "Uuid" };
    userName?: string;
    mobile?: string;
    roleId?: string & { readonly __uuid: "Uuid" };
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
  "moveOperationsSalesMenuItem": {
    request: SalesMenuItemMoveRequest;
    response: SalesMenuCommandReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
    salesItemRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "moveOperationsSalesMenuSection": {
    request: SalesMenuSectionMoveRequest;
    response: SalesMenuCommandReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
    salesSectionRef: string & { readonly __uuid: "Uuid" };
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
  "patchOperationsStoreQrConfiguration": {
    request: StoreQrConfigurationUpdateRequest;
    response: StoreQrConfigurationView;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "patchOperationsStoreServicePoint": {
    request: StoreServicePointUpdateRequest;
    response: StoreServicePoint;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    servicePointRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "patchOperationsStoreServicePointArea": {
    request: StoreServicePointAreaUpdateRequest;
    response: StoreServicePointArea;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    areaRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "postOperationsStoreServicePoint": {
    request: StoreServicePointCreateRequest;
    response: StoreServicePoint;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    areaRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "postOperationsStoreServicePointArea": {
    request: StoreServicePointAreaCreateRequest;
    response: StoreServicePointArea;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "postOperationsStoreServicePointAreaOrder": {
    request: StoreServicePointAreaOrderRequest;
    response: StoreServicePointArea;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    areaRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "postOperationsStoreServicePointAreaStatus": {
    request: StoreServicePointAreaStatusRequest;
    response: StoreServicePointArea;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    areaRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "postOperationsStoreServicePointOrder": {
    request: StoreServicePointOrderRequest;
    response: StoreServicePoint;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    servicePointRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "postOperationsStoreServicePointStatus": {
    request: StoreServicePointStatusRequest;
    response: StoreServicePoint;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    servicePointRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "postOperationsStoreTerminal": {
    request: StoreTerminalCreateRequest;
    response: StoreTerminalMutation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "postOperationsStoreTerminalStatus": {
    request: StoreTerminalStatusRequest;
    response: StoreTerminalMutation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    terminalRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "publishOperationsSalesMenu": {
    request: SalesMenuPublishRequest;
    response: SalesMenuCommandReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "putOperationsStoreTerminal": {
    request: StoreTerminalReplaceRequest;
    response: StoreTerminalMutation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    terminalRef: string & { readonly __uuid: "Uuid" };
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
  "releaseOperationsSalesMenuStagedAsset": {
    request: SalesMenuAssetReleaseRequest;
    response: SalesMenuAssetReleaseReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
    salesItemRef: string & { readonly __uuid: "Uuid" };
    assetRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "releaseStagedStoreServicePointImage": {
    request: StoreServicePointAssetReleaseRequest;
    response: StoreServicePointAssetReleaseReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    assetRef: string & { readonly __uuid: "Uuid" };
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
  "renameOperationsSalesMenu": {
    request: SalesMenuRenameRequest;
    response: SalesMenuCommandReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "renameOperationsSalesMenuSection": {
    request: SalesMenuSectionRenameRequest;
    response: SalesMenuCommandReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
    salesSectionRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "restoreOperationsSalesMenuItemSale": {
    request: SalesMenuManualRestoreRequest;
    response: SalesMenuCommandReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
    salesItemRef: string & { readonly __uuid: "Uuid" };
    channelRef: string & { readonly __uuid: "Uuid" };
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
  "setOperationsSalesMenuActivation": {
    request: SalesMenuActivationRequest;
    response: SalesMenuCommandReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
    channelRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "setOperationsSalesMenuItemSoldOut": {
    request: SalesMenuManualSoldOutRequest;
    response: SalesMenuCommandReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
    salesItemRef: string & { readonly __uuid: "Uuid" };
    channelRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "stageOperationsSalesMenuAsset": {
    request: SalesMenuAssetStageRequest;
    response: SalesMenuAssetStageReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
    salesItemRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "stageStoreServicePointImage": {
    request: StoreServicePointAssetStageRequest;
    response: StoreServicePointAssetStageReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "transitionOperationsBusinessChannelStatus": {
    request: BusinessChannelStatusRequest;
    response: BusinessChannelView;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    channelRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "transitionOperationsBusinessChannelTemplateStatus": {
    request: BusinessChannelTemplateStatusRequest;
    response: BusinessChannelTemplateView;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    templateRef: string & { readonly __uuid: "Uuid" };
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
  "updateOperationsBusinessChannel": {
    request: BusinessChannelUpdateRequest;
    response: BusinessChannelView;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    channelRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "updateOperationsBusinessChannelTemplate": {
    request: BusinessChannelTemplateUpdateRequest;
    response: BusinessChannelTemplateView;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    templateRef: string & { readonly __uuid: "Uuid" };
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
  "updateOperationsSalesMenuItem": {
    request: SalesMenuItemUpdateRequest;
    response: SalesMenuCommandReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
    salesItemRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "X-Sales-Menu-Asset-Bind-Grants"?: string;
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "updateOperationsSalesMenuSchedule": {
    request: SalesMenuScheduleUpdateRequest;
    response: SalesMenuCommandReadback;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    storeRef: string & { readonly __uuid: "Uuid" };
    salesMenuRef: string & { readonly __uuid: "Uuid" };
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
    addOperationsSalesMenuItems: (pathParameters: FaceOperationContracts["addOperationsSalesMenuItems"]["path"], options: FaceOperationOptions<"addOperationsSalesMenuItems">) => execute({
      operationId: "addOperationsSalesMenuItems",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/sections/{salesSectionRef}/items",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    archiveOperationsSalesMenu: (pathParameters: FaceOperationContracts["archiveOperationsSalesMenu"]["path"], options: FaceOperationOptions<"archiveOperationsSalesMenu">) => execute({
      operationId: "archiveOperationsSalesMenu",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/archive",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    cancelOperationsStoreTerminalActivation: (pathParameters: FaceOperationContracts["cancelOperationsStoreTerminalActivation"]["path"], options: FaceOperationOptions<"cancelOperationsStoreTerminalActivation">) => execute({
      operationId: "cancelOperationsStoreTerminalActivation",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals/{terminalRef}/activation/cancel",
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
    copyOperationsSalesMenu: (pathParameters: FaceOperationContracts["copyOperationsSalesMenu"]["path"], options: FaceOperationOptions<"copyOperationsSalesMenu">) => execute({
      operationId: "copyOperationsSalesMenu",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/copies",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createOperationsBusinessChannel: (pathParameters: FaceOperationContracts["createOperationsBusinessChannel"]["path"], options: FaceOperationOptions<"createOperationsBusinessChannel">) => execute({
      operationId: "createOperationsBusinessChannel",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createOperationsBusinessChannelTemplate: (pathParameters: FaceOperationContracts["createOperationsBusinessChannelTemplate"]["path"], options: FaceOperationOptions<"createOperationsBusinessChannelTemplate">) => execute({
      operationId: "createOperationsBusinessChannelTemplate",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates",
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
    createOperationsOwnerBinding: (pathParameters: FaceOperationContracts["createOperationsOwnerBinding"]["path"], options: FaceOperationOptions<"createOperationsOwnerBinding">) => execute({
      operationId: "createOperationsOwnerBinding",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}/owner-binding",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createOperationsSalesMenu: (pathParameters: FaceOperationContracts["createOperationsSalesMenu"]["path"], options: FaceOperationOptions<"createOperationsSalesMenu">) => execute({
      operationId: "createOperationsSalesMenu",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createOperationsSalesMenuSection: (pathParameters: FaceOperationContracts["createOperationsSalesMenuSection"]["path"], options: FaceOperationOptions<"createOperationsSalesMenuSection">) => execute({
      operationId: "createOperationsSalesMenuSection",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/sections",
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
    deleteOperationsOwnerBinding: (pathParameters: FaceOperationContracts["deleteOperationsOwnerBinding"]["path"], options: FaceOperationOptions<"deleteOperationsOwnerBinding">) => execute({
      operationId: "deleteOperationsOwnerBinding",
      method: "DELETE",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}/owner-binding",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    deleteOperationsSalesMenuItem: (pathParameters: FaceOperationContracts["deleteOperationsSalesMenuItem"]["path"], options: FaceOperationOptions<"deleteOperationsSalesMenuItem">) => execute({
      operationId: "deleteOperationsSalesMenuItem",
      method: "DELETE",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/items/{salesItemRef}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    deleteOperationsSalesMenuSection: (pathParameters: FaceOperationContracts["deleteOperationsSalesMenuSection"]["path"], options: FaceOperationOptions<"deleteOperationsSalesMenuSection">) => execute({
      operationId: "deleteOperationsSalesMenuSection",
      method: "DELETE",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/sections/{salesSectionRef}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsBusinessChannelDetail: (pathParameters: FaceOperationContracts["getOperationsBusinessChannelDetail"]["path"], options: FaceOperationOptions<"getOperationsBusinessChannelDetail">) => execute({
      operationId: "getOperationsBusinessChannelDetail",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsBusinessChannelTemplates: (pathParameters: FaceOperationContracts["getOperationsBusinessChannelTemplates"]["path"], options: FaceOperationOptions<"getOperationsBusinessChannelTemplates">) => execute({
      operationId: "getOperationsBusinessChannelTemplates",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsBusinessChannelTemplateVisibleStores: (pathParameters: FaceOperationContracts["getOperationsBusinessChannelTemplateVisibleStores"]["path"], options: FaceOperationOptions<"getOperationsBusinessChannelTemplateVisibleStores">) => execute({
      operationId: "getOperationsBusinessChannelTemplateVisibleStores",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates/{templateRef}/visible-stores",
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
    getOperationsExternalCapabilityDictionary: (pathParameters: FaceOperationContracts["getOperationsExternalCapabilityDictionary"]["path"], options: FaceOperationOptions<"getOperationsExternalCapabilityDictionary">) => execute({
      operationId: "getOperationsExternalCapabilityDictionary",
      method: "GET",
      path: "/api/operations/external-capability-dictionary",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsExternalProviderCandidates: (pathParameters: FaceOperationContracts["getOperationsExternalProviderCandidates"]["path"], options: FaceOperationOptions<"getOperationsExternalProviderCandidates">) => execute({
      operationId: "getOperationsExternalProviderCandidates",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/external-provider-candidates",
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
    getOperationsOrganizationStoreExtensionDefinition: (pathParameters: FaceOperationContracts["getOperationsOrganizationStoreExtensionDefinition"]["path"], options: FaceOperationOptions<"getOperationsOrganizationStoreExtensionDefinition">) => execute({
      operationId: "getOperationsOrganizationStoreExtensionDefinition",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/extension-definition",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsOrganizationStoreOperatingRule: (pathParameters: FaceOperationContracts["getOperationsOrganizationStoreOperatingRule"]["path"], options: FaceOperationOptions<"getOperationsOrganizationStoreOperatingRule">) => execute({
      operationId: "getOperationsOrganizationStoreOperatingRule",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}/operating-rule-switches",
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
    getOperationsOwnerBindingDetail: (pathParameters: FaceOperationContracts["getOperationsOwnerBindingDetail"]["path"], options: FaceOperationOptions<"getOperationsOwnerBindingDetail">) => execute({
      operationId: "getOperationsOwnerBindingDetail",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}/owner-binding",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsProjectBusinessChannels: (pathParameters: FaceOperationContracts["getOperationsProjectBusinessChannels"]["path"], options: FaceOperationOptions<"getOperationsProjectBusinessChannels">) => execute({
      operationId: "getOperationsProjectBusinessChannels",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/business-channels",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsSalesMenu: (pathParameters: FaceOperationContracts["getOperationsSalesMenu"]["path"], options: FaceOperationOptions<"getOperationsSalesMenu">) => execute({
      operationId: "getOperationsSalesMenu",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsSalesMenuDraftItem: (pathParameters: FaceOperationContracts["getOperationsSalesMenuDraftItem"]["path"], options: FaceOperationOptions<"getOperationsSalesMenuDraftItem">) => execute({
      operationId: "getOperationsSalesMenuDraftItem",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/items/{salesItemRef}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsSalesMenuDraftItems: (pathParameters: FaceOperationContracts["getOperationsSalesMenuDraftItems"]["path"], options: FaceOperationOptions<"getOperationsSalesMenuDraftItems">) => execute({
      operationId: "getOperationsSalesMenuDraftItems",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/sections/{salesSectionRef}/items",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsSalesMenuDraftSections: (pathParameters: FaceOperationContracts["getOperationsSalesMenuDraftSections"]["path"], options: FaceOperationOptions<"getOperationsSalesMenuDraftSections">) => execute({
      operationId: "getOperationsSalesMenuDraftSections",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/sections",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsSalesMenuItemCandidates: (pathParameters: FaceOperationContracts["getOperationsSalesMenuItemCandidates"]["path"], options: FaceOperationOptions<"getOperationsSalesMenuItemCandidates">) => execute({
      operationId: "getOperationsSalesMenuItemCandidates",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/item-candidates",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsSalesMenuOperationRecords: (pathParameters: FaceOperationContracts["getOperationsSalesMenuOperationRecords"]["path"], options: FaceOperationOptions<"getOperationsSalesMenuOperationRecords">) => execute({
      operationId: "getOperationsSalesMenuOperationRecords",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/sales-menu-operation-records",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsSalesMenuPublicationPreview: (pathParameters: FaceOperationContracts["getOperationsSalesMenuPublicationPreview"]["path"], options: FaceOperationOptions<"getOperationsSalesMenuPublicationPreview">) => execute({
      operationId: "getOperationsSalesMenuPublicationPreview",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/publication-preview",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsSalesMenuPublishedItem: (pathParameters: FaceOperationContracts["getOperationsSalesMenuPublishedItem"]["path"], options: FaceOperationOptions<"getOperationsSalesMenuPublishedItem">) => execute({
      operationId: "getOperationsSalesMenuPublishedItem",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/published/items/{salesItemRef}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsSalesMenuPublishedItems: (pathParameters: FaceOperationContracts["getOperationsSalesMenuPublishedItems"]["path"], options: FaceOperationOptions<"getOperationsSalesMenuPublishedItems">) => execute({
      operationId: "getOperationsSalesMenuPublishedItems",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/published/sections/{salesSectionRef}/items",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsSalesMenuPublishedSections: (pathParameters: FaceOperationContracts["getOperationsSalesMenuPublishedSections"]["path"], options: FaceOperationOptions<"getOperationsSalesMenuPublishedSections">) => execute({
      operationId: "getOperationsSalesMenuPublishedSections",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/published/sections",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsSalesMenus: (pathParameters: FaceOperationContracts["getOperationsSalesMenus"]["path"], options: FaceOperationOptions<"getOperationsSalesMenus">) => execute({
      operationId: "getOperationsSalesMenus",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsStoreBusinessChannels: (pathParameters: FaceOperationContracts["getOperationsStoreBusinessChannels"]["path"], options: FaceOperationOptions<"getOperationsStoreBusinessChannels">) => execute({
      operationId: "getOperationsStoreBusinessChannels",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/business-channels",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsStoreBusinessChannelTemplateCandidates: (pathParameters: FaceOperationContracts["getOperationsStoreBusinessChannelTemplateCandidates"]["path"], options: FaceOperationOptions<"getOperationsStoreBusinessChannelTemplateCandidates">) => execute({
      operationId: "getOperationsStoreBusinessChannelTemplateCandidates",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-template-candidates",
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
    getOperationsStoreQrChannelCandidates: (pathParameters: FaceOperationContracts["getOperationsStoreQrChannelCandidates"]["path"], options: FaceOperationOptions<"getOperationsStoreQrChannelCandidates">) => execute({
      operationId: "getOperationsStoreQrChannelCandidates",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/qr-channel-candidates",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsStoreQrConfiguration: (pathParameters: FaceOperationContracts["getOperationsStoreQrConfiguration"]["path"], options: FaceOperationOptions<"getOperationsStoreQrConfiguration">) => execute({
      operationId: "getOperationsStoreQrConfiguration",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/qr-configuration",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsStoreServicePoint: (pathParameters: FaceOperationContracts["getOperationsStoreServicePoint"]["path"], options: FaceOperationOptions<"getOperationsStoreServicePoint">) => execute({
      operationId: "getOperationsStoreServicePoint",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-points/{servicePointRef}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsStoreServicePointAreas: (pathParameters: FaceOperationContracts["getOperationsStoreServicePointAreas"]["path"], options: FaceOperationOptions<"getOperationsStoreServicePointAreas">) => execute({
      operationId: "getOperationsStoreServicePointAreas",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsStoreServicePoints: (pathParameters: FaceOperationContracts["getOperationsStoreServicePoints"]["path"], options: FaceOperationOptions<"getOperationsStoreServicePoints">) => execute({
      operationId: "getOperationsStoreServicePoints",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas/{areaRef}/service-points",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsStoreTerminal: (pathParameters: FaceOperationContracts["getOperationsStoreTerminal"]["path"], options: FaceOperationOptions<"getOperationsStoreTerminal">) => execute({
      operationId: "getOperationsStoreTerminal",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals/{terminalRef}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsStoreTerminalAreaCandidates: (pathParameters: FaceOperationContracts["getOperationsStoreTerminalAreaCandidates"]["path"], options: FaceOperationOptions<"getOperationsStoreTerminalAreaCandidates">) => execute({
      operationId: "getOperationsStoreTerminalAreaCandidates",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals/area-candidates",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsStoreTerminals: (pathParameters: FaceOperationContracts["getOperationsStoreTerminals"]["path"], options: FaceOperationOptions<"getOperationsStoreTerminals">) => execute({
      operationId: "getOperationsStoreTerminals",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getOperationsStoreTerminalTagCandidates: (pathParameters: FaceOperationContracts["getOperationsStoreTerminalTagCandidates"]["path"], options: FaceOperationOptions<"getOperationsStoreTerminalTagCandidates">) => execute({
      operationId: "getOperationsStoreTerminalTagCandidates",
      method: "GET",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals/tag-candidates",
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
    moveOperationsSalesMenuItem: (pathParameters: FaceOperationContracts["moveOperationsSalesMenuItem"]["path"], options: FaceOperationOptions<"moveOperationsSalesMenuItem">) => execute({
      operationId: "moveOperationsSalesMenuItem",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/items/{salesItemRef}/move",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    moveOperationsSalesMenuSection: (pathParameters: FaceOperationContracts["moveOperationsSalesMenuSection"]["path"], options: FaceOperationOptions<"moveOperationsSalesMenuSection">) => execute({
      operationId: "moveOperationsSalesMenuSection",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/sections/{salesSectionRef}/move",
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
    patchOperationsStoreQrConfiguration: (pathParameters: FaceOperationContracts["patchOperationsStoreQrConfiguration"]["path"], options: FaceOperationOptions<"patchOperationsStoreQrConfiguration">) => execute({
      operationId: "patchOperationsStoreQrConfiguration",
      method: "PATCH",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/qr-configuration",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    patchOperationsStoreServicePoint: (pathParameters: FaceOperationContracts["patchOperationsStoreServicePoint"]["path"], options: FaceOperationOptions<"patchOperationsStoreServicePoint">) => execute({
      operationId: "patchOperationsStoreServicePoint",
      method: "PATCH",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-points/{servicePointRef}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    patchOperationsStoreServicePointArea: (pathParameters: FaceOperationContracts["patchOperationsStoreServicePointArea"]["path"], options: FaceOperationOptions<"patchOperationsStoreServicePointArea">) => execute({
      operationId: "patchOperationsStoreServicePointArea",
      method: "PATCH",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas/{areaRef}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    postOperationsStoreServicePoint: (pathParameters: FaceOperationContracts["postOperationsStoreServicePoint"]["path"], options: FaceOperationOptions<"postOperationsStoreServicePoint">) => execute({
      operationId: "postOperationsStoreServicePoint",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas/{areaRef}/service-points",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    postOperationsStoreServicePointArea: (pathParameters: FaceOperationContracts["postOperationsStoreServicePointArea"]["path"], options: FaceOperationOptions<"postOperationsStoreServicePointArea">) => execute({
      operationId: "postOperationsStoreServicePointArea",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    postOperationsStoreServicePointAreaOrder: (pathParameters: FaceOperationContracts["postOperationsStoreServicePointAreaOrder"]["path"], options: FaceOperationOptions<"postOperationsStoreServicePointAreaOrder">) => execute({
      operationId: "postOperationsStoreServicePointAreaOrder",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas/{areaRef}/order",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    postOperationsStoreServicePointAreaStatus: (pathParameters: FaceOperationContracts["postOperationsStoreServicePointAreaStatus"]["path"], options: FaceOperationOptions<"postOperationsStoreServicePointAreaStatus">) => execute({
      operationId: "postOperationsStoreServicePointAreaStatus",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas/{areaRef}/status",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    postOperationsStoreServicePointOrder: (pathParameters: FaceOperationContracts["postOperationsStoreServicePointOrder"]["path"], options: FaceOperationOptions<"postOperationsStoreServicePointOrder">) => execute({
      operationId: "postOperationsStoreServicePointOrder",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-points/{servicePointRef}/order",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    postOperationsStoreServicePointStatus: (pathParameters: FaceOperationContracts["postOperationsStoreServicePointStatus"]["path"], options: FaceOperationOptions<"postOperationsStoreServicePointStatus">) => execute({
      operationId: "postOperationsStoreServicePointStatus",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-points/{servicePointRef}/status",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    postOperationsStoreTerminal: (pathParameters: FaceOperationContracts["postOperationsStoreTerminal"]["path"], options: FaceOperationOptions<"postOperationsStoreTerminal">) => execute({
      operationId: "postOperationsStoreTerminal",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    postOperationsStoreTerminalStatus: (pathParameters: FaceOperationContracts["postOperationsStoreTerminalStatus"]["path"], options: FaceOperationOptions<"postOperationsStoreTerminalStatus">) => execute({
      operationId: "postOperationsStoreTerminalStatus",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals/{terminalRef}/status",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    publishOperationsSalesMenu: (pathParameters: FaceOperationContracts["publishOperationsSalesMenu"]["path"], options: FaceOperationOptions<"publishOperationsSalesMenu">) => execute({
      operationId: "publishOperationsSalesMenu",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/publications",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    putOperationsStoreTerminal: (pathParameters: FaceOperationContracts["putOperationsStoreTerminal"]["path"], options: FaceOperationOptions<"putOperationsStoreTerminal">) => execute({
      operationId: "putOperationsStoreTerminal",
      method: "PUT",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals/{terminalRef}",
      pathParameters,
      requiresSession: true,
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
    releaseOperationsSalesMenuStagedAsset: (pathParameters: FaceOperationContracts["releaseOperationsSalesMenuStagedAsset"]["path"], options: FaceOperationOptions<"releaseOperationsSalesMenuStagedAsset">) => execute({
      operationId: "releaseOperationsSalesMenuStagedAsset",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/items/{salesItemRef}/assets/stage/{assetRef}/release",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    releaseStagedStoreServicePointImage: (pathParameters: FaceOperationContracts["releaseStagedStoreServicePointImage"]["path"], options: FaceOperationOptions<"releaseStagedStoreServicePointImage">) => execute({
      operationId: "releaseStagedStoreServicePointImage",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-assets/stage/{assetRef}/release",
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
    renameOperationsSalesMenu: (pathParameters: FaceOperationContracts["renameOperationsSalesMenu"]["path"], options: FaceOperationOptions<"renameOperationsSalesMenu">) => execute({
      operationId: "renameOperationsSalesMenu",
      method: "PATCH",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/name",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    renameOperationsSalesMenuSection: (pathParameters: FaceOperationContracts["renameOperationsSalesMenuSection"]["path"], options: FaceOperationOptions<"renameOperationsSalesMenuSection">) => execute({
      operationId: "renameOperationsSalesMenuSection",
      method: "PATCH",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/sections/{salesSectionRef}/name",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    restoreOperationsSalesMenuItemSale: (pathParameters: FaceOperationContracts["restoreOperationsSalesMenuItemSale"]["path"], options: FaceOperationOptions<"restoreOperationsSalesMenuItemSale">) => execute({
      operationId: "restoreOperationsSalesMenuItemSale",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/published/items/{salesItemRef}/channels/{channelRef}/manual-restore",
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
    setOperationsSalesMenuActivation: (pathParameters: FaceOperationContracts["setOperationsSalesMenuActivation"]["path"], options: FaceOperationOptions<"setOperationsSalesMenuActivation">) => execute({
      operationId: "setOperationsSalesMenuActivation",
      method: "PUT",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/channels/{channelRef}/activation",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    setOperationsSalesMenuItemSoldOut: (pathParameters: FaceOperationContracts["setOperationsSalesMenuItemSoldOut"]["path"], options: FaceOperationOptions<"setOperationsSalesMenuItemSoldOut">) => execute({
      operationId: "setOperationsSalesMenuItemSoldOut",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/published/items/{salesItemRef}/channels/{channelRef}/manual-sold-out",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    stageOperationsSalesMenuAsset: (pathParameters: FaceOperationContracts["stageOperationsSalesMenuAsset"]["path"], options: FaceOperationOptions<"stageOperationsSalesMenuAsset">) => execute({
      operationId: "stageOperationsSalesMenuAsset",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/items/{salesItemRef}/assets/stage",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    stageStoreServicePointImage: (pathParameters: FaceOperationContracts["stageStoreServicePointImage"]["path"], options: FaceOperationOptions<"stageStoreServicePointImage">) => execute({
      operationId: "stageStoreServicePointImage",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-assets/stage",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    transitionOperationsBusinessChannelStatus: (pathParameters: FaceOperationContracts["transitionOperationsBusinessChannelStatus"]["path"], options: FaceOperationOptions<"transitionOperationsBusinessChannelStatus">) => execute({
      operationId: "transitionOperationsBusinessChannelStatus",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    transitionOperationsBusinessChannelTemplateStatus: (pathParameters: FaceOperationContracts["transitionOperationsBusinessChannelTemplateStatus"]["path"], options: FaceOperationOptions<"transitionOperationsBusinessChannelTemplateStatus">) => execute({
      operationId: "transitionOperationsBusinessChannelTemplateStatus",
      method: "POST",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates/{templateRef}/status",
      pathParameters,
      requiresSession: true,
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
    updateOperationsBusinessChannel: (pathParameters: FaceOperationContracts["updateOperationsBusinessChannel"]["path"], options: FaceOperationOptions<"updateOperationsBusinessChannel">) => execute({
      operationId: "updateOperationsBusinessChannel",
      method: "PATCH",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    updateOperationsBusinessChannelTemplate: (pathParameters: FaceOperationContracts["updateOperationsBusinessChannelTemplate"]["path"], options: FaceOperationOptions<"updateOperationsBusinessChannelTemplate">) => execute({
      operationId: "updateOperationsBusinessChannelTemplate",
      method: "PATCH",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates/{templateRef}",
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
    updateOperationsSalesMenuItem: (pathParameters: FaceOperationContracts["updateOperationsSalesMenuItem"]["path"], options: FaceOperationOptions<"updateOperationsSalesMenuItem">) => execute({
      operationId: "updateOperationsSalesMenuItem",
      method: "PUT",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/items/{salesItemRef}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    updateOperationsSalesMenuSchedule: (pathParameters: FaceOperationContracts["updateOperationsSalesMenuSchedule"]["path"], options: FaceOperationOptions<"updateOperationsSalesMenuSchedule">) => execute({
      operationId: "updateOperationsSalesMenuSchedule",
      method: "PUT",
      path: "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/schedule",
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
