import {createNodeId} from '@catering-v2s/kernel-base-contracts'
import type {LoggerPort, PlatformPorts} from '@catering-v2s/kernel-base-platform-ports'
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
  createRendererCatalog,
  RenderProvider,
  SurfaceRoot,
  useSurfaceHostImeInset,
  type RenderProviderProps,
  type SurfaceHostSource,
} from '@catering-v2s/ui-base-render'
import {InputSurfaceFrame, type InputDiagnostic} from '@catering-v2s/ui-base-input'
import {useCallback, useRef, type ReactElement, type ReactNode} from 'react'
import {sampleMemberDeskAssembly} from '@catering-v2s/ui-feature-sample-member-desk'
import {sampleStaffAuthAssembly} from '@catering-v2s/ui-feature-sample-staff-auth'
import {createSampleMemberRegistryModule} from '@catering-v2s/kernel-feature-sample-member-registry'
import {createSampleStaffSessionModule} from '@catering-v2s/kernel-feature-sample-staff-session'
import {createBaseModuleDescriptors} from '../application/baseModuleDescriptors'
import {terminalSurfaces} from '../application/terminalSurfaces'

const defaultPersistenceKey = 'sample-console'
const mainContainerKey = 'main' as const
const landscapeSurfaces = terminalSurfaces.orientations.landscape

export type SampleAssembly = Readonly<{
  readonly runtime: Runtime
  readonly createSurface: (displayMode: DisplayMode) => ReactElement
}>

const SurfaceInputFrame = ({
  displayMode,
  logger,
  hostSourceAttached,
  children,
}: Readonly<{
  readonly displayMode: DisplayMode
  readonly logger: LoggerPort
  readonly hostSourceAttached: boolean
  readonly children?: ReactNode
}>) => {
  const declaredRef = useRef(false)
  const declaredSize = landscapeSurfaces[displayMode]
  const imeInset = useSurfaceHostImeInset()

  const reportInputDiagnostic = useCallback((diagnostic: InputDiagnostic) => {
    if (!__DEV__) return
    logger.info({
      category: 'display-diagnostics',
      event: diagnostic.event,
      message: 'Input display-chain diagnostic',
      data: {
        ...diagnostic.data,
        sampleSource: 'sample-console.SurfaceInputFrame',
        displayMode,
        hostSourceAttached,
        declaredWidth: declaredSize.width,
        declaredHeight: declaredSize.height,
      },
    })
  }, [declaredSize.height, declaredSize.width, displayMode, hostSourceAttached, logger])

  if (__DEV__ && !declaredRef.current) {
    declaredRef.current = true
    logger.info({
      category: 'startup.surfaces',
      event: 'startup.surfaces.declared',
      message: 'Declared surface baseline registered',
      data: {
        kind: 'declared',
        displayMode,
        width: declaredSize.width,
        height: declaredSize.height,
        source: 'sample-console.package.json',
      },
    })
  }

  return (
    <InputSurfaceFrame
      imeInset={imeInset}
      onDiagnostic={reportInputDiagnostic}
      onMeasuredFrame={frame => {
        if (!__DEV__) return
        logger.info({
          category: 'startup.surfaces',
          event: 'startup.surfaces.measured',
          message: 'Measured surface frame observed',
          data: {
            kind: 'measured',
            displayMode,
            width: frame.width,
            height: frame.height,
            deltaWidth: frame.width - declaredSize.width,
            deltaHeight: frame.height - declaredSize.height,
            ready: frame.ready,
            orientation: frame.orientation,
            source: 'ui-base-input.InputSurfaceFrame.onLayout',
          },
        })
      }}
    >
      {children}
    </InputSurfaceFrame>
  )
}

export const createSurfaceForDisplayIndex = (
  assembly: SampleAssembly,
  displayIndex: 0 | 1,
): ReactElement => {
  const state = assembly.runtime.getState()
  const displayMode = resolveSurfaceDisplayMode({
    displayIndex,
    displayRole: selectDisplayRole(state),
    instanceMode: selectRuntimeInstanceMode(state),
  })
  return assembly.createSurface(displayMode)
}

const createStateSource = (runtime: Runtime): RenderProviderProps['stateSource'] => Object.freeze({
  getStatus: () => runtime.status,
  getState: () => runtime.getState(),
  subscribe: (listener: () => void) => runtime.subscribe(listener),
})

const createDispatchCommand = (runtime: Runtime): RenderProviderProps['dispatchCommand'] =>
  (command, options) => runtime.dispatchCommand(command.definition, command.payload, {
    requestId: options.requestId,
  })

