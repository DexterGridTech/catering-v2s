import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const preview = readFileSync(
  new URL('../../features/catalog-management/ui/CatalogAssetPreview.tsx', import.meta.url),
  'utf8',
);
const itemDrawer = readFileSync(
  new URL('../../features/catalog-management/ui/CatalogItemDrawer.tsx', import.meta.url),
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
  assert.match(itemDrawer, /localFile=\{asset\.staged \? asset\.file : undefined\}/);
  assert.match(itemDrawer, /asset\.staged\s*\n\s*\? '待保存'/);
  const productStage = itemDrawer.slice(
    itemDrawer.indexOf('const stageMedia'),
    itemDrawer.indexOf('const stageSkuMedia'),
  );
  assert.match(productStage, /bindGrant: readback\.bindGrant,[\s\S]*?\n\s*file,[\s\S]*?\n\s*fileName: file\.name/);
});

test('catalog SKU drafts also render the selected local file before the save boundary', () => {
  assert.match(itemDrawer, /localFile=\{asset\.file\}/);
  assert.match(itemDrawer, /待上传图片/);
});
