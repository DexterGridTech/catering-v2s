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
import {
  normalizeTerminalFunctionForm,
  scenePrinterKeysForDisplay,
  scenesForFunction,
  storeTerminalFunctionLabels,
} from '../model/storeTerminalModel';
import {storeTerminalTestIds} from '../storeTerminalTestIds';

export function scenesReferencingPrinter(functions: StoreTerminalFormValues['functions'], printerKey: string) {
  return (Array.isArray(functions) ? functions : []).flatMap(fn => {
    const normalized = normalizeTerminalFunctionForm(fn);
    if (!normalized) return [];
    return Object.entries(normalized.scenes).flatMap(([sceneKey, scene]) => {
      const label = `${storeTerminalFunctionLabels[normalized.functionKey] ?? normalized.functionKey} · ${scenesForFunction(normalized.functionKey).find(item => item.key === sceneKey)?.label ?? sceneKey}`;
      const display = scenePrinterKeysForDisplay(scene.printerKeys);
      if (!display.valid) return [`${label}（配置读取失败）`];
      return display.keys.includes(printerKey) ? [label] : [];
    });
  });
}

export function unbindPrinter(functions: StoreTerminalFormValues['functions'], printerKey: string) {
  return (Array.isArray(functions) ? functions : []).map(fn => {
    const normalized = normalizeTerminalFunctionForm(fn);
    if (!normalized) return fn;
    return {
      ...normalized,
      scenes: Object.fromEntries(
        Object.entries(normalized.scenes).map(([sceneKey, scene]) => [
          sceneKey,
          {
            ...scene,
            printerKeys: (() => {
              const display = scenePrinterKeysForDisplay(scene.printerKeys);
              return display.valid ? display.keys.filter(key => key !== printerKey) : scene.printerKeys;
            })(),
          },
        ]),
      ),
    };
  });
}

function validatePrinterSceneReferences(form: FormInstance<StoreTerminalFormValues>, printerIndex: number) {
  const values = form.getFieldsValue(true) as StoreTerminalFormValues;
  const printerKey = values.printers?.[printerIndex]?.ref || values.printers?.[printerIndex]?.clientKey;
  if (!printerKey) return;
  const paths = (Array.isArray(values.functions) ? values.functions : []).flatMap((fn, fnIndex) => {
    const normalized = normalizeTerminalFunctionForm(fn);
    if (!normalized) return [];
    return Object.entries(normalized.scenes)
      .filter(([, scene]) => {
        const display = scenePrinterKeysForDisplay(scene.printerKeys);
        return !display.valid || display.keys.includes(printerKey);
      })
      .map(([sceneKey]) => ['functions', fnIndex, 'scenes', sceneKey, 'printerKeys'] as const);
  });
  if (paths.length) void form.validateFields(paths).catch(() => undefined);
}

function updatePrinter(
  form: FormInstance<StoreTerminalFormValues>,
  index: number,
  patch: Partial<StoreTerminalFormValues['printers'][number]>,
) {
  const printers = form.getFieldValue('printers') as StoreTerminalFormValues['printers'] | undefined;
  const current = printers?.[index];
  if (!current) return;
  // The dependent controls are rendered from the same Form.List row. Commit
  // the row as one collection update so a transient brand/model combination
  // cannot unmount the next control while a user is selecting it.
  form.setFieldsValue({
    printers: printers.map((printer, printerIndex) => (printerIndex === index ? {...printer, ...patch} : printer)),
  });
}

type TerminalPrinterEditorProps = {
  form: FormInstance<StoreTerminalFormValues>;
  index: number;
  identity: string;
  onRemove: () => void;
  onValuesChange: () => void;
};

