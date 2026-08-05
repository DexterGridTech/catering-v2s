// Generated from contracts/catalog/admin-catalog.json; do not edit.
package com.catering.v2s.workspace.iam.api;

import java.util.List;
import java.util.Optional;

public final class WorkspaceAuthorizationCatalog {
    private WorkspaceAuthorizationCatalog() { }
    public static final class PageDesignKeys {
        private PageDesignKeys() { }
        public static final String HOME_GROUP = "HOME-GROUP";
        public static final String HOME_REGION = "HOME-REGION";
        public static final String HOME_PROJECT = "HOME-PROJECT";
        public static final String HOME_HEAD_COMPANY = "HOME-HEAD-COMPANY";
        public static final String HOME_STORE = "HOME-STORE";
        public static final String PG_ORG_STRUCTURE = "PG-ORG-STRUCTURE";
        public static final String PG_ORG_BRAND = "PG-ORG-BRAND";
        public static final String PG_ORG_TENANT = "PG-ORG-TENANT";
        public static final String PG_ORG_HEAD_COMPANY = "PG-ORG-HEAD-COMPANY";
        public static final String PG_ORG_STORE_MANAGE = "PG-ORG-STORE-MANAGE";
        public static final String PG_CONTRACT_STORE_MANAGE = "PG-CONTRACT-STORE-MANAGE";
        public static final String PG_IAM_GROUP_USERS = "PG-IAM-GROUP-USERS";
        public static final String PG_IAM_REGION_USERS = "PG-IAM-REGION-USERS";
        public static final String PG_IAM_PROJECT_USERS = "PG-IAM-PROJECT-USERS";
        public static final String PG_IAM_HEAD_COMPANY_USERS = "PG-IAM-HEAD-COMPANY-USERS";
        public static final String PG_IAM_STORE_USERS = "PG-IAM-STORE-USERS";
        public static final String PG_STORE_PROFILE = "PG-STORE-PROFILE";
    }
    public static final class CapabilityKeys {
        private CapabilityKeys() { }
        public static final String BC_ORG_GROUP_EDIT = "BC-ORG-GROUP-EDIT";
        public static final String BC_ORG_GROUP_STATUS = "BC-ORG-GROUP-STATUS";
        public static final String BC_ORG_REGION_CREATE = "BC-ORG-REGION-CREATE";
        public static final String BC_ORG_REGION_EDIT = "BC-ORG-REGION-EDIT";
        public static final String BC_ORG_REGION_STATUS = "BC-ORG-REGION-STATUS";
        public static final String BC_ORG_PROJECT_CREATE = "BC-ORG-PROJECT-CREATE";
        public static final String BC_ORG_PROJECT_EDIT = "BC-ORG-PROJECT-EDIT";
        public static final String BC_ORG_PROJECT_STATUS = "BC-ORG-PROJECT-STATUS";
        public static final String BC_ORG_BRAND_CREATE = "BC-ORG-BRAND-CREATE";
        public static final String BC_ORG_BRAND_EDIT = "BC-ORG-BRAND-EDIT";
        public static final String BC_ORG_BRAND_STATUS = "BC-ORG-BRAND-STATUS";
        public static final String BC_ORG_TENANT_CREATE = "BC-ORG-TENANT-CREATE";
        public static final String BC_ORG_TENANT_EDIT = "BC-ORG-TENANT-EDIT";
        public static final String BC_ORG_TENANT_STATUS = "BC-ORG-TENANT-STATUS";
        public static final String BC_ORG_HEAD_COMPANY_CREATE = "BC-ORG-HEAD-COMPANY-CREATE";
        public static final String BC_ORG_HEAD_COMPANY_EDIT = "BC-ORG-HEAD-COMPANY-EDIT";
        public static final String BC_ORG_HEAD_COMPANY_STATUS = "BC-ORG-HEAD-COMPANY-STATUS";
        public static final String BC_ORG_HEAD_COMPANY_BRAND = "BC-ORG-HEAD-COMPANY-BRAND";
        public static final String BC_ORG_STORE_CREATE = "BC-ORG-STORE-CREATE";
        public static final String BC_ORG_STORE_EDIT = "BC-ORG-STORE-EDIT";
        public static final String BC_ORG_STORE_STATUS = "BC-ORG-STORE-STATUS";
        public static final String BC_IAM_GROUP_ROLE_REVOKE = "BC-IAM-GROUP-ROLE-REVOKE";
        public static final String BC_IAM_REGION_ROLE_REVOKE = "BC-IAM-REGION-ROLE-REVOKE";
        public static final String BC_IAM_PROJECT_ROLE_REVOKE = "BC-IAM-PROJECT-ROLE-REVOKE";
        public static final String BC_IAM_HEAD_COMPANY_ROLE_REVOKE = "BC-IAM-HEAD-COMPANY-ROLE-REVOKE";
        public static final String BC_IAM_STORE_ROLE_REVOKE = "BC-IAM-STORE-ROLE-REVOKE";
        public static final String BC_IAM_GROUP_INVITE = "BC-IAM-GROUP-INVITE";
        public static final String BC_IAM_REGION_INVITE = "BC-IAM-REGION-INVITE";
        public static final String BC_IAM_PROJECT_INVITE = "BC-IAM-PROJECT-INVITE";
        public static final String BC_IAM_HEAD_COMPANY_INVITE = "BC-IAM-HEAD-COMPANY-INVITE";
        public static final String BC_IAM_STORE_INVITE = "BC-IAM-STORE-INVITE";
        public static final String BC_CONTRACT_CREATE = "BC-CONTRACT-CREATE";
        public static final String BC_CONTRACT_EDIT = "BC-CONTRACT-EDIT";
        public static final String BC_CONTRACT_INVALIDATE = "BC-CONTRACT-INVALIDATE";
    }
    public static List<CapabilityCatalogEntry> capabilityCatalog() { return List.of(
            capability("BC-ORG-GROUP-EDIT", "编辑集团资料", "ORGANIZATION_MANAGEMENT", "组织管理", 100, List.of("GROUP"), "PG-ORG-STRUCTURE", "GROUP_VISIBLE"),
            capability("BC-ORG-GROUP-STATUS", "启停集团", "ORGANIZATION_MANAGEMENT", "组织管理", 100, List.of("GROUP"), "PG-ORG-STRUCTURE", "GROUP_VISIBLE"),
            capability("BC-ORG-REGION-CREATE", "新建大区", "ORGANIZATION_MANAGEMENT", "组织管理", 100, List.of("GROUP"), "PG-ORG-STRUCTURE", "GROUP_VISIBLE"),
            capability("BC-ORG-REGION-EDIT", "编辑大区", "ORGANIZATION_MANAGEMENT", "组织管理", 100, List.of("GROUP", "REGION"), "PG-ORG-STRUCTURE", "VISIBLE_REGION"),
            capability("BC-ORG-REGION-STATUS", "启停大区", "ORGANIZATION_MANAGEMENT", "组织管理", 100, List.of("GROUP", "REGION"), "PG-ORG-STRUCTURE", "VISIBLE_REGION"),
            capability("BC-ORG-PROJECT-CREATE", "新建项目", "ORGANIZATION_MANAGEMENT", "组织管理", 100, List.of("GROUP", "REGION"), "PG-ORG-STRUCTURE", "VISIBLE_REGION"),
            capability("BC-ORG-PROJECT-EDIT", "编辑项目", "ORGANIZATION_MANAGEMENT", "组织管理", 100, List.of("GROUP", "REGION", "PROJECT"), "PG-ORG-STRUCTURE", "VISIBLE_PROJECT"),
            capability("BC-ORG-PROJECT-STATUS", "启停项目", "ORGANIZATION_MANAGEMENT", "组织管理", 100, List.of("GROUP", "REGION", "PROJECT"), "PG-ORG-STRUCTURE", "VISIBLE_PROJECT"),
            capability("BC-ORG-BRAND-CREATE", "新建品牌", "ORGANIZATION_MANAGEMENT", "组织管理", 100, List.of("GROUP"), "PG-ORG-BRAND", "NONE"),
            capability("BC-ORG-BRAND-EDIT", "编辑品牌", "ORGANIZATION_MANAGEMENT", "组织管理", 100, List.of("GROUP"), "PG-ORG-BRAND", "NONE"),
            capability("BC-ORG-BRAND-STATUS", "启停品牌", "ORGANIZATION_MANAGEMENT", "组织管理", 100, List.of("GROUP"), "PG-ORG-BRAND", "NONE"),
            capability("BC-ORG-TENANT-CREATE", "新建经营租户", "ORGANIZATION_MANAGEMENT", "组织管理", 100, List.of("GROUP"), "PG-ORG-TENANT", "NONE"),
            capability("BC-ORG-TENANT-EDIT", "编辑经营租户", "ORGANIZATION_MANAGEMENT", "组织管理", 100, List.of("GROUP"), "PG-ORG-TENANT", "NONE"),
            capability("BC-ORG-TENANT-STATUS", "启停经营租户", "ORGANIZATION_MANAGEMENT", "组织管理", 100, List.of("GROUP"), "PG-ORG-TENANT", "NONE"),
            capability("BC-ORG-HEAD-COMPANY-CREATE", "新建总公司", "ORGANIZATION_MANAGEMENT", "组织管理", 100, List.of("GROUP", "HEAD_COMPANY"), "PG-ORG-HEAD-COMPANY", "NONE"),
            capability("BC-ORG-HEAD-COMPANY-EDIT", "编辑总公司", "ORGANIZATION_MANAGEMENT", "组织管理", 100, List.of("GROUP", "HEAD_COMPANY"), "PG-ORG-HEAD-COMPANY", "NONE"),
            capability("BC-ORG-HEAD-COMPANY-STATUS", "启停总公司", "ORGANIZATION_MANAGEMENT", "组织管理", 100, List.of("GROUP", "HEAD_COMPANY"), "PG-ORG-HEAD-COMPANY", "NONE"),
            capability("BC-ORG-HEAD-COMPANY-BRAND", "维护总公司品牌授权", "ORGANIZATION_MANAGEMENT", "组织管理", 100, List.of("GROUP", "HEAD_COMPANY"), "PG-ORG-HEAD-COMPANY", "NONE"),
            capability("BC-ORG-STORE-CREATE", "新建门店", "STORE_MANAGEMENT", "门店管理", 200, List.of("GROUP", "REGION", "PROJECT"), "PG-ORG-STORE-MANAGE", "SELECTED_PROJECT_SCOPE"),
            capability("BC-ORG-STORE-EDIT", "编辑门店", "STORE_MANAGEMENT", "门店管理", 200, List.of("GROUP", "REGION", "PROJECT"), "PG-ORG-STORE-MANAGE", "SELECTED_PROJECT_SCOPE"),
            capability("BC-ORG-STORE-STATUS", "启停门店", "STORE_MANAGEMENT", "门店管理", 200, List.of("GROUP", "REGION", "PROJECT"), "PG-ORG-STORE-MANAGE", "SELECTED_PROJECT_SCOPE"),
            capability("BC-IAM-GROUP-ROLE-REVOKE", "撤销集团用户运营角色", "USER_MANAGEMENT", "用户管理", 300, List.of("GROUP"), "PG-IAM-GROUP-USERS", "NONE"),
            capability("BC-IAM-REGION-ROLE-REVOKE", "撤销大区用户运营角色", "USER_MANAGEMENT", "用户管理", 300, List.of("GROUP", "REGION"), "PG-IAM-REGION-USERS", "SELECTED_REGION_SCOPE"),
            capability("BC-IAM-PROJECT-ROLE-REVOKE", "撤销项目用户运营角色", "USER_MANAGEMENT", "用户管理", 300, List.of("GROUP", "REGION", "PROJECT"), "PG-IAM-PROJECT-USERS", "SELECTED_PROJECT_SCOPE"),
            capability("BC-IAM-HEAD-COMPANY-ROLE-REVOKE", "撤销总公司用户运营角色", "USER_MANAGEMENT", "用户管理", 300, List.of("GROUP", "HEAD_COMPANY"), "PG-IAM-HEAD-COMPANY-USERS", "HEAD_COMPANY_TARGET"),
            capability("BC-IAM-STORE-ROLE-REVOKE", "撤销门店用户运营角色", "USER_MANAGEMENT", "用户管理", 300, List.of("GROUP", "REGION", "PROJECT", "STORE"), "PG-IAM-STORE-USERS", "SELECTED_STORE_SCOPE"),
            capability("BC-IAM-GROUP-INVITE", "管理集团用户邀请", "USER_MANAGEMENT", "用户管理", 300, List.of("GROUP"), "PG-IAM-GROUP-USERS", "NONE"),
            capability("BC-IAM-REGION-INVITE", "管理大区用户邀请", "USER_MANAGEMENT", "用户管理", 300, List.of("GROUP", "REGION"), "PG-IAM-REGION-USERS", "SELECTED_REGION_SCOPE"),
            capability("BC-IAM-PROJECT-INVITE", "管理项目用户邀请", "USER_MANAGEMENT", "用户管理", 300, List.of("GROUP", "REGION", "PROJECT"), "PG-IAM-PROJECT-USERS", "SELECTED_PROJECT_SCOPE"),
            capability("BC-IAM-HEAD-COMPANY-INVITE", "管理总公司用户邀请", "USER_MANAGEMENT", "用户管理", 300, List.of("GROUP", "HEAD_COMPANY"), "PG-IAM-HEAD-COMPANY-USERS", "HEAD_COMPANY_TARGET"),
            capability("BC-IAM-STORE-INVITE", "管理门店用户邀请", "USER_MANAGEMENT", "用户管理", 300, List.of("GROUP", "REGION", "PROJECT", "STORE"), "PG-IAM-STORE-USERS", "SELECTED_STORE_SCOPE"),
            capability("BC-CONTRACT-CREATE", "新建门店合同", "STORE_CONTRACT_MANAGEMENT", "门店合同管理", 400, List.of("GROUP", "REGION", "PROJECT"), "PG-CONTRACT-STORE-MANAGE", "SELECTED_PROJECT_SCOPE"),
            capability("BC-CONTRACT-EDIT", "编辑门店合同", "STORE_CONTRACT_MANAGEMENT", "门店合同管理", 400, List.of("GROUP", "REGION", "PROJECT"), "PG-CONTRACT-STORE-MANAGE", "SELECTED_PROJECT_SCOPE"),
            capability("BC-CONTRACT-INVALIDATE", "设置门店合同失效", "STORE_CONTRACT_MANAGEMENT", "门店合同管理", 400, List.of("GROUP", "REGION", "PROJECT"), "PG-CONTRACT-STORE-MANAGE", "SELECTED_PROJECT_SCOPE")); }
    public static List<PageAccessCatalogEntry> pageCatalog() { return List.of(
            page("HOME-GROUP", "集团首页", "工作台", 10, "NONE", List.of("GROUP"), null, false),
            page("HOME-REGION", "大区首页", "工作台", 20, "NONE", List.of("REGION"), null, false),
            page("HOME-PROJECT", "项目首页", "工作台", 30, "NONE", List.of("PROJECT"), null, false),
            page("HOME-HEAD-COMPANY", "总公司首页", "工作台", 40, "NONE", List.of("HEAD_COMPANY"), null, false),
            page("HOME-STORE", "门店首页", "工作台", 50, "NONE", List.of("STORE"), null, false),
            page("PG-ORG-STRUCTURE", "组织架构", "组织管理", 100, "NONE", List.of("GROUP", "REGION", "PROJECT"), null, true),
            page("PG-ORG-BRAND", "品牌管理", "组织管理", 110, "NONE", List.of("GROUP", "HEAD_COMPANY"), null, true),
            page("PG-ORG-TENANT", "经营租户管理", "组织管理", 120, "NONE", List.of("GROUP", "HEAD_COMPANY"), null, true),
            page("PG-ORG-HEAD-COMPANY", "总公司管理", "组织管理", 130, "NONE", List.of("GROUP", "HEAD_COMPANY"), null, true),
            page("PG-ORG-STORE-MANAGE", "门店管理", "组织管理", 140, "PROJECT", List.of("GROUP", "REGION", "PROJECT"), null, true),
            page("PG-CONTRACT-STORE-MANAGE", "门店合同管理", "组织管理", 150, "PROJECT", List.of("GROUP", "REGION", "PROJECT"), null, true),
            page("PG-IAM-GROUP-USERS", "集团用户管理", "用户与权限", 200, "NONE", List.of("GROUP"), "GROUP", true),
            page("PG-IAM-REGION-USERS", "大区用户管理", "用户与权限", 210, "REGION", List.of("GROUP", "REGION"), "REGION", true),
            page("PG-IAM-PROJECT-USERS", "项目用户管理", "用户与权限", 220, "PROJECT", List.of("GROUP", "REGION", "PROJECT"), "PROJECT", true),
            page("PG-IAM-HEAD-COMPANY-USERS", "总公司用户管理", "用户与权限", 230, "HEAD_COMPANY", List.of("GROUP", "HEAD_COMPANY"), "HEAD_COMPANY", true),
            page("PG-IAM-STORE-USERS", "门店用户管理", "用户与权限", 240, "STORE", List.of("GROUP", "REGION", "PROJECT", "STORE"), "STORE", true),
            page("PG-STORE-PROFILE", "门店资料", "门店经营", 300, "STORE", List.of("STORE"), null, true)); }
    public static List<UserManagementActionBinding> userManagementActionBindings() { return List.of(
            new UserManagementActionBinding("PG-IAM-GROUP-USERS", "GROUP", UserManagementAction.ROLE_REVOKE, "BC-IAM-GROUP-ROLE-REVOKE"),
            new UserManagementActionBinding("PG-IAM-REGION-USERS", "REGION", UserManagementAction.ROLE_REVOKE, "BC-IAM-REGION-ROLE-REVOKE"),
            new UserManagementActionBinding("PG-IAM-PROJECT-USERS", "PROJECT", UserManagementAction.ROLE_REVOKE, "BC-IAM-PROJECT-ROLE-REVOKE"),
            new UserManagementActionBinding("PG-IAM-HEAD-COMPANY-USERS", "HEAD_COMPANY", UserManagementAction.ROLE_REVOKE, "BC-IAM-HEAD-COMPANY-ROLE-REVOKE"),
            new UserManagementActionBinding("PG-IAM-STORE-USERS", "STORE", UserManagementAction.ROLE_REVOKE, "BC-IAM-STORE-ROLE-REVOKE"),
            new UserManagementActionBinding("PG-IAM-GROUP-USERS", "GROUP", UserManagementAction.INVITE, "BC-IAM-GROUP-INVITE"),
            new UserManagementActionBinding("PG-IAM-REGION-USERS", "REGION", UserManagementAction.INVITE, "BC-IAM-REGION-INVITE"),
            new UserManagementActionBinding("PG-IAM-PROJECT-USERS", "PROJECT", UserManagementAction.INVITE, "BC-IAM-PROJECT-INVITE"),
            new UserManagementActionBinding("PG-IAM-HEAD-COMPANY-USERS", "HEAD_COMPANY", UserManagementAction.INVITE, "BC-IAM-HEAD-COMPANY-INVITE"),
            new UserManagementActionBinding("PG-IAM-STORE-USERS", "STORE", UserManagementAction.INVITE, "BC-IAM-STORE-INVITE")); }
    public static List<RoleHomeEntry> roleHomeCatalog() { return List.of(
            new RoleHomeEntry("GROUP", "HOME-GROUP"),
            new RoleHomeEntry("REGION", "HOME-REGION"),
            new RoleHomeEntry("PROJECT", "HOME-PROJECT"),
            new RoleHomeEntry("HEAD_COMPANY", "HOME-HEAD-COMPANY"),
            new RoleHomeEntry("STORE", "HOME-STORE")); }
    public static List<PageAccessCatalogEntry> managedPageCatalog() { return pageCatalog().stream().filter(PageAccessCatalogEntry::pageAccessManaged).toList(); }
    public static Optional<PageAccessCatalogEntry> page(String pageDesignKey) { return pageCatalog().stream().filter(page -> page.pageDesignKey().equals(pageDesignKey)).findFirst(); }
    public static Optional<String> homePageForRoleNodeType(String roleNodeType) { return roleHomeCatalog().stream().filter(entry -> entry.roleNodeType().equals(roleNodeType)).reduce((first, duplicate) -> { throw new IllegalStateException("ROLE_HOME_CATALOG_DUPLICATE:" + roleNodeType); }).map(RoleHomeEntry::pageDesignKey); }
    public static Optional<String> userManagementTargetOrganizationType(String pageDesignKey) { return page(pageDesignKey).map(PageAccessCatalogEntry::userManagementTargetOrganizationType).filter(value -> value != null); }
    public static Optional<String> userManagementPageForTargetType(String targetOrganizationType) { return pageCatalog().stream().filter(page -> targetOrganizationType.equals(page.userManagementTargetOrganizationType())).map(PageAccessCatalogEntry::pageDesignKey).findFirst(); }
    public static Optional<String> requiredUserManagementCapability(String pageDesignKey, UserManagementAction action) { return userManagementActionBindings().stream().filter(binding -> binding.pageDesignKey().equals(pageDesignKey) && binding.action() == action).map(UserManagementActionBinding::capabilityKey).findFirst(); }
    public static Optional<String> requiredUserManagementCapabilityForTarget(String targetOrganizationType, UserManagementAction action) { return userManagementActionBindings().stream().filter(binding -> binding.targetOrganizationType().equals(targetOrganizationType) && binding.action() == action).map(UserManagementActionBinding::capabilityKey).findFirst(); }
    private static CapabilityCatalogEntry capability(String key, String label, String groupKey, String groupLabel, int order, List<String> types, String pageDesignKey, String scopeApplicability) { return new CapabilityCatalogEntry(key, groupKey, groupLabel, order, label, label, types, pageDesignKey, scopeApplicability); }
    private static PageAccessCatalogEntry page(String key, String title, String group, int order, String dataNodeType, List<String> types, String targetType, boolean managed) { return new PageAccessCatalogEntry(key, title, group, order, dataNodeType, types, targetType, managed); }
    public enum UserManagementAction { INVITE, ROLE_REVOKE }
    public record UserManagementActionBinding(String pageDesignKey, String targetOrganizationType, UserManagementAction action, String capabilityKey) { }
    public record RoleHomeEntry(String roleNodeType, String pageDesignKey) { }
    public record CapabilityCatalogEntry(String key, String actionGroupKey, String actionGroupLabel, int actionGroupOrder, String label, String description, List<String> organizationTypes, String pageDesignKey, String scopeApplicability) { }
    public record PageAccessCatalogEntry(String pageDesignKey, String title, String menuGroup, int menuOrder, String requiredDataNodeType, List<String> eligibleOrganizationTypes, String userManagementTargetOrganizationType, boolean pageAccessManaged) { }
}
