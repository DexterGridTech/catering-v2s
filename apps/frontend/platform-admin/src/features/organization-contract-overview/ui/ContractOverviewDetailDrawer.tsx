import {Alert, Button, Descriptions, Drawer, Space, Typography} from 'antd';
import {
  adminDrawerSurfaceProps,
  NameCodeText,
  testId,
  useOverlayLock,
  ValidityStatus,
} from '@catering-v2s/admin-ui-foundation';
import type {ContractOverviewItem} from '../../../app/api/generated/platform-edge';

export function ContractOverviewDetailDrawer({
  open,
  loading,
  problem,
  item,
  onClose,
  onAudit,
}: {
  open: boolean;
  loading: boolean;
  problem?: {title: string; detail: string};
  item?: ContractOverviewItem;
  onClose: () => void;
  onAudit: () => void;
}) {
  useOverlayLock(open);
  const extensionItems =
    item?.extensionFields?.map(field => ({
      key: `extension-${field.name}`,
      label: field.name,
      children: field.value || '—',
    })) ?? [];
  return (
    <Drawer
      title="合同详情"
      open={open}
      loading={loading}
      onClose={onClose}
      maskClosable
      size={560}
      destroyOnHidden
      {...adminDrawerSurfaceProps}
      {...testId('platform-contract-detail-drawer')}
      extra={
        item && (
          <Space>
            <Button onClick={onAudit} {...testId('platform-contract-audit-history')}>
              操作历史
            </Button>
          </Space>
        )
      }
    >
      {problem && !item && (
        <Alert
          type="error"
          showIcon
          title={problem.title}
          description={problem.detail}
          {...testId('platform-contract-detail-problem')}
        />
      )}
      {item && (
        <Descriptions
          bordered
          size="small"
          column={1}
          items={[
            {key: 'contractNo', label: '合同编号', children: item.contractRef.code},
            {key: 'status', label: '状态', children: <ValidityStatus status={item.status} />},
            {
              key: 'project',
              label: '项目',
              children: <NameCodeText name={item.projectRef.name} code={item.projectRef.code} />,
            },
            {
              key: 'store',
              label: '门店',
              children: <NameCodeText name={item.storeRef.name} code={item.storeRef.code} />,
            },
            {key: 'phase', label: '分期', children: item.phaseName},
            {
              key: 'tenant',
              label: '经营租户',
              children: <NameCodeText name={item.tenantRef.name} code={item.tenantRef.code} />,
            },
            {key: 'date', label: '起止日期', children: `${item.effectiveFrom ?? '—'} 至 ${item.effectiveTo ?? '—'}`},
            {
              key: 'items',
              label: '货号',
              children: item.items?.length ? (
                <Space direction="vertical" size={0}>
                  {item.items.map(entry => (
                    <Typography.Text key={`${entry.code}-${entry.name}`}>
                      {<NameCodeText name={entry.name} code={entry.code} />}
                    </Typography.Text>
                  ))}
                </Space>
              ) : (
                '—'
              ),
            },
            {key: 'note', label: '备注', children: item.note || '—'},
            {
              key: 'createdAt',
              label: '创建时间',
              children: new Date(item.createdAt).toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'}),
            },
            {
              key: 'updatedAt',
              label: '更新时间',
              children: new Date(item.updatedAt).toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'}),
            },
            ...extensionItems,
          ]}
        />
      )}
    </Drawer>
  );
}
