import packageJson from '../../package.json'
import {moduleName as integrationModuleName} from '../moduleName'
import type {EnvironmentMode, NativeLoadingCapability, PlatformPorts} from '@catering-v2s/kernel-base-platform-ports'
import {definePart, type SurfaceHostMeasurementSource} from '@catering-v2s/ui-base-render'
import {
  createConsoleAssembly,
  createSurfaceForDisplayIndex as createSharedSurfaceForDisplayIndex,
  type ConsoleAssembly,
} from '@catering-v2s/ui-base-console-assembly'
import {sampleMemberDeskAssembly} from '@catering-v2s/ui-feature-sample-member-desk'
import {sampleStaffAuthAssembly} from '@catering-v2s/ui-feature-sample-staff-auth'
import {createSampleMemberRegistryModule} from '@catering-v2s/kernel-feature-sample-member-registry'
import {createSampleStaffSessionModule} from '@catering-v2s/kernel-feature-sample-staff-session'
import {createTopologyAdminCapability, createTopologyModule, resolveTopologyCommandTarget} from '@catering-v2s/kernel-base-topology'
import {createTopologyIdentityClient, createTransportModule, type TopologyPeerChannel} from '@catering-v2s/kernel-base-transport'
import {ADMIN_SECTION_CONTAINER_KEY, SampleSection} from '@catering-v2s/ui-base-admin-shell'
import {createSampleConsoleModule, startupReadyCommand, type SampleConsoleReadyPayload} from '../application/module'
import {
  getSurfaceDeclarations,
  terminalSurfaces,
  type SurfaceCreationInput,
  type SurfaceForm,
  type TerminalSurfaces,
} from '../application/terminalSurfaces'

const defaultPersistenceKey = 'sample-console'

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
})

export const createSampleDefinedParts = (includeSampleAdminSection = true) => {
  const baseParts = [
    ...sampleStaffAuthAssembly.parts,
    ...sampleMemberDeskAssembly.parts,
  ]
  return Object.freeze(includeSampleAdminSection ? [...baseParts, sampleAdminTestPart] : baseParts)
}

export type SampleAssembly = ConsoleAssembly

export const createSurfaceForDisplayIndex = createSharedSurfaceForDisplayIndex

type SampleAssemblyInput = Readonly<{
  readonly platformPorts: PlatformPorts
  readonly nativeLoadingCapability: NativeLoadingCapability
  readonly persistenceKey?: string
  readonly surfaceForm: SurfaceForm
  readonly terminalSurfaces?: TerminalSurfaces
  readonly defaultContainerPartKeys?: Readonly<Partial<Record<string, string>>>
  readonly environmentMode?: EnvironmentMode
  readonly packagingDebugMode?: boolean
  readonly startupDebugMode?: boolean
  readonly showAdminPassword?: boolean
  readonly surfaceHostSourcesByDisplayIndex?: Readonly<Partial<Record<0 | 1, SurfaceHostMeasurementSource>>>
  readonly topologyPeerChannel?: TopologyPeerChannel
}>

export function createSampleAssembly(input: SampleAssemblyInput): Promise<SampleAssembly>
export async function createSampleAssembly(
  input: SampleAssemblyInput,
): Promise<SampleAssembly> {
  const nativeLoadingCapability = input.nativeLoadingCapability
  const surfaceForm = input.surfaceForm
  const environmentMode: EnvironmentMode = input.environmentMode ?? (__DEV__ ? 'DEV' : 'PROD')
  const staffAuthModule = sampleStaffAuthAssembly.createModule()
  const memberDeskModule = sampleMemberDeskAssembly.createModule()
  const memberRegistryModule = createSampleMemberRegistryModule()
  return createConsoleAssembly<SampleConsoleReadyPayload>({
    appName: 'sample-console',
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
    parts: createSampleDefinedParts(),
    layerDismissals: Object.freeze({
      ...sampleStaffAuthAssembly.layerDismissals,
      ...sampleMemberDeskAssembly.layerDismissals,
    }),
    variables: [...sampleStaffAuthAssembly.variables],
    surfaceHostSourcesByDisplayIndex: input.surfaceHostSourcesByDisplayIndex,
    startupReadyCommand,
    createStartupReadyPayload: ({surfaceKey, displayIndex, readyPartKey, contentFailure}) => ({
      surfaceKey,
      displayIndex,
      readyPartKey,
      contentFailure,
    }),
    resolveCommandTarget: resolveTopologyCommandTarget,
    createTopologyAdminCapability,
    createApplicationModules: ({uiStateModule}) => [
      createTransportModule(),
      createTopologyModule({
        displayName: 'sample-console',
        moduleName: integrationModuleName,
        surfaceForm,
        identityClient: createTopologyIdentityClient(),
        peerChannel: input.topologyPeerChannel,
        stateSyncSlices: [...(uiStateModule.stateSlices ?? []), ...(memberRegistryModule.stateSlices ?? [])].reduce<Array<{
          readonly name: string
          readonly syncIntent: 'master-to-slave' | 'slave-to-master'
        }>>((result, slice) => {
          if (slice.syncIntent !== 'isolated') result.push({name: slice.name, syncIntent: slice.syncIntent})
          return result
        }, []),
      }),
      createSampleConsoleModule(),
      createSampleStaffSessionModule(),
      memberRegistryModule,
      staffAuthModule,
      memberDeskModule,
    ],
  })
}
