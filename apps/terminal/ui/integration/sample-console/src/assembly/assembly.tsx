import {createNodeId} from '@catering-v2s/kernel-base-contracts'
import {describePlatformPortCapabilities, normalizeDeviceIdentity, type EnvironmentMode, type LoggerPort, type PlatformPorts} from '@catering-v2s/kernel-base-platform-ports'
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
  bindSurfaceHostIdentity,
  RenderProvider,
  SurfaceRoot,
  createRenderRuntimeFacts,
  resolveDebugMode,
  definePart,
  type RenderProviderProps,
  type RenderRuntimeFacts,
  type SurfaceHostMeasurementSource,
} from '@catering-v2s/ui-base-render'
import {InputSurfaceFrame, type InputDiagnostic} from '@catering-v2s/ui-base-input'
import {useCallback, useRef, type ReactElement, type ReactNode} from 'react'
import {sampleMemberDeskAssembly} from '@catering-v2s/ui-feature-sample-member-desk'
import {sampleStaffAuthAssembly} from '@catering-v2s/ui-feature-sample-staff-auth'
import {createSampleMemberRegistryModule} from '@catering-v2s/kernel-feature-sample-member-registry'
import {createSampleStaffSessionModule} from '@catering-v2s/kernel-feature-sample-staff-session'
import {
  ADMIN_SECTION_CONTAINER_KEY,
  AdminLauncher,
  SampleSection,
  adminShellAssembly,
} from '@catering-v2s/ui-base-admin-shell'
import {createBaseModuleDescriptors} from '../application/baseModuleDescriptors'
import {
  getSurfaceDeclarations,
  terminalSurfaces,
  type SurfaceCreationInput,
  type SurfaceForm,
} from '../application/terminalSurfaces'

const defaultPersistenceKey = 'sample-console'
const mainContainerKey = 'main' as const

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
    ...adminShellAssembly.parts,
    ...sampleStaffAuthAssembly.parts,
    ...sampleMemberDeskAssembly.parts,
  ]
  return Object.freeze(includeSampleAdminSection ? [...baseParts, sampleAdminTestPart] : baseParts)
}

export type SampleAssembly = Readonly<{
  readonly runtime: Runtime
  readonly surfaceForm: SurfaceForm
  readonly runtimeFacts: RenderRuntimeFacts
  readonly createSurface: (input: SurfaceCreationInput) => ReactElement
}>

