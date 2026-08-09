import {Alert, Button, Card, Collapse, Descriptions, Drawer, Empty, Skeleton, Space, Table, Tag} from 'antd';
import {adminWideDetailDescriptionsProps, adminWideDrawerSurfaceProps, NameCodeText, testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useRef, useState} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import type {OperationsPageContext} from '../../../app/routing/model';
import {INVENTORY_ACTION_TRIGGER_TEST_IDS, InventoryActionModal, type InventoryActionKind} from './InventoryActionModal';
import {envelopeData, shouldRequestInventoryDiagnostics, type CursorPage, type InventoryCurrentView, type InventoryDiagnostics, type InventoryHistoryEntry, type InventoryLedgerEntry, type InventoryReference} from './inventoryManagementModel';

type Props = {targetRef?: string; canEdit: boolean; queryContext: OperationsPageContext; onClose: () => void; onListChanged: () => void};
type InventoryZone = 'current' | 'changes' | 'history' | 'references' | 'ledger' | 'diagnostics';

function ZoneProblem({title, onRetry}: {title: string; onRetry: () => void}) {
  return <Alert type="error" showIcon title={`${title}暂时无法获取`} action={<Button size="small" onClick={onRetry}>重试</Button>}/>;
}

export function InventoryDetailDrawer({targetRef, canEdit, queryContext, onClose, onListChanged}: Props) {
  const [action, setAction] = useState<InventoryActionKind>();
  const [expandedZones, setExpandedZones] = useState<string[]>(['current']);
  const [historyCursors, setHistoryCursors] = useState<string[]>(['']);
  const [referenceCursors, setReferenceCursors] = useState<string[]>(['']);
  const [ledgerCursors, setLedgerCursors] = useState<string[]>(['']);
  const actionTriggerRef = useRef<HTMLElement | null>(null);
  const open = Boolean(targetRef);
  useOverlayLock(open);
  useEffect(() => {
    setExpandedZones(['current']);
    setAction(undefined);
    setHistoryCursors(['']);
    setReferenceCursors(['']);
    setLedgerCursors(['']);
    actionTriggerRef.current = null;
  }, [targetRef]);
  const zoneLoaded = (zone: InventoryZone) => zone === 'current' ? open : open && expandedZones.includes(zone);
  const path = {targetRef: targetRef ?? ''};
  const historyCursor = historyCursors[historyCursors.length - 1] ?? '';
  const referenceCursor = referenceCursors[referenceCursors.length - 1] ?? '';
  const ledgerCursor = ledgerCursors[ledgerCursors.length - 1] ?? '';
  const current = operationsRtk.useGetOperationsInventoryTargetQuery(catalogInventoryRtkRequest.getOperationsInventoryTarget(path), {skip: !open});
  const changesToday = operationsRtk.useGetOperationsInventoryTargetChangeSummaryQuery(catalogInventoryRtkRequest.getOperationsInventoryTargetChangeSummary(path, {query: {period: 'TODAY'}}), {skip: !zoneLoaded('changes')});
  const changes7d = operationsRtk.useGetOperationsInventoryTargetChangeSummaryQuery(catalogInventoryRtkRequest.getOperationsInventoryTargetChangeSummary(path, {query: {period: '7D'}}), {skip: !zoneLoaded('changes')});
  const changes30d = operationsRtk.useGetOperationsInventoryTargetChangeSummaryQuery(catalogInventoryRtkRequest.getOperationsInventoryTargetChangeSummary(path, {query: {period: '30D'}}), {skip: !zoneLoaded('changes')});
  const history = operationsRtk.useGetOperationsInventoryTargetBusinessHistoryQuery(
    catalogInventoryRtkRequest.getOperationsInventoryTargetBusinessHistory(
      path,
      historyCursor ? {query: {pageSize: 20, cursor: historyCursor}} : {query: {pageSize: 20}}
    ),
    {skip: !zoneLoaded('history')}
  );
  const references = operationsRtk.useGetOperationsInventoryTargetConsumptionReferencesQuery(
    catalogInventoryRtkRequest.getOperationsInventoryTargetConsumptionReferences(
      path,
      referenceCursor ? {query: {pageSize: 20, cursor: referenceCursor}} : {query: {pageSize: 20}}
    ),
    {skip: !zoneLoaded('references')}
  );
  const ledger = operationsRtk.useGetOperationsInventoryTargetLedgerQuery(
    catalogInventoryRtkRequest.getOperationsInventoryTargetLedger(
      path,
      ledgerCursor ? {query: {pageSize: 20, cursor: ledgerCursor}} : {query: {pageSize: 20}}
    ),
    {skip: !zoneLoaded('ledger')}
  );
  const requestDiagnostics = shouldRequestInventoryDiagnostics(zoneLoaded('diagnostics'));
  const diagnostics = operationsRtk.useGetOperationsInventoryTargetDiagnosticsQuery(catalogInventoryRtkRequest.getOperationsInventoryTargetDiagnostics(path), {skip: !shouldRequestInventoryDiagnostics(zoneLoaded('diagnostics'))});
  const currentView = envelopeData<InventoryCurrentView>(current.data);
  const historyPage = envelopeData<CursorPage<InventoryHistoryEntry>>(history.data);
  const referencePage = envelopeData<CursorPage<InventoryReference>>(references.data);
  const ledgerPage = envelopeData<CursorPage<InventoryLedgerEntry>>(ledger.data);
  const diagnosticsView = envelopeData<InventoryDiagnostics>(diagnostics.data);
  const periodChanges = useMemo(() => {
    const fromResponse = (query: typeof changesToday, fallback: InventoryCurrentView['changeSummary'][keyof InventoryCurrentView['changeSummary']], label: string) => {
      const value = envelopeData<{period?: string; increase?: string; decrease?: string; netChange?: string; entryCount?: number}>(query.data);
      return value?.period ? {period: label, increase: value.increase ?? '0', decrease: value.decrease ?? '0', netChange: value.netChange ?? '0', entryCount: value.entryCount ?? 0} : {period: label, ...fallback};
    };
    return currentView ? [
      fromResponse(changesToday, currentView.changeSummary.today, '今日'),
      fromResponse(changes7d, currentView.changeSummary.sevenDays, '7天'),
      fromResponse(changes30d, currentView.changeSummary.thirtyDays, '30天'),
    ] : [];
  }, [changes30d, changes7d, changesToday, currentView]);

  const close = () => { setAction(undefined); onClose(); };
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
    if (zoneLoaded('changes')) { void changesToday.refetch(); void changes7d.refetch(); void changes30d.refetch(); }
    if (zoneLoaded('history')) void history.refetch();
    if (zoneLoaded('references')) void references.refetch();
    if (zoneLoaded('ledger')) void ledger.refetch();
    if (requestDiagnostics) void diagnostics.refetch();
    onListChanged();
  };
  const handleZoneChange = (keys: string | string[]) => setExpandedZones(Array.isArray(keys) ? keys : [keys]);
  const title = currentView ? `库存对象详情：${currentView.target.productName}` : '库存对象详情';
  const identityBlocked = Boolean(current.error);
  const zoneItems = [
    {key: 'current', label: '① 当前状态', children: <Card size="small" title="① 当前状态" {...testId('inventory-zone-current')}>
      <Descriptions {...adminWideDetailDescriptionsProps} items={[
        {key: 'identity', label: '库存对象', children: <NameCodeText name={currentView?.target.productName ?? ''} code={currentView?.target.productCode ?? ''}/>},
        {key: 'sku', label: 'SKU', children: currentView?.target.skuName ? <NameCodeText name={currentView.target.skuName} code={currentView.target.skuCode ?? ''}/> : '非 SKU 对象'},
        {key: 'shape', label: '对象形态', children: currentView?.target.productShape},
        {key: 'balance', label: '当前库存', children: currentView ? `${currentView.balance} ${currentView.target.consumptionUnit}` : '—'},
        {key: 'state', label: '库存状态', children: currentView ? <Space><Tag color={currentView.stockState === 'LOW' ? 'orange' : currentView.stockState === 'OUT' || currentView.stockState === 'NEGATIVE' ? 'red' : 'green'}>{currentView.stockState}</Tag>{currentView.stale && <Tag>数据陈旧</Tag>}{currentView.unknown && <Tag>未知</Tag>}</Space> : '—'},
        {key: 'threshold', label: '阈值 / 差额', children: currentView ? `${currentView.threshold ?? '—'} / ${currentView.gap ?? '—'}` : '—'},
        {key: 'source', label: '来源', children: '内部轻库存'},
        {key: 'counting', label: '盘点单位', children: currentView?.target.countingUnit ? `${currentView.target.countingUnit}（${currentView.target.conversionSummary ?? '—'}）` : '未配置'},
      ]}/>
    </Card>},
    {key: 'changes', label: '② 库存变化', children: <Card size="small" title="② 库存变化" {...testId('inventory-zone-changes')}>
      {(changesToday.error || changes7d.error || changes30d.error) ? <ZoneProblem title="库存变化" onRetry={() => { void changesToday.refetch(); void changes7d.refetch(); void changes30d.refetch(); }}/> : (changesToday.isLoading || changes7d.isLoading || changes30d.isLoading) && !changesToday.data && !changes7d.data && !changes30d.data ? <Skeleton active/> : periodChanges.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无库存变化"/> : <Table size="small" rowKey="period" pagination={false} dataSource={periodChanges} columns={[
        {title: '周期', dataIndex: 'period'}, {title: '增加', dataIndex: 'increase'}, {title: '减少', dataIndex: 'decrease'}, {title: '净变化', dataIndex: 'netChange'}, {title: '变化数', dataIndex: 'entryCount'},
      ]}/>} 
    </Card>},
    {key: 'history', label: '③ 盘点与库存增加历史', children: <Card size="small" title="③ 盘点与库存增加历史" {...testId('inventory-zone-business-history')}>
      {history.error ? <ZoneProblem title="盘点与库存增加历史" onRetry={() => void history.refetch()}/> : history.isLoading && !history.data ? <Skeleton active/> : !historyPage?.entries.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无盘点或库存增加记录"/> : <Table size="small" rowKey="entryRef" pagination={{current: historyCursors.length, pageSize: 20, total: historyPage.total, showSizeChanger: false, onChange: (page) => setHistoryCursors(current => page < current.length ? current.slice(0, page) : page > current.length && historyPage.cursor ? [...current, historyPage.cursor] : current)}} dataSource={historyPage.entries} columns={[
        {title: '动作', dataIndex: 'action'}, {title: '数量', dataIndex: 'quantity'}, {title: '变更前', dataIndex: 'beforeQuantity'}, {title: '变更后', dataIndex: 'afterQuantity'}, {title: '时间', dataIndex: 'occurredAt', render: (value: number) => new Date(value).toLocaleString()},
      ]}/>} 
    </Card>},
    {key: 'references', label: '④ 关联商品与扣减规则', children: <Card size="small" title="④ 关联商品与扣减规则" {...testId('inventory-zone-consumption-references')}>
      {references.error ? <ZoneProblem title="关联商品与扣减规则" onRetry={() => void references.refetch()}/> : references.isLoading && !references.data ? <Skeleton active/> : !referencePage?.entries.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无关联商品或扣减规则"/> : <Table size="small" rowKey="sourceCode" pagination={{current: referenceCursors.length, pageSize: 20, total: referencePage.total, showSizeChanger: false, onChange: (page) => setReferenceCursors(current => page < current.length ? current.slice(0, page) : page > current.length && referencePage.cursor ? [...current, referencePage.cursor] : current)}} dataSource={referencePage.entries} columns={[
        {title: '来源对象', render: (_, row) => <NameCodeText name={row.sourceName ?? row.sourceKind} code={row.sourceCode}/>}, {title: '来源层级', render: (_, row) => row.ownerScope?.ownerType ?? '—'}, {title: '每份消耗', render: (_, row) => `${row.quantity} ${row.unit}`}, {title: '时机', dataIndex: 'timing'}, {title: '状态', dataIndex: 'status'},
      ]}/>} 
    </Card>},
    {key: 'ledger', label: '⑤ 全部变化记录', children: <Card size="small" title="⑤ 全部变化记录" {...testId('inventory-zone-ledger')}>
      {ledger.error ? <ZoneProblem title="全部变化记录" onRetry={() => void ledger.refetch()}/> : ledger.isLoading && !ledger.data ? <Skeleton active/> : !ledgerPage?.entries.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无变化记录"/> : <Table size="small" rowKey="entryRef" pagination={{current: ledgerCursors.length, pageSize: 20, total: ledgerPage.total, showSizeChanger: false, onChange: (page) => setLedgerCursors(current => page < current.length ? current.slice(0, page) : page > current.length && ledgerPage.cursor ? [...current, ledgerPage.cursor] : current)}} dataSource={ledgerPage.entries} columns={[
        {title: '来源', dataIndex: 'source'}, {title: '原因', dataIndex: 'reasonCode'}, {title: '变更前', dataIndex: 'beforeQuantity'}, {title: '变化量', dataIndex: 'changeQuantity'}, {title: '变更后', dataIndex: 'afterQuantity'}, {title: '时间', dataIndex: 'occurredAt', render: (value: number) => new Date(value).toLocaleString()},
      ]}/>} 
    </Card>},
    ...([{key: 'diagnostics', label: '⑥ 高级诊断', children: <Card size="small" title="⑥ 高级诊断" {...testId('inventory-zone-diagnostics')}>
      {diagnostics.error ? <ZoneProblem title="高级诊断" onRetry={() => void diagnostics.refetch()}/> : diagnostics.isLoading && !diagnostics.data ? <Skeleton active/> : !diagnosticsView ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无诊断数据"/> : <>
        {diagnosticsView.warnings.length > 0 && <Alert type="warning" showIcon title="诊断提示" description={diagnosticsView.warnings.map((entry) => `${entry.code}：${entry.message}`).join('；')} style={{marginBottom: 12}}/>}
        <Table size="small" rowKey="queryName" pagination={false} dataSource={diagnosticsView.queries} columns={[{title: '查询', dataIndex: 'queryName'}, {title: '数据库操作数', dataIndex: 'databaseOperationCount'}, {title: '耗时(ms)', dataIndex: 'durationMillis'}]}/>
      </>}
    </Card>}]),
  ];

  return <>
    <Drawer title={title} open={open} onClose={close} destroyOnHidden maskClosable={!action} {...adminWideDrawerSurfaceProps} {...testId('inventory-target-drawer')}
      extra={currentView && canEdit ? <Space wrap>
        <Button onClick={(event) => openAction('COUNT', event.currentTarget)} {...testId(INVENTORY_ACTION_TRIGGER_TEST_IDS.COUNT)}>存量盘点</Button>
        <Button onClick={(event) => openAction('INCREASE', event.currentTarget)} {...testId(INVENTORY_ACTION_TRIGGER_TEST_IDS.INCREASE)}>库存增加</Button>
        <Button onClick={(event) => openAction('ADJUST', event.currentTarget)} {...testId(INVENTORY_ACTION_TRIGGER_TEST_IDS.ADJUST)}>人工调整</Button>
        <Button onClick={(event) => openAction('CONFIGURE', event.currentTarget)} {...testId(INVENTORY_ACTION_TRIGGER_TEST_IDS.CONFIGURE)}>快捷配置</Button>
      </Space> : undefined}>
      {current.isLoading && !current.data && <Skeleton active {...testId('inventory-zone-current-loading')}/>}
      {identityBlocked && <Alert type="error" showIcon title="库存对象详情未完成" description="关键对象身份暂时无法获取，请重试。" action={<Button onClick={() => void current.refetch()}>重试</Button>} {...testId('inventory-zone-current-problem')}/>} 
      {!identityBlocked && currentView && <Collapse activeKey={expandedZones} onChange={handleZoneChange} items={zoneItems}/>} 
    </Drawer>
    <InventoryActionModal action={action} current={currentView} expectedVersion={currentView?.version} queryContext={queryContext} onClose={closeAction} onCompleted={refreshAll}/>
  </>;
}
