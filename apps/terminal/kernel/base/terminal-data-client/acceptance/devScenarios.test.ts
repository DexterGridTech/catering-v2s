import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {createServer} from 'node:net';
import {appendFileSync, readFileSync} from 'node:fs';
import {randomBytes, randomUUID} from 'node:crypto';
import {Agent, ProxyAgent, WebSocket, request} from 'undici';
import {createAwaitableDisposal} from './asyncDisposal';
import {
  createNodeId,
  createRequestId,
  moduleName as contractsModuleName,
  type TransportServerConfig,
} from '@catering-v2s/kernel-base-contracts';
import {
  createPlatformPorts,
  createProcessMemoryStateStoragePort,
  moduleName as platformPortsModuleName,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableDevicePort,
  unavailableHotUpdatePort,
  unavailableLogUploadPort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  type DevicePort,
} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as stateModuleName, type StateJsonValue} from '@catering-v2s/kernel-base-state';
import {
  createRuntime,
  type CommandDefinition,
  type Runtime,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime';
import {releaseRuntimeForTestAsync} from '@catering-v2s/kernel-base-runtime/testing';
import {
  activateTerminalCommand,
  cancelTerminalOfflineCommand,
  cancelTerminalOnlineCommand,
  connectTerminalCommand,
  createTerminalDataClientModule,
  disconnectTerminalCommand,
  selectActivationState,
  selectConnectionLatency,
  selectConnectionState,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {createServerConfigModule, setServerOverrideCommand} from '@catering-v2s/kernel-base-server-config';
import {resolveServerNetworkSnapshot} from '@catering-v2s/kernel-base-server-config/network-adapter';
import {
  createTransportModule,
  type TransportConnectionEvent,
  type TransportManagedConnection,
  type TransportNetworkAdapter,
} from '@catering-v2s/kernel-base-transport';
import {
  executeManagedTerminalDevAction,
  readManagedTdsLatestState,
} from '../../../../../../scripts/dev/r5-dev-runner.mjs';

const workspaceKey = 'aurora';
const storeCode = 'S-OP';
const storeName = '河畔茶里店';
const clientMaxPayloadBytes = 65_536;
const clientMaxFragments = 1_024;
const fixtureTerminals = Object.freeze([
  {activationCode: '62000001', name: '前台收银终端', surfaceForm: 'laptop' as const},
  {activationCode: '62000002', name: '后厨多打印终端', surfaceForm: 'laptop' as const},
  {activationCode: '62000003', name: '后厨显示终端', surfaceForm: 'laptop' as const},
  {activationCode: '62000004', name: '移动点餐终端', surfaceForm: 'mobile' as const},
  {activationCode: '62000005', name: '标签制作终端', surfaceForm: 'laptop' as const},
]);
const requestId = () => createRequestId();
const scenarioRunId = () => required('V2S_TERMINAL_DEV_ACCEPTANCE_RUN_ID');
const managedDevRunId = () => required('V2S_TERMINAL_DEV_MANAGED_DEV_RUN_ID');
const devManifestPath = () => required('V2S_TERMINAL_DEV_MANIFEST');
const httpBaseUrl = () => required('V2S_TERMINAL_DEV_HTTP_BASE_URL');
const entryOneUrl = () => required('V2S_TERMINAL_DEV_TDS_ENTRY_ONE_WS_URL');
const entryTwoUrl = () => required('V2S_TERMINAL_DEV_TDS_ENTRY_TWO_WS_URL');
const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`TERMINAL_DEV_ACCEPTANCE_ENV_MISSING:${name}`);
  return value;
};

const toolkit = (name: string, dependencies: readonly string[]): RuntimeModule => ({
  moduleName: name,
  kind: 'toolkit',
  dependencies: dependencies.map(moduleName => ({moduleName})),
});

type ScenarioClient = Readonly<{
  readonly alias: string;
  readonly runtime: Runtime;
  readonly close: () => Promise<void>;
}>;

const waitFor = async <T>(
  read: () => T,
  predicate: (value: T) => boolean,
  code: string,
  timeoutMs = 20_000,
  intervalMs = 100,
): Promise<T> => {
  const now = Date.now;
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    const current = read();
    if (predicate(current)) return current;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`TERMINAL_DEV_ACCEPTANCE_TIMEOUT:${code}`);
};

const observeActivationCancelledClose = (runtime: Runtime, code: string, timeoutMs = 15_000): Promise<void> =>
  new Promise((resolve, reject) => {
    let unsubscribe: (() => void) | undefined;
    let unsubscribeAfterRegistration = false;
    let settled = false;
    const stop = () => {
      if (unsubscribe) unsubscribe();
      else unsubscribeAfterRegistration = true;
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      stop();
      reject(new Error(`TERMINAL_DEV_ACCEPTANCE_TIMEOUT:${code}`));
    }, timeoutMs);
    const inspect = () => {
      if (settled || selectConnectionState(runtime.getState()).lastCloseReason !== 'ACTIVATION_CANCELLED') return;
      settled = true;
      clearTimeout(timer);
      stop();
      resolve();
    };
    unsubscribe = runtime.subscribe(inspect);
    if (unsubscribeAfterRegistration) unsubscribe();
    inspect();
  });

const dispatch = async <TPayload extends StateJsonValue>(
  runtime: Runtime,
  command: CommandDefinition<TPayload>,
  payload: TPayload,
): Promise<unknown> => {
  const result = await runtime.dispatchCommand(command, payload, {requestId: requestId()});
  if (result.status !== 'completed') {
    throw new Error(
      `TERMINAL_DEV_ACCEPTANCE_COMMAND_FAILED:${result.status}:${result.actorResults.map(value => value.error?.code ?? 'NO_CODE').join(',')}`,
    );
  }
  const actorResult = result.actorResults[0];
  if (!actorResult) throw new Error('TERMINAL_DEV_ACCEPTANCE_COMMAND_NOT_ROUTED');
  return actorResult.result;
};

