import {Alert, Button, Descriptions, Drawer, Form, Input, Space, Tag} from 'antd';
import {
  adminDrawerSurfaceProps,
  useDrawerFormLifecycle,
  useSubmissionLifecycle,
  testId,
} from '@catering-v2s/admin-ui-foundation';
import {
  OPERATIONS_ADMIN_OPERATION_IDS,
  type BusinessChannelView,
  type OwnerBindingView,
} from '../../../app/api/generated/operations-edge';
import type {OperationsPageContext} from '../../../app/routing/model';
import {operationsClient, operationsProblemOf} from '../../../app/api/OperationsTransport';
import {useEffect, useState} from 'react';

export function BusinessChannelBindingDrawer({
  open,
  queryContext,
  channel,
  providerCode,
  authenticationKind,
  onClose,
  onSaved,
}: {
  open: boolean;
  queryContext: OperationsPageContext;
  channel: BusinessChannelView;
  providerCode?: string;
  authenticationKind?: 'EXTERNAL_GRANT' | 'INTERNAL_MAPPING' | 'NO_MAPPING';
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm<{bindingDisplayName?: string; externalOwnerId?: string}>();
  const [binding, setBinding] = useState<OwnerBindingView>();
  const [problem, setProblem] = useState<string>();
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: value => {
      if (!value) onClose();
    },
    idempotencyKey: true,
    diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.createOperationsOwnerBinding,
  });
  const submission = useSubmissionLifecycle();
  useEffect(() => {
    if (!open) return;
    setProblem(undefined);
    lifecycle.reset();
    form.resetFields();
    if (!channel.bindingRef) {
      setBinding(undefined);
      return;
    }
    void operationsClient
      .getOperationsOwnerBindingDetail(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, channelRef: channel.channelRef},
        {},
      )
      .then(value => {
        setBinding(value);
        form.setFieldsValue({
          bindingDisplayName: value.bindingDisplayName ?? undefined,
          externalOwnerId: value.externalOwnerId ?? undefined,
        });
      })
      .catch(error => setProblem(operationsProblemOf(error).detail));
  }, [channel.bindingRef, channel.channelRef, form, lifecycle, open, queryContext.groupWorkspaceKey]);

  const create = async (values: {bindingDisplayName?: string; externalOwnerId?: string}) => {
    if (!providerCode) {
      setProblem('当前模板没有可用于绑定的外部接入档案。');
      return;
    }
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      await operationsClient.createOperationsOwnerBinding(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, channelRef: channel.channelRef},
        {
          body: {
            providerCode,
            nodeType: channel.ownerNodeType,
            nodeRef: channel.ownerNodeRef,
            bindingDisplayName: values.bindingDisplayName?.trim() || null,
            externalOwnerId: authenticationKind === 'INTERNAL_MAPPING' ? values.externalOwnerId?.trim() || null : null,
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

  const remove = async () => {
    if (!binding) return;
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      await operationsClient.deleteOperationsOwnerBinding(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, channelRef: channel.channelRef},
        {
          body: {
            bindingDisplayName: binding.bindingDisplayName ?? null,
            externalOwnerId: binding.externalOwnerId ?? null,
            expectedVersion: binding.version,
          },
          headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()},
        },
      );
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
      title={binding ? '渠道绑定' : '建立渠道绑定'}
      maskClosable={!lifecycle.submitting}
      onClose={lifecycle.requestClose}
      {...adminDrawerSurfaceProps}
      {...testId('business-channel-binding')}
    >
      {problem && <Alert type="error" showIcon title="绑定操作失败" description={problem} />}
      <Alert
        type="info"
        showIcon
        title={`绑定节点：${channel.ownerNodeTypeDisplayName}经营渠道`}
        style={{margin: '16px 0'}}
      />
      {binding && (
        <p>
          当前状态：<Tag>{binding.statusDisplayName}</Tag>
        </p>
      )}
      {binding && authenticationKind === 'EXTERNAL_GRANT' && (
        <Alert
          type="info"
          showIcon
          title="外部授权信息由外部平台回填，当前绑定不能在这里修改。"
          style={{marginBottom: 16}}
        />
      )}
      {authenticationKind === 'NO_MAPPING' && (
        <Alert type="info" showIcon title="此接入档案无需外部主体映射。" style={{marginBottom: 16}} />
      )}
      {binding ? (
        <>
          <Descriptions
            column={1}
            size="small"
            items={[
              {key: 'name', label: '绑定名称', children: binding.bindingDisplayName || '—'},
              {key: 'owner', label: '外部主体编号', children: binding.externalOwnerId || '待外部授权回填'},
            ]}
          />
          <Space style={{marginTop: 16}}>
            <Button onClick={lifecycle.requestClose}>关闭</Button>
            <Button danger onClick={() => void remove()} loading={lifecycle.submitting}>
              删除绑定
            </Button>
          </Space>
        </>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={values => void create(values)}
          onValuesChange={() => lifecycle.markBusinessIntentChanged()}
        >
          <Form.Item label="绑定名称" name="bindingDisplayName">
            <Input />
          </Form.Item>
          {authenticationKind === 'INTERNAL_MAPPING' && (
            <Form.Item
              label="外部主体编号"
              name="externalOwnerId"
              rules={[{required: true, message: '请输入外部主体编号'}]}
            >
              <Input {...testId('owner-binding-external-owner-id')} />
            </Form.Item>
          )}
          <Space>
            <Button onClick={lifecycle.requestClose}>取消</Button>
            <Button type="primary" htmlType="submit" loading={lifecycle.submitting} disabled={!providerCode}>
              建立绑定
            </Button>
          </Space>
        </Form>
      )}
    </Drawer>
  );
}
