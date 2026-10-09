import {describe, expect, it} from 'vitest';
import {
  createTerminalApiClient,
  isTerminalActivationResult,
  isTerminalStoreActiveContractsRead,
  terminalOperationContracts,
} from '../src/generated/terminalApi';
import type {TerminalRequestExecutor, TerminalResponseMap} from '../src/generated/terminalApi';

describe('generated terminal API contract', () => {
  it('selects the two terminal-binding operations and all canonical TDP reads with their wire metadata', () => {
    expect(Object.keys(terminalOperationContracts)).toEqual([
      'activateTerminal',
      'cancelTerminalActivation',
      'issueTerminalUpdateArtifactDownloadGrant',
      'submitTerminalUpdateReport',
      'terminalReadContract',
      'terminalReadProjectUpdateRuleSnapshotPage',
      'terminalReadServicePoint',
      'terminalReadServicePointArea',
      'terminalReadStoreActiveContracts',
      'terminalReadStoreBasic',
      'terminalReadStoreOrganizationPath',
      'terminalReadStoreServicePointAreas',
      'terminalReadStoreServicePoints',
    ]);
    expect(terminalOperationContracts.activateTerminal.authorizationMode).toBe('NONE');
    expect(terminalOperationContracts.cancelTerminalActivation.authorizationMode).toBe('TERMINAL_CREDENTIAL');
    expect(terminalOperationContracts.activateTerminal.owner).toBe('terminal-binding');
    expect(terminalOperationContracts.activateTerminal.idempotencyRequired).toBe(false);
    expect(terminalOperationContracts.activateTerminal.safeRetryable).toBe(true);
    expect(terminalOperationContracts.activateTerminal.errorCodes).toContain('TERMINAL_BINDING_ALREADY_BOUND');
    expect(terminalOperationContracts.cancelTerminalActivation.idempotencyRequired).toBe(false);
    expect(terminalOperationContracts.terminalReadStoreActiveContracts.authorizationMode).toBe('TERMINAL_CREDENTIAL');
  });

  it('validates nested owner schemas and array items instead of accepting a wrapper or rejecting every array', () => {
    const contract = {
      id: '00000000-0000-4000-8000-000000000001',
      groupWorkspaceKey: 'mixc',
      project: {id: 'project-1', code: 'P1', name: 'Project'},
      store: {id: 'store-1', code: 'S1', name: 'Store'},
      tenant: {id: 'tenant-1', code: 'T1', name: 'Tenant'},
      phaseName: 'Current',
      contractNo: 'C-1',
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      extensionValues: {},
      extensionRuleRevision: 1,
      status: 'VALID',
      revision: 1,
      source: 'MANUAL',
      createdAt: 1,
      updatedAt: 2,
      items: [{code: 'BASE', name: 'Base'}],
    } as const;
    expect(isTerminalStoreActiveContractsRead({items: [contract], collectionUpdatedAtEpochMillis: 2})).toBe(true);
    expect(
      isTerminalStoreActiveContractsRead({
        items: [{...contract, items: [{code: 3, name: 'Base'}]}],
        collectionUpdatedAtEpochMillis: 2,
      }),
    ).toBe(false);
  });

  it('provides typed request parts and classifies success, business rejection, and delivery failures', async () => {
    const body: TerminalResponseMap['activateTerminal'] = {
      terminalRef: '00000000-0000-4000-8000-000000000001',
      storeRef: '00000000-0000-4000-8000-000000000002',
      groupWorkspaceKey: 'group-1',
      bindingGeneration: 1,
    };
    const execute: TerminalRequestExecutor = async (descriptor, request) => {
      expect(descriptor.operationId).toBe('activateTerminal');
      expect(descriptor.safeRetryable).toBe(true);
      expect(descriptor.path).toBe('/activation');
      expect(request.pathParameters).toEqual({});
      expect(request.queryParameters).toEqual({});
      expect(request.headers).toEqual({});
      return {kind: 'response', status: 200, body};
    };
    const client = createTerminalApiClient(execute);
    const result = await client.activateTerminal({
      pathParameters: {},
      queryParameters: {},
      headers: {},
      body: {
        activationCode: '12345678',
        deviceId: 'device-1',
        surfaceForm: 'laptop',
        appVersion: 'test',
        credentialSecret: 'A'.repeat(43),
        futureArray: [1, {enabled: true}],
        futureObject: {nested: ['value']},
        futureLongString: 'x'.repeat(1024),
      },
    });
    expect(result).toEqual({kind: 'success', status: 200, body});
    expect(isTerminalActivationResult(body)).toBe(true);

    const cancellation = createTerminalApiClient(async (descriptor, request) => {
      expect(descriptor.operationId).toBe('cancelTerminalActivation');
      expect(descriptor.path).toBe('/terminals/{terminalRef}/activation/cancel');
      expect(descriptor.owner).toBe('terminal-binding');
      expect(descriptor.idempotencyRequired).toBe(false);
      expect(request.headers.Authorization).toBe('Terminal 1.' + 'A'.repeat(43));
      return {
        kind: 'response',
        status: 401,
        body: {
          type: 'about:blank',
          title: 'Invalid credential',
          status: 401,
          detail: 'invalid',
          errorCode: 'TERMINAL_BINDING_CREDENTIAL_INVALID',
          correlationId: 'correlation-123',
          future: {ignored: true},
        },
      };
    });
    const rejected = await cancellation.cancelTerminalActivation({
      pathParameters: {terminalRef: '00000000-0000-4000-8000-000000000001'},
      queryParameters: {},
      headers: {Authorization: 'Terminal 1.' + 'A'.repeat(43)},
      body: {bindingGeneration: 1, deviceId: 'device-1'},
    });
    expect(rejected).toMatchObject({kind: 'business-rejection', errorCode: 'TERMINAL_BINDING_CREDENTIAL_INVALID'});

    const invalidSuccess = createTerminalApiClient(async () => ({
      kind: 'response',
      status: 200,
      body: {terminalRef: 7},
    }));
    await expect(
      invalidSuccess.activateTerminal({
        pathParameters: {},
        queryParameters: {},
        headers: {},
        body: {
          activationCode: '12345678',
          deviceId: 'device-1',
          surfaceForm: 'laptop',
          appVersion: 'test',
          credentialSecret: 'A'.repeat(43),
        },
      }),
    ).resolves.toEqual({kind: 'failure', category: 'delivered-failure', code: 'TERMINAL_RESPONSE_SCHEMA_INVALID'});

    const unknownProblem = createTerminalApiClient(async () => ({
      kind: 'response',
      status: 409,
      body: {
        type: 'about:blank',
        title: 'New error',
        status: 409,
        detail: 'updated server',
        errorCode: 'NEW_SERVER_ERROR',
        correlationId: 'correlation-123',
      },
    }));
    await expect(
      unknownProblem.activateTerminal({
        pathParameters: {},
        queryParameters: {},
        headers: {},
        body: {
          activationCode: '12345678',
          deviceId: 'device-1',
          surfaceForm: 'laptop',
          appVersion: 'test',
          credentialSecret: 'A'.repeat(43),
        },
      }),
    ).resolves.toEqual({kind: 'failure', category: 'unknown-business-rejection', code: 'NEW_SERVER_ERROR'});

    const deliveryFailure: TerminalRequestExecutor = async () => ({
      kind: 'failure',
      category: 'not-delivered',
      code: 'network',
    });
    await expect(
      createTerminalApiClient(deliveryFailure).activateTerminal({
        pathParameters: {},
        queryParameters: {},
        headers: {},
        body: {
          activationCode: '12345678',
          deviceId: 'device-1',
          surfaceForm: 'laptop',
          appVersion: 'test',
          credentialSecret: 'A'.repeat(43),
        },
      }),
    ).resolves.toEqual({kind: 'failure', category: 'not-delivered', code: 'network'});
  });
});

// @ts-expect-error A new executor failure category must require generator protocol updates.
const unsupportedExecutor: TerminalRequestExecutor = async () => ({kind: 'new-failure-category'});
void unsupportedExecutor;
