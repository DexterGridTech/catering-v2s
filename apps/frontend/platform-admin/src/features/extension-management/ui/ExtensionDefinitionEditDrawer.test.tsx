// @vitest-environment jsdom
import {createElement, type ReactNode} from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ExtensionDefinitionEditDrawer} from './ExtensionDefinitionEditDrawer';
import type {ExtensionDefinition} from '../../../app/api/generated/platform-edge';

const testState = vi.hoisted(() => ({
  submitting: false,
  requestClose: vi.fn(),
  setFieldValue: vi.fn(),
}));

const noop = () => undefined;

vi.mock('antd', () => {
  const mockNoop = () => undefined;
  const Button = ({children, ...props}: Record<string, unknown> & {children?: ReactNode}) =>
    createElement('button', {type: 'button', ...props}, children);
  const passthrough = ({children, ...props}: Record<string, unknown> & {children?: ReactNode}) =>
    createElement('div', props, children);
  const Form = ({children, ...props}: Record<string, unknown> & {children?: ReactNode}) =>
    createElement('form', props, children);
  Form.useForm = () => [
    {
      setFieldsValue: mockNoop,
      getFieldValue: () => [],
      setFieldValue: testState.setFieldValue,
      submit: mockNoop,
    },
  ];
  Form.useWatch = () => undefined;
  Form.Item = passthrough;
  Form.List = ({
    children,
  }: {
    children: (fields: never[], actions: {move: typeof mockNoop; remove: typeof mockNoop}) => unknown;
  }) => children([], {move: mockNoop, remove: mockNoop});
  Form.ErrorList = () => null;
  const Drawer = ({
    extra,
    footer,
    children,
    ...props
  }: Record<string, unknown> & {extra?: ReactNode; footer?: ReactNode; children?: ReactNode}) =>
    createElement('aside', props, extra, footer, children);
  const Text = ({children, ...props}: Record<string, unknown> & {children?: ReactNode}) =>
    createElement('span', props, children);
  const Typography = {Text};
  const Modal = {confirm: mockNoop};
  return {
    Alert: passthrough,
    Button,
    Card: passthrough,
    Col: passthrough,
    Drawer,
    Form,
    Input: passthrough,
    Modal,
    Row: passthrough,
    Select: passthrough,
    Space: passthrough,
    Typography,
  };
});

vi.mock('@catering-v2s/admin-ui-foundation', () => {
  const mockNoop = () => undefined;
  return {
    adminDrawerSurfaceProps: {},
    isFlatExtensionHost: (entityType: string | undefined) =>
      ['BRAND', 'TENANT', 'HEAD_COMPANY', 'STORE', 'CONTRACT'].includes(entityType ?? ''),
    testId: (locator: string) => ({'data-testid': locator}),
    useDrawerFormLifecycle: () => ({
      submitting: testState.submitting,
      dirty: false,
      requestClose: testState.requestClose,
      afterOpenChange: mockNoop,
      reset: mockNoop,
      setSubmitting: mockNoop,
      setDirty: mockNoop,
      closeAfterSuccess: mockNoop,
    }),
    useOverlayLock: mockNoop,
    useSubmissionLifecycle: () => ({
      getIdempotencyKey: () => 'test-idempotency-key',
      markBusinessIntentChanged: mockNoop,
      reset: mockNoop,
    }),
  };
});

vi.mock('../../../app/api/PlatformTransport', () => ({
  platformClient: {replaceExtensionDefinition: vi.fn()},
  platformProblemOf: () => ({title: '测试错误', detail: '测试错误', errorCode: 'TEST_ERROR'}),
}));

vi.mock('../../../app/api/generated/platform-edge', () => ({
  PLATFORM_ADMIN_OPERATION_IDS: {replaceExtensionDefinition: 'replaceExtensionDefinition'},
}));

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const definition = {
  entityType: 'BRAND',
  revision: 3,
  definitions: [],
} as unknown as ExtensionDefinition;

async function renderDrawer(
  submitting: boolean,
  inputDefinition: ExtensionDefinition = definition,
): Promise<ReactTestRenderer> {
  testState.submitting = submitting;
  let renderer!: ReactTestRenderer;
  await act(() => {
    renderer = create(
      <ExtensionDefinitionEditDrawer
        definition={inputDefinition}
        displayName="品牌"
        groupWorkspaceKey="workspace-a"
        onClose={noop}
        onSaved={noop}
        onConflict={noop}
      />,
    );
  });
  return renderer;
}

function cancelButton(renderer: ReactTestRenderer) {
  return renderer.root
    .findAllByType('button')
    .find(node => node.props['data-testid'] === 'extension-definition-cancel');
}

function addFieldButton(renderer: ReactTestRenderer) {
  return renderer.root.findAllByType('button').find(node => node.props['data-testid'] === 'extension-definition-add');
}

function definitionFor(entityType: ExtensionDefinition['entityType']): ExtensionDefinition {
  return {...definition, entityType};
}

describe('extension definition drawer actions', () => {
  beforeEach(() => {
    testState.submitting = false;
    testState.requestClose.mockReset();
    testState.setFieldValue.mockReset();
  });

  it('exposes the stable cancel locator on the real footer button and closes on click', async () => {
    const renderer = await renderDrawer(false);
    const button = cancelButton(renderer);

    expect(button).toBeDefined();
    expect(button?.props.disabled).toBe(false);
    const onClick = button?.props.onClick as (() => void) | undefined;
    await act(() => onClick?.());
    expect(testState.requestClose).toHaveBeenCalledTimes(1);

    await act(() => renderer.unmount());
  });

  it('disables the real cancel button while a submission is pending', async () => {
    const renderer = await renderDrawer(true);
    const button = cancelButton(renderer);

    expect(button).toBeDefined();
    expect(button?.props.disabled).toBe(true);

    await act(() => renderer.unmount());
  });

  it('defaults list display and search flags per host applicability', async () => {
    const cases: Array<[ExtensionDefinition['entityType'], boolean | null]> = [
      ['BRAND', false],
      ['COMMERCIAL_GROUP', null],
    ];

    for (const [entityType, expected] of cases) {
      const renderer = await renderDrawer(false, definitionFor(entityType));
      const button = addFieldButton(renderer);

      expect(button).toBeDefined();
      await act(() => (button?.props.onClick as (() => void) | undefined)?.());
      expect(testState.setFieldValue).toHaveBeenLastCalledWith('definitions', [
        expect.objectContaining({
          listDisplay: expected,
          searchable: expected,
        }),
      ]);

      await act(() => renderer.unmount());
    }
  });
});
