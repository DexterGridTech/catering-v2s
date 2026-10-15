// @vitest-environment jsdom
import {createElement, type ReactNode} from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {RemoteControlTarget} from './RemoteControlWorkspace';
import {RemoteControlWorkspace} from './RemoteControlWorkspace';

type Deferred = {resolve: () => void; reject: (reason: unknown) => void};
type RoomLike = {
  listeners: Map<string, Set<(...args: unknown[]) => void>>;
  resolveConnect?: () => void;
  disconnectCalls: number;
  removedAll: number;
  resolveDisconnect?: () => void;
  rejectDisconnect?: (reason: unknown) => void;
  emit: (event: string, ...args: unknown[]) => void;
};
type InspectableRenderer = ReactTestRenderer & {toJSON: () => unknown};

const testState = vi.hoisted(() => ({
  rooms: [] as RoomLike[],
  endRequests: [] as Deferred[],
  publishedMessages: [] as Array<{room: RoomLike; payload: Uint8Array}>,
  endButtonLoading: false,
  closeButtonClick: undefined as (() => void) | undefined,
}));

vi.mock('antd', () => {
  const passthrough = ({children}: {children?: unknown}) => children ?? null;
  return {
    Alert: passthrough,
    Button: ({children, loading, ...props}: {children?: unknown; loading?: boolean; [key: string]: unknown}) => {
      if (props['data-testid'] === 'operations-remote-control-end') testState.endButtonLoading = Boolean(loading);
      if (props['data-testid'] === 'operations-remote-control-close') {
        testState.closeButtonClick = typeof props.onClick === 'function' ? props.onClick as () => void : undefined;
      }
      return children ?? null;
    },
    Modal: ({children, title}: {children?: ReactNode; title?: ReactNode}) => createElement('div', null, title, children),
    Space: passthrough,
    Typography: {Text: passthrough},
  };
});

vi.mock('livekit-client', () => {
  const roomEvent = {
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    DataReceived: 'dataReceived',
    Disconnected: 'disconnected',
  } as const;
  class TestRoom {
    listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    resolveConnect?: () => void;
    disconnectCalls = 0;
    removedAll = 0;
    resolveDisconnect?: () => void;
    rejectDisconnect?: (reason: unknown) => void;
    localParticipant = {publishData: (payload: Uint8Array) => {
      testState.publishedMessages.push({room: this, payload});
      return Promise.resolve();
    }};
    on(event: string, handler: (...args: unknown[]) => void) {
      const handlers = this.listeners.get(event) ?? new Set();
      handlers.add(handler);
      this.listeners.set(event, handlers);
      return this;
    }
    off(event: string, handler: (...args: unknown[]) => void) {
      this.listeners.get(event)?.delete(handler);
      return this;
    }
    emit(event: string, ...args: unknown[]) {
      for (const handler of this.listeners.get(event) ?? []) handler(...args);
    }
    connect() {
      return new Promise<void>(resolve => {
        this.resolveConnect = resolve;
      });
    }
    disconnect() {
      this.disconnectCalls += 1;
      return new Promise<void>((resolve, reject) => {
        this.resolveDisconnect = resolve;
        this.rejectDisconnect = reject;
      });
    }
    removeAllListeners() {
      this.removedAll += 1;
      this.listeners.clear();
    }
  }
  return {
    Room: class extends TestRoom {
      constructor() {
        super();
        testState.rooms.push(this);
      }
    },
    RoomEvent: roomEvent,
    Track: {Kind: {Video: 'video'}},
  };
});

vi.mock('../../../app/api/OperationsTransport', () => ({
  operationsClient: new Proxy({}, {
    get: (_target, method) => (..._args: unknown[]) => {
      if (method === 'issueOperationsRemoteControlGrant') {
        return Promise.resolve({
          url: 'ws://livekit.test',
          token: 'test-token',
          description: {
            sessionId: '50000000-0000-4000-8000-000000000001',
            topologyKind: 'SINGLE_DEVICE',
            endpoints: [{endpointId: '60000000-0000-4000-8000-000000000001', participantIdentity: 'screen-main'}],
            screens: [{screen: 'main', endpointId: '60000000-0000-4000-8000-000000000001'}],
          },
        });
      }
      if (method === 'endOperationsTerminalRemoteControl') {
        return new Promise<unknown>((resolve, reject) => testState.endRequests.push({resolve: () => resolve({}), reject}));
      }
      return Promise.resolve({});
    },
  }),
  operationsLogger: {debug: () => undefined, error: () => undefined, info: () => undefined, warn: () => undefined},
  operationsProblemOf: (error: unknown) => ({detail: error instanceof Error ? error.message : String(error), errorCode: 'TEST', status: 500}),
}));

