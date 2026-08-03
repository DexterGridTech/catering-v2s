import {Alert, Button, Drawer, Form, Input, Space} from 'antd';
import {adminDrawerSurfaceProps, testId, useDrawerFormLifecycle, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useState} from 'react';
import {platformClient, platformProblemOf, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
import {adminCatalog, platformShellCopyKeys} from '../../../app/catalog/generatedAdminCatalog';

type FormValue = {currentPassword: string; newPassword: string; confirmation: string};

export function PlatformPasswordChangeDrawer({
  open,
  sessionVersion,
  onClose,
  onChanged,
}: {
  open: boolean;
  sessionVersion: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [form] = Form.useForm<FormValue>();
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const submission = useSubmissionLifecycle();
  useOverlayLock(open);
  const clearSecrets = () => form.resetFields(['currentPassword', 'newPassword', 'confirmation']);
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: (next) => { if (!next) { clearSecrets(); setProblem(undefined); submission.reset(); onClose(); } },
    dirtyMessage: '已填写的密码不会保存。',
    onSuccessClosed: onChanged,
    diagnosticOperationId: PLATFORM_ADMIN_OPERATION_IDS.changeCurrentPlatformPassword,
  });
  const submit = async (value: FormValue) => {
    if (lifecycle.submitting) return;
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      await platformClient.changeCurrentPlatformPassword({}, {
        body: {currentPassword: value.currentPassword, newPassword: value.newPassword, expectedSessionVersion: sessionVersion},
        headers: {'Idempotency-Key': submission.getIdempotencyKey()},
      });
      clearSecrets();
      submission.reset();
      lifecycle.setDirty(false);
      lifecycle.closeAfterSuccess();
    } catch (error) {
      clearSecrets();
      submission.reset();
      setProblem(platformProblemOf(error));
    } finally {
      lifecycle.setSubmitting(false);
    }
  };
  return <Drawer title={adminCatalog.platformShellCopy[platformShellCopyKeys.PlatformShellChangePassword]} open={open} size={480} destroyOnHidden mask={{closable: true}} keyboard={!lifecycle.submitting}
    onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} {...adminDrawerSurfaceProps}
    footer={<Space><Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting} {...testId('platform-password-cancel')}>取消</Button><Button type="primary" loading={lifecycle.submitting} disabled={lifecycle.submitting} onClick={() => form.submit()} {...testId('platform-password-submit')}>保存</Button></Space>}>
    {problem && <Alert type="error" showIcon title={problem.title} style={{marginBottom: 16}}/>}
    <Form form={form} layout="vertical" disabled={lifecycle.submitting} onFinish={(value) => void submit(value)} onValuesChange={() => { lifecycle.setDirty(true); lifecycle.markBusinessIntentChanged(); }}>
      <Form.Item name="currentPassword" label="当前密码" rules={[{required: true}]}><Input.Password autoComplete="current-password" {...testId('platform-password-current')}/></Form.Item>
      <Form.Item name="newPassword" label="新密码" rules={[{required: true, min: 8}]}><Input.Password autoComplete="new-password" {...testId('platform-password-new')}/></Form.Item>
      <Form.Item name="confirmation" label="确认新密码" dependencies={['newPassword']} rules={[{required: true}, ({getFieldValue}) => ({validator: (_, value) => value === getFieldValue('newPassword') ? Promise.resolve() : Promise.reject(new Error('两次输入的密码不一致'))})]}><Input.Password autoComplete="new-password" {...testId('platform-password-confirmation')}/></Form.Item>
    </Form>
  </Drawer>;
}
