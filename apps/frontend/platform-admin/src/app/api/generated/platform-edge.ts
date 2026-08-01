// Generated from accepted R5 edge catalog; do not edit.

export const PLATFORM_ADMIN_OPERATIONS = [
  {
    "operationId": "changeCurrentPlatformPassword",
    "method": "POST",
    "path": "/api/platform/auth/password",
    "owner": "platform-iam"
  },
  {
    "operationId": "completePlatformPasswordRecovery",
    "method": "POST",
    "path": "/api/platform/auth/password-recovery/complete",
    "owner": "platform-iam"
  },
  {
    "operationId": "createPlatformAdmin",
    "method": "POST",
    "path": "/api/platform/admin-users",
    "owner": "platform-iam"
  },
  {
    "operationId": "createPlatformGroupWorkspace",
    "method": "POST",
    "path": "/api/platform/group-workspaces",
    "owner": "platform-workspace"
  },
  {
    "operationId": "createWorkspaceRole",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/roles",
    "owner": "workspace-iam"
  },
  {
    "operationId": "getCurrentPlatformSession",
    "method": "GET",
    "path": "/api/platform/auth/session",
    "owner": "platform-iam"
  },
  {
    "operationId": "getExtensionDefinition",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions/{entityType}",
    "owner": "extension"
  },
  {
    "operationId": "getExtensionEntityCatalog",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions",
    "owner": "extension"
  },
  {
    "operationId": "getPlatformAdminDetail",
    "method": "GET",
    "path": "/api/platform/admin-users/{platformAdminId}",
    "owner": "platform-iam"
  },
  {
    "operationId": "getPlatformAdminPage",
    "method": "GET",
    "path": "/api/platform/admin-users",
    "owner": "platform-iam"
  },
  {
    "operationId": "getPlatformContractOverviewDetail",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview/{contractId}",
    "owner": "contract"
  },
  {
    "operationId": "getPlatformContractOverviewPage",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview",
    "owner": "contract"
  },
  {
    "operationId": "getPlatformEntityAuditHistory",
    "method": "GET",
    "path": "/api/platform/audit-history",
    "owner": "platform-workspace"
  },
  {
    "operationId": "getPlatformGroupWorkspaceDetail",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}",
    "owner": "platform-workspace"
  },
  {
    "operationId": "getPlatformOrganizationHierarchyTree",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/hierarchy",
    "owner": "organization"
  },
  {
    "operationId": "getPlatformOrganizationOverviewDetail",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/{category}/{itemId}",
    "owner": "organization"
  },
  {
    "operationId": "getPlatformOrganizationOverviewPage",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview",
    "owner": "organization"
  },
  {
    "operationId": "getWorkspaceAccount",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}",
    "owner": "workspace-iam"
  },
  {
    "operationId": "getWorkspaceAccounts",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts",
    "owner": "workspace-iam"
  },
  {
    "operationId": "getWorkspaceRole",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}",
    "owner": "workspace-iam"
  },
  {
    "operationId": "getWorkspaceRoles",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/roles",
    "owner": "workspace-iam"
  },
  {
    "operationId": "initializeCommercialGroup",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/commercial-group",
    "owner": "organization"
  },
  {
    "operationId": "listPlatformGroupWorkspaces",
    "method": "GET",
    "path": "/api/platform/group-workspaces",
    "owner": "platform-workspace"
  },
  {
    "operationId": "platformLogout",
    "method": "POST",
    "path": "/api/platform/auth/logout",
    "owner": "platform-iam"
  },
  {
    "operationId": "platformPasswordLogin",
    "method": "POST",
    "path": "/api/platform/auth/password-login",
    "owner": "platform-iam"
  },
  {
    "operationId": "releasePlatformStagedAsset",
    "method": "POST",
    "path": "/api/platform/assets/staging/{assetRef}/release",
    "owner": "platform-asset"
  },
  {
    "operationId": "replaceExtensionDefinition",
    "method": "PUT",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions/{entityType}",
    "owner": "extension"
  },
  {
    "operationId": "requestWorkspaceCredentialReset",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/credential-reset",
    "owner": "workspace-iam"
  },
  {
    "operationId": "resetPlatformAdminCredential",
    "method": "POST",
    "path": "/api/platform/admin-users/{platformAdminId}/credential-reset",
    "owner": "platform-iam"
  },
  {
    "operationId": "revokePlatformWorkspaceAssignment",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/assignments/{assignmentId}/revoke",
    "owner": "workspace-iam"
  },
  {
    "operationId": "sendPlatformLoginOtp",
    "method": "POST",
    "path": "/api/platform/auth/login-otp/send",
    "owner": "platform-iam"
  },
  {
    "operationId": "sendPlatformPasswordRecoveryOtp",
    "method": "POST",
    "path": "/api/platform/auth/password-recovery/otp/send",
    "owner": "platform-iam"
  },
  {
    "operationId": "stagePlatformAsset",
    "method": "POST",
    "path": "/api/platform/assets/staging",
    "owner": "platform-asset"
  },
  {
    "operationId": "startPlatformPasswordRecovery",
    "method": "POST",
    "path": "/api/platform/auth/password-recovery/start",
    "owner": "platform-iam"
  },
  {
    "operationId": "transitionPlatformAdminStatus",
    "method": "POST",
    "path": "/api/platform/admin-users/{platformAdminId}/status",
    "owner": "platform-iam"
  },
  {
    "operationId": "transitionPlatformGroupWorkspaceStatus",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/status",
    "owner": "platform-workspace"
  },
  {
    "operationId": "transitionWorkspaceAccountStatus",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/status",
    "owner": "workspace-iam"
  },
  {
    "operationId": "transitionWorkspaceRoleStatus",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}/status",
    "owner": "workspace-iam"
  },
  {
    "operationId": "updatePlatformAdminProfile",
    "method": "PATCH",
    "path": "/api/platform/admin-users/{platformAdminId}/profile",
    "owner": "platform-iam"
  },
  {
    "operationId": "updatePlatformGroupWorkspaceDisplay",
    "method": "PATCH",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}",
    "owner": "platform-workspace"
  },
  {
    "operationId": "updateWorkspaceRole",
    "method": "PATCH",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}",
    "owner": "workspace-iam"
  },
  {
    "operationId": "verifyPlatformLoginOtp",
    "method": "POST",
    "path": "/api/platform/auth/login-otp/verify",
    "owner": "platform-iam"
  },
  {
    "operationId": "verifyPlatformPasswordRecoveryOtp",
    "method": "POST",
    "path": "/api/platform/auth/password-recovery/otp/verify",
    "owner": "platform-iam"
  }
] as const;