const makeDispatcher = (
  proxy: Readonly<{host: string; port: number; username?: string; password?: string}> | undefined,
  timeoutMs: number,
): Agent | ProxyAgent => {
  const limits = {
    connectTimeout: Math.min(timeoutMs, 5_000),
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
    maxResponseSize: clientMaxPayloadBytes,
    webSocket: {maxPayloadSize: clientMaxPayloadBytes, maxFragments: clientMaxFragments},
  };
  if (proxy) {
    const token =
      proxy.username && proxy.password
        ? `Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64')}`
        : undefined;
    return new ProxyAgent({
      uri: `http://${proxy.host}:${proxy.port}`,
      ...(token ? {token} : {}),
      proxyTunnel: true,
      ...limits,
    });
  }
  return new Agent(limits);
};

const httpJson = async (
  base: string,
  pathAndQuery: string,
  init: Readonly<{
    method?: string;
    headers?: Readonly<Record<string, string>>;
    body?: unknown;
    timeoutMs?: number;
    proxy?: Readonly<{host: string; port: number; username?: string; password?: string}>;
  }> = {},
): Promise<Readonly<{status: number; headers: Record<string, string | string[] | undefined>; body: any}>> => {
  const timeoutMs = init.timeoutMs ?? 5_000;
  const dispatcher = makeDispatcher(init.proxy, timeoutMs);
  try {
    const result = await request(new URL(pathAndQuery, `${base.replace(/\/$/, '')}/`), {
      method: init.method ?? 'GET',
      headers: {...(init.headers ?? {}), ...(init.body === undefined ? {} : {'content-type': 'application/json'})},
      ...(init.body === undefined ? {} : {body: JSON.stringify(init.body)}),
      dispatcher,
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
    });
    const body = result.statusCode === 204 ? null : await result.body.json();
    return {status: result.statusCode, headers: result.headers, body};
  } finally {
    await dispatcher.close();
  }
};

const createWebSocketConnection = async (
  addressName: string,
  url: string,
  proxy: Readonly<{host: string; port: number; username?: string; password?: string}> | undefined,
  timeoutMs: number,
  requireCompression = false,
): Promise<TransportManagedConnection> => {
  const dispatcher = makeDispatcher(proxy, timeoutMs);
  const dispatcherDisposal = createAwaitableDisposal(
    () => dispatcher.close(),
    'TERMINAL_DEV_WS_DISPATCHER_CLOSE_FAILED',
  );
  const socket = new WebSocket(url, {dispatcher});
  const listeners = new Set<(event: TransportConnectionEvent) => void>();
  const queued: TransportConnectionEvent[] = [];
  let socketClosePromise: Promise<void> | undefined;
  let handshakeComplete = false;
  const closeSocket = (reason?: string): Promise<void> => {
    if (socketClosePromise !== undefined) return socketClosePromise;
    if (socket.readyState === WebSocket.CLOSED) {
      socketClosePromise = Promise.resolve();
      return socketClosePromise;
    }
    socketClosePromise = new Promise<void>(resolve => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        resolve();
      };
      socket.addEventListener('close', finish, {once: true});
      timer = setTimeout(finish, 1_500);
      try {
        socket.close(1000, (reason ?? 'client stop').slice(0, 100));
      } catch {
        finish();
      }
    });
    return socketClosePromise;
  };
  const emit = (event: TransportConnectionEvent) => {
    if (listeners.size === 0) queued.push(event);
    else for (const listener of [...listeners]) listener(event);
  };
  const opened = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TERMINAL_DEV_WS_HANDSHAKE_TIMEOUT')), timeoutMs + 1_000);
    socket.addEventListener(
      'open',
      () => {
        clearTimeout(timer);
        handshakeComplete = true;
        emit({type: 'open', addressName});
        resolve();
      },
      {once: true},
    );
    socket.addEventListener(
      'error',
      () => {
        clearTimeout(timer);
        reject(new Error('TERMINAL_DEV_WS_HANDSHAKE_FAILED'));
      },
      {once: true},
    );
    socket.addEventListener(
      'close',
      event => {
        clearTimeout(timer);
        emit({type: 'close', code: event.code, reason: event.reason});
        socketClosePromise ??= Promise.resolve();
        void dispatcherDisposal.start();
        if (!handshakeComplete) reject(new Error('TERMINAL_DEV_WS_CLOSED_BEFORE_OPEN'));
      },
      {once: true},
    );
  });
  socket.addEventListener('message', event => emit({type: 'message', raw: String(event.data)}));
  socket.addEventListener('error', () => emit({type: 'error', reason: 'NETWORK_ERROR'}));
  try {
    await opened;
    if (
      requireCompression &&
      !socket.extensions.split(',').some(extension => extension.trim().startsWith('permessage-deflate'))
    ) {
      await closeSocket('compression negotiation failed');
      await dispatcherDisposal.wait();
      throw new Error('TERMINAL_DEV_WS_PERMESSAGE_DEFLATE_NOT_NEGOTIATED');
    }
  } catch (error) {
    try {
      await closeSocket('connection setup failed');
      await dispatcherDisposal.wait();
    } catch {
      throw new Error('TERMINAL_DEV_WS_SETUP_CLEANUP_FAILED');
    }
    throw error;
  }
  return Object.freeze({
    send: async (raw: string) => {
      if (socket.readyState !== WebSocket.OPEN) throw new Error('TERMINAL_DEV_WS_NOT_OPEN');
      socket.send(raw);
    },
    close: async (reason?: string) => {
      await closeSocket(reason);
      await dispatcherDisposal.wait();
    },
    subscribe: (listener: (event: TransportConnectionEvent) => void) => {
      listeners.add(listener);
      for (const event of queued.splice(0)) listener(event);
      return () => {
        listeners.delete(listener);
      };
    },
  });
};

