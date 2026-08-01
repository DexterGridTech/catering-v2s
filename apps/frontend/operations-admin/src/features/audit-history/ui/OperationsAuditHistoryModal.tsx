import {Alert, Button, Descriptions, Empty, List, Modal, Pagination, Spin, Table, Typography} from 'antd';
import {testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import type {AuditChange, AuditHistoryItem} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';

type AuditEntityType = Parameters<typeof operationsAdminRtkRequest.getOperationsEntityAuditHistory>[1]['query']['entityType'];
export type OperationsAuditTarget = {entityType: AuditEntityType; entityId: string; displayName?: string};

const actionLabels: Record<string, string> = {
  ORGANIZATION_NODE_CREATED: '已创建组织节点', ORGANIZATION_NODE_UPDATED: '已更新组织节点', ORGANIZATION_NODE_STATUS_CHANGED: '已更新组织节点状态', PROJECT_PHASE_NAMES_REPLACED: '已更新项目分期名称',
  BRAND_CREATED: '已创建品牌', BRAND_UPDATED: '已更新品牌', BRAND_STATUS_CHANGED: '已更新品牌状态',
  TENANT_CREATED: '已创建经营租户', TENANT_UPDATED: '已更新经营租户', TENANT_STATUS_CHANGED: '已更新经营租户状态',
  HEAD_COMPANY_CREATED: '已创建总公司', HEAD_COMPANY_UPDATED: '已更新总公司', HEAD_COMPANY_STATUS_CHANGED: '已更新总公司状态', HEAD_COMPANY_BRAND_AUTHORIZATION_ADDED: '已新增总公司品牌授权', HEAD_COMPANY_BRAND_AUTHORIZATION_REMOVED: '已移除总公司品牌授权',
  STORE_CREATED: '已创建门店', STORE_UPDATED: '已更新门店', STORE_STATUS_CHANGED: '已更新门店状态',
  CONTRACT_CREATED: '已创建合同', CONTRACT_UPDATED: '已更新合同', CONTRACT_INVALIDATED: '已设置合同失效',
  WORKSPACE_ACCOUNT_STATUS_CHANGED: '已更新账号状态', WORKSPACE_ACCOUNT_ASSIGNMENT_REVOKED: '已撤销账号任职',
  WORKSPACE_ACCOUNT_CREDENTIAL_RESET_REQUESTED: '已请求重置账号凭据',
  WORKSPACE_INVITATION_CREATED: '已创建邀请', WORKSPACE_INVITATION_CANCELLED: '已取消邀请', WORKSPACE_INVITATION_REISSUED: '已重新发送邀请', WORKSPACE_INVITATION_ACCEPT_INTENT_RECORDED: '已记录接受邀请意图', WORKSPACE_INVITATION_MOBILE_VERIFIED: '已验证手机号', WORKSPACE_INVITATION_CREDENTIAL_READY: '已完成凭据准备', WORKSPACE_INVITATION_COMPLETED: '已完成邀请',
  WORKSPACE_ROLE_CREATED: '已创建业务角色', ROLE_PERMISSIONS_REPLACED: '已更新业务角色授权', WORKSPACE_ROLE_STATUS_CHANGED: '已更新业务角色状态',
};
const fieldLabels: Record<string, string> = {
  status: '状态', displayName: '显示名称', name: '名称', legalName: '法定名称', creditCode: '统一社会信用代码',
  alias: '别名', remark: '备注', notes: '说明', description: '说明', contractNo: '合同编号', effectiveFrom: '生效日期', effectiveTo: '失效日期',
  relationship: '关联关系', lifecycleEvent: '生命周期事件', serviceNodeAssignment: '任职', pageAccessKeys: '可使用的功能菜单', capabilityKeys: '可执行的操作', phaseName: '项目分期', items: '货号',
};

function formatOccurredAt(value: number) {
  return new Intl.DateTimeFormat('zh-CN', {dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Shanghai'}).format(new Date(value));
}

const action = (value: string) => actionLabels[value] ?? '已记录操作';
const field = (value: string) => fieldLabels[value] ?? '字段变更';

/** Approved R5 master-detail read only: it is never a route, Drawer, or list action column. */
export function OperationsAuditHistoryModal({open, target, groupWorkspaceKey, onClose}: {open: boolean; target?: OperationsAuditTarget; groupWorkspaceKey: string; onClose: () => void}) {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string>();
  useOverlayLock(open);

  useEffect(() => { if (!open) { setPage(1); setSelectedId(undefined); } }, [open, target?.entityId, target?.entityType]);
  const request = useMemo(() => target ? operationsAdminRtkRequest.getOperationsEntityAuditHistory({}, {query: {groupWorkspaceKey, entityType: target.entityType, entityId: target.entityId, page, pageSize: 20}}) : undefined, [groupWorkspaceKey, page, target?.entityId, target?.entityType]);
  const query = operationsRtk.useGetOperationsEntityAuditHistoryQuery(request!, {skip: !open || !request});
  const problem = query.error ? operationsProblemOf(query.error) : undefined;
  const inaccessible = problem?.errorCode === 'PLATFORM_COMMON_ACCESS_DENIED' || problem?.errorCode === 'PLATFORM_COMMON_RESOURCE_NOT_FOUND';
  useEffect(() => { if (open && inaccessible) onClose(); }, [inaccessible, onClose, open]);
  useEffect(() => { if (query.data?.items) setSelectedId(query.data.items[0]?.id); }, [query.data?.items]);
  const selected = query.data?.items.find((item) => item.id === selectedId) ?? query.data?.items[0];

  return <Modal title={target?.displayName ? `操作历史 · ${target.displayName}` : '操作历史'} open={open} onCancel={onClose} width={980} destroyOnHidden footer={<Button onClick={onClose}>关闭</Button>} {...testId('operations-audit-history-modal')}>
    {problem && !inaccessible && <Alert type="error" showIcon message="无法读取操作历史" description={<Button type="link" onClick={() => void query.refetch()} {...testId('operations-audit-history-retry')}>重试</Button>} style={{marginBottom: 16}}/>}
    {query.isLoading && !query.data ? <Spin {...testId('operations-audit-history-loading')}/> : !query.data ? null : query.data.items.length === 0 ? <Empty description="暂无操作历史" {...testId('operations-audit-history-empty')}/> : <div style={{display: 'grid', gridTemplateColumns: '330px minmax(0, 1fr)', gap: 20}}>
      <section aria-label="操作历史时间列表" {...testId('operations-audit-history-list')}><List dataSource={query.data.items} renderItem={(item) => <List.Item style={{padding: 0}}><button type="button" onClick={() => setSelectedId(item.id)} {...testId(`operations-audit-history-item-${item.id}`)} style={{width: '100%', border: 0, background: item.id === selected?.id ? '#e6f4ff' : 'transparent', textAlign: 'left', padding: '12px 10px', cursor: 'pointer'}}><Typography.Text strong>{formatOccurredAt(item.occurredAt)}</Typography.Text><br/><Typography.Text>{item.actorDisplayName} · {action(item.action)}</Typography.Text></button></List.Item>}/><Pagination current={query.data.page} pageSize={query.data.pageSize} total={query.data.total} showSizeChanger={false} onChange={setPage} style={{marginTop: 12}} {...testId('operations-audit-history-pagination')}/></section>
      <section aria-label="操作历史详情" {...testId('operations-audit-history-detail')}>{selected ? <AuditDetail item={selected}/> : <Empty description="请选择一条操作历史"/>}</section>
    </div>}
  </Modal>;
}

function AuditDetail({item}: {item: AuditHistoryItem}) { return <><Descriptions bordered size="small" column={1} items={[{key: 'occurredAt', label: '操作时间', children: formatOccurredAt(item.occurredAt)}, {key: 'actor', label: '操作人', children: item.actorDisplayName}, {key: 'action', label: '操作', children: action(item.action)}]}/><Table<AuditChange> style={{marginTop: 16}} rowKey={(row) => row.fieldKey} pagination={false} dataSource={item.changes} locale={{emptyText: '该操作不包含可展示的字段变更'}} columns={[{title: '字段', dataIndex: 'fieldKey', render: field}, {title: '变更前', dataIndex: 'beforeValue', render: (value: string) => value || '—'}, {title: '变更后', dataIndex: 'afterValue', render: (value: string) => value || '—'}]}/></>; }
