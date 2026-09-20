import {Alert, Button, DatePicker, Space, Tag} from 'antd';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {
  activeInvitationPageUrl,
  adminListState,
  contextScopedQueryArgs,
  createPageQueryIdentity,
  EllipsisTooltip,
  formatCanonicalDateTime,
  NameCodePathText,
  testId,
  useCursorCandidates,
  useDetailDrawer,
  usePageQuery,
} from '@catering-v2s/admin-ui-foundation';
import type {Dayjs} from 'dayjs';
import {useEffect, useMemo, useState} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import type {
  SortDirection,
  WorkspaceInvitation,
  WorkspaceInvitationCandidatePage,
  WorkspaceInvitationPage,
  WorkspaceInvitationSortKey,
  WorkspaceInvitationStatus,
} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {userManagementFor, type UserManagementPageDesignKey} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {WorkspaceInvitationActionModal} from './WorkspaceInvitationActionModal';
import {WorkspaceInvitationCreateDrawer} from './WorkspaceInvitationCreateDrawer';
import {WorkspaceInvitationDetailDrawer} from './WorkspaceInvitationDetailDrawer';
import {useWorkspaceInvitationCandidates} from '../application/useWorkspaceInvitationCandidates';

type InvitationAction = 'cancel' | 'reissue';
type InvitationFilterForm = {
  mobile?: string;
  organizationRef?: string;
  roleId?: string;
  status?: WorkspaceInvitationStatus;
  expiresRange?: [Dayjs, Dayjs];
};
type AppliedFilters = {
  mobile?: string;
  organizationRef?: string;
  roleId?: string;
  status?: WorkspaceInvitationStatus;
  expiresFrom?: number;
  expiresTo?: number;
};
const statusLabel: Record<WorkspaceInvitationStatus, string> = {
  ACTIVE: '有效',
  CANCELLED: '已取消',
  EXPIRED: '已过期',
  COMPLETED: '已完成',
};

function time(value: number | null | undefined) {
  return formatCanonicalDateTime(value);
}

