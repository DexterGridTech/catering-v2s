import {Alert, Button, Select} from 'antd';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {contextScopedQueryArgs, formatNameCode, testId, useDetailDrawer, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import type {StoreContract, StoreContractSortDirection, StoreContractSortKey} from '../../../app/api/generated/operations-edge';
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
  projectId?: string;
  storeId?: string;
  contractNo?: string;
  phaseName?: string;
  tenantName?: string;
  status?: 'VALID' | 'INVALID';
  dateFrom?: string;
  dateTo?: string;
};

const contractPage = adminCatalog.operationsPages.find((page) => page.pageDesignKey === operationsPageDesignKeys.PgContractStoreManage);
const contractPageTitle = contractPage?.pageTitle;
if (!contractPageTitle) throw new Error('ADMIN_CATALOG_CONTRACT_PAGE_MISSING');

export function ContractManagementPage({queryContext, actionCapabilityKeys}: OperationsPageProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<ContractFilters>({});
  const [projectSearch, setProjectSearch] = useState('');
  const [sort, setSort] = useState<StoreContractSortKey>('UPDATED_AT');
  const [direction, setDirection] = useState<StoreContractSortDirection>('DESC');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<StoreContract>();
  const [invalidating, setInvalidating] = useState<StoreContract>();
  const detail = useDetailDrawer<StoreContract>();
  useOverlayLock(detail.isOpen || createOpen || Boolean(editing) || Boolean(invalidating));
  const projectId = filters.projectId;
  const projectCandidates = useOrganizationCandidates({open: Boolean(queryContext.scopeRef), queryContext, subjectType: 'PROJECT', queryText: projectSearch, selectedId: projectId});

  const query = useMemo(() => contextScopedQueryArgs({
    ...filters, projectId: projectId ?? '', sort, direction, page, pageSize,
  }, queryContext), [direction, filters, page, pageSize, projectId, queryContext, sort]);
  const listRequest = useMemo(() => operationsAdminRtkRequest.getOperationsContracts(
    {groupWorkspaceKey: queryContext.groupWorkspaceKey},
    {query},
  ), [query, queryContext.groupWorkspaceKey]);
  const list = operationsRtk.useGetOperationsContractsQuery(listRequest, {skip: !projectId});
  const candidates = useContractStoreCandidates({open: true, queryContext, projectId});
  const canCreate = actionCapabilityKeys.includes(ACTION_CAPABILITIES.CONTRACT_CREATE);
  const canEdit = actionCapabilityKeys.includes(ACTION_CAPABILITIES.CONTRACT_EDIT);
  const canInvalidate = actionCapabilityKeys.includes(ACTION_CAPABILITIES.CONTRACT_INVALIDATE);
  const problem = !queryContext.scopeRef
    ? '请先选择数据范围。'
    : projectCandidates.error
      ? '项目候选暂时无法获取，请重试。'
      : !projectId
        ? '请先选择项目。'
    : list.error
      ? '合同列表暂时无法获取，请重试。'
      : candidates.error
        ? '门店候选暂时无法获取，请重试后再筛选或创建合同。'
        : undefined;

  useEffect(() => {
    if (!filters.projectId || projectCandidates.items.some((project) => project.id === filters.projectId)) return;
    setFilters((current) => ({...current, projectId: undefined, storeId: undefined}));
    setPage(1);
  }, [filters.projectId, projectCandidates.items]);

  const columns = useMemo<ProColumns<StoreContract>[]>(() => [
    {key: 'contractNo', title: '合同编号', dataIndex: 'contractNo', sorter: true, ellipsis: true, hideInSearch: true, render: (value, row) => <Button type="link" onClick={() => detail.open(row)} {...testId('operations-contract-detail-open')}>{value}</Button>},
    {title: '门店', dataIndex: 'storeDisplay', hideInSearch: true, render: (_, row) => formatNameCode(row.store.name, row.store.code)},
    {title: '分期', dataIndex: 'phaseName', hideInSearch: true},
    {title: '经营租户', dataIndex: 'tenantDisplay', hideInSearch: true, render: (_, row) => formatNameCode(row.tenant.name, row.tenant.code)},
    {key: 'effectiveFrom', title: '起止日期', dataIndex: 'effectiveDisplay', sorter: true, hideInSearch: true, render: (_, row) => `${row.effectiveFrom} 至 ${row.effectiveTo ?? '长期'}`},
    {title: '状态', dataIndex: 'status', hideInSearch: true, valueEnum: {VALID: {text: '有效', status: 'Success'}, INVALID: {text: '已失效', status: 'Default'}}},
    {title: '门店', dataIndex: 'storeId', hideInTable: true, renderFormItem: () => <Select allowClear disabled={Boolean(candidates.error)} showSearch={{filterOption: false, onSearch: candidates.setStoreSearch}} onPopupScroll={candidates.onPopupScroll} loading={candidates.isFetching} options={candidates.stores.map((store) => ({value: store.id, label: formatNameCode(store.name, store.code)}))} {...testId('operations-contract-filter-store')}/>},
    {title: '项目', dataIndex: 'projectId', hideInTable: true, renderFormItem: () => <Select allowClear showSearch={{filterOption: false, onSearch: setProjectSearch}} onPopupScroll={projectCandidates.onPopupScroll} loading={projectCandidates.isFetching} options={projectCandidates.items.map((project) => ({value: project.id, label: formatNameCode(project.name, project.code)}))} {...testId('operations-contract-filter-project')}/>},
    {title: '合同编号', dataIndex: 'contractNo', hideInTable: true},
    {title: '分期', dataIndex: 'phaseName', hideInTable: true},
    {title: '经营租户', dataIndex: 'tenantName', hideInTable: true},
    {title: '状态', dataIndex: 'status', hideInTable: true, valueType: 'select', valueEnum: {VALID: {text: '有效'}, INVALID: {text: '已失效'}}},
    {title: '起止日期', dataIndex: 'dateRange', hideInTable: true, valueType: 'dateRange'},
  ], [candidates.error, candidates.isFetching, candidates.onPopupScroll, candidates.setStoreSearch, candidates.stores, detail, projectCandidates.items, projectCandidates.isFetching, projectCandidates.onPopupScroll]);

  const showOwnerReadback = (contract: StoreContract) => { detail.open(contract); };

  const retry = candidates.error ? () => void candidates.refetch() : list.error ? () => void list.refetch() : undefined;
  return <>
    {problem && <Alert type="error" showIcon title="合同页面暂时不可用" description={problem} action={retry ? <Button onClick={retry} {...testId('operations-contract-page-retry')}>重试</Button> : undefined} style={{marginBottom: 16}}/>}
    <ProTable<StoreContract>
      aria-label={contractPageTitle} rowKey="id" options={false} loading={list.isLoading && !list.data}
      dataSource={list.data?.items ?? []} columns={columns} search={{labelWidth: 'auto', optionRender: (searchConfig) => [
        <Button key="submit" type="primary" onClick={() => searchConfig.form?.submit()} {...testId('operations-contract-filter-submit')}>查询</Button>,
        <Button key="reset" onClick={() => { searchConfig.form?.resetFields(); setFilters({}); setPage(1); setProjectSearch(''); }} {...testId('operations-contract-filter-reset')}>重置</Button>,
      ]}}
      onSubmit={(values) => { const dateRange = values.dateRange as string[] | undefined; const projectChanged = values.projectId !== filters.projectId; if (projectChanged) { setCreateOpen(false); setProjectSearch(''); } setFilters({projectId: values.projectId, storeId: projectChanged ? undefined : values.storeId, contractNo: values.contractNo, phaseName: values.phaseName, tenantName: values.tenantName, status: values.status, dateFrom: dateRange?.[0], dateTo: dateRange?.[1]}); setPage(1); }}
      toolBarRender={() => canCreate ? [<Button key="create" type="primary" disabled={!projectId} onClick={() => setCreateOpen(true)} {...testId('operations-contract-create-open')}>新建合同</Button>] : []}
      pagination={{current: page, pageSize, total: list.data?.metadata.total ?? 0, showSizeChanger: true, onChange: (nextPage, nextSize) => { setPage(nextPage); setPageSize(nextSize); }}}
      onChange={(_, __, sorter) => {
        const current = Array.isArray(sorter) ? sorter[0] : sorter;
        if (!current?.order) {
          setSort('UPDATED_AT');
          setDirection('DESC');
          return;
        }
        const nextSort = current?.columnKey === 'contractNo' ? 'CONTRACT_NO' : current?.columnKey === 'effectiveFrom' ? 'EFFECTIVE_FROM' : 'UPDATED_AT';
        setSort(nextSort);
        setDirection(current.order === 'ascend' ? 'ASC' : 'DESC');
        setPage(1);
      }}
      locale={{emptyText: projectId ? '暂无合同' : '请先选择项目'}} {...testId('operations-contract-page')}
    />
    <ContractDetailDrawer contract={detail.target} queryContext={queryContext} canEdit={canEdit} canInvalidate={canInvalidate} onClose={detail.close} onEdit={(contract) => { detail.close(); setEditing(contract); }} onInvalidate={(contract) => { detail.close(); setInvalidating(contract); }}/>
    <ContractCreateDrawer open={createOpen} queryContext={queryContext} projectId={projectId} onClose={() => setCreateOpen(false)} onCreated={(contract) => { setCreateOpen(false); showOwnerReadback(contract); }}/>
    <ContractEditDrawer contract={editing} queryContext={queryContext} onClose={() => setEditing(undefined)} onUpdated={(contract) => { setEditing(undefined); showOwnerReadback(contract); }} onConflict={(contract) => { setEditing(undefined); showOwnerReadback(contract); }}/>
    <ContractInvalidateModal contract={invalidating} queryContext={queryContext} onClose={() => setInvalidating(undefined)} onInvalidated={(contract) => { setInvalidating(undefined); showOwnerReadback(contract); }}/>
  </>;
}
