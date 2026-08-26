import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migrationPath = path.join(
  repoRoot,
  'apps/backend/catering-business-server/src/main/resources/db/migration/V20260824_120000_000__catalog_single_production_tag.sql',
);
const migration = fs.readFileSync(migrationPath, 'utf8');

function assertMigrationContract(source) {
  assert.equal(
    (source.match(/SELECT \* FROM pg_temp\.catalog_production_tag_migration_preflight\(\)/g) ?? []).length,
    2,
    'preflight must run before DDL and again before DML',
  );
  assert.match(source, /CREATE OR REPLACE FUNCTION pg_temp\.catalog_production_tag_resolution\(\)/);
  assert.match(source, /CREATE OR REPLACE FUNCTION pg_temp\.catalog_production_tag_migration_preflight\(\)/);
  assert.match(source, /RETURNS TABLE\(category TEXT, finding_count BIGINT, disposition TEXT\)/);
  assert.match(source, /catalog\.catalog_item_reference[\s\S]*kind = 'PRODUCTION_TAG'/);
  assert.match(source, /DELETE FROM catalog\.catalog_item_reference[\s\S]*kind = 'PRODUCTION_TAG'/);
  assert.match(source, /INSERT INTO catalog\.catalog_item_reference\(item_ref, kind, ref\)/);
  assert.match(source, /CREATE UNIQUE INDEX ux_catalog_item_reference_production_tag_item_ref/);
  assert.match(source, /ON catalog\.catalog_item_reference \(item_ref\)[\s\S]*WHERE kind = 'PRODUCTION_TAG'/);
  assert.match(source, /preparation_profile - 'productionTagRefs'/);
  assert.match(source, /preparation_override -> 'profile'[\s\S]*- 'productionTagRefs'/);
  assert.match(source, /preparation_effect = preparation_effect - 'addProductionTagRefs'/);
  assert.match(source, /array_agg\(elements\.tag_ref ORDER BY elements\.tag_ref\)/);
  assert.match(source, /array_agg\(relation\.ref ORDER BY relation\.ref\)/);
  assert.doesNotMatch(source, /max\(\s*(?:elements\.)?(?:tag_ref|ref)\)/i);
  assert.doesNotMatch(source, /->\s*'[^']+'\s*-\s*'/);
  for (const category of [
    'EMPTY',
    'SAFE_SINGLE',
    'SAFE_REDUNDANT_NESTED',
    'SAFE_RELATION_REPAIR',
    'CONFLICT_ITEM_MULTI',
    'CONFLICT_SKU_CLEAR',
    'CONFLICT_NESTED_DIFFERENT',
    'CONFLICT_RELATION_EXTRA',
    'MALFORMED',
  ]) assert.match(source, new RegExp(category));
  assert.match(source, /DEXTER_DECISION_REQUIRED/);
  assert.match(source, /SAFE_REDUNDANT_NESTED/);
  assert.match(source, /nested_tag_state = 'MALFORMED'/);
  assert.match(source, /DROP CONSTRAINT ck_catalog_item_preparation_profile/);
  assert.match(source, /DROP CONSTRAINT ck_catalog_sku_preparation_override/);
  assert.match(source, /DROP CONSTRAINT ck_catalog_item_option_preparation_effect/);
  assert.doesNotMatch(source, /sections\s*->\s*'productionTagRefs'/);
  assert.doesNotMatch(source, /DISTINCT ON\s*\(/i);
  assert.doesNotMatch(source, /ORDER BY[\s\S]{0,120}LIMIT\s+1/i);
  assert.doesNotMatch(source, /pick[-_ ]first|fallback|dual[-_ ]read/i);
  for (const notice of source.split('\n').filter(line => line.includes('RAISE NOTICE'))) {
    assert.doesNotMatch(notice, /item_ref|tag_ref|name|notes|instruction|raw|json/i);
  }
}

test('CP-02 migration statically closes the singular production-tag boundary', () => {
  assertMigrationContract(migration);
});

test('CP-02 red fixture rejects removal of the transaction recheck', () => {
  const mutated = migration.replace(
    /DO \$\$[\s\S]*?CATALOG_PRODUCTION_TAG_PREFLIGHT_RECHECK_FAILED[\s\S]*?\$\$;/,
    '',
  );
  assert.throws(() => assertMigrationContract(mutated));
});

test('CP-02 red fixture rejects a non-partial or non-unique production-tag index', () => {
  const mutated = migration.replace(
    'CREATE UNIQUE INDEX ux_catalog_item_reference_production_tag_item_ref',
    'CREATE INDEX ux_catalog_item_reference_production_tag_item_ref',
  );
  assert.throws(() => assertMigrationContract(mutated));
});

test('CP-02 red fixture rejects reintroducing runtime-derived dual-read input', () => {
  const mutated = `${migration}\nSELECT sections -> 'productionTagRefs' FROM catalog.catalog_item;\n`;
  assert.throws(() => assertMigrationContract(mutated));
});
