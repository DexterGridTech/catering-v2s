import {Alert, Modal} from 'antd';
import {testId, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
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
    <Modal
      title={`确认${action}集团空间？`}
      open={Boolean(workspace)}
      onCancel={onClose}
      onOk={() => void submit()}
      confirmLoading={busy}
      okText="确认"
      cancelText="返回"
      okButtonProps={testId('platform-workspace-status-confirm')}
      cancelButtonProps={testId('platform-workspace-status-return')}
      destroyOnHidden
    >
      {problem && (
        <Alert
          type="error"
          showIcon
          title={problem.title}
          description={problem.detail}
          {...testId('platform-workspace-status-error')}
        />
      )}
      将集团空间状态变更为“已{action}”。
    </Modal>
  );
}
