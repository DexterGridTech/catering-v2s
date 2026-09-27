import {Card, Checkbox, Form, Select, Space, Typography} from 'antd';
import type {FormInstance} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import type {StoreTerminalFormValues, TerminalPrinterForm, TerminalSceneForm} from '../model/storeTerminalModel';
import {
  requireTerminalIdentity,
  resolveTerminalPrinter,
  scenePrinterKeysForDisplay,
  terminalSceneDraftHasInvalidCollections,
  TerminalSceneValidationError,
  storeTerminalOrderTypeLabels,
  terminalPrinterIdentity,
  terminalPrinterReadyForBinding,
} from '../model/storeTerminalModel';
import {STORE_TERMINAL_ORDER_TYPES} from '../../../app/api/generated/storeTerminalRules';
import {storeTerminalTestIds} from '../storeTerminalTestIds';

export type TerminalSceneEditorProps = {
  form: FormInstance<StoreTerminalFormValues>;
  index: number;
  functionIdentity: string;
  scene: {key: string; label: string; allowedPaperSpecKeys: readonly string[]};
  printerValues: readonly TerminalPrinterForm[];
  showToggle?: boolean;
};

export function TerminalSceneEditor({
  form,
  index,
  functionIdentity,
  scene,
  printerValues,
  showToggle = true,
}: TerminalSceneEditorProps) {
  const watchedScene = Form.useWatch(['functions', index, 'scenes', scene.key], form) as
    Partial<TerminalSceneForm> | undefined;
  // The scene editor is controlled by this subscription. A one-off
  // getFieldValue fallback can win over the fresh nested value during a
  // Form.List commit and make the visible selection diverge from the draft.
  const currentScene = watchedScene;
  const displayPrinterKeys = scenePrinterKeysForDisplay(currentScene?.printerKeys);
  const knownPrinterKeys = printerValues
    .map(printer => terminalPrinterIdentity(printer))
    .filter(
      (identity): identity is string =>
        typeof identity === 'string' && identity.length > 0 && identity === identity.trim(),
    );
  const invalidSceneConfiguration = terminalSceneDraftHasInvalidCollections(
    currentScene,
    STORE_TERMINAL_ORDER_TYPES.map(value => value.key),
    knownPrinterKeys,
  );
  const sceneValue = currentScene
    ? {
        selected: Boolean(currentScene.selected),
        orderTypes: Array.isArray(currentScene.orderTypes)
          ? currentScene.orderTypes.filter(value => typeof value === 'string' && value.length > 0)
          : [],
        printerKeys: displayPrinterKeys.keys,
      }
    : {selected: false, orderTypes: [], printerKeys: []};
  const selectablePrinters = printerValues.filter(printer => {
    const identity = terminalPrinterIdentity(printer);
    const validIdentity = typeof identity === 'string' && identity.length > 0 && identity === identity.trim();
    return terminalPrinterReadyForBinding(printer) || (validIdentity && sceneValue.printerKeys.includes(identity));
  });
  return (
    <Card size="small" style={{marginBottom: 8}} {...testId(storeTerminalTestIds.scene(functionIdentity, scene.key))}>
      <Space direction="vertical" size={8} style={{display: 'flex'}}>
        {showToggle ? (
          <Form.Item name={[index, 'scenes', scene.key, 'selected']} valuePropName="checked" noStyle>
            <Checkbox {...testId(storeTerminalTestIds.sceneToggle(functionIdentity, scene.key))}>
              {scene.label}
            </Checkbox>
          </Form.Item>
        ) : (
          <Typography.Text strong>{scene.label}</Typography.Text>
        )}
        {sceneValue.selected && (
          <>
            {invalidSceneConfiguration && <Typography.Text type="danger">场景配置读取失败，请重新选择</Typography.Text>}
            <Form.Item name={[index, 'scenes', scene.key, 'orderTypes']} label="订单类型">
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
              name={[index, 'scenes', scene.key, 'printerKeys']}
              label="打印机"
              rules={[
                {
                  validator: async (_, values: string[] | undefined) => {
                    try {
                      const incompatible = (values ?? []).some(key => {
                        const printer = resolveTerminalPrinter(key, printerValues);
                        return !scene.allowedPaperSpecKeys.includes(printer.paperSpecKey);
                      });
                      if (incompatible) {
                        throw new TerminalSceneValidationError(
                          'PAPER_SPEC_MISMATCH',
                          '存在与该场景纸规格不匹配的打印机',
                        );
                      }
                    } catch (error) {
                      if (error instanceof TerminalSceneValidationError) throw error;
                      throw new TerminalSceneValidationError('PRINTER_INVALID', '所选打印机已失效，请重新选择');
                    }
                  },
                },
              ]}
            >
              <Select
                mode="multiple"
                {...testId(storeTerminalTestIds.scenePrinters(functionIdentity, scene.key))}
                options={selectablePrinters.map((printer, printerIndex) => {
                  const key = requireTerminalIdentity(terminalPrinterIdentity(printer), 'printer');
                  const compatible = scene.allowedPaperSpecKeys.includes(printer.paperSpecKey);
                  const selected = sceneValue.printerKeys.includes(key);
                  return {
                    value: key,
                    label: `${printer.name || `未命名打印机 ${printerIndex + 1}`}${compatible ? '' : '（纸规格不匹配）'}`,
                    disabled: !compatible && !selected,
                  };
                })}
                placeholder={selectablePrinters.length ? '请选择打印机' : '请先完成打印机定义'}
                disabled={!selectablePrinters.length}
              />
            </Form.Item>
          </>
        )}
      </Space>
    </Card>
  );
}
