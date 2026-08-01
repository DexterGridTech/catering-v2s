import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("operations-admin owns R5 keyed login and never persists session tokens in browser storage", () => {
  const app = fs.readFileSync(new URL("../../app/OperationsApp.tsx", import.meta.url), "utf8");
  const login = fs.readFileSync(new URL("../../features/authentication/ui/OperationsLoginPage.tsx", import.meta.url), "utf8");
  const generatedCatalog = fs.readFileSync(new URL("../../app/api/generated/operations-edge.ts", import.meta.url), "utf8");
  assert.match(login, /operationsClient\.operationsWorkspacePasswordLogin/);
  assert.match(generatedCatalog, /"operationId": "operationsWorkspacePasswordLogin"[\s\S]*"path": "\/api\/operations\/group-workspaces\/\{groupWorkspaceKey\}\/password-login"/);
  assert.doesNotMatch(login, /['"`]\s*\/api\//);
  assert.match(login, /groupWorkspaceKey/);
  assert.match(app, /当前角色/);
  assert.match(app, /DataScopeSelector/);
  assert.doesNotMatch(app + login, /sessionStorage|localStorage/);
});

test("operations session selection is generated-wire driven and never derives an unscoped data-node list in the browser", () => {
  const app = fs.readFileSync(new URL("../../app/OperationsApp.tsx", import.meta.url), "utf8");
  const contextSelector = fs.readFileSync(new URL("../../features/role-home-bootstrap/ui/DataScopeSelector.tsx", import.meta.url), "utf8");
  const roleSelector = fs.readFileSync(new URL("../../features/role-home-bootstrap/ui/RoleContextSelector.tsx", import.meta.url), "utf8");
  const generatedCatalog = fs.readFileSync(new URL("../../app/api/generated/operations-edge.ts", import.meta.url), "utf8");
  assert.match(app, /operationsAdminRtkRequest\.getOperationsWorkspaceSessionEntry/);
  assert.match(app, /operationsRtk\.useGetOperationsWorkspaceSessionEntryQuery/);
  assert.doesNotMatch(app, /operationsClient\.getOperationsWorkspaceSessionEntry/);
  assert.match(contextSelector, /entry\.dataNodeCandidates/);
  assert.match(contextSelector, /operationsClient\.selectOperationsWorkspaceSessionDataNode/);
  assert.doesNotMatch(contextSelector, /getOperationsOrganizationHierarchy/);
  assert.match(roleSelector, /operationsClient\.selectOperationsWorkspaceSessionContext/);
  assert.match(roleSelector, /entry\.mode === 'EMPTY'/);
  assert.match(generatedCatalog, /export type WorkspaceSessionEntry =/);
  assert.match(generatedCatalog, /"operationId": "getOperationsWorkspaceSessionEntry"/);
  assert.match(generatedCatalog, /"operationId": "selectOperationsWorkspaceSessionContext"/);
  assert.match(generatedCatalog, /"operationId": "selectOperationsWorkspaceSessionDataNode"/);
});

test("each business-entity edit capability consumes its generated update operation instead of leaving a dead contract", () => {
  const businessPage = fs.readFileSync(new URL("../../features/business-entity-management/ui/BusinessEntityManagementPage.tsx", import.meta.url), "utf8");
  const businessEdit = fs.readFileSync(new URL("../../features/business-entity-management/ui/BusinessEntityEditDrawer.tsx", import.meta.url), "utf8");
  const businessDetail = fs.readFileSync(new URL("../../features/business-entity-management/ui/BusinessEntityDetailDrawer.tsx", import.meta.url), "utf8");
  const businessStatus = fs.readFileSync(new URL("../../features/business-entity-management/ui/BusinessEntityStatusModal.tsx", import.meta.url), "utf8");
  const brandAuthorizationDrawer = fs.readFileSync(new URL("../../features/business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx", import.meta.url), "utf8");
  const brandAuthorizationAdapter = fs.readFileSync(new URL("../../features/business-entity-management/application/HeadCompanyBrandAuthorizationActionAdapter.ts", import.meta.url), "utf8");
  const hierarchyPage = fs.readFileSync(new URL("../../features/organization-structure/ui/OrganizationStructurePage.tsx", import.meta.url), "utf8");
  const hierarchyEdit = fs.readFileSync(new URL("../../features/organization-structure/ui/OrganizationEditDrawer.tsx", import.meta.url), "utf8");
  const store = fs.readFileSync(new URL("../../features/store-management/ui/StoreManagementPage.tsx", import.meta.url), "utf8");
  const storeEdit = fs.readFileSync(new URL("../../features/store-management/ui/StoreEditDrawer.tsx", import.meta.url), "utf8");
  const contract = fs.readFileSync(new URL("../../features/contract-management/ui/ContractManagementPage.tsx", import.meta.url), "utf8");
  const contractEdit = fs.readFileSync(new URL("../../features/contract-management/ui/ContractEditDrawer.tsx", import.meta.url), "utf8");
  assert.match(businessPage, /operationsRtk\.useGetOperationsOrganizationBrandsQuery/);
  assert.match(businessPage, /operationsRtk\.useGetOperationsOrganizationTenantsQuery/);
  assert.match(businessPage, /operationsRtk\.useGetOperationsOrganizationHeadCompaniesQuery/);
  assert.match(businessEdit, /operationsClient\.updateOperationsOrganizationBrand/);
  assert.match(businessEdit, /operationsClient\.updateOperationsOrganizationTenant/);
  assert.match(businessEdit, /operationsClient\.updateOperationsOrganizationHeadCompany/);
  assert.match(businessDetail, /ACTION_CAPABILITIES\.ORG_HEAD_COMPANY_BRAND/);
  assert.match(businessPage, /HeadCompanyBrandAuthorizationDrawer/);
  assert.match(businessStatus, /transitionOperationsOrganizationBrandStatus/);
  assert.match(businessStatus, /transitionOperationsOrganizationTenantStatus/);
  assert.match(businessStatus, /transitionOperationsOrganizationHeadCompanyStatus/);
  assert.match(brandAuthorizationAdapter, /addOperationsOrganizationHeadCompanyBrandAuthorization/);
  assert.match(brandAuthorizationAdapter, /removeOperationsOrganizationHeadCompanyBrandAuthorization/);
  assert.match(brandAuthorizationAdapter, /getOperationsOrganizationHeadCompany/);
  assert.match(brandAuthorizationAdapter, /getOperationsOrganizationBrands/);
  assert.doesNotMatch(businessPage + businessEdit + businessDetail + businessStatus + brandAuthorizationDrawer + brandAuthorizationAdapter, /replaceOperationsOrganizationHeadCompanyBrandAuthorizations/);
  assert.doesNotMatch(brandAuthorizationDrawer + brandAuthorizationAdapter, /\bfetch\s*\(|operationsRtk|OperationsApi/);
  assert.match(hierarchyPage, /ACTION_CAPABILITIES\.ORG_REGION_EDIT/);
  assert.match(hierarchyPage, /ACTION_CAPABILITIES\.ORG_PROJECT_EDIT/);
  assert.match(hierarchyEdit, /operationsClient\.updateOperationsOrganizationNode/);
  assert.match(store, /ACTION_CAPABILITIES\.ORG_STORE_EDIT/);
  assert.match(storeEdit, /operationsClient\.updateOperationsOrganizationStore/);
  assert.match(contract, /ACTION_CAPABILITIES\.CONTRACT_EDIT/);
  assert.match(contractEdit, /operationsClient\.updateOperationsContract/);
});

test("workspace invitation management resolves page capability from the generated catalog and consumes all frozen write operations", () => {
  const invitationPanel = fs.readFileSync(new URL("../../features/workspace-user/ui/WorkspaceInvitationPanel.tsx", import.meta.url), "utf8");
  const invitationCreateDrawer = fs.readFileSync(new URL("../../features/workspace-user/ui/WorkspaceInvitationCreateDrawer.tsx", import.meta.url), "utf8");
  const invitationActionModal = fs.readFileSync(new URL("../../features/workspace-user/ui/WorkspaceInvitationActionModal.tsx", import.meta.url), "utf8");
  assert.match(invitationPanel, /userManagementFor\(pageDesignKey\)/);
  assert.match(invitationPanel, /actionCapabilityKeys\.includes\(userManagement\.inviteActionKey\)/);
  assert.match(invitationPanel, /const targetType = userManagement\.targetOrganizationType/);
  assert.doesNotMatch(invitationPanel, /ACTION_CAPABILITIES/);
  for (const target of ["Group", "Region", "Project", "HeadCompany", "Store"]) {
    assert.match(invitationCreateDrawer, new RegExp(`operationsClient\\.createOperationsWorkspace${target}Invitation`));
    assert.match(invitationActionModal, new RegExp(`operationsClient\\.cancelOperationsWorkspace${target}Invitation`));
    assert.match(invitationActionModal, new RegExp(`operationsClient\\.reissueOperationsWorkspace${target}Invitation`));
  }
  assert.doesNotMatch(invitationCreateDrawer + invitationActionModal, /operationsClient\.(?:create|cancel|reissue)OperationsWorkspaceInvitation/);
  assert.match(invitationPanel + invitationCreateDrawer + invitationActionModal, /expectedContextVersion: queryContext\.expectedContextVersion/);
});

test("operations details and login alternatives consume every approved generated read or auth operation", () => {
  const login = fs.readFileSync(new URL("../../features/authentication/ui/OperationsLoginPage.tsx", import.meta.url), "utf8");
  const user = fs.readFileSync(new URL("../../features/workspace-user/ui/WorkspaceUserPage.tsx", import.meta.url), "utf8");
  const profile = fs.readFileSync(new URL("../../features/store-profile/ui/StoreProfilePage.tsx", import.meta.url), "utf8");
  const store = fs.readFileSync(new URL("../../features/store-management/ui/StoreManagementPage.tsx", import.meta.url), "utf8");
  const contractDetail = fs.readFileSync(new URL("../../features/contract-management/ui/ContractDetailDrawer.tsx", import.meta.url), "utf8");
  const generatedCatalog = fs.readFileSync(new URL("../../app/api/generated/operations-edge.ts", import.meta.url), "utf8");
  assert.match(login, /operationsClient\.sendOperationsWorkspaceOtp/);
  assert.match(login, /operationsClient\.verifyOperationsWorkspaceOtp/);
  for (const target of ["Group", "Region", "Project", "HeadCompany", "Store"]) {
    assert.match(user, new RegExp(`operationsClient\\.getOperationsWorkspace${target}UserAccount`));
  }
  assert.doesNotMatch(user, /operationsClient\.getOperationsWorkspaceUserAccount/);
  assert.match(profile, /operationsAdminRtkRequest\.getOperationsFixedStoreContracts/);
  assert.match(profile, /operationsRtk\.useGetOperationsFixedStoreContractsQuery/);
  assert.match(store, /operationsAdminRtkRequest\.getOperationsOrganizationStore/);
  assert.match(contractDetail, /operationsAdminRtkRequest\.getOperationsContract/);
  for (const operationId of ["sendOperationsWorkspaceOtp", "verifyOperationsWorkspaceOtp", "getOperationsWorkspaceGroupUserAccount", "getOperationsWorkspaceRegionUserAccount", "getOperationsWorkspaceProjectUserAccount", "getOperationsWorkspaceHeadCompanyUserAccount", "getOperationsWorkspaceStoreUserAccount", "getOperationsFixedStoreContracts", "getOperationsOrganizationStore", "getOperationsContract"]) {
    assert.match(generatedCatalog, new RegExp(`"operationId": "${operationId}"`));
  }
});

test("operations password change uses the approved authentication consumers and a terminal relogin result", () => {
  const app = fs.readFileSync(new URL("../../app/OperationsApp.tsx", import.meta.url), "utf8");
  const drawer = fs.readFileSync(new URL("../../features/authentication/ui/OperationsPasswordChangeDrawer.tsx", import.meta.url), "utf8");
  const result = fs.readFileSync(new URL("../../features/authentication/ui/OperationsPasswordChangeResult.tsx", import.meta.url), "utf8");
  assert.match(app, /features\/authentication\/ui\/OperationsPasswordChangeDrawer/);
  assert.match(app, /OperationsPasswordChangeResult/);
  assert.doesNotMatch(app, /features\/work-context\/ui\/OperationsPasswordChangeDrawer/);
  assert.match(drawer, /operationsClient\.changeCurrentWorkspacePassword/);
  assert.match(drawer, /useSubmissionLifecycle/);
  assert.match(drawer, /useOverlayLock\(open\)/);
  assert.match(drawer, /clearSecrets\(\)/);
  assert.doesNotMatch(drawer, /problem\.detail/);
  assert.match(result, /useOverlayLock\(open\)/);
  assert.match(result, /修改成功/);
  assert.match(result, /重新登录/);
});

test("operations shell is owner-branded, catalog-titled, tab-hosted, and icon-mapped", () => {
  const app = fs.readFileSync(new URL("../../app/OperationsApp.tsx", import.meta.url), "utf8");
  assert.match(app, /entry\.workspaceName/);
  assert.match(app, /entry\.operationsTitle/);
  assert.match(app, /entry\.logoUrl/);
  assert.match(app, /selectedCatalogPage\.pageTitle/);
  assert.match(app, /pageMeta\.contentTabLabel/);
  assert.match(app, /<Tabs/);
  assert.match(app, /operations-shell-refresh-current/);
  assert.match(app, /operations-shell-toggle-fullscreen/);
  assert.match(app, /menuIconByKey/);
  assert.match(app, /DashboardOutlined/);
  assert.match(app, /ApartmentOutlined/);
  assert.match(app, /ShopOutlined/);
  assert.doesNotMatch(app, />运营管理后台</);
});
