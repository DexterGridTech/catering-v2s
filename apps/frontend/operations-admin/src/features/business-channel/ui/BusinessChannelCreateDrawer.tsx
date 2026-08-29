import {Alert, Button, Drawer, Form, Input, Select, Space} from 'antd';
import {
  adminDrawerSurfaceProps,
  closedCodeLabel,
  useDrawerFormLifecycle,
  useOverlayLock,
  useSubmissionLifecycle,
  testId,
} from '@catering-v2s/admin-ui-foundation';
import {
  OPERATIONS_ADMIN_OPERATION_IDS,
  type BusinessChannelTemplateView,
} from '../../../app/api/generated/operations-edge';
import type {OperationsPageContext} from '../../../app/routing/model';
import {useEffect, useState} from 'react';
import {operationsClient, operationsProblemOf} from '../../../app/api/OperationsTransport';
import {wireUuid} from '../../../app/api/wireUuid';
import {operatorKindLabels} from '../model/businessChannelCodeLabels';

export function BusinessChannelCreateDrawer({
  open,
  queryContext,
  ownerNodeType,
  ownerNodeRef,
  templates,
  onClose,
  onSaved,
}: {
  open: boolean;
  queryContext: OperationsPageContext;
  ownerNodeType: 'PROJECT' | 'STORE';
  ownerNodeRef: string;
  templates: BusinessChannelTemplateView[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm<{templateRef: string; channelCode: string; channelName: string}>();
  const [problem, setProblem] = useState<string>();
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: value => {
      if (!value) onClose();
    },
    idempotencyKey: true,
    diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.createOperationsBusinessChannel,
  });
  const submission = useSubmissionLifecycle();
  useOverlayLock(open);
  useEffect(() => {
    if (!open) return;
    setProblem(undefined);
    lifecycle.reset();
    form.resetFields();
  }, [form, lifecycle, open]);
  const save = async (values: {templateRef: string; channelCode: string; channelName: string}) => {
    setProblem(undefined);
    lifecycle.setSubmitting(true);
    try {
      await operationsClient.createOperationsBusinessChannel(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {
          body: {
            templateRef: wireUuid(values.templateRef),
            ownerNodeType,
            ownerNodeRef: wireUuid(ownerNodeRef),
            channelCode: values.channelCode.trim(),
            channelName: values.channelName.trim(),
            bindingRef: null,
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
  const availableTemplates =
    ownerNodeType === 'STORE'
      ? templates.filter(template => template.operatorKind === 'STORE' && template.status === 'ENABLED')
      : templates.filter(template => template.operatorKind === 'PROJECT' && template.status === 'ENABLED');
  return (
    <Drawer
      open={open}
      size={520}
      destroyOnHidden
      maskClosable={!lifecycle.submitting}
      closable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      title="新建经营渠道"
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      {...adminDrawerSurfaceProps}
      {...testId(`${ownerNodeType.toLocaleLowerCase()}-business-channel-create`)}
      footer={
        <Space>
          <Button
            onClick={lifecycle.requestClose}
            disabled={lifecycle.submitting}
            {...testId(`${ownerNodeType.toLocaleLowerCase()}-business-channel-create-cancel`)}
          >
            取消
          </Button>
          <Button
            type="primary"
            loading={lifecycle.submitting}
            disabled={!availableTemplates.length || lifecycle.submitting}
            onClick={() => form.submit()}
            {...testId(`${ownerNodeType.toLocaleLowerCase()}-business-channel-create-submit`)}
          >
            保存
          </Button>
        </Space>
      }
    >
      {problem && <Alert type="error" showIcon title="保存失败" description={problem} />}
      <Form
        form={form}
        layout="vertical"
        disabled={lifecycle.submitting}
        onFinish={values => void save(values)}
        onValuesChange={() => lifecycle.markBusinessIntentChanged()}
      >
        <Form.Item label="渠道模板" name="templateRef" rules={[{required: true, message: '请选择渠道模板'}]}>
          <Select
            showSearch
            optionFilterProp="label"
            options={availableTemplates.map(template => ({
              value: template.templateRef,
              label: `${template.templateName}（${closedCodeLabel(operatorKindLabels, template.operatorKind)}）`,
            }))}
            {...testId(`${ownerNodeType.toLocaleLowerCase()}-business-channel-template-select`)}
          />
        </Form.Item>
        <Form.Item label="渠道编码" name="channelCode" rules={[{required: true, message: '请输入渠道编码'}]}>
          <Input />
        </Form.Item>
        <Form.Item label="渠道名称" name="channelName" rules={[{required: true, message: '请输入渠道名称'}]}>
          <Input />
        </Form.Item>
        {!availableTemplates.length && <Alert type="info" showIcon title="当前没有可选的渠道模板。" />}
      </Form>
    </Drawer>
  );
}
