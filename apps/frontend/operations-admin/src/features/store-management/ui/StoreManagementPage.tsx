import {Alert, Button, Tag} from 'antd';
import {ProTable, type ProColumns, type ProFormInstance} from '@ant-design/pro-components';
import {
  adminListState,
  clearInvalidExtensionFilterFields,
  contextScopedQueryArgs,
  createExtensionFilterRecoveryState,
  createPageQueryIdentity,
  reconcileExtensionFilterValues,
  ExtensionFilterInvalidSummary,
  isExtensionDefinitionRevisionAtLeast,
  lifecycleColor,
  NameCodeText,
  displayFieldValue,
  testId,
  useExtensionFilterInvalidFocus,
  useExtensionFilterStaleRecovery,
  useDetailDrawer,
  useOverlayLock,
  usePageQuery,
} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import type {
  ExtensionDefinition,
  OrganizationStore,
  OrganizationStoreSortDirection,
  OrganizationStoreSortKey,
  OrganizationStoreStatus,
} from '../../../app/api/generated/operations-edge';
import {OPERATIONS_ADMIN_OPERATION_IDS} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {ACTION_CAPABILITIES, adminCatalog, operationsPageDesignKeys} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';
import {OperationsAuditHistoryModal} from '../../audit-history';
import {StoreCreateDrawer} from './StoreCreateDrawer';
import {StoreDetailDrawer} from './StoreDetailDrawer';
import {StoreEditDrawer} from './StoreEditDrawer';
import {StoreStatusModal} from './StoreStatusModal';
import {extensionListAndSearchColumns, extensionQueryValues} from '../../extension-fields/model/extensionList';
import {organizationStoreStatusLabels} from '../../organization-structure/model/organizationStatus';
import {
  extensionListInvalidSummaryTestId,
  extensionListRecoveryNoticeTestId,
} from '../../../app/automation/extensionListTestIds';

type StoreFilters = {
  name?: string;
  code?: string;
  status?: OrganizationStoreStatus;
  extensionFilterValues?: Record<string, unknown>;
};
const page = adminCatalog.operationsPages.find(
  entry => entry.pageDesignKey === operationsPageDesignKeys.PgOrgStoreManage,
);
const storePageTitle = page?.pageTitle;
if (!storePageTitle) throw new Error('ADMIN_CATALOG_STORE_PAGE_MISSING');

