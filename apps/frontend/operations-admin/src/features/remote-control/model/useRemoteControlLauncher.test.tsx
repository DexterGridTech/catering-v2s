// @vitest-environment jsdom
import {createElement} from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {wireUuid} from '../../../app/api/wireUuid';
import type {TerminalRemoteControlStartResponse} from '../../../app/api/generated/operations-edge';
import type {RemoteControlTarget} from '../ui/RemoteControlWorkspace';

type Request = {
  method: string;
  args: unknown[];
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

const testState = vi.hoisted(() => ({
  starts: [] as Request[],
  calls: [] as Array<{method: string; args: unknown[]}>,
}));

vi.mock('../../../app/api/OperationsTransport', () => ({
  operationsClient: new Proxy({}, {
    get: (_target, method) => (...args: unknown[]) => {
      testState.calls.push({method: String(method), args});
      if (method === 'startOperationsTerminalRemoteControl') {
        let resolve!: (value: unknown) => void;
        let reject!: (reason: unknown) => void;
        const promise = new Promise<unknown>((resolvePromise, rejectPromise) => {
          resolve = resolvePromise;
          reject = rejectPromise;
        });
        testState.starts.push({method: String(method), args, resolve, reject});
        return promise;
      }
      return Promise.resolve({});
    },
  }),
  operationsLogger: {debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn()},
  operationsProblemOf: (error: unknown) => ({detail: error instanceof Error ? error.message : String(error), errorCode: 'TEST'}),
}));

import {useRemoteControlLauncher} from './useRemoteControlLauncher';

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const projectRef = wireUuid('10000000-0000-4000-8000-000000000001');
const terminalRef = wireUuid('30000000-0000-4000-8000-000000000001');

function target(contextKey: string, selectedTerminalRef = terminalRef): RemoteControlTarget {
  return {
    groupWorkspaceKey: 'aurora',
    projectRef,
    terminalRef: selectedTerminalRef,
    terminalName: 'Front register',
    storeName: 'Riverside',
    expectedContextVersion: 4,
    contextKey,
  };
}

function startResponse(sessionId: string): TerminalRemoteControlStartResponse {
  return {sessionId, state: 'STARTING'} as TerminalRemoteControlStartResponse;
}

function flushMicrotasks() {
  return Promise.resolve().then(() => Promise.resolve());
}

let renderer: ReactTestRenderer | undefined;

beforeEach(() => {
  testState.starts.length = 0;
  testState.calls.length = 0;
});

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer?.unmount());
    renderer = undefined;
  }
});

