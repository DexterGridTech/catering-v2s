// @vitest-environment jsdom
import {createElement, forwardRef, useImperativeHandle, type Ref} from 'react';
import {Form, Input} from 'antd';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {describe, expect, it} from 'vitest';
import {newTerminalFunction, type StoreTerminalFormValues} from '../model/storeTerminalModel';
import {handleStoreTerminalFormFinish} from './StoreTerminalFormDrawer';

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

type SubmitHandle = {submit: () => void};

const firstFunction = {...newTerminalFunction('ORDERING_CASHIER'), clientKey: 'function-first'};
const secondFunction = {...newTerminalFunction('KITCHEN_PRINT'), clientKey: 'function-second'};

const FormStoreSubmitHarness = forwardRef(function FormStoreSubmitHarness(
  {onSubmit}: {onSubmit: (values: StoreTerminalFormValues) => void},
  ref: Ref<SubmitHandle>,
) {
  const [form] = Form.useForm<StoreTerminalFormValues>();
  useImperativeHandle(ref, () => ({submit: () => form.submit()}), [form]);
  return (
    <Form
      form={form}
      initialValues={{functions: [firstFunction, secondFunction]}}
      onFinish={() => handleStoreTerminalFormFinish(form, onSubmit)}
    >
      <Form.List name="functions">
        {fields =>
          fields[0] ? (
            <Form.Item name={[fields[0].name, 'functionKey']}>
              <Input />
            </Form.Item>
          ) : null
        }
      </Form.List>
    </Form>
  );
});

describe('store terminal aggregate submit', () => {
  it('preserves configured functions that are not mounted as the active editor', async () => {
    const ref = {current: null as SubmitHandle | null};
    const submitted: StoreTerminalFormValues[] = [];
    let renderer: ReactTestRenderer | undefined;

    await act(async () => {
      renderer = create(createElement(FormStoreSubmitHarness, {ref, onSubmit: values => submitted.push(values)}));
    });
    await act(async () => {
      ref.current?.submit();
      await Promise.resolve();
    });

    expect(submitted).toHaveLength(1);
    expect(submitted[0]?.functions).toHaveLength(2);
    expect(submitted[0]?.functions[0]).toMatchObject({clientKey: 'function-first', functionKey: 'ORDERING_CASHIER'});
    expect(submitted[0]?.functions[1]).toMatchObject({clientKey: 'function-second', functionKey: 'KITCHEN_PRINT'});
    renderer?.unmount();
  });
});
