import {describe, expect, it} from 'vitest';
import {
  createOperationsFixtureClient,
  type OperationsFixtureHttpJson,
  type OperationsFixtureHttpResponse,
} from './operationsFixture';

const makeFixtureRequest = () => {
  const calls: Array<{path: string; method: string; body: any; headers: Record<string, string>}> = [];
  let binding = {status: 'ACTIVE', generation: 9};
  let store = {
    id: 'store-1',
    groupWorkspaceKey: 'aurora',
    code: 'S-OP',
    name: 'Original store',
    notes: 'Original notes' as string | null,
    status: 'ENABLED' as 'ENABLED' | 'DISABLED' | 'VOIDED',
    headCompany: {id: 'head-1'},
    extensionValues: {legacy: 'kept'},
    extensionRuleRevision: 3,
    revision: 7,
    updatedAt: 100,
    operatingRuleSwitches: {reservationEnabled: true},
  };
  const requestJson: OperationsFixtureHttpJson = async (base, pathAndQuery, init = {}) => {
    const path = new URL(pathAndQuery, base).pathname;
    const method = init.method ?? 'GET';
    calls.push({path, method, body: init.body, headers: {...(init.headers ?? {})}});
    let response: OperationsFixtureHttpResponse;
    if (path.endsWith('/password-login')) {
      response = {status: 200, headers: {'set-cookie': 'operations-session=test-cookie; Path=/'}, body: {}};
    } else if (path.endsWith('/session/entry')) {
      response = {
        status: 200,
        headers: {},
        body: {contextVersion: 2, candidates: [{roleNodeType: 'PROJECT', roleAssignmentRef: 'project-1'}]},
      };
    } else if (path.endsWith('/session/context')) {
      response = {
        status: 200,
        headers: {},
        body: {
          contextVersion: 3,
          dataNodeCandidates: [{dataNodeType: 'STORE', dataNodeCode: 'S-OP', dataNodeRef: 'store-1'}],
        },
      };
    } else if (path.endsWith('/session/data-node')) {
      response = {
        status: 200,
        headers: {},
        body: {
          contextVersion: 4,
          scopeContext: {store: {dataNodeType: 'STORE', dataNodeCode: 'S-OP', dataNodeRef: 'store-1'}},
        },
      };
    } else if (path.endsWith('/organization/stores/store-1') && method === 'GET') {
      response = {status: 200, headers: {}, body: store};
    } else if (path.endsWith('/organization/stores/store-1') && method === 'PATCH') {
      expect(init.headers?.cookie).toBe('operations-session=test-cookie');
      expect(init.headers?.['Idempotency-Key']).toEqual(expect.any(String));
      expect(init.body).toMatchObject({
        headCompanyId: 'head-1',
        extensionValues: {legacy: 'kept'},
        extensionRuleRevision: 3,
        expectedVersion: 7,
        operatingRuleSwitches: {reservationEnabled: true},
      });
      const body = init.body as {name: string; notes: string | null};
      store = {...store, name: body.name, notes: body.notes, revision: store.revision + 1, updatedAt: 101};
      response = {status: 200, headers: {}, body: store};
    } else if (path.endsWith('/terminals') && method === 'GET') {
      response = {status: 200, headers: {}, body: {items: [{terminalRef: 'terminal-1'}]}};
    } else if (path.endsWith('/terminal-1/activation/cancel') && method === 'POST') {
      expect((init.body as {expectedBindingGeneration?: number}).expectedBindingGeneration).toBe(9);
      binding = {status: 'INACTIVE', generation: 9};
      response = {status: 200, headers: {}, body: {outcome: 'CANCELLED'}};
    } else if (path.endsWith('/terminals/terminal-1')) {
      response = {
        status: 200,
        headers: {},
        body: {terminalRef: 'terminal-1', activationCode: '62000001', binding},
      };
    } else {
      throw new Error(`UNEXPECTED_OPERATIONS_FIXTURE_REQUEST:${method}:${path}`);
    }
    return response;
  };
  return {calls, requestJson};
};

const createClient = (requestJson: OperationsFixtureHttpJson) =>
  createOperationsFixtureClient({
    httpBaseUrl: 'http://dev.invalid',
    workspaceKey: 'aurora',
    storeCode: 'S-OP',
    loginName: 'r5-account-multi-role',
    password: 'fixture-password',
    fixtures: [{activationCode: '62000001', name: '前台收银终端', surfaceForm: 'laptop'}],
    requestJson,
  });

