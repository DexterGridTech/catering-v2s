import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const stateLists = [
  'features/business-entity-management/ui/BusinessEntityManagementPage.tsx',
  'features/contract-management/ui/ContractManagementPage.tsx',
  'features/store-management/ui/StoreManagementPage.tsx',
  'features/store-profile/ui/StoreProfilePage.tsx',
  'features/workspace-user/ui/WorkspaceInvitationPanel.tsx',
  'features/workspace-user/ui/WorkspaceUserPage.tsx',
];

test('every operations management list defaults to ten rows without shrinking candidate search windows', () => {
  for (const path of stateLists) {
    const source = read(path);
    assert.match(source, /useState\(10\)/, path);
    assert.doesNotMatch(source, /useState\(20\)/, path);
  }
  const audit = read('features/audit-history/ui/OperationsAuditHistoryModal.tsx');
  assert.match(audit, /pageSize: 10/);
  assert.doesNotMatch(audit, /pageSize:\s*(?!10\b)\d+/);
});
