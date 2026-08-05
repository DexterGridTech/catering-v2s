import {Alert, Button, Tag} from 'antd';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {contextScopedQueryArgs, testId} from '@catering-v2s/admin-ui-foundation';
import {useMemo, useState} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {type BusinessEntitySortDirection, type BusinessEntitySortKey, type BusinessEntityStatus, type HeadCompany} from '../../../app/api/generated/operations-edge';
import {ACTION_CAPABILITIES, adminCatalog, operationsPageDesignKeys, type OperationsPageDesignKey} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';
import {BusinessEntityCreateDrawer} from './BusinessEntityCreateDrawer';
import {BusinessEntityDetailDrawer, type BusinessEntity} from './BusinessEntityDetailDrawer';
import {BusinessEntityEditDrawer} from './BusinessEntityEditDrawer';
import {BusinessEntityStatusModal} from './BusinessEntityStatusModal';
import {HeadCompanyBrandAuthorizationDrawer} from './HeadCompanyBrandAuthorizationDrawer';

type Props = OperationsPageProps & {pageDesignKey: Extract<OperationsPageDesignKey,
  typeof operationsPageDesignKeys.PgOrgBrand | typeof operationsPageDesignKeys.PgOrgTenant | typeof operationsPageDesignKeys.PgOrgHeadCompany>};
type Filters = {name?: string; code?: string; legalName?: string; unifiedSocialCreditCode?: string; status?: BusinessEntityStatus};

const configByKey = {
  [operationsPageDesignKeys.PgOrgBrand]: {kind: 'BRAND', create: ACTION_CAPABILITIES.ORG_BRAND_CREATE, edit: ACTION_CAPABILITIES.ORG_BRAND_EDIT, status: ACTION_CAPABILITIES.ORG_BRAND_STATUS},
  [operationsPageDesignKeys.PgOrgTenant]: {kind: 'TENANT', create: ACTION_CAPABILITIES.ORG_TENANT_CREATE, edit: ACTION_CAPABILITIES.ORG_TENANT_EDIT, status: ACTION_CAPABILITIES.ORG_TENANT_STATUS},
  [operationsPageDesignKeys.PgOrgHeadCompany]: {kind: 'HEAD_COMPANY', create: ACTION_CAPABILITIES.ORG_HEAD_COMPANY_CREATE, edit: ACTION_CAPABILITIES.ORG_HEAD_COMPANY_EDIT, status: ACTION_CAPABILITIES.ORG_HEAD_COMPANY_STATUS},
} as const;

const actionLabel = new Map(adminCatalog.actions.map((action) => [action.actionKey, action.actionLabel]));

