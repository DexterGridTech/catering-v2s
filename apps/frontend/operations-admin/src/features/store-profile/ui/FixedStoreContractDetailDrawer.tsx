import {Alert, Descriptions, Drawer, Skeleton, Space} from 'antd';
import {adminDetailDescriptionsProps, adminDrawerSurfaceProps, NameCodeText, testId, useDetailDrawer, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {JsonValue, StoreContract} from '../../../app/api/generated/operations-edge';
import type {OperationsPageContext} from '../../../app/routing/model';

type Props = {
  contract?: StoreContract;
  queryContext: OperationsPageContext;
  onClose: () => void;
};

/** Store-profile contract detail is intentionally read-only: this face has no contract mutation capability. */
export function FixedStoreContractDetailDrawer({contract, queryContext, onClose}: Props) {
  const detail = useDetailDrawer<StoreContract>();
  useOverlayLock(Boolean(contract));
  const {target: selected, open: openDetail, close: closeDetail} = detail;

  const definitionRequest = useMemo(() => operationsAdminRtkRequest.getOperationsContractExtensionDefinition(
    {groupWorkspaceKey: queryContext.groupWorkspaceKey},
    {query: {expectedContextVersion: queryContext.expectedContextVersion}},
  ), [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey]);
  const definition = operationsRtk.useGetOperationsContractExtensionDefinitionQuery(definitionRequest, {skip: !selected});
  const extensionItems = [...(definition.data?.definitions ?? [])]
    .filter((field) => field.status !== 'DISABLED')
    .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0))
    .map((field) => ({key: `extension-${field.key}`, label: field.label, children: valueOf(selected?.extensionValues?.[field.key])}));

  useEffect(() => {
    if (contract) openDetail(contract);
    else closeDetail();
  }, [contract, closeDetail, openDetail]);

  return <Drawer
    title={selected ? `合同详情：${selected.contractNo}` : '合同详情'}
    open={Boolean(contract)}
    size={640}
    destroyOnHidden
    maskClosable
    onClose={() => { closeDetail(); onClose(); }}
    {...adminDrawerSurfaceProps}
    {...testId('operations-store-profile-contract-detail-drawer')}
  >
    {selected && <>
      {definition.isLoading && <Skeleton active {...testId('operations-store-profile-contract-detail-extension-loading')} />}
      {definition.error && <Alert type="warning" showIcon title="扩展字段读取失败" description="当前仅显示已确认的基础资料。" {...testId('operations-store-profile-contract-detail-extension-error')} />}
      <Descriptions {...adminDetailDescriptionsProps} items={[
        {key: 'contractNo', label: '合同编号', children: selected.contractNo},
        {key: 'store', label: '门店', children: <NameCodeText name={selected.store.name} code={selected.store.code}/>},
        {key: 'project', label: '项目', children: <NameCodeText name={selected.project.name} code={selected.project.code}/>},
        {key: 'phaseName', label: '项目分期', children: selected.phaseName},
        {key: 'tenant', label: '经营租户', children: <NameCodeText name={selected.tenant.name} code={selected.tenant.code}/>},
        {key: 'items', label: '货号', children: selected.items.length ? <Space direction="vertical" size={2}>{selected.items.map((item) => <NameCodeText key={`${item.code}-${item.name}`} name={item.name} code={item.code}/>)}</Space> : '—'},
        {key: 'effective', label: '起止日期', children: `${selected.effectiveFrom} 至 ${selected.effectiveTo ?? '长期'}`},
        {key: 'status', label: '状态', children: selected.status === 'VALID' ? '有效' : '已作废'},
        {key: 'note', label: '备注', children: selected.note ?? '—'},
        {key: 'updatedAt', label: '更新时间', children: new Date(selected.updatedAt).toLocaleString('zh-CN')},
        ...extensionItems,
      ]} {...testId('operations-store-profile-contract-detail-fields')}/>
    </>}
  </Drawer>;
}

function valueOf(value: JsonValue | undefined) {
  return value === undefined || value === null || value === '' ? '—' : String(value);
}
