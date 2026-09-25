import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {Form} from 'antd';
import type {StoreTerminalFormValues} from '../model/storeTerminalModel';
import {TerminalFunctionEditor} from './TerminalFunctionEditor';
import {TerminalPrinterEditor, scenesReferencingPrinter, unbindPrinter} from './TerminalPrinterEditor';
import {TerminalSceneEditor} from './TerminalSceneEditor';

const candidateState = {
  items: [],
  onPopupScroll: () => undefined,
  nextCursor: undefined,
  total: 0,
  debouncedQueryText: '',
};

function PartialEditorsHarness() {
  const [form] = Form.useForm<StoreTerminalFormValues>();
  return (
    <Form
      form={form}
      initialValues={{
        functions: [
          {
            clientKey: 'function-partial',
            // Form.List may render this row before functionKey/scenes arrive.
            // The editor must retain the row without dereferencing absent children.
          },
        ],
      }}
    >
      <TerminalFunctionEditor
        form={form}
        index={0}
        deviceType="laptop"
        areaCandidates={candidateState}
        tagCandidates={candidateState}
        areasLoading={false}
        tagsLoading={false}
        areaQueryText=""
        tagQueryText=""
        onAreaQueryTextChange={() => undefined}
        onTagQueryTextChange={() => undefined}
        onRetryAreaCandidates={() => undefined}
        onRetryTagCandidates={() => undefined}
        areaReferences={[]}
        tagReferences={[]}
        candidateCacheKey="partial-test"
        printerValues={[undefined, {clientKey: 'printer-partial'}] as never}
        functionIdentity="function-partial"
        onRemove={() => undefined}
        onValuesChange={() => undefined}
      />
    </Form>
  );
}

describe('store terminal partial Form.List rows', () => {
  it('renders a function row before nested fields are complete', () => {
    expect(() => renderToStaticMarkup(<PartialEditorsHarness />)).not.toThrow();
  });

  it('renders a selected scene with sparse child values without crashing', () => {
    function SceneHarness() {
      const [form] = Form.useForm<StoreTerminalFormValues>();
      return (
        <Form
          form={form}
          initialValues={
            {
              functions: [
                {
                  clientKey: 'function-scene-partial',
                  functionKey: 'ORDERING_CASHIER',
                  scenes: {
                    TABLE_ORDER_TICKET: {selected: true, printerKeys: [undefined, 'printer-partial']},
                  },
                },
              ],
            } as never
          }
        >
          <TerminalSceneEditor
            form={form}
            index={0}
            functionIdentity="function-scene-partial"
            scene={{
              key: 'TABLE_ORDER_TICKET',
              label: '桌台订单',
              allowedPaperSpecKeys: ['THERMAL_80'],
            }}
            printerValues={[undefined, {clientKey: 'printer-partial'}, {clientKey: 42}] as never}
          />
        </Form>
      );
    }

    expect(() => renderToStaticMarkup(<SceneHarness />)).not.toThrow();
  });

  it('keeps an invalid scene printer collection render-safe until submit validation rejects it', () => {
    function InvalidSceneHarness() {
      const [form] = Form.useForm<StoreTerminalFormValues>();
      return (
        <Form
          form={form}
          initialValues={
            {
              functions: [
                {
                  clientKey: 'function-invalid-scene',
                  functionKey: 'ORDERING_CASHIER',
                  scenes: {TABLE_ORDER_TICKET: {selected: true, printerKeys: 'invalid'}},
                },
              ],
            } as never
          }
        >
          <TerminalSceneEditor
            form={form}
            index={0}
            functionIdentity="function-invalid-scene"
            scene={{key: 'TABLE_ORDER_TICKET', label: '桌台订单', allowedPaperSpecKeys: ['THERMAL_80']}}
            printerValues={[]}
          />
        </Form>
      );
    }

    expect(() => renderToStaticMarkup(<InvalidSceneHarness />)).not.toThrow();
  });

  it('renders a partial printer row and keeps printer binding helpers sparse-safe', () => {
    function PrinterHarness() {
      const [form] = Form.useForm<StoreTerminalFormValues>();
      return (
        <Form
          form={form}
          initialValues={
            {
              printers: [{clientKey: 'printer-partial'}],
            } as never
          }
        >
          <TerminalPrinterEditor
            form={form}
            index={0}
            identity="printer-partial"
            onRemove={() => undefined}
            onValuesChange={() => undefined}
          />
        </Form>
      );
    }

    expect(() => renderToStaticMarkup(<PrinterHarness />)).not.toThrow();
    expect(() =>
      scenesReferencingPrinter([undefined, {clientKey: 'function-partial'}] as never, 'printer-partial'),
    ).not.toThrow();
    expect(() => unbindPrinter([undefined, {clientKey: 'function-partial'}] as never, 'printer-partial')).not.toThrow();

    const invalidSceneFunctions = [
      {
        clientKey: 'function-invalid-scene',
        functionKey: 'ORDERING_CASHIER',
        scenes: {TABLE_ORDER_TICKET: {selected: true, printerKeys: 'invalid'}},
      },
    ] as never;
    expect(scenesReferencingPrinter(invalidSceneFunctions, 'printer-partial')[0]).toContain('配置读取失败');
    expect(unbindPrinter(invalidSceneFunctions, 'printer-partial')[0].scenes.TABLE_ORDER_TICKET.printerKeys).toBe(
      'invalid',
    );
  });
});
