import {Alert, Button, Drawer, Form, Input, Space} from 'antd';
import {adminDrawerSurfaceProps, testId, useDrawerFormLifecycle, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {platformClient, platformProblemOf, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import {PLATFORM_ADMIN_OPERATION_IDS, type PlatformAdminCreateRequest, type PlatformAdminDetail} from '../../../app/api/generated/platform-edge';

type Fields = Omit<PlatformAdminCreateRequest, 'idempotencyKey'> & {confirmation: string};

export function AdministratorCreateDrawer({open, onClose, onCreated}: {open: boolean; onClose: () => void; onCreated: (admin: PlatformAdminDetail) => void}) {
  const [form] = Form.useForm<Fields>();
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const clearSecrets = () => form.resetFields(['password', 'confirmation']);
  const lifecycle = useDrawerFormLifecycle({open, onOpenChange: (next) => { if (!next) { clearSecrets(); onClose(); } }, dirtyMessage: '已填写的管理员资料不会保存。', idempotencyKey: true, diagnosticOperationId: PLATFORM_ADMIN_OPERATION_IDS.createPlatformAdmin});
  useOverlayLock(open);
  useEffect(() => { if (open) { form.resetFields(); setProblem(undefined); lifecycle.reset(); } }, [form, lifecycle, open]);
  const submit = async (value: Fields) => {
    if (lifecycle.submitting) return;
    lifecycle.setSubmitting(true); setProblem(undefined);
    try {
      const {confirmation: _confirmation, ...request} = value;
      const admin = await platformClient.createPlatformAdmin({}, {body: {...request, loginName: request.loginName.trim(), userName: request.userName.trim(), mobile: request.mobile?.trim() || null, idempotencyKey: lifecycle.getIdempotencyKey()}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
      clearSecrets(); lifecycle.setDirty(false); onCreated(admin);
    } catch (error) { clearSecrets(); setProblem(platformProblemOf(error)); } finally { lifecycle.setSubmitting(false); }
  };
  return <Drawer title="新建管理员" open={open} size={520} destroyOnHidden onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} mask={{closable: true}} keyboard={!lifecycle.submitting} {...adminDrawerSurfaceProps} footer={<Space><Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting} {...testId('platform-admin-create-cancel')}>取消</Button><Button type="primary" loading={lifecycle.submitting} onClick={() => form.submit()} {...testId('platform-admin-create-submit')}>创建</Button></Space>}>
    {problem && <Alert type="error" showIcon title={problem.title} description={problem.detail} style={{marginBottom: 16}} {...testId('platform-admin-create-error')}/>}
    <Form form={form} layout="vertical" onFinish={(value) => void submit(value)} onValuesChange={() => { lifecycle.setDirty(true); lifecycle.markBusinessIntentChanged(); }} disabled={lifecycle.submitting}>
      <Form.Item name="loginName" label="登录账号" rules={[{required: true, whitespace: true}]}><Input autoComplete="username" {...testId('platform-admin-create-login-name')}/></Form.Item>
      <Form.Item name="userName" label="姓名" rules={[{required: true, whitespace: true}]}><Input {...testId('platform-admin-create-user-name')}/></Form.Item>
      <Form.Item name="mobile" label="手机号"><Input inputMode="tel" autoComplete="tel" {...testId('platform-admin-create-mobile')}/></Form.Item>
      <Form.Item name="password" label="初始密码" rules={[{required: true, min: 8}]}><Input.Password autoComplete="new-password" {...testId('platform-admin-create-password')}/></Form.Item>
      <Form.Item name="confirmation" label="确认密码" dependencies={['password']} rules={[{required: true}, ({getFieldValue}) => ({validator: (_, value) => value === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error('两次输入的密码不一致'))})]}><Input.Password autoComplete="new-password" {...testId('platform-admin-create-confirmation')}/></Form.Item>
    </Form>
  </Drawer>;
}
