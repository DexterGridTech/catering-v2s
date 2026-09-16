import {useMemo} from 'react'
import type {UiCatalogEntry} from '@catering-v2s/kernel-base-ui-state'
import {PrimitiveContainer, PrimitiveEmptyState} from '@catering-v2s/ui-base-primitives'
import {createCatalogContext, useRenderContext, useRenderSnapshot, useSurfaceContext} from '@catering-v2s/ui-base-render'
import {createAdminSectionCommandBoundary} from '../foundations/adminSectionSelection'
import {adminTestIds} from '../foundations/adminTestIds'
import {useAdminSections} from '../hooks/useAdminSections'
import type {AdminShellProps} from '../types/adminShell'
import {AdminSectionContent} from './AdminSectionContent'
import {AdminSectionNavigation} from './AdminSectionNavigation'
import {AdminShellFrame} from './AdminShellFrame'

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
  const {uiCatalog, rendererCatalog, stateSource, runtimeFacts, selectSurfaceForm} = useRenderContext()
  const surface = useSurfaceContext()
  const snapshot = useRenderSnapshot()
  const commandBoundary = useMemo(() => createAdminSectionCommandBoundary(), [])

  if (snapshot.root === undefined) {
    return (
      <AdminShellFrame onClose={onClose}>
        <PrimitiveEmptyState testID={`${adminTestIds.content}:unavailable`}>运行状态尚未就绪</PrimitiveEmptyState>
      </AdminShellFrame>
    )
  }

  const catalogContext = createCatalogContext(snapshot.root, surface.displayMode, selectSurfaceForm(snapshot.root))
  const selection = useAdminSections({catalog: uiCatalog, context: catalogContext})
  const resolvedSelection = resolveMobileSelection({
    sections: selection.sections,
    requestedPartKey: selection.selectedPartKey,
  })

  return (
    <AdminShellFrame onClose={onClose}>
      <AdminSectionNavigation
        sections={selection.sections}
        selectedPartKey={resolvedSelection.selectedPartKey}
        onSelect={selection.selectSection}
      />
      <PrimitiveContainer testID={adminTestIds.content} layout="content" bounded style={contentStyle}>
        <AdminSectionContent
          selectedSection={resolvedSelection.selectedSection}
          rendererCatalog={rendererCatalog}
          stateRoot={snapshot.root}
          stateSource={stateSource}
          runtimeFacts={runtimeFacts}
          surface={surface}
          commandBoundary={commandBoundary}
        />
      </PrimitiveContainer>
    </AdminShellFrame>
  )
}
