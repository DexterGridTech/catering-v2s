import {Alert, Button} from 'antd';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {
  adminListState,
  contextScopedQueryArgs,
  NameCodeText,
  testId,
  useDetailDrawer,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useMemo, useState} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import type {
  OrganizationStore,
  OrganizationStoreSortDirection,
  OrganizationStoreSortKey,
  OrganizationStoreStatus,
} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {ACTION_CAPABILITIES, adminCatalog, operationsPageDesignKeys} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';
import {OperationsAuditHistoryModal} from '../../audit-history';
import {StoreCreateDrawer} from './StoreCreateDrawer';
import {StoreDetailDrawer} from './StoreDetailDrawer';
import {StoreEditDrawer} from './StoreEditDrawer';
import {StoreStatusModal} from './StoreStatusModal';

type StoreFilters = {name?: string; code?: string; status?: OrganizationStoreStatus};
const page = adminCatalog.operationsPages.find(
  entry => entry.pageDesignKey === operationsPageDesignKeys.PgOrgStoreManage,
);
const storePageTitle = page?.pageTitle;
if (!storePageTitle) throw new Error('ADMIN_CATALOG_STORE_PAGE_MISSING');

export function StoreManagementPage({queryContext, actionCapabilityKeys}: OperationsPageProps) {
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<StoreFilters>({});
  const [sort, setSort] = useState<OrganizationStoreSortKey>('UPDATED_AT');
  const [direction, setDirection] = useState<OrganizationStoreSortDirection>('DESC');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationStore>();
  const [statusTarget, setStatusTarget] = useState<OrganizationStore>();
  const [message, setMessage] = useState<string>();
  const [auditOpen, setAuditOpen] = useState(false);
  const detail = useDetailDrawer<OrganizationStore>();
  useOverlayLock(Boolean(statusTarget));
  const context = contextScopedQueryArgs({}, queryContext);
  const scopeReady = Boolean(queryContext.scopeRef);
  const listRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsOrganizationStores(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {query: {...context, ...filters, sort, direction, page: current, pageSize}},
      ),
    [context, current, direction, filters, pageSize, queryContext.groupWorkspaceKey, sort],
  );
  const list = operationsRtk.useGetOperationsOrganizationStoresQuery(listRequest, {skip: !scopeReady});
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
      {key: 'notes', title: '备注', dataIndex: 'notes', search: false, render: (_, row) => row.notes ?? '—'},
      {
        title: '状态',
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: {ENABLED: {text: '启用', status: 'Success'}, DISABLED: {text: '停用', status: 'Default'}},
        fieldProps: {...testId('operations-store-filter-status'), allowClear: true, placeholder: '状态'},
      },
    ],
    [openDetail],
  );
  // The shell-owned context bar is the sole missing-project prompt for every
  // scoped page. This page only reports a real list or command failure.
  const problem = message ?? (list.error ? '门店数据暂时无法获取，请重试。' : undefined);
  const selected = detail.target;
  return (
    <section {...testId('operations-store-page')}>
      {problem && (
        <Alert type="error" showIcon title="门店管理未完成" description={problem} style={{marginBottom: 16}} />
      )}
      <ProTable<OrganizationStore>
        size="small"
        aria-label={storePageTitle}
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
                searchConfig.form?.resetFields();
                setFilters({});
                setCurrent(1);
              }}
              {...testId('operations-store-filter-reset')}
            >
              重置
            </Button>,
          ],
        }}
        onSubmit={value => {
          setFilters({
            name: value.name?.trim() || undefined,
            code: value.code?.trim() || undefined,
            status: value.status,
          });
          setCurrent(1);
        }}
        options={false}
        {...adminListState({
          loading: list.isFetching,
          failed: Boolean(list.error),
          emptyText: '暂无门店',
          testIdPrefix: 'operations-store-list',
        })}
        dataSource={list.currentData?.items ?? []}
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
        pagination={{current, pageSize, total: list.currentData?.metadata.total ?? 0, showSizeChanger: true}}
        onChange={(pagination, _, sorter, extra) => {
          if (extra.action === 'paginate') {
            setCurrent(pagination.current ?? current);
            setPageSize(pagination.pageSize ?? pageSize);
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
          setCurrent(1);
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
