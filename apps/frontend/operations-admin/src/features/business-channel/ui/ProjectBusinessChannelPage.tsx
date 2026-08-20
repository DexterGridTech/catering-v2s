import {Alert, Button, Card, Space, Tag} from 'antd';
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
import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  operationsClient,
  operationsContentTabRefreshSignal,
  operationsProblemOf,
} from '../../../app/api/OperationsTransport';
import {readBusinessChannelTemplates} from '../application/queries';
import {BusinessChannelCreateDrawer} from './BusinessChannelCreateDrawer';
import {BusinessChannelDetailDrawer} from './BusinessChannelDetailDrawer';
import {BusinessChannelEditDrawer} from './BusinessChannelEditDrawer';
import {BusinessChannelList} from './BusinessChannelList';
import {BusinessChannelTemplateDetailDrawer} from './BusinessChannelTemplateDetailDrawer';
import {BusinessChannelTemplateDrawer} from './BusinessChannelTemplateDrawer';

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
    operatorKind: 'OPERATOR_KIND',
    orderKind: 'ORDER_KIND',
    status: 'STATUS',
  };
  if (!key || !order || !sortKeys[key]) return {};
  return {sortKey: sortKeys[key], sortDirection: order === 'ascend' ? 'ASC' : 'DESC'};
}

