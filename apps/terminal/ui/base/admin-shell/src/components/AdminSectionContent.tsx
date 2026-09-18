import {useRenderContext, type RendererCatalog} from '@catering-v2s/ui-base-render'
import type {UiCatalogEntry} from '@catering-v2s/kernel-base-ui-state'
import {useEffect} from 'react'
import {PrimitiveEmptyState} from '@catering-v2s/ui-base-primitives'
import {adminTestIds} from '../foundations/adminTestIds'
import {createAdminSectionCommandBoundary, type AdminSectionCommandBoundary} from '../foundations/adminSectionSelection'
import type {AdminSectionComponent} from '../types/adminSection'
import type {RenderRuntimeFacts, SurfaceContextValue} from '@catering-v2s/ui-base-render'
import type {TopologyAdminCapability} from '@catering-v2s/kernel-base-contracts'
import {ADMIN_TOPOLOGY_SECTION_PART_KEY} from '../foundations/adminIdentity'

export type AdminSectionContentProps = Readonly<{
  readonly selectedSection: UiCatalogEntry | undefined
  readonly rendererCatalog: RendererCatalog
  readonly runtimeFacts: RenderRuntimeFacts
  readonly surface: SurfaceContextValue
  readonly commandBoundary?: AdminSectionCommandBoundary
  readonly topologyCapability?: TopologyAdminCapability
}>

export const AdminSectionContent = ({
  selectedSection,
  rendererCatalog,
  runtimeFacts,
  surface,
  commandBoundary = createAdminSectionCommandBoundary(),
  topologyCapability,
}: AdminSectionContentProps) => {
  const {logger} = useRenderContext()
  const activeBinding = selectedSection === undefined
    ? undefined
    : rendererCatalog.resolve(selectedSection.rendererKey)
  const activeSection = activeBinding?.component as AdminSectionComponent | undefined
  useEffect(() => {
    logger.info({
      category: 'admin.navigation',
      event: 'admin.section-content-rendered',
      message: 'Admin section content mounted for the selected catalog entry',
      data: {
        partKey: selectedSection?.partKey ?? null,
        rendererKey: selectedSection?.rendererKey ?? null,
        componentAvailable: activeSection !== undefined,
        displayMode: surface.displayMode,
        surfaceForm: surface.surfaceForm,
      },
    })
  }, [activeSection, logger, selectedSection?.partKey, selectedSection?.rendererKey, surface.displayMode, surface.surfaceForm])
  if (selectedSection === undefined || activeSection === undefined) {
    return (
      <PrimitiveEmptyState testID={`${adminTestIds.content}:empty`} accessibilityLabel="暂无可用诊断节">
        暂无可用诊断节
      </PrimitiveEmptyState>
    )
  }
  const ActiveSection = activeSection
  return (
    <ActiveSection
      context={{
        catalogEntry: selectedSection,
        runtimeFacts,
        surface,
        commandBoundary,
        topologyCapability: selectedSection.partKey === ADMIN_TOPOLOGY_SECTION_PART_KEY ? topologyCapability : undefined,
      }}
    />
  )
}
