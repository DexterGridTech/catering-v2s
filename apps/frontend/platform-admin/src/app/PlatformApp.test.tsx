import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./PlatformApp.tsx', import.meta.url), 'utf8');
describe('platform authenticated shell focused contract', () => {
  it('uses catalog navigation, workspace scope, guarded overlays, and password result reauthentication', () => {
    expect(source).toContain("type: 'submenu' as const");
    expect(source).toContain('icon: <SettingOutlined/>');
    expect(source).toContain('mode="inline" inlineCollapsed={siderCollapsed}');
    expect(source).toContain("disabled: !selectedGroupWorkspaceKey");
    expect(source).toContain('<WorkspaceScopeSelector collapsed={siderCollapsed}/>');
    expect(source).toContain('collapsible\n        collapsed={siderCollapsed}');
    expect(source).toContain('onCollapse={(next) => { if (!locked) setSiderCollapsed(next); }}');
    expect(source).toContain('trigger={null}');
    expect(source).toContain('<CollapsedIcon');
    expect(source).toContain('className="platform-sider-collapsed-button"');
    expect(source).toContain("testId('platform-shell-toggle-sider')");
    expect(source).toContain('<Layout.Header className="platform-header">');
    expect(source).toContain("testId('platform-shell-refresh-current')");
    expect(source).toContain('<Dropdown menu={principalMenu}');
    expect(source).not.toContain('<Typography.Text type="secondary">平台管理员</Typography.Text>');
    expect(source).toContain('aria-label="刷新当前页"');
    expect(source).toContain('<PlatformPasswordChangeResult');
    expect(source).toContain('<PlatformSessionProvider refresh={refreshSession}>');
    expect(source).not.toMatch(/title:\s*['"]操作['"]/);
  });
});
