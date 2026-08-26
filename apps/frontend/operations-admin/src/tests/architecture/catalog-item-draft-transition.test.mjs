import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const editorSession = readFileSync(
  new URL('../../features/catalog-management/model/useCatalogItemEditorSession.ts', import.meta.url),
  'utf8',
);
const workspaceState = readFileSync(
  new URL('../../features/catalog-management/ui/useCatalogItemEditorWorkspaceState.tsx', import.meta.url),
  'utf8',
);

test('catalog item edit transition rehydrates a clean draft without overwriting dirty input', () => {
  assert.match(editorSession, /shouldHydrateCatalogItemDraft\(\{[\s\S]*?dirty,[\s\S]*?forceHydrate/s);
  assert.match(
    workspaceState,
    /const hydration = hydrateDraftFromDetail\(\{activeTab, dirty: lifecycleDirty, createDraftRowId\}\)/,
  );
  assert.match(workspaceState, /if \(hydration\.kind !== 'HYDRATED'\) return;/);
  assert.match(workspaceState, /if \(!itemCode\) \{[\s\S]*replaceDraft\(emptyCatalogItemDraftSnapshot\(\)\)/s);
  assert.doesNotMatch(workspaceState, /setMode\('edit'\)/);
});
