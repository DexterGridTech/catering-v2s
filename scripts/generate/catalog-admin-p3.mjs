#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = JSON.parse(fs.readFileSync(path.join(root, "contracts/catalog/admin-catalog.json"), "utf8"));
const groups = new Map(source.nodes.filter((node) => node.kind === "NAVIGATION_GROUP").map((node) => [node.key, node]));
const actions = source.nodes.filter((node) => node.kind === "ACTION");
const pages = source.nodes.filter((node) => node.kind === "PAGE");
const operationsPages = pages.filter((node) => node.consumerFace === "operations-admin").map((node) => {
  const group = groups.get(node.navigation.groupKey);
  return {
    pageDesignKey: node.key,
    kind: node.page.kind,
    pageAccessManaged: node.page.kind === "BUSINESS",
    menuOrder: node.navigation.order,
    menuGroupKey: node.navigation.groupKey,
    menuGroupIconKey: group.navigation.iconKey,
    menuGroupLabel: group.display.label,
    menuLabel: node.display.label,
    pageTitle: node.display.label,
    contentTabLabel: node.display.label,
    pageDescription: node.experience?.pageDescription ?? "",
    dataNodeCascaderLabel: node.experience?.dataNodeCascaderLabel ?? null,
    noDataNodePrompt: node.experience?.noDataNodePrompt ?? null,
    noCandidatePrompt: node.experience?.noCandidatePrompt ?? null,
    cascadeLevelLabels: node.experience?.cascadeLevelLabels ?? [],
    forbiddenAlternatives: node.experience?.forbiddenAlternatives ?? [],
    requiredDataNodeType: node.page.kind === "ROLE_HOME" ? "NONE" : node.pageAccess.requiredDataNodeType,
    supportedRoleNodeTypes: node.page.kind === "ROLE_HOME" ? [node.page.roleHomeForNodeType] : node.pageAccess.grantableRoleNodeTypes,
    userManagementTargetOrganizationType: node.pageAccess?.userManagementTargetOrganizationType ?? null,
  };
});
const catalogActions = actions.map((node) => {
  const group = source.nodes.find((candidate) => candidate.key === node.action.groupKey);
  return {
    actionKey: node.key,
    actionLabel: node.display.label,
    actionDescription: node.display.label,
    actionGroupKey: node.action.groupKey,
    actionGroupLabel: group.display.label,
    actionGroupOrder: group.actionGroup.order,
    pageBindings: [{pageDesignKey: node.action.targetPageKey, selectedIdentityTypes: node.action.grantableRoleNodeTypes, scopeApplicability: node.action.scopeApplicability}],
    grantableRoleNodeTypes: node.action.grantableRoleNodeTypes,
    userManagement: node.action.userManagement,
  };
});
const userManagementActionBindings = catalogActions.filter((action) => action.userManagement).map((action) => ({pageDesignKey: action.pageBindings[0].pageDesignKey, targetOrganizationType: action.userManagement.targetOrganizationType, actionPurpose: action.userManagement.purpose, actionKey: action.actionKey}));
const managedTargetPages = operationsPages.filter((page) => page.userManagementTargetOrganizationType);
const userManagementByPage = Object.fromEntries(managedTargetPages.map((page) => [page.pageDesignKey, {
  targetOrganizationType: page.userManagementTargetOrganizationType,
  inviteActionKey: userManagementActionBindings.find((binding) => binding.pageDesignKey === page.pageDesignKey && binding.actionPurpose === "INVITE")?.actionKey,
  roleRevokeActionKey: userManagementActionBindings.find((binding) => binding.pageDesignKey === page.pageDesignKey && binding.actionPurpose === "ROLE_REVOKE")?.actionKey,
}]));
const roleHomes = operationsPages.filter((page) => page.kind === "ROLE_HOME").map((page) => ({roleNodeType: page.supportedRoleNodeTypes[0], pageDesignKey: page.pageDesignKey}));
const actionGroups = source.nodes.filter((node) => node.kind === "ACTION_GROUP").map((node) => ({actionGroupKey: node.key, actionGroupLabel: node.display.label, actionGroupOrder: node.actionGroup.order}));
const symbolName = (value) => value.toLowerCase().split(/[^a-z0-9]+/).map((part) => part[0].toUpperCase() + part.slice(1)).join("");
const actionCapabilities = Object.fromEntries(catalogActions.map((action) => [action.actionKey.replace(/^BC-/, "").replaceAll("-", "_"), action.actionKey]));
const pageKeys = Object.fromEntries(operationsPages.map((page) => [symbolName(page.pageDesignKey), page.pageDesignKey]));
const ts = `// Generated from contracts/catalog/admin-catalog.json; do not edit.\nexport const adminCatalog = ${JSON.stringify({operationsPages, actionGroups, actions: catalogActions, userManagementActionBindings, userManagementByPage}, null, 2)} as const;\nexport const operationsPageDesignKeys = ${JSON.stringify(pageKeys, null, 2)} as const;\nexport type AdminCatalog = typeof adminCatalog;\nexport type OperationsPageDesignKey = typeof operationsPageDesignKeys[keyof typeof operationsPageDesignKeys];\nexport const ACTION_CAPABILITIES = ${JSON.stringify(actionCapabilities, null, 2)} as const;\nexport type AdminActionCapabilityKey = typeof ACTION_CAPABILITIES[keyof typeof ACTION_CAPABILITIES];\nexport const USER_MANAGEMENT_PAGE_DESIGN_KEYS = ${JSON.stringify(managedTargetPages.map((page) => page.pageDesignKey), null, 2)} as const;\nexport type UserManagementPageDesignKey = typeof USER_MANAGEMENT_PAGE_DESIGN_KEYS[number];\nexport function userManagementFor(pageDesignKey: UserManagementPageDesignKey) {\n  const value = adminCatalog.userManagementByPage[pageDesignKey];\n  if (!value) throw new Error(\`USER_MANAGEMENT_TARGET_MISSING:\${pageDesignKey}\`);\n  return value;\n}\n`;
const javaString = (value) => JSON.stringify(value);
const javaList = (values) => values.length ? `List.of(${values.map(javaString).join(", ")})` : "List.of()";
const javaConstants = operationsPages.map((page) => `        public static final String ${page.pageDesignKey.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()} = ${javaString(page.pageDesignKey)};`).join("\n");
const javaCapabilityConstants = catalogActions.map((action) => `        public static final String ${action.actionKey.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()} = ${javaString(action.actionKey)};`).join("\n");
const javaCapabilities = catalogActions.map((action) => `            capability(${javaString(action.actionKey)}, ${javaString(action.actionLabel)}, ${javaString(action.actionGroupKey)}, ${javaString(action.actionGroupLabel)}, ${action.actionGroupOrder}, ${javaList(action.grantableRoleNodeTypes)}, ${javaString(action.pageBindings[0].pageDesignKey)}, ${javaString(action.pageBindings[0].scopeApplicability)})`).join(",\n");
const javaPages = operationsPages.map((page) => `            page(${javaString(page.pageDesignKey)}, ${javaString(page.pageTitle)}, ${javaString(page.menuGroupLabel)}, ${page.menuOrder}, ${javaString(page.requiredDataNodeType)}, ${javaList(page.supportedRoleNodeTypes)}, ${page.userManagementTargetOrganizationType ? javaString(page.userManagementTargetOrganizationType) : "null"}, ${page.pageAccessManaged})`).join(",\n");
const javaBindings = userManagementActionBindings.map((binding) => `            new UserManagementActionBinding(${javaString(binding.pageDesignKey)}, ${javaString(binding.targetOrganizationType)}, UserManagementAction.${binding.actionPurpose}, ${javaString(binding.actionKey)})`).join(",\n");
const javaHomes = roleHomes.map((entry) => `            new RoleHomeEntry(${javaString(entry.roleNodeType)}, ${javaString(entry.pageDesignKey)})`).join(",\n");
const java = `// Generated from contracts/catalog/admin-catalog.json; do not edit.\npackage com.catering.v2s.workspace.iam.api;\n\nimport java.util.List;\nimport java.util.Optional;\n\npublic final class WorkspaceAuthorizationCatalog {\n    private WorkspaceAuthorizationCatalog() { }\n    public static final class PageDesignKeys { private PageDesignKeys() { }\n${javaConstants}\n    }\n    public static final class CapabilityKeys { private CapabilityKeys() { }\n${javaCapabilityConstants}\n    }\n    public static List<CapabilityCatalogEntry> capabilityCatalog() { return List.of(\n${javaCapabilities}); }\n    public static List<PageAccessCatalogEntry> pageCatalog() { return List.of(\n${javaPages}); }\n    public static List<UserManagementActionBinding> userManagementActionBindings() { return List.of(\n${javaBindings}); }\n    public static List<RoleHomeEntry> roleHomeCatalog() { return List.of(\n${javaHomes}); }\n    public static List<PageAccessCatalogEntry> managedPageCatalog() { return pageCatalog().stream().filter(PageAccessCatalogEntry::pageAccessManaged).toList(); }\n    public static Optional<PageAccessCatalogEntry> page(String pageDesignKey) { return pageCatalog().stream().filter(page -> page.pageDesignKey().equals(pageDesignKey)).findFirst(); }\n    public static Optional<String> homePageForRoleNodeType(String roleNodeType) { return roleHomeCatalog().stream().filter(entry -> entry.roleNodeType().equals(roleNodeType)).reduce((first, duplicate) -> { throw new IllegalStateException(\"ROLE_HOME_CATALOG_DUPLICATE:\" + roleNodeType); }).map(RoleHomeEntry::pageDesignKey); }\n    public static Optional<String> userManagementTargetOrganizationType(String pageDesignKey) { return page(pageDesignKey).map(PageAccessCatalogEntry::userManagementTargetOrganizationType).filter(value -> value != null); }\n    public static Optional<String> userManagementPageForTargetType(String targetOrganizationType) { return pageCatalog().stream().filter(page -> targetOrganizationType.equals(page.userManagementTargetOrganizationType())).map(PageAccessCatalogEntry::pageDesignKey).findFirst(); }\n    public static Optional<String> requiredUserManagementCapability(String pageDesignKey, UserManagementAction action) { return userManagementActionBindings().stream().filter(binding -> binding.pageDesignKey().equals(pageDesignKey) && binding.action() == action).map(UserManagementActionBinding::capabilityKey).findFirst(); }\n    public static Optional<String> requiredUserManagementCapabilityForTarget(String targetOrganizationType, UserManagementAction action) { return userManagementActionBindings().stream().filter(binding -> binding.targetOrganizationType().equals(targetOrganizationType) && binding.action() == action).map(UserManagementActionBinding::capabilityKey).findFirst(); }\n    private static CapabilityCatalogEntry capability(String key, String label, String groupKey, String groupLabel, int order, List<String> types, String pageDesignKey, String scopeApplicability) { return new CapabilityCatalogEntry(key, groupKey, groupLabel, order, label, label, types, pageDesignKey, scopeApplicability); }\n    private static PageAccessCatalogEntry page(String key, String title, String group, int order, String dataNodeType, List<String> types, String targetType, boolean managed) { return new PageAccessCatalogEntry(key, title, group, order, dataNodeType, types, targetType, managed); }\n    public enum UserManagementAction { INVITE, ROLE_REVOKE }\n    public record UserManagementActionBinding(String pageDesignKey, String targetOrganizationType, UserManagementAction action, String capabilityKey) { }\n    public record RoleHomeEntry(String roleNodeType, String pageDesignKey) { }\n    public record CapabilityCatalogEntry(String key, String actionGroupKey, String actionGroupLabel, int actionGroupOrder, String label, String description, List<String> organizationTypes, String pageDesignKey, String scopeApplicability) { }\n    public record PageAccessCatalogEntry(String pageDesignKey, String title, String menuGroup, int menuOrder, String requiredDataNodeType, List<String> eligibleOrganizationTypes, String userManagementTargetOrganizationType, boolean pageAccessManaged) { }\n}\n`;
fs.writeFileSync(path.join(root, "apps/frontend/operations-admin/src/app/catalog/generatedAdminCatalog.ts"), ts);
fs.writeFileSync(path.join(root, "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/api/WorkspaceAuthorizationCatalog.java"), java);
console.log(`CATALOG_ADMIN_P3_GENERATED pages=${operationsPages.length} actions=${catalogActions.length}`);
