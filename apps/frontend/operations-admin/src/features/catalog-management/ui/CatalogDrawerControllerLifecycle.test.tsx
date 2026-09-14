// @vitest-environment jsdom
import {createElement, forwardRef, useImperativeHandle, type ReactNode, type Ref} from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {wireUuid} from '../../../app/api/wireUuid';
import type {OperationsPageContext} from '../../../app/routing/model';
import type {LocalCopyScope} from './local-copy/localCatalogCopyModel';
import {CatalogDictionaryDrawerView} from './dictionary/CatalogDictionaryDrawerView';
import {useCatalogDictionaryDrawerController} from './dictionary/CatalogDictionaryDrawerState';
import {LocalCatalogCopyView} from './local-copy/LocalCatalogCopyView';
import {useLocalCatalogCopyController} from './local-copy/LocalCatalogCopyDrawer';
import type {WizardStep} from './local-copy/localCatalogCopyModel';

const testState = vi.hoisted(() => {
  type ConfirmationHandle = {
    onOk?: () => void;
    onCancel?: () => void;
    destroyed: boolean;
    destroy: () => void;
  };
  const modal = {confirmation: undefined as ConfirmationHandle | undefined};
  const confirm = (confirmation: Pick<ConfirmationHandle, 'onOk' | 'onCancel'>) => {
    const handle: ConfirmationHandle = {
      ...confirmation,
      destroyed: false,
      destroy: () => undefined,
    };
    handle.destroy = () => {
      if (handle.destroyed) return;
      handle.destroyed = true;
      handle.onOk = undefined;
      handle.onCancel = undefined;
      if (modal.confirmation === handle) modal.confirmation = undefined;
    };
    modal.confirmation = handle;
    return {destroy: handle.destroy};
  };
  const formValues: Record<string, unknown> = {};
  const form = {
    getFieldValue: vi.fn((name: string) => formValues[name]),
    getFieldsValue: vi.fn(() => ({...formValues})),
    resetFields: vi.fn(() => {
      for (const key of Object.keys(formValues)) delete formValues[key];
    }),
    setFields: vi.fn(),
    setFieldsValue: vi.fn((values: Record<string, unknown>) => Object.assign(formValues, values)),
    validateFields: vi.fn(async () => ({})),
  };
  const queryOverrides: Record<string, {currentData?: unknown; error?: unknown; isError?: boolean}> = {};
  const mutationOverrides: Record<string, {response?: unknown; error?: unknown; pending?: Promise<unknown>}> = {};
  const drawerProps: Array<{
    children?: ReactNode;
    title?: unknown;
    open?: boolean;
    maskClosable?: boolean;
    keyboard?: boolean;
    onClose: () => void;
    afterOpenChange: (visible: boolean) => void;
  }> = [];
  let dictionaryView: {problem?: string; unitReadProblem?: string} | undefined;
  let localCopyView: {problem?: string; readback?: unknown; candidateError?: boolean} | undefined;
  const queryResult = () => ({
    currentData: undefined,
    isError: false,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(async () => undefined),
  });
  const queryCalls: Array<{name: string; options: unknown}> = [];
  const mutationResult = (name: string) => {
    const behavior = mutationOverrides[name];
    return [
      vi.fn(() => ({
        unwrap: vi.fn(async () => {
          if (behavior?.error) throw behavior.error;
          if (behavior?.pending) return behavior.pending;
          return behavior?.response;
        }),
      })),
      {
        isError: Boolean(behavior?.error),
        isLoading: Boolean(behavior?.pending),
        isSuccess: Boolean(behavior?.response),
      },
    ];
  };
  const operationsRtk = new Proxy(
    {},
    {
      get: (_target, property) => {
        const name = String(property);
        if (name.includes('Mutation')) return () => mutationResult(name);
        return (...args: unknown[]) => {
          queryCalls.push({name, options: args[1]});
          return {...queryResult(), ...queryOverrides[name]};
        };
      },
    },
  );
  const catalogInventoryRtkRequest = new Proxy(
    {},
    {
      get: (_target, property) => () => ({operationId: String(property)}),
    },
  );
  const operationIds = new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  );
  const refreshSignal = {
    subscribe: () => () => undefined,
    snapshot: () => 0,
  };
  return {
    app: {modal: {confirm}},
    catalogInventoryRtkRequest,
    form,
    modal,
    operationIds,
    operationsRtk,
    queryCalls,
    queryOverrides,
    mutationOverrides,
    drawerProps,
    get dictionaryView() {
      return dictionaryView;
    },
    set dictionaryView(value: {problem?: string; unitReadProblem?: string} | undefined) {
      dictionaryView = value;
    },
    get localCopyView() {
      return localCopyView;
    },
    set localCopyView(value: {problem?: string; readback?: unknown; candidateError?: boolean} | undefined) {
      localCopyView = value;
    },
    refreshSignal,
  };
});

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('antd', () => {
  const passthrough = ({children}: {children?: ReactNode}) => createElement('div', null, children);
  const button = ({children}: {children?: ReactNode}) => createElement('button', null, children);
  const alert = ({title, description, children}: {title?: ReactNode; description?: ReactNode; children?: ReactNode}) =>
    createElement('div', null, title, description, children);
  const text = ({children}: {children?: ReactNode}) => createElement('span', null, children);
  const typography = {Text: text, Paragraph: text, Title: text, Link: text};
  const input = Object.assign(passthrough, {Search: passthrough, TextArea: passthrough});
  const radio = Object.assign(passthrough, {Group: passthrough, Button: button});
  const checkbox = Object.assign(passthrough, {Group: passthrough});
  const list = Object.assign(passthrough, {Item: passthrough});
  const collapse = Object.assign(passthrough, {Panel: passthrough});
  const empty = Object.assign(passthrough, {PRESENTED_IMAGE_SIMPLE: null});
  const descriptions = Object.assign(passthrough, {Item: passthrough});
  const form = Object.assign(passthrough, {useForm: () => [testState.form]});
  const drawer = (props: {
    children?: ReactNode;
    title?: unknown;
    open?: boolean;
    maskClosable?: boolean;
    keyboard?: boolean;
    onClose: () => void;
    afterOpenChange: (visible: boolean) => void;
  }) => {
    testState.drawerProps.push(props);
    return createElement('div', null, props.children);
  };
  return {
    Alert: alert,
    App: {useApp: () => testState.app},
    Button: button,
    Checkbox: checkbox,
    Collapse: collapse,
    Descriptions: descriptions,
    Divider: passthrough,
    Drawer: drawer,
    Empty: empty,
    Flex: passthrough,
    Form: form,
    Input: input,
    List: list,
    Radio: radio,
    Skeleton: passthrough,
    Space: passthrough,
    Splitter: Object.assign(passthrough, {Panel: passthrough}),
    Steps: passthrough,
    Table: passthrough,
    Tag: passthrough,
    theme: {
      useToken: () => ({
        token: {
          colorBorderSecondary: '#ddd',
          margin: 8,
          controlHeight: 32,
          paddingXS: 4,
          paddingLG: 16,
          lineWidthBold: 2,
          colorPrimary: '#1677ff',
          colorText: '#111',
          motionDurationSlow: '0.2s',
        },
      }),
    },
    Tooltip: passthrough,
    Typography: typography,
  };
});

