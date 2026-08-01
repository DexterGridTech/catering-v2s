import {Alert, Button, Drawer, Form, Input, Modal, Select, Space, type FormInstance, type FormListFieldData} from 'antd';
import {adminDrawerSurfaceProps, testId, useDrawerFormLifecycle, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {PLATFORM_ADMIN_OPERATION_IDS, type ExtensionDefinition} from '../../../app/api/generated/platform-edge';
import {platformClient, platformProblemOf, type PlatformApiProblem} from '../../../app/api/PlatformTransport';

type DefinitionField = ExtensionDefinition['definitions'][number];
type ExtensionFieldDraft = Omit<DefinitionField, 'key' | 'options'> & {key?: string; optionsText: string};
type ExtensionEditorFields = {definitions: ExtensionFieldDraft[]};

const fieldTypeOptions: Array<{value: DefinitionField['type']; label: string}> = [
  {value: 'TEXT', label: '文本'}, {value: 'NUMBER', label: '数值'}, {value: 'DATE', label: '日期'},
  {value: 'BOOLEAN', label: '是/否'}, {value: 'SELECT', label: '单选'},
];
const fieldStatusOptions: Array<{value: NonNullable<DefinitionField['status']>; label: string}> = [
  {value: 'ENABLED', label: '启用'}, {value: 'DISABLED', label: '停用'},
];
const fieldTypeLabel = (value?: DefinitionField['type']) => fieldTypeOptions.find((option) => option.value === value)?.label ?? '—';

type RowProps = {field: FormListFieldData; index: number; count: number; form: FormInstance<ExtensionEditorFields>; onMove: (from: number, to: number) => void; onRemove: (name: number) => void; onDragStart: (index: number) => void; onDrop: (index: number) => void};

function ExtensionEditorRow({field, index, count, form, onMove, onRemove, onDragStart, onDrop}: RowProps) {
  const type = Form.useWatch(['definitions', field.name, 'type'], form) as DefinitionField['type'] | undefined;
  const ownerKey = Form.useWatch(['definitions', field.name, 'key'], form) as string | undefined;
  const isExisting = Boolean(ownerKey);
  const changeType = (next: DefinitionField['type']) => {
    const optionsPath: ['definitions', number, 'optionsText'] = ['definitions', field.name, 'optionsText'];
    if (type === 'SELECT' && next !== 'SELECT' && form.getFieldValue(optionsPath)) {
      Modal.confirm({
        title: '清除单选选项？', content: '字段改为非单选类型后，已填写的选项将被清除。', okText: '清除并继续', cancelText: '保留单选',
        onOk: () => form.setFieldValue(optionsPath, ''),
        onCancel: () => form.setFieldValue(['definitions', field.name, 'type'] as ['definitions', number, 'type'], 'SELECT'),
      });
    }
  };
  return <div draggable onDragStart={() => onDragStart(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => onDrop(index)} style={{padding: '12px 0', borderBottom: '1px solid var(--ant-color-border-secondary)', cursor: 'grab'}}>
    <Space align="start" wrap style={{display: 'flex'}}>
      <Form.Item label="字段名称" name={[field.name, 'label']} rules={[{required: true, whitespace: true}]}><Input style={{width: 160}} {...testId(`extension-definition-label-${index}`)}/></Form.Item>
      <Form.Item label="字段类型" name={[field.name, 'type']} rules={[{required: true}]}>{isExisting ? <Input value={fieldTypeLabel(type)} readOnly style={{width: 110}} {...testId(`extension-definition-type-${index}`)}/> : <Select style={{width: 110}} options={fieldTypeOptions} onChange={changeType} {...testId(`extension-definition-type-${index}`)}/>}</Form.Item>
      <Form.Item label="是否必填" name={[field.name, 'required']} rules={[{required: true}]}><Select style={{width: 92}} options={[{value: true, label: '是'}, {value: false, label: '否'}]} {...testId(`extension-definition-required-${index}`)}/></Form.Item>
      <Form.Item label="是否启用" name={[field.name, 'status']}><Select style={{width: 100}} options={fieldStatusOptions} {...testId(`extension-definition-status-${index}`)}/></Form.Item>
      <Form.Item label="显示顺序"><Input value={index + 1} readOnly style={{width: 82}} {...testId(`extension-definition-order-${index}`)}/></Form.Item>
      {type === 'SELECT' && <Form.Item label="选项（顿号分隔）" name={[field.name, 'optionsText']} rules={[{required: true, whitespace: true, message: '请填写至少一个单选选项'}, {validator: (_, value) => { const options = String(value ?? '').split('、').map((option) => option.trim()).filter(Boolean); return options.length && new Set(options).size === options.length ? Promise.resolve() : Promise.reject(new Error('单选选项不能为空或重复')); }}]}><Input style={{width: 190}} {...testId(`extension-definition-options-${index}`)}/></Form.Item>}
      <Button type="text" disabled={index === 0} onClick={() => onMove(index, index - 1)} {...testId(`extension-definition-move-up-${index}`)}>上移</Button>
      <Button type="text" disabled={index === count - 1} onClick={() => onMove(index, index + 1)} {...testId(`extension-definition-move-down-${index}`)}>下移</Button>
      <Button danger type="text" onClick={() => onRemove(field.name)} {...testId(`extension-definition-remove-${index}`)}>删除</Button>
    </Space>
  </div>;
}

type Props = {definition?: ExtensionDefinition; displayName?: string; groupWorkspaceKey: string; onClose: () => void; onSaved: (definition: ExtensionDefinition) => void; onConflict: (entityType: ExtensionDefinition['entityType']) => void};

/** Edits one complete owner-defined field set; no browser-generated field identity exists. */
export function ExtensionDefinitionEditDrawer({definition, displayName, groupWorkspaceKey, onClose, onSaved, onConflict}: Props) {
  const [form] = Form.useForm<ExtensionEditorFields>();
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const [dragIndex, setDragIndex] = useState<number>();
  const {getIdempotencyKey, markBusinessIntentChanged, reset: resetSubmission} = useSubmissionLifecycle();
  const lifecycle = useDrawerFormLifecycle({open: Boolean(definition), onOpenChange: (open) => { if (!open) { resetSubmission(); onClose(); } }, dirtyMessage: '已填写的字段配置不会保存。', diagnosticOperationId: PLATFORM_ADMIN_OPERATION_IDS.replaceExtensionDefinition});
  useOverlayLock(Boolean(definition));
  useEffect(() => {
    if (!definition) return;
    form.setFieldsValue({definitions: definition.definitions.map((field, index) => ({...field, displayOrder: field.displayOrder ?? index, optionsText: field.type === 'SELECT' ? field.options.join('、') : ''}))});
    setProblem(undefined); setDragIndex(undefined); resetSubmission(); lifecycle.reset();
  }, [definition, form, lifecycle, resetSubmission]);
  const submit = async (value: ExtensionEditorFields) => {
    if (!definition || lifecycle.submitting) return;
    lifecycle.setSubmitting(true); setProblem(undefined);
    try {
      const updated = await platformClient.replaceExtensionDefinition({groupWorkspaceKey, entityType: definition.entityType}, {body: {definitions: value.definitions.map((field, index) => ({...(field.key ? {key: field.key} : {}), label: field.label.trim(), type: field.type, required: field.required, options: field.type === 'SELECT' ? field.optionsText.split('、').map((option) => option.trim()).filter(Boolean) : [], status: field.status ?? 'ENABLED', displayOrder: index})), expectedVersion: definition.revision}, headers: {'Idempotency-Key': getIdempotencyKey()}});
      resetSubmission(); lifecycle.setDirty(false); lifecycle.closeAfterSuccess(); onSaved(updated);
    } catch (error) {
      const currentProblem = platformProblemOf(error);
      if (currentProblem.errorCode === 'EXTENSION_DEFINITION_VERSION_CONFLICT') { lifecycle.setDirty(false); onClose(); onConflict(definition.entityType); }
      else setProblem(currentProblem);
    } finally { lifecycle.setSubmitting(false); }
  };
  return <Drawer title={`编辑${displayName ?? ''}字段配置`} open={Boolean(definition)} width={980} destroyOnHidden onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} maskClosable keyboard={!lifecycle.submitting} {...adminDrawerSurfaceProps} footer={<Space><Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting}>取消</Button><Button type="primary" loading={lifecycle.submitting} onClick={() => form.submit()} {...testId('extension-definition-save')}>保存</Button></Space>}>
    {problem && <Alert type="error" showIcon message={problem.title} description={problem.detail} style={{marginBottom: 16}}/>}
    <Form form={form} layout="vertical" onFinish={(value) => void submit(value)} onValuesChange={() => { lifecycle.setDirty(true); markBusinessIntentChanged(); }} disabled={lifecycle.submitting}>
      <Form.List name="definitions">{(fields, {add, move, remove}) => <>
        {fields.map((field, index) => <ExtensionEditorRow key={field.key} field={field} index={index} count={fields.length} form={form} onMove={move} onRemove={remove} onDragStart={setDragIndex} onDrop={(target) => { if (dragIndex !== undefined && dragIndex !== target) move(dragIndex, target); setDragIndex(undefined); }}/>) }
        <Button onClick={() => add({label: '', type: 'TEXT', required: false, status: 'ENABLED', optionsText: ''})} {...testId('extension-definition-add')}>添加字段</Button>
      </>}</Form.List>
    </Form>
  </Drawer>;
}
