import {describe, expect, it} from 'vitest';
import {
  createTerminalApiClient,
  buildTerminalHttpCommandRequest,
  isTerminalActivationResult,
  terminalOperationContracts,
} from '../src/generated/terminalApi';
import type {TerminalRequestExecutor, TerminalResponseMap} from '../src/generated/terminalApi';

describe('generated terminal API contract', () => {
  it('keeps only the two terminal-binding operations in the credential owner client', () => {
    expect(Object.keys(terminalOperationContracts)).toEqual([
      'activateTerminal',
      'cancelTerminalActivation',
    ]);
    expect(terminalOperationContracts.activateTerminal.authorizationMode).toBe('NONE');
    expect(terminalOperationContracts.cancelTerminalActivation.authorizationMode).toBe('TERMINAL_CREDENTIAL');
    expect(terminalOperationContracts.activateTerminal.owner).toBe('terminal-binding');
    expect(terminalOperationContracts.activateTerminal.idempotencyRequired).toBe(false);
    expect(terminalOperationContracts.activateTerminal.safeRetryable).toBe(true);
    expect(terminalOperationContracts.activateTerminal.errorCodes).toContain('TERMINAL_BINDING_ALREADY_BOUND');
    expect(terminalOperationContracts.cancelTerminalActivation.idempotencyRequired).toBe(false);
  });

  it('builds relative HTTP requests from the generated descriptor without adding credential headers', () => {
    const request = buildTerminalHttpCommandRequest(terminalOperationContracts.cancelTerminalActivation, {
      pathParameters: {terminalRef: 'terminal/one'},
      queryParameters: {},
      headers: {},
    });
    expect(request).toEqual({
      method: 'POST',
      pathAndQuery: '/terminals/terminal%2Fone/activation/cancel',
      headers: {},
      body: {kind: 'empty'},
      safeRetryable: true,
    });
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
      expect(request.headers).toEqual({});
      expect(request).not.toHaveProperty('body');
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
      headers: {},
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
    ).resolves.toEqual({
      kind: 'failure',
      category: 'delivered-failure',
      code: 'TERMINAL_RESPONSE_SCHEMA_INVALID',
      status: 200,
    });

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
    ).resolves.toEqual({
      kind: 'failure',
      category: 'unknown-business-rejection',
      code: 'NEW_SERVER_ERROR',
      status: 409,
    });

    const untypedForbidden = createTerminalApiClient(async () => ({
      kind: 'response',
      status: 403,
      body: {detail: 'access denied'},
    }));
    await expect(
      untypedForbidden.activateTerminal({
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
    ).resolves.toEqual({kind: 'failure', category: 'delivered-failure', code: 'HTTP_DELIVERED_FAILURE', status: 403});

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
