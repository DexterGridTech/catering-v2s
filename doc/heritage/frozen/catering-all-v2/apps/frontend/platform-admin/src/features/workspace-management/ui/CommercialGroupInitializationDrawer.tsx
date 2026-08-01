import {Button, Form, Modal} from 'antd';
import {adminDrawerSurfaceProps, useOverlayLock} from '@catering-all-v2/admin-ui-foundation';
import {DrawerForm, ProFormText, type ProFormInstance} from '@ant-design/pro-components';
import {useCallback, useEffect, useRef, useState} from 'react';
import {DrawerSubmissionFeedback} from '../../../app/forms/DrawerSubmissionFeedback';
import {useDrawerFormLifecycle} from '../../../app/forms/useDrawerFormLifecycle';
import {testId} from '../../../app/automation/platformLocators';
import {workspaceManagementLocators} from '../automation/locators';

export type CommercialGroupRootReadback = {
  id: string;
  workspaceKey: string;
  groupCode: string;
  groupName: string;
  version: number;
  createdAt: number;
  updatedAt: number;
};

export type CommercialGroupRootSummary = {
  initialized: boolean;
  root?: CommercialGroupRootReadback | null;
};

export type CommercialGroupInitializeRequest = {
  groupCode: string;
  groupName: string;
  idempotencyKey: string;
};

type FormValues = {
  groupCode: string;
  groupName: string;
};

type Props = {
  open: boolean;
  workspace: {workspaceKey: string; name: string} | undefined;
  onOpenChange: (open: boolean) => void;
  onInitialize: (workspaceKey: string, request: CommercialGroupInitializeRequest) => Promise<CommercialGroupRootReadback>;
  onOwnerReadback: (root: CommercialGroupRootReadback) => Promise<void> | void;
};

/**
 * The generated edge binding owns transport. This form only owns the approved
 * Drawer task: collect independent group code/name and hand its owner readback
 * back to the page composition.
 */
export function CommercialGroupInitializationDrawer({open, workspace, onOpenChange, onInitialize, onOwnerReadback}: Props) {
  const formRef = useRef<ProFormInstance<FormValues> | undefined>(undefined);
  const [form] = Form.useForm<FormValues>();
  const [failure, setFailure] = useState<unknown>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  useOverlayLock(Boolean(failure) || successOpen);
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange,
    dirtyMessage: '已填写的集团资料不会保存。',
    onSuccessClosed: useCallback(() => {
      formRef.current?.resetFields();
      setFailure(null);
      setSuccessOpen(true);
    }, []),
  });

  useEffect(() => {
    if (!open || !workspace) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      groupCode: '',
      groupName: '',
    });
    setFailure(null);
    lifecycle.setDirty(false);
  }, [lifecycle.setDirty, open, workspace?.name, workspace?.workspaceKey]);

  async function submit(values: FormValues) {
    if (!workspace || lifecycle.submitting) return false;
    lifecycle.setSubmitting(true);
    setFailure(null);
    try {
      const root = await onInitialize(workspace.workspaceKey, {
        groupCode: values.groupCode.trim(),
        groupName: values.groupName.trim(),
        idempotencyKey: lifecycle.getIdempotencyKey(),
      });
      await onOwnerReadback(root);
      lifecycle.closeAfterSuccess();
      return true;
    } catch (error) {
      setFailure(error);
      return false;
    } finally {
      lifecycle.setSubmitting(false);
    }
  }

  return (
    <>
      <DrawerForm<FormValues>
        form={form}
        formRef={formRef}
        open={open}
        title="初始化商业集团"
        width={520}
        disabled={lifecycle.submitting}
        drawerProps={{
          ...adminDrawerSurfaceProps,
          maskClosable: false,
          keyboard: !lifecycle.submitting,
          onClose: lifecycle.requestClose,
          afterOpenChange: lifecycle.afterOpenChange,
        }}
        onOpenChange={lifecycle.handleOpenChange}
        onValuesChange={() => {
          lifecycle.setDirty(true);
          if (failure !== null) lifecycle.markBusinessIntentChanged();
        }}
        submitter={{
          searchConfig: {submitText: '初始化'},
          resetButtonProps: {onClick: lifecycle.requestClose, disabled: lifecycle.submitting, ...testId(workspaceManagementLocators.commercialGroupCancel)},
          submitButtonProps: {
            disabled: lifecycle.submitting || !workspace,
            loading: lifecycle.submitting,
            'aria-busy': lifecycle.submitting,
            'aria-label': '初始化商业集团',
            ...testId(workspaceManagementLocators.commercialGroupSubmit),
          },
        }}
        onFinish={submit}
      >
        <ProFormText
          name="groupCode"
          label="集团编码"
          placeholder="请输入集团编码"
          disabled={lifecycle.submitting}
          fieldProps={{...testId(workspaceManagementLocators.commercialGroupCode), 'aria-label': '集团编码', maxLength: 64}}
          rules={[{required: true, message: '请输入集团编码'}]}
        />
        <ProFormText
          name="groupName"
          label="集团名称"
          placeholder="请输入集团名称"
          disabled={lifecycle.submitting}
          fieldProps={{...testId(workspaceManagementLocators.commercialGroupName), 'aria-label': '集团名称', maxLength: 120}}
          rules={[{required: true, message: '请输入集团名称'}]}
        />
      </DrawerForm>
      <DrawerSubmissionFeedback
        open={failure !== null}
        operation="create"
        title="初始化失败"
        reason="初始化商业集团失败，请根据提示修改后重试。"
        operationPath="POST /api/platform/group-workspaces/{workspaceKey}/commercial-group"
        error={failure}
        onClose={() => setFailure(null)}
      />
      <Modal
        open={successOpen}
        width={360}
        title="初始化成功"
        footer={<Button type="primary" {...testId(workspaceManagementLocators.commercialGroupSuccessAcknowledge)} onClick={() => setSuccessOpen(false)}>知道了</Button>}
        onCancel={() => setSuccessOpen(false)}
        destroyOnHidden
      />
    </>
  );
}
