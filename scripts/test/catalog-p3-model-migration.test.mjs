import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migration = readFileSync(path.join(root, 'apps/backend/catering-business-server/src/main/resources/db/migration/V20260814_100000_000__catalog_p3_model.sql'), 'utf8');
const catalogOwner = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java'), 'utf8');
const itemReferenceFacts = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemReferenceFacts.java'), 'utf8');
const itemMediaFacts = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemMediaFacts.java'), 'utf8');
const skuMediaFacts = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogSkuMediaFacts.java'), 'utf8');
const designCoverage = readFileSync(path.join(root, 'contracts/policy/catalog-inventory-design-byte-coverage.json'), 'utf8');
const openApi = readFileSync(path.join(root, 'contracts/openapi/catalog-inventory.openapi.yaml'), 'utf8');
const generator = readFileSync(path.join(root, 'scripts/generate/catalog-inventory-p1.mjs'), 'utf8');
const designCoverageJson = JSON.parse(designCoverage);
const openApiJson = JSON.parse(openApi);

test('P3 catalog model migration contains relational source-of-truth constraints only', () => {
  for (const table of [
    'catalog.catalog_sku', 'catalog.catalog_sku_attribute_value', 'catalog.catalog_item_category',
    'catalog.catalog_composite_group', 'catalog.catalog_composite_component', 'catalog.catalog_item_reference',
    'catalog.catalog_item_image', 'catalog.catalog_sku_media',
    'catalog.catalog_sku_variant_axis', 'catalog.catalog_sku_variant_axis_value',
  ]) assert.match(migration, new RegExp(`CREATE TABLE ${table.replace('.', '\\.')}`));

  assert.match(migration, /PRIMARY KEY \(product_sku_ref, attribute_ref\)/);
  assert.match(migration, /UNIQUE \(item_ref, sku_code\)/);
  assert.match(migration, /ux_catalog_sku_default_per_item[\s\S]*WHERE is_default AND status <> 'ARCHIVED'/);
  assert.match(migration, /ux_catalog_sku_variant_digest_per_item[\s\S]*WHERE status <> 'ARCHIVED'/);
  assert.match(migration, /PRIMARY KEY \(item_ref, category_ref\)/);
  assert.match(migration, /CHECK \(max_selections >= min_selections\)/);
  assert.match(migration, /PRIMARY KEY \(item_ref, kind, ref\)/);
  assert.match(migration, /CREATE TABLE catalog\.catalog_item_image/);
  assert.match(migration, /CREATE TABLE catalog\.catalog_sku_media/);
  assert.match(migration, /UNIQUE \(item_ref, asset_ref\)/);
  assert.match(migration, /UNIQUE \(product_sku_ref, asset_ref\)/);
  assert.doesNotMatch(migration, /ORDER_OPTION_ATTRIBUTE_VALUE/);
  assert.match(migration, /UNIQUE \(item_ref, attribute_ref\)/);
  assert.match(migration, /PRIMARY KEY \(sku_variant_axis_ref, value_ref\)/);
  assert.doesNotMatch(migration, /\b(?:INSERT INTO|UPDATE|DELETE FROM|DO \$\$|ALTER TABLE catalog\.catalog_item)\b/);
});

