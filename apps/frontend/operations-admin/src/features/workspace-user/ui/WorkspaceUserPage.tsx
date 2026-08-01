import {Alert, Button, Form, Input, Select, Space, Tabs, Tag} from 'antd';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {contextScopedQueryArgs, testId, useDetailDrawer, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useMemo, useState} from 'react';
import {ApiFailure, operationsClient, operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {WorkspaceAccountStatus, WorkspaceUser, WorkspaceUserPage as WorkspaceUserPageResult} from '../../../app/api/generated/operations-edge';
import {adminCatalog, userManagementFor, type UserManagementPageDesignKey} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';
import {OperationsAuditHistoryModal} from '../../audit-history';
import {WorkspaceInvitationPanel} from './WorkspaceInvitationPanel';
import {WorkspaceUserDetailDrawer} from './WorkspaceUserDetailDrawer';
import {WorkspaceUserRevokeModal} from './WorkspaceUserRevokeModal';

type UserFilters = {
  userName?: string;
  mobile?: string;
  roleQuery?: string;
  status?: WorkspaceAccountStatus;
};

type UserManagementTargetType = ReturnType<typeof userManagementFor>['targetOrganizationType'];
type WorkspaceAssignment = WorkspaceUser['assignments'][number];

const statusOptions = [
  {value: 'ENABLED', label: '启用'},
  {value: 'DISABLED', label: '禁用'},
] satisfies Array<{value: WorkspaceAccountStatus; label: string}>;

function issue(error: unknown) {
  return error instanceof ApiFailure
    ? '无法读取用户详情，请稍后重试'
    : '无法完成用户管理操作';
}

function pageTitleFor(pageDesignKey: UserManagementPageDesignKey) {
  const page = adminCatalog.operationsPages.find((entry) => entry.pageDesignKey === pageDesignKey);
  if (!page?.pageTitle) throw new Error(`USER_MANAGEMENT_PAGE_TITLE_MISSING:${pageDesignKey}`);
  return page.pageTitle;
}

function time(value?: number | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '—';
}

function statusLabel(value: WorkspaceAccountStatus) {
  return value === 'ENABLED' ? '启用' : '禁用';
}

function latestUpdatedAt(user: WorkspaceUser) {
  return user.assignments.reduce((latest, assignment) => Math.max(latest, assignment.updatedAt), user.createdAt);
}

async function loadUserDetail(targetType: UserManagementTargetType, queryContext: OperationsPageProps['queryContext'], accountId: string) {
  const path = {groupWorkspaceKey: queryContext.groupWorkspaceKey, accountId};
  const options = {query: {expectedContextVersion: queryContext.expectedContextVersion}};
  return targetType === 'GROUP'
    ? operationsClient.getOperationsWorkspaceGroupUserAccount(path, options)
    : targetType === 'REGION'
      ? operationsClient.getOperationsWorkspaceRegionUserAccount(path, options)
      : targetType === 'PROJECT'
        ? operationsClient.getOperationsWorkspaceProjectUserAccount(path, options)
        : targetType === 'HEAD_COMPANY'
          ? operationsClient.getOperationsWorkspaceHeadCompanyUserAccount(path, options)
          : operationsClient.getOperationsWorkspaceStoreUserAccount(path, options);
}

async function revokeAssignment(targetType: UserManagementTargetType, queryContext: OperationsPageProps['queryContext'], assignment: WorkspaceAssignment, idempotencyKey: string) {
  const path = {groupWorkspaceKey: queryContext.groupWorkspaceKey, assignmentId: assignment.id};
  const options = {
    body: {
      expectedVersion: assignment.revision,
      expectedContextVersion: queryContext.expectedContextVersion,
      idempotencyKey,
    },
    headers: {'Idempotency-Key': idempotencyKey},
  };
  return targetType === 'GROUP'
    ? operationsClient.revokeOperationsWorkspaceGroupUserAssignment(path, options)
    : targetType === 'REGION'
      ? operationsClient.revokeOperationsWorkspaceRegionUserAssignment(path, options)
      : targetType === 'PROJECT'
        ? operationsClient.revokeOperationsWorkspaceProjectUserAssignment(path, options)
        : targetType === 'HEAD_COMPANY'
          ? operationsClient.revokeOperationsWorkspaceHeadCompanyUserAssignment(path, options)
          : operationsClient.revokeOperationsWorkspaceStoreUserAssignment(path, options);
}

export function WorkspaceUserPage({
  pageDesignKey,
  queryContext,
  actionCapabilityKeys,
}: OperationsPageProps & {pageDesignKey: UserManagementPageDesignKey}) {
  const pageTitle = pageTitleFor(pageDesignKey);
  const userManagement = userManagementFor(pageDesignKey);
  const targetType = userManagement.targetOrganizationType;
  const canRevoke = actionCapabilityKeys.includes(userManagement.roleRevokeActionKey);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<UserFilters>({});
  const [commandProblem, setProblem] = useState<string>();
  const [filterForm] = Form.useForm<UserFilters>();
  const detail = useDetailDrawer<WorkspaceUser>();
  const revokeLifecycle = useSubmissionLifecycle();
  const [pendingRevoke, setPendingRevoke] = useState<WorkspaceAssignment>();
  const [revokeProblem, setRevokeProblem] = useState<string>();
  const [auditOpen, setAuditOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const requestScopeRef = targetType === 'GROUP' || targetType === 'HEAD_COMPANY' ? undefined : queryContext.scopeRef;

  const scopedQuery = useMemo(() => {
    const scoped = contextScopedQueryArgs({
      userName: filters.userName?.trim() || undefined,
      mobile: filters.mobile?.trim() || undefined,
      roleQuery: filters.roleQuery?.trim() || undefined,
      status: filters.status,
      page,
      pageSize,
    }, {
      groupWorkspaceKey: queryContext.groupWorkspaceKey,
      expectedContextVersion: queryContext.expectedContextVersion,
      scopeRef: requestScopeRef,
    });
    const {groupWorkspaceKey, ...query} = scoped;
    return {path: {groupWorkspaceKey}, query};
  }, [filters.mobile, filters.roleQuery, filters.status, filters.userName, page, pageSize, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, requestScopeRef]);

  const groupUsers = operationsRtk.useGetOperationsWorkspaceGroupUserQuery(operationsAdminRtkRequest.getOperationsWorkspaceGroupUser(scopedQuery.path, {query: scopedQuery.query}), {skip: targetType !== 'GROUP'});
  const regionUsers = operationsRtk.useGetOperationsWorkspaceRegionUserQuery(operationsAdminRtkRequest.getOperationsWorkspaceRegionUser(scopedQuery.path, {query: scopedQuery.query}), {skip: targetType !== 'REGION' || !queryContext.scopeRef});
  const projectUsers = operationsRtk.useGetOperationsWorkspaceProjectUserQuery(operationsAdminRtkRequest.getOperationsWorkspaceProjectUser(scopedQuery.path, {query: scopedQuery.query}), {skip: targetType !== 'PROJECT' || !queryContext.scopeRef});
  const headCompanyUsers = operationsRtk.useGetOperationsWorkspaceHeadCompanyUserQuery(operationsAdminRtkRequest.getOperationsWorkspaceHeadCompanyUser(scopedQuery.path, {query: scopedQuery.query}), {skip: targetType !== 'HEAD_COMPANY'});
  const storeUsers = operationsRtk.useGetOperationsWorkspaceStoreUserQuery(operationsAdminRtkRequest.getOperationsWorkspaceStoreUser(scopedQuery.path, {query: scopedQuery.query}), {skip: targetType !== 'STORE' || !queryContext.scopeRef});
  const activeUserQuery = targetType === 'GROUP'
    ? groupUsers
    : targetType === 'REGION'
      ? regionUsers
      : targetType === 'PROJECT'
        ? projectUsers
        : targetType === 'HEAD_COMPANY'
          ? headCompanyUsers
          : storeUsers;
  const result = activeUserQuery.data as WorkspaceUserPageResult | undefined;
  const queryError = activeUserQuery.error;
  const scopeRequired = targetType !== 'GROUP' && targetType !== 'HEAD_COMPANY' && !queryContext.scopeRef;
  const problem = scopeRequired ? '请选择可查看范围。' : queryError ? issue(operationsProblemOf(queryError)) : commandProblem;

  const columns = useMemo<ProColumns<WorkspaceUser>[]>(() => [
    {
      title: '姓名',
      dataIndex: 'displayName',
      render: (_, user) => <Button type="link" onClick={() => { void openDetail(user); }} {...testId(`operations-workspace-user-open-${user.accountId}`)}>{user.displayName}</Button>,
    },
    {title: '登录账号', dataIndex: 'loginName'},
    {
      title: '业务角色',
      dataIndex: 'assignments',
      render: (_, user) => <Space size={[4, 4]} wrap>{Array.from(new Set(user.assignments.filter((assignment) => assignment.status === 'ACTIVE').map((assignment) => assignment.roleName))).map((role) => <Tag key={role}>{role}</Tag>)}</Space>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, user) => <Tag color={user.status === 'ENABLED' ? 'success' : 'default'}>{statusLabel(user.status)}</Tag>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      render: (_, user) => time(latestUpdatedAt(user)),
    },
  ], []);

  async function openDetail(user: WorkspaceUser) {
    setProblem(undefined);
    try {
      detail.open(await loadUserDetail(targetType, queryContext, user.accountId));
    } catch (error) {
      setProblem(issue(error));
    }
  }

  function submitFilters(next: UserFilters) {
    setFilters(next);
    setPage(1);
  }

  function resetFilters() {
    filterForm.resetFields();
    setFilters({});
    setPage(1);
  }

  async function confirmRevoke() {
    if (!pendingRevoke || revoking) return;
    revokeLifecycle.markBusinessIntentChanged();
    setRevokeProblem(undefined);
    setRevoking(true);
    setProblem(undefined);
    try {
      const result = await revokeAssignment(targetType, queryContext, pendingRevoke, revokeLifecycle.getIdempotencyKey());
      setRevokeProblem(undefined);
      setPendingRevoke(undefined);
      detail.open(result.user);
    } catch (error) {
      void error;
      setRevokeProblem('撤销任职未完成，请检查后重试');
    } finally {
      setRevoking(false);
    }
  }

  const userContent = <>
    {problem && <Alert type={scopeRequired ? 'info' : 'error'} showIcon message={scopeRequired ? '可查看范围' : '用户管理失败'} description={problem} style={{marginBottom: 16}}/>}
    <Form form={filterForm} layout="inline" onFinish={submitFilters} style={{marginBottom: 16}}>
      <Form.Item name="userName" label="姓名"><Input allowClear placeholder="输入姓名" {...testId('operations-workspace-user-filter-name')}/></Form.Item>
      <Form.Item name="mobile" label="手机号"><Input allowClear placeholder="输入手机号" {...testId('operations-workspace-user-filter-mobile')}/></Form.Item>
      <Form.Item name="roleQuery" label="业务角色"><Input allowClear placeholder="输入业务角色" {...testId('operations-workspace-user-filter-role')}/></Form.Item>
      <Form.Item name="status" label="状态"><Select allowClear placeholder="全部" style={{width: 120}} options={statusOptions} {...testId('operations-workspace-user-filter-status')}/></Form.Item>
      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" {...testId('operations-workspace-user-filter-submit')}>查询</Button>
          <Button onClick={resetFilters} {...testId('operations-workspace-user-filter-reset')}>重置</Button>
        </Space>
      </Form.Item>
    </Form>
    <ProTable<WorkspaceUser>
      search={false}
      options={false}
      rowKey="accountId"
      loading={activeUserQuery.isLoading && !result}
      dataSource={result?.items ?? []}
      columns={columns}
      pagination={{
        current: page,
        pageSize,
        total: result?.total ?? 0,
        showSizeChanger: true,
        onChange: (nextPage, nextPageSize) => {
          setPage(nextPage);
          setPageSize(nextPageSize);
        },
      }}
      locale={{emptyText: '当前目标暂无任职用户'}}
      {...testId('operations-workspace-user-table')}
    />
  </>;

  return <>
    <Tabs
      items={[
        {key: 'users', label: <span {...testId('operations-workspace-user-tab-users')}>用户</span>, children: userContent},
        {
          key: 'invitations',
          label: <span {...testId('operations-workspace-user-tab-invitations')}>邀请</span>,
          children: <WorkspaceInvitationPanel pageDesignKey={pageDesignKey} queryContext={queryContext} actionCapabilityKeys={actionCapabilityKeys}/>,
        },
      ]}
      {...testId('operations-workspace-user-tabs')}
    />
    <WorkspaceUserDetailDrawer
      open={detail.isOpen}
      pageTitle={pageTitle}
      user={detail.target}
      canRevoke={canRevoke}
      revoking={revoking}
      onClose={detail.close}
      onOpenAudit={() => setAuditOpen(true)}
      onRequestRevoke={(assignment) => {
        setRevokeProblem(undefined);
        setPendingRevoke(assignment);
      }}
    />
    <WorkspaceUserRevokeModal
      open={Boolean(pendingRevoke)}
      displayName={detail.target?.displayName}
      organizationPath={pendingRevoke?.organizationPath}
      problem={revokeProblem}
      submitting={revoking}
      onCancel={() => {
        if (!revoking) {
          setRevokeProblem(undefined);
          setPendingRevoke(undefined);
        }
      }}
      onConfirm={() => { void confirmRevoke(); }}
    />
    <OperationsAuditHistoryModal
      open={auditOpen}
      target={detail.target ? {entityType: 'WORKSPACE_ACCOUNT', entityId: detail.target.accountId, displayName: detail.target.displayName} : undefined}
      groupWorkspaceKey={queryContext.groupWorkspaceKey}
      onClose={() => setAuditOpen(false)}
    />
  </>;
}
