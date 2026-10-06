import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import type {TransportHttpProxy, TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {serverConfigSliceName} from '../features/slices/serverConfig';
import type {
  EffectiveServerConfigView,
  ServerConfigOverrideState,
  ServerConfigState,
  ServerNetworkSnapshot,
} from '../types/serverConfig';

const readState = (state: StateRoot): ServerConfigState => {
  const slice = state[serverConfigSliceName];
  if (slice === undefined || slice === null) throw new Error('SERVER_CONFIG_STATE_MISSING');
  return slice as ServerConfigState;
};

const effectiveDefaults = (current: ServerConfigState, defaults: TransportServerConfig): TransportServerConfig =>
  current.syncedHostDefaults ?? defaults;

const maskProxy = (
  proxy: TransportHttpProxy | null | undefined,
): EffectiveServerConfigView['defaults'][number]['servers'][number]['proxy'] => {
  if (proxy === null || proxy === undefined) return null;
  return Object.freeze({
    protocol: proxy.protocol,
    host: proxy.host,
    port: proxy.port,
    ...(proxy.username === undefined ? {} : {username: proxy.username}),
    passwordConfigured: proxy.password !== undefined,
  });
};

const mergeProxy = (
  defaultProxy: TransportHttpProxy | undefined,
  override: ServerConfigOverrideState | undefined,
  passwordOverride: string | undefined,
): TransportHttpProxy | undefined => {
  if (override === undefined) return defaultProxy;
  if (override.proxy === null) return undefined;
  const {proxy} = override;
  return Object.freeze({
    ...proxy,
    ...(passwordOverride === undefined ? {} : {password: passwordOverride}),
  });
};

const resolveServerNetworkSnapshotImplementation = (
  state: StateRoot,
  defaults: TransportServerConfig,
  serverName: string,
): ServerNetworkSnapshot => {
  const current = readState(state);
  const effective = effectiveDefaults(current, defaults);
  const selectedSpace =
    effective.spaces.find(space => space.name === current.selectedSpace) ??
    effective.spaces.find(space => space.name === effective.selectedSpace);
  const server = selectedSpace?.servers.find(item => item.serverName === serverName);
  if (server === undefined) throw new Error('SERVER_CONFIG_SERVICE_UNAVAILABLE');
  const override = current.overrides[serverName];
  const proxy = mergeProxy(server.proxy, override, current.proxyPasswords[serverName]);
  return Object.freeze({
    serverName,
    revision: current.serviceRevisions[serverName] ?? 0,
    addresses: override?.addresses ?? server.addresses,
    ...(proxy === undefined ? {} : {proxy}),
  });
};

const selectServerConfigurationImplementation = (
  state: StateRoot,
  defaults: TransportServerConfig,
): EffectiveServerConfigView => {
  const current = readState(state);
  const effective = effectiveDefaults(current, defaults);
  const spaces = effective.spaces.map(space => ({
    name: space.name,
    servers: space.servers.map(server => {
      const override = current.overrides[server.serverName];
      const proxy = mergeProxy(server.proxy, override, current.proxyPasswords[server.serverName]);
      return Object.freeze({
        serverName: server.serverName,
        addresses: override?.addresses ?? server.addresses,
        proxy: maskProxy(proxy),
        proxyPasswordOverridden: current.proxyPasswords[server.serverName] !== undefined,
        overridden: override !== undefined,
      });
    }),
  }));
  const defaultViews = effective.spaces.map(space => ({
    name: space.name,
    servers: space.servers.map(server =>
      Object.freeze({
        serverName: server.serverName,
        addresses: server.addresses,
        proxy: maskProxy(server.proxy),
      }),
    ),
  }));
  return Object.freeze({
    source: current.syncedHostDefaults === null ? 'package-defaults' : 'host-sync',
    selectedSpace: effective.spaces.some(space => space.name === current.selectedSpace)
      ? current.selectedSpace
      : effective.selectedSpace,
    spaces: Object.freeze(spaces.map(space => Object.freeze({...space, servers: Object.freeze(space.servers)}))),
    defaults: Object.freeze(
      defaultViews.map(space => Object.freeze({...space, servers: Object.freeze(space.servers)})),
    ),
    overriddenServerNames: Object.freeze(Object.keys(current.overrides).sort()),
  });
};

export const selectServerConfiguration = defineStateSelector(moduleName, 'selectServerConfiguration', {
  parameters: [
    {
      kind: 'object',
      properties: {
        selectedSpace: {kind: 'string'},
        spaces: {
          kind: 'array',
          items: {
            kind: 'object',
            properties: {
              name: {kind: 'string'},
              servers: {
                kind: 'array',
                items: {
                  kind: 'object',
                  properties: {
                    serverName: {kind: 'string'},
                    addresses: {
                      kind: 'array',
                      items: {
                        kind: 'object',
                        properties: {
                          addressName: {kind: 'string'},
                          baseUrl: {kind: 'string'},
                          timeoutMs: {kind: 'number', optional: true},
                        },
                      },
                    },
                    proxy: {
                      kind: 'object',
                      properties: {
                        protocol: {kind: 'enum', values: ['http']},
                        host: {kind: 'string'},
                        port: {kind: 'number'},
                        username: {kind: 'string', optional: true},
                        password: {kind: 'string', optional: true},
                      },
                      optional: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  ],
  selector: selectServerConfigurationImplementation,
});
export const resolveServerNetworkSnapshot = defineStateSelector(moduleName, 'resolveServerNetworkSnapshot', {
  parameters: [
    {
      kind: 'object',
      properties: {
        selectedSpace: {kind: 'string'},
        spaces: {
          kind: 'array',
          items: {
            kind: 'object',
            properties: {
              name: {kind: 'string'},
              servers: {
                kind: 'array',
                items: {
                  kind: 'object',
                  properties: {
                    serverName: {kind: 'string'},
                    addresses: {
                      kind: 'array',
                      items: {
                        kind: 'object',
                        properties: {
                          addressName: {kind: 'string'},
                          baseUrl: {kind: 'string'},
                          timeoutMs: {kind: 'number', optional: true},
                        },
                      },
                    },
                    proxy: {
                      kind: 'object',
                      properties: {
                        protocol: {kind: 'enum', values: ['http']},
                        host: {kind: 'string'},
                        port: {kind: 'number'},
                        username: {kind: 'string', optional: true},
                        password: {kind: 'string', optional: true},
                      },
                      optional: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    {kind: 'string'},
  ],
  selector: resolveServerNetworkSnapshotImplementation,
});
