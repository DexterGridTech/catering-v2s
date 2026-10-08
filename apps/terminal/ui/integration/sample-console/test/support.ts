import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts';
import {
  createPlatformPorts,
  createProcessMemoryStateStoragePort,
  consoleLoggerBinding,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableUpdatePort,
  unavailableLogUploadPort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  unavailableDevicePort,
  type DevicePort,
  type DeviceInfo,
  type DisplayInfo,
  type DisplaySurfaceInfo,
  type LogEvent,
  type LogContext,
  type LogScopeBinding,
  type LogWriteInput,
  type LoggerPort,
  type PlatformPorts,
  type PortResult,
  type StateStoragePort,
  type UpdatePort,
  type NativeLoadingCapability,
} from '@catering-v2s/kernel-base-platform-ports';
import type {TopologyPeerChannel, TopologyPeerChannelEvent} from '@catering-v2s/kernel-base-transport';
import type {TransportNetworkAdapter, TransportConnectionEvent} from '@catering-v2s/kernel-base-transport';

export const createReadyTerminalNetworkAdapter = (
  readSnapshot: TransportNetworkAdapter['readSnapshot'],
  sendHttp: NonNullable<TransportNetworkAdapter['sendHttp']>,
): TransportNetworkAdapter =>
  Object.freeze({
    readSnapshot,
    sendHttp,
    connect: async () => {
      const listeners = new Set<(event: TransportConnectionEvent) => void>();
      return Object.freeze({
        send: async (raw: string) => {
          const frame = JSON.parse(raw) as {readonly type?: string};
          if (frame.type !== 'AUTHENTICATE') return;
          const ready = JSON.stringify({
            type: 'SESSION_READY',
            sessionId: 'test-session',
            nodeId: 'test-node',
            serverTime: new Date().toISOString(),
            heartbeatIntervalMs: 60_000,
            heartbeatTimeoutMs: 180_000,
          });
          queueMicrotask(() => listeners.forEach(listener => listener({type: 'message', raw: ready})));
        },
        subscribe: (listener: (event: TransportConnectionEvent) => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        close: async (reason?: string) => {
          listeners.forEach(listener => listener({type: 'close', code: 1000, reason}));
        },
      });
    },
  });

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor');
const testPortCapabilities = Object.freeze([
  Object.freeze({capability: 'fixture', state: 'real' as const, source: 'fixture' as const}),
]);

const withTestPortDescriptor = <T extends object>(value: T, port: string): T => {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  Reflect.deleteProperty(descriptors, PORT_DESCRIPTOR_KEY);
  const copy = Object.create(Object.getPrototypeOf(value), descriptors) as T;
  Object.defineProperty(copy, PORT_DESCRIPTOR_KEY, {
    value: Object.freeze({port, capabilities: testPortCapabilities}),
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return Object.freeze(copy);
};

const withoutTestPortDescriptor = <T extends object>(value: T): T => {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  Reflect.deleteProperty(descriptors, PORT_DESCRIPTOR_KEY);
  return Object.freeze(Object.create(Object.getPrototypeOf(value), descriptors) as T);
};

const nativeLoadingCapability: NativeLoadingCapability = Object.freeze({
  targetPhysicalSurface: Object.freeze({surfaceKey: 'PRIMARY', displayIndex: 0}),
  hideOnce: async reason => Object.freeze({hidden: true, alreadyHidden: false, reason}),
});

const wrapLoggerWithStartupReadyFailures = (logger: LoggerPort, remainingFailures: {value: number}): LoggerPort =>
  Object.freeze({
    debug: (input: LogWriteInput) => logger.debug(input),
    info: (input: LogWriteInput) => {
      if (input.event === 'startup.ready' && remainingFailures.value > 0) {
        remainingFailures.value -= 1;
        throw new Error('fixture startup-ready logger failure');
      }
      return logger.info(input);
    },
    warn: (input: LogWriteInput) => logger.warn(input),
    error: (input: LogWriteInput) => logger.error(input),
    scope: (binding: LogScopeBinding) => wrapLoggerWithStartupReadyFailures(logger.scope(binding), remainingFailures),
    withContext: (context: LogContext) =>
      wrapLoggerWithStartupReadyFailures(logger.withContext(context), remainingFailures),
  });

export type TestPlatformPorts = PlatformPorts & Readonly<{readonly nativeLoadingCapability: NativeLoadingCapability}>;

export class TestPeerChannel implements TopologyPeerChannel {
  readonly sentFrames: string[] = [];
  private readonly listeners = new Set<(event: TopologyPeerChannelEvent) => void>();

  subscribe(listener: (event: TopologyPeerChannelEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  listen(): void {}

  async connect(_url: string): Promise<void> {
    this.emit({type: 'open', connectionId: 'test-peer-connection'});
  }

  async send(raw: string): Promise<void> {
    this.sentFrames.push(raw);
  }

  async close(reason?: string): Promise<void> {
    this.emit({type: 'close', reason, connectionId: 'test-peer-connection'});
  }

  async dispose(): Promise<void> {
    this.listeners.clear();
  }

  emit(event: TopologyPeerChannelEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

export class FakeWebStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }
  clear(): void {
    this.values.clear();
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const success = <TValue>(value: TValue): PortResult<TValue> => ({
  status: 'succeeded',
  value,
  completedAt: nowTimestampMs(),
});

const defaultDisplaySurfaces = (displayCount: number): readonly DisplaySurfaceInfo[] =>
  Object.freeze(
    Array.from({length: displayCount}, (_, displayIndex) =>
      Object.freeze({
        displayId: displayIndex,
        role: displayIndex === 0 ? ('primary' as const) : ('secondary' as const),
        logicalSize: Object.freeze(displayIndex === 0 ? {width: 1280, height: 800} : {width: 1024, height: 768}),
        physicalSize: null,
        readiness: 'ready' as const,
      }),
    ),
  );

export const createTestPlatformPorts = (
  input: Readonly<{
    readonly displayCount?: number;
    readonly getDisplayCount?: () => number;
    readonly displaySurfaces?: readonly DisplaySurfaceInfo[];
    readonly deviceInfo?: DeviceInfo;
    readonly onGetDeviceInfo?: () => void;
    readonly displayInfoGate?: Promise<void>;
    readonly displayInfoGateAfterCalls?: number;
    readonly plainStorage?: StateStoragePort;
    readonly protectedStorage?: StateStoragePort;
    readonly events?: LogEvent[];
    readonly startupRunId?: string;
    readonly stripPortDescriptors?: boolean;
    readonly failStartupReadyCount?: number;
    readonly updatePort?: UpdatePort;
  }> = {},
): TestPlatformPorts => {
  const events = input.events ?? [];
  let displayInfoCalls = 0;
  const device = withTestPortDescriptor(
    {
      ...unavailableDevicePort,
      getDeviceInfo: async ({timeoutMs}) => {
        input.onGetDeviceInfo?.();
        return input.deviceInfo === undefined
          ? unavailableDevicePort.getDeviceInfo({timeoutMs})
          : success(input.deviceInfo);
      },
      getDisplayInfo: async (): Promise<PortResult<DisplayInfo>> => {
        displayInfoCalls += 1;
        if (input.displayInfoGate !== undefined && displayInfoCalls > (input.displayInfoGateAfterCalls ?? 0)) {
          await input.displayInfoGate;
        }
        const displayCount = input.getDisplayCount?.() ?? input.displayCount ?? 1;
        return success({
          displayCount,
          surfaces: input.displaySurfaces ?? defaultDisplaySurfaces(displayCount),
        });
      },
    },
    'device',
  ) as DevicePort;
  const logger = withTestPortDescriptor(
    {
      ...consoleLoggerBinding,
      kind: 'sink' as const,
      write: (event: LogEvent) => {
        events.push(event);
      },
    },
    'logger',
  );
  const plainStorage = withTestPortDescriptor(input.plainStorage ?? createProcessMemoryStateStoragePort(), 'persistKv');
  const protectedStorage = withTestPortDescriptor(
    input.protectedStorage ?? createProcessMemoryStateStoragePort(),
    'persistSecure',
  );
  const ports = createPlatformPorts({
    environmentMode: 'TEST',
    bindings: {
      logger,
      persistKv: plainStorage,
      persistSecure: protectedStorage,
      device,
      appControl: withTestPortDescriptor(unavailableAppControlPort, 'appControl'),
      script: withTestPortDescriptor(unavailableScriptPort, 'script'),
      connector: withTestPortDescriptor(unavailableConnectorPort, 'connector'),
      update: withTestPortDescriptor(input.updatePort ?? unavailableUpdatePort, 'update'),
      logUpload: withTestPortDescriptor(unavailableLogUploadPort, 'logUpload'),
      topologyHost: withTestPortDescriptor(unavailableTopologyHostPort, 'topologyHost'),
    },
  });
  const failureState = {value: input.failStartupReadyCount ?? 0};
  const result = Object.freeze({
    ...ports,
    ...(failureState.value > 0 ? {logger: wrapLoggerWithStartupReadyFailures(ports.logger, failureState)} : {}),
    ...(input.startupRunId === undefined ? {} : {startupRunId: input.startupRunId}),
    nativeLoadingCapability,
  });
  if (!input.stripPortDescriptors) return result;
  return Object.freeze({
    ...result,
    logger: withoutTestPortDescriptor(result.logger),
    persistKv: withoutTestPortDescriptor(result.persistKv),
    persistSecure: withoutTestPortDescriptor(result.persistSecure),
    device: withoutTestPortDescriptor(result.device),
    appControl: withoutTestPortDescriptor(result.appControl),
    script: withoutTestPortDescriptor(result.script),
    connector: withoutTestPortDescriptor(result.connector),
    update: withoutTestPortDescriptor(result.update),
    logUpload: withoutTestPortDescriptor(result.logUpload),
    topologyHost: withoutTestPortDescriptor(result.topologyHost),
  });
};

export const readText = (children: readonly unknown[] | undefined): string =>
  (children ?? []).filter((child): child is string => typeof child === 'string').join('');
