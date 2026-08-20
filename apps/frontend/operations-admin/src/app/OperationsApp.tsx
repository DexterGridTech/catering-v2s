import {
  ApartmentOutlined,
  BankOutlined,
  ClusterOutlined,
  DashboardOutlined,
  DownOutlined,
  FileTextOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  LogoutOutlined,
  ReloadOutlined,
  ShopOutlined,
  TagsOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {Alert, App, Avatar, Button, Dropdown, Layout, Menu, Result, Space, Tabs, Typography} from 'antd';
import type {MenuProps} from 'antd';
import {CollapsedIcon} from '@ant-design/pro-components/es/layout/components/CollapsedIcon';
import {
  AdminErrorBoundary,
  OverlayLockProvider,
  contextScopedQueryArgs,
  testId,
  useShellInteractionLock,
  useSubmissionLifecycle,
} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode} from 'react';
import {BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams} from 'react-router';
import {
  clearOperationsTransportState,
  operationsClient,
  operationsRtk,
  recordOperationsRenderError,
  refreshOperationsCurrentPage,
  registerOperationsContextStaleRecovery,
  registerOperationsSessionRecovery,
} from './api/OperationsTransport';
import {operationsAdminRtkRequest} from './api/generated/operations-edge.rtk';
import {PublicInvitationEntry} from '../features/invitation-acceptance/ui/PublicInvitationEntry';
import {OperationsLoginPage} from '../features/authentication/ui/OperationsLoginPage';
import * as RecoveryCompletePageModule from '../features/authentication/ui/OperationsPasswordRecoveryCompletePage';
import * as RecoveryPasswordPageModule from '../features/authentication/ui/OperationsPasswordRecoveryPasswordPage';
import {OperationsPasswordRecoveryVerifyPage} from '../features/authentication/ui/OperationsPasswordRecoveryVerifyPage';
import {OperationsPasswordChangeDrawer} from '../features/authentication/ui/OperationsPasswordChangeDrawer';
import {OperationsPasswordChangeResult} from '../features/authentication/ui/OperationsPasswordChangeResult';
import {OperationsForcedPasswordChangePage} from '../features/authentication/ui/OperationsForcedPasswordChangePage';
import {RoleContextSelector} from '../features/role-home-bootstrap/ui/RoleContextSelector';
import {DataScopeSelector} from '../features/role-home-bootstrap/ui/DataScopeSelector';
import {adminCatalog, operationsPageDesignKeys} from './catalog/generatedAdminCatalog';
import {
  matchOperationsRoute,
  operationsPageRegistry,
  parseOperationsPageDesignKey,
  routeForOperationsPage,
} from './routing/pageRegistry';
import type {OperationsPageDesignKey} from './catalog/generatedAdminCatalog';
import type {OperationsSession as Session} from './state/OperationsSession';
import {operationsStore} from './state/OperationsStore';
import {clearOwnerScopeContext, replaceOwnerScopeContext} from './state/OperationsScopeContext';
import {OperationsRequiredScopeSurface} from './components/OperationsRequiredScopeSurface';
import type {WorkspaceSessionEntry} from './api/generated/operations-edge';
import {operationsAdminChromeProps} from './theme/operationsAdminTheme';
import '../styles.css';

const {OperationsPasswordRecoveryCompletePage} = RecoveryCompletePageModule;
const {OperationsPasswordRecoveryPasswordPage} = RecoveryPasswordPageModule;

