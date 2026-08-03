import {Button, Modal} from 'antd';
import {testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import type {HierarchyRow} from './organizationStructureShared';

export function OrganizationStatusModal({target, submitting, onCancel, onConfirm}: {
  target?: HierarchyRow;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (target: HierarchyRow) => void;
}) {
  useOverlayLock(Boolean(target));
  return <Modal title={target ? `确认${target.status === 'ENABLED' ? '停用' : '启用'}“${target.name}”？` : '确认状态操作'} open={Boolean(target)} onCancel={submitting ? undefined : onCancel} mask={{closable: !submitting}} keyboard={!submitting} destroyOnHidden footer={[<Button key="cancel" onClick={onCancel} disabled={submitting} {...testId('operations-organization-status-cancel')}>取消</Button>, <Button key="confirm" type="primary" loading={submitting} onClick={() => { if (target) onConfirm(target); }} {...testId('operations-organization-status-confirm')}>确认</Button>]} {...testId('operations-organization-status-modal')}>
    <p>停用影响由系统在提交后如实提示。</p>
  </Modal>;
}
