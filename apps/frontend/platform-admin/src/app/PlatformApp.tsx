import {ApartmentOutlined, AppstoreOutlined, DashboardOutlined, DownOutlined, FileTextOutlined, FullscreenExitOutlined, FullscreenOutlined, LogoutOutlined, ReloadOutlined, SafetyCertificateOutlined, SettingOutlined, TagsOutlined, TeamOutlined, UserOutlined} from '@ant-design/icons';
import {Alert, App, Avatar, Button, Dropdown, Layout, Menu, Result, Space, Tabs, Typography, type MenuProps} from 'antd';
import {CollapsedIcon} from '@ant-design/pro-components/es/layout/components/CollapsedIcon';
import {AdminErrorBoundary, OverlayLockProvider, contextScopedQueryArgs, testId, useAsyncGenerationGuard, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {clearPlatformTransportState, platformClient, registerPlatformSessionRecovery} from './api/PlatformTransport';
import {PlatformLoginPage} from '../features/authentication/ui/PlatformLoginPage';
import {PlatformPasswordChangeDrawer} from '../features/authentication/ui/PlatformPasswordChangeDrawer';
import {PlatformPasswordChangeResult} from '../features/authentication/ui/PlatformPasswordChangeResult';
import {PlatformPasswordRecoveryCompletePage} from '../features/authentication/ui/PlatformPasswordRecoveryCompletePage';
import {PlatformPasswordRecoveryPasswordPage} from '../features/authentication/ui/PlatformPasswordRecoveryPasswordPage';
import {PlatformPasswordRecoveryVerifyPage} from '../features/authentication/ui/PlatformPasswordRecoveryVerifyPage';
import {platformPageRegistry} from './routing/pageRegistry';
import {adminCatalog, platformShellCopyKeys} from './catalog/generatedAdminCatalog';
import {platformAdminChromeProps} from './theme/platformAdminTheme';
import {WorkspaceScopeProvider, WorkspaceScopeSelector, useWorkspaceScope} from './state/WorkspaceScope';
import {PlatformSessionProvider} from './state/PlatformSession';
import {useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent} from 'react';
import {BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate} from 'react-router';
import '../styles.css';

type Session = {displayName: string; sessionVersion: number};

const menuIconByKey = {
  WORKSPACE: <AppstoreOutlined/>, ADMIN_USER: <TeamOutlined/>, OVERVIEW: <DashboardOutlined/>,
  ORGANIZATION: <ApartmentOutlined/>, CONTRACT: <FileTextOutlined/>, ROLE: <SafetyCertificateOutlined/>,
  ACCOUNT: <UserOutlined/>, EXTENSION: <TagsOutlined/>,
} as const;

function Shell({session, logout}: {session: Session; logout: () => Promise<void>}) {
  const locked = useOverlayLock();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const registrations = Object.values(platformPageRegistry).sort((left, right) => left.menuOrder - right.menuOrder);
  const {selectedGroupWorkspaceKey} = useWorkspaceScope();
  const [siderCollapsed, setSiderCollapsed] = useState(false);
  const menuItems = useMemo<MenuProps['items']>(() => {
    const topLevel = registrations
      .filter((entry) => entry.workspaceRequirement !== 'REQUIRED')
      .map((entry) => ({key: entry.pageDesignKey, icon: menuIconByKey[entry.iconKey as keyof typeof menuIconByKey], label: entry.title}));
    const workspaceDetails = registrations
      .filter((entry) => entry.workspaceRequirement === 'REQUIRED')
      .map((entry) => ({key: entry.pageDesignKey, icon: menuIconByKey[entry.iconKey as keyof typeof menuIconByKey], label: entry.title, disabled: !selectedGroupWorkspaceKey}));
    const workspaceDetailGroupKey = workspaceDetails.map((entry) => entry.key).join('|');
    return [...topLevel, {type: 'submenu' as const, key: workspaceDetailGroupKey, icon: <SettingOutlined/>, label: adminCatalog.platformShellCopy[platformShellCopyKeys.PlatformShellWorkspaceDetailGroup], children: workspaceDetails}];
  }, [registrations, selectedGroupWorkspaceKey]);
  const page = registrations.find((entry) => location.pathname === entry.path)?.pageDesignKey ?? registrations[0].pageDesignKey;
  const [openPages, setOpenPages] = useState<string[]>([page]);
  const [pageReload, setPageReload] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const workspaceContextKey = useMemo(() => selectedGroupWorkspaceKey
    ? contextScopedQueryArgs({}, {groupWorkspaceKey: selectedGroupWorkspaceKey}).groupWorkspaceKey
    : 'GLOBAL', [selectedGroupWorkspaceKey]);
  useEffect(() => { setOpenPages((current) => current.includes(page) ? current : [...current, page]); }, [page]);
  useEffect(() => { setPageReload((current) => current + 1); }, [workspaceContextKey]);
  const closePage = (target: string) => {
    if (openPages.length === 1) return;
    const index = openPages.indexOf(target);
    const next = openPages.filter((key) => key !== target);
    setOpenPages(next);
    if (target === page) {
      const nextKey = next[Math.min(index, next.length - 1)];
      void navigate(platformPageRegistry[nextKey as keyof typeof platformPageRegistry].path);
    }
  };
  const principalMenu: MenuProps = {
    items: [
      {key: 'change-password', label: adminCatalog.platformShellCopy[platformShellCopyKeys.PlatformShellChangePassword]},
      {key: 'logout', icon: <LogoutOutlined/>, label: adminCatalog.platformShellCopy[platformShellCopyKeys.PlatformShellLogout]},
    ],
    onClick: ({key}) => {
      if (key === 'change-password') setPasswordOpen(true);
      if (key === 'logout') void logout();
    },
  };
  return <Layout className="platform-shell" {...platformAdminChromeProps}>
    {!fullscreen && <Layout.Header className="platform-header"><Typography.Text className="platform-brand">{adminCatalog.platformShellCopy[platformShellCopyKeys.PlatformShellBrand]}</Typography.Text><Space align="center"><WorkspaceScopeSelector/><Dropdown menu={principalMenu} trigger={['click']} disabled={locked}><Button type="text" className="platform-principal" disabled={locked} aria-label={`平台管理员 ${session.displayName}`}><Avatar size="small" icon={<UserOutlined/>}/><span>{session.displayName}</span><DownOutlined aria-hidden="true"/></Button></Dropdown></Space></Layout.Header>}
    <Layout hasSider>
      {!fullscreen && <Layout.Sider
        className="platform-sider"
        collapsible
        collapsed={siderCollapsed}
        onCollapse={(next) => { if (!locked) setSiderCollapsed(next); }}
        theme="light"
        trigger={null}
        styles={{body: {display: 'flex', height: '100%', flexDirection: 'column'}}}
      >
        <CollapsedIcon
          className="platform-sider-collapsed-button"
          collapsed={siderCollapsed}
          role="button"
          tabIndex={locked ? -1 : 0}
          aria-label={siderCollapsed ? '展开菜单' : '收起菜单'}
          aria-disabled={locked}
          onClick={() => { if (!locked) setSiderCollapsed((current) => !current); }}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (!locked && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              setSiderCollapsed((current) => !current);
            }
          }}
          {...testId('platform-shell-toggle-sider')}
        />
        <Menu style={{flex: 1}} theme="light" mode="inline" inlineCollapsed={siderCollapsed} defaultOpenKeys={(menuItems ?? []).filter((item) => item?.type === 'submenu').map((item) => String(item?.key))} selectedKeys={[page]} onClick={({key}) => { const target = platformPageRegistry[key as keyof typeof platformPageRegistry]; if (target) void navigate(target.path); }} items={menuItems}/>
      </Layout.Sider>}
      <Layout>
        <Layout.Content className="platform-content">
        <Tabs
          className="platform-content-tabs" type="editable-card" hideAdd activeKey={page}
          onChange={(key) => void navigate(platformPageRegistry[key as keyof typeof platformPageRegistry].path)}
          onEdit={(key, action) => { if (action === 'remove') closePage(String(key)); }}
          tabBarExtraContent={<Space><Button type="text" aria-label="刷新当前页" icon={<ReloadOutlined/>} onClick={() => setPageReload((current) => current + 1)} {...testId('platform-shell-refresh-current')}/><Button type="text" aria-label={fullscreen ? '退出全屏' : '全屏显示当前页面'} icon={fullscreen ? <FullscreenExitOutlined/> : <FullscreenOutlined/>} onClick={() => setFullscreen((current) => !current)} {...testId('platform-shell-toggle-fullscreen')}/></Space>}
          items={openPages.map((key) => ({key, closable: openPages.length > 1, label: platformPageRegistry[key as keyof typeof platformPageRegistry].title}))}
        />
        <div className="platform-tab-body" key={`${page}-${workspaceContextKey}-${pageReload}`}>
          <Routes>{registrations.map((entry) => <Route key={entry.pageDesignKey} path={entry.path} element={entry.element}/>)}<Route path="*" element={<Navigate to="/platform/workspaces" replace/>}/></Routes>
        </div>
        </Layout.Content>
      </Layout>
    </Layout><PlatformPasswordChangeDrawer open={passwordOpen} sessionVersion={session.sessionVersion} onClose={() => setPasswordOpen(false)} onChanged={() => { setPasswordOpen(false); setPasswordChanged(true); }}/><PlatformPasswordChangeResult open={passwordChanged} onReauthenticate={() => { setPasswordChanged(false); void logout(); }}/>
  </Layout>;
}

