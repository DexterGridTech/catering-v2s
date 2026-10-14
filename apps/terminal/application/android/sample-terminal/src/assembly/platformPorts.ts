import packageJson from '../../package.json';
import {createAndroidPlatformBinding} from '@catering-v2s/application-base-android';
import {createSampleAssembly, type SurfaceForm} from '@catering-v2s/ui-integration-sample-console';
import {resolveManagedServerSpaces} from './managedServerSpaces';

const persistenceKey = 'sample-terminal-android';
const androidPlatform = createAndroidPlatformBinding(persistenceKey);
const terminalAutomation = (() => {
  if (process.env.EXPO_PUBLIC_TER_AUTOMATION_BUILD !== 'true') return packageJson.terminalAutomation;
  const url = process.env.EXPO_PUBLIC_TER_AUTOMATION_URL;
  const sessionToken = process.env.EXPO_PUBLIC_TER_AUTOMATION_TOKEN;
  if (!url || !sessionToken) throw new Error('TERMINAL_AUTOMATION_BUILD_CONFIG_INCOMPLETE');
  return Object.freeze({enabled: true, url, sessionToken});
})();
const serverSpaces = () =>
  resolveManagedServerSpaces(
    packageJson.serverSpaces,
    process.env.EXPO_PUBLIC_TER_SERVER_CONFIG_ENVIRONMENT_JSON,
  );

if (
  process.env.EXPO_PUBLIC_TER_MANAGED_DEV_CONFIG_REQUIRED === 'true' &&
  process.env.EXPO_PUBLIC_TER_SERVER_CONFIG_ENVIRONMENT_JSON === undefined
) {
  throw new Error('TERMINAL_AUTOMATION_SERVER_CONFIG_ENVIRONMENT_REQUIRED');
}

export const nativeLoadingCapability = androidPlatform.nativeLoadingCapability;
export const nativeLoadingLogger = androidPlatform.platformPorts.logger;

export const createSampleTerminalAssembly = (input: Readonly<{readonly surfaceForm: SurfaceForm}>) => {
  return createSampleAssembly({
    ...androidPlatform,
    persistenceKey,
    appVersion: packageJson.version,
    terminalAutomation,
    surfaceForm: input.surfaceForm,
    terminalSurfaces: packageJson.terminalSurfaces,
    serverSpaces: serverSpaces(),
    showAdminPassword: packageJson.showAdminPassword,
  });
};
