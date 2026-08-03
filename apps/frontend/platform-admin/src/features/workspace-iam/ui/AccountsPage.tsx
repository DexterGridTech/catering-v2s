import {ProTable, type ProColumns, type ProFormInstance} from '@ant-design/pro-components';
import {Alert, Button, Space, Tabs, Tag, Typography} from 'antd';
import {adminListState, formatCodeNamePath, testId, useAsyncGenerationGuard, useDetailDrawer, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useMemo, useRef, useState} from 'react';
import {WorkspaceScope} from '../../../app/state/WorkspaceScope';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {platformClient, platformProblemOf, platformRtk, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import type {ServiceNodeType, SortDirection, WorkspaceAccount, WorkspaceAccountStatus, WorkspaceInvitationCandidatePage, WorkspacePlatformAccountSortKey} from '../../../app/api/generated/platform-edge';
import {WorkspaceAccountActionModal} from './WorkspaceAccountActionModal';
import {WorkspaceAccountDetailDrawer, type WorkspaceAccountAction} from './WorkspaceAccountDetailDrawer';
import {PlatformAuditHistoryModal, type PlatformAuditTarget} from '../../audit-history';
import {PlatformInvitationPanel} from './PlatformInvitationPanel';

const accountStatusLabel = (status: WorkspaceAccount['status']) => status === 'ENABLED' ? '启用' : '停用';
const nodeLabels: Record<ServiceNodeType, string> = {GROUP: '集团', REGION: '大区', PROJECT: '项目', HEAD_COMPANY: '总公司', STORE: '门店'};
const accountTargetTypes: ServiceNodeType[] = ['GROUP', 'REGION', 'PROJECT', 'HEAD_COMPANY', 'STORE'];
type AccountFilters = {userName?: string; mobile?: string; loginName?: string; roleQuery?: string; status?: WorkspaceAccountStatus; serviceNodeType?: ServiceNodeType; organizationRef?: string};
const text = (value?: string) => value?.trim() || undefined;

export function AccountsPage() {
  return <WorkspaceScope>{(key) => <AccountsForWorkspace groupWorkspaceKey={key}/>}</WorkspaceScope>;
}

function AccountsForWorkspace({groupWorkspaceKey}: {groupWorkspaceKey: string}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<WorkspacePlatformAccountSortKey>('LOGIN_NAME');
  const [direction, setDirection] = useState<SortDirection>('ASC');
  const [filters, setFilters] = useState<AccountFilters>({});
  const [organizationType, setOrganizationType] = useState<ServiceNodeType>();
  const [organizationQuery, setOrganizationQuery] = useState('');
  const [roleCandidateQuery, setRoleCandidateQuery] = useState('');
  const formRef = useRef<ProFormInstance | undefined>(undefined);
  const [commandProblem, setProblem] = useState<PlatformApiProblem>();
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<WorkspaceAccountAction>();
  const [actionAccount, setActionAccount] = useState<WorkspaceAccount>();
  const [pendingAction, setPendingAction] = useState<{action: WorkspaceAccountAction; account: WorkspaceAccount}>();
  const [auditTarget, setAuditTarget] = useState<PlatformAuditTarget>();
  const detail = useDetailDrawer<WorkspaceAccount>();
  const pendingActionRef = useRef<typeof pendingAction>(undefined);
  pendingActionRef.current = pendingAction;
  const detailGeneration = useAsyncGenerationGuard();
  useOverlayLock(detail.isOpen || action !== undefined || Boolean(auditTarget));
  const listRequest = useMemo(
    () => platformAdminRtkRequest.getWorkspaceAccounts({groupWorkspaceKey}, {query: {...filters, page, pageSize, sort, direction}}),
    [direction, filters, groupWorkspaceKey, page, pageSize, sort],
  );
  const {data: result, error, isLoading, refetch} = platformRtk.useGetWorkspaceAccountsQuery(listRequest);
  const organizationCandidateRequest = useMemo(
    () => organizationType ? platformAdminRtkRequest.getWorkspaceInvitationCandidates({groupWorkspaceKey}, {query: {targetOrganizationType: organizationType, subjectType: 'ORGANIZATION', queryText: organizationQuery || undefined, page: 1, pageSize: 50}}) : undefined,
    [groupWorkspaceKey, organizationQuery, organizationType],
  );
  const organizationCandidates = platformRtk.useGetWorkspaceInvitationCandidatesQuery(organizationCandidateRequest!, {skip: !organizationCandidateRequest});
  const roleCandidateRequest = useMemo(
    () => organizationType ? platformAdminRtkRequest.getWorkspaceInvitationCandidates({groupWorkspaceKey}, {query: {targetOrganizationType: organizationType, subjectType: 'ROLE', queryText: roleCandidateQuery || undefined, page: 1, pageSize: 50}}) : undefined,
    [groupWorkspaceKey, organizationType, roleCandidateQuery],
  );
  const roleCandidates = platformRtk.useGetWorkspaceInvitationCandidatesQuery(roleCandidateRequest!, {skip: !roleCandidateRequest});
  const problem = error ? platformProblemOf(error) : commandProblem;

  const loadDetail = useCallback(async (accountId: string) => {
    const request = detailGeneration.begin();
    detail.openLoading();
    setProblem(undefined);
    try {
      const next = await platformClient.getWorkspaceAccount({groupWorkspaceKey, accountId}, {});
      if (detailGeneration.isCurrent(request)) detail.open(next);
    } catch (nextError) {
      if (detailGeneration.isCurrent(request)) { detail.finishLoading(); setProblem(platformProblemOf(nextError)); }
    }
  }, [detail, detailGeneration, groupWorkspaceKey]);
  const closeDetail = useCallback(() => { detailGeneration.invalidate(); detail.close(); }, [detail, detailGeneration]);

  const closeActionAndRefresh = useCallback(async (accountId: string) => {
    setAction(undefined);
    setActionAccount(undefined);
    await Promise.all([loadDetail(accountId), refetch()]);
  }, [loadDetail, refetch]);

  const submitAction = async (idempotencyKey: string) => {
    if (!actionAccount || !action) return;
    const account = actionAccount;
    setBusy(true);
    setProblem(undefined);
    try {
      if (action.kind === 'STATUS') {
        await platformClient.transitionWorkspaceAccountStatus(
          {groupWorkspaceKey, accountId: account.id},
          {body: {targetStatus: action.targetStatus, expectedVersion: account.revision}, headers: {'Idempotency-Key': idempotencyKey}},
        );
      } else if (action.kind === 'CREDENTIAL_RESET') {
        await platformClient.requestWorkspaceCredentialReset(
          {groupWorkspaceKey, accountId: account.id},
          {body: {expectedVersion: account.revision}, headers: {'Idempotency-Key': idempotencyKey}},
        );
      } else {
        await platformClient.revokePlatformWorkspaceAssignment(
          {groupWorkspaceKey, accountId: account.id, assignmentId: action.assignment.id},
          {body: {expectedVersion: action.assignment.revision}, headers: {'Idempotency-Key': idempotencyKey}},
        );
      }
    } catch (nextError) {
      setProblem(platformProblemOf(nextError));
    } finally {
      setBusy(false);
      await closeActionAndRefresh(account.id);
    }
  };
  const requestDetailAction = (nextAction: WorkspaceAccountAction) => {
    if (!detail.target) return;
    const next = {action: nextAction, account: detail.target};
    pendingActionRef.current = next;
    setPendingAction(next);
    closeDetail();
  };
  const openPendingActionAfterDetailClosed = (open: boolean) => {
    const pending = pendingActionRef.current;
    if (open || !pending) return;
    setAction(pending.action);
    setActionAccount(pending.account);
    pendingActionRef.current = undefined;
    setPendingAction(undefined);
  };
  const listState = adminListState({loading: isLoading && !result && !error, failed: Boolean(error), emptyText: '暂无账号', testIdPrefix: 'workspace-account-list'});
  const candidateOptions = ((organizationCandidates.data as WorkspaceInvitationCandidatePage | undefined)?.organizations ?? [])
    .filter((candidate) => candidate.serviceNodeType === organizationType)
    .map((candidate) => ({value: candidate.organizationRef, label: formatCodeNamePath(candidate.path)}));
  const roleOptions = ((roleCandidates.data as WorkspaceInvitationCandidatePage | undefined)?.roles ?? []).map((role) => ({value: role.name, label: role.name}));
  const columns = useMemo<ProColumns<WorkspaceAccount>[]>(() => [
    {title: '姓名', key: 'displayName', dataIndex: 'displayName', sorter: true, render: (_, row) => <Button type="link" onClick={() => void loadDetail(row.id)} {...testId(`workspace-account-detail-${row.id}`)}>{row.displayName}</Button>},
    {title: '手机号', dataIndex: 'mobile', fieldProps: {...testId('workspace-account-query-mobile'), allowClear: true}},
    {title: '登录账号', dataIndex: 'loginName', sorter: true, fieldProps: {...testId('workspace-account-query-login-name'), allowClear: true}},
    {title: '状态', dataIndex: 'status', valueType: 'select', valueEnum: {ENABLED: {text: '启用'}, DISABLED: {text: '停用'}}, fieldProps: {...testId('workspace-account-query-status'), allowClear: true}, render: (_, row) => <Tag>{accountStatusLabel(row.status)}</Tag>},
    {title: '任职机构类型', dataIndex: 'serviceNodeType', hideInTable: true, valueType: 'select', valueEnum: Object.fromEntries(accountTargetTypes.map((value) => [value, {text: nodeLabels[value]}])), fieldProps: {allowClear: true, ...testId('workspace-account-query-organization-type'), onChange: (value: ServiceNodeType | undefined) => { setOrganizationType(value); setOrganizationQuery(''); setRoleCandidateQuery(''); formRef.current?.setFieldValue('organizationRef', undefined); formRef.current?.setFieldValue('roleQuery', undefined); }}},
    {title: '任职机构', dataIndex: 'organizationRef', hideInTable: true, valueType: 'select', fieldProps: {showSearch: {filterOption: false, onSearch: setOrganizationQuery}, disabled: !organizationType, options: candidateOptions, loading: organizationCandidates.isFetching, allowClear: true, placeholder: organizationType ? '搜索机构名称或编码' : '请先选择任职机构类型', ...testId('workspace-account-query-organization')}},
    {title: '业务角色', dataIndex: 'roleQuery', hideInTable: true, valueType: 'select', fieldProps: {showSearch: {filterOption: false, onSearch: setRoleCandidateQuery}, disabled: !organizationType, options: roleOptions, loading: roleCandidates.isFetching, allowClear: true, placeholder: organizationType ? '搜索业务角色' : '请先选择任职机构类型', ...testId('workspace-account-query-role')}},
    {title: '任职机构 / 业务角色', key: 'assignments', search: false, render: (_, row) => <Space direction="vertical" size={2}>{row.assignments.map((assignment) => <Space key={assignment.id} size={8} wrap><span><Tag>{nodeLabels[assignment.serviceNodeType]}</Tag>{formatCodeNamePath(assignment.organizationPath)}</span><Typography.Text type="secondary">{assignment.roleName}</Typography.Text></Space>)}</Space>},
    {title: '最后登录时间', dataIndex: 'lastLoginAt', valueType: 'dateTime', sorter: true, search: false},
    {title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime', sorter: true, search: false},
  ], [candidateOptions, loadDetail, organizationCandidates.isFetching, organizationType, roleCandidates.isFetching, roleOptions]);

  return <Tabs defaultActiveKey="accounts" items={[{key: 'accounts', label: '账号', children: <>
    <Typography.Paragraph type="secondary" style={{margin: '0 0 16px'}}>从姓名进入账号详情，再确认状态、凭据或任职动作；所有结果以最新 owner 读回为准。</Typography.Paragraph>
    {problem && <Alert type="error" showIcon title={problem.title} description={problem.detail} {...testId('workspace-account-list-error')}/>}
    <div {...testId('workspace-account-table')}><ProTable<WorkspaceAccount>
      formRef={formRef}
      rowKey="id"
      loading={listState.loading}
      locale={listState.locale}
      dataSource={result?.items}
      search={{labelWidth: 'auto', optionRender: (searchConfig) => [
        <Button key="submit" type="primary" onClick={() => searchConfig.form?.submit()} {...testId('workspace-account-query-submit')}>查询</Button>,
        <Button key="reset" onClick={() => { searchConfig.form?.resetFields(); setFilters({}); setPage(1); setOrganizationType(undefined); setOrganizationQuery(''); setRoleCandidateQuery(''); }} {...testId('workspace-account-query-reset')}>重置</Button>,
      ]}}
      options={false}
      pagination={result ? {current: result.page, pageSize: result.pageSize, total: result.total, onChange: (nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); }} : false}
      columns={columns}
      onSubmit={(values) => { setPage(1); setFilters({userName: text(values.displayName), mobile: text(values.mobile), loginName: text(values.loginName), roleQuery: text(values.roleQuery), status: values.status, serviceNodeType: values.serviceNodeType, organizationRef: values.organizationRef}); }}
      onReset={() => { setPage(1); setFilters({}); setOrganizationType(undefined); setOrganizationQuery(''); }}
      onChange={(_, __, nextSorter) => {
        const sorter = Array.isArray(nextSorter) ? nextSorter[0] : nextSorter;
        if (!sorter?.order) {
          setSort('LOGIN_NAME');
          setDirection('ASC');
          return;
        }
        setSort(sorter.columnKey === 'displayName' ? 'DISPLAY_NAME' : sorter.columnKey === 'lastLoginAt' ? 'LAST_LOGIN_AT' : sorter.columnKey === 'updatedAt' ? 'UPDATED_AT' : 'LOGIN_NAME');
        setDirection(sorter.order === 'ascend' ? 'ASC' : 'DESC');
        setPage(1);
      }}
    /></div>
    <WorkspaceAccountDetailDrawer
      open={detail.isOpen}
      loading={detail.loading}
      account={detail.target}
      onClose={closeDetail}
      onAfterOpenChange={openPendingActionAfterDetailClosed}
      onOpenAction={requestDetailAction}
      onAudit={() => detail.target && setAuditTarget({entityType: 'WORKSPACE_ACCOUNT', entityId: detail.target.id, displayName: detail.target.displayName})}
    />
    <WorkspaceAccountActionModal
      key={action ? `${actionAccount?.id ?? 'unknown'}:${action.kind}:${action.kind === 'STATUS' ? action.targetStatus : action.kind === 'REVOKE_ASSIGNMENT' ? action.assignment.id : ''}` : 'closed'}
      open={action !== undefined}
      action={action}
      account={actionAccount}
      busy={busy}
      onClose={() => { setAction(undefined); setActionAccount(undefined); }}
      onConfirm={submitAction}
    />
    <PlatformAuditHistoryModal open={Boolean(auditTarget)} target={auditTarget} groupWorkspaceKey={groupWorkspaceKey} onClose={() => setAuditTarget(undefined)}/>
  </>}, {key: 'invitations', label: '邀请', children: <PlatformInvitationPanel groupWorkspaceKey={groupWorkspaceKey}/>}]}/>;
}