export const PLATFORM_ADMIN_OPERATION_IDS = {
  "changeCurrentPlatformPassword": "changeCurrentPlatformPassword",
  "completePlatformPasswordRecovery": "completePlatformPasswordRecovery",
  "createPlatformAdmin": "createPlatformAdmin",
  "createPlatformGroupWorkspace": "createPlatformGroupWorkspace",
  "createWorkspaceRole": "createWorkspaceRole",
  "getCurrentPlatformSession": "getCurrentPlatformSession",
  "getExtensionDefinition": "getExtensionDefinition",
  "getExtensionEntityCatalog": "getExtensionEntityCatalog",
  "getPlatformAdminDetail": "getPlatformAdminDetail",
  "getPlatformAdminPage": "getPlatformAdminPage",
  "getPlatformContractOverviewDetail": "getPlatformContractOverviewDetail",
  "getPlatformContractOverviewPage": "getPlatformContractOverviewPage",
  "getPlatformEntityAuditHistory": "getPlatformEntityAuditHistory",
  "getPlatformGroupWorkspaceDetail": "getPlatformGroupWorkspaceDetail",
  "getPlatformOrganizationHierarchyTree": "getPlatformOrganizationHierarchyTree",
  "getPlatformOrganizationOverviewDetail": "getPlatformOrganizationOverviewDetail",
  "getPlatformOrganizationOverviewPage": "getPlatformOrganizationOverviewPage",
  "getWorkspaceAccount": "getWorkspaceAccount",
  "getWorkspaceAccounts": "getWorkspaceAccounts",
  "getWorkspaceRole": "getWorkspaceRole",
  "getWorkspaceRoles": "getWorkspaceRoles",
  "initializeCommercialGroup": "initializeCommercialGroup",
  "listPlatformGroupWorkspaces": "listPlatformGroupWorkspaces",
  "platformLogout": "platformLogout",
  "platformPasswordLogin": "platformPasswordLogin",
  "releasePlatformStagedAsset": "releasePlatformStagedAsset",
  "replaceExtensionDefinition": "replaceExtensionDefinition",
  "requestWorkspaceCredentialReset": "requestWorkspaceCredentialReset",
  "resetPlatformAdminCredential": "resetPlatformAdminCredential",
  "revokePlatformWorkspaceAssignment": "revokePlatformWorkspaceAssignment",
  "sendPlatformLoginOtp": "sendPlatformLoginOtp",
  "sendPlatformPasswordRecoveryOtp": "sendPlatformPasswordRecoveryOtp",
  "stagePlatformAsset": "stagePlatformAsset",
  "startPlatformPasswordRecovery": "startPlatformPasswordRecovery",
  "transitionPlatformAdminStatus": "transitionPlatformAdminStatus",
  "transitionPlatformGroupWorkspaceStatus": "transitionPlatformGroupWorkspaceStatus",
  "transitionWorkspaceAccountStatus": "transitionWorkspaceAccountStatus",
  "transitionWorkspaceRoleStatus": "transitionWorkspaceRoleStatus",
  "updatePlatformAdminProfile": "updatePlatformAdminProfile",
  "updatePlatformGroupWorkspaceDisplay": "updatePlatformGroupWorkspaceDisplay",
  "updateWorkspaceRole": "updateWorkspaceRole",
  "verifyPlatformLoginOtp": "verifyPlatformLoginOtp",
  "verifyPlatformPasswordRecoveryOtp": "verifyPlatformPasswordRecoveryOtp"
} as const;

export const EDGE_PROBLEM_CODES = [
  "COMMERCIAL_GROUP_ALREADY_INITIALIZED",
  "EXTENSION_DEFINITION_INVALID",
  "EXTENSION_DEFINITION_VERSION_CONFLICT",
  "GROUP_WORKSPACE_NOT_FOUND",
  "IDEMPOTENCY_CONFLICT",
  "INVALID_EDGE_CONTEXT",
  "PLATFORM_ASSET_BIND_CONFLICT",
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
  "PLATFORM_IAM_ACCOUNT_DISABLED",
  "PLATFORM_IAM_CREDENTIAL_LOCKED",
  "PLATFORM_IAM_INVALID_CREDENTIALS",
  "PLATFORM_IAM_LOGIN_NAME_CONFLICT",
  "PLATFORM_IAM_RATE_LIMITED",
  "PLATFORM_IAM_RESULT_UNKNOWN",
  "PLATFORM_IAM_SESSION_EXPIRED",
  "PLATFORM_WORKSPACE_KEY_CONFLICT",
  "PLATFORM_WORKSPACE_NAME_CONFLICT",
  "PLATFORM_WORKSPACE_STATUS_TRANSITION_INVALID",
  "UNKNOWN_SUBMISSION_RESULT",
  "VALIDATION_FAILED",
  "WORKSPACE_IAM_ACCOUNT_STATUS_TRANSITION_INVALID",
  "WORKSPACE_IAM_ACCOUNT_VERSION_CONFLICT",
  "WORKSPACE_IAM_ASSIGNMENT_NOT_ACTIVE",
  "WORKSPACE_IAM_ASSIGNMENT_VERSION_CONFLICT",
  "WORKSPACE_IAM_CREDENTIAL_RESET_UNAVAILABLE",
  "WORKSPACE_IAM_PAGE_ACCESS_CATALOG_MISMATCH",
  "WORKSPACE_IAM_ROLE_CAPABILITY_CATALOG_DRIFT",
  "WORKSPACE_IAM_ROLE_CAPABILITY_INCOMPATIBLE",
  "WORKSPACE_IAM_ROLE_CAPABILITY_UNKNOWN",
  "WORKSPACE_IAM_ROLE_NAME_CONFLICT",
  "WORKSPACE_IAM_ROLE_SERVICE_NODE_TYPE_UNSUPPORTED",
  "WORKSPACE_IAM_ROLE_STATUS_TRANSITION_INVALID",
  "WORKSPACE_IAM_ROLE_VERSION_CONFLICT"
] as const;
export type EdgeProblemCode = (typeof EDGE_PROBLEM_CODES)[number];
export type PlatformAdminOperationId = (typeof PLATFORM_ADMIN_OPERATIONS)[number]["operationId"];



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

export type CommercialGroupInitializeRequest = {
  groupCode: string;
  groupName: string;
  idempotencyKey: string;
};

export type CommercialGroupRoot = {
  id: string;
  groupWorkspaceKey: string;
  groupCode: string;
  groupName: string;
  version: number;
  createdAt: EpochMillis;
  updatedAt: EpochMillis;
};

export type ContractOverviewItem = {
  contractRef: {
  id: string;
  code: string;
  name: string;
  resolutionStatus: "RESOLVED" | "UNRESOLVED";
};
  storeRef: {
  id: string;
  code: string;
  name: string;
  resolutionStatus: "RESOLVED" | "UNRESOLVED";
};
  phaseName: string;
  tenantRef: {
  id: string;
  code: string;
  name: string;
  resolutionStatus: "RESOLVED" | "UNRESOLVED";
};
  effectiveFrom?: string;
  effectiveTo?: string;
  note?: (string) | null;
  itemSummary?: string;
  status: StoreContractStatus;
  source: "MANUAL";
  revision: number;
  createdAt: number;
  updatedAt: number;
  storeResolutionStatus: "RESOLVED" | "UNRESOLVED";
  tenantResolutionStatus: "RESOLVED" | "UNRESOLVED";
  extensionFields?: Array<{
  name: string;
  value?: (string) | null;
}>;
};

