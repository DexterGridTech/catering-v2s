import {createNodeId} from '@catering-v2s/kernel-base-contracts'
import type {PlatformPorts} from '@catering-v2s/kernel-base-platform-ports'
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
import {createRendererCatalog, RenderProvider, SurfaceRoot, type RenderProviderProps} from '@catering-v2s/ui-base-render'
import {InputSurfaceFrame} from '@catering-v2s/ui-base-input'
import {createElement, useEffect, useState, type ReactElement, type ReactNode} from 'react'
import {sampleMemberDeskAssembly} from '@catering-v2s/ui-feature-sample-member-desk'
import {sampleStaffAuthAssembly} from '@catering-v2s/ui-feature-sample-staff-auth'
import {createSampleMemberRegistryModule} from '@catering-v2s/kernel-feature-sample-member-registry'
import {createSampleStaffSessionModule} from '@catering-v2s/kernel-feature-sample-staff-session'
import {createBaseModuleDescriptors} from './baseModuleDescriptors'

const defaultPersistenceKey = 'sample-console'
const mainContainerKey = 'main' as const

export type SampleAssembly = Readonly<{
  readonly runtime: Runtime
  readonly createSurface: (displayMode: DisplayMode) => ReactElement
}>

type SurfaceImeInsetsSnapshot = Readonly<{
  readonly visible: boolean
  readonly bottomLogical: number
}>

type SurfaceImeInsetsSource = Readonly<{
  readonly getSnapshot: () => SurfaceImeInsetsSnapshot | null
  readonly subscribe: (listener: (snapshot: SurfaceImeInsetsSnapshot) => void) => () => void
}>

const SurfaceInputFrame = ({
  imeInsetsSource,
  children,
}: Readonly<{
  readonly imeInsetsSource?: SurfaceImeInsetsSource
  readonly children?: ReactNode
}>) => {
  const [snapshot, setSnapshot] = useState<SurfaceImeInsetsSnapshot | null>(
    () => imeInsetsSource?.getSnapshot() ?? null,
  )

  useEffect(() => {
    if (imeInsetsSource === undefined) return undefined
    setSnapshot(imeInsetsSource.getSnapshot())
    return imeInsetsSource.subscribe(setSnapshot)
  }, [imeInsetsSource])

  return createElement(
    InputSurfaceFrame,
    {
      imeInset: snapshot?.visible === true ? Math.max(0, snapshot.bottomLogical) : 0,
    },
    children,
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
  readonly imeInsetsSources?: Readonly<Partial<Record<DisplayMode, SurfaceImeInsetsSource>>>
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

  const createSurface = (displayMode: DisplayMode): ReactElement => createElement(
    RenderProvider,
    {
      stateSource,
      uiCatalog,
      rendererCatalog,
      logger: input.platformPorts.logger,
      dispatchCommand,
      selectUiVariable,
    },
    createElement(SurfaceRoot, {
      displayMode,
      containerKey: mainContainerKey,
      renderContentFrame: ({content}) => createElement(
        SurfaceInputFrame,
        {
          imeInsetsSource: input.imeInsetsSources?.[displayMode],
        },
        content,
      ),
    }),
  )

  return Object.freeze({runtime, createSurface})
}