const menuIconByKey = {
  [operationsPageDesignKeys.HomeGroup]: <DashboardOutlined />,
  [operationsPageDesignKeys.HomeRegion]: <DashboardOutlined />,
  [operationsPageDesignKeys.HomeProject]: <DashboardOutlined />,
  [operationsPageDesignKeys.HomeHeadCompany]: <DashboardOutlined />,
  [operationsPageDesignKeys.HomeStore]: <DashboardOutlined />,
  [operationsPageDesignKeys.PgOrgStructure]: <ApartmentOutlined />,
  [operationsPageDesignKeys.PgOrgBrand]: <TagsOutlined />,
  [operationsPageDesignKeys.PgOrgTenant]: <BankOutlined />,
  [operationsPageDesignKeys.PgOrgHeadCompany]: <ClusterOutlined />,
  [operationsPageDesignKeys.PgOrgStoreManage]: <ShopOutlined />,
  [operationsPageDesignKeys.PgContractStoreManage]: <FileTextOutlined />,
  [operationsPageDesignKeys.PgIamGroupUsers]: <TeamOutlined />,
  [operationsPageDesignKeys.PgIamRegionUsers]: <TeamOutlined />,
  [operationsPageDesignKeys.PgIamProjectUsers]: <TeamOutlined />,
  [operationsPageDesignKeys.PgIamHeadCompanyUsers]: <TeamOutlined />,
  [operationsPageDesignKeys.PgIamStoreUsers]: <TeamOutlined />,
  [operationsPageDesignKeys.PgStoreProfile]: <ShopOutlined />,
  [operationsPageDesignKeys.PgBusinessChannelProject]: <ShopOutlined />,
  [operationsPageDesignKeys.PgBusinessChannelStore]: <ShopOutlined />,
  [operationsPageDesignKeys.PgCatalogStoreItems]: <TagsOutlined />,
  [operationsPageDesignKeys.PgInventoryStoreStatus]: <ShopOutlined />,
  [operationsPageDesignKeys.PgCatalogBrandItems]: <TagsOutlined />,
} satisfies Partial<Record<OperationsPageDesignKey, ReactNode>>;

