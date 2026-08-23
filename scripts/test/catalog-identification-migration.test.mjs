import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migrationPath = path.join(
  repoRoot,
  'apps/backend/catering-business-server/src/main/resources/db/migration/V20260823_120000_000__catalog_identifiers_and_preparation_model.sql',
);
const migration = fs.readFileSync(migrationPath, 'utf8');

test('CIPG migration is fail-closed and uses only current owner tables', () => {
  assert.equal((migration.match(/CREATE OR REPLACE FUNCTION pg_temp\.cipg_migration_preflight\(\)/g) ?? []).length, 1);
  assert.equal((migration.match(/SELECT \* FROM pg_temp\.cipg_migration_preflight\(\)/g) ?? []).length, 2);
  assert.match(migration, /RETURNS TABLE\(category TEXT, finding_count BIGINT, disposition TEXT\)/);
  assert.match(migration, /CREATE TABLE catalog\.product_identifier/);
  assert.match(migration, /FOREIGN KEY \(item_ref, product_sku_ref\)/);
  assert.match(migration, /UNIQUE \(data_node_ref, brand_ref, identifier_type, normalized_value\)/);
  assert.match(migration, /CHECK \(btrim\(normalized_value\) <> ''\)/);
  assert.match(migration, /CHECK \(length\(normalized_value\) <= 160\)/);
  assert.match(migration, /CHECK \(btrim\(normalized_value\) <> ''\)/);
  assert.match(migration, /CHECK \(length\(normalized_value\) <= 160\)/);
  assert.match(migration, /ADD COLUMN preparation_profile JSONB/);
  assert.match(migration, /ADD COLUMN preparation_override JSONB/);
  assert.match(migration, /ADD COLUMN preparation_effect JSONB/);
  assert.match(migration, /ADD COLUMN display_order INTEGER/);
  assert.match(migration, /uq_catalog_item_order_option_config_item_display_order/);
  assert.match(migration, /DROP COLUMN sku_barcode/);
  assert.doesNotMatch(migration, /catalog\.catalog_order_option_value\b/);
  assert.doesNotMatch(migration, /catalog\.catalog_order_option_group\b/);

  const notices = migration.split('\n').filter((line) => line.includes('RAISE NOTICE'));
  assert.ok(notices.length >= 2);
  for (const notice of notices) {
    assert.doesNotMatch(notice, /identifierValue|preparationNotes|instruction|raw JSON/);
  }
});

test('CIPG migration materializes deterministic legacy facts before retiring old storage', () => {
  const firstPreflightCall = migration.indexOf('SELECT * FROM pg_temp.cipg_migration_preflight()');
  const secondPreflightCall = migration.indexOf(
    'SELECT * FROM pg_temp.cipg_migration_preflight()',
    firstPreflightCall + 1,
  );
  const preflightEnd = migration.indexOf('CREATE TABLE catalog.product_identifier');
  const dmlStart = migration.indexOf('WITH legacy_identifiers AS');
  const dropStart = migration.indexOf('DROP COLUMN sku_barcode');
  assert.ok(firstPreflightCall > 0);
  assert.ok(secondPreflightCall > firstPreflightCall);
  assert.ok(preflightEnd > 0);
  assert.ok(firstPreflightCall < preflightEnd);
  assert.ok(secondPreflightCall > preflightEnd);
  assert.ok(dmlStart > preflightEnd);
  assert.ok(secondPreflightCall < dmlStart);
  assert.ok(dropStart > dmlStart);
  assert.match(migration, /md5\('CIPG:item:/);
  assert.match(migration, /md5\('CIPG:sku:/);
  assert.match(migration, /sections = sections - 'identifiers' - 'productionProfiles' - 'productionTagRefs'/);
  assert.match(migration, /nested|top-level|materialRole/);
});
