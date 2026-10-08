import {
  type ConnectorCallRequest,
  type ConnectorCallResponse,
  type ConnectorEvent,
  type ConnectorMessage,
  type ConnectorOnInput,
  type ConnectorObject,
  type ConnectorPort,
  type ConnectorSubscribeInput,
  type ConnectorSubscription,
  type ConnectorUnsubscribeInput,
  type ConnectorValue,
  type CreatePlatformPortsInput,
  type AppControlPort,
  type DevicePort,
  type DeviceInfo,
  type DisplayInfo,
  type EnvironmentMode,
  type UpdatePort,
  type UpdateAction,
  type TerminalUpdateArtifact,
  type LogError,
  type LogEvent,
  type LogFields,
  type LogWriteInput,
  type LogWriteResult,
  type LoggerPort,
  type LogUploadPort,
  type LogUploadInput,
  type NoOutput,
  type NetworkStatusChanged,
  type NetworkStatusListener,
  type NetworkStatusSubscriptionInput,
  type NetworkStatusUnsubscribeInput,
  type PlatformPortBindings,
  type PlatformPorts,
  type PortActionResult,
  type PortResult,
  type RuntimeTransitionObservation,
  type ScriptNativeBindings,
  type ScriptPort,
  type StateStoragePort,
  type StateStorageReadEntry,
  type StateStorageReadValue,
  type SystemStatus,
  type TopologyHostConfig,
  type TopologyHostPort,
} from '@catering-v2s/kernel-base-platform-ports';
import {createPlatformPorts} from '@catering-v2s/kernel-base-platform-ports';
import type {
  AppError,
  AppModule,
  CommandId,
  CommandResultPatch,
  CommandResultSnapshot,
  CommandRouteContext,
  ConnectionId,
  RequestCommandSnapshot,
  RequestId,
  RequestLifecycleSnapshot,
  RuntimeInstanceId,
  SessionId,
  TimestampMs,
  TransportRequestContext,
} from '@catering-v2s/kernel-base-contracts';
import {
  createCommandId,
  createConnectionId,
  createNodeId,
  createRequestId,
  createRuntimeInstanceId,
  createSessionId,
  nowTimestampMs,
} from '@catering-v2s/kernel-base-contracts';

const runtimeInstanceId = createRuntimeInstanceId();
const requestId = createRequestId();
const commandId = createCommandId();
const sessionId = createSessionId();
const nodeId = createNodeId();
const connectionId = createConnectionId();
const timestamp: TimestampMs = nowTimestampMs();

const appError: AppError = {
  name: 'ExampleError',
  message: 'example',
  key: 'example.error',
  code: 'EXAMPLE_ERROR',
  category: 'SYSTEM',
  severity: 'LOW',
  createdAt: timestamp,
  templateMissingKeys: [],
};

const logError: LogError = {message: 'safe'};
const logFields: LogFields = {attempt: 1, nested: {ok: true}};
const logInput: LogWriteInput = {
  category: 'platform-ports',
  event: 'fixture',
  message: 'safe',
  data: logFields,
  error: logError,
};

const routeContext: CommandRouteContext = {workspace: 'BRANCH', instanceMode: 'SLAVE', displayMode: 'SECONDARY'};
const transportContext: TransportRequestContext = {requestId, commandId, sessionId, nodeId};

const resultPayload = {accepted: true};
const patch: CommandResultPatch<typeof resultPayload> = {commandId, result: resultPayload, patchedAt: timestamp};
const commandSnapshot: CommandResultSnapshot<typeof resultPayload> = {commandId, result: resultPayload};
const requestCommand: RequestCommandSnapshot<typeof resultPayload> = {
  commandId,
  ownerNodeId: nodeId,
  sourceNodeId: nodeId,
  targetNodeId: nodeId,
  commandName: 'fixture',
  status: 'completed',
  result: resultPayload,
  updatedAt: timestamp,
};
const requestSnapshot: RequestLifecycleSnapshot<typeof resultPayload> = {
  requestId,
  ownerNodeId: nodeId,
  rootCommandId: commandId,
  sessionId,
  status: 'completed',
  startedAt: timestamp,
  updatedAt: timestamp,
  commands: [requestCommand],
  commandResults: [commandSnapshot],
};

