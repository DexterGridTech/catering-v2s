import {Alert, Button, Card, Descriptions, Drawer, Space, Tabs, Tooltip, Typography} from 'antd';
import {useEffect, useMemo, useState} from 'react';
import {
  AdminDetailActionLabel,
  AdminDetailActionMenu,
  adminWideDrawerSurfaceProps,
  createContentIdempotencyKey,
  displayFieldValue,
  NameCodeText,
  StatusChangeConfirm,
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
  onClose,
  onAfterOpenChange,
}: CatalogItemDrawerProps) {
  const [viewedItemCode, setViewedItemCode] = useState(itemCode);
  const [activeTab, setActiveTab] = useState(initialViewTab || 'basic');
  const [problem, setProblem] = useState<string>();
  const [pendingStatus, setPendingStatus] = useState<'ENABLED' | 'DISABLED' | 'VOIDED'>();
  const [statusSubmitting, setStatusSubmitting] = useState(false);
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
    setProblem(undefined);
    setStatusSubmitting(true);
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
    } catch (error) {
      setProblem(catalogUiProblemFeedback(error, '商品状态更新未完成，请重试。').message);
    } finally {
      setStatusSubmitting(false);
      setPendingStatus(undefined);
    }
  };

  const confirmStatusChange = (targetStatus: 'ENABLED' | 'DISABLED' | 'VOIDED') => {
    if (!detail) return;
    setPendingStatus(targetStatus);
  };

  const markItemDeleted = () => {
    if (!detail?.actionAvailability.voidAvailability?.canVoid) return;
    setPendingStatus('VOIDED');
  };

  const pendingStatusLabel = pendingStatus === 'ENABLED' ? '启用' : pendingStatus === 'DISABLED' ? '停用' : '作废';

  const tabs = detail?.tabs
    .filter(tab => tab.visible)
    .map(tab => ({
      key: tab.tabKey,
      label:
        tab.disabled && tab.reason ? (
          <Tooltip title={tab.reason}>
            <span
              data-testid={catalogItemTabTestId(tab.tabKey)}
              data-active={activeTab === tab.tabKey ? 'true' : 'false'}
            >
              {catalogViewTabLabel(tab.tabKey)}
            </span>
          </Tooltip>
        ) : (
          <span
            data-testid={catalogItemTabTestId(tab.tabKey)}
            data-active={activeTab === tab.tabKey ? 'true' : 'false'}
          >
            {catalogViewTabLabel(tab.tabKey)}
          </span>
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
                label: (
                  <AdminDetailActionLabel testIdValue={catalogTestIds.control.statusEnable}>
                    启用
                  </AdminDetailActionLabel>
                ),
                onClick: () => confirmStatusChange('ENABLED'),
              }
            : null,
          action?.canDisable
            ? {
                key: 'disable',
                label: (
                  <AdminDetailActionLabel testIdValue={catalogTestIds.control.statusDisable}>
                    停用
                  </AdminDetailActionLabel>
                ),
                onClick: () => confirmStatusChange('DISABLED'),
              }
            : null,
          action?.voidAvailability?.canVoid
            ? {
                key: 'void',
                danger: true,
                label: (
                  <AdminDetailActionLabel testIdValue={catalogTestIds.static.itemVoid}>
                    <span {...testId(catalogTestIds.control.statusVoid)}>作废</span>
                  </AdminDetailActionLabel>
                ),
                onClick: markItemDeleted,
              }
            : null,
          {
            key: 'copy',
            label: (
              <AdminDetailActionLabel testIdValue={catalogTestIds.static.itemCopyLocalOpen}>
                从已有商品复制配置
              </AdminDetailActionLabel>
            ),
            onClick: () => onCopy?.({itemCode: detail.item.code, targetShapeKey: detail.item.shapeKey}),
          },
        ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      : [];
  const actionItems = detail
    ? [
        ...(canWriteCatalog && action?.canEdit && !sourceLocked && !isReferencedDetail
          ? [
              {
                key: 'edit',
                label: (
                  <AdminDetailActionLabel testIdValue={catalogTestIds.static.itemEdit}>编辑</AdminDetailActionLabel>
                ),
                onClick: onEdit,
              },
            ]
          : []),
        ...(isReferencedDetail
          ? [
              {
                key: 'return-current',
                label: (
                  <AdminDetailActionLabel testIdValue={catalogTestIdControls.view.returnCurrent}>
                    返回当前商品
                  </AdminDetailActionLabel>
                ),
                onClick: () => setViewedItemCode(itemCode),
              },
            ]
          : []),
        ...(canWriteCatalog && sourceLocked
          ? [
              {
                key: 'temporary-promotion',
                label: (
                  <AdminDetailActionLabel testIdValue={catalogTestIds.static.itemTemporaryPromotion}>
                    检查是否可以转为正式商品
                  </AdminDetailActionLabel>
                ),
                onClick: () => setPromotionOpen(true),
              },
            ]
          : []),
        ...moreActions,
      ]
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
        actionItems.length > 0 ? (
          <AdminDetailActionMenu items={actionItems} triggerTestId={catalogTestIdControls.view.action} />
        ) : undefined
      }
      afterOpenChange={onAfterOpenChange}
      maskClosable
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
              {
                key: 'name',
                label: '原始名称',
                children: displayFieldValue(detail.item.externalIdentity.snapshot?.name),
              },
              {key: 'price', label: '原始价格', children: money(detail.item.externalIdentity.snapshot?.price ?? null)},
            ]}
          />
        </Card>
      )}
      {detail && tabs && (
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} {...testId(catalogTestIds.static.itemTabs)} />
      )}
      {pendingStatus && detail && (
        <StatusChangeConfirm
          open
          title={`${pendingStatusLabel}商品？`}
          actionLabel={pendingStatusLabel}
          dangerous={pendingStatus === 'VOIDED'}
          submitting={statusSubmitting}
          onCancel={() => setPendingStatus(undefined)}
          onConfirm={() => void changeStatus(pendingStatus)}
          confirmTestId={catalogTestIds.control.lifecycleConfirmYes}
          cancelTestId={catalogTestIds.control.lifecycleConfirmNo}
          modalTestId={catalogTestIds.surface.lifecycleConfirm}
        >
          {pendingStatus === 'VOIDED'
            ? '商品会保留历史记录并作废；如需新建商品，请返回商品列表重新创建。'
            : `将把商品“${detail.item.name}”的状态改为“${pendingStatusLabel}”，不会清空商品信息。`}
        </StatusChangeConfirm>
      )}
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