export function ProjectBusinessChannelPage({queryContext}: OperationsPageProps) {
  const projectRef = queryContext.scopeRef;
  const [templates, setTemplates] = useState<BusinessChannelTemplateView[]>([]);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateDetailOpen, setTemplateDetailOpen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [channelEditOpen, setChannelEditOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<BusinessChannelTemplateView | undefined>();
  const [templateSort, setTemplateSort] = useState<{
    sortKey?: BusinessChannelTemplateSortKey;
    sortDirection?: SortDirection;
  }>({});
  const [selectedBusinessChannel, setSelectedBusinessChannel] = useState<BusinessChannelView>();
  const [editingBusinessChannel, setEditingBusinessChannel] = useState<BusinessChannelView>();
  const scopeRef = projectRef ? requireOperationsScopeRef(queryContext) : undefined;
  const templateRefreshSignal = useMemo(() => createRefreshSignal(), []);
  const channelRefreshSignal = useMemo(() => createRefreshSignal(), []);
  const templateRefreshVersion = useRefreshVersion(templateRefreshSignal);
  const contentTabRefreshVersion = useRefreshVersion(operationsContentTabRefreshSignal);
  const templateGeneration = useAsyncGenerationGuard();
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

  const refreshTemplates = useCallback(() => templateRefreshSignal.publish(), [templateRefreshSignal]);
  useEffect(() => {
    if (!scopeRef) {
      templateGeneration.invalidate();
      return;
    }
    const requestGeneration = templateGeneration.begin();
    setLoading(true);
    setProblem(undefined);
    void readBusinessChannelTemplates(readQueryContext, scopeRef, templateSort)
      .then(result => {
        if (templateGeneration.isCurrent(requestGeneration)) setTemplates(result.items);
      })
      .catch(error => {
        if (templateGeneration.isCurrent(requestGeneration)) setProblem(operationsProblemOf(error).detail);
      })
      .finally(() => {
        if (templateGeneration.isCurrent(requestGeneration)) setLoading(false);
      });
  }, [contentTabRefreshVersion, readQueryContext, scopeRef, templateGeneration, templateRefreshVersion, templateSort]);

  const templateColumns = useMemo<ProColumns<BusinessChannelTemplateView>[]>(
    () => [
      {
        title: '模板名称',
        dataIndex: 'templateName',
        key: 'templateName',
        sorter: true,
        sortOrder: templateSort.sortKey === 'TEMPLATE_NAME' ? proSortOrder(templateSort.sortDirection) : undefined,
        render: (_value: unknown, row: BusinessChannelTemplateView) => (
          <Button
            type="link"
            onClick={() => {
              setSelectedTemplate(row);
              setTemplateDetailOpen(true);
            }}
            {...testId(`project-business-channel-template-open-detail-${row.templateRef}`)}
          >
            {row.templateName}
          </Button>
        ),
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
        title: '经营主体',
        dataIndex: 'operatorKind',
        key: 'operatorKind',
        sorter: true,
        sortOrder: templateSort.sortKey === 'OPERATOR_KIND' ? proSortOrder(templateSort.sortDirection) : undefined,
        render: (_value: unknown, row: BusinessChannelTemplateView) => row.operatorKindDisplayName,
      },
      {
        title: '订单类型',
        dataIndex: 'orderKind',
        key: 'orderKind',
        sorter: true,
        sortOrder: templateSort.sortKey === 'ORDER_KIND' ? proSortOrder(templateSort.sortDirection) : undefined,
        render: (_value: unknown, row: BusinessChannelTemplateView) => row.orderKindDisplayName,
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        sorter: true,
        sortOrder: templateSort.sortKey === 'STATUS' ? proSortOrder(templateSort.sortDirection) : undefined,
        render: (_value: unknown, row: BusinessChannelTemplateView) => <Tag>{row.statusDisplayName}</Tag>,
      },
    ],
    [templateSort.sortDirection, templateSort.sortKey],
  );

  if (!scopeRef)
    return <Alert type="info" showIcon title="请先选择项目数据节点。" {...testId('project-business-channel-page')} />;
  return (
    <div {...testId('project-business-channel-page')}>
      <Space direction="vertical" size={16} style={{display: 'flex'}}>
        {problem && (
          <Alert
            type="error"
            showIcon
            title="渠道模板读取失败"
            description={problem}
            action={
              <Button onClick={refreshTemplates} {...testId('project-business-channel-template-retry')}>
                重试
              </Button>
            }
          />
        )}
        <section
          aria-labelledby="project-business-channel-template-list-title"
          {...testId('project-business-channel-template-list')}
        >
          <Card
            title={<span id="project-business-channel-template-list-title">经营渠道模板</span>}
            extra={
              <Button
                type="primary"
                onClick={() => {
                  setSelectedTemplate(undefined);
                  setTemplateOpen(true);
                }}
                {...testId('business-channel-template-create')}
              >
                新建模板
              </Button>
            }
          >
            <ProTable<BusinessChannelTemplateView>
              size="small"
              rowKey="templateRef"
              dataSource={templates}
              search={false}
              options={false}
              toolBarRender={false}
              pagination={false}
              {...adminListState({
                loading,
                failed: Boolean(problem),
                emptyText: '暂无经营渠道模板',
                testIdPrefix: 'project-business-channel-template-list',
              })}
              columns={templateColumns}
              onChange={(_, __, nextSorter, extra) => {
                if (extra.action === 'sort') setTemplateSort(readTemplateSort(nextSorter));
              }}
            />
          </Card>
        </section>
        <BusinessChannelList
          queryContext={queryContext}
          ownerNodeType="PROJECT"
          ownerNodeRef={scopeRef}
          sectionTitle="项目主体经营渠道"
          templateNames={templateNameByRef}
          refreshSignal={channelRefreshSignal}
          onCreate={() => setChannelOpen(true)}
          onOpenDetail={channel => setSelectedBusinessChannel(channel)}
        />
      </Space>
      <BusinessChannelTemplateDrawer
        open={templateOpen}
        queryContext={queryContext}
        projectRef={scopeRef}
        template={selectedTemplate}
        onClose={() => setTemplateOpen(false)}
        onSaved={() => {
          setTemplateOpen(false);
          refreshTemplates();
        }}
      />
      <BusinessChannelTemplateDetailDrawer
        open={templateDetailOpen}
        queryContext={queryContext}
        template={selectedTemplate}
        onClose={() => setTemplateDetailOpen(false)}
        onEdit={template => {
          setSelectedTemplate(template);
          setTemplateOpen(true);
        }}
        onStatusChange={transitionTemplate}
      />
      <BusinessChannelCreateDrawer
        open={channelOpen}
        queryContext={queryContext}
        ownerNodeType="PROJECT"
        ownerNodeRef={scopeRef}
        templates={templates.filter(template => template.operatorKind === 'PROJECT')}
        onClose={() => setChannelOpen(false)}
        onSaved={() => {
          setChannelOpen(false);
          channelRefreshSignal.publish();
        }}
      />
      <BusinessChannelDetailDrawer
        open={Boolean(selectedBusinessChannel)}
        queryContext={queryContext}
        selected={selectedBusinessChannel}
        onClose={() => setSelectedBusinessChannel(undefined)}
        onEdit={channel => {
          setEditingBusinessChannel(channel);
          setChannelEditOpen(true);
        }}
        onSaved={() => channelRefreshSignal.publish()}
      />
      <BusinessChannelEditDrawer
        open={channelEditOpen}
        queryContext={queryContext}
        channel={editingBusinessChannel}
        onClose={() => setChannelEditOpen(false)}
        onSaved={() => {
          setChannelEditOpen(false);
          channelRefreshSignal.publish();
        }}
      />
    </div>
  );

  async function transitionTemplate(template: BusinessChannelTemplateView, status: 'ENABLED' | 'DISABLED') {
    await operationsClient.transitionOperationsBusinessChannelTemplateStatus(
      {groupWorkspaceKey: queryContext.groupWorkspaceKey, templateRef: template.templateRef},
      {
        body: {status, expectedVersion: template.version},
        headers: {
          'Idempotency-Key': `business-channel-template:${template.templateRef}:${status}`,
        },
      },
    );
    refreshTemplates();
    channelRefreshSignal.publish();
  }
}
