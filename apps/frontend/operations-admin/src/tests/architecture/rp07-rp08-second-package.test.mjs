import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../../../../../');
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const drawerSource = (relative) => readFileSync(path.join(root, 'apps/frontend/operations-admin', relative), 'utf8');
test('RP-08 avoids a private drawer submission state in the brand authorization surface', () => {
  const brand = drawerSource('src/features/business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx');
  assert.doesNotMatch(brand, /\[submitting,\s*setSubmitting\]/);
});

test('RP-07 sends one normalized queryText and never duplicates name/code', () => {
  const adapter = read('apps/frontend/operations-admin/src/features/business-entity-management/application/HeadCompanyBrandAuthorizationActionAdapter.ts');
  assert.match(adapter, /queryText:\s*queryText\?\.trim\(\)\s*\|\|\s*undefined/);
  assert.doesNotMatch(adapter, /name:\s*queryText|code:\s*queryText/);
});