const moduleDescription: AppModule = {
  moduleName: 'fixture.module',
  kind: 'toolkit',
  parameterDefinitions: [],
};

const consumeResult = <TValue>(result: PortResult<TValue>): TValue | undefined => {
  if (result.status === 'succeeded') {
    return result.value;
  }
  if (result.status === 'failed') {
    return undefined;
  }
  if (result.status === 'timed-out') {
    return undefined;
  }
  return undefined;
};

const consumeAction = (result: PortActionResult<NoOutput, RuntimeTransitionObservation>): string => {
  if (result.status === 'accepted') {
    return result.requestId;
  }
  if (result.status === 'succeeded') {
    return result.value.completed ? 'completed' : 'not-completed';
  }
  return result.status;
};

declare const acceptedAction: PortActionResult<NoOutput, RuntimeTransitionObservation>;
if (acceptedAction.status === 'accepted') {
  // S-1/F-4: accepted is not a succeeded value and must not expose value.completed.
  // @ts-expect-error Accepted actions carry correlation/observation, not a success payload.
  acceptedAction.value.completed;
}

const completeResult = <TValue>(value: TValue): PortResult<TValue> => ({
  status: 'succeeded',
  value,
  completedAt: timestamp,
});
const unavailableResultFor = <TValue>(
  port: 'persistSecure' | 'device' | 'appControl' | 'script' | 'connector' | 'update' | 'logUpload' | 'topologyHost',
  capability: string,
): PortResult<TValue> => ({
  status: 'unavailable',
  port,
  capability,
  reason: 'ADAPTER_NOT_INJECTED',
  message: `${port}.${capability} has no injected adapter`,
});
const noOutput: NoOutput = {completed: true};
const emptyDeviceInfo: DeviceInfo = {
  deviceId: 'fixture',
  systemName: 'fixture',
  systemVersion: '1',
  logicalProcessorCount: 1,
};
const emptyDisplayInfo: DisplayInfo = {displayCount: 1};
const emptySystemStatus: SystemStatus = {
  processor: {logicalProcessorCount: 1, processUtilizationRatio: 0},
  memory: {totalBytes: 1, availableBytes: 1, processBytes: 1},
  storage: {totalBytes: 1, availableBytes: 1, processBytes: 1},
  network: {connected: true},
  power: {source: 'unknown', charging: 'unknown'},
  observedAt: timestamp,
};

const completeStorage: StateStoragePort = {
  read: async () => completeResult<StateStorageReadValue>({state: 'missing'}),
  write: async () => completeResult(noOutput),
  remove: async () => completeResult(noOutput),
  readMany: async () => completeResult<readonly StateStorageReadEntry[]>([]),
  writeMany: async () => completeResult(noOutput),
  removeMany: async () => completeResult(noOutput),
  listKeys: async () => completeResult<readonly string[]>([]),
  clear: async () => completeResult(noOutput),
};

const eventFor = (level: 'debug' | 'info' | 'warn' | 'error', input: LogWriteInput): LogEvent => ({
  timestamp,
  level,
  category: input.category,
  event: input.event,
  message: input.message,
  scope: {moduleName: 'fixture'},
  context: input.context,
  data: input.data,
  error: input.error,
  security: {containsSensitiveRaw: false, maskingMode: 'masked'},
});
const completeLogResult = (event: LogEvent): LogWriteResult => ({
  status: 'succeeded',
  value: event,
  completedAt: timestamp,
});
const completeLogger: LoggerPort = {
  debug: (input): LogWriteResult => completeLogResult(eventFor('debug', input)),
  info: (input): LogWriteResult => completeLogResult(eventFor('info', input)),
  warn: (input): LogWriteResult => completeLogResult(eventFor('warn', input)),
  error: (input): LogWriteResult => completeLogResult(eventFor('error', input)),
  scope: () => completeLogger,
  withContext: () => completeLogger,
};

