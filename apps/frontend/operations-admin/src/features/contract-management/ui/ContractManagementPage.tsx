import {Alert, Button, Select} from 'antd';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {contextScopedQueryArgs, testId, useDetailDrawer, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useMemo, useState} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import type {StoreContract} from '../../../app/api/generated/operations-edge';
import {ACTION_CAPABILITIES, adminCatalog, operationsPageDesignKeys} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {ContractCreateDrawer} from './ContractCreateDrawer';
import {ContractDetailDrawer} from './ContractDetailDrawer';
import {ContractEditDrawer} from './ContractEditDrawer';
import {ContractInvalidateModal} from './ContractInvalidateModal';

type ContractFilters = {
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
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<ContractFilters>({});
  const [storeSearch, setStoreSearch] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<StoreContract>();
  const [invalidating, setInvalidating] = useState<StoreContract>();
  const detail = useDetailDrawer<StoreContract>();
  useOverlayLock(detail.isOpen || createOpen || Boolean(editing) || Boolean(invalidating));

  const query = useMemo(() => contextScopedQueryArgs({
    projectId: queryContext.scopeRef ?? '', ...filters, page, pageSize,
  }, queryContext), [filters, page, pageSize, queryContext]);
  const listRequest = useMemo(() => operationsAdminRtkRequest.getOperationsContracts(
    {groupWorkspaceKey: queryContext.groupWorkspaceKey},
    {query},
  ), [query, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey]);
  const list = operationsRtk.useGetOperationsContractsQuery(listRequest, {skip: !queryContext.scopeRef});
  const candidateRequest = useMemo(() => operationsAdminRtkRequest.getOperationsContractCandidates(
    {groupWorkspaceKey: queryContext.groupWorkspaceKey},
    {query: {expectedContextVersion: queryContext.expectedContextVersion, projectId: queryContext.scopeRef ?? '', storeSearch, page: 1, pageSize: 100}},
  ), [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, queryContext.scopeRef, storeSearch]);
  const candidates = operationsRtk.useGetOperationsContractCandidatesQuery(candidateRequest, {skip: !queryContext.scopeRef});
  const canCreate = actionCapabilityKeys.includes(ACTION_CAPABILITIES.CONTRACT_CREATE);
  const canEdit = actionCapabilityKeys.includes(ACTION_CAPABILITIES.CONTRACT_EDIT);
  const canInvalidate = actionCapabilityKeys.includes(ACTION_CAPABILITIES.CONTRACT_INVALIDATE);
  const problem = !queryContext.scopeRef ? '请先选择项目数据范围。' : list.error ? '合同列表暂时无法获取，请重试。' : undefined;

  const columns = useMemo<ProColumns<StoreContract>[]>(() => [
    {title: '合同编号', dataIndex: 'contractNo', ellipsis: true, hideInSearch: true, render: (value, row) => <Button type="link" onClick={() => detail.open(row)} {...testId('operations-contract-detail-open')}>{value}</Button>},
    {title: '门店', dataIndex: 'storeDisplay', hideInSearch: true, render: (_, row) => row.store.name},
    {title: '项目分期', dataIndex: 'phaseName', hideInSearch: true},
    {title: '经营租户', dataIndex: 'tenantDisplay', hideInSearch: true, render: (_, row) => row.tenant.name},
    {title: '起止日期', dataIndex: 'effectiveDisplay', hideInSearch: true, render: (_, row) => `${row.effectiveFrom} 至 ${row.effectiveTo ?? '长期'}`},
    {title: '状态', dataIndex: 'status', hideInSearch: true, valueEnum: {VALID: {text: '有效', status: 'Success'}, INVALID: {text: '已失效', status: 'Default'}}},
    {title: '门店', dataIndex: 'storeId', hideInTable: true, renderFormItem: () => <Select allowClear showSearch filterOption={false} loading={candidates.isLoading} options={(candidates.data?.stores ?? []).map((store) => ({value: store.id, label: `${store.name}（${store.code}）`}))} onSearch={setStoreSearch} {...testId('operations-contract-filter-store')}/>},
    {title: '合同编号', dataIndex: 'contractNo', hideInTable: true},
    {title: '分期', dataIndex: 'phaseName', hideInTable: true},
    {title: '经营租户', dataIndex: 'tenantName', hideInTable: true},
    {title: '状态', dataIndex: 'status', hideInTable: true, valueType: 'select', valueEnum: {VALID: {text: '有效'}, INVALID: {text: '已失效'}}},
    {title: '起止日期', dataIndex: 'dateRange', hideInTable: true, valueType: 'dateRange'},
  ], [candidates.data?.stores, candidates.isLoading, detail]);

  const showOwnerReadback = (contract: StoreContract) => { detail.open(contract); };

  return <>
    {problem && <Alert type="error" showIcon message="合同页面暂时不可用" description={problem} style={{marginBottom: 16}}/>}
    <ProTable<StoreContract>
      headerTitle={contractPageTitle} rowKey="id" options={false} loading={list.isLoading && !list.data}
      dataSource={list.data?.items ?? []} columns={columns} search={{labelWidth: 'auto'}}
      form={{onFinish: (values) => { const dateRange = values.dateRange as string[] | undefined; setFilters({storeId: values.storeId, contractNo: values.contractNo, phaseName: values.phaseName, tenantName: values.tenantName, status: values.status, dateFrom: dateRange?.[0], dateTo: dateRange?.[1]}); setPage(1); }}}
      toolBarRender={() => canCreate ? [<Button key="create" type="primary" disabled={!queryContext.scopeRef} onClick={() => setCreateOpen(true)} {...testId('operations-contract-create-open')}>新建合同</Button>] : []}
      pagination={{current: page, pageSize, total: list.data?.metadata.total ?? 0, showSizeChanger: true, onChange: (nextPage, nextSize) => { setPage(nextPage); setPageSize(nextSize); }}}
      locale={{emptyText: queryContext.scopeRef ? '暂无合同' : '请先选择项目数据范围'}} {...testId('operations-contract-page')}
    />
    <ContractDetailDrawer contract={detail.target} queryContext={queryContext} canEdit={canEdit} canInvalidate={canInvalidate} onClose={detail.close} onEdit={(contract) => { detail.close(); setEditing(contract); }} onInvalidate={(contract) => { detail.close(); setInvalidating(contract); }}/>
    <ContractCreateDrawer open={createOpen} queryContext={queryContext} onClose={() => setCreateOpen(false)} onCreated={(contract) => { setCreateOpen(false); showOwnerReadback(contract); }}/>
    <ContractEditDrawer contract={editing} queryContext={queryContext} onClose={() => setEditing(undefined)} onUpdated={(contract) => { setEditing(undefined); showOwnerReadback(contract); }} onConflict={(contract) => { setEditing(undefined); showOwnerReadback(contract); }}/>
    <ContractInvalidateModal contract={invalidating} queryContext={queryContext} onClose={() => setInvalidating(undefined)} onInvalidated={(contract) => { setInvalidating(undefined); showOwnerReadback(contract); }}/>
  </>;
}
