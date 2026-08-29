import {Alert, Button, Card, Descriptions, Dropdown, Drawer, Modal, Space, Tabs, Tooltip, Typography} from 'antd';
import {useEffect, useMemo, useState} from 'react';
import {
  adminWideDrawerSurfaceProps,
  createContentIdempotencyKey,
  NameCodeText,
  testId,
} from '@catering-v2s/admin-ui-foundation';
import {operationsLogger, operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {CATALOG_INVENTORY_OPERATION_IDS} from '../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {requireOperationsScopeRef} from '../../../app/routing/model';
import {selectCatalogDetailForItem} from '../model/catalogModel';
import {catalogViewTabLabel} from '../model/catalogTabLabels';
import {catalogUiProblemFeedback} from '../model/catalogUiProblemFeedback';
import type {CatalogItemDrawerProps, CatalogManifest} from '../model/catalogItemSurfaceTypes';
import {catalogItemTabTestId, catalogTestIdControls, catalogTestIds} from '../catalogTestIds';
import {CatalogTemporaryPromotionTask} from './CatalogTemporaryPromotionTask';
import {CatalogItemViewTabContent} from './CatalogItemViewSections';
import {CatalogLifecycleStatusTag} from './CatalogLifecycleStatusTag';

function money(value: number | null | undefined) {
  return value === null || value === undefined ? '未设置' : `¥${(value / 100).toFixed(2)}`;
}

export function CatalogItemViewDrawer({
  itemCode,
  initialViewTab,
  queryContext,
  brandRef,
  canWriteCatalog,
  onEdit,
  onCopy,
  onVoidAndRebuild,
  onClose,
}: CatalogItemDrawerProps) {
  const [viewedItemCode, setViewedItemCode] = useState(itemCode);
  const [activeTab, setActiveTab] = useState(initialViewTab || 'basic');
  const [problem, setProblem] = useState<string>();
  const [pendingStatus, setPendingStatus] = useState<'ENABLED' | 'DISABLED' | 'VOIDED'>();
  const [promotionOpen, setPromotionOpen] = useState(false);
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const detailRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogItem(
        {itemCode: viewedItemCode ?? ''},
        {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? '')}, headers},
      ),
    [headers, queryContext.scopeRef, viewedItemCode],
  );
  const detailQuery = operationsRtk.useGetOperationsCatalogItemQuery(detailRequest, {skip: !viewedItemCode});
  // detailQuery.isError ? undefined keeps a failed identity read from reusing stale currentData.
  const detail = useMemo(
    () =>
      detailQuery.isError
        ? undefined
        : selectCatalogDetailForItem(viewedItemCode, detailQuery.currentData, detailQuery.data),
    [detailQuery.currentData, detailQuery.data, detailQuery.isError, viewedItemCode],
  );
  const manifestRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogShapeManifest(
        {},
        {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? '')}, headers},
      ),
    [headers, queryContext.scopeRef],
  );
  const manifestQuery = operationsRtk.useGetOperationsCatalogShapeManifestQuery(manifestRequest, {skip: !itemCode});
  const manifest: CatalogManifest | undefined = manifestQuery.currentData?.data;
  const [transition] = operationsRtk.useTransitionOperationsCatalogItemStatusMutation();
  const action = detail?.actionAvailability;
  const sourceLocked = detail?.item.source === 'TEMPORARY';
  const isReferencedDetail = Boolean(viewedItemCode && itemCode && viewedItemCode !== itemCode);

  useEffect(() => {
    setViewedItemCode(itemCode);
  }, [itemCode]);

  useEffect(() => {
    if (initialViewTab) setActiveTab(initialViewTab);
  }, [initialViewTab]);

  useEffect(() => {
    if (!detail) return;
    const first = detail.tabs.find(tab => tab.visible)?.tabKey;
    if (first && !detail.tabs.some(tab => tab.tabKey === activeTab && tab.visible)) setActiveTab(first);
  }, [activeTab, detail]);

  const changeStatus = async (targetStatus: 'ENABLED' | 'DISABLED' | 'VOIDED') => {
    if (!detail || !viewedItemCode) return;
    try {
      const body = {
        dataNodeRef: requireOperationsScopeRef(queryContext),
        itemCode: viewedItemCode,
        targetStatus,
        expectedVersion: detail.item.version,
      };
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.transitionOperationsCatalogItemStatus,
        body,
      );
      await transition(
        catalogInventoryRtkRequest.transitionOperationsCatalogItemStatus(
          {itemCode: viewedItemCode},
          {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
        ),
      ).unwrap();
      await detailQuery.refetch();
      operationsLogger.info({
        event: 'catalog.item.view.status_changed',
        phase: 'COMMAND',
        outcome: 'SUCCEEDED',
        operationId: CATALOG_INVENTORY_OPERATION_IDS.transitionOperationsCatalogItemStatus,
      });
      if (targetStatus === 'VOIDED')
        onVoidAndRebuild?.({code: detail.item.code, name: detail.item.name, shapeKey: detail.item.shapeKey});
    } catch (error) {
      setProblem(catalogUiProblemFeedback(error, '商品状态更新未完成，请重试。').message);
    }
  };

  const confirmStatusChange = (targetStatus: 'ENABLED' | 'DISABLED' | 'VOIDED') => {
    if (!detail) return;
    setPendingStatus(targetStatus);
  };

  const voidAndRebuild = () => {
    if (!detail?.actionAvailability.voidAvailability?.canVoid) return;
    setPendingStatus('VOIDED');
  };

  const pendingStatusLabel = pendingStatus === 'ENABLED' ? '启用' : pendingStatus === 'DISABLED' ? '停用' : '标记删除';

  const tabs = detail?.tabs
    .filter(tab => tab.visible)
    .map(tab => ({
      key: tab.tabKey,
      label:
        tab.disabled && tab.reason ? (
          <Tooltip title={tab.reason}>
            <span data-testid={catalogItemTabTestId(tab.tabKey)}>{catalogViewTabLabel(tab.tabKey)}</span>
          </Tooltip>
        ) : (
          <span data-testid={catalogItemTabTestId(tab.tabKey)}>{catalogViewTabLabel(tab.tabKey)}</span>
        ),
      disabled: tab.disabled,
      children: (
        <CatalogItemViewTabContent
          tabKey={tab.tabKey}
          detail={detail}
          manifest={manifest}
          onNavigateTab={setActiveTab}
          onOpenReferencedItem={code => {
            setViewedItemCode(code);
            setActiveTab('basic');
          }}
        />
      ),
    }));
  const moreActions =
    detail && canWriteCatalog && !sourceLocked && !isReferencedDetail
      ? [
          action?.canEnable
            ? {
                key: 'enable',
                label: <span {...testId(catalogTestIds.control.statusEnable)}>启用</span>,
                onClick: () => confirmStatusChange('ENABLED'),
              }
            : null,
          action?.canDisable
            ? {
                key: 'disable',
                label: <span {...testId(catalogTestIds.control.statusDisable)}>停用</span>,
                onClick: () => confirmStatusChange('DISABLED'),
              }
            : null,
          action?.voidAvailability?.canVoid
            ? {
                key: 'void',
                danger: true,
                label: (
                  <span {...testId(catalogTestIds.static.itemVoidAndRebuild)}>
                    <span {...testId(catalogTestIds.control.statusVoid)}>标记删除</span>
                  </span>
                ),
                onClick: voidAndRebuild,
              }
            : null,
          {
            key: 'copy',
            label: <span {...testId(catalogTestIds.static.itemCopyLocalOpen)}>从已有商品复制配置</span>,
            onClick: () => onCopy?.({itemCode: detail.item.code, targetShapeKey: detail.item.shapeKey}),
          },
        ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      : [];

  return (
    <Drawer
      open={Boolean(itemCode)}
      onClose={onClose}
      title={
        detail ? (
          <Space>
            <NameCodeText name={detail.item.name} code={detail.item.code} emphasizeName />
            <CatalogLifecycleStatusTag manifest={manifest} kind="ITEM" status={detail.item.lifecycle.status} />
          </Space>
        ) : (
          '商品详情'
        )
      }
      extra={
        detail && (
          <Space>
            {canWriteCatalog && action?.canEdit && !sourceLocked && !isReferencedDetail && (
              <Button onClick={onEdit} {...testId(catalogTestIds.static.itemEdit)}>
                编辑
              </Button>
            )}
            {isReferencedDetail && <Button onClick={() => setViewedItemCode(itemCode)}>返回当前商品</Button>}
            {canWriteCatalog && sourceLocked && (
              <Button
                type="primary"
                onClick={() => setPromotionOpen(true)}
                {...testId(catalogTestIds.static.itemTemporaryPromotion)}
              >
                检查是否可以转为正式商品
              </Button>
            )}
            {moreActions.length > 0 && (
              <Dropdown menu={{items: moreActions}}>
                <Button {...testId(catalogTestIdControls.view.more)}>更多</Button>
              </Dropdown>
            )}
          </Space>
        )
      }
      {...adminWideDrawerSurfaceProps}
      {...testId(catalogTestIds.surface.itemViewDrawer)}
    >
      {problem && <Alert type="error" showIcon title="商品操作未完成" description={problem} />}
      {detailQuery.isLoading && !detail && <Typography.Text>正在读取商品信息…</Typography.Text>}
      {detailQuery.error && (
        <Alert
          type="error"
          showIcon
          title="商品详情暂时无法获取"
          description="请重试或稍后再试。"
          action={
            <Button onClick={() => void detailQuery.refetch()} {...testId(catalogTestIds.static.itemProblemRetry)}>
              重试
            </Button>
          }
          {...testId(catalogTestIds.static.itemProblem)}
        />
      )}
      {detail?.item.source === 'AUTO_SYNC' && (
        <Alert
          type="info"
          showIcon
          title="自动同步商品"
          description="部分信息由来源系统维护，当前页面只展示商品事实。"
        />
      )}
      {detail?.item.source === 'TEMPORARY' && (
        <Card size="small" title="来源与原始信息">
          <Descriptions
            size="small"
            column={2}
            items={[
              {key: 'name', label: '原始名称', children: detail.item.externalIdentity.snapshot?.name || '—'},
              {key: 'price', label: '原始价格', children: money(detail.item.externalIdentity.snapshot?.price ?? null)},
            ]}
          />
        </Card>
      )}
      {detail && tabs && (
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} {...testId(catalogTestIds.static.itemTabs)} />
      )}
      <Modal
        open={Boolean(pendingStatus && detail)}
        title={pendingStatus === 'VOIDED' ? `作废并重建“${detail?.item.name ?? ''}”` : `${pendingStatusLabel}商品？`}
        onCancel={() => setPendingStatus(undefined)}
        onOk={() => {
          const targetStatus = pendingStatus;
          setPendingStatus(undefined);
          if (targetStatus) void changeStatus(targetStatus);
        }}
        okText={pendingStatus === 'VOIDED' ? '作废并继续重建' : `确认${pendingStatusLabel}`}
        cancelText="取消"
        okButtonProps={testId(catalogTestIds.control.lifecycleConfirmYes)}
        cancelButtonProps={testId(catalogTestIds.control.lifecycleConfirmNo)}
        {...testId(catalogTestIds.surface.lifecycleConfirm)}
      >
        {pendingStatus === 'VOIDED'
          ? '旧商品会保留历史记录，并打开新的创建流程。'
          : `将把商品“${detail?.item.name ?? ''}”的状态改为“${pendingStatusLabel}”，不会清空商品信息。`}
      </Modal>
      {detail && (
        <CatalogTemporaryPromotionTask
          open={promotionOpen}
          detail={detail}
          manifest={manifest}
          queryContext={queryContext}
          brandRef={brandRef}
          onClose={() => setPromotionOpen(false)}
          onCompleted={({codeChanged}) => {
            setPromotionOpen(false);
            if (codeChanged) onClose();
            else void detailQuery.refetch();
          }}
        />
      )}
    </Drawer>
  );
}
