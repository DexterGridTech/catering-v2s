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

export const resolveServerNetworkSnapshot = (
  state: StateRoot,
  defaults: TransportServerConfig,
  serverName: string,
): ServerNetworkSnapshot => {
  const current = readState(state);
  const selectedSpace = defaults.spaces.find(space => space.name === current.selectedSpace) ??
    defaults.spaces.find(space => space.name === defaults.selectedSpace);
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

export const selectServerConfiguration = (
  state: StateRoot,
  defaults: TransportServerConfig,
): EffectiveServerConfigView => {
  const current = readState(state);
  const spaces = defaults.spaces.map(space => ({
    name: space.name,
    servers: space.servers.map(server => {
      const override = current.overrides[server.serverName];
      const proxy = mergeProxy(server.proxy, override, current.proxyPasswords[server.serverName]);
      return Object.freeze({
        serverName: server.serverName,
        addresses: override?.addresses ?? server.addresses,
        proxy: maskProxy(proxy),
        overridden: override !== undefined,
      });
    }),
  }));
  const defaultViews = defaults.spaces.map(space => ({
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
    selectedSpace: defaults.spaces.some(space => space.name === current.selectedSpace)
      ? current.selectedSpace
      : defaults.selectedSpace,
    spaces: Object.freeze(spaces.map(space => Object.freeze({...space, servers: Object.freeze(space.servers)}))),
    defaults: Object.freeze(defaultViews.map(space => Object.freeze({...space, servers: Object.freeze(space.servers)}))),
    overriddenServerNames: Object.freeze(Object.keys(current.overrides).sort()),
  });
};
