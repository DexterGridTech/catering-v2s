import {ApartmentOutlined, AppstoreOutlined, FileTextOutlined, FullscreenExitOutlined, FullscreenOutlined, LogoutOutlined, ReloadOutlined, SafetyCertificateOutlined, SettingOutlined, TagsOutlined, TeamOutlined, UserOutlined} from '@ant-design/icons';
import {Alert, App, Button, Layout, Menu, Result, Space, Tabs, Typography} from 'antd';
import {AdminErrorBoundary, OverlayLockProvider, contextScopedQueryArgs, testId, useAsyncGenerationGuard, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {clearPlatformTransportState, platformClient, registerPlatformSessionRecovery} from './api/PlatformTransport';
import {PlatformLoginPage} from '../features/authentication/ui/PlatformLoginPage';
import {PlatformPasswordChangeDrawer} from '../features/authentication/ui/PlatformPasswordChangeDrawer';
import {PlatformPasswordChangeResult} from '../features/authentication/ui/PlatformPasswordChangeResult';
import {PlatformPasswordRecoveryCompletePage} from '../features/authentication/ui/PlatformPasswordRecoveryCompletePage';
import {PlatformPasswordRecoveryPasswordPage} from '../features/authentication/ui/PlatformPasswordRecoveryPasswordPage';
import {PlatformPasswordRecoveryVerifyPage} from '../features/authentication/ui/PlatformPasswordRecoveryVerifyPage';
import {platformPageRegistry} from './routing/pageRegistry';
import {platformAdminChromeProps} from './theme/platformAdminTheme';
import {WorkspaceScopeProvider, WorkspaceScopeSelector, useWorkspaceScope} from './state/WorkspaceScope';
import {useEffect, useMemo, useRef, useState} from 'react';
import {BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate} from 'react-router';
import '../styles.css';

type Session = {displayName: string; sessionVersion: number};

const menuIconByKey = {
  WORKSPACE: <AppstoreOutlined/>, ADMIN_USER: <TeamOutlined/>, OVERVIEW: <SettingOutlined/>,
  ORGANIZATION: <ApartmentOutlined/>, CONTRACT: <FileTextOutlined/>, ROLE: <SafetyCertificateOutlined/>,
  ACCOUNT: <UserOutlined/>, EXTENSION: <TagsOutlined/>,
} as const;

function Shell({session, logout}: {session: Session; logout: () => Promise<void>}) {
  const locked = useOverlayLock();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const registrations = Object.values(platformPageRegistry);
  const {selectedGroupWorkspaceKey} = useWorkspaceScope();
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
  return <Layout className="platform-shell" {...platformAdminChromeProps}>
    {!fullscreen && <Layout.Sider style={{display: 'flex', flexDirection: 'column'}}>
      <div className="brand">运维管理后台</div>
      <Menu style={{flex: 1}} theme="dark" selectedKeys={[page]} onClick={({key}) => { const target = platformPageRegistry[key as keyof typeof platformPageRegistry]; if (target) void navigate(target.path); }} items={registrations.map((entry) => ({key: entry.pageDesignKey, icon: menuIconByKey[entry.iconKey as keyof typeof menuIconByKey], label: entry.title, disabled: entry.workspaceRequirement === 'REQUIRED' && !selectedGroupWorkspaceKey}))}/>
      <div className="platform-workspace-selector"><WorkspaceScopeSelector/></div>
    </Layout.Sider>}
    <Layout>
      {!fullscreen && <Layout.Header className="platform-header"><Space><Typography.Text>平台管理员</Typography.Text><Typography.Text type="secondary">{session.displayName}</Typography.Text></Space><Space><Button type="text" disabled={locked} onClick={() => setPasswordOpen(true)}>修改密码</Button><Button type="text" icon={<LogoutOutlined/>} disabled={locked} onClick={() => void logout()}>退出登录</Button></Space></Layout.Header>}
      <Layout.Content className="platform-content">
        <Tabs
          className="platform-content-tabs" type="editable-card" hideAdd activeKey={page}
          onChange={(key) => void navigate(platformPageRegistry[key as keyof typeof platformPageRegistry].path)}
          onEdit={(key, action) => { if (action === 'remove') closePage(String(key)); }}
          tabBarExtraContent={<Space><Button type="text" icon={<ReloadOutlined/>} onClick={() => setPageReload((current) => current + 1)} {...testId('platform-shell-refresh-current')}>刷新当前页</Button><Button type="text" icon={fullscreen ? <FullscreenExitOutlined/> : <FullscreenOutlined/>} onClick={() => setFullscreen((current) => !current)} {...testId('platform-shell-toggle-fullscreen')}>{fullscreen ? '退出全屏' : '全屏显示当前页面'}</Button></Space>}
          items={openPages.map((key) => ({key, closable: openPages.length > 1, label: platformPageRegistry[key as keyof typeof platformPageRegistry].title}))}
        />
        <div className="platform-tab-body" key={`${page}-${workspaceContextKey}-${pageReload}`}>
          <Routes>{registrations.map((entry) => <Route key={entry.pageDesignKey} path={entry.path} element={entry.element}/>)}<Route path="*" element={<Navigate to="/platform/workspaces" replace/>}/></Routes>
        </div>
      </Layout.Content>
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
    ? <Alert type="info" showIcon message="正在恢复平台会话"/>
    : <>{session
    ? <WorkspaceScopeProvider><Shell session={session} logout={async () => {
      lifecycle.markBusinessIntentChanged();
      try {
        await platformClient.platformLogout({}, {headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
      } finally {
        clearLocalSession();
      }
    }}/></WorkspaceScopeProvider>
    : <Routes><Route path="/platform/login" element={<PlatformLoginPage onSession={(value) => { sessionInvalidating.current = false; setSession(value); void navigate('/platform/workspaces'); }}/>} /><Route path="/platform/password-recovery/verify" element={<PlatformPasswordRecoveryVerifyPage/>}/><Route path="/platform/password-recovery/password" element={<PlatformPasswordRecoveryPasswordPage/>}/><Route path="/platform/password-recovery/complete" element={<PlatformPasswordRecoveryCompletePage/>}/><Route path="*" element={<Navigate to="/platform/login" replace/>}/></Routes>}</>;
  return <App><OverlayLockProvider><AdminErrorBoundary
    resetKeys={[session?.sessionVersion]}
    fallback={({error, reset}) => <Result status="error" title="页面出现异常" subTitle={error.message} extra={<Button type="primary" onClick={reset}>重试页面</Button>}/>}
  >{content}</AdminErrorBoundary></OverlayLockProvider></App>;
}
export function PlatformApp() { return <BrowserRouter><Root/></BrowserRouter>; }
