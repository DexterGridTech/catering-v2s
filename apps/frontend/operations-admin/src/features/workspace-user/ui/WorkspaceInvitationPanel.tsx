import {Alert, Button, DatePicker, Space, Tag} from 'antd';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {contextScopedQueryArgs, formatCodeNamePath, testId, useDetailDrawer} from '@catering-v2s/admin-ui-foundation';
import type {Dayjs} from 'dayjs';
import {useMemo, useState} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import type {SortDirection, WorkspaceInvitation, WorkspaceInvitationPage, WorkspaceInvitationSortKey, WorkspaceInvitationStatus} from '../../../app/api/generated/operations-edge';
import {userManagementFor, type UserManagementPageDesignKey} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {WorkspaceInvitationActionModal} from './WorkspaceInvitationActionModal';
import {WorkspaceInvitationCreateDrawer} from './WorkspaceInvitationCreateDrawer';
import {WorkspaceInvitationDetailDrawer} from './WorkspaceInvitationDetailDrawer';

type InvitationAction = 'cancel' | 'reissue';
type InvitationFilterForm = {
  mobile?: string;
  organizationQuery?: string;
  roleQuery?: string;
  status?: WorkspaceInvitationStatus;
  expiresRange?: [Dayjs, Dayjs];
};
type AppliedFilters = {
  mobile?: string;
  organizationQuery?: string;
  roleQuery?: string;
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
  return value ? new Date(value).toLocaleString('zh-CN') : '—';
}

