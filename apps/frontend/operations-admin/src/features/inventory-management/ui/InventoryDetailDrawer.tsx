import {
  Alert,
  Button,
  Card,
  Collapse,
  Descriptions,
  Drawer,
  Empty,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  adminWideDetailDescriptionsProps,
  adminWideDrawerSurfaceProps,
  NameCodeText,
  testId,
  useCursorStack,
  useOverlayLock,
  type CursorStackState,
} from '@catering-v2s/admin-ui-foundation';
import {skipToken} from '@reduxjs/toolkit/query';
import {useEffect, useMemo, useRef, useState} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import type {Uuid} from '../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import type {OperationsPageContext} from '../../../app/routing/model';
import {
  INVENTORY_ACTION_TRIGGER_TEST_IDS,
  InventoryActionModal,
  type InventoryActionKind,
} from './InventoryActionModal';
import {
  envelopeData,
  inventoryAuthorityLabel,
  shouldRequestInventoryDiagnostics,
  type CursorPage,
  type InventoryCurrentView,
  type InventoryDiagnostics,
  type InventoryHistoryEntry,
  type InventoryLedgerEntry,
  type InventoryReference,
} from './inventoryManagementModel';

type Props = {
  targetRef?: Uuid;
  canEdit: boolean;
  queryContext: OperationsPageContext;
  onClose: () => void;
  onListChanged: () => void;
};
type InventoryZone = 'current' | 'changes' | 'history' | 'references' | 'ledger' | 'diagnostics';

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

function CursorControls({
  state,
  hasNext,
  nextCursor,
  testIdPrefix,
}: {
  state: Pick<CursorStackState, 'page' | 'canPrevious' | 'goToPage'>;
  hasNext: boolean;
  nextCursor?: string;
  testIdPrefix: string;
}) {
  return (
    <Space size={8} style={{display: 'flex', justifyContent: 'flex-end'}} {...testId(testIdPrefix)}>
      <Button
        disabled={!state.canPrevious}
        onClick={() => state.goToPage(state.page - 1)}
        {...testId(`${testIdPrefix}-previous`)}
      >
        上一页
      </Button>
      <Typography.Text type="secondary">第 {state.page} 页</Typography.Text>
      <Button
        disabled={!hasNext}
        onClick={() => state.goToPage(state.page + 1, nextCursor)}
        {...testId(`${testIdPrefix}-next`)}
      >
        下一页
      </Button>
    </Space>
  );
}

