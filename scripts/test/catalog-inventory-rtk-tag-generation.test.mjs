import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const generator = path.join(root, 'scripts/generate/catalog-inventory-p3-frontend.mjs');

test('catalog-inventory generator rejects red tag-policy mutations', () => {
  const result = spawnSync(process.execPath, [generator, '--self-test'], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  for (const marker of [
    'CATALOG_INVENTORY_P3_RTK_TAG_RED_MUTATIONS=PASS',
    'RED_MISSING_PROVIDER=PASS',
    'RED_UNRELATED_INVALIDATION=PASS',
    'RED_ITEM_REFERENCE_TAG=PASS',
    'RED_PRODUCTION_TAG_REFERENCE_PROVIDER=PASS',
    'RED_PRODUCTION_TAG_REFERENCE_INVALIDATION=PASS',
    'RED_TARGET_REFERENCE_TAG=PASS',
    'RED_COPY_ITEM_REFERENCE_TAG=PASS',
  ])
    assert.match(result.stdout, new RegExp(marker));
});
