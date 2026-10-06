import {randomUUID} from 'node:crypto';
import {Agent, ProxyAgent, request} from 'undici';

export type OperationsFixture = Readonly<{
  readonly activationCode: string;
  readonly name: string;
  readonly surfaceForm?: 'laptop' | 'mobile';
}>;

export type OperationsFixtureSession = Readonly<{cookie: string; contextVersion: number; storeRef: string}>;

export type OperationsTerminal = Readonly<{
  readonly terminalRef: string;
  readonly activationCode?: string;
  readonly binding?: Readonly<{status: string; generation?: number}>;
}>;

export type OperationsStore = Readonly<{
  readonly id: string;
  readonly groupWorkspaceKey: string;
  readonly code: string;
  readonly name: string;
  readonly status: 'ENABLED' | 'DISABLED' | 'VOIDED';
  readonly headCompany?: Readonly<{id: string}>;
  readonly notes?: string | null;
  readonly extensionValues: Readonly<Record<string, unknown>>;
  readonly extensionRuleRevision: number;
  readonly revision: number;
  readonly updatedAt: number;
  readonly operatingRuleSwitches: Readonly<Record<string, unknown>>;
}>;

export type OperationsFixtureRequestOptions = Readonly<{
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly timeoutMs?: number;
  readonly proxy?: Readonly<{host: string; port: number; username?: string; password?: string}>;
}>;

export type OperationsFixtureHttpResponse = Readonly<{
  readonly status: number;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: any;
}>;

export type OperationsFixtureHttpJson = (
  base: string,
  pathAndQuery: string,
  init?: OperationsFixtureRequestOptions,
) => Promise<OperationsFixtureHttpResponse>;

