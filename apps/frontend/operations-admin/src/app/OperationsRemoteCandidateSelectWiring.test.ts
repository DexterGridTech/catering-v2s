import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const remoteCandidateSources = await Promise.all([
  '../features/contract-management/ui/ContractCreateDrawer.tsx',
  '../features/contract-management/ui/ContractManagementPage.tsx',
  '../features/store-management/ui/StoreCreateDrawer.tsx',
  '../features/store-management/ui/StoreEditDrawer.tsx',
  '../features/business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx',
  '../features/workspace-user/ui/WorkspaceInvitationCreateDrawer.tsx',
  '../features/workspace-user/ui/WorkspaceUserPage.tsx',
  '../features/workspace-user/ui/WorkspaceInvitationPanel.tsx',
].map((relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8')));

describe('operations remote candidate Select wiring', () => {
  it('binds every remote candidate search callback through Select props, not the showSearch flag', () => {
    const source = remoteCandidateSources.join('\n');

    expect(source).not.toMatch(/showSearch\s*[:=]\s*\{\s*filterOption\s*:/);
    expect((source.match(/filterOption=\{false\}/g) ?? [])).toHaveLength(8);
    expect((source.match(/filterOption:\s*false/g) ?? [])).toHaveLength(5);
    expect((source.match(/onSearch[=:]/g) ?? [])).toHaveLength(13);
  });
});
