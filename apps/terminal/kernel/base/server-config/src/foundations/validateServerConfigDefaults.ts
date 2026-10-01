import type {
  TransportHttpProxy,
  TransportServerAddress,
  TransportServerConfig,
} from '@catering-v2s/kernel-base-contracts';

const fail = (code: string): never => {
  throw new Error(`SERVER_CONFIG_${code}`);
};

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
type ConfigServer = TransportServerConfig['spaces'][number]['servers'][number];

const validateServer = (server: ConfigServer): void => {
  if (!Array.isArray(server.addresses) || server.addresses.length < 1 || server.addresses.length > 4) {
    fail('DEFAULT_ADDRESS_COUNT_INVALID');
  }
  const addressNames = new Set<string>();
  for (const address of server.addresses) {
    validateServerAddress(address, false);
    if (addressNames.has(address.addressName)) fail('ADDRESS_NAME_DUPLICATE');
    addressNames.add(address.addressName);
  }
  if (server.proxy !== undefined) validateProxy(server.proxy);
};

const validateSpaceServers = (space: TransportServerConfig['spaces'][number]): void => {
  const serverNames = new Set<string>();
  for (const server of space.servers) {
    if (!nonEmpty(server.serverName) || serverNames.has(server.serverName)) fail('DEFAULTS_INVALID');
    serverNames.add(server.serverName);
    validateServer(server);
  }
};

export const validateServerAddress = (address: TransportServerAddress, requireTimeout: boolean): void => {
  if (!nonEmpty(address.addressName)) fail('ADDRESS_NAME_REQUIRED');
  if (!nonEmpty(address.baseUrl)) fail('ADDRESS_URL_REQUIRED');
  let parsed: URL;
  try {
    parsed = new URL(address.baseUrl);
  } catch {
    return fail('ADDRESS_URL_INVALID');
  }
  if (
    !['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol) ||
    parsed.username !== '' ||
    parsed.password !== ''
  ) {
    return fail('ADDRESS_URL_INVALID');
  }
  if (requireTimeout && !Number.isSafeInteger(address.timeoutMs)) fail('OVERRIDE_TIMEOUT_REQUIRED');
  if (address.timeoutMs !== undefined && (!Number.isSafeInteger(address.timeoutMs) || address.timeoutMs <= 0)) {
    fail('ADDRESS_TIMEOUT_INVALID');
  }
};

export const validateProxy = (proxy: TransportHttpProxy): void => {
  if (proxy.protocol !== 'http' || !nonEmpty(proxy.host)) fail('PROXY_INVALID');
  if (!Number.isSafeInteger(proxy.port) || proxy.port < 1 || proxy.port > 65535) fail('PROXY_INVALID');
  const hasUsername = proxy.username !== undefined && proxy.username.length > 0;
  const hasPassword = proxy.password !== undefined && proxy.password.length > 0;
  if (hasUsername !== hasPassword || (proxy.username !== undefined && !hasUsername)) fail('PROXY_CREDENTIALS_INVALID');
};

export const validateServerConfigDefaults = (config: TransportServerConfig): void => {
  if (!nonEmpty(config.selectedSpace) || !Array.isArray(config.spaces) || config.spaces.length === 0) {
    fail('DEFAULTS_INVALID');
  }
  const spaceNames = new Set<string>();
  for (const space of config.spaces) {
    if (!nonEmpty(space.name) || spaceNames.has(space.name) || !Array.isArray(space.servers)) fail('DEFAULTS_INVALID');
    spaceNames.add(space.name);
    validateSpaceServers(space);
  }
  if (!spaceNames.has(config.selectedSpace)) fail('DEFAULT_SPACE_MISSING');
};

export const defaultServiceNames = (config: TransportServerConfig): readonly string[] =>
  [...new Set(config.spaces.flatMap(space => space.servers.map(server => server.serverName)))].sort();
