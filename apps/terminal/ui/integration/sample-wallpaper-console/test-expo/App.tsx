import {createTestExpoApp} from '@catering-v2s/ui-base-dev-host';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {createProcessMemoryStateStoragePort} from '@catering-v2s/kernel-base-platform-ports';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {parseServerConfigEnvironmentJson, resolveServerConfigEnvironment} from '@catering-v2s/kernel-base-server-config';
import {refreshTopologyDisplayCommand} from '@catering-v2s/kernel-base-topology';
import {createTerminalUpdateAutomationFixture} from '@catering-v2s/kernel-base-terminal-update/testing';
import {createWebRemoteControlTestPort} from '@catering-v2s/terminal-automation/web-remote-control-test-port';
import {testExpoTestIds} from '@catering-v2s/ui-base-dev-host';
import packageJson from '../package.json';
import {createSampleWallpaperConsoleAssembly, terminalSurfaces} from '../src';
import {TerminalUpdateAssetLoadProbe} from './TerminalUpdateAssetLoadProbe';
import '../theme/global.css';

const defaultServerSpaces = packageJson.serverSpaces as TransportServerConfig;
const serverConfigEnvironmentJson = process.env.EXPO_PUBLIC_TER_SERVER_CONFIG_ENVIRONMENT_JSON;
if (
  process.env.EXPO_PUBLIC_TER_MANAGED_DEV_CONFIG_REQUIRED === 'true' &&
  serverConfigEnvironmentJson === undefined
) {
  throw new Error('TEST_EXPO_SERVER_CONFIG_ENVIRONMENT_REQUIRED');
}
const managedDeviceId = process.env.EXPO_PUBLIC_TER_MANAGED_DEVICE_ID;
const testAutomationUrl = process.env.EXPO_PUBLIC_TER_AUTOMATION_URL;
const testAutomationToken = process.env.EXPO_PUBLIC_TER_AUTOMATION_TOKEN;
const testServerSpaces = (): TransportServerConfig =>
  serverConfigEnvironmentJson === undefined
    ? defaultServerSpaces
    : resolveServerConfigEnvironment(
        defaultServerSpaces,
        parseServerConfigEnvironmentJson(serverConfigEnvironmentJson),
      );
const terminalUpdateRunId =
  process.env.EXPO_PUBLIC_TER_AUTOMATION_PHASE === 'remote' ? undefined : process.env.EXPO_PUBLIC_TER_AUTOMATION_RUN_ID;
const terminalUpdateOwnerFlow = process.env.EXPO_PUBLIC_TER_UPDATE_OWNER_FLOW;
if (
  (terminalUpdateOwnerFlow !== undefined && terminalUpdateOwnerFlow !== '1') ||
  (terminalUpdateOwnerFlow === '1' &&
    (terminalUpdateRunId === undefined ||
      process.env.EXPO_PUBLIC_TER_AUTOMATION_CASE !== 'update.owner-flow' ||
      !process.env.EXPO_PUBLIC_TER_AUTOMATION_ANDROID_PACKAGE_ID))
) {
  throw new Error('TEST_EXPO_TERMINAL_UPDATE_OWNER_FLOW_CONFIG_INVALID');
}
const remoteControlTestRunId =
  process.env.EXPO_PUBLIC_TER_AUTOMATION_PHASE === 'remote' ? process.env.EXPO_PUBLIC_TER_AUTOMATION_RUN_ID : undefined;
const terminalUpdateAssetProbe = process.env.EXPO_PUBLIC_TER_AUTOMATION_UPDATE_ASSET_PROBE;
if (terminalUpdateAssetProbe !== undefined && terminalUpdateAssetProbe !== 'true') {
  throw new Error('TEST_EXPO_TERMINAL_UPDATE_ASSET_PROBE_INVALID');
}
const terminalUpdateFixture =
  terminalUpdateRunId === undefined
    ? undefined
    : createTerminalUpdateAutomationFixture({
        runId: terminalUpdateRunId,
        applicationId:
          terminalUpdateOwnerFlow === '1'
            ? process.env.EXPO_PUBLIC_TER_AUTOMATION_ANDROID_PACKAGE_ID!
            : 'com.catering.v2s.terminal.samplewallpaper',
        scenario: process.env.EXPO_PUBLIC_TER_AUTOMATION_CASE,
      });
const testSurfaceForm = process.env.EXPO_PUBLIC_TER_AUTOMATION_SURFACE_FORM;
if (testSurfaceForm !== undefined && testSurfaceForm !== 'laptop' && testSurfaceForm !== 'mobile') {
  throw new Error('TEST_EXPO_TERMINAL_SURFACE_FORM_INVALID');
}
if ((testAutomationUrl === undefined) !== (testAutomationToken === undefined)) {
  throw new Error('TEST_EXPO_AUTOMATION_CONFIG_INCOMPLETE');
}
if (managedDeviceId !== undefined && !/^[A-Za-z0-9:._-]{1,128}$/.test(managedDeviceId)) {
  throw new Error('TEST_EXPO_MANAGED_DEVICE_ID_INVALID');
}

const App = createTestExpoApp({
  appName: 'sample-wallpaper-console',
  title: '壁纸终端画布',
  persistenceKey: 'sample-wallpaper-console-web',
  ...(testAutomationUrl === undefined || testAutomationToken === undefined || testSurfaceForm === undefined
    ? {}
    : {surfaceForm: testSurfaceForm}),
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
    createSampleWallpaperConsoleAssembly({
      ...input,
      ...(terminalUpdateFixture === undefined
        ? {}
        : {
            platformPorts: Object.freeze({...input.platformPorts, update: terminalUpdateFixture.port}),
            ...(terminalUpdateOwnerFlow === '1'
              ? {}
              : {terminalUpdateSourceProvider: terminalUpdateFixture.sourceProvider}),
          }),
      ...(remoteControlTestRunId === undefined
        ? {}
        : {
            platformPorts: Object.freeze({
              ...input.platformPorts,
              remoteControl: createWebRemoteControlTestPort({
                runId: remoteControlTestRunId,
                primarySurfaceTestId: String(testExpoTestIds.surface('PRIMARY')),
                trace: (event, data) =>
                  input.platformPorts.logger.scope({
                    moduleName: 'ui.integration.sample-wallpaper-console.test-expo',
                    layer: 'application',
                    subsystem: 'remote-control-test-endpoint',
                  }).info({
                    category: 'terminal.automation.remote-control',
                    event,
                    message: 'Web test endpoint media and input lifecycle',
                    data,
                  }),
              }),
            }),
          }),
      serverSpaces: testServerSpaces(),
      ...(terminalUpdateAssetProbe === 'true'
        ? {renderAutomationChildren: () => <TerminalUpdateAssetLoadProbe />}
        : {}),
      ...(testAutomationUrl === undefined || testAutomationToken === undefined
        ? {}
        : {terminalAutomation: {enabled: true, url: testAutomationUrl, sessionToken: testAutomationToken}}),
    }),
  getRuntimeStatus: assembly => assembly.runtime.status,
  onSurfaceModeChanged: async ({assembly}) => {
    await assembly.runtime.dispatchCommand(refreshTopologyDisplayCommand, {}, {requestId: createRequestId()});
  },
});

export default App;