function trimOrUndefined(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toAppliedFilters(values: InvitationFilterForm): AppliedFilters {
  const range = values.expiresRange;
  return {
    mobile: trimOrUndefined(values.mobile),
    organizationQuery: trimOrUndefined(values.organizationQuery),
    roleQuery: trimOrUndefined(values.roleQuery),
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<WorkspaceInvitationSortKey>('CREATED_AT');
  const [direction, setDirection] = useState<SortDirection>('DESC');
  const [filters, setFilters] = useState<AppliedFilters>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [actionKind, setActionKind] = useState<InvitationAction>();
  const detail = useDetailDrawer<WorkspaceInvitation>();
  const canInvite = actionCapabilityKeys.includes(userManagement.inviteActionKey);
  const targetType = userManagement.targetOrganizationType;
  const path = useMemo(() => ({groupWorkspaceKey: queryContext.groupWorkspaceKey}), [queryContext.groupWorkspaceKey]);
  const invitationOptions = useMemo(() => ({
    query: contextScopedQueryArgs({
      scopeRef: queryContext.scopeRef,
      mobile: filters.mobile,
      organizationQuery: filters.organizationQuery,
      roleQuery: filters.roleQuery,
      status: filters.status,
      expiresFrom: filters.expiresFrom,
      expiresTo: filters.expiresTo,
      page,
      pageSize,
      sort,
      direction,
    }, {
      groupWorkspaceKey: queryContext.groupWorkspaceKey,
      expectedContextVersion: queryContext.expectedContextVersion,
    }),
  }), [direction, filters.expiresFrom, filters.expiresTo, filters.mobile, filters.organizationQuery, filters.roleQuery, filters.status, page, pageSize, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, queryContext.scopeRef, sort]);
  const groupInvitations = operationsRtk.useGetOperationsWorkspaceGroupInvitationsQuery(operationsAdminRtkRequest.getOperationsWorkspaceGroupInvitations(path, invitationOptions), {skip: targetType !== 'GROUP'});
  const regionInvitations = operationsRtk.useGetOperationsWorkspaceRegionInvitationsQuery(operationsAdminRtkRequest.getOperationsWorkspaceRegionInvitations(path, invitationOptions), {skip: targetType !== 'REGION'});
  const projectInvitations = operationsRtk.useGetOperationsWorkspaceProjectInvitationsQuery(operationsAdminRtkRequest.getOperationsWorkspaceProjectInvitations(path, invitationOptions), {skip: targetType !== 'PROJECT'});
  const headCompanyInvitations = operationsRtk.useGetOperationsWorkspaceHeadCompanyInvitationsQuery(operationsAdminRtkRequest.getOperationsWorkspaceHeadCompanyInvitations(path, invitationOptions), {skip: targetType !== 'HEAD_COMPANY'});
  const storeInvitations = operationsRtk.useGetOperationsWorkspaceStoreInvitationsQuery(operationsAdminRtkRequest.getOperationsWorkspaceStoreInvitations(path, invitationOptions), {skip: targetType !== 'STORE'});
  const activeInvitations = targetType === 'GROUP' ? groupInvitations : targetType === 'REGION' ? regionInvitations : targetType === 'PROJECT' ? projectInvitations : targetType === 'HEAD_COMPANY' ? headCompanyInvitations : storeInvitations;
  const result = activeInvitations.data as WorkspaceInvitationPage | undefined;
  const problem = activeInvitations.error ? queryIssue(activeInvitations.error, '邀请列表读取失败，请稍后重试') : undefined;
  const selected = detail.target;
  const columns = useMemo<ProColumns<WorkspaceInvitation>[]>(() => [
    {title: '邀请手机号', dataIndex: 'maskedMobile', ellipsis: true, search: false, render: (_, value) => <Button type="link" onClick={() => detail.open(value)} {...testId('operations-workspace-invitation-open-detail')}>{value.maskedMobile}</Button>},
    {title: '邀请手机号', dataIndex: 'mobile', hideInTable: true, fieldProps: {...testId('operations-workspace-invitation-query-mobile'), allowClear: true, placeholder: '请输入邀请手机号'}},
    {title: '任职机构', dataIndex: 'organizationQuery', hideInTable: true, fieldProps: {...testId('operations-workspace-invitation-query-organization'), allowClear: true, placeholder: '请输入机构名称'}},
    {title: '业务角色', dataIndex: 'roleQuery', hideInTable: true, fieldProps: {...testId('operations-workspace-invitation-query-role'), allowClear: true, placeholder: '请输入业务角色'}},
    {title: '任职机构', dataIndex: 'targetOrganizationPath', ellipsis: true, search: false, render: (_, value) => formatCodeNamePath(value.targetOrganizationPath)},
    {title: '业务角色', dataIndex: 'roleNames', search: false, render: (_, value) => <Space size={[4, 4]} wrap>{value.roleNames.map((role) => <Tag key={role}>{role}</Tag>)}</Space>},
    {title: '状态', dataIndex: 'status', valueType: 'select', valueEnum: Object.fromEntries(Object.entries(statusLabel).map(([value, text]) => [value, {text}])), fieldProps: {...testId('operations-workspace-invitation-query-status'), allowClear: true}, render: (_, value) => <Tag color={value.status === 'ACTIVE' ? 'blue' : value.status === 'COMPLETED' ? 'green' : 'default'}>{statusLabel[value.status]}</Tag>},
    {title: '有效期', dataIndex: 'expiresRange', hideInTable: true, valueType: 'dateRange', renderFormItem: () => <DatePicker.RangePicker {...testId('operations-workspace-invitation-query-expires-range')}/>},
    {title: '有效期', dataIndex: 'expiresAt', search: false, sorter: true, render: (_, value) => time(value.expiresAt)},
  ], [detail]);

  return <>
    {problem && <Alert type="error" showIcon title="邀请管理失败" description={problem} style={{marginBottom: 16}}/>}
    <ProTable<WorkspaceInvitation>
      search={{labelWidth: 'auto', optionRender: (searchConfig) => [<Button key="submit" type="primary" onClick={() => searchConfig.form?.submit()} {...testId('operations-workspace-invitation-query-submit')}>查询</Button>, <Button key="reset" onClick={() => { searchConfig.form?.resetFields(); setPage(1); setFilters({}); }} {...testId('operations-workspace-invitation-query-reset')}>重置</Button>]}}
      onSubmit={(values) => { setPage(1); setFilters(toAppliedFilters(values)); }}
      options={false}
      rowKey="id"
      loading={activeInvitations.isLoading && !result}
      dataSource={result?.items ?? []}
      columns={columns}
      onChange={(_, __, nextSorter) => {
        const sorter = Array.isArray(nextSorter) ? nextSorter[0] : nextSorter;
        if (!sorter?.order) {
          setSort('CREATED_AT');
          setDirection('DESC');
          return;
        }
        setSort(sorter.columnKey === 'expiresAt' ? 'EXPIRES_AT' : 'CREATED_AT');
        setDirection(sorter.order === 'ascend' ? 'ASC' : 'DESC');
        setPage(1);
      }}
      toolBarRender={() => canInvite ? [<Button key="create" type="primary" onClick={() => setCreateOpen(true)} {...testId('operations-workspace-invitation-create-open')}>发出邀请</Button>] : []}
      pagination={{
        current: page,
        pageSize,
        total: result?.total ?? 0,
        showSizeChanger: true,
        onChange: (nextPage, nextSize) => {
          setPage(nextPage);
          setPageSize(nextSize);
        },
      }}
      locale={{emptyText: '当前范围暂无邀请'}}
      {...testId('operations-workspace-invitation-table')}
    />
    <WorkspaceInvitationCreateDrawer
      open={createOpen}
      targetType={targetType}
      queryContext={queryContext}
      onClose={() => setCreateOpen(false)}
      onCreated={(invitation) => {
        setCreateOpen(false);
        detail.open(invitation);
      }}
    />
    <WorkspaceInvitationDetailDrawer
      open={detail.isOpen}
      invitation={selected}
      canInvite={canInvite}
      onClose={detail.close}
      onRequestAction={(kind) => setActionKind(kind)}
    />
    <WorkspaceInvitationActionModal
      open={selected !== undefined && actionKind !== undefined}
      kind={actionKind ?? 'cancel'}
      invitation={selected}
      queryContext={queryContext}
      targetType={targetType}
      onCancel={() => setActionKind(undefined)}
      onUpdated={(invitation) => {
        setActionKind(undefined);
        detail.open(invitation);
      }}
    />
  </>;
}
