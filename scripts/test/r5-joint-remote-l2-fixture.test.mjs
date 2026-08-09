import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const fixturePath = path.join(root, 'scripts/test/r5-joint-remote-l2-fixture.mjs');

function l2Sources(directory) {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.spec.ts') || name.endsWith('L2.ts'))
    .map((name) => path.join(directory, name));
}

function requiredKeys(source) {
  return [...source.matchAll(/requiredL2Env\('([^']+)'\)/g)].map((match) => match[1]);
}

function declaredKeys(source, expression) {
  const match = source.match(expression);
  assert.ok(match, `missing fixture declaration matching ${expression}`);
  return [...match[1].matchAll(/'(R5_L2_[A-Z0-9_]+)'|\b(R5_L2_[A-Z0-9_]+)\s*:/g)].map((entry) => entry[1] ?? entry[2]);
}

test('joint L2 fixture declares every browser environment input consumed by either admin', () => {
  const fixture = readFileSync(fixturePath, 'utf8');
  const required = new Set([
    ...l2Sources(path.join(root, 'apps/frontend/platform-admin/src/tests/l2')),
    ...l2Sources(path.join(root, 'apps/frontend/operations-admin/src/tests/l2')),
  ].flatMap((file) => requiredKeys(readFileSync(file, 'utf8'))));
  const expected = new Set(declaredKeys(fixture, /const expectedBrowserInputKeys = \[([\s\S]*?)\];/));
  const publicValues = new Set(declaredKeys(fixture, /const values = \{([\s\S]*?)\n\};\nconst privateValues/));
  const privateValues = new Set([
    ...declaredKeys(fixture, /const privateValues = \{([\s\S]*?)\n\};\nif \(process\.env\.R5_JOINT_INCLUDE_CATALOG_INVENTORY/),
    ...declaredKeys(fixture, /Object\.assign\(privateValues, \{([\s\S]*?)\n\}\);/),
  ]);
  const fixtureInputs = new Set([...publicValues, ...privateValues]);

  assert.deepEqual([...required].filter((key) => !expected.has(key)), []);
  assert.deepEqual([...required].filter((key) => !fixtureInputs.has(key)), []);
});

test('joint L2 fixture reports every administrator-reset bootstrap stage', () => {
  const fixture = readFileSync(fixturePath, 'utf8');
  assert.match(fixture, /createManagedInvitation\('createCredentialResetWorkspaceInvitation'/);
  assert.match(fixture, /'createCredentialResetWorkspaceInvitation'/);
});

test('catalog API fixture provisions a project principal for project-scope rejection', () => {
  const fixture = readFileSync(fixturePath, 'utf8');
  assert.match(fixture, /createCatalogProjectRole/);
  assert.match(fixture, /targetType: 'PROJECT'/);
  assert.match(fixture, /CATALOG_INVENTORY_PROJECT_LOGIN: catalogProjectLoginName/);
});
