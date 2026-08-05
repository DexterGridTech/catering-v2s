import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../../../../../');
const formDrawers = [
  'src/features/business-entity-management/ui/BusinessEntityCreateDrawer.tsx',
  'src/features/business-entity-management/ui/BusinessEntityEditDrawer.tsx',
  'src/features/business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx',
  'src/features/organization-structure/ui/RegionCreateDrawer.tsx',
  'src/features/organization-structure/ui/ProjectCreateDrawer.tsx',
  'src/features/organization-structure/ui/OrganizationEditDrawer.tsx',
  'src/features/organization-structure/ui/CommercialGroupEditDrawer.tsx',
  'src/features/contract-management/ui/ContractCreateDrawer.tsx',
  'src/features/contract-management/ui/ContractEditDrawer.tsx',
  'src/features/store-management/ui/StoreCreateDrawer.tsx',
  'src/features/store-management/ui/StoreEditDrawer.tsx',
  'src/features/workspace-user/ui/WorkspaceInvitationCreateDrawer.tsx',
  'src/features/authentication/ui/OperationsPasswordChangeDrawer.tsx',
];
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const drawerSource = (relative) => readFileSync(path.join(root, 'apps/frontend/operations-admin', relative), 'utf8');
const assertDrawerContract = (source, relative) => {
  assert.match(source, /maskClosable=\{!lifecycle\.submitting\}/, relative);
  assert.match(source, /closable=\{!lifecycle\.submitting\}/, relative);
  assert.match(source, /keyboard=\{!lifecycle\.submitting\}/, relative);
  assert.match(source, /onClose=\{lifecycle\.requestClose\}/, relative);
  assert.match(source, /disabled=\{lifecycle\.submitting\}/, relative);
};

test('RP-08 exact FORM_DRAWER denominator binds every close path to lifecycle submitting', () => {
  for (const relative of formDrawers) assertDrawerContract(drawerSource(relative), relative);
  const brand = drawerSource('src/features/business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx');
  assert.doesNotMatch(brand, /\[submitting,\s*setSubmitting\]/);
});

test('RP-08 red mutation removing mask binding is detected', () => {
  const source = drawerSource(formDrawers[0]);
  const mutated = source.replace('maskClosable={!lifecycle.submitting}', 'maskClosable');
  assert.notEqual(mutated, source);
  assert.doesNotMatch(mutated, /maskClosable=\{!lifecycle\.submitting\}/);
});

test('RP-07 sends one normalized queryText and never duplicates name/code', () => {
  const adapter = read('apps/frontend/operations-admin/src/features/business-entity-management/application/HeadCompanyBrandAuthorizationActionAdapter.ts');
  assert.match(adapter, /queryText:\s*queryText\?\.trim\(\)\s*\|\|\s*undefined/);
  assert.doesNotMatch(adapter, /name:\s*queryText|code:\s*queryText/);
});
