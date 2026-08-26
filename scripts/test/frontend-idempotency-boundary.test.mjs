import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => readFileSync(path.join(root, relative), 'utf8');
function contentKeyPattern(namespace, operationId) {
  return new RegExp('createContentIdempotencyKey\\(\\s*' + namespace + '\\.' + operationId + '\\b');
}
const featureSources = [
  'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemCreateDrawer.tsx',
  'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemViewDrawer.tsx',
  'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogTemporaryPromotionTask.tsx',
  'apps/frontend/operations-admin/src/features/catalog-management/model/useCatalogItemEditorSession.ts',
  'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawerState.tsx',
  'apps/frontend/operations-admin/src/features/catalog-management/ui/controllers/CatalogWorkbenchController.tsx',
  'apps/frontend/operations-admin/src/features/catalog-management/ui/controllers/useCatalogCategoryActionController.tsx',
  'apps/frontend/operations-admin/src/features/catalog-management/ui/controllers/useCatalogBatchActionController.ts',
  'apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx',
  'apps/frontend/operations-admin/src/features/catalog-management/ui/LocalCatalogCopyDrawer.tsx',
  'apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryActionModal.tsx',
].map(relative => [relative, read(relative)]);

test('set-value catalog commands derive keys from operation and request content', () => {
  const source = featureSources.map(([, content]) => content).join('\n');
  const operations = [
    'createOperationsCatalogItem',
    'saveOperationsCatalogItem',
    'transitionOperationsCatalogItemStatus',
    'preflightOperationsTemporaryCatalogItemPromotion',
    'executeOperationsTemporaryCatalogItemPromotion',
    'stageOperationsCatalogAsset',
    'releaseOperationsCatalogStagedAsset',
    'preflightOperationsBrandCatalogCopy',
    'executeOperationsBrandCatalogCopy',
    'preflightOperationsLocalCatalogCopy',
    'executeOperationsLocalCatalogCopy',
    'updateOperationsCatalogDictionaryEntry',
    'transitionOperationsCatalogDictionaryEntryStatus',
    'updateOperationsProductionTag',
    'transitionOperationsProductionTagStatus',
    'createOperationsCatalogCategory',
    'updateOperationsCatalogCategory',
    'moveOperationsCatalogCategory',
    'deleteOperationsCatalogCategory',
    'batchTransitionOperationsCatalogItemStatus',
    'updateOperationsInventoryTargetConfiguration',
  ];

  for (const operationId of operations) {
    assert.match(
      source,
      contentKeyPattern('CATALOG_INVENTORY_OPERATION_IDS', operationId),
      `${operationId} must use content-derived idempotency`,
    );
  }
  assert.match(
    read('apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawerState.tsx'),
    /const requestOperationId = isProduction[\s\S]*?createOperationsProductionTag[\s\S]*?createOperationsCatalogDictionaryEntry/,
  );
  assert.match(
    read('apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawerState.tsx'),
    /createContentIdempotencyKey\(requestOperationId, body\)/,
  );
  for (const [, content] of featureSources) {
    assert.doesNotMatch(content, /['"]Idempotency-Key['"]\s*:\s*globalThis\.crypto\.randomUUID\(\)/);
  }
  assert.doesNotMatch(source, /reorderOperationsCatalogDictionaryEntry/);
  assert.doesNotMatch(
    read('apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemViewDrawer.tsx'),
    /lifecycle\.getIdempotencyKey\(\)/,
  );
  assert.doesNotMatch(
    read('apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx'),
    /useSubmissionLifecycle|submission\./,
  );
  assert.doesNotMatch(
    read('apps/frontend/operations-admin/src/features/catalog-management/ui/LocalCatalogCopyDrawer.tsx'),
    /useSubmissionLifecycle|submission\./,
  );
});

test('inventory quantity changes keep one retry key while configuration uses content', () => {
  const source = read('apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryActionModal.tsx');
  assert.match(source, /const headers = \{'Idempotency-Key': lifecycle\.getIdempotencyKey\(\)\};/);
  assert.match(source, /if \(action !== 'CONFIGURE'\) lifecycle\.markBusinessIntentChanged\(\);/);
  assert.doesNotMatch(source, /lifecycle\.markBusinessIntentChanged\(\);\s*const headers/);
  assert.match(
    source,
    contentKeyPattern('CATALOG_INVENTORY_OPERATION_IDS', 'updateOperationsInventoryTargetConfiguration'),
  );
});

test('multi-command consumers do not share one lifecycle key across operation ids', () => {
  const publicInvitation = read(
    'apps/frontend/operations-admin/src/features/invitation-acceptance/ui/PublicInvitationEntry.tsx',
  );
  const workspaceCreate = read(
    'apps/frontend/platform-admin/src/features/workspace-management/ui/WorkspaceCreateDrawer.tsx',
  );
  const workspaceEdit = read(
    'apps/frontend/platform-admin/src/features/workspace-management/ui/WorkspaceEditDrawer.tsx',
  );
  const invitationCommands = read(
    'apps/frontend/platform-admin/src/features/workspace-iam/ui/PlatformInvitationPanel.tsx',
  );
  const operationsRecovery = read(
    'apps/frontend/operations-admin/src/features/authentication/ui/OperationsPasswordRecoveryVerifyPage.tsx',
  );
  const operationsPassword = read(
    'apps/frontend/operations-admin/src/features/authentication/ui/OperationsPasswordRecoveryPasswordPage.tsx',
  );
  const platformRecovery = read(
    'apps/frontend/platform-admin/src/features/authentication/ui/PlatformPasswordRecoveryVerifyPage.tsx',
  );
  const platformPassword = read(
    'apps/frontend/platform-admin/src/features/authentication/ui/PlatformPasswordRecoveryPasswordPage.tsx',
  );

  for (const [namespace, operationId, source] of [
    ['PUBLIC_OPERATION_IDS', 'acceptPublicInvitation', publicInvitation],
    ['PUBLIC_OPERATION_IDS', 'verifyPublicInvitationOtp', publicInvitation],
    ['PUBLIC_OPERATION_IDS', 'savePublicInvitationCredentials', publicInvitation],
    ['PUBLIC_OPERATION_IDS', 'completePublicInvitation', publicInvitation],
    ['PLATFORM_ADMIN_OPERATION_IDS', 'stagePlatformAsset', workspaceCreate],
    ['PLATFORM_ADMIN_OPERATION_IDS', 'createPlatformGroupWorkspace', workspaceCreate],
    ['PLATFORM_ADMIN_OPERATION_IDS', 'stagePlatformAsset', workspaceEdit],
    ['PLATFORM_ADMIN_OPERATION_IDS', 'updatePlatformGroupWorkspaceDisplay', workspaceEdit],
    ['PUBLIC_OPERATION_IDS', 'startOperationsPasswordRecovery', operationsRecovery],
    ['PUBLIC_OPERATION_IDS', 'verifyOperationsPasswordRecoveryOtp', operationsRecovery],
    ['PUBLIC_OPERATION_IDS', 'completeOperationsPasswordRecovery', operationsPassword],
    ['PLATFORM_ADMIN_OPERATION_IDS', 'startPlatformPasswordRecovery', platformRecovery],
    ['PLATFORM_ADMIN_OPERATION_IDS', 'verifyPlatformPasswordRecoveryOtp', platformRecovery],
    ['PLATFORM_ADMIN_OPERATION_IDS', 'completePlatformPasswordRecovery', platformPassword],
  ]) {
    assert.match(
      source,
      contentKeyPattern(namespace, operationId),
      `${operationId} must have an operation-scoped content key`,
    );
  }
  assert.match(
    publicInvitation,
    /lifecycle\.markBusinessIntentChanged\(\);\s*return publicClient\.sendPublicInvitationOtp/,
  );
  assert.match(
    invitationCommands,
    /const operationId = kind === 'cancel' \? 'cancelWorkspaceInvitation' : 'reissueWorkspaceInvitation'/,
  );
  assert.match(invitationCommands, /createContentIdempotencyKey\(operationId, payload\)/);
  assert.match(
    operationsRecovery,
    /lifecycle\.markBusinessIntentChanged\(\);\s*const result = await publicClient\.sendOperationsPasswordRecoveryOtp/,
  );
  assert.match(
    platformRecovery,
    /lifecycle\.markBusinessIntentChanged\(\);\s*const result = await platformClient\.sendPlatformPasswordRecoveryOtp/,
  );
  assert.doesNotMatch(publicInvitation, /run\([^\n]*lifecycle\.markBusinessIntentChanged/);
  assert.doesNotMatch(workspaceCreate, /lifecycle\.getIdempotencyKey\(\)/);
  assert.doesNotMatch(workspaceEdit, /lifecycle\.getIdempotencyKey\(\)/);
  assert.doesNotMatch(invitationCommands, /useSubmissionLifecycle|submission\.getIdempotencyKey/);
});

test('the foundation helper rejects binary objects and proves the old direct-UUID pattern is red', () => {
  const helper = read('libraries/frontend/admin-ui-foundation/src/behavior/contentIdempotencyKey.ts');
  assert.match(helper, /Object\.getPrototypeOf\(value\) !== Object\.prototype/);
  assert.match(helper, /\.sort\(\)/);
  const oldPattern = "'Idempotency-Key': globalThis.crypto.randomUUID()";
  assert.throws(
    () => assert.doesNotMatch(`${oldPattern}`, /['"]Idempotency-Key['"]\s*:\s*globalThis\.crypto\.randomUUID\(\)/),
    /expected.*not match/i,
  );
});
