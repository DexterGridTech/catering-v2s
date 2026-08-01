import {Button, Descriptions, Drawer, Space} from 'antd';
import {adminDrawerSurfaceProps, testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import type {PlatformAdminDetail} from '../../../app/api/generated/platform-edge';

export function AdministratorDetailDrawer({admin, onClose, onAfterOpenChange, onEdit, onCredential, onStatus, onAudit}: {admin?: PlatformAdminDetail; onClose: () => void; onAfterOpenChange: (open: boolean) => void; onEdit: () => void; onCredential: () => void; onStatus: () => void; onAudit: () => void}) {
  useOverlayLock(Boolean(admin));
  return <Drawer title="管理员详情" open={Boolean(admin)} onClose={onClose} afterOpenChange={onAfterOpenChange} width={520} {...adminDrawerSurfaceProps} {...testId('platform-admin-detail-drawer')} extra={admin && <Space><Button onClick={onAudit} {...testId('platform-admin-detail-audit-history')}>操作历史</Button><Button onClick={onEdit} {...testId('platform-admin-detail-edit')}>编辑</Button><Button onClick={onCredential} {...testId('platform-admin-detail-credential')}>重置登录凭据</Button><Button danger={admin.status === 'ACTIVE'} onClick={onStatus} {...testId('platform-admin-detail-status')}>{admin.status === 'ACTIVE' ? '停用' : '启用'}</Button></Space>}>
    {admin && <Descriptions bordered size="small" column={1} items={[
      {key: 'loginName', label: '登录账号', children: admin.loginName},
      {key: 'userName', label: '姓名', children: admin.userName},
      {key: 'mobile', label: '手机号', children: admin.maskedMobile ?? '未填写'},
      {key: 'status', label: '状态', children: admin.status === 'ACTIVE' ? '已启用' : '已停用'},
      {key: 'lastLoginAt', label: '最近登录', children: admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString('zh-CN') : '暂无'},
      {key: 'updatedAt', label: '更新时间', children: new Date(admin.updatedAt).toLocaleString('zh-CN')},
      {key: 'audit', label: '审计摘要', children: admin.auditSummary},
    ]}/>} 
  </Drawer>;
}
