import {describe, expect, it} from 'vitest';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {resolveServerConfigEnvironment} from '../src/foundations/resolveServerConfigEnvironment';

const defaults: TransportServerConfig = Object.freeze({
  selectedSpace: 'development',
  spaces: Object.freeze([
    Object.freeze({
      name: 'development',
      servers: Object.freeze([
        Object.freeze({
          serverName: 'business',
          addresses: Object.freeze([
            Object.freeze({addressName: 'primary', baseUrl: 'http://127.0.0.1:28080/api/terminal/group-workspaces/dev', timeoutMs: 10000}),
          ]),
        }),
        Object.freeze({
          serverName: 'terminal-data-server',
          addresses: Object.freeze([
            Object.freeze({addressName: 'haproxy-entry-one', baseUrl: 'ws://127.0.0.1:28180', timeoutMs: 10000}),
            Object.freeze({addressName: 'haproxy-entry-two', baseUrl: 'ws://127.0.0.1:28181', timeoutMs: 10000}),
          ]),
        }),
      ]),
    }),
    Object.freeze({
      name: 'production',
      servers: Object.freeze([
        Object.freeze({
          serverName: 'business',
          addresses: Object.freeze([
            Object.freeze({addressName: 'primary', baseUrl: 'https://business.example.test/api', timeoutMs: 10000}),
          ]),
        }),
      ]),
    }),
  ]),
});

describe('server-config environment resolver', () => {
  it.each([1, 2, 10])('replaces a service with its complete %i-address set by name', count => {
    const addresses = Array.from({length: count}, (_, index) => ({
      addressName: index === 0 ? 'primary' : `edge-${index + 1}`,
      baseUrl: `https://edge-${index + 1}.example.test/api`,
      ...(index === 0 ? {} : {timeoutMs: 5000 + index}),
    }));
    const result = resolveServerConfigEnvironment(defaults, {
      spaceName: 'development',
      servers: [{serverName: 'business', addresses}],
    });

    expect(result.selectedSpace).toBe('development');
    expect(result.spaces[0]?.servers[0]?.addresses).toHaveLength(count);
    expect(result.spaces[0]?.servers[0]?.addresses[0]).toEqual({...addresses[0], timeoutMs: 10000});
    expect(result.spaces[0]?.servers[1]?.addresses).toEqual(defaults.spaces[0]?.servers[1]?.addresses);
    expect(result.spaces[1]).toEqual(defaults.spaces[1]);
    expect(result.spaces[0]?.servers[0]?.addresses.map(address => address.addressName)).toEqual(
      addresses.map(address => address.addressName),
    );
  });

  it('rejects unknown names, duplicate identities, empty sets, invalid URLs, and missing timeout for a new address', () => {
    const base = {spaceName: 'development', servers: [{serverName: 'business', addresses: []}]};
    expect(() => resolveServerConfigEnvironment(defaults, {...base, spaceName: 'missing'})).toThrow(
      'SERVER_CONFIG_ENVIRONMENT_SPACE_UNKNOWN',
    );
    expect(() =>
      resolveServerConfigEnvironment(defaults, {
        spaceName: 'development',
        servers: [{serverName: 'missing', addresses: [{addressName: 'x', baseUrl: 'https://x.test', timeoutMs: 1000}]}],
      }),
    ).toThrow('SERVER_CONFIG_ENVIRONMENT_SERVICE_UNKNOWN');
    expect(() =>
      resolveServerConfigEnvironment(defaults, {
        spaceName: 'development',
        servers: [
          {serverName: 'business', addresses: [{addressName: 'primary', baseUrl: 'https://x.test'}]},
          {serverName: 'business', addresses: [{addressName: 'primary', baseUrl: 'https://y.test'}]},
        ],
      }),
    ).toThrow('SERVER_CONFIG_ENVIRONMENT_SERVICE_DUPLICATE_OR_INVALID');
    expect(() => resolveServerConfigEnvironment(defaults, base)).toThrow('SERVER_CONFIG_ENVIRONMENT_ADDRESS_SET_EMPTY');
    expect(() =>
      resolveServerConfigEnvironment(defaults, {
        spaceName: 'development',
        servers: [{serverName: 'business', addresses: [{addressName: 'primary', baseUrl: 'not-a-url'}]}],
      }),
    ).toThrow('SERVER_CONFIG_ADDRESS_URL_INVALID');
    expect(() =>
      resolveServerConfigEnvironment(defaults, {
        spaceName: 'development',
        servers: [{serverName: 'business', addresses: [{addressName: 'new', baseUrl: 'https://new.test'}]}],
      }),
    ).toThrow('SERVER_CONFIG_ENVIRONMENT_ADDRESS_TIMEOUT_REQUIRED');
  });
});
