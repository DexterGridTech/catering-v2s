import type {ComponentType} from 'react'
import type {RenderRuntimeFacts, SurfaceContextValue} from '@catering-v2s/ui-base-render'
import type {UiCatalogEntry} from '@catering-v2s/kernel-base-ui-state'
import type {AdminSectionCommandBoundary} from '../foundations/adminSectionSelection'

export type AdminSectionRenderContext = Readonly<{
  readonly catalogEntry: UiCatalogEntry
  readonly runtimeFacts: RenderRuntimeFacts
  readonly surface: SurfaceContextValue
  readonly commandBoundary: AdminSectionCommandBoundary
}>

export type AdminSectionProps = Readonly<{
  readonly context: AdminSectionRenderContext
}>

export type AdminSectionComponent = ComponentType<AdminSectionProps>
