import {Alert, Descriptions, Drawer, Skeleton, Space} from 'antd';
import {
  AdminDetailActionLabel,
  AdminDetailActionMenu,
  adminDetailDescriptionsProps,
  adminDrawerSurfaceProps,
  formatTypedExtensionValue,
  NameCodeText,
  testId,
  ValidityStatus,
  useDetailDrawer,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import type {StoreContract} from '../../../app/api/generated/operations-edge';
import type {OperationsPageProps} from '../../../app/routing/model';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {OperationsAuditHistoryModal} from '../../audit-history';
import {operationsDetailDrawerTestIds} from '../../../app/automation/operationsDetailDrawerTestIds';

type Props = {
  contract?: StoreContract;
  queryContext: OperationsPageProps['queryContext'];
  canEdit: boolean;
  canInvalidate: boolean;
  onClose: () => void;
  onEdit: (contract: StoreContract) => void;
  onInvalidate: (contract: StoreContract) => void;
};

export function ContractDetailDrawer({
  contract,
  queryContext,
  canEdit,
  canInvalidate,
  onClose,
  onEdit,
  onInvalidate,
}: Props) {
  const [auditOpen, setAuditOpen] = useState(false);
  const latest = useDetailDrawer<StoreContract>();
  useOverlayLock(Boolean(contract));
  const detailRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsContract(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, contractId: contract?.id ?? ''},
        {query: {expectedContextVersion: queryContext.expectedContextVersion}},
      ),
    [contract?.id, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey],
  );
  const detailQuery = operationsRtk.useGetOperationsContractQuery(detailRequest, {skip: !contract});
  // The list row only identifies the target. Detail facts and every follow-up action
  // must wait for the contract owner's current readback.
  const selectedResult = detailQuery.currentData;
  const selected = detailQuery.error || selectedResult?.id !== contract?.id ? undefined : selectedResult;
  const detailReady = Boolean(selected) && !detailQuery.isFetching;
  const definitionRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsContractExtensionDefinition(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {query: {expectedContextVersion: queryContext.expectedContextVersion}},
      ),
    [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey],
  );
  const definitionQuery = operationsRtk.useGetOperationsContractExtensionDefinitionQuery(definitionRequest, {
    skip: !selected,
  });
  useEffect(() => {
    if (selected) latest.open(selected);
    else latest.close();
  }, [latest, selected]);
  const extensionItems = [...(definitionQuery.currentData?.definitions ?? [])]
    .filter(field => field.status !== 'DISABLED')
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .map(field => ({
      key: `extension-${field.key}`,
      label: field.label,
      children: formatTypedExtensionValue(selected?.extensionValues?.[field.key], field),
    }));
  const closeThen = (next: (value: StoreContract) => void) => {
    if (!latest.target) return;
    const current = latest.target;
    latest.close();
    onClose();
    next(current);
  };
  const actionItems =
    detailReady && selected
      ? [
          {
            key: 'audit',
            label: (
              <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.contract.audit}>
                操作历史
              </AdminDetailActionLabel>
            ),
            onClick: () => setAuditOpen(true),
          },
          ...(canEdit && selected.status === 'VALID'
            ? [
                {
                  key: 'edit',
                  label: (
                    <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.contract.edit}>
                      编辑
                    </AdminDetailActionLabel>
                  ),
                  onClick: () => closeThen(onEdit),
                },
              ]
            : []),
          ...(canInvalidate && selected.status === 'VALID'
            ? [
                {
                  key: 'invalidate',
                  danger: true,
                  label: (
                    <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.contract.invalidate}>
                      作废
                    </AdminDetailActionLabel>
                  ),
                  onClick: () => closeThen(onInvalidate),
                },
              ]
            : []),
        ]
      : [];
  return (
    <>
      <Drawer
        title={selected ? `合同详情：${selected.contractNo}` : '合同详情'}
        open={Boolean(contract)}
        loading={detailQuery.isFetching}
        onClose={() => {
          latest.close();
          onClose();
        }}
        size={640}
        destroyOnHidden
        maskClosable
        {...adminDrawerSurfaceProps}
        {...testId('operations-contract-detail-drawer')}
        extra={
          actionItems.length > 0 ? (
            <AdminDetailActionMenu
              items={actionItems}
              triggerTestId={operationsDetailDrawerTestIds.contract.actionMenu}
            />
          ) : undefined
        }
      >
        {detailQuery.isFetching && !selected && <Skeleton active {...testId('operations-contract-detail-loading')} />}
        {detailQuery.error && (
          <Alert
            type="error"
            showIcon
            title="详情加载失败"
            description="请关闭后重新进入详情。"
            {...testId('operations-contract-detail-error')}
          />
        )}
        {definitionQuery.error && (
          <Alert
            type="warning"
            showIcon
            title="扩展字段加载失败"
            description="当前仅显示已确认的基础资料。"
            {...testId('operations-contract-detail-extension-error')}
          />
        )}
        {selected && (
          <Descriptions
            {...adminDetailDescriptionsProps}
            items={[
              {key: 'contractNo', label: '合同编号', children: selected.contractNo},
              {
                key: 'store',
                label: '门店',
                children: <NameCodeText name={selected.store.name} code={selected.store.code} />,
              },
              {key: 'phase', label: '项目分期', children: selected.phaseName || '未设置'},
              {
                key: 'tenant',
                label: '经营租户',
                children: <NameCodeText name={selected.tenant.name} code={selected.tenant.code} />,
              },
              {
                key: 'items',
                label: '货号',
                children: selected.items.length ? (
                  <Space direction="vertical" size={2}>
                    {selected.items.map(item => (
                      <NameCodeText key={`${item.code}-${item.name}`} name={item.name} code={item.code} />
                    ))}
                  </Space>
                ) : (
                  '—'
                ),
              },
              {
                key: 'effective',
                label: '起止日期',
                children: `${selected.effectiveFrom} 至 ${selected.effectiveTo ?? '长期'}`,
              },
              {key: 'status', label: '状态', children: <ValidityStatus status={selected.status} />},
              {key: 'note', label: '备注', children: selected.note ?? '—'},
              {key: 'updatedAt', label: '更新时间', children: new Date(selected.updatedAt).toLocaleString()},
              ...extensionItems,
            ]}
          />
        )}
      </Drawer>
      <OperationsAuditHistoryModal
        open={auditOpen}
        target={
          selected ? {entityType: 'STORE_CONTRACT', entityId: selected.id, displayName: selected.contractNo} : undefined
        }
        groupWorkspaceKey={queryContext.groupWorkspaceKey}
        onClose={() => setAuditOpen(false)}
      />
    </>
  );
}
