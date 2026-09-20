import {Alert, Button, Space, Tabs, Tag} from 'antd';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {
  adminListState,
  contextScopedQueryArgs,
  createContentIdempotencyKey,
  createPageQueryIdentity,
  formatCanonicalDateTime,
  LifecycleStatusTag,
  testId,
  useCursorCandidates,
  useDetailDrawer,
  usePageQuery,
} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {ApiFailure, operationsClient, operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {OPERATIONS_ADMIN_OPERATION_IDS} from '../../../app/api/generated/operations-edge';
import type {
  SortDirection,
  WorkspaceAccountStatus,
  WorkspaceInvitationCandidatePage,
  WorkspaceUser,
  WorkspaceUserPage as WorkspaceUserPageResult,
  WorkspaceUserSortKey,
} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {
  adminCatalog,
  userManagementFor,
  type UserManagementPageDesignKey,
} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';
import {OperationsAuditHistoryModal} from '../../audit-history';
import {WorkspaceInvitationPanel} from './WorkspaceInvitationPanel';
import {WorkspaceUserDetailDrawer} from './WorkspaceUserDetailDrawer';
import {WorkspaceUserRevokeModal} from './WorkspaceUserRevokeModal';
import {useWorkspaceInvitationCandidates} from '../application/useWorkspaceInvitationCandidates';

type UserFilters = {
  userName?: string;
  mobile?: string;
  roleId?: string;
  status?: WorkspaceAccountStatus;
};

type UserManagementTargetType = ReturnType<typeof userManagementFor>['targetOrganizationType'];
type WorkspaceAssignment = WorkspaceUser['assignments'][number];

function issue(error: unknown) {
  if (error instanceof ApiFailure) return error.problem.detail;
  if (
    typeof error === 'object' &&
    error !== null &&
    'detail' in error &&
    typeof (error as {detail?: unknown}).detail === 'string'
  ) {
    return (error as {detail: string}).detail;
  }
  return '无法完成用户管理操作';
}

function pageTitleFor(pageDesignKey: UserManagementPageDesignKey) {
  const page = adminCatalog.operationsPages.find(entry => entry.pageDesignKey === pageDesignKey);
  if (!page?.pageTitle) throw new Error(`USER_MANAGEMENT_PAGE_TITLE_MISSING:${pageDesignKey}`);
  return page.pageTitle;
}

function time(value?: number | null) {
  return formatCanonicalDateTime(value);
}

function latestUpdatedAt(user: WorkspaceUser) {
  return user.assignments.reduce((latest, assignment) => Math.max(latest, assignment.updatedAt), user.createdAt);
}

async function revokeAssignment(
  targetType: UserManagementTargetType,
  queryContext: OperationsPageProps['queryContext'],
  assignment: WorkspaceAssignment,
  idempotencyKey: string,
) {
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

function revokeOperationId(targetType: UserManagementTargetType) {
  return targetType === 'GROUP'
    ? OPERATIONS_ADMIN_OPERATION_IDS.revokeOperationsWorkspaceGroupUserAssignment
    : targetType === 'REGION'
      ? OPERATIONS_ADMIN_OPERATION_IDS.revokeOperationsWorkspaceRegionUserAssignment
      : targetType === 'PROJECT'
        ? OPERATIONS_ADMIN_OPERATION_IDS.revokeOperationsWorkspaceProjectUserAssignment
        : targetType === 'HEAD_COMPANY'
          ? OPERATIONS_ADMIN_OPERATION_IDS.revokeOperationsWorkspaceHeadCompanyUserAssignment
          : OPERATIONS_ADMIN_OPERATION_IDS.revokeOperationsWorkspaceStoreUserAssignment;
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
  const [sort, setSort] = useState<WorkspaceUserSortKey>('LOGIN_NAME');
  const [direction, setDirection] = useState<SortDirection>('ASC');
  const [filters, setFilters] = useState<UserFilters>({});
  const [commandProblem, setProblem] = useState<string>();
  const detail = useDetailDrawer<WorkspaceUser>();
  const {open: openDetailTarget, finishLoading: finishDetailLoading} = detail;
  const [detailAccountId, setDetailAccountId] = useState<string>();
  const [pendingRevoke, setPendingRevoke] = useState<WorkspaceAssignment>();
  const [revokeProblem, setRevokeProblem] = useState<string>();
  const [auditOpen, setAuditOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [roleCandidateQuery, setRoleCandidateQuery] = useState('');
  // GROUP is the sole aggregate page.  A head-company page is a selected,
  // exact data-node context just like region/project/store pages.
  const requestScopeRef = targetType === 'GROUP' ? undefined : queryContext.scopeRef;
  const targetOperationPart =
    targetType === 'HEAD_COMPANY' ? 'HeadCompany' : `${targetType[0]}${targetType.slice(1).toLowerCase()}`;
  const queryIdentity = useMemo(
    () =>
      createPageQueryIdentity({
        operationId: `getOperationsWorkspace${targetOperationPart}User`,
        scope: {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          expectedContextVersion: queryContext.expectedContextVersion,
          scopeRef: requestScopeRef,
          targetType,
        },
        filters,
        sort: {sort, direction},
      }),
    [direction, filters, queryContext, requestScopeRef, sort, targetOperationPart, targetType],
  );
  const pagination = usePageQuery({queryIdentity, initialPageSize: 10});
  const {page, pageSize} = pagination;

  const scopedQuery = useMemo(() => {
    const scoped = contextScopedQueryArgs(
      {
        userName: filters.userName?.trim() || undefined,
        mobile: filters.mobile?.trim() || undefined,
        roleId: filters.roleId ? wireUuid(filters.roleId) : undefined,
        status: filters.status,
        page,
        pageSize,
        sort,
        direction,
      },
      {
        groupWorkspaceKey: queryContext.groupWorkspaceKey,
        expectedContextVersion: queryContext.expectedContextVersion,
        scopeRef: requestScopeRef,
      },
    );
    const {groupWorkspaceKey, ...query} = scoped;
    return {path: {groupWorkspaceKey}, query};
  }, [
    direction,
    filters.mobile,
    filters.roleId,
    filters.status,
    filters.userName,
    page,
    pageSize,
    queryContext.expectedContextVersion,
    queryContext.groupWorkspaceKey,
    requestScopeRef,
    sort,
  ]);

  const groupUsers = operationsRtk.useGetOperationsWorkspaceGroupUserQuery(
    operationsAdminRtkRequest.getOperationsWorkspaceGroupUser(scopedQuery.path, {query: scopedQuery.query}),
    {skip: targetType !== 'GROUP'},
  );
  const regionUsers = operationsRtk.useGetOperationsWorkspaceRegionUserQuery(
    operationsAdminRtkRequest.getOperationsWorkspaceRegionUser(scopedQuery.path, {query: scopedQuery.query}),
    {skip: targetType !== 'REGION' || !queryContext.scopeRef},
  );
  const projectUsers = operationsRtk.useGetOperationsWorkspaceProjectUserQuery(
    operationsAdminRtkRequest.getOperationsWorkspaceProjectUser(scopedQuery.path, {query: scopedQuery.query}),
    {skip: targetType !== 'PROJECT' || !queryContext.scopeRef},
  );
  const headCompanyUsers = operationsRtk.useGetOperationsWorkspaceHeadCompanyUserQuery(
    operationsAdminRtkRequest.getOperationsWorkspaceHeadCompanyUser(scopedQuery.path, {query: scopedQuery.query}),
    {skip: targetType !== 'HEAD_COMPANY' || !queryContext.scopeRef},
  );
  const storeUsers = operationsRtk.useGetOperationsWorkspaceStoreUserQuery(
    operationsAdminRtkRequest.getOperationsWorkspaceStoreUser(scopedQuery.path, {query: scopedQuery.query}),
    {skip: targetType !== 'STORE' || !queryContext.scopeRef},
  );
  const activeUserQuery =
    targetType === 'GROUP'
      ? groupUsers
      : targetType === 'REGION'
        ? regionUsers
        : targetType === 'PROJECT'
          ? projectUsers
          : targetType === 'HEAD_COMPANY'
            ? headCompanyUsers
            : storeUsers;
  const result = activeUserQuery.currentData as WorkspaceUserPageResult | undefined;
  const queryError = activeUserQuery.error;
  const scopeRequired = targetType !== 'GROUP' && !queryContext.scopeRef;
  const roleCandidates = useCursorCandidates<WorkspaceInvitationCandidatePage['roles'][number]>({
    queryText: roleCandidateQuery,
    resetKey: `${targetType}|${queryContext.groupWorkspaceKey}|${queryContext.scopeRef ?? ''}|ROLE`,
    pageSize: 50,
    keyOf: role => role.id,
  });
  const {
    acceptPage: acceptRoleCandidatePage,
    debouncedQueryText: roleCandidateQueryText,
    items: roleCandidateItems,
    onPopupScroll: onRoleCandidatePopupScroll,
    page: roleCandidatePage,
    pageSize: roleCandidatePageSize,
  } = roleCandidates;
  const roleCandidateResult = useWorkspaceInvitationCandidates({
    targetType,
    queryContext,
    subjectType: 'ROLE',
    candidateUsage: 'LIST_FILTER',
    queryText: roleCandidateQueryText,
    page: roleCandidatePage,
    pageSize: roleCandidatePageSize,
    enabled: !scopeRequired,
  });
  useEffect(() => {
    if (!roleCandidateResult.currentData) return;
    acceptRoleCandidatePage(roleCandidateResult.currentData.roles, roleCandidateResult.currentData.metadata);
  }, [acceptRoleCandidatePage, roleCandidatePage, roleCandidateResult.currentData]);
  const roleOptions = roleCandidateItems.map(role => ({value: role.id, label: role.name}));
  // The shared app-level scope bar is the one and only missing-scope prompt.
  // Keep this page alert for genuine query or command failures only.
  const problem = queryError ? issue(operationsProblemOf(queryError)) : commandProblem;

  const detailPath = useMemo(
    () => ({groupWorkspaceKey: queryContext.groupWorkspaceKey, accountId: detailAccountId ?? ''}),
    [detailAccountId, queryContext.groupWorkspaceKey],
  );
  const detailOptions = useMemo(
    () => ({query: {expectedContextVersion: queryContext.expectedContextVersion}}),
    [queryContext.expectedContextVersion],
  );
  const groupDetail = operationsRtk.useGetOperationsWorkspaceGroupUserAccountQuery(
    operationsAdminRtkRequest.getOperationsWorkspaceGroupUserAccount(detailPath, detailOptions),
    {skip: targetType !== 'GROUP' || !detailAccountId},
  );
  const regionDetail = operationsRtk.useGetOperationsWorkspaceRegionUserAccountQuery(
    operationsAdminRtkRequest.getOperationsWorkspaceRegionUserAccount(detailPath, detailOptions),
    {skip: targetType !== 'REGION' || !detailAccountId},
  );
  const projectDetail = operationsRtk.useGetOperationsWorkspaceProjectUserAccountQuery(
    operationsAdminRtkRequest.getOperationsWorkspaceProjectUserAccount(detailPath, detailOptions),
    {skip: targetType !== 'PROJECT' || !detailAccountId},
  );
  const headCompanyDetail = operationsRtk.useGetOperationsWorkspaceHeadCompanyUserAccountQuery(
    operationsAdminRtkRequest.getOperationsWorkspaceHeadCompanyUserAccount(detailPath, detailOptions),
    {skip: targetType !== 'HEAD_COMPANY' || !detailAccountId},
  );
  const storeDetail = operationsRtk.useGetOperationsWorkspaceStoreUserAccountQuery(
    operationsAdminRtkRequest.getOperationsWorkspaceStoreUserAccount(detailPath, detailOptions),
    {skip: targetType !== 'STORE' || !detailAccountId},
  );
  const activeDetailQuery =
    targetType === 'GROUP'
      ? groupDetail
      : targetType === 'REGION'
        ? regionDetail
        : targetType === 'PROJECT'
          ? projectDetail
          : targetType === 'HEAD_COMPANY'
            ? headCompanyDetail
            : storeDetail;
  const detailData = activeDetailQuery.currentData as WorkspaceUser | undefined;
  const detailError = activeDetailQuery.error;
  const detailFetching = activeDetailQuery.isFetching;

  useEffect(() => {
    if (!detailAccountId) return;
    if (detailData?.accountId === detailAccountId) openDetailTarget(detailData);
    else if (detailError && !detailFetching) {
      finishDetailLoading();
      setProblem(issue(operationsProblemOf(detailError)));
    }
  }, [detailAccountId, detailData, detailError, detailFetching, finishDetailLoading, openDetailTarget]);

  const openDetail = useCallback(
    (user: WorkspaceUser) => {
      setProblem(undefined);
      setDetailAccountId(user.accountId);
      detail.openLoading();
    },
    [detail],
  );

  const columns = useMemo<ProColumns<WorkspaceUser>[]>(
    () => [
      {
        title: '姓名',
        dataIndex: 'displayName',
        sorter: true,
        fieldProps: {...testId('operations-workspace-user-filter-name'), allowClear: true, placeholder: '输入姓名'},
        render: (_, user) => (
          <Button
            type="link"
            onClick={() => {
              void openDetail(user);
            }}
            {...testId(`operations-workspace-user-open-${user.accountId}`)}
          >
            {user.displayName}
          </Button>
        ),
      },
      {
        title: '手机号',
        dataIndex: 'mobile',
        hideInTable: true,
        fieldProps: {...testId('operations-workspace-user-filter-mobile'), allowClear: true, placeholder: '输入手机号'},
      },
      {title: '手机号', dataIndex: 'maskedMobile', search: false},
      {
        title: '业务角色',
        dataIndex: 'roleId',
        hideInTable: true,
        valueType: 'select',
        fieldProps: {
          showSearch: true,
          filterOption: false,
          onSearch: setRoleCandidateQuery,
          onPopupScroll: (event: Parameters<typeof onRoleCandidatePopupScroll>[0]) =>
            onRoleCandidatePopupScroll(event, roleCandidateResult.isFetching),
          options: roleOptions,
          loading: roleCandidateResult.isFetching,
          allowClear: true,
          placeholder: '搜索业务角色',
          ...testId('operations-workspace-user-filter-role'),
        },
      },
      {title: '登录账号', dataIndex: 'loginName', search: false, sorter: true},
      {
        title: '业务角色',
        dataIndex: 'assignments',
        search: false,
        render: (_, user) => (
          <Space size={[4, 4]} wrap>
            {Array.from(
              new Set(
                user.assignments
                  .filter(assignment => assignment.status === 'ACTIVE')
                  .map(assignment => assignment.roleName),
              ),
            ).map(role => (
              <Tag key={role}>{role}</Tag>
            ))}
          </Space>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: {ENABLED: {text: '启用'}, DISABLED: {text: '停用'}},
        fieldProps: {...testId('operations-workspace-user-filter-status'), allowClear: true, placeholder: '全部'},
        render: (_, user) => <LifecycleStatusTag status={user.status} />,
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        search: false,
        render: (_, user) => time(latestUpdatedAt(user)),
      },
    ],
    [onRoleCandidatePopupScroll, openDetail, roleCandidateResult.isFetching, roleOptions],
  );

  function closeDetail() {
    setDetailAccountId(undefined);
    detail.close();
  }

  function submitFilters(next: UserFilters) {
    setFilters(next);
    pagination.setPage(1);
  }

  async function confirmRevoke() {
    if (!pendingRevoke || revoking) return;
    setRevokeProblem(undefined);
    setRevoking(true);
    setProblem(undefined);
    try {
      const idempotencyKey = await createContentIdempotencyKey(revokeOperationId(targetType), {
        assignmentId: pendingRevoke.id,
        expectedVersion: pendingRevoke.revision,
        expectedContextVersion: queryContext.expectedContextVersion,
      });
      const result = await revokeAssignment(targetType, queryContext, pendingRevoke, idempotencyKey);
      setRevokeProblem(undefined);
      setPendingRevoke(undefined);
      detail.open(result.user);
    } catch (error) {
      setRevokeProblem(operationsProblemOf(error).detail);
    } finally {
      setRevoking(false);
    }
  }

  const userContent = (
    <>
      {problem && <Alert type="error" showIcon title="用户管理失败" description={problem} style={{marginBottom: 16}} />}
      <ProTable<WorkspaceUser>
        size="small"
        search={{
          labelWidth: 'auto',
          optionRender: searchConfig => [
            <Button
              key="submit"
              type="primary"
              onClick={() => searchConfig.form?.submit()}
              {...testId('operations-workspace-user-filter-submit')}
            >
              查询
            </Button>,
            <Button
              key="reset"
              onClick={() => {
                searchConfig.form?.resetFields();
                setFilters({});
                pagination.setPage(1);
              }}
              {...testId('operations-workspace-user-filter-reset')}
            >
              重置
            </Button>,
          ],
        }}
        onSubmit={values =>
          submitFilters({
            userName: typeof values.displayName === 'string' ? values.displayName : undefined,
            mobile: typeof values.mobile === 'string' ? values.mobile : undefined,
            roleId: typeof values.roleId === 'string' ? values.roleId : undefined,
            status: values.status,
          })
        }
        options={false}
        rowKey="accountId"
        {...adminListState({
          loading: activeUserQuery.isFetching,
          failed: Boolean(queryError) || scopeRequired,
          emptyText: '当前目标暂无任职用户',
          testIdPrefix: 'operations-workspace-user-list',
        })}
        dataSource={result?.items ?? []}
        columns={columns}
        onChange={(tablePagination, _, nextSorter, extra) => {
          if (extra.action === 'paginate') {
            pagination.setPage(tablePagination.current ?? page);
            pagination.setPageSize(tablePagination.pageSize ?? pageSize);
            return;
          }
          if (extra.action !== 'sort') return;
          const sorter = Array.isArray(nextSorter) ? nextSorter[0] : nextSorter;
          if (!sorter?.order) {
            setSort('LOGIN_NAME');
            setDirection('ASC');
            return;
          }
          setSort(sorter.columnKey === 'displayName' ? 'DISPLAY_NAME' : 'LOGIN_NAME');
          setDirection(sorter.order === 'ascend' ? 'ASC' : 'DESC');
          pagination.setPage(1);
        }}
        pagination={{
          current: page,
          pageSize,
          total: result?.total ?? 0,
          showSizeChanger: true,
        }}
        {...testId('operations-workspace-user-table')}
      />
    </>
  );

  return (
    <>
      <Tabs
        items={[
          {
            key: 'users',
            label: <span {...testId('operations-workspace-user-tab-users')}>用户</span>,
            children: userContent,
          },
          {
            key: 'invitations',
            label: <span {...testId('operations-workspace-user-tab-invitations')}>邀请</span>,
            children: (
              <WorkspaceInvitationPanel
                pageDesignKey={pageDesignKey}
                queryContext={queryContext}
                actionCapabilityKeys={actionCapabilityKeys}
              />
            ),
          },
        ]}
        {...testId('operations-workspace-user-tabs')}
      />
      <WorkspaceUserDetailDrawer
        open={detail.isOpen}
        loading={detail.loading}
        problem={problem}
        pageTitle={pageTitle}
        user={detail.target}
        canRevoke={canRevoke}
        revoking={revoking}
        onClose={closeDetail}
        onOpenAudit={() => setAuditOpen(true)}
        onRequestRevoke={assignment => {
          setRevokeProblem(undefined);
          setPendingRevoke(assignment);
        }}
      />
      <WorkspaceUserRevokeModal
        open={Boolean(pendingRevoke)}
        displayName={detail.target?.displayName}
        organizationPathNodes={pendingRevoke?.organizationPathNodes}
        problem={revokeProblem}
        submitting={revoking}
        onCancel={() => {
          if (!revoking) {
            setRevokeProblem(undefined);
            setPendingRevoke(undefined);
          }
        }}
        onConfirm={() => {
          void confirmRevoke();
        }}
      />
      <OperationsAuditHistoryModal
        open={auditOpen}
        target={
          detail.target
            ? {
                entityType: 'WORKSPACE_ACCOUNT',
                entityId: detail.target.accountId,
                displayName: detail.target.displayName,
              }
            : undefined
        }
        groupWorkspaceKey={queryContext.groupWorkspaceKey}
        onClose={() => setAuditOpen(false)}
      />
    </>
  );
}
