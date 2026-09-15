import {Alert, Button, Modal} from 'antd';
import {testId, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {operationsClient, operationsProblemOf} from '../../../app/api/OperationsTransport';
import type {OrganizationStore} from '../../../app/api/generated/operations-edge';
import type {OperationsPageProps} from '../../../app/routing/model';
import {toggleOrganizationStoreStatus} from '../../organization-structure/model/organizationStatus';

type Props = {
  store?: OrganizationStore;
  queryContext: OperationsPageProps['queryContext'];
  onClose: () => void;
  onUpdated: (store: OrganizationStore) => void;
  onProblem: (problem: string) => void;
};
const statusFailureMessage = '门店状态操作未完成，请重试。';
export function StoreStatusModal({store, queryContext, onClose, onUpdated, onProblem}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string>();
  const lifecycle = useSubmissionLifecycle();
  useOverlayLock(Boolean(store));
  useEffect(() => {
    lifecycle.reset();
    setSubmitting(false);
    setProblem(undefined);
  }, [lifecycle, store]);
  const targetStatus = store ? toggleOrganizationStoreStatus(store.status) : undefined;
  const submit = async () => {
    if (!store || !targetStatus || submitting) return;
    setSubmitting(true);
    try {
      const updated = await operationsClient.transitionOperationsOrganizationStoreStatus(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeId: store.id},
        {
          body: {targetStatus, expectedVersion: store.revision},
          headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()},
        },
      );
      onUpdated(updated);
      onClose();
    } catch (error) {
      const message = operationsProblemOf(error)?.detail ?? statusFailureMessage;
      setProblem(message);
      onProblem(message);
    } finally {
      setSubmitting(false);
    }
  };
  const action = targetStatus === 'DISABLED' ? '停用' : targetStatus === 'ENABLED' ? '启用' : undefined;
  return (
    <Modal
      title={store && action ? `确认${action}“${store.name}”？` : '状态操作不可用'}
      open={Boolean(store)}
      destroyOnHidden
      onCancel={submitting ? undefined : onClose}
      maskClosable={!submitting}
      keyboard={!submitting}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting} {...testId('operations-store-status-cancel')}>
          取消
        </Button>,
        <Button
          key="confirm"
          type="primary"
          loading={submitting}
          disabled={!targetStatus}
          onClick={() => void submit()}
          {...testId('operations-store-status-confirm')}
        >
          确认
        </Button>,
      ]}
      {...testId('operations-store-status-modal')}
    >
      {problem && <Alert type="error" showIcon title="状态操作未完成" description={problem} />}
      <p>{action ? '此操作仅改变门店资料可用状态。' : '已作废门店不可变更状态。'}</p>
    </Modal>
  );
}
