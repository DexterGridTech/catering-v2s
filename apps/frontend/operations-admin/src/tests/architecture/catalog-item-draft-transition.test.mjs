import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const drawer = readFileSync(
  new URL('../../features/catalog-management/ui/CatalogItemDrawer.tsx', import.meta.url),
  'utf8',
);

test('catalog item edit transition rehydrates a clean draft without overwriting dirty input', () => {
  const hydrationEffect = drawer.slice(
    drawer.indexOf('const shouldHydrate = shouldHydrateCatalogItemDraft'),
    drawer.indexOf(
      'useEffect(() => {\n    if (!(problem',
      drawer.indexOf('const shouldHydrate = shouldHydrateCatalogItemDraft'),
    ),
  );
  assert.match(hydrationEffect, /lifecycle\.dirty/);
  assert.match(hydrationEffect, /\[createDraftRowId, detail, form, lifecycle, mode, normalizeSkuDraftRows\]/);

  const editTransition = drawer.slice(
    drawer.indexOf('A read-only session has no user-owned draft.'),
    drawer.indexOf("setMode('edit');", drawer.indexOf('A read-only session has no user-owned draft.')) + 16,
  );
  assert.match(editTransition, /if \(!lifecycle\.dirty\) initializedDraftItem\.current = undefined/);
  assert.match(editTransition, /setMode\('edit'\)/);
});
