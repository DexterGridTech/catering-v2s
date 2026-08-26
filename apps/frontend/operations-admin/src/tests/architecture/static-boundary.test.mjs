import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('operations-admin owns R5 keyed login and never persists session tokens in browser storage', () => {
  const app = fs.readFileSync(new URL('../../app/OperationsApp.tsx', import.meta.url), 'utf8');
  const login = fs.readFileSync(
    new URL('../../features/authentication/ui/OperationsLoginPage.tsx', import.meta.url),
    'utf8',
  );
  const generatedCatalog = fs.readFileSync(
    new URL('../../app/api/generated/operations-edge.ts', import.meta.url),
    'utf8',
  );
  assert.match(login, /operationsClient\.operationsWorkspacePasswordLogin/);
  const passwordLoginWirePattern = new RegExp(
    [
      String.raw`"operationId": "operationsWorkspacePasswordLogin"`,
      String.raw`"path": "\/api\/operations\/group-workspaces\/\{groupWorkspaceKey\}\/password-login"`,
    ].join(String.raw`[\s\S]*`),
  );
  assert.match(generatedCatalog, passwordLoginWirePattern);
  assert.doesNotMatch(login, /['"`]\s*\/api\//);
  assert.match(login, /groupWorkspaceKey/);
  assert.match(app, /DataScopeSelector/);
  assert.doesNotMatch(app + login, /sessionStorage|localStorage/);
});

test('operations sign-in centers the official LoginFormPage card through its public container style', () => {
  const login = fs.readFileSync(
    new URL('../../features/authentication/ui/OperationsLoginPage.tsx', import.meta.url),
    'utf8',
  );
  const layout = fs.readFileSync(
    new URL('../../features/authentication/ui/loginFormPageLayout.ts', import.meta.url),
    'utf8',
  );
  assert.match(login, /operationsSignInFormPageLayout/);
  assert.match(layout, /export const operationsSignInFormPageLayout/);
  assert.match(layout, /position: 'fixed'/);
  assert.match(layout, /top: '50%'/);
  assert.match(layout, /left: '50%'/);
  assert.match(layout, /transform: 'translate\(-50%, -50%\)'/);
  assert.doesNotMatch(layout, /ant-pro-form-login-page/);
});

test('operations sign-in gives the management console title priority and keeps the workspace as the subtitle', () => {
  const login = fs.readFileSync(
    new URL('../../features/authentication/ui/OperationsLoginPage.tsx', import.meta.url),
    'utf8',
  );
  assert.match(login, /title=\{entryState\.operationsTitle\}/);
  assert.match(login, /subTitle=\{entryState\.workspaceName\}/);
  assert.doesNotMatch(login, /title=\{entryState\.workspaceName\}/);
  assert.doesNotMatch(login, /subTitle=\{entryState\.operationsTitle\}/);
});

test('operations scope trigger keeps the original compact range summary and preserves its actionable owner-confirmed contents', () => {
  const selector = fs.readFileSync(
    new URL('../../features/role-home-bootstrap/ui/DataScopeSelector.tsx', import.meta.url),
    'utf8',
  );
  const styles = fs.readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
  assert.match(selector, /operations-scope-trigger-summary/);
  assert.match(selector, /<Typography\.Text type="secondary" className="operations-scope-trigger-type">/);
  assert.match(selector, /\{name\}：/);
  assert.match(selector, /operations-scope-trigger-line/);
  assert.match(styles, /\.operations-scope-trigger-line \{[\s\S]*display: grid;[\s\S]*line-height: 20px;/);
  assert.match(
    styles,
    /\.operations-scope-trigger-type,[\s\S]*\.operations-scope-trigger-value \{[\s\S]*display: block;/,
  );
  assert.doesNotMatch(selector, /operations-scope-trigger-heading|RightOutlined/);
});

test('operations shell fixes the range footer outside its only scrollable navigation region', () => {
  const app = fs.readFileSync(new URL('../../app/OperationsApp.tsx', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
  assert.match(app, /<Menu[\s\S]*className="operations-shell-menu"/);
  assert.match(styles, /\.operations-shell-menu \{[\s\S]*min-height: 0;[\s\S]*flex: 1 1 auto;[\s\S]*overflow-y: auto;/);
  assert.match(styles, /\.operations-scope-selector \{[\s\S]*flex: 0 0 auto;/);
});

test('operations business surfaces never expose owner internals, raw scope identities, or copy implementation terms', () => {
  const dictionary = fs.readFileSync(
    new URL('../../features/catalog-management/ui/CatalogDictionaryDrawerState.tsx', import.meta.url),
    'utf8',
  );
  const configurationSurface = fs.readFileSync(
    new URL('../../features/catalog-management/ui/CatalogConfigurationDrawerSurface.tsx', import.meta.url),
    'utf8',
  );
  const item = fs.readFileSync(
    new URL('../../features/catalog-management/ui/CatalogItemDrawer.tsx', import.meta.url),
    'utf8',
  );
  const localCopy = fs.readFileSync(
    new URL('../../features/catalog-management/ui/LocalCatalogCopyDrawer.tsx', import.meta.url),
    'utf8',
  );
  const brandCopy = fs.readFileSync(
    new URL('../../features/catalog-management/ui/BrandCatalogCopyDrawer.tsx', import.meta.url),
    'utf8',
  );
  const inventory = fs.readFileSync(
    new URL('../../features/inventory-management/ui/InventoryDetailDrawer.tsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(dictionary, /生产履约 owner|商品字典 owner|当前作用域：|quickManage|回填当前字段/);
  assert.match(configurationSurface, /维护商品共用的标签、单位、规格、生产标签、属性和点单选项/);
  assert.doesNotMatch(
    item,
    /商品 owner|typed production profile|其他 typed 字段|lineSign：|字段契约未登记|数据节点上下文/,
  );
  assert.doesNotMatch(
    localCopy + brandCopy,
    /owner 回读|Owner readback|旧 digest|闭包对象|\$\{(?:sourceScope|targetScope|scope)\.ownerType\}/,
  );
  assert.match(localCopy + brandCopy, /关联内容/);
  assert.doesNotMatch(inventory, /ownerScope\.ownerRef/);
});

test('catalog configuration drawer keeps one first-level workspace with stable library navigation and small atom modals only', () => {
  const dictionary = fs.readFileSync(
    new URL('../../features/catalog-management/ui/CatalogDictionaryDrawerState.tsx', import.meta.url),
    'utf8',
  );
  const navigation = fs.readFileSync(
    new URL('../../features/catalog-management/ui/CatalogConfigurationLibraryNavigation.tsx', import.meta.url),
    'utf8',
  );
  const configurationSurface = fs.readFileSync(
    new URL('../../features/catalog-management/ui/CatalogConfigurationDrawerSurface.tsx', import.meta.url),
    'utf8',
  );
  const simpleLibrary = fs.readFileSync(
    new URL('../../features/catalog-management/ui/CatalogSimpleDictionaryLibrary.tsx', import.meta.url),
    'utf8',
  );
  const skuAttributeLibrary = fs.readFileSync(
    new URL('../../features/catalog-management/ui/CatalogSkuAttributeLibrary.tsx', import.meta.url),
    'utf8',
  );
  const atomModals = fs.readFileSync(
    new URL('../../features/catalog-management/ui/CatalogDictionaryAtomModals.tsx', import.meta.url),
    'utf8',
  );
  const definitionLibraries = fs.readFileSync(
    new URL('../../features/catalog-management/ui/CatalogDefinitionLibraries.tsx', import.meta.url),
    'utf8',
  );
  const workbench = [
    fs.readFileSync(
      new URL('../../features/catalog-management/ui/controllers/CatalogWorkbenchController.tsx', import.meta.url),
      'utf8',
    ),
    fs.readFileSync(
      new URL('../../features/catalog-management/ui/CatalogWorkbenchToolbar.tsx', import.meta.url),
      'utf8',
    ),
  ].join('\n');
  const catalogTestIds = fs.readFileSync(
    new URL('../../features/catalog-management/catalogTestIds.ts', import.meta.url),
    'utf8',
  );
  assert.match(
    navigation,
    /\{key: 'TAG', label: '商品标签'\}[\s\S]*\{key: 'UNIT', label: '计量单位'\}[\s\S]*\{key: 'SKU_ATTRIBUTE', label: '规格维度'\}[\s\S]*\{key: 'PRODUCTION_TAG', label: '生产标签'\}/,
  );
  assert.match(navigation, /\{key: 'ATTRIBUTES', label: '商品属性库'\}/);
  assert.match(navigation, /\{key: 'ORDER_OPTIONS', label: '点单选项库'\}/);
  assert.match(
    configurationSurface,
    /title=\{presentation === 'EDITOR_CHILD' \? '维护商品元数据' : '商品配置'\}[\s\S]*push=\{false\}[\s\S]*adminWideDrawerSurfaceProps/,
  );
  assert.match(
    configurationSurface,
    /<CatalogConfigurationLibraryNavigation[\s\S]*contentId="catalog-configuration-content"/,
  );
  assert.match(navigation, /aria-label="商品配置分类"[\s\S]*width: 184/);
  assert.match(
    dictionary,
    /<CatalogDefinitionLibraries[\s\S]*open=\{open\}[\s\S]*kind=\{currentLibrary === 'ATTRIBUTES' \? 'ATTRIBUTES' : 'ORDER_OPTIONS'\}/,
  );
  assert.match(
    atomModals,
    /canWrite && creatingKind && \([\s\S]*<Modal[\s\S]*width=\{creationKind === 'UNIT' \? 720 : 480\}/,
  );
  assert.doesNotMatch(dictionary, /上移|下移|reorderOperationsCatalogDictionaryEntry/);
  assert.match(dictionary, /if \(open && !wasOpen\.current\) \{[\s\S]*selectLibrary\(initialConfigLibrary\);/);
  assert.match(dictionary, /dictionaryData = dictionaryQuery\.currentData\?\.data/);
  assert.match(dictionary, /productionQuery\.currentData\?\.data/);
  assert.match(dictionary, /const isSkuAttributeManagement = kind === 'SKU_ATTRIBUTE';/);
  assert.match(skuAttributeLibrary, /<Splitter[\s\S]*catalogTestIds\.static\.skuAttributeManager/);
  assert.match(skuAttributeLibrary, /rowSelection=\{\{[\s\S]*type: 'radio'/);
  assert.match(simpleLibrary, /placeholder="搜索名称或编码"[\s\S]*catalogTestIds\.control\.configSearch/);
  assert.match(simpleLibrary, /全部状态[\s\S]*已停用/);
  assert.match(
    dictionary,
    /dictionaryKind: 'SKU_ATTRIBUTE_VALUE',[\s\S]*parentEntryRef: wireUuid\(selectedAttributeRef\)/,
  );
  assert.match(dictionary, /const \[tagForm\] = Form\.useForm/);
  assert.match(dictionary, /const \[unitForm\] = Form\.useForm/);
  assert.match(dictionary, /const \[skuAttributeForm\] = Form\.useForm/);
  assert.match(dictionary, /const \[productionTagForm\] = Form\.useForm/);
  assert.match(atomModals, /canWrite && creatingKind && \(\s*<Modal/);
  assert.match(catalogTestIds, /dictionaryCreateModal: 'catalog-dictionary-create-modal'/);
  assert.match(catalogTestIds, /dictionaryNameEditModal: 'catalog-dictionary-name-edit-modal'/);
  assert.match(catalogTestIds, /dictionaryStatusChangeModal: 'catalog-dictionary-status-change-modal'/);
  assert.match(dictionary, /仍被商品或规格使用/);
  assert.doesNotMatch(dictionary, /\$\{entry\.referenceKind\}:\$\{entry\.referenceRef\}/);
  assert.doesNotMatch(dictionary, /dictionaryEditingKey|editingCode|editingName/);
  assert.doesNotMatch(dictionary, /checkCodeAvailability|编码可用|toUpperCase\(|\^\[A-Z0-9\]/);
  assert.doesNotMatch(definitionLibraries, /title: '操作'|>刷新<|可选项可不关联原料；关联后，商品配置会填写每份用量。/);
  assert.match(
    definitionLibraries,
    /属性名称[\s\S]*onOpenDefinitionEditor\(\{library: 'ATTRIBUTES', mode: 'EDIT', definitionRef: row\.definitionRef\}\)/,
  );
  assert.match(
    definitionLibraries,
    /选项组[\s\S]*onOpenDefinitionEditor\(\{library: 'ORDER_OPTIONS', mode: 'EDIT', definitionRef: row\.definitionRef\}\)/,
  );
  assert.match(workbench, /商品元数据/);
  assert.doesNotMatch(workbench, /<Tabs\b|catalogArea|catalog-inventory-area-tabs|CatalogDefinitionLibraries/);
  assert.doesNotMatch(workbench, /catalog-inventory-production-tags/);
});

test('catalog product controls derive every runtime testId from the shared business-identity vocabulary', () => {
  const uiDirectory = new URL('../../features/catalog-management/ui/', import.meta.url);
  const sources = fs
    .readdirSync(uiDirectory)
    .filter(fileName => /\.(?:tsx|ts)$/.test(fileName) && !/\.test\.(?:tsx|ts)$/.test(fileName))
    .map(fileName => [fileName, fs.readFileSync(new URL(fileName, uiDirectory), 'utf8')]);
  const directCatalogTestId = /\btestId(?:\(|=)\s*\{?\s*(?:`catalog-|['"]catalog-)/;
  const offenders = sources.filter(([, source]) => directCatalogTestId.test(source)).map(([fileName]) => fileName);
  assert.deepEqual(offenders, []);
  const catalogTestIds = fs.readFileSync(
    new URL('../../features/catalog-management/catalogTestIds.ts', import.meta.url),
    'utf8',
  );
  assert.match(catalogTestIds, /inventory:\s*\{[\s\S]*bomLine:/);
  assert.match(catalogTestIds, /copy:\s*\{[\s\S]*confirmation:/);
  assert.match('testId(`catalog-inventory-bom-remove-${index}`)', directCatalogTestId);
});

test(
  'operations session selection is generated-wire driven ' +
    'and never derives an unscoped data-node list in the browser',
  () => {
    const app = fs.readFileSync(new URL('../../app/OperationsApp.tsx', import.meta.url), 'utf8');
    const contextSelector = fs.readFileSync(
      new URL('../../features/role-home-bootstrap/ui/DataScopeSelector.tsx', import.meta.url),
      'utf8',
    );
    const roleSelector = fs.readFileSync(
      new URL('../../features/role-home-bootstrap/ui/RoleContextSelector.tsx', import.meta.url),
      'utf8',
    );
    const generatedCatalog = fs.readFileSync(
      new URL('../../app/api/generated/operations-edge.ts', import.meta.url),
      'utf8',
    );
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
  },
);

test(
  'each business-entity edit capability consumes its generated update operation ' +
    'instead of leaving a dead contract',
  () => {
    const businessPage = fs.readFileSync(
      new URL('../../features/business-entity-management/ui/BusinessEntityManagementPage.tsx', import.meta.url),
      'utf8',
    );
    const businessEdit = fs.readFileSync(
      new URL('../../features/business-entity-management/ui/BusinessEntityEditDrawer.tsx', import.meta.url),
      'utf8',
    );
    const businessDetail = fs.readFileSync(
      new URL('../../features/business-entity-management/ui/BusinessEntityDetailDrawer.tsx', import.meta.url),
      'utf8',
    );
    const businessStatus = fs.readFileSync(
      new URL('../../features/business-entity-management/ui/BusinessEntityStatusModal.tsx', import.meta.url),
      'utf8',
    );
    const brandAuthorizationDrawer = fs.readFileSync(
      new URL('../../features/business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx', import.meta.url),
      'utf8',
    );
    const brandAuthorizationAdapter = fs.readFileSync(
      new URL(
        '../../features/business-entity-management/application/HeadCompanyBrandAuthorizationActionAdapter.ts',
        import.meta.url,
      ),
      'utf8',
    );
    const hierarchyPage = fs.readFileSync(
      new URL('../../features/organization-structure/ui/OrganizationStructurePage.tsx', import.meta.url),
      'utf8',
    );
    const hierarchyEdit = fs.readFileSync(
      new URL('../../features/organization-structure/ui/OrganizationEditDrawer.tsx', import.meta.url),
      'utf8',
    );
    const store = fs.readFileSync(
      new URL('../../features/store-management/ui/StoreManagementPage.tsx', import.meta.url),
      'utf8',
    );
    const storeEdit = fs.readFileSync(
      new URL('../../features/store-management/ui/StoreEditDrawer.tsx', import.meta.url),
      'utf8',
    );
    const contract = fs.readFileSync(
      new URL('../../features/contract-management/ui/ContractManagementPage.tsx', import.meta.url),
      'utf8',
    );
    const contractEdit = fs.readFileSync(
      new URL('../../features/contract-management/ui/ContractEditDrawer.tsx', import.meta.url),
      'utf8',
    );
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
    assert.doesNotMatch(
      businessPage +
        businessEdit +
        businessDetail +
        businessStatus +
        brandAuthorizationDrawer +
        brandAuthorizationAdapter,
      /replaceOperationsOrganizationHeadCompanyBrandAuthorizations/,
    );
    assert.doesNotMatch(
      brandAuthorizationDrawer + brandAuthorizationAdapter,
      /\bfetch\s*\(|operationsRtk|OperationsApi/,
    );
    assert.match(hierarchyPage, /ACTION_CAPABILITIES\.ORG_REGION_EDIT/);
    assert.match(hierarchyPage, /ACTION_CAPABILITIES\.ORG_PROJECT_EDIT/);
    assert.match(hierarchyEdit, /operationsClient\.updateOperationsOrganizationNode/);
    assert.match(store, /ACTION_CAPABILITIES\.ORG_STORE_EDIT/);
    assert.match(storeEdit, /operationsClient\.updateOperationsOrganizationStore/);
    assert.match(contract, /ACTION_CAPABILITIES\.CONTRACT_EDIT/);
    assert.match(contractEdit, /operationsClient\.updateOperationsContract/);
  },
);

test(
  'workspace invitation management resolves page capability from the generated catalog ' +
    'and consumes all frozen write operations',
  () => {
    const invitationPanel = fs.readFileSync(
      new URL('../../features/workspace-user/ui/WorkspaceInvitationPanel.tsx', import.meta.url),
      'utf8',
    );
    const invitationCreateDrawer = fs.readFileSync(
      new URL('../../features/workspace-user/ui/WorkspaceInvitationCreateDrawer.tsx', import.meta.url),
      'utf8',
    );
    const invitationActionModal = fs.readFileSync(
      new URL('../../features/workspace-user/ui/WorkspaceInvitationActionModal.tsx', import.meta.url),
      'utf8',
    );
    const invitationDetailDrawer = fs.readFileSync(
      new URL('../../features/workspace-user/ui/WorkspaceInvitationDetailDrawer.tsx', import.meta.url),
      'utf8',
    );
    assert.match(invitationPanel, /userManagementFor\(pageDesignKey\)/);
    assert.match(invitationPanel, /actionCapabilityKeys\.includes\(userManagement\.inviteActionKey\)/);
    assert.match(invitationPanel, /const targetType = userManagement\.targetOrganizationType/);
    assert.match(invitationPanel, /activeInvitationPageUrl\(value\)/);
    assert.match(invitationPanel, /title: '邀请链接'/);
    assert.match(invitationPanel, /ellipsis: \{showTitle: false\}/);
    assert.match(
      invitationPanel,
      /EllipsisTooltip\s+title=\{<NameCodePathText\s+value=\{value\.targetOrganizationPath\}\s*\/>\}/,
    );
    assert.doesNotMatch(invitationPanel, /ACTION_CAPABILITIES/);
    for (const target of ['Group', 'Region', 'Project', 'HeadCompany', 'Store']) {
      assert.match(invitationPanel, new RegExp(`getOperationsWorkspace${target}Invitations`));
      assert.match(
        invitationCreateDrawer,
        new RegExp(`operationsClient\\.createOperationsWorkspace${target}Invitation`),
      );
      assert.match(
        invitationActionModal,
        new RegExp(`operationsClient\\.cancelOperationsWorkspace${target}Invitation`),
      );
      assert.match(
        invitationActionModal,
        new RegExp(`operationsClient\\.reissueOperationsWorkspace${target}Invitation`),
      );
    }
    assert.doesNotMatch(
      invitationCreateDrawer + invitationActionModal,
      /operationsClient\.(?:create|cancel|reissue)OperationsWorkspaceInvitation/,
    );
    assert.match(
      invitationPanel + invitationCreateDrawer + invitationActionModal,
      /expectedContextVersion: queryContext\.expectedContextVersion/,
    );
    assert.match(invitationDetailDrawer, /activeInvitationPageUrl\(invitation\)/);
    assert.doesNotMatch(invitationDetailDrawer, /copy\(invitation\.invitationPageUrl\)/);
  },
);

test('operations details and login alternatives consume every approved generated read or auth operation', () => {
  const login = fs.readFileSync(
    new URL('../../features/authentication/ui/OperationsLoginPage.tsx', import.meta.url),
    'utf8',
  );
  const user = fs.readFileSync(
    new URL('../../features/workspace-user/ui/WorkspaceUserPage.tsx', import.meta.url),
    'utf8',
  );
  const profile = fs.readFileSync(
    new URL('../../features/store-profile/ui/StoreProfilePage.tsx', import.meta.url),
    'utf8',
  );
  const store = fs.readFileSync(
    new URL('../../features/store-management/ui/StoreManagementPage.tsx', import.meta.url),
    'utf8',
  );
  const contractDetail = fs.readFileSync(
    new URL('../../features/contract-management/ui/ContractDetailDrawer.tsx', import.meta.url),
    'utf8',
  );
  const generatedCatalog = fs.readFileSync(
    new URL('../../app/api/generated/operations-edge.ts', import.meta.url),
    'utf8',
  );
  assert.match(login, /operationsClient\.sendOperationsWorkspaceOtp/);
  assert.match(login, /operationsClient\.verifyOperationsWorkspaceOtp/);
  for (const target of ['Group', 'Region', 'Project', 'HeadCompany', 'Store']) {
    assert.match(user, new RegExp(`operationsAdminRtkRequest\\.getOperationsWorkspace${target}UserAccount`));
    assert.match(user, new RegExp(`operationsRtk\\.useGetOperationsWorkspace${target}UserAccountQuery`));
  }
  assert.doesNotMatch(user, /operationsClient\.getOperationsWorkspaceUserAccount/);
  assert.match(profile, /operationsAdminRtkRequest\.getOperationsFixedStoreContracts/);
  assert.match(profile, /operationsRtk\.useGetOperationsFixedStoreContractsQuery/);
  assert.match(store, /operationsAdminRtkRequest\.getOperationsOrganizationStore/);
  assert.match(contractDetail, /operationsAdminRtkRequest\.getOperationsContract/);
  for (const operationId of [
    'sendOperationsWorkspaceOtp',
    'verifyOperationsWorkspaceOtp',
    'getOperationsWorkspaceGroupUserAccount',
    'getOperationsWorkspaceRegionUserAccount',
    'getOperationsWorkspaceProjectUserAccount',
    'getOperationsWorkspaceHeadCompanyUserAccount',
    'getOperationsWorkspaceStoreUserAccount',
    'getOperationsFixedStoreContracts',
    'getOperationsOrganizationStore',
    'getOperationsContract',
  ]) {
    assert.match(generatedCatalog, new RegExp(`"operationId": "${operationId}"`));
  }
});

test('operations password change uses the approved authentication consumers and a terminal relogin result', () => {
  const app = fs.readFileSync(new URL('../../app/OperationsApp.tsx', import.meta.url), 'utf8');
  const drawer = fs.readFileSync(
    new URL('../../features/authentication/ui/OperationsPasswordChangeDrawer.tsx', import.meta.url),
    'utf8',
  );
  const result = fs.readFileSync(
    new URL('../../features/authentication/ui/OperationsPasswordChangeResult.tsx', import.meta.url),
    'utf8',
  );
  assert.match(app, /features\/authentication\/ui\/OperationsPasswordChangeDrawer/);
  assert.match(app, /OperationsPasswordChangeResult/);
  assert.doesNotMatch(app, /features\/work-context\/ui\/OperationsPasswordChangeDrawer/);
  assert.match(drawer, /operationsClient\.changeCurrentWorkspacePassword/);
  assert.match(drawer, /useSubmissionLifecycle/);
  assert.match(drawer, /useOverlayLock\(open\)/);
  assert.match(drawer, /clearSecrets\(\)/);
  assert.doesNotMatch(drawer, /problem\.detail/);
  assert.match(result, /useOverlayLock\(open\)/);
});

test.todo('no-seed browser L2 must prove the operations shell keeps owner branding, catalog tabs and icon mapping');
test.todo('no-seed browser L2 must prove authored truncation exposes the complete human-readable value');

test('editable catalog rows use UI-stable keys and preserve only definition-backed item options at the owner boundary', () => {
  const identifiers = fs.readFileSync(
    new URL('../../features/catalog-management/ui/CatalogItemIdentifiersEditor.tsx', import.meta.url),
    'utf8',
  );
  const skuMatrix = fs.readFileSync(
    new URL('../../features/catalog-management/ui/CatalogItemSkuMatrixTable.tsx', import.meta.url),
    'utf8',
  );
  const saveRequest = fs.readFileSync(
    new URL('../../features/catalog-management/model/catalogItemSaveRequest.ts', import.meta.url),
    'utf8',
  );
  const l2 = fs.readFileSync(new URL('../l2/catalog-inventory.spec.ts', import.meta.url), 'utf8');
  assert.match(identifiers, /key=\{entry\.editorId\}/);
  assert.match(skuMatrix, /rowKey=\{sku => sku\.editorId\}/);
  assert.doesNotMatch(
    identifiers + skuMatrix,
    /key=\{`\$\{(?:entry\.kind|sku\.skuCode|value\.code)-\$\{(?:index|skuIndex|valueIndex)\}`\}/,
  );
  assert.match(
    saveRequest,
    /catalogDraft\.identifiers\s*=\s*input\.identifierDraft\.map\(entry\s*=>\s*\(\{\s*identifierType:\s*entry\.identifierType,\s*identifierValue:\s*entry\.identifierValue,?\s*\}\)\)/,
  );
  assert.doesNotMatch(
    saveRequest,
    /catalogDraft\.identifiers[\s\S]{0,500}(?:identifierRef|ownerType|ownerRef|normalizedValue|displayOrder)/,
  );
  assert.match(
    saveRequest,
    /serializeSkuRowsForSave\(input\.skusDraft\.map\(\(\{editorId: _editorId, \.\.\.row\}\) => row\)\)/,
  );
  assert.match(saveRequest, /orderOptionConfigs: input\.orderOptionConfigsDraft\.map\(config => \(\{/);
  assert.match(saveRequest, /definitionRef: wireUuid\(config\.definitionRef\)/);
  assert.match(saveRequest, /definitionValueRef: wireUuid\(value\.definitionValueRef\)/);
  assert.doesNotMatch(saveRequest, /materialQuantities/);
  assert.doesNotMatch(saveRequest, /materialRef: wireUuid\(/);
  assert.doesNotMatch(saveRequest, /catalogDraft\.orderOptions\s*=/);
  assert.doesNotMatch(
    identifiers + skuMatrix + saveRequest,
    /(?:categoryRefsDraft|orderOptionsDraft|detail\.item\.orderOptions|detail\.orderOptions|attributesDraftRows|CatalogOrderOptionGroup|CatalogOrderOptionValue|OrderOptionsEditor|OrderOptionsReadOnly|AttributesKeyValueEditor|FactMap)/,
  );
  assert.doesNotMatch(saveRequest, /values: values\.map\(\(\{editorId: _editorId, \.\.\.value\}\) => value\)/);
  assert.match(l2, /pressSequentially/);
});

test('candidate refetch keeps unrelated Drawer controls enabled', () => {
  const drawerFiles = [
    '../../features/store-management/ui/StoreCreateDrawer.tsx',
    '../../features/store-management/ui/StoreEditDrawer.tsx',
    '../../features/contract-management/ui/ContractCreateDrawer.tsx',
  ];
  for (const path of drawerFiles) {
    const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /const (?:definitionReady|candidatesReady|ready)/, path);
    for (const name of ['definitionReady', 'candidatesReady', 'ready'])
      assert.doesNotMatch(source, new RegExp(`const ${name}[^;]*isFetching`), path);
    assert.match(source, /loading=\{[^}]*isFetching\}/, path);
    assert.doesNotMatch(source, /<Form[\s\S]{0,260}disabled=\{!ready\}/, path);
  }
});

test(
  'operations Drawers are mask-closeable without changing the other app, ' + 'and immutable form facts are not inputs',
  () => {
    const drawerFiles = [
      'authentication/ui/OperationsPasswordChangeDrawer.tsx',
      'business-entity-management/ui/BusinessEntityCreateDrawer.tsx',
      'business-entity-management/ui/BusinessEntityDetailDrawer.tsx',
      'business-entity-management/ui/BusinessEntityEditDrawer.tsx',
      'business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx',
      'contract-management/ui/ContractCreateDrawer.tsx',
      'contract-management/ui/ContractDetailDrawer.tsx',
      'contract-management/ui/ContractEditDrawer.tsx',
      'organization-structure/ui/OrganizationEditDrawer.tsx',
      'organization-structure/ui/ProjectCreateDrawer.tsx',
      'organization-structure/ui/RegionCreateDrawer.tsx',
      'store-management/ui/StoreCreateDrawer.tsx',
      'store-management/ui/StoreDetailDrawer.tsx',
      'store-management/ui/StoreEditDrawer.tsx',
      'store-profile/ui/FixedStoreContractDetailDrawer.tsx',
      'workspace-user/ui/WorkspaceInvitationCreateDrawer.tsx',
      'workspace-user/ui/WorkspaceInvitationDetailDrawer.tsx',
      'workspace-user/ui/WorkspaceUserDetailDrawer.tsx',
    ];
    for (const path of drawerFiles) {
      const source = fs.readFileSync(new URL(`../../features/${path}`, import.meta.url), 'utf8');
      assert.match(source, /adminDrawerSurfaceProps/, path);
    }
    const draftFiles = [
      'authentication/ui/OperationsPasswordChangeDrawer.tsx',
      'business-entity-management/ui/BusinessEntityCreateDrawer.tsx',
      'business-entity-management/ui/BusinessEntityEditDrawer.tsx',
      'contract-management/ui/ContractCreateDrawer.tsx',
      'contract-management/ui/ContractEditDrawer.tsx',
      'organization-structure/ui/OrganizationEditDrawer.tsx',
      'organization-structure/ui/ProjectCreateDrawer.tsx',
      'organization-structure/ui/RegionCreateDrawer.tsx',
      'store-management/ui/StoreCreateDrawer.tsx',
      'store-management/ui/StoreEditDrawer.tsx',
      'workspace-user/ui/WorkspaceInvitationCreateDrawer.tsx',
    ];
    for (const path of draftFiles) {
      const source = fs.readFileSync(new URL(`../../features/${path}`, import.meta.url), 'utf8');
      assert.match(source, /useDrawerFormLifecycle/, path);
      assert.match(source, /onClose=\{lifecycle\.requestClose\}/, path);
    }
    const immutableValueFiles = [
      'organization-structure/ui/RegionCreateDrawer.tsx',
      'organization-structure/ui/ProjectCreateDrawer.tsx',
      'organization-structure/ui/OrganizationEditDrawer.tsx',
      'contract-management/ui/ContractCreateDrawer.tsx',
      'contract-management/ui/ContractEditDrawer.tsx',
      'store-management/ui/StoreEditDrawer.tsx',
      'workspace-user/ui/WorkspaceInvitationDetailDrawer.tsx',
    ];
    for (const path of immutableValueFiles)
      assert.doesNotMatch(
        fs.readFileSync(new URL(`../../features/${path}`, import.meta.url), 'utf8'),
        /<Input(?:\.TextArea)?\b[^>]*\breadOnly\b/,
        path,
      );
  },
);
