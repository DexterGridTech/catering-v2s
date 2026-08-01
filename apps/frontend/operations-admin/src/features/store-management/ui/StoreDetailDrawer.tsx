import {Alert, Button, Descriptions, Drawer, Space, Spin} from 'antd';
import {adminDrawerSurfaceProps, testId, useDetailDrawer, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import type {ExtensionDefinition, JsonValue, OrganizationStore} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {OperationsPageProps} from '../../../app/routing/model';

type Props = {
  store?: OrganizationStore;
  queryContext: OperationsPageProps['queryContext'];
  canEdit: boolean;
  canTransition: boolean;
  onClose: () => void;
  onEdit: (store: OrganizationStore) => void;
  onStatus: (store: OrganizationStore) => void;
  onAudit: () => void;
};

function extensionItems(definition: ExtensionDefinition | undefined, values: Record<string, JsonValue> | undefined) {
  return (definition?.definitions ?? [])
    .filter((field) => field.status !== 'DISABLED')
    .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0))
    .map((field) => ({key: `extension-${field.key}`, label: field.label, children: values?.[field.key] === undefined || values[field.key] === null || values[field.key] === '' ? '—' : String(values[field.key])}));
}

export function StoreDetailDrawer({store, queryContext, canEdit, canTransition, onClose, onEdit, onStatus, onAudit}: Props) {
  const latest = useDetailDrawer<OrganizationStore>();
  useOverlayLock(Boolean(store));
  const storeRequest = useMemo(() => operationsAdminRtkRequest.getOperationsOrganizationStore(
    {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeId: store?.id ?? ''},
    {query: {expectedContextVersion: queryContext.expectedContextVersion}},
  ), [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, store?.id]);
  const latestStore = operationsRtk.useGetOperationsOrganizationStoreQuery(storeRequest, {skip: !store});
  const definitionRequest = useMemo(() => operationsAdminRtkRequest.getOperationsOrganizationStoreExtensionDefinition(
    {groupWorkspaceKey: queryContext.groupWorkspaceKey},
    {query: {expectedContextVersion: queryContext.expectedContextVersion}},
  ), [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey]);
  const definition = operationsRtk.useGetOperationsOrganizationStoreExtensionDefinitionQuery(definitionRequest, {skip: !store});
  useEffect(() => {
    if (latestStore.data) latest.open(latestStore.data);
    else latest.close();
  }, [latest.close, latest.open, latestStore.data]);
  const selected = latest.target;
  const loading = Boolean(store) && (latestStore.isLoading || definition.isLoading);
  const problem = latestStore.error ? '门店详情暂时无法获取，请关闭后重新进入。' : undefined;
  const definitionWarning = definition.error ? '扩展字段暂时无法获取，当前仅显示已确认的基础资料。' : undefined;
  const ready = Boolean(selected) && !loading && !problem;
  const closeThen = (next: (current: OrganizationStore) => void) => {
    if (!selected || !ready) return;
    latest.close();
    onClose();
    next(selected);
  };

  return <Drawer title={selected ? `门店详情：${selected.name}` : '门店详情'} open={Boolean(store)} onClose={() => { latest.close(); onClose(); }} width={620} destroyOnHidden {...adminDrawerSurfaceProps} {...testId('operations-store-detail-drawer')} extra={ready && selected && <Space>
    <Button onClick={onAudit} {...testId('operations-store-detail-audit')}>操作历史</Button>
    {canEdit && <Button onClick={() => closeThen(onEdit)} {...testId('operations-store-detail-edit')}>编辑</Button>}
    {canTransition && <Button onClick={() => closeThen(onStatus)} {...testId('operations-store-detail-status')}>{selected.status === 'ENABLED' ? '停用' : '启用'}</Button>}
  </Space>}>
    {loading && <Spin {...testId('operations-store-detail-loading')}/>} 
    {problem && <Alert type="error" showIcon message="门店详情未完成" description={problem} {...testId('operations-store-detail-problem')}/>} 
    {definitionWarning && <Alert type="warning" showIcon message="扩展字段暂不可用" description={definitionWarning} {...testId('operations-store-detail-extension-warning')}/>} 
    {ready && selected && <Descriptions bordered column={1} items={[
      {key: 'code', label: '门店编码', children: selected.code},
      {key: 'name', label: '门店名称', children: selected.name},
      {key: 'project', label: '所属项目', children: selected.project.name},
      {key: 'brand', label: '品牌', children: selected.brand.name},
      {key: 'tenant', label: '经营租户', children: selected.tenant.name},
      {key: 'headCompany', label: '总公司', children: selected.headCompany?.name ?? '未设置'},
      {key: 'status', label: '状态', children: selected.status === 'ENABLED' ? '启用' : '停用'},
      {key: 'notes', label: '备注', children: selected.notes ?? '—'},
      ...extensionItems(definition.data, selected.extensionValues),
    ]}/>} 
  </Drawer>;
}
