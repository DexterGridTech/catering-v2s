import {createNodeId, createRequestId, createRuntimeInstanceId} from '@catering-v2s/kernel-base-contracts'
import {
  createDisplayContextModule,
  resolveSurfaceDisplayMode,
  selectDisplayRole,
  type DisplayMode,
} from '@catering-v2s/kernel-base-display-context'
import {
  describePlatformPortCapabilities,
  normalizeDeviceIdentity,
  type EnvironmentMode,
  type LoggerPort,
  type NativeLoadingCapability,
  type PlatformPorts,
} from '@catering-v2s/kernel-base-platform-ports'
import {
  createRuntime,
  selectRuntimeInstanceMode,
  type CommandDefinition,
  type Runtime,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime'
import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
import {
  createUiCatalog,
  createUiStateModule,
  type SurfaceForm,
  type UiCatalogEntry,
  type UiStateModule,
  type UiVariableDeclaration,
} from '@catering-v2s/kernel-base-ui-state'
import {useCallback, useRef, type ReactElement, type ReactNode} from 'react'
import {
  InputSurfaceFrame,
  type InputDiagnostic,
} from '@catering-v2s/ui-base-input'
import {AdminLauncher, adminShellAssembly} from '@catering-v2s/ui-base-admin-shell'
import {
  bindSurfaceHostIdentity,
  createRenderRuntimeFacts,
  createRendererCatalog,
  dispatchWithRequestId,
  RenderProvider,
  resolveDebugMode,
  SurfaceRoot,
  type RenderProviderProps,
  type RenderLayerDismissal,
  type RenderRuntimeFacts,
  type RenderSurfaceReadyInput,
  type RendererBinding,
  type SurfaceCanvasDeclaration,
  type SurfaceHostMeasurementSource,
} from '@catering-v2s/ui-base-render'
import {createStartupDiagnosticsWriter, type StartupDiagnosticsWriter} from './startupDiagnosticsWriter'

export type ConsoleSurfaceCreationInput = Readonly<{
  readonly displayIndex: 0 | 1
  readonly displayMode: DisplayMode
  readonly surfaceForm: SurfaceForm
}>

export type ConsoleSurfaceDeclarations = Readonly<{
  readonly PRIMARY: SurfaceCanvasDeclaration
  readonly SECONDARY?: SurfaceCanvasDeclaration
}>

type ConsoleDefinedPart = Readonly<{
  readonly catalogEntry: UiCatalogEntry
  readonly rendererBinding: RendererBinding<any>
}>

const assertUniquePartKeys = (parts: readonly ConsoleDefinedPart[]): void => {
  const seen = new Set<string>()
  for (const part of parts) {
    if (seen.has(part.catalogEntry.partKey)) {
      throw new Error(`[ui.base.console-assembly] duplicate partKey: ${part.catalogEntry.partKey}`)
    }
    seen.add(part.catalogEntry.partKey)
  }
}

export type ConsoleAssembly = Readonly<{
  readonly appName: string
  readonly runtime: Runtime
  readonly surfaceForm: SurfaceForm
  readonly surfaceDeclarations: ConsoleSurfaceDeclarations
  readonly runtimeFacts: RenderRuntimeFacts
  readonly createSurface: (input: ConsoleSurfaceCreationInput) => ReactElement
}>

export type ConsoleAssemblyInput<TReadyPayload extends StateJsonValue> = Readonly<{
  readonly appName: string
  readonly errorPrefix: string
  readonly runtimeName: string
  readonly defaultPersistenceKey: string
  readonly platformPorts: PlatformPorts
  readonly nativeLoadingCapability: NativeLoadingCapability
  readonly persistenceKey?: string
  readonly surfaceForm: SurfaceForm
  readonly surfaceDeclarations: ConsoleSurfaceDeclarations
  readonly environmentMode?: EnvironmentMode
  readonly packagingDebugMode?: boolean
  readonly startupDebugMode?: boolean
  readonly parts: readonly ConsoleDefinedPart[]
  readonly layerDismissals: Readonly<Record<string, RenderLayerDismissal>>
  readonly variables: readonly UiVariableDeclaration<StateJsonValue>[]
  readonly surfaceHostSourcesByDisplayIndex?: Readonly<Partial<Record<0 | 1, SurfaceHostMeasurementSource>>>
  readonly startupReadyCommand: CommandDefinition<TReadyPayload>
  readonly createStartupReadyPayload: (input: RenderSurfaceReadyInput) => TReadyPayload
  readonly createApplicationModules: (input: Readonly<{
    readonly uiStateModule: UiStateModule
  }>) => readonly RuntimeModule[]
  readonly renderChildren?: () => ReactNode
}>

export const createStateSource = (runtime: Runtime): RenderProviderProps['stateSource'] => Object.freeze({
  getStatus: () => runtime.status,
  getState: () => runtime.getState(),
  subscribe: (listener: () => void) => runtime.subscribe(listener),
})

export const createDispatchCommand = (runtime: Runtime): RenderProviderProps['dispatchCommand'] =>
  (command, options) => runtime.dispatchCommand(command.definition, command.payload, {
    requestId: options.requestId,
  })

export const createSurfaceForDisplayIndex = (
  assembly: ConsoleAssembly,
  displayIndex: 0 | 1,
): ReactElement => {
  const state = assembly.runtime.getState()
  const displayMode = resolveSurfaceDisplayMode({
    displayIndex,
    displayRole: selectDisplayRole(state),
    instanceMode: selectRuntimeInstanceMode(state),
  })
  if (displayMode === 'SECONDARY' && assembly.surfaceDeclarations.SECONDARY === undefined) {
    throw new Error(`[${assembly.appName}] display index ${displayIndex} is unavailable for ${assembly.surfaceForm}`)
  }
  return assembly.createSurface({displayIndex, displayMode, surfaceForm: assembly.surfaceForm})
}

type ConsoleSurfaceInputFrameProps = Readonly<{
  readonly appName: string
  readonly surface: ConsoleSurfaceCreationInput
  readonly declaredSize: SurfaceCanvasDeclaration
  readonly logger: LoggerPort
  readonly hostSourceAttached: boolean
  readonly onSurfaceDeclared: () => void
  readonly onSurfaceMeasured: () => void
  readonly children?: ReactNode
}>

const ConsoleSurfaceInputFrame = ({
  appName,
  surface,
  declaredSize,
  logger,
  hostSourceAttached,
  onSurfaceDeclared,
  onSurfaceMeasured,
  children,
}: ConsoleSurfaceInputFrameProps) => {
  const declaredRef = useRef(false)
  const declaredDiagnosticRef = useRef(false)
  const reportInputDiagnostic = useCallback((diagnostic: InputDiagnostic) => {
    if (!__DEV__) return
    logger.info({
      category: 'display-diagnostics',
      event: diagnostic.event,
      message: 'Input display-chain diagnostic',
      data: {
        ...diagnostic.data,
        source: 'ui.base.console-assembly.ConsoleSurfaceInputFrame',
        appName,
        displayMode: surface.displayMode,
        displayIndex: surface.displayIndex,
        surfaceForm: surface.surfaceForm,
        hostSourceAttached,
        declaredWidth: declaredSize.width,
        declaredHeight: declaredSize.height,
      },
    })
  }, [appName, declaredSize.height, declaredSize.width, hostSourceAttached, logger, surface.displayIndex, surface.displayMode, surface.surfaceForm])

  if (!declaredRef.current) {
    declaredRef.current = true
    onSurfaceDeclared()
  }

  if (__DEV__ && !declaredDiagnosticRef.current) {
    declaredDiagnosticRef.current = true
    logger.info({
      category: 'startup.surfaces',
      event: 'startup.surfaces.declared',
      message: 'Declared surface baseline registered',
      data: {
        kind: 'declared',
        source: 'ui.base.console-assembly.ConsoleSurfaceInputFrame',
        appName,
        displayMode: surface.displayMode,
        displayIndex: surface.displayIndex,
        surfaceForm: surface.surfaceForm,
        width: declaredSize.width,
        height: declaredSize.height,
        hostSourceAttached,
      },
    })
  }

  return (
    <InputSurfaceFrame
      onDiagnostic={reportInputDiagnostic}
      onMeasuredFrame={frame => {
        onSurfaceMeasured()
        if (!__DEV__) return
        logger.info({
          category: 'startup.surfaces',
          event: 'startup.surfaces.measured',
          message: 'Measured surface frame observed',
          data: {
            kind: 'measured',
            source: 'ui.base.console-assembly.ConsoleSurfaceInputFrame.onLayout',
            appName,
            displayMode: surface.displayMode,
            displayIndex: surface.displayIndex,
            surfaceForm: surface.surfaceForm,
            width: frame.width,
            height: frame.height,
            deltaWidth: frame.width - declaredSize.width,
            deltaHeight: frame.height - declaredSize.height,
            ready: frame.ready,
            orientation: frame.orientation,
            hostSourceAttached,
          },
        })
      }}
    >
      {children}
    </InputSurfaceFrame>
  )
}

export const createConsoleAssembly = async <TReadyPayload extends StateJsonValue>(
  input: ConsoleAssemblyInput<TReadyPayload>,
): Promise<ConsoleAssembly> => {
  // Production bundles must not inherit the development diagnostics mode when
  // a caller omits the optional test override. The Android assembly passes an
  // explicit mode; this branch keeps the same contract for other real shells.
  const environmentMode: EnvironmentMode = input.environmentMode ?? (__DEV__ ? 'DEV' : 'PROD')
  const deviceInfoResult = await input.platformPorts.device.getDeviceInfo({timeoutMs: 2_000})
  const deviceIdentity = normalizeDeviceIdentity(deviceInfoResult)
  const runtimeFacts = createRenderRuntimeFacts({
    environmentMode,
    debugMode: resolveDebugMode({packaging: input.packagingDebugMode, startup: input.startupDebugMode}),
    deviceIdentity,
    platformPortCapabilities: describePlatformPortCapabilities(input.platformPorts),
  })
  const allParts = Object.freeze([...adminShellAssembly.parts, ...input.parts])
  assertUniquePartKeys(allParts)
  const uiCatalog = createUiCatalog(allParts.map(({catalogEntry}) => catalogEntry))
  const rendererCatalog = createRendererCatalog(allParts.map(({rendererBinding}) => rendererBinding))
  const uiStateModule = createUiStateModule({
    catalog: uiCatalog,
    variables: input.variables,
    surfaceForm: input.surfaceForm,
  })
  const startupReadiness = {
    primaryDeclared: false,
    primaryMeasured: false,
    primaryRealReady: false,
    parts: uiCatalog.entries.length > 0 && uiCatalog.entries.every(entry => rendererCatalog.resolve(entry.rendererKey) !== undefined),
  }
  let runtime: Runtime | undefined
  const startupDiagnosticsWriter = createStartupDiagnosticsWriter({
    logger: input.platformPorts.logger,
    startupRunId: createRuntimeInstanceId(),
    appName: input.appName,
    surfaceProvenance: {
      surfaceKey: 'PRIMARY',
      displayIndex: 0,
      surfaceForm: input.surfaceForm,
    },
    clientProvenance: {
      clientId: createRuntimeInstanceId(),
      clientName: input.appName,
      owner: 'ui.base.console-assembly',
    },
    getReadiness: () => {
      const descriptors = runtime?.status === 'started' ? runtime.descriptors : []
      const runtimeStarted = descriptors.length > 0
      const registrationGroupsComplete = runtimeStarted && descriptors.every(descriptor =>
        Array.isArray(descriptor.stateSliceNames)
        && Array.isArray(descriptor.commandNames)
        && Array.isArray(descriptor.actorKeys),
      )
      return {
        groups: {
          modules: runtimeStarted,
          slices: registrationGroupsComplete,
          commands: registrationGroupsComplete,
          actors: registrationGroupsComplete,
          ports: runtimeFacts.platformPortCapabilities.every(port => port.descriptorStatus === 'complete'),
          parts: startupReadiness.parts,
        },
        primaryDeclared: startupReadiness.primaryDeclared,
        primaryMeasured: startupReadiness.primaryMeasured,
        primaryRealReady: startupReadiness.primaryRealReady,
      }
    },
  })
  const modules: readonly RuntimeModule[] = [
    createDisplayContextModule(),
    uiStateModule,
    ...input.createApplicationModules({uiStateModule}),
  ]
  runtime = createRuntime({
    localNodeId: createNodeId(),
    modules,
    platformPorts: input.platformPorts,
    state: {
      runtimeName: input.runtimeName,
      environmentMode,
      persistenceKey: input.persistenceKey ?? input.defaultPersistenceKey,
      persistenceDebounceMs: 300,
    },
  })
  await runtime.start()
  if (runtime.status !== 'started') throw new Error(`[${input.errorPrefix}] runtime did not start`)

  const stateSource = createStateSource(runtime)
  const dispatchCommand = createDispatchCommand(runtime)
  let primaryReadyPromise: Promise<void> | null = null
  let primarySurfaceReady = false
  const onPrimarySurfaceReady: NonNullable<RenderProviderProps['onPrimarySurfaceReady']> = readyInput => {
    // ScreenReadyBoundary is intentionally local to the currently rendered
    // real part.  A login -> business navigation therefore mounts another
    // boundary in the same runtime.  Share the first accepted promise so
    // that navigation cannot dispatch startup-ready (and write complete) a
    // second time, while a genuinely failed first attempt remains retryable.
    if (primaryReadyPromise !== null) return primaryReadyPromise
    primaryReadyPromise = dispatchWithRequestId({
      dispatchCommand,
      definition: input.startupReadyCommand,
      payload: input.createStartupReadyPayload(readyInput),
      requestId: createRequestId(),
    }).then(result => {
      if (result.status !== 'completed') {
        throw new Error(`[${input.errorPrefix}] startup-ready command ended with ${result.status}`)
      }
      startupReadiness.primaryRealReady = true
      if (!startupDiagnosticsWriter.writeComplete()) {
        throw new Error(`[${input.errorPrefix}] startup completion prerequisites were not met`)
      }
      primarySurfaceReady = true
    }).catch(error => {
      primaryReadyPromise = null
      throw error
    })
    return primaryReadyPromise
  }
  const selectUiVariable: RenderProviderProps['selectUiVariable'] = (root, declaration) =>
    uiStateModule.selectUiVariable(root, declaration)
  const selectSurfaceForm: RenderProviderProps['selectSurfaceForm'] = root => uiStateModule.selectSurfaceForm(root)
  const boundHostSources = new Map<string, ReturnType<typeof bindSurfaceHostIdentity>>()
  const getSurfaceHostSource = (surface: ConsoleSurfaceCreationInput) => {
    const source = input.surfaceHostSourcesByDisplayIndex?.[surface.displayIndex]
    if (source === undefined) return undefined
    const cacheKey = `${surface.displayIndex}:${surface.displayMode}:${surface.surfaceForm}`
    const cached = boundHostSources.get(cacheKey)
    if (cached !== undefined) return cached
    const bound = bindSurfaceHostIdentity(
      source,
      {
        surfaceKey: surface.displayIndex === 0 ? 'PRIMARY' : 'SECONDARY',
        displayIndex: surface.displayIndex,
        surfaceForm: surface.surfaceForm,
        displayMode: surface.displayMode,
      },
      rejection => {
        input.platformPorts.logger.warn({
          category: 'display-diagnostics',
          event: 'surface.host-identity-rejected',
          message: 'Surface host source rejected because its physical host flag does not match the bound display index',
          data: {
            source: 'ui.base.console-assembly.bindSurfaceHostIdentity',
            appName: input.appName,
            reason: rejection.reason,
            displayIndex: rejection.displayIndex,
            expectedIsHostPrimaryDisplay: rejection.expectedIsHostPrimaryDisplay,
            actualIsHostPrimaryDisplay: rejection.actualIsHostPrimaryDisplay,
            displayMode: surface.displayMode,
            surfaceForm: surface.surfaceForm,
          },
        })
      },
    )
    boundHostSources.set(cacheKey, bound)
    return bound
  }

  if (__DEV__) {
    input.platformPorts.logger.info({
      category: 'display-diagnostics',
      event: 'sample.assembly-created',
      message: 'Shared console assembly display-chain inputs registered',
      data: {
        source: 'ui.base.console-assembly.createConsoleAssembly',
        appName: input.appName,
        surfaceForm: input.surfaceForm,
        primaryWidth: input.surfaceDeclarations.PRIMARY.width,
        primaryHeight: input.surfaceDeclarations.PRIMARY.height,
        secondaryWidth: input.surfaceDeclarations.SECONDARY?.width ?? null,
        secondaryHeight: input.surfaceDeclarations.SECONDARY?.height ?? null,
        primaryHostSourceAttached: input.surfaceHostSourcesByDisplayIndex?.[0] !== undefined,
        secondaryHostSourceAttached: input.surfaceHostSourcesByDisplayIndex?.[1] !== undefined,
      },
    })
    input.platformPorts.logger.info({
      category: 'startup.device',
      event: 'sample.device-identity-resolved',
      message: 'Sample device identity fact resolved',
      data: {
        appName: input.appName,
        available: deviceIdentity.available,
        source: 'ui.base.console-assembly.createConsoleAssembly',
      },
    })
  }
  input.platformPorts.logger.info({
    category: 'startup.runtime-facts',
    event: 'sample.runtime-facts-resolved',
    message: 'Sample runtime facts resolved',
    data: {
      source: 'ui.base.console-assembly.createConsoleAssembly',
      appName: input.appName,
      debugEnabled: runtimeFacts.debugMode.enabled,
      debugSource: runtimeFacts.debugMode.source,
      deviceIdentityAvailable: runtimeFacts.deviceIdentity.available,
      capabilityDescriptorCount: runtimeFacts.platformPortCapabilities.length,
    },
  })

  const reportedSurfaceModes = new Set<DisplayMode>()
  const createSurface = (surface: ConsoleSurfaceCreationInput): ReactElement => {
    const declaredSize = surface.displayMode === 'PRIMARY'
      ? input.surfaceDeclarations.PRIMARY
      : input.surfaceDeclarations.SECONDARY
    if (declaredSize === undefined) {
      throw new Error(`[${input.errorPrefix}] ${surface.displayMode} is unavailable for ${surface.surfaceForm}`)
    }
    if (__DEV__ && !reportedSurfaceModes.has(surface.displayMode)) {
      reportedSurfaceModes.add(surface.displayMode)
      input.platformPorts.logger.info({
        category: 'display-diagnostics',
        event: 'sample.surface-created',
        message: 'Sample display surface created',
        data: {
          source: 'ui.base.console-assembly.createConsoleAssembly',
          appName: input.appName,
          displayMode: surface.displayMode,
          displayIndex: surface.displayIndex,
          surfaceForm: surface.surfaceForm,
          containerKey: 'main',
          orientation: surface.surfaceForm === 'laptop' ? 'landscape' : 'portrait',
          declaredWidth: declaredSize.width,
          declaredHeight: declaredSize.height,
          hostSourceAttached: input.surfaceHostSourcesByDisplayIndex?.[surface.displayIndex] !== undefined,
        },
      })
    }
    return (
      <RenderProvider
        stateSource={stateSource}
        uiCatalog={uiCatalog}
        rendererCatalog={rendererCatalog}
        logger={input.platformPorts.logger}
        nativeLoadingCapability={input.nativeLoadingCapability}
        onPrimarySurfaceReady={onPrimarySurfaceReady}
        getPrimarySurfaceReady={() => primarySurfaceReady}
        runtimeFacts={runtimeFacts}
        dispatchCommand={dispatchCommand}
        layerDismissals={input.layerDismissals}
        selectUiVariable={selectUiVariable}
        selectSurfaceForm={selectSurfaceForm}
      >
        <SurfaceRoot
          displayMode={surface.displayMode}
          containerKey="main"
          canvas={declaredSize}
          surfaceHostSource={getSurfaceHostSource(surface)}
          renderContentFrame={({content}) => (
            <ConsoleSurfaceInputFrame
              appName={input.appName}
              surface={surface}
              declaredSize={declaredSize}
              logger={input.platformPorts.logger}
              hostSourceAttached={input.surfaceHostSourcesByDisplayIndex?.[surface.displayIndex] !== undefined}
              onSurfaceDeclared={() => {
                if (surface.displayIndex === 0) startupReadiness.primaryDeclared = true
              }}
              onSurfaceMeasured={() => {
                if (surface.displayIndex === 0) startupReadiness.primaryMeasured = true
              }}
            >
              <AdminLauncher canvas={declaredSize}>{content}</AdminLauncher>
            </ConsoleSurfaceInputFrame>
          )}
        >
          {input.renderChildren?.()}
        </SurfaceRoot>
      </RenderProvider>
    )
  }

  return Object.freeze({
    appName: input.appName,
    runtime,
    surfaceForm: input.surfaceForm,
    surfaceDeclarations: input.surfaceDeclarations,
    runtimeFacts,
    createSurface,
  })
}
