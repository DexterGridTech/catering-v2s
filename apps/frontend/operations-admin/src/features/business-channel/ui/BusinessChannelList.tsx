import {Alert, Button, Card, Tag} from 'antd';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {
  adminListState,
  testId,
  useAsyncGenerationGuard,
  useRefreshVersion,
  type RefreshSignal,
} from '@catering-v2s/admin-ui-foundation';
import type {
  BusinessChannelSortKey,
  BusinessChannelView,
  SortDirection,
} from '../../../app/api/generated/operations-edge';
import type {OperationsPageContext} from '../../../app/routing/model';
import {operationsContentTabRefreshSignal, operationsProblemOf} from '../../../app/api/OperationsTransport';
import {useEffect, useMemo, useState} from 'react';
import {readProjectBusinessChannels, readStoreBusinessChannels} from '../application/queries';

type ProSortOrder = 'ascend' | 'descend';

function proSortOrder(direction: SortDirection | undefined): ProSortOrder | undefined {
  return direction === 'ASC' ? 'ascend' : direction === 'DESC' ? 'descend' : undefined;
}

function readChannelSort(nextSorter: unknown): {sortKey?: BusinessChannelSortKey; sortDirection?: SortDirection} {
  const candidate = Array.isArray(nextSorter) ? nextSorter[0] : nextSorter;
  if (!candidate || typeof candidate !== 'object') return {};
  const key = 'columnKey' in candidate && typeof candidate.columnKey === 'string' ? candidate.columnKey : undefined;
  const order =
    'order' in candidate && (candidate.order === 'ascend' || candidate.order === 'descend')
      ? candidate.order
      : undefined;
  const sortKeys: Record<string, BusinessChannelSortKey> = {
    channelName: 'CHANNEL_NAME',
    channelCode: 'CHANNEL_CODE',
    templateName: 'TEMPLATE_NAME',
    status: 'STATUS',
    bindingStatus: 'BINDING_STATUS',
  };
  if (!key || !order || !sortKeys[key]) return {};
  return {sortKey: sortKeys[key], sortDirection: order === 'ascend' ? 'ASC' : 'DESC'};
}

