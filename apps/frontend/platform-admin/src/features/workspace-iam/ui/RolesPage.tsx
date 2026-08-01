import {ProTable} from '@ant-design/pro-components';
import {Alert, Button, Tag, Typography} from 'antd';
import {testId, useAsyncGenerationGuard, useDetailDrawer, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useMemo, useRef, useState} from 'react';
import {WorkspaceScope} from '../../../app/state/WorkspaceScope';
import {type WorkspaceRole} from '../../../app/api/generated/platform-edge';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {platformClient, platformProblemOf, platformRtk, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import {adminCatalog, platformPageDesignKeys} from '../../../app/catalog/generatedAdminCatalog';
import {RoleCreateDrawer} from './RoleCreateDrawer';
import {RoleDetailDrawer} from './RoleDetailDrawer';
import {RoleEditDrawer} from './RoleEditDrawer';
import {RoleStatusModal} from './RoleStatusModal';
import {serviceNodeTypeLabel} from './RolePermissionFields';
import {PlatformAuditHistoryModal, type PlatformAuditTarget} from '../../audit-history';
const rolesPage = adminCatalog.platformPages.find((page) => page.pageDesignKey === platformPageDesignKeys.PlatformRoles);
if (!rolesPage) throw new Error('Missing generated roles page');
const rolesPageTitle = rolesPage.title;

export function RolesPage() {
  return <WorkspaceScope>{(key) => <RolesForWorkspace groupWorkspaceKey={key}/>}</WorkspaceScope>;
}

function RolesForWorkspace({groupWorkspaceKey}: {groupWorkspaceKey: string}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceRole>();
  const [statusRole, setStatusRole] = useState<WorkspaceRole>();
  const [auditTarget, setAuditTarget] = useState<PlatformAuditTarget>();
  const [pendingAction, setPendingAction] = useState<{kind: 'edit' | 'status'; role: WorkspaceRole}>();
  const [commandProblem, setProblem] = useState<PlatformApiProblem>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const detail = useDetailDrawer<WorkspaceRole>();
  const pendingActionRef = useRef<typeof pendingAction>(undefined);
  pendingActionRef.current = pendingAction;
  const detailGeneration = useAsyncGenerationGuard();
  useOverlayLock(detail.isOpen || createOpen || Boolean(editing) || Boolean(statusRole) || Boolean(auditTarget));
  const listRequest = useMemo(() => platformAdminRtkRequest.getWorkspaceRoles({groupWorkspaceKey}, {query: {page, pageSize}}), [groupWorkspaceKey, page, pageSize]);
  const {data: result, error, isLoading} = platformRtk.useGetWorkspaceRolesQuery(listRequest);
  const problem = error ? platformProblemOf(error) : commandProblem;
  const loadDetail = useCallback(async (roleId: string) => {
    const request = detailGeneration.begin();
    setDetailLoading(true); setProblem(undefined);
    try {
      const next = await platformClient.getWorkspaceRole({groupWorkspaceKey, roleId}, {});
      if (detailGeneration.isCurrent(request)) detail.open(next);
    } catch (nextError) {
      if (detailGeneration.isCurrent(request)) setProblem(platformProblemOf(nextError));
    } finally {
      if (detailGeneration.isCurrent(request)) setDetailLoading(false);
    }
  }, [detail, detailGeneration, groupWorkspaceKey]);
  const submitStatus = async (idempotencyKey: string) => {
    if (!statusRole) return;
    const role = statusRole;
    setBusy(true); setProblem(undefined);
    try {
      await platformClient.transitionWorkspaceRoleStatus({groupWorkspaceKey, roleId: role.id}, {body: {targetStatus: role.status === 'ENABLED' ? 'DISABLED' : 'ENABLED', expectedVersion: role.revision}, headers: {'Idempotency-Key': idempotencyKey}});
    } catch (nextError) { setProblem(platformProblemOf(nextError)); } finally {
      setBusy(false); setStatusRole(undefined); await loadDetail(role.id);
    }
  };
  const requestDetailAction = (kind: 'edit' | 'status') => {
    if (!detail.target) return;
    const next = {kind, role: detail.target};
    pendingActionRef.current = next;
    setPendingAction(next);
    detail.close();
  };
  const openPendingActionAfterDetailClosed = (open: boolean) => {
    const pending = pendingActionRef.current;
    if (open || !pending) return;
    if (pending.kind === 'edit') setEditing(pending.role);
    else setStatusRole(pending.role);
    pendingActionRef.current = undefined;
    setPendingAction(undefined);
  };
  return <>
    <Typography.Title level={4}>{rolesPageTitle}</Typography.Title>
    <Typography.Paragraph>为不同任职机构类型配置可使用的功能菜单和可执行的操作；保存与状态变更均由集团空间 owner 最终校验。</Typography.Paragraph>
    {problem && <Alert type="error" showIcon message={problem.title} description={problem.detail}/>} 
    <ProTable<WorkspaceRole>
      rowKey="id" loading={isLoading && !result && !problem} dataSource={result?.items} search={false} options={false}
      toolBarRender={() => [<Button key="create" type="primary" onClick={() => setCreateOpen(true)} {...testId('workspace-role-create')}>新建业务角色</Button>]}
      pagination={result ? {current: result.page, pageSize: result.pageSize, total: result.total, onChange: (nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); }} : false}
      columns={[
        {title: '名称', render: (_, row) => <Button type="link" onClick={() => void loadDetail(row.id)} {...testId(`workspace-role-detail-${row.id}`)}>{row.name}</Button>},
        {title: '任职机构类型', render: (_, row) => serviceNodeTypeLabel(row.serviceNodeType)},
        {title: '状态', render: (_, row) => <Tag>{row.status === 'ENABLED' ? '启用' : '停用'}</Tag>},
        {title: '说明', dataIndex: 'description', render: (value) => value || '—'},
        {title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime'},
      ]}
    />
    <RoleCreateDrawer open={createOpen} groupWorkspaceKey={groupWorkspaceKey} catalog={result} onClose={() => setCreateOpen(false)} onCreated={(role) => void loadDetail(role.id)}/>
    <RoleDetailDrawer open={detail.isOpen} loading={detailLoading} role={detail.target} catalog={result} onClose={detail.close} onAfterOpenChange={openPendingActionAfterDetailClosed} onEdit={() => requestDetailAction('edit')} onChangeStatus={() => requestDetailAction('status')} onAudit={() => detail.target && setAuditTarget({entityType: 'WORKSPACE_ROLE', entityId: detail.target.id, displayName: detail.target.name})}/>
    <RoleEditDrawer role={editing} groupWorkspaceKey={groupWorkspaceKey} catalog={result} onClose={() => setEditing(undefined)} onUpdated={(role) => void loadDetail(role.id)}/>
    <RoleStatusModal key={statusRole ? `${statusRole.id}:${statusRole.status}` : 'closed'} role={statusRole} busy={busy} onClose={() => setStatusRole(undefined)} onConfirm={submitStatus}/>
    <PlatformAuditHistoryModal open={Boolean(auditTarget)} target={auditTarget} groupWorkspaceKey={groupWorkspaceKey} onClose={() => setAuditTarget(undefined)}/>
  </>;
}
