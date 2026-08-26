import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = relative => readFileSync(path.join(root, relative), 'utf8');
const matrix = JSON.parse(read('contracts/policy/catalog-inventory-reference-path-matrix.json'));

const declaredReferenceIds = Array.from({length: 17}, (_, index) => `R${String(index + 1).padStart(2, '0')}`);
const requiredEntryFields = [
  'id',
  'owner',
  'storage',
  'jsonPath',
  'objectType',
  'sourceLookup',
  'legacyCodePath',
  'readProjection',
  'writeConsumers',
  'copyConsumer',
  'status',
];

test('inventory reference matrix declares every stock target and BOM opaque reference independently', () => {
  const entriesById = new Map(matrix.entries.map(entry => [entry.id, entry]));
  assert.deepEqual(
    matrix.entries.filter(entry => /^R\d{2}$/.test(entry.id)).map(entry => entry.id),
    declaredReferenceIds,
  );

  const expected = {
    R13: ['inventory.stock_target.item_ref', 'CATALOG_ITEM'],
    R14: ['inventory.stock_target.product_sku_ref', 'PRODUCT_SKU'],
    R15: ['inventory.stock_bom.item_ref', 'CATALOG_ITEM'],
    R16: ['inventory.stock_bom.product_sku_ref', 'PRODUCT_SKU'],
    R17: ['inventory.stock_bom.option_value_ref', 'CATALOG_ORDER_OPTION_DEFINITION_VALUE'],
  };
  for (const [id, [storage, objectType]] of Object.entries(expected)) {
    const entry = entriesById.get(id);
    assert.ok(entry, `missing ${id}`);
    assert.equal(entry.storage, storage, `${id} storage`);
    assert.equal(entry.objectType, objectType, `${id} objectType`);
    assert.match(entry.sourceLookup, /data_node_ref\+brand_ref/, `${id} scope axis`);
    for (const field of requiredEntryFields) assert.ok(Object.hasOwn(entry, field), `${id} missing ${field}`);
    assert.equal(entry.status, 'MIGRATE', `${id} keeps historical lineage only`);
  }
  assert.match(entriesById.get('R12').sourceLookup, /kind=ORDER_OPTION_VALUE/);
  assert.match(entriesById.get('R17').sourceLookup, /catalog_order_option_definition_value/);
  assert.doesNotMatch(entriesById.get('R17').sourceLookup, /ORDER_OPTION_VALUE/);
  assert.doesNotMatch(entriesById.get('R06').sourceLookup, /ORDER_OPTION_VALUE/);
  assert.equal(
    matrix.entries.some(
      entry => entry.id >= 'R13' && entry.id <= 'R17' && entry.objectType === 'CATALOG_ITEM_OR_PRODUCT_SKU',
    ),
    false,
  );
});

test('production tag reference entries declare one nullable item relation, not a legacy collection', () => {
  const entriesById = new Map(matrix.entries.map(entry => [entry.id, entry]));
  for (const [id, jsonPath] of [
    ['R07', '/catalogDraft/productionTagRef'],
    ['R11', '/item/productionTagRef'],
  ]) {
    const entry = entriesById.get(id);
    assert.ok(entry, `missing ${id}`);
    assert.equal(entry.objectType, 'PRODUCTION_TAG', `${id} object type`);
    assert.equal(entry.status, 'REPLACE', `${id} replacement state`);
    assert.equal(entry.jsonPath, jsonPath, `${id} singular path`);
    assert.match(entry.storage, /one row per item/, `${id} one relation per item`);
    assert.doesNotMatch(entry.jsonPath, /productionTagRefs/, `${id} rejects the legacy collection path`);
  }
});

test('counterexamples remain outside the declared reference denominator', () => {
  const counterexamples = matrix.entries.filter(entry => /^C\d{2}$/.test(entry.id));
  assert.deepEqual(
    counterexamples.map(entry => entry.id),
    ['C01', 'C02', 'C03'],
  );
  assert.deepEqual(
    counterexamples.map(entry => entry.status),
    ['RETAIN_UUID_COUNTEREXAMPLE', 'RETAIN_UUID_COUNTEREXAMPLE', 'RETAIN_CODE_WITH_REASON'],
  );
  const asset = counterexamples.find(entry => entry.id === 'C01');
  assert.equal(asset.storage, 'catalog.catalog_item_image.asset_ref + catalog.catalog_sku_media.asset_ref');
  assert.equal(asset.jsonPath, null);
});

test('generator admits exactly R01 through R17 and does not absorb counterexamples', () => {
  const generator = read('scripts/generate/catalog-inventory-p1.mjs');
  assert.match(generator, /\^R\(\?:0\[1-9\]\|1\[0-7\]\)\$/);
  assert.match(generator, /\.length !==\s+17\b/);
  assert.doesNotMatch(generator, /1\[0-4\]\)\$\/\.test\(entry\.id\)\)\.length !== 14/);
});

test('the catalog-inventory policy CLI consumes the same R01 through R17 denominator', () => {
  const cli = read('tools/catalog-inventory-p1/cli.mjs');
  assert.match(cli, /\^R\(\?:0\[1-9\]\|1\[0-7\]\)\$/);
  assert.match(
    cli,
    /\["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08", "R09", "R10", "R11", "R12", "R13", "R14", "R15", "R16", "R17"\]/,
  );
  assert.doesNotMatch(cli, /\^R\(\?:0\[1-9\]\|1\[0-4\]\)\$/);
});

test("inventory's typed dependency guard consumes declarations generated from the five matrix paths", () => {
  const declarations = read(
    'apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryCatalogReferenceDeclarations.java',
  );
  const inventoryOwner = read(
    'apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java',
  );
  for (const [objectType, tableName, columnName] of [
    ['CATALOG_ITEM', 'stock_target', 'item_ref'],
    ['CATALOG_ITEM', 'stock_bom', 'item_ref'],
    ['PRODUCT_SKU', 'stock_target', 'product_sku_ref'],
    ['PRODUCT_SKU', 'stock_bom', 'product_sku_ref'],
    ['CATALOG_ORDER_OPTION_DEFINITION_VALUE', 'stock_bom', 'option_value_ref'],
  ]) {
    assert.match(
      declarations,
      new RegExp(`case \\"${objectType}\\"[\\s\\S]*?new Source\\(\\"${tableName}\\", \\"${columnName}\\"\\)`),
    );
  }
  assert.match(inventoryOwner, /InventoryCatalogReferenceDeclarations\.sourcesFor\(objectType\)/);
  assert.doesNotMatch(inventoryOwner, /case "CATALOG_ITEM" -> List\.of\(/);
  assert.doesNotMatch(declarations, /\)\),\s*\n\s*case /, 'generated Java switch cases must not be comma-separated');
  assert.match(
    declarations,
    /case "CATALOG_ITEM" -> List\.of\([\s\S]*?\);/,
    'generated Java switch cases must terminate their expressions',
  );
});
