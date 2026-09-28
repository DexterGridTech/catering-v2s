import type {
  DeviceIdentity,
  EnvironmentMode,
  PlatformPortCapabilitySnapshot,
} from '@catering-v2s/kernel-base-platform-ports'
import type {DisplayFactsReadModel} from '@catering-v2s/kernel-base-display-context'
import type {SurfaceCanvasDeclaration} from '../foundations/surfaceHost'

export type RuntimeSurfaceCanvasSizes = Readonly<{
  readonly PRIMARY?: SurfaceCanvasDeclaration
  readonly SECONDARY?: SurfaceCanvasDeclaration
}>

export type DebugModeSource = 'startup' | 'packaging' | 'default'

export type DebugMode = Readonly<{
  readonly enabled: boolean
  readonly source: DebugModeSource
}>

export type RuntimeDeviceIdentity = DeviceIdentity

export type RenderRuntimeFacts = Readonly<{
  readonly environmentMode: EnvironmentMode
  readonly debugMode: DebugMode
  /** Optional package-level opt-in for showing the current sample admin password in the login UI. */
  readonly showAdminPassword?: boolean
  readonly deviceIdentity: RuntimeDeviceIdentity
  readonly platformPortCapabilities: readonly PlatformPortCapabilitySnapshot[]
  readonly displayFacts?: DisplayFactsReadModel
  /** Application-declared logical canvas resolution, independent of measured device display bounds. */
  readonly surfaceCanvasSizes?: RuntimeSurfaceCanvasSizes
}>

export type DebugModeResolutionInput = Readonly<{
  readonly startup?: boolean
  readonly packaging?: boolean
}>

export const resolveDebugMode = ({startup, packaging}: DebugModeResolutionInput): DebugMode => Object.freeze({
  enabled: startup ?? packaging ?? false,
  source: startup !== undefined
    ? 'startup' as const
    : packaging !== undefined
      ? 'packaging' as const
      : 'default' as const,
})

export const createRenderRuntimeFacts = ({
  environmentMode,
  debugMode,
  showAdminPassword,
  deviceIdentity,
  platformPortCapabilities,
  displayFacts,
  surfaceCanvasSizes,
}: Readonly<{
  readonly environmentMode: EnvironmentMode
  readonly debugMode: DebugMode
  readonly showAdminPassword?: boolean
  readonly deviceIdentity: RuntimeDeviceIdentity
  readonly platformPortCapabilities: readonly PlatformPortCapabilitySnapshot[]
  readonly displayFacts?: DisplayFactsReadModel
  readonly surfaceCanvasSizes?: RuntimeSurfaceCanvasSizes
}>): RenderRuntimeFacts => Object.freeze({
  environmentMode,
  debugMode: Object.freeze({enabled: debugMode.enabled, source: debugMode.source}),
  ...(showAdminPassword === undefined ? {} : {showAdminPassword}),
  deviceIdentity: Object.freeze({
    available: deviceIdentity.available,
    deviceId: deviceIdentity.deviceId,
  }),
  platformPortCapabilities: Object.freeze(platformPortCapabilities.map(snapshot => Object.freeze({
    port: snapshot.port,
    descriptorStatus: snapshot.descriptorStatus,
    capabilities: Object.freeze(snapshot.capabilities.map(capability => Object.freeze({
      capability: capability.capability,
      state: capability.state,
      source: capability.source,
    }))),
  }))),
  ...(displayFacts === undefined ? {} : {
    displayFacts: Object.freeze({
      status: displayFacts.status,
      physicalDisplayCount: displayFacts.physicalDisplayCount,
      currentSurfaceKey: displayFacts.currentSurfaceKey,
      surfaces: Object.freeze(displayFacts.surfaces.map(surface => Object.freeze({
        ...surface,
        logicalSize: surface.logicalSize === null ? null : Object.freeze({...surface.logicalSize}),
        physicalSize: surface.physicalSize === null ? null : Object.freeze({...surface.physicalSize}),
      }))),
      reasonCode: displayFacts.reasonCode,
    }),
  }),
  ...(surfaceCanvasSizes === undefined ? {} : {
    surfaceCanvasSizes: Object.freeze({
      ...(surfaceCanvasSizes.PRIMARY === undefined ? {} : {PRIMARY: Object.freeze({...surfaceCanvasSizes.PRIMARY})}),
      ...(surfaceCanvasSizes.SECONDARY === undefined ? {} : {SECONDARY: Object.freeze({...surfaceCanvasSizes.SECONDARY})}),
    }),
  }),
})
