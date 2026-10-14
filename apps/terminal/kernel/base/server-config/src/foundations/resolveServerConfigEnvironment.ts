import type {TransportServerAddress, TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {validateServerAddress, validateServerConfigDefaults} from './validateServerConfigDefaults.ts';

export type ServerConfigEnvironment = Readonly<{
  readonly spaceName: string;
  readonly servers: readonly Readonly<{
    readonly serverName: string;
    readonly addresses: readonly Readonly<{
      readonly addressName: string;
      readonly baseUrl: string;
      readonly timeoutMs?: number;
    }>[];
  }>[];
}>;

const fail = (code: string): never => {
  throw new Error(`SERVER_CONFIG_ENVIRONMENT_${code}`);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Parses the single automation/environment input before the normal resolver validates its values. */
export const parseServerConfigEnvironmentJson = (value: string): ServerConfigEnvironment => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return fail('JSON_INVALID');
  }
  if (!isRecord(parsed) || typeof parsed.spaceName !== 'string' || !Array.isArray(parsed.servers)) {
    return fail('INVALID');
  }
  for (const server of parsed.servers) {
    if (!isRecord(server) || typeof server.serverName !== 'string' || !Array.isArray(server.addresses)) {
      return fail('INVALID');
    }
    for (const address of server.addresses) {
      if (
        !isRecord(address) ||
        typeof address.addressName !== 'string' ||
        typeof address.baseUrl !== 'string' ||
        (address.timeoutMs !== undefined &&
          (!Number.isSafeInteger(address.timeoutMs) || (address.timeoutMs as number) <= 0))
      ) {
        return fail('INVALID');
      }
    }
  }
  return parsed as ServerConfigEnvironment;
};

/** Applies complete, name-keyed service address sets to one entry's package defaults. */
export const resolveServerConfigEnvironment = (
  defaults: TransportServerConfig,
  environment: ServerConfigEnvironment,
): TransportServerConfig => {
  validateServerConfigDefaults(defaults);
  if (
    typeof environment.spaceName !== 'string' ||
    !Array.isArray(environment.servers)
  ) {
    return fail('INVALID');
  }
  const targetSpace = defaults.spaces.find(space => space.name === environment.spaceName);
  if (targetSpace === undefined) return fail('SPACE_UNKNOWN');

  const seenServices = new Set<string>();
  const replacements = new Map<string, readonly TransportServerAddress[]>();
  for (const override of environment.servers) {
    if (typeof override.serverName !== 'string' || seenServices.has(override.serverName)) {
      return fail('SERVICE_DUPLICATE_OR_INVALID');
    }
    seenServices.add(override.serverName);
    const defaultServer = targetSpace.servers.find(server => server.serverName === override.serverName);
    if (defaultServer === undefined) return fail('SERVICE_UNKNOWN');
    if (!Array.isArray(override.addresses) || override.addresses.length === 0) {
      return fail('ADDRESS_SET_EMPTY');
    }

    const seenAddresses = new Set<string>();
    const addresses = override.addresses.map((address: ServerConfigEnvironment['servers'][number]['addresses'][number]) => {
      if (
        typeof address.addressName !== 'string' ||
        typeof address.baseUrl !== 'string' ||
        seenAddresses.has(address.addressName)
      ) {
        return fail('ADDRESS_DUPLICATE_OR_INVALID');
      }
      seenAddresses.add(address.addressName);
      const inheritedTimeout = defaultServer.addresses.find(
        candidate => candidate.addressName === address.addressName,
      )?.timeoutMs;
      const timeoutMs = address.timeoutMs ?? inheritedTimeout;
      if (timeoutMs === undefined) return fail('ADDRESS_TIMEOUT_REQUIRED');
      const normalized = Object.freeze({
        addressName: address.addressName,
        baseUrl: address.baseUrl,
        timeoutMs,
      });
      validateServerAddress(normalized, true);
      return normalized;
    });
    replacements.set(override.serverName, Object.freeze(addresses));
  }

  const spaces = defaults.spaces.map(space => {
    if (space.name !== environment.spaceName) return space;
    return Object.freeze({
      ...space,
      servers: Object.freeze(
        space.servers.map(server => {
          const addresses = replacements.get(server.serverName);
          return addresses === undefined ? server : Object.freeze({...server, addresses});
        }),
      ),
    });
  });
  const resolved = Object.freeze({selectedSpace: environment.spaceName, spaces: Object.freeze(spaces)});
  validateServerConfigDefaults(resolved);
  return resolved;
};
