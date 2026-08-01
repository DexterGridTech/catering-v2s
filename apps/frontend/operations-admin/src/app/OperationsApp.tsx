import {ApartmentOutlined, BankOutlined, ClusterOutlined, DashboardOutlined, FileTextOutlined, FullscreenExitOutlined, FullscreenOutlined, LogoutOutlined, ReloadOutlined, ShopOutlined, TagsOutlined, TeamOutlined} from '@ant-design/icons';
import {Alert, App, Button, Layout, Menu, Result, Space, Tabs, Typography} from 'antd';
import type {MenuProps} from 'antd';
import {AdminErrorBoundary, OverlayLockProvider, contextScopedQueryArgs, testId, useShellInteractionLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams} from 'react-router';
import {clearOperationsTransportState, operationsClient, operationsRtk, registerOperationsSessionRecovery} from './api/OperationsTransport';
import {operationsAdminRtkRequest} from './api/generated/operations-edge.rtk';
import {PublicInvitationEntry} from '../features/invitation-acceptance/ui/PublicInvitationEntry';
import {OperationsLoginPage} from '../features/authentication/ui/OperationsLoginPage';
import {OperationsPasswordRecoveryCompletePage} from '../features/authentication/ui/OperationsPasswordRecoveryCompletePage';
import {OperationsPasswordRecoveryPasswordPage} from '../features/authentication/ui/OperationsPasswordRecoveryPasswordPage';
import {OperationsPasswordRecoveryVerifyPage} from '../features/authentication/ui/OperationsPasswordRecoveryVerifyPage';
import {OperationsPasswordChangeDrawer} from '../features/authentication/ui/OperationsPasswordChangeDrawer';
import {OperationsPasswordChangeResult} from '../features/authentication/ui/OperationsPasswordChangeResult';
import {RoleContextSelector} from '../features/role-home-bootstrap/ui/RoleContextSelector';
import {DataScopeSelector} from '../features/role-home-bootstrap/ui/DataScopeSelector';
import {adminCatalog, operationsPageDesignKeys} from './catalog/generatedAdminCatalog';
import {operationsPageRegistry, parseOperationsPageDesignKey} from './routing/pageRegistry';
import type {OperationsPageDesignKey} from './catalog/generatedAdminCatalog';
import type {OperationsSession as Session} from './state/OperationsSession';
import type {WorkspaceSessionEntry} from './api/generated/operations-edge';
import '../styles.css';

const menuIconByKey = {
  [operationsPageDesignKeys.HomeGroup]: <DashboardOutlined/>,
  [operationsPageDesignKeys.HomeRegion]: <DashboardOutlined/>,
  [operationsPageDesignKeys.HomeProject]: <DashboardOutlined/>,
  [operationsPageDesignKeys.HomeHeadCompany]: <DashboardOutlined/>,
  [operationsPageDesignKeys.HomeStore]: <DashboardOutlined/>,
  [operationsPageDesignKeys.PgOrgStructure]: <ApartmentOutlined/>,
  [operationsPageDesignKeys.PgOrgBrand]: <TagsOutlined/>,
  [operationsPageDesignKeys.PgOrgTenant]: <BankOutlined/>,
  [operationsPageDesignKeys.PgOrgHeadCompany]: <ClusterOutlined/>,
  [operationsPageDesignKeys.PgOrgStoreManage]: <ShopOutlined/>,
  [operationsPageDesignKeys.PgContractStoreManage]: <FileTextOutlined/>,
  [operationsPageDesignKeys.PgIamGroupUsers]: <TeamOutlined/>,
  [operationsPageDesignKeys.PgIamRegionUsers]: <TeamOutlined/>,
  [operationsPageDesignKeys.PgIamProjectUsers]: <TeamOutlined/>,
  [operationsPageDesignKeys.PgIamHeadCompanyUsers]: <TeamOutlined/>,
  [operationsPageDesignKeys.PgIamStoreUsers]: <TeamOutlined/>,
  [operationsPageDesignKeys.PgStoreProfile]: <ShopOutlined/>,
} satisfies Partial<Record<OperationsPageDesignKey, ReactNode>>;

