import {useMemo} from 'react'
import type {UiCatalogEntry} from '@catering-v2s/kernel-base-ui-state'
import {PrimitiveContainer, PrimitiveEmptyState} from '@catering-v2s/ui-base-primitives'
import {useRenderContext, useRenderStatus, useSurfaceContext, useUiCatalogContext} from '@catering-v2s/ui-base-render'
import {createAdminSectionCommandBoundary} from '../foundations/adminSectionSelection'
import {adminTestIds} from '../foundations/adminTestIds'
import {useAdminSections} from '../hooks/useAdminSections'
import type {AdminShellProps} from '../types/adminShell'
import {AdminSectionContent} from './AdminSectionContent'
import {AdminSectionNavigation} from './AdminSectionNavigation'
import {AdminShellFrame} from './AdminShellFrame'
import {PowerConfirmationBridge} from './PowerConfirmationBridge'

const resolveMobileSelection = ({sections, requestedPartKey}: Readonly<{
  readonly sections: readonly UiCatalogEntry[]
  readonly requestedPartKey: string | null
}>): Readonly<{readonly selectedPartKey: string | null; readonly selectedSection: UiCatalogEntry | undefined}> => {
  const selectedPartKey = requestedPartKey !== null && sections.some(section => section.partKey === requestedPartKey)
    ? requestedPartKey
    : sections[0]?.partKey ?? null
  return {
    selectedPartKey,
    selectedSection: selectedPartKey === null
      ? undefined
      : sections.find(section => section.partKey === selectedPartKey),
  }
}

const contentStyle = Object.freeze({flex: 1, minHeight: 0, minWidth: 0})

export const AdminShellMobile = ({onClose}: AdminShellProps) => {
  const {uiCatalog, rendererCatalog, runtimeFacts, topologyCapability} = useRenderContext()
  const surface = useSurfaceContext()
  const runtimeStatus = useRenderStatus()
  const catalogContext = useUiCatalogContext(surface.displayMode)
  const commandBoundary = useMemo(() => createAdminSectionCommandBoundary(), [])
  const selection = useAdminSections({catalog: uiCatalog, context: catalogContext})
  const resolvedSelection = resolveMobileSelection({
    sections: selection.sections,
    requestedPartKey: selection.selectedPartKey,
  })

  if (runtimeStatus !== 'started' || catalogContext === undefined) {
    return (
      <AdminShellFrame onClose={onClose}>
        <PrimitiveEmptyState testID={`${adminTestIds.content}:unavailable`}>运行状态尚未就绪</PrimitiveEmptyState>
      </AdminShellFrame>
    )
  }

  return (
    <AdminShellFrame onClose={onClose}>
      <PowerConfirmationBridge />
      <AdminSectionNavigation
        sections={selection.sections}
        selectedPartKey={resolvedSelection.selectedPartKey}
        onSelect={selection.selectSection}
      />
      <PrimitiveContainer testID={adminTestIds.content} layout="content" bounded style={contentStyle}>
        <AdminSectionContent
          key={resolvedSelection.selectedPartKey ?? 'empty'}
          selectedSection={resolvedSelection.selectedSection}
          rendererCatalog={rendererCatalog}
          runtimeFacts={runtimeFacts}
          surface={surface}
          commandBoundary={commandBoundary}
          topologyCapability={topologyCapability}
        />
      </PrimitiveContainer>
    </AdminShellFrame>
  )
}
