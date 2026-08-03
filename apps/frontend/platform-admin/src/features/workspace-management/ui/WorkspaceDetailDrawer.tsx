import {Alert, Button, Descriptions, Drawer, Image, Space, Tag} from 'antd';
import {adminDrawerSurfaceProps, formatNameCode, testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import type {GroupWorkspaceDetail} from '../../../app/api/generated/platform-edge';

export function WorkspaceDetailDrawer({open, loading, problem, workspace, onClose, onAfterOpenChange, onEdit, onStatus, onInitialize, onAudit}: {open: boolean; loading: boolean; problem?: {title: string; detail: string}; workspace?: GroupWorkspaceDetail; onClose: () => void; onAfterOpenChange: (open: boolean) => void; onEdit: () => void; onStatus: () => void; onInitialize: () => void; onAudit: () => void}) {
  useOverlayLock(open);
  return <Drawer title="集团空间详情" open={open} loading={loading} onClose={onClose} afterOpenChange={onAfterOpenChange} size={600} {...adminDrawerSurfaceProps} {...testId('platform-workspace-detail-drawer')}
    extra={workspace && <Space>{!workspace.commercialGroup?.initialized && <Button onClick={onInitialize} {...testId('platform-workspace-initialize')}>初始化商业集团</Button>}<Button onClick={onAudit} {...testId('platform-workspace-audit-history')}>操作历史</Button><Button onClick={onEdit} {...testId('platform-workspace-edit')}>编辑</Button><Button danger={workspace.status === 'ENABLED'} onClick={onStatus} {...testId('platform-workspace-status')}>{workspace.status === 'ENABLED' ? '停用' : '启用'}</Button></Space>}>
    {problem && !workspace && <Alert type="error" showIcon title={problem.title} description={problem.detail} {...testId('platform-workspace-detail-problem')}/>}
    {workspace && <Descriptions bordered size="small" column={1} items={[
      {key: 'workspace', label: '集团空间', children: formatNameCode(workspace.name, workspace.groupWorkspaceKey)},
      {key: 'operationsTitle', label: '运营管理后台标题名称', children: workspace.operationsTitle},
      {key: 'logo', label: 'Logo', children: workspace.logoUrl ? <Image width={96} src={workspace.logoUrl} alt={`${workspace.name} Logo`}/> : '未配置'},
      {key: 'notes', label: '备注', children: workspace.notes ?? '—'},
      {key: 'status', label: '状态', children: <Tag color={workspace.status === 'ENABLED' ? 'success' : 'default'}>{workspace.status === 'ENABLED' ? '已启用' : '已停用'}</Tag>},
      {key: 'group', label: '商业集团', children: workspace.commercialGroup?.root ? formatNameCode(workspace.commercialGroup.root.groupName, workspace.commercialGroup.root.groupCode) : '尚未初始化'},
      {key: 'created', label: '创建时间', children: new Date(workspace.createdAt).toLocaleString('zh-CN')},
      {key: 'updated', label: '更新时间', children: new Date(workspace.updatedAt).toLocaleString('zh-CN')},
    ]}/>} 
  </Drawer>;
}
