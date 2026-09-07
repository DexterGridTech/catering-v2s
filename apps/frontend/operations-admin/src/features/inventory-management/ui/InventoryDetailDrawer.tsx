import {Alert, Button, Card, Descriptions, Drawer, Empty, Skeleton, Space, Table, Tag} from 'antd';
import {
  AdminDetailActionLabel,
  AdminDetailActionMenu,
  adminWideDetailDescriptionsProps,
  adminWideDrawerSurfaceProps,
  CursorPagination,
  NameCodeText,
  testId,
  useCursorStack,
  useOverlayLock,
  useRefreshVersion,
} from '@catering-v2s/admin-ui-foundation';
import {skipToken} from '@reduxjs/toolkit/query';
import {useEffect, useMemo, useRef, useState} from 'react';
import {operationsContentTabRefreshSignal, operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import type {Uuid} from '../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import type {OperationsPageContext} from '../../../app/routing/model';
import {InventoryActionModal, type InventoryActionKind} from './InventoryActionModal';
import {operationsDetailDrawerTestIds} from '../../../app/automation/operationsDetailDrawerTestIds';
import {
  envelopeData,
  inventoryConversionLabel,
  inventoryDeductionTimingLabel,
  inventoryOperationLabel,
  inventoryReasonLabel,
  inventoryReferenceSourceKindLabel,
  inventoryShapeLabel,
  inventoryStockStateLabel,
  inventoryAuthorityLabel,
  inventoryUnitLabel,
  type CursorPage,
  type InventoryCurrentView,
  type InventoryHistoryEntry,
  type InventoryLedgerEntry,
  type InventoryReference,
} from './inventoryManagementModel';

type Props = {
  targetRef?: Uuid;
  canEdit: boolean;
  queryContext: OperationsPageContext;
  onClose: () => void;
};

function ZoneProblem({title, onRetry}: {title: string; onRetry: () => void}) {
  return (
    <Alert
      type="error"
      showIcon
      title={`${title}暂时无法获取`}
      action={
        <Button size="small" onClick={onRetry}>
          重试
        </Button>
      }
    />
  );
}

export function InventoryDetailDrawer({targetRef, canEdit, queryContext, onClose}: Props) {
  const [action, setAction] = useState<InventoryActionKind>();
  const historyCursorState = useCursorStack({resetKey: targetRef ?? ''});
  const referenceCursorState = useCursorStack({resetKey: targetRef ?? ''});
  const ledgerCursorState = useCursorStack({resetKey: targetRef ?? ''});
  const actionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const open = Boolean(targetRef);
  const contentTabRefreshVersion = useRefreshVersion(operationsContentTabRefreshSignal);
  useOverlayLock(open);
  useEffect(() => {
    setAction(undefined);
    actionTriggerRef.current = null;
  }, [targetRef]);
  const path = targetRef ? {targetRef: wireUuid(targetRef)} : undefined;
  const historyCursor = historyCursorState.cursor ?? '';
  const referenceCursor = referenceCursorState.cursor ?? '';
  const ledgerCursor = ledgerCursorState.cursor ?? '';
  const current = operationsRtk.useGetOperationsInventoryTargetQuery(
    path ? catalogInventoryRtkRequest.getOperationsInventoryTarget(path) : skipToken,
    {skip: !open},
  );
  const history = operationsRtk.useGetOperationsInventoryTargetBusinessHistoryQuery(
    path
      ? catalogInventoryRtkRequest.getOperationsInventoryTargetBusinessHistory(
          path,
          historyCursor ? {query: {pageSize: 20, cursor: historyCursor}} : {query: {pageSize: 20}},
        )
      : skipToken,
    {skip: !open},
  );
  const references = operationsRtk.useGetOperationsInventoryTargetConsumptionReferencesQuery(
    path
      ? catalogInventoryRtkRequest.getOperationsInventoryTargetConsumptionReferences(
          path,
          referenceCursor ? {query: {pageSize: 20, cursor: referenceCursor}} : {query: {pageSize: 20}},
        )
      : skipToken,
    {skip: !open},
  );
  const ledger = operationsRtk.useGetOperationsInventoryTargetLedgerQuery(
    path
      ? catalogInventoryRtkRequest.getOperationsInventoryTargetLedger(
          path,
          ledgerCursor ? {query: {pageSize: 20, cursor: ledgerCursor}} : {query: {pageSize: 20}},
        )
      : skipToken,
    {skip: !open},
  );
  const refetchCurrent = current.refetch;
  const refetchHistory = history.refetch;
  const refetchReferences = references.refetch;
  const refetchLedger = ledger.refetch;
  useEffect(() => {
    if (!open || contentTabRefreshVersion === 0) return;
    // Every detail zone is visible. Re-read all of them while preserving
    // pagination cursors and action-modal form state.
    void refetchCurrent();
    void refetchHistory();
    void refetchReferences();
    void refetchLedger();
  }, [contentTabRefreshVersion, open, refetchCurrent, refetchHistory, refetchLedger, refetchReferences]);
  const currentView = envelopeData<InventoryCurrentView>(current.currentData);
  const historyPage = envelopeData<CursorPage<InventoryHistoryEntry>>(history.currentData);
  const referencePage = envelopeData<CursorPage<InventoryReference>>(references.currentData);
  const ledgerPage = envelopeData<CursorPage<InventoryLedgerEntry>>(ledger.currentData);
  const periodChanges = useMemo(() => {
    if (!currentView) return [];
    return [
      {...currentView.changeSummary.today, period: '今日'},
      {...currentView.changeSummary.sevenDays, period: '7天'},
      {...currentView.changeSummary.thirtyDays, period: '30天'},
    ];
  }, [currentView]);

  const close = () => {
    setAction(undefined);
    onClose();
  };
  const closeAction = () => {
    setAction(undefined);
    window.requestAnimationFrame(() => actionTriggerRef.current?.focus());
  };
  const openAction = (nextAction: InventoryActionKind) => {
    setAction(nextAction);
  };
  const title = currentView ? (
    <Space size={4}>
      库存对象详情：
      <NameCodeText
        name={currentView.target.productName ?? currentView.target.productCode}
        code={currentView.target.productCode}
      />
    </Space>
  ) : (
    '库存对象详情'
  );
  const actionItems = currentView && canEdit
    ? [
        {
          key: 'count',
          label: <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.inventory.count}>存量盘点</AdminDetailActionLabel>,
          onClick: () => openAction('COUNT'),
        },
        {
          key: 'increase',
          label: <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.inventory.increase}>库存增加</AdminDetailActionLabel>,
          onClick: () => openAction('INCREASE'),
        },
        {
          key: 'adjust',
          label: <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.inventory.adjust}>人工调整</AdminDetailActionLabel>,
          onClick: () => openAction('ADJUST'),
        },
        {
          key: 'configure',
          label: <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.inventory.configure}>快捷配置</AdminDetailActionLabel>,
          onClick: () => openAction('CONFIGURE'),
        },
      ]
    : [];
  const identityBlocked = Boolean(current.error);
  const zoneItems = [
    {
      key: 'current',
      children: (
        <Card size="small" title="① 当前状态" {...testId('inventory-zone-current')}>
          <Space direction="vertical" size={12} style={{display: 'flex'}}>
            <Descriptions
              {...adminWideDetailDescriptionsProps}
              items={[
                {
                  key: 'identity',
                  label: '库存对象',
                  children: (
                    <NameCodeText
                      name={currentView?.target.productName ?? ''}
                      code={currentView?.target.productCode ?? ''}
                    />
                  ),
                },
                {
                  key: 'sku',
                  label: 'SKU',
                  children: currentView?.target.skuName ? (
                    <NameCodeText name={currentView.target.skuName} code={currentView.target.skuCode ?? ''} />
                  ) : (
                    '非 SKU 对象'
                  ),
                },
                {
                  key: 'shape',
                  label: '对象形态',
                  children: inventoryShapeLabel(currentView?.target.productShape),
                },
                {
                  key: 'balance',
                  label: '当前库存',
                  children: currentView ? (
                    <>
                      {currentView.balance} {inventoryUnitLabel(currentView.target.consumptionUnitSnapshot)}
                    </>
                  ) : (
                    '—'
                  ),
                },
                {
                  key: 'state',
                  label: '库存状态',
                  children: currentView ? (
                    <Space>
                      <Tag
                        color={
                          currentView.stockState === 'LOW'
                            ? 'orange'
                            : currentView.stockState === 'OUT' || currentView.stockState === 'NEGATIVE'
                              ? 'red'
                              : 'green'
                        }
                      >
                        {inventoryStockStateLabel(currentView.stockState)}
                      </Tag>
                      {currentView.stale && <Tag>数据陈旧</Tag>}
                      {currentView.unknown && <Tag>未知</Tag>}
                    </Space>
                  ) : (
                    '—'
                  ),
                },
                {
                  key: 'threshold',
                  label: '阈值 / 差额',
                  children: currentView ? `${currentView.threshold ?? '—'} / ${currentView.gap ?? '—'}` : '—',
                },
                {key: 'source', label: '来源', children: inventoryAuthorityLabel(currentView?.target.authorityType)},
                {
                  key: 'counting',
                  label: '盘点单位',
                  children: currentView?.target.countingUnitSnapshot ? (
                    <>
                      {inventoryUnitLabel(currentView.target.countingUnitSnapshot)}（
                      {inventoryConversionLabel(currentView.target.conversionFacts)}）
                    </>
                  ) : (
                    '未配置'
                  ),
                },
              ]}
            />
            {currentView?.recentChanges?.length ? (
              <Table
                size="small"
                rowKey={(row, index) => `${row.occurredAt}-${row.changeType}-${index}`}
                pagination={false}
                dataSource={currentView.recentChanges}
                columns={[
                  {
                    title: '最近变化',
                    dataIndex: 'changeType',
                    render: (value: string) => inventoryOperationLabel(value),
                  },
                  {title: '数量', dataIndex: 'quantity'},
                  {title: '来源', dataIndex: 'source', render: (value: string) => inventoryOperationLabel(value)},
                  {title: '时间', dataIndex: 'occurredAt', render: (value: number) => new Date(value).toLocaleString()},
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无最近变化明细" />
            )}
          </Space>
        </Card>
      ),
    },
    {
      key: 'changes',
      children: (
        <Card size="small" title="② 库存变化" {...testId('inventory-zone-changes')}>
          <Space direction="vertical" size={12} style={{display: 'flex'}}>
            {periodChanges.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无库存变化" />
            ) : (
              <Table
                size="small"
                rowKey="period"
                pagination={false}
                dataSource={periodChanges}
                columns={[
                  {title: '周期', dataIndex: 'period'},
                  {title: '变化量', dataIndex: 'netChange'},
                ]}
              />
            )}
          </Space>
        </Card>
      ),
    },
    {
      key: 'history',
      children: (
        <Card size="small" title="③ 盘点与库存增加历史" {...testId('inventory-zone-business-history')}>
          {history.error ? (
            <ZoneProblem title="盘点与库存增加历史" onRetry={() => void history.refetch()} />
          ) : history.isFetching && !history.currentData ? (
            <Skeleton active />
          ) : !historyPage?.entries.length ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无盘点或库存增加记录" />
          ) : (
            <Space direction="vertical" size={8} style={{display: 'flex'}}>
              <Table
                size="small"
                rowKey="entryRef"
                pagination={false}
                dataSource={historyPage.entries}
                columns={[
                  {title: '动作', dataIndex: 'action', render: (value: string) => inventoryOperationLabel(value)},
                  {title: '数量', dataIndex: 'quantity'},
                  {title: '变更前', dataIndex: 'beforeQuantity'},
                  {title: '变更后', dataIndex: 'afterQuantity'},
                  {title: '时间', dataIndex: 'occurredAt', render: (value: number) => new Date(value).toLocaleString()},
                ]}
              />
              <CursorPagination
                state={historyCursorState}
                nextCursor={historyPage.cursor}
                testIdPrefix="inventory-history-pagination"
              />
            </Space>
          )}
        </Card>
      ),
    },
    {
      key: 'references',
      children: (
        <Card size="small" title="④ 关联商品与扣减规则" {...testId('inventory-zone-consumption-references')}>
          {references.error ? (
            <ZoneProblem title="关联商品与扣减规则" onRetry={() => void references.refetch()} />
          ) : references.isFetching && !references.currentData ? (
            <Skeleton active />
          ) : !referencePage?.entries.length ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无关联商品或扣减规则" />
          ) : (
            <Space direction="vertical" size={8} style={{display: 'flex'}}>
              <Table
                size="small"
                rowKey={(row, index) => `${row.sourceKind}-${row.sourceCode}-${index}`}
                pagination={false}
                dataSource={referencePage.entries}
                columns={[
                  {
                    title: '来源对象',
                    render: (_, row) => (
                      <NameCodeText
                        name={row.sourceName || inventoryReferenceSourceKindLabel(row.sourceKind)}
                        code={row.sourceCode}
                      />
                    ),
                  },
                  {
                    title: '来源层级',
                    render: (_, row) => (row.ownerScope ? inventoryReferenceScopeLabel(row.ownerScope.ownerType) : '—'),
                  },
                  {
                    title: '每份消耗',
                    render: (_, row) => (
                      <>
                        {row.quantity} {inventoryUnitLabel(row.consumptionUnitSnapshot)}
                      </>
                    ),
                  },
                  {
                    title: '时机',
                    dataIndex: 'timing',
                    render: (value: string) => inventoryDeductionTimingLabel(value),
                  },
                ]}
              />
              <CursorPagination
                state={referenceCursorState}
                nextCursor={referencePage.cursor}
                testIdPrefix="inventory-reference-pagination"
              />
            </Space>
          )}
        </Card>
      ),
    },
    {
      key: 'ledger',
      children: (
        <Card size="small" title="⑤ 全部变化记录" {...testId('inventory-zone-ledger')}>
          {ledger.error ? (
            <ZoneProblem title="全部变化记录" onRetry={() => void ledger.refetch()} />
          ) : ledger.isFetching && !ledger.currentData ? (
            <Skeleton active />
          ) : !ledgerPage?.entries.length ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无变化记录" />
          ) : (
            <Space direction="vertical" size={8} style={{display: 'flex'}}>
              <Table
                size="small"
                rowKey="entryRef"
                pagination={false}
                dataSource={ledgerPage.entries}
                columns={[
                  {title: '来源', dataIndex: 'source', render: (value: string) => inventoryOperationLabel(value)},
                  {title: '原因', dataIndex: 'reasonCode', render: (value: string) => inventoryReasonLabel(value)},
                  {title: '变更前', dataIndex: 'beforeQuantity'},
                  {title: '变化量', dataIndex: 'changeQuantity'},
                  {title: '变更后', dataIndex: 'afterQuantity'},
                  {title: '时间', dataIndex: 'occurredAt', render: (value: number) => new Date(value).toLocaleString()},
                ]}
              />
              <CursorPagination
                state={ledgerCursorState}
                nextCursor={ledgerPage.cursor}
                testIdPrefix="inventory-ledger-pagination"
              />
            </Space>
          )}
        </Card>
      ),
    },
  ];

  return (
    <>
      <Drawer
        title={title}
        open={open}
        onClose={close}
        destroyOnHidden
        maskClosable={!action}
        keyboard={!action}
        {...adminWideDrawerSurfaceProps}
        {...testId('inventory-target-drawer')}
        extra={
          actionItems.length > 0 ? (
            <AdminDetailActionMenu
              items={actionItems}
              triggerTestId={operationsDetailDrawerTestIds.inventory.actionMenu}
              triggerRef={actionTriggerRef}
            />
          ) : undefined
        }
      >
        {current.isFetching && !current.currentData && (
          <Skeleton active {...testId('inventory-zone-current-loading')} />
        )}
        {identityBlocked && (
          <Alert
            type="error"
            showIcon
            title="库存对象详情未完成"
            description="关键对象身份暂时无法获取，请重试。"
            action={<Button onClick={() => void current.refetch()}>重试</Button>}
            {...testId('inventory-zone-current-problem')}
          />
        )}
        {!identityBlocked && currentView && (
          <Space direction="vertical" size={12} style={{display: 'flex'}}>
            {zoneItems.map(item => (
              <div key={item.key} style={{width: '100%'}}>
                {item.children}
              </div>
            ))}
          </Space>
        )}
      </Drawer>
      <InventoryActionModal
        action={action}
        current={currentView}
        expectedVersion={currentView?.version}
        queryContext={queryContext}
        onClose={closeAction}
      />
    </>
  );
}

function inventoryReferenceScopeLabel(ownerType: string) {
  if (ownerType === 'STORE') return '门店商品库';
  if (ownerType === 'HEAD_COMPANY') return '品牌商品库';
  return '当前商品库';
}
