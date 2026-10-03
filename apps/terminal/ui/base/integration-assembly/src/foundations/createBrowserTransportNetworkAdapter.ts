import type {
  TransportConnectionEvent,
  TransportManagedConnection,
  TransportNetworkAdapter,
  TransportNetworkSnapshot,
  TransportHttpAttemptResult,
} from '@catering-v2s/kernel-base-transport';

type SnapshotReader = (serverName: string) => Promise<TransportNetworkSnapshot>;

const urlWithSuffix = (baseUrl: string, suffix: string): string => {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const path = suffix.startsWith('/') ? suffix : `/${suffix}`;
  return `${base}${path}`;
};

const boundedResponseText = async (response: Response, maximumBytes: number): Promise<string> => {
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maximumBytes) {
        await reader.cancel('response body exceeds limit');
        throw new Error('TRANSPORT_HTTP_RESPONSE_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
};

const responseValue = (body: string, contentType: string | null): unknown => {
  if (body.length === 0) return null;
  if (contentType?.toLowerCase().includes('json') !== true) return body;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
};

const connect = async (
  input: Parameters<TransportNetworkAdapter['connect']>[0],
): Promise<TransportManagedConnection> => {
  if (input.proxy !== undefined) throw new Error('BROWSER_TRANSPORT_PROXY_UNSUPPORTED');
  const baseUrl = input.address.baseUrl;
  const httpUrl = urlWithSuffix(baseUrl, input.endpointPathAndQuery ?? '');
  const url = httpUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  const socket = new WebSocket(url);
  const listeners = new Set<(event: TransportConnectionEvent) => void>();
  let opened = false;
  let closed = false;
  let settleOpen!: (connection: TransportManagedConnection) => void;
  let rejectOpen!: (error: Error) => void;
  const openedPromise = new Promise<TransportManagedConnection>((resolve, reject) => {
    settleOpen = resolve;
    rejectOpen = reject;
  });
  const publish = (event: TransportConnectionEvent): void => {
    for (const listener of listeners) listener(event);
  };
  const connection: TransportManagedConnection = Object.freeze({
    send: async raw => {
      if (!opened || closed || socket.readyState !== WebSocket.OPEN) throw new Error('BROWSER_SOCKET_NOT_OPEN');
      socket.send(raw);
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: async reason => {
      if (closed) return;
      closed = true;
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)
        socket.close(1000, reason?.slice(0, 100));
    },
  });
  socket.onopen = () => {
    opened = true;
    publish(Object.freeze({type: 'open', addressName: input.address.addressName}));
    settleOpen(connection);
  };
  socket.onmessage = event => {
    if (typeof event.data === 'string') publish(Object.freeze({type: 'message', raw: event.data}));
    else publish(Object.freeze({type: 'error', reason: 'NON_TEXT_FRAME'}));
  };
  socket.onerror = () => {
    const event = Object.freeze({type: 'error', reason: 'WEBSOCKET_ERROR'} as const);
    if (!opened) rejectOpen(new Error(event.reason));
    else publish(event);
  };
  socket.onclose = event => {
    closed = true;
    const closeEvent = Object.freeze({type: 'close', code: event.code, reason: event.reason} as const);
    if (!opened) rejectOpen(new Error('WEBSOCKET_HANDSHAKE_FAILED'));
    else publish(closeEvent);
  };
  const timeout = setTimeout(() => {
    if (!opened) {
      socket.close();
      rejectOpen(new Error('WEBSOCKET_CONNECT_TIMEOUT'));
    }
  }, input.address.timeoutMs ?? 10_000);
  try {
    return await openedPromise;
  } finally {
    clearTimeout(timeout);
  }
};

const sendHttp = async (
  input: Parameters<NonNullable<TransportNetworkAdapter['sendHttp']>>[0],
): Promise<TransportHttpAttemptResult> => {
  if (input.proxy !== undefined)
    return Object.freeze({kind: 'failure', category: 'not-delivered', code: 'BROWSER_TRANSPORT_PROXY_UNSUPPORTED'});
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await fetch(urlWithSuffix(input.address.baseUrl, input.pathAndQuery), {
      method: input.method,
      headers: {
        ...input.headers,
        ...(input.body === undefined ? {} : {'content-type': 'application/json'}),
      },
      ...(input.body === undefined ? {} : {body: JSON.stringify(input.body)}),
      signal: controller.signal,
    });
    const bodyText = await boundedResponseText(response, 65_536);
    return Object.freeze({
      kind: 'response',
      status: response.status,
      body: responseValue(bodyText, response.headers.get('content-type')),
      ...(response.headers.get('content-type') === null ? {} : {contentType: response.headers.get('content-type')!}),
    });
  } catch (error) {
    const code =
      error instanceof Error && error.message === 'TRANSPORT_HTTP_RESPONSE_TOO_LARGE'
        ? 'BROWSER_HTTP_RESPONSE_TOO_LARGE'
        : 'BROWSER_HTTP_TRANSPORT_FAILED';
    return Object.freeze({kind: 'failure', category: 'not-delivered', code});
  } finally {
    clearTimeout(timeout);
  }
};

export const createBrowserTransportNetworkAdapter = (readSnapshot: SnapshotReader): TransportNetworkAdapter =>
  Object.freeze({readSnapshot, connect, sendHttp});
