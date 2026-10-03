import {afterEach, describe, expect, it, vi} from 'vitest';
import {createBrowserTransportNetworkAdapter} from '../src/foundations/createBrowserTransportNetworkAdapter';

afterEach(() => vi.unstubAllGlobals());

describe('browser transport adapter', () => {
  it('appends generated operation suffix and query to the currently selected base URL', async () => {
    const fetch = vi.fn(
      async (..._args: Parameters<typeof globalThis.fetch>) =>
        new Response('{"accepted":true}', {
          status: 200,
          headers: {'content-type': 'application/json'},
        }),
    );
    vi.stubGlobal('fetch', fetch);
    const adapter = createBrowserTransportNetworkAdapter(async serverName =>
      Object.freeze({
        serverName,
        revision: 3,
        addresses: Object.freeze([
          {addressName: 'selected', baseUrl: 'https://api.example.test/group-workspaces/work%2Fone/'},
        ]),
      }),
    );
    const snapshot = await adapter.readSnapshot('business');

    const result = await adapter.sendHttp!({
      address: snapshot.addresses[0]!,
      method: 'POST',
      pathAndQuery: '/activate?source=ter%2Fweb',
      headers: {},
      body: {activationCode: '00123456'},
      timeoutMs: 5_000,
    });

    expect(fetch.mock.calls[0]?.[0]).toBe(
      'https://api.example.test/group-workspaces/work%2Fone/activate?source=ter%2Fweb',
    );
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: '{"activationCode":"00123456"}',
    });
    expect(result).toMatchObject({kind: 'response', status: 200, body: {accepted: true}});
  });

  it('refuses browser-side proxy credentials without sending the request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const adapter = createBrowserTransportNetworkAdapter(async serverName =>
      Object.freeze({
        serverName,
        revision: 1,
        addresses: Object.freeze([{addressName: 'selected', baseUrl: 'https://api.example.test'}]),
        proxy: Object.freeze({
          protocol: 'http',
          host: 'proxy.example.test',
          port: 8080,
          username: 'staff',
          password: 'secret',
        }),
      }),
    );
    const snapshot = await adapter.readSnapshot('business');
    const result = await adapter.sendHttp!({
      address: snapshot.addresses[0]!,
      proxy: snapshot.proxy,
      method: 'GET',
      pathAndQuery: '/health',
      headers: {},
      timeoutMs: 1_000,
    });

    expect(result).toEqual({kind: 'failure', category: 'not-delivered', code: 'BROWSER_TRANSPORT_PROXY_UNSUPPORTED'});
    expect(fetch).not.toHaveBeenCalled();
  });

  it('cancels response reading once the declared HTTP response byte ceiling is exceeded', async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(65_536));
        controller.enqueue(new Uint8Array(1));
      },
      cancel() {
        cancelled = true;
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, {status: 200})),
    );
    const adapter = createBrowserTransportNetworkAdapter(async serverName =>
      Object.freeze({
        serverName,
        revision: 1,
        addresses: Object.freeze([{addressName: 'selected', baseUrl: 'https://api.example.test'}]),
      }),
    );
    const snapshot = await adapter.readSnapshot('business');

    const result = await adapter.sendHttp!({
      address: snapshot.addresses[0]!,
      method: 'GET',
      pathAndQuery: '/activation',
      headers: {},
      timeoutMs: 1_000,
    });

    expect(cancelled).toBe(true);
    expect(result).toEqual({kind: 'failure', category: 'not-delivered', code: 'BROWSER_HTTP_RESPONSE_TOO_LARGE'});
  });
});
