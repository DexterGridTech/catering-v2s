import {Alert, Button, Card, Form, Input, Typography} from 'antd';
import {testId, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useState} from 'react';
import {operationsClient, operationsProblemOf} from '../../../app/api/OperationsTransport';

type FormValue = {currentPassword: string; newPassword: string; confirmation: string};

/** Forced credential transition: no shell, role, or data-scope state is available here. */
export function OperationsForcedPasswordChangePage({
  groupWorkspaceKey,
  contextVersion,
  onCompleted,
}: {
  groupWorkspaceKey: string;
  contextVersion: number;
  onCompleted: () => void;
}) {
  const [form] = Form.useForm<FormValue>();
  const [problem, setProblem] = useState<string>();
  const [pending, setPending] = useState(false);
  const submission = useSubmissionLifecycle();
  const submit = async (value: FormValue) => {
    if (pending) return;
    setPending(true);
    setProblem(undefined);
    try {
      await operationsClient.changeCurrentWorkspacePassword(
        {groupWorkspaceKey},
        {
          body: {
            currentPassword: value.currentPassword,
            newPassword: value.newPassword,
            expectedSessionVersion: contextVersion,
          },
          headers: {'Idempotency-Key': submission.getIdempotencyKey()},
        },
      );
      form.resetFields();
      submission.reset();
      onCompleted();
    } catch (error) {
      form.resetFields(['currentPassword', 'newPassword', 'confirmation']);
      submission.reset();
      setProblem(operationsProblemOf(error).detail);
    } finally {
      setPending(false);
    }
  };
  return (
    <main className="auth-page" {...testId('operations-forced-password-change-page')}>
      <Card className="auth-card" title="请修改登录密码">
        <Typography.Paragraph>
          管理员已将你的临时密码重置为你的登录账号。为保护账号安全，请先设置新密码。
        </Typography.Paragraph>
        {problem && <Alert type="error" showIcon title="密码修改失败" description={problem} />}
        <Form form={form} layout="vertical" onFinish={value => void submit(value)}>
          <Form.Item label="当前密码" name="currentPassword" rules={[{required: true, message: '请输入当前密码'}]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item label="新密码" name="newPassword" rules={[{required: true, min: 8, message: '新密码至少8位'}]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmation"
            dependencies={['newPassword']}
            rules={[
              {required: true, message: '请再次输入新密码'},
              ({getFieldValue}) => ({
                validator: (_, value) =>
                  !value || value === getFieldValue('newPassword')
                    ? Promise.resolve()
                    : Promise.reject(new Error('两次输入的新密码不一致')),
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={pending}
            block
            {...testId('operations-forced-password-change-submit')}
          >
            保存新密码并重新登录
          </Button>
        </Form>
      </Card>
    </main>
  );
}
