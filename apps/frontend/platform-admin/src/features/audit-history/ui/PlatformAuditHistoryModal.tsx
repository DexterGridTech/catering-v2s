import {Alert, Button, Descriptions, Empty, List, Modal, Pagination, Space, Spin, Table, Typography} from 'antd';
import {createPageQueryIdentity, testId, useOverlayLock, usePageQuery} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import type {AuditChange, AuditHistoryItem, AuditHistoryPage} from '../../../app/api/generated/platform-edge';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {platformProblemOf, platformRtk} from '../../../app/api/PlatformTransport';
import {auditFieldLabel, auditValue} from './auditChangePresentation';

type AuditEntityType = Parameters<
  typeof platformAdminRtkRequest.getPlatformEntityAuditHistory
>[1]['query']['entityType'];
export type PlatformAuditTarget = {entityType: AuditEntityType; entityId: string; displayName: string};
const actionLabels: Record<string, string> = {
  GROUP_WORKSPACE_CREATED: '已创建集团空间',
  GROUP_WORKSPACE_UPDATED: '已更新集团空间',
  GROUP_WORKSPACE_STATUS_CHANGED: '已更新集团空间状态',
  COMMERCIAL_GROUP_INITIALIZED: '已初始化商业集团',
  PLATFORM_ADMIN_CREATED: '已创建管理员',
  PLATFORM_ADMIN_PROFILE_UPDATED: '已更新管理员资料',
  PLATFORM_ADMIN_STATUS_CHANGED: '已更新管理员状态',
  PLATFORM_ADMIN_CREDENTIAL_RESET: '已重置管理员登录凭据',
  WORKSPACE_ROLE_CREATED: '已创建业务角色',
  ROLE_PERMISSIONS_REPLACED: '已更新业务角色授权',
  WORKSPACE_ROLE_STATUS_CHANGED: '已更新业务角色状态',
  WORKSPACE_ACCOUNT_STATUS_CHANGED: '已更新账号状态',
  WORKSPACE_ACCOUNT_ASSIGNMENT_REVOKED: '已撤销账号任职',
  WORKSPACE_ACCOUNT_CREDENTIAL_RESET_REQUESTED: '已请求重置账号登录凭据',
  WORKSPACE_INVITATION_CREATED: '已发出邀请',
  WORKSPACE_INVITATION_CANCELLED: '已取消邀请',
  WORKSPACE_INVITATION_REISSUED: '已重发邀请',
  EXTENSION_DEFINITION_REPLACED: '已更新字段定义',
  CONTRACT_CREATED: '已创建合同',
  CONTRACT_UPDATED: '已更新合同',
  CONTRACT_INVALIDATED: '已设置合同失效',
};
const at = (value: number) =>
  new Intl.DateTimeFormat('zh-CN', {dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Shanghai'}).format(
    new Date(value),
  );
const action = (value: string) => actionLabels[value] ?? '已记录操作';

/** Approved R5 master-detail read only: it is never a route, Drawer, or list action column. */
export function PlatformAuditHistoryModal({
  open,
  target,
  groupWorkspaceKey,
  onClose,
}: {
  open: boolean;
  target?: PlatformAuditTarget;
  groupWorkspaceKey?: string;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [lastSuccessful, setLastSuccessful] = useState<AuditHistoryPage>();
  const targetType = target?.entityType;
  const targetId = target?.entityId;
  const queryIdentity = useMemo(
    () =>
      createPageQueryIdentity({
        operationId: PLATFORM_ADMIN_OPERATION_IDS.getPlatformEntityAuditHistory,
        scope: {groupWorkspaceKey, targetType, targetId},
      }),
    [groupWorkspaceKey, targetId, targetType],
  );
  const pagination = usePageQuery({queryIdentity, initialPageSize: 10});
  const {reset: resetPagination} = pagination;
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
        ? platformAdminRtkRequest.getPlatformEntityAuditHistory(
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
  const query = platformRtk.useGetPlatformEntityAuditHistoryQuery(request!, {skip: !open || !request});
  const problem = query.error ? platformProblemOf(query.error) : undefined;
  useEffect(() => {
    if (!query.data || query.error) return;
    setLastSuccessful(query.data);
    const firstItemId = query.data.items[0]?.id;
    if (query.data.items.length && !query.data.items.some(item => item.id === selectedId)) setSelectedId(firstItemId);
  }, [query.data, query.error, selectedId]);
  const visibleData = query.data ?? lastSuccessful;
  const selected = visibleData?.items.find(item => item.id === selectedId) ?? visibleData?.items[0];
  return (
    <Modal
      title={target ? `操作历史 · ${target.displayName}` : '操作历史'}
      open={open}
      onCancel={onClose}
      maskClosable
      width={980}
      centered
      styles={{body: {height: 640, overflowY: 'auto'}}}
      destroyOnHidden
      footer={<Button onClick={onClose}>关闭</Button>}
      {...testId('platform-audit-history-modal')}
    >
      {query.isLoading && !visibleData ? (
        <Spin {...testId('platform-audit-history-loading')} />
      ) : !visibleData ? (
        problem ? (
          <Alert
            type="error"
            showIcon
            title="无法读取操作历史"
            description={
              <Space>
                <Typography.Text>{problem.detail}</Typography.Text>
                <Button type="link" onClick={() => void query.refetch()} {...testId('platform-audit-history-retry')}>
                  重试
                </Button>
              </Space>
            }
            {...testId('platform-audit-history-initial-error')}
          />
        ) : null
      ) : visibleData.items.length === 0 ? (
        <Empty description="暂无操作历史" {...testId('platform-audit-history-empty')} />
      ) : (
        <div style={{display: 'grid', gridTemplateColumns: '330px minmax(0, 1fr)', gap: 20}}>
          <section aria-label="操作历史时间列表" {...testId('platform-audit-history-list')}>
            {problem && (
              <Alert
                type="error"
                showIcon
                title="无法读取操作历史"
                description={
                  <Space>
                    <Typography.Text>
                      {problem.detail}
                      {visibleData ? ' 已保留上一页记录。' : ''}
                    </Typography.Text>
                    <Button
                      type="link"
                      onClick={() => void query.refetch()}
                      {...testId('platform-audit-history-retry')}
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
                    {...testId(`platform-audit-history-item-${item.id}`)}
                    style={{
                      width: '100%',
                      border: 0,
                      background: item.id === selected?.id ? '#e6f4ff' : 'transparent',
                      textAlign: 'left',
                      padding: '12px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    <Typography.Text strong>{at(item.occurredAt)}</Typography.Text>
                    <br />
                    <Typography.Text>
                      {item.actorDisplayName} · {action(item.action)}
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
              {...testId('platform-audit-history-pagination')}
            />
          </section>
          <section aria-label="操作历史详情" {...testId('platform-audit-history-detail')}>
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
          {key: 'occurredAt', label: '操作时间', children: at(item.occurredAt)},
          {key: 'actor', label: '操作人', children: item.actorDisplayName},
          {key: 'action', label: '操作', children: action(item.action)},
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
