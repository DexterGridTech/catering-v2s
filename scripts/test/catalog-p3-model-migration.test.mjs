import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {readCatalogInventoryOpenApi} from '../lib/catalog-inventory-openapi.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const historicalP3Migration = readFileSync(path.join(root, 'apps/backend/catering-business-server/src/main/resources/db/migration/V20260814_100000_000__catalog_p3_model.sql'), 'utf8');
const base1LifecycleMigration = readFileSync(path.join(root, 'apps/backend/catering-business-server/src/main/resources/db/migration/V20260827_010000_000__base1_three_state_lifecycle.sql'), 'utf8');
const unitModelMigration = readFileSync(path.join(root, 'apps/backend/catering-business-server/src/main/resources/db/migration/V20260821_090000_000__catalog_inventory_unit_model.sql'), 'utf8');
const inventoryIdentityMigration = readFileSync(path.join(root, 'apps/backend/catering-business-server/src/main/resources/db/migration/V20260808_160000_000__inventory_opaque_catalog_identity_refs.sql'), 'utf8');
const itemCodeReleaseMigration = readFileSync(path.join(root, 'apps/backend/catering-business-server/src/main/resources/db/migration/V20260815_010000_000__catalog_voided_item_code_release.sql'), 'utf8');
const skuCodeReleaseMigration = readFileSync(path.join(root, 'apps/backend/catering-business-server/src/main/resources/db/migration/V20260816_020000_000__catalog_sku_voided_code_release.sql'), 'utf8');
const dictionaryTagReleaseMigration = readFileSync(path.join(root, 'apps/backend/catering-business-server/src/main/resources/db/migration/V20260816_030000_000__catalog_dictionary_tag_voided_code_release.sql'), 'utf8');
const deadIndexMigration = readFileSync(path.join(root, 'apps/backend/catering-business-server/src/main/resources/db/migration/V20260816_040000_000__remove_unusable_stock_bom_option_value_index.sql'), 'utf8');
const dictionaryMigration = readFileSync(path.join(root, 'apps/backend/catering-business-server/src/main/resources/db/migration/V20260816_010000_000__catalog_dictionary_attribute_parent_and_order_option_kind.sql'), 'utf8');
const catalogOwner = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java'), 'utf8');
const catalogDictionaryService = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogDictionaryService.java'), 'utf8');
const catalogDictionaryPersistence = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogDictionaryPersistence.java'), 'utf8');
const catalogDictionaryServiceSql = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogDictionaryServiceSql.java'), 'utf8');
const catalogCopyService = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogCopyService.java'), 'utf8');
const catalogCopyPersistence = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogCopyPersistence.java'), 'utf8');
const catalogCopyServiceSql = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogCopyServiceSql.java'), 'utf8');
const catalogItemService = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemService.java'), 'utf8');
const productionTagOwner = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/ProductionTagOwnerService.java'), 'utf8');
const productionTagServiceSql = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/persistence/ProductionTagOwnerServiceSql.java'), 'utf8');
const platformAuthentication = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/platform-admin-iam/src/main/java/com/catering/v2s/platform/iam/application/PlatformAuthenticationService.java'), 'utf8');
const platformAuthenticationServiceSql = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/platform-admin-iam/src/main/java/com/catering/v2s/platform/iam/application/persistence/PlatformAuthenticationServiceSql.java'), 'utf8');
const inventoryOwner = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java'), 'utf8');
const itemReferenceFacts = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemReferenceFacts.java'), 'utf8');
const itemReferencePersistence = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogItemReferenceFacts.java'), 'utf8');
const catalogOwnerValueSupport = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerValueSupport.java'), 'utf8');
const itemMediaFacts = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemMediaFacts.java'), 'utf8');
const skuMediaFacts = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogSkuMediaFacts.java'), 'utf8');
const itemMediaPersistence = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogItemMediaFacts.java'), 'utf8');
const skuMediaPersistence = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogSkuMediaFacts.java'), 'utf8');
const itemMediaSql = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogItemMediaFactsSql.java'), 'utf8');
const skuMediaSql = readFileSync(path.join(root, 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogSkuMediaFactsSql.java'), 'utf8');
const designCoverage = readFileSync(path.join(root, 'contracts/policy/catalog-inventory-design-byte-coverage.json'), 'utf8');
const generator = readFileSync(path.join(root, 'scripts/generate/catalog-inventory-p1.mjs'), 'utf8');
const designCoverageJson = JSON.parse(designCoverage);
const openApiRootDocument = JSON.parse(readFileSync(path.join(root, 'contracts/openapi/catalog-inventory.openapi.json'), 'utf8'));
const openApiJson = readCatalogInventoryOpenApi(root);
const openApi = JSON.stringify(openApiJson);
const normalizeJavaSource = source => source.replace(/"\s*\+\s*"/g, '').replace(/\s+/g, ' ');
const normalizedCatalogOwner = normalizeJavaSource(catalogOwner);
const normalizedCatalogDictionaryService = normalizeJavaSource(catalogDictionaryService);
const normalizedCatalogItemService = normalizeJavaSource(catalogItemService);
const normalizedProductionTagOwner = normalizeJavaSource(productionTagOwner);
const normalizedProductionTagServiceSql = normalizeJavaSource(productionTagServiceSql);
const normalizedPlatformAuthentication = normalizeJavaSource(platformAuthentication);
const normalizedPlatformAuthenticationServiceSql = normalizeJavaSource(platformAuthenticationServiceSql);

test('catalog inventory root OpenAPI declares its generated projection boundary', () => {
  assert.equal(openApiRootDocument['x-v2s-generated'], true);
  assert.equal(openApiRootDocument['x-v2s-do-not-edit'], true);
  assert.equal(openApiRootDocument['x-v2s-generated-from'], 'contracts/catalog/catalog-inventory-edge-placement.json and its declared JSON shards');
  assert.deepEqual(openApiRootDocument, openApiJson);
});

test('historical P3 catalog model migration retains its immutable relational source-of-truth constraints', () => {
  for (const table of [
    'catalog.catalog_sku', 'catalog.catalog_sku_attribute_value', 'catalog.catalog_item_category',
    'catalog.catalog_composite_group', 'catalog.catalog_composite_component', 'catalog.catalog_item_reference',
    'catalog.catalog_item_image', 'catalog.catalog_sku_media',
    'catalog.catalog_sku_variant_axis', 'catalog.catalog_sku_variant_axis_value',
  ]) assert.match(historicalP3Migration, new RegExp(`CREATE TABLE ${table.replace('.', '\\.')}`));

  assert.match(historicalP3Migration, /PRIMARY KEY \(product_sku_ref, attribute_ref\)/);
  assert.match(historicalP3Migration, /UNIQUE \(item_ref, sku_code\)/);
  assert.match(historicalP3Migration, /ux_catalog_sku_default_per_item[\s\S]*WHERE is_default AND status <> 'ARCHIVED'/);
  assert.match(historicalP3Migration, /ux_catalog_sku_variant_digest_per_item[\s\S]*WHERE status <> 'ARCHIVED'/);
  assert.match(historicalP3Migration, /PRIMARY KEY \(item_ref, category_ref\)/);
  assert.match(historicalP3Migration, /CHECK \(max_selections >= min_selections\)/);
  assert.match(historicalP3Migration, /PRIMARY KEY \(item_ref, kind, ref\)/);
  assert.match(historicalP3Migration, /CREATE TABLE catalog\.catalog_item_image/);
  assert.match(historicalP3Migration, /CREATE TABLE catalog\.catalog_sku_media/);
  assert.match(historicalP3Migration, /UNIQUE \(item_ref, asset_ref\)/);
  assert.match(historicalP3Migration, /UNIQUE \(product_sku_ref, asset_ref\)/);
  assert.doesNotMatch(historicalP3Migration, /ORDER_OPTION_ATTRIBUTE_VALUE/);
  assert.match(historicalP3Migration, /UNIQUE \(item_ref, attribute_ref\)/);
  assert.match(historicalP3Migration, /PRIMARY KEY \(sku_variant_axis_ref, value_ref\)/);
  assert.doesNotMatch(historicalP3Migration, /\b(?:INSERT INTO|UPDATE|DELETE FROM|DO \$\$|ALTER TABLE catalog\.catalog_item)\b/);
});

test('base1 lifecycle migration converges catalog rows and uniqueness predicates to the three-state model', () => {
  assert.match(base1LifecycleMigration, /WHEN 'DRAFT' THEN 'DISABLED'/);
  assert.match(base1LifecycleMigration, /WHEN 'ARCHIVED' THEN 'VOIDED'/);
  assert.match(base1LifecycleMigration, /ALTER COLUMN status DROP DEFAULT/);
  assert.match(base1LifecycleMigration, /ADD CONSTRAINT catalog_item_status_check[\s\S]*CHECK \(status IN \('ENABLED', 'DISABLED', 'VOIDED'\)\)/);
  assert.match(base1LifecycleMigration, /ADD CONSTRAINT catalog_sku_status_check[\s\S]*CHECK \(status IN \('ENABLED', 'DISABLED', 'VOIDED'\)\)/);
  assert.match(base1LifecycleMigration, /ux_catalog_sku_default_per_item[\s\S]*WHERE is_default AND status <> 'VOIDED'/);
  assert.match(base1LifecycleMigration, /ux_catalog_sku_variant_digest_per_item[\s\S]*WHERE status <> 'VOIDED'/);
});

test('inventory identity migration names legacy constraints explicitly and fails when they are absent', () => {
  assert.match(inventoryIdentityMigration, /DROP CONSTRAINT stock_target_data_node_ref_brand_ref_item_code_sku_code_key;/);
  assert.match(inventoryIdentityMigration, /DROP CONSTRAINT stock_bom_data_node_ref_brand_ref_item_code_sku_code_key;/);
  assert.doesNotMatch(inventoryIdentityMigration, /DROP CONSTRAINT IF EXISTS stock_(?:target|bom)_data_node_ref_brand_ref_item_code_sku_code_key/);
});

test('voided item and SKU code releases fail when named legacy constraints are absent', () => {
  assert.match(itemCodeReleaseMigration, /DROP CONSTRAINT catalog_item_data_node_ref_brand_ref_code_key;/);
  assert.doesNotMatch(itemCodeReleaseMigration, /DROP CONSTRAINT IF EXISTS catalog_item_data_node_ref_brand_ref_code_key/);
  assert.match(skuCodeReleaseMigration, /DROP CONSTRAINT catalog_sku_status_check;/);
  assert.match(skuCodeReleaseMigration, /DROP CONSTRAINT catalog_sku_item_ref_sku_code_key;/);
  assert.doesNotMatch(skuCodeReleaseMigration, /DROP CONSTRAINT IF EXISTS catalog_sku_(?:status_check|item_ref_sku_code_key)/);
});

test('dictionary and production-tag codes are reusable only after VOIDED while lists retain voided rows', () => {
  assert.match(dictionaryTagReleaseMigration, /DROP CONSTRAINT dictionary_entry_data_node_ref_brand_ref_dictionary_kind_co_key;/);
  assert.match(dictionaryTagReleaseMigration, /CREATE UNIQUE INDEX ux_catalog_dictionary_active_code[\s\S]*WHERE status <> 'VOIDED';/);
  assert.match(dictionaryTagReleaseMigration, /DROP CONSTRAINT production_tag_definition_data_node_ref_brand_ref_code_key;/);
  assert.match(dictionaryTagReleaseMigration, /CREATE UNIQUE INDEX ux_production_tag_active_code[\s\S]*WHERE status <> 'VOIDED';/);
  assert.match(catalogCopyServiceSql, /CATALOG_COPY_SERVICE_OPEN_PAREN_ON_CONFLICT\s*=\s*"[^\n]*ON CONFLICT "/);
  assert.match(catalogCopyServiceSql, /CATALOG_COPY_SERVICE_OPEN_PAREN_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND_CODE\s*=\s*"[^\n]*WHERE status <> 'VOIDED' DO "/);
  assert.match(catalogCopyServiceSql, /CATALOG_COPY_SERVICE_CONTINUATION\s*=\s*"NOTHING"/);
  assert.match(catalogCopyPersistence, /OPEN_PAREN_ON_CONFLICT[\s\S]*OPEN_PAREN_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND_CODE[\s\S]*CONTINUATION/);
  const dictionaryListing = catalogDictionaryService.match(/private DictionaryListing loadDictionaryListing\([\s\S]*?\n    private Set<UUID> relationalSkuDictionaryReferences/)?.[0] ?? '';
  assert.notEqual(dictionaryListing, '');
  assert.doesNotMatch(dictionaryListing, /status\s*<>\s*'VOIDED'/);
  const tagListing = normalizedProductionTagOwner.match(/public JsonNode readTags\([\s\S]*?return envelope\(requestId, data\); \}/)?.[0] ?? '';
  assert.notEqual(tagListing, '');
  assert.doesNotMatch(tagListing, /status\s*<>\s*'VOIDED'/);
});

test('only the stock BOM partial index without a matching production predicate is retired', () => {
  assert.match(deadIndexMigration, /DROP INDEX inventory\.ix_stock_bom_option_value;/);
  assert.match(normalizedProductionTagServiceSql, /FROM fulfillment_production\.production_tag_definition WHERE data_node_ref=\? AND brand_ref=\?/);
  assert.match(normalizedProductionTagServiceSql, /ORDER BY code NULLS LAST,\s*tag_ref LIMIT \?/);
  assert.match(normalizedPlatformAuthenticationServiceSql, /FROM platform_iam\.platform_password_recovery_flow WHERE token_hash=\? FOR UPDATE/);
  assert.doesNotMatch(inventoryOwner, /stock_bom[\s\S]{0,240}option_value_code\s+IS\s+NOT\s+NULL/);
});

test('P3 keeps only unordered item-owned sets in the shared reference table', () => {
  const allowedKinds = unitModelMigration.match(/CHECK \(kind IN \(\s*'([^']+)',\s*'([^']+)'\s*\)\)/s);
  assert.ok(allowedKinds);
  assert.deepEqual(allowedKinds.slice(1), ['PRODUCTION_TAG', 'CATALOG_TAG']);
  assert.match(unitModelMigration, /DELETE FROM catalog\.catalog_item_reference WHERE kind='SALES_UNIT';/);
  assert.match(itemReferencePersistence, /private static final List<String> KINDS = List\.of\(PRODUCTION_TAG, CATALOG_TAG\);/);
  assert.doesNotMatch(itemReferenceFacts, /ITEM_IMAGE|SKU_MEDIA|ORDER_OPTION_ATTRIBUTE_VALUE/);
  assert.match(itemMediaSql, /catalog\.catalog_item_image/);
  assert.match(skuMediaSql, /catalog\.catalog_sku_media/);
  assert.match(itemMediaSql, /ORDER BY item_ref,display_order,asset_ref/);
  assert.match(skuMediaSql, /ORDER BY product_sku_ref,display_order,asset_ref/);
});

test('C1-2 separates option values and enforces parent ownership at the database boundary', () => {
  assert.match(dictionaryMigration, /ADD COLUMN IF NOT EXISTS parent_entry_ref UUID/);
  assert.match(dictionaryMigration, /SET dictionary_kind = 'ORDER_OPTION_VALUE'/);
  assert.match(dictionaryMigration, /CHECK \(\(dictionary_kind = 'SKU_ATTRIBUTE_VALUE'\) = \(parent_entry_ref IS NOT NULL\)\)/);
  assert.match(dictionaryMigration, /FOREIGN KEY \(parent_entry_ref, data_node_ref, brand_ref\)/);
  assert.match(dictionaryMigration, /CATALOG_DICTIONARY_UNCLASSIFIED_VALUE_EXISTS/);
  assert.match(dictionaryMigration, /CATALOG_DICTIONARY_VALUE_HAS_MULTIPLE_ATTRIBUTE_PARENTS/);
  assert.match(dictionaryMigration, /trg_catalog_sku_attribute_value_relation/);
  assert.match(dictionaryMigration, /trg_catalog_sku_variant_axis_value_relation/);
  assert.match(dictionaryMigration, /trg_catalog_order_option_value_relation/);
  assert.match(normalizedCatalogDictionaryService, /parentEntryRef/);
  assert.match(normalizedCatalogDictionaryService, /"SKU_ATTRIBUTE_VALUE"\.equals\(kind\)/);
  assert.match(catalogOwnerValueSupport, /case "ORDER_OPTION_VALUE" -> "SKU_ATTRIBUTE_VALUE"/);
  assert.match(catalogCopyService, /case "TAG", "SKU_ATTRIBUTE", "SKU_ATTRIBUTE_VALUE", "ORDER_OPTION_VALUE"/);
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
  assert.equal(detailSku.properties.updatedAt.format, 'epoch-millis');
  assert.equal(detailSku.required.includes('updatedAt'), true);
  assert.equal(saveSku.properties.displayOrder.type, 'integer');
  assert.equal(Object.hasOwn(saveSku.properties, 'updatedAt'), false);
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
  assert.doesNotMatch(catalogItemService, /applyDerivedCatalogFacts|sections\.putObject\("skuSummary"\)|sections\.put\("missingPriceCount"/);
  assert.match(catalogItemService, /new DerivedSkuFacts\(/);
});

test('P3 derives the smart-view wire vocabulary and exposes dictionary entry identity', () => {
  const pageQuery = designCoverageJson.requestRows.find((row) => row.model === 'CatalogItemPageQuery');
  const dictionary = designCoverageJson.rows.find((row) => row.model === 'CatalogDictionaryView');
  assert.ok(pageQuery);
  assert.ok(dictionary);

  const smartViewKey = pageQuery.fields.find((field) => field.path === 'smartViewKey');
  assert.deepEqual(smartViewKey, {
    path: 'smartViewKey', type: 'string', enum: [
      'ALL', 'EXTERNAL_ORDER_TEMP', 'INACTIVE', 'RECENTLY_UPDATED', 'AUTO_SYNC',
    ], required: false,
  });
  assert.equal(dictionary.fields.some((field) => field.path === 'data.entries[].entryRef' && field.format === 'uuid'), true);
  assert.match(generator, /if \(spec\.enumSource\) schema\.enum = enumValues\(spec\.enumSource\);/);

  const querySchema = openApiJson.components.schemas.CatalogItemPageQuery;
  assert.deepEqual(querySchema.properties.smartViewKey.enum, [
    'ALL', 'EXTERNAL_ORDER_TEMP', 'INACTIVE', 'RECENTLY_UPDATED', 'AUTO_SYNC',
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
  assert.match(normalizedCatalogOwner, /return itemService\.readItem\(dataNodeRef, brandRef, itemCode, requestId\)/);
  assert.match(normalizedCatalogItemService, /data\.putObject\("queryIdentity"\)\s*\.put\("dataNodeRef",\s*dataNodeRef\)\s*\.put\("brandRef",\s*brandRef\)/);
});