export function BusinessEntityManagementPage({pageDesignKey, queryContext, actionCapabilityKeys}: Props) {
  const config = configByKey[pageDesignKey];
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<BusinessEntitySortKey>('NAME');
  const [direction, setDirection] = useState<BusinessEntitySortDirection>('ASC');
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<BusinessEntity>();
  const [editing, setEditing] = useState<BusinessEntity>();
  const [transitioning, setTransitioning] = useState<BusinessEntity>();
  const [authorizing, setAuthorizing] = useState<HeadCompany>();
  const query = useMemo(() => contextScopedQueryArgs({
    ...(config.kind === 'BRAND' ? {queryText: filters.name?.trim() || undefined} : {
      name: filters.name?.trim() || undefined,
      code: filters.code?.trim() || undefined,
      legalName: filters.legalName?.trim() || undefined,
      unifiedSocialCreditCode: filters.unifiedSocialCreditCode?.trim() || undefined,
    }),
    status: filters.status,
    sort,
    direction,
    page,
    pageSize,
  }, queryContext), [config.kind, direction, filters.code, filters.legalName, filters.name, filters.status, filters.unifiedSocialCreditCode, page, pageSize, queryContext, sort]);
  const path = useMemo(() => ({groupWorkspaceKey: queryContext.groupWorkspaceKey}), [queryContext.groupWorkspaceKey]);
  const brandQuery = operationsRtk.useGetOperationsOrganizationBrandsQuery(
    operationsAdminRtkRequest.getOperationsOrganizationBrands(path, {query}), {skip: config.kind !== 'BRAND'},
  );
  const tenantQuery = operationsRtk.useGetOperationsOrganizationTenantsQuery(
    operationsAdminRtkRequest.getOperationsOrganizationTenants(path, {query}), {skip: config.kind !== 'TENANT'},
  );
  const headCompanyQuery = operationsRtk.useGetOperationsOrganizationHeadCompaniesQuery(
    operationsAdminRtkRequest.getOperationsOrganizationHeadCompanies(path, {query}), {skip: config.kind !== 'HEAD_COMPANY'},
  );
  const activeQuery = config.kind === 'BRAND' ? brandQuery : config.kind === 'TENANT' ? tenantQuery : headCompanyQuery;
  const result = activeQuery.data;
  const rows = (result?.items ?? []) as unknown as BusinessEntity[];
  const canCreate = actionCapabilityKeys.includes(config.create);
  const createLabel = actionLabel.get(config.create);
  if (!createLabel) throw new Error('ADMIN_CATALOG_BUSINESS_ENTITY_ACTION_MISSING');

  const columns: ProColumns<BusinessEntity>[] = [
    {key: 'name', title: config.kind === 'BRAND' ? '品牌名称' : '名称', dataIndex: 'name', sorter: true, fieldProps: {...testId(`operations-business-entity-filter-name-${config.kind.toLowerCase()}`), allowClear: true}, render: (_, entity) => <Button type="link" onClick={() => setDetail(entity)} {...testId(`operations-business-entity-detail-${entity.id}`)}>{entity.name}</Button>},
    {key: 'code', title: '编码', dataIndex: 'code', sorter: true, search: config.kind !== 'BRAND', fieldProps: {...testId(`operations-business-entity-filter-code-${config.kind.toLowerCase()}`), allowClear: true}},
    ...(config.kind === 'BRAND' ? [
      {key: 'alias', title: '别名', dataIndex: 'alias', search: false, render: (_: unknown, entity: BusinessEntity) => ('alias' in entity ? entity.alias ?? '—' : '—')},
    ] : [
      {key: 'legalName', title: '法人公司', dataIndex: 'legalName', fieldProps: {...testId(`operations-business-entity-filter-legal-name-${config.kind.toLowerCase()}`), allowClear: true}},
      {key: 'unifiedSocialCreditCode', title: '统一代码', dataIndex: 'unifiedSocialCreditCode', fieldProps: {...testId(`operations-business-entity-filter-unified-code-${config.kind.toLowerCase()}`), allowClear: true}},
    ]),
    {key: 'remark', title: '备注', dataIndex: 'remark', search: false, render: (_, entity) => entity.remark ?? '—'},
    {title: '状态', dataIndex: 'status', valueType: 'select', valueEnum: {ENABLED: {text: '启用'}, DISABLED: {text: '停用'}}, fieldProps: {...testId(`operations-business-entity-filter-status-${config.kind.toLowerCase()}`), allowClear: true}, render: (_, entity) => <Tag color={entity.status === 'ENABLED' ? 'green' : 'default'}>{entity.status === 'ENABLED' ? '启用' : '停用'}</Tag>},
    {key: 'updatedAt', title: '更新时间', dataIndex: 'updatedAt', sorter: true, search: false, render: (_, entity) => new Date(entity.updatedAt).toLocaleString()},
  ];

  return <>
    {activeQuery.error && <Alert type="error" showIcon title="经营实体加载失败" style={{marginBottom: 16}}/>}
    <ProTable<BusinessEntity>
      rowKey="id"
      search={{labelWidth: 'auto', optionRender: (searchConfig) => [<Button key="submit" type="primary" onClick={() => searchConfig.form?.submit()} {...testId(`operations-business-entity-filter-submit-${config.kind.toLowerCase()}`)}>查询</Button>, <Button key="reset" onClick={() => { searchConfig.form?.resetFields(); setFilters({}); setPage(1); }} {...testId(`operations-business-entity-filter-reset-${config.kind.toLowerCase()}`)}>重置</Button>]}}
      onSubmit={(value) => { setFilters({name: value.name?.trim() || undefined, code: value.code?.trim() || undefined, legalName: value.legalName?.trim() || undefined, unifiedSocialCreditCode: value.unifiedSocialCreditCode?.trim() || undefined, status: value.status}); setPage(1); }}
      options={false}
      columns={columns}
      dataSource={rows}
      loading={activeQuery.isLoading}
      toolBarRender={() => canCreate ? [<Button key="create" type="primary" onClick={() => setCreating(true)} {...testId(`operations-business-entity-create-${config.kind.toLowerCase()}`)}>{createLabel}</Button>] : []}
      pagination={{current: page, pageSize, total: result?.metadata.total ?? 0}}
      onChange={(pagination, _, sorter, extra) => {
        if (extra.action === 'paginate') { setPage(pagination.current ?? page); setPageSize(pagination.pageSize ?? pageSize); return; }
        if (extra.action !== 'sort') return;
        const current = Array.isArray(sorter) ? sorter[0] : sorter;
        if (!current?.order) {
          setSort('NAME');
          setDirection('ASC');
          return;
        }
        const nextSort = current?.columnKey === 'name' ? 'NAME' : current?.columnKey === 'code' ? 'CODE' : 'UPDATED_AT';
        setSort(nextSort);
        setDirection(current.order === 'ascend' ? 'ASC' : 'DESC');
        setPage(1);
      }}
      {...testId(`operations-business-entity-${config.kind.toLowerCase()}-page`)}
    />
    <BusinessEntityDetailDrawer entity={detail} kind={config.kind} queryContext={queryContext} actionCapabilityKeys={actionCapabilityKeys} onClose={() => setDetail(undefined)} onEdit={(entity) => { setDetail(undefined); setEditing(entity); }} onStatus={(entity) => { setDetail(undefined); setTransitioning(entity); }} onAuthorizeBrands={(entity) => { setDetail(undefined); setAuthorizing(entity); }}/>
    <BusinessEntityCreateDrawer open={creating} kind={config.kind} queryContext={queryContext} onClose={() => setCreating(false)} onCreated={(entity) => { setCreating(false); setDetail(entity); }}/>
    <BusinessEntityEditDrawer entity={editing} kind={config.kind} queryContext={queryContext} onClose={() => setEditing(undefined)} onUpdated={(entity) => { setEditing(undefined); setDetail(entity); }}/>
    <BusinessEntityStatusModal entity={transitioning} kind={config.kind} queryContext={queryContext} onClose={() => setTransitioning(undefined)} onUpdated={(entity) => { setTransitioning(undefined); setDetail(entity); }}/>
    <HeadCompanyBrandAuthorizationDrawer headCompany={authorizing} queryContext={queryContext} onClose={() => setAuthorizing(undefined)} onUpdated={(entity) => { setAuthorizing(undefined); setDetail(entity); }}/>
  </>;
}
