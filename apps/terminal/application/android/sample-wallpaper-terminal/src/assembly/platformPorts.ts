import packageJson from '../../package.json';
import {createElement} from 'react';
import {createAndroidPlatformBinding} from '@catering-v2s/application-base-android';
import {
  createSampleWallpaperConsoleAssembly,
  type SurfaceForm,
} from '@catering-v2s/ui-integration-sample-wallpaper-console';
import {TerminalUpdateAssetLoadProbe} from '@catering-v2s/ui-integration-sample-wallpaper-console/test-expo/TerminalUpdateAssetLoadProbe';
import type {FixedUpdateTarget, UpdateTargetSourceProvider} from '@catering-v2s/kernel-base-terminal-update';
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

const terminalUpdateSourceProvider = (): UpdateTargetSourceProvider | undefined => {
  const targetUrl = process.env.EXPO_PUBLIC_TER_AUTOMATION_UPDATE_TARGET_URL;
  if (process.env.EXPO_PUBLIC_TER_AUTOMATION_BUILD !== 'true' || targetUrl === undefined) return undefined;
  const runId = process.env.EXPO_PUBLIC_TER_AUTOMATION_RUN_ID;
  const applicationId = process.env.EXPO_PUBLIC_TER_AUTOMATION_ANDROID_PACKAGE_ID;
  const revision = process.env.EXPO_PUBLIC_TER_AUTOMATION_UPDATE_REVISION ?? 'default';
  if (!runId || !applicationId) throw new Error('TERMINAL_AUTOMATION_UPDATE_SOURCE_CONFIG_INCOMPLETE');
  if (!/^[a-z0-9-]{1,32}$/u.test(revision)) throw new Error('TERMINAL_AUTOMATION_UPDATE_REVISION_INVALID');
  const url = new URL(targetUrl);
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    url.username ||
    url.password ||
    url.hash ||
    url.search
  ) {
    throw new Error('TERMINAL_AUTOMATION_UPDATE_TARGET_URL_INVALID');
  }
  const descriptorUrl = new URL(url);
  descriptorUrl.searchParams.set('revision', revision);
  // The fixed task survives an APK replacement, while this provider is recreated with the
  // new JS runtime. Keep run-owned refs resolvable from build identity, not from a prior fetch.
  const sourcePaths = new Map<string, string>([
    [`full-${runId}`, '/full.apk'],
    [`hot-${runId}`, '/hot.zip'],
  ]);
  const provider: UpdateTargetSourceProvider = {
    readTarget: async (selectionContext: FixedUpdateTarget['selectionContext']) => {
      if (selectionContext.selectedSpace !== 'development' || selectionContext.contextIdentity !== runId) return null;
      const response = await fetch(descriptorUrl.toString());
      if (!response.ok) return null;
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 256 * 1024) throw new Error('TERMINAL_AUTOMATION_UPDATE_TARGET_TOO_LARGE');
      const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (typeof value !== 'object' || value === null || !('target' in value) || !('sourcePaths' in value)) return null;
      const document = value as {target?: FixedUpdateTarget; sourcePaths?: Record<string, unknown>};
      if (
        document.target === undefined ||
        document.target.applicationId !== applicationId ||
        document.target.ruleRef !== `automation-${runId}` ||
        typeof document.sourcePaths !== 'object' ||
        document.sourcePaths === null ||
        Array.isArray(document.sourcePaths)
      )
        return null;
      for (const source of [document.target.full, document.target.hot]) {
        if (source === null) continue;
        const sourcePath = document.sourcePaths[source.sourceRef];
        const expectedPath = sourcePaths.get(source.sourceRef);
        if (
          typeof sourcePath !== 'string' ||
          !sourcePath.startsWith('/') ||
          sourcePath.startsWith('//') ||
          sourcePath.includes('\\') ||
          /(?:^|\/)\.\.?\//u.test(sourcePath) ||
          sourcePath !== expectedPath
        )
          return null;
      }
      return document.target;
    },
    resolveSourcePath: (sourceRef: string) => sourcePaths.get(sourceRef) ?? null,
  };
  return Object.freeze(provider);
};

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
    terminalUpdateSourceProvider: terminalUpdateSourceProvider(),
    ...(process.env.EXPO_PUBLIC_TER_AUTOMATION_UPDATE_ASSET_PROBE === 'true'
      ? {renderAutomationChildren: () => createElement(TerminalUpdateAssetLoadProbe)}
      : {}),
    showAdminPassword: packageJson.showAdminPassword,
  });
