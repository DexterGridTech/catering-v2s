import {useCallback, useRef, type ReactElement, type ReactNode} from 'react'
import {createNodeId} from '@catering-v2s/kernel-base-contracts'
import {
  describePlatformPortCapabilities,
  normalizeDeviceIdentity,
  type EnvironmentMode,
  type LoggerPort,
  type PlatformPorts,
} from '@catering-v2s/kernel-base-platform-ports'
import {
  createDisplayContextModule,
  resolveSurfaceDisplayMode,
  selectDisplayRole,
  type DisplayMode,
} from '@catering-v2s/kernel-base-display-context'
import {
  createRuntime,
  selectRuntimeInstanceMode,
  type Runtime,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime'
import {createUiCatalog, createUiStateModule} from '@catering-v2s/kernel-base-ui-state'
import {
  bindSurfaceHostIdentity,
  createRenderRuntimeFacts,
  createRendererCatalog,
  RenderProvider,
  SurfaceRoot,
  resolveDebugMode,
  type RenderProviderProps,
  type RenderRuntimeFacts,
  type SurfaceHostMeasurementSource,
} from '@catering-v2s/ui-base-render'
import {InputSurfaceFrame, type InputDiagnostic} from '@catering-v2s/ui-base-input'
import {sampleStaffAuthAssembly} from '@catering-v2s/ui-feature-sample-staff-auth'
import {sampleWallpaperPickerAssembly, WallpaperBackground} from '@catering-v2s/ui-feature-sample-wallpaper-picker'
import {createSampleStaffSessionModule} from '@catering-v2s/kernel-feature-sample-staff-session'
import {createSampleWallpaperModule} from '@catering-v2s/kernel-feature-sample-wallpaper'
import {AdminLauncher, adminShellAssembly} from '@catering-v2s/ui-base-admin-shell'
import {createBaseModuleDescriptors} from '../application/baseModuleDescriptors'
import {createSampleWallpaperConsoleModule} from '../application/module'
import {parts as wallpaperConsoleParts} from '../parts/parts'
import {
  getSurfaceDeclarations,
  terminalSurfaces,
  type SurfaceCreationInput,
  type SurfaceForm,
} from '../application/terminalSurfaces'

const defaultPersistenceKey = 'sample-wallpaper-console'
const mainContainerKey = 'main' as const

export type WallpaperConsoleAssembly = Readonly<{
  readonly runtime: Runtime
  readonly surfaceForm: SurfaceForm
  readonly runtimeFacts: RenderRuntimeFacts
  readonly createSurface: (input: SurfaceCreationInput) => ReactElement
}>

const SurfaceInputFrame = ({
  surface,
  declaredSize,
  logger,
  children,
}: Readonly<{
  readonly surface: SurfaceCreationInput
  readonly declaredSize: Readonly<{readonly width: number; readonly height: number}>
  readonly logger: LoggerPort
  readonly children?: ReactNode
}>) => {
  const declaredRef = useRef(false)
  const reportInputDiagnostic = useCallback((diagnostic: InputDiagnostic) => {
    if (!__DEV__) return
    logger.info({
      category: 'display-diagnostics',
      event: diagnostic.event,
      message: 'Input display-chain diagnostic',
      data: {
        ...diagnostic.data,
        source: 'sample-wallpaper-console.SurfaceInputFrame',
        displayMode: surface.displayMode,
        displayIndex: surface.displayIndex,
        surfaceForm: surface.surfaceForm,
        declaredWidth: declaredSize.width,
        declaredHeight: declaredSize.height,
      },
    })
  }, [declaredSize.height, declaredSize.width, logger, surface.displayIndex, surface.displayMode, surface.surfaceForm])

  if (__DEV__ && !declaredRef.current) {
    declaredRef.current = true
    logger.info({
      category: 'startup.surfaces',
      event: 'startup.surfaces.declared',
      message: 'Declared sample2 surface baseline registered',
      data: {
        source: 'sample-wallpaper-console.package.json',
        displayMode: surface.displayMode,
        displayIndex: surface.displayIndex,
        surfaceForm: surface.surfaceForm,
        width: declaredSize.width,
        height: declaredSize.height,
      },
    })
  }

  return (
    <InputSurfaceFrame
      onDiagnostic={reportInputDiagnostic}
      onMeasuredFrame={frame => {
        if (!__DEV__) return
        logger.info({
          category: 'startup.surfaces',
          event: 'startup.surfaces.measured',
          message: 'Measured sample2 surface frame observed',
          data: {
            source: 'ui-base-input.InputSurfaceFrame.onLayout',
            displayMode: surface.displayMode,
            displayIndex: surface.displayIndex,
            surfaceForm: surface.surfaceForm,
            width: frame.width,
            height: frame.height,
            deltaWidth: frame.width - declaredSize.width,
            deltaHeight: frame.height - declaredSize.height,
            ready: frame.ready,
            orientation: frame.orientation,
          },
        })
      }}
    >
      {children}
    </InputSurfaceFrame>
  )
}

const createStateSource = (runtime: Runtime): RenderProviderProps['stateSource'] => Object.freeze({
  getStatus: () => runtime.status,
  getState: () => runtime.getState(),
  subscribe: (listener: () => void) => runtime.subscribe(listener),
})

const createDispatchCommand = (runtime: Runtime): RenderProviderProps['dispatchCommand'] =>
  (command, options) => runtime.dispatchCommand(command.definition, command.payload, {requestId: options.requestId})

export const createSurfaceForDisplayIndex = (
  assembly: WallpaperConsoleAssembly,
  displayIndex: 0 | 1,
): ReactElement => {
  const state = assembly.runtime.getState()
  const displayMode = resolveSurfaceDisplayMode({
    displayIndex,
    displayRole: selectDisplayRole(state),
    instanceMode: selectRuntimeInstanceMode(state),
  })
  const declarations = getSurfaceDeclarations(terminalSurfaces, assembly.surfaceForm)
  if (displayMode === 'SECONDARY' && !('SECONDARY' in declarations)) {
    throw new Error(`[sample-wallpaper-console] display index ${displayIndex} is unavailable for ${assembly.surfaceForm}`)
  }
  return assembly.createSurface({displayIndex, displayMode, surfaceForm: assembly.surfaceForm})
}

export const createSampleWallpaperConsoleAssembly = async (input: Readonly<{
  readonly platformPorts: PlatformPorts
  readonly persistenceKey?: string
  readonly surfaceForm: SurfaceForm
  readonly environmentMode?: EnvironmentMode
  readonly packagingDebugMode?: boolean
  readonly startupDebugMode?: boolean
  readonly surfaceHostSourcesByDisplayIndex?: Readonly<Partial<Record<0 | 1, SurfaceHostMeasurementSource>>>
}>): Promise<WallpaperConsoleAssembly> => {
  const surfaceForm = input.surfaceForm
  const environmentMode = input.environmentMode ?? 'DEV'
  const surfaceDeclarations = getSurfaceDeclarations(terminalSurfaces, surfaceForm)
  const deviceInfoResult = await input.platformPorts.device.getDeviceInfo({timeoutMs: 2_000})
  const deviceIdentity = normalizeDeviceIdentity(deviceInfoResult)
  const runtimeFacts = createRenderRuntimeFacts({
    environmentMode,
    debugMode: resolveDebugMode({packaging: input.packagingDebugMode, startup: input.startupDebugMode}),
    deviceIdentity,
    platformPortCapabilities: describePlatformPortCapabilities(input.platformPorts),
  })
  const definedParts = [
    ...adminShellAssembly.parts,
    ...sampleStaffAuthAssembly.parts,
    ...sampleWallpaperPickerAssembly.parts,
    ...wallpaperConsoleParts,
  ]
  const uiCatalog = createUiCatalog(definedParts.map(({catalogEntry}) => catalogEntry))
  const rendererCatalog = createRendererCatalog(definedParts.map(({rendererBinding}) => rendererBinding))
  const uiStateModule = createUiStateModule({
    catalog: uiCatalog,
    variables: sampleStaffAuthAssembly.variables,
    surfaceForm,
  })
  const modules: readonly RuntimeModule[] = [
    ...createBaseModuleDescriptors(),
    createDisplayContextModule(),
    uiStateModule,
    createSampleStaffSessionModule(),
    createSampleWallpaperModule(),
    sampleStaffAuthAssembly.createModule(),
    sampleWallpaperPickerAssembly.createModule(),
    createSampleWallpaperConsoleModule(),
  ]
  const runtime = createRuntime({
    localNodeId: createNodeId(),
    modules,
    platformPorts: input.platformPorts,
    state: {
      runtimeName: 'sample-wallpaper-console',
      environmentMode,
      persistenceKey: input.persistenceKey ?? defaultPersistenceKey,
      persistenceDebounceMs: 300,
    },
  })
  await runtime.start()
  if (runtime.status !== 'started') throw new Error('[sample-wallpaper-console] runtime did not start')

  const stateSource = createStateSource(runtime)
  const dispatchCommand = createDispatchCommand(runtime)
  const selectUiVariable: RenderProviderProps['selectUiVariable'] = (root, declaration) =>
    uiStateModule.selectUiVariable(root, declaration)
  const selectSurfaceForm: RenderProviderProps['selectSurfaceForm'] = root => uiStateModule.selectSurfaceForm(root)
  const boundHostSources = new Map<string, ReturnType<typeof bindSurfaceHostIdentity>>()
  const getSurfaceHostSource = (surface: SurfaceCreationInput) => {
    const source = input.surfaceHostSourcesByDisplayIndex?.[surface.displayIndex]
    if (source === undefined) return undefined
    const cacheKey = `${surface.displayIndex}:${surface.displayMode}:${surface.surfaceForm}`
    const cached = boundHostSources.get(cacheKey)
    if (cached !== undefined) return cached
    const bound = bindSurfaceHostIdentity(source, {
      surfaceKey: surface.displayIndex === 0 ? 'PRIMARY' : 'SECONDARY',
      displayIndex: surface.displayIndex,
      surfaceForm: surface.surfaceForm,
      displayMode: surface.displayMode,
    }, rejection => {
      input.platformPorts.logger.warn({
        category: 'display-diagnostics',
        event: 'sample-wallpaper-console.host-identity-rejected',
        message: 'Sample2 host source rejected because physical host identity mismatched',
        data: {
          source: 'sample-wallpaper-console.bindSurfaceHostIdentity',
          reason: rejection.reason,
          displayIndex: rejection.displayIndex,
          expectedIsHostPrimaryDisplay: rejection.expectedIsHostPrimaryDisplay,
          actualIsHostPrimaryDisplay: rejection.actualIsHostPrimaryDisplay,
          displayMode: surface.displayMode,
          surfaceForm: surface.surfaceForm,
        },
      })
    })
    boundHostSources.set(cacheKey, bound)
    return bound
  }

  const reportedSurfaceModes = new Set<DisplayMode>()
  const createSurface = (surface: SurfaceCreationInput): ReactElement => {
    const declaredSize = surface.displayMode === 'PRIMARY'
      ? surfaceDeclarations.PRIMARY
      : 'SECONDARY' in surfaceDeclarations ? surfaceDeclarations.SECONDARY : undefined
    if (declaredSize === undefined) {
      throw new Error(`[sample-wallpaper-console] ${surface.displayMode} is unavailable for ${surface.surfaceForm}`)
    }
    if (__DEV__ && !reportedSurfaceModes.has(surface.displayMode)) {
      reportedSurfaceModes.add(surface.displayMode)
      input.platformPorts.logger.info({
        category: 'display-diagnostics',
        event: 'sample-wallpaper-console.surface-created',
        message: 'Sample2 display surface created',
        data: {
          source: 'sample-wallpaper-console.createSurface',
          displayMode: surface.displayMode,
          displayIndex: surface.displayIndex,
          surfaceForm: surface.surfaceForm,
          declaredWidth: declaredSize.width,
          declaredHeight: declaredSize.height,
        },
      })
    }
    return (
      <RenderProvider
        stateSource={stateSource}
        uiCatalog={uiCatalog}
        rendererCatalog={rendererCatalog}
        logger={input.platformPorts.logger}
        runtimeFacts={runtimeFacts}
        dispatchCommand={dispatchCommand}
        selectUiVariable={selectUiVariable}
        selectSurfaceForm={selectSurfaceForm}
      >
        <SurfaceRoot
          displayMode={surface.displayMode}
          containerKey={mainContainerKey}
          canvas={declaredSize}
          surfaceHostSource={getSurfaceHostSource(surface)}
          renderContentFrame={({content}) => (
            <SurfaceInputFrame
              surface={surface}
              declaredSize={declaredSize}
              logger={input.platformPorts.logger}
            >
              <AdminLauncher canvas={declaredSize}>{content}</AdminLauncher>
            </SurfaceInputFrame>
          )}
        >
          <WallpaperBackground />
        </SurfaceRoot>
      </RenderProvider>
    )
  }

  return Object.freeze({runtime, surfaceForm, runtimeFacts, createSurface})
}