export const createSampleAssembly = async (input: Readonly<{
  readonly platformPorts: PlatformPorts
  readonly persistenceKey?: string
  readonly surfaceHostSources?: Readonly<Partial<Record<DisplayMode, SurfaceHostSource>>>
}>): Promise<SampleAssembly> => {
  const definedParts = [
    ...sampleStaffAuthAssembly.parts,
    ...sampleMemberDeskAssembly.parts,
  ] as const
  const uiCatalog = createUiCatalog(definedParts.map(({catalogEntry}) => catalogEntry))
  const rendererCatalog = createRendererCatalog(
    definedParts.map(({rendererBinding}) => rendererBinding),
  )
  const variables = [
    ...sampleStaffAuthAssembly.variables,
  ] as const
  const uiStateModule = createUiStateModule({catalog: uiCatalog, variables})
  const modules: readonly RuntimeModule[] = [
    ...createBaseModuleDescriptors(),
    createDisplayContextModule(),
    uiStateModule,
    createSampleStaffSessionModule(),
    createSampleMemberRegistryModule(),
    sampleStaffAuthAssembly.createModule(),
    sampleMemberDeskAssembly.createModule(),
  ]
  const runtime = createRuntime({
    localNodeId: createNodeId(),
    modules,
    platformPorts: input.platformPorts,
    state: {
      runtimeName: 'sample-console',
      environmentMode: 'DEV',
      persistenceKey: input.persistenceKey ?? defaultPersistenceKey,
      storageTimeouts: {readMs: 2_000, writeMs: 2_000, resetMs: 5_000},
      persistenceDebounceMs: 300,
    },
  })
  await runtime.start()
  if (runtime.status !== 'started') throw new Error('[sample-console] runtime did not start')

  const stateSource = createStateSource(runtime)
  const dispatchCommand = createDispatchCommand(runtime)
  const selectUiVariable: RenderProviderProps['selectUiVariable'] = (root, declaration) =>
    uiStateModule.selectUiVariable(root, declaration)

  if (__DEV__) {
    input.platformPorts.logger.info({
      category: 'display-diagnostics',
      event: 'sample.assembly-created',
      message: 'Sample display-chain inputs registered',
      data: {
        source: 'sample-console.createSampleAssembly',
        orientation: 'landscape',
        primaryWidth: landscapeSurfaces.PRIMARY.width,
        primaryHeight: landscapeSurfaces.PRIMARY.height,
        secondaryWidth: landscapeSurfaces.SECONDARY.width,
        secondaryHeight: landscapeSurfaces.SECONDARY.height,
        primaryHostSourceAttached: input.surfaceHostSources?.PRIMARY !== undefined,
        secondaryHostSourceAttached: input.surfaceHostSources?.SECONDARY !== undefined,
      },
    })
  }

  const reportedSurfaceModes = new Set<DisplayMode>()
  const createSurface = (displayMode: DisplayMode): ReactElement => {
    if (__DEV__ && !reportedSurfaceModes.has(displayMode)) {
      reportedSurfaceModes.add(displayMode)
      const declaredSize = landscapeSurfaces[displayMode]
      input.platformPorts.logger.info({
        category: 'display-diagnostics',
        event: 'sample.surface-created',
        message: 'Sample display surface created',
        data: {
          source: 'sample-console.createSurface',
          displayMode,
          containerKey: mainContainerKey,
          orientation: 'landscape',
          declaredWidth: declaredSize.width,
          declaredHeight: declaredSize.height,
          hostSourceAttached: input.surfaceHostSources?.[displayMode] !== undefined,
        },
      })
    }
    return (
      <RenderProvider
        stateSource={stateSource}
        uiCatalog={uiCatalog}
        rendererCatalog={rendererCatalog}
        logger={input.platformPorts.logger}
        dispatchCommand={dispatchCommand}
        selectUiVariable={selectUiVariable}
      >
        <SurfaceRoot
          displayMode={displayMode}
          containerKey={mainContainerKey}
          canvas={landscapeSurfaces[displayMode]}
          surfaceHostSource={input.surfaceHostSources?.[displayMode]}
          renderContentFrame={({content}) => (
            <SurfaceInputFrame
              displayMode={displayMode}
              logger={input.platformPorts.logger}
              hostSourceAttached={input.surfaceHostSources?.[displayMode] !== undefined}
            >
              {content}
            </SurfaceInputFrame>
          )}
        />
      </RenderProvider>
    )
  }

  return Object.freeze({runtime, createSurface})
}
