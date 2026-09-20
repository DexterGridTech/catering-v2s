import {Alert, Button, Drawer, Form, Select, Space, Switch} from 'antd';
import type {FormInstance} from 'antd';
import {adminDrawerSurfaceProps, testId} from '@catering-v2s/admin-ui-foundation';
import {operationsProblemOf} from '../../../app/api/OperationsTransport';
import type {QrFormValues, StoreServicePointDrawerLifecycle} from '../model/storeServicePointModel';
import {storeServicePointTestIds} from '../storeServicePointTestIds';

export function QrConfigurationDrawer({
  open,
  form,
  lifecycle,
  options,
  configurationReady,
  candidatesLoading,
  candidatesError,
  onRetryCandidates,
  onFinish,
  onValuesChange,
}: {
  open: boolean;
  form: FormInstance<QrFormValues>;
  lifecycle: StoreServicePointDrawerLifecycle;
  options: Array<{value: string; label: string; 'data-testid': string}>;
  configurationReady: boolean;
  candidatesLoading: boolean;
  candidatesError?: unknown;
  onRetryCandidates: () => void;
  onFinish: (values: QrFormValues) => void;
  onValuesChange: () => void;
}) {
  return (
    <Drawer
      open={open}
      title="编辑二维码配置"
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      destroyOnHidden
      maskClosable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      closable={!lifecycle.submitting}
      {...adminDrawerSurfaceProps}
      {...testId(storeServicePointTestIds.qrDrawer)}
      footer={
        <Space>
          <Button
            onClick={lifecycle.requestClose}
            disabled={lifecycle.submitting}
            {...testId(storeServicePointTestIds.qrCancel)}
          >
            取消
          </Button>
          <Button
            type="primary"
            loading={lifecycle.submitting}
            disabled={!configurationReady || candidatesLoading}
            onClick={() => form.submit()}
            {...testId(storeServicePointTestIds.qrSave)}
          >
            保存
          </Button>
        </Space>
      }
    >
      {candidatesError ? (
        <Alert
          type="error"
          showIcon
          title="门店渠道读取失败"
          description={operationsProblemOf(candidatesError).detail || '请重试或稍后再试。'}
          action={<Button onClick={onRetryCandidates}>重试</Button>}
        />
      ) : null}
      <Form
        form={form}
        layout="vertical"
        disabled={lifecycle.submitting}
        onFinish={onFinish}
        onValuesChange={onValuesChange}
      >
        <Form.Item name="enabled" label="是否开启二维码下单" valuePropName="checked">
          <Switch {...testId(storeServicePointTestIds.qrEnabled)} />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(previous, current) => previous.enabled !== current.enabled}>
          {({getFieldValue}) => (
            <Form.Item
              name="channelRef"
              label="门店渠道"
              rules={getFieldValue('enabled') ? [{required: true, message: '开启二维码下单后请选择门店渠道'}] : []}
              help={!getFieldValue('enabled') ? '未开启时可以不选择渠道。' : undefined}
            >
              <Select
                allowClear={!getFieldValue('enabled')}
                loading={candidatesLoading}
                options={options}
                placeholder="请选择门店渠道"
                {...testId(storeServicePointTestIds.qrChannel)}
              />
            </Form.Item>
          )}
        </Form.Item>
      </Form>
    </Drawer>
  );
}
