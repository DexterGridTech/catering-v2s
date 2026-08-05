import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const source = readFileSync(path.join(root, 'scripts/test/r5-platform-admin-l2-fixture-seed.mjs'), 'utf8');
const jointFixtureSource = readFileSync(path.join(root, 'scripts/test/r5-joint-remote-l2-fixture.mjs'), 'utf8');

test('platform L2 fixture consumes CommercialGroupRoot.groupName rather than a generic name field', () => {
  assert.match(source, /initializeCommercialGroup/);
  assert.match(source, /R5_L2_PLATFORM_GROUP_LABEL:\s*required\(group\.json\?\.groupName, 'GROUP_NAME'\)/);
  assert.doesNotMatch(source, /R5_L2_PLATFORM_GROUP_LABEL:\s*required\(group\.json\?\.name, 'GROUP_NAME'\)/);
  assert.match(source, /R5_L2_PLATFORM_WORKSPACE_LABEL:\s*`\$\{required\(workspace\.json\?\.name, 'WORKSPACE_NAME'\)\}\(\$\{workspaceKey\}\)`/);
  assert.doesNotMatch(source, /R5_L2_PLATFORM_WORKSPACE_LABEL:[^;]*（\$\{workspaceKey\}）/);
  assert.doesNotMatch(source, /R5_L2_PLATFORM_(?:WORKSPACE|ORGANIZATION_PROJECT|ORGANIZATION_BRAND|ORGANIZATION_TENANT)_LABEL:[^;]*（/);
  assert.doesNotMatch(jointFixtureSource, /R5_L2_PLATFORM_ORGANIZATION_(?:PROJECT|BRAND|TENANT)_LABEL:[^;]*（/);
  assert.match(source, /pageAccessKeys: \['PG-ORG-STRUCTURE'\]/);
  assert.doesNotMatch(source, /pageAccessKeys: \[\]/);
  assert.match(jointFixtureSource, /V2S_SEED_OTP_FIXED_VALUE:\s*required\(credentials\.V2S_SEED_OTP_FIXED_VALUE, 'MANAGED_BOOTSTRAP_FIXED_OTP'\)/);
  assert.match(source, /R5_L2_PLATFORM_ORGANIZATION_LABEL:\s*`\$\{required\(store\.json\?\.name, 'STORE_NAME'\)\}\(\$\{required\(store\.json\?\.code, 'STORE_CODE'\)\}\)`/);
});

test('platform L2 fixture create bodies follow selected-project context and never send projectId', () => {
  const storeCreate = source.match(/createOperationsOrganizationStore[\s\S]*?body:\s*\{([^}]*)\}/)?.[1] ?? '';
  const contractCreate = source.match(/createOperationsContract[\s\S]*?body:\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.ok(storeCreate);
  assert.ok(contractCreate);
  assert.doesNotMatch(storeCreate, /\bprojectId\b/);
  assert.doesNotMatch(contractCreate, /\bprojectId\b/);
  assert.match(storeCreate, /brandId:/);
  assert.match(storeCreate, /tenantId:/);
  assert.match(contractCreate, /storeId:/);
});
