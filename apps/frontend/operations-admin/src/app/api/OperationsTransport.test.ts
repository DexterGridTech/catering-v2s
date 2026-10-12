import {beforeEach, describe, expect, it, vi} from 'vitest';

const transport = vi.hoisted(() => ({
  dispatch: vi.fn(),
  initiate: vi.fn(),
}));

vi.mock('../state/OperationsStore', () => ({operationsStore: {dispatch: transport.dispatch}}));
vi.mock('./OperationsApi', () => ({
  abortOperationsRequests: vi.fn(),
  operationsApi: {
    endpoints: new Proxy({}, {get: () => ({initiate: transport.initiate})}),
    util: {resetApiState: vi.fn()},
  },
  operationsContentTabRefreshSignal: {publish: vi.fn()},
  operationsLogger: {error: vi.fn()},
  operationsRefreshSignal: {publish: vi.fn()},
  registerOperationsUnauthorizedRecovery: vi.fn(),
}));
vi.mock('@catering-v2s/admin-ui-foundation', () => ({
  readCurrentDefinitionRevision: vi.fn(),
  readExtensionFilterInvalidFields: vi.fn(),
  transportResponseStatus: vi.fn(),
}));

import {operationsClient} from './OperationsTransport';

describe('operations imperative query transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transport.dispatch.mockImplementation(action => action);
  });

  it('forces each repeated GET to fetch the current owner read instead of reusing RTK Query cache', async () => {
    const firstRead = {state: 'STARTING', reason: null, description: null};
    const currentDescription = {sessionId: 'session-current'};
    const latestRead = {state: 'STARTING', reason: null, description: currentDescription};
    const results = [firstRead, latestRead];
    transport.initiate.mockImplementation(() => ({
      unwrap: vi.fn().mockResolvedValue(results.shift()),
      unsubscribe: vi.fn(),
      reset: vi.fn(),
    }));

    const path = {
      groupWorkspaceKey: 'mixc',
      projectRef: '00000000-0000-4000-8000-000000000001',
      terminalRef: '00000000-0000-4000-8000-000000000002',
      sessionId: '00000000-0000-4000-8000-000000000003',
    } as never;
    const options = {query: {expectedContextVersion: 7}};

    const waiting = await operationsClient.getOperationsTerminalRemoteControl(path, options);
    const registered = await operationsClient.getOperationsTerminalRemoteControl(path, options);

    expect(waiting.description).toBeNull();
    expect(registered.description).toEqual(currentDescription);
    expect(transport.initiate).toHaveBeenCalledTimes(2);
    for (const [, initiateOptions] of transport.initiate.mock.calls) {
      expect(initiateOptions).toEqual({subscribe: false, forceRefetch: true});
    }
  });
});
