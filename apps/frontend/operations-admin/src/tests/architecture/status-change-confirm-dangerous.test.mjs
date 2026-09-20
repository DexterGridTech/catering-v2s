import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const readRoot = path => readFileSync(new URL(`../../../../../../${path}`, import.meta.url), 'utf8');

const statusConfirmSources = [
  'apps/frontend/operations-admin/src/features/store-service-point/ui/StoreServicePointPage.tsx',
  'apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDetailDrawer.tsx',
  'apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityStatusModal.tsx',
  'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryAtomModals.tsx',
  'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemViewDrawer.tsx',
  'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogBatchActionModal.tsx',
  'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDefinitionLibraries.tsx',
  'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogCategoryActionModal.tsx',
  'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemEditorWorkspace.tsx',
  'apps/frontend/operations-admin/src/features/organization-structure/ui/OrganizationStatusModal.tsx',
  'apps/frontend/operations-admin/src/features/store-management/ui/StoreStatusModal.tsx',
  'apps/frontend/platform-admin/src/features/external-collaboration/ui/ExternalSystemDetail.tsx',
  'apps/frontend/platform-admin/src/features/external-collaboration/ui/ProviderProfileDetail.tsx',
  'apps/frontend/platform-admin/src/features/platform-administration/ui/AdministratorStatusModal.tsx',
  'apps/frontend/platform-admin/src/features/platform-administration/ui/AdministratorDetailDrawer.tsx',
  'apps/frontend/platform-admin/src/features/workspace-iam/ui/RoleStatusModal.tsx',
  'apps/frontend/platform-admin/src/features/workspace-iam/ui/WorkspaceAccountActionModal.tsx',
  'apps/frontend/platform-admin/src/features/workspace-management/ui/WorkspaceStatusModal.tsx',
].map(path => [path, readRoot(path)]);

test('status confirmations reserve danger styling for irreversible voiding', () => {
  const dangerousExpressions = statusConfirmSources.flatMap(([path, source]) =>
    [...source.matchAll(/dangerous=\{([^}]+)\}/g)].map(match => ({path, expression: match[1]})),
  );

  assert.ok(dangerousExpressions.length > 0, 'status confirmation consumers must declare their danger semantics');
  for (const {path, expression} of dangerousExpressions) {
    assert.match(
      expression,
      /VOIDED|pendingVoidSku|action\?\.mode === 'DELETE'/,
      `${path} must derive danger from a void-only action`,
    );
    assert.doesNotMatch(
      expression,
      /DISABLED|停用|!==\s*['"](?:ENABLED|启用)['"]/,
      `${path} marks reversible stop as dangerous`,
    );
  }
  for (const [path, source] of statusConfirmSources) {
    assert.doesNotMatch(source, /\bdangerous\s*(?:\r?\n\s*|,|\/>)/, `${path} uses a bare dangerous prop`);
  }
});
