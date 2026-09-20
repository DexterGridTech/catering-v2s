import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Switch,
  Typography,
} from 'antd';
import type {FormInstance} from 'antd';
import {
  AdminImageCollectionEditor,
  adminDetailDescriptionsProps,
  adminWideDrawerSurfaceProps,
  testId,
} from '@catering-v2s/admin-ui-foundation';
import type {ExtensionDefinition} from '../../../app/api/generated/operations-edge';
import {AssetPreview} from '../../../app/components/AssetPreview';
import {
  enabledStoreServicePointExtensionFields,
  storeServicePointAreaTypeLabels,
  storeServicePointShapeLabels,
  StoreServicePointDrawerLifecycle,
  PointEditor,
  PointFormValues,
  StoreServicePointImage,
} from '../model/storeServicePointModel';
import {storeServicePointTestIds} from '../storeServicePointTestIds';

const IMAGE_LIMITS = {maxImageCount: 1, maxImageBytes: 2 * 1024 * 1024} as const;

function ExtensionFormItems({definition}: {definition?: ExtensionDefinition}) {
  return (
    <>
      {enabledStoreServicePointExtensionFields(definition).map(field => {
        const locator = `store-service-point-extension-${field.key}`;
        const control =
          field.type === 'NUMBER' ? (
            <InputNumber style={{width: '100%'}} {...testId(locator)} />
          ) : field.type === 'BOOLEAN' ? (
            <Switch {...testId(locator)} />
          ) : field.type === 'DATE' ? (
            <DatePicker style={{width: '100%'}} {...testId(locator)} />
          ) : field.type === 'SELECT' ? (
            <Select
              options={field.options.map(option => ({value: option, label: option}))}
              style={{width: '100%'}}
              {...testId(locator)}
            />
          ) : (
            <Input maxLength={2000} {...testId(locator)} />
          );
        return (
          <Form.Item
            key={field.key}
            name={['extensionValues', field.key]}
            label={field.label}
            rules={field.required ? [{required: true, message: `请输入${field.label}`}] : []}
            valuePropName={field.type === 'BOOLEAN' ? 'checked' : undefined}
          >
            {control}
          </Form.Item>
        );
      })}
    </>
  );
}

function PointImageEditor({
  items,
  onStageMedia,
  onRemoveMedia,
  onMoveMedia,
}: {
  items: readonly StoreServicePointImage[];
  onStageMedia: (file: File, existingId?: string) => void | Promise<void>;
  onRemoveMedia: (id: string, index: number) => void | Promise<void>;
  onMoveMedia: (id: string, offset: -1 | 1) => void;
}) {
  return (
    <AdminImageCollectionEditor
      items={items}
      limits={IMAGE_LIMITS}
      labels={{
        title: '桌台图片',
        formatLimits: count => `${count}/1 · 单张上限 2MB`,
        loading: '图片规则加载中',
        atLimit: '已配置图片',
        upload: '上传图片',
        empty: '未配置图片',
        pendingPreview: item => (
          <span style={{width: 96, height: 72, display: 'grid', placeItems: 'center'}}>
            <Typography.Text type="secondary">{item.status === 'FAILED' ? '图片上传失败' : '待上传'}</Typography.Text>
          </span>
        ),
        renderPreview: (item, index, previewId) => (
          <AssetPreview
            assetRef={item.assetRef}
            localFile={item.file}
            alt={`${index === 0 ? '桌台主图' : '桌台图片'}预览`}
            width={96}
            height={72}
            testId={previewId}
          />
        ),
        renderStatus: item =>
          item.status === 'UPLOADING'
            ? '上传中/处理中'
            : item.status === 'FAILED'
              ? (item.error ?? '上传失败')
              : item.staged
                ? '待保存'
                : '已配置',
        positionLabel: () => '图片',
        replace: '替换',
        retry: '重试',
        moveUp: '上移',
        moveDown: '下移',
        setPrimary: '设为主图',
        remove: '移除',
      }}
      testIds={{
        root: storeServicePointTestIds.pointImageUpload,
        upload: `${storeServicePointTestIds.pointImageUpload}-upload`,
        list: `${storeServicePointTestIds.pointImageUpload}-list`,
        item: (identity, action) => `${storeServicePointTestIds.pointImageUpload}-${identity}-${action}`,
      }}
      onStageMedia={onStageMedia}
      onRemoveMedia={onRemoveMedia}
      onMoveMedia={onMoveMedia}
      onSetPrimaryMedia={() => undefined}
    />
  );
}

