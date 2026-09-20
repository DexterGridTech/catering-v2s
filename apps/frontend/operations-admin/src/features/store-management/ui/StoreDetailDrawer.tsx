import {Alert, Card, Descriptions, Drawer, Skeleton} from 'antd';
import {
  AdminDetailActionLabel,
  AdminDetailActionMenu,
  adminDetailDescriptionsProps,
  adminDrawerSurfaceProps,
  displayFieldValue,
  formatTypedExtensionValue,
  NameCodeText,
  testId,
  useDetailDrawer,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import type {ExtensionDefinition, JsonValue, OrganizationStore} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {OperationsPageProps} from '../../../app/routing/model';
import {operationsDetailDrawerTestIds} from '../../../app/automation/operationsDetailDrawerTestIds';
import {
  organizationStoreStatusLabels,
  toggleOrganizationStoreStatus,
} from '../../organization-structure/model/organizationStatus';
import {storeManagementTestIds} from '../storeManagementTestIds';
import {StoreOperatingRuleTree, completeStoreOperatingRuleValues} from './StoreOperatingRuleTree';

type Props = {
  store?: OrganizationStore;
  queryContext: OperationsPageProps['queryContext'];
  canEdit: boolean;
  canTransition: boolean;
  onClose: () => void;
  onEdit: (store: OrganizationStore) => void;
  onStatus: (store: OrganizationStore) => void;
  onAudit: () => void;
};

function extensionItems(definition: ExtensionDefinition | undefined, values: Record<string, JsonValue> | undefined) {
  return (definition?.definitions ?? [])
    .filter(field => field.status !== 'DISABLED')
    .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0))
    .map(field => ({
      key: `extension-${field.key}`,
      label: field.label,
      children: formatTypedExtensionValue(values?.[field.key], field),
    }));
}

export function StoreDetailDrawer({
  store,
  queryContext,
  canEdit,
  canTransition,
  onClose,
  onEdit,
  onStatus,
  onAudit,
}: Props) {
  const latest = useDetailDrawer<OrganizationStore>();
  const {open: openLatest, close: closeLatest, target: latestTarget} = latest;
  useOverlayLock(Boolean(store));
  const storeRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsOrganizationStore(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeId: store?.id ?? ''},
        {query: {expectedContextVersion: queryContext.expectedContextVersion}},
      ),
    [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, store?.id],
  );
  const latestStore = operationsRtk.useGetOperationsOrganizationStoreQuery(storeRequest, {skip: !store});
  const definitionRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsOrganizationStoreExtensionDefinition(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {query: {expectedContextVersion: queryContext.expectedContextVersion}},
      ),
    [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey],
  );
  const definition = operationsRtk.useGetOperationsOrganizationStoreExtensionDefinitionQuery(definitionRequest, {
    skip: !store,
  });
  useEffect(() => {
    if (latestStore.currentData) openLatest(latestStore.currentData);
    else closeLatest();
  }, [closeLatest, latestStore.currentData, openLatest]);
  const selected = latestTarget;
  const statusTarget = selected ? toggleOrganizationStoreStatus(selected.status) : undefined;
  const loading = Boolean(store) && (latestStore.isFetching || definition.isFetching);
  const problem = latestStore.error ? '门店详情暂时无法获取，请关闭后重新进入。' : undefined;
  const definitionWarning = definition.error ? '字段配置暂时无法获取，当前仅显示已确认的基础资料。' : undefined;
  const ready = Boolean(selected) && !loading && !problem;
  const operatingRuleValues = useMemo(
    () => completeStoreOperatingRuleValues(selected?.operatingRuleSwitches),
    [selected?.operatingRuleSwitches],
  );
  const closeThen = (next: (current: OrganizationStore) => void) => {
    if (!selected || !ready) return;
    closeLatest();
    onClose();
    next(selected);
  };
  const actionItems =
    ready && selected
      ? [
          {
            key: 'audit',
            label: (
              <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.store.audit}>
                操作历史
              </AdminDetailActionLabel>
            ),
            onClick: onAudit,
          },
          ...(canEdit && selected.status !== 'VOIDED'
            ? [
                {
                  key: 'edit',
                  label: (
                    <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.store.edit}>
                      编辑
                    </AdminDetailActionLabel>
                  ),
                  onClick: () => closeThen(onEdit),
                },
              ]
            : []),
          ...(canTransition && statusTarget
            ? [
                {
                  key: 'status',
                  label: (
                    <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.store.status}>
                      {statusTarget === 'DISABLED' ? '停用' : '启用'}
                    </AdminDetailActionLabel>
                  ),
                  onClick: () => closeThen(onStatus),
                },
              ]
            : []),
        ]
      : [];

  return (
    <Drawer
      title={selected ? `门店详情：${selected.name}` : '门店详情'}
      open={Boolean(store)}
      loading={loading}
      onClose={() => {
        closeLatest();
        onClose();
      }}
      size={620}
      destroyOnHidden
      maskClosable
      {...adminDrawerSurfaceProps}
      {...testId('operations-store-detail-drawer')}
      extra={
        actionItems.length > 0 ? (
          <AdminDetailActionMenu items={actionItems} triggerTestId={operationsDetailDrawerTestIds.store.actionMenu} />
        ) : undefined
      }
    >
      {loading && <Skeleton active {...testId('operations-store-detail-loading')} />}
      {problem && (
        <Alert
          type="error"
          showIcon
          title="门店详情未完成"
          description={problem}
          {...testId('operations-store-detail-problem')}
        />
      )}
      {definitionWarning && (
        <Alert
          type="warning"
          showIcon
          title="字段配置暂时无法获取"
          description={definitionWarning}
          style={{marginBottom: 16}}
          {...testId('operations-store-detail-definition-warning')}
        />
      )}
      {ready && selected && (
        <>
          <Descriptions
            {...adminDetailDescriptionsProps}
            items={[
              {key: 'name', label: '门店名称', children: selected.name},
              {key: 'code', label: '门店编码', children: selected.code},
              {
                key: 'project',
                label: '所属项目',
                children: <NameCodeText name={selected.project.name} code={selected.project.code} />,
              },
              {
                key: 'brand',
                label: '品牌',
                children: <NameCodeText name={selected.brand.name} code={selected.brand.code} />,
              },
              {
                key: 'tenant',
                label: '经营租户',
                children: <NameCodeText name={selected.tenant.name} code={selected.tenant.code} />,
              },
              {
                key: 'headCompany',
                label: '总公司',
                children: selected.headCompany ? (
                  <NameCodeText name={selected.headCompany.name} code={selected.headCompany.code} />
                ) : (
                  '未设置'
                ),
              },
              {key: 'status', label: '状态', children: organizationStoreStatusLabels[selected.status]},
              {key: 'notes', label: '备注', children: displayFieldValue(selected.notes)},
              ...extensionItems(definition.currentData, selected.extensionValues),
            ]}
          />
          <Card
            size="small"
            title="经营规则"
            style={{marginTop: 16}}
            {...testId(storeManagementTestIds.detailOperatingRuleGroup)}
          >
            <StoreOperatingRuleTree mode="detail" values={operatingRuleValues} />
          </Card>
        </>
      )}
    </Drawer>
  );
}
