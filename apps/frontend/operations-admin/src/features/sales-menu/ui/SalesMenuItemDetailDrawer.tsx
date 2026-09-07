import {Alert, Button, Card, Col, Descriptions, Drawer, Row, Space, Table, Typography} from 'antd';
import {NameCodeText, adminDrawerSurfaceProps, testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useMemo} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {type SalesMenuSkuPrice, type Uuid} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import type {OperationsPageContext} from '../../../app/routing/model';
import {
  formatSalesMenuPrice,
  salesMenuInventoryAvailabilityLabel,
  salesMenuManualSaleStatusLabel,
  salesMenuProductShapeLabel,
} from '../model/salesMenuModel';
import {salesMenuTestIds} from '../salesMenuTestIds';
import {itemMediaLabel, saleContentLabel, type DraftOrPublishedItem} from './salesMenuUiShared';

function manualTargetKindLabel(kind: 'ITEM' | 'SKU' | 'ORDER_OPTION_VALUE'): string {
  return kind === 'SKU' ? '规格' : kind === 'ORDER_OPTION_VALUE' ? '销售选项' : '整个销售项';
}

export function SalesMenuItemDetailDrawer({
  item,
  open,
  queryContext,
  menuRef,
  channelRef,
  onClose,
}: {
  item?: DraftOrPublishedItem;
  open: boolean;
  queryContext: OperationsPageContext;
  menuRef?: Uuid;
  channelRef?: Uuid;
  onClose: () => void;
}) {
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
  useOverlayLock(open);
  return (
    <Drawer
      open={open}
      title="销售项详情"
      onClose={onClose}
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
          <Descriptions bordered size="small" column={1}>
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
            <Descriptions.Item label="展示图片">{itemMediaLabel(displayedItem)}</Descriptions.Item>
          </Descriptions>
          {displayedItem.saleContent.kind === 'SKU_SELECTION' && (
            <Card size="small" title="规格与挂牌价">
              {displayedItem.saleContent.skuPrices.length === 0 ? (
                <Typography.Text type="secondary">未选择规格。</Typography.Text>
              ) : (
                <Table<SalesMenuSkuPrice>
                  size="small"
                  rowKey="skuRef"
                  pagination={false}
                  dataSource={displayedItem.saleContent.skuPrices}
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
                    <Descriptions key={option.definitionRef} bordered size="small" column={1}>
                      <Descriptions.Item label={option.name}>
                        {option.values.length === 0
                          ? '未配置选项值'
                          : option.values
                              .map(value => {
                                const extraPrice = value.extraPrice !== null && value.extraPrice !== 0
                                  ? `（加价 ${formatSalesMenuPrice(value.extraPrice)}）`
                                  : '';
                                return `${value.name}${extraPrice}`;
                              })
                              .join('、')}
                      </Descriptions.Item>
                    </Descriptions>
                  ))}
                </Space>
              )}
            </Card>
          )}
          {displayedItem.saleContent.kind === 'WEIGHTED' && (
            <Card size="small" title="销售单位">
              <Descriptions bordered size="small" column={1}>
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
          {published && publishedDetail && (
            <Space direction="vertical" size={12} style={{display: 'flex'}}>
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <Card size="small" title="库存状态">
                    {salesMenuInventoryAvailabilityLabel(publishedDetail.inventoryAvailability)}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="销售项人工状态">
                    {salesMenuManualSaleStatusLabel(publishedDetail.manualSaleStatus)}
                  </Card>
                </Col>
              </Row>
              {publishedDetail.manualSaleTargetStatuses.length > 0 && (
                <Card size="small" title="规格与销售选项人工状态">
                  <Descriptions bordered size="small" column={1}>
                    {publishedDetail.manualSaleTargetStatuses.map(status => (
                      <Descriptions.Item
                        key={`${status.targetKind}-${status.targetRef}`}
                        label={`${manualTargetKindLabel(status.targetKind)}：${status.resolvedTargetDisplayName}`}
                      >
                        {status.state === 'MANUAL_SOLD_OUT' ? '已沽清' : '正常销售'}
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                </Card>
              )}
            </Space>
          )}
        </Space>
      )}
    </Drawer>
  );
}
