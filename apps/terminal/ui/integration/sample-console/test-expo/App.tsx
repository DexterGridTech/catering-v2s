import {createTestExpoApp} from '@catering-v2s/ui-base-dev-host';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {createProcessMemoryStateStoragePort} from '@catering-v2s/kernel-base-platform-ports';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {refreshTopologyDisplayCommand} from '@catering-v2s/kernel-base-topology';
import packageJson from '../package.json';
import {createSampleAssembly, terminalSurfaces} from '../src';
import {createTerminalUpdateAutomationFixture} from './terminalUpdateFixture';
import '../theme/global.css';

const defaultServerSpaces = packageJson.serverSpaces as TransportServerConfig;
const managedGroupWorkspaceBaseUrl = process.env.EXPO_PUBLIC_TER_MANAGED_GROUP_WORKSPACE_BASE_URL;
const managedTdsEntryOneWebSocketBaseUrl = process.env.EXPO_PUBLIC_TER_MANAGED_TDS_ENTRY_ONE_WS_URL;
const managedTdsEntryTwoWebSocketBaseUrl = process.env.EXPO_PUBLIC_TER_MANAGED_TDS_ENTRY_TWO_WS_URL;
const managedDeviceId = process.env.EXPO_PUBLIC_TER_MANAGED_DEVICE_ID;
const testAutomationUrl = process.env.EXPO_PUBLIC_TER_AUTOMATION_URL;
const testAutomationToken = process.env.EXPO_PUBLIC_TER_AUTOMATION_TOKEN;
if (managedDeviceId !== undefined && !/^[A-Za-z0-9:._-]{1,128}$/.test(managedDeviceId)) {
  throw new Error('TEST_EXPO_MANAGED_DEVICE_ID_INVALID');
}
const testServerSpaces = (): TransportServerConfig => {
  const managedUrls = [
    managedGroupWorkspaceBaseUrl,
    managedTdsEntryOneWebSocketBaseUrl,
    managedTdsEntryTwoWebSocketBaseUrl,
  ];
  if (managedUrls.every(value => value === undefined || value.length === 0)) return defaultServerSpaces;
  if (managedUrls.some(value => value === undefined || value.length === 0)) {
    throw new Error('TEST_EXPO_MANAGED_SERVER_URLS_INCOMPLETE');
  }
  const businessUrl = new URL(managedGroupWorkspaceBaseUrl!);
  const tdsEntryOneUrl = new URL(managedTdsEntryOneWebSocketBaseUrl!);
  const tdsEntryTwoUrl = new URL(managedTdsEntryTwoWebSocketBaseUrl!);
  if (
    businessUrl.protocol !== 'http:' ||
    businessUrl.hostname !== '127.0.0.1' ||
    !/^\d{4,5}$/.test(businessUrl.port) ||
    !/^\/api\/terminal\/group-workspaces\/[A-Za-z0-9_-]+$/.test(businessUrl.pathname) ||
    businessUrl.username.length > 0 ||
    businessUrl.password.length > 0 ||
    businessUrl.search.length > 0 ||
    businessUrl.hash.length > 0 ||
    [tdsEntryOneUrl, tdsEntryTwoUrl].some(
      url =>
        url.protocol !== 'ws:' ||
        url.hostname !== '127.0.0.1' ||
        !/^\d{4,5}$/.test(url.port) ||
        (url.pathname !== '' && url.pathname !== '/') ||
        url.username.length > 0 ||
        url.password.length > 0 ||
        url.search.length > 0 ||
        url.hash.length > 0,
    ) ||
    tdsEntryOneUrl.port === tdsEntryTwoUrl.port
  ) {
    throw new Error('TEST_EXPO_MANAGED_SERVER_URL_INVALID');
  }
  const spaces = defaultServerSpaces.spaces.map(space => {
    if (space.name !== defaultServerSpaces.selectedSpace) return space;
    let businessReplaced = false;
    let tdsAddressesReplaced = 0;
    const servers = space.servers.map(server => {
      if (server.serverName === 'business') {
        const addresses = server.addresses.map(address => {
          if (address.addressName !== 'primary') return address;
          businessReplaced = true;
          return Object.freeze({...address, baseUrl: businessUrl.toString()});
        });
        return Object.freeze({...server, addresses: Object.freeze(addresses)});
      }
      if (server.serverName === 'terminal-data-server') {
        const addresses = server.addresses.map(address => {
          const url =
            address.addressName === 'haproxy-entry-one'
              ? tdsEntryOneUrl
              : address.addressName === 'haproxy-entry-two'
                ? tdsEntryTwoUrl
                : null;
          if (url === null) return address;
          tdsAddressesReplaced += 1;
          return Object.freeze({...address, baseUrl: url.toString()});
        });
        return Object.freeze({...server, addresses: Object.freeze(addresses)});
      }
      return server;
    });
    if (!businessReplaced || tdsAddressesReplaced !== 2) throw new Error('TEST_EXPO_MANAGED_SERVER_ADDRESS_MISSING');
    return Object.freeze({...space, servers: Object.freeze(servers)});
  });
  return Object.freeze({...defaultServerSpaces, spaces: Object.freeze(spaces)});
};