export const createAcceptanceDispatcher = (
  proxy: OperationsFixtureRequestOptions['proxy'],
  timeoutMs: number,
): Agent | ProxyAgent => {
  const limits = {
    connectTimeout: Math.min(timeoutMs, 5_000),
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
    maxResponseSize: 65_536,
    webSocket: {maxPayloadSize: 65_536, maxFragments: 1_024},
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

export const httpJson: OperationsFixtureHttpJson = async (base, pathAndQuery, init = {}) => {
  const timeoutMs = init.timeoutMs ?? 5_000;
  const dispatcher = createAcceptanceDispatcher(init.proxy, timeoutMs);
  try {
    const result = await request(new URL(pathAndQuery, `${base.replace(/\/$/u, '')}/`), {
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

export type OperationsFixtureClientInput = Readonly<{
  readonly httpBaseUrl: string;
  readonly workspaceKey: string;
  readonly storeCode: string;
  readonly loginName: string;
  readonly password: string;
  readonly fixtures: readonly OperationsFixture[];
  readonly requestJson?: OperationsFixtureHttpJson;
}>;

export type ExistingActiveFixturePolicy = 'CANCEL_ACTIVE' | 'REQUIRE_INACTIVE';

const problemCode = (body: unknown): string => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return 'UNCLASSIFIED';
  const record = body as Record<string, unknown>;
  const nested = typeof record.problem === 'object' && record.problem !== null ? record.problem : undefined;
  const code = record.code ?? record.problemCode ?? (nested as Record<string, unknown> | undefined)?.code;
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,95}$/u.test(code) ? code : 'UNCLASSIFIED';
};

export const createOperationsFixtureClient = (input: OperationsFixtureClientInput) => {
  const send = input.requestJson ?? httpJson;
  const workspacePath = `/api/operations/group-workspaces/${encodeURIComponent(input.workspaceKey)}`;

  const operationsSession = async (): Promise<OperationsFixtureSession> => {
    const login = await send(`${input.httpBaseUrl}`, `${workspacePath}/password-login`, {
      method: 'POST',
      body: {loginName: input.loginName, password: input.password},
    });
    if (login.status !== 200) throw new Error(`TERMINAL_DEV_OPERATIONS_LOGIN_FAILED:${login.status}`);
    const cookieValue = login.headers['set-cookie'];
    const cookie = (Array.isArray(cookieValue) ? cookieValue[0] : cookieValue)?.split(';', 1)[0];
    if (!cookie) throw new Error('TERMINAL_DEV_OPERATIONS_COOKIE_MISSING');
    const session = await send(`${input.httpBaseUrl}`, `${workspacePath}/session/entry`, {headers: {cookie}});
    if (session.status !== 200) throw new Error(`TERMINAL_DEV_OPERATIONS_SESSION_FAILED:${session.status}`);
    const candidates = session.body?.candidates;
    const projectIdentities = Array.isArray(candidates)
      ? candidates.filter((candidate: {roleNodeType?: string}) => candidate.roleNodeType === 'PROJECT')
      : [];
    if (projectIdentities.length !== 1 || typeof projectIdentities[0].roleAssignmentRef !== 'string') {
      throw new Error('TERMINAL_DEV_PROJECT_IDENTITY_INVALID');
    }
    const projectContext = await send(`${input.httpBaseUrl}`, `${workspacePath}/session/context`, {
      method: 'POST',
      headers: {cookie, 'Idempotency-Key': randomUUID()},
      body: {
        roleAssignmentRef: projectIdentities[0].roleAssignmentRef,
        requiredContextVersion: session.body.contextVersion,
      },
    });
    if (projectContext.status !== 200)
      throw new Error(`TERMINAL_DEV_PROJECT_CONTEXT_SELECT_FAILED:${projectContext.status}`);
    const dataNodeCandidates = projectContext.body?.dataNodeCandidates;
    const targetStores = Array.isArray(dataNodeCandidates)
      ? dataNodeCandidates.filter(
          (candidate: {dataNodeType?: string; dataNodeCode?: string}) =>
            candidate.dataNodeType === 'STORE' && candidate.dataNodeCode === input.storeCode,
        )
      : [];
    if (targetStores.length !== 1 || typeof targetStores[0].dataNodeRef !== 'string') {
      throw new Error('TERMINAL_DEV_TARGET_STORE_CANDIDATE_INVALID');
    }
    const selected = await send(`${input.httpBaseUrl}`, `${workspacePath}/session/data-node`, {
      method: 'POST',
      headers: {cookie, 'Idempotency-Key': randomUUID()},
      body: {
        dataNodeRef: targetStores[0].dataNodeRef,
        dataNodeType: 'STORE',
        requiredContextVersion: projectContext.body.contextVersion,
      },
    });
    if (selected.status !== 200) throw new Error(`TERMINAL_DEV_STORE_CONTEXT_SELECT_FAILED:${selected.status}`);
    const store = selected.body?.scopeContext?.store;
    if (
      store?.dataNodeType !== 'STORE' ||
      store.dataNodeCode !== input.storeCode ||
      typeof store.dataNodeRef !== 'string'
    ) {
      throw new Error('TERMINAL_DEV_STORE_CONTEXT_READBACK_INVALID');
    }
    return Object.freeze({cookie, contextVersion: selected.body.contextVersion, storeRef: store.dataNodeRef});
  };

  const operationsTerminalByRef = async (
    session: OperationsFixtureSession,
    terminalRef: string,
  ): Promise<OperationsTerminal> => {
    const response = await send(
      input.httpBaseUrl,
      `${workspacePath}/stores/${encodeURIComponent(session.storeRef)}/terminals/${encodeURIComponent(terminalRef)}`,
      {headers: {cookie: session.cookie}},
    );
    if (response.status !== 200) throw new Error(`TERMINAL_DEV_TERMINAL_DETAIL_FAILED:${response.status}`);
    if (response.body?.terminalRef !== terminalRef) throw new Error('TERMINAL_DEV_BINDING_READBACK_MISMATCH');
    return response.body as OperationsTerminal;
  };

  const operationsStore = async (session: OperationsFixtureSession): Promise<OperationsStore> => {
    const response = await send(
      input.httpBaseUrl,
      `${workspacePath}/organization/stores/${encodeURIComponent(session.storeRef)}?expectedContextVersion=${session.contextVersion}`,
      {headers: {cookie: session.cookie}},
    );
    if (response.status !== 200) throw new Error(`TERMINAL_DEV_STORE_DETAIL_FAILED:${response.status}`);
    const store = response.body;
    if (
      store?.id !== session.storeRef ||
      store?.groupWorkspaceKey !== input.workspaceKey ||
      typeof store.name !== 'string' ||
      !['ENABLED', 'DISABLED', 'VOIDED'].includes(store.status) ||
      !Number.isInteger(store.revision) ||
      !Number.isInteger(store.extensionRuleRevision) ||
      !Number.isInteger(store.updatedAt) ||
      typeof store.extensionValues !== 'object' ||
      store.extensionValues === null ||
      Array.isArray(store.extensionValues) ||
      typeof store.operatingRuleSwitches !== 'object' ||
      store.operatingRuleSwitches === null ||
      Array.isArray(store.operatingRuleSwitches)
    ) {
      throw new Error('TERMINAL_DEV_STORE_DETAIL_INVALID');
    }
    return store as OperationsStore;
  };

  const updateOperationsStore = async (
    session: OperationsFixtureSession,
    store: OperationsStore,
    update: Readonly<{name?: string; notes?: string | null}>,
  ): Promise<OperationsStore> => {
    if (store.id !== session.storeRef || store.groupWorkspaceKey !== input.workspaceKey) {
      throw new Error('TERMINAL_DEV_STORE_UPDATE_IDENTITY_MISMATCH');
    }
    const response = await send(
      input.httpBaseUrl,
      `${workspacePath}/organization/stores/${encodeURIComponent(store.id)}`,
      {
        method: 'PATCH',
        headers: {cookie: session.cookie, 'Idempotency-Key': randomUUID()},
        body: {
          name: update.name ?? store.name,
          headCompanyId: store.headCompany?.id ?? null,
          notes: update.notes === undefined ? (store.notes ?? null) : update.notes,
          extensionValues: store.extensionValues,
          extensionRuleRevision: store.extensionRuleRevision,
          expectedVersion: store.revision,
          operatingRuleSwitches: store.operatingRuleSwitches,
        },
      },
    );
    if (response.status !== 200) {
      throw new Error(`TERMINAL_DEV_STORE_UPDATE_FAILED:${response.status}:${problemCode(response.body)}`);
    }
    const updated = response.body;
    if (
      updated?.id !== store.id ||
      updated?.groupWorkspaceKey !== input.workspaceKey ||
      updated.revision !== store.revision + 1 ||
      typeof updated.updatedAt !== 'number'
    ) {
      throw new Error('TERMINAL_DEV_STORE_UPDATE_READBACK_INVALID');
    }
    return updated as OperationsStore;
  };

  const operationsTerminal = async (
    session: OperationsFixtureSession,
    fixtureIndex: number,
  ): Promise<OperationsTerminal> => {
    const fixture = input.fixtures[fixtureIndex];
    if (!fixture) throw new Error('TERMINAL_DEV_FIXTURE_INDEX_INVALID');
    const list = await send(
      input.httpBaseUrl,
      `${workspacePath}/stores/${encodeURIComponent(session.storeRef)}/terminals?query=${encodeURIComponent(fixture.name)}&pageSize=20`,
      {headers: {cookie: session.cookie}},
    );
    if (list.status !== 200) throw new Error(`TERMINAL_DEV_TERMINAL_LIST_FAILED:${list.status}`);
    const items = Array.isArray(list.body?.items) ? list.body.items : [];
    const details = await Promise.all(
      items.map((item: {terminalRef?: string}) => {
        if (typeof item.terminalRef !== 'string') throw new Error('TERMINAL_DEV_TERMINAL_LIST_ITEM_INVALID');
        return operationsTerminalByRef(session, item.terminalRef);
      }),
    );
    const matches = details.filter(value => value.activationCode === fixture.activationCode);
    if (matches.length !== 1) throw new Error('TERMINAL_DEV_SEEDED_TERMINAL_NOT_UNIQUE');
    return matches[0];
  };

  const cancelByOperations = async (
    session: OperationsFixtureSession,
    terminal: OperationsTerminal,
  ): Promise<OperationsTerminal> => {
    if (terminal.binding?.status === 'INACTIVE') return terminal;
    if (terminal.binding?.status !== 'ACTIVE' || !Number.isInteger(terminal.binding.generation)) {
      throw new Error('TERMINAL_DEV_BINDING_STATE_INVALID');
    }
    const result = await send(
      input.httpBaseUrl,
      `${workspacePath}/stores/${encodeURIComponent(session.storeRef)}/terminals/${encodeURIComponent(terminal.terminalRef)}/activation/cancel`,
      {
        method: 'POST',
        headers: {cookie: session.cookie, 'Idempotency-Key': randomUUID()},
        body: {expectedBindingGeneration: terminal.binding.generation},
      },
    );
    if (result.status !== 200) throw new Error(`TERMINAL_DEV_BACKEND_CANCEL_FAILED:${result.status}`);
    const readback = await operationsTerminalByRef(session, terminal.terminalRef);
    if (readback.binding?.status !== 'INACTIVE') throw new Error('TERMINAL_DEV_BINDING_NOT_INACTIVE');
    return readback;
  };

  const prepareFixture = async (
    session: OperationsFixtureSession,
    fixtureIndex: number,
    activePolicy: ExistingActiveFixturePolicy = 'CANCEL_ACTIVE',
  ): Promise<OperationsTerminal> => {
    const current = await operationsTerminal(session, fixtureIndex);
    let prepared = current;
    if (current.binding?.status === 'ACTIVE') {
      if (activePolicy === 'REQUIRE_INACTIVE') throw new Error('TERMINAL_DEV_FIXTURE_ALREADY_ACTIVE');
      prepared = await cancelByOperations(session, current);
    } else if (current.binding?.status !== 'INACTIVE') {
      throw new Error('TERMINAL_DEV_BINDING_STATE_INVALID');
    }
    if (prepared.binding?.status !== 'INACTIVE') throw new Error('TERMINAL_DEV_BINDING_NOT_INACTIVE');
    return prepared;
  };

  return Object.freeze({
    operationsSession,
    operationsTerminalByRef,
    operationsStore,
    updateOperationsStore,
    operationsTerminal,
    cancelByOperations,
    prepareFixture,
  });
};
