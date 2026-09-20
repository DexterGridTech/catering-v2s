#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const migrationRoot = path.join(root, 'apps/backend/catering-business-server/src/main/resources/db/migration');
const policyPath = path.join(root, 'contracts/policy/lifecycle-vocabulary.json');

function fail(message) {
  throw new Error(message);
}

function stripSqlComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
}

function migrationStatusTables(sourceRoot = migrationRoot) {
  const tables = new Set();
  const files = fs
    .readdirSync(sourceRoot)
    .filter(file => file.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const source = stripSqlComments(fs.readFileSync(path.join(sourceRoot, file), 'utf8'));
    for (const statement of source.split(';')) {
      const create = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w.]+)\s*\(/i);
      if (create && /\bstatus\b\s+(?:varchar|text|char|integer|smallint|boolean)\b/i.test(statement)) {
        tables.add(create[1].toLowerCase());
      }
      const alter = statement.match(
        /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([\w.]+)[\s\S]*?ADD\s+(?:COLUMN\s+)?status\s+(?:varchar|text|char|integer|smallint|boolean)\b/i,
      );
      if (alter) tables.add(alter[1].toLowerCase());
    }
  }
  return [...tables].sort();
}

function loadPolicy() {
  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  if (policy.schemaVersion !== 1 || policy.statusColumn !== 'status') fail('R6_LIFECYCLE_POLICY_SCHEMA_INVALID');
  const main = policy.mainDataTables ?? [];
  const exempt = policy.exemptTables ?? [];
  const entries = [...main, ...exempt];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.table !== 'string' || !entry.reason?.trim()) {
      fail('R6_LIFECYCLE_POLICY_ENTRY_INVALID');
    }
    if (seen.has(entry.table)) fail(`R6_LIFECYCLE_POLICY_DUPLICATE:${entry.table}`);
    seen.add(entry.table);
  }
  return {main, exempt, registered: seen};
}

function assertClosedSet(statusTables, policy) {
  const discovered = new Set(statusTables);
  const missing = statusTables.filter(table => !policy.registered.has(table));
  const stale = [...policy.registered].filter(table => !discovered.has(table)).sort();
  if (missing.length) fail(`R6_LIFECYCLE_UNREGISTERED:${missing.join(',')}`);
  if (stale.length) fail(`R6_LIFECYCLE_STALE_REGISTRATION:${stale.join(',')}`);
  if (policy.main.length === 0 || policy.exempt.length === 0) fail('R6_LIFECYCLE_POLICY_EMPTY_BUCKET');
}

function selfTest() {
  const policy = loadPolicy();
  const discovered = migrationStatusTables();
  assertClosedSet(discovered, policy);
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'v2s-lifecycle-self-test-'));
  try {
    for (const file of fs.readdirSync(migrationRoot).filter(entry => entry.endsWith('.sql'))) {
      fs.copyFileSync(path.join(migrationRoot, file), path.join(fixtureRoot, file));
    }
    fs.writeFileSync(
      path.join(fixtureRoot, 'V99999999999999__lifecycle_vocabulary_self_test.sql'),
      [
        'CREATE TABLE fixture_unregistered_status_table (id uuid NOT NULL, status varchar(16) NOT NULL);',
        'CREATE TABLE fixture_alter_status_table (id uuid NOT NULL);',
        'ALTER TABLE fixture_alter_status_table ADD COLUMN status varchar(16);',
      ].join('\n'),
    );
    const mutatedDiscovery = migrationStatusTables(fixtureRoot);
    for (const table of ['fixture_unregistered_status_table', 'fixture_alter_status_table']) {
      if (!mutatedDiscovery.includes(table)) fail(`R6_LIFECYCLE_SELF_TEST_DISCOVERY_MISSED:${table}`);
    }
    let red = false;
    try {
      assertClosedSet(mutatedDiscovery, policy);
    } catch (error) {
      red = String(error).includes('R6_LIFECYCLE_UNREGISTERED');
    }
    if (!red) fail('R6_LIFECYCLE_SELF_TEST_RED_NOT_DETECTED');
  } finally {
    fs.rmSync(fixtureRoot, {recursive: true, force: true});
  }
  process.stdout.write(
    `R6_LIFECYCLE_VOCABULARY_RED=PASS\nR6_LIFECYCLE_VOCABULARY_SELF_TEST=PASS\nSTATUS_TABLES=${discovered.length}\n`,
  );
}

function main() {
  const policy = loadPolicy();
  const discovered = migrationStatusTables();
  assertClosedSet(discovered, policy);
  process.stdout.write(
    `R6_LIFECYCLE_VOCABULARY=PASS\nSTATUS_TABLES=${discovered.length}\nMAIN_DATA_TABLES=${policy.main.length}\nEXEMPT_TABLES=${policy.exempt.length}\n`,
  );
}

try {
  if (process.argv.includes('--self-test')) selfTest();
  else main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