export type ContractOverviewPage = {
  metadata: {
  groupWorkspaceKey: string;
  page: number;
  pageSize: number;
  total: number;
  sort: StoreContractSortKey;
  direction: StoreContractSortDirection;
};
  items: Array<ContractOverviewItem>;
  itemsSourceStatus: "AVAILABLE" | "UNAVAILABLE";
  itemsAsOf: (number) | null;
  itemsUnresolved: Array<string>;
  filterOptions: Array<{
  kind: "STORE" | "TENANT";
  id: string;
  name: string;
}>;
  filterOptionsSourceStatus: "AVAILABLE" | "UNAVAILABLE";
  filterOptionsAsOf: (number) | null;
  filterOptionsUnresolved: Array<string>;
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

export type ExtensionDefinitionUpdateRequest = {
  definitions: Array<{
  key?: string;
  label: string;
  type: "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT";
  required: boolean;
  options: Array<string>;
  status?: "ENABLED" | "DISABLED";
  displayOrder?: number;
  displaySuffix?: string;
}>;
  expectedVersion: number;
};

export type ExtensionEntityCatalogPage = {
  items: Array<{
  entityType: ExtensionEntityType;
  displayName: string;
  configuredFieldCount: number;
  updatedAt: EpochMillis;
}>;
};

export type ExtensionEntityType = "BRAND" | "TENANT" | "HEAD_COMPANY" | "STORE" | "CONTRACT";

export type GroupWorkspaceCreateRequest = {
  groupWorkspaceKey: string;
  name: string;
  operationsTitle: string;
  logoAssetRef: string;
  logoBindGrant: string;
  notes?: string;
  idempotencyKey: string;
};

export type GroupWorkspaceCreateResult = {
  groupWorkspaceKey: string;
  name: string;
  operationsTitle: string;
  logoAssetRef: string;
  notes?: (string) | null;
  status: GroupWorkspaceStatus;
  statusChangedAt?: (number) | null;
  version: number;
  createdAt: EpochMillis;
  updatedAt: EpochMillis;
};

export type GroupWorkspaceDetail = {
  groupWorkspaceKey: string;
  name: string;
  operationsTitle: string;
  logoAssetRef?: (string) | null;
  logoUrl?: (string) | null;
  notes?: (string) | null;
  status: GroupWorkspaceStatus;
  statusChangedAt?: (number) | null;
  version: number;
  createdAt: EpochMillis;
  updatedAt: EpochMillis;
  commercialGroup?: {
  initialized: boolean;
  root?: ((CommercialGroupRoot)) | null;
};
  workspaceSourceStatus?: "AVAILABLE" | "UNAVAILABLE";
  workspaceAsOf?: EpochMillis;
  workspaceUnresolved?: (string) | null;
  initializationSourceStatus?: "AVAILABLE" | "UNAVAILABLE";
  initializationAsOf?: EpochMillis;
  initializationUnresolved?: (string) | null;
  accountAccessSourceStatus?: "AVAILABLE" | "UNAVAILABLE";
  accountAccessAsOf?: EpochMillis;
  accountAccessUnresolved?: (string) | null;
  accountCount?: (number) | null;
  roleCount?: (number) | null;
};

export type GroupWorkspaceDisplayUpdateRequest = {
  name: string;
  operationsTitle: string;
  notes?: (string) | null;
  logoIntent: "KEEP" | "REPLACE" | "REMOVE";
  logoAssetRef?: (string) | null;
  logoBindGrant?: (string) | null;
  expectedVersion: number;
  idempotencyKey: string;
};

export type GroupWorkspacePage = {
  items: Array<{
  groupWorkspaceKey: string;
  name: string;
  operationsTitle?: (string) | null;
  logoAssetRef?: (string) | null;
  logoUrl?: (string) | null;
  commercialGroup?: {
  initialized: boolean;
  root?: ((CommercialGroupRoot)) | null;
};
  status: GroupWorkspaceStatus;
  updatedAt: EpochMillis;
}>;
  page: number;
  pageSize: number;
  total: number;
  sortKey: GroupWorkspaceSortKey;
  sortDirection: SortDirection;
};

export type GroupWorkspaceSortKey = "NAME" | "WORKSPACE_KEY" | "UPDATED_AT";

export type GroupWorkspaceStatus = "ENABLED" | "DISABLED";

export type GroupWorkspaceStatusTransitionRequest = {
  targetStatus: GroupWorkspaceStatus;
  expectedVersion: number;
  idempotencyKey: string;
};

export type LoginRequest = {
  accountName: string;
  password: string;
};

export type NoBody = Record<string, never>;

export type NoContent = null;

export type OrganizationHierarchyTree = {
  groupCode: string;
  groupName: string;
  regions: Array<OrganizationHierarchyTreeNode>;
};

export type OrganizationHierarchyTreeNode = {
  id: string;
  type: "REGION" | "PROJECT";
  code: string;
  name: string;
  status: OrganizationOverviewStatus;
  notes?: (string) | null;
  updatedAt: number;
  children: Array<OrganizationHierarchyTreeNode>;
};

export type OrganizationOverviewCategory = "HIERARCHY" | "BUSINESS_ENTITY" | "STORE";

export type OrganizationOverviewItem = {
  id: string;
  groupWorkspaceKey: string;
  category: OrganizationOverviewCategory;
  type: OrganizationOverviewType;
  code: string;
  name: string;
  path: Array<{
  id: string;
  code: string;
  name: string;
  resolved: boolean;
}>;
  status: OrganizationOverviewStatus;
  source: OrganizationOverviewSource;
  version: number;
  createdAt: number;
  updatedAt: number;
  notes?: (string) | null;
  project?: {
  id: string;
  code: string;
  name: string;
  resolved: boolean;
};
  brand?: {
  id: string;
  code: string;
  name: string;
  resolved: boolean;
};
  tenant?: {
  id: string;
  code: string;
  name: string;
  resolved: boolean;
};
  headCompany?: {
  id: string;
  code: string;
  name: string;
  resolved: boolean;
};
  unresolvedReferences?: Array<string>;
  extensionFields?: Array<{
  name: string;
  value?: (string) | null;
}>;
};

export type OrganizationOverviewPage = {
  metadata: {
  groupWorkspaceKey: string;
  category: OrganizationOverviewCategory;
  page: number;
  pageSize: number;
  total: number;
  sort: OrganizationOverviewSortKey;
  direction: OrganizationOverviewSortDirection;
};
  items: Array<OrganizationOverviewItem>;
  itemsSourceStatus: "AVAILABLE" | "UNAVAILABLE";
  itemsAsOf: (number) | null;
  itemsUnresolved: Array<string>;
  filterOptions: Array<{
  kind: "PROJECT" | "BRAND" | "TENANT";
  id: string;
  code: string;
  name: string;
}>;
  filterOptionsSourceStatus: "AVAILABLE" | "UNAVAILABLE";
  filterOptionsAsOf: (number) | null;
  filterOptionsUnresolved: Array<string>;
};

export type OrganizationOverviewSortDirection = "ASC" | "DESC";

export type OrganizationOverviewSortKey = "NAME" | "CODE" | "UPDATED_AT";

export type OrganizationOverviewSource = "MANUAL" | "SYSTEM";

export type OrganizationOverviewStatus = "ENABLED" | "DISABLED";

export type OrganizationOverviewType = "GROUP" | "REGION" | "PROJECT" | "BRAND" | "TENANT" | "HEAD_COMPANY" | "STORE";

export type PlatformAdminCreateRequest = {
  loginName: string;
  userName: string;
  mobile?: (string) | null;
  password: string;
  idempotencyKey: string;
};

export type PlatformAdminCredentialResetRequest = {
  password: string;
  expectedVersion: number;
  idempotencyKey: string;
};

export type PlatformAdminDetail = {
  id: string;
  userName: string;
  loginName: string;
  builtIn: boolean;
  mobile?: (string) | null;
  maskedMobile?: (string) | null;
  status: PlatformAdminStatus;
  credentialStatus: "SET";
  lastLoginAt?: (EpochMillis) | null;
  createdAt: EpochMillis;
  updatedAt: EpochMillis;
  version: number;
  auditSummary: string;
};

export type PlatformAdminPage = {
  items: Array<{
  id: string;
  userName: string;
  loginName: string;
  builtIn: boolean;
  status: PlatformAdminStatus;
  lastLoginAt?: (EpochMillis) | null;
  updatedAt: EpochMillis;
  version: number;
}>;
  page: number;
  pageSize: number;
  total: number;
  sortKey: PlatformAdminSortKey;
  sortDirection: SortDirection;
};

export type PlatformAdminProfileUpdateRequest = {
  userName: string;
  mobile?: (string) | null;
  expectedVersion: number;
  idempotencyKey: string;
};

export type PlatformAdminSortKey = "USER_NAME" | "LOGIN_NAME" | "LAST_LOGIN_AT" | "UPDATED_AT";

export type PlatformAdminStatus = "ACTIVE" | "DISABLED";

export type PlatformAdminStatusTransitionRequest = {
  targetStatus: PlatformAdminStatus;
  expectedVersion: number;
  idempotencyKey: string;
};

export type PlatformAssetStageMultipart = {
  usage: "GROUP_WORKSPACE_LOGO";
  groupWorkspaceKey?: string;
  file: Blob;
};

export type PlatformAssetStagingResult = {
  assetRef: string;
  bindGrant: string;
  expiresAt: EpochMillis;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  sizeBytes: number;
  sha256: string;
};

export type PlatformCurrentPasswordChangeRequest = {
  currentPassword: string;
  newPassword: string;
  expectedSessionVersion: number;
};

export type PlatformCurrentPasswordChangeResult = {
  status: "COMPLETED";
  sessionsRevoked: boolean;
  reauthenticationRequired: boolean;
};

export type PlatformLoginOtpSendRequest = {
  mobile: string;
};

export type PlatformLoginOtpVerifyRequest = {
  mobile: string;
  code: string;
};

export type PlatformOtpDispatchResponse = {
  expiresAt: EpochMillis;
  debugVerificationCode?: (string) | null;
};

export type PlatformPasswordRecoveryCompleteRequest = {
  newPassword: string;
};

export type PlatformPasswordRecoveryCompletion = {
  status: "COMPLETED";
  sessionsRevoked: boolean;
  reauthenticationRequired: boolean;
};

export type PlatformPasswordRecoveryOtpSendRequest = Record<string, never>;

export type PlatformPasswordRecoveryOtpVerifyRequest = {
  code: string;
};

export type PlatformPasswordRecoveryStartRequest = {
  loginName: string;
  mobile: string;
};

export type PlatformPasswordRecoveryStartResponse = {
  status: "OTP_REQUIRED";
};

export type PlatformPasswordRecoveryVerification = {
  status: "PASSWORD_REQUIRED";
};

export type PlatformSessionView = {
  sessionId: string;
  sessionVersion: number;
  displayName: string;
  capabilities: Array<"platform.admin.access" | "platform.workspace.initialize">;
  platformAdminAccessible: boolean;
};

export type Problem = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: (string) | null;
  errorCode: EdgeProblemCode;
  correlationId: string;
  brandAuthorizationBlockers?: {
  visibleStores: Array<{
  id: string;
  code: string;
  name: string;
}>;
};
};

