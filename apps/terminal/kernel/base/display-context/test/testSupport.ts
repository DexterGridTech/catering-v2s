import {createNodeId, createRequestId, type TimestampMs} from '@catering-v2s/kernel-base-contracts';
import {moduleName as contractsModuleName} from '@catering-v2s/kernel-base-contracts';
import {moduleName as platformPortsModuleName} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as stateModuleName} from '@catering-v2s/kernel-base-state';
import {
  createPlatformPorts,
  createProcessMemoryStateStoragePort,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableUpdatePort,
  unavailableLogUploadPort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  type DeviceCall,
  type DevicePort,
  type DisplayInfo,
  type LogEvent,
  type NoOutput,
  type NetworkStatus,
  type NetworkStatusChanged,
  type NetworkStatusSubscriptionInput,
  type NetworkStatusUnsubscribeInput,
  type PlatformPorts,
  type PortFailure,
  type PortResult,
  type PowerStatusChanged,
  type PowerStatusSubscriptionInput,
  type PowerStatusUnsubscribeInput,
  type StateStoragePort,
} from '@catering-v2s/kernel-base-platform-ports';
import {
  createRuntime,
  type CreateRuntimeInput,
  type Runtime,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime';
import {createDisplayContextModule} from '../src/index';

const completedAt = 1 as TimestampMs;

export const succeeded = <TValue>(value: TValue): PortResult<TValue> =>
  Object.freeze({
    status: 'succeeded' as const,
    value,
    completedAt,
  });

export const noOutput = (): PortResult<NoOutput> => succeeded(Object.freeze({completed: true}));

export const unavailable = (capability: string): PortResult<never> =>
  Object.freeze({
    status: 'unavailable' as const,
    port: 'device' as const,
    capability,
    reason: 'ADAPTER_NOT_INJECTED' as const,
    message: `device ${capability} unavailable`,
  });

export const failed = (capability: string): PortFailure =>
  Object.freeze({
    status: 'failed' as const,
    port: 'device' as const,
    capability,
    error: Object.freeze({
      code: 'TEST_DEVICE_FAILURE',
      message: `${capability} failed`,
      retryable: true,
    }),
  });

export class FakeDevicePort implements DevicePort {
  displayCount = 1;
  displayResults: PortResult<DisplayInfo>[] = [];
  displayInfoPending: Promise<PortResult<DisplayInfo>> | null = null;
  subscribeResult: PortResult<{readonly subscriptionId: string}> = succeeded({subscriptionId: 'power-subscription'});
  subscribeError: Error | null = null;
  unsubscribeResult: PortResult<NoOutput> = noOutput();
  unsubscribeError: Error | null = null;
  readonly calls = {
    getDisplayInfo: [] as DeviceCall[],
    getNetworkStatus: [] as DeviceCall[],
    subscribeNetworkStatus: [] as NetworkStatusSubscriptionInput[],
    unsubscribeNetworkStatus: [] as NetworkStatusUnsubscribeInput[],
    subscribePowerStatus: [] as PowerStatusSubscriptionInput[],
    unsubscribePowerStatus: [] as PowerStatusUnsubscribeInput[],
  };
  private listener: ((event: PowerStatusChanged) => void) | null = null;
  private onError: ((error: PortFailure['error']) => void) | null = null;
  private networkListener: ((event: NetworkStatusChanged) => void) | null = null;
  private networkOnError: ((error: PortFailure['error']) => void) | null = null;

  async getDeviceInfo(): Promise<PortResult<never>> {
    return unavailable('getDeviceInfo');
  }

  async getDisplayInfo(input: DeviceCall): Promise<PortResult<DisplayInfo>> {
    this.calls.getDisplayInfo.push(input);
    if (this.displayInfoPending !== null) return this.displayInfoPending;
    return this.displayResults.shift() ?? succeeded({displayCount: this.displayCount});
  }

  async getSystemStatus(): Promise<PortResult<never>> {
    return unavailable('getSystemStatus');
  }

  async getPowerStatus(): Promise<PortResult<never>> {
    return unavailable('getPowerStatus');
  }

  async getNetworkStatus(input: DeviceCall): Promise<PortResult<NetworkStatus>> {
    this.calls.getNetworkStatus.push(input);
    return unavailable('getNetworkStatus');
  }

  async subscribeNetworkStatus(
    input: NetworkStatusSubscriptionInput,
  ): Promise<PortResult<{readonly subscriptionId: string}>> {
    this.calls.subscribeNetworkStatus.push(input);
    if (this.subscribeError !== null) throw this.subscribeError;
    if (this.subscribeResult.status === 'succeeded') {
      this.networkListener = input.listener;
      this.networkOnError = input.onError;
    }
    return this.subscribeResult;
  }

  async unsubscribeNetworkStatus(input: NetworkStatusUnsubscribeInput): Promise<PortResult<NoOutput>> {
    this.calls.unsubscribeNetworkStatus.push(input);
    if (this.unsubscribeError !== null) throw this.unsubscribeError;
    return this.unsubscribeResult;
  }

  async subscribePowerStatus(
    input: PowerStatusSubscriptionInput,
  ): Promise<PortResult<{readonly subscriptionId: string}>> {
    this.calls.subscribePowerStatus.push(input);
    if (this.subscribeError !== null) throw this.subscribeError;
    if (this.subscribeResult.status === 'succeeded') {
      this.listener = input.listener;
      this.onError = input.onError;
    }
    return this.subscribeResult;
  }

  async unsubscribePowerStatus(input: PowerStatusUnsubscribeInput): Promise<PortResult<NoOutput>> {
    this.calls.unsubscribePowerStatus.push(input);
    if (this.unsubscribeError !== null) throw this.unsubscribeError;
    return this.unsubscribeResult;
  }

  emit(source: PowerStatusChanged['status']['source']): void {
    this.listener?.({
      status: {source, charging: 'unknown'},
      observedAt: completedAt,
    });
  }

  emitNetwork(connected: boolean): void {
    this.networkListener?.({status: {connected}, observedAt: completedAt});
  }

  reportNetworkError(code = 'NETWORK_STATUS_TEST_ERROR'): void {
    this.networkOnError?.({code, message: code, retryable: true});
  }

  reportError(code = 'POWER_STATUS_TEST_ERROR'): void {
    this.onError?.({
      code,
      message: code,
      retryable: true,
    });
  }
}

export const createSinkLoggerBinding = (events: LogEvent[]) => ({
  kind: 'sink' as const,
  write: (event: LogEvent): void => {
    events.push(event);
  },
});

export const createDisplayPlatformPorts = (
  input: Readonly<{
    device?: FakeDevicePort;
    plainStorage?: StateStoragePort;
    protectedStorage?: StateStoragePort;
    events?: LogEvent[];
  }> = {},
): PlatformPorts =>
  createPlatformPorts({
    environmentMode: 'TEST',
    bindings: {
      logger: createSinkLoggerBinding(input.events ?? []),
      persistKv: input.plainStorage ?? createProcessMemoryStateStoragePort(),
      persistSecure: input.protectedStorage ?? createProcessMemoryStateStoragePort(),
      device: input.device ?? new FakeDevicePort(),
      appControl: unavailableAppControlPort,
      script: unavailableScriptPort,
      connector: unavailableConnectorPort,
      update: unavailableUpdatePort,
      logUpload: unavailableLogUploadPort,
      topologyHost: unavailableTopologyHostPort,
    },
  });

export const createDisplayRuntime = (
  input: Readonly<{
    device?: FakeDevicePort;
    plainStorage?: StateStoragePort;
    protectedStorage?: StateStoragePort;
    runtimeName?: string;
    events?: LogEvent[];
  }> = {},
): Readonly<{
  runtime: Runtime;
  device: FakeDevicePort;
  plainStorage: StateStoragePort;
  protectedStorage: StateStoragePort;
  events: LogEvent[];
}> => {
  const device = input.device ?? new FakeDevicePort();
  const plainStorage = input.plainStorage ?? createProcessMemoryStateStoragePort();
  const protectedStorage = input.protectedStorage ?? createProcessMemoryStateStoragePort();
  const events = input.events ?? [];
  const dependencyModules: readonly RuntimeModule[] = [
    Object.freeze({moduleName: contractsModuleName, kind: 'toolkit' as const, dependencies: []}),
    Object.freeze({
      moduleName: platformPortsModuleName,
      kind: 'toolkit' as const,
      dependencies: [{moduleName: contractsModuleName}],
    }),
    Object.freeze({
      moduleName: stateModuleName,
      kind: 'toolkit' as const,
      dependencies: [{moduleName: contractsModuleName}, {moduleName: platformPortsModuleName}],
    }),
  ];
  const runtimeInput: CreateRuntimeInput = {
    localNodeId: createNodeId(),
    modules: [...dependencyModules, createDisplayContextModule()],
    platformPorts: createDisplayPlatformPorts({device, plainStorage, protectedStorage, events}),
    state: {
      runtimeName: input.runtimeName ?? `display-context-${Math.random().toString(36).slice(2)}`,
      environmentMode: 'TEST',
      persistenceKey: 'display-context-test',
      persistenceDebounceMs: 0,
    },
  };
  return Object.freeze({
    runtime: createRuntime(runtimeInput),
    device,
    plainStorage,
    protectedStorage,
    events,
  });
};

export const primaryRoute = Object.freeze({
  workspace: 'MAIN' as const,
  instanceMode: 'SLAVE' as const,
  displayMode: 'PRIMARY' as const,
});
export const secondaryRoute = Object.freeze({
  workspace: 'MAIN' as const,
  instanceMode: 'SLAVE' as const,
  displayMode: 'SECONDARY' as const,
});
export const requestId = () => createRequestId();