vi.mock('../../../app/api/OperationsTransport', () => ({
  operationsContentTabRefreshSignal: testState.refreshSignal,
  operationsLogger: {debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn()},
  operationsProblemOf: vi.fn(() => ({errorCode: 'PLATFORM_COMMON_RESULT_UNKNOWN', status: 0})),
  operationsRtk: testState.operationsRtk,
}));

vi.mock('../../../app/api/generated/catalog-inventory-edge.rtk', () => ({
  catalogInventoryRtkRequest: testState.catalogInventoryRtkRequest,
}));

vi.mock('../../../app/api/generated/catalog-inventory-edge', () => ({
  CATALOG_INVENTORY_OPERATION_IDS: testState.operationIds,
}));

vi.mock('./CatalogConfigurationDrawerSurface', async () => {
  const actual = await vi.importActual<typeof import('./CatalogConfigurationDrawerSurface')>(
    './CatalogConfigurationDrawerSurface',
  );
  return actual;
});
vi.mock('./CatalogDefinitionLibraries', () => ({CatalogDefinitionLibraries: () => null}));
vi.mock('./CatalogDictionaryAtomModals', () => ({CatalogDictionaryAtomModals: () => null}));
vi.mock('./CatalogSimpleDictionaryLibrary', () => ({CatalogSimpleDictionaryLibrary: () => null}));
vi.mock('./CatalogSkuAttributeLibrary', () => ({CatalogSkuAttributeLibrary: () => null}));

