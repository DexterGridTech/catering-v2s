import {Alert, Button, Drawer, Form, Input, Space} from 'antd';
import {
  adminDrawerSurfaceProps,
  testId,
  useDrawerFormLifecycle,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {platformClient, platformProblemOf, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import {PLATFORM_ADMIN_OPERATION_IDS, type PlatformAdminDetail} from '../../../app/api/generated/platform-edge';

type Fields = {password: string; confirmation: string};

export function AdministratorCredentialDrawer({
  admin,
  onClose,
  onUpdated,
}: {
  admin?: PlatformAdminDetail;
  onClose: () => void;
  onUpdated: (admin: PlatformAdminDetail) => void;
}) {
  const [form] = Form.useForm<Fields>();
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const clearSecrets = () => form.resetFields(['password', 'confirmation']);
  const lifecycle = useDrawerFormLifecycle({
    open: Boolean(admin),
    onOpenChange: next => {
      if (!next) {
        clearSecrets();
        onClose();
      }
    },
    dirtyMessage: '已输入的新密码不会保存。',
    idempotencyKey: true,
    diagnosticOperationId: PLATFORM_ADMIN_OPERATION_IDS.resetPlatformAdminCredential,
  });
  useOverlayLock(Boolean(admin));
  useEffect(() => {
    if (admin) {
      form.resetFields();
      setProblem(undefined);
      lifecycle.reset();
    }
  }, [admin, form, lifecycle]);
  const submit = async (value: Fields) => {
    if (!admin || lifecycle.submitting) return;
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      const updated = await platformClient.resetPlatformAdminCredential(
        {platformAdminId: admin.id},
        {
          body: {
            password: value.password,
            expectedVersion: admin.version,
            idempotencyKey: lifecycle.getIdempotencyKey(),
          },
          headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()},
        },
      );
      clearSecrets();
      lifecycle.setDirty(false);
      onUpdated(updated);
    } catch (error) {
      clearSecrets();
      setProblem(platformProblemOf(error));
    } finally {
      lifecycle.setSubmitting(false);
    }
  };
  return (
    <Drawer
      title="重置登录凭据"
      open={Boolean(admin)}
      size={520}
      destroyOnHidden
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      maskClosable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      {...adminDrawerSurfaceProps}
      footer={
        <Space>
          <Button
            onClick={lifecycle.requestClose}
            disabled={lifecycle.submitting}
            {...testId('platform-admin-credential-cancel')}
          >
            取消
          </Button>
          <Button
            type="primary"
            danger
            loading={lifecycle.submitting}
            onClick={() => form.submit()}
            {...testId('platform-admin-credential-submit')}
          >
            确认
          </Button>
        </Space>
      }
    >
      <p>为“{admin?.loginName}”设置新的登录密码。新密码不会在详情、后续读取或日志中显示。</p>
      {problem && (
        <Alert type="error" showIcon title={problem.title} description={problem.detail} style={{marginBottom: 16}} />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={value => void submit(value)}
        onValuesChange={() => {
          lifecycle.setDirty(true);
          lifecycle.markBusinessIntentChanged();
        }}
        disabled={lifecycle.submitting}
      >
        <Form.Item name="password" label="新登录密码" rules={[{required: true, min: 8}]}>
          <Input.Password autoComplete="new-password" {...testId('platform-admin-credential-password')} />
        </Form.Item>
        <Form.Item
          name="confirmation"
          label="确认新登录密码"
          dependencies={['password']}
          rules={[
            {required: true},
            ({getFieldValue}) => ({
              validator: (_, value) =>
                value === getFieldValue('password')
                  ? Promise.resolve()
                  : Promise.reject(new Error('两次输入的密码不一致')),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" {...testId('platform-admin-credential-confirmation')} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
