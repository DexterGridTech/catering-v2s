import {Alert, Button, Descriptions, Empty, List, Modal, Pagination, Space, Spin, Table, Typography} from 'antd';
import {
  createPageQueryIdentity,
  auditActionLabel,
  formatCanonicalDateTime,
  testId,
  useOverlayLock,
  usePageQuery,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState, type ReactNode} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import type {AuditChange, AuditHistoryItem, AuditHistoryPage} from '../../../app/api/generated/operations-edge';
import {OPERATIONS_ADMIN_OPERATION_IDS} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {auditFieldLabel, auditValue} from './auditChangePresentation';

type AuditEntityType = Parameters<
  typeof operationsAdminRtkRequest.getOperationsEntityAuditHistory
>[1]['query']['entityType'];
export type OperationsAuditTarget = {entityType: AuditEntityType; entityId: string; displayName?: ReactNode};

function formatOccurredAt(value: number) {
  return formatCanonicalDateTime(value);
}

/** Approved R5 master-detail read only: it is never a route, Drawer, or list action column. */
export function OperationsAuditHistoryModal({
  open,
  target,
  groupWorkspaceKey,
  onClose,
}: {
  open: boolean;
  target?: OperationsAuditTarget;
  groupWorkspaceKey: string;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [lastSuccessful, setLastSuccessful] = useState<{page: number; data: AuditHistoryPage}>();
  const targetType = target?.entityType;
  const targetId = target?.entityId;
  const queryIdentity = useMemo(
    () =>
      createPageQueryIdentity({
        operationId: OPERATIONS_ADMIN_OPERATION_IDS.getOperationsEntityAuditHistory,
        scope: {groupWorkspaceKey, targetType, targetId},
      }),
    [groupWorkspaceKey, targetId, targetType],
  );
  const pagination = usePageQuery({queryIdentity, initialPageSize: 10});
  const resetPagination = pagination.reset;
  useOverlayLock(open);

  useEffect(() => {
    if (!open) {
      resetPagination();
      setSelectedId(undefined);
      setLastSuccessful(undefined);
      return;
    }
    setSelectedId(undefined);
    setLastSuccessful(undefined);
  }, [groupWorkspaceKey, open, resetPagination, targetId, targetType]);
  const request = useMemo(
    () =>
      targetType && targetId
        ? operationsAdminRtkRequest.getOperationsEntityAuditHistory(
            {},
            {
              query: {
                groupWorkspaceKey,
                entityType: targetType,
                entityId: targetId,
                page: pagination.page,
                pageSize: pagination.pageSize,
              },
            },
          )
        : undefined,
    [groupWorkspaceKey, pagination.page, pagination.pageSize, targetId, targetType],
  );
  const query = operationsRtk.useGetOperationsEntityAuditHistoryQuery(request!, {skip: !open || !request});
  const problem = query.error ? operationsProblemOf(query.error) : undefined;
  const boundaryFailure =
    problem &&
    (problem.status === 403 ||
      problem.status === 404 ||
      problem.errorCode === 'PLATFORM_COMMON_ACCESS_DENIED' ||
      problem.errorCode === 'PLATFORM_COMMON_RESOURCE_NOT_FOUND');
  useEffect(() => {
    if (boundaryFailure) {
      onClose();
      return;
    }
    if (!query.data || query.error) return;
    setLastSuccessful({page: query.data.page, data: query.data});
    const firstItemId = query.data.items[0]?.id;
    if (query.data.items.length && !query.data.items.some(item => item.id === selectedId)) setSelectedId(firstItemId);
  }, [boundaryFailure, onClose, query.data, query.error, selectedId]);
  const visibleData = query.data ?? lastSuccessful?.data;
  const selected = visibleData?.items.find(item => item.id === selectedId) ?? visibleData?.items[0];

  const modalTitle = target?.displayName ? <span>操作历史 · {target.displayName}</span> : '操作历史';
  return (
    <Modal
      title={modalTitle}
      open={open}
      onCancel={onClose}
      maskClosable
      width={980}
      centered
      styles={{body: {height: 640, overflowY: 'auto'}}}
      destroyOnHidden
      footer={<Button onClick={onClose}>关闭</Button>}
      {...testId('operations-audit-history-modal')}
    >
      {query.isLoading && !visibleData ? (
        <Spin {...testId('operations-audit-history-loading')} />
      ) : !visibleData ? (
        problem && !boundaryFailure ? (
          <Alert
            type="error"
            showIcon
            title="无法读取操作历史"
            description={
              <Space>
                <Typography.Text>请稍后重试。</Typography.Text>
                <Button type="link" onClick={() => void query.refetch()} {...testId('operations-audit-history-retry')}>
                  重试
                </Button>
              </Space>
            }
            {...testId('operations-audit-history-initial-error')}
          />
        ) : null
      ) : visibleData.items.length === 0 ? (
        <Empty description="暂无操作历史" {...testId('operations-audit-history-empty')} />
      ) : (
        <div style={{display: 'grid', gridTemplateColumns: '330px minmax(0, 1fr)', gap: 20}}>
          <section aria-label="操作历史时间列表" {...testId('operations-audit-history-list')}>
            {problem && !boundaryFailure && (
              <Alert
                type="error"
                showIcon
                title="无法读取操作历史"
                description={
                  <Space>
                    <Typography.Text>请稍后重试。已保留上一页记录。</Typography.Text>
                    <Button
                      type="link"
                      onClick={() => void query.refetch()}
                      {...testId('operations-audit-history-retry')}
                    >
                      重试
                    </Button>
                  </Space>
                }
                style={{marginBottom: 16}}
              />
            )}
            <List
              dataSource={visibleData.items}
              renderItem={item => (
                <List.Item style={{padding: 0}}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    {...testId(`operations-audit-history-item-${item.id}`)}
                    style={{
                      width: '100%',
                      border: 0,
                      background: item.id === selected?.id ? 'var(--operations-admin-color-primary-bg)' : 'transparent',
                      textAlign: 'left',
                      padding: '12px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    <Typography.Text strong>{formatOccurredAt(item.occurredAt)}</Typography.Text>
                    <br />
                    <Typography.Text>
                      {item.actorDisplayName} · {auditActionLabel(item.action)}
                    </Typography.Text>
                  </button>
                </List.Item>
              )}
            />
            <Pagination
              current={pagination.page}
              pageSize={pagination.pageSize}
              total={visibleData.total}
              showSizeChanger
              onChange={(nextPage, nextPageSize) => {
                if (nextPageSize !== pagination.pageSize) pagination.setPageSize(nextPageSize);
                else pagination.setPage(nextPage);
              }}
              style={{marginTop: 12}}
              {...testId('operations-audit-history-pagination')}
            />
          </section>
          <section aria-label="操作历史详情" {...testId('operations-audit-history-detail')}>
            {selected ? <AuditDetail item={selected} /> : <Empty description="请选择一条操作历史" />}
          </section>
        </div>
      )}
    </Modal>
  );
}

function AuditDetail({item}: {item: AuditHistoryItem}) {
  return (
    <>
      <Descriptions
        bordered
        size="small"
        column={1}
        items={[
          {key: 'occurredAt', label: '操作时间', children: formatOccurredAt(item.occurredAt)},
          {key: 'actor', label: '操作人', children: item.actorDisplayName},
          {key: 'action', label: '操作', children: auditActionLabel(item.action)},
        ]}
      />
      <Table<AuditChange>
        style={{marginTop: 16}}
        rowKey={row => row.fieldKey}
        pagination={false}
        dataSource={item.changes}
        locale={{emptyText: '该操作不包含可展示的字段变更'}}
        columns={[
          {title: '字段', dataIndex: 'fieldKey', render: (_, change) => auditFieldLabel(change)},
          {title: '变更前', dataIndex: 'beforeValue', render: (_, change) => auditValue(change, 'before')},
          {title: '变更后', dataIndex: 'afterValue', render: (_, change) => auditValue(change, 'after')},
        ]}
      />
    </>
  );
}
