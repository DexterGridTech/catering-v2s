import {beforeEach, describe, expect, it, vi} from 'vitest';

const {registerGlobalsMock, connectMock, nativeModuleMock, rooms, nativeListeners, readWindowMock, mediaTracks} = vi.hoisted(() => ({
  registerGlobalsMock: vi.fn(),
  connectMock: vi.fn(),
  nativeModuleMock: {
    createWindowVideoTrack: vi.fn(),
    dispatchWindowTouch: vi.fn(),
    cancelWindowTouch: vi.fn(),
    addListener: vi.fn((name: string, listener: (event: never) => void) => {
      nativeListeners.set(name, listener);
      return {remove: vi.fn(() => nativeListeners.delete(name))};
    }),
  },
  nativeListeners: new Map<string, (event: never) => void>(),
  readWindowMock: vi.fn(),
  mediaTracks: [] as Array<{released: boolean}>,
  rooms: [] as Array<{
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    localParticipant: {
      publishTrack: ReturnType<typeof vi.fn>;
      publishData: ReturnType<typeof vi.fn>;
      unpublishTrack: ReturnType<typeof vi.fn>;
    };
    state: string;
  }>,
}));

vi.mock('expo-modules-core', () => ({requireNativeModule: () => nativeModuleMock}));
vi.mock('@catering-v2s/adapter-android-dual-screen', () => ({readAndroidSurfaceHostWindow: readWindowMock}));
vi.mock('@livekit/react-native', () => ({registerGlobals: registerGlobalsMock}));
vi.mock('@livekit/react-native-webrtc', () => ({
  MediaStreamTrack: class MediaStreamTrack {
    released = false;
    constructor(_info: unknown) { mediaTracks.push(this); }
    release() { this.released = true; }
    getSettings() { return {width: 1280, height: 800}; }
  },
}));
vi.mock('livekit-client', () => ({
  LocalVideoTrack: class LocalVideoTrack {
    stopped = false;
    constructor(_track: unknown, _constraints: unknown, _userProvidedTrack: boolean) {}
    stop() { this.stopped = true; }
  },
  Room: class Room {
    state = 'disconnected';
    localParticipant = {
      publishTrack: vi.fn(),
      publishData: vi.fn(),
      unpublishTrack: vi.fn(),
    };
    on = vi.fn();
    off = vi.fn();
    disconnect = vi.fn(async () => undefined);

    constructor() {
      rooms.push(this);
    }

    connect = connectMock;
  },
  RoomEvent: {
    Connected: 'connected',
    Reconnecting: 'reconnecting',
    Disconnected: 'disconnected',
    ParticipantDisconnected: 'participant-disconnected',
    DataReceived: 'data-received',
  },
  Track: {Source: {ScreenShare: 'screen-share'}},
}));

const sessionInput = (signalUrl: string) => ({
  signalUrl,
  sessionId: 'session-1',
  roomName: 'room-1',
  participantIdentity: 'terminal-1',
  token: 'test-token',
  localScreens: [{screen: 'main' as const, surfaceKey: 'PRIMARY' as const, windowIdentity: 'window-1', generation: 1}],
});

