import {Button, Descriptions, Drawer, Space} from 'antd';
import {adminDrawerSurfaceProps, testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import type {ContractOverviewItem} from '../../../app/api/generated/platform-edge';

export function ContractOverviewDetailDrawer({item, onClose, onAudit}: {item?: ContractOverviewItem; onClose: () => void; onAudit: () => void}) {
  useOverlayLock(Boolean(item));
  const extensionItems = item?.extensionFields?.map((field) => ({key: `extension-${field.name}`, label: field.name, children: field.value || '—'})) ?? [];
  return <Drawer title="合同详情" open={Boolean(item)} onClose={onClose} width={560} destroyOnHidden {...adminDrawerSurfaceProps} {...testId('platform-contract-detail-drawer')} extra={item && <Space><Button onClick={onAudit} {...testId('platform-contract-audit-history')}>操作历史</Button></Space>}>
    {item && <Descriptions bordered size="small" column={1} items={[{key: 'contractNo', label: '合同编号', children: item.contractRef.code}, {key: 'status', label: '状态', children: item.status === 'VALID' ? '生效中' : '已失效'}, {key: 'store', label: '门店', children: item.storeRef.name}, {key: 'phase', label: '分期', children: item.phaseName}, {key: 'tenant', label: '经营租户', children: item.tenantRef.name}, {key: 'date', label: '起止日期', children: `${item.effectiveFrom ?? '—'} 至 ${item.effectiveTo ?? '—'}`}, {key: 'items', label: '货号', children: item.itemSummary || '—'}, {key: 'note', label: '备注', children: item.note || '—'}, {key: 'createdAt', label: '创建时间', children: new Date(item.createdAt).toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}, {key: 'updatedAt', label: '更新时间', children: new Date(item.updatedAt).toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}, ...extensionItems]}/>} 
  </Drawer>;
}
