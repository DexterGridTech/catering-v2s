import {Alert, Button, Drawer, Form, Input, Space} from 'antd';
import {adminDrawerSurfaceProps, testId, useDrawerFormLifecycle, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {platformClient, platformProblemOf, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import {PLATFORM_ADMIN_OPERATION_IDS, type PlatformAdminDetail} from '../../../app/api/generated/platform-edge';

type Fields = {userName: string; mobile?: string};

export function AdministratorEditDrawer({admin, onClose, onUpdated}: {admin?: PlatformAdminDetail; onClose: () => void; onUpdated: (admin: PlatformAdminDetail) => void}) {
  const [form] = Form.useForm<Fields>();
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const lifecycle = useDrawerFormLifecycle({open: Boolean(admin), onOpenChange: (next) => { if (!next) onClose(); }, dirtyMessage: '已填写的管理员资料不会保存。', idempotencyKey: true, diagnosticOperationId: PLATFORM_ADMIN_OPERATION_IDS.updatePlatformAdminProfile});
  useOverlayLock(Boolean(admin));
  useEffect(() => { if (admin) { form.setFieldsValue({userName: admin.userName, mobile: admin.mobile ?? undefined}); setProblem(undefined); lifecycle.reset(); } }, [admin, form, lifecycle]);
  const submit = async (value: Fields) => {
    if (!admin || lifecycle.submitting) return;
    lifecycle.setSubmitting(true); setProblem(undefined);
    try {
      const updated = await platformClient.updatePlatformAdminProfile({platformAdminId: admin.id}, {body: {userName: value.userName.trim(), mobile: value.mobile?.trim() || null, expectedVersion: admin.version, idempotencyKey: lifecycle.getIdempotencyKey()}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
      lifecycle.setDirty(false); onUpdated(updated);
    } catch (error) { setProblem(platformProblemOf(error)); } finally { lifecycle.setSubmitting(false); }
  };
  return <Drawer title="编辑管理员资料" open={Boolean(admin)} size={520} destroyOnHidden onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} mask={{closable: true}} keyboard={!lifecycle.submitting} {...adminDrawerSurfaceProps} footer={<Space><Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting} {...testId('platform-admin-edit-cancel')}>取消</Button><Button type="primary" loading={lifecycle.submitting} onClick={() => form.submit()} {...testId('platform-admin-edit-submit')}>保存</Button></Space>}>
    {problem && <Alert type="error" showIcon title={problem.title} description={problem.detail} style={{marginBottom: 16}} {...testId('platform-admin-edit-error')}/>}
    <Form form={form} layout="vertical" onFinish={(value) => void submit(value)} onValuesChange={() => { lifecycle.setDirty(true); lifecycle.markBusinessIntentChanged(); }} disabled={lifecycle.submitting}>
      <Form.Item label="登录账号"><Input value={admin?.loginName} disabled {...testId('platform-admin-edit-login-name')}/></Form.Item>
      <Form.Item name="userName" label="姓名" rules={[{required: true, whitespace: true}]}><Input {...testId('platform-admin-edit-user-name')}/></Form.Item>
      <Form.Item name="mobile" label="手机号"><Input inputMode="tel" autoComplete="tel" {...testId('platform-admin-edit-mobile')}/></Form.Item>
    </Form>
  </Drawer>;
}
