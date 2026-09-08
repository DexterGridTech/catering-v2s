import {Alert, Button, Card, Col, Descriptions, Drawer, Row, Space, Table, Tag, Typography, theme} from 'antd';
import {
  NameCodeText,
  adminDetailDescriptionsProps,
  adminDrawerSurfaceProps,
  testId,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {useMemo} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {
  type SalesMenuPublishedItemView,
  type SalesMenuSkuPrice,
  type Uuid,
} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import type {OperationsPageContext} from '../../../app/routing/model';
import {
  formatSalesMenuPrice,
  salesMenuInventoryAvailabilityLabel,
  salesMenuManualSaleStatusLabel,
  salesMenuProductShapeLabel,
} from '../model/salesMenuModel';
import {salesMenuTestIds} from '../salesMenuTestIds';
import {
  itemMediaLabel,
  saleContentLabel,
  salesMenuManualSaleStatusTagColor,
  salesMenuImageAssetRefs,
  type DraftOrPublishedItem,
} from './salesMenuUiShared';
import {SalesMenuItemImageGallery} from './SalesMenuItemImageGallery';

type PublishedTargetStatus = SalesMenuPublishedItemView['manualSaleTargetStatuses'][number];

function salesMenuPublishedTargetGroupLabel(item: DraftOrPublishedItem, target: PublishedTargetStatus): string {
  if (target.targetKind === 'SKU') return '销售规格';
  if (target.targetKind !== 'ORDER_OPTION_VALUE' || item.saleContent.kind !== 'DIRECT') return '销售选项';
  const option = item.saleContent.selectedOrderOptions.find(option =>
    option.values.some(value => value.definitionValueRef === target.targetRef),
  );
  return option ? `销售选项：${option.name}` : '销售选项';
}

export function SalesMenuItemDetailDrawer({
  item,
  open,
  queryContext,
  menuRef,
  channelRef,
  onClose,
  onAfterOpenChange,
}: {
  item?: DraftOrPublishedItem;
  open: boolean;
  queryContext: OperationsPageContext;
  menuRef?: Uuid;
  channelRef?: Uuid;
  onClose: () => void;
  onAfterOpenChange?: (visible: boolean) => void;
}) {
  const {token} = theme.useToken();
  const publishedRow = item && 'inventoryAvailability' in item ? item : undefined;
  const publishedDetailRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsSalesMenuPublishedItem(
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeRef: wireUuid(queryContext.scopeRef ?? ''),
          salesMenuRef: menuRef ?? ('' as Uuid),
          salesItemRef: publishedRow?.salesItemRef ?? ('' as Uuid),
        },
        {query: {channelRef: channelRef ?? ('' as Uuid)}},
      ),
    [channelRef, menuRef, publishedRow?.salesItemRef, queryContext.groupWorkspaceKey, queryContext.scopeRef],
  );
  const publishedDetailQuery = operationsRtk.useGetOperationsSalesMenuPublishedItemQuery(publishedDetailRequest, {
    skip: !open || !publishedRow || !queryContext.scopeRef || !menuRef || !channelRef,
  });
  // The published list is a paginated read model.  Detail must come from the
  // owner operation and must never reuse a previous row when the identity changes.
  const publishedDetail = useMemo(() => {
    if (publishedDetailQuery.isError) return undefined;
    const current = publishedDetailQuery.currentData;
    return current && publishedRow && current.salesItemRef === publishedRow.salesItemRef ? current : undefined;
  }, [publishedDetailQuery.currentData, publishedDetailQuery.isError, publishedRow]);
  const displayedItem = publishedRow ? publishedDetail : item;
  const published = Boolean(publishedRow);
  const imageAssetRefs = useMemo(() => (displayedItem ? salesMenuImageAssetRefs(displayedItem) : []), [displayedItem]);
  useOverlayLock(open);
  return (
    <Drawer
      open={open}
      title="销售项详情"
      onClose={onClose}
      afterOpenChange={onAfterOpenChange}
      maskClosable
      width="min(720px, calc(100vw - 48px))"
      {...adminDrawerSurfaceProps}
      {...testId(salesMenuTestIds.itemDetail)}
    >
      {publishedDetailQuery.isFetching && !displayedItem && <Typography.Text>正在读取前台销售项详情…</Typography.Text>}
      {publishedDetailQuery.error && (
        <Alert
          type="error"
          showIcon
          title="前台销售项详情暂时无法获取"
          description="请重试或稍后再试。"
          action={<Button onClick={() => void publishedDetailQuery.refetch()}>重试</Button>}
        />
      )}
      {displayedItem && (
        <Space direction="vertical" size={16} style={{display: 'flex'}}>
          <Card size="small" title="菜单商品">
            <Row gutter={[16, 16]} align="top">
              <Col xs={24} sm={8} style={{minWidth: 0}}>
                <SalesMenuItemImageGallery
                  itemRef={String(displayedItem.salesItemRef)}
                  displayName={displayedItem.displayName}
                  assetRefs={imageAssetRefs}
                  mediaLabel={itemMediaLabel(displayedItem)}
                />
              </Col>
              <Col xs={24} sm={16} style={{minWidth: 0}}>
                <Descriptions {...adminDetailDescriptionsProps}>
                  <Descriptions.Item label="菜单商品">
                    <NameCodeText name={displayedItem.displayName} code={displayedItem.itemCode} />
                  </Descriptions.Item>
                  <Descriptions.Item label="商品形态">
                    {salesMenuProductShapeLabel(displayedItem.productShape)}
                  </Descriptions.Item>
                  <Descriptions.Item label="销售内容">{saleContentLabel(displayedItem)}</Descriptions.Item>
                  <Descriptions.Item label="适用挂牌价">
                    {displayedItem.saleContent.kind === 'SKU_SELECTION'
                      ? '按规格分别设置'
                      : formatSalesMenuPrice(displayedItem.saleContent.listedPriceCents)}
                  </Descriptions.Item>
                  <Descriptions.Item label="适用约束">
                    {displayedItem.saleContent.kind === 'WEIGHTED'
                      ? '称重销售不显示按份约束'
                      : `起售量 ${displayedItem.orderingConstraints.minItemQuantity ?? '未设置'}；订购倍数 ${displayedItem.orderingConstraints.quantityStep ?? '未设置'}`}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
          </Card>
          {published && publishedDetail && (
            <Card size="small" title="可售状态">
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={12}>
                  <Space direction="vertical" size={4} style={{display: 'flex'}}>
                    <Typography.Text type="secondary">库存状态</Typography.Text>
                    <Tag
                      color={
                        publishedDetail.inventoryAvailability.applicability === 'NOT_APPLICABLE'
                          ? 'default'
                          : publishedDetail.inventoryAvailability.state === 'AVAILABLE'
                            ? 'success'
                            : 'warning'
                      }
                      style={{alignSelf: 'flex-start', marginInlineEnd: 0}}
                    >
                      {salesMenuInventoryAvailabilityLabel(publishedDetail.inventoryAvailability)}
                    </Tag>
                  </Space>
                </Col>
                <Col xs={24} sm={12}>
                  <Space direction="vertical" size={4} style={{display: 'flex'}}>
                    <Typography.Text type="secondary">销售项人工状态</Typography.Text>
                    <Tag
                      color={salesMenuManualSaleStatusTagColor(publishedDetail.manualSaleStatus.state)}
                      style={{alignSelf: 'flex-start', marginInlineEnd: 0}}
                    >
                      {salesMenuManualSaleStatusLabel(publishedDetail.manualSaleStatus)}
                    </Tag>
                  </Space>
                </Col>
              </Row>
              <Typography.Text type="secondary" style={{display: 'block', marginTop: 12}}>
                库存状态与销售项人工状态分别记录，互不覆盖。
              </Typography.Text>
              {publishedDetail.manualSaleTargetStatuses.length > 0 && (
                <Card size="small" title="规格与销售选项人工状态">
                  <Space direction="vertical" size={6} style={{display: 'flex'}}>
                    {publishedDetail.manualSaleTargetStatuses.map(status => (
                      <div
                        key={`${status.targetKind}-${status.targetRef}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          flexWrap: 'wrap',
                          padding: '8px 10px',
                          border: `1px solid ${token.colorBorderSecondary}`,
                          borderRadius: token.borderRadiusSM,
                        }}
                      >
                        <Space direction="vertical" size={1} style={{minWidth: 0}}>
                          <Typography.Text type="secondary">
                            {salesMenuPublishedTargetGroupLabel(displayedItem, status)}
                          </Typography.Text>
                          <Typography.Text style={{whiteSpace: 'normal'}}>
                            {status.resolvedTargetDisplayName}
                          </Typography.Text>
                        </Space>
                        <Tag color={salesMenuManualSaleStatusTagColor(status.state)} style={{marginInlineEnd: 0}}>
                          {status.state === 'MANUAL_SOLD_OUT' ? '已沽清' : '正常销售'}
                        </Tag>
                      </div>
                    ))}
                  </Space>
                </Card>
              )}
            </Card>
          )}
          {displayedItem.saleContent.kind === 'SKU_SELECTION' && (
            <Card size="small" title="规格与挂牌价">
              {displayedItem.saleContent.skuPrices.length === 0 ? (
                <Typography.Text type="secondary">未选择规格。</Typography.Text>
              ) : (
                <Table<SalesMenuSkuPrice>
                  size="small"
                  rowKey="skuRef"
                  pagination={false}
                  scroll={{x: 560}}
                  dataSource={displayedItem.saleContent.skuPrices}
                  columns={[
                    {
                      title: '规格',
                      dataIndex: 'skuName',
                      key: 'skuName',
                      render: value => <Typography.Text style={{whiteSpace: 'normal'}}>{value}</Typography.Text>,
                    },
                    {
                      title: '规格编码',
                      dataIndex: 'skuCode',
                      key: 'skuCode',
                      render: value => <Typography.Text style={{whiteSpace: 'normal'}}>{value}</Typography.Text>,
                    },
                    {
                      title: '商品默认价',
                      key: 'standardPrice',
                      render: (_, row) => formatSalesMenuPrice(row.standardPriceCents),
                    },
                    {
                      title: '菜单挂牌价',
                      key: 'listedPrice',
                      render: (_, row) => formatSalesMenuPrice(row.listedPriceCents),
                    },
                  ]}
                />
              )}
            </Card>
          )}
          {displayedItem.saleContent.kind === 'DIRECT' && (
            <Card size="small" title="已配置销售选项">
              {displayedItem.saleContent.selectedOrderOptions.length === 0 ? (
                <Typography.Text type="secondary">未配置销售选项。</Typography.Text>
              ) : (
                <Space direction="vertical" size={8} style={{display: 'flex'}}>
                  {displayedItem.saleContent.selectedOrderOptions.map(option => (
                    <Descriptions key={option.definitionRef} {...adminDetailDescriptionsProps}>
                      <Descriptions.Item label={option.name}>
                        {option.values.length === 0 ? (
                          '未配置选项值'
                        ) : (
                          <Space wrap size={[8, 8]}>
                            {option.values.map(value => {
                              const extraPrice =
                                value.extraPrice !== null && value.extraPrice !== 0
                                  ? `（加价 ${formatSalesMenuPrice(value.extraPrice)}）`
                                  : '';
                              return <Tag key={value.definitionValueRef}>{`${value.name}${extraPrice}`}</Tag>;
                            })}
                          </Space>
                        )}
                      </Descriptions.Item>
                    </Descriptions>
                  ))}
                </Space>
              )}
            </Card>
          )}
          {displayedItem.saleContent.kind === 'WEIGHTED' && (
            <Card size="small" title="销售单位">
              <Descriptions {...adminDetailDescriptionsProps}>
                <Descriptions.Item label="单位">
                  <NameCodeText
                    name={displayedItem.saleContent.salesUnit.name}
                    code={displayedItem.saleContent.salesUnit.code}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="精度">{displayedItem.saleContent.salesUnit.precision}</Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </Space>
      )}
    </Drawer>
  );
}
