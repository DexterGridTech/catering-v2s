import packageJson from '../../package.json';
import * as Crypto from 'expo-crypto';
import {moduleName as integrationModuleName} from '../moduleName';
import type {EnvironmentMode, NativeLoadingCapability, PlatformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {definePart, type SurfaceHostMeasurementSource} from '@catering-v2s/ui-base-render';
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
import {sampleMemberDeskAssembly} from '@catering-v2s/ui-feature-sample-member-desk';
import {sampleStaffAuthAssembly} from '@catering-v2s/ui-feature-sample-staff-auth';
import {createSampleMemberRegistryModule} from '@catering-v2s/kernel-feature-sample-member-registry';
import {createSampleStaffSessionModule} from '@catering-v2s/kernel-feature-sample-staff-session';
import {
  createStoreBasicModule,
  selectStoreBasicLoadReadiness,
  selectStoreOrganizationPath,
} from '@catering-v2s/kernel-feature-store-basic';
import {createServerConfigModule} from '@catering-v2s/kernel-base-server-config';
import {createTerminalUpdateModule, type UpdateTargetSourceProvider} from '@catering-v2s/kernel-base-terminal-update';
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
  type TransportNetworkAdapter,
  type TransportNetworkSnapshot,
  type TopologyPeerChannel,
} from '@catering-v2s/kernel-base-transport';
import {ADMIN_SECTION_CONTAINER_KEY, SampleSection} from '@catering-v2s/ui-base-admin-shell';
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
  createSampleConsoleModule,
  selectSampleConsoleBusinessInterlockActive,
  selectSampleConsoleBusinessMutationAllowed,
  selectSampleConsoleStaffLoginAllowed,
  startupReadyCommand,
  type SampleConsoleReadyPayload,
} from '../application/module';
export {selectSampleConsoleBusinessInterlockActive} from '../application/module';
import {
  getSurfaceDeclarations,
  terminalSurfaces,
  type SurfaceForm,
  type TerminalSurfaces,
} from '../application/terminalSurfaces';

const defaultPersistenceKey = 'sample-console';

const sampleAdminTestPart = definePart({
  partKey: 'sample.console.admin-test',
  rendererKey: 'sample.console.admin-test',
  containerKeys: [ADMIN_SECTION_CONTAINER_KEY] as const,
  displayModes: ['PRIMARY', 'SECONDARY'] as const,
  workspaces: ['MAIN', 'BRANCH'] as const,
  instanceModes: ['MASTER', 'SLAVE'] as const,
  surfaceForm: ['laptop', 'mobile'] as const,
  title: '示例诊断',
  description: '由 sample-console 通过生产 catalog 注册的标题占位 section',
  component: SampleSection,
});

export const createSampleDefinedParts = (
  includeSampleAdminSection = true,
  serverSpaces: TransportServerConfig = packageJson.serverSpaces as TransportServerConfig,
) => {
  const baseParts = [...sampleStaffAuthAssembly.parts, ...sampleMemberDeskAssembly.parts];
  return Object.freeze([
    ...baseParts,
    ...createTerminalActivationParts(serverSpaces),
    ...createServerConfigPanelParts(serverSpaces),
    ...(includeSampleAdminSection ? [sampleAdminTestPart] : []),
  ]);
};

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
    parts: createSampleDefinedParts(true, input.serverSpaces ?? (packageJson.serverSpaces as TransportServerConfig)),
    layerDismissals: Object.freeze({
      ...sampleStaffAuthAssembly.layerDismissals,
      ...sampleMemberDeskAssembly.layerDismissals,
    }),
    variables: [...sampleStaffAuthAssembly.variables],
    surfaceHostSourcesByDisplayIndex: input.surfaceHostSourcesByDisplayIndex,
    startupReadyCommand,
    createStartupReadyPayload,
    resolveCommandTarget: resolveTopologyCommandTarget,
    createTopologyAdminCapability,
    createApplicationModules: ({uiStateModule}) => {
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
      let lastRuleSnapshotGateSignature = '';
      const readRuleSnapshotContext = (state: Parameters<typeof selectActivationState>[0]) => {
        const activation = selectActivationState(state);
        const readiness = selectStoreBasicLoadReadiness(state);
        const path = selectStoreOrganizationPath(state);
        const gates = Object.freeze({
          activationActive: activation.status === 'active',
          activationIdentityPresent:
            activation.terminalRef !== null && activation.bindingGeneration !== null && activation.storeRef !== null,
          activationWorkspacePresent: activation.groupWorkspaceKey !== null,
          runtimeIdPresent: readiness.runtimeId !== null,
          readinessBindingPresent: readiness.binding !== null,
          readinessBindingMatchesActivation:
            readiness.binding !== null &&
            readiness.binding.terminalRef === activation.terminalRef &&
            readiness.binding.bindingGeneration === activation.bindingGeneration &&
            readiness.binding.storeRef === activation.storeRef &&
            readiness.binding.groupWorkspaceKey === activation.groupWorkspaceKey,
          storeFlushed: readiness.storeStatus === 'flushed',
          projectFlushed: readiness.projectStatus === 'flushed',
          organizationPathPresent: path !== null,
          projectRefMatchesPath: path !== null && readiness.projectRef === path.projectRef,
        });
        const signature = JSON.stringify({
          gates,
          storeStatus: readiness.storeStatus,
          projectStatus: readiness.projectStatus,
        });
        if (signature !== lastRuleSnapshotGateSignature) {
          lastRuleSnapshotGateSignature = signature;
          input.platformPorts.logger.info({
            category: 'terminal-update.rules',
            event: 'terminal-update.rules.context-gates',
            message: 'Evaluated the readiness gates for the terminal rule snapshot context',
            data: {
              ...gates,
              storeStatus: readiness.storeStatus,
              projectStatus: readiness.projectStatus,
            },
          });
        }
        if (Object.values(gates).some(ready => !ready)) return null;
        if (
          path === null ||
          activation.terminalRef === null ||
          activation.bindingGeneration === null ||
          activation.storeRef === null ||
          activation.groupWorkspaceKey === null
        )
          return null;
        return Object.freeze({
          terminalRef: activation.terminalRef,
          bindingGeneration: activation.bindingGeneration,
          selectedSpace: activation.groupWorkspaceKey,
          storeRef: activation.storeRef,
          projectRef: path.projectRef,
          projectUpdatedAtEpochMillis: path.projectUpdatedAtEpochMillis,
        });
      };
      return [
        serverConfigModule,
        transportModule,
        createTerminalUpdateModule({
          port: input.platformPorts.update,
          createProtocolUuid: () => Crypto.randomUUID(),
          sourceProvider: input.terminalUpdateSourceProvider,
          readNetworkSnapshot: (state, serverName) => resolveServerNetworkSnapshot(state, serverSpaces, serverName),
          readRuleSnapshotContext,
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
          stateSyncSlices: selectStateSyncSlices([
            ...(uiStateModule.stateSlices ?? []),
            ...(staffSessionModule.stateSlices ?? []),
            ...(memberRegistryModule.stateSlices ?? []),
            ...(serverConfigModule.stateSlices ?? []),
            ...(terminalDataClientModule.stateSlices ?? []),
            ...(storeBasicModule.stateSlices ?? []),
          ]),
        }),
        createSampleConsoleModule(surfaceForm),
        createTerminalActivationModule(),
        terminalDataClientModule,
        storeBasicModule,
        staffSessionModule,
        memberRegistryModule,
        sampleStaffAuthAssembly.createModule(),
        sampleMemberDeskAssembly.createModule(),
      ];
    },
  });
}
