import type {RendererCatalog} from '@catering-v2s/ui-base-render'
import type {UiCatalogEntry} from '@catering-v2s/kernel-base-ui-state'
import {PrimitiveEmptyState} from '@catering-v2s/ui-base-primitives'
import {adminTestIds} from '../foundations/adminTestIds'
import {createAdminSectionCommandBoundary, type AdminSectionCommandBoundary} from '../foundations/adminSectionSelection'
import type {AdminSectionComponent} from '../types/adminSection'
import type {RenderRuntimeFacts, SurfaceContextValue} from '@catering-v2s/ui-base-render'

export type AdminSectionContentProps = Readonly<{
  readonly selectedSection: UiCatalogEntry | undefined
  readonly rendererCatalog: RendererCatalog
  readonly runtimeFacts: RenderRuntimeFacts
  readonly surface: SurfaceContextValue
  readonly commandBoundary?: AdminSectionCommandBoundary
}>

export const AdminSectionContent = ({
  selectedSection,
  rendererCatalog,
  runtimeFacts,
  surface,
  commandBoundary = createAdminSectionCommandBoundary(),
}: AdminSectionContentProps) => {
  const activeBinding = selectedSection === undefined
    ? undefined
    : rendererCatalog.resolve(selectedSection.rendererKey)
  const activeSection = activeBinding?.component as AdminSectionComponent | undefined
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
      }}
    />
  )
}
