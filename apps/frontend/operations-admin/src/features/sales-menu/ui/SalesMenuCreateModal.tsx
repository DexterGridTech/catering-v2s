import {Input, Modal} from 'antd';
import {testId, type DrawerFormLifecycleResult} from '@catering-v2s/admin-ui-foundation';
import {salesMenuTestIds} from '../salesMenuTestIds';

export type SalesMenuCreateModalProps = {
  open: boolean;
  name: string;
  lifecycle: DrawerFormLifecycleResult;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
  onAfterOpenChange: (visible: boolean) => void;
};

export function SalesMenuCreateModal({
  open,
  name,
  lifecycle,
  onNameChange,
  onSubmit,
  onAfterOpenChange,
}: SalesMenuCreateModalProps) {
  const submitting = lifecycle.submitting;
  return (
    <Modal
      open={open}
      title="新建菜单"
      onCancel={lifecycle.requestClose}
      onOk={onSubmit}
      afterOpenChange={onAfterOpenChange}
      maskClosable={!submitting}
      keyboard={!submitting}
      closable={!submitting}
      confirmLoading={submitting}
      okText="创建菜单"
      cancelText="取消"
      okButtonProps={{disabled: !name.trim() || submitting, ...testId(salesMenuTestIds.menuCreateSubmit)}}
      cancelButtonProps={{disabled: submitting}}
      destroyOnHidden
      {...testId(salesMenuTestIds.menuCreateModal)}
    >
      <Input
        value={name}
        onChange={event => {
          onNameChange(event.target.value);
          lifecycle.setDirty(true);
          lifecycle.markBusinessIntentChanged();
        }}
        placeholder="请输入菜单名称"
        autoFocus
        {...testId(salesMenuTestIds.menuCreateName)}
      />
    </Modal>
  );
}
