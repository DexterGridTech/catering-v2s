import {Alert, Button, Card, Descriptions, Spin, Table, Tabs} from 'antd';
import {contextScopedQueryArgs, formatNameCode, testId, useDetailDrawer} from '@catering-v2s/admin-ui-foundation';
import {useMemo, useState} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import type {ExtensionDefinition, JsonValue, OrganizationStore, StoreContract, StoreContractViewState} from '../../../app/api/generated/operations-edge';
import {adminCatalog, operationsPageDesignKeys} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {FixedStoreContractDetailDrawer} from './FixedStoreContractDetailDrawer';

const storeProfilePage = adminCatalog.operationsPages.find((page) => page.pageDesignKey === operationsPageDesignKeys.PgStoreProfile);
const storeProfilePageTitle = storeProfilePage?.pageTitle;
if (!storeProfilePageTitle) throw new Error('ADMIN_CATALOG_STORE_PROFILE_PAGE_MISSING');

const contractViewTabs: Array<{key: StoreContractViewState; label: string; emptyText: string}> = [
  {key: 'CURRENT', label: '当前', emptyText: '当前没有生效合同'},
  {key: 'PENDING_EFFECTIVE', label: '待生效', emptyText: '当前没有待生效合同'},
  {key: 'HISTORY', label: '历史', emptyText: '当前没有历史合同'},
  {key: 'INVALID', label: '已作废', emptyText: '当前没有已作废合同'},
];

function extensionItems(definition: ExtensionDefinition | undefined, values: Record<string, JsonValue> | undefined) {
  return (definition?.definitions ?? [])
    .filter((field) => field.status !== 'DISABLED')
    .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0))
    .map((field) => ({key: `extension-${field.key}`, label: field.label, children: valueOf(values?.[field.key])}));
}

function valueOf(value: JsonValue | undefined) {
  return value === undefined || value === null || value === '' ? '—' : String(value);
}

function queryIssue(error: unknown, fallback: string) {
  return error ? fallback : undefined;
}