vi.mock('./dictionary/CatalogDictionaryDrawerView', async () => {
  const actual = await vi.importActual<typeof import('./dictionary/CatalogDictionaryDrawerView')>(
    './dictionary/CatalogDictionaryDrawerView',
  );
  return {
    ...actual,
    CatalogDictionaryDrawerView: (props: Parameters<typeof actual.CatalogDictionaryDrawerView>[0]) => {
      testState.dictionaryView = {
        problem: props.viewModel.problem,
        unitReadProblem: props.viewModel.unitReadProblem,
      };
      return actual.CatalogDictionaryDrawerView(props);
    },
  };
});

vi.mock('./local-copy/LocalCatalogCopyView', async () => {
  const actual = await vi.importActual<typeof import('./local-copy/LocalCatalogCopyView')>(
    './local-copy/LocalCatalogCopyView',
  );
  return {
    ...actual,
    LocalCatalogCopyView: (props: Parameters<typeof actual.LocalCatalogCopyView>[0]) => {
      testState.localCopyView = {
        problem: props.viewModel.problem,
        readback: props.viewModel.readback,
        candidateError: props.viewModel.candidatesQuery.isError,
      };
      return actual.LocalCatalogCopyView(props);
    },
  };
});

const QUERY_CONTEXT_A: OperationsPageContext = {
  expectedContextVersion: 1,
  groupWorkspaceKey: 'workspace-1',
  scopeRef: wireUuid('00000000-0000-4000-8000-000000000001'),
};
const QUERY_CONTEXT_B: OperationsPageContext = {
  ...QUERY_CONTEXT_A,
  scopeRef: wireUuid('00000000-0000-4000-8000-000000000002'),
};

function renderedTree(renderer: ReactTestRenderer) {
  return JSON.stringify((renderer as ReactTestRenderer & {toJSON: () => unknown}).toJSON());
}

function latestDrawerProps() {
  const props = testState.drawerProps[testState.drawerProps.length - 1];
  if (!props) throw new Error('expected the owning Drawer to render');
  return props;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, resolve, reject};
}

type DictionaryControllerHandle = {
  applyFilter: () => void;
  afterOpenChange: (visible: boolean) => void;
  changeLibrary: (library: 'TAG' | 'UNIT') => void;
  requestConfigClose: () => void;
  requestClose: () => void;
  setEditName: (name: string) => void;
  editNameValue: () => unknown;
  setDefinitionDirtyMessage: (message?: string) => void;
  setDirty: (dirty: boolean) => void;
  setFilterInput: (value: string) => void;
  setSubmitting: (submitting: boolean) => void;
  snapshot: () => {
    appliedKeyword: string;
    currentLibrary: string;
    dirty: boolean;
    kind: string;
    open: boolean;
    submitting: boolean;
    unitReadProblem?: string;
    rowCount: number;
    closedSessionKey: number;
  };
};

