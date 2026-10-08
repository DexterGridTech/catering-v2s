const maxUnacknowledgedBytes = 1_048_576;

type WebSocketConstructor = {new (url: string, protocols?: string | string[]): WebSocket};
type PendingMessage = Readonly<{data: string; bytes: number; sent: boolean; messageType: string; messageIdFamily: string}>;
export type BoundedWebSocketFailure = Readonly<{
  readonly reason:
    | 'NON_TEXT_MESSAGE'
    | 'INVALID_JSON'
    | 'INVALID_MESSAGE_ID'
    | 'DUPLICATE_MESSAGE_ID'
    | 'MESSAGE_TOO_LARGE'
    | 'UNACKNOWLEDGED_WINDOW_FULL'
    | 'NATIVE_SEND_FAILED';
  readonly limitBytes: number;
  readonly messageBytes: number | null;
  readonly pendingBytes: number;
  readonly pendingMessages: number;
  readonly messageType?: string;
  readonly pendingMessageType?: string;
  readonly messageIdFamily?: string;
  readonly pendingMessageIdFamily?: string;
}>;

const messageIdFamily = (value: string): string => {
  if (value.startsWith('runtime-event-')) return 'runtime-event';
  if (value.startsWith('controls-event-')) return 'controls-event';
  if (value.startsWith('reply-')) return 'reply';
  if (value.startsWith('hello-')) return 'hello';
  if (value.startsWith('ack-')) return 'ack';
  if (value.startsWith('welcome-')) return 'welcome';
  return 'opaque';
};

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
  onLimit: (socket: WebSocket, failure: BoundedWebSocketFailure) => void,
  limit = maxUnacknowledgedBytes,
) => {
  const pending = new Map<string, PendingMessage>();
  const sendOrder: string[] = [];
  let unacknowledgedBytes = 0;
  let socket: WebSocket | undefined;
  let nativeSend: WebSocket['send'] | undefined;
  let disposed = false;
  let failed = false;

  const failClosed = (
    reason: BoundedWebSocketFailure['reason'],
    messageBytes: number | null = null,
    detail?: Readonly<{messageType?: string; messageIdFamily?: string; pendingMessage?: PendingMessage}>,
  ): void => {
    if (failed || disposed) return;
    failed = true;
    const failure = Object.freeze({
      reason,
      limitBytes: limit,
      messageBytes,
      pendingBytes: unacknowledgedBytes,
      pendingMessages: pending.size,
      ...(detail?.messageType === undefined ? {} : {messageType: detail.messageType}),
      ...(detail?.messageIdFamily === undefined ? {} : {messageIdFamily: detail.messageIdFamily}),
      ...(detail?.pendingMessage === undefined ? {} : {pendingMessageType: detail.pendingMessage.messageType}),
      ...(detail?.pendingMessage === undefined ? {} : {pendingMessageIdFamily: detail.pendingMessage.messageIdFamily}),
    });
    pending.clear();
    sendOrder.length = 0;
    unacknowledgedBytes = 0;
    if (socket !== undefined) onLimit(socket, failure);
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
        failClosed('NATIVE_SEND_FAILED');
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
          failClosed('NON_TEXT_MESSAGE');
          return;
        }
        let envelope: unknown;
        try {
          envelope = JSON.parse(data);
        } catch {
          failClosed('INVALID_JSON');
          return;
        }
        if (
          typeof envelope !== 'object' ||
          envelope === null ||
          !('messageId' in envelope) ||
          typeof envelope.messageId !== 'string' ||
          envelope.messageId.length === 0
        ) {
          failClosed('INVALID_MESSAGE_ID');
          return;
        }
        const bytes = utf8ByteLength(data);
        const currentMessageType = 'type' in envelope && typeof envelope.type === 'string' ? envelope.type : undefined;
        const currentIdFamily = messageIdFamily(envelope.messageId);
        const duplicate = pending.get(envelope.messageId);
        if (duplicate !== undefined) {
          failClosed('DUPLICATE_MESSAGE_ID', bytes, {
            ...(currentMessageType === undefined ? {} : {messageType: currentMessageType}),
            messageIdFamily: currentIdFamily,
            pendingMessage: duplicate,
          });
          return;
        }
        if (bytes > limit) {
          failClosed('MESSAGE_TOO_LARGE', bytes, {
            ...(currentMessageType === undefined ? {} : {messageType: currentMessageType}),
            messageIdFamily: currentIdFamily,
          });
          return;
        }
        if (unacknowledgedBytes + bytes > limit) {
          failClosed('UNACKNOWLEDGED_WINDOW_FULL', bytes, {
            ...(currentMessageType === undefined ? {} : {messageType: currentMessageType}),
            messageIdFamily: currentIdFamily,
          });
          return;
        }
        pending.set(
          envelope.messageId,
          Object.freeze({
            data,
            bytes,
            sent: false,
            messageType: currentMessageType ?? 'unknown',
            messageIdFamily: currentIdFamily,
          }),
        );
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
