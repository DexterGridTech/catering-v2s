import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const native = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  getStatus: vi.fn(),
  getDiagnosticsSnapshot: vi.fn(),
  sendFrame: vi.fn(),
  closePeer: vi.fn(),
  addListener: vi.fn(),
}));

vi.mock('expo-modules-core', () => ({requireNativeModule: () => native}));

describe('Android topology adapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    native.addListener.mockImplementation((_name: string, _listener: (event: unknown) => void) => ({remove: vi.fn()}));
    native.start.mockResolvedValue({
      status: 'succeeded',
      value: {
        host: '0.0.0.0',
        port: 43172,
        basePath: '/terminal-topology',
        httpBaseUrl: 'http://127.0.0.1:43172/terminal-topology',
        wsUrl: 'ws://127.0.0.1:43172/terminal-topology/ws',
        localHttpBaseUrl: 'http://127.0.0.1:43172/terminal-topology',
        localWsUrl: 'ws://127.0.0.1:43172/terminal-topology/ws',
      },
      completedAt: 1,
    });
    native.stop.mockResolvedValue({status: 'succeeded', value: {}, completedAt: 1});
    native.getStatus.mockResolvedValue({status: 'succeeded', value: {state: 'running', config: {}}, completedAt: 1});
    native.getDiagnosticsSnapshot.mockResolvedValue({status: 'succeeded', value: {status: {}, stats: {}}, completedAt: 1});
    native.sendFrame.mockResolvedValue({status: 'succeeded', value: {sent: true}, completedAt: 1});
    native.closePeer.mockResolvedValue({status: 'succeeded', value: {}, completedAt: 1});
  });

  it('forwards the host capability through the named native module', async () => {
    const {createAndroidTopologyHostPort} = await import('../src/implementations/nativeTopology');
    const port = createAndroidTopologyHostPort();
    const identity = {
      nodeId: 'node-1',
      moduleName: 'sample-terminal',
      displayName: 'TER test',
      instanceMode: 'MASTER',
      displayRole: 'CHIEF',
    } as const;

    await expect(port.start({
      port: 43172,
      basePath: '/terminal-topology',
      heartbeatIntervalMs: 10_000,
      heartbeatTimeoutMs: 30_000,
      timeoutMs: 1_000,
      identity,
    })).resolves.toMatchObject({status: 'succeeded', value: {port: 43172}});
    expect(native.start).toHaveBeenCalledWith(
      43172,
      '/terminal-topology',
      10_000,
      30_000,
      identity,
    );
  });

  it('reports peer WebSocket events and releases its native subscriptions', async () => {
    let socket: FakeWebSocket | undefined;
    class FakeWebSocket {
      readyState = 1;
      onopen: (() => void) | null = null;
      onmessage: ((event: Readonly<{data: unknown}>) => void) | null = null;
      onclose: ((event: Readonly<{code?: unknown; reason?: unknown}>) => void) | null = null;
      onerror: (() => void) | null = null;
      send = vi.fn();
      close = vi.fn();
      constructor(_url: string) {
        socket = this;
      }
    }
    const subscriptions = new Map<string, (event: unknown) => void>();
    native.addListener.mockImplementation((name: string, listener: (event: unknown) => void) => {
      subscriptions.set(name, listener);
      return {remove: vi.fn(() => subscriptions.delete(name))};
    });
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const {createAndroidTopologyPeerChannel} = await import('../src/implementations/nativeTopology');
    const channel = createAndroidTopologyPeerChannel();
    const events: Array<{type: string; raw?: string}> = [];
    channel.subscribe(event => events.push(event));
    await channel.connect('ws://127.0.0.1:43172/terminal-topology/ws');
    socket!.onopen?.();
    socket!.onmessage?.({data: '{"type":"ping"}'});
    expect(events).toEqual([
      expect.objectContaining({type: 'open'}),
      {type: 'message', raw: '{"type":"ping"}', connectionId: expect.any(String)},
    ]);
    await channel.send('reply');
    expect(socket!.send).toHaveBeenCalledExactlyOnceWith('reply');
    await channel.dispose();
    expect(socket!.close).toHaveBeenCalledOnce();
    expect(native.closePeer).toHaveBeenCalledWith('TOPOLOGY_HOST_STOPPED');
    expect(subscriptions.size).toBe(0);
  });
});
