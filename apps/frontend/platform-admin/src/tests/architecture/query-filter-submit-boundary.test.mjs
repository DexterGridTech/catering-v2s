import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const files = [
  '../../features/platform-administration/ui/AdministratorsPage.tsx',
  '../../features/workspace-management/ui/WorkspaceManagementPage.tsx',
  '../../features/organization-contract-overview/ui/PlatformReadPage.tsx',
];

test('platform CRUD query buttons use ProTable onSubmit and the official searchConfig form', () => {
  for (const file of files) {
    const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /form=\{\{[^}]*onFinish/);
    assert.match(source, /onSubmit=/);
    assert.match(source, /optionRender: \(searchConfig\)/);
    assert.match(source, /searchConfig\.form\?\.submit\(\)/);
  }
});
