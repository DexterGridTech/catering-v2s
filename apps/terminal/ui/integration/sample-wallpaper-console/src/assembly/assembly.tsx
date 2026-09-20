import packageJson from '../../package.json'
import {moduleName as integrationModuleName} from '../moduleName'
import type {EnvironmentMode, NativeLoadingCapability, PlatformPorts} from '@catering-v2s/kernel-base-platform-ports'
import {type SurfaceHostMeasurementSource} from '@catering-v2s/ui-base-render'
import {
  createConsoleAssembly,
  createSurfaceForDisplayIndex as createSharedSurfaceForDisplayIndex,
  type ConsoleAssembly,
} from '@catering-v2s/ui-base-console-assembly'
import {sampleStaffAuthAssembly} from '@catering-v2s/ui-feature-sample-staff-auth'
import {sampleWallpaperPickerAssembly, WallpaperBackground} from '@catering-v2s/ui-feature-sample-wallpaper-picker'
import {createSampleStaffSessionModule} from '@catering-v2s/kernel-feature-sample-staff-session'
import {createSampleWallpaperModule} from '@catering-v2s/kernel-feature-sample-wallpaper'
import {createTopologyAdminCapability, createTopologyModule, resolveTopologyCommandTarget} from '@catering-v2s/kernel-base-topology'
import {createTopologyIdentityClient, createTransportModule, type TopologyPeerChannel} from '@catering-v2s/kernel-base-transport'
import {createSampleWallpaperConsoleModule, startupReadyCommand, type SampleWallpaperConsoleReadyPayload} from '../application/module'
import {parts as wallpaperConsoleParts} from '../parts/parts'
import {
  getSurfaceDeclarations,
  terminalSurfaces,
  type SurfaceCreationInput,
  type SurfaceForm,
  type TerminalSurfaces,
} from '../application/terminalSurfaces'

const defaultPersistenceKey = 'sample-wallpaper-console'

export type WallpaperConsoleAssembly = ConsoleAssembly

export const createSurfaceForDisplayIndex = createSharedSurfaceForDisplayIndex

type WallpaperConsoleAssemblyInput = Readonly<{
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

export function createSampleWallpaperConsoleAssembly(input: WallpaperConsoleAssemblyInput): Promise<WallpaperConsoleAssembly>
export async function createSampleWallpaperConsoleAssembly(
  input: WallpaperConsoleAssemblyInput,
): Promise<WallpaperConsoleAssembly> {
  const nativeLoadingCapability = input.nativeLoadingCapability
  const surfaceForm = input.surfaceForm
  const environmentMode: EnvironmentMode = input.environmentMode ?? (__DEV__ ? 'DEV' : 'PROD')
  const staffAuthModule = sampleStaffAuthAssembly.createModule()
  const wallpaperPickerModule = sampleWallpaperPickerAssembly.createModule()
  return createConsoleAssembly<SampleWallpaperConsoleReadyPayload>({
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
    parts: [
      ...sampleStaffAuthAssembly.parts,
      ...sampleWallpaperPickerAssembly.parts,
      ...wallpaperConsoleParts,
    ],
    layerDismissals: Object.freeze({
      ...sampleStaffAuthAssembly.layerDismissals,
      ...sampleWallpaperPickerAssembly.layerDismissals,
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
        displayName: 'sample-wallpaper-console',
        moduleName: integrationModuleName,
        surfaceForm,
        identityClient: createTopologyIdentityClient(),
        peerChannel: input.topologyPeerChannel,
        stateSyncSlices: (uiStateModule.stateSlices ?? []).reduce<Array<{
          readonly name: string
          readonly syncIntent: 'master-to-slave' | 'slave-to-master'
        }>>((result, slice) => {
          if (slice.syncIntent !== 'isolated') result.push({name: slice.name, syncIntent: slice.syncIntent})
          return result
        }, []),
      }),
      createSampleWallpaperConsoleModule(),
      createSampleStaffSessionModule(),
      createSampleWallpaperModule(),
      staffAuthModule,
      wallpaperPickerModule,
    ],
    renderChildren: () => <WallpaperBackground />,
  })
}