export type ServiceNodeType = "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";

export type SortDirection = "ASC" | "DESC";

export type StoreContractSortDirection = "ASC" | "DESC";

export type StoreContractSortKey = "CONTRACT_NO" | "EFFECTIVE_FROM" | "UPDATED_AT";

export type StoreContractStatus = "VALID" | "INVALID";

export type WorkspaceAccount = {
  id: string;
  groupWorkspaceKey: string;
  displayName: string;
  maskedMobile: string;
  loginName: string;
  status: WorkspaceAccountStatus;
  credentialStatus: "SET" | "RESET_PENDING";
  activeAssignmentCount: number;
  lastLoginAt?: (EpochMillis) | null;
  createdAt: EpochMillis;
  updatedAt: EpochMillis;
  revision: number;
  assignments: Array<{
  id: string;
  serviceNodeType: ServiceNodeType;
  organizationPath: string;
  roleName: string;
  status: "ACTIVE" | "REVOKED";
  source: "INVITATION" | "ADMINISTRATION";
  revision: number;
}>;
  invitationHistory: Array<{
  invitationId: string;
  status: WorkspaceInvitationStatus;
  generation: number;
  expiresAt: EpochMillis;
}>;
};

export type WorkspaceAccountPage = {
  items: Array<WorkspaceAccount>;
  page: number;
  pageSize: number;
  total: number;
};

export type WorkspaceAccountStatus = "ENABLED" | "DISABLED";

export type WorkspaceAccountStatusTransitionRequest = {
  targetStatus: WorkspaceAccountStatus;
  expectedVersion: number;
};

export type WorkspaceAssignmentRevokeRequest = {
  expectedVersion: number;
};

export type WorkspaceAssignmentRevokeResult = {
  assignmentId: string;
  status: "REVOKED";
  version: number;
  revokedAt: number;
};

export type WorkspaceCredentialResetRequest = {
  expectedVersion: number;
};

export type WorkspaceCredentialResetResult = {
  accountId: string;
  loginName: string;
  status: WorkspaceAccountStatus;
  credentialStatus: "SET" | "RESET_PENDING";
  generation: number;
  expiresAt: EpochMillis;
  deliveryStatus: "QUEUED" | "SENT" | "UNAVAILABLE";
  revision: number;
};

export type WorkspaceInvitationStatus = "ACTIVE" | "CANCELLED" | "EXPIRED" | "COMPLETED";

export type WorkspaceRole = {
  id: string;
  groupWorkspaceKey: string;
  name: string;
  description?: (string) | null;
  serviceNodeType: ServiceNodeType;
  capabilityKeys: Array<"BC-ORG-GROUP-EDIT" | "BC-ORG-GROUP-STATUS" | "BC-ORG-REGION-CREATE" | "BC-ORG-REGION-EDIT" | "BC-ORG-REGION-STATUS" | "BC-ORG-PROJECT-CREATE" | "BC-ORG-PROJECT-EDIT" | "BC-ORG-PROJECT-STATUS" | "BC-ORG-BRAND-CREATE" | "BC-ORG-BRAND-EDIT" | "BC-ORG-BRAND-STATUS" | "BC-ORG-TENANT-CREATE" | "BC-ORG-TENANT-EDIT" | "BC-ORG-TENANT-STATUS" | "BC-ORG-HEAD-COMPANY-CREATE" | "BC-ORG-HEAD-COMPANY-EDIT" | "BC-ORG-HEAD-COMPANY-STATUS" | "BC-ORG-HEAD-COMPANY-BRAND" | "BC-ORG-STORE-CREATE" | "BC-ORG-STORE-EDIT" | "BC-ORG-STORE-STATUS" | "BC-IAM-GROUP-ROLE-REVOKE" | "BC-IAM-REGION-ROLE-REVOKE" | "BC-IAM-PROJECT-ROLE-REVOKE" | "BC-IAM-HEAD-COMPANY-ROLE-REVOKE" | "BC-IAM-STORE-ROLE-REVOKE" | "BC-IAM-GROUP-INVITE" | "BC-IAM-REGION-INVITE" | "BC-IAM-PROJECT-INVITE" | "BC-IAM-HEAD-COMPANY-INVITE" | "BC-IAM-STORE-INVITE" | "BC-CONTRACT-CREATE" | "BC-CONTRACT-EDIT" | "BC-CONTRACT-INVALIDATE">;
  pageAccessKeys: Array<string>;
  status: WorkspaceRoleStatus;
  revision: number;
  createdAt: EpochMillis;
  updatedAt: EpochMillis;
};

export type WorkspaceRoleCreateRequest = {
  name: string;
  description?: (string) | null;
  serviceNodeType: ServiceNodeType;
  capabilityKeys: Array<"BC-ORG-GROUP-EDIT" | "BC-ORG-GROUP-STATUS" | "BC-ORG-REGION-CREATE" | "BC-ORG-REGION-EDIT" | "BC-ORG-REGION-STATUS" | "BC-ORG-PROJECT-CREATE" | "BC-ORG-PROJECT-EDIT" | "BC-ORG-PROJECT-STATUS" | "BC-ORG-BRAND-CREATE" | "BC-ORG-BRAND-EDIT" | "BC-ORG-BRAND-STATUS" | "BC-ORG-TENANT-CREATE" | "BC-ORG-TENANT-EDIT" | "BC-ORG-TENANT-STATUS" | "BC-ORG-HEAD-COMPANY-CREATE" | "BC-ORG-HEAD-COMPANY-EDIT" | "BC-ORG-HEAD-COMPANY-STATUS" | "BC-ORG-HEAD-COMPANY-BRAND" | "BC-ORG-STORE-CREATE" | "BC-ORG-STORE-EDIT" | "BC-ORG-STORE-STATUS" | "BC-IAM-GROUP-ROLE-REVOKE" | "BC-IAM-REGION-ROLE-REVOKE" | "BC-IAM-PROJECT-ROLE-REVOKE" | "BC-IAM-HEAD-COMPANY-ROLE-REVOKE" | "BC-IAM-STORE-ROLE-REVOKE" | "BC-IAM-GROUP-INVITE" | "BC-IAM-REGION-INVITE" | "BC-IAM-PROJECT-INVITE" | "BC-IAM-HEAD-COMPANY-INVITE" | "BC-IAM-STORE-INVITE" | "BC-CONTRACT-CREATE" | "BC-CONTRACT-EDIT" | "BC-CONTRACT-INVALIDATE">;
  pageAccessKeys: Array<string>;
};

