import {Alert, Button, Tag} from 'antd';
import {ProTable, type ProColumns, type ProFormInstance} from '@ant-design/pro-components';
import {
  adminListState,
  clearInvalidExtensionFilterFields,
  contextScopedQueryArgs,
  createPageQueryIdentity,
  createExtensionFilterRecoveryState,
  ExtensionFilterInvalidSummary,
  isExtensionDefinitionRevisionAtLeast,
  reconcileExtensionFilterValues,
  useExtensionFilterStaleRecovery,
  useExtensionFilterInvalidFocus,
  testId,
  usePageQuery,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useRef, useState} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {
  type BusinessEntitySortDirection,
  type BusinessEntitySortKey,
  type BusinessEntityStatus,
  type ExtensionDefinition,
  type HeadCompany,
} from '../../../app/api/generated/operations-edge';
import {
  ACTION_CAPABILITIES,
  adminCatalog,
  operationsPageDesignKeys,
  type OperationsPageDesignKey,
} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';
import {BusinessEntityCreateDrawer} from './BusinessEntityCreateDrawer';
import {BusinessEntityDetailDrawer, type BusinessEntity} from './BusinessEntityDetailDrawer';
import {BusinessEntityEditDrawer} from './BusinessEntityEditDrawer';
import {BusinessEntityStatusModal} from './BusinessEntityStatusModal';
import {HeadCompanyBrandAuthorizationDrawer} from './HeadCompanyBrandAuthorizationDrawer';
import {businessEntityLifecycleLabels} from './businessEntityLifecycle';
import {extensionListAndSearchColumns, extensionQueryValues} from '../../extension-fields/model/extensionList';
import {
  extensionListInvalidSummaryTestId,
  extensionListRecoveryNoticeTestId,
} from '../../../app/automation/extensionListTestIds';

type Props = OperationsPageProps & {
  pageDesignKey: Extract<
    OperationsPageDesignKey,
    | typeof operationsPageDesignKeys.PgOrgBrand
    | typeof operationsPageDesignKeys.PgOrgTenant
    | typeof operationsPageDesignKeys.PgOrgHeadCompany
  >;
};
type Filters = {
  name?: string;
  code?: string;
  legalName?: string;
  unifiedSocialCreditCode?: string;
  status?: BusinessEntityStatus;
  extensionFilterValues?: Record<string, unknown>;
};

const configByKey = {
  [operationsPageDesignKeys.PgOrgBrand]: {
    kind: 'BRAND',
    create: ACTION_CAPABILITIES.ORG_BRAND_CREATE,
    edit: ACTION_CAPABILITIES.ORG_BRAND_EDIT,
    status: ACTION_CAPABILITIES.ORG_BRAND_STATUS,
  },
  [operationsPageDesignKeys.PgOrgTenant]: {
    kind: 'TENANT',
    create: ACTION_CAPABILITIES.ORG_TENANT_CREATE,
    edit: ACTION_CAPABILITIES.ORG_TENANT_EDIT,
    status: ACTION_CAPABILITIES.ORG_TENANT_STATUS,
  },
  [operationsPageDesignKeys.PgOrgHeadCompany]: {
    kind: 'HEAD_COMPANY',
    create: ACTION_CAPABILITIES.ORG_HEAD_COMPANY_CREATE,
    edit: ACTION_CAPABILITIES.ORG_HEAD_COMPANY_EDIT,
    status: ACTION_CAPABILITIES.ORG_HEAD_COMPANY_STATUS,
  },
} as const;

const actionLabel = new Map(adminCatalog.actions.map(action => [action.actionKey, action.actionLabel]));

