import {requireNativeModule, type EventSubscription} from 'expo-modules-core';
import type {
  TransportConnectionEvent,
  TransportManagedConnection,
  TransportNetworkAdapter,
  TransportNetworkSnapshot,
  TransportHttpAttemptResult,
} from '@catering-v2s/kernel-base-transport';

type NativeSocketEvent = Readonly<{
  readonly socketId: string;
  readonly type: 'message' | 'close' | 'error';
  readonly raw?: string;
  readonly code?: number;
  readonly reason?: string;
}>;

type NativeNetworkModule = Readonly<{
  readonly addListener: (eventName: string, listener: (event: NativeSocketEvent) => void) => EventSubscription;
  readonly request: (
    url: string,
    method: string,
    headers: Readonly<Record<string, string>>,
    bodyText: string | null,
    timeoutMs: number,
    proxy: unknown,
  ) => Promise<Readonly<{
    status: number;
    bodyText: string;
    contentType: string;
    requestId?: string | null;
    correlationId?: string | null;
  }>>;
  readonly openSocket: (
    socketId: string,
    url: string,
    headers: Readonly<Record<string, string>>,
    timeoutMs: number,
    proxy: unknown,
  ) => Promise<boolean>;
  readonly sendSocket: (socketId: string, raw: string) => Promise<boolean>;
  readonly closeSocket: (socketId: string, reason: string) => Promise<boolean>;
}>;

type SnapshotReader = (serverName: string) => Promise<TransportNetworkSnapshot>;

const nativeNetwork = (): NativeNetworkModule => requireNativeModule<NativeNetworkModule>('TerminalNetwork');

const withSuffix = (baseUrl: string, suffix: string): string => {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
};

const nativeProxy = (proxy: Parameters<TransportNetworkAdapter['connect']>[0]['proxy']): unknown =>
  proxy === undefined ? null : proxy;

const parseBody = (text: string, contentType: string): unknown => {
  if (text.length === 0) return null;
  if (!contentType.toLowerCase().includes('json')) return text;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const connect = async (
  input: Parameters<TransportNetworkAdapter['connect']>[0],
): Promise<TransportManagedConnection> => {
  const module = nativeNetwork();
  const socketId = `${input.profileId}:${input.connectionToken}`;
  const listeners = new Set<(event: TransportConnectionEvent) => void>();
  const queued: TransportConnectionEvent[] = [];
  let isOpen = false;
  let isClosed = false;
  const publish = (event: TransportConnectionEvent): void => {
    if (listeners.size === 0) queued.push(event);
    else listeners.forEach(listener => listener(event));
  };
  const subscription = module.addListener('onSocketEvent', event => {
    if (event.socketId !== socketId) return;
    if (event.type === 'message' && typeof event.raw === 'string')
      publish(Object.freeze({type: 'message', raw: event.raw}));
    else if (event.type === 'close') {
      isClosed = true;
      publish(
        Object.freeze({
          type: 'close',
          ...(event.code === undefined ? {} : {code: event.code}),
          ...(event.reason === undefined ? {} : {reason: event.reason}),
        }),
      );
    } else if (event.type === 'error')
      publish(Object.freeze({type: 'error', ...(event.reason === undefined ? {} : {reason: event.reason})}));
  });
  try {
    const base = withSuffix(input.address.baseUrl, input.endpointPathAndQuery ?? '');
    const url = base.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    await module.openSocket(socketId, url, {}, input.address.timeoutMs ?? 10_000, nativeProxy(input.proxy));
  } catch (error) {
    subscription.remove();
    throw error;
  }
  isOpen = true;
  return Object.freeze({
    send: async (raw: string) => {
      if (!isOpen || isClosed || !(await module.sendSocket(socketId, raw)))
        throw new Error('ANDROID_WEBSOCKET_SEND_FAILED');
    },
    subscribe: (listener: (event: TransportConnectionEvent) => void) => {
      listeners.add(listener);
      while (queued.length > 0) listener(queued.shift()!);
      return () => listeners.delete(listener);
    },
    close: async (reason?: string) => {
      if (isClosed) return;
      isClosed = true;
      try {
        await module.closeSocket(socketId, reason ?? 'transport closed');
      } finally {
        subscription.remove();
      }
    },
  });
};

const sendHttp = async (
  input: Parameters<NonNullable<TransportNetworkAdapter['sendHttp']>>[0],
): Promise<TransportHttpAttemptResult> => {
  try {
    const response = await nativeNetwork().request(
      withSuffix(input.address.baseUrl, input.pathAndQuery),
      input.method,
      {...input.headers, ...(input.body === undefined ? {} : {'content-type': 'application/json'})},
      input.body === undefined ? null : JSON.stringify(input.body),
      input.timeoutMs,
      nativeProxy(input.proxy),
    );
    return Object.freeze({
      kind: 'response',
      status: response.status,
      body: parseBody(response.bodyText, response.contentType),
      ...(response.contentType.length === 0 ? {} : {contentType: response.contentType}),
      ...(response.requestId == null ? {} : {requestId: response.requestId}),
      ...(response.correlationId == null ? {} : {correlationId: response.correlationId}),
    });
  } catch {
    return Object.freeze({kind: 'failure', category: 'not-delivered', code: 'ANDROID_HTTP_TRANSPORT_FAILED'});
  }
};

export const createAndroidTransportNetworkAdapter = (readSnapshot: SnapshotReader): TransportNetworkAdapter =>
  Object.freeze({readSnapshot, connect, sendHttp});
