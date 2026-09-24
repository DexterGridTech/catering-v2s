import {Button, Card, Form, Input, Select, Space, Typography} from 'antd';
import type {FormInstance} from 'antd';
import {useEffect} from 'react';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {
  STORE_TERMINAL_PRINTER_BRANDS,
  connectionOptionsForPrinter,
  modelByKey,
  modelOptionsForBrandAndConnection,
  parameterForConnection,
  paperOptionsForModel,
  storeTerminalModelLabels,
  type StoreTerminalFormValues,
} from '../model/storeTerminalModel';
import {scenesForFunction, storeTerminalFunctionLabels} from '../model/storeTerminalModel';
import {storeTerminalTestIds} from '../storeTerminalTestIds';

export function scenesReferencingPrinter(functions: StoreTerminalFormValues['functions'], printerKey: string) {
  return functions.flatMap(fn =>
    Object.entries(fn.scenes).flatMap(([sceneKey, scene]) =>
      scene.printerKeys.includes(printerKey)
        ? [
            `${storeTerminalFunctionLabels[fn.functionKey] ?? fn.functionKey} · ${scenesForFunction(fn.functionKey).find(item => item.key === sceneKey)?.label ?? sceneKey}`,
          ]
        : [],
    ),
  );
}

export function unbindPrinter(functions: StoreTerminalFormValues['functions'], printerKey: string) {
  return functions.map(fn => ({
    ...fn,
    scenes: Object.fromEntries(
      Object.entries(fn.scenes).map(([sceneKey, scene]) => [
        sceneKey,
        {...scene, printerKeys: scene.printerKeys.filter(key => key !== printerKey)},
      ]),
    ),
  }));
}

function validatePrinterSceneReferences(form: FormInstance<StoreTerminalFormValues>, printerIndex: number) {
  const values = form.getFieldsValue(true) as StoreTerminalFormValues;
  const printerKey = values.printers?.[printerIndex]?.ref || values.printers?.[printerIndex]?.clientKey;
  if (!printerKey) return;
  const paths = values.functions.flatMap((fn, fnIndex) =>
    Object.entries(fn.scenes)
      .filter(([, scene]) => scene.printerKeys.includes(printerKey))
      .map(([sceneKey]) => ['functions', fnIndex, 'scenes', sceneKey, 'printerKeys'] as const),
  );
  if (paths.length) void form.validateFields(paths).catch(() => undefined);
}

