import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {Alert, Button, Space, Tag, Typography} from 'antd';
import {
  adminListState,
  createPageQueryIdentity,
  createRefreshSignal,
  testId,
  useDetailDrawer,
  useAsyncGenerationGuard,
  usePageQuery,
  useRefreshVersion,
  NameCodePathText,
} from '@catering-v2s/admin-ui-foundation';
import {
  PLATFORM_ADMIN_OPERATION_IDS,
  type OwnerBindingView,
  type ProviderProfileView,
} from '../../../app/api/generated/platform-edge';
import {
  platformContentTabRefreshSignal,
  platformProblemOf,
  type PlatformApiProblem,
} from '../../../app/api/PlatformTransport';
import {useEffect, useMemo, useState} from 'react';
import {readPlatformOwnerBindings, type PlatformOwnerBindingPageQuery} from '../application/queries';
import {OwnerBindingDetailDrawer} from './OwnerBindingDetailDrawer';
import {OwnerBindingFormDrawer} from './OwnerBindingFormDrawer';
import {
  ownerBindingBusinessDisplay,
  canCreateOwnerBinding,
  ownerBindingExternalOwnerDisplay,
  ownerBindingNodeTypeDisplay,
  ownerBindingStatusDisplay,
} from './ownerBindingPresentation';

type BindingSortKey = NonNullable<PlatformOwnerBindingPageQuery['sortKey']>;
type SortDirection = NonNullable<PlatformOwnerBindingPageQuery['sortDirection']>;
type BindingFilters = {bindingName: string; nodeQueryText: string};

function readBindingSort(nextSorter: unknown): {sortKey?: BindingSortKey; sortDirection?: SortDirection} {
  const candidate = Array.isArray(nextSorter) ? nextSorter[0] : nextSorter;
  if (!candidate || typeof candidate !== 'object') return {};
  const columnKey =
    'columnKey' in candidate && typeof candidate.columnKey === 'string' ? candidate.columnKey : undefined;
  const order =
    'order' in candidate && (candidate.order === 'ascend' || candidate.order === 'descend')
      ? candidate.order
      : undefined;
  if (!columnKey || !order) return {};
  const sortKeys: Record<string, BindingSortKey> = {
    bindingName: 'BINDING_NAME',
    node: 'NODE',
    business: 'BUSINESS',
    externalOwnerId: 'EXTERNAL_OWNER_ID',
    status: 'STATUS',
  };
  const sortKey = sortKeys[columnKey];
  return sortKey ? {sortKey, sortDirection: order === 'ascend' ? 'ASC' : 'DESC'} : {};
}

