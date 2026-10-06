import packageJson from '../../package.json';
import {createAndroidPlatformBinding} from '@catering-v2s/application-base-android';
import {
  createSampleWallpaperConsoleAssembly,
  type SurfaceForm,
} from '@catering-v2s/ui-integration-sample-wallpaper-console';
import {resolveManagedServerSpaces} from './managedServerSpaces';

const persistenceKey = 'sample-wallpaper-terminal-android';
const androidPlatform = createAndroidPlatformBinding(persistenceKey);
const terminalAutomation = (() => {
  if (process.env.EXPO_PUBLIC_TER_AUTOMATION_BUILD !== 'true') return packageJson.terminalAutomation;
  const url = process.env.EXPO_PUBLIC_TER_AUTOMATION_URL;
  const sessionToken = process.env.EXPO_PUBLIC_TER_AUTOMATION_TOKEN;
  if (!url || !sessionToken) throw new Error('TERMINAL_AUTOMATION_BUILD_CONFIG_INCOMPLETE');
  return Object.freeze({enabled: true, url, sessionToken});
})();
export const automationSurfaceForm = (() => {
  if (process.env.EXPO_PUBLIC_TER_AUTOMATION_BUILD !== 'true') return undefined;
  const surfaceForm = process.env.EXPO_PUBLIC_TER_AUTOMATION_SURFACE_FORM;
  if (surfaceForm !== 'laptop' && surfaceForm !== 'mobile') {
    throw new Error('TERMINAL_AUTOMATION_SURFACE_FORM_INVALID');
  }
  return surfaceForm;
})();
export const nativeLoadingCapability = androidPlatform.nativeLoadingCapability;
export const nativeLoadingLogger = androidPlatform.platformPorts.logger;
const serverSpaces = () =>
  resolveManagedServerSpaces(packageJson.serverSpaces, {
    automationBuild: process.env.EXPO_PUBLIC_TER_AUTOMATION_BUILD,
    businessBaseUrl: process.env.EXPO_PUBLIC_TER_MANAGED_GROUP_WORKSPACE_BASE_URL,
    tdsEntryOneUrl: process.env.EXPO_PUBLIC_TER_MANAGED_TDS_ENTRY_ONE_WS_URL,
    tdsEntryTwoUrl: process.env.EXPO_PUBLIC_TER_MANAGED_TDS_ENTRY_TWO_WS_URL,
  });

export const createSampleWallpaperTerminalAssembly = (
  input: Readonly<{
    readonly surfaceForm: SurfaceForm;
  }>,
) =>
  createSampleWallpaperConsoleAssembly({
    ...androidPlatform,
    persistenceKey,
    appVersion: packageJson.version,
    terminalAutomation,
    surfaceForm: input.surfaceForm,
    terminalSurfaces: packageJson.terminalSurfaces,
    serverSpaces: serverSpaces(),
    showAdminPassword: packageJson.showAdminPassword,
  });
