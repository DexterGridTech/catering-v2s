import {Alert, Button, Drawer, Form, Input, Radio, Select, Space, Tag} from 'antd';
import {
  adminDrawerSurfaceProps,
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
import {readExternalProviderCandidates} from '../application/queries';

type Values = {
  templateName: string;
  templateCode: string;
  accessKind: 'INTERNAL' | 'EXTERNAL';
  operatorKind: 'PROJECT' | 'STORE';
  orderKind: 'DINE_IN' | 'TAKEAWAY' | 'GROUP_BUY';
  dineInForm?: 'POS' | 'QR' | 'KIOSK';
  providerCode?: string;
};

export function BusinessChannelTemplateDrawer({
  open,
  queryContext,
  projectRef,
  template,
  onClose,
  onSaved,
}: {
  open: boolean;
  queryContext: OperationsPageContext;
  projectRef: string;
  template?: BusinessChannelTemplateView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm<Values>();
  const [providers, setProviders] = useState<Awaited<ReturnType<typeof readExternalProviderCandidates>>>([]);
  const [problem, setProblem] = useState<string>();
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: value => {
      if (!value) onClose();
    },
    idempotencyKey: true,
    diagnosticOperationId: template
      ? OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsBusinessChannelTemplate
      : OPERATIONS_ADMIN_OPERATION_IDS.createOperationsBusinessChannelTemplate,
  });
  const submission = useSubmissionLifecycle();
  useOverlayLock(open);
  const accessKind = Form.useWatch('accessKind', form);
  const orderKind = Form.useWatch('orderKind', form);

  useEffect(() => {
    if (!open) return;
    setProblem(undefined);
    lifecycle.reset();
    form.setFieldsValue(
      template
        ? {
            templateName: template.templateName,
            templateCode: template.templateCode ?? '',
            accessKind: template.accessKind as Values['accessKind'],
            operatorKind: template.operatorKind as Values['operatorKind'],
            orderKind: template.orderKind as Values['orderKind'],
            dineInForm: template.dineInForm as Values['dineInForm'],
            providerCode: template.providerCode ?? undefined,
          }
        : {
            templateName: undefined,
            templateCode: undefined,
            accessKind: 'INTERNAL',
            operatorKind: 'PROJECT',
            orderKind: 'TAKEAWAY',
            dineInForm: undefined,
            providerCode: undefined,
          },
    );
  }, [form, lifecycle, open, template]);

  useEffect(() => {
    if (!open || accessKind !== 'EXTERNAL') {
      setProviders([]);
      return;
    }
    const capabilityClass = orderKind === 'TAKEAWAY' || orderKind === 'GROUP_BUY' ? orderKind : undefined;
    void readExternalProviderCandidates(queryContext, capabilityClass)
      .then(setProviders)
      .catch(() => setProviders([]));
  }, [accessKind, open, orderKind, queryContext, template]);

  const save = async (values: Values) => {
    setProblem(undefined);
    lifecycle.setSubmitting(true);
    try {
      if (template) {
        await operationsClient.updateOperationsBusinessChannelTemplate(
          {groupWorkspaceKey: queryContext.groupWorkspaceKey, templateRef: template.templateRef},
          {
            body: {templateName: values.templateName.trim(), expectedVersion: template.version},
            headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()},
          },
        );
      } else {
        await operationsClient.createOperationsBusinessChannelTemplate(
          {groupWorkspaceKey: queryContext.groupWorkspaceKey},
          {
            body: {
              projectRef: wireUuid(projectRef),
              templateName: values.templateName.trim(),
              templateCode: values.templateCode.trim(),
              accessKind: values.accessKind,
              operatorKind: values.operatorKind,
              orderKind: values.orderKind,
              dineInForm: values.orderKind === 'DINE_IN' ? (values.dineInForm ?? null) : null,
              providerCode: values.accessKind === 'EXTERNAL' ? (values.providerCode ?? null) : null,
            },
            headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()},
          },
        );
      }
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
      size={600}
      destroyOnHidden
      maskClosable={!lifecycle.submitting}
      closable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      title={template ? '编辑渠道模板' : '新建渠道模板'}
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      {...adminDrawerSurfaceProps}
      {...testId('business-channel-template-form')}
      footer={
        <Space>
          <Button
            onClick={lifecycle.requestClose}
            disabled={lifecycle.submitting}
            {...testId('business-channel-template-form-cancel')}
          >
            取消
          </Button>
          <Button
            type="primary"
            loading={lifecycle.submitting}
            disabled={template?.status === 'DISABLED' || lifecycle.submitting}
            onClick={() => form.submit()}
            {...testId('business-channel-template-form-submit')}
          >
            保存
          </Button>
        </Space>
      }
    >
      {problem && <Alert type="error" showIcon title="保存失败" description={problem} style={{marginBottom: 16}} />}
      <Form
        form={form}
        layout="vertical"
        disabled={lifecycle.submitting}
        onFinish={values => void save(values)}
        onValuesChange={(changed: Partial<Values>, values: Values) => {
          lifecycle.markBusinessIntentChanged();
          if (changed.accessKind === 'INTERNAL') form.setFieldValue('providerCode', undefined);

          if ('orderKind' in changed) {
            if (values.orderKind !== 'DINE_IN') {
              form.setFieldValue('dineInForm', undefined);
            } else {
              form.setFieldsValue({accessKind: 'INTERNAL', providerCode: undefined});
            }
          }
        }}
      >
        <Form.Item label="模板名称" name="templateName" rules={[{required: true, message: '请输入模板名称'}]}>
          <Input disabled={template?.status === 'DISABLED'} />
        </Form.Item>
        <Form.Item label="模板编码" name="templateCode" rules={[{required: true, message: '请输入模板编码'}]}>
          <Input disabled={Boolean(template) || template?.status === 'DISABLED'} />
        </Form.Item>
        <Form.Item label="接入类型" name="accessKind" rules={[{required: true}]}>
          <Radio.Group disabled={Boolean(template)} {...testId('business-channel-template-access-kind')}>
            <Radio value="INTERNAL">内部接入</Radio>
            <Radio value="EXTERNAL" disabled={orderKind === 'DINE_IN'}>
              外部接入
            </Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item label="经营主体" name="operatorKind" rules={[{required: true}]}>
          <Select
            disabled={Boolean(template)}
            options={[
              {value: 'PROJECT', label: '项目'},
              {value: 'STORE', label: '门店'},
            ]}
            {...testId('business-channel-template-operator-kind')}
          />
        </Form.Item>
        <Form.Item label="订单类型" name="orderKind" rules={[{required: true}]}>
          <Select
            disabled={Boolean(template)}
            options={[
              {value: 'DINE_IN', label: '到店点餐'},
              {value: 'TAKEAWAY', label: '外卖'},
              {value: 'GROUP_BUY', label: '团购'},
            ]}
            {...testId('business-channel-template-order-kind')}
          />
        </Form.Item>
        {orderKind === 'DINE_IN' && (
          <Form.Item label="到店点餐形式" name="dineInForm" rules={[{required: true, message: '请选择到店点餐形式'}]}>
            <Select
              disabled={Boolean(template) || accessKind === 'EXTERNAL'}
              options={[
                {value: 'POS', label: 'POS'},
                {value: 'QR', label: '扫码'},
                {value: 'KIOSK', label: '自助机'},
              ]}
              {...testId('business-channel-template-dine-in-form')}
            />
          </Form.Item>
        )}
        {accessKind === 'EXTERNAL' && (
          <Form.Item label="外部接入档案" name="providerCode" rules={[{required: true, message: '请选择外部接入档案'}]}>
            <Select
              disabled={Boolean(template)}
              showSearch
              optionFilterProp="label"
              options={providers.map(provider => ({
                value: provider.providerCode,
                label: (
                  <Space>
                    <span>{provider.displayName}</span>
                    <span>{provider.authenticationKindDisplayName}</span>
                    <span>{provider.bindableNodeTypeDisplayNames?.join('、') || '—'}</span>
                    <Tag>{provider.catalogStatusDisplayName || '—'}</Tag>
                  </Space>
                ),
              }))}
              {...testId('business-channel-template-provider')}
            />
          </Form.Item>
        )}
      </Form>
    </Drawer>
  );
}
