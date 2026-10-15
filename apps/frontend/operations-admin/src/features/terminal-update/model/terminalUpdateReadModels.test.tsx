// @vitest-environment jsdom
import {createElement} from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {wireUuid} from '../../../app/api/wireUuid';
import {useTerminalUpdateReports} from './useTerminalUpdateReports';
import {useTerminalUpdateReportDetail} from './useTerminalUpdateReportDetail';
import {useTerminalUpdateRules} from './useTerminalUpdateRules';
import {useTerminalUpdateRuleDetail} from './useTerminalUpdateRuleDetail';

type DeferredRequest = {
  method: string;
  args: unknown[];
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

const testState = vi.hoisted(() => ({
  requests: [] as DeferredRequest[],
  guardChecks: [] as Array<{generation: number; current: boolean; afterUnmount: boolean}>,
  unmounted: false,
}));

vi.mock('../../../app/api/OperationsTransport', () => ({
  operationsClient: new Proxy({}, {
    get: (_target, method) => (...args: unknown[]) => {
      let resolve!: (value: unknown) => void;
      let reject!: (reason: unknown) => void;
      const promise = new Promise<unknown>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      testState.requests.push({method: String(method), args, promise, resolve, reject});
      return promise;
    },
  }),
  operationsProblemOf: (error: unknown) => ({detail: error instanceof Error ? error.message : String(error)}),
}));

vi.mock('@catering-v2s/admin-ui-foundation', async importOriginal => {
  const actual = await importOriginal<typeof import('@catering-v2s/admin-ui-foundation')>();
  const observedGuards = new WeakSet<object>();
  return {
    ...actual,
    useAsyncGenerationGuard: () => {
      const guard = actual.useAsyncGenerationGuard();
      if (!observedGuards.has(guard)) {
        const isCurrent = guard.isCurrent;
        guard.isCurrent = generation => {
          const current = isCurrent(generation);
          testState.guardChecks.push({generation, current, afterUnmount: testState.unmounted});
          return current;
        };
        observedGuards.add(guard);
      }
      return guard;
    },
  };
});

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const projectRef = wireUuid('10000000-0000-4000-8000-000000000001');
const ruleA = '20000000-0000-4000-8000-000000000001';
const ruleB = '20000000-0000-4000-8000-000000000002';
const terminalA = '30000000-0000-4000-8000-000000000001';
const terminalB = '30000000-0000-4000-8000-000000000002';

function context(groupWorkspaceKey: string, expectedContextVersion = 1) {
  return {groupWorkspaceKey, expectedContextVersion, scopeRef: projectRef} as never;
}

function flushMicrotasks() {
  return Promise.resolve().then(() => Promise.resolve());
}

let renderer: ReactTestRenderer | undefined;

beforeEach(() => {
  testState.requests.length = 0;
  testState.guardChecks.length = 0;
  testState.unmounted = false;
});

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer?.unmount());
    renderer = undefined;
  }
});

