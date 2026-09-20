import {StatusChangeConfirm, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import type {GroupWorkspaceDetail} from '../../../app/api/generated/platform-edge';
import {platformClient, platformProblemOf, type PlatformApiProblem} from '../../../app/api/PlatformTransport';

export function WorkspaceStatusModal({
  workspace,
  onClose,
  onUpdated,
  onProblem,
  onConflict,
}: {
  workspace?: GroupWorkspaceDetail;
  onClose: () => void;
  onUpdated: (workspace: GroupWorkspaceDetail) => void;
  onProblem: (problem: PlatformApiProblem) => void;
  onConflict: (groupWorkspaceKey: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const {getIdempotencyKey, reset} = useSubmissionLifecycle();
  const workspaceKey = workspace?.groupWorkspaceKey;
  const workspaceVersion = workspace?.version;
  useOverlayLock(Boolean(workspace));
  useEffect(() => {
    if (workspaceKey) {
      reset();
      setProblem(undefined);
    }
  }, [workspaceKey, workspaceVersion, reset]);
  const action = workspace?.status === 'ENABLED' ? '停用' : '启用';
  const submit = async () => {
    if (!workspace || busy) return;
    setBusy(true);
    setProblem(undefined);
    try {
      const updated = await platformClient.transitionPlatformGroupWorkspaceStatus(
        {groupWorkspaceKey: workspace.groupWorkspaceKey},
        {
          body: {
            targetStatus: workspace.status === 'ENABLED' ? 'DISABLED' : 'ENABLED',
            expectedVersion: workspace.version,
            idempotencyKey: getIdempotencyKey(),
          },
          headers: {'Idempotency-Key': getIdempotencyKey()},
        },
      );
      onUpdated(updated);
    } catch (error) {
      const currentProblem = platformProblemOf(error);
      if (currentProblem.errorCode !== 'PLATFORM_COMMON_VERSION_CONFLICT') {
        setProblem(currentProblem);
        onProblem(currentProblem);
      } else {
        onClose();
        onConflict(workspace.groupWorkspaceKey);
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <StatusChangeConfirm
      title={`确认${action}集团空间？`}
      open={Boolean(workspace)}
      actionLabel={action}
      submitting={busy}
      problem={problem ? `${problem.title}: ${problem.detail}` : undefined}
      problemTestId="platform-workspace-status-error"
      cancelLabel="返回"
      onCancel={onClose}
      onConfirm={() => void submit()}
      confirmTestId="platform-workspace-status-confirm"
      cancelTestId="platform-workspace-status-return"
    >
      将集团空间状态变更为“{action}”。
    </StatusChangeConfirm>
  );
}
