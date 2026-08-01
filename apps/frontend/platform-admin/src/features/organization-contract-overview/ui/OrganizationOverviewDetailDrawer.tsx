import {Descriptions, Drawer} from 'antd';
import {adminDrawerSurfaceProps, testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import type {OrganizationOverviewItem} from '../../../app/api/generated/platform-edge';

export function OrganizationOverviewDetailDrawer({item, onClose}: {item?: OrganizationOverviewItem; onClose: () => void}) {
  useOverlayLock(Boolean(item));
  const status = item?.status === 'ENABLED' ? '已启用' : '已停用';
  const extensionItems = item?.extensionFields?.map((field) => ({key: `extension-${field.name}`, label: field.name, children: field.value || '—'})) ?? [];
  return <Drawer title={`${item?.type === 'BRAND' ? '品牌' : item?.type === 'TENANT' ? '经营租户' : item?.type === 'HEAD_COMPANY' ? '总公司' : item?.type === 'STORE' ? '门店' : '组织'}详情`} open={Boolean(item)} onClose={onClose} width={560} destroyOnHidden {...adminDrawerSurfaceProps} {...testId('platform-organization-detail-drawer')}>
    {item && <Descriptions bordered size="small" column={1} items={[{key: 'name', label: '名称', children: item.name}, {key: 'code', label: '编码', children: item.code}, {key: 'organization', label: '所属机构', children: item.path.map((part) => part.name).join(' / ') || '—'}, {key: 'status', label: '状态', children: status}, {key: 'notes', label: '备注', children: item.notes || '—'}, {key: 'updatedAt', label: '更新时间', children: new Date(item.updatedAt).toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}, ...extensionItems]}/>} 
  </Drawer>;
}
