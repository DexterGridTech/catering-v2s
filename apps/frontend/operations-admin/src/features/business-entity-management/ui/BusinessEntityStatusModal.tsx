import {Alert, Button, Modal} from 'antd';
import {testId, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {operationsClient} from '../../../app/api/OperationsTransport';
import type {BusinessEntityStatus} from '../../../app/api/generated/operations-edge';
import type {OperationsPageContext} from '../../../app/routing/model';
import type {BusinessEntity, BusinessEntityKind} from './BusinessEntityDetailDrawer';

type Props = {
  entity?: BusinessEntity;
  kind: BusinessEntityKind;
  queryContext: OperationsPageContext;
  onClose: () => void;
  onUpdated: (entity: BusinessEntity) => void;
};

function nextStatus(status: BusinessEntityStatus): BusinessEntityStatus {
  return status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
}

export function BusinessEntityStatusModal({entity, kind, queryContext, onClose, onUpdated}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string>();
  const {getIdempotencyKey, reset} = useSubmissionLifecycle();
  useOverlayLock(Boolean(entity));

  useEffect(() => {
    reset();
    setSubmitting(false);
    setProblem(undefined);
  }, [entity, reset]);

  const targetStatus = entity ? nextStatus(entity.status) : undefined;
  const actionLabel = targetStatus === 'DISABLED' ? '停用' : '启用';
  const submit = async () => {
    if (!entity || !targetStatus || submitting) return;
    setSubmitting(true);
    setProblem(undefined);
    const options = {
      body: {targetStatus, expectedVersion: entity.revision},
      headers: {'Idempotency-Key': getIdempotencyKey()},
    };
    try {
      const updated = kind === 'BRAND'
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
    } catch {
      setProblem('状态更新未完成，请重新确认后再试。');
    } finally {
      setSubmitting(false);
    }
  };

  return <Modal
    title={entity ? `确认${actionLabel}“${entity.name}”？` : '确认状态操作'}
    open={Boolean(entity)}
    destroyOnHidden
    onCancel={submitting ? undefined : onClose}
    maskClosable={!submitting}
    keyboard={!submitting}
    footer={[
      <Button key="cancel" onClick={onClose} disabled={submitting} {...testId('operations-business-entity-status-cancel')}>取消</Button>,
      <Button key="confirm" type="primary" loading={submitting} onClick={() => void submit()} {...testId('operations-business-entity-status-confirm')}>确认</Button>,
    ]}
    {...testId('operations-business-entity-status-modal')}
  >
    {problem && <Alert type="error" showIcon message="状态操作未完成" description={problem}/>} 
  </Modal>;
}
