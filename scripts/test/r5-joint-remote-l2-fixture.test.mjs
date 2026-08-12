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

test('joint fixture retains the platform label, group-name, page-access and fixed-OTP assertions', () => {
  const fixture = readFileSync(fixturePath, 'utf8');
  assert.match(fixture, /initializeCommercialGroup/);
  assert.match(fixture, /body:\s*\{[^}]*groupName:/);
  assert.match(fixture, /R5_L2_PLATFORM_GROUP_LABEL:\s*required\(group\.json\?\.groupName, 'PLATFORM_GROUP_NAME'\)/);
  assert.match(fixture, /R5_L2_PLATFORM_WORKSPACE_LABEL:\s*`\$\{required\(workspace\.json\?\.name, 'PLATFORM_WORKSPACE_LABEL'\)\}\(\$\{workspaceKey\}\)`/);
  assert.doesNotMatch(fixture, /R5_L2_PLATFORM_(?:WORKSPACE|ORGANIZATION_PROJECT|ORGANIZATION_BRAND|ORGANIZATION_TENANT)_LABEL:[^;]*（/);
  assert.match(fixture, /const pages = \[[\s\S]*'PG-ORG-STRUCTURE'/);
  assert.match(fixture, /V2S_SEED_OTP_FIXED_VALUE:\s*required\(credentials\.V2S_SEED_OTP_FIXED_VALUE, 'MANAGED_BOOTSTRAP_FIXED_OTP'\)/);
  assert.match(fixture, /R5_L2_PLATFORM_ORGANIZATION_LABEL:\s*`\$\{required\(store\.json\?\.name, 'PLATFORM_ORGANIZATION_NAME'\)\}\(\$\{required\(store\.json\?\.code, 'PLATFORM_ORGANIZATION_CODE'\)\}\)`/);
});

test('joint fixture creates store and contract under selected-project context without projectId', () => {
  const fixture = readFileSync(fixturePath, 'utf8');
  const storeCreate = fixture.match(/const store = await request\([\s\S]*?body:\s*\{([^}]*)\}\}\);/)?.[1] ?? '';
  const contractCreate = fixture.match(/createOperationsContract[\s\S]*?body:\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(fixture, /selectOperationsProjectDataNode/);
  assert.ok(storeCreate);
  assert.ok(contractCreate);
  assert.doesNotMatch(fixture, /\bprojectId\b/);
  assert.match(storeCreate, /brandId:/);
  assert.match(storeCreate, /tenantId:/);
  assert.match(contractCreate, /storeId:/);
});

test('catalog API fixture provisions a project principal for project-scope rejection', () => {
  const fixture = readFileSync(fixturePath, 'utf8');
  assert.match(fixture, /createCatalogProjectRole/);
  assert.match(fixture, /targetType: 'PROJECT'/);
  assert.match(fixture, /CATALOG_INVENTORY_PROJECT_LOGIN: catalogProjectLoginName/);
});

test('catalog L2 child report keeps business and cleanup ownership separate with terminal diagnostics', () => {
  const fixture = readFileSync(path.join(root, 'scripts/test/catalog-inventory-l2-test-fixture.mjs'), 'utf8');
  assert.match(fixture, /businessStatus: 'PASS'/);
  assert.match(fixture, /cleanupStatus: 'NOT_OWNED_BY_FIXTURE'/);
  assert.match(fixture, /cleanupOwner: 'JOINT_L2_RUNNER'/);
  assert.match(fixture, /firstFailure: null/);
  assert.match(fixture, /lastKnownGood: 'L2_FIXTURE_READBACK'/);
  assert.match(fixture, /brokenBoundary: null/);
});
