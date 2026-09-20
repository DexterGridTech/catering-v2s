import {Alert, Button, Drawer, Form, Input, Space} from 'antd';
import {
  adminDrawerSurfaceProps,
  isKnownClosedCode,
  useDrawerFormLifecycle,
  useOverlayLock,
  useSubmissionLifecycle,
  testId,
} from '@catering-v2s/admin-ui-foundation';
import {OPERATIONS_ADMIN_OPERATION_IDS, type BusinessChannelView} from '../../../app/api/generated/operations-edge';
import type {OperationsPageContext} from '../../../app/routing/model';
import {useEffect, useState} from 'react';
import {operationsClient, operationsProblemOf} from '../../../app/api/OperationsTransport';
import {wireUuid} from '../../../app/api/wireUuid';
import {lifecycleStatusLabels} from '../model/businessChannelCodeLabels';

type Values = {channelName: string};

export function canSubmitBusinessChannelEdit(channel?: BusinessChannelView): boolean {
  return Boolean(channel) && isKnownClosedCode(lifecycleStatusLabels, channel?.status) && channel?.status !== 'VOIDED';
}

export function BusinessChannelEditDrawer({
  open,
  queryContext,
  channel,
  onClose,
  onSaved,
}: {
  open: boolean;
  queryContext: OperationsPageContext;
  channel?: BusinessChannelView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm<Values>();
  const [problem, setProblem] = useState<string>();
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: value => {
      if (!value) onClose();
    },
    idempotencyKey: true,
    diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsBusinessChannel,
  });
  const submission = useSubmissionLifecycle();
  useOverlayLock(open);
  const channelStatusKnown = channel ? isKnownClosedCode(lifecycleStatusLabels, channel.status) : false;
  const channelEditable = canSubmitBusinessChannelEdit(channel);

  useEffect(() => {
    if (!open) return;
    setProblem(undefined);
    lifecycle.reset();
    form.setFieldsValue({channelName: channel?.channelName ?? ''});
  }, [channel, form, lifecycle, open]);

  const save = async (values: Values) => {
    if (!channel || !channelEditable) {
      if (channel && !channelStatusKnown) setProblem('当前渠道状态无法识别，已停止该操作。');
      return;
    }
    setProblem(undefined);
    lifecycle.setSubmitting(true);
    try {
      await operationsClient.updateOperationsBusinessChannel(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, channelRef: wireUuid(channel.channelRef)},
        {
          body: {
            channelName: values.channelName.trim(),
            bindingRef: channel.bindingRef ?? null,
            expectedVersion: channel.version,
          },
          headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()},
        },
      );
      submission.reset();
      lifecycle.closeAfterSuccess();
      onSaved();
    } catch (error) {
      setProblem(operationsProblemOf(error).detail);
    } finally {
      lifecycle.setSubmitting(false);
    }
  };

  return (
    <Drawer
      open={open}
      size={520}
      destroyOnHidden
      maskClosable={!lifecycle.submitting}
      closable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      title="编辑经营渠道"
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      {...adminDrawerSurfaceProps}
      {...testId('business-channel-edit')}
      footer={
        <Space>
          <Button
            onClick={lifecycle.requestClose}
            disabled={lifecycle.submitting}
            {...testId('business-channel-edit-cancel')}
          >
            取消
          </Button>
          <Button
            type="primary"
            loading={lifecycle.submitting}
            disabled={lifecycle.submitting || !channelEditable}
            onClick={() => form.submit()}
            {...testId('business-channel-edit-submit')}
          >
            保存
          </Button>
        </Space>
      }
    >
      {problem && <Alert type="error" showIcon title="经营渠道编辑未完成" description={problem} />}
      {channel && !channelStatusKnown && <Alert type="error" showIcon title="当前渠道状态无法识别，已停止编辑。" />}
      {channelStatusKnown && channel?.status === 'VOIDED' && (
        <Alert type="info" showIcon title="该业务渠道已作废，不能继续编辑。" />
      )}
      <Form
        form={form}
        layout="vertical"
        disabled={lifecycle.submitting || !channelEditable}
        onFinish={values => void save(values)}
        onValuesChange={() => lifecycle.markBusinessIntentChanged()}
      >
        <Form.Item label="渠道名称" name="channelName" rules={[{required: true, message: '请输入渠道名称'}]}>
          <Input />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
