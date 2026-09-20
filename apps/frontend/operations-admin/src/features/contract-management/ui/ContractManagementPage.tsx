import {Alert, Button} from 'antd';
import {ProTable, type ProColumns, type ProFormInstance} from '@ant-design/pro-components';
import {
  adminListState,
  contextScopedQueryArgs,
  createExtensionFilterRecoveryState,
  createPageQueryIdentity,
  EllipsisTooltip,
  ExtensionFilterInvalidSummary,
  formatCanonicalDateTime,
  clearInvalidExtensionFilterFields,
  isExtensionDefinitionRevisionAtLeast,
  reconcileExtensionFilterValues,
  NameCodeText,
  ValidityStatus,
  testId,
  useExtensionFilterInvalidFocus,
  useExtensionFilterStaleRecovery,
  useDetailDrawer,
  useOverlayLock,
  usePageQuery,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useRef, useState} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import type {
  ExtensionDefinition,
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
import {extensionListAndSearchColumns, extensionQueryValues} from '../../extension-fields/model/extensionList';
import {
  extensionListInvalidSummaryTestId,
  extensionListRecoveryNoticeTestId,
} from '../../../app/automation/extensionListTestIds';

type ContractFilters = {
  storeId?: string;
  contractNo?: string;
  phaseName?: string;
  tenantId?: string;
  status?: 'VALID' | 'INVALID';
  dateFrom?: string;
  dateTo?: string;
  extensionFilterValues?: Record<string, unknown>;
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
  const [extensionRecoveryNotice, setExtensionRecoveryNotice] = useState(false);
  const [extensionRecoveryInProgress, setExtensionRecoveryInProgress] = useState(false);
  const [extensionRecoveryFailed, setExtensionRecoveryFailed] = useState(false);
  const extensionRecoveryBlocked = extensionRecoveryInProgress || extensionRecoveryFailed;
  const filterFormRef = useRef<ProFormInstance | undefined>(undefined);
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
  const definitionRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsContractExtensionDefinition(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {query: {expectedContextVersion: queryContext.expectedContextVersion}},
      ),
    [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey],
  );
  const definitionQuery = operationsRtk.useGetOperationsContractExtensionDefinitionQuery(definitionRequest, {
    skip: !projectId,
  });
  const recoveryScopeKey = `operations-contract:${queryContext.groupWorkspaceKey}:${queryContext.scopeRef ?? ''}:${projectId ?? ''}`;
  const extensionRecoveryState = useRef<ReturnType<typeof createExtensionFilterRecoveryState> | undefined>(undefined);
  if (!extensionRecoveryState.current) extensionRecoveryState.current = createExtensionFilterRecoveryState();
  extensionRecoveryState.current.enterScope(recoveryScopeKey);
  useEffect(() => {
    extensionRecoveryState.current?.enterScope(recoveryScopeKey);
    setExtensionRecoveryNotice(false);
    setExtensionRecoveryInProgress(false);
    setExtensionRecoveryFailed(false);
    return () => extensionRecoveryState.current?.invalidate(recoveryScopeKey);
  }, [recoveryScopeKey]);
  const extensionQuery = useMemo(
    () => extensionQueryValues(definitionQuery.currentData, filters.extensionFilterValues),
    [definitionQuery.currentData, filters.extensionFilterValues],
  );

  const query = useMemo(() => {
    const {tenantId, extensionFilterValues: _extensionFilterValues, ...restFilters} = filters;
    return contextScopedQueryArgs(
      {
        ...restFilters,
        ...(tenantId ? {tenantId: wireUuid(tenantId)} : {}),
        ...extensionQuery,
        sort,
        direction,
        page,
        pageSize,
      },
      queryContext,
    );
  }, [direction, extensionQuery, filters, page, pageSize, queryContext, sort]);
  const listRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsContracts({groupWorkspaceKey: queryContext.groupWorkspaceKey}, {query}),
    [query, queryContext.groupWorkspaceKey],
  );
  const list = operationsRtk.useGetOperationsContractsQuery(listRequest, {
    skip: !projectId || extensionRecoveryBlocked,
  });
  const listProblem = list.error ? operationsProblemOf(list.error) : undefined;
  const definitionProblem = definitionQuery.error ? operationsProblemOf(definitionQuery.error) : undefined;
  const listDataFailed = Boolean(list.error) || Boolean(definitionQuery.error) || extensionRecoveryFailed;
  if (listProblem?.errorCode === 'EXTENSION_DEFINITION_REVISION_STALE') {
    extensionRecoveryState.current!.rememberStaleRevision(recoveryScopeKey, listProblem.currentDefinitionRevision);
  }
  const recoverExtensionFilters = () => {
    const recovery = extensionRecoveryState.current!.begin(recoveryScopeKey, listProblem?.currentDefinitionRevision);
    const isCurrentRecovery = () => extensionRecoveryState.current!.isCurrent(recovery);
    const previousFields = definitionQuery.currentData?.definitions;
    const previousValues = filters.extensionFilterValues;
    const failRecovery = () => {
      if (!isCurrentRecovery()) return;
      setExtensionRecoveryInProgress(false);
      setExtensionRecoveryFailed(true);
    };
    setExtensionRecoveryNotice(false);
    setExtensionRecoveryFailed(false);
    setExtensionRecoveryInProgress(true);
    void definitionQuery
      .refetch()
      .then(result => {
        if (!isCurrentRecovery()) return;
        const definition = result.data;
        if (!definition || !isExtensionDefinitionRevisionAtLeast(definition, recovery.expectedRevision)) {
          failRecovery();
          return;
        }
        const retained = reconcileExtensionFilterValues(
          filterFormRef.current,
          previousFields,
          definition.definitions,
          previousValues,
        );
        setFilters(current => {
          const {extensionFilterValues: _extensionFilterValues, ...coreFilters} = current;
          return Object.keys(retained).length ? {...coreFilters, extensionFilterValues: retained} : coreFilters;
        });
        pagination.setPage(1);
        setExtensionRecoveryNotice(true);
        setExtensionRecoveryInProgress(false);
        setExtensionRecoveryFailed(false);
      })
      .catch(failRecovery);
  };
  useExtensionFilterStaleRecovery({
    scopeKey: recoveryScopeKey,
    stale: listProblem?.errorCode === 'EXTENSION_DEFINITION_REVISION_STALE',
    staleRevision: listProblem?.currentDefinitionRevision,
    recover: recoverExtensionFilters,
  });
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
  const extensionDefinitionProblem = definitionProblem
    ? {title: '暂时无法获取合同字段配置', detail: '请重试。'}
    : undefined;
  const extensionRecoveryProblem = extensionRecoveryFailed
    ? {title: '暂时无法获取合同字段配置', detail: '请重试。'}
    : undefined;
  const queryProblem = extensionRecoveryProblem ?? listProblem ?? extensionDefinitionProblem;
  const invalidFilterProblem = listProblem?.errorCode === 'EXTENSION_FILTER_INVALID' ? listProblem : undefined;
  const invalidFilterProblemRef = useRef<HTMLDivElement | null>(null);
  useExtensionFilterInvalidFocus(invalidFilterProblemRef, invalidFilterProblem?.invalidFields);
  const problem =
    queryProblem?.detail ??
    (tenantCandidates.error
      ? '经营租户候选暂时无法获取，请重试。'
      : candidates.error
        ? '门店候选暂时无法获取，请重试后再筛选或创建合同。'
        : undefined);
  const problemTitle = queryProblem?.title ?? '合同页面暂时不可用';

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
      {
        title: '分期',
        dataIndex: 'phaseName',
        search: false,
        render: (_, row) => row.phaseName || '未设置',
      },
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
      ...extensionListAndSearchColumns<StoreContract>(
        definitionQuery.currentData as ExtensionDefinition | undefined,
        'operations-contract-filter-extension',
      ),
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
        render: (_, row) => formatCanonicalDateTime(row.updatedAt),
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
      definitionQuery.currentData,
    ],
  );

  const showOwnerReadback = (contract: StoreContract) => {
    detail.open(contract);
  };

  const retry = extensionRecoveryFailed
    ? () => recoverExtensionFilters()
    : candidates.error
      ? () => void candidates.refetch()
      : tenantCandidates.error
        ? () => void tenantCandidates.refetch()
        : listProblem
          ? listProblem.errorCode === 'EXTENSION_DEFINITION_REVISION_STALE'
            ? () => recoverExtensionFilters()
            : () => void list.refetch()
          : definitionProblem
            ? () => void definitionQuery.refetch()
            : undefined;
  return (
    <>
      {extensionRecoveryNotice && (
        <Alert
          type="info"
          showIcon
          closable
          title="筛选条件已按最新字段配置更新"
          onClose={() => setExtensionRecoveryNotice(false)}
          {...testId(extensionListRecoveryNoticeTestId('operations-contract'))}
          style={{marginBottom: 16}}
        />
      )}
      {problem && (
        <div
          ref={invalidFilterProblemRef}
          tabIndex={invalidFilterProblem?.invalidFields?.length ? -1 : undefined}
          style={{outline: 'none'}}
        >
          <Alert
            type="error"
            showIcon
            title={problemTitle}
            description={
              invalidFilterProblem ? (
                <>
                  <div>{invalidFilterProblem.detail}</div>
                  <ExtensionFilterInvalidSummary
                    invalidFields={invalidFilterProblem.invalidFields}
                    definitions={definitionQuery.currentData?.definitions}
                    onClear={() =>
                      clearInvalidExtensionFilterFields(
                        filterFormRef.current,
                        definitionQuery.currentData?.definitions,
                        invalidFilterProblem.invalidFields,
                      )
                    }
                    testIdPrefix={extensionListInvalidSummaryTestId('operations-contract')}
                  />
                </>
              ) : (
                problem
              )
            }
            action={
              retry ? (
                <Button onClick={retry} {...testId('operations-contract-page-retry')}>
                  重试
                </Button>
              ) : undefined
            }
            style={{marginBottom: 16}}
          />
        </div>
      )}
      <ProTable<StoreContract>
        size="small"
        aria-label={contractPageTitle}
        formRef={filterFormRef}
        rowKey="id"
        options={false}
        {...adminListState({
          loading: list.isFetching || extensionRecoveryInProgress,
          failed: listDataFailed,
          emptyText: projectId ? '暂无合同' : '请先选择项目',
          testIdPrefix: 'operations-contract-list',
        })}
        dataSource={listDataFailed ? [] : (list.currentData?.items ?? [])}
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
                extensionRecoveryState.current?.invalidate(recoveryScopeKey);
                searchConfig.form?.resetFields();
                setExtensionRecoveryNotice(false);
                setExtensionRecoveryInProgress(false);
                setExtensionRecoveryFailed(false);
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
          extensionRecoveryState.current?.invalidate(recoveryScopeKey);
          setExtensionRecoveryNotice(false);
          setExtensionRecoveryInProgress(false);
          setExtensionRecoveryFailed(false);
          const dateRange = values.dateRange as string[] | undefined;
          setFilters({
            storeId: values.storeId,
            contractNo: values.contractNo,
            phaseName: values.phaseName,
            tenantId: values.tenantId,
            status: values.status,
            dateFrom: dateRange?.[0],
            dateTo: dateRange?.[1],
            extensionFilterValues: values.extensionFilterValues as Record<string, unknown>,
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