export function TerminalPrinterEditor({
  form,
  index,
  identity,
  onRemove,
  onValuesChange,
}: {
  form: FormInstance<StoreTerminalFormValues>;
  index: number;
  identity: string;
  onRemove: () => void;
  onValuesChange: () => void;
}) {
  const brandKey = Form.useWatch(['printers', index, 'brandKey'], form) as string | undefined;
  const modelKey = Form.useWatch(['printers', index, 'modelKey'], form) as string | undefined;
  const paperSpecKey = Form.useWatch(['printers', index, 'paperSpecKey'], form) as string | undefined;
  const connectionMethodKey = Form.useWatch(['printers', index, 'connectionMethodKey'], form) as string | undefined;
  const models = modelOptionsForBrandAndConnection(brandKey ?? '', connectionMethodKey);
  const model = modelByKey(modelKey ?? '');
  const papers = paperOptionsForModel(modelKey ?? '');
  const connections = connectionOptionsForPrinter(brandKey ?? '', model?.key);
  const parameter = parameterForConnection(connectionMethodKey ?? '');

  useEffect(() => {
    validatePrinterSceneReferences(form, index);
  }, [connectionMethodKey, form, index, modelKey, paperSpecKey]);

  const updateModel = (nextModelKey: string) => {
    const nextModel = modelByKey(nextModelKey);
    if (!nextModel) return;
    form.setFieldValue(['printers', index, 'modelKey'], nextModel.key);
    const currentPaper = String(form.getFieldValue(['printers', index, 'paperSpecKey']) ?? '');
    if (!(nextModel.paperSpecKeys as readonly string[]).includes(currentPaper)) {
      form.setFieldValue(
        ['printers', index, 'paperSpecKey'],
        nextModel.paperSpecKeys.length === 1 ? nextModel.paperSpecKeys[0] : undefined,
      );
    }
    const currentConnection = String(form.getFieldValue(['printers', index, 'connectionMethodKey']) ?? '');
    if (!(nextModel.allowedConnectionMethodKeys as readonly string[]).includes(currentConnection)) {
      form.setFieldValue(['printers', index, 'connectionMethodKey'], undefined);
      form.setFieldValue(['printers', index, 'connectionParameter'], undefined);
    }
    validatePrinterSceneReferences(form, index);
    onValuesChange();
  };

  return (
    <Card
      size="small"
      type="inner"
      title={`打印机 ${index + 1}`}
      extra={
        <Button danger type="link" onClick={onRemove} {...testId(storeTerminalTestIds.printerRemove(identity))}>
          移除
        </Button>
      }
      {...testId(storeTerminalTestIds.printer(identity))}
    >
      <Space direction="vertical" size={8} style={{display: 'flex'}}>
        <Form.Item
          name={['printers', index, 'name']}
          label="打印机名称"
          rules={[{required: true, whitespace: true, message: '请输入打印机名称'}]}
        >
          <Input {...testId(storeTerminalTestIds.printerName(identity))} />
        </Form.Item>
        <Space.Compact block>
          <Form.Item
            name={['printers', index, 'brandKey']}
            label="品牌"
            rules={[{required: true, message: '请选择品牌'}]}
            style={{width: '50%'}}
          >
            <Select
              options={STORE_TERMINAL_PRINTER_BRANDS.map(value => ({value: value.key, label: value.label}))}
              allowClear
              {...testId(storeTerminalTestIds.printerBrand(identity))}
              onChange={() => {
                form.setFieldValue(['printers', index, 'modelKey'], undefined);
                form.setFieldValue(['printers', index, 'paperSpecKey'], undefined);
                form.setFieldValue(['printers', index, 'connectionMethodKey'], undefined);
                form.setFieldValue(['printers', index, 'connectionParameter'], undefined);
                onValuesChange();
              }}
            />
          </Form.Item>
          <Form.Item
            name={['printers', index, 'modelKey']}
            label="型号"
            rules={[{required: true, message: '请选择型号'}]}
            style={{width: '50%'}}
          >
            <Select
              disabled={!brandKey}
              options={models.map(value => ({value: value.key, label: value.label}))}
              onChange={updateModel}
              {...testId(storeTerminalTestIds.printerModel(identity))}
            />
          </Form.Item>
        </Space.Compact>
        <Space.Compact block>
          <Form.Item
            name={['printers', index, 'paperSpecKey']}
            label="纸规格"
            rules={[{required: true, message: '请选择纸规格'}]}
            style={{width: '50%'}}
          >
            <Select
              disabled={!modelKey || papers.length === 1}
              options={papers.map(value => ({value: value.key, label: value.label}))}
              onChange={() => {
                validatePrinterSceneReferences(form, index);
                onValuesChange();
              }}
              {...testId(storeTerminalTestIds.printerPaperSpec(identity))}
            />
          </Form.Item>
          <Form.Item
            name={['printers', index, 'connectionMethodKey']}
            label="连接方式"
            rules={[{required: true, message: '请选择连接方式'}]}
            style={{width: '50%'}}
          >
            <Select
              disabled={!brandKey}
              options={connections.map(value => ({value: value.key, label: value.label}))}
              allowClear
              {...testId(storeTerminalTestIds.printerConnection(identity))}
              onChange={value => {
                const selectedModel = modelByKey(String(form.getFieldValue(['printers', index, 'modelKey']) ?? ''));
                if (
                  selectedModel &&
                  value &&
                  !(selectedModel.allowedConnectionMethodKeys as readonly string[]).includes(value)
                ) {
                  form.setFieldValue(['printers', index, 'modelKey'], undefined);
                  form.setFieldValue(['printers', index, 'paperSpecKey'], undefined);
                }
                form.setFieldValue(['printers', index, 'connectionParameter'], undefined);
                onValuesChange();
              }}
            />
          </Form.Item>
        </Space.Compact>
        {parameter ? (
          <Form.Item
            name={['printers', index, 'connectionParameter']}
            label={parameter.label}
            rules={[{required: true, message: `请输入${parameter.label}`}]}
          >
            <Input placeholder={parameter.label} {...testId(storeTerminalTestIds.printerParameter(identity))} />
          </Form.Item>
        ) : (
          <Typography.Text type="secondary">
            {model
              ? `${storeTerminalModelLabels[model.key] ?? model.key} 使用设备内置连接，无需填写标识。`
              : '该连接方式无需填写参数。'}
          </Typography.Text>
        )}
      </Space>
    </Card>
  );
}