export function ServicePointDrawer({
  editor,
  form,
  lifecycle,
  extensionDefinition,
  extensionDefinitionError,
  extensionDefinitionLoading,
  onRetryExtensionDefinition,
  pointProblem,
  imageItems,
  onStageMedia,
  onRemoveMedia,
  onMoveMedia,
  onAfterOpenChange,
  onFinish,
  onValuesChange,
}: {
  editor?: PointEditor;
  form: FormInstance<PointFormValues>;
  lifecycle: StoreServicePointDrawerLifecycle;
  extensionDefinition?: ExtensionDefinition;
  extensionDefinitionError?: unknown;
  extensionDefinitionLoading: boolean;
  onRetryExtensionDefinition: () => void;
  pointProblem?: string;
  imageItems: readonly StoreServicePointImage[];
  onStageMedia: (file: File, existingId?: string) => void | Promise<void>;
  onRemoveMedia: (id: string, index: number) => void | Promise<void>;
  onMoveMedia: (id: string, offset: -1 | 1) => void;
  onAfterOpenChange: (visible: boolean) => void;
  onFinish: (values: PointFormValues) => void;
  onValuesChange: () => void;
}) {
  return (
    <Drawer
      open={Boolean(editor)}
      title={
        editor
          ? editor.mode === 'create'
            ? `新建${editor.areaType === 'TABLE_AREA' ? '桌台' : '扫码点'}`
            : `编辑${editor.areaType === 'TABLE_AREA' ? '桌台' : '扫码点'}资料`
          : '编辑'
      }
      onClose={lifecycle.requestClose}
      afterOpenChange={onAfterOpenChange}
      destroyOnHidden
      maskClosable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      closable={!lifecycle.submitting}
      {...adminWideDrawerSurfaceProps}
      {...testId(storeServicePointTestIds.pointDrawer(editor?.areaType === 'TABLE_AREA' ? 'table' : 'scan'))}
      footer={
        <Space>
          <Button
            onClick={lifecycle.requestClose}
            disabled={lifecycle.submitting}
            {...testId(storeServicePointTestIds.pointCancel)}
          >
            取消
          </Button>
          <Button
            type="primary"
            loading={lifecycle.submitting}
            disabled={!extensionDefinition || Boolean(extensionDefinitionError)}
            onClick={() => form.submit()}
            {...testId(storeServicePointTestIds.pointSave)}
          >
            保存
          </Button>
        </Space>
      }
    >
      {pointProblem && (
        <Alert type="error" showIcon title="保存未完成" description={pointProblem} style={{marginBottom: 16}} />
      )}
      {extensionDefinitionError ? (
        <Alert
          type="error"
          showIcon
          title="字段配置读取失败"
          description="暂时无法获取桌台与扫码点字段配置，请重试。"
          action={<Button onClick={onRetryExtensionDefinition}>重试</Button>}
        />
      ) : extensionDefinitionLoading && !extensionDefinition ? (
        <Spin tip="字段配置加载中…" />
      ) : (
        <Form
          form={form}
          layout="vertical"
          disabled={lifecycle.submitting}
          onFinish={onFinish}
          onValuesChange={onValuesChange}
        >
          <Descriptions
            {...adminDetailDescriptionsProps}
            column={1}
            style={{marginBottom: 16}}
            {...testId(storeServicePointTestIds.pointAreaContext)}
          >
            <Descriptions.Item label="所属区域">
              {editor ? `${editor.areaName}（${storeServicePointAreaTypeLabels[editor.areaType]}）` : '—'}
            </Descriptions.Item>
          </Descriptions>
          <Form.Item
            name="name"
            label={`${editor?.areaType === 'TABLE_AREA' ? '桌台' : '扫码点'}名称`}
            rules={[{required: true, whitespace: true, message: '请输入名称'}]}
          >
            <Input maxLength={120} {...testId(storeServicePointTestIds.pointName)} />
          </Form.Item>
          <Form.Item name="code" label="编码" rules={[{required: true, whitespace: true, message: '请输入编码'}]}>
            <Input maxLength={64} {...testId(storeServicePointTestIds.pointCode)} />
          </Form.Item>
          {editor?.areaType === 'TABLE_AREA' && (
            <>
              <Form.Item
                name="seatCapacity"
                label="容纳人数"
                rules={[{type: 'number', min: 1, message: '请输入正整数'}]}
              >
                <InputNumber
                  min={1}
                  precision={0}
                  style={{width: '100%'}}
                  {...testId(storeServicePointTestIds.pointCapacity)}
                />
              </Form.Item>
              <Form.Item name="tableShape" label="形态">
                <Select
                  options={Object.entries(storeServicePointShapeLabels).map(([value, label]) => ({value, label}))}
                  {...testId(storeServicePointTestIds.pointShape)}
                />
              </Form.Item>
              <Form.Item name="reservable" label="是否可预约">
                <Select
                  allowClear
                  placeholder="未设置"
                  options={[
                    {value: true, label: '是'},
                    {value: false, label: '否'},
                  ]}
                  {...testId(storeServicePointTestIds.pointReservable)}
                />
              </Form.Item>
              <PointImageEditor
                items={imageItems}
                onStageMedia={onStageMedia}
                onRemoveMedia={onRemoveMedia}
                onMoveMedia={onMoveMedia}
              />
            </>
          )}
          <div style={{marginTop: 16}} {...testId(storeServicePointTestIds.pointExtension)}>
            <ExtensionFormItems definition={extensionDefinition} />
          </div>
        </Form>
      )}
    </Drawer>
  );
}