const completeDevice: DevicePort = {
  getDeviceInfo: async () => completeResult(emptyDeviceInfo),
  getDisplayInfo: async () => completeResult(emptyDisplayInfo),
  getSystemStatus: async () => completeResult(emptySystemStatus),
  getNetworkStatus: async () => completeResult(emptySystemStatus.network),
  subscribeNetworkStatus: async () => completeResult({subscriptionId: 'network-fixture'}),
  unsubscribeNetworkStatus: async () => completeResult(noOutput),
  getPowerStatus: async () => completeResult(emptySystemStatus.power),
  subscribePowerStatus: async () => completeResult({subscriptionId: 'fixture'}),
  unsubscribePowerStatus: async () => completeResult(noOutput),
};
const networkChanged: NetworkStatusChanged = {status: emptySystemStatus.network, observedAt: timestamp};
const networkListener: NetworkStatusListener = (_event: NetworkStatusChanged): void => {};
const networkSubscription: NetworkStatusSubscriptionInput = {
  timeoutMs: 1_000,
  listener: networkListener,
  onError: () => {},
};
const networkUnsubscribe: NetworkStatusUnsubscribeInput = {timeoutMs: 1_000, subscriptionId: 'network'};
const completeAppControl: AppControlPort = {
  resetRuntime: async input => ({
    status: 'accepted',
    requestId: input.requestId,
    acceptedAt: timestamp,
    terminalObservation: 'SUCCESSOR_RUNTIME_STARTED',
  }),
  exitApplication: async input => ({
    status: 'accepted',
    requestId: input.requestId,
    acceptedAt: timestamp,
    terminalObservation: 'PROCESS_TERMINATED',
  }),
  clearHostDataCache: async () => completeResult(noOutput),
  setFullscreen: async input => completeResult({enabled: input.enabled}),
  getFullscreen: async () => completeResult({enabled: false}),
  setKioskMode: async input => completeResult({enabled: input.enabled}),
  getKioskMode: async () => completeResult({enabled: false}),
  showNativeLoading: async () => completeResult(noOutput),
  hideNativeLoading: async () => completeResult(noOutput),
};
const completeScript: ScriptPort = {
  execute: async () => completeResult({resultJson: '{}', elapsedMs: 0}),
  getStats: async () => completeResult({total: 0, succeeded: 0, failed: 0, averageElapsedMs: 0}),
  clearStats: async () => completeResult(noOutput),
};
const completeConnector: ConnectorPort = {
  call: async <TRequest extends ConnectorObject, TResponse extends ConnectorValue>(
    input: ConnectorCallRequest<TRequest>,
  ): Promise<PortResult<ConnectorCallResponse<TResponse>>> => unavailableResultFor('connector', 'call'),
  subscribe: async <TMessage extends ConnectorValue>(
    input: ConnectorSubscribeInput<TMessage>,
  ): Promise<PortResult<ConnectorSubscription>> => unavailableResultFor('connector', 'subscribe'),
  unsubscribe: async (input: ConnectorUnsubscribeInput) => unavailableResultFor<NoOutput>('connector', 'unsubscribe'),
  on: async <TEvent extends ConnectorValue>(
    input: ConnectorOnInput<TEvent>,
  ): Promise<PortResult<ConnectorSubscription>> => unavailableResultFor('connector', 'on'),
};
const completeUpdate: UpdatePort = {
  readFacts: async () => unavailableResultFor('update', 'readFacts'),
  prepareArtifact: async () => unavailableResultFor('update', 'prepareArtifact'),
  applyPrepared: async () => unavailableResultFor('update', 'applyPrepared'),
  readAction: async () => unavailableResultFor('update', 'readAction'),
  confirmBoot: async () => unavailableResultFor('update', 'confirmBoot'),
  releasePrepared: async () => unavailableResultFor('update', 'releasePrepared'),
};
const completeLogUpload: LogUploadPort = {
  uploadLogsForDate: async () => unavailableResultFor('logUpload', 'uploadLogsForDate'),
};
const completeTopologyHost: TopologyHostPort = {
  start: async () => unavailableResultFor('topologyHost', 'start'),
  stop: async () => unavailableResultFor('topologyHost', 'stop'),
  getStatus: async () => unavailableResultFor('topologyHost', 'getStatus'),
  getDiagnosticsSnapshot: async () => unavailableResultFor('topologyHost', 'getDiagnosticsSnapshot'),
};
const completeBindings: PlatformPortBindings = {
  logger: {kind: 'console'},
  persistKv: completeStorage,
  persistSecure: completeStorage,
  device: completeDevice,
  appControl: completeAppControl,
  script: completeScript,
  connector: completeConnector,
  update: completeUpdate,
  logUpload: completeLogUpload,
  topologyHost: completeTopologyHost,
};
const completePortImplementations: PlatformPorts = {
  logger: completeLogger,
  persistKv: completeStorage,
  persistSecure: completeStorage,
  device: completeDevice,
  appControl: completeAppControl,
  script: completeScript,
  connector: completeConnector,
  update: completeUpdate,
  logUpload: completeLogUpload,
  topologyHost: completeTopologyHost,
};
void completeBindings;
void completePortImplementations;
const createdPorts = createPlatformPorts({environmentMode: 'TEST', bindings: completeBindings});
void createdPorts.topologyHost;

