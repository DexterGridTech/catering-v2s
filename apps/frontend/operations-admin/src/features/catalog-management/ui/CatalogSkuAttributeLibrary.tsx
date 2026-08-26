import {Button, Divider, Empty, Flex, Space, Splitter, Table, Typography} from 'antd';
import {CursorPagination, type CursorStackState, testId} from '@catering-v2s/admin-ui-foundation';
import type {HTMLAttributes, ReactNode} from 'react';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';

export type SkuAttributeLibraryRow = {
  entryRef: string;
  code: string;
  name: string;
  status: string;
};

/**
 * The fixed parent/child presentation for specification dimensions and values.
 * Selection, data fetching, lifecycle guards and commands are injected from the
 * configuration controller so this view cannot retain a stale child selection.
 */
export function CatalogSkuAttributeLibrary({
  attributes,
  selectedAttributeRef,
  selectedAttribute,
  attributeValues,
  canWrite,
  attributesLoading,
  attributeValuesLoading,
  onSelectAttribute,
  onCreateAttribute,
  onCreateValue,
  renderStatus,
  renderVoidReason,
  renderAttributeActions,
  renderValueActions,
  attributesPagination,
  attributeValuesPagination,
}: {
  attributes: SkuAttributeLibraryRow[];
  selectedAttributeRef?: string;
  selectedAttribute?: SkuAttributeLibraryRow;
  attributeValues: SkuAttributeLibraryRow[];
  canWrite: boolean;
  attributesLoading: boolean;
  attributeValuesLoading: boolean;
  onSelectAttribute: (entryRef: string) => void;
  onCreateAttribute: () => void;
  onCreateValue: () => void;
  renderStatus: (value: string) => ReactNode;
  renderVoidReason: (row: SkuAttributeLibraryRow) => ReactNode;
  renderAttributeActions: (row: SkuAttributeLibraryRow) => ReactNode;
  renderValueActions: (row: SkuAttributeLibraryRow) => ReactNode;
  attributesPagination: {state: CursorStackState; nextCursor?: string; testIdPrefix: string};
  attributeValuesPagination: {state: CursorStackState; nextCursor?: string; testIdPrefix: string};
}) {
  return (
    <Splitter style={{minHeight: 360}} {...testId(catalogTestIds.static.skuAttributeManager)}>
      <Splitter.Panel defaultSize="36%" min="280px" max="440px">
        <Flex vertical gap="middle" style={{paddingRight: 16}}>
          <Flex justify="space-between" align="center">
            <Typography.Text strong>规格维度</Typography.Text>
            {canWrite && attributes.length > 0 && (
              <Button type="primary" size="small" onClick={onCreateAttribute}>
                新建规格维度
              </Button>
            )}
          </Flex>
          <Table<SkuAttributeLibraryRow>
            size="small"
            rowKey="entryRef"
            rowSelection={{
              type: 'radio',
              selectedRowKeys: selectedAttributeRef ? [selectedAttributeRef] : [],
              onChange: selectedRowKeys => onSelectAttribute(String(selectedRowKeys[0] ?? '')),
            }}
            loading={attributesLoading}
            dataSource={attributes}
            pagination={false}
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有规格维度。">
                  {canWrite && (
                    <Button type="primary" onClick={onCreateAttribute}>
                      新建规格维度
                    </Button>
                  )}
                </Empty>
              ),
            }}
            columns={[
              {title: '名称', dataIndex: 'name'},
              {title: '编码', dataIndex: 'code'},
              {title: '状态', dataIndex: 'status', render: renderStatus},
            ]}
            onRow={row => ({
              onClick: () => onSelectAttribute(row.entryRef),
              style: {cursor: 'pointer'},
              ...testId(catalogTestIdControls.config.row('SKU_ATTRIBUTE', row.code)),
            })}
            {...testId(catalogTestIds.static.skuAttributesTable)}
          />
          <CursorPagination
            state={attributesPagination.state}
            nextCursor={attributesPagination.nextCursor}
            testIdPrefix={attributesPagination.testIdPrefix}
            style={{marginTop: 12}}
          />
        </Flex>
      </Splitter.Panel>
      <Splitter.Panel>
        <div style={{paddingLeft: 16}}>
          {!selectedAttribute ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择左侧规格维度，查看其可选值。" />
          ) : (
            <Flex vertical gap="middle">
              <Flex justify="space-between" align="start" gap="middle">
                <Flex vertical gap={4} style={{flex: '1 1 auto', minWidth: 0}}>
                  <Flex align="center" gap="small">
                    <Typography.Title level={5} style={{margin: 0}}>
                      {selectedAttribute.name}
                    </Typography.Title>
                    {renderStatus(selectedAttribute.status)}
                  </Flex>
                  <Typography.Text type="secondary">编码：{selectedAttribute.code}</Typography.Text>
                  {renderVoidReason(selectedAttribute)}
                </Flex>
                <Space wrap style={{flex: '0 0 auto', justifyContent: 'flex-end'}}>
                  {renderAttributeActions(selectedAttribute)}
                  {canWrite && attributeValues.length > 0 && (
                    <Button type="primary" onClick={onCreateValue}>
                      新增可选值
                    </Button>
                  )}
                </Space>
              </Flex>
              <Divider titlePlacement="start">可选值</Divider>
              <Table<SkuAttributeLibraryRow>
                size="small"
                rowKey="entryRef"
                loading={attributeValuesLoading}
                dataSource={attributeValues}
                pagination={false}
                locale={{
                  emptyText: (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这个规格维度还没有可选值。">
                      {canWrite && (
                        <Button type="primary" onClick={onCreateValue}>
                          新增可选值
                        </Button>
                      )}
                    </Empty>
                  ),
                }}
                columns={[
                  {title: '名称', dataIndex: 'name'},
                  {title: '编码', dataIndex: 'code'},
                  {title: '状态', dataIndex: 'status', render: renderStatus},
                  {
                    key: 'actions',
                    render: (_: unknown, row: SkuAttributeLibraryRow) => <Space>{renderValueActions(row)}</Space>,
                  },
                ]}
                onRow={row =>
                  testId(
                    catalogTestIdControls.config.valueRow('SKU_ATTRIBUTE', selectedAttribute.code, row.code),
                  ) as HTMLAttributes<HTMLTableRowElement>
                }
                {...testId(catalogTestIds.static.skuAttributeValuesTable)}
              />
              <CursorPagination
                state={attributeValuesPagination.state}
                nextCursor={attributeValuesPagination.nextCursor}
                testIdPrefix={attributeValuesPagination.testIdPrefix}
                style={{marginTop: 12}}
              />
            </Flex>
          )}
        </div>
      </Splitter.Panel>
    </Splitter>
  );
}
