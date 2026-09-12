import type {ComponentType} from 'react'
import type {RenderProviderProps, RenderRuntimeFacts, SurfaceContextValue} from '@catering-v2s/ui-base-render'
import type {UiCatalogEntry} from '@catering-v2s/kernel-base-ui-state'
import type {AdminSectionCommandBoundary} from '../foundations/adminSectionSelection'

export type AdminRenderStateRoot = ReturnType<RenderProviderProps['stateSource']['getState']>

export type AdminSectionRenderContext = Readonly<{
  readonly catalogEntry: UiCatalogEntry
  readonly stateRoot: AdminRenderStateRoot
  readonly stateSource: RenderProviderProps['stateSource']
  readonly runtimeFacts: RenderRuntimeFacts
  readonly surface: SurfaceContextValue
  readonly commandBoundary: AdminSectionCommandBoundary
}>

export type AdminSectionProps = Readonly<{
  readonly context: AdminSectionRenderContext
}>

export type AdminSectionComponent = ComponentType<AdminSectionProps>