declare const ports: PlatformPorts;
declare const storage: StateStoragePort;
declare const logger: LoggerPort;
declare const device: DevicePort;
declare const script: ScriptPort;
declare const connector: ConnectorPort;
declare const update: UpdatePort;
declare const logUpload: LogUploadPort;
declare const topologyHost: TopologyHostPort;
declare const bindings: PlatformPortBindings;
declare const environmentMode: EnvironmentMode;
declare const runtimeId: RuntimeInstanceId;
declare const command: CommandId;
declare const connection: ConnectionId;
declare const session: SessionId;
declare const request: RequestId;
declare const deviceInfo: DeviceInfo;
declare const systemStatus: SystemStatus;
declare const connectorValue: ConnectorValue;

void appError;
void patch;
void requestSnapshot;
void routeContext;
void transportContext;
void moduleDescription;
void runtimeInstanceId;
void runtimeId;
void command;
void commandId;
void connection;
void connectionId;
void session;
void sessionId;
void request;
void requestId;
void deviceInfo;
void systemStatus;
void connectorValue;
void bindings;
void environmentMode;
void consumeResult;
void consumeAction;

const storageCall = {};
const deviceCall = {timeoutMs: 50};
const surface = {timeoutMs: 50, containerKey: 'primary'};
const requestCall = {timeoutMs: 50, requestId};
const scriptInput = {
  source: 'return 1',
  paramsJson: '{}',
  globalsJson: '{}',
  native: {kind: 'none'} as ScriptNativeBindings,
  timeoutMs: 50,
};
const connectorPayload = {quantity: 1};
const connectorRequest: ConnectorCallRequest<typeof connectorPayload> = {
  requestId,
  channel: {channelKey: 'fixture'},
  action: 'read',
  payload: connectorPayload,
  timeoutMs: 50,
};
const connectorResponse: ConnectorCallResponse<{readonly accepted: boolean}> = {
  requestId,
  payload: {accepted: true},
};
const connectorMessage: ConnectorMessage<{readonly ok: boolean}> = {
  subscriptionId: 'sub_fixture',
  sequence: 1,
  receivedAt: timestamp,
  payload: {ok: true},
};
const connectorEvent: ConnectorEvent<{readonly ok: boolean}> = {
  eventName: 'fixture',
  receivedAt: timestamp,
  payload: {ok: true},
};
const connectorOnInput: ConnectorOnInput<{readonly ok: boolean}> = {
  eventName: 'fixture',
  handler: event => void event,
  onError: error => void error,
  timeoutMs: 50,
};
const connectorSubscribeInput: ConnectorSubscribeInput<{readonly ok: boolean}> = {
  channel: {channelKey: 'fixture'},
  onMessage: message => void message,
  onError: error => void error,
  timeoutMs: 50,
};
const connectorUnsubscribeInput: ConnectorUnsubscribeInput = {subscriptionId: 'sub_fixture', timeoutMs: 50};
const subscription: ConnectorSubscription = {subscriptionId: 'sub_fixture'};

const namedBindings: ScriptNativeBindings = {
  kind: 'named',
  functionNames: ['read'],
  invoke: async input => {
    const functionName: string = input.functionName;
    const argsJson: string = input.argsJson;
    void functionName;
    void argsJson;
    return {status: 'succeeded', value: {resultJson: '{"ok":true}'}, completedAt: timestamp};
  },
};
const openFunctionTable = {read: (input: string) => input};
// F-4/C-2: an open function table is not a ScriptNativeBindings value.
// @ts-expect-error Native bindings must use the named dispatcher contract.
const invalidNativeBindings: ScriptNativeBindings = openFunctionTable;
void invalidNativeBindings;