const navigationIconByKey = {
  WORKBENCH: <DashboardOutlined />,
  ACCESS: <TeamOutlined />,
  ORGANIZATION: <ApartmentOutlined />,
  STORE_OPERATIONS: <ShopOutlined />,
  CATALOG_SERVICES: <TagsOutlined />,
} as const;

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
  const tabAssignmentRef = useRef<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [siderCollapsed, setSiderCollapsed] = useState(false);
  const [brandLogoBroken, setBrandLogoBroken] = useState(false);
  const catalogByKey = useMemo(() => new Map(adminCatalog.operationsPages.map(page => [page.pageDesignKey, page])), []);
  const accessiblePages = useMemo<
    Array<{key: OperationsPageDesignKey; page: (typeof adminCatalog.operationsPages)[number]}>
  >(
    () =>
      session.pageAccessKeys
        .flatMap(key => {
          const page = catalogByKey.get(key);
          return page ? [{key, page}] : [];
        })
        .sort((left, right) => left.page.menuOrder - right.page.menuOrder),
    [catalogByKey, session.pageAccessKeys],
  );
  const accessibleMenuPages = useMemo(() => accessiblePages.filter(({key}) => menuIconByKey[key]), [accessiblePages]);
  const menuItems = useMemo<MenuProps['items']>(() => {
    type MenuChild = {key: OperationsPageDesignKey; icon: ReactNode; label: string; disabled?: boolean};
    const groups = new Map<string, {label: string; icon: ReactNode; children: MenuChild[]}>();
    for (const item of accessibleMenuPages) {
      const group = groups.get(item.page.menuGroupKey) ?? {
        label: item.page.menuGroupLabel,
        icon: navigationIconByKey[item.page.menuGroupIconKey as keyof typeof navigationIconByKey],
        children: [] as MenuChild[],
      };
      group.children.push({key: item.key, icon: menuIconByKey[item.key], label: item.page.menuLabel, disabled: locked});
      groups.set(item.page.menuGroupKey, group);
    }
    return [...groups].map(([key, group]) => ({
      type: 'submenu' as const,
      key,
      icon: group.icon,
      label: group.label,
      children: group.children,
    }));
  }, [accessibleMenuPages, locked]);
  const basePath = `/operations/${encodeURIComponent(session.groupWorkspaceKey)}`;
  const routeSegment = location.pathname.startsWith(`${basePath}/`) ? location.pathname.slice(basePath.length + 1) : '';
  const routeMatch = matchOperationsRoute(routeSegment);
  const selected = routeMatch && accessiblePages.some(({key}) => key === routeMatch.key) ? routeMatch.key : undefined;
  const scopeRefForPage = useCallback(
    (pageKey: OperationsPageDesignKey) => {
      const page = catalogByKey.get(pageKey);
      return page?.requiredDataNodeType === 'REGION'
        ? entry.scopeContext?.region?.dataNodeRef
        : page?.requiredDataNodeType === 'PROJECT'
          ? entry.scopeContext?.project?.dataNodeRef
          : page?.requiredDataNodeType === 'STORE'
            ? entry.scopeContext?.store?.dataNodeRef
            : page?.requiredDataNodeType === 'HEAD_COMPANY'
              ? entry.scopeContext?.headCompany?.dataNodeRef
              : undefined;
    },
    [catalogByKey, entry.scopeContext],
  );
  const pagePath = useCallback(
    (pageKey: OperationsPageDesignKey) => `${basePath}/${routeForOperationsPage(pageKey)}`,
    [basePath],
  );
  const needsCanonicalRedirect = Boolean(selected && routeMatch && !routeMatch.canonical);
  useEffect(() => {
    if (needsCanonicalRedirect && selected) {
      void navigate(pagePath(selected), {replace: true});
      return;
    }
    if ((!routeSegment || !selected) && accessiblePages.length) {
      void navigate(pagePath(accessiblePages[0].key), {replace: true});
    }
  }, [accessiblePages, navigate, needsCanonicalRedirect, pagePath, routeSegment, selected]);
  useEffect(() => {
    setBrandLogoBroken(false);
  }, [entry.logoUrl]);
  useEffect(() => {
    const firstAccessibleKey = accessiblePages[0]?.key;
    const accessibleKeys = new Set(accessiblePages.map(({key}) => key));
    if (tabAssignmentRef.current !== session.assignmentId) {
      tabAssignmentRef.current = session.assignmentId;
      setOpenPages(firstAccessibleKey ? [firstAccessibleKey] : []);
      return;
    }
    setOpenPages(current => {
      const retained = current.filter(key => accessibleKeys.has(key));
      return retained.length ? retained : firstAccessibleKey ? [firstAccessibleKey] : [];
    });
  }, [accessiblePages, session.assignmentId]);
  useEffect(() => {
    if (!selected) return;
    setOpenPages(current => (current.includes(selected) ? current : [...current, selected]));
  }, [selected]);
  const registration = selected
    ? operationsPageRegistry[selected]
    : accessiblePages.length
      ? operationsPageRegistry[accessiblePages[0].key]
      : undefined;
  const selectedCatalogPage = selected ? catalogByKey.get(selected) : undefined;
  const selectedScopeRef = selected ? scopeRefForPage(selected) : undefined;
  const queryContext = useMemo(
    () =>
      contextScopedQueryArgs(
        {},
        {
          groupWorkspaceKey: session.groupWorkspaceKey,
          expectedContextVersion: session.contextVersion,
          identityKey: undefined,
          scopeRef: selectedScopeRef,
        },
      ),
    [selectedScopeRef, session.contextVersion, session.groupWorkspaceKey],
  );
  const currentPageKey = selected ?? accessiblePages[0]?.key;
  const pageBodyKey = `${currentPageKey ?? 'none'}-${session.assignmentId}-${session.contextVersion}`;
  const closePage = (target: OperationsPageDesignKey) => {
    if (openPages.length === 1 || locked) return;
    const index = openPages.indexOf(target);
    const next = openPages.filter(key => key !== target);
    setOpenPages(next);
    if (target === selected) {
      const nextKey = next[Math.min(index, next.length - 1)];
      if (nextKey) void navigate(pagePath(nextKey));
    }
  };
  const principalMenu: MenuProps = {
    items: [
      {key: 'change-password', label: '修改密码'},
      {key: 'logout', icon: <LogoutOutlined />, label: '退出登录'},
    ],
    onClick: ({key}) => {
      if (key === 'change-password') setPasswordOpen(true);
      if (key === 'logout') void onLogout();
    },
  };
  const page =
    registration && selectedCatalogPage ? (
      <OperationsRequiredScopeSurface
        requiredDataNodeType={selectedCatalogPage.requiredDataNodeType}
        scopeContext={entry.scopeContext}
      >
        <registration.Component
          key={session.contextVersion}
          queryContext={queryContext}
          actionCapabilityKeys={session.actionCapabilityKeys}
        />
      </OperationsRequiredScopeSurface>
    ) : (
      <Alert type="info" title={routeSegment ? '当前角色没有该页面准入' : '当前角色没有页面准入'} />
    );
  return (
    <Layout className="operations-shell" {...operationsAdminChromeProps} style={{height: '100vh', overflow: 'hidden'}}>
      {!fullscreen && (
        <Layout.Header className="operations-header">
          <div className="operations-header-leading">
            <div className="operations-header-brand" {...testId('operations-shell-brand')}>
              {entry.logoUrl && !brandLogoBroken ? (
                <img
                  className="operations-header-logo"
                  src={entry.logoUrl}
                  alt={`${entry.workspaceName}标识`}
                  onError={() => setBrandLogoBroken(true)}
                />
              ) : (
                <DashboardOutlined className="operations-header-logo" />
              )}
              <Typography.Text className="operations-header-title" ellipsis={{tooltip: entry.operationsTitle}}>
                {entry.operationsTitle}
              </Typography.Text>
            </div>
            {shellLock.dirtyLocked && (
              <Typography.Text type="warning" {...testId('operations-shell-dirty-guard')}>
                {dirtyDraftPrompt}
              </Typography.Text>
            )}
          </div>
          <Space align="center">
            <RoleContextSelector entry={entry} variant="header" disabled={locked} onSelected={onRoleSelected} />
            <Dropdown menu={principalMenu} trigger={['click']} disabled={locked}>
              <Button
                type="text"
                className="operations-principal"
                disabled={locked}
                aria-label={`当前账号 ${entry.displayName}`}
                {...testId('operations-shell-principal')}
              >
                <Avatar size="small" icon={<UserOutlined />} />
                <span>{entry.displayName}</span>
                <DownOutlined aria-hidden="true" />
              </Button>
            </Dropdown>
          </Space>
        </Layout.Header>
      )}
      <Layout hasSider>
        {!fullscreen && (
          <Layout.Sider
            className="operations-sider"
            width={210}
            collapsible
            collapsed={siderCollapsed}
            onCollapse={next => {
              if (!locked) setSiderCollapsed(next);
            }}
            theme="light"
            trigger={null}
            styles={{body: {display: 'flex', height: '100%', flexDirection: 'column'}}}
          >
            <CollapsedIcon
              className="operations-sider-collapsed-button"
              collapsed={siderCollapsed}
              role="button"
              tabIndex={locked ? -1 : 0}
              aria-label={siderCollapsed ? '展开菜单' : '收起菜单'}
              aria-disabled={locked}
              onClick={() => {
                if (!locked) setSiderCollapsed(current => !current);
              }}
              onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                if (!locked && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  setSiderCollapsed(current => !current);
                }
              }}
              {...testId('operations-shell-toggle-sider')}
            />
            <Menu
              className="operations-shell-menu"
              theme="light"
              mode="inline"
              inlineCollapsed={siderCollapsed}
              defaultOpenKeys={selectedCatalogPage ? [selectedCatalogPage.menuGroupKey] : []}
              selectedKeys={selected ? [selected] : []}
              onClick={({key}) => {
                if (locked) return;
                const pageKey = parseOperationsPageDesignKey(key);
                if (pageKey) void navigate(pagePath(pageKey));
              }}
              items={menuItems}
              {...testId('operations-shell-menu')}
            />
            <div className="operations-scope-selector">
              <DataScopeSelector
                entry={entry}
                page={
                  selectedCatalogPage
                    ? {
                        requiredDataNodeType: selectedCatalogPage.requiredDataNodeType,
                        noDataNodePrompt: selectedCatalogPage.noDataNodePrompt,
                        noCandidatePrompt: selectedCatalogPage.noCandidatePrompt,
                        cascadeLevelLabels: selectedCatalogPage.cascadeLevelLabels,
                      }
                    : undefined
                }
                collapsed={siderCollapsed}
                disabled={locked}
                onChanged={onEntry}
              />
            </div>
          </Layout.Sider>
        )}
        <Layout>
          <Layout.Content
            className="operations-content"
            style={{
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              padding: '12px 16px 16px',
              overflow: 'hidden',
            }}
          >
            <Tabs
              className="operations-content-tabs"
              type="editable-card"
              hideAdd
              activeKey={currentPageKey}
              onChange={key => {
                if (locked) return;
                const pageKey = parseOperationsPageDesignKey(key);
                if (pageKey) void navigate(pagePath(pageKey));
              }}
              onEdit={(key, action) => {
                if (action !== 'remove') return;
                const pageKey = parseOperationsPageDesignKey(String(key));
                if (pageKey) closePage(pageKey);
              }}
              tabBarExtraContent={
                <Space>
                  <Button
                    type="text"
                    aria-label="刷新当前页"
                    icon={<ReloadOutlined />}
                    disabled={locked || !currentPageKey}
                    onClick={refreshOperationsCurrentPage}
                    {...testId('operations-shell-refresh-current')}
                  />
                  <Button
                    type="text"
                    aria-label={fullscreen ? '退出全屏' : '全屏显示当前页面'}
                    icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                    disabled={locked}
                    onClick={() => setFullscreen(current => !current)}
                    {...testId('operations-shell-toggle-fullscreen')}
                  />
                </Space>
              }
              items={openPages.flatMap(key => {
                const pageMeta = catalogByKey.get(key);
                return pageMeta
                  ? [{key, closable: openPages.length > 1 && !locked, label: pageMeta.contentTabLabel}]
                  : [];
              })}
              {...testId('operations-shell-tabs')}
            />
            <div
              className="operations-tab-body"
              key={pageBodyKey}
              style={{minHeight: 0, flex: '1 1 auto', overflow: 'auto', padding: 4}}
              {...testId('operations-shell-tab-body')}
            >
              {page}
            </div>
          </Layout.Content>
        </Layout>
      </Layout>
      <OperationsPasswordChangeDrawer
        open={passwordOpen}
        queryContext={queryContext}
        onClose={() => setPasswordOpen(false)}
        onChanged={() => {
          setPasswordOpen(false);
          setPasswordChanged(true);
        }}
      />
      <OperationsPasswordChangeResult
        open={passwordChanged}
        onReauthenticate={() => {
          setPasswordChanged(false);
          void onLogout();
        }}
      />
    </Layout>
  );
}

