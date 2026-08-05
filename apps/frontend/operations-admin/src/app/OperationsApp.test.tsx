import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./OperationsApp.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

describe('operations shell focused IA contract', () => {
  it('locks shell navigation and context switches on dirty drafts, not only overlay-open state', () => {
    expect(source).toContain('useShellInteractionLock');
    expect(source).toContain('const shellLock = useShellInteractionLock()');
    expect(source).toContain('const locked = shellLock.locked');
    expect(source).toContain("const dirtyDraftPrompt = '请先保存或放弃当前修改'");
    expect(source).toContain("shellLock.dirtyLocked && <Typography.Text type=\"warning\" {...testId('operations-shell-dirty-guard')}>{dirtyDraftPrompt}</Typography.Text>");
    expect(source).toContain('group.children.push({key: item.key, icon: menuIconByKey[item.key], label: item.page.menuLabel, disabled: locked})');
    expect(source).toContain("type: 'submenu' as const");
    expect(source).toContain('item.page.menuGroupIconKey');
    expect(source).toContain('if (locked) return;');
    expect(source).toContain("disabled={locked} onSelected={onRoleSelected}");
    expect(source).toContain('disabled={locked}');
    expect(source).toContain('onChanged={onEntry}');
    expect(source).toContain('const [siderCollapsed, setSiderCollapsed] = useState(false);');
    expect(source).toMatch(/<Layout\.Header className="operations-header">[\s\S]*?<Layout hasSider>/);
    expect(source).toContain('className="operations-header-leading"');
    expect(source).toContain('className="operations-header-brand"');
    expect(source).toContain('alt={`${entry.workspaceName}标识`}');
    expect(source).toContain('<Typography.Text className="operations-header-title">{entry.operationsTitle}</Typography.Text>');
    expect(styles).toContain('.operations-header-logo {\n  width: 64px;\n  height: 64px;');
    expect(source).toMatch(/<Layout hasSider>[\s\S]*?<Layout\.Sider[\s\S]*?<Layout\.Content/);
    expect(source).toContain('collapsible\n      collapsed={siderCollapsed}\n      onCollapse={(next) => { if (!locked) setSiderCollapsed(next); }}');
    expect(source).toMatch(/<Layout\.Sider[\s\S]*?theme="light"/);
    expect(source).toContain('className="operations-sider"\n      width={210}');
    expect(source).toContain('trigger={null}');
    expect(source).toContain('<CollapsedIcon');
    expect(source).toContain('className="operations-sider-collapsed-button"');
    expect(source).toContain("testId('operations-shell-toggle-sider')");
    expect(source).toContain('theme="light"\n        mode="inline"\n        inlineCollapsed={siderCollapsed}');
    expect(source).not.toContain('theme="dark"');
    expect(source).not.toContain('breakpoint="lg"');
    expect(source).toContain('<DataScopeSelector\n          entry={entry}');
    expect(source).toContain('collapsed={siderCollapsed}');
    expect(source).toContain('<OperationsRequiredScopeSurface requiredDataNodeType={selectedCatalogPage.requiredDataNodeType} scopeContext={entry.scopeContext}>');
    expect(source).toContain('</OperationsRequiredScopeSurface>');
    expect(source).toContain('const tabAssignmentRef = useRef<string | null>(null);');
    expect(source).toContain('if (tabAssignmentRef.current !== session.assignmentId)');
    expect(source).toContain('tabAssignmentRef.current = session.assignmentId;');
    expect(source).toContain('const retained = current.filter((key) => accessibleKeys.has(key));');
    expect(source).toContain('return retained.length ? retained : firstAccessibleKey ? [firstAccessibleKey] : [];');
  });

  it('still keeps page and menu labels sourced from catalog metadata instead of raw shell strings', () => {
    expect(source).toContain('label: item.page.menuLabel');
    expect(source).toContain('pageMeta.contentTabLabel');
    expect(source).not.toContain("testId('operations-shell-page-title')");
  });

  it('does not run protected session recovery while the anonymous login route is rendering', () => {
    expect(source).toContain('const anonymousLoginRoute = location.pathname === loginPath');
    expect(source).toContain('groupWorkspaceKey && !anonymousLoginRoute ? operationsAdminRtkRequest.getOperationsWorkspaceSessionEntry');
    expect(source).toContain('const sessionEntryLoaded = !sessionEntryRequest ||');
  });

  it('centers the initial role-selection card without changing the role-context component ownership', () => {
    expect(source).toContain('<main className="auth-page"><div className="auth-card"><RoleContextSelector entry={entry} variant="initial" onSelected={enterSelectedHome}/></div></main>');
    expect(styles).toContain('.auth-page,\n.login-layout {');
    expect(styles).toContain('place-items: center;');
    expect(styles).toContain('.auth-card,\n.login-card {');
  });

  it('places a mandatory password transition before role selection or the application shell', () => {
    expect(source).toContain("entry?.outcome === 'PASSWORD_CHANGE_REQUIRED'");
    expect(source).toContain('<OperationsForcedPasswordChangePage');
    expect(source).toContain('onCompleted={() => void logout()}');
  });
});