export function BusinessChannelList({
  queryContext,
  ownerNodeType,
  ownerNodeRef,
  sectionTitle,
  templateNames,
  onOpenDetail,
  onCreate,
  refreshSignal,
}: {
  queryContext: OperationsPageContext;
  ownerNodeType: 'PROJECT' | 'STORE';
  ownerNodeRef: string;
  sectionTitle?: string;
  templateNames?: ReadonlyMap<string, string>;
  onOpenDetail: (channel: BusinessChannelView) => void;
  onCreate: () => void;
  refreshSignal: RefreshSignal;
}) {
  const [items, setItems] = useState<BusinessChannelView[]>([]);
  const [queryProblem, setQueryProblem] = useState<string>();
  const [sort, setSort] = useState<{sortKey?: BusinessChannelSortKey; sortDirection?: SortDirection}>({});
  const [loading, setLoading] = useState(false);
  const refreshVersion = useRefreshVersion(refreshSignal);
  const contentTabRefreshVersion = useRefreshVersion(operationsContentTabRefreshSignal);
  const generation = useAsyncGenerationGuard();
  const readQueryContext = useMemo(
    () => ({
      groupWorkspaceKey: queryContext.groupWorkspaceKey,
      expectedContextVersion: queryContext.expectedContextVersion,
      identityKey: queryContext.identityKey,
    }),
    [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, queryContext.identityKey],
  );
  useEffect(() => {
    const requestGeneration = generation.begin();
    setLoading(true);
    setQueryProblem(undefined);
    const read =
      ownerNodeType === 'PROJECT'
        ? readProjectBusinessChannels(readQueryContext, ownerNodeRef, sort)
        : readStoreBusinessChannels(readQueryContext, ownerNodeRef, sort);
    void read
      .then(result => {
        if (generation.isCurrent(requestGeneration)) setItems(result.items);
      })
      .catch(error => {
        if (generation.isCurrent(requestGeneration)) setQueryProblem(operationsProblemOf(error).detail);
      })
      .finally(() => {
        if (generation.isCurrent(requestGeneration)) setLoading(false);
      });
  }, [contentTabRefreshVersion, generation, ownerNodeRef, ownerNodeType, readQueryContext, refreshVersion, sort]);

  const listKey = ownerNodeType.toLocaleLowerCase();
  const listTitle = sectionTitle ?? '经营渠道';
  const columns = useMemo<ProColumns<BusinessChannelView>[]>(
    () => [
      {
        title: '渠道名称',
        dataIndex: 'channelName',
        key: 'channelName',
        sorter: true,
        sortOrder: sort.sortKey === 'CHANNEL_NAME' ? proSortOrder(sort.sortDirection) : undefined,
        render: (_value: unknown, row: BusinessChannelView) => (
          <Button
            type="link"
            onClick={() => onOpenDetail(row)}
            aria-label={`查看${row.channelName}详情`}
            {...testId(`${listKey}-business-channel-open-detail-${row.channelRef}`)}
          >
            {row.channelName}
          </Button>
        ),
      },
      {
        title: '渠道编码',
        dataIndex: 'channelCode',
        key: 'channelCode',
        sorter: true,
        sortOrder: sort.sortKey === 'CHANNEL_CODE' ? proSortOrder(sort.sortDirection) : undefined,
        render: (_value: unknown, row: BusinessChannelView) => row.channelCode || '—',
      },
      {
        title: '来源模板',
        dataIndex: 'templateRef',
        key: 'templateName',
        sorter: true,
        sortOrder: sort.sortKey === 'TEMPLATE_NAME' ? proSortOrder(sort.sortDirection) : undefined,
        render: (_value: unknown, row: BusinessChannelView) => templateNames?.get(row.templateRef) ?? '—',
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        sorter: true,
        sortOrder: sort.sortKey === 'STATUS' ? proSortOrder(sort.sortDirection) : undefined,
        render: (_value: unknown, row: BusinessChannelView) => <Tag>{row.statusDisplayName}</Tag>,
      },
      {
        title: '绑定状态',
        dataIndex: 'bindingStatus',
        key: 'bindingStatus',
        sorter: true,
        sortOrder: sort.sortKey === 'BINDING_STATUS' ? proSortOrder(sort.sortDirection) : undefined,
        render: (_value: unknown, row: BusinessChannelView) =>
          row.bindingStatus === 'NOT_REQUIRED' ? (
            '—'
          ) : (
            <Tag color={row.bindingStatus === 'BOUND' ? 'green' : 'default'}>{row.bindingStatusDisplayName || '—'}</Tag>
          ),
      },
    ],
    [listKey, onOpenDetail, sort.sortDirection, sort.sortKey, templateNames],
  );

  return (
    <section
      aria-labelledby={`${ownerNodeType.toLocaleLowerCase()}-business-channel-list-title`}
      {...testId(`${ownerNodeType.toLocaleLowerCase()}-business-channel-list`)}
    >
      <Card
        title={<span id={`${listKey}-business-channel-list-title`}>{listTitle}</span>}
        extra={
          <Button type="primary" onClick={onCreate} {...testId(`${listKey}-business-channel-create`)}>
            新建渠道
          </Button>
        }
      >
        {queryProblem && (
          <Alert
            type="error"
            showIcon
            title="经营渠道读取失败"
            description={queryProblem}
            action={
              <Button onClick={() => refreshSignal.publish()} {...testId(`${listKey}-business-channel-retry`)}>
                重试
              </Button>
            }
            style={{margin: 16, marginBottom: 0}}
          />
        )}
        <ProTable<BusinessChannelView>
          size="small"
          rowKey="channelRef"
          {...adminListState({
            loading,
            failed: Boolean(queryProblem),
            emptyText: '暂无经营渠道',
            testIdPrefix: `${listKey}-business-channel-list`,
          })}
          dataSource={items}
          search={false}
          options={false}
          toolBarRender={false}
          pagination={false}
          columns={columns}
          onChange={(_, __, nextSorter, extra) => {
            if (extra.action === 'sort') setSort(readChannelSort(nextSorter));
          }}
        />
      </Card>
    </section>
  );
}