const typedUploadInput: LogUploadInput = {
  uploadUrl: 'https://example.invalid/logs',
  logDate: '2026-08-30',
  commandId,
  surfaceIndex: 0,
  surfaceRole: 'primary',
  overwrite: false,
  headers: {'x-fixture': 'true'},
  timeoutMs: 50,
};
// C-6: RequestId is not a valid LogUploadInput.commandId.
// @ts-expect-error RequestId and CommandId are distinct branded IDs.
const wrongUploadInput: LogUploadInput = {...typedUploadInput, commandId: requestId};
void wrongUploadInput;

const fullConnectorOnInput: ConnectorOnInput<{readonly ok: boolean}> = {
  eventName: 'fixture',
  handler: event => {
    const ok: boolean = event.payload.ok;
    void ok;
  },
  onError: error => {
    const errorCode: string = error.error.code;
    void errorCode;
  },
  timeoutMs: 50,
};
const fullConnectorSubscribeInput: ConnectorSubscribeInput<{readonly ok: boolean}> = {
  channel: {channelKey: 'fixture'},
  onMessage: message => {
    const sequence: number = message.sequence;
    const ok: boolean = message.payload.ok;
    void sequence;
    void ok;
  },
  onError: error => {
    const errorCode: string = error.error.code;
    void errorCode;
  },
  timeoutMs: 50,
};
// C-4: message payloads are not interchangeable with arbitrary shapes.
const wrongConnectorOnInput: ConnectorOnInput<{readonly ok: boolean}> = {
  ...fullConnectorOnInput,
  handler: event => {
    // @ts-expect-error The listener payload is the declared {ok:boolean} shape.
    const missing: string = event.payload.missing;
    void missing;
  },
};
void wrongConnectorOnInput;

// F-2: every actual port method is required; deleting ConnectorPort.on is not assignable back.
declare const connectorWithoutOn: Omit<ConnectorPort, 'on'>;
// @ts-expect-error ConnectorPort.on is required.
const incompleteConnector: ConnectorPort = connectorWithoutOn;
void incompleteConnector;

// F-3: all ten binding keys are required at the assembly boundary.
declare const bindingsWithoutTopologyHost: Omit<PlatformPortBindings, 'topologyHost'>;
// @ts-expect-error PlatformPortBindings requires topologyHost.
const incompleteBindings: PlatformPortBindings = bindingsWithoutTopologyHost;
void incompleteBindings;
// C-5/F-3: the factory accepts only the exhaustive ten-key binding record.
// @ts-expect-error Factory input cannot omit topologyHost.
createPlatformPorts({environmentMode: 'TEST', bindings: bindingsWithoutTopologyHost});

// F-4: explicitly excluded names cannot be imported from the package root.
declare const publicLogger: LoggerPort;
// L-12/F-4: LoggerPort has no public sanitizer-bypassing emit method.
// @ts-expect-error logger.emit is intentionally not part of the public surface.
publicLogger.emit(logInput);
// @ts-expect-error localWebServer is intentionally not part of this package.
import {localWebServer} from '@catering-v2s/kernel-base-platform-ports';
// @ts-expect-error display is intentionally not part of this package.
import {display} from '@catering-v2s/kernel-base-platform-ports';
// @ts-expect-error automation is intentionally not part of this package.
import {automation} from '@catering-v2s/kernel-base-platform-ports';
void localWebServer;
void display;
void automation;
const updateArtifact: TerminalUpdateArtifact = {
  schemaVersion: 1,
  platform: 'android',
  applicationId: 'com.example.terminal',
  nativeVersion: '1.0.0',
  nativeBuildNumber: 1,
  bundleVersion: '1.0.0',
  runtimeVersion: '1',
  entry: 'index.android.bundle',
  files: [{path: 'index.android.bundle', sizeBytes: 0, sha256: 'a'.repeat(64)}],
  publicationId: 'b'.repeat(64),
};
const updateAction: UpdateAction = {
  actionId: 'action',
  taskId: 'task',
  state: 'accepted',
  reason: null,
  publicationId: updateArtifact.publicationId,
  bootId: null,
};
const topologyConfig: TopologyHostConfig = {
  timeoutMs: 50,
  port: 8080,
  basePath: '/topology',
  heartbeatIntervalMs: 1000,
  heartbeatTimeoutMs: 3000,
};
const createInput: CreatePlatformPortsInput = {environmentMode: 'TEST', bindings};

