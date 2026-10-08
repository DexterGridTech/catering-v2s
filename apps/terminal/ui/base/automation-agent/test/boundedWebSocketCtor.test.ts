import {describe, expect, it, vi} from 'vitest';
import {createBoundedWebSocketCtor, type BoundedWebSocketFailure} from '../src/foundations/boundedWebSocketCtor';

class FakeWebSocket {
  readonly OPEN = 1;
  readyState = 1;
  bufferedAmount = 0;
  close = vi.fn();
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  sendCount = 0;
  send = (_data: string | ArrayBufferLike | Blob | ArrayBufferView): void => {
    this.sendCount += 1;
    this.bufferedAmount += 3;
  };

  constructor(
    readonly url: string,
    readonly protocols?: string | string[],
  ) {}
}

describe('bounded WebSocket constructor', () => {
  it('closes once unacknowledged frames cross the limit and drops later sends', () => {
    const onLimit = vi.fn((socket: WebSocket, _failure: BoundedWebSocketFailure) => socket.close());
    const outbound = createBoundedWebSocketCtor(
      FakeWebSocket as unknown as {new (url: string, protocols?: string | string[]): WebSocket},
      onLimit,
      250,
    );
    const socket = new outbound.WebSocketCtor('ws://localhost:19090', ['automation-v1']) as unknown as FakeWebSocket;
    const frame = (messageId: string) =>
      JSON.stringify({protocolVersion: 1, sessionId: 's', messageId, type: 'event', body: null});

    socket.send(frame('first'));
    socket.send(frame('second'));
    socket.send(frame('third'));

    expect(socket.url).toBe('ws://localhost:19090');
    expect(socket.protocols).toEqual(['automation-v1']);
    expect(socket.sendCount).toBe(2);
    expect(onLimit).toHaveBeenCalledTimes(1);
    expect(onLimit.mock.calls[0]?.[1]).toMatchObject({
      reason: 'UNACKNOWLEDGED_WINDOW_FULL',
      limitBytes: 250,
      pendingMessages: 2,
      pendingBytes: expect.any(Number),
      messageBytes: expect.any(Number),
      messageType: 'event',
      messageIdFamily: 'opaque',
    });
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(outbound.pendingMessageCount).toBe(0);
    expect(outbound.pendingByteCount).toBe(0);
    outbound.dispose();
  });

  it('releases acknowledged bytes and sends later messages in order', () => {
    const onLimit = vi.fn();
    const first = JSON.stringify({protocolVersion: 1, sessionId: 's', messageId: 'first', type: 'event', body: null});
    const second = JSON.stringify({protocolVersion: 1, sessionId: 's', messageId: 'second', type: 'event', body: null});
    const third = JSON.stringify({protocolVersion: 1, sessionId: 's', messageId: 'third', type: 'event', body: null});
    const outbound = createBoundedWebSocketCtor(
      FakeWebSocket as unknown as {new (url: string, protocols?: string | string[]): WebSocket},
      onLimit,
      new TextEncoder().encode(first).length + new TextEncoder().encode(second).length,
    );
    const socket = new outbound.WebSocketCtor('ws://localhost:19090') as unknown as FakeWebSocket;

    socket.send(first);
    socket.send(second);
    outbound.acknowledge('first');
    socket.send(third);

    expect(socket.sendCount).toBe(3);
    expect(onLimit).not.toHaveBeenCalled();
    expect(socket.close).not.toHaveBeenCalled();
    expect(outbound.pendingMessageCount).toBe(2);
    outbound.dispose();
    expect(outbound.pendingByteCount).toBe(0);
    expect(outbound.pendingMessageCount).toBe(0);
  });

  it('distinguishes a single frame larger than the entire limit', () => {
    const onLimit = vi.fn();
    const outbound = createBoundedWebSocketCtor(
      FakeWebSocket as unknown as {new (url: string, protocols?: string | string[]): WebSocket},
      onLimit,
      32,
    );
    const socket = new outbound.WebSocketCtor('ws://localhost:19090') as unknown as FakeWebSocket;
    const frame = JSON.stringify({messageId: 'large', type: 'event', body: 'payload'});
    const frameBytes = new TextEncoder().encode(frame).length;

    socket.send(frame);

    expect(onLimit).toHaveBeenCalledTimes(1);
    expect(onLimit.mock.calls[0]?.[1]).toMatchObject({
      reason: 'MESSAGE_TOO_LARGE',
      limitBytes: 32,
      messageBytes: frameBytes,
      pendingBytes: 0,
      pendingMessages: 0,
      messageType: 'event',
      messageIdFamily: 'opaque',
    });
    expect(socket.sendCount).toBe(0);
    outbound.dispose();
  });

  it('reports duplicate frame type and identifier family without exposing the identifier', () => {
    const onLimit = vi.fn();
    const outbound = createBoundedWebSocketCtor(
      FakeWebSocket as unknown as {new (url: string, protocols?: string | string[]): WebSocket},
      onLimit,
    );
    const socket = new outbound.WebSocketCtor('ws://localhost:19090') as unknown as FakeWebSocket;
    const frame = JSON.stringify({protocolVersion: 1, sessionId: 's', messageId: 'reply-secret-id', type: 'response'});

    socket.send(frame);
    socket.send(frame);

    expect(onLimit).toHaveBeenCalledTimes(1);
    expect(onLimit.mock.calls[0]?.[1]).toMatchObject({
      reason: 'DUPLICATE_MESSAGE_ID',
      messageType: 'response',
      pendingMessageType: 'response',
      messageIdFamily: 'reply',
      pendingMessageIdFamily: 'reply',
    });
    expect(JSON.stringify(onLimit.mock.calls[0]?.[1])).not.toContain('reply-secret-id');
    outbound.dispose();
  });
});
