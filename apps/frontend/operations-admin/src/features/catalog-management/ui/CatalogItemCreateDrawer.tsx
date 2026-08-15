import {Alert, Button, Drawer, Form, Input, Select, Space} from 'antd';
import {adminWideDrawerSurfaceProps, testId, useDrawerFormLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {catalogInventoryClient, operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import type {CatalogItemCreateRequest, JsonValue} from '../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {requireOperationsScopeRef, type OperationsPageProps} from '../../../app/routing/model';
import {catalogEnumLabel} from '../model/catalogManifestLabels';

type Props = {
  open: boolean;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  initialValues?: {code?: string; name?: string; shapeKey?: string};
  onClose: () => void;
  onCreated: (itemCode: string) => void;
};

type FormValues = {code: string; name: string; shapeKey: string; attributesText?: string};

export function CatalogItemCreateDrawer({open, queryContext, brandRef, initialValues, onClose, onCreated}: Props) {
  const [form] = Form.useForm<FormValues>();
  const [problem, setProblem] = useState<string>();
  const [codeAvailability, setCodeAvailability] = useState<{code: string; available: boolean}>();
  const [checkingCode, setCheckingCode] = useState(false);
  const headers = useMemo(() => brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined, [brandRef]);
  const manifestRequest = useMemo(() => catalogInventoryRtkRequest.getOperationsCatalogShapeManifest({}, {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? '')}, headers}), [headers, queryContext.scopeRef]);
  const manifestQuery = operationsRtk.useGetOperationsCatalogShapeManifestQuery(manifestRequest, {skip: !open || !queryContext.scopeRef});
  const [create, createState] = operationsRtk.useCreateOperationsCatalogItemMutation();
  const lifecycle = useDrawerFormLifecycle({open, onOpenChange: (next) => { if (!next) onClose(); }, dirtyMessage: '新建商品内容尚未保存。', dirtyGuardTestIds: {confirm: testId('catalog-create-dirty-discard'), cancel: testId('catalog-create-dirty-continue')}, diagnosticOperationId: 'catalog-item-create', idempotencyKey: true});
  const manifest = manifestQuery.data?.data;
  const shapeKeys = manifest?.shapeKeys ?? [];
  const shapeOptions = shapeKeys.map((shapeKey) => ({value: shapeKey, label: catalogEnumLabel(manifest, 'shapeKey', shapeKey), disabled: shapeKey === 'BENEFIT_SHELL'}));

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setProblem(undefined);
      lifecycle.reset();
      return;
    }
    form.setFieldsValue({code: initialValues?.code, name: initialValues?.name, shapeKey: initialValues?.shapeKey});
    setCodeAvailability(undefined);
  }, [form, initialValues, lifecycle, open]);

  const checkCodeAvailability = async (rawCode: string | undefined) => {
    const code = rawCode?.trim().toUpperCase() ?? '';
    if (!code || !/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) {
      setCodeAvailability(undefined);
      return undefined;
    }
    setCheckingCode(true);
    try {
      await catalogInventoryClient.getOperationsCatalogItem({itemCode: code}, {query: {dataNodeRef: requireOperationsScopeRef(queryContext)}, headers});
      setCodeAvailability({code, available: false});
      form.setFields([{name: 'code', errors: ['当前作用域中已存在该商品编码。']}]);
      return false;
    } catch (error) {
      const feedback = operationsProblemOf(error);
      if (feedback.errorCode === 'NOT_FOUND') {
        setCodeAvailability({code, available: true});
        form.setFields([{name: 'code', errors: []}]);
        return true;
      }
      setCodeAvailability(undefined);
      return undefined;
    } finally {
      setCheckingCode(false);
    }
  };

  const submit = async () => {
    try {
      const values = await form.validateFields();
      const available = await checkCodeAvailability(values.code);
      if (available === false) throw new Error('CATALOG_CODE_UNAVAILABLE');
      if (available === undefined) throw new Error('CATALOG_CODE_AVAILABILITY_UNKNOWN');
      const attributes = parseAttributes(values.attributesText);
      lifecycle.setSubmitting(true);
      setProblem(undefined);
      const body: CatalogItemCreateRequest = {dataNodeRef: requireOperationsScopeRef(queryContext), code: values.code.trim(), name: values.name.trim(), shapeKey: values.shapeKey, attributes};
      await create(catalogInventoryRtkRequest.createOperationsCatalogItem({}, {headers: {...headers, 'Idempotency-Key': lifecycle.getIdempotencyKey()}, body})).unwrap();
      lifecycle.reset();
      onCreated(body.code);
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      setProblem(error instanceof Error && error.message === 'ATTRIBUTES_OBJECT_REQUIRED' ? '描述属性必须是 JSON 对象。' : error instanceof Error && error.message === 'CATALOG_CODE_UNAVAILABLE' ? '当前作用域中已存在该商品编码。' : error instanceof Error && error.message === 'CATALOG_CODE_AVAILABILITY_UNKNOWN' ? '暂时无法确认编码是否可用，请重试。' : operationsProblemOf(error).detail || '商品创建未完成，请重试。');
      lifecycle.setSubmitting(false);
    }
  };

  return <Drawer title="新建商品" open={open} onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} destroyOnHidden={false} maskClosable={!lifecycle.dirty} {...adminWideDrawerSurfaceProps} {...testId('catalog-item-create-drawer')}>
    {problem && <Alert type="error" showIcon title="商品创建未完成" description={problem} style={{marginBottom: 16}} {...testId('catalog-create-problem')}/>} 
    <Alert type="info" showIcon title="编码与形态创建后不可修改" description="创建时会校验当前商品库编码唯一性；权益商品壳保留在契约中，但本期不可创建。" style={{marginBottom: 16}}/>
    <Form form={form} layout="vertical" onValuesChange={() => lifecycle.setDirty(true)}>
      <Form.Item label="商品编码" name="code" validateStatus={codeAvailability?.available === false ? 'error' : undefined} help={codeAvailability?.available === false ? '当前作用域中已存在该商品编码。' : codeAvailability?.available === true ? '编码可用。' : undefined} rules={[{required: true, message: '请输入商品编码'}, {pattern: /^[A-Z0-9][A-Z0-9_-]*$/, message: '编码仅支持大写字母、数字、下划线和短横线'}]}><Input maxLength={80} onBlur={() => { void checkCodeAvailability(form.getFieldValue('code')); }} suffix={checkingCode ? '校验中…' : undefined} {...testId('catalog-create-code')}/></Form.Item>
      <Form.Item label="商品名称" name="name" rules={[{required: true, message: '请输入商品名称'}]}><Input maxLength={160} {...testId('catalog-create-name')}/></Form.Item>
      <Form.Item label="商品形态" name="shapeKey" rules={[{required: true, message: '请选择商品形态'}]}><Select loading={manifestQuery.isLoading} options={shapeOptions} optionRender={(option) => option.data.disabled ? <span style={{color: '#999'}}>{option.label}（权益域尚未开放）</span> : option.label} {...testId('catalog-create-shape')}/></Form.Item>
      <Form.Item label="描述属性（JSON 对象，可选）" name="attributesText" rules={[{validator: (_, value) => { if (!value?.trim()) return Promise.resolve(); try { const parsed: unknown = JSON.parse(value); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return Promise.reject(new Error('ATTRIBUTES_OBJECT_REQUIRED')); return Promise.resolve(); } catch { return Promise.reject(new Error('ATTRIBUTES_OBJECT_REQUIRED')); } }}]}><Input.TextArea rows={6} placeholder={'例如：{\n  "origin": "直营"\n}'} {...testId('catalog-create-attributes')}/></Form.Item>
    </Form>
    <Space><Button onClick={lifecycle.requestClose}>取消</Button><Button type="primary" loading={createState.isLoading || lifecycle.submitting} onClick={() => void submit()} {...testId('catalog-create-submit')}>创建</Button></Space>
  </Drawer>;
}

function parseAttributes(value: string | undefined): CatalogItemCreateRequest['attributes'] {
  if (!value?.trim()) return {};
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('ATTRIBUTES_OBJECT_REQUIRED');
  return parsed as Record<string, JsonValue>;
}