export type WorkspaceRolePage = {
  items: Array<WorkspaceRole>;
  page: number;
  pageSize: number;
  total: number;
  capabilityCatalog: Array<{
  key: "BC-ORG-GROUP-EDIT" | "BC-ORG-GROUP-STATUS" | "BC-ORG-REGION-CREATE" | "BC-ORG-REGION-EDIT" | "BC-ORG-REGION-STATUS" | "BC-ORG-PROJECT-CREATE" | "BC-ORG-PROJECT-EDIT" | "BC-ORG-PROJECT-STATUS" | "BC-ORG-BRAND-CREATE" | "BC-ORG-BRAND-EDIT" | "BC-ORG-BRAND-STATUS" | "BC-ORG-TENANT-CREATE" | "BC-ORG-TENANT-EDIT" | "BC-ORG-TENANT-STATUS" | "BC-ORG-HEAD-COMPANY-CREATE" | "BC-ORG-HEAD-COMPANY-EDIT" | "BC-ORG-HEAD-COMPANY-STATUS" | "BC-ORG-HEAD-COMPANY-BRAND" | "BC-ORG-STORE-CREATE" | "BC-ORG-STORE-EDIT" | "BC-ORG-STORE-STATUS" | "BC-IAM-GROUP-ROLE-REVOKE" | "BC-IAM-REGION-ROLE-REVOKE" | "BC-IAM-PROJECT-ROLE-REVOKE" | "BC-IAM-HEAD-COMPANY-ROLE-REVOKE" | "BC-IAM-STORE-ROLE-REVOKE" | "BC-IAM-GROUP-INVITE" | "BC-IAM-REGION-INVITE" | "BC-IAM-PROJECT-INVITE" | "BC-IAM-HEAD-COMPANY-INVITE" | "BC-IAM-STORE-INVITE" | "BC-CONTRACT-CREATE" | "BC-CONTRACT-EDIT" | "BC-CONTRACT-INVALIDATE";
  actionGroupKey: string;
  actionGroupLabel: string;
  actionGroupOrder: number;
  label: string;
  description: string;
  organizationTypes: Array<ServiceNodeType>;
}>;
  pageAccessCatalog: Array<{
  pageDesignKey: string;
  title: string;
  menuGroup: string;
  menuOrder: number;
  requiredDataNodeType: "NONE" | "REGION" | "PROJECT" | "STORE";
  eligibleOrganizationTypes: Array<ServiceNodeType>;
}>;
};

export type WorkspaceRoleStatus = "ENABLED" | "DISABLED";

export type WorkspaceRoleStatusTransitionRequest = {
  targetStatus: WorkspaceRoleStatus;
  expectedVersion: number;
};

export type WorkspaceRoleUpdateRequest = {
  name: string;
  description?: (string) | null;
  capabilityKeys: Array<"BC-ORG-GROUP-EDIT" | "BC-ORG-GROUP-STATUS" | "BC-ORG-REGION-CREATE" | "BC-ORG-REGION-EDIT" | "BC-ORG-REGION-STATUS" | "BC-ORG-PROJECT-CREATE" | "BC-ORG-PROJECT-EDIT" | "BC-ORG-PROJECT-STATUS" | "BC-ORG-BRAND-CREATE" | "BC-ORG-BRAND-EDIT" | "BC-ORG-BRAND-STATUS" | "BC-ORG-TENANT-CREATE" | "BC-ORG-TENANT-EDIT" | "BC-ORG-TENANT-STATUS" | "BC-ORG-HEAD-COMPANY-CREATE" | "BC-ORG-HEAD-COMPANY-EDIT" | "BC-ORG-HEAD-COMPANY-STATUS" | "BC-ORG-HEAD-COMPANY-BRAND" | "BC-ORG-STORE-CREATE" | "BC-ORG-STORE-EDIT" | "BC-ORG-STORE-STATUS" | "BC-IAM-GROUP-ROLE-REVOKE" | "BC-IAM-REGION-ROLE-REVOKE" | "BC-IAM-PROJECT-ROLE-REVOKE" | "BC-IAM-HEAD-COMPANY-ROLE-REVOKE" | "BC-IAM-STORE-ROLE-REVOKE" | "BC-IAM-GROUP-INVITE" | "BC-IAM-REGION-INVITE" | "BC-IAM-PROJECT-INVITE" | "BC-IAM-HEAD-COMPANY-INVITE" | "BC-IAM-STORE-INVITE" | "BC-CONTRACT-CREATE" | "BC-CONTRACT-EDIT" | "BC-CONTRACT-INVALIDATE">;
  pageAccessKeys: Array<string>;
  expectedVersion: number;
};

