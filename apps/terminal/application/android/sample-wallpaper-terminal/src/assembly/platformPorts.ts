import packageJson from '../../package.json';
import {createAndroidPlatformBinding} from '@catering-v2s/application-base-android';
import {
  createSampleWallpaperConsoleAssembly,
  type SurfaceForm,
} from '@catering-v2s/ui-integration-sample-wallpaper-console';
import {renderTerminalUpdateAssetLoadProbe} from '@catering-v2s/ui-integration-sample-wallpaper-console/test-expo/TerminalUpdateAssetLoadProbe';
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
    ...(process.env.EXPO_PUBLIC_TER_AUTOMATION_UPDATE_ASSET_PROBE === 'true'
      ? {renderAutomationChildren: renderTerminalUpdateAssetLoadProbe}
      : {}),
    showAdminPassword: packageJson.showAdminPassword,
  });