function InvitationRoute() {
  const {groupWorkspaceKey, invitationToken} = useParams();
  return <PublicInvitationEntry groupWorkspaceKey={groupWorkspaceKey ?? ''} invitationToken={invitationToken ?? ''} />;
}
function RecoveryVerifyRoute() {
  const {groupWorkspaceKey} = useParams();
  return <OperationsPasswordRecoveryVerifyPage groupWorkspaceKey={groupWorkspaceKey ?? ''} />;
}
function RecoveryPasswordRoute() {
  const {groupWorkspaceKey} = useParams();
  return <OperationsPasswordRecoveryPasswordPage groupWorkspaceKey={groupWorkspaceKey ?? ''} />;
}
function RecoveryCompleteRoute() {
  const {groupWorkspaceKey} = useParams();
  return <OperationsPasswordRecoveryCompletePage groupWorkspaceKey={groupWorkspaceKey ?? ''} />;
}
function toSession(entry: WorkspaceSessionEntry): Session | undefined {
  if (!entry.selected) return undefined;
  return {
    groupWorkspaceKey: entry.groupWorkspaceKey,
    assignmentId: entry.selected.roleAssignmentRef,
    visibleDataNodeId: entry.scopeContext?.project?.dataNodeRef ?? null,
    contextVersion: entry.contextVersion,
    pageAccessKeys: entry.selected.pageDesignKeys.flatMap(key => {
      const parsed = parseOperationsPageDesignKey(key);
      return parsed ? [parsed] : [];
    }),
    actionCapabilityKeys: entry.actionGrants,
  };
}
function WorkspaceRoute() {
  const {groupWorkspaceKey} = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [entryOverride, setEntryOverride] = useState<WorkspaceSessionEntry | null>(null);
  const lifecycle = useSubmissionLifecycle();
  const sessionInvalidating = useRef(false);
  const loginPath = groupWorkspaceKey ? `/operations/${encodeURIComponent(groupWorkspaceKey)}/login` : undefined;
  const anonymousLoginRoute = location.pathname === loginPath;
  const sessionEntryRequest = useMemo(
    () =>
      groupWorkspaceKey && !anonymousLoginRoute
        ? operationsAdminRtkRequest.getOperationsWorkspaceSessionEntry({groupWorkspaceKey}, {})
        : undefined,
    [anonymousLoginRoute, groupWorkspaceKey],
  );
  const sessionEntryQuery = operationsRtk.useGetOperationsWorkspaceSessionEntryQuery(sessionEntryRequest!, {
    skip: !sessionEntryRequest,
  });
  const {refetch: refetchSessionEntry} = sessionEntryQuery;
  const refreshSessionEntry = useCallback(async () => {
    if (!sessionEntryRequest) return;
    const next = await refetchSessionEntry();
    if (next.data) setEntryOverride(next.data);
  }, [refetchSessionEntry, sessionEntryRequest]);
  const entry = entryOverride ?? sessionEntryQuery.data ?? null;
  const session = entry ? toSession(entry) : undefined;
  const sessionEntryLoaded =
    !sessionEntryRequest || entryOverride !== null || sessionEntryQuery.isSuccess || sessionEntryQuery.isError;
  const clearLocalSession = () => {
    clearOperationsTransportState();
    operationsStore.dispatch(clearOwnerScopeContext());
    setEntryOverride(null);
  };
  useEffect(() => {
    operationsStore.dispatch(replaceOwnerScopeContext(entry?.scopeContext ?? null));
  }, [entry?.contextVersion, entry?.scopeContext]);
  useEffect(
    () =>
      registerOperationsSessionRecovery(async () => {
        if (sessionInvalidating.current) return;
        sessionInvalidating.current = true;
        clearLocalSession();
        if (groupWorkspaceKey)
          await navigate(`/operations/${encodeURIComponent(groupWorkspaceKey)}/login`, {replace: true});
      }),
    [groupWorkspaceKey, navigate],
  );
  useEffect(() => registerOperationsContextStaleRecovery(refreshSessionEntry), [refreshSessionEntry]);
  useEffect(() => {
    sessionInvalidating.current = false;
    setEntryOverride(null);
  }, [groupWorkspaceKey]);
  const logout = async () => {
    if (!entry) return;
    lifecycle.markBusinessIntentChanged();
    try {
      await operationsClient.operationsWorkspaceLogout(
        {groupWorkspaceKey: entry.groupWorkspaceKey},
        {headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}},
      );
    } finally {
      clearLocalSession();
    }
  };
  if (!groupWorkspaceKey) return <Navigate to="/operations" replace />;
  if (!sessionEntryLoaded) return <Alert type="info" title="正在恢复登录状态" />;
  const enterSelectedHome = (next: WorkspaceSessionEntry) => {
    setEntryOverride(next);
    const selectedSession = toSession(next);
    const page = selectedSession?.pageAccessKeys[0];
    if (page)
      void navigate(`/operations/${encodeURIComponent(next.groupWorkspaceKey)}/${routeForOperationsPage(page)}`, {
        replace: true,
      });
  };
  if (entry?.outcome === 'PASSWORD_CHANGE_REQUIRED')
    return (
      <OperationsForcedPasswordChangePage
        groupWorkspaceKey={entry.groupWorkspaceKey}
        contextVersion={entry.contextVersion}
        onCompleted={() => void logout()}
      />
    );
  if (entry && !session)
    return (
      <main className="auth-page">
        <div className="auth-card">
          <RoleContextSelector entry={entry} variant="initial" onSelected={enterSelectedHome} />
        </div>
      </main>
    );
  return session && entry ? (
    <Shell
      session={session}
      entry={entry}
      onLogout={logout}
      onEntry={setEntryOverride}
      onRoleSelected={enterSelectedHome}
    />
  ) : (
    <OperationsLoginPage
      groupWorkspaceKey={groupWorkspaceKey}
      onEntry={next => {
        sessionInvalidating.current = false;
        enterSelectedHome(next);
      }}
    />
  );
}

