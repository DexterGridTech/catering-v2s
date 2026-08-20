import {Alert, Button} from 'antd';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {
  adminListState,
  contextScopedQueryArgs,
  createPageQueryIdentity,
  EllipsisTooltip,
  NameCodeText,
  ValidityStatus,
  testId,
  useDetailDrawer,
  useOverlayLock,
  usePageQuery,
} from '@catering-v2s/admin-ui-foundation';
import {useMemo, useState} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import type {
  StoreContract,
  StoreContractSortDirection,
  StoreContractSortKey,
} from '../../../app/api/generated/operations-edge';
import {OPERATIONS_ADMIN_OPERATION_IDS} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {ACTION_CAPABILITIES, adminCatalog, operationsPageDesignKeys} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {ContractCreateDrawer} from './ContractCreateDrawer';
import {ContractDetailDrawer} from './ContractDetailDrawer';
import {ContractEditDrawer} from './ContractEditDrawer';
import {ContractInvalidateModal} from './ContractInvalidateModal';
import {useContractStoreCandidates} from './useContractStoreCandidates';
import {useOrganizationCandidates} from '../../../app/queries/useOrganizationCandidates';

type ContractFilters = {
  storeId?: string;
  contractNo?: string;
  phaseName?: string;
  tenantId?: string;
  status?: 'VALID' | 'INVALID';
  dateFrom?: string;
  dateTo?: string;
};

const contractPage = adminCatalog.operationsPages.find(
  page => page.pageDesignKey === operationsPageDesignKeys.PgContractStoreManage,
);
const contractPageTitle = contractPage?.pageTitle;
if (!contractPageTitle) throw new Error('ADMIN_CATALOG_CONTRACT_PAGE_MISSING');