describe('Android RemoteControlPort', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    nativeModuleMock.addListener.mockImplementation((name, listener) => {
      nativeListeners.set(name, listener);
      return {remove: vi.fn(() => nativeListeners.delete(name))};
    });
    rooms.length = 0;
    nativeListeners.clear();
    mediaTracks.length = 0;
    readWindowMock.mockReset();
  });

  it('describes each implemented capability as a real adapter binding', async () => {
    const {createAndroidRemoteControlPort} = await import('../src/createAndroidRemoteControlPort');
    const port = createAndroidRemoteControlPort({});
    const descriptor = Reflect.get(port, Symbol.for('catering-v2s.platform-ports.descriptor')) as {
      port: string;
      capabilities: Array<{capability: string; state: string; source: string}>;
    };

    expect(Object.isFrozen(port)).toBe(true);
    expect(descriptor.port).toBe('remoteControl');
    expect(descriptor.capabilities).toEqual([
      {capability: 'subscribeEvents', state: 'real', source: 'adapter'},
      {capability: 'readLocalScreens', state: 'real', source: 'adapter'},
      {capability: 'begin', state: 'real', source: 'adapter'},
      {capability: 'sendData', state: 'real', source: 'adapter'},
      {capability: 'dispatchPointer', state: 'real', source: 'adapter'},
      {capability: 'end', state: 'real', source: 'adapter'},
    ]);
  });

  it.each([
    'ws://47.106.121.27:7880',
    'wss://livekit.example.test',
    'http://47.106.121.27:7880',
    'https://livekit.example.test',
  ])('passes the configured LiveKit endpoint to the SDK unchanged (%s)', async signalUrl => {
    connectMock.mockRejectedValueOnce(new Error('mock connection stop'));
    const {createAndroidRemoteControlPort} = await import('../src/createAndroidRemoteControlPort');
    const port = createAndroidRemoteControlPort({});

    const result = await port.begin(sessionInput(signalUrl));

    expect(result).toMatchObject({status: 'failed', error: {code: 'REMOTE_CONTROL_BEGIN_FAILED'}});
    expect(registerGlobalsMock).toHaveBeenCalledTimes(1);
    expect(connectMock).toHaveBeenCalledWith(signalUrl, 'test-token');
    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.disconnect).toHaveBeenCalledTimes(1);
  });

  it('releases the old window track and publishes a new generation after a geometry change', async () => {
    nativeModuleMock.createWindowVideoTrack.mockResolvedValue({
      id: 'native-track', kind: 'video', remote: false, constraints: {}, enabled: true,
      settings: {}, peerConnectionId: 1, readyState: 'live',
    });
    nativeModuleMock.cancelWindowTouch.mockResolvedValue('no-active-gesture');
    rooms.length = 0;
    const {createAndroidRemoteControlPort} = await import('../src/createAndroidRemoteControlPort');
    const port = createAndroidRemoteControlPort({});
    const events: Array<{type: string; generation?: number}> = [];
    port.subscribeEvents(event => events.push(event));

    await expect(port.begin(sessionInput('ws://47.106.121.27:7880'))).resolves.toMatchObject({status: 'succeeded'});
    const room = rooms[0]!;
    room.state = 'connected';
    const connected = room.on.mock.calls.find(([name]) => name === 'connected')?.[1] as (() => void) | undefined;
    connected?.();
    const windowChanged = nativeListeners.get('onWindowHostChanged');
    expect(windowChanged).toBeTypeOf('function');
    readWindowMock.mockResolvedValueOnce({surfaceKey: 'PRIMARY', windowIdentity: 'primary', generation: 2});
    windowChanged?.({
      available: true, surfaceKey: 'PRIMARY', windowIdentity: 'primary', generation: 2,
      displayId: 0, widthPx: 2560, heightPx: 1600, reason: null,
    } as never);

    await vi.waitFor(() => expect(nativeModuleMock.createWindowVideoTrack).toHaveBeenCalledTimes(2));
    expect(nativeModuleMock.createWindowVideoTrack).toHaveBeenNthCalledWith(2, 'PRIMARY', 'primary', 2, expect.any(String));
    expect(mediaTracks[0]?.released).toBe(true);
    expect(events).toContainEqual(expect.objectContaining({type: 'geometry-changed', generation: 2}));
    await expect(port.end({sessionId: 'session-1'})).resolves.toMatchObject({status: 'succeeded'});
  });

  it('catches up to the newest geometry when another window generation arrives during recapture', async () => {
    const nativeTrack = {
      id: 'native-track', kind: 'video', remote: false, constraints: {}, enabled: true,
      settings: {}, peerConnectionId: 1, readyState: 'live',
    };
    let finishSecondCapture!: (value: typeof nativeTrack) => void;
    const secondCapture = new Promise<typeof nativeTrack>(resolve => { finishSecondCapture = resolve; });
    nativeModuleMock.createWindowVideoTrack
      .mockResolvedValueOnce(nativeTrack)
      .mockImplementationOnce(() => secondCapture)
      .mockResolvedValueOnce(nativeTrack);
    nativeModuleMock.cancelWindowTouch.mockResolvedValue('no-active-gesture');
    const {createAndroidRemoteControlPort} = await import('../src/createAndroidRemoteControlPort');
    const port = createAndroidRemoteControlPort({});
    await expect(port.begin(sessionInput('ws://47.106.121.27:7880'))).resolves.toMatchObject({status: 'succeeded'});

    const windowChanged = nativeListeners.get('onWindowHostChanged');
    readWindowMock.mockResolvedValueOnce({surfaceKey: 'PRIMARY', windowIdentity: 'primary', generation: 2})
      .mockResolvedValueOnce({surfaceKey: 'PRIMARY', windowIdentity: 'primary', generation: 3});
    windowChanged?.({
      available: true, surfaceKey: 'PRIMARY', windowIdentity: 'primary', generation: 2,
      displayId: 0, widthPx: 2560, heightPx: 1600, reason: null,
    } as never);
    await vi.waitFor(() => expect(nativeModuleMock.createWindowVideoTrack).toHaveBeenCalledTimes(2));

    windowChanged?.({
      available: true, surfaceKey: 'PRIMARY', windowIdentity: 'primary', generation: 3,
      displayId: 0, widthPx: 2560, heightPx: 1600, reason: null,
    } as never);
    finishSecondCapture(nativeTrack);

    await vi.waitFor(() => expect(nativeModuleMock.createWindowVideoTrack).toHaveBeenCalledTimes(3));
    expect(nativeModuleMock.createWindowVideoTrack).toHaveBeenNthCalledWith(3, 'PRIMARY', 'primary', 3, expect.any(String));
    expect(mediaTracks.slice(0, 2).every(track => track.released)).toBe(true);
    await expect(port.end({sessionId: 'session-1'})).resolves.toMatchObject({status: 'succeeded'});
  });
});