const DictionaryControllerProbe = forwardRef(function DictionaryControllerProbe(
  {
    open,
    initialKind,
    queryContext,
    onClose,
  }: {
    initialKind: 'TAG' | 'UNIT';
    open: boolean;
    queryContext: OperationsPageContext;
    onClose?: () => void;
  },
  ref: Ref<DictionaryControllerHandle>,
) {
  const viewModel = useCatalogDictionaryDrawerController({
    canWrite: true,
    initialKind,
    onAfterClose: () => undefined,
    onClose: onClose ?? (() => undefined),
    open,
    queryContext,
  });
  useImperativeHandle(
    ref,
    () => ({
      applyFilter: viewModel.simpleLibraryFilter.applyKeyword,
      afterOpenChange: viewModel.lifecycle.afterOpenChange,
      changeLibrary: viewModel.changeLibrary,
      requestConfigClose: viewModel.requestConfigClose,
      requestClose: viewModel.lifecycle.requestClose,
      setEditName: (name: string) => viewModel.editNameForm.setFieldsValue({name}),
      editNameValue: () => viewModel.editNameForm.getFieldValue('name'),
      setDefinitionDirtyMessage: viewModel.setDefinitionDirtyMessage,
      setDirty: viewModel.lifecycle.setDirty,
      setFilterInput: viewModel.simpleLibraryFilter.setKeywordInput,
      setSubmitting: viewModel.lifecycle.setSubmitting,
      snapshot: () => ({
        appliedKeyword: viewModel.simpleLibraryFilter.appliedKeyword,
        currentLibrary: String(viewModel.currentLibrary),
        dirty: viewModel.lifecycle.dirty,
        kind: String(viewModel.kind),
        open: viewModel.open,
        submitting: viewModel.lifecycle.submitting,
        unitReadProblem: viewModel.unitReadProblem,
        rowCount: viewModel.rows.length,
        closedSessionKey: viewModel.lifecycle.closedSessionKey,
      }),
    }),
    [viewModel],
  );
  return createElement(CatalogDictionaryDrawerView, {viewModel});
});

type LocalCopyControllerHandle = {
  afterOpenChange: (visible: boolean) => void;
  closeAfterSuccess: () => void;
  requestClose: () => void;
  runPreflight: () => Promise<void>;
  execute: () => Promise<void>;
  setSelectedSections: (sections: LocalCopyScope[]) => void;
  setSelectedSourceItemCode: (code?: string) => void;
  setDirty: (dirty: boolean) => void;
  setStep: (step: WizardStep) => void;
  setSubmitting: (submitting: boolean) => void;
  snapshot: () => {
    dirty: boolean;
    preflightPending: boolean;
    preflightDigest?: string;
    problem?: string;
    readback?: unknown;
    selectedSourceItemCode?: string;
    sourceKeyword: string;
    step: string;
    submitting: boolean;
    closedSessionKey: number;
  };
};

const LocalCopyControllerProbe = forwardRef(function LocalCopyControllerProbe(
  {
    open,
    queryContext,
    onClose,
  }: {
    open: boolean;
    queryContext: OperationsPageContext;
    onClose?: () => void;
  },
  ref: Ref<LocalCopyControllerHandle>,
) {
  const viewModel = useLocalCatalogCopyController({
    brandRef: undefined,
    onClose: onClose ?? (() => undefined),
    open,
    queryContext,
    sourceItemCode: 'ITEM-TARGET',
    targetShapeKey: 'STANDARD',
  });
  useImperativeHandle(
    ref,
    () => ({
      afterOpenChange: viewModel.lifecycle.afterOpenChange,
      closeAfterSuccess: viewModel.lifecycle.closeAfterSuccess,
      requestClose: viewModel.lifecycle.requestClose,
      runPreflight: viewModel.runPreflight,
      execute: viewModel.execute,
      setSelectedSections: viewModel.setSelectedSections,
      setSelectedSourceItemCode: viewModel.setSelectedSourceItemCode,
      setDirty: viewModel.lifecycle.setDirty,
      setStep: viewModel.setStep,
      setSubmitting: viewModel.lifecycle.setSubmitting,
      snapshot: () => ({
        dirty: viewModel.lifecycle.dirty,
        preflightPending: viewModel.preflightPending,
        preflightDigest: viewModel.preflight?.preflightDigest,
        problem: viewModel.problem,
        readback: viewModel.readback,
        selectedSourceItemCode: viewModel.selectedSourceItemCode,
        sourceKeyword: viewModel.sourceKeyword,
        step: viewModel.step,
        submitting: viewModel.lifecycle.submitting,
        closedSessionKey: viewModel.lifecycle.closedSessionKey,
      }),
    }),
    [viewModel],
  );
  return createElement(LocalCatalogCopyView, {viewModel});
});

