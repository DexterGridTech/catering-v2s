import packageJson from '../../package.json';
import {moduleName as integrationModuleName} from '../moduleName';
import type {EnvironmentMode, NativeLoadingCapability, PlatformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {type SurfaceHostMeasurementSource} from '@catering-v2s/ui-base-render';
import {
  createCredentialSecret,
  createTerminalActivationModule,
  createTerminalActivationParts,
} from '@catering-v2s/ui-base-terminal-activation';
import {createServerConfigPanelParts} from '@catering-v2s/ui-base-server-config-panel';
import {createTerminalDataClientModule} from '@catering-v2s/kernel-base-terminal-data-client';
import {
  createIntegrationAssembly,
  createStartupReadyPayload,
  createSurfaceForDisplayIndex as createSharedSurfaceForDisplayIndex,
  createBrowserTransportNetworkAdapter,
  PairReadinessInterlock,
  selectStateSyncSlices,
  type IntegrationAssembly,
} from '@catering-v2s/ui-base-integration-assembly';
import {sampleStaffAuthAssembly} from '@catering-v2s/ui-feature-sample-staff-auth';
import {sampleWallpaperPickerAssembly, WallpaperBackground} from '@catering-v2s/ui-feature-sample-wallpaper-picker';
import {createSampleStaffSessionModule, sessionSliceName} from '@catering-v2s/kernel-feature-sample-staff-session';
import {createSampleWallpaperModule, wallpaperSliceName} from '@catering-v2s/kernel-feature-sample-wallpaper';
import {createServerConfigModule} from '@catering-v2s/kernel-base-server-config';
import {resolveServerNetworkSnapshot} from '@catering-v2s/kernel-base-server-config';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {
  createTopologyAdminCapability,
  createTopologyModule,
  resolveTopologyCommandTarget,
} from '@catering-v2s/kernel-base-topology';
import {
  createTopologyIdentityClient,
  createTransportModule,
  type TopologyPeerChannel,
  type TransportNetworkAdapter,
  type TransportNetworkSnapshot,
} from '@catering-v2s/kernel-base-transport';
import {
  createSampleWallpaperConsoleModule,
  selectSampleWallpaperConsoleBusinessInterlockActive,
  startupReadyCommand,
  type SampleWallpaperConsoleReadyPayload,
} from '../application/module';
import {parts as wallpaperConsoleParts} from '../parts/parts';
import {
  getSurfaceDeclarations,
  terminalSurfaces,
  type SurfaceForm,
  type TerminalSurfaces,
} from '../application/terminalSurfaces';

const defaultPersistenceKey = 'sample-wallpaper-console';
export {selectSampleWallpaperConsoleBusinessInterlockActive};

export type WallpaperConsoleAssembly = IntegrationAssembly;

export const createSurfaceForDisplayIndex = createSharedSurfaceForDisplayIndex;

type WallpaperConsoleAssemblyInput = Readonly<{
  readonly platformPorts: PlatformPorts;
  readonly nativeLoadingCapability: NativeLoadingCapability;
  readonly persistenceKey?: string;
  readonly appVersion?: string;
  readonly surfaceForm: SurfaceForm;
  readonly terminalSurfaces?: TerminalSurfaces;
  readonly defaultContainerPartKeys?: Readonly<Partial<Record<string, string>>>;
  readonly environmentMode?: EnvironmentMode;
  readonly packagingDebugMode?: boolean;
  readonly startupDebugMode?: boolean;
  readonly showAdminPassword?: boolean;
  readonly serverSpaces?: TransportServerConfig;
  readonly surfaceHostSourcesByDisplayIndex?: Readonly<Partial<Record<0 | 1, SurfaceHostMeasurementSource>>>;
  readonly topologyPeerChannel?: TopologyPeerChannel;
  readonly transportNetworkAdapterFactory?: (
    readSnapshot: (serverName: string) => Promise<TransportNetworkSnapshot>,
  ) => TransportNetworkAdapter;
}>;

export function createSampleWallpaperConsoleAssembly(
  input: WallpaperConsoleAssemblyInput,
): Promise<WallpaperConsoleAssembly>;
export async function createSampleWallpaperConsoleAssembly(
  input: WallpaperConsoleAssemblyInput,
): Promise<WallpaperConsoleAssembly> {
  const nativeLoadingCapability = input.nativeLoadingCapability;
  const surfaceForm = input.surfaceForm;
  const environmentMode: EnvironmentMode = input.environmentMode ?? (__DEV__ ? 'DEV' : 'PROD');
  return createIntegrationAssembly<SampleWallpaperConsoleReadyPayload>({
    appName: 'sample-wallpaper-console',
    errorPrefix: 'sample-wallpaper-console',
    runtimeName: 'sample-wallpaper-console',
    defaultPersistenceKey,
    platformPorts: input.platformPorts,
    nativeLoadingCapability,
    persistenceKey: input.persistenceKey,
    surfaceForm,
    surfaceDeclarations: getSurfaceDeclarations(input.terminalSurfaces ?? terminalSurfaces, surfaceForm),
    defaultContainerPartKeys: input.defaultContainerPartKeys,
    environmentMode,
    packagingDebugMode: input.packagingDebugMode,
    startupDebugMode: input.startupDebugMode,
    showAdminPassword: input.showAdminPassword ?? packageJson.showAdminPassword,
    selectBusinessInterlockActive: selectSampleWallpaperConsoleBusinessInterlockActive,
    renderBusinessInterlock: () => <PairReadinessInterlock />,
    parts: [
      ...sampleStaffAuthAssembly.parts,
      ...sampleWallpaperPickerAssembly.parts,
      ...createTerminalActivationParts(input.serverSpaces ?? (packageJson.serverSpaces as TransportServerConfig)),
      ...createServerConfigPanelParts(input.serverSpaces ?? (packageJson.serverSpaces as TransportServerConfig)),
      ...wallpaperConsoleParts,
    ],
    layerDismissals: Object.freeze({
      ...sampleStaffAuthAssembly.layerDismissals,
      ...sampleWallpaperPickerAssembly.layerDismissals,
    }),
    variables: [...sampleStaffAuthAssembly.variables],
    surfaceHostSourcesByDisplayIndex: input.surfaceHostSourcesByDisplayIndex,
    startupReadyCommand,
    createStartupReadyPayload,
    resolveCommandTarget: resolveTopologyCommandTarget,
    createTopologyAdminCapability,
    createApplicationModules: ({uiStateModule}) => {
      const staffSessionModule = createSampleStaffSessionModule();
      const wallpaperModule = createSampleWallpaperModule();
      const serverConfigModule = createServerConfigModule(
        input.serverSpaces ?? (packageJson.serverSpaces as TransportServerConfig),
      );
      const serverSpaces = input.serverSpaces ?? (packageJson.serverSpaces as TransportServerConfig);
      const transportModule = createTransportModule({
        networkAdapterFactory: context => {
          const readSnapshot = async (serverName: string): Promise<TransportNetworkSnapshot> =>
            resolveServerNetworkSnapshot(context.getState(), serverSpaces, serverName);
          return (
            input.transportNetworkAdapterFactory?.(readSnapshot) ?? createBrowserTransportNetworkAdapter(readSnapshot)
          );
        },
      });
      const terminalDataClientModule = createTerminalDataClientModule({
        transport: transportModule.commandGateway,
        businessServerName: 'business',
        createCredentialSecret,
        now: () => Date.now(),
        surfaceForm,
        appVersion: input.appVersion ?? '1.0.0',
      });
      return [
        serverConfigModule,
        transportModule,
        createTopologyModule({
          displayName: 'sample-wallpaper-console',
          moduleName: integrationModuleName,
          surfaceForm,
          identityClient: createTopologyIdentityClient(),
          peerChannel: input.topologyPeerChannel,
          stateSyncSlices: selectStateSyncSlices([
            ...(uiStateModule.stateSlices ?? []),
            ...(staffSessionModule.stateSlices ?? []),
            ...(wallpaperModule.stateSlices ?? []),
            ...(serverConfigModule.stateSlices ?? []),
            ...(terminalDataClientModule.stateSlices ?? []),
          ]),
        }),
        createSampleWallpaperConsoleModule(surfaceForm),
        createTerminalActivationModule(),
        terminalDataClientModule,
        staffSessionModule,
        wallpaperModule,
        sampleStaffAuthAssembly.createModule(),
        sampleWallpaperPickerAssembly.createModule(),
      ];
    },
    renderChildren: () => <WallpaperBackground />,
  });
}
