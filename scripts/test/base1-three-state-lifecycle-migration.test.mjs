import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migrationPath = path.join(
  repoRoot,
  'apps/backend/catering-business-server/src/main/resources/db/migration/V20260827_010000_000__base1_three_state_lifecycle.sql',
);
const migration = fs.readFileSync(migrationPath, 'utf8');
const inventoryOwnerServicePath = path.join(
  repoRoot,
  'apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java',
);
const inventoryOwnerService = fs.readFileSync(inventoryOwnerServicePath, 'utf8');
const inventoryBomPersistence = fs.readFileSync(
  path.join(
    repoRoot,
    'apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/persistence/InventoryBomPersistence.java',
  ),
  'utf8',
);
const inventoryBomServiceSql = fs.readFileSync(
  path.join(
    repoRoot,
    'apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/persistence/InventoryBomServiceSql.java',
  ),
  'utf8',
);
const inventoryCopyPersistence = fs.readFileSync(
  path.join(
    repoRoot,
    'apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/persistence/InventoryCopyPersistence.java',
  ),
  'utf8',
);
const inventoryCopyServiceSql = fs.readFileSync(
  path.join(
    repoRoot,
    'apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/persistence/InventoryCopyServiceSql.java',
  ),
  'utf8',
);
const businessChannelService = fs.readFileSync(
  path.join(
    repoRoot,
    'apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelService.java',
  ),
  'utf8',
);
const businessChannelTemplateService = fs.readFileSync(
  path.join(
    repoRoot,
    'apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelTemplateService.java',
  ),
  'utf8',
);
const businessChannelTemplatePersistence = fs.readFileSync(
  path.join(
    repoRoot,
    'apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/persistence/BusinessChannelTemplatePersistence.java',
  ),
  'utf8',
);
const businessChannelServiceSql = fs.readFileSync(
  path.join(
    repoRoot,
    'apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/persistence/BusinessChannelServiceSql.java',
  ),
  'utf8',
);

function indexOfRequired(source, needle) {
  const index = source.indexOf(needle);
  assert.notEqual(index, -1, `missing ${needle}`);
  return index;
}

function uniqueIndexStatement(source, indexName) {
  const match = source.match(new RegExp(`CREATE UNIQUE INDEX ${indexName}\\b[\\s\\S]*?;`));
  assert.notEqual(match, null, `missing CREATE UNIQUE INDEX ${indexName}`);
  return match[0];
}

function methodBody(source, methodName) {
  const start = source.indexOf(`${methodName}(`);
  assert.notEqual(start, -1, `missing ${methodName}`);
  const nextMethod = source.indexOf('\n    public ', start + methodName.length);
  return source.slice(start, nextMethod === -1 ? source.length : nextMethod);
}

function assertInventoryBomUpsertPredicates(sources) {
  const callSites = [
    {
      method: 'upsertCopiedOptionValueBom',
      persistence: sources.bomPersistence,
      sql: sources.bomSql,
      constant: 'INVENTORY_BOM_SERVICE_WHERE_DEFINITION_STATUS_ENABLED',
      predicate: /WHERE definition_status='ENABLED' DO NOTHING/,
    },
    {
      method: 'upsertCatalogBomRows',
      persistence: sources.bomPersistence,
      sql: sources.bomSql,
      constant: 'INVENTORY_BOM_SERVICE_DEFINITION_STATUS_ENABLED',
      predicate: /WHERE definition_status='ENABLED'/,
    },
    {
      method: 'copyCatalogSkus',
      persistence: sources.copyPersistence,
      sql: sources.copySql,
      constant: 'INVENTORY_COPY_SERVICE_DEFINITION_STATUS_ENABLED',
      predicate: /WHERE definition_status='ENABLED'/,
    },
  ];
  assert.equal(callSites.length, 3, 'inventory has exactly three BOM upsert call sites');
  for (const callSite of callSites) {
    assert.match(methodBody(callSite.persistence, callSite.method), new RegExp(callSite.constant));
    assert.match(callSite.sql, callSite.predicate, `${callSite.method} keeps the ENABLED-only arbiter predicate`);
  }
}