const dirtyDraftPrompt = '请先保存或放弃当前修改';

function Shell({
  session,
  entry,
  onLogout,
  onEntry,
  onRoleSelected,
}: {
  session: Session;
  entry: WorkspaceSessionEntry;
  onLogout: () => Promise<void>;
  onEntry: (next: WorkspaceSessionEntry) => void;
  onRoleSelected: (next: WorkspaceSessionEntry) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const shellLock = useShellInteractionLock();
  const locked = shellLock.locked;
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [openPages, setOpenPages] = useState<OperationsPageDesignKey[]>([]);
  const [pageReload, setPageReload] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [brandLogoBroken, setBrandLogoBroken] = useState(false);
  const catalogByKey = useMemo(() => new Map(adminCatalog.operationsPages.map((page) => [page.pageDesignKey, page])), []);
  const accessiblePages = useMemo<Array<{key: OperationsPageDesignKey; page: (typeof adminCatalog.operationsPages)[number]}>>(() => session.pageAccessKeys.flatMap((key) => {
    const page = catalogByKey.get(key);
    return page ? [{key, page}] : [];
  }).sort((left, right) => left.page.menuOrder - right.page.menuOrder), [catalogByKey, session.pageAccessKeys]);
  const accessibleMenuPages = useMemo(() => accessiblePages.filter(({key}) => menuIconByKey[key]), [accessiblePages]);
  const menuItems = useMemo<MenuProps['items']>(() => {
    const groups = new Map<string, Array<{key: OperationsPageDesignKey; icon: ReactNode; label: string; disabled?: boolean}>>();
    for (const item of accessibleMenuPages) {
      const children = groups.get(item.page.menuGroupLabel) ?? [];
      children.push({key: item.key, icon: menuIconByKey[item.key], label: item.page.menuLabel, disabled: locked});
      groups.set(item.page.menuGroupLabel, children);
    }
    return [...groups].map(([label, children]) => ({type: 'group' as const, label, children}));
  }, [accessibleMenuPages, locked]);
  const basePath = `/operations/${encodeURIComponent(session.groupWorkspaceKey)}`;
  const routeSegment = location.pathname.startsWith(`${basePath}/`) ? location.pathname.slice(basePath.length + 1) : '';
  const selected = accessiblePages.find(({key}) => operationsPageRegistry[key].routeSegment === routeSegment)?.key;
  useEffect(() => {
    if ((!routeSegment || !selected) && accessiblePages.length) {
      void navigate(`${basePath}/${operationsPageRegistry[accessiblePages[0].key].routeSegment}`, {replace: true});
    }
  }, [accessiblePages, basePath, navigate, routeSegment, selected]);
  useEffect(() => { setBrandLogoBroken(false); }, [entry.logoUrl]);
  useEffect(() => {
    const firstAccessibleKey = accessiblePages[0]?.key;
    setOpenPages(firstAccessibleKey ? [firstAccessibleKey] : []);
  }, [accessiblePages, session.assignmentId]);
  useEffect(() => {
    if (!selected) return;
    setOpenPages((current) => current.includes(selected) ? current : [...current, selected]);
  }, [selected]);
  const queryContext = useMemo(() => contextScopedQueryArgs({}, {
    groupWorkspaceKey: session.groupWorkspaceKey,
    expectedContextVersion: session.contextVersion,
    identityKey: undefined,
    scopeRef: session.visibleDataNodeId ?? undefined,
  }), [session.assignmentId, session.contextVersion, session.groupWorkspaceKey, session.visibleDataNodeId]);
  const registration = selected ? operationsPageRegistry[selected] : undefined;
  const selectedCatalogPage = selected ? catalogByKey.get(selected) : undefined;
  const currentPageKey = selected ?? accessiblePages[0]?.key;
  const pageBodyKey = `${currentPageKey ?? 'none'}-${session.assignmentId}-${session.contextVersion}-${pageReload}`;
  const closePage = (target: OperationsPageDesignKey) => {
    if (openPages.length === 1 || locked) return;
    const index = openPages.indexOf(target);
    const next = openPages.filter((key) => key !== target);
    setOpenPages(next);
    if (target === selected) {
      const nextKey = next[Math.min(index, next.length - 1)];
      if (nextKey) void navigate(`${basePath}/${operationsPageRegistry[nextKey].routeSegment}`);
    }
  };
  const page = registration && selectedCatalogPage
    ? <><Typography.Title level={2} {...testId('operations-shell-page-title')}>{selectedCatalogPage.pageTitle}</Typography.Title><registration.Component key={session.contextVersion} queryContext={queryContext} actionCapabilityKeys={session.actionCapabilityKeys}/></>
    : <Alert type="info" message={routeSegment ? '当前角色没有该页面准入' : '当前角色没有页面准入'}/>;
  return <Layout className="operations-shell" style={{height: '100vh', overflow: 'hidden'}}>
    {!fullscreen && <Layout.Sider breakpoint="lg" collapsedWidth="0" style={{display: 'flex', flexDirection: 'column'}}>
      <div className="brand operations-brand" style={{gap: 12}} {...testId('operations-shell-brand')}>
        {entry.logoUrl && !brandLogoBroken
          ? <img src={entry.logoUrl} alt="" style={{width: 32, height: 32, objectFit: 'contain'}} onError={() => setBrandLogoBroken(true)}/>
          : <DashboardOutlined style={{fontSize: 24}}/>}
        <div style={{minWidth: 0, display: 'flex', flexDirection: 'column'}}>
          <div style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{entry.workspaceName}</div>
          <Typography.Text type="secondary">{entry.operationsTitle}</Typography.Text>
        </div>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={selected ? [selected] : []}
        onClick={({key}) => {
          if (locked) return;
          const pageKey = parseOperationsPageDesignKey(key);
          if (pageKey) void navigate(`${basePath}/${operationsPageRegistry[pageKey].routeSegment}`);
        }}
        items={menuItems}
        {...testId('operations-shell-menu')}
      />
      <DataScopeSelector
        entry={entry}
        page={selectedCatalogPage ? {
          requiredDataNodeType: selectedCatalogPage.requiredDataNodeType,
          noDataNodePrompt: selectedCatalogPage.noDataNodePrompt,
          noCandidatePrompt: selectedCatalogPage.noCandidatePrompt,
          cascadeLevelLabels: selectedCatalogPage.cascadeLevelLabels,
        } : undefined}
        disabled={locked}
        onChanged={onEntry}
      />
    </Layout.Sider>}
    <Layout>
      {!fullscreen && <Layout.Header className="operations-header">
        <Space direction="vertical" size={0} align="start">
          <RoleContextSelector entry={entry} variant="header" disabled={locked} onSelected={onRoleSelected}/>
          {shellLock.dirtyLocked && <Typography.Text type="warning" {...testId('operations-shell-dirty-guard')}>{dirtyDraftPrompt}</Typography.Text>}
        </Space>
        <Space>
          <Button type="text" disabled={locked} onClick={() => setPasswordOpen(true)} {...testId('operations-shell-change-password')}>修改密码</Button>
          <Button type="text" icon={<LogoutOutlined/>} disabled={locked} onClick={() => void onLogout()} {...testId('operations-shell-logout')}>退出登录</Button>
        </Space>
      </Layout.Header>}
      <Layout.Content className="operations-content" style={{minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '12px 16px 16px', overflow: 'hidden'}}>
        <Tabs
          className="operations-content-tabs"
          type="editable-card"
          hideAdd
          activeKey={currentPageKey}
          onChange={(key) => {
            if (locked) return;
            const pageKey = parseOperationsPageDesignKey(key);
            if (pageKey) void navigate(`${basePath}/${operationsPageRegistry[pageKey].routeSegment}`);
          }}
          onEdit={(key, action) => {
            if (action !== 'remove') return;
            const pageKey = parseOperationsPageDesignKey(String(key));
            if (pageKey) closePage(pageKey);
          }}
          tabBarExtraContent={<Space>
            <Button type="text" icon={<ReloadOutlined/>} disabled={locked || !currentPageKey} onClick={() => setPageReload((current) => current + 1)} {...testId('operations-shell-refresh-current')}>刷新当前页</Button>
            <Button type="text" icon={fullscreen ? <FullscreenExitOutlined/> : <FullscreenOutlined/>} disabled={locked} onClick={() => setFullscreen((current) => !current)} {...testId('operations-shell-toggle-fullscreen')}>{fullscreen ? '退出全屏' : '全屏显示当前页面'}</Button>
          </Space>}
          items={openPages.flatMap((key) => {
            const pageMeta = catalogByKey.get(key);
            return pageMeta ? [{key, closable: openPages.length > 1 && !locked, label: pageMeta.contentTabLabel}] : [];
          })}
          {...testId('operations-shell-tabs')}
        />
        <div className="operations-tab-body" key={pageBodyKey} style={{minHeight: 0, flex: '1 1 auto', overflow: 'auto', padding: 4}} {...testId('operations-shell-tab-body')}>
          {page}
        </div>
      </Layout.Content>
    </Layout>
    <OperationsPasswordChangeDrawer open={passwordOpen} queryContext={queryContext} onClose={() => setPasswordOpen(false)} onChanged={() => { setPasswordOpen(false); setPasswordChanged(true); }}/>
    <OperationsPasswordChangeResult open={passwordChanged} onReauthenticate={() => { setPasswordChanged(false); void onLogout(); }}/>
  </Layout>;
}

function InvitationRoute() { const {groupWorkspaceKey, invitationToken} = useParams(); return <PublicInvitationEntry groupWorkspaceKey={groupWorkspaceKey ?? ''} invitationToken={invitationToken ?? ''}/>; }
function RecoveryVerifyRoute() { const {groupWorkspaceKey} = useParams(); return <OperationsPasswordRecoveryVerifyPage groupWorkspaceKey={groupWorkspaceKey ?? ''}/>; }
function RecoveryPasswordRoute() { const {groupWorkspaceKey} = useParams(); return <OperationsPasswordRecoveryPasswordPage groupWorkspaceKey={groupWorkspaceKey ?? ''}/>; }
function RecoveryCompleteRoute() { const {groupWorkspaceKey} = useParams(); return <OperationsPasswordRecoveryCompletePage groupWorkspaceKey={groupWorkspaceKey ?? ''}/>; }
function toSession(entry: WorkspaceSessionEntry): Session | undefined {
  if (!entry.selected) return undefined;
  return {
    groupWorkspaceKey: entry.groupWorkspaceKey,
    assignmentId: entry.selected.roleAssignmentRef,
    visibleDataNodeId: entry.selectedDataNode?.dataNodeRef ?? null,
    contextVersion: entry.contextVersion,
    pageAccessKeys: entry.selected.pageDesignKeys.flatMap((key) => {
      const parsed = parseOperationsPageDesignKey(key);
      return parsed ? [parsed] : [];
    }),
    actionCapabilityKeys: entry.actionGrants,
  };
}
function WorkspaceRoute() {
  const {groupWorkspaceKey} = useParams();
  const navigate = useNavigate();
  const [entryOverride, setEntryOverride] = useState<WorkspaceSessionEntry | null>(null);
  const lifecycle = useSubmissionLifecycle();
  const sessionInvalidating = useRef(false);
  const sessionEntryRequest = useMemo(
    () => groupWorkspaceKey ? operationsAdminRtkRequest.getOperationsWorkspaceSessionEntry({groupWorkspaceKey}, {}) : undefined,
    [groupWorkspaceKey],
  );
  const sessionEntryQuery = operationsRtk.useGetOperationsWorkspaceSessionEntryQuery(sessionEntryRequest!, {skip: !sessionEntryRequest});
  const entry = entryOverride ?? sessionEntryQuery.data ?? null;
  const session = entry ? toSession(entry) : undefined;
  const sessionEntryLoaded = entryOverride !== null || sessionEntryQuery.isSuccess || sessionEntryQuery.isError;
  const clearLocalSession = () => {
    clearOperationsTransportState();
    setEntryOverride(null);
  };
  useEffect(() => registerOperationsSessionRecovery(async () => {
    if (sessionInvalidating.current) return;
    sessionInvalidating.current = true;
    clearLocalSession();
    if (groupWorkspaceKey) await navigate(`/operations/${encodeURIComponent(groupWorkspaceKey)}/login`, {replace: true});
  }), [groupWorkspaceKey, navigate]);
  useEffect(() => {
    sessionInvalidating.current = false;
    setEntryOverride(null);
  }, [groupWorkspaceKey]);
  const logout = async () => {
    if (!session) return;
    lifecycle.markBusinessIntentChanged();
    try {
      await operationsClient.operationsWorkspaceLogout(
        {groupWorkspaceKey: session.groupWorkspaceKey},
        {headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}},
      );
    } finally {
      clearLocalSession();
    }
  };
  if (!groupWorkspaceKey) return <Navigate to="/operations" replace/>;
  if (!sessionEntryLoaded) return <Alert type="info" message="正在恢复运营上下文"/>;
  const enterSelectedHome = (next: WorkspaceSessionEntry) => {
    setEntryOverride(next);
    const selectedSession = toSession(next);
    const page = selectedSession?.pageAccessKeys[0];
    if (page) void navigate(`/operations/${encodeURIComponent(next.groupWorkspaceKey)}/${operationsPageRegistry[page].routeSegment}`, {replace: true});
  };
  if (entry && !session) return <RoleContextSelector entry={entry} variant="initial" onSelected={enterSelectedHome}/>;
  return session && entry ? <Shell session={session} entry={entry} onLogout={logout} onEntry={setEntryOverride} onRoleSelected={enterSelectedHome}/> : <OperationsLoginPage groupWorkspaceKey={groupWorkspaceKey} onEntry={(next) => {
    sessionInvalidating.current = false;
    enterSelectedHome(next);
  }}/>;
}

function OperationsRoot() { return <App><OverlayLockProvider><AdminErrorBoundary
  fallback={({error, reset}) => <Result status="error" title="页面出现异常" subTitle={error.message} extra={<Button type="primary" onClick={reset}>重试页面</Button>}/>}
><Routes>
  <Route path="/operations/invitations/:groupWorkspaceKey/:invitationToken" element={<InvitationRoute/>}/>
  <Route path="/operations/:groupWorkspaceKey/password-recovery" element={<RecoveryVerifyRoute/>}/>
  <Route path="/operations/:groupWorkspaceKey/password-recovery/password" element={<RecoveryPasswordRoute/>}/>
  <Route path="/operations/:groupWorkspaceKey/password-recovery/complete" element={<RecoveryCompleteRoute/>}/>
  <Route path="/operations/:groupWorkspaceKey/*" element={<WorkspaceRoute/>}/>
  <Route path="*" element={<Navigate to="/operations/unknown/login" replace/>}/>
</Routes></AdminErrorBoundary></OverlayLockProvider></App>; }
export function OperationsApp() { return <BrowserRouter><OperationsRoot/></BrowserRouter>; }
