import {Alert, Button, Modal, type ModalProps} from 'antd';
import type {ReactNode} from 'react';
import {testId} from '../automation/testId';

export type StatusChangeConfirmProps = {
  open: boolean;
  title: ReactNode;
  actionLabel: string;
  dangerous?: boolean;
  submitting?: boolean;
  problem?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmTestId: string;
  cancelTestId: string;
  modalTestId?: string;
  problemTestId?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  children?: ReactNode;
  modalProps?: Omit<ModalProps, 'open' | 'onCancel' | 'onOk' | 'title' | 'children'>;
};

/** Shared confirmation primitive; owners keep action semantics and failure mapping. */
export function StatusChangeConfirm({
  open,
  title,
  actionLabel,
  dangerous = false,
  submitting = false,
  problem,
  onCancel,
  onConfirm,
  confirmTestId,
  cancelTestId,
  modalTestId,
  problemTestId,
  cancelLabel = '取消',
  confirmDisabled = false,
  children,
  modalProps,
}: StatusChangeConfirmProps) {
  const wrapProps = modalTestId ? {...(modalProps?.wrapProps ?? {}), ...testId(modalTestId)} : modalProps?.wrapProps;

  return (
    <Modal
      {...modalProps}
      title={title}
      open={open}
      destroyOnHidden
      onCancel={submitting ? undefined : onCancel}
      onOk={onConfirm}
      maskClosable={!submitting}
      keyboard={!submitting}
      confirmLoading={submitting}
      okText={`确认${actionLabel}`}
      cancelText={cancelLabel}
      okButtonProps={{danger: dangerous, disabled: confirmDisabled, ...testId(confirmTestId)}}
      cancelButtonProps={testId(cancelTestId)}
      wrapProps={wrapProps}
    >
      {problem ? (
        <Alert
          type="error"
          showIcon
          title="状态操作未完成"
          description={problem}
          {...(problemTestId ? testId(problemTestId) : {})}
        />
      ) : null}
      {children}
    </Modal>
  );
}