function assertBusinessChannelCodeAvailabilityPredicates(sources) {
  assert.match(
    migration,
    /CREATE UNIQUE INDEX ux_business_channel_template_active_project_code[\s\S]*WHERE template_code IS NOT NULL AND status <> 'VOIDED';/,
    'template code reuse excludes VOIDED rows at the database boundary',
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX ux_business_channel_active_group_code[\s\S]*WHERE channel_code IS NOT NULL AND status <> 'VOIDED';/,
    'channel code reuse excludes VOIDED rows at the database boundary',
  );
  const projection = methodBody(sources.templatePersistence, 'readTemplateCommandProjection');
  assert.match(projection, /CONDITION_CHANNEL_CHANNEL_CODE_STATUS_VOIDED/);
  assert.match(projection, /channel_code_in_use/);
  assert.match(sources.serviceSql, /channel\.channel_code=\? AND channel\.status <> 'VOIDED'/);
  const create = methodBody(sources.service, 'createChannel');
  assert.match(create, /readTemplateCommandProjection/);
  assert.match(create, /ensureChannelCodeAvailable\(template\.channelCodeInUse\(\)\)/);
  const createTemplate = methodBody(sources.templateService, 'createTemplate');
  assert.match(createTemplate, /catch \(DuplicateKeyException/);
  assert.match(createTemplate, /problem\("DUPLICATE_CODE"/);
}

const EXPECTED_DUPLICATE_LABELS = [
  'organization.organization_node.code',
  'organization.brand.code',
  'organization.brand.name',
  'organization.tenant.code',
  'organization.tenant.credit_code',
  'organization.tenant.name',
  'organization.head_company.code',
  'organization.head_company.credit_code',
  'organization.head_company.name',
  'organization.store.code',
  'organization.store.name',
  'workspace_iam.workspace_role.name',
  'business_channel.business_channel_template.template_code',
  'business_channel.business_channel.channel_code',
  'catalog.catalog_category.code',
  'catalog.catalog_attribute_definition.code',
  'catalog.catalog_order_option_definition.code',
  'catalog.unit_definition.code',
  'catalog.catalog_order_option_definition_value.parent_code',
];

function duplicateLabels(source) {
  return [...source.matchAll(/\n\s*'([a-z_]+\.[a-z_.]+)'\n\);/g)].map((match) => match[1]);
}

function assertDuplicatePreconditionLabels(source) {
  assert.deepEqual(
    duplicateLabels(source),
    EXPECTED_DUPLICATE_LABELS,
    'all base-1 non-VOIDED duplicate preconditions remain in their approved order',
  );
}

function assertMigrationContract(source) {
  assert.doesNotMatch(source, /CONCURRENTLY/i);
  assert.doesNotMatch(source, /ADD COLUMN IF NOT EXISTS\s+status/i);
  assert.match(source, /D03=C explicitly revises only the option-value part/);
  assert.match(source, /option groups remain scope-unique; option values are unique within their parent definition/);

  const businessDrop = indexOfRequired(source, 'DROP CONSTRAINT business_channel_status_check');
  const businessUpdate = indexOfRequired(source, 'UPDATE business_channel.business_channel');
  const businessAdd = indexOfRequired(source, "ADD CONSTRAINT business_channel_status_check\n    CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'))");
  assert.ok(businessDrop < businessUpdate && businessUpdate < businessAdd);

  const itemUpdate = indexOfRequired(source, 'UPDATE catalog.catalog_item');
  const itemDropDefault = indexOfRequired(source, 'ALTER COLUMN status DROP DEFAULT');
  const itemCheck = indexOfRequired(source, "ADD CONSTRAINT catalog_item_status_check\n    CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'))");
  assert.ok(itemUpdate < itemDropDefault && itemDropDefault < itemCheck);

  const skuUpdate = indexOfRequired(source, 'UPDATE catalog.catalog_sku');
  const skuCheck = indexOfRequired(source, "ADD CONSTRAINT catalog_sku_status_check\n    CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'))");
  assert.ok(skuUpdate < skuCheck);

  for (const constraint of [
    'ck_organization_node_status',
    'ck_brand_status',
    'ck_tenant_status',
    'ck_head_company_status',
    'ck_store_status',
    'ck_workspace_account_status',
    'ck_workspace_role_status',
    'business_channel_template_status_check',
    'unit_definition_status_check',
    'ck_catalog_attribute_definition_status',
    'ck_catalog_order_option_definition_status',
  ]) {
    assert.match(source, new RegExp(`${constraint}[\\s\\S]*ENABLED[\\s\\S]*DISABLED[\\s\\S]*VOIDED`));
  }

  assert.match(source, /BASE1_COMPONENT_ARCHIVED_PRECONDITION_FAILED/);
  assert.doesNotMatch(source, /UPDATE\s+catalog\.catalog_composite_component[\s\S]*SET\s+status\s*=\s*'VOIDED'/i);
  assert.match(
    source,
    /ADD CONSTRAINT catalog_composite_component_status_check\s+CHECK \(status IN \('ENABLED', 'DISABLED'\)\)/,
  );
  assert.match(source, /catalog\.catalog_attribute_definition ADD COLUMN status VARCHAR\(16\);/);
  assert.match(source, /catalog\.catalog_order_option_definition ADD COLUMN status VARCHAR\(16\);/);
  assert.match(source, /ck_extension_definition_field_status/);
  assert.match(source, /jsonb_array_elements\(definition\.definitions\) WITH ORDINALITY/);
  assert.match(source, /BASE1_EXTENSION_FIELD_STATUS_PRECONDITION_FAILED/);

  for (const index of [
    'ux_organization_node_active_code',
    'ux_brand_active_code',
    'ux_brand_active_name',
    'ux_tenant_active_code',
    'ux_tenant_active_credit_code',
    'ux_tenant_active_name',
    'ux_head_company_active_code',
    'ux_head_company_active_credit_code',
    'ux_head_company_active_name',
    'ux_store_active_code',
    'ux_store_active_name',
    'ux_workspace_role_active_name',
    'ux_business_channel_template_active_project_code',
    'ux_business_channel_active_group_code',
    'ux_catalog_category_active_code',
    'ux_catalog_attribute_definition_active_code',
    'ux_catalog_order_option_definition_active_code',
    'ux_catalog_unit_definition_active_code',
  ]) {
    assert.match(uniqueIndexStatement(source, index), /WHERE[\s\S]*status <> 'VOIDED'/);
  }

  assert.match(source, /uq_catalog_order_option_definition_value_parent_code[\s\S]*UNIQUE \(order_option_definition_ref, code\)/);
  assert.ok(
    indexOfRequired(source, 'ADD CONSTRAINT uq_catalog_order_option_definition_value_parent_code') <
      indexOfRequired(source, 'DROP CONSTRAINT uq_catalog_order_option_definition_value_scope_code'),
  );
  assert.doesNotMatch(source, /ALTER TABLE catalog\.catalog_order_option_definition_value[\s\S]*ADD COLUMN status/);

  assert.match(source, /ux_catalog_sku_default_per_item[\s\S]*WHERE is_default AND status <> 'VOIDED'/);
  assert.match(source, /ux_catalog_sku_variant_digest_per_item[\s\S]*WHERE status <> 'VOIDED'/);
  assert.doesNotMatch(source, /DROP (?:INDEX|CONSTRAINT)[\s\S]*(?:ux_inventory_stock_target_active_identity|ux_inventory_stock_bom_active_identity|stock_target_definition_status_check|stock_bom_definition_status_check)/);
  assert.doesNotMatch(source, /DROP CONSTRAINT uq_workspace_(?:mobile|login)/);
  assert.doesNotMatch(source, /ux_workspace_(?:mobile|login).*status <> 'VOIDED'/);
}

test('BASE1 CP-B1 migration statically matches lifecycle DDL contract', () => {
  assertMigrationContract(migration);
});

test('BASE1 CP-B1 inventory BOM upserts keep their historical-definition predicate', () => {
  assertInventoryBomUpsertPredicates({
    bomPersistence: inventoryBomPersistence,
    bomSql: inventoryBomServiceSql,
    copyPersistence: inventoryCopyPersistence,
    copySql: inventoryCopyServiceSql,
  });
});

test('BASE1 CP-B1 business-channel code checks release codes only after VOIDED', () => {
  assertBusinessChannelCodeAvailabilityPredicates({
    service: businessChannelService,
    templateService: businessChannelTemplateService,
    templatePersistence: businessChannelTemplatePersistence,
    serviceSql: businessChannelServiceSql,
  });
});

test('BASE1 CP-B1 red fixture rejects a widened inventory BOM upsert predicate', () => {
  const widenedPredicate = "WHERE definition_status <> 'VOIDED'";
  assert.throws(() =>
    assertInventoryBomUpsertPredicates({
      bomPersistence: inventoryBomPersistence,
      bomSql: inventoryBomServiceSql.replaceAll("WHERE definition_status='ENABLED'", widenedPredicate),
      copyPersistence: inventoryCopyPersistence,
      copySql: inventoryCopyServiceSql.replaceAll("WHERE definition_status='ENABLED'", widenedPredicate),
    }),
  );
});

test('BASE1 CP-B1 red fixture rejects counting VOIDED business-channel rows as duplicates', () => {
  const mutatedServiceSql = businessChannelServiceSql.replace("AND channel.channel_code=? AND channel.status <> 'VOIDED'", 'AND channel.channel_code=?');
  assert.throws(() =>
    assertBusinessChannelCodeAvailabilityPredicates({
      service: businessChannelService,
      templateService: businessChannelTemplateService,
      templatePersistence: businessChannelTemplatePersistence,
      serviceSql: mutatedServiceSql,
    }),
  );
});

test('BASE1 CP-B1 migration enumerates the complete duplicate-precondition denominator', () => {
  assertDuplicatePreconditionLabels(migration);
});

test('BASE1 CP-B1 red fixture rejects a missing duplicate-precondition label', () => {
  const removed = migration.replace(
    "    'organization.brand.name'\n);",
    '',
  );
  assert.throws(() => assertDuplicatePreconditionLabels(removed));
});

test('BASE1 CP-B1 red fixture rejects invalid business-channel ordering', () => {
  const mutated = migration.replace(
    'ALTER TABLE business_channel.business_channel\n    DROP CONSTRAINT business_channel_status_check;\n\n',
    '',
  );
  assert.throws(() => assertMigrationContract(mutated));
});

test('BASE1 CP-B1 red fixture rejects component ARCHIVED mapping instead of fail closed', () => {
  const mutated = migration.replace(
    'BASE1_COMPONENT_ARCHIVED_PRECONDITION_FAILED',
    "SET status = 'VOIDED' WHERE status = 'ARCHIVED'",
  );
  assert.throws(() => assertMigrationContract(mutated));
});

test('BASE1 CP-B1 red fixture rejects widening workspace account identity uniqueness', () => {
  const mutated = `${migration}\nDROP CONSTRAINT uq_workspace_mobile;\nCREATE UNIQUE INDEX ux_workspace_mobile_active ON workspace_iam.workspace_account (workspace_uuid, group_workspace_key, mobile_normalized) WHERE status <> 'VOIDED';\n`;
  assert.throws(() => assertMigrationContract(mutated));
});

test('BASE1 CP-B1 red fixture rejects partial index predicate borrowed from the next statement', () => {
  const mutated = migration.replace(
    "CREATE UNIQUE INDEX ux_brand_active_code\n    ON organization.brand (workspace_uuid, group_workspace_key, code)\n    WHERE status <> 'VOIDED';",
    "CREATE UNIQUE INDEX ux_brand_active_code\n    ON organization.brand (workspace_uuid, group_workspace_key, code);",
  );
  assert.throws(() => assertMigrationContract(mutated));
});
