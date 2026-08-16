import {Alert, Button, Modal} from 'antd';
import {testId, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {operationsClient, operationsProblemOf} from '../../../app/api/OperationsTransport';
import {OPERATIONS_ADMIN_OPERATION_IDS, type StoreContract} from '../../../app/api/generated/operations-edge';
import type {OperationsPageProps} from '../../../app/routing/model';

type Props = {
  contract?: StoreContract;
  queryContext: OperationsPageProps['queryContext'];
  onClose: () => void;
  onInvalidated: (contract: StoreContract) => void;
};
export function ContractInvalidateModal({contract, queryContext, onClose, onInvalidated}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string>();
  const lifecycle = useSubmissionLifecycle();
  useOverlayLock(Boolean(contract));
  useEffect(() => {
    lifecycle.reset();
    setSubmitting(false);
    setProblem(undefined);
  }, [contract, lifecycle]);
  const submit = async () => {
    if (!contract || submitting) return;
    setSubmitting(true);
    try {
      const readback = await operationsClient.invalidateOperationsContract(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, contractId: contract.id},
        {body: {expectedVersion: contract.revision}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}},
      );
      onInvalidated(readback);
      onClose();
    } catch (error) {
      setProblem(operationsProblemOf(error).detail);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Modal
      title={contract ? `确认作废合同“${contract.contractNo}”？` : '确认作废合同'}
      open={Boolean(contract)}
      destroyOnHidden
      onCancel={submitting ? undefined : onClose}
      mask={{closable: !submitting}}
      keyboard={!submitting}
      footer={[
        <Button
          key="cancel"
          onClick={onClose}
          disabled={submitting}
          {...testId('operations-contract-invalidate-cancel')}
        >
          取消
        </Button>,
        <Button
          key="confirm"
          type="primary"
          loading={submitting}
          data-operation={OPERATIONS_ADMIN_OPERATION_IDS.invalidateOperationsContract}
          onClick={() => void submit()}
          {...testId('operations-contract-invalidate-confirm')}
        >
          确认
        </Button>,
      ]}
      {...testId('operations-contract-invalidate-modal')}
    >
      {problem && <Alert type="error" showIcon title="合同作废未完成" description={problem} />}
      <p>作废后保留历史记录。</p>
    </Modal>
  );
}
