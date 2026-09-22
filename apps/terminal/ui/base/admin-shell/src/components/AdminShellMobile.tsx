import {useMemo} from 'react'
import {adminGeometry, PrimitiveContainer} from '@catering-v2s/ui-base-primitives'
import {useRenderContext, useRenderStatus, useSurfaceContext, useUiCatalogContext} from '@catering-v2s/ui-base-render'
import {AdminFrameReporterContext, panelFrameId, useAdminFrameController} from '../foundations/adminFrameRegistry'
import {createAdminSectionCommandBoundary} from '../foundations/adminSectionSelection'
import {adminTestIds} from '../foundations/adminTestIds'
import {useAdminSections} from '../hooks/useAdminSections'
import type {AdminShellProps} from '../types/adminShell'
import {AdminSectionContentMobile} from './AdminSectionContentMobile'
import {AdminSectionNavigationMobile} from './AdminSectionNavigationMobile'
import {AdminPanelStateCardMobile} from './AdminPanelStateCardMobile'
import {adminPanelStatusFromRuntime} from './AdminShellFrame'
import {AdminShellFrameMobile} from './AdminShellFrameMobile'
import {PowerConfirmationBridge} from './PowerConfirmationBridge'

const contentStyle = adminGeometry.contentMobile

export const AdminShellMobile = ({onClose}: AdminShellProps) => {
  const {uiCatalog, rendererCatalog, runtimeFacts, topologyCapability, onRuntimeRetry} = useRenderContext()
  const surface = useSurfaceContext()
  const runtimeStatus = useRenderStatus()
  const catalogContext = useUiCatalogContext(surface.displayMode)
  const commandBoundary = useMemo(() => createAdminSectionCommandBoundary(), [])
  const selection = useAdminSections({catalog: uiCatalog, context: catalogContext})
  const defaultFrameId = runtimeStatus !== 'started'
    ? panelFrameId('mobile', runtimeStatus === 'failed' ? 'error' : 'loading')
    : catalogContext === undefined
      ? panelFrameId('mobile', 'error')
      : selection.sections.length === 0
        ? panelFrameId('mobile', 'empty')
        : panelFrameId('mobile', 'normal')
  const frameController = useAdminFrameController(defaultFrameId)

  return (
    <AdminFrameReporterContext.Provider value={frameController.reportFrame}>
      <AdminShellFrameMobile frameId={frameController.frameId} onClose={onClose} status={adminPanelStatusFromRuntime(runtimeStatus)}>
        {runtimeStatus === 'started' ? <PowerConfirmationBridge /> : null}
        <AdminSectionNavigationMobile
          sections={selection.sections}
          selectedPartKey={selection.selectedPartKey}
          onSelect={selection.selectSection}
        />
        <PrimitiveContainer testID={adminTestIds.content} layout="content" appearance="admin-content" bounded style={contentStyle}>
          {runtimeStatus !== 'started' ? (
            <AdminPanelStateCardMobile state={runtimeStatus === 'failed' ? 'error' : 'loading'} onRetry={onRuntimeRetry} />
          ) : catalogContext === undefined ? (
            <AdminPanelStateCardMobile state="error" onRetry={onRuntimeRetry} />
          ) : selection.sections.length === 0 ? (
            <AdminPanelStateCardMobile state="empty" />
          ) : (
            <AdminSectionContentMobile
              key={selection.selectedPartKey ?? 'empty'}
              selectedSection={selection.selectedSection}
              rendererCatalog={rendererCatalog}
              runtimeFacts={runtimeFacts}
              surface={surface}
              commandBoundary={commandBoundary}
              topologyCapability={topologyCapability}
            />
          )}
        </PrimitiveContainer>
      </AdminShellFrameMobile>
    </AdminFrameReporterContext.Provider>
  )
}
