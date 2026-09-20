import {Alert, Descriptions, Drawer} from 'antd';
import {
  adminDrawerSurfaceProps,
  displayFieldValue,
  formatCanonicalDateTime,
  NameCodeText,
  testId,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import type {ExtensionDefinition, OrganizationOverviewItem} from '../../../app/api/generated/platform-edge';
import {organizationOverviewExtensionItems} from './OrganizationOverviewPresentation';
import {organizationOverviewStatusLabel} from './OrganizationOverviewFilters';

export function OrganizationOverviewDetailDrawer({
  open,
  loading,
  problem,
  item,
  definition,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  problem?: {title: string; detail: string};
  item?: OrganizationOverviewItem;
  definition?: ExtensionDefinition;
  onClose: () => void;
}) {
  useOverlayLock(open);
  const status = item ? organizationOverviewStatusLabel(item.status) : '—';
  const typeLabel =
    item?.type === 'BRAND'
      ? '品牌'
      : item?.type === 'TENANT'
        ? '经营租户'
        : item?.type === 'HEAD_COMPANY'
          ? '总公司'
          : item?.type === 'STORE'
            ? '门店'
            : '组织';
  const extensionItems = organizationOverviewExtensionItems(definition, item?.extensionValues);
  const businessEntityItems =
    item?.type === 'BRAND'
      ? [{key: 'alias', label: '别名', children: displayFieldValue(item.alias)}]
      : item?.type === 'TENANT' || item?.type === 'HEAD_COMPANY'
        ? [
            {key: 'legalName', label: '法定名称', children: displayFieldValue(item.legalName)},
            {
              key: 'unifiedSocialCreditCode',
              label: '统一代码',
              children: displayFieldValue(item.unifiedSocialCreditCode),
            },
          ]
        : [];
  const storeRelationItems =
    item?.type === 'STORE'
      ? [
          {
            key: 'project',
            label: '项目',
            children: item.project ? <NameCodeText name={item.project.name} code={item.project.code} /> : '—',
          },
          {
            key: 'brand',
            label: '品牌',
            children: item.brand ? <NameCodeText name={item.brand.name} code={item.brand.code} /> : '—',
          },
          {
            key: 'tenant',
            label: '经营租户',
            children: item.tenant ? <NameCodeText name={item.tenant.name} code={item.tenant.code} /> : '—',
          },
          {
            key: 'headCompany',
            label: '总公司',
            children: item.headCompany ? (
              <NameCodeText name={item.headCompany.name} code={item.headCompany.code} />
            ) : (
              '未设置'
            ),
          },
        ]
      : [];
  return (
    <Drawer
      title={`${typeLabel}详情`}
      open={open}
      loading={loading}
      onClose={onClose}
      maskClosable
      size={560}
      destroyOnHidden
      {...adminDrawerSurfaceProps}
      {...testId('platform-organization-detail-drawer')}
    >
      {problem && !item && (
        <Alert
          type="error"
          showIcon
          title={problem.title}
          description={problem.detail}
          {...testId('platform-organization-detail-problem')}
        />
      )}
      {item && (
        <Descriptions
          bordered
          size="small"
          column={1}
          styles={{label: {width: 164}}}
          items={[
            {key: 'name', label: '名称', children: item.name},
            {key: 'code', label: '编码', children: item.code},
            ...businessEntityItems,
            ...storeRelationItems,
            {key: 'status', label: '状态', children: status},
            {key: 'notes', label: '备注', children: displayFieldValue(item.notes)},
            {
              key: 'updatedAt',
              label: '更新时间',
              children: formatCanonicalDateTime(item.updatedAt),
            },
            ...extensionItems,
          ]}
        />
      )}
    </Drawer>
  );
}
