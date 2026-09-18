import {useCallback, useEffect, useMemo} from 'react'
import type {UiCatalogEntry} from '@catering-v2s/kernel-base-ui-state'
import {PrimitiveContainer, PrimitiveEmptyState, PrimitiveGrid} from '@catering-v2s/ui-base-primitives'
import {useRenderContext, useRenderStatus, useSurfaceContext, useUiCatalogContext} from '@catering-v2s/ui-base-render'
import {createAdminSectionCommandBoundary} from '../foundations/adminSectionSelection'
import {adminTestIds} from '../foundations/adminTestIds'
import {useAdminSections} from '../hooks/useAdminSections'
import type {AdminShellProps} from '../types/adminShell'
import {AdminSectionContent} from './AdminSectionContent'
import {AdminShellFrame} from './AdminShellFrame'
import {AdminSectionNavigationLaptop} from './AdminSectionNavigationLaptop'
import {PowerConfirmationBridge} from './PowerConfirmationBridge'

const resolveLaptopSelection = ({sections, requestedPartKey}: Readonly<{
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

export const AdminShellLaptop = (props: AdminShellProps) => (
  <AdminShellLaptopContent {...props} />
)

const workspaceStyle = Object.freeze({
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  flexDirection: 'row' as const,
  flexWrap: 'nowrap' as const,
  alignItems: 'stretch' as const,
})
const navigationFrameStyle = Object.freeze({width: 280, minWidth: 220, maxWidth: 360, minHeight: 0, flexShrink: 0})
const detailFrameStyle = Object.freeze({flex: 1, minHeight: 0, minWidth: 0})

const AdminShellLaptopContent = ({onClose}: AdminShellProps) => {
  const {logger, uiCatalog, rendererCatalog, runtimeFacts, topologyCapability} = useRenderContext()
  const surface = useSurfaceContext()
  const runtimeStatus = useRenderStatus()
  const catalogContext = useUiCatalogContext(surface.displayMode)
  const commandBoundary = useMemo(() => createAdminSectionCommandBoundary(), [])
  const selection = useAdminSections({catalog: uiCatalog, context: catalogContext})
  const resolvedSelection = resolveLaptopSelection({
    sections: selection.sections,
    requestedPartKey: selection.selectedPartKey,
  })
  const selectSection = useCallback((partKey: string) => {
    logger.info({
      category: 'admin.navigation',
      event: 'admin.section-requested',
      message: 'Admin section navigation requested',
      data: {
        partKey,
        displayMode: surface.displayMode,
        surfaceForm: surface.surfaceForm,
        workspace: catalogContext?.workspace ?? null,
        instanceMode: catalogContext?.instanceMode ?? null,
      },
    })
    selection.selectSection(partKey)
  }, [catalogContext?.instanceMode, catalogContext?.workspace, logger, selection.selectSection, surface.displayMode, surface.surfaceForm])

  useEffect(() => {
    logger.info({
      category: 'admin.navigation',
      event: 'admin.section-rendered',
      message: 'Admin section selection rendered',
      data: {
        requestedPartKey: selection.selectedPartKey,
        resolvedPartKey: resolvedSelection.selectedPartKey,
        displayMode: surface.displayMode,
        surfaceForm: surface.surfaceForm,
        workspace: catalogContext?.workspace ?? null,
        instanceMode: catalogContext?.instanceMode ?? null,
      },
    })
  }, [catalogContext?.instanceMode, catalogContext?.workspace, logger, resolvedSelection.selectedPartKey, selection.selectedPartKey, surface.displayMode, surface.surfaceForm])

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
      <PrimitiveGrid testID="terminal.admin:workspace" style={workspaceStyle}>
        <PrimitiveContainer testID="terminal.admin:navigation-frame" layout="content" style={navigationFrameStyle}>
          <AdminSectionNavigationLaptop
            sections={selection.sections}
            selectedPartKey={resolvedSelection.selectedPartKey}
            onSelect={selectSection}
          />
        </PrimitiveContainer>
        <PrimitiveContainer testID={adminTestIds.content} layout="content" bounded style={detailFrameStyle}>
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
      </PrimitiveGrid>
    </AdminShellFrame>
  )
}
