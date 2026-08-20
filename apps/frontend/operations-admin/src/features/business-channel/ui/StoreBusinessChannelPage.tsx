import {Alert, Button, Card, Space} from 'antd';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {
  adminListState,
  createRefreshSignal,
  testId,
  useAsyncGenerationGuard,
  useRefreshVersion,
} from '@catering-v2s/admin-ui-foundation';
import type {
  BusinessChannelTemplateSortKey,
  BusinessChannelTemplateView,
  BusinessChannelView,
  SortDirection,
} from '../../../app/api/generated/operations-edge';
import type {OperationsPageProps} from '../../../app/routing/model';
import {requireOperationsScopeRef} from '../../../app/routing/model';
import {useEffect, useMemo, useState} from 'react';
import {
  operationsClient,
  operationsContentTabRefreshSignal,
  operationsProblemOf,
} from '../../../app/api/OperationsTransport';
import {readStoreBusinessChannelTemplateCandidates} from '../application/queries';
import {BusinessChannelCreateDrawer} from './BusinessChannelCreateDrawer';
import {BusinessChannelDetailDrawer} from './BusinessChannelDetailDrawer';
import {BusinessChannelEditDrawer} from './BusinessChannelEditDrawer';
import {BusinessChannelList} from './BusinessChannelList';

type ProSortOrder = 'ascend' | 'descend';

function proSortOrder(direction: SortDirection | undefined): ProSortOrder | undefined {
  return direction === 'ASC' ? 'ascend' : direction === 'DESC' ? 'descend' : undefined;
}

function readTemplateSort(nextSorter: unknown): {
  sortKey?: BusinessChannelTemplateSortKey;
  sortDirection?: SortDirection;
} {
  const candidate = Array.isArray(nextSorter) ? nextSorter[0] : nextSorter;
  if (!candidate || typeof candidate !== 'object') return {};
  const key = 'columnKey' in candidate && typeof candidate.columnKey === 'string' ? candidate.columnKey : undefined;
  const order =
    'order' in candidate && (candidate.order === 'ascend' || candidate.order === 'descend')
      ? candidate.order
      : undefined;
  const sortKeys: Record<string, BusinessChannelTemplateSortKey> = {
    templateName: 'TEMPLATE_NAME',
    templateCode: 'TEMPLATE_CODE',
    accessKind: 'ACCESS_KIND',
    orderKind: 'ORDER_KIND',
  };
  if (!key || !order || !sortKeys[key]) return {};
  return {sortKey: sortKeys[key], sortDirection: order === 'ascend' ? 'ASC' : 'DESC'};
}

