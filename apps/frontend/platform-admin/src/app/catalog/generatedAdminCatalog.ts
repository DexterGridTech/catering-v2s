// Generated from contracts/catalog/admin-catalog.json; do not edit.
export const adminCatalog = {
  "platformPages": [
    {
      "pageDesignKey": "PLATFORM-WORKSPACES",
      "title": "集团空间管理",
      "iconKey": "WORKSPACE",
      "workspaceRequirement": "GLOBAL_OR_OPTIONAL"
    },
    {
      "pageDesignKey": "PLATFORM-ADMIN-USERS",
      "title": "运维管理员管理",
      "iconKey": "ADMIN_USER",
      "workspaceRequirement": "GLOBAL_OR_OPTIONAL"
    },
    {
      "pageDesignKey": "PLATFORM-WORKSPACE-OVERVIEW",
      "title": "集团空间概览",
      "iconKey": "OVERVIEW",
      "workspaceRequirement": "REQUIRED"
    },
    {
      "pageDesignKey": "PLATFORM-ORGANIZATION-OVERVIEW",
      "title": "组织概览",
      "iconKey": "ORGANIZATION",
      "workspaceRequirement": "REQUIRED"
    },
    {
      "pageDesignKey": "PLATFORM-CONTRACT-OVERVIEW",
      "title": "合同概览",
      "iconKey": "CONTRACT",
      "workspaceRequirement": "REQUIRED"
    },
    {
      "pageDesignKey": "PLATFORM-ROLES",
      "title": "业务角色管理",
      "iconKey": "ROLE",
      "workspaceRequirement": "REQUIRED"
    },
    {
      "pageDesignKey": "PLATFORM-WORKSPACE-ACCOUNTS",
      "title": "空间账号",
      "iconKey": "ACCOUNT",
      "workspaceRequirement": "REQUIRED"
    },
    {
      "pageDesignKey": "PLATFORM-EXTENSION-FIELDS",
      "title": "扩展字段",
      "iconKey": "EXTENSION",
      "workspaceRequirement": "REQUIRED"
    }
  ]
} as const;
export const platformPageDesignKeys = {
  "PlatformWorkspaces": "PLATFORM-WORKSPACES",
  "PlatformAdminUsers": "PLATFORM-ADMIN-USERS",
  "PlatformWorkspaceOverview": "PLATFORM-WORKSPACE-OVERVIEW",
  "PlatformOrganizationOverview": "PLATFORM-ORGANIZATION-OVERVIEW",
  "PlatformContractOverview": "PLATFORM-CONTRACT-OVERVIEW",
  "PlatformRoles": "PLATFORM-ROLES",
  "PlatformWorkspaceAccounts": "PLATFORM-WORKSPACE-ACCOUNTS",
  "PlatformExtensionFields": "PLATFORM-EXTENSION-FIELDS"
} as const;
export type AdminCatalog = typeof adminCatalog;
export type PlatformPageDesignKey = typeof platformPageDesignKeys[keyof typeof platformPageDesignKeys];
