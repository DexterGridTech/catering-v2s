import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./PlatformApp.tsx', import.meta.url), 'utf8');
describe('platform authenticated shell focused contract', () => {
  it('uses catalog navigation, workspace scope, guarded overlays, and password result reauthentication', () => {
    expect(source).toContain('registrations.map((entry) => ({key: entry.pageDesignKey');
    expect(source).toContain("workspaceRequirement === 'REQUIRED' && !selectedGroupWorkspaceKey");
    expect(source).toContain('<WorkspaceScopeSelector/>');
    expect(source).toContain("testId('platform-shell-refresh-current')");
    expect(source).toContain('<PlatformPasswordChangeResult');
    expect(source).not.toMatch(/title:\s*['"]操作['"]/);
  });
});
