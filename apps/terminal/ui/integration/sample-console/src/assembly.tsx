import {createNodeId} from '@catering-v2s/kernel-base-contracts'
import type {PlatformPorts} from '@catering-v2s/kernel-base-platform-ports'
import {createDisplayContextModule} from '@catering-v2s/kernel-base-display-context'
import type {DisplayMode} from '@catering-v2s/kernel-base-display-context'
import {createRuntime, type Runtime, type RuntimeModule} from '@catering-v2s/kernel-base-runtime'
import {createUiCatalog, createUiStateModule} from '@catering-v2s/kernel-base-ui-state'
import {createRendererCatalog, RenderProvider, SurfaceRoot, type RenderProviderProps} from '@catering-v2s/ui-base-render'
import {createElement, type ReactElement} from 'react'
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
    ...sampleMemberDeskAssembly.variables,
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
    createElement(SurfaceRoot, {displayMode, containerKey: mainContainerKey}),
  )

  return Object.freeze({runtime, createSurface})
}
