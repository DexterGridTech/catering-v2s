import {
  parseServerConfigEnvironmentJson,
  type ServerConfigEnvironment,
} from '@catering-v2s/kernel-base-server-config/environment';

export const parseServerConfigEnvironment = parseServerConfigEnvironmentJson;

export const serverConfigAddress = (
  environment: ServerConfigEnvironment,
  serverName: string,
  addressName: string,
): ServerConfigEnvironment['servers'][number]['addresses'][number] => {
  const address = environment.servers
    .find(server => server.serverName === serverName)
    ?.addresses.find(candidate => candidate.addressName === addressName);
  if (address === undefined) throw new Error('TERMINAL_AUTOMATION_SERVER_CONFIG_ADDRESS_MISSING');
  return address;
};

export const groupWorkspaceKeyFromServerConfig = (environment: ServerConfigEnvironment): string => {
  const url = new URL(serverConfigAddress(environment, 'business', 'primary').baseUrl);
  const match = /^\/api\/terminal\/group-workspaces\/([A-Za-z0-9_-]{1,64})$/u.exec(url.pathname);
  if (match === null) throw new Error('TERMINAL_AUTOMATION_GROUP_WORKSPACE_ADDRESS_INVALID');
  return match[1]!;
};

export const serverConfigOrigin = (environment: ServerConfigEnvironment): string =>
  new URL(serverConfigAddress(environment, 'business', 'primary').baseUrl).origin;