import {remoteControlTopic} from '../../../app/api/generated/terminalRemoteControlProtocol';

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const target: RemoteControlTarget = {
  groupWorkspaceKey: 'aurora',
  projectRef: '10000000-0000-4000-8000-000000000001',
  terminalRef: '30000000-0000-4000-8000-000000000001',
  terminalName: 'Front register',
  storeName: 'Riverside',
  expectedContextVersion: 1,
  contextKey: 'context-A',
};
const endpointId = '60000000-0000-4000-8000-000000000001';
const streamId = '70000000-0000-4000-8000-000000000001';

function start(sessionId: string) {
  return {
    sessionId,
    state: 'STARTING',
    deadlineAtEpochMillis: Date.now() + 60_000,
    description: {
      sessionId,
      topologyKind: 'SINGLE_DEVICE',
      endpoints: [{endpointId, participantIdentity: 'screen-main'}],
      screens: [{screen: 'main', endpointId}],
    },
  } as never;
}

async function flushMicrotasks() {
  for (let count = 0; count < 8; count += 1) await Promise.resolve();
}

async function runLateACompletion(outcome: 'disconnect-resolves' | 'disconnect-rejects') {
  const onClose = vi.fn();
  const onCloseRequested = vi.fn();
  const props = {
    target,
    currentStart: start('50000000-0000-4000-8000-000000000001'),
    contextCurrent: true,
    onRestart: async () => undefined,
    onCloseRequested,
    onClose,
  };
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = create(createElement(RemoteControlWorkspace, props), {
      createNodeMock: element => element.type === 'video' ? {
        videoWidth: 1080,
        videoHeight: 1920,
        readyState: 4,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      } : null,
    });
    await flushMicrotasks();
  });
  const roomA = testState.rooms[0]!;
  expect(roomA.disconnectCalls).toBe(0);

  await act(async () => {
    roomA.emit('disconnected');
    await flushMicrotasks();
  });
  expect(testState.endRequests).toHaveLength(1);
  expect(roomA.disconnectCalls).toBe(1);

  await act(async () => {
    renderer?.update(createElement(RemoteControlWorkspace, {
      ...props,
      currentStart: start('50000000-0000-4000-8000-000000000002'),
    }));
    await flushMicrotasks();
  });
  const roomB = testState.rooms[1]!;
  expect(roomB).toBeDefined();
  expect([...roomA.listeners.values()].every(handlers => handlers.size === 0)).toBe(true);
  expect(roomB.listeners.get('trackSubscribed')?.size).toBe(1);

  await act(async () => {
    roomB.resolveConnect?.();
    await flushMicrotasks();
  });

  const track = {
    kind: 'video',
    sid: 'track-B',
    attach: () => undefined,
    detach: () => undefined,
  };
  await act(async () => {
    roomB.emit('trackSubscribed', track, {}, {identity: 'screen-main'});
    roomB.emit(
      'dataReceived',
      new TextEncoder().encode(JSON.stringify({
        v: 1,
        type: 'SCREEN_READY',
        sessionId: '50000000-0000-4000-8000-000000000002',
        seq: 1,
        body: {endpointId, screen: 'main', streamId, trackSid: 'track-B', widthPx: 1080, heightPx: 1920},
      })),
      {identity: 'screen-main'},
      undefined,
      remoteControlTopic,
    );
    const keepalive = testState.publishedMessages
      .filter(message => message.room === roomB)
      .map(message => JSON.parse(new TextDecoder().decode(message.payload)) as {type?: string; body?: {probeId?: string}})
      .find(message => message.type === 'KEEPALIVE');
    expect(keepalive?.body?.probeId).toBeDefined();
    roomB.emit(
      'dataReceived',
      new TextEncoder().encode(JSON.stringify({
        v: 1,
        type: 'KEEPALIVE_ACK',
        sessionId: '50000000-0000-4000-8000-000000000002',
        seq: 2,
        body: {probeId: keepalive?.body?.probeId},
      })),
      {identity: 'screen-main'},
      undefined,
      remoteControlTopic,
    );
    await flushMicrotasks();
  });
  expect(JSON.stringify((renderer as InspectableRenderer | undefined)?.toJSON())).toContain('remote-control-video-active');

  await act(async () => {
    testState.endRequests[0]!.reject(new Error('end A rejected'));
    await flushMicrotasks();
  });

  expect(roomA.removedAll).toBe(0);
  expect(JSON.stringify((renderer as InspectableRenderer | undefined)?.toJSON())).toContain('remote-control-video-active');
  expect(testState.endButtonLoading).toBe(false);

  await act(async () => {
    if (outcome === 'disconnect-rejects') roomA.rejectDisconnect?.(new Error('disconnect A rejected'));
    else roomA.resolveDisconnect?.();
    await flushMicrotasks();
  });

  const rendered = JSON.stringify((renderer as InspectableRenderer | undefined)?.toJSON());
  expect(onClose).not.toHaveBeenCalled();
  expect(rendered).toContain('remote-control-video-active');
  expect(rendered).not.toContain('remote-control-connecting');
  expect(rendered).not.toContain('remote-control-ended');
  expect(testState.endButtonLoading).toBe(false);
  expect(roomA.disconnectCalls).toBe(1);
  expect(roomA.removedAll).toBe(1);
  expect(roomB.disconnectCalls).toBe(0);

  await act(async () => {
    renderer?.unmount();
    roomB.resolveDisconnect?.();
    await flushMicrotasks();
  });
  renderer = undefined;
}