const createScenarioClient = async (alias: string, requireCompression = false): Promise<ScenarioClient> => {
  const httpUrl = httpBaseUrl();
  const wsOne = entryOneUrl();
  const wsTwo = entryTwoUrl();
  const defaults: TransportServerConfig = Object.freeze({
    selectedSpace: 'managed-dev',
    spaces: Object.freeze([
      Object.freeze({
        name: 'managed-dev',
        servers: Object.freeze([
          Object.freeze({
            serverName: 'terminal-business-api',
            addresses: Object.freeze([{addressName: 'business-http', baseUrl: httpUrl, timeoutMs: 5_000}]),
          }),
          Object.freeze({
            serverName: 'terminal-data-server',
            addresses: Object.freeze([
              {addressName: 'tds-entry-one', baseUrl: wsOne, timeoutMs: 5_000},
              {addressName: 'tds-entry-two', baseUrl: wsTwo, timeoutMs: 5_000},
            ]),
          }),
        ]),
      }),
    ]),
  });
  let runtime: Runtime | undefined;
  const adapter: TransportNetworkAdapter = {
    readSnapshot: async serverName => {
      if (!runtime) throw new Error('TERMINAL_DEV_COMPOSITION_NOT_STARTED');
      return resolveServerNetworkSnapshot(runtime.getState(), defaults, serverName);
    },
    connect: async input => {
      const suffix = input.endpointPathAndQuery ?? '/';
      const base = `${input.address.baseUrl.replace(/\/$/, '')}/`;
      const target = new URL(suffix.replace(/^\//, ''), base).toString();
      return createWebSocketConnection(
        input.address.addressName,
        target,
        input.proxy,
        input.address.timeoutMs ?? 5_000,
        requireCompression,
      );
    },
    sendHttp: async input => {
      const response = await httpJson(input.address.baseUrl, input.pathAndQuery, {
        method: input.method,
        headers: input.headers,
        body: input.body,
        timeoutMs: input.timeoutMs,
        proxy: input.proxy,
      });
      return {
        kind: 'response',
        status: response.status,
        body: response.body,
        contentType: String(response.headers['content-type'] ?? ''),
      };
    },
  };
  const transportModule = createTransportModule({networkAdapter: adapter});
  const serverConfigModule = createServerConfigModule(defaults);
  const deviceId = `r5-${alias}-${randomUUID()}`;
  const device: DevicePort = {
    ...unavailableDevicePort,
    getDeviceInfo: async () => ({
      status: 'succeeded',
      value: {deviceId, systemName: 'managed-node', systemVersion: process.version, logicalProcessorCount: 1},
      completedAt: Date.now(),
    }),
  };
  const plainStorage = createProcessMemoryStateStoragePort();
  const protectedStorage = createProcessMemoryStateStoragePort();
  const terminalModule = createTerminalDataClientModule({
    businessServerName: 'terminal-business-api',
    transport: transportModule.commandGateway,
    createCredentialSecret: () => randomBytes(32).toString('base64url'),
    now: Date.now,
    appVersion: 'batch-2-managed-dev-acceptance',
  });
  const modules: readonly RuntimeModule[] = [
    toolkit(contractsModuleName, []),
    toolkit(platformPortsModuleName, [contractsModuleName]),
    toolkit(stateModuleName, [contractsModuleName, platformPortsModuleName]),
    serverConfigModule,
    transportModule,
    terminalModule,
  ];
  const platformPorts = createPlatformPorts({
    environmentMode: 'TEST',
    bindings: {
      logger: {kind: 'sink', write: () => undefined},
      persistKv: plainStorage,
      persistSecure: protectedStorage,
      device,
      appControl: {
        ...unavailableAppControlPort,
        resetRuntime: async ({requestId: resetRequestId}) => ({
          status: 'accepted' as const,
          requestId: resetRequestId,
          acceptedAt: Date.now(),
          terminalObservation: 'SUCCESSOR_RUNTIME_STARTED' as const,
        }),
      },
      script: unavailableScriptPort,
      connector: unavailableConnectorPort,
      hotUpdate: unavailableHotUpdatePort,
      logUpload: unavailableLogUploadPort,
      topologyHost: unavailableTopologyHostPort,
    },
  });
  runtime = createRuntime({
    localNodeId: createNodeId(),
    modules,
    platformPorts,
    state: {
      runtimeName: `managed-dev-${alias}`,
      environmentMode: 'TEST',
      persistenceKey: `managed-dev-${alias}-${randomUUID()}`,
      persistenceDebounceMs: 0,
    },
  });
  await runtime.start();
  return Object.freeze({
    alias,
    runtime,
    close: async () => {
      try {
        await dispatch(runtime!, disconnectTerminalCommand, {});
      } finally {
        await releaseRuntimeForTestAsync(runtime!);
      }
    },
  });
};

const activate = async (
  client: ScenarioClient,
  fixtureIndex: number,
  session: OperationsSession,
): Promise<Readonly<{terminalRef: string; generation: number}>> => {
  const fixture = fixtureTerminals[fixtureIndex];
  if (!fixture) throw new Error('TERMINAL_DEV_FIXTURE_INDEX_INVALID');
  const result = (await dispatch(client.runtime, activateTerminalCommand, {
    operationId: `managed-dev-${client.alias}-${randomUUID()}`,
    groupWorkspaceKey: workspaceKey,
    activationCode: fixture.activationCode,
    surfaceForm: fixture.surfaceForm,
    appVersion: 'batch-2-managed-dev-acceptance',
  })) as {
    status?: string | number;
    terminalRef?: string;
    bindingGeneration?: number;
    kind?: string;
    reason?: string;
    errorCode?: string;
    category?: string;
    code?: string;
  };
  if (result.status !== 'activated' || !result.terminalRef || !Number.isInteger(result.bindingGeneration)) {
    const safeFields = [
      result.status,
      result.kind,
      result.reason,
      result.errorCode,
      result.category,
      result.code,
    ].filter(
      (value): value is string | number =>
        typeof value === 'number' || (typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)),
    );
    throw new Error(`TERMINAL_DEV_ACTIVATION_FAILED:${safeFields.join(':') || 'NO_SAFE_REASON'}`);
  }
  activatedFixtures.push({session, fixtureIndex});
  expect(selectActivationState(client.runtime.getState())).toMatchObject({
    status: 'active',
    terminalRef: result.terminalRef,
  });
  return {terminalRef: result.terminalRef, generation: result.bindingGeneration!};
};

const connect = async (
  client: ScenarioClient,
  timeoutMs = 20_000,
): Promise<Readonly<{nodeId: string; addressName: string}>> => {
  await dispatch(client.runtime, connectTerminalCommand, {});
  const state = await waitFor(
    () => selectConnectionState(client.runtime.getState()),
    value => value.status === 'connected' && Boolean(value.nodeId),
    `SESSION_READY:${client.alias}`,
    timeoutMs,
  );
  if (!state.nodeId || !state.addressName) throw new Error('TERMINAL_DEV_SESSION_READY_IDENTITY_MISSING');
  return {nodeId: state.nodeId, addressName: state.addressName};
};

type OperationsSession = Readonly<{cookie: string; contextVersion: number; storeRef: string}>;
const operationsSession = async (): Promise<OperationsSession> => {
  const password = required('V2S_SEED_OPERATIONS_DEFAULT_PASSWORD');
  const login = await httpJson(httpBaseUrl(), `/api/operations/group-workspaces/${workspaceKey}/password-login`, {
    method: 'POST',
    body: {loginName: 'r5-account-multi-role', password},
  });
  if (login.status !== 200) throw new Error(`TERMINAL_DEV_OPERATIONS_LOGIN_FAILED:${login.status}`);
  const cookieValue = login.headers['set-cookie'];
  const cookie = (Array.isArray(cookieValue) ? cookieValue[0] : cookieValue)?.split(';', 1)[0];
  if (!cookie) throw new Error('TERMINAL_DEV_OPERATIONS_COOKIE_MISSING');
  const session = await httpJson(httpBaseUrl(), `/api/operations/group-workspaces/${workspaceKey}/session/entry`, {
    headers: {cookie},
  });
  if (session.status !== 200) throw new Error(`TERMINAL_DEV_OPERATIONS_SESSION_FAILED:${session.status}`);
  const projectIdentities = (session.body.candidates ?? []).filter(
    (candidate: {roleNodeType?: string}) => candidate.roleNodeType === 'PROJECT',
  );
  if (projectIdentities.length !== 1) throw new Error('TERMINAL_DEV_PROJECT_IDENTITY_INVALID');
  const projectContext = await httpJson(
    httpBaseUrl(),
    `/api/operations/group-workspaces/${workspaceKey}/session/context`,
    {
      method: 'POST',
      headers: {cookie, 'Idempotency-Key': randomUUID()},
      body: {
        roleAssignmentRef: projectIdentities[0].roleAssignmentRef,
        requiredContextVersion: session.body.contextVersion,
      },
    },
  );
  if (projectContext.status !== 200)
    throw new Error(`TERMINAL_DEV_PROJECT_CONTEXT_SELECT_FAILED:${projectContext.status}`);
  const targetStores = (projectContext.body.dataNodeCandidates ?? []).filter(
    (candidate: {dataNodeType?: string; dataNodeCode?: string}) =>
      candidate.dataNodeType === 'STORE' && candidate.dataNodeCode === storeCode,
  );
  if (targetStores.length !== 1 || typeof targetStores[0].dataNodeRef !== 'string')
    throw new Error('TERMINAL_DEV_TARGET_STORE_CANDIDATE_INVALID');
  const project = await httpJson(httpBaseUrl(), `/api/operations/group-workspaces/${workspaceKey}/session/data-node`, {
    method: 'POST',
    headers: {cookie, 'Idempotency-Key': randomUUID()},
    body: {
      dataNodeRef: targetStores[0].dataNodeRef,
      dataNodeType: 'STORE',
      requiredContextVersion: projectContext.body.contextVersion,
    },
  });
  if (project.status !== 200) throw new Error(`TERMINAL_DEV_STORE_CONTEXT_SELECT_FAILED:${project.status}`);
  const selectedStore = project.body.scopeContext?.store;
  if (selectedStore?.dataNodeType !== 'STORE' || selectedStore.dataNodeCode !== storeCode || !selectedStore.dataNodeRef)
    throw new Error('TERMINAL_DEV_STORE_CONTEXT_READBACK_INVALID');
  return {cookie, contextVersion: project.body.contextVersion, storeRef: selectedStore.dataNodeRef};
};

const operationsTerminalByRef = async (session: OperationsSession, terminalRef: string): Promise<any> => {
  const response = await httpJson(
    httpBaseUrl(),
    `/api/operations/group-workspaces/${workspaceKey}/stores/${session.storeRef}/terminals/${terminalRef}`,
    {
      headers: {cookie: session.cookie},
    },
  );
  if (response.status !== 200) throw new Error(`TERMINAL_DEV_TERMINAL_DETAIL_FAILED:${response.status}`);
  return response.body;
};

const operationsTerminal = async (session: OperationsSession, fixtureIndex: number): Promise<any> => {
  const fixture = fixtureTerminals[fixtureIndex];
  if (!fixture) throw new Error('TERMINAL_DEV_FIXTURE_INDEX_INVALID');
  const list = await httpJson(
    httpBaseUrl(),
    `/api/operations/group-workspaces/${workspaceKey}/stores/${session.storeRef}/terminals?query=${encodeURIComponent(fixture.name)}&pageSize=20`,
    {
      headers: {cookie: session.cookie},
    },
  );
  if (list.status !== 200) throw new Error(`TERMINAL_DEV_TERMINAL_LIST_FAILED:${list.status}`);
  const details = await Promise.all(
    (list.body.items ?? []).map((item: {terminalRef: string}) => operationsTerminalByRef(session, item.terminalRef)),
  );
  const detail = details.find(value => value.activationCode === fixture.activationCode);
  if (!detail) throw new Error('TERMINAL_DEV_SEEDED_TERMINAL_NOT_FOUND');
  return detail;
};

const cancelByOperations = async (
  session: OperationsSession,
  terminal: {terminalRef: string; binding: {status: string; generation?: number}},
): Promise<void> => {
  if (terminal.binding?.status === 'INACTIVE') return;
  if (terminal.binding?.status !== 'ACTIVE') throw new Error('TERMINAL_DEV_BINDING_STATE_INVALID');
  const result = await httpJson(
    httpBaseUrl(),
    `/api/operations/group-workspaces/${workspaceKey}/stores/${session.storeRef}/terminals/${terminal.terminalRef}/activation/cancel`,
    {
      method: 'POST',
      headers: {cookie: session.cookie, 'Idempotency-Key': randomUUID()},
      body: {expectedBindingGeneration: terminal.binding.generation},
    },
  );
  if (result.status !== 200) throw new Error(`TERMINAL_DEV_BACKEND_CANCEL_FAILED:${result.status}`);
  const readback = await operationsTerminalByRef(session, terminal.terminalRef);
  if (readback.terminalRef !== terminal.terminalRef) throw new Error('TERMINAL_DEV_BINDING_READBACK_MISMATCH');
  if (readback.binding?.status !== 'INACTIVE') throw new Error('TERMINAL_DEV_BINDING_NOT_INACTIVE');
};

const prepareFixture = async (session: OperationsSession, fixtureIndex: number): Promise<void> => {
  const terminal = await operationsTerminal(session, fixtureIndex);
  await cancelByOperations(session, terminal);
};

const latestState = (terminalRef: string) =>
  readManagedTdsLatestState({manifestPath: devManifestPath(), runId: managedDevRunId(), terminalRef});
const recordLatestState = async (terminalRef: string, predicate: (value: any) => boolean, name: string): Promise<any> =>
  waitFor(
    () => latestState(terminalRef),
    value => value !== null && predicate(value),
    `LATEST_STATE:${name}`,
    15_000,
    1_000,
  );

const setTdsAddresses = async (
  client: ScenarioClient,
  addresses: readonly Readonly<{addressName: string; baseUrl: string; timeoutMs: number}>[],
): Promise<void> => {
  const result = (await dispatch(client.runtime, setServerOverrideCommand, {
    serverName: 'terminal-data-server',
    addresses,
    proxy: null,
  })) as {changed?: boolean};
  if (result.changed !== true && result.changed !== false) throw new Error('TERMINAL_DEV_ADDRESS_OVERRIDE_FAILED');
};

const activeClients: ScenarioClient[] = [];
const activatedFixtures: Array<Readonly<{session: OperationsSession; fixtureIndex: number}>> = [];
const scenarioCleanupFailures: string[] = [];
const scenarioCleanupFailureCodes = new Set([
  'TERMINAL_DEV_TERMINAL_DETAIL_FAILED',
  'TERMINAL_DEV_TERMINAL_LIST_FAILED',
  'TERMINAL_DEV_SEEDED_TERMINAL_NOT_FOUND',
  'TERMINAL_DEV_BACKEND_CANCEL_FAILED',
  'TERMINAL_DEV_BINDING_STATE_INVALID',
  'TERMINAL_DEV_BINDING_READBACK_MISMATCH',
  'TERMINAL_DEV_BINDING_NOT_INACTIVE',
]);
const safeScenarioCleanupFailure = (error: unknown): string => {
  const message = error instanceof Error ? error.message : '';
  const marker = message.split(':', 1)[0];
  if (marker === 'TERMINAL_DEV_BACKEND_CANCEL_FAILED') {
    const status = message.split(':')[1];
    if (status !== undefined && /^[1-5][0-9]{2}$/.test(status)) return `${marker}:${status}`;
  }
  return marker && scenarioCleanupFailureCodes.has(marker) ? marker : 'FIXTURE_RESTORE_FAILED';
};
const managedNodesNeedingRestore = new Set<'tds-a' | 'tds-b'>();
const acceptanceEventsPath = (): string => required('V2S_TERMINAL_DEV_ACCEPTANCE_SCENARIO_EVENTS');
const recordScenarioEvent = (phase: string, details: Readonly<Record<string, unknown>> = {}): void => {
  appendFileSync(
    acceptanceEventsPath(),
    `${JSON.stringify({at: new Date().toISOString(), runId: scenarioRunId(), scenarioId: required('V2S_TERMINAL_DEV_ACCEPTANCE_SCENARIO'), phase, ...details})}\n`,
    {mode: 0o600},
  );
};
beforeEach(() => {
  scenarioCleanupFailures.length = 0;
  managedNodesNeedingRestore.clear();
  recordScenarioEvent('SCENARIO_STARTED');
});
afterEach(async () => {
  for (const instanceName of managedNodesNeedingRestore) {
    scenarioCleanupFailures.push(`TDS_NODE_NOT_RESTORED:${instanceName}`);
  }
  for (const fixture of activatedFixtures.splice(0)) {
    try {
      const current = await operationsTerminal(fixture.session, fixture.fixtureIndex);
      await cancelByOperations(fixture.session, current);
    } catch (error) {
      scenarioCleanupFailures.push(safeScenarioCleanupFailure(error));
    }
  }
  for (const client of activeClients.splice(0)) {
    try {
      await client.close();
    } catch {
      scenarioCleanupFailures.push('CLIENT_RUNTIME_CLOSE_FAILED');
    }
  }
  if (scenarioCleanupFailures.length === 0) recordScenarioEvent('SCENARIO_CLEANUP_PASS');
  else {
    recordScenarioEvent('SCENARIO_CLEANUP_FAIL', {failures: [...new Set(scenarioCleanupFailures)]});
    throw new Error('TERMINAL_DEV_SCENARIO_CLEANUP_FAILED');
  }
});

describe('terminal-data-client managed DEV end-to-end scenarios', () => {
  it('terminal-data-client managed DEV lifecycle activates, receives heartbeats and latency, survives backend cancellation, reactivates and cancels online', async () => {
    const session = await operationsSession();
    await prepareFixture(session, 0);
    const client = await createScenarioClient('ve1', true);
    activeClients.push(client);
    const first = await activate(client, 0, session);
    const connected = await connect(client);
    expect(manifestNodeIds()).toContain(connected.nodeId);
    const initialState = await recordLatestState(
      first.terminalRef,
      value => value.node_id === connected.nodeId && value.disconnected_at_epoch_millis === null,
      'E1_CONNECTED',
    );
    expect(initialState.session_id).toBeTruthy();
    await waitFor(
      () => selectConnectionLatency(client.runtime.getState()),
      value => value.samples.length >= 3 && value.lastRttMs >= 0,
      'E1_THREE_HEARTBEATS',
      125_000,
    );
    const withRtt = await recordLatestState(
      first.terminalRef,
      value => value.node_id === connected.nodeId && value.last_rtt_ms >= 0,
      'E1_RTT_READBACK',
    );
    expect(withRtt.last_rtt_ms).toBeGreaterThanOrEqual(0);
    await cancelByOperations(session, await operationsTerminal(session, 0));
    await waitFor(
      () => selectActivationState(client.runtime.getState()),
      value => value.status === 'inactive',
      'E1_REMOTE_CANCEL_RESET',
      15_000,
    );
    await dispatch(client.runtime, cancelTerminalOfflineCommand, {});
    const second = await activate(client, 0, session);
    expect(second.terminalRef).toBe(first.terminalRef);
    await connect(client);
    const cancelResult = await dispatch(client.runtime, cancelTerminalOnlineCommand, {
      groupWorkspaceKey: workspaceKey,
      terminalRef: second.terminalRef,
    });
    expect(cancelResult).toMatchObject({status: 'CANCELLED'});
    const finalState = await recordLatestState(
      second.terminalRef,
      value => value.disconnected_at_epoch_millis !== null,
      'E1_DISCONNECTED',
    );
    expect(finalState.close_reason).toBe('ACTIVATION_CANCELLED');
  }, 150_000);

  it('terminal-data-client managed DEV retries a nonresponsive configured entry and prefers the reachable address', async () => {
    const session = await operationsSession();
    await prepareFixture(session, 1);
    const client = await createScenarioClient('ve2');
    const blackholeSockets = new Set<import('node:net').Socket>();
    const blackhole = createServer(socket => {
      blackholeSockets.add(socket);
      socket.once('close', () => blackholeSockets.delete(socket));
    });
    activeClients.push(
      Object.freeze({
        ...client,
        close: async () => {
          await client.close();
          for (const socket of blackholeSockets) socket.destroy();
          if (blackhole.listening) await new Promise<void>(resolve => blackhole.close(() => resolve()));
        },
      }),
    );
    await new Promise<void>((resolve, reject) => {
      blackhole.once('error', reject);
      blackhole.listen(0, '127.0.0.1', resolve);
    });
    const address = blackhole.address();
    if (!address || typeof address === 'string') throw new Error('TERMINAL_DEV_BLACKHOLE_BIND_FAILED');
    const activated = await activate(client, 1, session);
    await setTdsAddresses(client, [
      {addressName: 'blackhole', baseUrl: `ws://127.0.0.1:${address.port}`, timeoutMs: 2_500},
      {addressName: 'tds-entry-one', baseUrl: entryOneUrl(), timeoutMs: 5_000},
    ]);
    const startedAt = Date.now();
    const connected = await connect(client, 20_000);
    expect(Date.now() - startedAt).toBeLessThan(20_000);
    expect(connected.addressName).toBe('tds-entry-one');
    const state = await recordLatestState(
      activated.terminalRef,
      value => value.disconnected_at_epoch_millis === null,
      'E2_CONNECTED',
    );
    expect(state.node_id).toBe(connected.nodeId);
    expect(selectConnectionState(client.runtime.getState()).addressName).toBe('tds-entry-one');
  }, 60_000);

  it('terminal-data-client managed DEV preserves an offline credential until backend cancellation and rebinds across devices', async () => {
    const session = await operationsSession();
    await prepareFixture(session, 2);
    const first = await createScenarioClient('ve5-a');
    const second = await createScenarioClient('ve5-b');
    activeClients.push(first, second);
    const original = await activate(first, 2, session);
    const originalNode = await connect(first);
    await dispatch(first.runtime, disconnectTerminalCommand, {});
    expect(selectActivationState(first.runtime.getState())).toMatchObject({
      status: 'active',
      terminalRef: original.terminalRef,
    });
    await cancelByOperations(session, await operationsTerminal(session, 2));
    const rebound = await activate(second, 2, session);
    expect(rebound.terminalRef).toBe(original.terminalRef);
    const secondNode = await connect(second);
    expect(manifestNodeIds()).toContain(secondNode.nodeId);
    const oldCredentialCloseReason = observeActivationCancelledClose(first.runtime, 'E5_OLD_CREDENTIAL_CLOSE_REASON');
    await dispatch(first.runtime, connectTerminalCommand, {});
    await oldCredentialCloseReason;
    await waitFor(
      () => selectActivationState(first.runtime.getState()),
      value => value.status === 'inactive',
      'E5_OLD_CREDENTIAL_REVOKED',
      15_000,
    );
    expect(selectConnectionState(second.runtime.getState())).toMatchObject({
      status: 'connected',
      nodeId: secondNode.nodeId,
    });
    expect(originalNode.nodeId).not.toBe('');
    const ownerReadback = await recordLatestState(
      rebound.terminalRef,
      value => value.disconnected_at_epoch_millis === null,
      'E5_REBOUND_ONLINE',
    );
    expect(ownerReadback.node_id).toBe(secondNode.nodeId);
  }, 90_000);

  it('terminal-data-client managed DEV drains node A, fails node B to entry two, and does not fail back after restart', async () => {
    const session = await operationsSession();
    for (const fixtureIndex of [0, 1, 2, 3]) await prepareFixture(session, fixtureIndex);
    const clients = await Promise.all(['ve6-a', 've6-b', 've6-c', 've6-d'].map(alias => createScenarioClient(alias)));
    activeClients.push(...clients);
    const activations = await Promise.all(clients.map((client, index) => activate(client, index, session)));
    const initial = await Promise.all(clients.map(client => connect(client)));
    recordScenarioEvent('E6_INITIAL_CONNECTIONS', {
      clients: initial.map((connection, index) => ({
        index,
        nodeId: connection.nodeId,
        addressName: connection.addressName,
      })),
    });
    const expectedNodeIds = manifestNodeIds();
    expect(initial.every(value => value.addressName === 'tds-entry-one')).toBe(true);
    expect(initial.map(value => value.nodeId).every(value => expectedNodeIds.includes(value))).toBe(true);
    expect(initial.some(value => value.nodeId === nodeIdFor('tds-a'))).toBe(true);
    expect(initial.some(value => value.nodeId === nodeIdFor('tds-b'))).toBe(true);
    const aClients = clients.filter((_client, index) => initial[index]?.nodeId === nodeIdFor('tds-a'));
    expect(aClients.length).toBeGreaterThan(0);
    const initialStates = await Promise.all(
      activations.map((activation, index) =>
        recordLatestState(
          activation.terminalRef,
          value => value.node_id === initial[index]?.nodeId && value.disconnected_at_epoch_millis === null,
          `E6_INITIAL:${index}`,
        ),
      ),
    );
    const initialSessionIds = initialStates.map(value => value.session_id as string);
    let aRestartAttempted = false;
    let bRestartAttempted = false;
    managedNodesNeedingRestore.add('tds-a');
    try {
      await executeManagedTerminalDevAction({
        manifestPath: devManifestPath(),
        runId: managedDevRunId(),
        action: 'drain-stop-a',
      });
      for (const [index, client] of clients.entries()) {
        const expectedNodeId =
          initial[index]?.nodeId === nodeIdFor('tds-a') ? nodeIdFor('tds-b') : initial[index]?.nodeId;
        let connection: ReturnType<typeof selectConnectionState>;
        try {
          connection = await waitFor(
            () => selectConnectionState(client.runtime.getState()),
            value => value.status === 'connected' && value.nodeId === expectedNodeId,
            `E6_AFTER_A_CONNECTION:${index}`,
            40_000,
          );
        } catch (error) {
          const observed = selectConnectionState(client.runtime.getState());
          recordScenarioEvent('E6_AFTER_A_CONNECTION_WAIT_FAILED', {
            index,
            initialNodeId: initial[index]?.nodeId ?? 'MISSING',
            expectedNodeId: expectedNodeId ?? 'MISSING',
            observedStatus: observed.status,
            observedNodeId: observed.status === 'connected' ? observed.nodeId : null,
            observedAddressName: observed.status === 'connected' ? observed.addressName : null,
            observedCloseReason: [
              'ACTIVATION_CANCELLED',
              'CREDENTIAL_INVALID',
              'GROUP_WORKSPACE_DISABLED',
              'TERMINAL_DISABLED',
              'SESSION_REPLACED',
              'REDIRECT_TO_NEXT_NODE',
              'NODE_BUSY',
              'AUTHENTICATION_TIMEOUT',
              'HEARTBEAT_TIMEOUT',
              'SERVER_ERROR',
              'NETWORK_ERROR',
              'UNKNOWN',
            ].includes(observed.lastCloseReason ?? '')
              ? observed.lastCloseReason
              : observed.lastCloseReason === null
                ? null
                : 'OTHER',
          });
          throw error;
        }
        recordScenarioEvent('E6_AFTER_A_CONNECTION_REACHED', {
          index,
          nodeId: connection.nodeId,
          addressName: connection.addressName,
        });
        const state = await recordLatestState(
          activations[index]!.terminalRef,
          value => value.node_id === expectedNodeId && value.disconnected_at_epoch_millis === null,
          `E6_AFTER_A_STATE:${index}`,
        );
        expect(connection.nodeId).toBe(expectedNodeId);
        if (initial[index]?.nodeId === nodeIdFor('tds-a')) expect(state.session_id).not.toBe(initialSessionIds[index]);
        else expect(state.session_id).toBe(initialSessionIds[index]);
      }
      managedNodesNeedingRestore.add('tds-b');
      await executeManagedTerminalDevAction({
        manifestPath: devManifestPath(),
        runId: managedDevRunId(),
        action: 'drain-force-stop-b',
      });
      const afterBStates = await Promise.all(
        clients.map(async (client, index) => {
          await waitFor(
            () => selectConnectionState(client.runtime.getState()),
            value => value.status === 'connected' && value.nodeId === nodeIdFor('tds-c'),
            `E6_B_TO_C:${index}`,
            40_000,
          );
          const state = await recordLatestState(
            activations[index]!.terminalRef,
            value => value.node_id === nodeIdFor('tds-c') && value.disconnected_at_epoch_millis === null,
            `E6_C_OWNER_READBACK:${index}`,
          );
          expect(state.session_id).not.toBe(initialSessionIds[index]);
          return state;
        }),
      );
      const cancellationCloseReason = observeActivationCancelledClose(clients[0]!.runtime, 'E6_CANCEL_CLOSE_REASON');
      await cancelByOperations(session, await operationsTerminal(session, 0));
      await cancellationCloseReason;
      await waitFor(
        () => selectActivationState(clients[0]!.runtime.getState()),
        value => value.status === 'inactive',
        'E6_CANCEL_ONE',
        15_000,
      );
      const cancelledState = await recordLatestState(
        activations[0]!.terminalRef,
        value => value.node_id === nodeIdFor('tds-c') && value.disconnected_at_epoch_millis !== null,
        'E6_CANCELLED_OWNER_READBACK',
      );
      expect(cancelledState.close_reason).toBe('ACTIVATION_CANCELLED');
      for (let index = 1; index < clients.length; index += 1) {
        expect(selectActivationState(clients[index]!.runtime.getState()).status).toBe('active');
        expect(selectConnectionState(clients[index]!.runtime.getState())).toMatchObject({
          status: 'connected',
          nodeId: nodeIdFor('tds-c'),
          addressName: 'tds-entry-two',
        });
        const state = await recordLatestState(
          activations[index]!.terminalRef,
          value => value.node_id === nodeIdFor('tds-c') && value.disconnected_at_epoch_millis === null,
          `E6_OTHER_CLIENT_UNCHANGED:${index}`,
        );
        expect(state.session_id).toBe(afterBStates[index]?.session_id);
      }
      managedNodesNeedingRestore.add('tds-a');
      aRestartAttempted = true;
      try {
        await executeManagedTerminalDevAction({
          manifestPath: devManifestPath(),
          runId: managedDevRunId(),
          action: 'restart-a',
        });
        managedNodesNeedingRestore.delete('tds-a');
      } catch {
        scenarioCleanupFailures.push('TDS_NODE_A_RESTART_FAILED');
        throw new Error('TERMINAL_DEV_TDS_NODE_A_RESTART_FAILED');
      }
      bRestartAttempted = true;
      try {
        await executeManagedTerminalDevAction({
          manifestPath: devManifestPath(),
          runId: managedDevRunId(),
          action: 'restart-b',
        });
        managedNodesNeedingRestore.delete('tds-b');
      } catch {
        scenarioCleanupFailures.push('TDS_NODE_B_RESTART_FAILED');
        throw new Error('TERMINAL_DEV_TDS_NODE_B_RESTART_FAILED');
      }
      // R-10.3's first reconnect delay is 10 seconds; observe beyond it after A/B are ready.
      await new Promise(resolve => setTimeout(resolve, 11_000));
      expect(selectActivationState(clients[0]!.runtime.getState()).status).toBe('inactive');
      const stillCancelled = await recordLatestState(
        activations[0]!.terminalRef,
        value => value.node_id === nodeIdFor('tds-c') && value.disconnected_at_epoch_millis !== null,
        'E6_CANCELLED_NO_RECONNECT',
      );
      expect(stillCancelled.session_id).toBe(cancelledState.session_id);
      for (let index = 1; index < clients.length; index += 1) {
        expect(selectConnectionState(clients[index]!.runtime.getState())).toMatchObject({
          status: 'connected',
          nodeId: nodeIdFor('tds-c'),
          addressName: 'tds-entry-two',
        });
        const state = await recordLatestState(
          activations[index]!.terminalRef,
          value => value.node_id === nodeIdFor('tds-c') && value.disconnected_at_epoch_millis === null,
          `E6_NO_FAILBACK:${index}`,
        );
        expect(state.session_id).toBe(afterBStates[index]?.session_id);
      }
    } finally {
      if (managedNodesNeedingRestore.has('tds-a') && !aRestartAttempted) {
        try {
          await executeManagedTerminalDevAction({
            manifestPath: devManifestPath(),
            runId: managedDevRunId(),
            action: 'ensure-ready-a',
          });
          managedNodesNeedingRestore.delete('tds-a');
        } catch {
          scenarioCleanupFailures.push('TDS_NODE_A_RESTORE_FAILED');
        }
      }
      if (managedNodesNeedingRestore.has('tds-b') && !bRestartAttempted) {
        try {
          await executeManagedTerminalDevAction({
            manifestPath: devManifestPath(),
            runId: managedDevRunId(),
            action: 'ensure-ready-b',
          });
          managedNodesNeedingRestore.delete('tds-b');
        } catch {
          scenarioCleanupFailures.push('TDS_NODE_B_RESTORE_FAILED');
        }
      }
    }
  }, 300_000);
});

function manifestNodeIds(): string[] {
  const manifest = JSON.parse(readFileSync(devManifestPath(), 'utf8')) as {
    remoteTdsNodes: {instanceName: string; nodeId: string}[];
  };
  return manifest.remoteTdsNodes.map(node => node.nodeId);
}

function nodeIdFor(instanceName: 'tds-a' | 'tds-b' | 'tds-c'): string {
  const manifest = JSON.parse(readFileSync(devManifestPath(), 'utf8')) as {
    remoteTdsNodes: {instanceName: string; nodeId: string}[];
  };
  const node = manifest.remoteTdsNodes.find(value => value.instanceName === instanceName);
  if (!node) throw new Error('TERMINAL_DEV_NODE_MANIFEST_ENTRY_MISSING');
  return node.nodeId;
}

// The test imports the current managed manifest only for run-bound orchestration and
// never writes terminal binding or connection state directly.