describe('catalog drawer controller lifecycle wiring', () => {
  beforeEach(() => {
    testState.modal.confirmation = undefined;
    testState.queryCalls.length = 0;
    for (const key of Object.keys(testState.queryOverrides)) delete testState.queryOverrides[key];
    for (const key of Object.keys(testState.mutationOverrides)) delete testState.mutationOverrides[key];
    testState.drawerProps.length = 0;
    testState.dictionaryView = undefined;
    testState.localCopyView = undefined;
  });

  it('runs Dictionary lifecycle and query reset through the owning controller', async () => {
    const ref = {current: null as DictionaryControllerHandle | null};
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        createElement(DictionaryControllerProbe, {initialKind: 'TAG', open: false, queryContext: QUERY_CONTEXT_A, ref}),
      );
    });
    expect(ref.current?.snapshot()).toMatchObject({
      appliedKeyword: '',
      currentLibrary: 'TAG',
      dirty: false,
      kind: 'TAG',
      open: false,
      submitting: false,
    });

    await act(async () => {
      renderer.update(
        createElement(DictionaryControllerProbe, {initialKind: 'TAG', open: true, queryContext: QUERY_CONTEXT_A, ref}),
      );
    });
    await act(async () => ref.current?.afterOpenChange(true));
    await act(async () => {
      ref.current?.setFilterInput('name');
      ref.current?.applyFilter();
      ref.current?.setDefinitionDirtyMessage('字典编辑尚未保存。');
    });
    expect(ref.current?.snapshot()).toMatchObject({appliedKeyword: 'name', dirty: true});

    await act(async () => ref.current?.requestConfigClose());
    expect(testState.modal.confirmation).toBeDefined();
    await act(async () => testState.modal.confirmation?.onCancel?.());
    expect(ref.current?.snapshot().dirty).toBe(true);

    await act(async () => ref.current?.requestConfigClose());
    await act(async () => testState.modal.confirmation?.onOk?.());
    expect(ref.current?.snapshot().dirty).toBe(false);

    await act(async () => {
      renderer.update(
        createElement(DictionaryControllerProbe, {initialKind: 'TAG', open: false, queryContext: QUERY_CONTEXT_A, ref}),
      );
    });
    await act(async () => latestDrawerProps().afterOpenChange(false));
    expect(ref.current?.snapshot().closedSessionKey).toBeGreaterThan(0);

    await act(async () => {
      renderer.update(
        createElement(DictionaryControllerProbe, {initialKind: 'TAG', open: true, queryContext: QUERY_CONTEXT_A, ref}),
      );
    });
    await act(async () => {
      ref.current?.setFilterInput('stale');
      ref.current?.applyFilter();
      ref.current?.setEditName('未提交的旧上下文名称');
      ref.current?.setDefinitionDirtyMessage('旧上下文尚未保存。');
    });
    expect(ref.current?.snapshot().dirty).toBe(true);
    expect(ref.current?.editNameValue()).toBe('未提交的旧上下文名称');
    const closeRequests: string[] = [];
    await act(async () => ref.current?.requestConfigClose());
    const staleConfirmation = testState.modal.confirmation;
    expect(staleConfirmation).toBeDefined();
    await act(async () => {
      renderer.update(
        createElement(DictionaryControllerProbe, {
          initialKind: 'TAG',
          open: true,
          queryContext: QUERY_CONTEXT_B,
          onClose: () => closeRequests.push('stale'),
          ref,
        }),
      );
    });
    expect(staleConfirmation?.destroyed).toBe(true);
    expect(testState.modal.confirmation).toBeUndefined();
    await act(async () => staleConfirmation?.onOk?.());
    expect(closeRequests).toEqual([]);
    expect(ref.current?.snapshot()).toMatchObject({appliedKeyword: '', currentLibrary: 'TAG', dirty: false});
    expect(ref.current?.editNameValue()).toBeUndefined();

    testState.queryCalls.length = 0;
    await act(async () => {
      renderer.update(
        createElement(DictionaryControllerProbe, {initialKind: 'TAG', open: false, queryContext: QUERY_CONTEXT_B, ref}),
      );
    });
    await act(async () => {
      renderer.update(
        createElement(DictionaryControllerProbe, {initialKind: 'UNIT', open: true, queryContext: QUERY_CONTEXT_B, ref}),
      );
    });
    const dictionaryCalls = testState.queryCalls.filter(({name}) => name === 'useGetOperationsCatalogDictionaryQuery');
    expect(dictionaryCalls.length).toBeGreaterThan(0);
    expect(dictionaryCalls.every(({options}) => (options as {skip?: boolean} | undefined)?.skip === true)).toBe(true);
    const unitCalls = testState.queryCalls.filter(({name}) => name === 'useListOperationsCatalogUnitsQuery');
    expect(unitCalls.some(({options}) => (options as {skip?: boolean} | undefined)?.skip === false)).toBe(true);
    expect(ref.current?.snapshot().currentLibrary).toBe('UNIT');

    testState.queryOverrides.useListOperationsCatalogUnitsQuery = {
      currentData: {
        data: {
          units: [
            {
              unitRef: '00000000-0000-4000-8000-000000000003',
              code: 'COUNT',
              name: '个',
              status: 'ENABLED',
              version: 1,
              unitDimension: 'COUNT',
              precision: 0,
              isReferenced: false,
            },
          ],
        },
      },
    };
    await act(async () => {
      renderer.update(
        createElement(DictionaryControllerProbe, {initialKind: 'UNIT', open: true, queryContext: QUERY_CONTEXT_B, ref}),
      );
    });
    expect(ref.current?.snapshot()).toMatchObject({rowCount: 1, unitReadProblem: undefined});

    testState.queryOverrides.useListOperationsCatalogUnitsQuery = {
      isError: true,
      error: new Error('UNIT_QUERY_TRANSPORT_FAILURE'),
    };
    await act(async () => {
      renderer.update(
        createElement(DictionaryControllerProbe, {initialKind: 'UNIT', open: true, queryContext: QUERY_CONTEXT_B, ref}),
      );
    });
    expect(ref.current?.snapshot().unitReadProblem).toBeTruthy();
    expect(testState.dictionaryView?.unitReadProblem).toBeTruthy();
    expect(renderedTree(renderer!)).toContain('计量单位读取失败');

    testState.queryOverrides.useListOperationsCatalogUnitsQuery = {currentData: {data: {units: []}}};

    testState.queryCalls.length = 0;
    await act(async () => ref.current?.changeLibrary('TAG'));
    const dictionaryCallsAfterManualSwitch = testState.queryCalls.filter(
      ({name}) => name === 'useGetOperationsCatalogDictionaryQuery',
    );
    expect(
      dictionaryCallsAfterManualSwitch.some(({options}) => (options as {skip?: boolean} | undefined)?.skip === false),
    ).toBe(true);
    expect(ref.current?.snapshot().currentLibrary).toBe('TAG');

    await act(async () => {
      renderer.update(
        createElement(DictionaryControllerProbe, {initialKind: 'TAG', open: true, queryContext: QUERY_CONTEXT_B, ref}),
      );
    });
    expect(ref.current?.snapshot().currentLibrary).toBe('TAG');

    testState.queryCalls.length = 0;
    await act(async () => {
      renderer.update(
        createElement(DictionaryControllerProbe, {initialKind: 'UNIT', open: true, queryContext: QUERY_CONTEXT_B, ref}),
      );
    });
    expect(ref.current?.snapshot().currentLibrary).toBe('UNIT');
    const unitCallsAfterOpenPropChange = testState.queryCalls.filter(
      ({name}) => name === 'useListOperationsCatalogUnitsQuery',
    );
    expect(
      unitCallsAfterOpenPropChange.some(({options}) => (options as {skip?: boolean} | undefined)?.skip === false),
    ).toBe(true);
    renderer!.unmount();
  });

  it('runs Local Copy lifecycle, pending close, error and close reset through the owning controller', async () => {
    const ref = {current: null as LocalCopyControllerHandle | null};
    const closeRequests: boolean[] = [];
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        createElement(LocalCopyControllerProbe, {
          onClose: () => closeRequests.push(false),
          open: true,
          queryContext: QUERY_CONTEXT_A,
          ref,
        }),
      );
    });
    await act(async () => ref.current?.afterOpenChange(true));
    await act(async () => ref.current?.setStep('source-item'));
    await act(async () => ref.current?.setDirty(true));
    await act(async () => ref.current?.setSubmitting(true));
    expect(ref.current?.snapshot()).toMatchObject({dirty: true, step: 'source-item', submitting: true});

    await act(async () => ref.current?.requestClose());
    expect(testState.modal.confirmation).toBeUndefined();

    await act(async () => ref.current?.setSubmitting(false));
    await act(async () => ref.current?.runPreflight());
    expect(ref.current?.snapshot().problem).toBe('请选择来源商品和至少一个复制范围。');

    testState.queryOverrides.useGetOperationsLocalCatalogCopyCandidatesQuery = {
      isError: true,
      error: new Error('CANDIDATE_QUERY_TRANSPORT_FAILURE'),
    };
    await act(async () => {
      renderer.update(
        createElement(LocalCopyControllerProbe, {
          onClose: () => closeRequests.push(false),
          open: true,
          queryContext: QUERY_CONTEXT_A,
          ref,
        }),
      );
    });
    expect(testState.localCopyView?.candidateError).toBe(true);

    await act(async () => {
      ref.current?.setSelectedSourceItemCode('ITEM-SOURCE');
      ref.current?.setSelectedSections(['BASIC_INFO']);
    });
    const pendingPreflight = deferred<unknown>();
    testState.mutationOverrides.usePreflightOperationsLocalCatalogCopyMutation = {
      pending: pendingPreflight.promise,
    };
    await act(async () => {
      renderer.update(
        createElement(LocalCopyControllerProbe, {
          onClose: () => closeRequests.push(false),
          open: true,
          queryContext: QUERY_CONTEXT_A,
          ref,
        }),
      );
    });
    let pendingPreflightRun: Promise<void> | undefined;
    await act(async () => {
      pendingPreflightRun = ref.current?.runPreflight();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(ref.current?.snapshot()).toMatchObject({preflightPending: true, submitting: true});
    const pendingDrawer = latestDrawerProps();
    expect(pendingDrawer.onClose).toBeTypeOf('function');
    expect(pendingDrawer.afterOpenChange).toBeTypeOf('function');
    expect(pendingDrawer).toMatchObject({maskClosable: false, keyboard: false});
    await act(async () => pendingDrawer.onClose());
    expect(testState.modal.confirmation).toBeUndefined();
    await act(async () => {
      pendingPreflight.reject(new Error('PREFLIGHT_PENDING_ABORT'));
      if (pendingPreflightRun) await pendingPreflightRun;
    });
    expect(ref.current?.snapshot()).toMatchObject({preflightPending: false, submitting: false});

    testState.mutationOverrides.usePreflightOperationsLocalCatalogCopyMutation = {
      error: new Error('PREFLIGHT_TRANSPORT_FAILURE'),
    };
    await act(async () => {
      renderer.update(
        createElement(LocalCopyControllerProbe, {
          onClose: () => closeRequests.push(false),
          open: true,
          queryContext: QUERY_CONTEXT_A,
          ref,
        }),
      );
    });
    await act(async () => ref.current?.runPreflight());
    expect(ref.current?.snapshot().problem).toBeTruthy();
    expect(ref.current?.snapshot().preflightPending).toBe(false);
    expect(renderedTree(renderer!)).toContain('本库复制未完成');

    testState.mutationOverrides.usePreflightOperationsLocalCatalogCopyMutation = {
      response: {
        data: {
          preflightDigest: 'PREFLIGHT-1',
          objectVersions: [{objectType: 'CATALOG_ITEM', code: 'ITEM-SOURCE', sourceVersion: 1, targetVersion: 1}],
          closureItems: [],
          referenceMappings: [],
          skipped: [],
          compatibilityResults: [],
          blockingCount: 0,
          confirmationRequiredCount: 0,
        },
      },
    };
    await act(async () => {
      renderer.update(
        createElement(LocalCopyControllerProbe, {
          onClose: () => closeRequests.push(false),
          open: true,
          queryContext: QUERY_CONTEXT_A,
          ref,
        }),
      );
    });
    await act(async () => ref.current?.runPreflight());
    expect(ref.current?.snapshot()).toMatchObject({
      preflightDigest: 'PREFLIGHT-1',
      preflightPending: false,
      selectedSourceItemCode: 'ITEM-SOURCE',
      problem: undefined,
    });

    const executeResponse = {
      data: {
        preflightDigest: 'PREFLIGHT-1',
        created: [],
        reused: [],
        skipped: [],
        referenceMappings: [],
        targetVersions: [],
        ownerReadbacks: [],
      },
    };
    const pendingExecute = deferred<unknown>();
    testState.mutationOverrides.useExecuteOperationsLocalCatalogCopyMutation = {
      pending: pendingExecute.promise,
    };
    await act(async () => {
      ref.current?.setStep('preview');
      renderer.update(
        createElement(LocalCopyControllerProbe, {
          onClose: () => closeRequests.push(false),
          open: true,
          queryContext: QUERY_CONTEXT_A,
          ref,
        }),
      );
    });
    let pendingExecuteRun: Promise<void> | undefined;
    await act(async () => {
      pendingExecuteRun = ref.current?.execute();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(ref.current?.snapshot().submitting).toBe(true);
    expect(latestDrawerProps()).toMatchObject({maskClosable: false, keyboard: false});
    await act(async () => {
      pendingExecute.resolve(executeResponse);
      if (pendingExecuteRun) await pendingExecuteRun;
    });
    expect(ref.current?.snapshot().readback).toMatchObject({preflightDigest: 'PREFLIGHT-1'});
    expect(testState.localCopyView?.readback).toMatchObject({preflightDigest: 'PREFLIGHT-1'});
    expect(renderedTree(renderer!)).toContain('配置已复制');
    await act(async () => ref.current?.closeAfterSuccess());
    await act(async () => {
      renderer.update(
        createElement(LocalCopyControllerProbe, {
          onClose: () => closeRequests.push(false),
          open: false,
          queryContext: QUERY_CONTEXT_A,
          ref,
        }),
      );
    });
    const closedDrawer = latestDrawerProps();
    expect(closedDrawer.afterOpenChange).toBeTypeOf('function');
    await act(async () => closedDrawer.afterOpenChange(false));
    expect(closeRequests).toEqual([false]);
    expect(ref.current?.snapshot().closedSessionKey).toBeGreaterThan(0);

    await act(async () => {
      renderer.update(
        createElement(LocalCopyControllerProbe, {
          onClose: () => closeRequests.push(false),
          open: true,
          queryContext: QUERY_CONTEXT_B,
          ref,
        }),
      );
    });
    expect(ref.current?.snapshot()).toMatchObject({
      dirty: false,
      problem: undefined,
      preflightDigest: undefined,
      readback: undefined,
      selectedSourceItemCode: undefined,
      sourceKeyword: '',
      step: 'source-scope',
      submitting: false,
    });
    renderer!.unmount();
    expect(closeRequests).toEqual([false]);
  });
});