export function StoreManagementPage({queryContext, actionCapabilityKeys}: OperationsPageProps) {
  const [filters, setFilters] = useState<StoreFilters>({});
  const [sort, setSort] = useState<OrganizationStoreSortKey>('UPDATED_AT');
  const [direction, setDirection] = useState<OrganizationStoreSortDirection>('DESC');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationStore>();
  const [statusTarget, setStatusTarget] = useState<OrganizationStore>();
  const [message, setMessage] = useState<string>();
  const [extensionRecoveryNotice, setExtensionRecoveryNotice] = useState(false);
  const [extensionRecoveryInProgress, setExtensionRecoveryInProgress] = useState(false);
  const [extensionRecoveryFailed, setExtensionRecoveryFailed] = useState(false);
  const extensionRecoveryBlocked = extensionRecoveryInProgress || extensionRecoveryFailed;
  const filterFormRef = useRef<ProFormInstance | undefined>(undefined);
  const [auditOpen, setAuditOpen] = useState(false);
  const detail = useDetailDrawer<OrganizationStore>();
  useOverlayLock(Boolean(statusTarget));
  const context = contextScopedQueryArgs({}, queryContext);
  const scopeReady = Boolean(queryContext.scopeRef);
  const queryIdentity = useMemo(
    () =>
      createPageQueryIdentity({
        operationId: OPERATIONS_ADMIN_OPERATION_IDS.getOperationsOrganizationStores,
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
      operationsAdminRtkRequest.getOperationsOrganizationStoreExtensionDefinition(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {query: {expectedContextVersion: queryContext.expectedContextVersion}},
      ),
    [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey],
  );
  const definitionQuery = operationsRtk.useGetOperationsOrganizationStoreExtensionDefinitionQuery(definitionRequest, {
    skip: !scopeReady,
  });
  const recoveryScopeKey = `operations-store:${queryContext.groupWorkspaceKey}:${queryContext.scopeRef ?? ''}`;
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
  const listRequest = useMemo(() => {
    const {extensionFilterValues: _extensionFilterValues, ...coreFilters} = filters;
    return operationsAdminRtkRequest.getOperationsOrganizationStores(
      {groupWorkspaceKey: queryContext.groupWorkspaceKey},
      {
        query: {
          ...context,
          ...coreFilters,
          ...extensionQuery,
          sort,
          direction,
          page: pagination.page,
          pageSize: pagination.pageSize,
        },
      },
    );
  }, [
    context,
    direction,
    extensionQuery,
    filters,
    pagination.page,
    pagination.pageSize,
    queryContext.groupWorkspaceKey,
    sort,
  ]);
  const list = operationsRtk.useGetOperationsOrganizationStoresQuery(listRequest, {
    skip: !scopeReady || extensionRecoveryBlocked,
  });
  const listProblem = list.error ? operationsProblemOf(list.error) : undefined;
  const definitionProblem = definitionQuery.error ? operationsProblemOf(definitionQuery.error) : undefined;
  const listDataFailed = Boolean(list.error) || Boolean(definitionQuery.error) || extensionRecoveryFailed;
  const invalidFilterProblem = listProblem?.errorCode === 'EXTENSION_FILTER_INVALID' ? listProblem : undefined;
  const invalidFilterProblemRef = useRef<HTMLDivElement | null>(null);
  useExtensionFilterInvalidFocus(invalidFilterProblemRef, invalidFilterProblem?.invalidFields);
  if (listProblem?.errorCode === 'EXTENSION_DEFINITION_REVISION_STALE') {
    extensionRecoveryState.current.rememberStaleRevision(recoveryScopeKey, listProblem.currentDefinitionRevision);
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
  const openDetail = useCallback(
    (row: OrganizationStore) => {
      setMessage(undefined);
      detail.open(row);
    },
    [detail],
  );
  const columns = useMemo<ProColumns<OrganizationStore>[]>(
    () => [
      {
        key: 'name',
        title: '门店名称',
        dataIndex: 'name',
        sorter: true,
        fieldProps: {...testId('operations-store-filter-name'), allowClear: true, placeholder: '门店名称'},
        render: (_, row) => (
          <Button
            type="link"
            onClick={() => void openDetail(row)}
            {...testId(`operations-store-open-detail-${row.id}`)}
          >
            {row.name}
          </Button>
        ),
      },
      {
        key: 'code',
        title: '编码',
        dataIndex: 'code',
        sorter: true,
        fieldProps: {...testId('operations-store-filter-code'), allowClear: true, placeholder: '门店编码'},
      },
      {title: '品牌', search: false, render: (_, row) => <NameCodeText name={row.brand.name} code={row.brand.code} />},
      {
        title: '经营租户',
        search: false,
        render: (_, row) => <NameCodeText name={row.tenant.name} code={row.tenant.code} />,
      },
      {
        title: '总公司',
        search: false,
        render: (_, row) =>
          row.headCompany ? <NameCodeText name={row.headCompany.name} code={row.headCompany.code} /> : '未设置',
      },
      {
        key: 'notes',
        title: '备注',
        dataIndex: 'notes',
        search: false,
        render: (_, row) => displayFieldValue(row.notes),
      },
      ...extensionListAndSearchColumns<OrganizationStore>(
        definitionQuery.currentData as ExtensionDefinition | undefined,
        'operations-store-filter-extension',
      ),
      {
        title: '状态',
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: {
          ENABLED: {text: organizationStoreStatusLabels.ENABLED, status: 'Success'},
          DISABLED: {text: organizationStoreStatusLabels.DISABLED, status: 'Warning'},
          VOIDED: {text: organizationStoreStatusLabels.VOIDED, status: 'Error'},
        },
        fieldProps: {...testId('operations-store-filter-status'), allowClear: true, placeholder: '状态'},
        render: (_, row) => <Tag color={lifecycleColor(row.status)}>{organizationStoreStatusLabels[row.status]}</Tag>,
      },
    ],
    [definitionQuery.currentData, openDetail],
  );
  // The shell-owned context bar is the sole missing-project prompt for every
  // scoped page. This page only reports a real list or command failure.
  const extensionDefinitionProblem = definitionProblem
    ? {title: '暂时无法获取门店字段配置', detail: '请重试。'}
    : undefined;
  const extensionRecoveryProblem = extensionRecoveryFailed
    ? {title: '暂时无法获取门店字段配置', detail: '请重试。'}
    : undefined;
  const problem =
    extensionRecoveryProblem?.detail ?? message ?? listProblem?.detail ?? extensionDefinitionProblem?.detail;
  const problemTitle =
    extensionRecoveryProblem?.title ??
    (message ? '门店管理未完成' : (listProblem?.title ?? extensionDefinitionProblem?.title ?? '门店管理未完成'));
  const retry = extensionRecoveryFailed
    ? () => recoverExtensionFilters()
    : listProblem
      ? listProblem.errorCode === 'EXTENSION_DEFINITION_REVISION_STALE'
        ? () => recoverExtensionFilters()
        : () => void list.refetch()
      : definitionProblem
        ? () => void definitionQuery.refetch()
        : undefined;
  const selected = detail.target;
  return (
    <section {...testId('operations-store-page')}>
      {extensionRecoveryNotice && (
        <Alert
          type="info"
          showIcon
          closable
          title="筛选条件已按最新字段配置更新"
          onClose={() => setExtensionRecoveryNotice(false)}
          {...testId(extensionListRecoveryNoticeTestId('operations-store'))}
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
                    testIdPrefix={extensionListInvalidSummaryTestId('operations-store')}
                  />
                </>
              ) : (
                problem
              )
            }
            action={
              retry ? (
                <Button onClick={retry} {...testId('operations-store-page-retry')}>
                  重试
                </Button>
              ) : undefined
            }
            style={{marginBottom: 16}}
          />
        </div>
      )}
      <ProTable<OrganizationStore>
        size="small"
        aria-label={storePageTitle}
        formRef={filterFormRef}
        rowKey="id"
        search={{
          labelWidth: 'auto',
          optionRender: searchConfig => [
            <Button
              key="submit"
              type="primary"
              onClick={() => searchConfig.form?.submit()}
              {...testId('operations-store-filter-submit')}
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
              }}
              {...testId('operations-store-filter-reset')}
            >
              重置
            </Button>,
          ],
        }}
        onSubmit={value => {
          extensionRecoveryState.current?.invalidate(recoveryScopeKey);
          setExtensionRecoveryNotice(false);
          setExtensionRecoveryInProgress(false);
          setExtensionRecoveryFailed(false);
          setFilters({
            name: value.name?.trim() || undefined,
            code: value.code?.trim() || undefined,
            status: value.status,
            extensionFilterValues: value.extensionFilterValues as Record<string, unknown>,
          });
          pagination.setPage(1);
        }}
        options={false}
        {...adminListState({
          loading: list.isFetching || extensionRecoveryInProgress,
          failed: listDataFailed,
          emptyText: '暂无门店',
          testIdPrefix: 'operations-store-list',
        })}
        dataSource={listDataFailed ? [] : (list.currentData?.items ?? [])}
        columns={columns}
        toolBarRender={() =>
          actionCapabilityKeys.includes(ACTION_CAPABILITIES.ORG_STORE_CREATE)
            ? [
                <Button
                  key="create"
                  type="primary"
                  onClick={() => setCreateOpen(true)}
                  {...testId('operations-store-create-open')}
                >
                  新建门店
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
          const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter;
          if (!currentSorter?.order) {
            setSort('UPDATED_AT');
            setDirection('DESC');
            return;
          }
          const nextSort =
            currentSorter?.columnKey === 'name' ? 'NAME' : currentSorter?.columnKey === 'code' ? 'CODE' : 'UPDATED_AT';
          setSort(nextSort);
          setDirection(currentSorter.order === 'ascend' ? 'ASC' : 'DESC');
          pagination.setPage(1);
        }}
        {...testId('operations-store-table')}
      />
      <StoreDetailDrawer
        store={detail.isOpen ? selected : undefined}
        queryContext={queryContext}
        canEdit={actionCapabilityKeys.includes(ACTION_CAPABILITIES.ORG_STORE_EDIT)}
        canTransition={actionCapabilityKeys.includes(ACTION_CAPABILITIES.ORG_STORE_STATUS)}
        onClose={detail.close}
        onAudit={() => setAuditOpen(true)}
        onEdit={setEditing}
        onStatus={setStatusTarget}
      />
      <StoreCreateDrawer
        open={createOpen}
        queryContext={queryContext}
        onClose={() => setCreateOpen(false)}
        onCreated={store => {
          setCreateOpen(false);
          detail.open(store);
        }}
      />
      <StoreEditDrawer
        store={editing}
        queryContext={queryContext}
        onClose={() => setEditing(undefined)}
        onUpdated={store => {
          setEditing(undefined);
          detail.open(store);
        }}
      />
      <StoreStatusModal
        store={statusTarget}
        queryContext={queryContext}
        onClose={() => setStatusTarget(undefined)}
        onUpdated={store => {
          setStatusTarget(undefined);
          detail.open(store);
        }}
        onProblem={setMessage}
      />
      <OperationsAuditHistoryModal
        open={auditOpen}
        target={selected ? {entityType: 'STORE', entityId: selected.id, displayName: selected.name} : undefined}
        groupWorkspaceKey={queryContext.groupWorkspaceKey}
        onClose={() => setAuditOpen(false)}
      />
    </section>
  );
}