export function InventoryDetailDrawer({targetRef, canEdit, queryContext, onClose, onListChanged}: Props) {
  const [action, setAction] = useState<InventoryActionKind>();
  const [expandedZones, setExpandedZones] = useState<string[]>(['current']);
  const historyCursorState = useCursorStack({resetKey: targetRef ?? ''});
  const referenceCursorState = useCursorStack({resetKey: targetRef ?? ''});
  const ledgerCursorState = useCursorStack({resetKey: targetRef ?? ''});
  const actionTriggerRef = useRef<HTMLElement | null>(null);
  const open = Boolean(targetRef);
  useOverlayLock(open);
  useEffect(() => {
    setExpandedZones(['current']);
    setAction(undefined);
    actionTriggerRef.current = null;
  }, [targetRef]);
  const zoneLoaded = (zone: InventoryZone) => (zone === 'current' ? open : open && expandedZones.includes(zone));
  const path = targetRef ? {targetRef: wireUuid(targetRef)} : undefined;
  const historyCursor = historyCursorState.cursor ?? '';
  const referenceCursor = referenceCursorState.cursor ?? '';
  const ledgerCursor = ledgerCursorState.cursor ?? '';
  const current = operationsRtk.useGetOperationsInventoryTargetQuery(
    path ? catalogInventoryRtkRequest.getOperationsInventoryTarget(path) : skipToken,
    {skip: !open},
  );
  const changesToday = operationsRtk.useGetOperationsInventoryTargetChangeSummaryQuery(
    path
      ? catalogInventoryRtkRequest.getOperationsInventoryTargetChangeSummary(path, {query: {period: 'TODAY'}})
      : skipToken,
    {skip: !zoneLoaded('changes')},
  );
  const changes7d = operationsRtk.useGetOperationsInventoryTargetChangeSummaryQuery(
    path
      ? catalogInventoryRtkRequest.getOperationsInventoryTargetChangeSummary(path, {query: {period: '7D'}})
      : skipToken,
    {skip: !zoneLoaded('changes')},
  );
  const changes30d = operationsRtk.useGetOperationsInventoryTargetChangeSummaryQuery(
    path
      ? catalogInventoryRtkRequest.getOperationsInventoryTargetChangeSummary(path, {query: {period: '30D'}})
      : skipToken,
    {skip: !zoneLoaded('changes')},
  );
  const history = operationsRtk.useGetOperationsInventoryTargetBusinessHistoryQuery(
    path
      ? catalogInventoryRtkRequest.getOperationsInventoryTargetBusinessHistory(
          path,
          historyCursor ? {query: {pageSize: 20, cursor: historyCursor}} : {query: {pageSize: 20}},
        )
      : skipToken,
    {skip: !zoneLoaded('history')},
  );
  const references = operationsRtk.useGetOperationsInventoryTargetConsumptionReferencesQuery(
    path
      ? catalogInventoryRtkRequest.getOperationsInventoryTargetConsumptionReferences(
          path,
          referenceCursor ? {query: {pageSize: 20, cursor: referenceCursor}} : {query: {pageSize: 20}},
        )
      : skipToken,
    {skip: !zoneLoaded('references')},
  );
  const ledger = operationsRtk.useGetOperationsInventoryTargetLedgerQuery(
    path
      ? catalogInventoryRtkRequest.getOperationsInventoryTargetLedger(
          path,
          ledgerCursor ? {query: {pageSize: 20, cursor: ledgerCursor}} : {query: {pageSize: 20}},
        )
      : skipToken,
    {skip: !zoneLoaded('ledger')},
  );
  const requestDiagnostics = shouldRequestInventoryDiagnostics(zoneLoaded('diagnostics'));
  const diagnostics = operationsRtk.useGetOperationsInventoryTargetDiagnosticsQuery(
    path ? catalogInventoryRtkRequest.getOperationsInventoryTargetDiagnostics(path) : skipToken,
    {skip: !shouldRequestInventoryDiagnostics(zoneLoaded('diagnostics'))},
  );
  const currentView = envelopeData<InventoryCurrentView>(current.currentData);
  const historyPage = envelopeData<CursorPage<InventoryHistoryEntry>>(history.currentData);
  const referencePage = envelopeData<CursorPage<InventoryReference>>(references.currentData);
  const ledgerPage = envelopeData<CursorPage<InventoryLedgerEntry>>(ledger.currentData);
  const diagnosticsView = envelopeData<InventoryDiagnostics>(diagnostics.currentData);
  const periodChanges = useMemo(() => {
    const fromResponse = (
      query: typeof changesToday,
      fallback: InventoryCurrentView['changeSummary'][keyof InventoryCurrentView['changeSummary']],
      label: string,
    ) => {
      const value = envelopeData<{
        period?: string;
        increase?: string;
        decrease?: string;
        netChange?: string;
        entryCount?: number;
      }>(query.currentData);
      return value?.period
        ? {
            period: label,
            increase: value.increase ?? '0',
            decrease: value.decrease ?? '0',
            netChange: value.netChange ?? '0',
            entryCount: value.entryCount ?? 0,
          }
        : {period: label, ...fallback};
    };
    return currentView
      ? [
          fromResponse(changesToday, currentView.changeSummary.today, '今日'),
          fromResponse(changes7d, currentView.changeSummary.sevenDays, '7天'),
          fromResponse(changes30d, currentView.changeSummary.thirtyDays, '30天'),
        ]
      : [];
  }, [changes30d, changes7d, changesToday, currentView]);

  const close = () => {
    setAction(undefined);
    onClose();
  };
  const closeAction = () => {
    setAction(undefined);
    window.requestAnimationFrame(() => actionTriggerRef.current?.focus());
  };
  const openAction = (nextAction: InventoryActionKind, trigger: HTMLElement) => {
    actionTriggerRef.current = trigger;
    setAction(nextAction);
  };
  const refreshAll = () => {
    void current.refetch();
    if (zoneLoaded('changes')) {
      void changesToday.refetch();
      void changes7d.refetch();
      void changes30d.refetch();
    }
    if (zoneLoaded('history')) void history.refetch();
    if (zoneLoaded('references')) void references.refetch();
    if (zoneLoaded('ledger')) void ledger.refetch();
    if (requestDiagnostics) void diagnostics.refetch();
    onListChanged();
  };
  const handleZoneChange = (keys: string | string[]) => setExpandedZones(Array.isArray(keys) ? keys : [keys]);
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
  const identityBlocked = Boolean(current.error);
  const zoneItems = [
    {
      key: 'current',
      label: '① 当前状态',
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
                {key: 'shape', label: '对象形态', children: currentView?.target.productShape},
                {
                  key: 'balance',
                  label: '当前库存',
                  children: currentView ? `${currentView.balance} ${currentView.target.consumptionUnit}` : '—',
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
                        {currentView.stockState}
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
                  children: currentView?.target.countingUnit
                    ? `${currentView.target.countingUnit}（${currentView.target.conversionSummary ?? '—'}）`
                    : '未配置',
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
                  {title: '最近变化', dataIndex: 'changeType'},
                  {title: '数量', dataIndex: 'quantity'},
                  {title: '来源', dataIndex: 'source'},
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
      label: '② 库存变化',
      children: (
        <Card size="small" title="② 库存变化" {...testId('inventory-zone-changes')}>
          {changesToday.error || changes7d.error || changes30d.error ? (
            <ZoneProblem
              title="库存变化"
              onRetry={() => {
                void changesToday.refetch();
                void changes7d.refetch();
                void changes30d.refetch();
              }}
            />
          ) : (changesToday.isFetching && !changesToday.currentData) ||
            (changes7d.isFetching && !changes7d.currentData) ||
            (changes30d.isFetching && !changes30d.currentData) ? (
            <Skeleton active />
          ) : (
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
          )}
        </Card>
      ),
    },
    {
      key: 'history',
      label: '③ 盘点与库存增加历史',
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
                  {title: '动作', dataIndex: 'action'},
                  {title: '数量', dataIndex: 'quantity'},
                  {title: '变更前', dataIndex: 'beforeQuantity'},
                  {title: '变更后', dataIndex: 'afterQuantity'},
                  {title: '时间', dataIndex: 'occurredAt', render: (value: number) => new Date(value).toLocaleString()},
                ]}
              />
              <CursorControls
                state={historyCursorState}
                hasNext={Boolean(historyPage.cursor)}
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
      label: '④ 关联商品与扣减规则',
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
                    render: (_, row) => <NameCodeText name={row.sourceName ?? row.sourceKind} code={row.sourceCode} />,
                  },
                  {
                    title: '来源层级',
                    render: (_, row) =>
                      row.ownerScope ? `${row.ownerScope.ownerType} / ${row.ownerScope.ownerRef}` : '—',
                  },
                  {title: '每份消耗', render: (_, row) => `${row.quantity} ${row.unit}`},
                  {title: '时机', dataIndex: 'timing'},
                  {title: '状态', dataIndex: 'status'},
                ]}
              />
              <CursorControls
                state={referenceCursorState}
                hasNext={Boolean(referencePage.cursor)}
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
      label: '⑤ 全部变化记录',
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
                  {title: '来源', dataIndex: 'source'},
                  {title: '原因', dataIndex: 'reasonCode'},
                  {title: '变更前', dataIndex: 'beforeQuantity'},
                  {title: '变化量', dataIndex: 'changeQuantity'},
                  {title: '变更后', dataIndex: 'afterQuantity'},
                  {title: '时间', dataIndex: 'occurredAt', render: (value: number) => new Date(value).toLocaleString()},
                ]}
              />
              <CursorControls
                state={ledgerCursorState}
                hasNext={Boolean(ledgerPage.cursor)}
                nextCursor={ledgerPage.cursor}
                testIdPrefix="inventory-ledger-pagination"
              />
            </Space>
          )}
        </Card>
      ),
    },
    ...[
      {
        key: 'diagnostics',
        label: '⑥ 高级诊断',
        children: (
          <Card size="small" title="⑥ 高级诊断" {...testId('inventory-zone-diagnostics')}>
            {diagnostics.error ? (
              <ZoneProblem title="高级诊断" onRetry={() => void diagnostics.refetch()} />
            ) : diagnostics.isFetching && !diagnostics.currentData ? (
              <Skeleton active />
            ) : !diagnosticsView ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无诊断数据" />
            ) : (
              <>
                {diagnosticsView.warnings.length > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    title="诊断提示"
                    description={diagnosticsView.warnings.map(entry => `${entry.code}：${entry.message}`).join('；')}
                    style={{marginBottom: 12}}
                  />
                )}
                <Table
                  size="small"
                  rowKey="queryName"
                  pagination={false}
                  dataSource={diagnosticsView.queries}
                  columns={[
                    {title: '查询', dataIndex: 'queryName'},
                    {title: '数据库操作数', dataIndex: 'databaseOperationCount'},
                    {title: '耗时(ms)', dataIndex: 'durationMillis'},
                  ]}
                />
              </>
            )}
          </Card>
        ),
      },
    ],
  ];

  return (
    <>
      <Drawer
        title={title}
        open={open}
        onClose={close}
        destroyOnHidden
        maskClosable={!action}
        {...adminWideDrawerSurfaceProps}
        {...testId('inventory-target-drawer')}
        extra={
          currentView && canEdit ? (
            <Space wrap>
              <Button
                onClick={event => openAction('COUNT', event.currentTarget)}
                {...testId(INVENTORY_ACTION_TRIGGER_TEST_IDS.COUNT)}
              >
                存量盘点
              </Button>
              <Button
                onClick={event => openAction('INCREASE', event.currentTarget)}
                {...testId(INVENTORY_ACTION_TRIGGER_TEST_IDS.INCREASE)}
              >
                库存增加
              </Button>
              <Button
                onClick={event => openAction('ADJUST', event.currentTarget)}
                {...testId(INVENTORY_ACTION_TRIGGER_TEST_IDS.ADJUST)}
              >
                人工调整
              </Button>
              <Button
                onClick={event => openAction('CONFIGURE', event.currentTarget)}
                {...testId(INVENTORY_ACTION_TRIGGER_TEST_IDS.CONFIGURE)}
              >
                快捷配置
              </Button>
            </Space>
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
          <Collapse activeKey={expandedZones} onChange={handleZoneChange} items={zoneItems} />
        )}
      </Drawer>
      <InventoryActionModal
        action={action}
        current={currentView}
        expectedVersion={currentView?.version}
        queryContext={queryContext}
        onClose={closeAction}
        onCompleted={refreshAll}
      />
    </>
  );
}