describe('terminal update resource read models', () => {
  it('invalidates an in-flight rules page before a late success can write after unmount', async () => {
    let read!: ReturnType<typeof useTerminalUpdateRules>;
    const filters = {status: undefined, targetMode: undefined};
    function Probe() {
      read = useTerminalUpdateRules({
        queryContext: context('workspace-A'),
        projectRef,
        filters,
        cursor: undefined,
      });
      return null;
    }

    await act(async () => {
      renderer = create(createElement(Probe));
      await flushMicrotasks();
    });
    expect(testState.requests).toHaveLength(1);
    expect(read.loading).toBe(true);

    await act(async () => renderer?.unmount());
    renderer = undefined;
    testState.unmounted = true;
    await act(async () => {
      testState.requests[0]!.resolve({items: [{ruleRef: ruleA}], nextCursor: 'late-cursor'});
      await flushMicrotasks();
    });

    const lateChecks = testState.guardChecks.filter(check => check.afterUnmount);
    expect(lateChecks.length).toBeGreaterThanOrEqual(2);
    expect(lateChecks.every(check => !check.current)).toBe(true);
    expect(read.items).toEqual([]);
    expect(read.nextCursor).toBeNull();
    expect(read.problem).toBeUndefined();
    expect(read.loading).toBe(true);
  });

  it('does not write a late report page rejection into an unmounted read model', async () => {
    let read!: ReturnType<typeof useTerminalUpdateReports>;
    const filters = {query: '', apk: '', js: '', runtime: '', storeRef: ''};
    function Probe() {
      read = useTerminalUpdateReports({
        queryContext: context('workspace-A'),
        projectRef,
        filters,
        cursor: undefined,
      });
      return null;
    }

    await act(async () => {
      renderer = create(createElement(Probe));
      await flushMicrotasks();
    });
    expect(testState.requests).toHaveLength(1);
    expect(read.loading).toBe(true);

    await act(async () => renderer?.unmount());
    renderer = undefined;
    testState.unmounted = true;
    await act(async () => {
      testState.requests[0]!.reject(new Error('late report page failure'));
      await flushMicrotasks();
    });

    const lateChecks = testState.guardChecks.filter(check => check.afterUnmount);
    expect(lateChecks.length).toBeGreaterThanOrEqual(2);
    expect(lateChecks.every(check => !check.current)).toBe(true);
    expect(read.items).toEqual([]);
    expect(read.nextCursor).toBeNull();
    expect(read.problem).toBeUndefined();
    expect(read.loading).toBe(true);
  });

  it('keeps the active rules page loading when an older context succeeds late', async () => {
    let read!: ReturnType<typeof useTerminalUpdateRules>;
    const filters = {status: undefined, targetMode: undefined};
    function Probe({workspace}: {workspace: string}) {
      read = useTerminalUpdateRules({queryContext: context(workspace), projectRef, filters, cursor: undefined});
      return null;
    }

    await act(async () => {
      renderer = create(createElement(Probe, {workspace: 'workspace-A'}));
      await flushMicrotasks();
    });
    expect(testState.requests.map(request => request.method)).toEqual(['getOperationsProjectTerminalUpdateRulePage']);

    await act(async () => {
      renderer?.update(createElement(Probe, {workspace: 'workspace-B'}));
      await flushMicrotasks();
    });
    expect(testState.requests).toHaveLength(2);

    await act(async () => {
      testState.requests[0]!.resolve({items: [{ruleRef: ruleA}], nextCursor: null});
      await flushMicrotasks();
    });
    expect(read.items).toEqual([]);
    expect(read.loading).toBe(true);
    expect(read.problem).toBeUndefined();

    await act(async () => {
      testState.requests[1]!.resolve({items: [{ruleRef: ruleB}], nextCursor: null});
      await flushMicrotasks();
    });
    expect(read.items.map(item => item.ruleRef)).toEqual([ruleB]);
    expect(read.loading).toBe(false);
  });

  it('ignores an old report cursor rejection without replacing the new page state', async () => {
    let read!: ReturnType<typeof useTerminalUpdateReports>;
    const filters = {query: '', apk: '', js: '', runtime: '', storeRef: ''};
    function Probe({cursor}: {cursor?: string}) {
      read = useTerminalUpdateReports({queryContext: context('workspace-A'), projectRef, filters, cursor});
      return null;
    }

    await act(async () => {
      renderer = create(createElement(Probe, {cursor: undefined}));
      await flushMicrotasks();
    });
    await act(async () => {
      renderer?.update(createElement(Probe, {cursor: 'cursor-next'}));
      await flushMicrotasks();
    });
    expect(testState.requests).toHaveLength(2);

    await act(async () => {
      testState.requests[0]!.reject(new Error('stale report page failed'));
      await flushMicrotasks();
    });
    expect(read.items).toEqual([]);
    expect(read.problem).toBeUndefined();
    expect(read.loading).toBe(true);

    await act(async () => {
      testState.requests[1]!.resolve({items: [{terminalRef: terminalB}], nextCursor: null});
      await flushMicrotasks();
    });
    expect(read.items.map(item => item.terminalRef)).toEqual([terminalB]);
    expect(read.loading).toBe(false);
  });

  it('does not let an older rule detail success clear the newer entity loading state', async () => {
    let read!: ReturnType<typeof useTerminalUpdateRuleDetail>;
    function Probe() {
      read = useTerminalUpdateRuleDetail({queryContext: context('workspace-A'), projectRef});
      return null;
    }
    await act(async () => {
      renderer = create(createElement(Probe));
    });

    let openA!: Promise<unknown>;
    let openB!: Promise<unknown>;
    await act(async () => {
      openA = read.open(ruleA);
      openB = read.open(ruleB);
      await flushMicrotasks();
    });
    expect(testState.requests).toHaveLength(2);

    await act(async () => {
      testState.requests[0]!.resolve({ruleRef: ruleA, targetMode: 'ALL'});
      await flushMicrotasks();
    });
    expect(read.ruleRef).toBe(ruleB);
    expect(read.detail).toBeUndefined();
    expect(read.detailLoading).toBe(true);
    expect(read.problem).toBeUndefined();

    await act(async () => {
      testState.requests[1]!.resolve({ruleRef: ruleB, targetMode: 'ALL'});
      await flushMicrotasks();
    });
    await expect(openA).resolves.toBeUndefined();
    await expect(openB).resolves.toMatchObject({ruleRef: ruleB});
    expect(read.detail?.ruleRef).toBe(ruleB);
    expect(read.detailLoading).toBe(false);
  });

  it('ignores an older report detail rejection while the newer terminal and history load', async () => {
    let read!: ReturnType<typeof useTerminalUpdateReportDetail>;
    function Probe() {
      read = useTerminalUpdateReportDetail({queryContext: context('workspace-A'), projectRef});
      return null;
    }
    await act(async () => {
      renderer = create(createElement(Probe));
    });

    let openA!: Promise<unknown>;
    let openB!: Promise<unknown>;
    await act(async () => {
      openA = read.open(terminalA);
      openB = read.open(terminalB);
      await flushMicrotasks();
    });
    expect(testState.requests).toHaveLength(2);

    await act(async () => {
      testState.requests[0]!.reject(new Error('stale terminal detail failed'));
      await flushMicrotasks();
    });
    expect(read.terminalRef).toBe(terminalB);
    expect(read.detail).toBeUndefined();
    expect(read.detailLoading).toBe(true);
    expect(read.problem).toBeUndefined();

    await act(async () => {
      testState.requests[1]!.resolve({terminalRef: terminalB, hasReport: true});
      await flushMicrotasks();
    });
    expect(testState.requests[2]?.method).toBe('getOperationsProjectTerminalUpdateReportHistoryPage');
    await act(async () => {
      testState.requests[2]!.resolve({items: [], nextCursor: null});
      await flushMicrotasks();
    });
    await expect(openA).resolves.toBeUndefined();
    await expect(openB).resolves.toMatchObject({terminalRef: terminalB});
    expect(read.detail?.terminalRef).toBe(terminalB);
    expect(read.detailLoading).toBe(false);
    expect(read.problem).toBeUndefined();
  });

  it('does not return or apply a rule detail after its store page finishes following close', async () => {
    let read!: ReturnType<typeof useTerminalUpdateRuleDetail>;
    function Probe() {
      read = useTerminalUpdateRuleDetail({queryContext: context('workspace-A'), projectRef});
      return null;
    }

    await act(async () => {
      renderer = create(createElement(Probe));
    });
    let opening!: Promise<unknown>;
    await act(async () => {
      opening = read.open(ruleA);
    });
    await act(async () => {
      testState.requests[0]!.resolve({ruleRef: ruleA, targetMode: 'STORE_REFS'});
      await flushMicrotasks();
    });
    expect(testState.requests[1]?.method).toBe('getOperationsProjectTerminalUpdateRuleStorePage');
    expect(read.detail?.ruleRef).toBe(ruleA);
    expect(read.storesLoading).toBe(true);

    await act(async () => read.close());
    await act(async () => {
      testState.requests[1]!.resolve({items: [{storeRef: projectRef}], nextCursor: null});
      await flushMicrotasks();
    });

    await expect(opening).resolves.toBeUndefined();
    expect(read.ruleRef).toBeUndefined();
    expect(read.detail).toBeUndefined();
    expect(read.stores).toEqual([]);
    expect(read.storesLoading).toBe(false);
    expect(read.problem).toBeUndefined();
  });

  it('ignores a store page failure that arrives after the rule detail closes', async () => {
    let read!: ReturnType<typeof useTerminalUpdateRuleDetail>;
    function Probe() {
      read = useTerminalUpdateRuleDetail({queryContext: context('workspace-A'), projectRef});
      return null;
    }
    await act(async () => {
      renderer = create(createElement(Probe));
    });
    let opening!: Promise<unknown>;
    await act(async () => {
      opening = read.open(ruleA);
    });
    await act(async () => {
      testState.requests[0]!.resolve({ruleRef: ruleA, targetMode: 'STORE_REFS'});
      await flushMicrotasks();
    });
    await act(async () => read.close());
    await act(async () => {
      testState.requests[1]!.reject(new Error('stale store page failed'));
      await flushMicrotasks();
    });

    await expect(opening).resolves.toBeUndefined();
    expect(read.ruleRef).toBeUndefined();
    expect(read.stores).toEqual([]);
    expect(read.storesLoading).toBe(false);
    expect(read.problem).toBeUndefined();
  });

  it('keeps a report detail close authoritative when its history page rejects late', async () => {
    let read!: ReturnType<typeof useTerminalUpdateReportDetail>;
    function Probe() {
      read = useTerminalUpdateReportDetail({queryContext: context('workspace-A'), projectRef});
      return null;
    }

    await act(async () => {
      renderer = create(createElement(Probe));
    });
    let opening!: Promise<unknown>;
    await act(async () => {
      opening = read.open(terminalA);
    });
    await act(async () => {
      testState.requests[0]!.resolve({terminalRef: terminalA, hasReport: true});
      await flushMicrotasks();
    });
    expect(testState.requests[1]?.method).toBe('getOperationsProjectTerminalUpdateReportHistoryPage');
    expect(read.historyLoading).toBe(true);

    await act(async () => read.close());
    await act(async () => {
      testState.requests[1]!.reject(new Error('stale report history failed'));
      await flushMicrotasks();
    });

    await expect(opening).resolves.toBeUndefined();
    expect(read.terminalRef).toBeUndefined();
    expect(read.detail).toBeUndefined();
    expect(read.history).toEqual([]);
    expect(read.historyLoading).toBe(false);
    expect(read.problem).toBeUndefined();
  });

  it('keeps a report detail close authoritative when its history page succeeds late', async () => {
    let read!: ReturnType<typeof useTerminalUpdateReportDetail>;
    function Probe() {
      read = useTerminalUpdateReportDetail({queryContext: context('workspace-A'), projectRef});
      return null;
    }
    await act(async () => {
      renderer = create(createElement(Probe));
    });
    let opening!: Promise<unknown>;
    await act(async () => {
      opening = read.open(terminalA);
    });
    await act(async () => {
      testState.requests[0]!.resolve({terminalRef: terminalA, hasReport: true});
      await flushMicrotasks();
    });
    await act(async () => read.close());
    await act(async () => {
      testState.requests[1]!.resolve({items: [{reportId: '70000000-0000-4000-8000-000000000001'}], nextCursor: null});
      await flushMicrotasks();
    });

    await expect(opening).resolves.toBeUndefined();
    expect(read.terminalRef).toBeUndefined();
    expect(read.history).toEqual([]);
    expect(read.historyLoading).toBe(false);
    expect(read.problem).toBeUndefined();
  });
});
