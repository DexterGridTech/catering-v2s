// @vitest-environment jsdom
import {createElement} from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const testState = vi.hoisted(() => ({
  calls: [] as Array<{method: string; args: unknown[]}>,
  lifecycleCalls: [] as string[],
  resetPreservingOpen: () => testState.lifecycleCalls.push('resetPreservingOpen'),
  successMessages: [] as string[],
  createRequests: [] as Array<{resolve: (value: unknown) => void; reject: (reason: unknown) => void}>,
  deferCreate: false,
  alertMessages: [] as string[],
  onFinish: undefined as ((values: unknown) => Promise<void>) | undefined,
  candidateRequests: [] as Array<{request: unknown; resolve: (value: unknown) => void; reject: (reason: unknown) => void}>,
  candidateInputs: [] as unknown[],
  acceptedPages: [] as Array<{kind: string; items: unknown[]}>,
  formValues: {} as Record<string, unknown>,
  form: {
    resetFields: () => undefined,
    setFieldsValue: () => undefined,
    setFieldValue: () => undefined,
    getFieldValue: (_name: string) => undefined as unknown,
  },
}));

vi.mock('antd', () => {
  const passthrough = ({children}: {children?: unknown}) => children ?? null;
  const form = Object.assign(({children, onFinish}: {children?: unknown; onFinish?: (values: unknown) => Promise<void>}) => {
    if (onFinish) testState.onFinish = onFinish;
    return children ?? null;
  }, {
    Item: passthrough,
    useForm: () => [testState.form],
    useWatch: (name: string) => testState.formValues[name],
  });
  return {
    Alert: ({message: alertMessage}: {message?: string}) => {
      if (alertMessage) testState.alertMessages.push(alertMessage);
      return null;
    },
    Button: passthrough,
    Drawer: passthrough,
    Form: form,
    Input: Object.assign(passthrough, {TextArea: passthrough}),
    InputNumber: passthrough,
    Select: passthrough,
    Space: passthrough,
    message: {success: (value: string) => testState.successMessages.push(value)},
  };
});

vi.mock('@catering-v2s/admin-ui-foundation', async importOriginal => {
  const actual = await importOriginal<typeof import('@catering-v2s/admin-ui-foundation')>();
  const acceptFullPage = (items: unknown[]) => testState.acceptedPages.push({kind: 'FULL', items});
  const acceptHotPage = (items: unknown[]) => testState.acceptedPages.push({kind: 'HOT', items});
  return {
    ...actual,
    createContentIdempotencyKey: vi.fn(async () => 'rule-create-idempotency-key'),
    useCursorCandidates: ({resetKey}: {resetKey: string}) => ({
      items: [],
      acceptPage: String(resetKey).split('|').length >= 3 ? acceptHotPage : acceptFullPage,
      cursor: '',
      debouncedQueryText: '',
      pageSize: 50,
      nextCursor: null,
      loadNext: () => undefined,
      onPopupScroll: () => undefined,
    }),
    useDrawerFormLifecycle: () => ({
      submitting: false,
      setSubmitting: (value: boolean) => testState.lifecycleCalls.push(`submitting:${value}`),
      setDirty: (value: boolean) => testState.lifecycleCalls.push(`dirty:${value}`),
      resetPreservingOpen: testState.resetPreservingOpen,
      closeAfterSuccess: () => testState.lifecycleCalls.push('closeAfterSuccess'),
      requestClose: () => undefined,
      afterOpenChange: () => undefined,
    }),
    useOverlayLock: () => undefined,
  };
});