describe('useRemoteControlLauncher', () => {
  it('releases the start lock after the current start rejects', async () => {
    let launcher!: ReturnType<typeof useRemoteControlLauncher>;
    function Probe() {
      launcher = useRemoteControlLauncher('context-A');
      return null;
    }
    await act(async () => {
      renderer = create(createElement(Probe));
    });

    let starting!: Promise<unknown>;
    await act(async () => {
      starting = launcher.start(target('context-A'), () => true);
    });
    const rejection = expect(starting).rejects.toThrow('start rejected');
    await act(async () => {
      testState.starts[0]!.reject(new Error('start rejected'));
      await flushMicrotasks();
    });
    await rejection;

    expect(launcher.currentSession).toBeUndefined();
    expect(launcher.isStarting).toBe(false);
    let retry!: Promise<unknown>;
    await act(async () => {
      retry = launcher.start(target('context-A'), () => true);
    });
    expect(testState.starts).toHaveLength(2);
    await act(async () => {
      testState.starts[1]!.resolve(startResponse('50000000-0000-4000-8000-000000000003'));
      await flushMicrotasks();
    });
    await expect(retry).resolves.toMatchObject({start: {sessionId: '50000000-0000-4000-8000-000000000003'}});
  });

  it('ends only a start response made stale by a context switch', async () => {
    let launcher!: ReturnType<typeof useRemoteControlLauncher>;
    function Probe({contextKey}: {contextKey: string}) {
      launcher = useRemoteControlLauncher(contextKey);
      return null;
    }

    await act(async () => {
      renderer = create(createElement(Probe, {contextKey: 'context-A'}));
    });
    let starting!: Promise<unknown>;
    await act(async () => {
      starting = launcher.start(target('context-A'), () => true);
    });
    expect(launcher.isStarting).toBe(true);
    expect(testState.starts).toHaveLength(1);

    await act(async () => {
      renderer?.update(createElement(Probe, {contextKey: 'context-B'}));
      await flushMicrotasks();
    });
    expect(launcher.isStarting).toBe(false);

    await act(async () => {
      testState.starts[0]!.resolve(startResponse('50000000-0000-4000-8000-000000000001'));
      await flushMicrotasks();
    });
    await expect(starting).resolves.toBeUndefined();
    expect(launcher.currentSession).toBeUndefined();
    expect(testState.calls.filter(call => call.method === 'endOperationsTerminalRemoteControl')).toHaveLength(1);
    expect(testState.calls.at(-1)?.args[0]).toMatchObject({
      groupWorkspaceKey: 'aurora',
      projectRef,
      terminalRef,
      sessionId: '50000000-0000-4000-8000-000000000001',
    });
  });

  it('ends a start response when the selected terminal changes in the same page context', async () => {
    let launcher!: ReturnType<typeof useRemoteControlLauncher>;
    let selectedTerminal = terminalRef;
    function Probe() {
      launcher = useRemoteControlLauncher('context-A');
      return null;
    }
    await act(async () => {
      renderer = create(createElement(Probe));
    });

    let starting!: Promise<unknown>;
    await act(async () => {
      starting = launcher.start(target('context-A', terminalRef), () => selectedTerminal === terminalRef);
    });
    selectedTerminal = wireUuid('30000000-0000-4000-8000-000000000002');
    await act(async () => {
      testState.starts[0]!.resolve(startResponse('50000000-0000-4000-8000-000000000005'));
      await flushMicrotasks();
    });

    await expect(starting).resolves.toBeUndefined();
    expect(launcher.currentSession).toBeUndefined();
    expect(testState.calls.filter(call => call.method === 'endOperationsTerminalRemoteControl')).toHaveLength(1);
    expect(testState.calls.at(-1)?.args[0]).toMatchObject({terminalRef, sessionId: '50000000-0000-4000-8000-000000000005'});
  });

  it('ends a start response that arrives after the launcher owner unmounts', async () => {
    let launcher!: ReturnType<typeof useRemoteControlLauncher>;
    function Probe() {
      launcher = useRemoteControlLauncher('context-A');
      return null;
    }
    await act(async () => {
      renderer = create(createElement(Probe));
    });
    let starting!: Promise<unknown>;
    await act(async () => {
      starting = launcher.start(target('context-A'), () => true);
    });

    await act(async () => {
      renderer?.unmount();
      renderer = undefined;
    });
    await act(async () => {
      testState.starts[0]!.resolve(startResponse('50000000-0000-4000-8000-000000000004'));
      await flushMicrotasks();
    });

    await expect(starting).resolves.toBeUndefined();
    expect(testState.calls.filter(call => call.method === 'endOperationsTerminalRemoteControl')).toHaveLength(1);
  });

  it('ends the active session when its context changes', async () => {
    let launcher!: ReturnType<typeof useRemoteControlLauncher>;
    function Probe({contextKey}: {contextKey: string}) {
      launcher = useRemoteControlLauncher(contextKey);
      return null;
    }
    await act(async () => {
      renderer = create(createElement(Probe, {contextKey: 'context-A'}));
    });
    let starting!: Promise<unknown>;
    await act(async () => {
      starting = launcher.start(target('context-A'), () => true);
      testState.starts[0]!.resolve(startResponse('50000000-0000-4000-8000-000000000006'));
      await flushMicrotasks();
    });
    await expect(starting).resolves.toMatchObject({start: {sessionId: '50000000-0000-4000-8000-000000000006'}});

    await act(async () => {
      renderer?.update(createElement(Probe, {contextKey: 'context-B'}));
      await flushMicrotasks();
    });

    expect(launcher.currentSession).toBeUndefined();
    const endings = testState.calls.filter(call => call.method === 'endOperationsTerminalRemoteControl');
    expect(endings).toHaveLength(1);
    expect(endings[0]?.args[0]).toMatchObject({sessionId: '50000000-0000-4000-8000-000000000006'});
    expect(endings[0]?.args[1]).toMatchObject({body: {reason: 'WORKSPACE_CLOSED'}});
  });

  it('ends the active session once when its launcher unmounts', async () => {
    let launcher!: ReturnType<typeof useRemoteControlLauncher>;
    function Probe() {
      launcher = useRemoteControlLauncher('context-A');
      return null;
    }
    await act(async () => {
      renderer = create(createElement(Probe));
    });
    let starting!: Promise<unknown>;
    await act(async () => {
      starting = launcher.start(target('context-A'), () => true);
      testState.starts[0]!.resolve(startResponse('50000000-0000-4000-8000-000000000007'));
      await flushMicrotasks();
    });
    await expect(starting).resolves.toMatchObject({start: {sessionId: '50000000-0000-4000-8000-000000000007'}});

    await act(async () => {
      renderer?.unmount();
      renderer = undefined;
      await flushMicrotasks();
    });

    const endings = testState.calls.filter(call => call.method === 'endOperationsTerminalRemoteControl');
    expect(endings).toHaveLength(1);
    expect(endings[0]?.args[0]).toMatchObject({sessionId: '50000000-0000-4000-8000-000000000007'});
  });

  it('does not end a session again after the owning page clears it', async () => {
    let launcher!: ReturnType<typeof useRemoteControlLauncher>;
    function Probe() {
      launcher = useRemoteControlLauncher('context-A');
      return null;
    }
    await act(async () => {
      renderer = create(createElement(Probe));
    });
    let starting!: Promise<unknown>;
    await act(async () => {
      starting = launcher.start(target('context-A'), () => true);
      testState.starts[0]!.resolve(startResponse('50000000-0000-4000-8000-000000000008'));
      await flushMicrotasks();
    });
    await expect(starting).resolves.toMatchObject({start: {sessionId: '50000000-0000-4000-8000-000000000008'}});
    await act(async () => launcher.clear('50000000-0000-4000-8000-000000000008'));
    await act(async () => {
      renderer?.unmount();
      renderer = undefined;
      await flushMicrotasks();
    });

    expect(testState.calls.filter(call => call.method === 'endOperationsTerminalRemoteControl')).toHaveLength(0);
  });

  it('keeps B when a stale A clear arrives after B became current', async () => {
    let launcher!: ReturnType<typeof useRemoteControlLauncher>;
    function Probe() {
      launcher = useRemoteControlLauncher('context-A');
      return null;
    }
    await act(async () => {
      renderer = create(createElement(Probe));
    });

    let startA!: Promise<unknown>;
    await act(async () => {
      startA = launcher.start(target('context-A'), () => true);
    });
    await act(async () => {
      testState.starts[0]!.resolve(startResponse('50000000-0000-4000-8000-000000000001'));
      await flushMicrotasks();
    });
    await expect(startA).resolves.toMatchObject({start: {sessionId: '50000000-0000-4000-8000-000000000001'}});

    let startB!: Promise<unknown>;
    await act(async () => {
      startB = launcher.restart(target('context-A'));
    });
    await act(async () => {
      testState.starts[1]!.resolve(startResponse('50000000-0000-4000-8000-000000000002'));
      await flushMicrotasks();
    });
    await expect(startB).resolves.toMatchObject({start: {sessionId: '50000000-0000-4000-8000-000000000002'}});

    await act(async () => launcher.clear('50000000-0000-4000-8000-000000000001'));
    expect(launcher.currentSession?.start.sessionId).toBe('50000000-0000-4000-8000-000000000002');
  });

  it('ends a restart result that arrives after its workspace was closed', async () => {
    let launcher!: ReturnType<typeof useRemoteControlLauncher>;
    function Probe() {
      launcher = useRemoteControlLauncher('context-A');
      return null;
    }
    await act(async () => {
      renderer = create(createElement(Probe));
    });

    let firstStart!: Promise<unknown>;
    await act(async () => {
      firstStart = launcher.start(target('context-A'), () => true);
      testState.starts[0]!.resolve(startResponse('50000000-0000-4000-8000-000000000011'));
      await flushMicrotasks();
    });
    await expect(firstStart).resolves.toMatchObject({
      start: {sessionId: '50000000-0000-4000-8000-000000000011'},
    });

    let restart!: Promise<unknown>;
    await act(async () => {
      restart = launcher.restart(target('context-A'));
    });
    expect(launcher.isStarting).toBe(true);

    await act(async () => {
      launcher.cancelRestart('50000000-0000-4000-8000-000000000011');
      launcher.clear('50000000-0000-4000-8000-000000000011');
    });
    expect(launcher.isStarting).toBe(false);

    await act(async () => {
      testState.starts[1]!.resolve(startResponse('50000000-0000-4000-8000-000000000012'));
      await flushMicrotasks();
    });

    await expect(restart).resolves.toBeUndefined();
    expect(launcher.currentSession).toBeUndefined();
    expect(testState.calls.filter(call => call.method === 'endOperationsTerminalRemoteControl')).toHaveLength(1);
    expect(testState.calls.at(-1)?.args[0]).toMatchObject({
      sessionId: '50000000-0000-4000-8000-000000000012',
    });
  });
});
