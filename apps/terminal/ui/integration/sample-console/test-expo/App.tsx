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
import {createSampleAssembly, terminalSurfaces} from '../src';
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
const terminalUpdateFixture =
  terminalUpdateRunId === undefined
    ? undefined
    : createTerminalUpdateAutomationFixture({
        runId: terminalUpdateRunId,
        applicationId:
          terminalUpdateOwnerFlow === '1'
            ? process.env.EXPO_PUBLIC_TER_AUTOMATION_ANDROID_PACKAGE_ID!
            : 'com.anonymous.sampleterminal',
        scenario: process.env.EXPO_PUBLIC_TER_AUTOMATION_CASE,
      });
const remoteControlTestRunId =
  process.env.EXPO_PUBLIC_TER_AUTOMATION_PHASE === 'remote' ? process.env.EXPO_PUBLIC_TER_AUTOMATION_RUN_ID : undefined;
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
                    moduleName: 'ui.integration.sample-console.test-expo',
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
      ...(testAutomation === undefined ? {} : {terminalAutomation: testAutomation}),
    }),
  getRuntimeStatus: assembly => assembly.runtime.status,
  onSurfaceModeChanged: async ({assembly}) => {
    await assembly.runtime.dispatchCommand(refreshTopologyDisplayCommand, {}, {requestId: createRequestId()});
  },
});

export default App;
