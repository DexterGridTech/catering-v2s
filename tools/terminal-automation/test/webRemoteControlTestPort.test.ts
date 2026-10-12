import {afterEach, describe, expect, it, vi} from 'vitest';

vi.mock('livekit-client', () => ({
  RoomEvent: {DataReceived: 'data-received', Disconnected: 'disconnected'},
  Track: {Source: {ScreenShare: 'screen-share'}},
  Room: class {
    localParticipant = {
      publishTrack: async () => ({trackSid: 'TR_WEB_TEST'}),
      publishData: async () => undefined,
    };
    connect = async () => undefined;
    disconnect = async () => undefined;
    on = () => this;
    off = () => this;
  },
}));

import {createWebRemoteControlTestPort} from '../src/fixtures/createWebRemoteControlTestPort.js';

class FakeHTMLElement {
  getBoundingClientRect() {
    return {left: 0, top: 0, width: 640, height: 480, right: 640, bottom: 480, x: 0, y: 0, toJSON: () => ({})};
  }
}

describe('Web remote-control test port', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('records a safe diagnostic when the primary surface is missing', async () => {
    vi.stubGlobal('HTMLElement', FakeHTMLElement);
    vi.stubGlobal('CSS', {escape: (value: string) => value});
    vi.stubGlobal('document', {querySelector: () => null});
    const traces: Array<{event: string; fields: Readonly<Record<string, unknown>>}> = [];
    const port = createWebRemoteControlTestPort({
      runId: 'remote-run-2',
      primarySurfaceTestId: 'terminal-primary',
      trace: (event, fields) => traces.push({event, fields}),
    });

    const result = await port.readLocalScreens([{screen: 'main', surfaceKey: 'PRIMARY'}]);

    expect(result).toMatchObject({status: 'failed', error: {code: 'WEB_REMOTE_CONTROL_SURFACE_UNAVAILABLE'}});
    expect(traces).toEqual([
      expect.objectContaining({
        event: 'surface.unavailable',
        fields: expect.objectContaining({requestedScreenCount: 1, expectedPrimaryMapping: true, surfaceFound: false}),
      }),
    ]);
  });

  it('announces a protocol-valid UUID stream identity', async () => {
    const surface = new FakeHTMLElement();
    const context = {fillStyle: '', font: '', fillRect: () => undefined, fillText: () => undefined};
    const mediaTrack = {stop: () => undefined, readyState: 'live'};
    const stream = {getVideoTracks: () => [mediaTrack], getTracks: () => [mediaTrack]};
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
      captureStream: () => stream,
    };
    vi.stubGlobal('HTMLElement', FakeHTMLElement);
    vi.stubGlobal('CSS', {escape: (value: string) => value});
    vi.stubGlobal('document', {
      querySelector: () => surface,
      createElement: () => canvas,
      elementFromPoint: () => surface,
    });

    const port = createWebRemoteControlTestPort({
      runId: 'remote-run-1',
      primarySurfaceTestId: 'terminal-primary',
      trace: () => undefined,
    });
    const events: Array<{type: string; streamId?: string}> = [];
    port.subscribeEvents(event => events.push(event as {type: string; streamId?: string}));
    const sessionId = '00000000-0000-4000-8000-000000000019';
    const begin = await port.begin({
      sessionId,
      localScreens: [{screen: 'main', surfaceKey: 'PRIMARY', windowIdentity: 'web-primary', generation: 1}],
      signalUrl: 'ws://127.0.0.1:7880',
      token: 'fixture-token',
    } as never);

    expect(begin.status).toBe('succeeded');
    const ready = events.find(event => event.type === 'screen-ready');
    expect(ready?.streamId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu);
    expect(ready?.streamId).not.toContain('remote-run-1');
    expect((await port.end({sessionId})).status).toBe('succeeded');
  });
});
