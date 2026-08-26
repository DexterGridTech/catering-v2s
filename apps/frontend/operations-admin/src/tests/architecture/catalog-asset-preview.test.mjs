import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const preview = readFileSync(
  new URL('../../features/catalog-management/ui/CatalogAssetPreview.tsx', import.meta.url),
  'utf8',
);
const basicEditor = readFileSync(
  new URL('../../features/catalog-management/ui/CatalogItemBasicEditor.tsx', import.meta.url),
  'utf8',
);
const skuMatrix = readFileSync(
  new URL('../../features/catalog-management/ui/CatalogItemSkuMatrixTable.tsx', import.meta.url),
  'utf8',
);
const editorSession = readFileSync(
  new URL('../../features/catalog-management/model/useCatalogItemEditorSession.ts', import.meta.url),
  'utf8',
);
const mediaActions = readFileSync(
  new URL('../../features/catalog-management/ui/useCatalogItemEditorMediaActions.ts', import.meta.url),
  'utf8',
);

test('catalog previews staged files locally and only asks the public asset endpoint for saved assets', () => {
  assert.match(preview, /localFile\?: File/);
  assert.match(preview, /URL\.createObjectURL\(localFile\)/);
  assert.match(preview, /URL\.revokeObjectURL\(url\)/);
  assert.match(preview, /assetRef \? publicRtkRequest\.getPublicAssetContent/);
  assert.match(preview, /skip: Boolean\(localFile \|\| !assetRef \|\| !request\)/);
  assert.doesNotMatch(preview, /wireUuid\(assetRef \?\? ''\)/);
  assert.match(preview, /const sourceUrl = localPreviewUrl \?\? publicUrl/);
  assert.match(basicEditor, /localFile=\{asset\.staged \? asset\.file : undefined\}/);
  assert.match(basicEditor, /: asset\.staged\s+\? '待保存'/);
  assert.match(editorSession, /const stageStagedAsset = useCallback/);
  assert.match(editorSession, /if \(!readback\?\.assetRef \|\| !readback\.bindGrant\)/);
  assert.match(mediaActions, /stageStagedAsset\(\{file, correlationId: itemCode\}\)/);
  assert.match(mediaActions, /bindGrant: readback\.bindGrant,[\s\S]*fileName: file\.name/s);
});

test('catalog SKU drafts also render the selected local file before the save boundary', () => {
  assert.match(skuMatrix, /localFile=\{stagedAsset\.file\}/);
  assert.match(skuMatrix, /待上传图片/);
});