/** Store-role profile: all facts, contract state and pagination remain owner reads. */
export function StoreProfilePage({queryContext}: OperationsPageProps) {
  const [state, setState] = useState<StoreContractViewState>('CURRENT');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const detail = useDetailDrawer<StoreContract>();
  const scopeReady = Boolean(queryContext.scopeRef);
  const path = useMemo(() => ({groupWorkspaceKey: queryContext.groupWorkspaceKey}), [queryContext.groupWorkspaceKey]);
  const profileRequest = useMemo(() => operationsAdminRtkRequest.getOperationsStoreProfile(path, {
    query: contextScopedQueryArgs({}, {groupWorkspaceKey: queryContext.groupWorkspaceKey, expectedContextVersion: queryContext.expectedContextVersion, scopeRef: queryContext.scopeRef}),
  }), [path, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, queryContext.scopeRef]);
  const definitionRequest = useMemo(() => operationsAdminRtkRequest.getOperationsOrganizationStoreExtensionDefinition(path, {
    query: contextScopedQueryArgs({}, {groupWorkspaceKey: queryContext.groupWorkspaceKey, expectedContextVersion: queryContext.expectedContextVersion, scopeRef: queryContext.scopeRef}),
  }), [path, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, queryContext.scopeRef]);
  const contractRequest = useMemo(() => operationsAdminRtkRequest.getOperationsFixedStoreContracts(path, {
    query: contextScopedQueryArgs({state, page, pageSize}, {groupWorkspaceKey: queryContext.groupWorkspaceKey, expectedContextVersion: queryContext.expectedContextVersion, scopeRef: queryContext.scopeRef}),
  }), [page, pageSize, path, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, queryContext.scopeRef, state]);
  const profile = operationsRtk.useGetOperationsStoreProfileQuery(profileRequest, {skip: !scopeReady});
  const definition = operationsRtk.useGetOperationsOrganizationStoreExtensionDefinitionQuery(definitionRequest, {skip: !scopeReady});
  const contracts = operationsRtk.useGetOperationsFixedStoreContractsQuery(contractRequest, {skip: !scopeReady});
  const profileProblem = !scopeReady ? '请选择可查看范围。' : queryIssue(profile.error, '门店资料读取失败');
  const contractProblem = queryIssue(contracts.error, '合同列表读取失败');

  if (!scopeReady) return <Alert type="info" showIcon title="可查看范围" description={profileProblem} {...testId('operations-store-profile-scope-required')}/>;
  if (profile.error) return <Alert type="error" showIcon title="门店资料读取失败" description={profileProblem} action={<Button onClick={() => void profile.refetch()} {...testId('operations-store-profile-retry')}>重试</Button>} {...testId('operations-store-profile-error')}/>;
  if (profile.isLoading && !profile.data) return <Spin {...testId('operations-store-profile-loading')}/>;
  if (!profile.data) return <Alert type="error" showIcon title="门店资料暂不可用" description="暂时无法获取，请重试。" action={<Button onClick={() => void profile.refetch()} {...testId('operations-store-profile-retry')}>重试</Button>} {...testId('operations-store-profile-error')}/>;

  const store: OrganizationStore = profile.data;
  return <Card aria-label={storeProfilePageTitle} {...testId('operations-store-profile-page')}>
    <Descriptions title="我的门店" bordered column={1} size="small" items={[
      {key: 'identity', label: '名称', children: formatNameCode(store.name, store.code)},
      {key: 'project', label: '项目', children: formatNameCode(store.project.name, store.project.code)},
      {key: 'brand', label: '品牌', children: formatNameCode(store.brand.name, store.brand.code)},
      {key: 'tenant', label: '经营租户', children: formatNameCode(store.tenant.name, store.tenant.code)},
      {key: 'headCompany', label: '总公司', children: store.headCompany ? formatNameCode(store.headCompany.name, store.headCompany.code) : '—'},
      {key: 'status', label: '门店状态', children: store.status === 'ENABLED' ? '启用' : '停用'},
      ...extensionItems(definition.data, store.extensionValues),
    ]} {...testId('operations-store-profile-fields')}/>
  {definition.error && <Alert type="warning" showIcon title="扩展字段读取失败" description="当前仅显示已确认的基础资料。" style={{marginTop: 16}} {...testId('operations-store-profile-extension-error')}/>}
    <Tabs
      style={{marginTop: 16}}
      items={[{
        key: 'contract',
        label: '合同',
        children: <Tabs
          activeKey={state}
          onChange={(next) => { setState(next as StoreContractViewState); setPage(1); }}
          items={contractViewTabs.map((view) => ({
        key: view.key,
        label: view.label,
        children: <>
          {contractProblem && <Alert type="error" showIcon title="合同列表读取失败" description={contractProblem} {...testId('operations-store-profile-contract-error')}/>}
          <Table<StoreContract>
            style={{marginTop: contractProblem ? 16 : 0}}
            rowKey="id"
            size="small"
            loading={contracts.isLoading}
            dataSource={contracts.data?.items ?? []}
            pagination={{
              current: contracts.data?.metadata.page ?? page,
              pageSize: contracts.data?.metadata.pageSize ?? pageSize,
              total: contracts.data?.metadata.total ?? 0,
              showSizeChanger: true,
              onChange: (nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); },
            }}
            columns={[
              {title: '合同编号', dataIndex: 'contractNo', render: (value, contract) => <Button type="link" onClick={() => detail.open(contract)} {...testId('operations-store-profile-contract-detail-open')}>{value}</Button>},
              {title: '项目分期', dataIndex: 'phaseName'},
              {title: '经营租户', render: (_, contract) => formatNameCode(contract.tenant.name, contract.tenant.code)},
              {title: '起止日期', render: (_, contract) => `${contract.effectiveFrom} 至 ${contract.effectiveTo ?? '长期'}`},
              {title: '状态', dataIndex: 'status', render: (value) => value === 'VALID' ? '有效' : '已作废'},
            ]}
            locale={{emptyText: view.emptyText}}
            {...testId(`operations-store-profile-contract-${view.key.toLowerCase()}`)}
          />
        </>,
          }))}
          {...testId('operations-store-profile-contract-state-tabs')}
        />,
      }]}
      {...testId('operations-store-profile-contract-tab')}
    />
    <FixedStoreContractDetailDrawer contract={detail.target} queryContext={queryContext} onClose={detail.close}/>
  </Card>;
}