function OperationsRoot() {
  const location = useLocation();
  return (
    <App>
      <OverlayLockProvider>
        <AdminErrorBoundary
          onError={recordOperationsRenderError}
          resetKeys={[location.key, location.pathname, location.search, location.hash]}
          fallback={({reset}) => (
            <Result
              status="error"
              title="页面暂时无法显示"
              subTitle="请重试当前页面。"
              extra={
                <Button type="primary" onClick={reset}>
                  重试页面
                </Button>
              }
            />
          )}
        >
          <Routes>
            <Route path="/operations/invitations/:groupWorkspaceKey/:invitationToken" element={<InvitationRoute />} />
            <Route path="/operations/:groupWorkspaceKey/password-recovery" element={<RecoveryVerifyRoute />} />
            <Route
              path="/operations/:groupWorkspaceKey/password-recovery/password"
              element={<RecoveryPasswordRoute />}
            />
            <Route
              path="/operations/:groupWorkspaceKey/password-recovery/complete"
              element={<RecoveryCompleteRoute />}
            />
            <Route path="/operations/:groupWorkspaceKey/*" element={<WorkspaceRoute />} />
            <Route path="*" element={<Navigate to="/operations/unknown/login" replace />} />
          </Routes>
        </AdminErrorBoundary>
      </OverlayLockProvider>
    </App>
  );
}
export function OperationsApp() {
  return (
    <BrowserRouter>
      <OperationsRoot />
    </BrowserRouter>
  );
}