function trimOrUndefined(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toAppliedFilters(values: InvitationFilterForm): AppliedFilters {
  const range = values.expiresRange;
  return {
    mobile: trimOrUndefined(values.mobile),
    organizationRef: typeof values.organizationRef === 'string' ? values.organizationRef : undefined,
    roleId: typeof values.roleId === 'string' ? values.roleId : undefined,
    status: values.status,
    expiresFrom: range?.[0]?.startOf('day').valueOf(),
    expiresTo: range?.[1]?.endOf('day').valueOf(),
  };
}

function queryIssue(error: unknown, fallback: string) {
  const problem = operationsProblemOf(error);
  return problem?.detail ?? fallback;
}

export function WorkspaceInvitationPanel({
  pageDesignKey,
  queryContext,
  actionCapabilityKeys,
}: OperationsPageProps & {pageDesignKey: UserManagementPageDesignKey}) {
  const userManagement = userManagementFor(pageDesignKey);
  const [sort, setSort] = useState<WorkspaceInvitationSortKey>('CREATED_AT');
  const [direction, setDirection] = useState<SortDirection>('DESC');
  const [filters, setFilters] = useState<AppliedFilters>({});
  const [organizationCandidateQuery, setOrganizationCandidateQuery] = useState('');
  const [roleCandidateQuery, setRoleCandidateQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [actionKind, setActionKind] = useState<InvitationAction>();
  const detail = useDetailDrawer<WorkspaceInvitation>();
  const canInvite = actionCapabilityKeys.includes(userManagement.inviteActionKey);
  const targetType = userManagement.targetOrganizationType;
  const targetOperationPart =
    targetType === 'HEAD_COMPANY' ? 'HeadCompany' : `${targetType[0]}${targetType.slice(1).toLowerCase()}`;
  const queryIdentity = useMemo(
    () =>
      createPageQueryIdentity({
        operationId: `getOperationsWorkspace${targetOperationPart}Invitations`,
        scope: {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          expectedContextVersion: queryContext.expectedContextVersion,
          scopeRef: queryContext.scopeRef,
          targetType,
        },
        filters,
        sort: {sort, direction},
      }),
    [direction, filters, queryContext, sort, targetOperationPart, targetType],
  );
  const pagination = usePageQuery({queryIdentity, initialPageSize: 10});
  const {page, pageSize} = pagination;
  const path = useMemo(() => ({groupWorkspaceKey: queryContext.groupWorkspaceKey}), [queryContext.groupWorkspaceKey]);
  const invitationOptions = useMemo(
    () => ({
      query: contextScopedQueryArgs(
        {
          scopeRef: queryContext.scopeRef,
          mobile: filters.mobile,
          organizationRef: filters.organizationRef ? wireUuid(filters.organizationRef) : undefined,
          roleId: filters.roleId ? wireUuid(filters.roleId) : undefined,
          status: filters.status,
          expiresFrom: filters.expiresFrom,
          expiresTo: filters.expiresTo,
          page,
          pageSize,
          sort,
          direction,
        },
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          expectedContextVersion: queryContext.expectedContextVersion,
        },
      ),
    }),
    [
      direction,
      filters.expiresFrom,
      filters.expiresTo,
      filters.mobile,
      filters.organizationRef,
      filters.roleId,
      filters.status,
      page,
      pageSize,
      queryContext.expectedContextVersion,
      queryContext.groupWorkspaceKey,
      queryContext.scopeRef,
      sort,
    ],
  );
  const groupInvitations = operationsRtk.useGetOperationsWorkspaceGroupInvitationsQuery(
    operationsAdminRtkRequest.getOperationsWorkspaceGroupInvitations(path, invitationOptions),
    {skip: targetType !== 'GROUP'},
  );
  const regionInvitations = operationsRtk.useGetOperationsWorkspaceRegionInvitationsQuery(
    operationsAdminRtkRequest.getOperationsWorkspaceRegionInvitations(path, invitationOptions),
    {skip: targetType !== 'REGION'},
  );
  const projectInvitations = operationsRtk.useGetOperationsWorkspaceProjectInvitationsQuery(
    operationsAdminRtkRequest.getOperationsWorkspaceProjectInvitations(path, invitationOptions),
    {skip: targetType !== 'PROJECT'},
  );
  const headCompanyInvitations = operationsRtk.useGetOperationsWorkspaceHeadCompanyInvitationsQuery(
    operationsAdminRtkRequest.getOperationsWorkspaceHeadCompanyInvitations(path, invitationOptions),
    {skip: targetType !== 'HEAD_COMPANY'},
  );
  const storeInvitations = operationsRtk.useGetOperationsWorkspaceStoreInvitationsQuery(
    operationsAdminRtkRequest.getOperationsWorkspaceStoreInvitations(path, invitationOptions),
    {skip: targetType !== 'STORE'},
  );
  const activeInvitations =
    targetType === 'GROUP'
      ? groupInvitations
      : targetType === 'REGION'
        ? regionInvitations
        : targetType === 'PROJECT'
          ? projectInvitations
          : targetType === 'HEAD_COMPANY'
            ? headCompanyInvitations
            : storeInvitations;
  const result = activeInvitations.currentData as WorkspaceInvitationPage | undefined;
  const problem = activeInvitations.error
    ? queryIssue(activeInvitations.error, '邀请列表读取失败，请稍后重试')
    : undefined;
  const organizationCandidates = useCursorCandidates<WorkspaceInvitationCandidatePage['organizations'][number]>({
    queryText: organizationCandidateQuery,
    resetKey: `${targetType}|${queryContext.groupWorkspaceKey}|${queryContext.scopeRef ?? ''}|ORGANIZATION`,
    pageSize: 50,
    keyOf: candidate => candidate.organizationRef,
  });
  const roleCandidates = useCursorCandidates<WorkspaceInvitationCandidatePage['roles'][number]>({
    queryText: roleCandidateQuery,
    resetKey: `${targetType}|${queryContext.groupWorkspaceKey}|${queryContext.scopeRef ?? ''}|ROLE`,
    pageSize: 50,
    keyOf: role => role.id,
  });
  const {
    acceptPage: acceptOrganizationCandidatePage,
    debouncedQueryText: organizationCandidateQueryText,
    items: organizationCandidateItems,
    onPopupScroll: onOrganizationCandidatePopupScroll,
    page: organizationCandidatePage,
    pageSize: organizationCandidatePageSize,
  } = organizationCandidates;
  const {
    acceptPage: acceptRoleCandidatePage,
    debouncedQueryText: roleCandidateQueryText,
    items: roleCandidateItems,
    onPopupScroll: onRoleCandidatePopupScroll,
    page: roleCandidatePage,
    pageSize: roleCandidatePageSize,
  } = roleCandidates;
  const organizationCandidateResult = useWorkspaceInvitationCandidates({
    targetType,
    queryContext,
    subjectType: 'ORGANIZATION',
    candidateUsage: 'LIST_FILTER',
    queryText: organizationCandidateQueryText,
    page: organizationCandidatePage,
    pageSize: organizationCandidatePageSize,
  });
  const roleCandidateResult = useWorkspaceInvitationCandidates({
    targetType,
    queryContext,
    subjectType: 'ROLE',
    candidateUsage: 'LIST_FILTER',
    queryText: roleCandidateQueryText,
    page: roleCandidatePage,
    pageSize: roleCandidatePageSize,
  });
  useEffect(() => {
    if (!organizationCandidateResult.currentData) return;
    const items = organizationCandidateResult.currentData.organizations.filter(
      candidate => candidate.serviceNodeType === targetType,
    );
    acceptOrganizationCandidatePage(items, organizationCandidateResult.currentData.metadata);
  }, [organizationCandidateResult.currentData, acceptOrganizationCandidatePage, organizationCandidatePage, targetType]);
  useEffect(() => {
    if (!roleCandidateResult.currentData) return;
    acceptRoleCandidatePage(roleCandidateResult.currentData.roles, roleCandidateResult.currentData.metadata);
  }, [acceptRoleCandidatePage, roleCandidatePage, roleCandidateResult.currentData]);
  const organizationOptions = organizationCandidateItems.map(candidate => ({
    value: candidate.organizationRef,
    label: <NameCodePathText nodes={candidate.pathNodes} />,
  }));
  const roleOptions = roleCandidateItems.map(role => ({value: role.id, label: role.name}));
  const selected = detail.target;
  const columns = useMemo<ProColumns<WorkspaceInvitation>[]>(
    () => [
      {
        title: '邀请手机号',
        dataIndex: 'maskedMobile',
        ellipsis: {showTitle: false},
        search: false,
        render: (_, value) => (
          <EllipsisTooltip title={value.maskedMobile}>
            <span>
              <Button
                type="link"
                onClick={() => detail.open(value)}
                {...testId('operations-workspace-invitation-open-detail')}
              >
                {value.maskedMobile}
              </Button>
            </span>
          </EllipsisTooltip>
        ),
      },
      {
        title: '邀请手机号',
        dataIndex: 'mobile',
        hideInTable: true,
        fieldProps: {
          ...testId('operations-workspace-invitation-query-mobile'),
          allowClear: true,
          placeholder: '请输入邀请手机号',
        },
      },
      {
        title: '任职机构',
        dataIndex: 'organizationRef',
        hideInTable: true,
        valueType: 'select',
        fieldProps: {
          showSearch: true,
          filterOption: false,
          onSearch: setOrganizationCandidateQuery,
          onPopupScroll: (event: Parameters<typeof onOrganizationCandidatePopupScroll>[0]) =>
            onOrganizationCandidatePopupScroll(event, organizationCandidateResult.isFetching),
          options: organizationOptions,
          loading: organizationCandidateResult.isFetching,
          allowClear: true,
          placeholder: '搜索机构名称或编码',
          ...testId('operations-workspace-invitation-query-organization'),
        },
      },
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
          ...testId('operations-workspace-invitation-query-role'),
        },
      },
      {
        title: '任职机构',
        dataIndex: 'targetOrganizationPathNodes',
        ellipsis: {showTitle: false},
        search: false,
        render: (_, value) => (
          <EllipsisTooltip title={<NameCodePathText nodes={value.targetOrganizationPathNodes} />}>
            <span>
              <NameCodePathText nodes={value.targetOrganizationPathNodes} />
            </span>
          </EllipsisTooltip>
        ),
      },
      {
        title: '业务角色',
        dataIndex: 'roleNames',
        search: false,
        render: (_, value) => (
          <Space size={[4, 4]} wrap>
            {value.roleNames.map(role => (
              <Tag key={role}>{role}</Tag>
            ))}
          </Space>
        ),
      },
      {
        title: '邀请链接',
        key: 'invitationRouteFacts',
        search: false,
        render: (_, value) => {
          const href = activeInvitationPageUrl(value);
          return href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              {...testId(`operations-workspace-invitation-entry-${value.id}`)}
            >
              打开邀请页
            </a>
          ) : (
            '—'
          );
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: Object.fromEntries(Object.entries(statusLabel).map(([value, text]) => [value, {text}])),
        fieldProps: {...testId('operations-workspace-invitation-query-status'), allowClear: true},
        render: (_, value) => (
          <Tag color={value.status === 'ACTIVE' ? 'blue' : value.status === 'COMPLETED' ? 'green' : 'default'}>
            {statusLabel[value.status]}
          </Tag>
        ),
      },
      {
        title: '有效期',
        dataIndex: 'expiresRange',
        hideInTable: true,
        valueType: 'dateRange',
        renderFormItem: () => (
          <DatePicker.RangePicker {...testId('operations-workspace-invitation-query-expires-range')} />
        ),
      },
      {
        title: '有效期',
        dataIndex: 'expiresAt',
        search: false,
        sorter: true,
        render: (_, value) => time(value.expiresAt),
      },
      {
        title: '发起时间',
        dataIndex: 'createdAt',
        search: false,
        sorter: true,
        render: (_, value) => time(value.createdAt),
      },
    ],
    [
      detail,
      onOrganizationCandidatePopupScroll,
      onRoleCandidatePopupScroll,
      organizationCandidateResult.isFetching,
      organizationOptions,
      roleCandidateResult.isFetching,
      roleOptions,
    ],
  );

  return (
    <>
      {problem && <Alert type="error" showIcon title="邀请管理失败" description={problem} style={{marginBottom: 16}} />}
      <ProTable<WorkspaceInvitation>
        size="small"
        search={{
          labelWidth: 'auto',
          optionRender: searchConfig => [
            <Button
              key="submit"
              type="primary"
              onClick={() => searchConfig.form?.submit()}
              {...testId('operations-workspace-invitation-query-submit')}
            >
              查询
            </Button>,
            <Button
              key="reset"
              onClick={() => {
                searchConfig.form?.resetFields();
                pagination.setPage(1);
                setFilters({});
              }}
              {...testId('operations-workspace-invitation-query-reset')}
            >
              重置
            </Button>,
          ],
        }}
        onSubmit={values => {
          pagination.setPage(1);
          setFilters(toAppliedFilters(values));
        }}
        options={false}
        rowKey="id"
        {...adminListState({
          loading: activeInvitations.isFetching,
          failed: Boolean(activeInvitations.error),
          emptyText: '当前范围暂无邀请',
          testIdPrefix: 'operations-workspace-invitation-list',
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
            setSort('CREATED_AT');
            setDirection('DESC');
            return;
          }
          setSort(sorter.columnKey === 'expiresAt' ? 'EXPIRES_AT' : 'CREATED_AT');
          setDirection(sorter.order === 'ascend' ? 'ASC' : 'DESC');
          pagination.setPage(1);
        }}
        toolBarRender={() =>
          canInvite
            ? [
                <Button
                  key="create"
                  type="primary"
                  onClick={() => setCreateOpen(true)}
                  {...testId('operations-workspace-invitation-create-open')}
                >
                  发出邀请
                </Button>,
              ]
            : []
        }
        pagination={{
          current: page,
          pageSize,
          total: result?.total ?? 0,
          showSizeChanger: true,
        }}
        {...testId('operations-workspace-invitation-table')}
      />
      <WorkspaceInvitationCreateDrawer
        open={createOpen}
        targetType={targetType}
        queryContext={queryContext}
        onClose={() => setCreateOpen(false)}
        onCreated={invitation => {
          setCreateOpen(false);
          detail.open(invitation);
        }}
      />
      <WorkspaceInvitationDetailDrawer
        open={detail.isOpen}
        invitation={selected}
        canInvite={canInvite}
        onClose={detail.close}
        onRequestAction={kind => setActionKind(kind)}
      />
      <WorkspaceInvitationActionModal
        open={selected !== undefined && actionKind !== undefined}
        kind={actionKind ?? 'cancel'}
        invitation={selected}
        queryContext={queryContext}
        targetType={targetType}
        onCancel={() => setActionKind(undefined)}
        onUpdated={invitation => {
          setActionKind(undefined);
          detail.open(invitation);
        }}
      />
    </>
  );
}