beforeEach(() => {
  testState.rooms.length = 0;
  testState.endRequests.length = 0;
  testState.publishedMessages.length = 0;
  testState.endButtonLoading = false;
  testState.closeButtonClick = undefined;
});

afterEach(() => {
  for (const room of testState.rooms) room.resolveDisconnect?.();
});

describe('RemoteControlWorkspace session ownership', () => {
  it('keeps B usable when A end rejects before its disconnect completes', async () => {
    await runLateACompletion('disconnect-resolves');
  });

  it('keeps B usable when A end and later disconnect both reject', async () => {
    await runLateACompletion('disconnect-rejects');
  });

  it('closes after the session has ended and shows a completed Room cleanup failure', async () => {
    const onClose = vi.fn();
    const onCloseRequested = vi.fn();
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(RemoteControlWorkspace, {
        target,
        currentStart: start('50000000-0000-4000-8000-000000000001'),
        contextCurrent: true,
        onRestart: async () => undefined,
        onCloseRequested,
        onClose,
      }), {
        createNodeMock: element => element.type === 'video' ? {
          videoWidth: 1080,
          videoHeight: 1920,
          readyState: 4,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        } : null,
      });
      await flushMicrotasks();
    });
    const room = testState.rooms[0]!;

    await act(async () => {
      room.emit('disconnected');
      await flushMicrotasks();
    });
    expect(testState.endRequests).toHaveLength(1);
    expect(room.disconnectCalls).toBe(1);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      testState.endRequests[0]!.resolve();
      room.rejectDisconnect?.(new Error('Room cleanup failed'));
      await flushMicrotasks();
    });
    expect(JSON.stringify((renderer as InspectableRenderer | undefined)?.toJSON()))
      .toContain('远程控制已结束，资源释放失败');
    expect(onClose).not.toHaveBeenCalled();
    expect(testState.closeButtonClick).toBeDefined();

    await act(async () => {
      testState.closeButtonClick?.();
      expect(onCloseRequested).toHaveBeenCalledWith('50000000-0000-4000-8000-000000000001');
      await flushMicrotasks();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith('50000000-0000-4000-8000-000000000001', {
      endFailed: false,
      cleanupFailed: true,
    });

    await act(async () => {
      testState.closeButtonClick?.();
      renderer?.unmount();
      await flushMicrotasks();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
