import type packageJson from '../../package.json';

type ServerSpaces = typeof packageJson.serverSpaces;

export type ManagedServerSpaceEnvironment = Readonly<{
  readonly automationBuild: string | undefined;
  readonly businessBaseUrl: string | undefined;
  readonly tdsEntryOneUrl: string | undefined;
  readonly tdsEntryTwoUrl: string | undefined;
}>;

const fail = (code: string): never => {
  throw new Error(code);
};

const parseManagedUrl = (value: string, protocol: 'http:' | 'ws:'): URL => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail('TERMINAL_AUTOMATION_MANAGED_SERVER_URL_INVALID');
  }
  if (
    url.protocol !== protocol ||
    url.hostname !== '127.0.0.1' ||
    url.port === '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    return fail('TERMINAL_AUTOMATION_MANAGED_SERVER_URL_INVALID');
  }
  return url;
};

/** Test-build-only composition override; server-config remains the runtime address owner. */
export const resolveManagedServerSpaces = (
  defaults: ServerSpaces,
  environment: ManagedServerSpaceEnvironment,
): ServerSpaces => {
  if (environment.automationBuild !== 'true') return defaults;
  const values = [environment.businessBaseUrl, environment.tdsEntryOneUrl, environment.tdsEntryTwoUrl];
  if (values.every(value => value === undefined || value.length === 0)) return defaults;
  if (values.some(value => value === undefined || value.length === 0)) {
    return fail('TERMINAL_AUTOMATION_MANAGED_SERVER_URLS_INCOMPLETE');
  }
  const business = parseManagedUrl(environment.businessBaseUrl!, 'http:');
  const tdsOne = parseManagedUrl(environment.tdsEntryOneUrl!, 'ws:');
  const tdsTwo = parseManagedUrl(environment.tdsEntryTwoUrl!, 'ws:');
  if (
    business.pathname !== '/api/terminal/group-workspaces/aurora' ||
    (tdsOne.pathname !== '' && tdsOne.pathname !== '/') ||
    (tdsTwo.pathname !== '' && tdsTwo.pathname !== '/') ||
    tdsOne.port === tdsTwo.port ||
    business.port === tdsOne.port ||
    business.port === tdsTwo.port
  ) {
    return fail('TERMINAL_AUTOMATION_MANAGED_SERVER_URL_INVALID');
  }

  let replacedBusiness = 0;
  let replacedTdsOne = 0;
  let replacedTdsTwo = 0;
  const spaces = defaults.spaces.map(space => {
    if (space.name !== defaults.selectedSpace) return space;
    const servers = space.servers.map(server => {
      if (server.serverName === 'business') {
        const addresses = server.addresses.map(address => {
          if (address.addressName !== 'primary') return address;
          replacedBusiness += 1;
          return Object.freeze({...address, baseUrl: business.toString()});
        });
        return Object.freeze({...server, addresses: Object.freeze(addresses)});
      }
      if (server.serverName === 'terminal-data-server') {
        const addresses = server.addresses.map(address => {
          if (address.addressName === 'haproxy-entry-one') {
            replacedTdsOne += 1;
            return Object.freeze({...address, baseUrl: tdsOne.toString()});
          }
          if (address.addressName === 'haproxy-entry-two') {
            replacedTdsTwo += 1;
            return Object.freeze({...address, baseUrl: tdsTwo.toString()});
          }
          return address;
        });
        return Object.freeze({...server, addresses: Object.freeze(addresses)});
      }
      return server;
    });
    return Object.freeze({...space, servers: Object.freeze(servers)});
  });
  if (replacedBusiness !== 1 || replacedTdsOne !== 1 || replacedTdsTwo !== 1) {
    return fail('TERMINAL_AUTOMATION_MANAGED_SERVER_ADDRESS_MISSING');
  }
  return Object.freeze({...defaults, spaces: Object.freeze(spaces)}) as ServerSpaces;
};
