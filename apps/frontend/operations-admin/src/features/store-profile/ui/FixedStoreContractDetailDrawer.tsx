import {Descriptions, Drawer} from 'antd';
import {adminDrawerSurfaceProps, testId, useDetailDrawer, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect} from 'react';
import type {StoreContract} from '../../../app/api/generated/operations-edge';

type Props = {
  contract?: StoreContract;
  onClose: () => void;
};

/** Store-profile contract detail is intentionally read-only: this face has no contract mutation capability. */
export function FixedStoreContractDetailDrawer({contract, onClose}: Props) {
  const detail = useDetailDrawer<StoreContract>();
  useOverlayLock(Boolean(contract));
  const selected = detail.target;

  useEffect(() => {
    if (contract) detail.open(contract);
    else detail.close();
  }, [contract, detail.close, detail.open]);

  return <Drawer
    title={selected ? `合同详情：${selected.contractNo}` : '合同详情'}
    open={Boolean(contract)}
    width={640}
    destroyOnHidden
    onClose={() => { detail.close(); onClose(); }}
    {...adminDrawerSurfaceProps}
    {...testId('operations-store-profile-contract-detail-drawer')}
  >
    {selected && <Descriptions bordered column={1} items={[
      {key: 'contractNo', label: '合同编号', children: selected.contractNo},
      {key: 'phaseName', label: '项目分期', children: selected.phaseName},
      {key: 'tenant', label: '经营租户', children: selected.tenant.name},
      {key: 'effective', label: '起止日期', children: `${selected.effectiveFrom} 至 ${selected.effectiveTo ?? '长期'}`},
      {key: 'status', label: '状态', children: selected.status === 'VALID' ? '有效' : '已作废'},
    ]} {...testId('operations-store-profile-contract-detail-fields')}/>} 
  </Drawer>;
}
