import {beforeEach, describe, expect, it, vi} from 'vitest';

const {nativeRequest} = vi.hoisted(() => ({nativeRequest: vi.fn()}));

vi.mock('expo-modules-core', () => ({requireNativeModule: () => ({request: nativeRequest})}));

import {createAndroidTransportNetworkAdapter} from '../src/foundations/androidTransportNetworkAdapter';

describe('Android transport HTTP response diagnostics', () => {
  beforeEach(() => nativeRequest.mockReset());

  it('passes only bounded safe request and correlation IDs from the native response', async () => {
    nativeRequest.mockResolvedValue({
      status: 409,
      bodyText: '{"errorCode":"TERMINAL_BINDING_CREDENTIAL_INVALID"}',
      contentType: 'application/problem+json',
      requestId: 'req-android-001',
      correlationId: 'corr-android-001',
    });
    const adapter = createAndroidTransportNetworkAdapter(async () => {
      throw new Error('snapshot is not used by direct sendHttp');
    });

    const result = await adapter.sendHttp?.({
      address: {addressName: 'primary', baseUrl: 'http://127.0.0.1:28080'},
      method: 'POST',
      pathAndQuery: '/activation/cancel',
      headers: {},
      timeoutMs: 5_000,
      proxy: undefined,
    });

    expect(result).toMatchObject({
      kind: 'response',
      status: 409,
      requestId: 'req-android-001',
      correlationId: 'corr-android-001',
      body: {errorCode: 'TERMINAL_BINDING_CREDENTIAL_INVALID'},
    });
    expect(nativeRequest).toHaveBeenCalledWith(
      'http://127.0.0.1:28080/activation/cancel',
      'POST',
      {},
      null,
      5_000,
      null,
    );
  });

  it('forwards response identity fields unchanged for the transport owner to validate', async () => {
    nativeRequest.mockResolvedValue({
      status: 200,
      bodyText: '{"outcome":"CANCELLED"}',
      contentType: 'application/json',
      requestId: 'req-android-001\nAuthorization: secret',
      correlationId: 'c'.repeat(129),
    });
    const adapter = createAndroidTransportNetworkAdapter(async () => {
      throw new Error('snapshot is not used by direct sendHttp');
    });

    const result = await adapter.sendHttp?.({
      address: {addressName: 'primary', baseUrl: 'http://127.0.0.1:28080'},
      method: 'POST',
      pathAndQuery: '/activation/cancel',
      headers: {},
      timeoutMs: 5_000,
      proxy: undefined,
    });

    expect(result).toEqual({
      kind: 'response',
      status: 200,
      body: {outcome: 'CANCELLED'},
      contentType: 'application/json',
      requestId: 'req-android-001\nAuthorization: secret',
      correlationId: 'c'.repeat(129),
    });
  });
});