describe('TDC operations fixture', () => {
  it('uses explicit credentials, selects PROJECT and STORE, and reads the uniquely matched terminal', async () => {
    const fake = makeFixtureRequest();
    const client = createClient(fake.requestJson);

    const session = await client.operationsSession();
    const terminal = await client.operationsTerminal(session, 0);

    expect(session).toEqual({cookie: 'operations-session=test-cookie', contextVersion: 4, storeRef: 'store-1'});
    expect(terminal).toMatchObject({terminalRef: 'terminal-1', binding: {status: 'ACTIVE'}});
    expect(fake.calls.map(call => call.path)).toEqual([
      '/api/operations/group-workspaces/aurora/password-login',
      '/api/operations/group-workspaces/aurora/session/entry',
      '/api/operations/group-workspaces/aurora/session/context',
      '/api/operations/group-workspaces/aurora/session/data-node',
      '/api/operations/group-workspaces/aurora/stores/store-1/terminals',
      '/api/operations/group-workspaces/aurora/stores/store-1/terminals/terminal-1',
    ]);
    expect(fake.calls[0]?.body).toEqual({loginName: 'r5-account-multi-role', password: 'fixture-password'});
    expect(fake.calls.slice(1).every(call => call.headers.cookie === 'operations-session=test-cookie')).toBe(true);
  });

  it('rejects an active REQUIRE_INACTIVE fixture without cancelling another run binding', async () => {
    const fake = makeFixtureRequest();
    const client = createClient(fake.requestJson);
    const session = await client.operationsSession();

    await expect(client.prepareFixture(session, 0, 'REQUIRE_INACTIVE')).rejects.toThrow(
      'TERMINAL_DEV_FIXTURE_ALREADY_ACTIVE',
    );

    expect(fake.calls.some(call => call.path.endsWith('/activation/cancel'))).toBe(false);
  });

  it('cancels an active fixture by expected generation and verifies inactive readback', async () => {
    const fake = makeFixtureRequest();
    const client = createClient(fake.requestJson);
    const session = await client.operationsSession();

    const terminal = await client.prepareFixture(session, 0, 'CANCEL_ACTIVE');

    expect(terminal.binding?.status).toBe('INACTIVE');
    const cancel = fake.calls.find(call => call.path.endsWith('/activation/cancel'));
    expect(cancel?.body).toEqual({expectedBindingGeneration: 9});
    expect(fake.calls.filter(call => call.path.endsWith('/terminals/terminal-1'))).toHaveLength(2);
  });

  it('reads and updates the selected store through the real owner endpoint shape', async () => {
    const fake = makeFixtureRequest();
    const client = createClient(fake.requestJson);
    const session = await client.operationsSession();
    const before = await client.operationsStore(session);

    const changed = await client.updateOperationsStore(session, before, {notes: 'run-marker'});
    const after = await client.operationsStore(session);

    expect(before).toMatchObject({id: 'store-1', name: 'Original store', revision: 7, updatedAt: 100});
    expect(changed).toMatchObject({id: 'store-1', name: 'Original store', notes: 'run-marker', revision: 8});
    expect(after).toMatchObject({notes: 'run-marker', revision: 8, updatedAt: 101});
    expect(
      fake.calls.filter(call => call.path.endsWith('/organization/stores/store-1')).map(call => call.method),
    ).toEqual(['GET', 'PATCH', 'GET']);
  });

  it('rejects missing or duplicate fixture matches instead of selecting an arbitrary terminal', async () => {
    const duplicateRequest: OperationsFixtureHttpJson = async (base, pathAndQuery, init = {}) => {
      const response = await makeFixtureRequest().requestJson(base, pathAndQuery, init);
      if (pathAndQuery.includes('/terminals?')) {
        return {status: 200, headers: {}, body: {items: [{terminalRef: 'terminal-1'}, {terminalRef: 'terminal-1'}]}};
      }
      return response;
    };
    const client = createClient(duplicateRequest);
    const session = await client.operationsSession();

    await expect(client.operationsTerminal(session, 0)).rejects.toThrow('TERMINAL_DEV_SEEDED_TERMINAL_NOT_UNIQUE');
    await expect(client.operationsTerminal(session, 1)).rejects.toThrow('TERMINAL_DEV_FIXTURE_INDEX_INVALID');
  });
});
