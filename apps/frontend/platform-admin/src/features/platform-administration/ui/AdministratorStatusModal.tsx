import {Modal} from 'antd';
import {testId, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {platformClient, platformProblemOf, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import type {PlatformAdminDetail} from '../../../app/api/generated/platform-edge';

export function AdministratorStatusModal({admin, onClose, onUpdated, onProblem}: {admin?: PlatformAdminDetail; onClose: () => void; onUpdated: (admin: PlatformAdminDetail) => void; onProblem: (problem: PlatformApiProblem) => void}) {
  const [busy, setBusy] = useState(false);
  const {getIdempotencyKey, reset} = useSubmissionLifecycle();
  const adminId = admin?.id;
  const adminVersion = admin?.version;
  useOverlayLock(Boolean(admin));
  useEffect(() => { if (adminId) reset(); }, [adminId, adminVersion, reset]);
  const submit = async () => {
    if (!admin) return;
    setBusy(true);
    try {
      const updated = await platformClient.transitionPlatformAdminStatus({platformAdminId: admin.id}, {body: {targetStatus: admin.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE', expectedVersion: admin.version, idempotencyKey: getIdempotencyKey()}, headers: {'Idempotency-Key': getIdempotencyKey()}});
      onUpdated(updated);
    } catch (error) { onProblem(platformProblemOf(error)); } finally { setBusy(false); }
  };
  const action = admin?.status === 'ACTIVE' ? '停用' : '启用';
  return <Modal title={`确认${action}“${admin?.userName ?? ''}”？`} open={Boolean(admin)} onCancel={onClose} onOk={() => void submit()} confirmLoading={busy} okText="确认" cancelText="取消" okButtonProps={testId('platform-admin-status-confirm')} cancelButtonProps={testId('platform-admin-status-cancel')} destroyOnHidden/>;
}
