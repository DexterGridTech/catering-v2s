import packageJson from '../../package.json';
import * as Crypto from 'expo-crypto';
import {moduleName as integrationModuleName} from '../moduleName';
import type {EnvironmentMode, NativeLoadingCapability, PlatformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {type SurfaceHostMeasurementSource} from '@catering-v2s/ui-base-render';
import {
  createCredentialSecret,
  createTerminalActivationModule,
  createTerminalActivationParts,
} from '@catering-v2s/ui-base-terminal-activation';
import {createServerConfigPanelParts} from '@catering-v2s/ui-base-server-config-panel';
import {
  createTerminalDataClientModule,
  selectActivationState,
  selectConnectionState,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {
  createIntegrationAssembly,
  createStartupReadyPayload,
  createSurfaceForDisplayIndex as createSharedSurfaceForDisplayIndex,
  createBrowserTransportNetworkAdapter,
  PairReadinessInterlock,
  selectStateSyncSlices,
  type IntegrationAssembly,
  type AutomationAgentConfig,
} from '@catering-v2s/ui-base-integration-assembly';
import {sampleStaffAuthAssembly} from '@catering-v2s/ui-feature-sample-staff-auth';
import {sampleWallpaperPickerAssembly, WallpaperBackground} from '@catering-v2s/ui-feature-sample-wallpaper-picker';
import {createSampleStaffSessionModule} from '@catering-v2s/kernel-feature-sample-staff-session';
import {createStoreBasicModule} from '@catering-v2s/kernel-feature-store-basic';
import {createSampleWallpaperModule} from '@catering-v2s/kernel-feature-sample-wallpaper';
import {createServerConfigModule} from '@catering-v2s/kernel-base-server-config';
import {resolveServerNetworkSnapshot} from '@catering-v2s/kernel-base-server-config';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {
  createTopologyAdminCapability,
  createTopologyModule,
  resolveTopologyCommandTarget,
  selectTopologyState,
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
  selectSampleWallpaperConsoleBusinessMutationAllowed,
  selectSampleWallpaperConsoleStaffLoginAllowed,
  startupReadyCommand,
  type SampleWallpaperConsoleReadyPayload,
} from '../application/module';
export {selectSampleWallpaperConsoleBusinessInterlockActive} from '../application/module';
import {parts as wallpaperConsoleParts} from '../parts/parts';
import {
  getSurfaceDeclarations,
  terminalSurfaces,
  type SurfaceForm,
  type TerminalSurfaces,
} from '../application/terminalSurfaces';

const defaultPersistenceKey = 'sample-wallpaper-console';

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
  readonly terminalAutomation?: AutomationAgentConfig;
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
    appVersion: input.appVersion ?? 'dev',
    terminalAutomation: input.terminalAutomation ?? packageJson.terminalAutomation,
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
      const staffSessionModule = createSampleStaffSessionModule({
        canLogin: selectSampleWallpaperConsoleStaffLoginAllowed,
      });
      const wallpaperModule = createSampleWallpaperModule({
        canMutate: selectSampleWallpaperConsoleBusinessMutationAllowed,
      });
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
        createProtocolUuid: () => Crypto.randomUUID(),
        now: () => Date.now(),
        surfaceForm,
        appVersion: input.appVersion ?? '1.0.0',
        canActivate: state => !selectTopologyState(state).repairPending,
      });
      const storeBasicModule = createStoreBasicModule();
      return [
        serverConfigModule,
        transportModule,
        createTopologyModule({
          displayName: 'sample-wallpaper-console',
          moduleName: integrationModuleName,
          surfaceForm,
          identityClient: createTopologyIdentityClient(),
          peerChannel: input.topologyPeerChannel,
          canPair: state => {
            const activation = selectActivationState(state);
            const connection = selectConnectionState(state);
            return (
              activation.status === 'inactive' &&
              (connection.status === 'stopped' || connection.status === 'disconnected')
            );
          },
          stateSyncSlices: selectStateSyncSlices([
            ...(uiStateModule.stateSlices ?? []),
            ...(staffSessionModule.stateSlices ?? []),
            ...(wallpaperModule.stateSlices ?? []),
            ...(serverConfigModule.stateSlices ?? []),
            ...(terminalDataClientModule.stateSlices ?? []),
            ...(storeBasicModule.stateSlices ?? []),
          ]),
        }),
        createSampleWallpaperConsoleModule(surfaceForm),
        createTerminalActivationModule(),
        terminalDataClientModule,
        storeBasicModule,
        staffSessionModule,
        wallpaperModule,
        sampleStaffAuthAssembly.createModule(),
        sampleWallpaperPickerAssembly.createModule(),
      ];
    },
    renderChildren: () => <WallpaperBackground />,
  });
}