const SurfaceInputFrame = ({
  surface,
  declaredSize,
  logger,
  hostSourceAttached,
  children,
}: Readonly<{
  readonly surface: SurfaceCreationInput
  readonly declaredSize: Readonly<{readonly width: number; readonly height: number}>
  readonly logger: LoggerPort
  readonly hostSourceAttached: boolean
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
        sampleSource: 'sample-console.SurfaceInputFrame',
        displayMode: surface.displayMode,
        displayIndex: surface.displayIndex,
        surfaceForm: surface.surfaceForm,
        hostSourceAttached,
        declaredWidth: declaredSize.width,
        declaredHeight: declaredSize.height,
      },
    })
  }, [declaredSize.height, declaredSize.width, hostSourceAttached, logger, surface.displayIndex, surface.displayMode, surface.surfaceForm])

  if (__DEV__ && !declaredRef.current) {
    declaredRef.current = true
    logger.info({
      category: 'startup.surfaces',
      event: 'startup.surfaces.declared',
      message: 'Declared surface baseline registered',
      data: {
        kind: 'declared',
        displayMode: surface.displayMode,
        displayIndex: surface.displayIndex,
        surfaceForm: surface.surfaceForm,
        width: declaredSize.width,
        height: declaredSize.height,
        source: 'sample-console.package.json',
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
          message: 'Measured surface frame observed',
          data: {
            kind: 'measured',
            displayMode: surface.displayMode,
            displayIndex: surface.displayIndex,
            surfaceForm: surface.surfaceForm,
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
  const declarations = getSurfaceDeclarations(terminalSurfaces, assembly.surfaceForm)
  if (displayMode === 'SECONDARY' && !('SECONDARY' in declarations)) {
    throw new Error(`[sample-console] display index ${displayIndex} is not available for ${assembly.surfaceForm}`)
  }
  return assembly.createSurface({displayIndex, displayMode, surfaceForm: assembly.surfaceForm})
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
  readonly surfaceForm: SurfaceForm
  readonly environmentMode?: EnvironmentMode
  readonly packagingDebugMode?: boolean
  readonly startupDebugMode?: boolean
  readonly surfaceHostSourcesByDisplayIndex?: Readonly<Partial<Record<0 | 1, SurfaceHostMeasurementSource>>>
}>): Promise<SampleAssembly> => {
  const surfaceForm = input.surfaceForm
  const environmentMode = input.environmentMode ?? 'DEV'
  const surfaceDeclarations = getSurfaceDeclarations(terminalSurfaces, surfaceForm)
  const deviceInfoResult = await input.platformPorts.device.getDeviceInfo({timeoutMs: 2_000})
  const deviceIdentity = normalizeDeviceIdentity(deviceInfoResult)
  const runtimeFacts = createRenderRuntimeFacts({
    environmentMode,
    debugMode: resolveDebugMode({
      packaging: input.packagingDebugMode,
      startup: input.startupDebugMode,
    }),
    deviceIdentity,
    platformPortCapabilities: describePlatformPortCapabilities(input.platformPorts),
  })
  const definedParts = createSampleDefinedParts()
  const uiCatalog = createUiCatalog(definedParts.map(({catalogEntry}) => catalogEntry))
  const rendererCatalog = createRendererCatalog(
    definedParts.map(({rendererBinding}) => rendererBinding),
  )
  const variables = [
    ...sampleStaffAuthAssembly.variables,
  ] as const
  const uiStateModule = createUiStateModule({catalog: uiCatalog, variables, surfaceForm})
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
      environmentMode,
      persistenceKey: input.persistenceKey ?? defaultPersistenceKey,
      persistenceDebounceMs: 300,
    },
  })
  await runtime.start()
  if (runtime.status !== 'started') throw new Error('[sample-console] runtime did not start')

  input.platformPorts.logger.info({
    category: 'startup.runtime-facts',
    event: 'sample.runtime-facts-resolved',
    message: 'Sample runtime facts resolved',
    data: {
      source: 'sample-console.createSampleAssembly',
      debugEnabled: runtimeFacts.debugMode.enabled,
      debugSource: runtimeFacts.debugMode.source,
      deviceIdentityAvailable: runtimeFacts.deviceIdentity.available,
      capabilityDescriptorCount: runtimeFacts.platformPortCapabilities.length,
    },
  })

  const stateSource = createStateSource(runtime)
  const dispatchCommand = createDispatchCommand(runtime)
  const selectUiVariable: RenderProviderProps['selectUiVariable'] = (root, declaration) =>
    uiStateModule.selectUiVariable(root, declaration)
  const selectSurfaceForm: RenderProviderProps['selectSurfaceForm'] = root =>
    uiStateModule.selectSurfaceForm(root)

  const boundHostSources = new Map<string, ReturnType<typeof bindSurfaceHostIdentity>>()
  const getSurfaceHostSource = (surface: SurfaceCreationInput) => {
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
            source: 'sample-console.bindSurfaceHostIdentity',
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
      message: 'Sample display-chain inputs registered',
      data: {
        source: 'sample-console.createSampleAssembly',
        surfaceForm,
        primaryWidth: surfaceDeclarations.PRIMARY.width,
        primaryHeight: surfaceDeclarations.PRIMARY.height,
        secondaryWidth: 'SECONDARY' in surfaceDeclarations ? surfaceDeclarations.SECONDARY.width : null,
        secondaryHeight: 'SECONDARY' in surfaceDeclarations ? surfaceDeclarations.SECONDARY.height : null,
        primaryHostSourceAttached: input.surfaceHostSourcesByDisplayIndex?.[0] !== undefined,
        secondaryHostSourceAttached: input.surfaceHostSourcesByDisplayIndex?.[1] !== undefined,
      },
    })
    input.platformPorts.logger.info({
      category: 'startup.device',
      event: 'sample.device-identity-resolved',
      message: 'Sample device identity fact resolved',
      data: {
        available: deviceIdentity.available,
        source: 'platformPorts.device.getDeviceInfo',
      },
    })
  }

  const reportedSurfaceModes = new Set<DisplayMode>()
  const createSurface = (surface: SurfaceCreationInput): ReactElement => {
    const declaredSize = surface.displayMode === 'PRIMARY'
      ? surfaceDeclarations.PRIMARY
      : 'SECONDARY' in surfaceDeclarations
        ? surfaceDeclarations.SECONDARY
        : undefined
    if (declaredSize === undefined) {
      throw new Error(`[sample-console] ${surface.displayMode} is unavailable for ${surface.surfaceForm}`)
    }
    if (__DEV__ && !reportedSurfaceModes.has(surface.displayMode)) {
      reportedSurfaceModes.add(surface.displayMode)
      input.platformPorts.logger.info({
        category: 'display-diagnostics',
        event: 'sample.surface-created',
        message: 'Sample display surface created',
        data: {
          source: 'sample-console.createSurface',
          displayMode: surface.displayMode,
          displayIndex: surface.displayIndex,
          surfaceForm: surface.surfaceForm,
          containerKey: mainContainerKey,
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
              hostSourceAttached={input.surfaceHostSourcesByDisplayIndex?.[surface.displayIndex] !== undefined}
            >
              <AdminLauncher canvas={declaredSize}>{content}</AdminLauncher>
            </SurfaceInputFrame>
          )}
        />
      </RenderProvider>
    )
  }

  return Object.freeze({runtime, surfaceForm, runtimeFacts, createSurface})
}
