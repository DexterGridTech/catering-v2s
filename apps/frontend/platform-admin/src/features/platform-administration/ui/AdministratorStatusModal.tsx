import {StatusChangeConfirm, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {platformClient, platformProblemOf, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import type {PlatformAdminDetail} from '../../../app/api/generated/platform-edge';

export function AdministratorStatusModal({
  admin,
  onClose,
  onUpdated,
  onProblem,
}: {
  admin?: PlatformAdminDetail;
  onClose: () => void;
  onUpdated: (admin: PlatformAdminDetail) => void;
  onProblem: (problem: PlatformApiProblem) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const {getIdempotencyKey, reset} = useSubmissionLifecycle();
  const adminId = admin?.id;
  const adminVersion = admin?.version;
  useOverlayLock(Boolean(admin));
  useEffect(() => {
    if (adminId) {
      reset();
      setProblem(undefined);
    }
  }, [adminId, adminVersion, reset]);
  const submit = async () => {
    if (!admin) return;
    setBusy(true);
    setProblem(undefined);
    try {
      const updated = await platformClient.transitionPlatformAdminStatus(
        {platformAdminId: admin.id},
        {
          body: {
            targetStatus: admin.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
            expectedVersion: admin.version,
            idempotencyKey: getIdempotencyKey(),
          },
          headers: {'Idempotency-Key': getIdempotencyKey()},
        },
      );
      onUpdated(updated);
    } catch (error) {
      const currentProblem = platformProblemOf(error);
      setProblem(currentProblem);
      onProblem(currentProblem);
    } finally {
      setBusy(false);
    }
  };
  const action = admin?.status === 'ACTIVE' ? '停用' : '启用';
  return (
    <StatusChangeConfirm
      title={`确认${action}“${admin?.userName ?? ''}”？`}
      open={Boolean(admin)}
      actionLabel={action}
      submitting={busy}
      problem={problem ? `${problem.title}: ${problem.detail}` : undefined}
      problemTestId="platform-admin-status-error"
      onCancel={onClose}
      onConfirm={() => void submit()}
      confirmTestId="platform-admin-status-confirm"
      cancelTestId="platform-admin-status-cancel"
    >
      将管理员状态变更为“{action}”。
    </StatusChangeConfirm>
  );
}