test('P3 keeps only unordered item-owned sets in the shared reference table', () => {
  const allowedKinds = migration.match(/CHECK \(kind IN \(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'\s*\)\)/s);
  assert.ok(allowedKinds);
  assert.deepEqual(allowedKinds.slice(1), ['PRODUCTION_TAG', 'CATALOG_TAG', 'SALES_UNIT']);
  assert.match(itemReferenceFacts, /private static final List<String> KINDS = List\.of\(PRODUCTION_TAG, CATALOG_TAG, SALES_UNIT\);/);
  assert.doesNotMatch(itemReferenceFacts, /ITEM_IMAGE|SKU_MEDIA|ORDER_OPTION_ATTRIBUTE_VALUE/);
  assert.match(itemMediaFacts, /catalog\.catalog_item_image/);
  assert.match(skuMediaFacts, /catalog\.catalog_sku_media/);
  assert.match(itemMediaFacts, /ORDER BY item_ref,display_order,asset_ref/);
  assert.match(skuMediaFacts, /ORDER BY product_sku_ref,display_order,asset_ref/);
});

test('P3 retires the redundant governance status dimension from the owner and contract', () => {
  assert.doesNotMatch(catalogOwner, /optional\(request, "governanceStatus"\)|\.put\("governanceStatus"/);
  assert.doesNotMatch(catalogOwner, /GOVERNANCE_PENDING|GOVERNANCE_TODO/);
  assert.doesNotMatch(designCoverage, /governanceStatus/);
  assert.doesNotMatch(openApi, /governanceStatus|GOVERNANCE_PENDING/);
});

test('P3 no longer publishes the non-existent PRINT_NAME local-copy section', () => {
  const preflight = openApiJson.components.schemas.LocalCopyPreflightRequest.properties.selectedSections.items.enum;
  const execute = openApiJson.components.schemas.LocalCopyExecuteRequest.properties.selectedSections.items.enum;
  assert.equal(preflight.includes('PRINT_NAME'), false);
  assert.equal(execute.includes('PRINT_NAME'), false);
  assert.doesNotMatch(catalogOwner, /case "PRINT_NAME"/);
});

test('P3 SKU digest is read-only contract data and SKU ordering is preserved on the wire', () => {
  const detailCoverage = designCoverageJson.rows.find((row) => row.model === 'CatalogItemDetail');
  const saveCoverage = designCoverageJson.requestRows.find((row) => row.model === 'CatalogItemSaveRequest');
  assert.ok(detailCoverage);
  assert.ok(saveCoverage);
  assert.equal(detailCoverage.fields.some((field) => field.path === 'item.skus[].displayOrder'), true);
  assert.equal(detailCoverage.fields.some((field) => field.path === 'item.skus[].variantCombinationDigest'), true);
  assert.equal(saveCoverage.fields.some((field) => field.path === 'sections.catalogDraft.skus[].displayOrder'), true);
  assert.equal(saveCoverage.fields.some((field) => field.path === 'sections.catalogDraft.skus[].variantCombinationDigest'), false);

  const detailSku = openApiJson.components.schemas.CatalogItemDetail.properties.data.properties.item.properties.skus.items;
  const saveSku = openApiJson.components.schemas.CatalogItemSaveRequest.properties.sections.properties.catalogDraft.properties.skus.items;
  assert.equal(detailSku.properties.displayOrder.type, 'integer');
  assert.equal(detailSku.properties.variantCombinationDigest.type, 'string');
  assert.equal(saveSku.properties.displayOrder.type, 'integer');
  assert.equal(Object.hasOwn(saveSku.properties, 'variantCombinationDigest'), false);
  assert.equal(saveSku.additionalProperties, false);
});

test('P3 derived catalog facts are response-only and shape-owned', () => {
  const saveCoverage = designCoverageJson.requestRows.find((row) => row.model === 'CatalogItemSaveRequest');
  assert.ok(saveCoverage);
  for (const pathValue of [
    'sections.catalogDraft.priceGranularity',
    'sections.catalogDraft.missingPriceCount',
    'sections.catalogDraft.listedSalePrice',
    'sections.catalogDraft.skus[].version',
  ]) assert.equal(saveCoverage.fields.some((field) => field.path === pathValue), false, pathValue);

  const saveDraft = openApiJson.components.schemas.CatalogItemSaveRequest.properties.sections.properties.catalogDraft;
  const saveSku = saveDraft.properties.skus.items;
  assert.equal(Object.hasOwn(saveDraft.properties, 'ordering'), false);
  assert.equal(Object.hasOwn(saveDraft.properties, 'listedSalePrice'), false);
  assert.equal(Object.hasOwn(saveDraft.properties, 'standardSalePrice'), true);
  assert.equal(Object.hasOwn(saveSku.properties, 'version'), false);
  assert.doesNotMatch(catalogOwner, /applyDerivedCatalogFacts|sections\.putObject\("skuSummary"\)|sections\.put\("missingPriceCount"/);
  assert.match(catalogOwner, /new DerivedSkuFacts\(/);
});

test('P3 derives the smart-view wire vocabulary and exposes dictionary entry identity', () => {
  const pageQuery = designCoverageJson.requestRows.find((row) => row.model === 'CatalogItemPageQuery');
  const dictionary = designCoverageJson.rows.find((row) => row.model === 'CatalogDictionaryView');
  assert.ok(pageQuery);
  assert.ok(dictionary);

  const smartViewKey = pageQuery.fields.find((field) => field.path === 'smartViewKey');
  assert.deepEqual(smartViewKey, {
    path: 'smartViewKey', type: 'string', enumSource: 'smartViewKey', required: false,
  });
  assert.equal(dictionary.fields.some((field) => field.path === 'data.entries[].entryRef' && field.format === 'uuid'), true);
  assert.match(generator, /if \(spec\.enumSource\) schema\.enum = enumValues\(spec\.enumSource\);/);

  const querySchema = openApiJson.components.schemas.CatalogItemPageQuery;
  assert.deepEqual(querySchema.properties.smartViewKey.enum, [
    'ALL', 'EXTERNAL_ORDER_TEMP', 'INACTIVE', 'ARCHIVED', 'RECENTLY_UPDATED', 'AUTO_SYNC',
  ]);
  const entrySchema = openApiJson.components.schemas.CatalogDictionaryView.properties.data.properties.entries.items;
  assert.equal(entrySchema.properties.entryRef.format, 'uuid');
});

test('P3 item detail returns the complete candidate scope for SKU pickers', () => {
  const detailCoverage = designCoverageJson.rows.find((row) => row.model === 'CatalogItemDetail');
  assert.ok(detailCoverage);
  assert.equal(detailCoverage.fields.some((field) => field.path === 'queryIdentity.brandRef' && field.type === 'string'), true);
  const queryIdentity = openApiJson.components.schemas.CatalogItemDetail.properties.data.properties.queryIdentity;
  assert.equal(queryIdentity.properties.brandRef.type, 'string');
  assert.match(catalogOwner, /data\.putObject\("queryIdentity"\)\.put\("dataNodeRef", dataNodeRef\)\.put\("brandRef", brandRef\)/);
});
