import {useEffect, useMemo} from 'react'
import {
  useRenderContext,
  type RenderRuntimeFacts,
  type RendererCatalog,
  type SurfaceContextValue,
} from '@catering-v2s/ui-base-render'
import type {TopologyAdminCapability} from '@catering-v2s/kernel-base-contracts'
import type {UiCatalogEntry} from '@catering-v2s/kernel-base-ui-state'
import {ADMIN_TOPOLOGY_SECTION_PART_KEY} from '../foundations/adminIdentity'
import {
  createAdminSectionCommandBoundary,
  type AdminSectionCommandBoundary,
} from '../foundations/adminSectionSelection'
import type {
  AdminSectionComponent,
  AdminSectionRenderContext,
} from '../types/adminSection'

export type AdminSectionBindingInput = Readonly<{
  readonly selectedSection: UiCatalogEntry | undefined
  readonly rendererCatalog: RendererCatalog
  readonly runtimeFacts: RenderRuntimeFacts
  readonly surface: SurfaceContextValue
  readonly commandBoundary?: AdminSectionCommandBoundary
  readonly topologyCapability?: TopologyAdminCapability
  readonly surfaceForm: 'laptop' | 'mobile'
}>

export type AdminSectionBinding = Readonly<{
  readonly activeSection: AdminSectionComponent | undefined
  readonly activeContext: AdminSectionRenderContext | undefined
}>

/** Shared catalog binding and lifecycle owner; form renderers retain their own layout JSX. */
export const useAdminSectionBinding = ({
  selectedSection,
  rendererCatalog,
  runtimeFacts,
  surface,
  commandBoundary,
  topologyCapability,
  surfaceForm,
}: AdminSectionBindingInput): AdminSectionBinding => {
  const {logger} = useRenderContext()
  const resolvedCommandBoundary = useMemo(
    () => commandBoundary ?? createAdminSectionCommandBoundary(),
    [commandBoundary],
  )
  const activeBinding = selectedSection === undefined
    ? undefined
    : rendererCatalog.resolve(selectedSection.rendererKey)
  const activeSection = activeBinding?.component as AdminSectionComponent | undefined
  const activeContext = selectedSection === undefined
    ? undefined
    : {
      catalogEntry: selectedSection,
      runtimeFacts,
      surface,
      commandBoundary: resolvedCommandBoundary,
      topologyCapability: selectedSection.partKey === ADMIN_TOPOLOGY_SECTION_PART_KEY ? topologyCapability : undefined,
    }

  useEffect(() => {
    logger.info({
      category: 'admin.navigation',
      event: 'admin.section-content-rendered',
      message: `${surfaceForm === 'laptop' ? 'Laptop' : 'Mobile'} admin section content mounted for the selected catalog entry`,
      data: {
        partKey: selectedSection?.partKey ?? null,
        rendererKey: selectedSection?.rendererKey ?? null,
        componentAvailable: activeSection !== undefined,
        displayMode: surface.displayMode,
        surfaceForm,
      },
    })
  }, [activeSection, logger, selectedSection?.partKey, selectedSection?.rendererKey, surface.displayMode, surfaceForm])

  return {activeSection, activeContext}
}
