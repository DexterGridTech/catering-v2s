#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIGRATION = 'apps/backend/catering-business-server/src/main/resources/db/migration/V20260901_000000_000__sales_menu_owner.sql';
const OWNER_TABLES = Object.freeze([
  'sales_collection',
  'sales_collection_activation',
  'sales_collection_version',
  'sales_section',
  'sales_version_section',
  'sales_item',
  'sales_version_item',
  'sales_version_item_sku',
  'sales_version_item_media',
  'sales_publication',
  'sales_manual_status_current',
  'sales_manual_status_event',
  'sales_operation_record',
  'sales_command_receipt',
]);

function fail(code, detail = '') {
  throw new Error(`${code}${detail ? `:${detail}` : ''}`);
}

function assertContains(source, fragment, code) {
  if (!source.includes(fragment)) fail(code, fragment);
}

function validateSource(source) {
  const normalized = source.replace(/--.*$/gm, '').replace(/\s+/g, ' ');
  assertContains(normalized, 'CREATE SCHEMA sales_menu;', 'SALES_MENU_SCHEMA_MISSING');

  const tables = [...normalized.matchAll(/CREATE TABLE sales_menu\.([a-z0-9_]+) \(/g)].map(match => match[1]);
  if (tables.length !== OWNER_TABLES.length || JSON.stringify(tables) !== JSON.stringify(OWNER_TABLES)) {
    fail('SALES_MENU_OWNER_TABLE_SET_INVALID', tables.join(','));
  }
  assertContains(normalized, 'CREATE TABLE platform_asset.sales_menu_asset_target (', 'SALES_MENU_ASSET_TARGET_TABLE_MISSING');
  assertContains(
    normalized,
    'PRIMARY KEY (collection_ref, channel_ref)',
    'SALES_MENU_ACTIVATION_PAIR_KEY_MISSING',
  );
  assertContains(
    normalized,
    'CREATE INDEX idx_sales_collection_activation_channel ON sales_menu.sales_collection_activation (channel_ref, status, collection_ref);',
    'SALES_MENU_ACTIVATION_CHANNEL_INDEX_MISSING',
  );
  assertContains(
    normalized,
    'FOREIGN KEY (source_draft_version_ref, collection_ref) REFERENCES sales_menu.sales_collection_version(version_ref, collection_ref)',
    'SALES_MENU_SOURCE_COLLECTION_FK_MISSING',
  );
  assertContains(
    normalized,
    'FOREIGN KEY (published_version_ref, collection_ref) REFERENCES sales_menu.sales_collection_version(version_ref, collection_ref)',
    'SALES_MENU_PUBLICATION_COLLECTION_FK_MISSING',
  );
  if (/UNIQUE(?: INDEX [^ ]+ ON [^ ]+)? \(collection_ref, catalog_item_ref\)/.test(normalized)) {
    fail('SALES_MENU_DUPLICATE_ITEM_UNIQUE_FORBIDDEN');
  }
  for (const trigger of [
    'tr_sales_collection_version_published_immutable',
    'tr_sales_version_section_published_immutable',
    'tr_sales_version_item_published_immutable',
    'tr_sales_version_item_sku_published_immutable',
    'tr_sales_version_item_media_published_immutable',
    'tr_sales_publication_append_only',
    'tr_sales_item_binding_immutable',
  ]) {
    assertContains(normalized, `CREATE TRIGGER ${trigger}`, 'SALES_MENU_TRIGGER_MISSING');
  }
  if (/REFERENCES (organization|business_channel|catalog|inventory)\./.test(normalized)) {
    fail('SALES_MENU_CROSS_SCHEMA_FK_FORBIDDEN');
  }
  assertContains(
    normalized,
    "CHECK (usage IN ('GROUP_WORKSPACE_LOGO', 'CATALOG_ITEM_IMAGE', 'SALES_MENU_ITEM_IMAGE'))",
    'SALES_MENU_ASSET_USAGE_NOT_EXTENDED',
  );
  return {tables: tables.length};
}

function validate(base = repositoryRoot) {
  const source = fs.readFileSync(path.join(base, MIGRATION), 'utf8');
  const result = validateSource(source);
  process.stdout.write(`SALES_MENU_SCHEMA=PASS\nOWNER_TABLES=${result.tables}\nASSET_TARGET=PASS\n`);
  return result;
}

function selfTest() {
  const source = fs.readFileSync(path.join(repositoryRoot, MIGRATION), 'utf8');
  const expectRed = (label, mutate, expectedCode) => {
    let red = false;
    try {
      validateSource(mutate(source));
    } catch (error) {
      red = error.message.includes(expectedCode);
    }
    if (!red) fail('SALES_MENU_SCHEMA_SELF_TEST_RED_NOT_DETECTED', label);
  };
  expectRed(
    'cross-collection source reference',
    value => value.replace(
      /FOREIGN KEY\s*\(\s*source_draft_version_ref,\s*collection_ref\s*\)\s+REFERENCES\s+sales_menu\.sales_collection_version\s*\(\s*version_ref,\s*collection_ref\s*\)/,
      'FOREIGN KEY (source_draft_version_ref) REFERENCES sales_menu.sales_collection_version(version_ref)',
    ),
    'SALES_MENU_SOURCE_COLLECTION_FK_MISSING',
  );
  expectRed(
    'duplicate catalog item restriction',
    value => value.replace(
      'CREATE INDEX idx_sales_item_collection_catalog_item\n    ON sales_menu.sales_item (collection_ref, catalog_item_ref, sales_item_ref)',
      'CREATE UNIQUE INDEX uq_sales_item_catalog_item\n    ON sales_menu.sales_item (collection_ref, catalog_item_ref)',
    ),
    'SALES_MENU_DUPLICATE_ITEM_UNIQUE_FORBIDDEN',
  );
  expectRed(
    'published child trigger',
    value => value.replace('CREATE TRIGGER tr_sales_version_item_media_published_immutable', 'CREATE TRIGGER removed_trigger'),
    'SALES_MENU_TRIGGER_MISSING',
  );
  process.stdout.write('SALES_MENU_SCHEMA_SELF_TEST=PASS\n');
}

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--self-test') selfTest();
  else if (args.length === 0) validate();
  else fail('SALES_MENU_SCHEMA_ACCEPTS_ONLY_SELF_TEST');
} catch (error) {
  process.stderr.write(`SALES_MENU_SCHEMA=FAIL\nREASON=${error.message}\n`);
  process.exit(1);
}

export {OWNER_TABLES, validate, validateSource};
