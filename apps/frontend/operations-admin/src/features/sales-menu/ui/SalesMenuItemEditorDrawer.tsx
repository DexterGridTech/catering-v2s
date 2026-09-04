import {DeleteOutlined} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Drawer,
  Input,
  InputNumber,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  NameCodeText,
  adminWideDrawerSurfaceProps,
  testId,
  useDrawerFormLifecycle,
} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  OPERATIONS_ADMIN_OPERATION_IDS,
  type SalesMenuDisplayMedia,
  type SalesMenuDraftItemView,
  type SalesMenuOrderingConstraints,
  type SalesMenuSkuPrice,
  type Uuid,
} from '../../../app/api/generated/operations-edge';
import {operationsLogger, operationsRtk} from '../../../app/api/OperationsTransport';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {wireUuid} from '../../../app/api/wireUuid';
import type {OperationsPageContext} from '../../../app/routing/model';
import {formatSalesMenuPrice, salesMenuProductShapeLabel} from '../model/salesMenuModel';
import {salesMenuTestIds} from '../salesMenuTestIds';
import {SalesMenuMediaEditor} from './SalesMenuItemMediaEditor';
import {commandErrorMessage, type SalesMenuCommands} from './salesMenuUiShared';

export function SalesMenuItemEditorDrawer({
  item: rowItem,
  open,
  queryContext,
  menuRef,
  menuVersion,
  commands,
  onSave,
  onClose,
  onSaved,
  onDelete,
  onClosedFocus,
}: {
  item?: SalesMenuDraftItemView;
  open: boolean;
  queryContext: OperationsPageContext;
  menuRef?: Uuid;
  menuVersion?: number;
  commands: SalesMenuCommands;
  onSave: (
    item: SalesMenuDraftItemView,
    body: Parameters<SalesMenuCommands['updateItem']>[1],
    grants: Record<string, string>,
  ) => Promise<boolean>;
  onClose: () => void;
  onSaved: () => void;
  onDelete: (item: SalesMenuDraftItemView, beforeDelete?: () => Promise<boolean>) => void;
  onClosedFocus: () => void;
}) {
  const detailRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsSalesMenuDraftItem(
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeRef: wireUuid(queryContext.scopeRef ?? ''),
          salesMenuRef: menuRef ?? ('' as Uuid),
          salesItemRef: rowItem?.salesItemRef ?? ('' as Uuid),
        },
        {},
      ),
    [menuRef, queryContext.groupWorkspaceKey, queryContext.scopeRef, rowItem?.salesItemRef],
  );
  const detailQuery = operationsRtk.useGetOperationsSalesMenuDraftItemQuery(detailRequest, {
    skip: !open || !rowItem || !queryContext.scopeRef || !menuRef,
  });
  // A drawer is opened from a paginated row, but the editor must hydrate from the
  // owner detail operation.  Never reuse a previous item's detail while identity changes
  // or while the current owner readback is still in flight.
  const detail = useMemo(() => {
    if (detailQuery.isError || detailQuery.isFetching) return undefined;
    const current = detailQuery.currentData;
    return current && rowItem && current.salesItemRef === rowItem.salesItemRef ? current : undefined;
  }, [detailQuery.currentData, detailQuery.isError, detailQuery.isFetching, rowItem]);
  const item = detail ?? rowItem;
  const [displayName, setDisplayName] = useState('');
  const [listedPriceCents, setListedPriceCents] = useState<number | null>(null);
  const [skuPrices, setSkuPrices] = useState<SalesMenuSkuPrice[]>([]);
  const [constraints, setConstraints] = useState<SalesMenuOrderingConstraints>({
    minItemQuantity: null,
    quantityStep: null,
  });
  const [displayMedia, setDisplayMedia] = useState<SalesMenuDisplayMedia>({
    mode: 'INHERIT_CATALOG',
    assetRefs: [],
    primaryAssetRef: null,
  });
  const [assetBindGrants, setAssetBindGrants] = useState<Record<string, string>>({});
  const [mediaPending, setMediaPending] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const stagedReleaseRef = useRef<() => Promise<boolean>>(() => Promise.resolve(true));
  const closingAfterSaveRef = useRef(false);
  const closeInFlightRef = useRef(false);
  const openedRef = useRef(false);
  const lifecycleRef = useRef<{
    reset: () => void;
    setDirty: (dirty: boolean) => void;
  } | null>(null);
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: nextOpen => {
      if (nextOpen) return;
      if (closingAfterSaveRef.current) {
        closingAfterSaveRef.current = false;
        onClose();
        return;
      }
      if (closeInFlightRef.current) return;
      closeInFlightRef.current = true;
      setClosing(true);
      lifecycle.setSubmitting(true);
      void stagedReleaseRef
        .current()
        .then(released => {
          if (released) {
            onClose();
            return;
          }
          lifecycleRef.current?.reset();
          lifecycleRef.current?.setDirty(true);
        })
        .finally(() => {
          lifecycle.setSubmitting(false);
          closeInFlightRef.current = false;
          setClosing(false);
        });
    },
    dirtyMessage: '已填写的内容不会保存。',
    dirtyGuardTestIds: {
      confirm: testId(salesMenuTestIds.itemDiscardConfirm),
      cancel: testId(salesMenuTestIds.itemDiscardCancel),
    },
    onSuccessClosed: onSaved,
    diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsSalesMenuItem,
    idempotencyKey: true,
  });
  lifecycleRef.current = lifecycle;
  const resetLifecycle = lifecycle.reset;

  useEffect(() => {
    if (!detail || !open) return;
    if (lifecycle.dirty) {
      operationsLogger.info({
        event: 'sales-menu.item.editor',
        phase: 'DRAFT_HYDRATION',
        outcome: 'SKIPPED_DIRTY_DRAFT',
        operationId: OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsSalesMenuItem,
        diagnostic: {
          itemVersion: detail.version,
          menuVersion: menuVersion ?? null,
          draftState: 'DIRTY',
        },
      });
      return;
    }
    operationsLogger.info({
      event: 'sales-menu.item.editor',
      phase: 'EDITOR',
      outcome: 'OPENED',
      operationId: OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsSalesMenuItem,
      diagnostic: {
        itemVersion: detail.version,
        menuVersion: menuVersion ?? null,
        expectedVersionSource: 'SALES_MENU_DETAIL',
      },
    });
    openedRef.current = true;
    setDisplayName(detail.displayName);
    setListedPriceCents(detail.saleContent.listedPriceCents);
    setSkuPrices(detail.saleContent.skuPrices);
    setConstraints(detail.orderingConstraints);
    setDisplayMedia(detail.displayMedia);
    setAssetBindGrants({});
    setMediaPending(false);
    setProblem(undefined);
    setClosing(false);
    closeInFlightRef.current = false;
    closingAfterSaveRef.current = false;
    resetLifecycle();
  }, [detail, lifecycle, menuVersion, open, resetLifecycle]);

  const markDirty = useCallback(() => {
    lifecycle.setDirty(true);
    lifecycle.markBusinessIntentChanged();
  }, [lifecycle]);

  const handleMediaPendingChange = useCallback(
    (pending: boolean) => {
      setMediaPending(pending);
      lifecycle.setSubmitting(pending);
      if (pending) markDirty();
    },
    [lifecycle, markDirty],
  );

  const handleAfterOpenChange = useCallback(
    (visible: boolean) => {
      lifecycle.afterOpenChange(visible);
      if (!visible && openedRef.current) {
        openedRef.current = false;
        window.requestAnimationFrame(onClosedFocus);
      }
    },
    [lifecycle, onClosedFocus],
  );

  const registerStagedRelease = useCallback((release?: () => Promise<boolean>) => {
    stagedReleaseRef.current = release ?? (() => Promise.resolve(true));
  }, []);

  const save = useCallback(async () => {
    if (!item || !menuRef || menuVersion === undefined || mediaPending) return;
    setProblem(undefined);
    setSaving(true);
    lifecycle.setSubmitting(true);
    const isSku = item.saleContent.kind === 'SKU_SELECTION';
    operationsLogger.info({
      event: 'sales-menu.item.editor',
      phase: 'COMMAND_INPUT',
      outcome: 'VERSION_BOUND',
      operationId: OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsSalesMenuItem,
      diagnostic: {
        itemVersion: item.version,
        menuVersion,
        expectedVersion: menuVersion,
        expectedVersionSource: 'SALES_MENU_DETAIL',
      },
    });
    try {
      const saved = await onSave(
        item,
        {
          displayNameOverride: displayName.trim() ? displayName.trim() : null,
          saleContent: {
            kind: item.saleContent.kind,
            listedPriceCents: isSku ? null : listedPriceCents,
            skuPrices: isSku ? skuPrices : [],
          },
          orderingConstraints:
            item.saleContent.kind === 'WEIGHTED' ? {minItemQuantity: null, quantityStep: null} : constraints,
          displayMedia,
          expectedVersion: menuVersion,
        },
        assetBindGrants,
      );
      if (!saved) {
        lifecycle.setSubmitting(false);
        return;
      }
      closingAfterSaveRef.current = true;
      lifecycle.closeAfterSuccess();
    } catch (error) {
      setProblem(commandErrorMessage(error, '销售项保存失败，请检查后重试。'));
      lifecycle.setSubmitting(false);
    } finally {
      setSaving(false);
    }
  }, [
    assetBindGrants,
    constraints,
    displayMedia,
    displayName,
    item,
    lifecycle,
    listedPriceCents,
    mediaPending,
    menuRef,
    menuVersion,
    onSave,
    skuPrices,
  ]);

  if (!item) return null;
  const isSku = item.saleContent.kind === 'SKU_SELECTION';
  const isWeighted = item.saleContent.kind === 'WEIGHTED';
  return (
    <Drawer
      open={open}
      title={
        <Space>
          <span>编辑销售项</span>
          <Tag>{salesMenuProductShapeLabel(item.productShape)}</Tag>
        </Space>
      }
      closable={false}
      onClose={lifecycle.requestClose}
      afterOpenChange={handleAfterOpenChange}
      maskClosable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      extra={
        <Space>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => detail && onDelete(detail, stagedReleaseRef.current)}
            disabled={!detail || saving || closing}
            {...testId(salesMenuTestIds.itemDelete)}
          >
            删除销售项
          </Button>
          <Button onClick={lifecycle.requestClose} disabled={saving || closing} {...testId(salesMenuTestIds.itemClose)}>
            关闭
          </Button>
        </Space>
      }
      footer={
        <Space>
          <Button onClick={lifecycle.requestClose} disabled={saving || closing}>
            取消
          </Button>
          <Button
            type="primary"
            onClick={() => void save()}
            loading={saving}
            disabled={!detail || mediaPending || closing}
            {...testId(salesMenuTestIds.itemSave)}
          >
            保存
          </Button>
        </Space>
      }
      {...testId(salesMenuTestIds.itemEditor)}
      {...adminWideDrawerSurfaceProps}
    >
      {!detail ? (
        detailQuery.error ? (
          <Alert type="error" showIcon title="销售项详情暂时无法获取" description="请关闭后重试。" />
        ) : (
          <Space direction="vertical" align="center" style={{display: 'flex', padding: '32px 0'}}>
            <Spin />
            <Typography.Text type="secondary">正在读取销售项详情…</Typography.Text>
          </Space>
        )
      ) : (
        <Space direction="vertical" size={16} style={{display: 'flex'}}>
          {problem && <Alert type="error" showIcon title={problem} />}
          <Card size="small" title="菜单展示名称">
            <Input
              value={displayName}
              placeholder="留空则沿用商品名称"
              onChange={event => {
                setDisplayName(event.target.value);
                markDirty();
              }}
              {...testId(salesMenuTestIds.itemDisplayName)}
            />
          </Card>
          <Card size="small" title="销售内容与挂牌价">
            <Space direction="vertical" size={12} style={{display: 'flex'}}>
              <Typography.Text type="secondary">
                {item.saleContent.kind === 'SKU_SELECTION'
                  ? '按规格销售；每个规格分别维护菜单挂牌价。'
                  : item.saleContent.kind === 'WEIGHTED'
                    ? '按称重数量销售；销售单位来自商品结构化事实。'
                    : item.saleContent.kind === 'COMPOSITE'
                      ? '当前按套餐整体销售。'
                      : '该商品无规格，直接销售该商品。'}
              </Typography.Text>
              {isSku ? (
                <Table<SalesMenuSkuPrice>
                  size="small"
                  rowKey="skuRef"
                  pagination={false}
                  dataSource={skuPrices}
                  columns={[
                    {title: '规格', dataIndex: 'skuName', key: 'skuName'},
                    {title: '规格编码', dataIndex: 'skuCode', key: 'skuCode'},
                    {
                      title: '商品默认价',
                      key: 'standardPrice',
                      render: (_, row) => formatSalesMenuPrice(row.standardPriceCents),
                    },
                    {
                      title: '菜单挂牌价',
                      key: 'listedPrice',
                      render: (_, row) => (
                        <InputNumber
                          min={0}
                          precision={2}
                          value={row.listedPriceCents / 100}
                          addonBefore="¥"
                          onChange={value => {
                            const nextCents = value === null || value === undefined ? 0 : Math.round(value * 100);
                            setSkuPrices(current =>
                              current.map(price =>
                                price.skuRef === row.skuRef ? {...price, listedPriceCents: nextCents} : price,
                              ),
                            );
                            markDirty();
                          }}
                        />
                      ),
                    },
                  ]}
                />
              ) : (
                <Space direction="vertical" size={4} style={{display: 'flex'}}>
                  <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="商品默认价">
                      {formatSalesMenuPrice(item.defaultPriceCents)}
                    </Descriptions.Item>
                  </Descriptions>
                  <Typography.Text strong>挂牌价</Typography.Text>
                  <InputNumber
                    min={0}
                    precision={2}
                    addonBefore="¥"
                    value={listedPriceCents === null ? undefined : listedPriceCents / 100}
                    onChange={value => {
                      setListedPriceCents(value === null || value === undefined ? null : Math.round(value * 100));
                      markDirty();
                    }}
                    {...testId(salesMenuTestIds.itemListedPrice)}
                  />
                  {isWeighted && (
                    <Descriptions bordered size="small" column={1}>
                      <Descriptions.Item label="销售单位">
                        <NameCodeText name={item.saleContent.salesUnit.name} code={item.saleContent.salesUnit.code} />
                      </Descriptions.Item>
                      <Descriptions.Item label="精度">{item.saleContent.salesUnit.precision}</Descriptions.Item>
                    </Descriptions>
                  )}
                </Space>
              )}
            </Space>
          </Card>
          <Card size="small" title="适用约束">
            {isWeighted ? (
              <Typography.Text type="secondary">称重销售商品不显示按份定义的起售量与订购倍数。</Typography.Text>
            ) : (
              <Space>
                <label>
                  起售量
                  <InputNumber
                    min={1}
                    value={constraints.minItemQuantity ?? undefined}
                    onChange={value => {
                      setConstraints(current => ({...current, minItemQuantity: value ?? null}));
                      markDirty();
                    }}
                  />
                </label>
                <label>
                  订购倍数
                  <InputNumber
                    min={1}
                    value={constraints.quantityStep ?? undefined}
                    onChange={value => {
                      setConstraints(current => ({...current, quantityStep: value ?? null}));
                      markDirty();
                    }}
                  />
                </label>
              </Space>
            )}
          </Card>
          <Divider />
          <Card size="small" title="展示图片">
            <SalesMenuMediaEditor
              item={item}
              menuRef={menuRef as Uuid}
              open={open}
              media={displayMedia}
              queryContext={queryContext}
              commands={commands}
              onChange={(next, grants) => {
                setDisplayMedia(next);
                setAssetBindGrants(grants);
                markDirty();
              }}
              onPendingChange={handleMediaPendingChange}
              onRegisterRelease={registerStagedRelease}
            />
          </Card>
        </Space>
      )}
    </Drawer>
  );
}
