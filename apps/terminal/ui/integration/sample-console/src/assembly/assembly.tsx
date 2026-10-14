import packageJson from '../../package.json';
import * as Crypto from 'expo-crypto';
import {moduleName as integrationModuleName} from '../moduleName';
import type {
  EnvironmentMode,
  NativeLoadingCapability,
  PlatformPorts,
  TransportNetworkAdapter,
  TransportNetworkSnapshot,
} from '@catering-v2s/kernel-base-platform-ports';
import type {SurfaceHostMeasurementSource} from '@catering-v2s/ui-base-render';
import {
  createIntegrationAssembly,
  createStartupReadyPayload,
  createSurfaceForDisplayIndex as createSharedSurfaceForDisplayIndex,
  createBrowserTransportNetworkAdapter,
  PairReadinessInterlock,
  type IntegrationAssembly,
  type AutomationAgentConfig,
} from '@catering-v2s/ui-base-integration-assembly';
import {createSampleMemberDeskModule} from '@catering-v2s/ui-feature-sample-member-desk';
import {createSampleStaffAuthModule} from '@catering-v2s/ui-feature-sample-staff-auth';
import {createSampleMemberRegistryModule} from '@catering-v2s/kernel-feature-sample-member-registry';
import {createSampleStaffSessionModule} from '@catering-v2s/kernel-feature-sample-staff-session';
import {createStoreBasicModule, selectStoreBasicBinding} from '@catering-v2s/kernel-feature-store-basic';
import {
  createProjectBasicModule,
  selectCurrentProjectTerminalUpdateTarget,
  selectProjectTerminalUpdateContextFacts,
  selectProjectFixedTerminalUpdateContextFacts,
} from '@catering-v2s/kernel-feature-project-basic';
import {createServerConfigModule} from '@catering-v2s/kernel-base-server-config';
import {createTerminalUpdateModule, type UpdateTargetSourceProvider} from '@catering-v2s/kernel-base-terminal-update';
import {createRemoteControlModule} from '@catering-v2s/kernel-base-remote-control';
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
} from '@catering-v2s/kernel-base-transport';
import type {TopologyPeerChannel} from '@catering-v2s/kernel-base-platform-ports';
import {
  createAdminShellModule,
} from '@catering-v2s/ui-base-admin-shell';
import {
  createCredentialSecret,
  createTerminalActivationModule,
} from '@catering-v2s/ui-base-terminal-activation';
import {
  createTerminalDataClientModule,
  selectActivationState,
  selectConnectionState,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {
  createSampleConsoleModule,
} from '../application/module';
import {selectSampleConsoleBusinessInterlockActive} from '../selectors/selectSampleConsoleBusinessInterlockActive';
import {selectSampleConsoleBusinessMutationAllowed} from '../selectors/selectSampleConsoleBusinessMutationAllowed';
import {selectSampleConsoleStaffLoginAllowed} from '../selectors/selectSampleConsoleStaffLoginAllowed';
import {startupReadyCommand, type SampleConsoleReadyPayload} from '../declarations/commands';
export {selectSampleConsoleBusinessInterlockActive} from '../selectors/selectSampleConsoleBusinessInterlockActive';
import {
  getSurfaceDeclarations,
  terminalSurfaces,
  type SurfaceForm,
  type TerminalSurfaces,
} from '../application/terminalSurfaces';

const defaultPersistenceKey = 'sample-console';

export type SampleAssembly = IntegrationAssembly;

export const createSurfaceForDisplayIndex = createSharedSurfaceForDisplayIndex;

type SampleAssemblyInput = Readonly<{
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
  readonly terminalUpdateSourceProvider?: UpdateTargetSourceProvider;
  readonly serverSpaces?: TransportServerConfig;
  readonly surfaceHostSourcesByDisplayIndex?: Readonly<Partial<Record<0 | 1, SurfaceHostMeasurementSource>>>;
  readonly topologyPeerChannel?: TopologyPeerChannel;
  readonly transportNetworkAdapterFactory?: (
    readSnapshot: (serverName: string) => Promise<TransportNetworkSnapshot>,
  ) => TransportNetworkAdapter;
}>;

export function createSampleAssembly(input: SampleAssemblyInput): Promise<SampleAssembly>;
export async function createSampleAssembly(input: SampleAssemblyInput): Promise<SampleAssembly> {
  const nativeLoadingCapability = input.nativeLoadingCapability;
  const surfaceForm = input.surfaceForm;
  const environmentMode: EnvironmentMode = input.environmentMode ?? (__DEV__ ? 'DEV' : 'PROD');
  return createIntegrationAssembly<SampleConsoleReadyPayload>({
    appName: 'sample-console',
    appVersion: input.appVersion ?? 'dev',
    terminalAutomation: input.terminalAutomation ?? packageJson.terminalAutomation,
    errorPrefix: 'sample-console',
    runtimeName: 'sample-console',
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
    selectBusinessInterlockActive: selectSampleConsoleBusinessInterlockActive,
    renderBusinessInterlock: () => <PairReadinessInterlock />,
    surfaceHostSourcesByDisplayIndex: input.surfaceHostSourcesByDisplayIndex,
    startupReadyCommand,
    createStartupReadyPayload,
    resolveCommandTarget: resolveTopologyCommandTarget,
    createTopologyAdminCapability,
    createApplicationModules: () => {
      const memberRegistryModule = createSampleMemberRegistryModule({
        canMutate: selectSampleConsoleBusinessMutationAllowed,
      });
      const staffSessionModule = createSampleStaffSessionModule({canLogin: selectSampleConsoleStaffLoginAllowed});
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
      const projectBasicModule = createProjectBasicModule();
      return [
        serverConfigModule,
        transportModule,
        createTerminalUpdateModule({
          port: input.platformPorts.update,
          createProtocolUuid: () => Crypto.randomUUID(),
          sourceProvider: input.terminalUpdateSourceProvider,
          readTerminalUpdateContextFacts: selectProjectTerminalUpdateContextFacts,
          readFixedTerminalUpdateContextFacts: selectProjectFixedTerminalUpdateContextFacts,
          readCurrentTarget: (state, requested) =>
            selectCurrentProjectTerminalUpdateTarget(
              state,
              requested.applicationId,
              requested.ruleRef,
              requested.collectionHash,
              requested.selectionContext.contextIdentity,
            ),
          readNetworkSnapshot: (state, serverName) => resolveServerNetworkSnapshot(state, serverSpaces, serverName),
        }),
        createTopologyModule({
          displayName: 'sample-console',
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
        }),
        createRemoteControlModule({
          topologyModuleName: integrationModuleName,
          port: input.platformPorts.remoteControl,
          serverSpaces,
        }),
        createSampleConsoleModule(surfaceForm),
        createTerminalActivationModule(serverSpaces, surfaceForm),
        createAdminShellModule(serverSpaces),
        terminalDataClientModule,
        storeBasicModule,
        projectBasicModule,
        staffSessionModule,
        memberRegistryModule,
        createSampleStaffAuthModule(),
        createSampleMemberDeskModule(),
      ];
    },
  });
}
