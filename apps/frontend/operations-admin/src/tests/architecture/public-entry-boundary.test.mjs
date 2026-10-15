import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const invitationSource = readFileSync(
  new URL('../../features/invitation-acceptance/ui/PublicInvitationEntry.tsx', import.meta.url),
  'utf8',
);
const recoverySource = [
  '../../features/authentication/ui/OperationsPasswordRecoveryVerifyPage.tsx',
  '../../features/authentication/ui/OperationsPasswordRecoveryPasswordPage.tsx',
  '../../features/authentication/ui/OperationsPasswordRecoveryCompletePage.tsx',
]
  .map(relativePath => readFileSync(new URL(relativePath, import.meta.url), 'utf8'))
  .join('\n');
const appSource = readFileSync(new URL('../../app/OperationsApp.tsx', import.meta.url), 'utf8');
const generatedCatalog = readFileSync(new URL('../../app/api/generated/public-edge.ts', import.meta.url), 'utf8');
const pageRegistrySource = readFileSync(new URL('../../app/routing/pageRegistry.tsx', import.meta.url), 'utf8');
const remoteControlPageSource = readFileSync(
  new URL('../../features/terminal-update/ui/ProjectTerminalUpdatePage.tsx', import.meta.url),
  'utf8',
);
const featureBoundarySourcePaths = [
  '../../features/store-management/ui/StoreDetailDrawer.tsx',
  '../../features/store-management/ui/StoreStatusModal.tsx',
  '../../features/store-management/ui/StoreManagementPage.tsx',
  '../../features/store-profile/ui/StoreProfilePage.tsx',
  '../../features/sales-menu/ui/SalesMenuPage.tsx',
  '../../features/inventory-management/ui/InventoryManagementPage.tsx',
  '../../features/store-service-point/ui/StoreServicePointPage.tsx',
  '../../features/catalog-management/ui/controllers/CatalogWorkbenchController.tsx',
  '../../features/catalog-management/ui/CatalogWorkbenchContent.tsx',
];
const organizationStructureIndex = readFileSync(
  new URL('../../features/organization-structure/index.ts', import.meta.url),
  'utf8',
);
const storeOperatingRulesIndex = readFileSync(
  new URL('../../features/store-operating-rules/index.ts', import.meta.url),
  'utf8',
);
const businessChannelIndex = readFileSync(new URL('../../features/business-channel/index.ts', import.meta.url), 'utf8');
const sameFeatureBusinessChannelSource = readFileSync(
  new URL('../../features/business-channel/ui/BusinessChannelDetailDrawer.tsx', import.meta.url),
  'utf8',
);
const remoteControlIndex = readFileSync(new URL('../../features/remote-control/index.ts', import.meta.url), 'utf8');
const extensionFieldsIndex = readFileSync(new URL('../../features/extension-fields/index.ts', import.meta.url), 'utf8');
const extensionFeatureConsumerPaths = [
  '../../features/organization-structure/ui/RegionCreateDrawer.tsx',
  '../../features/organization-structure/ui/ProjectCreateDrawer.tsx',
  '../../features/organization-structure/ui/OrganizationEditDrawer.tsx',
  '../../features/organization-structure/ui/CommercialGroupEditDrawer.tsx',
  '../../features/organization-structure/ui/OrganizationExtensionFields.tsx',
  '../../features/organization-structure/ui/OrganizationStructurePage.tsx',
  '../../features/business-entity-management/ui/BusinessEntityCreateDrawer.tsx',
  '../../features/business-entity-management/ui/BusinessEntityEditDrawer.tsx',
  '../../features/business-entity-management/ui/BusinessEntityDetailDrawer.tsx',
  '../../features/business-entity-management/ui/BusinessEntityManagementPage.tsx',
  '../../features/store-management/ui/StoreCreateDrawer.tsx',
  '../../features/store-management/ui/StoreEditDrawer.tsx',
  '../../features/store-management/ui/StoreDetailDrawer.tsx',
  '../../features/store-management/ui/StoreManagementPage.tsx',
  '../../features/contract-management/ui/ContractCreateDrawer.tsx',
  '../../features/contract-management/ui/ContractEditDrawer.tsx',
  '../../features/contract-management/ui/ContractDetailDrawer.tsx',
  '../../features/contract-management/ui/ContractManagementPage.tsx',
  '../../features/store-profile/ui/StoreProfilePage.tsx',
  '../../features/store-profile/ui/FixedStoreContractDetailDrawer.tsx',
];

