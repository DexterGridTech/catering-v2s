import {ProTable} from '@ant-design/pro-components';
import {Alert, Button, Tag, Typography} from 'antd';
import {testId, useAsyncGenerationGuard, useDetailDrawer, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useMemo, useRef, useState} from 'react';
import {WorkspaceScope} from '../../../app/state/WorkspaceScope';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {platformClient, platformProblemOf, platformRtk, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import type {WorkspaceAccount} from '../../../app/api/generated/platform-edge';
import {WorkspaceAccountActionModal} from './WorkspaceAccountActionModal';
import {WorkspaceAccountDetailDrawer, type WorkspaceAccountAction} from './WorkspaceAccountDetailDrawer';
import {PlatformAuditHistoryModal, type PlatformAuditTarget} from '../../audit-history';

const accountStatusLabel = (status: WorkspaceAccount['status']) => status === 'ENABLED' ? '启用' : '停用';

export function AccountsPage() {
  return <WorkspaceScope>{(key) => <AccountsForWorkspace groupWorkspaceKey={key}/>}</WorkspaceScope>;
}

function AccountsForWorkspace({groupWorkspaceKey}: {groupWorkspaceKey: string}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [commandProblem, setProblem] = useState<PlatformApiProblem>();
  const [detailLoading, setDetailLoading] = useState(false);
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
    () => platformAdminRtkRequest.getWorkspaceAccounts({groupWorkspaceKey}, {query: {page, pageSize}}),
    [groupWorkspaceKey, page, pageSize],
  );
  const {data: result, error, isLoading} = platformRtk.useGetWorkspaceAccountsQuery(listRequest);
  const problem = error ? platformProblemOf(error) : commandProblem;

  const loadDetail = useCallback(async (accountId: string) => {
    const request = detailGeneration.begin();
    setDetailLoading(true);
    setProblem(undefined);
    try {
      const next = await platformClient.getWorkspaceAccount({groupWorkspaceKey, accountId}, {});
      if (detailGeneration.isCurrent(request)) detail.open(next);
    } catch (nextError) {
      if (detailGeneration.isCurrent(request)) setProblem(platformProblemOf(nextError));
    } finally {
      if (detailGeneration.isCurrent(request)) setDetailLoading(false);
    }
  }, [detail, detailGeneration, groupWorkspaceKey]);

  const closeActionAndRefresh = useCallback(async (accountId: string) => {
    setAction(undefined);
    setActionAccount(undefined);
    await loadDetail(accountId);
  }, [loadDetail]);

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
    detail.close();
  };
  const openPendingActionAfterDetailClosed = (open: boolean) => {
    const pending = pendingActionRef.current;
    if (open || !pending) return;
    setAction(pending.action);
    setActionAccount(pending.account);
    pendingActionRef.current = undefined;
    setPendingAction(undefined);
  };

  return <>
    <Typography.Paragraph>从姓名进入账号详情，再确认状态、凭据或任职动作；所有结果以最新 owner 读回为准。</Typography.Paragraph>
    {problem && <Alert type="error" showIcon message={problem.title} description={problem.detail}/>} 
    <div {...testId('workspace-account-table')}><ProTable<WorkspaceAccount>
      rowKey="id"
      loading={isLoading && !result && !problem}
      dataSource={result?.items}
      search={false}
      options={false}
      pagination={result ? {current: result.page, pageSize: result.pageSize, total: result.total, onChange: (nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); }} : false}
      columns={[
        {title: '姓名', render: (_, row) => <Button type="link" onClick={() => void loadDetail(row.id)} {...testId(`workspace-account-detail-${row.id}`)}>{row.displayName}</Button>},
        {title: '登录账号', dataIndex: 'loginName'},
        {title: '状态', render: (_, row) => <Tag>{accountStatusLabel(row.status)}</Tag>},
        {title: '任职机构', render: (_, row) => row.assignments.map((assignment) => assignment.organizationPath).join('、') || '—'},
        {title: '业务角色', render: (_, row) => row.assignments.map((assignment) => assignment.roleName).join('、') || '—'},
        {title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime'},
      ]}
    /></div>
    <WorkspaceAccountDetailDrawer
      open={detail.isOpen}
      loading={detailLoading}
      account={detail.target}
      onClose={detail.close}
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
  </>;
}
