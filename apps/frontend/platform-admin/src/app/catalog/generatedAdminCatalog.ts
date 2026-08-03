// Generated from contracts/catalog/admin-catalog.json; do not edit.
export const adminCatalog = {
  "platformPages": [
    {
      "pageDesignKey": "PLATFORM-WORKSPACES",
      "title": "集团空间管理",
      "iconKey": "WORKSPACE",
      "menuOrder": 10,
      "workspaceRequirement": "GLOBAL_OR_OPTIONAL"
    },
    {
      "pageDesignKey": "PLATFORM-ADMIN-USERS",
      "title": "运维管理员管理",
      "iconKey": "ADMIN_USER",
      "menuOrder": 20,
      "workspaceRequirement": "GLOBAL_OR_OPTIONAL"
    },
    {
      "pageDesignKey": "PLATFORM-WORKSPACE-OVERVIEW",
      "title": "集团空间概览",
      "iconKey": "OVERVIEW",
      "menuOrder": 30,
      "workspaceRequirement": "REQUIRED"
    },
    {
      "pageDesignKey": "PLATFORM-ORGANIZATION-OVERVIEW",
      "title": "组织概览",
      "iconKey": "ORGANIZATION",
      "menuOrder": 40,
      "workspaceRequirement": "REQUIRED"
    },
    {
      "pageDesignKey": "PLATFORM-CONTRACT-OVERVIEW",
      "title": "合同概览",
      "iconKey": "CONTRACT",
      "menuOrder": 50,
      "workspaceRequirement": "REQUIRED"
    },
    {
      "pageDesignKey": "PLATFORM-ROLES",
      "title": "业务角色管理",
      "iconKey": "ROLE",
      "menuOrder": 60,
      "workspaceRequirement": "REQUIRED"
    },
    {
      "pageDesignKey": "PLATFORM-WORKSPACE-ACCOUNTS",
      "title": "空间账号",
      "iconKey": "ACCOUNT",
      "menuOrder": 70,
      "workspaceRequirement": "REQUIRED"
    },
    {
      "pageDesignKey": "PLATFORM-EXTENSION-FIELDS",
      "title": "扩展字段",
      "iconKey": "EXTENSION",
      "menuOrder": 80,
      "workspaceRequirement": "REQUIRED"
    }
  ],
  "platformShellCopy": {
    "PLATFORM-SHELL-BRAND": "运维管理后台",
    "PLATFORM-SHELL-WORKSPACE-DETAIL-GROUP": "集团空间详细信息",
    "PLATFORM-SHELL-CHANGE-PASSWORD": "修改密码",
    "PLATFORM-SHELL-LOGOUT": "退出登录"
  }
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
export const platformShellCopyKeys = {
  "PlatformShellBrand": "PLATFORM-SHELL-BRAND",
  "PlatformShellWorkspaceDetailGroup": "PLATFORM-SHELL-WORKSPACE-DETAIL-GROUP",
  "PlatformShellChangePassword": "PLATFORM-SHELL-CHANGE-PASSWORD",
  "PlatformShellLogout": "PLATFORM-SHELL-LOGOUT"
} as const;
export type AdminCatalog = typeof adminCatalog;
export type PlatformPageDesignKey = typeof platformPageDesignKeys[keyof typeof platformPageDesignKeys];
