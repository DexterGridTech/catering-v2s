import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const files = [
  '../../features/business-entity-management/ui/BusinessEntityManagementPage.tsx',
  '../../features/store-management/ui/StoreManagementPage.tsx',
  '../../features/contract-management/ui/ContractManagementPage.tsx',
  '../../features/workspace-user/ui/WorkspaceUserPage.tsx',
  '../../features/workspace-user/ui/WorkspaceInvitationPanel.tsx',
];

test('operations CRUD query buttons use ProTable onSubmit and the official searchConfig form', () => {
  for (const file of files) {
    const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /form=\{\{[^}]*onFinish/);
    assert.match(source, /onSubmit=/);
    if (source.includes('optionRender:')) {
      assert.match(source, /optionRender: \(searchConfig\)/);
      assert.match(source, /searchConfig\.form\?\.submit\(\)/);
    }
  }
});