const testAutomationConfig = () => {
  if (testAutomationUrl === undefined && testAutomationToken === undefined) return undefined;
  if (
    typeof testAutomationUrl !== 'string' ||
    testAutomationUrl.length === 0 ||
    typeof testAutomationToken !== 'string' ||
    testAutomationToken.length === 0
  ) {
    throw new Error('TEST_EXPO_AUTOMATION_CONFIG_INCOMPLETE');
  }
  return Object.freeze({enabled: true, url: testAutomationUrl, sessionToken: testAutomationToken});
};
const testAutomation = testAutomationConfig();
const terminalUpdateRunId = process.env.EXPO_PUBLIC_TER_AUTOMATION_RUN_ID;
const terminalUpdateFixture =
  terminalUpdateRunId === undefined
    ? undefined
    : createTerminalUpdateAutomationFixture(
        terminalUpdateRunId,
        process.env.EXPO_PUBLIC_TER_AUTOMATION_CASE === 'update.install-result'
          ? 'install-result'
          : process.env.EXPO_PUBLIC_TER_AUTOMATION_CASE === 'update.compatibility'
            ? 'compatibility'
            : 'fixed',
      );
const testSurfaceForm = process.env.EXPO_PUBLIC_TER_AUTOMATION_SURFACE_FORM;
if (testSurfaceForm !== undefined && testSurfaceForm !== 'laptop' && testSurfaceForm !== 'mobile') {
  throw new Error('TEST_EXPO_TERMINAL_SURFACE_FORM_INVALID');
}

const App = createTestExpoApp({
  appName: 'sample-console',
  title: '真实业务画布',
  persistenceKey: 'sample-console-web',
  ...(testAutomation === undefined || testSurfaceForm === undefined ? {} : {surfaceForm: testSurfaceForm}),
  webPlatformOptions: {
    protectedStorage: createProcessMemoryStateStoragePort(),
    ...(managedDeviceId === undefined
      ? {}
      : {
          readDeviceInfo: () => ({
            deviceId: managedDeviceId,
            manufacturer: 'TER Web acceptance',
            model: 'managed-browser',
            systemName: 'Web',
            systemVersion: 'managed',
            logicalProcessorCount: 4,
          }),
        }),
  },
  terminalSurfaces,
  createAssembly: input =>
    createSampleAssembly({
      ...input,
      ...(terminalUpdateFixture === undefined
        ? {}
        : {
            platformPorts: Object.freeze({...input.platformPorts, update: terminalUpdateFixture.port}),
            terminalUpdateSourceProvider: terminalUpdateFixture.sourceProvider,
          }),
      serverSpaces: testServerSpaces(),
      ...(testAutomation === undefined ? {} : {terminalAutomation: testAutomation}),
    }),
  getRuntimeStatus: assembly => assembly.runtime.status,
  onSurfaceModeChanged: async ({assembly}) => {
    await assembly.runtime.dispatchCommand(refreshTopologyDisplayCommand, {}, {requestId: createRequestId()});
  },
});

export default App;
