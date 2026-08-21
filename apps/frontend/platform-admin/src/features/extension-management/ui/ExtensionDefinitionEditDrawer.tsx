import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Typography,
  type FormInstance,
  type FormListFieldData,
} from 'antd';
import {
  adminDrawerSurfaceProps,
  testId,
  useDrawerFormLifecycle,
  useOverlayLock,
  useSubmissionLifecycle,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {PLATFORM_ADMIN_OPERATION_IDS, type ExtensionDefinition} from '../../../app/api/generated/platform-edge';
import {platformClient, platformProblemOf, type PlatformApiProblem} from '../../../app/api/PlatformTransport';

type DefinitionField = ExtensionDefinition['definitions'][number];
type ExtensionDraftField = Omit<DefinitionField, 'key'> & {key?: string};
type ExtensionEditorFields = {definitions: ExtensionDraftField[]};

const fieldTypeOptions: Array<{value: DefinitionField['type']; label: string}> = [
  {value: 'TEXT', label: '文本'},
  {value: 'NUMBER', label: '数值'},
  {value: 'DATE', label: '日期'},
  {value: 'BOOLEAN', label: '是/否'},
  {value: 'SELECT', label: '单选'},
];
const fieldStatusOptions: Array<{value: NonNullable<DefinitionField['status']>; label: string}> = [
  {value: 'ENABLED', label: '启用'},
  {value: 'DISABLED', label: '停用'},
];
const fieldTypeLabel = (value?: DefinitionField['type']) =>
  fieldTypeOptions.find(option => option.value === value)?.label ?? '—';

type RowProps = {
  field: FormListFieldData;
  index: number;
  form: FormInstance<ExtensionEditorFields>;
  existingKeys: ReadonlySet<string>;
  onRemove: (name: number) => void;
  onDragStart: (index: number) => void;
  onDrop: (index: number) => void;
};

function ExtensionEditorRow({field, index, form, existingKeys, onRemove, onDragStart, onDrop}: RowProps) {
  const type = Form.useWatch(['definitions', field.name, 'type'], form) as DefinitionField['type'] | undefined;
  const fieldKey = Form.useWatch(['definitions', field.name, 'key'], form) as string | undefined;
  const isExisting = existingKeys.has(fieldKey ?? '');
  const changeType = (next: DefinitionField['type']) => {
    const optionsPath: ['definitions', number, 'options'] = ['definitions', field.name, 'options'];
    const options = form.getFieldValue(optionsPath) as string[] | undefined;
    if (type === 'SELECT' && next !== 'SELECT' && options?.length) {
      Modal.confirm({
        title: '清除单选选项？',
        content: '字段改为非单选类型后，已填写的选项将被清除。',
        okText: '清除并继续',
        cancelText: '保留单选',
        onOk: () => form.setFieldValue(optionsPath, []),
        onCancel: () =>
          form.setFieldValue(['definitions', field.name, 'type'] as ['definitions', number, 'type'], 'SELECT'),
      });
    }
  };
  return (
    <Card
      size="small"
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={event => event.preventDefault()}
      onDrop={() => onDrop(index)}
      style={{marginBottom: 12, cursor: 'grab'}}
      title={
        <Space size={8}>
          <Typography.Text strong>字段 {index + 1}</Typography.Text>
          <Typography.Text type="secondary">拖动卡片可调整字段排列</Typography.Text>
        </Space>
      }
      extra={
        <Button
          danger
          type="text"
          onClick={() => onRemove(field.name)}
          {...testId(`extension-definition-remove-${index}`)}
        >
          删除
        </Button>
      }
    >
      <Row gutter={[16, 0]}>
        <Form.Item name={[field.name, 'key']} hidden>
          <Input />
        </Form.Item>
        <Col xs={24} sm={12} lg={6}>
          <Form.Item label="字段名称" name={[field.name, 'label']} rules={[{required: true, whitespace: true}]}>
            <Input {...testId(`extension-definition-label-${index}`)} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          {isExisting ? (
            <Form.Item label="字段类型">
              <Space size={8}>
                <Typography.Text {...testId(`extension-definition-type-display-${index}`)}>
                  {fieldTypeLabel(type)}
                </Typography.Text>
                <Typography.Text type="secondary">已固定</Typography.Text>
                <Form.Item name={[field.name, 'type']} hidden>
                  <Input />
                </Form.Item>
              </Space>
            </Form.Item>
          ) : (
            <Form.Item label="字段类型" name={[field.name, 'type']} rules={[{required: true}]}>
              <Select
                options={fieldTypeOptions}
                onChange={changeType}
                {...testId(`extension-definition-type-${index}`)}
              />
            </Form.Item>
          )}
        </Col>
        <Col xs={12} sm={12} lg={3}>
          <Form.Item label="是否必填" name={[field.name, 'required']} rules={[{required: true}]}>
            <Select
              options={[
                {value: true, label: '是'},
                {value: false, label: '否'},
              ]}
              {...testId(`extension-definition-required-${index}`)}
            />
          </Form.Item>
        </Col>
        <Col xs={12} sm={12} lg={3}>
          <Form.Item label="是否启用" name={[field.name, 'status']}>
            <Select options={fieldStatusOptions} {...testId(`extension-definition-status-${index}`)} />
          </Form.Item>
        </Col>
        {type === 'SELECT' && (
          <Col span={24}>
            <Form.Item label="选项" required>
              <Form.List
                name={[field.name, 'options']}
                rules={[
                  {
                    validator: (_, value) => {
                      const options = Array.isArray(value)
                        ? value.map(option => String(option).trim()).filter(Boolean)
                        : [];
                      return options.length && new Set(options).size === options.length
                        ? Promise.resolve()
                        : Promise.reject(new Error('请填写至少一个不重复的单选选项'));
                    },
                  },
                ]}
              >
                {(optionFields, {add, remove}, {errors}) => (
                  <Space direction="vertical" size={8} style={{width: '100%'}}>
                    {optionFields.map((optionField, optionIndex) => (
                      <Space key={optionField.key} size={8} style={{display: 'flex'}}>
                        <Form.Item
                          {...optionField}
                          rules={[{required: true, whitespace: true, message: '请填写选项'}]}
                          style={{marginBottom: 0, flex: 1}}
                        >
                          <Input
                            aria-label={`选项 ${optionIndex + 1}`}
                            placeholder={`选项 ${optionIndex + 1}`}
                            maxLength={120}
                            {...testId(`extension-definition-option-${index}-${optionIndex}`)}
                          />
                        </Form.Item>
                        <Button
                          danger
                          type="text"
                          onClick={() => remove(optionField.name)}
                          {...testId(`extension-definition-option-remove-${index}-${optionIndex}`)}
                        >
                          删除
                        </Button>
                      </Space>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() => add('')}
                      {...testId(`extension-definition-option-add-${index}`)}
                    >
                      添加选项
                    </Button>
                    <Form.ErrorList errors={errors} />
                  </Space>
                )}
              </Form.List>
            </Form.Item>
          </Col>
        )}
      </Row>
    </Card>
  );
}

type Props = {
  definition?: ExtensionDefinition;
  displayName?: string;
  groupWorkspaceKey: string;
  onClose: () => void;
  onSaved: (definition: ExtensionDefinition) => void;
  onConflict: (entityType: ExtensionDefinition['entityType']) => void;
};

/** Edits one complete owner-defined field set; no browser-generated field identity exists. */
export function ExtensionDefinitionEditDrawer({
  definition,
  displayName,
  groupWorkspaceKey,
  onClose,
  onSaved,
  onConflict,
}: Props) {
  const [form] = Form.useForm<ExtensionEditorFields>();
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const [dragIndex, setDragIndex] = useState<number>();
  const existingKeys = new Set(definition?.definitions.map(field => field.key) ?? []);
  const {getIdempotencyKey, markBusinessIntentChanged, reset: resetSubmission} = useSubmissionLifecycle();
  const lifecycle = useDrawerFormLifecycle({
    open: Boolean(definition),
    onOpenChange: open => {
      if (!open) {
        resetSubmission();
        onClose();
      }
    },
    dirtyMessage: '已填写的字段配置不会保存。',
    diagnosticOperationId: PLATFORM_ADMIN_OPERATION_IDS.replaceExtensionDefinition,
  });
  useOverlayLock(Boolean(definition));
  useEffect(() => {
    if (!definition) return;
    form.setFieldsValue({
      definitions: definition.definitions.map((field, index) => ({
        ...field,
        displayOrder: field.displayOrder ?? index,
        options: field.type === 'SELECT' ? field.options : [],
      })),
    });
    setProblem(undefined);
    setDragIndex(undefined);
    resetSubmission();
    lifecycle.reset();
  }, [definition, form, lifecycle, resetSubmission]);
  const submit = async (value: ExtensionEditorFields) => {
    if (!definition || lifecycle.submitting) return;
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      const updated = await platformClient.replaceExtensionDefinition(
        {groupWorkspaceKey, entityType: definition.entityType},
        {
          body: {
            definitions: value.definitions.map((field, index) => ({
              ...(field.key?.trim() ? {key: field.key.trim()} : {}),
              label: field.label.trim(),
              type: field.type,
              required: field.required,
              options: field.type === 'SELECT' ? field.options.map(option => option.trim()).filter(Boolean) : [],
              status: field.status ?? 'ENABLED',
              displayOrder: index,
            })),
            expectedVersion: definition.revision,
          },
          headers: {'Idempotency-Key': getIdempotencyKey()},
        },
      );
      resetSubmission();
      lifecycle.setDirty(false);
      lifecycle.closeAfterSuccess();
      onSaved(updated);
    } catch (error) {
      const currentProblem = platformProblemOf(error);
      if (currentProblem.errorCode === 'EXTENSION_DEFINITION_VERSION_CONFLICT') {
        lifecycle.setDirty(false);
        onClose();
        onConflict(definition.entityType);
      } else setProblem(currentProblem);
    } finally {
      lifecycle.setSubmitting(false);
    }
  };
  const addField = () => {
    form.setFieldValue('definitions', [
      ...(form.getFieldValue('definitions') ?? []),
      {label: '', type: 'TEXT', required: false, status: 'ENABLED', options: []},
    ]);
    lifecycle.setDirty(true);
    markBusinessIntentChanged();
  };
  return (
    <Drawer
      title={`编辑${displayName ?? ''}字段配置`}
      extra={
        <Button
          type="primary"
          onClick={addField}
          disabled={lifecycle.submitting}
          {...testId('extension-definition-add')}
        >
          添加字段
        </Button>
      }
      open={Boolean(definition)}
      size={980}
      destroyOnHidden
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      maskClosable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      {...adminDrawerSurfaceProps}
      footer={
        <Space>
          <Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting}>
            取消
          </Button>
          <Button
            type="primary"
            loading={lifecycle.submitting}
            onClick={() => form.submit()}
            {...testId('extension-definition-save')}
          >
            保存
          </Button>
        </Space>
      }
    >
      {problem && (
        <Alert
          type="error"
          showIcon
          title={problem.title}
          description={problem.detail}
          style={{marginBottom: 16}}
          {...testId('extension-definition-error')}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={value => void submit(value)}
        onValuesChange={() => {
          lifecycle.setDirty(true);
          markBusinessIntentChanged();
        }}
        disabled={lifecycle.submitting}
      >
        <Form.List name="definitions">
          {(fields, {move, remove}) => (
            <>
              {fields.map((field, index) => (
                <ExtensionEditorRow
                  key={field.key}
                  field={field}
                  index={index}
                  form={form}
                  existingKeys={existingKeys}
                  onRemove={remove}
                  onDragStart={setDragIndex}
                  onDrop={target => {
                    if (dragIndex !== undefined && dragIndex !== target) move(dragIndex, target);
                    setDragIndex(undefined);
                  }}
                />
              ))}
            </>
          )}
        </Form.List>
      </Form>
    </Drawer>
  );
}
