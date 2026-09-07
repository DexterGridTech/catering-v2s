import {Alert, Descriptions, Drawer, Skeleton} from 'antd';
import {
  AdminDetailActionLabel,
  AdminDetailActionMenu,
  adminDetailDescriptionsProps,
  adminDrawerSurfaceProps,
  testId,
  useDetailDrawer,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {Brand, HeadCompany, Tenant} from '../../../app/api/generated/operations-edge';
import {
  ACTION_CAPABILITIES,
  adminCatalog,
  type AdminActionCapabilityKey,
} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageContext} from '../../../app/routing/model';
import {OperationsAuditHistoryModal} from '../../audit-history';
import {
  businessEntityLifecycleLabels,
  canManageBusinessEntity,
  canVoidBusinessEntity,
  toggleBusinessEntityStatus,
} from './businessEntityLifecycle';
import {operationsDetailDrawerTestIds} from '../../../app/automation/operationsDetailDrawerTestIds';

export type BusinessEntity = Brand | Tenant | HeadCompany;
export type BusinessEntityKind = 'BRAND' | 'TENANT' | 'HEAD_COMPANY';

type Props = {
  entity?: BusinessEntity;
  kind: BusinessEntityKind;
  queryContext: OperationsPageContext;
  actionCapabilityKeys: readonly AdminActionCapabilityKey[];
  onClose: () => void;
  onEdit: (entity: BusinessEntity) => void;
  onStatus: (entity: BusinessEntity, targetStatus: BusinessEntity['status']) => void;
  onAuthorizeBrands?: (entity: HeadCompany) => void;
};

const detailLabels: Record<BusinessEntityKind, string> = {
  BRAND: '品牌',
  TENANT: '经营租户',
  HEAD_COMPANY: '总公司',
};

const editCapabilityByKind: Record<BusinessEntityKind, AdminActionCapabilityKey> = {
  BRAND: ACTION_CAPABILITIES.ORG_BRAND_EDIT,
  TENANT: ACTION_CAPABILITIES.ORG_TENANT_EDIT,
  HEAD_COMPANY: ACTION_CAPABILITIES.ORG_HEAD_COMPANY_EDIT,
};

const statusCapabilityByKind: Record<BusinessEntityKind, AdminActionCapabilityKey> = {
  BRAND: ACTION_CAPABILITIES.ORG_BRAND_STATUS,
  TENANT: ACTION_CAPABILITIES.ORG_TENANT_STATUS,
  HEAD_COMPANY: ACTION_CAPABILITIES.ORG_HEAD_COMPANY_STATUS,
};

const brandAuthorizationCapability = ACTION_CAPABILITIES.ORG_HEAD_COMPANY_BRAND;

function catalogActionLabel(actionKey: AdminActionCapabilityKey) {
  const label = adminCatalog.actions.find(action => action.actionKey === actionKey)?.actionLabel;
  if (!label) throw new Error('ADMIN_CATALOG_BUSINESS_ENTITY_ACTION_MISSING');
  return label;
}

function displayValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '是' : '否';
  return JSON.stringify(value);
}

function displayTime(value: number) {
  return new Date(value).toLocaleString('zh-CN');
}

function isHeadCompany(entity: BusinessEntity, kind: BusinessEntityKind): entity is HeadCompany {
  return kind === 'HEAD_COMPANY';
}

function typeSpecificItems(entity: BusinessEntity, kind: BusinessEntityKind) {
  if (kind === 'BRAND') return [{key: 'alias', label: '别名', children: (entity as Brand).alias ?? '—'}];
  const legalEntity = entity as Tenant | HeadCompany;
  return [
    {key: 'legalName', label: '法定名称', children: legalEntity.legalName},
    {key: 'unifiedSocialCreditCode', label: '统一代码', children: legalEntity.unifiedSocialCreditCode},
  ];
}

