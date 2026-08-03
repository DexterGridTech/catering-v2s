import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const stateLists = [
  'features/organization-contract-overview/ui/PlatformReadPage.tsx',
  'features/platform-administration/ui/AdministratorsPage.tsx',
  'features/workspace-iam/ui/AccountsPage.tsx',
  'features/workspace-iam/ui/PlatformInvitationPanel.tsx',
  'features/workspace-iam/ui/RolesPage.tsx',
  'features/workspace-management/ui/WorkspaceManagementPage.tsx',
];

test('every platform management list defaults to ten rows without changing candidate windows', () => {
  for (const path of stateLists) {
    const source = read(path);
    assert.match(source, /useState\(10\)/, path);
    assert.doesNotMatch(source, /useState\(20\)/, path);
  }
  assert.match(read('features/organization-contract-overview/ui/OrganizationOverviewFilters.ts'), /pageSize: 10/);
  assert.match(read('features/audit-history/ui/PlatformAuditHistoryModal.tsx'), /pageSize: 10/);
});
