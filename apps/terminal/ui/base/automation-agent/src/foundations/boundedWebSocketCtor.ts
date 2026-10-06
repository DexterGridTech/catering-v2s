const maxUnacknowledgedBytes = 1_048_576;

type WebSocketConstructor = {new (url: string, protocols?: string | string[]): WebSocket};
type PendingMessage = Readonly<{data: string; bytes: number; sent: boolean}>;

const utf8ByteLength = (value: string): number => {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) {
      bytes += 1;
      continue;
    }
    if (code <= 0x7ff) {
      bytes += 2;
      continue;
    }
    if (code < 0xd800 || code > 0xdbff || index + 1 >= value.length) {
      bytes += 3;
      continue;
    }
    const next = value.charCodeAt(index + 1);
    if (next < 0xdc00 || next > 0xdfff) {
      bytes += 3;
      continue;
    }
    bytes += 4;
    index += 1;
  }
  return bytes;
};

/**
 * Bound client-originated bytes until the driver confirms receipt. This works
 * with browser and React Native WebSocket implementations, including runtimes
 * that declare but do not update the native bufferedAmount property.
 */
export const createBoundedWebSocketCtor = (
  NativeWebSocket: WebSocketConstructor,
  onLimit: (socket: WebSocket) => void,
  limit = maxUnacknowledgedBytes,
) => {
  const pending = new Map<string, PendingMessage>();
  const sendOrder: string[] = [];
  let unacknowledgedBytes = 0;
  let socket: WebSocket | undefined;
  let nativeSend: WebSocket['send'] | undefined;
  let disposed = false;
  let failed = false;

  const failClosed = (): void => {
    if (failed || disposed) return;
    failed = true;
    pending.clear();
    sendOrder.length = 0;
    unacknowledgedBytes = 0;
    if (socket !== undefined) onLimit(socket);
  };

  const flush = (): void => {
    if (disposed || failed || socket === undefined || nativeSend === undefined || socket.readyState !== socket.OPEN)
      return;
    while (sendOrder.length > 0) {
      const messageId = sendOrder.shift();
      if (messageId === undefined) return;
      const entry = pending.get(messageId);
      if (entry === undefined || entry.sent) continue;
      try {
        nativeSend(entry.data);
        pending.set(messageId, Object.freeze({...entry, sent: true}));
      } catch {
        failClosed();
        return;
      }
    }
  };

  const WebSocketCtor = function (url: string, protocols?: string | string[]): WebSocket {
    socket = protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
    nativeSend = socket.send.bind(socket);
    Object.defineProperty(socket, 'send', {
      configurable: false,
      enumerable: false,
      value: (data: Parameters<WebSocket['send']>[0]): void => {
        if (disposed || failed) return;
        if (typeof data !== 'string') {
          failClosed();
          return;
        }
        let envelope: unknown;
        try {
          envelope = JSON.parse(data);
        } catch {
          failClosed();
          return;
        }
        if (
          typeof envelope !== 'object' ||
          envelope === null ||
          !('messageId' in envelope) ||
          typeof envelope.messageId !== 'string' ||
          envelope.messageId.length === 0 ||
          pending.has(envelope.messageId)
        ) {
          failClosed();
          return;
        }
        const bytes = utf8ByteLength(data);
        if (bytes > limit || unacknowledgedBytes + bytes > limit) {
          failClosed();
          return;
        }
        pending.set(envelope.messageId, Object.freeze({data, bytes, sent: false}));
        sendOrder.push(envelope.messageId);
        unacknowledgedBytes += bytes;
        flush();
      },
    });
    return socket;
  } as unknown as WebSocketConstructor;

  return Object.freeze({
    WebSocketCtor,
    acknowledge: (messageId: string): void => {
      const entry = pending.get(messageId);
      if (entry === undefined || !entry.sent) return;
      pending.delete(messageId);
      unacknowledgedBytes -= entry.bytes;
      flush();
    },
    dispose: (): void => {
      disposed = true;
      pending.clear();
      sendOrder.length = 0;
      unacknowledgedBytes = 0;
      socket = undefined;
      nativeSend = undefined;
    },
    get pendingByteCount(): number {
      return unacknowledgedBytes;
    },
    get pendingMessageCount(): number {
      return pending.size;
    },
  });
};