export type FaceOperationContracts = {
  "changeCurrentPlatformPassword": {
    request: PlatformCurrentPasswordChangeRequest;
    response: PlatformCurrentPasswordChangeResult;
    requestRequired: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "completePlatformPasswordRecovery": {
    request: PlatformPasswordRecoveryCompleteRequest;
    response: PlatformPasswordRecoveryCompletion;
    requestRequired: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createPlatformAdmin": {
    request: PlatformAdminCreateRequest;
    response: PlatformAdminDetail;
    requestRequired: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createPlatformGroupWorkspace": {
    request: GroupWorkspaceCreateRequest;
    response: GroupWorkspaceCreateResult;
    requestRequired: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createWorkspaceRole": {
    request: WorkspaceRoleCreateRequest;
    response: WorkspaceRole;
    requestRequired: true;
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
  "getCurrentPlatformSession": {
    request: NoBody;
    response: PlatformSessionView;
    requestRequired: false;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getExtensionDefinition": {
    request: NoBody;
    response: ExtensionDefinition;
    requestRequired: false;
    path: {
    groupWorkspaceKey: string;
    entityType: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getExtensionEntityCatalog": {
    request: NoBody;
    response: ExtensionEntityCatalogPage;
    requestRequired: false;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformAdminDetail": {
    request: NoBody;
    response: PlatformAdminDetail;
    requestRequired: false;
    path: {
    platformAdminId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformAdminPage": {
    request: NoBody;
    response: PlatformAdminPage;
    requestRequired: false;
    path: Record<string, never>;
    query: {
    userName?: string;
    loginName?: string;
    status?: PlatformAdminStatus;
    page?: number;
    pageSize?: number;
    sortKey?: PlatformAdminSortKey;
    sortDirection?: SortDirection;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformContractOverviewDetail": {
    request: NoBody;
    response: ContractOverviewItem;
    requestRequired: false;
    path: {
    groupWorkspaceKey: string;
    contractId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformContractOverviewPage": {
    request: NoBody;
    response: ContractOverviewPage;
    requestRequired: false;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    contractNo?: string;
    storeName?: string;
    phaseName?: string;
    tenantName?: string;
    itemCode?: string;
    status?: StoreContractStatus;
    sort?: StoreContractSortKey;
    direction?: StoreContractSortDirection;
    page?: number;
    pageSize?: number;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformEntityAuditHistory": {
    request: NoBody;
    response: AuditHistoryPage;
    requestRequired: false;
    path: Record<string, never>;
    query: {
    groupWorkspaceKey?: string;
    entityType: "GROUP_WORKSPACE" | "PLATFORM_ADMIN" | "WORKSPACE_ROLE" | "WORKSPACE_ACCOUNT" | "EXTENSION_DEFINITION" | "STORE_CONTRACT";
    entityId: string;
    page?: number;
    pageSize?: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformGroupWorkspaceDetail": {
    request: NoBody;
    response: GroupWorkspaceDetail;
    requestRequired: false;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformOrganizationHierarchyTree": {
    request: NoBody;
    response: OrganizationHierarchyTree;
    requestRequired: false;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformOrganizationOverviewDetail": {
    request: NoBody;
    response: OrganizationOverviewItem;
    requestRequired: false;
    path: {
    groupWorkspaceKey: string;
    category: string;
    itemId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformOrganizationOverviewPage": {
    request: NoBody;
    response: OrganizationOverviewPage;
    requestRequired: false;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    category: OrganizationOverviewCategory;
    type?: OrganizationOverviewType;
    name?: string;
    code?: string;
    status?: OrganizationOverviewStatus;
    source?: OrganizationOverviewSource;
    projectId?: string;
    brandId?: string;
    tenantId?: string;
    sort?: OrganizationOverviewSortKey;
    direction?: OrganizationOverviewSortDirection;
    page?: number;
    pageSize?: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getWorkspaceAccount": {
    request: NoBody;
    response: WorkspaceAccount;
    requestRequired: false;
    path: {
    groupWorkspaceKey: string;
    accountId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getWorkspaceAccounts": {
    request: NoBody;
    response: WorkspaceAccountPage;
    requestRequired: false;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    userName?: string;
    mobile?: string;
    loginName?: string;
    roleQuery?: string;
    status?: WorkspaceAccountStatus;
    page?: number;
    pageSize?: number;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getWorkspaceRole": {
    request: NoBody;
    response: WorkspaceRole;
    requestRequired: false;
    path: {
    groupWorkspaceKey: string;
    roleId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getWorkspaceRoles": {
    request: NoBody;
    response: WorkspaceRolePage;
    requestRequired: false;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    name?: string;
    organizationType?: ServiceNodeType;
    status?: WorkspaceRoleStatus;
    page?: number;
    pageSize?: number;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "initializeCommercialGroup": {
    request: CommercialGroupInitializeRequest;
    response: CommercialGroupRoot;
    requestRequired: true;
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
  "listPlatformGroupWorkspaces": {
    request: NoBody;
    response: GroupWorkspacePage;
    requestRequired: false;
    path: Record<string, never>;
    query: {
    name?: string;
    groupWorkspaceKey?: string;
    operationsTitle?: string;
    status?: GroupWorkspaceStatus;
    page?: number;
    pageSize?: number;
    sortKey?: GroupWorkspaceSortKey;
    sortDirection?: SortDirection;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "platformLogout": {
    request: NoBody;
    response: NoContent;
    requestRequired: false;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "platformPasswordLogin": {
    request: LoginRequest;
    response: PlatformSessionView;
    requestRequired: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "releasePlatformStagedAsset": {
    request: NoBody;
    response: NoContent;
    requestRequired: false;
    path: {
    assetRef: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "X-Asset-Bind-Grant": string;
  };
    headersRequired: true;
  };
  "replaceExtensionDefinition": {
    request: ExtensionDefinitionUpdateRequest;
    response: ExtensionDefinition;
    requestRequired: true;
    path: {
    groupWorkspaceKey: string;
    entityType: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "requestWorkspaceCredentialReset": {
    request: WorkspaceCredentialResetRequest;
    response: WorkspaceCredentialResetResult;
    requestRequired: true;
    path: {
    groupWorkspaceKey: string;
    accountId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "resetPlatformAdminCredential": {
    request: PlatformAdminCredentialResetRequest;
    response: PlatformAdminDetail;
    requestRequired: true;
    path: {
    platformAdminId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "revokePlatformWorkspaceAssignment": {
    request: WorkspaceAssignmentRevokeRequest;
    response: WorkspaceAssignmentRevokeResult;
    requestRequired: true;
    path: {
    groupWorkspaceKey: string;
    accountId: string;
    assignmentId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "sendPlatformLoginOtp": {
    request: PlatformLoginOtpSendRequest;
    response: PlatformOtpDispatchResponse;
    requestRequired: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "sendPlatformPasswordRecoveryOtp": {
    request: PlatformPasswordRecoveryOtpSendRequest;
    response: PlatformOtpDispatchResponse;
    requestRequired: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "stagePlatformAsset": {
    request: PlatformAssetStageMultipart;
    response: PlatformAssetStagingResult;
    requestRequired: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "startPlatformPasswordRecovery": {
    request: PlatformPasswordRecoveryStartRequest;
    response: PlatformPasswordRecoveryStartResponse;
    requestRequired: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "transitionPlatformAdminStatus": {
    request: PlatformAdminStatusTransitionRequest;
    response: PlatformAdminDetail;
    requestRequired: true;
    path: {
    platformAdminId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "transitionPlatformGroupWorkspaceStatus": {
    request: GroupWorkspaceStatusTransitionRequest;
    response: GroupWorkspaceDetail;
    requestRequired: true;
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
  "transitionWorkspaceAccountStatus": {
    request: WorkspaceAccountStatusTransitionRequest;
    response: WorkspaceAccount;
    requestRequired: true;
    path: {
    groupWorkspaceKey: string;
    accountId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "transitionWorkspaceRoleStatus": {
    request: WorkspaceRoleStatusTransitionRequest;
    response: WorkspaceRole;
    requestRequired: true;
    path: {
    groupWorkspaceKey: string;
    roleId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "updatePlatformAdminProfile": {
    request: PlatformAdminProfileUpdateRequest;
    response: PlatformAdminDetail;
    requestRequired: true;
    path: {
    platformAdminId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "updatePlatformGroupWorkspaceDisplay": {
    request: GroupWorkspaceDisplayUpdateRequest;
    response: GroupWorkspaceDetail;
    requestRequired: true;
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
  "updateWorkspaceRole": {
    request: WorkspaceRoleUpdateRequest;
    response: WorkspaceRole;
    requestRequired: true;
    path: {
    groupWorkspaceKey: string;
    roleId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "verifyPlatformLoginOtp": {
    request: PlatformLoginOtpVerifyRequest;
    response: PlatformSessionView;
    requestRequired: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "verifyPlatformPasswordRecoveryOtp": {
    request: PlatformPasswordRecoveryOtpVerifyRequest;
    response: PlatformPasswordRecoveryVerification;
    requestRequired: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
};

type RequestPart<I extends PlatformAdminOperationId> = FaceOperationContracts[I]["requestRequired"] extends true
  ? {body: FaceOperationContracts[I]["request"]}
  : {body?: never};
type QueryPart<I extends PlatformAdminOperationId> = FaceOperationContracts[I]["queryRequired"] extends true
  ? {query: FaceOperationContracts[I]["query"]}
  : {query?: FaceOperationContracts[I]["query"]};
type HeaderPart<I extends PlatformAdminOperationId> = FaceOperationContracts[I]["headersRequired"] extends true
  ? {headers: FaceOperationContracts[I]["headers"]}
  : {headers?: never};
export type FaceOperationOptions<I extends PlatformAdminOperationId> = RequestPart<I> & QueryPart<I> & HeaderPart<I>;
export type FaceOperationRequest<I extends PlatformAdminOperationId> = FaceOperationOptions<I> & {
  operationId: I;
  method: (typeof PLATFORM_ADMIN_OPERATIONS)[number]["method"];
  path: (typeof PLATFORM_ADMIN_OPERATIONS)[number]["path"];
  pathParameters: FaceOperationContracts[I]["path"];
};
export type FaceExecutor = <I extends PlatformAdminOperationId>(request: FaceOperationRequest<I>) => Promise<FaceOperationContracts[I]["response"]>;

export function createPlatformAdminClient(execute: FaceExecutor) {
  return {
    changeCurrentPlatformPassword: (pathParameters: FaceOperationContracts["changeCurrentPlatformPassword"]["path"], options: FaceOperationOptions<"changeCurrentPlatformPassword">) => execute({
      operationId: "changeCurrentPlatformPassword",
      method: "POST",
      path: "/api/platform/auth/password",
      pathParameters,
      ...options,
    }),
    completePlatformPasswordRecovery: (pathParameters: FaceOperationContracts["completePlatformPasswordRecovery"]["path"], options: FaceOperationOptions<"completePlatformPasswordRecovery">) => execute({
      operationId: "completePlatformPasswordRecovery",
      method: "POST",
      path: "/api/platform/auth/password-recovery/complete",
      pathParameters,
      ...options,
    }),
    createPlatformAdmin: (pathParameters: FaceOperationContracts["createPlatformAdmin"]["path"], options: FaceOperationOptions<"createPlatformAdmin">) => execute({
      operationId: "createPlatformAdmin",
      method: "POST",
      path: "/api/platform/admin-users",
      pathParameters,
      ...options,
    }),
    createPlatformGroupWorkspace: (pathParameters: FaceOperationContracts["createPlatformGroupWorkspace"]["path"], options: FaceOperationOptions<"createPlatformGroupWorkspace">) => execute({
      operationId: "createPlatformGroupWorkspace",
      method: "POST",
      path: "/api/platform/group-workspaces",
      pathParameters,
      ...options,
    }),
    createWorkspaceRole: (pathParameters: FaceOperationContracts["createWorkspaceRole"]["path"], options: FaceOperationOptions<"createWorkspaceRole">) => execute({
      operationId: "createWorkspaceRole",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/roles",
      pathParameters,
      ...options,
    }),
    getCurrentPlatformSession: (pathParameters: FaceOperationContracts["getCurrentPlatformSession"]["path"], options: FaceOperationOptions<"getCurrentPlatformSession">) => execute({
      operationId: "getCurrentPlatformSession",
      method: "GET",
      path: "/api/platform/auth/session",
      pathParameters,
      ...options,
    }),
    getExtensionDefinition: (pathParameters: FaceOperationContracts["getExtensionDefinition"]["path"], options: FaceOperationOptions<"getExtensionDefinition">) => execute({
      operationId: "getExtensionDefinition",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions/{entityType}",
      pathParameters,
      ...options,
    }),
    getExtensionEntityCatalog: (pathParameters: FaceOperationContracts["getExtensionEntityCatalog"]["path"], options: FaceOperationOptions<"getExtensionEntityCatalog">) => execute({
      operationId: "getExtensionEntityCatalog",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions",
      pathParameters,
      ...options,
    }),
    getPlatformAdminDetail: (pathParameters: FaceOperationContracts["getPlatformAdminDetail"]["path"], options: FaceOperationOptions<"getPlatformAdminDetail">) => execute({
      operationId: "getPlatformAdminDetail",
      method: "GET",
      path: "/api/platform/admin-users/{platformAdminId}",
      pathParameters,
      ...options,
    }),
    getPlatformAdminPage: (pathParameters: FaceOperationContracts["getPlatformAdminPage"]["path"], options: FaceOperationOptions<"getPlatformAdminPage">) => execute({
      operationId: "getPlatformAdminPage",
      method: "GET",
      path: "/api/platform/admin-users",
      pathParameters,
      ...options,
    }),
    getPlatformContractOverviewDetail: (pathParameters: FaceOperationContracts["getPlatformContractOverviewDetail"]["path"], options: FaceOperationOptions<"getPlatformContractOverviewDetail">) => execute({
      operationId: "getPlatformContractOverviewDetail",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview/{contractId}",
      pathParameters,
      ...options,
    }),
    getPlatformContractOverviewPage: (pathParameters: FaceOperationContracts["getPlatformContractOverviewPage"]["path"], options: FaceOperationOptions<"getPlatformContractOverviewPage">) => execute({
      operationId: "getPlatformContractOverviewPage",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview",
      pathParameters,
      ...options,
    }),
    getPlatformEntityAuditHistory: (pathParameters: FaceOperationContracts["getPlatformEntityAuditHistory"]["path"], options: FaceOperationOptions<"getPlatformEntityAuditHistory">) => execute({
      operationId: "getPlatformEntityAuditHistory",
      method: "GET",
      path: "/api/platform/audit-history",
      pathParameters,
      ...options,
    }),
    getPlatformGroupWorkspaceDetail: (pathParameters: FaceOperationContracts["getPlatformGroupWorkspaceDetail"]["path"], options: FaceOperationOptions<"getPlatformGroupWorkspaceDetail">) => execute({
      operationId: "getPlatformGroupWorkspaceDetail",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}",
      pathParameters,
      ...options,
    }),
    getPlatformOrganizationHierarchyTree: (pathParameters: FaceOperationContracts["getPlatformOrganizationHierarchyTree"]["path"], options: FaceOperationOptions<"getPlatformOrganizationHierarchyTree">) => execute({
      operationId: "getPlatformOrganizationHierarchyTree",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/hierarchy",
      pathParameters,
      ...options,
    }),
    getPlatformOrganizationOverviewDetail: (pathParameters: FaceOperationContracts["getPlatformOrganizationOverviewDetail"]["path"], options: FaceOperationOptions<"getPlatformOrganizationOverviewDetail">) => execute({
      operationId: "getPlatformOrganizationOverviewDetail",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/{category}/{itemId}",
      pathParameters,
      ...options,
    }),
    getPlatformOrganizationOverviewPage: (pathParameters: FaceOperationContracts["getPlatformOrganizationOverviewPage"]["path"], options: FaceOperationOptions<"getPlatformOrganizationOverviewPage">) => execute({
      operationId: "getPlatformOrganizationOverviewPage",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview",
      pathParameters,
      ...options,
    }),
    getWorkspaceAccount: (pathParameters: FaceOperationContracts["getWorkspaceAccount"]["path"], options: FaceOperationOptions<"getWorkspaceAccount">) => execute({
      operationId: "getWorkspaceAccount",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}",
      pathParameters,
      ...options,
    }),
    getWorkspaceAccounts: (pathParameters: FaceOperationContracts["getWorkspaceAccounts"]["path"], options: FaceOperationOptions<"getWorkspaceAccounts">) => execute({
      operationId: "getWorkspaceAccounts",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts",
      pathParameters,
      ...options,
    }),
    getWorkspaceRole: (pathParameters: FaceOperationContracts["getWorkspaceRole"]["path"], options: FaceOperationOptions<"getWorkspaceRole">) => execute({
      operationId: "getWorkspaceRole",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}",
      pathParameters,
      ...options,
    }),
    getWorkspaceRoles: (pathParameters: FaceOperationContracts["getWorkspaceRoles"]["path"], options: FaceOperationOptions<"getWorkspaceRoles">) => execute({
      operationId: "getWorkspaceRoles",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/roles",
      pathParameters,
      ...options,
    }),
    initializeCommercialGroup: (pathParameters: FaceOperationContracts["initializeCommercialGroup"]["path"], options: FaceOperationOptions<"initializeCommercialGroup">) => execute({
      operationId: "initializeCommercialGroup",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/commercial-group",
      pathParameters,
      ...options,
    }),
    listPlatformGroupWorkspaces: (pathParameters: FaceOperationContracts["listPlatformGroupWorkspaces"]["path"], options: FaceOperationOptions<"listPlatformGroupWorkspaces">) => execute({
      operationId: "listPlatformGroupWorkspaces",
      method: "GET",
      path: "/api/platform/group-workspaces",
      pathParameters,
      ...options,
    }),
    platformLogout: (pathParameters: FaceOperationContracts["platformLogout"]["path"], options: FaceOperationOptions<"platformLogout">) => execute({
      operationId: "platformLogout",
      method: "POST",
      path: "/api/platform/auth/logout",
      pathParameters,
      ...options,
    }),
    platformPasswordLogin: (pathParameters: FaceOperationContracts["platformPasswordLogin"]["path"], options: FaceOperationOptions<"platformPasswordLogin">) => execute({
      operationId: "platformPasswordLogin",
      method: "POST",
      path: "/api/platform/auth/password-login",
      pathParameters,
      ...options,
    }),
    releasePlatformStagedAsset: (pathParameters: FaceOperationContracts["releasePlatformStagedAsset"]["path"], options: FaceOperationOptions<"releasePlatformStagedAsset">) => execute({
      operationId: "releasePlatformStagedAsset",
      method: "POST",
      path: "/api/platform/assets/staging/{assetRef}/release",
      pathParameters,
      ...options,
    }),
    replaceExtensionDefinition: (pathParameters: FaceOperationContracts["replaceExtensionDefinition"]["path"], options: FaceOperationOptions<"replaceExtensionDefinition">) => execute({
      operationId: "replaceExtensionDefinition",
      method: "PUT",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions/{entityType}",
      pathParameters,
      ...options,
    }),
    requestWorkspaceCredentialReset: (pathParameters: FaceOperationContracts["requestWorkspaceCredentialReset"]["path"], options: FaceOperationOptions<"requestWorkspaceCredentialReset">) => execute({
      operationId: "requestWorkspaceCredentialReset",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/credential-reset",
      pathParameters,
      ...options,
    }),
    resetPlatformAdminCredential: (pathParameters: FaceOperationContracts["resetPlatformAdminCredential"]["path"], options: FaceOperationOptions<"resetPlatformAdminCredential">) => execute({
      operationId: "resetPlatformAdminCredential",
      method: "POST",
      path: "/api/platform/admin-users/{platformAdminId}/credential-reset",
      pathParameters,
      ...options,
    }),
    revokePlatformWorkspaceAssignment: (pathParameters: FaceOperationContracts["revokePlatformWorkspaceAssignment"]["path"], options: FaceOperationOptions<"revokePlatformWorkspaceAssignment">) => execute({
      operationId: "revokePlatformWorkspaceAssignment",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/assignments/{assignmentId}/revoke",
      pathParameters,
      ...options,
    }),
    sendPlatformLoginOtp: (pathParameters: FaceOperationContracts["sendPlatformLoginOtp"]["path"], options: FaceOperationOptions<"sendPlatformLoginOtp">) => execute({
      operationId: "sendPlatformLoginOtp",
      method: "POST",
      path: "/api/platform/auth/login-otp/send",
      pathParameters,
      ...options,
    }),
    sendPlatformPasswordRecoveryOtp: (pathParameters: FaceOperationContracts["sendPlatformPasswordRecoveryOtp"]["path"], options: FaceOperationOptions<"sendPlatformPasswordRecoveryOtp">) => execute({
      operationId: "sendPlatformPasswordRecoveryOtp",
      method: "POST",
      path: "/api/platform/auth/password-recovery/otp/send",
      pathParameters,
      ...options,
    }),
    stagePlatformAsset: (pathParameters: FaceOperationContracts["stagePlatformAsset"]["path"], options: FaceOperationOptions<"stagePlatformAsset">) => execute({
      operationId: "stagePlatformAsset",
      method: "POST",
      path: "/api/platform/assets/staging",
      pathParameters,
      ...options,
    }),
    startPlatformPasswordRecovery: (pathParameters: FaceOperationContracts["startPlatformPasswordRecovery"]["path"], options: FaceOperationOptions<"startPlatformPasswordRecovery">) => execute({
      operationId: "startPlatformPasswordRecovery",
      method: "POST",
      path: "/api/platform/auth/password-recovery/start",
      pathParameters,
      ...options,
    }),
    transitionPlatformAdminStatus: (pathParameters: FaceOperationContracts["transitionPlatformAdminStatus"]["path"], options: FaceOperationOptions<"transitionPlatformAdminStatus">) => execute({
      operationId: "transitionPlatformAdminStatus",
      method: "POST",
      path: "/api/platform/admin-users/{platformAdminId}/status",
      pathParameters,
      ...options,
    }),
    transitionPlatformGroupWorkspaceStatus: (pathParameters: FaceOperationContracts["transitionPlatformGroupWorkspaceStatus"]["path"], options: FaceOperationOptions<"transitionPlatformGroupWorkspaceStatus">) => execute({
      operationId: "transitionPlatformGroupWorkspaceStatus",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/status",
      pathParameters,
      ...options,
    }),
    transitionWorkspaceAccountStatus: (pathParameters: FaceOperationContracts["transitionWorkspaceAccountStatus"]["path"], options: FaceOperationOptions<"transitionWorkspaceAccountStatus">) => execute({
      operationId: "transitionWorkspaceAccountStatus",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/status",
      pathParameters,
      ...options,
    }),
    transitionWorkspaceRoleStatus: (pathParameters: FaceOperationContracts["transitionWorkspaceRoleStatus"]["path"], options: FaceOperationOptions<"transitionWorkspaceRoleStatus">) => execute({
      operationId: "transitionWorkspaceRoleStatus",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}/status",
      pathParameters,
      ...options,
    }),
    updatePlatformAdminProfile: (pathParameters: FaceOperationContracts["updatePlatformAdminProfile"]["path"], options: FaceOperationOptions<"updatePlatformAdminProfile">) => execute({
      operationId: "updatePlatformAdminProfile",
      method: "PATCH",
      path: "/api/platform/admin-users/{platformAdminId}/profile",
      pathParameters,
      ...options,
    }),
    updatePlatformGroupWorkspaceDisplay: (pathParameters: FaceOperationContracts["updatePlatformGroupWorkspaceDisplay"]["path"], options: FaceOperationOptions<"updatePlatformGroupWorkspaceDisplay">) => execute({
      operationId: "updatePlatformGroupWorkspaceDisplay",
      method: "PATCH",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}",
      pathParameters,
      ...options,
    }),
    updateWorkspaceRole: (pathParameters: FaceOperationContracts["updateWorkspaceRole"]["path"], options: FaceOperationOptions<"updateWorkspaceRole">) => execute({
      operationId: "updateWorkspaceRole",
      method: "PATCH",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}",
      pathParameters,
      ...options,
    }),
    verifyPlatformLoginOtp: (pathParameters: FaceOperationContracts["verifyPlatformLoginOtp"]["path"], options: FaceOperationOptions<"verifyPlatformLoginOtp">) => execute({
      operationId: "verifyPlatformLoginOtp",
      method: "POST",
      path: "/api/platform/auth/login-otp/verify",
      pathParameters,
      ...options,
    }),
    verifyPlatformPasswordRecoveryOtp: (pathParameters: FaceOperationContracts["verifyPlatformPasswordRecoveryOtp"]["path"], options: FaceOperationOptions<"verifyPlatformPasswordRecoveryOtp">) => execute({
      operationId: "verifyPlatformPasswordRecoveryOtp",
      method: "POST",
      path: "/api/platform/auth/password-recovery/otp/verify",
      pathParameters,
      ...options,
    })
  } as const;
}
