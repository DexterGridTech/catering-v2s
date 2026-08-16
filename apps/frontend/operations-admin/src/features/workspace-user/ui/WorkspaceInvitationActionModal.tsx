import {Alert, Button, Modal, Typography} from 'antd';
import {testId, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {operationsClient, operationsProblemOf} from '../../../app/api/OperationsTransport';
import type {WorkspaceInvitation} from '../../../app/api/generated/operations-edge';
import type {OperationsPageProps} from '../../../app/routing/model';

type TargetType = 'GROUP' | 'REGION' | 'PROJECT' | 'HEAD_COMPANY' | 'STORE';

type Props = {
  open: boolean;
  kind: 'cancel' | 'reissue';
  invitation?: WorkspaceInvitation;
  queryContext: OperationsPageProps['queryContext'];
  targetType: TargetType;
  onCancel: () => void;
  onUpdated: (invitation: WorkspaceInvitation) => void;
};

export function WorkspaceInvitationActionModal({
  open,
  kind,
  invitation,
  queryContext,
  targetType,
  onCancel,
  onUpdated,
}: Props) {
  useOverlayLock(open);
  const submission = useSubmissionLifecycle();
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string>();
  const title = kind === 'cancel' ? '确认取消邀请？' : '确认重新发送邀请？';
  const description = kind === 'cancel' ? '取消后该邀请链接将不再有效。' : '重新发送会使旧邀请链接失效。';
  const targetPath = useMemo(
    () => (invitation ? {groupWorkspaceKey: queryContext.groupWorkspaceKey, invitationId: invitation.id} : undefined),
    [invitation, queryContext.groupWorkspaceKey],
  );

  useEffect(() => {
    if (open) setProblem(undefined);
  }, [invitation?.id, kind, open]);

  const submit = async () => {
    if (!invitation || !targetPath || submitting) return;
    submission.markBusinessIntentChanged();
    setProblem(undefined);
    setSubmitting(true);
    const idempotencyKey = submission.getIdempotencyKey();
    const options = {
      body: {
        scopeRef: queryContext.scopeRef,
        expectedVersion: invitation.revision,
        expectedContextVersion: queryContext.expectedContextVersion,
        idempotencyKey,
      },
      headers: {'Idempotency-Key': idempotencyKey},
    };
    try {
      const updated =
        kind === 'cancel'
          ? targetType === 'GROUP'
            ? await operationsClient.cancelOperationsWorkspaceGroupInvitation(targetPath, options)
            : targetType === 'REGION'
              ? await operationsClient.cancelOperationsWorkspaceRegionInvitation(targetPath, options)
              : targetType === 'PROJECT'
                ? await operationsClient.cancelOperationsWorkspaceProjectInvitation(targetPath, options)
                : targetType === 'HEAD_COMPANY'
                  ? await operationsClient.cancelOperationsWorkspaceHeadCompanyInvitation(targetPath, options)
                  : await operationsClient.cancelOperationsWorkspaceStoreInvitation(targetPath, options)
          : targetType === 'GROUP'
            ? await operationsClient.reissueOperationsWorkspaceGroupInvitation(targetPath, options)
            : targetType === 'REGION'
              ? await operationsClient.reissueOperationsWorkspaceRegionInvitation(targetPath, options)
              : targetType === 'PROJECT'
                ? await operationsClient.reissueOperationsWorkspaceProjectInvitation(targetPath, options)
                : targetType === 'HEAD_COMPANY'
                  ? await operationsClient.reissueOperationsWorkspaceHeadCompanyInvitation(targetPath, options)
                  : await operationsClient.reissueOperationsWorkspaceStoreInvitation(targetPath, options);
      onUpdated(updated);
    } catch (error) {
      setProblem(operationsProblemOf(error).detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={submitting ? undefined : onCancel}
      destroyOnHidden
      mask={{closable: !submitting}}
      keyboard={!submitting}
      footer={[
        <Button
          key="cancel"
          onClick={onCancel}
          disabled={submitting}
          {...testId('operations-workspace-invitation-action-back')}
        >
          返回
        </Button>,
        <Button
          key="confirm"
          type="primary"
          loading={submitting}
          onClick={() => void submit()}
          {...testId('operations-workspace-invitation-action-confirm')}
        >
          确认
        </Button>,
      ]}
      {...testId('operations-workspace-invitation-action-modal')}
    >
      {problem && <Alert type="error" showIcon title={problem} style={{marginBottom: 16}} />}
      <Typography.Paragraph>{description}</Typography.Paragraph>
    </Modal>
  );
}