async function exercisePublicCalls(): Promise<void> {
  const read = await ports.persistKv.read({...storageCall, key: 'fixture'});
  if (read.status === 'succeeded') {
    if (read.value.state === 'found') {
      const value: string = read.value.value;
      void value;
    }
  } else if (read.status === 'failed' || read.status === 'timed-out' || read.status === 'unavailable') {
    const status = read.status;
    void status;
  }
  // C-1: the discriminated result cannot be used as a string without narrowing.
  // @ts-expect-error PortResult is not the storage value itself.
  const invalidStorageValue: string = read;
  void invalidStorageValue;
  await storage.write({...storageCall, key: 'fixture', value: 'value'});
  const writeLog = logger.info(logInput);
  consumeResult(writeLog);
  await device.getDeviceInfo(deviceCall);
  await device.getSystemStatus(deviceCall);
  await device.getNetworkStatus(deviceCall);
  await device.subscribeNetworkStatus(networkSubscription);
  await device.unsubscribeNetworkStatus(networkUnsubscribe);
  void networkChanged;
  const scriptResult = await script.execute({...scriptInput, native: namedBindings});
  if (scriptResult.status === 'succeeded') {
    const resultJson: string = scriptResult.value.resultJson;
    void resultJson;
  }
  const connectorResult = await connector.call<typeof connectorPayload, {readonly accepted: boolean}>(connectorRequest);
  if (connectorResult.status === 'succeeded') {
    const accepted: boolean = connectorResult.value.payload.accepted;
    void accepted;
  }
  const subscriptionResult = await connector.subscribe(fullConnectorSubscribeInput);
  if (subscriptionResult.status === 'succeeded') {
    const subscriptionId: string = subscriptionResult.value.subscriptionId;
    void subscriptionId;
  }
  const eventSubscriptionResult = await connector.on(fullConnectorOnInput);
  if (eventSubscriptionResult.status === 'succeeded') {
    const subscriptionId: string = eventSubscriptionResult.value.subscriptionId;
    void subscriptionId;
  }
  await connector.unsubscribe(connectorUnsubscribeInput);
  await update.readFacts({timeoutMs: 50});
  await update.prepareArtifact({
    timeoutMs: 50,
    sourceRef: 'fixture',
    sourcePath: '/updates/artifact.zip',
    expectedSha256: updateArtifact.publicationId,
    artifact: updateArtifact,
    kind: 'hot',
    network: {addresses: [{addressName: 'primary', baseUrl: 'https://updates.example.invalid'}]},
  });
  await update.applyPrepared({timeoutMs: 50, taskId: 'task', actionId: 'action', preparedId: 'prepared', kind: 'hot'});
  await update.readAction({timeoutMs: 50, taskId: updateAction.taskId, actionId: updateAction.actionId});
  await update.confirmBoot({timeoutMs: 50, bootToken: 'boot', publicationId: updateArtifact.publicationId});
  await update.releasePrepared({timeoutMs: 50, preparedId: 'prepared'});
  await logUpload.uploadLogsForDate(typedUploadInput);
  await topologyHost.start(topologyConfig);
  consumeAction(await ports.appControl.resetRuntime(requestCall));
  void connectorResponse;
  void connectorMessage;
  void connectorEvent;
  void subscription;
  void updateAction;
}

void exercisePublicCalls;

// F-1/F-2: branded runtime IDs cannot cross their declared domains.
// @ts-expect-error RequestId and CommandId are intentionally incompatible brands.
const wrongBrandedId: RequestId = commandId;
void wrongBrandedId;

// F-3: an unavailable result must be narrowed before a success payload is read.
declare const unavailableResult: PortResult<{readonly ok: true}>;
if (unavailableResult.status === 'unavailable') {
  // @ts-expect-error unavailable results do not carry a success value.
  unavailableResult.value;
}

// F-4: a genericized result cannot accept the wrong payload shape.
const typedPatch: CommandResultPatch<{readonly count: number}> = {
  commandId,
  result: {count: 1},
  patchedAt: timestamp,
};
// @ts-expect-error Result payloads remain typed after the TR-05 genericization.
const wrongPatch: CommandResultPatch<{readonly count: number}> = {...typedPatch, result: {count: 'one'}};
void wrongPatch;
