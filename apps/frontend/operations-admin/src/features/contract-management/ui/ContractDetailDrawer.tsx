import {Alert, Button, Descriptions, Drawer, Space} from 'antd';
import {adminDrawerSurfaceProps, testId, useDetailDrawer, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import type {JsonValue, StoreContract} from '../../../app/api/generated/operations-edge';
import type {OperationsPageProps} from '../../../app/routing/model';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {OperationsAuditHistoryModal} from '../../audit-history';

type Props = {contract?: StoreContract; queryContext: OperationsPageProps['queryContext']; canEdit: boolean; canInvalidate: boolean; onClose: () => void; onEdit: (contract: StoreContract) => void; onInvalidate: (contract: StoreContract) => void};

export function ContractDetailDrawer({contract, queryContext, canEdit, canInvalidate, onClose, onEdit, onInvalidate}: Props) {
  const [auditOpen, setAuditOpen] = useState(false);
  const latest = useDetailDrawer<StoreContract>();
  useOverlayLock(Boolean(contract));
  const detailRequest = useMemo(() => operationsAdminRtkRequest.getOperationsContract({groupWorkspaceKey: queryContext.groupWorkspaceKey, contractId: contract?.id ?? ''}, {query: {expectedContextVersion: queryContext.expectedContextVersion}}), [contract?.id, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey]);
  const detailQuery = operationsRtk.useGetOperationsContractQuery(detailRequest, {skip: !contract});
  const selected = detailQuery.data ?? contract;
  const definitionRequest = useMemo(() => operationsAdminRtkRequest.getOperationsContractExtensionDefinition({groupWorkspaceKey: queryContext.groupWorkspaceKey}, {query: {expectedContextVersion: queryContext.expectedContextVersion, projectId: selected?.project.id ?? ''}}), [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, selected?.project.id]);
  const definitionQuery = operationsRtk.useGetOperationsContractExtensionDefinitionQuery(definitionRequest, {skip: !selected});
  useEffect(() => { if (selected) latest.open(selected); else latest.close(); }, [latest, selected]);
  const extensionItems = [...(definitionQuery.data?.definitions ?? [])].filter((field) => field.status !== 'DISABLED').sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)).map((field) => ({key: `extension-${field.key}`, label: field.label, children: valueOf(selected?.extensionValues?.[field.key])}));
  const closeThen = (next: (value: StoreContract) => void) => { if (!latest.target) return; const current = latest.target; latest.close(); onClose(); next(current); };
  return <><Drawer title={selected ? `合同详情：${selected.contractNo}` : '合同详情'} open={Boolean(contract)} onClose={() => { latest.close(); onClose(); }} width={640} destroyOnHidden {...adminDrawerSurfaceProps} {...testId('operations-contract-detail-drawer')} extra={selected && <Space><Button onClick={() => setAuditOpen(true)} {...testId('operations-contract-detail-audit-history')}>操作历史</Button>{canEdit && selected.status === 'VALID' && <Button onClick={() => closeThen(onEdit)} {...testId('operations-contract-detail-edit')}>编辑</Button>}{canInvalidate && selected.status === 'VALID' && <Button danger onClick={() => closeThen(onInvalidate)} {...testId('operations-contract-detail-invalidate')}>作废</Button>}</Space>}>
    {detailQuery.isLoading && <span aria-live="polite" {...testId('operations-contract-detail-loading')}>正在加载合同详情</span>}
    {detailQuery.error && <Alert type="error" showIcon message="详情加载失败" description="请关闭后重新进入详情。" {...testId('operations-contract-detail-error')}/>}
    {definitionQuery.error && <Alert type="warning" showIcon message="扩展字段加载失败" description="当前仅显示已确认的基础资料。" {...testId('operations-contract-detail-extension-error')}/>}
    {selected && <Descriptions bordered column={1} items={[{key: 'contractNo', label: '合同编号', children: selected.contractNo}, {key: 'store', label: '门店', children: selected.store.name}, {key: 'phase', label: '项目分期', children: selected.phaseName}, {key: 'tenant', label: '经营租户', children: selected.tenant.name}, {key: 'items', label: '货号', children: selected.items.map((item) => `${item.code} / ${item.name}`).join('；')}, {key: 'effective', label: '起止日期', children: `${selected.effectiveFrom} 至 ${selected.effectiveTo ?? '长期'}`}, {key: 'status', label: '状态', children: selected.status === 'VALID' ? '有效' : '已失效'}, {key: 'note', label: '备注', children: selected.note ?? '—'}, {key: 'updatedAt', label: '更新时间', children: new Date(selected.updatedAt).toLocaleString()}, ...extensionItems]}/>} 
  </Drawer><OperationsAuditHistoryModal open={auditOpen} target={selected ? {entityType: 'STORE_CONTRACT', entityId: selected.id, displayName: selected.contractNo} : undefined} groupWorkspaceKey={queryContext.groupWorkspaceKey} onClose={() => setAuditOpen(false)}/></>;
}

function valueOf(value: JsonValue | undefined) { return value === undefined || value === null || value === '' ? '—' : String(value); }
