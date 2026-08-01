import {Alert, Button, Descriptions, Drawer, Space} from 'antd';
import {adminDrawerSurfaceProps, testId, useDetailDrawer, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {Brand, HeadCompany, Tenant} from '../../../app/api/generated/operations-edge';
import {ACTION_CAPABILITIES, adminCatalog, type AdminActionCapabilityKey} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageContext} from '../../../app/routing/model';
import {OperationsAuditHistoryModal} from '../../audit-history';

export type BusinessEntity = Brand | Tenant | HeadCompany;
export type BusinessEntityKind = 'BRAND' | 'TENANT' | 'HEAD_COMPANY';

type Props = {
  entity?: BusinessEntity;
  kind: BusinessEntityKind;
  queryContext: OperationsPageContext;
  actionCapabilityKeys: readonly AdminActionCapabilityKey[];
  onClose: () => void;
  onEdit: (entity: BusinessEntity) => void;
  onStatus: (entity: BusinessEntity) => void;
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
  const label = adminCatalog.actions.find((action) => action.actionKey === actionKey)?.actionLabel;
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
    {key: 'unifiedSocialCreditCode', label: '统一社会信用代码', children: legalEntity.unifiedSocialCreditCode},
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
  const selected = kind === 'BRAND'
    ? brandDetail.data
    : kind === 'TENANT'
      ? tenantDetail.data
      : headCompanyDetail.data;
  const detailLoading = kind === 'BRAND'
    ? brandDetail.isLoading
    : kind === 'TENANT'
      ? tenantDetail.isLoading
      : headCompanyDetail.isLoading;
  const detailError = kind === 'BRAND'
    ? brandDetail.error
    : kind === 'TENANT'
      ? tenantDetail.error
      : headCompanyDetail.error;

  useEffect(() => {
    if (selected) storeLatestDetail(selected);
    else clearLatestDetail();
  }, [clearLatestDetail, selected, storeLatestDetail]);

  const canEdit = actionCapabilityKeys.includes(editCapabilityByKind[kind]);
  const canStatus = actionCapabilityKeys.includes(statusCapabilityByKind[kind]);
  const canAuthorizeBrands = kind === 'HEAD_COMPANY'
    && actionCapabilityKeys.includes(brandAuthorizationCapability)
    && Boolean(onAuthorizeBrands);
  const enabledDefinitions = [...(definitionResult.data?.definitions ?? [])]
    .filter((definition) => definition.status !== 'DISABLED')
    .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0));

  const closeThen = (next: (current: BusinessEntity) => void) => {
    if (!selected) return;
    clearLatestDetail();
    onClose();
    next(selected);
  };

  const entityLabel = detailLabels[kind];
  const statusLabel = selected?.status === 'ENABLED' ? '停用' : '启用';
  return <><Drawer
    title={selected ? `${entityLabel}详情：${selected.name}` : `${entityLabel}详情`}
    open={Boolean(entity)}
    width={640}
    destroyOnHidden
    maskClosable={false}
    onClose={() => {
      clearLatestDetail();
      onClose();
    }}
    {...adminDrawerSurfaceProps}
    {...testId('operations-business-entity-detail-drawer')}
    extra={selected && <Space>
      <Button onClick={() => setAuditOpen(true)} {...testId('operations-business-entity-detail-audit-history')}>操作历史</Button>
      {canEdit && <Button
        onClick={() => closeThen(onEdit)}
        {...testId('operations-business-entity-detail-edit')}
      >
        {catalogActionLabel(editCapabilityByKind[kind])}
      </Button>}
      {canAuthorizeBrands && isHeadCompany(selected, kind) && <Button
        onClick={() => closeThen((current) => onAuthorizeBrands?.(current as HeadCompany))}
        {...testId('operations-business-entity-detail-authorize-brands')}
      >
        经营品牌
      </Button>}
      {canStatus && <Button
        onClick={() => closeThen(onStatus)}
        {...testId('operations-business-entity-detail-status')}
      >
        {statusLabel}
      </Button>}
    </Space>}
  >
    {detailLoading && <span aria-live="polite">正在加载详情</span>}
    {detailError && <Alert type="error" showIcon message="详情加载失败" description="请关闭后重新进入详情。"/>}
    {definitionResult.error && <Alert type="warning" showIcon message="扩展字段加载失败" description="当前仅显示已确认的基础资料。"/>}
    {selected && <Descriptions bordered column={1} items={[
      {key: 'code', label: '编码', children: selected.code},
      {key: 'name', label: '名称', children: selected.name},
      ...typeSpecificItems(selected, kind),
      {key: 'status', label: '状态', children: selected.status === 'ENABLED' ? '已启用' : '已停用'},
      {key: 'remark', label: '备注', children: selected.remark ?? '—'},
      {key: 'updatedAt', label: '更新时间', children: displayTime(selected.updatedAt)},
      ...enabledDefinitions.map((definition) => ({
        key: `extension-${definition.key}`,
        label: definition.label,
        children: displayValue(selected.extensionValues[definition.key]),
      })),
    ]}/>} 
  </Drawer><OperationsAuditHistoryModal open={auditOpen} target={selected ? {entityType: kind, entityId: selected.id, displayName: selected.name} : undefined} groupWorkspaceKey={groupWorkspaceKey} onClose={() => setAuditOpen(false)}/></>;
}