vi.mock('../../../app/api/OperationsTransport', () => {
  const fetchCandidatePage = (request: unknown) => {
        let resolve!: (value: unknown) => void;
        let reject!: (reason: unknown) => void;
        const promise = new Promise<unknown>((resolvePromise, rejectPromise) => {
          resolve = resolvePromise;
          reject = rejectPromise;
        });
        testState.candidateRequests.push({request, resolve, reject});
        return {unwrap: () => promise};
  };
  return {
    operationsClient: new Proxy({}, {
      get: (_target, method) => (...args: unknown[]) => {
        testState.calls.push({method: String(method), args});
        if (method === 'createOperationsProjectTerminalUpdateRule' && testState.deferCreate) {
          return new Promise<unknown>((resolve, reject) => testState.createRequests.push({resolve, reject}));
        }
        return Promise.resolve({ruleRef: '20000000-0000-4000-8000-000000000001'});
      },
    }),
    operationsProblemOf: () => ({detail: 'unexpected request failure', errorCode: 'TEST'}),
    operationsRtk: {
      useLazyGetOperationsTerminalUpdateArtifactCandidatePageQuery: () => [fetchCandidatePage, {isFetching: false}],
    },
  };
});

vi.mock('../../../app/api/generated/operations-edge.rtk', () => ({
  operationsAdminRtkRequest: {getOperationsTerminalUpdateArtifactCandidatePage: (...args: unknown[]) => {
    testState.candidateInputs.push(args);
    return args;
  }},
}));

vi.mock('../../../app/queries/useOrganizationCandidates', () => ({
  useOrganizationCandidates: () => ({
    items: [],
    isFetching: false,
    setStoreSearch: () => undefined,
    onPopupScroll: () => undefined,
  }),
}));

import {wireUuid} from '../../../app/api/wireUuid';
import {RuleCreateDrawer} from './RuleCreateDrawer';

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const groupWorkspaceKey = 'aurora';
const projectRef = wireUuid('10000000-0000-4000-8000-000000000001');
const storeRef = wireUuid('30000000-0000-4000-8000-000000000001');
const fullArtifactRef = wireUuid('40000000-0000-4000-8000-000000000001');
const hotArtifactRef = wireUuid('40000000-0000-4000-8000-000000000002');

let renderer: ReactTestRenderer | undefined;

beforeEach(() => {
  testState.calls.length = 0;
  testState.lifecycleCalls.length = 0;
  testState.successMessages.length = 0;
  testState.createRequests.length = 0;
  testState.deferCreate = false;
  testState.alertMessages.length = 0;
  testState.onFinish = undefined;
  testState.candidateRequests.length = 0;
  testState.candidateInputs.length = 0;
  testState.acceptedPages.length = 0;
  testState.formValues = {};
  testState.form.getFieldValue = name => testState.formValues[name];
});

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer?.unmount());
    renderer = undefined;
  }
});