export function BusinessEntityManagementPage({pageDesignKey, queryContext, actionCapabilityKeys}: Props) {
  const config = configByKey[pageDesignKey];
  const [filters, setFilters] = useState<Filters>({});
  const [sort, setSort] = useState<BusinessEntitySortKey>('NAME');
  const [direction, setDirection] = useState<BusinessEntitySortDirection>('ASC');
  const [creating, setCreating] = useState(false);
  const [extensionRecoveryNotice, setExtensionRecoveryNotice] = useState(false);
  const [extensionRecoveryInProgress, setExtensionRecoveryInProgress] = useState(false);
  const [extensionRecoveryFailed, setExtensionRecoveryFailed] = useState(false);
  const extensionRecoveryBlocked = extensionRecoveryInProgress || extensionRecoveryFailed;
  const filterFormRef = useRef<ProFormInstance | undefined>(undefined);
  const [detail, setDetail] = useState<BusinessEntity>();
  const [editing, setEditing] = useState<BusinessEntity>();
  const [transitioning, setTransitioning] = useState<
    {entity: BusinessEntity; targetStatus: BusinessEntityStatus} | undefined
  >();
  const [authorizing, setAuthorizing] = useState<HeadCompany>();
  const queryIdentity = useMemo(
    () =>
      createPageQueryIdentity({
        operationId: `getOperationsOrganization${config.kind}`,
        scope: {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          expectedContextVersion: queryContext.expectedContextVersion,
          scopeRef: queryContext.scopeRef,
        },
        filters,
        sort: {sort, direction},
      }),
    [config.kind, direction, filters, queryContext, sort],
  );
  const pagination = usePageQuery({queryIdentity, initialPageSize: 10});
  const {page, pageSize} = pagination;
  const definitionRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsOrganizationBusinessEntityExtensionDefinition(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {query: {expectedContextVersion: queryContext.expectedContextVersion, entityType: config.kind}},
      ),
    [config.kind, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey],
  );
  const definitionQuery = operationsRtk.useGetOperationsOrganizationBusinessEntityExtensionDefinitionQuery(
    definitionRequest,
    {skip: !queryContext.groupWorkspaceKey},
  );
  const extensionQuery = useMemo(
    () => extensionQueryValues(definitionQuery.currentData, filters.extensionFilterValues),
    [definitionQuery.currentData, filters.extensionFilterValues],
  );
  const recoveryScopeKey = `operations-business-entity:${queryContext.groupWorkspaceKey}:${queryContext.scopeRef ?? ''}:${config.kind}`;
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
  const query = useMemo(
    () =>
      contextScopedQueryArgs(
        {
          ...(config.kind === 'BRAND'
            ? {queryText: filters.name?.trim() || undefined}
            : {
                name: filters.name?.trim() || undefined,
                code: filters.code?.trim() || undefined,
                legalName: filters.legalName?.trim() || undefined,
                unifiedSocialCreditCode: filters.unifiedSocialCreditCode?.trim() || undefined,
              }),
          status: filters.status,
          ...extensionQuery,
          sort,
          direction,
          page,
          pageSize,
        },
        queryContext,
      ),
    [
      config.kind,
      direction,
      filters.code,
      filters.legalName,
      filters.name,
      filters.status,
      filters.unifiedSocialCreditCode,
      extensionQuery,
      page,
      pageSize,
      queryContext,
      sort,
    ],
  );
  const path = useMemo(() => ({groupWorkspaceKey: queryContext.groupWorkspaceKey}), [queryContext.groupWorkspaceKey]);
  const brandQuery = operationsRtk.useGetOperationsOrganizationBrandsQuery(
    operationsAdminRtkRequest.getOperationsOrganizationBrands(path, {query}),
    {skip: config.kind !== 'BRAND' || extensionRecoveryBlocked},
  );
  const tenantQuery = operationsRtk.useGetOperationsOrganizationTenantsQuery(
    operationsAdminRtkRequest.getOperationsOrganizationTenants(path, {query}),
    {skip: config.kind !== 'TENANT' || extensionRecoveryBlocked},
  );
  const headCompanyQuery = operationsRtk.useGetOperationsOrganizationHeadCompaniesQuery(
    operationsAdminRtkRequest.getOperationsOrganizationHeadCompanies(path, {query}),
    {skip: config.kind !== 'HEAD_COMPANY' || extensionRecoveryBlocked},
  );
  const activeQuery = config.kind === 'BRAND' ? brandQuery : config.kind === 'TENANT' ? tenantQuery : headCompanyQuery;
  const result = activeQuery.currentData;
  const activeProblem = activeQuery.error ? operationsProblemOf(activeQuery.error) : undefined;
  const definitionProblem = definitionQuery.error ? operationsProblemOf(definitionQuery.error) : undefined;
  const listDataFailed = Boolean(activeQuery.error) || Boolean(definitionQuery.error) || extensionRecoveryFailed;
  const extensionDefinitionProblem = definitionProblem
    ? {
        title: `暂时无法获取${config.kind === 'BRAND' ? '品牌' : config.kind === 'TENANT' ? '经营租户' : '总公司'}字段配置`,
        detail: '请重试。',
      }
    : undefined;
  const extensionRecoveryProblem = extensionRecoveryFailed
    ? {
        title: `暂时无法获取${config.kind === 'BRAND' ? '品牌' : config.kind === 'TENANT' ? '经营租户' : '总公司'}字段配置`,
        detail: '请重试。',
      }
    : undefined;
  const queryProblem = extensionRecoveryProblem ?? activeProblem ?? extensionDefinitionProblem;
  const invalidFilterProblem = activeProblem?.errorCode === 'EXTENSION_FILTER_INVALID' ? activeProblem : undefined;
  const invalidFilterProblemRef = useRef<HTMLDivElement | null>(null);
  useExtensionFilterInvalidFocus(invalidFilterProblemRef, invalidFilterProblem?.invalidFields);
  if (activeProblem?.errorCode === 'EXTENSION_DEFINITION_REVISION_STALE') {
    extensionRecoveryState.current.rememberStaleRevision(recoveryScopeKey, activeProblem.currentDefinitionRevision);
  }
  const recoverExtensionFilters = () => {
    const recovery = extensionRecoveryState.current!.begin(recoveryScopeKey, activeProblem?.currentDefinitionRevision);
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
    stale: activeProblem?.errorCode === 'EXTENSION_DEFINITION_REVISION_STALE',
    staleRevision: activeProblem?.currentDefinitionRevision,
    recover: recoverExtensionFilters,
  });
  const rows = listDataFailed ? [] : ((result?.items ?? []) as unknown as BusinessEntity[]);
  const canCreate = actionCapabilityKeys.includes(config.create);
  const createLabel = actionLabel.get(config.create);
  if (!createLabel) throw new Error('ADMIN_CATALOG_BUSINESS_ENTITY_ACTION_MISSING');

  const columns: ProColumns<BusinessEntity>[] = [
    {
      key: 'name',
      title: config.kind === 'BRAND' ? '品牌名称' : '名称',
      dataIndex: 'name',
      sorter: true,
      fieldProps: {...testId(`operations-business-entity-filter-name-${config.kind.toLowerCase()}`), allowClear: true},
      render: (_, entity) => (
        <Button
          type="link"
          onClick={() => setDetail(entity)}
          {...testId(`operations-business-entity-detail-${entity.id}`)}
        >
          {entity.name}
        </Button>
      ),
    },
    {
      key: 'code',
      title: '编码',
      dataIndex: 'code',
      sorter: true,
      search: config.kind !== 'BRAND',
      fieldProps: {...testId(`operations-business-entity-filter-code-${config.kind.toLowerCase()}`), allowClear: true},
    },
    ...(config.kind === 'BRAND'
      ? [
          {
            key: 'alias',
            title: '别名',
            dataIndex: 'alias',
            search: false,
            render: (_: unknown, entity: BusinessEntity) => ('alias' in entity ? (entity.alias ?? '—') : '—'),
          },
        ]
      : [
          {
            key: 'legalName',
            title: '法人公司',
            dataIndex: 'legalName',
            fieldProps: {
              ...testId(`operations-business-entity-filter-legal-name-${config.kind.toLowerCase()}`),
              allowClear: true,
            },
          },
          {
            key: 'unifiedSocialCreditCode',
            title: '统一代码',
            dataIndex: 'unifiedSocialCreditCode',
            fieldProps: {
              ...testId(`operations-business-entity-filter-unified-code-${config.kind.toLowerCase()}`),
              allowClear: true,
            },
          },
        ]),
    {key: 'remark', title: '备注', dataIndex: 'remark', search: false, render: (_, entity) => entity.remark ?? '—'},
    ...extensionListAndSearchColumns<BusinessEntity>(
      definitionQuery.currentData as ExtensionDefinition | undefined,
      `operations-business-entity-filter-extension-${config.kind.toLowerCase()}`,
    ),
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: Object.fromEntries(
        Object.entries(businessEntityLifecycleLabels).map(([value, label]) => [value, {text: label}]),
      ),
      fieldProps: {
        ...testId(`operations-business-entity-filter-status-${config.kind.toLowerCase()}`),
        allowClear: true,
      },
      render: (_, entity) => (
        <Tag color={entity.status === 'ENABLED' ? 'green' : entity.status === 'VOIDED' ? 'error' : 'default'}>
          {businessEntityLifecycleLabels[entity.status]}
        </Tag>
      ),
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      dataIndex: 'updatedAt',
      sorter: true,
      search: false,
      render: (_, entity) => new Date(entity.updatedAt).toLocaleString(),
    },
  ];

  return (
    <>
      {extensionRecoveryNotice && (
        <Alert
          type="info"
          showIcon
          closable
          title="筛选条件已按最新字段配置更新"
          onClose={() => setExtensionRecoveryNotice(false)}
          {...testId(extensionListRecoveryNoticeTestId(`operations-business-entity-${config.kind.toLowerCase()}`))}
          style={{marginBottom: 16}}
        />
      )}
      {queryProblem && (
        <div
          ref={invalidFilterProblemRef}
          tabIndex={invalidFilterProblem?.invalidFields?.length ? -1 : undefined}
          style={{outline: 'none'}}
        >
          <Alert
            type="error"
            showIcon
            title={queryProblem.title}
            description={
              <>
                <div>{queryProblem.detail}</div>
                <ExtensionFilterInvalidSummary
                  invalidFields={invalidFilterProblem?.invalidFields}
                  definitions={definitionQuery.currentData?.definitions}
                  onClear={() =>
                    clearInvalidExtensionFilterFields(
                      filterFormRef.current,
                      definitionQuery.currentData?.definitions,
                      invalidFilterProblem?.invalidFields,
                    )
                  }
                  testIdPrefix={extensionListInvalidSummaryTestId(
                    `operations-business-entity-${config.kind.toLowerCase()}`,
                  )}
                />
              </>
            }
            action={
              <Button
                onClick={() =>
                  void (extensionRecoveryFailed
                    ? recoverExtensionFilters()
                    : activeProblem?.errorCode === 'EXTENSION_DEFINITION_REVISION_STALE'
                      ? recoverExtensionFilters()
                      : activeProblem
                        ? activeQuery.refetch()
                        : definitionQuery.refetch())
                }
                {...testId(`operations-business-entity-${config.kind.toLowerCase()}-retry`)}
              >
                重试
              </Button>
            }
            style={{marginBottom: 16}}
          />
        </div>
      )}
      <ProTable<BusinessEntity>
        size="small"
        formRef={filterFormRef}
        rowKey="id"
        search={{
          labelWidth: 'auto',
          optionRender: searchConfig => [
            <Button
              key="submit"
              type="primary"
              onClick={() => searchConfig.form?.submit()}
              {...testId(`operations-business-entity-filter-submit-${config.kind.toLowerCase()}`)}
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
              {...testId(`operations-business-entity-filter-reset-${config.kind.toLowerCase()}`)}
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
            legalName: value.legalName?.trim() || undefined,
            unifiedSocialCreditCode: value.unifiedSocialCreditCode?.trim() || undefined,
            status: value.status,
            extensionFilterValues: value.extensionFilterValues as Record<string, unknown>,
          });
          pagination.setPage(1);
        }}
        options={false}
        columns={columns}
        dataSource={rows}
        {...adminListState({
          loading: activeQuery.isFetching || extensionRecoveryInProgress,
          failed: listDataFailed,
          emptyText: '当前结果域暂无记录',
          testIdPrefix: `operations-business-entity-${config.kind.toLowerCase()}`,
        })}
        toolBarRender={() =>
          canCreate
            ? [
                <Button
                  key="create"
                  type="primary"
                  onClick={() => setCreating(true)}
                  {...testId(`operations-business-entity-create-${config.kind.toLowerCase()}`)}
                >
                  {createLabel}
                </Button>,
              ]
            : []
        }
        pagination={{current: page, pageSize, total: result?.metadata.total ?? 0, showSizeChanger: true}}
        onChange={(tablePagination, _, sorter, extra) => {
          if (extra.action === 'paginate') {
            pagination.setPage(tablePagination.current ?? page);
            pagination.setPageSize(tablePagination.pageSize ?? pageSize);
            return;
          }
          if (extra.action !== 'sort') return;
          const current = Array.isArray(sorter) ? sorter[0] : sorter;
          if (!current?.order) {
            setSort('NAME');
            setDirection('ASC');
            return;
          }
          const nextSort =
            current?.columnKey === 'name' ? 'NAME' : current?.columnKey === 'code' ? 'CODE' : 'UPDATED_AT';
          setSort(nextSort);
          setDirection(current.order === 'ascend' ? 'ASC' : 'DESC');
          pagination.setPage(1);
        }}
        {...testId(`operations-business-entity-${config.kind.toLowerCase()}-page`)}
      />
      <BusinessEntityDetailDrawer
        entity={detail}
        kind={config.kind}
        queryContext={queryContext}
        actionCapabilityKeys={actionCapabilityKeys}
        onClose={() => setDetail(undefined)}
        onEdit={entity => {
          setDetail(undefined);
          setEditing(entity);
        }}
        onStatus={(entity, targetStatus) => {
          setDetail(undefined);
          setTransitioning({entity, targetStatus});
        }}
        onAuthorizeBrands={entity => {
          setDetail(undefined);
          setAuthorizing(entity);
        }}
      />
      <BusinessEntityCreateDrawer
        open={creating}
        kind={config.kind}
        queryContext={queryContext}
        onClose={() => setCreating(false)}
        onCreated={entity => {
          setCreating(false);
          setDetail(entity);
        }}
      />
      <BusinessEntityEditDrawer
        entity={editing}
        kind={config.kind}
        queryContext={queryContext}
        onClose={() => setEditing(undefined)}
        onUpdated={entity => {
          setEditing(undefined);
          setDetail(entity);
        }}
      />
      <BusinessEntityStatusModal
        entity={transitioning?.entity}
        targetStatus={transitioning?.targetStatus}
        kind={config.kind}
        queryContext={queryContext}
        onClose={() => setTransitioning(undefined)}
        onUpdated={entity => {
          setTransitioning(undefined);
          setDetail(entity);
        }}
      />
      <HeadCompanyBrandAuthorizationDrawer
        headCompany={authorizing}
        queryContext={queryContext}
        onClose={() => setAuthorizing(undefined)}
        onUpdated={entity => {
          setAuthorizing(entity);
        }}
      />
    </>
  );
}
