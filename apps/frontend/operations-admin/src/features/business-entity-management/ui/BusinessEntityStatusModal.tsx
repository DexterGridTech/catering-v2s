import {StatusChangeConfirm, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {operationsClient, operationsProblemOf} from '../../../app/api/OperationsTransport';
import type {BusinessEntityStatus} from '../../../app/api/generated/operations-edge';
import type {OperationsPageContext} from '../../../app/routing/model';
import type {BusinessEntity, BusinessEntityKind} from './BusinessEntityDetailDrawer';
import {toggleBusinessEntityStatus} from './businessEntityLifecycle';

type Props = {
  entity?: BusinessEntity;
  targetStatus?: BusinessEntityStatus;
  kind: BusinessEntityKind;
  queryContext: OperationsPageContext;
  onClose: () => void;
  onUpdated: (entity: BusinessEntity) => void;
};

export function BusinessEntityStatusModal({
  entity,
  targetStatus: requestedStatus,
  kind,
  queryContext,
  onClose,
  onUpdated,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string>();
  const {getIdempotencyKey, reset} = useSubmissionLifecycle();
  useOverlayLock(Boolean(entity));

  useEffect(() => {
    reset();
    setSubmitting(false);
    setProblem(undefined);
  }, [entity, requestedStatus, reset]);

  const targetStatus = requestedStatus ?? (entity ? toggleBusinessEntityStatus(entity.status) : undefined);
  const actionLabel = targetStatus === 'VOIDED' ? '作废' : targetStatus === 'DISABLED' ? '停用' : '启用';
  const submit = async () => {
    if (!entity || !targetStatus || submitting) return;
    setSubmitting(true);
    setProblem(undefined);
    const options = {
      body: {targetStatus, expectedVersion: entity.revision},
      headers: {'Idempotency-Key': getIdempotencyKey()},
    };
    try {
      const updated =
        kind === 'BRAND'
          ? await operationsClient.transitionOperationsOrganizationBrandStatus(
              {groupWorkspaceKey: queryContext.groupWorkspaceKey, brandId: entity.id},
              options,
            )
          : kind === 'TENANT'
            ? await operationsClient.transitionOperationsOrganizationTenantStatus(
                {groupWorkspaceKey: queryContext.groupWorkspaceKey, tenantId: entity.id},
                options,
              )
            : await operationsClient.transitionOperationsOrganizationHeadCompanyStatus(
                {groupWorkspaceKey: queryContext.groupWorkspaceKey, headCompanyId: entity.id},
                options,
              );
      onUpdated(updated);
      onClose();
    } catch (error) {
      setProblem(operationsProblemOf(error)?.detail ?? '状态更新未完成，请重新确认后再试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StatusChangeConfirm
      title={entity ? `确认${actionLabel}“${entity.name}”？` : '确认状态操作'}
      open={Boolean(entity)}
      actionLabel={actionLabel}
      dangerous={targetStatus === 'VOIDED'}
      submitting={submitting}
      problem={problem}
      onCancel={onClose}
      onConfirm={() => void submit()}
      confirmTestId="operations-business-entity-status-confirm"
      cancelTestId="operations-business-entity-status-cancel"
      modalTestId="operations-business-entity-status-modal"
    >
      {targetStatus === 'VOIDED'
        ? '作废后将保留经营实体历史事实；该实体不可恢复，也不能继续维护。'
        : `将经营实体状态变更为“${actionLabel}”。`}
    </StatusChangeConfirm>
  );
}
