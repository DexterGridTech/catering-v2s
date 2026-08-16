import {Alert, Button, Modal} from 'antd';
import {testId, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {operationsClient, operationsProblemOf} from '../../../app/api/OperationsTransport';
import type {OrganizationStore} from '../../../app/api/generated/operations-edge';
import type {OperationsPageProps} from '../../../app/routing/model';

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
  const submit = async () => {
    if (!store || submitting) return;
    setSubmitting(true);
    try {
      const updated = await operationsClient.transitionOperationsOrganizationStoreStatus(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeId: store.id},
        {
          body: {targetStatus: store.status === 'ENABLED' ? 'DISABLED' : 'ENABLED', expectedVersion: store.revision},
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
  const action = store?.status === 'ENABLED' ? '停用' : '启用';
  return (
    <Modal
      title={store ? `确认${action}“${store.name}”？` : '确认状态操作'}
      open={Boolean(store)}
      destroyOnHidden
      onCancel={submitting ? undefined : onClose}
      mask={{closable: !submitting}}
      keyboard={!submitting}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting} {...testId('operations-store-status-cancel')}>
          取消
        </Button>,
        <Button
          key="confirm"
          type="primary"
          loading={submitting}
          onClick={() => void submit()}
          {...testId('operations-store-status-confirm')}
        >
          确认
        </Button>,
      ]}
      {...testId('operations-store-status-modal')}
    >
      {problem && <Alert type="error" showIcon title="状态操作未完成" description={problem} />}
      <p>此操作仅改变门店资料可用状态。</p>
    </Modal>
  );
}