test('public invitation and recovery preserve the public-only, anonymous owner-flow boundary', () => {
  assert.match(invitationSource, /publicClient\s*\.\s*getPublicInvitationView/);
  assert.match(invitationSource, /operationsProblemOf\(error\)/);
  assert.doesNotMatch(invitationSource, /<h1>\{brandHeading\}<\/h1>/);
  for (const operation of [
    'startOperationsPasswordRecovery',
    'sendOperationsPasswordRecoveryOtp',
    'verifyOperationsPasswordRecoveryOtp',
    'completeOperationsPasswordRecovery',
  ]) {
    assert.match(recoverySource, new RegExp(`publicClient\\.${operation}`));
    assert.match(generatedCatalog, new RegExp(`"operationId": "${operation}"`));
  }
  assert.match(generatedCatalog, /\/api\/public\/invitations/);
  assert.match(generatedCatalog, /\/api\/public\/operations-workspaces/);
  const forbiddenRecoveryTokens = [
    '/api/public/password-reset',
    'completeWorkspacePasswordReset',
    'sendWorkspacePasswordResetOtp',
    'verifyWorkspacePasswordResetOtp',
  ];
  assert.doesNotMatch(generatedCatalog, new RegExp(forbiddenRecoveryTokens.join('|')));
  assert.doesNotMatch(
    recoverySource + appSource,
    /resetGenerationKey|sendWorkspacePasswordResetOtp|verifyWorkspacePasswordResetOtp|completeWorkspacePasswordReset/,
  );
  assert.doesNotMatch(recoverySource, /['"`]\s*\/api\//);
  assert.match(recoverySource, /Idempotency-Key/);
  assert.doesNotMatch(recoverySource, /assignmentId|role_assignment|localStorage|sessionStorage|testCode/);
});

test('page registration owns page icons without filtering authorized pages through a second map', () => {
  assert.match(pageRegistrySource, /icon:\s*ReactNode/);
  assert.match(pageRegistrySource, /Component:\s*ProjectTerminalUpdatePage,[\s\S]*?icon:/);
  assert.doesNotMatch(appSource, /menuIconByKey|accessibleMenuPages/);
  assert.match(appSource, /import \{selectAccessibleOperationsPages\} from '\.\/routing\/accessibleOperationsPages'/);
  assert.match(
    appSource,
    /selectAccessibleOperationsPages\(session\.pageAccessKeys,\s*catalogByKey,\s*operationsPageRegistry\)/,
  );
  assert.match(appSource, /icon: item\.registration\.icon/);
});

test('cross-feature consumers use narrow feature entries and same-feature model imports remain valid', () => {
  assert.match(organizationStructureIndex, /organizationStoreStatusLabels/);
  assert.match(organizationStructureIndex, /toggleOrganizationStoreStatus/);
  assert.match(storeOperatingRulesIndex, /useStoreOperatingRuleGate/);
  assert.match(storeOperatingRulesIndex, /StoreOperatingRuleGateState/);
  assert.match(businessChannelIndex, /accessKindLabels/);
  assert.match(businessChannelIndex, /orderKindLabels/);
  const forbiddenInternalFeatureImport =
    /from ['"][^'"]*\/(?:organization-structure\/model\/organizationStatus|store-operating-rules\/model\/useStoreOperatingRuleGate|business-channel\/model\/businessChannelCodeLabels)['"]/;
  for (const relativePath of featureBoundarySourcePaths) {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    assert.equal(
      forbiddenInternalFeatureImport.test(source),
      false,
      `${relativePath} must use the owning feature's public entry for cross-feature imports`,
    );
  }
  assert.match(sameFeatureBusinessChannelSource, /from ['"]\.\.\/model\/businessChannelCodeLabels['"]/);
  assert.match(remoteControlIndex, /RemoteControlWorkspace/);
  assert.match(remoteControlPageSource, /from ['"]\.\.\/\.\.\/remote-control['"]/);
  assert.match(extensionFieldsIndex, /enabledExtensionFields/);
  assert.match(extensionFieldsIndex, /serializeExtensionFormValues/);
  assert.match(extensionFieldsIndex, /hydrateExtensionFormValues/);
  assert.match(extensionFieldsIndex, /extensionDetailItems/);
  assert.match(extensionFieldsIndex, /extensionListAndSearchColumns/);
  assert.match(extensionFieldsIndex, /extensionQueryValues/);
  const retiredExtensionModelImport = /from ['"][^'"]*\/(?:extension-fields\/model|organization-structure\/model\/organizationExtensionValues|extensionList)['"]/;
  for (const relativePath of extensionFeatureConsumerPaths) {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    assert.equal(
      retiredExtensionModelImport.test(source),
      false,
      `${relativePath} must consume the extension-fields feature entry, not its model or retired serializer`,
    );
  }
});

test.todo(
  'no-seed browser L2 must prove public invitation next-step controls and owner-projected heading/path rendering',
);