function TerminalPrinterEditorFields({form, index, identity, onRemove, onValuesChange}: TerminalPrinterEditorProps) {
  // Subscribe to each dependent field directly. Ant Design can retain a
  // stale Form.List collection snapshot while a sibling value is updated by
  // a controlled selector. Scalar subscriptions keep each dependent control
  // tied to the authoritative field that controls it, so selecting a brand
  // immediately enables its model and connection controls.
  const modelKey = Form.useWatch(['printers', index, 'modelKey'], form) as string | undefined;
  const paperSpecKey = Form.useWatch(['printers', index, 'paperSpecKey'], form) as string | undefined;
  const connectionMethodKey = Form.useWatch(['printers', index, 'connectionMethodKey'], form) as string | undefined;

  useEffect(() => {
    validatePrinterSceneReferences(form, index);
  }, [connectionMethodKey, form, index, modelKey, paperSpecKey]);

  const updateModel = (nextModelKey: string) => {
    const nextModel = modelByKey(nextModelKey);
    if (!nextModel) return;
    const current = form.getFieldValue(['printers', index]) as StoreTerminalFormValues['printers'][number] | undefined;
    if (!current) return;
    const currentPaper = String(current.paperSpecKey ?? '');
    const currentConnection = String(current.connectionMethodKey ?? '');
    updatePrinter(form, index, {
      modelKey: nextModel.key,
      paperSpecKey: (nextModel.paperSpecKeys as readonly string[]).includes(currentPaper)
        ? currentPaper
        : nextModel.paperSpecKeys.length === 1
          ? nextModel.paperSpecKeys[0]
          : undefined,
      connectionMethodKey: (nextModel.allowedConnectionMethodKeys as readonly string[]).includes(currentConnection)
        ? currentConnection
        : undefined,
      connectionParameter: (nextModel.allowedConnectionMethodKeys as readonly string[]).includes(currentConnection)
        ? current.connectionParameter
        : undefined,
    });
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
        <Form.Item name={[index, 'ref']} hidden>
          <Input />
        </Form.Item>
        <Form.Item name={[index, 'clientKey']} hidden>
          <Input />
        </Form.Item>
        <Form.Item
          name={[index, 'name']}
          label="打印机名称"
          rules={[{required: true, whitespace: true, message: '请输入打印机名称'}]}
        >
          <Input {...testId(storeTerminalTestIds.printerName(identity))} />
        </Form.Item>
        <Space.Compact block>
          <Form.Item
            name={[index, 'brandKey']}
            label="品牌"
            rules={[{required: true, message: '请选择品牌'}]}
            style={{width: '50%'}}
          >
            <Select
              options={STORE_TERMINAL_PRINTER_BRANDS.map(value => ({value: value.key, label: value.label}))}
              allowClear
              {...testId(storeTerminalTestIds.printerBrand(identity))}
              onChange={(value: string | undefined) => {
                updatePrinter(form, index, {
                  brandKey: value,
                  modelKey: undefined,
                  paperSpecKey: undefined,
                  connectionMethodKey: undefined,
                  connectionParameter: undefined,
                });
                onValuesChange();
              }}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(previous, current) =>
              previous.printers?.[index]?.brandKey !== current.printers?.[index]?.brandKey ||
              previous.printers?.[index]?.connectionMethodKey !== current.printers?.[index]?.connectionMethodKey
            }
          >
            {({getFieldValue}) => {
              const currentBrandKey = String(getFieldValue(['printers', index, 'brandKey']) ?? '');
              const currentConnectionMethodKey = String(
                getFieldValue(['printers', index, 'connectionMethodKey']) ?? '',
              );
              const models = modelOptionsForBrandAndConnection(currentBrandKey, currentConnectionMethodKey);
              return (
                <Form.Item
                  name={[index, 'modelKey']}
                  label="型号"
                  rules={[{required: true, message: '请选择型号'}]}
                  style={{width: '50%'}}
                >
                  <Select
                    disabled={!currentBrandKey}
                    options={models.map(value => ({value: value.key, label: value.label}))}
                    onChange={updateModel}
                    {...testId(storeTerminalTestIds.printerModel(identity))}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
        </Space.Compact>
        <Space.Compact block>
          <Form.Item
            noStyle
            shouldUpdate={(previous, current) =>
              previous.printers?.[index]?.modelKey !== current.printers?.[index]?.modelKey ||
              previous.printers?.[index]?.paperSpecKey !== current.printers?.[index]?.paperSpecKey
            }
          >
            {({getFieldValue}) => {
              const currentModelKey = String(getFieldValue(['printers', index, 'modelKey']) ?? '');
              const papers = paperOptionsForModel(currentModelKey);
              return (
                <Form.Item
                  name={[index, 'paperSpecKey']}
                  label="纸规格"
                  rules={[{required: true, message: '请选择纸规格'}]}
                  style={{width: '50%'}}
                >
                  <Select
                    disabled={!currentModelKey || papers.length === 1}
                    options={papers.map(value => ({value: value.key, label: value.label}))}
                    onChange={() => {
                      validatePrinterSceneReferences(form, index);
                      onValuesChange();
                    }}
                    {...testId(storeTerminalTestIds.printerPaperSpec(identity))}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(previous, current) =>
              previous.printers?.[index]?.brandKey !== current.printers?.[index]?.brandKey ||
              previous.printers?.[index]?.modelKey !== current.printers?.[index]?.modelKey
            }
          >
            {({getFieldValue}) => {
              const currentBrandKey = String(getFieldValue(['printers', index, 'brandKey']) ?? '');
              const currentModelKey = String(getFieldValue(['printers', index, 'modelKey']) ?? '');
              const connections = connectionOptionsForPrinter(currentBrandKey, modelByKey(currentModelKey)?.key);
              return (
                <Form.Item
                  name={[index, 'connectionMethodKey']}
                  label="连接方式"
                  rules={[{required: true, message: '请选择连接方式'}]}
                  style={{width: '50%'}}
                >
                  <Select
                    disabled={!currentBrandKey}
                    options={connections.map(value => ({value: value.key, label: value.label}))}
                    allowClear
                    {...testId(storeTerminalTestIds.printerConnection(identity))}
                    onChange={(value: string | undefined) => {
                      const selectedModel = modelByKey(
                        String(form.getFieldValue(['printers', index, 'modelKey']) ?? ''),
                      );
                      const modelCompatible =
                        selectedModel &&
                        value &&
                        (selectedModel.allowedConnectionMethodKeys as readonly string[]).includes(value);
                      updatePrinter(form, index, {
                        connectionMethodKey: value,
                        modelKey: modelCompatible ? selectedModel?.key : undefined,
                        paperSpecKey: modelCompatible
                          ? String(form.getFieldValue(['printers', index, 'paperSpecKey']) ?? '') || undefined
                          : undefined,
                        connectionParameter: undefined,
                      });
                      onValuesChange();
                    }}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
        </Space.Compact>
        <Form.Item
          noStyle
          shouldUpdate={(previous, current) =>
            previous.printers?.[index]?.connectionMethodKey !== current.printers?.[index]?.connectionMethodKey ||
            previous.printers?.[index]?.modelKey !== current.printers?.[index]?.modelKey
          }
        >
          {({getFieldValue}) => {
            const currentModelKey = String(getFieldValue(['printers', index, 'modelKey']) ?? '');
            const currentConnectionMethodKey = String(getFieldValue(['printers', index, 'connectionMethodKey']) ?? '');
            const currentModel = modelByKey(currentModelKey);
            const parameter = parameterForConnection(currentConnectionMethodKey);
            return parameter ? (
              <Form.Item
                name={[index, 'connectionParameter']}
                label={parameter.label}
                rules={[{required: true, message: `请输入${parameter.label}`}]}
              >
                <Input placeholder={parameter.label} {...testId(storeTerminalTestIds.printerParameter(identity))} />
              </Form.Item>
            ) : (
              <Typography.Text type="secondary">
                {currentModel
                  ? `${storeTerminalModelLabels[currentModel.key] ?? currentModel.key} 使用设备内置连接，无需填写标识。`
                  : '该连接方式无需填写参数。'}
              </Typography.Text>
            );
          }}
        </Form.Item>
      </Space>
    </Card>
  );
}

export function TerminalPrinterEditor(props: TerminalPrinterEditorProps) {
  return <TerminalPrinterEditorFields {...props} />;
}
