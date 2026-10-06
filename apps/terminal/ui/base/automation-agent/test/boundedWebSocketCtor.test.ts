import {describe, expect, it, vi} from 'vitest';
import {createBoundedWebSocketCtor} from '../src/foundations/boundedWebSocketCtor';

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

  constructor(readonly url: string, readonly protocols?: string | string[]) {}
}

describe('bounded WebSocket constructor', () => {
  it('closes once unacknowledged frames cross the limit and drops later sends', () => {
    const onLimit = vi.fn((socket: WebSocket) => socket.close());
    const outbound = createBoundedWebSocketCtor(
      FakeWebSocket as unknown as {new (url: string, protocols?: string | string[]): WebSocket},
      onLimit,
      250,
    );
    const socket = new outbound.WebSocketCtor('ws://localhost:19090', ['automation-v1']) as unknown as FakeWebSocket;
    const frame = (messageId: string) => JSON.stringify({protocolVersion: 1, sessionId: 's', messageId, type: 'event', body: null});

    socket.send(frame('first'));
    socket.send(frame('second'));
    socket.send(frame('third'));

    expect(socket.url).toBe('ws://localhost:19090');
    expect(socket.protocols).toEqual(['automation-v1']);
    expect(socket.sendCount).toBe(2);
    expect(onLimit).toHaveBeenCalledTimes(1);
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
});