describe('RuleCreateDrawer', () => {
  it('ignores a stale candidate response after workspace change and after replacing the selected FULL artifact', async () => {
    const props = {
      open: true,
      queryContext: {groupWorkspaceKey, expectedContextVersion: 7, scopeRef: projectRef} as never,
      projectRef,
      onClose: vi.fn(),
      onCreated: async () => undefined,
    };
    function Probe({workspace}: {workspace: string; revision: number}) {
      return createElement(RuleCreateDrawer, {
        ...props,
        queryContext: {groupWorkspaceKey: workspace, expectedContextVersion: 7, scopeRef: projectRef} as never,
      });
    }

    await act(async () => {
      renderer = create(createElement(Probe, {workspace: groupWorkspaceKey, revision: 0}));
      await Promise.resolve();
    });
    expect(testState.candidateRequests).toHaveLength(1);

    await act(async () => {
      renderer?.update(createElement(Probe, {workspace: 'boreal', revision: 1}));
      await Promise.resolve();
    });
    expect(testState.candidateRequests).toHaveLength(2);
    await act(async () => {
      testState.candidateRequests[0]!.resolve({items: [{artifactRef: fullArtifactRef}], nextCursor: null});
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(testState.acceptedPages).toEqual([]);
    await act(async () => {
      testState.candidateRequests[1]!.resolve({items: [{artifactRef: fullArtifactRef}], nextCursor: null});
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(testState.acceptedPages.map(page => page.kind)).toEqual(['FULL']);

    testState.formValues.fullArtifactRef = fullArtifactRef;
    await act(async () => {
      renderer?.update(createElement(Probe, {workspace: 'boreal', revision: 2}));
      await Promise.resolve();
    });
    expect(testState.candidateRequests).toHaveLength(3);
    testState.formValues.fullArtifactRef = hotArtifactRef;
    await act(async () => {
      renderer?.update(createElement(Probe, {workspace: 'boreal', revision: 3}));
      await Promise.resolve();
    });
    expect(testState.candidateRequests).toHaveLength(4);
    await act(async () => {
      testState.candidateRequests[2]!.reject(new Error('stale HOT candidate failure'));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(testState.acceptedPages).toHaveLength(1);
    await act(async () => {
      testState.candidateRequests[3]!.resolve({items: [{artifactRef: hotArtifactRef}], nextCursor: null});
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(testState.acceptedPages).toEqual([
      {kind: 'FULL', items: [{artifactRef: fullArtifactRef}]},
      {kind: 'HOT', items: [{artifactRef: hotArtifactRef}]},
    ]);
    expect(testState.candidateInputs[2]).toMatchObject([
      {groupWorkspaceKey: 'boreal'},
      {query: {minimumFullArtifactRef: fullArtifactRef}},
    ]);
    expect(testState.candidateInputs[3]).toMatchObject([
      {groupWorkspaceKey: 'boreal'},
      {query: {minimumFullArtifactRef: hotArtifactRef}},
    ]);
  });

  it('keeps store scope, FULL/HOT intent, idempotency and drawer success lifecycle on the original owner call', async () => {
    const onClose = vi.fn();
    const onCreated = vi.fn(async () => undefined);
    const queryContext = {
      groupWorkspaceKey,
      expectedContextVersion: 7,
      scopeRef: projectRef,
    } as never;
    const drawer = createElement(RuleCreateDrawer, {
      open: true,
      queryContext,
      projectRef,
      onClose,
      onCreated,
    });
    await act(async () => {
      renderer = create(drawer);
      await Promise.resolve();
    });
    expect(testState.onFinish).toBeDefined();
    await act(async () => {
      await testState.onFinish?.({
        targetMode: 'STORE_REFS',
        status: 'ENABLED',
        storeRefs: [storeRef],
        fullArtifactRef,
        hotArtifactRef,
        nMinutes: 3,
        hotStrategy: 'IDLE',
        mMinutes: 2,
        description: 'nightly rollout',
      });
    });

    expect(testState.calls).toHaveLength(1);
    expect(testState.calls[0]?.method).toBe('createOperationsProjectTerminalUpdateRule');
    expect(testState.calls[0]?.args).toEqual([
      {groupWorkspaceKey, projectRef},
      {
        query: {expectedContextVersion: 7},
        body: {
          targetMode: 'STORE_REFS',
          storeRefs: [storeRef],
          fullArtifactRef,
          hotArtifactRef,
          status: 'ENABLED',
          nSeconds: 180,
          hotStrategy: 'IDLE',
          mSeconds: 120,
          description: 'nightly rollout',
        },
        headers: {'Idempotency-Key': 'rule-create-idempotency-key'},
      },
    ]);
    expect(testState.lifecycleCalls).toEqual([
      'resetPreservingOpen',
      'submitting:true',
      'dirty:false',
      'closeAfterSuccess',
      'submitting:false',
    ]);
    expect(onCreated).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores a successful submit response after the drawer changes project context', async () => {
    const onCreated = vi.fn(async () => undefined);
    testState.deferCreate = true;
    function Probe({workspace}: {workspace: string}) {
      return createElement(RuleCreateDrawer, {
        open: true,
        queryContext: {groupWorkspaceKey: workspace, expectedContextVersion: 7, scopeRef: projectRef} as never,
        projectRef,
        onClose: vi.fn(),
        onCreated,
      });
    }

    await act(async () => {
      renderer = create(createElement(Probe, {workspace: groupWorkspaceKey}));
      await Promise.resolve();
    });
    let submitting!: Promise<void>;
    await act(async () => {
      submitting = testState.onFinish?.({
        targetMode: 'ALL', status: 'DISABLED', fullArtifactRef, nMinutes: 5,
      }) ?? Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(testState.createRequests).toHaveLength(1);

    await act(async () => {
      renderer?.update(createElement(Probe, {workspace: 'boreal'}));
      await Promise.resolve();
    });
    expect(testState.lifecycleCalls).toContain('resetPreservingOpen');

    await act(async () => {
      testState.createRequests[0]!.resolve({ruleRef: '20000000-0000-4000-8000-000000000001'});
      await submitting;
    });
    expect(onCreated).not.toHaveBeenCalled();
    expect(testState.lifecycleCalls).not.toContain('closeAfterSuccess');
    expect(testState.successMessages).toEqual([]);
  });

  it('shows the create success before an asynchronous refresh can outlive the original context', async () => {
    testState.deferCreate = true;
    let resolveRefresh!: () => void;
    const onCreated = vi.fn(() => new Promise<void>(resolve => { resolveRefresh = resolve; }));
    function Probe({workspace}: {workspace: string}) {
      return createElement(RuleCreateDrawer, {
        open: true,
        queryContext: {groupWorkspaceKey: workspace, expectedContextVersion: 7, scopeRef: projectRef} as never,
        projectRef,
        onClose: vi.fn(),
        onCreated,
      });
    }

    await act(async () => {
      renderer = create(createElement(Probe, {workspace: groupWorkspaceKey}));
      await Promise.resolve();
    });
    let submitting!: Promise<void>;
    await act(async () => {
      submitting = testState.onFinish?.({
        targetMode: 'ALL', status: 'DISABLED', fullArtifactRef, nMinutes: 5,
      }) ?? Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(testState.createRequests).toHaveLength(1);

    await act(async () => {
      testState.createRequests[0]!.resolve({ruleRef: '20000000-0000-4000-8000-000000000001'});
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onCreated).toHaveBeenCalledOnce();
    expect(testState.successMessages).toEqual(['更新规则已创建，当前为停用状态']);

    await act(async () => {
      renderer?.update(createElement(Probe, {workspace: 'boreal'}));
      await Promise.resolve();
      resolveRefresh();
      await submitting;
    });
    expect(testState.successMessages).toEqual(['更新规则已创建，当前为停用状态']);
  });

  it('does not show an old submit failure after the drawer changes project context', async () => {
    testState.deferCreate = true;
    function Probe({workspace}: {workspace: string}) {
      return createElement(RuleCreateDrawer, {
        open: true,
        queryContext: {groupWorkspaceKey: workspace, expectedContextVersion: 7, scopeRef: projectRef} as never,
        projectRef,
        onClose: vi.fn(),
        onCreated: async () => undefined,
      });
    }

    await act(async () => {
      renderer = create(createElement(Probe, {workspace: groupWorkspaceKey}));
      await Promise.resolve();
    });
    let submitting!: Promise<void>;
    await act(async () => {
      submitting = testState.onFinish?.({
        targetMode: 'ALL', status: 'DISABLED', fullArtifactRef, nMinutes: 5,
      }) ?? Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(testState.createRequests).toHaveLength(1);

    await act(async () => {
      renderer?.update(createElement(Probe, {workspace: 'boreal'}));
      await Promise.resolve();
    });
    await act(async () => {
      testState.createRequests[0]!.reject(new Error('old project save failed'));
      await submitting;
    });
    expect(testState.alertMessages).toEqual([]);
    expect(testState.lifecycleCalls.slice(-1)).toEqual(['resetPreservingOpen']);
  });
});
