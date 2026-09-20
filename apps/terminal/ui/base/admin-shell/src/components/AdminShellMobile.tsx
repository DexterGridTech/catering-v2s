import {useMemo} from 'react'
import type {UiCatalogEntry} from '@catering-v2s/kernel-base-ui-state'
import {adminGeometry, PrimitiveContainer} from '@catering-v2s/ui-base-primitives'
import {useRenderContext, useRenderStatus, useSurfaceContext, useUiCatalogContext} from '@catering-v2s/ui-base-render'
import {AdminFrameReporterContext, panelFrameId, useAdminFrameController} from '../foundations/adminFrameRegistry'
import {createAdminSectionCommandBoundary} from '../foundations/adminSectionSelection'
import {adminTestIds} from '../foundations/adminTestIds'
import {useAdminSections} from '../hooks/useAdminSections'
import type {AdminShellProps} from '../types/adminShell'
import {AdminSectionContent} from './AdminSectionContent'
import {AdminSectionNavigation} from './AdminSectionNavigation'
import {AdminPanelStateCard, AdminShellFrame, adminPanelStatusFromRuntime} from './AdminShellFrame'
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

const contentStyle = adminGeometry.contentMobile

export const AdminShellMobile = ({onClose}: AdminShellProps) => {
  const {uiCatalog, rendererCatalog, runtimeFacts, topologyCapability, onRuntimeRetry} = useRenderContext()
  const surface = useSurfaceContext()
  const runtimeStatus = useRenderStatus()
  const catalogContext = useUiCatalogContext(surface.displayMode)
  const commandBoundary = useMemo(() => createAdminSectionCommandBoundary(), [])
  const selection = useAdminSections({catalog: uiCatalog, context: catalogContext})
  const resolvedSelection = resolveMobileSelection({
    sections: selection.sections,
    requestedPartKey: selection.selectedPartKey,
  })
  const defaultFrameId = runtimeStatus !== 'started'
    ? panelFrameId(surface.surfaceForm, runtimeStatus === 'failed' ? 'error' : 'loading')
    : catalogContext === undefined
      ? panelFrameId(surface.surfaceForm, 'error')
      : selection.sections.length === 0
        ? panelFrameId(surface.surfaceForm, 'empty')
        : panelFrameId(surface.surfaceForm, 'normal')
  const frameController = useAdminFrameController(defaultFrameId)

  return (
    <AdminFrameReporterContext.Provider value={frameController.reportFrame}>
      <AdminShellFrame frameId={frameController.frameId} onClose={onClose} status={adminPanelStatusFromRuntime(runtimeStatus)}>
        {runtimeStatus === 'started' ? <PowerConfirmationBridge /> : null}
        <AdminSectionNavigation
          sections={selection.sections}
          selectedPartKey={resolvedSelection.selectedPartKey}
          onSelect={selection.selectSection}
        />
        <PrimitiveContainer testID={adminTestIds.content} layout="content" appearance="admin-content" bounded style={contentStyle}>
          {runtimeStatus !== 'started' ? (
            <AdminPanelStateCard state={runtimeStatus === 'failed' ? 'error' : 'loading'} onRetry={onRuntimeRetry} />
          ) : catalogContext === undefined ? (
            <AdminPanelStateCard state="error" onRetry={onRuntimeRetry} />
          ) : selection.sections.length === 0 ? (
            <AdminPanelStateCard state="empty" />
          ) : (
            <AdminSectionContent
              key={resolvedSelection.selectedPartKey ?? 'empty'}
              selectedSection={resolvedSelection.selectedSection}
              rendererCatalog={rendererCatalog}
              runtimeFacts={runtimeFacts}
              surface={surface}
              commandBoundary={commandBoundary}
              topologyCapability={topologyCapability}
            />
          )}
        </PrimitiveContainer>
      </AdminShellFrame>
    </AdminFrameReporterContext.Provider>
  )
}
