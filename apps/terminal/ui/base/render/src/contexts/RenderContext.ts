import {createContext, useContext} from 'react'
import type {LoggerPort} from '@catering-v2s/kernel-base-platform-ports'
import type {UiCatalog} from '@catering-v2s/kernel-base-ui-state'
import type {RenderSnapshotReader} from '../foundations/createRenderSnapshotReader'
import type {RendererCatalog} from '../types/catalog'
import type {RenderProviderProps} from '../types/props'
import type {RenderPartDiagnosticReporter} from '../foundations/diagnostics'

export type RenderContextValue = Readonly<{
  readonly stateSource: RenderProviderProps['stateSource']
  readonly uiCatalog: UiCatalog
  readonly rendererCatalog: RendererCatalog
  readonly logger: LoggerPort
  readonly runtimeFacts: RenderProviderProps['runtimeFacts']
  readonly dispatchCommand: RenderProviderProps['dispatchCommand']
  readonly selectUiVariable: RenderProviderProps['selectUiVariable']
  readonly selectSurfaceForm: NonNullable<RenderProviderProps['selectSurfaceForm']>
  readonly snapshotReader: RenderSnapshotReader
  readonly reportPartDiagnostic: RenderPartDiagnosticReporter['report']
  readonly clearPartDiagnostic: RenderPartDiagnosticReporter['clearForPart']
}>

export const RenderContext = createContext<RenderContextValue | undefined>(undefined)

export const useRenderContext = (): RenderContextValue => {
  const value = useContext(RenderContext)
  if (value === undefined) throw new Error('[ui-base-render] RenderProvider is required')
  return value
}