function Root() {
  const [session, setSession] = useState<Session>();
  const [recovering, setRecovering] = useState(true);
  const navigate = useNavigate();
  const lifecycle = useSubmissionLifecycle();
  const generation = useAsyncGenerationGuard();
  const sessionInvalidating = useRef(false);
  const refreshSession = useCallback(async () => {
    const request = generation.begin();
    try {
      const next = await platformClient.getCurrentPlatformSession({}, {});
      if (generation.isCurrent(request)) setSession(next);
    } catch {
      // Keep the current shell name on transient refresh failure; unauthorized
      // responses still use the registered session recovery path.
    }
  }, [generation]);
  const clearLocalSession = () => {
    clearPlatformTransportState();
    setSession(undefined);
  };
  useEffect(() => registerPlatformSessionRecovery(async () => {
    if (sessionInvalidating.current) return;
    sessionInvalidating.current = true;
    clearLocalSession();
    await navigate('/platform/login', {replace: true});
  }), [navigate]);
  useEffect(() => {
    const request = generation.begin();
    setRecovering(true);
    void platformClient.getCurrentPlatformSession({}, {})
      .then((next) => { if (generation.isCurrent(request)) setSession(next); })
      .catch(() => { if (generation.isCurrent(request)) setSession(undefined); })
      .finally(() => { if (generation.isCurrent(request)) setRecovering(false); });
  }, [generation]);
  const content = recovering
    ? <Alert type="info" showIcon title="正在恢复平台会话"/>
    : <>{session
    ? <PlatformSessionProvider refresh={refreshSession}><WorkspaceScopeProvider><Shell session={session} logout={async () => {
      lifecycle.markBusinessIntentChanged();
      try {
        await platformClient.platformLogout({}, {headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
      } finally {
        clearLocalSession();
      }
    }}/></WorkspaceScopeProvider></PlatformSessionProvider>
    : <Routes><Route path="/platform/login" element={<PlatformLoginPage onSession={(value) => { sessionInvalidating.current = false; setSession(value); void navigate('/platform/workspaces'); }}/>} /><Route path="/platform/password-recovery/verify" element={<PlatformPasswordRecoveryVerifyPage/>}/><Route path="/platform/password-recovery/password" element={<PlatformPasswordRecoveryPasswordPage/>}/><Route path="/platform/password-recovery/complete" element={<PlatformPasswordRecoveryCompletePage/>}/><Route path="*" element={<Navigate to="/platform/login" replace/>}/></Routes>}</>;
  return <App><OverlayLockProvider><AdminErrorBoundary
    resetKeys={[session?.sessionVersion]}
    fallback={({reset}) => <Result status="error" title="页面暂时无法显示" subTitle="请重试当前页面。" extra={<Button type="primary" onClick={reset}>重试页面</Button>}/>}
  >{content}</AdminErrorBoundary></OverlayLockProvider></App>;
}
export function PlatformApp() { return <BrowserRouter><Root/></BrowserRouter>; }
