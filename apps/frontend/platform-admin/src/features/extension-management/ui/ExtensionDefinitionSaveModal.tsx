import {Button, Modal, Space} from 'antd';
import {testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';

type Props = {outcome?: 'saved' | 'conflict'; onClose: () => void; onViewLatest: () => void};

/** Owner-result feedback exposes only the next business action, never CAS or field identity. */
export function ExtensionDefinitionSaveModal({outcome, onClose, onViewLatest}: Props) {
  useOverlayLock(Boolean(outcome));
  if (!outcome) return null;
  const conflict = outcome === 'conflict';
  return <Modal title={conflict ? '字段配置已变化' : '字段配置已更新'} open onCancel={onClose} onOk={conflict ? undefined : onClose} footer={conflict ? <Space><Button onClick={onClose} {...testId('extension-definition-conflict-cancel')}>取消</Button><Button type="primary" onClick={() => { onViewLatest(); onClose(); }} {...testId('extension-definition-view-latest')}>查看最新配置</Button></Space> : undefined} okText="确认" cancelButtonProps={conflict ? undefined : {style: {display: 'none'}}} okButtonProps={testId('extension-definition-save-confirm')} destroyOnHidden {...testId('extension-definition-save-result')}>
    <p>{conflict ? '字段配置已变化，请查看最新配置后重试。' : '字段配置已更新。'}</p>
  </Modal>;
}