export function ContractManagementPage({queryContext, actionCapabilityKeys}: OperationsPageProps) {
  const [filters, setFilters] = useState<ContractFilters>({});
  const [tenantSearch, setTenantSearch] = useState('');
  const [sort, setSort] = useState<StoreContractSortKey>('UPDATED_AT');
  const [direction, setDirection] = useState<StoreContractSortDirection>('DESC');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<StoreContract>();
  const [invalidating, setInvalidating] = useState<StoreContract>();
  const detail = useDetailDrawer<StoreContract>();
  useOverlayLock(detail.isOpen || createOpen || Boolean(editing) || Boolean(invalidating));
  const projectId = queryContext.scopeRef;
  const queryIdentity = useMemo(
    () =>
      createPageQueryIdentity({
        operationId: OPERATIONS_ADMIN_OPERATION_IDS.getOperationsContracts,
        scope: {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          expectedContextVersion: queryContext.expectedContextVersion,
          scopeRef: queryContext.scopeRef,
        },
        filters,
        sort: {sort, direction},
      }),
    [direction, filters, queryContext, sort],
  );
  const pagination = usePageQuery({queryIdentity, initialPageSize: 10});
  const {page, pageSize} = pagination;

  const query = useMemo(() => {
    const {tenantId, ...restFilters} = filters;
    return contextScopedQueryArgs(
      {
        ...restFilters,
        ...(tenantId ? {tenantId: wireUuid(tenantId)} : {}),
        sort,
        direction,
        page,
        pageSize,
      },
      queryContext,
    );
  }, [direction, filters, page, pageSize, queryContext, sort]);
  const listRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsContracts({groupWorkspaceKey: queryContext.groupWorkspaceKey}, {query}),
    [query, queryContext.groupWorkspaceKey],
  );
  const list = operationsRtk.useGetOperationsContractsQuery(listRequest, {skip: !projectId});
  const candidates = useContractStoreCandidates({open: Boolean(projectId), queryContext});
  const tenantCandidates = useOrganizationCandidates({
    open: Boolean(projectId),
    queryContext,
    subjectType: 'TENANT',
    candidateUsage: 'CONTRACT_LIST',
    projectId,
    queryText: tenantSearch,
    selectedId: filters.tenantId,
  });
  const canCreate = actionCapabilityKeys.includes(ACTION_CAPABILITIES.CONTRACT_CREATE);
  const canEdit = actionCapabilityKeys.includes(ACTION_CAPABILITIES.CONTRACT_EDIT);
  const canInvalidate = actionCapabilityKeys.includes(ACTION_CAPABILITIES.CONTRACT_INVALIDATE);
  // Missing project context is rendered once by OperationsDataScopeContextBar.
  // Keeping only actual query failures here prevents a second, inconsistent
  // required-scope alert inside the CRUD page.
  const problem = list.error
    ? '合同列表暂时无法获取，请重试。'
    : tenantCandidates.error
      ? '经营租户候选暂时无法获取，请重试。'
      : candidates.error
        ? '门店候选暂时无法获取，请重试后再筛选或创建合同。'
        : undefined;

  const columns = useMemo<ProColumns<StoreContract>[]>(
    () => [
      {
        key: 'contractNo',
        title: '合同编号',
        dataIndex: 'contractNo',
        sorter: true,
        ellipsis: {showTitle: false},
        search: false,
        render: (value, row) => (
          <EllipsisTooltip title={value}>
            <span>
              <Button
                type="link"
                className="operations-contract-number-link"
                onClick={() => detail.open(row)}
                {...testId('operations-contract-detail-open')}
              >
                <span className="operations-contract-number-label">{value}</span>
              </Button>
            </span>
          </EllipsisTooltip>
        ),
      },
      {
        title: '门店',
        dataIndex: 'storeDisplay',
        search: false,
        render: (_, row) => <NameCodeText name={row.store.name} code={row.store.code} />,
      },
      {title: '分期', dataIndex: 'phaseName', search: false},
      {
        title: '经营租户',
        dataIndex: 'tenantDisplay',
        search: false,
        render: (_, row) => <NameCodeText name={row.tenant.name} code={row.tenant.code} />,
      },
      {
        key: 'effectiveFrom',
        title: '起止日期',
        dataIndex: 'effectiveDisplay',
        sorter: true,
        search: false,
        render: (_, row) => (
          <span className="operations-contract-effective-range">
            <span>{row.effectiveFrom}</span>
            <span>至 {row.effectiveTo ?? '长期'}</span>
          </span>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        search: false,
        render: (_value, row) => <ValidityStatus status={row.status} />,
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        search: false,
        render: (_, row) => new Date(row.updatedAt).toLocaleString('zh-CN'),
      },
      {
        title: '门店',
        dataIndex: 'storeId',
        hideInTable: true,
        valueType: 'select',
        fieldProps: {
          ...testId('operations-contract-filter-store'),
          allowClear: true,
          disabled: Boolean(candidates.error),
          showSearch: true,
          filterOption: false,
          onSearch: candidates.setStoreSearch,
          onPopupScroll: candidates.onPopupScroll,
          loading: candidates.isFetching,
          options: candidates.stores.map(store => ({
            value: store.id,
            label: <NameCodeText name={store.name} code={store.code} />,
          })),
        },
      },
      {title: '合同编号', dataIndex: 'contractNo', hideInTable: true},
      {title: '分期', dataIndex: 'phaseName', hideInTable: true},
      {
        title: '经营租户',
        dataIndex: 'tenantId',
        hideInTable: true,
        valueType: 'select',
        fieldProps: {
          ...testId('operations-contract-filter-tenant'),
          allowClear: true,
          disabled: Boolean(tenantCandidates.error),
          showSearch: true,
          filterOption: false,
          onSearch: setTenantSearch,
          onPopupScroll: tenantCandidates.onPopupScroll,
          loading: tenantCandidates.isFetching,
          options: tenantCandidates.items.map(tenant => ({
            value: tenant.id,
            label: <NameCodeText name={tenant.name} code={tenant.code} />,
          })),
          placeholder: '搜索经营租户名称或编码',
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        hideInTable: true,
        valueType: 'select',
        valueEnum: {VALID: {text: '有效'}, INVALID: {text: '已失效'}},
      },
      {title: '起止日期', dataIndex: 'dateRange', hideInTable: true, valueType: 'dateRange'},
    ],
    [
      candidates.error,
      candidates.isFetching,
      candidates.onPopupScroll,
      candidates.setStoreSearch,
      candidates.stores,
      detail,
      tenantCandidates.error,
      tenantCandidates.isFetching,
      tenantCandidates.items,
      tenantCandidates.onPopupScroll,
    ],
  );

  const showOwnerReadback = (contract: StoreContract) => {
    detail.open(contract);
  };

  const retry = candidates.error
    ? () => void candidates.refetch()
    : tenantCandidates.error
      ? () => void tenantCandidates.refetch()
      : list.error
        ? () => void list.refetch()
        : undefined;
  return (
    <>
      {problem && (
        <Alert
          type="error"
          showIcon
          title="合同页面暂时不可用"
          description={problem}
          action={
            retry ? (
              <Button onClick={retry} {...testId('operations-contract-page-retry')}>
                重试
              </Button>
            ) : undefined
          }
          style={{marginBottom: 16}}
        />
      )}
      <ProTable<StoreContract>
        size="small"
        aria-label={contractPageTitle}
        rowKey="id"
        options={false}
        {...adminListState({
          loading: list.isFetching,
          failed: Boolean(list.error),
          emptyText: projectId ? '暂无合同' : '请先选择项目',
          testIdPrefix: 'operations-contract-list',
        })}
        dataSource={list.currentData?.items ?? []}
        columns={columns}
        search={{
          labelWidth: 'auto',
          optionRender: searchConfig => [
            <Button
              key="submit"
              type="primary"
              onClick={() => searchConfig.form?.submit()}
              {...testId('operations-contract-filter-submit')}
            >
              查询
            </Button>,
            <Button
              key="reset"
              onClick={() => {
                searchConfig.form?.resetFields();
                setFilters({});
                pagination.setPage(1);
                setTenantSearch('');
              }}
              {...testId('operations-contract-filter-reset')}
            >
              重置
            </Button>,
          ],
        }}
        onSubmit={values => {
          const dateRange = values.dateRange as string[] | undefined;
          setFilters({
            storeId: values.storeId,
            contractNo: values.contractNo,
            phaseName: values.phaseName,
            tenantId: values.tenantId,
            status: values.status,
            dateFrom: dateRange?.[0],
            dateTo: dateRange?.[1],
          });
          pagination.setPage(1);
        }}
        toolBarRender={() =>
          canCreate
            ? [
                <Button
                  key="create"
                  type="primary"
                  disabled={!projectId}
                  onClick={() => setCreateOpen(true)}
                  {...testId('operations-contract-create-open')}
                >
                  新建合同
                </Button>,
              ]
            : []
        }
        pagination={{current: page, pageSize, total: list.currentData?.metadata.total ?? 0, showSizeChanger: true}}
        onChange={(tablePagination, _, sorter, extra) => {
          if (extra.action === 'paginate') {
            pagination.setPage(tablePagination.current ?? page);
            pagination.setPageSize(tablePagination.pageSize ?? pageSize);
            return;
          }
          if (extra.action !== 'sort') return;
          const current = Array.isArray(sorter) ? sorter[0] : sorter;
          if (!current?.order) {
            setSort('UPDATED_AT');
            setDirection('DESC');
            return;
          }
          const nextSort =
            current?.columnKey === 'contractNo'
              ? 'CONTRACT_NO'
              : current?.columnKey === 'effectiveFrom'
                ? 'EFFECTIVE_FROM'
                : 'UPDATED_AT';
          setSort(nextSort);
          setDirection(current.order === 'ascend' ? 'ASC' : 'DESC');
          pagination.setPage(1);
        }}
        {...testId('operations-contract-page')}
      />
      <ContractDetailDrawer
        contract={detail.target}
        queryContext={queryContext}
        canEdit={canEdit}
        canInvalidate={canInvalidate}
        onClose={detail.close}
        onEdit={contract => {
          detail.close();
          setEditing(contract);
        }}
        onInvalidate={contract => {
          detail.close();
          setInvalidating(contract);
        }}
      />
      <ContractCreateDrawer
        open={createOpen}
        queryContext={queryContext}
        onClose={() => setCreateOpen(false)}
        onCreated={contract => {
          setCreateOpen(false);
          showOwnerReadback(contract);
        }}
      />
      <ContractEditDrawer
        contract={editing}
        queryContext={queryContext}
        onClose={() => setEditing(undefined)}
        onUpdated={contract => {
          setEditing(undefined);
          showOwnerReadback(contract);
        }}
        onConflict={contract => {
          setEditing(undefined);
          showOwnerReadback(contract);
        }}
      />
      <ContractInvalidateModal
        contract={invalidating}
        queryContext={queryContext}
        onClose={() => setInvalidating(undefined)}
        onInvalidated={contract => {
          setInvalidating(undefined);
          showOwnerReadback(contract);
        }}
      />
    </>
  );
}