export function OwnerBindingList({
  groupWorkspaceKey,
  profile,
}: {
  groupWorkspaceKey: string;
  profile: ProviderProfileView;
}) {
  const [rows, setRows] = useState<OwnerBindingView[]>([]);
  const [filters, setFilters] = useState<BindingFilters>({bindingName: '', nodeQueryText: ''});
  const [sort, setSort] = useState<{sortKey?: BindingSortKey; sortDirection?: SortDirection}>({});
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OwnerBindingView>();
  const detail = useDetailDrawer<OwnerBindingView>();
  const providerCode = profile.providerCode;
  const refreshSignal = useMemo(() => createRefreshSignal(), []);
  const refreshVersion = useRefreshVersion(refreshSignal);
  const contentTabRefreshVersion = useRefreshVersion(platformContentTabRefreshSignal);
  const generation = useAsyncGenerationGuard();
  const queryIdentity = useMemo(
    () =>
      createPageQueryIdentity({
        operationId: PLATFORM_ADMIN_OPERATION_IDS.getPlatformProviderProfileBindings,
        scope: {groupWorkspaceKey, providerCode},
        filters,
        sort,
      }),
    [filters, groupWorkspaceKey, providerCode, sort],
  );
  const pagination = usePageQuery({queryIdentity, initialPageSize: 10});
  const {page, pageSize} = pagination;
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const requestGeneration = generation.begin();
    setLoading(true);
    setProblem(undefined);
    void readPlatformOwnerBindings(groupWorkspaceKey, providerCode, {
      ...filters,
      ...sort,
      page,
      pageSize,
    })
      .then(result => {
        if (generation.isCurrent(requestGeneration)) {
          setRows(result.items);
          setTotal(result.total);
        }
      })
      .catch(error => {
        if (generation.isCurrent(requestGeneration)) setProblem(platformProblemOf(error));
      })
      .finally(() => {
        if (generation.isCurrent(requestGeneration)) setLoading(false);
      });
  }, [
    contentTabRefreshVersion,
    filters,
    generation,
    groupWorkspaceKey,
    page,
    pageSize,
    providerCode,
    refreshVersion,
    sort,
  ]);

  const columns: ProColumns<OwnerBindingView>[] = [
    {
      key: 'bindingName',
      title: '绑定名称',
      dataIndex: 'bindingName',
      sorter: true,
      fieldProps: {...testId('platform-owner-binding-name-filter'), allowClear: true},
      render: (_, row) => (
        <Button
          type="link"
          onClick={() => detail.open(row)}
          {...testId(`platform-owner-binding-detail-${row.bindingRef}`)}
        >
          {row.bindingDisplayName || '未命名绑定'}
        </Button>
      ),
    },
    {
      key: 'node',
      title: '绑定节点',
      dataIndex: 'nodeQueryText',
      sorter: true,
      fieldProps: {...testId('platform-owner-binding-node-filter'), allowClear: true},
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>
            {row.nodePath.length > 0 ? <NameCodePathText nodes={row.nodePath} /> : '未绑定组织节点'}
          </Typography.Text>
          <Typography.Text type="secondary">{ownerBindingNodeTypeDisplay(row)}</Typography.Text>
        </Space>
      ),
    },
    {
      key: 'business',
      title: '业务',
      dataIndex: 'business',
      sorter: true,
      search: false,
      render: (_, row) => ownerBindingBusinessDisplay(row),
    },
    {
      key: 'externalOwnerId',
      title: '外部主体编号',
      dataIndex: 'externalOwnerId',
      sorter: true,
      search: false,
      render: (_, row) => ownerBindingExternalOwnerDisplay(row, profile.authenticationKind),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      sorter: true,
      search: false,
      render: (_, row) => <Tag>{ownerBindingStatusDisplay(row)}</Tag>,
    },
  ];

  const listState = adminListState({
    loading,
    failed: Boolean(problem),
    emptyText: '暂无绑定关系',
    testIdPrefix: 'platform-owner-binding-list',
  });

  return (
    <>
      {problem && (
        <Alert
          type="error"
          showIcon
          title={problem.title}
          description={problem.detail}
          style={{marginBottom: 16}}
          {...testId('platform-owner-binding-list-error')}
        />
      )}
      <ProTable<OwnerBindingView>
        size="small"
        rowKey="bindingRef"
        {...listState}
        dataSource={rows}
        columns={columns}
        search={{
          labelWidth: 'auto',
          optionRender: searchConfig => [
            <Button
              key="submit"
              type="primary"
              onClick={() => searchConfig.form?.submit()}
              {...testId('platform-owner-binding-filter-submit')}
            >
              查询
            </Button>,
            <Button
              key="reset"
              onClick={() => {
                searchConfig.form?.resetFields();
                setFilters({bindingName: '', nodeQueryText: ''});
                pagination.setPage(1);
              }}
              {...testId('platform-owner-binding-filter-reset')}
            >
              重置
            </Button>,
          ],
        }}
        options={false}
        toolBarRender={() =>
          canCreateOwnerBinding(profile)
            ? [
                <Button
                  key="create"
                  type="primary"
                  onClick={() => {
                    setEditing(undefined);
                    setFormOpen(true);
                  }}
                  {...testId('platform-owner-binding-create')}
                >
                  新建绑定
                </Button>,
              ]
            : []
        }
        pagination={{current: page, pageSize, total, showSizeChanger: true}}
        scroll={{x: 1100}}
        onSubmit={values => {
          setFilters({
            bindingName: typeof values.bindingName === 'string' ? values.bindingName.trim() : '',
            nodeQueryText: typeof values.nodeQueryText === 'string' ? values.nodeQueryText.trim() : '',
          });
          pagination.setPage(1);
        }}
        onReset={() => {
          setFilters({bindingName: '', nodeQueryText: ''});
          pagination.setPage(1);
        }}
        onChange={(tablePagination, _, sorter, extra) => {
          if (extra.action === 'paginate') {
            if (tablePagination.pageSize !== pageSize) pagination.setPageSize(tablePagination.pageSize ?? pageSize);
            else pagination.setPage(tablePagination.current ?? page);
            return;
          }
          if (extra.action !== 'sort') return;
          setSort(readBindingSort(sorter));
          pagination.setPage(1);
        }}
        {...testId('platform-owner-binding-table')}
      />
      <OwnerBindingDetailDrawer
        detail={detail}
        groupWorkspaceKey={groupWorkspaceKey}
        profile={profile}
        onChanged={() => refreshSignal.publish()}
        onEdit={binding => {
          detail.close();
          setEditing(binding);
          setFormOpen(true);
        }}
      />
      <OwnerBindingFormDrawer
        open={formOpen}
        groupWorkspaceKey={groupWorkspaceKey}
        profile={profile}
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(undefined);
        }}
        onSaved={() => {
          setFormOpen(false);
          setEditing(undefined);
          refreshSignal.publish();
        }}
      />
    </>
  );
}