export function StoreBusinessChannelPage({queryContext}: OperationsPageProps) {
  const [templates, setTemplates] = useState<BusinessChannelTemplateView[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<BusinessChannelView>();
  const [editingChannel, setEditingChannel] = useState<BusinessChannelView>();
  const [createOpen, setCreateOpen] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [templateSort, setTemplateSort] = useState<{
    sortKey?: BusinessChannelTemplateSortKey;
    sortDirection?: SortDirection;
  }>({});
  const [loading, setLoading] = useState(false);
  const storeRef = queryContext.scopeRef;
  const scopeRef = storeRef ? requireOperationsScopeRef(queryContext) : undefined;
  const templateRefreshSignal = useMemo(() => createRefreshSignal(), []);
  const channelRefreshSignal = useMemo(() => createRefreshSignal(), []);
  const templateRefreshVersion = useRefreshVersion(templateRefreshSignal);
  const contentTabRefreshVersion = useRefreshVersion(operationsContentTabRefreshSignal);
  const generation = useAsyncGenerationGuard();
  const templateNameByRef = useMemo(
    () => new Map(templates.map(template => [template.templateRef, template.templateName] as const)),
    [templates],
  );
  const readQueryContext = useMemo(
    () => ({
      groupWorkspaceKey: queryContext.groupWorkspaceKey,
      expectedContextVersion: queryContext.expectedContextVersion,
      identityKey: queryContext.identityKey,
    }),
    [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, queryContext.identityKey],
  );
  useEffect(() => {
    if (!scopeRef) {
      generation.invalidate();
      return;
    }
    const requestGeneration = generation.begin();
    setLoading(true);
    setProblem(undefined);
    void operationsClient
      .getOperationsOrganizationStore(
        {groupWorkspaceKey: readQueryContext.groupWorkspaceKey, storeId: scopeRef},
        {query: {expectedContextVersion: readQueryContext.expectedContextVersion}},
      )
      .then(store =>
        readStoreBusinessChannelTemplateCandidates(readQueryContext, store.project.id, scopeRef, templateSort),
      )
      .then(result => {
        if (generation.isCurrent(requestGeneration)) setTemplates(result.items);
      })
      .catch(error => {
        if (generation.isCurrent(requestGeneration)) setProblem(operationsProblemOf(error).detail);
      })
      .finally(() => {
        if (generation.isCurrent(requestGeneration)) setLoading(false);
      });
  }, [contentTabRefreshVersion, generation, readQueryContext, scopeRef, templateRefreshVersion, templateSort]);

  const templateColumns = useMemo<ProColumns<BusinessChannelTemplateView>[]>(
    () => [
      {
        title: '模板名称',
        dataIndex: 'templateName',
        key: 'templateName',
        sorter: true,
        sortOrder: templateSort.sortKey === 'TEMPLATE_NAME' ? proSortOrder(templateSort.sortDirection) : undefined,
        render: (_value: unknown, row: BusinessChannelTemplateView) => row.templateName,
      },
      {
        title: '模板编码',
        dataIndex: 'templateCode',
        key: 'templateCode',
        sorter: true,
        sortOrder: templateSort.sortKey === 'TEMPLATE_CODE' ? proSortOrder(templateSort.sortDirection) : undefined,
        render: (_value: unknown, row: BusinessChannelTemplateView) => row.templateCode || '—',
      },
      {
        title: '接入类型',
        dataIndex: 'accessKind',
        key: 'accessKind',
        sorter: true,
        sortOrder: templateSort.sortKey === 'ACCESS_KIND' ? proSortOrder(templateSort.sortDirection) : undefined,
        render: (_value: unknown, row: BusinessChannelTemplateView) => row.accessKindDisplayName,
      },
      {
        title: '订单类型',
        dataIndex: 'orderKind',
        key: 'orderKind',
        sorter: true,
        sortOrder: templateSort.sortKey === 'ORDER_KIND' ? proSortOrder(templateSort.sortDirection) : undefined,
        render: (_value: unknown, row: BusinessChannelTemplateView) => row.orderKindDisplayName,
      },
    ],
    [templateSort.sortDirection, templateSort.sortKey],
  );

  if (!scopeRef)
    return <Alert type="info" showIcon title="请先选择门店数据节点。" {...testId('store-business-channel-page')} />;
  return (
    <div {...testId('store-business-channel-page')}>
      <Space direction="vertical" size={16} style={{display: 'flex'}}>
        {problem && (
          <Alert
            type="error"
            showIcon
            title="门店渠道模板读取失败"
            description={problem}
            action={
              <Button
                onClick={() => templateRefreshSignal.publish()}
                {...testId('store-business-channel-template-retry')}
              >
                重试
              </Button>
            }
          />
        )}
        <section
          aria-labelledby="store-business-channel-template-list-title"
          {...testId('store-business-channel-template-list')}
        >
          <Card title={<span id="store-business-channel-template-list-title">门店可接入经营渠道模板</span>}>
            <ProTable<BusinessChannelTemplateView>
              size="small"
              rowKey="templateRef"
              dataSource={templates}
              {...adminListState({
                loading,
                failed: Boolean(problem),
                emptyText: '暂无门店可接入经营渠道模板',
                testIdPrefix: 'store-business-channel-template-list',
              })}
              search={false}
              options={false}
              toolBarRender={false}
              pagination={false}
              columns={templateColumns}
              onChange={(_, __, nextSorter, extra) => {
                if (extra.action === 'sort') setTemplateSort(readTemplateSort(nextSorter));
              }}
            />
          </Card>
        </section>
        <BusinessChannelList
          queryContext={queryContext}
          ownerNodeType="STORE"
          ownerNodeRef={scopeRef}
          sectionTitle="门店主体经营渠道"
          templateNames={templateNameByRef}
          refreshSignal={channelRefreshSignal}
          onCreate={() => setCreateOpen(true)}
          onOpenDetail={channel => setSelectedChannel(channel)}
        />
      </Space>
      <BusinessChannelCreateDrawer
        open={createOpen}
        queryContext={queryContext}
        ownerNodeType="STORE"
        ownerNodeRef={scopeRef}
        templates={templates}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          setCreateOpen(false);
          channelRefreshSignal.publish();
        }}
      />
      <BusinessChannelDetailDrawer
        open={Boolean(selectedChannel)}
        queryContext={queryContext}
        selected={selectedChannel}
        onClose={() => setSelectedChannel(undefined)}
        onEdit={channel => {
          setEditingChannel(channel);
          setCreateOpen(false);
        }}
        onSaved={() => channelRefreshSignal.publish()}
      />
      <BusinessChannelEditDrawer
        open={Boolean(editingChannel)}
        queryContext={queryContext}
        channel={editingChannel}
        onClose={() => setEditingChannel(undefined)}
        onSaved={() => {
          setEditingChannel(undefined);
          channelRefreshSignal.publish();
        }}
      />
    </div>
  );
}
