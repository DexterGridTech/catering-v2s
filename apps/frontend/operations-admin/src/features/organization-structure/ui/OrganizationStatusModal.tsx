import {StatusChangeConfirm, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import type {HierarchyRow} from './organizationStructureShared';

export function OrganizationStatusModal({
  target,
  submitting,
  onCancel,
  onConfirm,
}: {
  target?: HierarchyRow;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (target: HierarchyRow) => void;
}) {
  useOverlayLock(Boolean(target));
  const actionLabel = target?.status === 'ENABLED' ? '停用' : '启用';
  return (
    <StatusChangeConfirm
      title={target ? `确认${target.status === 'ENABLED' ? '停用' : '启用'}“${target.name}”？` : '确认状态操作'}
      open={Boolean(target)}
      actionLabel={actionLabel}
      submitting={submitting}
      onCancel={onCancel}
      onConfirm={() => {
        if (target) onConfirm(target);
      }}
      confirmTestId="operations-organization-status-confirm"
      cancelTestId="operations-organization-status-cancel"
      modalTestId="operations-organization-status-modal"
    >
      <p>停用影响由系统在提交后如实提示。</p>
    </StatusChangeConfirm>
  );
}
