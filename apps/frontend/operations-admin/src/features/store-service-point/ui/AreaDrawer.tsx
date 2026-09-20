import {Button, Drawer, Form, Input, Select, Space} from 'antd';
import type {FormInstance} from 'antd';
import {adminDrawerSurfaceProps, testId} from '@catering-v2s/admin-ui-foundation';
import type {
  AreaEditor,
  AreaFormValues,
  StoreServicePointDrawerLifecycle,
} from '../model/storeServicePointModel';
import {storeServicePointAreaTypeLabels} from '../model/storeServicePointModel';
import {storeServicePointTestIds} from '../storeServicePointTestIds';

export function AreaDrawer({
  editor,
  form,
  lifecycle,
  onFinish,
  onValuesChange,
}: {
  editor?: AreaEditor;
  form: FormInstance<AreaFormValues>;
  lifecycle: StoreServicePointDrawerLifecycle;
  onFinish: (values: AreaFormValues) => void;
  onValuesChange: () => void;
}) {
  return (
    <Drawer
      open={Boolean(editor)}
      title={editor?.mode === 'create' ? '新建区域' : '编辑区域'}
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      destroyOnHidden
      maskClosable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      closable={!lifecycle.submitting}
      {...adminDrawerSurfaceProps}
      {...testId(storeServicePointTestIds.areaDrawer)}
      footer={
        <Space>
          <Button
            onClick={lifecycle.requestClose}
            disabled={lifecycle.submitting}
            {...testId(storeServicePointTestIds.areaCancel)}
          >
            取消
          </Button>
          <Button
            type="primary"
            loading={lifecycle.submitting}
            onClick={() => form.submit()}
            {...testId(storeServicePointTestIds.areaSave)}
          >
            保存
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        disabled={lifecycle.submitting}
        onFinish={onFinish}
        onValuesChange={onValuesChange}
      >
        <Form.Item
          name="name"
          label="区域名称"
          rules={[{required: true, whitespace: true, message: '请输入区域名称'}]}
        >
          <Input maxLength={120} {...testId(storeServicePointTestIds.areaName)} />
        </Form.Item>
        <Form.Item
          name="code"
          label="区域编码"
          rules={[{required: true, whitespace: true, message: '请输入区域编码'}]}
        >
          <Input maxLength={64} {...testId(storeServicePointTestIds.areaCode)} />
        </Form.Item>
        <Form.Item name="areaType" label="区域类型" rules={[{required: true, message: '请选择区域类型'}]}>
          <Select
            disabled={editor?.mode === 'edit'}
            options={Object.entries(storeServicePointAreaTypeLabels).map(([value, label]) => ({value, label}))}
            {...testId(storeServicePointTestIds.areaType)}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
