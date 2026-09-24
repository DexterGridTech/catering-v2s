import {Card, Checkbox, Form, Select, Space, Typography} from 'antd';
import type {FormInstance} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import type {StoreTerminalFormValues, TerminalPrinterForm, TerminalSceneForm} from '../model/storeTerminalModel';
import {storeTerminalOrderTypeLabels} from '../model/storeTerminalModel';
import {STORE_TERMINAL_ORDER_TYPES} from '../../../app/api/generated/storeTerminalRules';
import {storeTerminalTestIds} from '../storeTerminalTestIds';

export function TerminalSceneEditor({
  form,
  index,
  functionIdentity,
  scene,
  printerValues,
  showToggle = true,
}: {
  form: FormInstance<StoreTerminalFormValues>;
  index: number;
  functionIdentity: string;
  scene: {key: string; label: string; allowedPaperSpecKeys: readonly string[]};
  printerValues: readonly TerminalPrinterForm[];
  showToggle?: boolean;
}) {
  const sceneValue = (Form.useWatch(['functions', index, 'scenes', scene.key], form) as
    TerminalSceneForm | undefined) ?? {selected: false, orderTypes: [], printerKeys: []};

  return (
    <Card size="small" style={{marginBottom: 8}} {...testId(storeTerminalTestIds.scene(functionIdentity, scene.key))}>
      <Space direction="vertical" size={8} style={{display: 'flex'}}>
        {showToggle ? (
          <Form.Item name={['functions', index, 'scenes', scene.key, 'selected']} valuePropName="checked" noStyle>
            <Checkbox {...testId(storeTerminalTestIds.sceneToggle(functionIdentity, scene.key))}>
              {scene.label}
            </Checkbox>
          </Form.Item>
        ) : (
          <Typography.Text strong>{scene.label}</Typography.Text>
        )}
        {sceneValue.selected && (
          <>
            <Form.Item name={['functions', index, 'scenes', scene.key, 'orderTypes']} label="订单类型">
              <Checkbox.Group {...testId(storeTerminalTestIds.sceneOrderTypes(functionIdentity, scene.key))}>
                {STORE_TERMINAL_ORDER_TYPES.map(value => (
                  <Checkbox
                    key={value.key}
                    value={value.key}
                    {...testId(storeTerminalTestIds.sceneOrderType(functionIdentity, scene.key, value.key))}
                  >
                    {storeTerminalOrderTypeLabels[value.key] ?? value.label}
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </Form.Item>
            <Form.Item
              name={['functions', index, 'scenes', scene.key, 'printerKeys']}
              label="打印机"
              rules={[
                {
                  validator: async (_, values: string[] | undefined) => {
                    const incompatible = (values ?? []).some(key => {
                      const printer = printerValues.find(value => (value.ref || value.clientKey) === key);
                      return printer && !scene.allowedPaperSpecKeys.includes(printer.paperSpecKey);
                    });
                    if (incompatible) throw new Error('存在与该场景纸规格不匹配的打印机');
                  },
                },
              ]}
            >
              <Select
                mode="multiple"
                {...testId(storeTerminalTestIds.scenePrinters(functionIdentity, scene.key))}
                options={printerValues.map((printer, printerIndex) => {
                  const key = printer.ref || printer.clientKey;
                  const compatible = scene.allowedPaperSpecKeys.includes(printer.paperSpecKey);
                  const selected = sceneValue.printerKeys.includes(key);
                  return {
                    value: key,
                    label: `${printer.name || `未命名打印机 ${printerIndex + 1}`}${compatible ? '' : '（纸规格不匹配）'}`,
                    disabled: !compatible && !selected,
                  };
                })}
                placeholder={printerValues.length ? '请选择打印机' : '请先定义打印机'}
                disabled={!printerValues.length}
              />
            </Form.Item>
          </>
        )}
      </Space>
    </Card>
  );
}