export function BusinessEntityDetailDrawer({
  entity,
  kind,
  queryContext,
  actionCapabilityKeys,
  onClose,
  onEdit,
  onStatus,
  onAuthorizeBrands,
}: Props) {
  const [auditOpen, setAuditOpen] = useState(false);
  const {open: storeLatestDetail, close: clearLatestDetail} = useDetailDrawer<BusinessEntity>();
  useOverlayLock(Boolean(entity));
  const groupWorkspaceKey = queryContext.groupWorkspaceKey;
  const expectedContextVersion = queryContext.expectedContextVersion;
  const brandDetail = operationsRtk.useGetOperationsOrganizationBrandQuery(
    operationsAdminRtkRequest.getOperationsOrganizationBrand(
      {groupWorkspaceKey, brandId: entity?.id ?? ''},
      {query: {expectedContextVersion}},
    ),
    {skip: !entity || kind !== 'BRAND'},
  );
  const tenantDetail = operationsRtk.useGetOperationsOrganizationTenantQuery(
    operationsAdminRtkRequest.getOperationsOrganizationTenant(
      {groupWorkspaceKey, tenantId: entity?.id ?? ''},
      {query: {expectedContextVersion}},
    ),
    {skip: !entity || kind !== 'TENANT'},
  );
  const headCompanyDetail = operationsRtk.useGetOperationsOrganizationHeadCompanyQuery(
    operationsAdminRtkRequest.getOperationsOrganizationHeadCompany(
      {groupWorkspaceKey, headCompanyId: entity?.id ?? ''},
      {query: {expectedContextVersion}},
    ),
    {skip: !entity || kind !== 'HEAD_COMPANY'},
  );
  const definitionResult = operationsRtk.useGetOperationsOrganizationBusinessEntityExtensionDefinitionQuery(
    operationsAdminRtkRequest.getOperationsOrganizationBusinessEntityExtensionDefinition(
      {groupWorkspaceKey},
      {query: {expectedContextVersion, entityType: kind}},
    ),
    {skip: !entity},
  );
  const selectedResult =
    kind === 'BRAND'
      ? brandDetail.currentData
      : kind === 'TENANT'
        ? tenantDetail.currentData
        : headCompanyDetail.currentData;
  const selected = selectedResult?.id === entity?.id ? selectedResult : undefined;
  const detailLoading =
    kind === 'BRAND'
      ? brandDetail.isFetching
      : kind === 'TENANT'
        ? tenantDetail.isFetching
        : headCompanyDetail.isFetching;
  const detailError =
    kind === 'BRAND' ? brandDetail.error : kind === 'TENANT' ? tenantDetail.error : headCompanyDetail.error;
  const detailReady = Boolean(selected) && !detailLoading && !detailError;

  useEffect(() => {
    if (selected) storeLatestDetail(selected);
    else clearLatestDetail();
  }, [clearLatestDetail, selected, storeLatestDetail]);

  const canEdit = actionCapabilityKeys.includes(editCapabilityByKind[kind]);
  const canStatus = actionCapabilityKeys.includes(statusCapabilityByKind[kind]);
  const canAuthorizeBrands =
    kind === 'HEAD_COMPANY' &&
    actionCapabilityKeys.includes(brandAuthorizationCapability) &&
    Boolean(onAuthorizeBrands);
  const enabledDefinitions = [...(definitionResult.currentData?.definitions ?? [])]
    .filter(definition => definition.status !== 'DISABLED')
    .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0));

  const closeThen = (next: (current: BusinessEntity) => void) => {
    if (!detailReady || !selected) return;
    clearLatestDetail();
    onClose();
    next(selected);
  };

  const entityLabel = detailLabels[kind];
  const statusTarget = selected ? toggleBusinessEntityStatus(selected.status) : undefined;
  const actionItems = detailReady && selected
    ? [
        {
          key: 'audit',
          label: <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.businessEntity.audit}>操作历史</AdminDetailActionLabel>,
          onClick: () => setAuditOpen(true),
        },
        ...(canManageBusinessEntity(selected.status) && canEdit
          ? [
              {
                key: 'edit',
                label: (
                  <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.businessEntity.edit}>
                    {catalogActionLabel(editCapabilityByKind[kind])}
                  </AdminDetailActionLabel>
                ),
                onClick: () => closeThen(onEdit),
              },
            ]
          : []),
        ...(canManageBusinessEntity(selected.status) && canAuthorizeBrands && isHeadCompany(selected, kind)
          ? [
              {
                key: 'authorize-brands',
                label: (
                  <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.businessEntity.authorizeBrands}>
                    经营品牌
                  </AdminDetailActionLabel>
                ),
                onClick: () => closeThen(current => onAuthorizeBrands?.(current as HeadCompany)),
              },
            ]
          : []),
        ...(canManageBusinessEntity(selected.status) && canStatus && statusTarget
          ? [
              {
                key: 'status',
                label: (
                  <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.businessEntity.status}>
                    {statusTarget === 'DISABLED' ? '停用' : '启用'}
                  </AdminDetailActionLabel>
                ),
                onClick: () => closeThen(current => onStatus(current, statusTarget)),
              },
            ]
          : []),
        ...(canManageBusinessEntity(selected.status) && canStatus && canVoidBusinessEntity(selected.status)
          ? [
              {
                key: 'void',
                danger: true,
                label: (
                  <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.businessEntity.void}>
                    标记删除
                  </AdminDetailActionLabel>
                ),
                onClick: () => closeThen(current => onStatus(current, 'VOIDED')),
              },
            ]
          : []),
      ]
    : [];
  return (
    <>
      <Drawer
        title={selected ? `${entityLabel}详情：${selected.name}` : `${entityLabel}详情`}
        open={Boolean(entity)}
        loading={detailLoading}
        size={640}
        destroyOnHidden
        maskClosable
        onClose={() => {
          clearLatestDetail();
          onClose();
        }}
        {...adminDrawerSurfaceProps}
        {...testId('operations-business-entity-detail-drawer')}
        extra={
          actionItems.length > 0 ? (
            <AdminDetailActionMenu
              items={actionItems}
              triggerTestId={operationsDetailDrawerTestIds.businessEntity.actionMenu}
            />
          ) : undefined
        }
      >
        {detailLoading && <Skeleton active {...testId('operations-business-entity-detail-loading')} />}
        {detailError && <Alert type="error" showIcon title="详情加载失败" description="请关闭后重新进入详情。" />}
        {selected && (
          <Descriptions
            {...adminDetailDescriptionsProps}
            items={[
              {key: 'name', label: '名称', children: selected.name},
              {key: 'code', label: '编码', children: selected.code},
              ...typeSpecificItems(selected, kind),
              {key: 'status', label: '状态', children: businessEntityLifecycleLabels[selected.status]},
              {key: 'remark', label: '备注', children: selected.remark ?? '—'},
              {key: 'updatedAt', label: '更新时间', children: displayTime(selected.updatedAt)},
              ...enabledDefinitions.map(definition => ({
                key: `extension-${definition.key}`,
                label: definition.label,
                children: displayValue(selected.extensionValues[definition.key]),
              })),
            ]}
          />
        )}
      </Drawer>
      <OperationsAuditHistoryModal
        open={auditOpen}
        target={selected ? {entityType: kind, entityId: selected.id, displayName: selected.name} : undefined}
        groupWorkspaceKey={groupWorkspaceKey}
        onClose={() => setAuditOpen(false)}
      />
    </>
  );
}
