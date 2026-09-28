import {useCallback, useEffect, useMemo} from 'react';
import {adminGeometry, PrimitiveContainer, PrimitiveGrid} from '@catering-v2s/ui-base-primitives';
import {useRenderContext, useRenderStatus, useSurfaceContext, useUiCatalogContext} from '@catering-v2s/ui-base-render';
import {AdminFrameReporterContext, panelFrameId, useAdminFrameController} from '../foundations/adminFrameRegistry';
import {createAdminSectionCommandBoundary} from '../foundations/adminSectionSelection';
import {adminTestIds} from '../foundations/adminTestIds';
import {useAdminSections} from '../hooks/useAdminSections';
import type {AdminShellProps} from '../types/adminShell';
import {AdminSectionContentLaptop} from './AdminSectionContentLaptop';
import {AdminPanelStateCardLaptop} from './AdminPanelStateCardLaptop';
import {adminPanelStatusFromRuntime} from './AdminShellFrame';
import {AdminShellFrameLaptop} from './AdminShellFrameLaptop';
import {AdminSectionNavigationLaptop} from './AdminSectionNavigationLaptop';
import {PowerConfirmationBridge} from './PowerConfirmationBridge';

export const AdminShellLaptop = (props: AdminShellProps) => <AdminShellLaptopContent {...props} />;

const workspaceStyle = Object.freeze({
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  flexDirection: 'row' as const,
  flexWrap: 'nowrap' as const,
  alignItems: 'stretch' as const,
});
const navigationFrameStyle = adminGeometry.navigation;
const detailFrameStyle = adminGeometry.contentLaptop;

const AdminShellLaptopContent = ({onClose}: AdminShellProps) => {
  const {logger, uiCatalog, rendererCatalog, runtimeFacts, topologyCapability, onRuntimeRetry} = useRenderContext();
  const surface = useSurfaceContext();
  const runtimeStatus = useRenderStatus();
  const catalogContext = useUiCatalogContext(surface.displayMode);
  const commandBoundary = useMemo(() => createAdminSectionCommandBoundary(), []);
  const selection = useAdminSections({catalog: uiCatalog, context: catalogContext});
  const defaultFrameId =
    runtimeStatus !== 'started'
      ? panelFrameId('laptop', runtimeStatus === 'failed' ? 'error' : 'loading')
      : catalogContext === undefined
        ? panelFrameId('laptop', 'error')
        : selection.sections.length === 0
          ? panelFrameId('laptop', 'empty')
          : panelFrameId('laptop', 'normal');
  const frameController = useAdminFrameController(defaultFrameId);
  const selectAdminSection = selection.selectSection;
  const selectSection = useCallback(
    (partKey: string) => {
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
      });
      logger.info({
        category: 'admin.navigation',
        event: 'admin.section-selection-dispatch-started',
        message: 'Admin section selection dispatch started',
        data: {partKey},
      });
      selectAdminSection(partKey);
      logger.info({
        category: 'admin.navigation',
        event: 'admin.section-selection-dispatch-returned',
        message: 'Admin section selection dispatch returned',
        data: {partKey},
      });
    },
    [
      catalogContext?.instanceMode,
      catalogContext?.workspace,
      logger,
      selectAdminSection,
      surface.displayMode,
      surface.surfaceForm,
    ],
  );

  useEffect(() => {
    logger.info({
      category: 'admin.navigation',
      event: 'admin.section-rendered',
      message: 'Admin section selection rendered',
      data: {
        requestedPartKey: selection.selectedPartKey,
        resolvedPartKey: selection.selectedPartKey,
        displayMode: surface.displayMode,
        surfaceForm: surface.surfaceForm,
        workspace: catalogContext?.workspace ?? null,
        instanceMode: catalogContext?.instanceMode ?? null,
      },
    });
  }, [
    catalogContext?.instanceMode,
    catalogContext?.workspace,
    logger,
    selection.selectedPartKey,
    surface.displayMode,
    surface.surfaceForm,
  ]);

  return (
    <AdminFrameReporterContext.Provider value={frameController.reportFrame}>
      <AdminShellFrameLaptop
        frameId={frameController.frameId}
        onClose={onClose}
        status={adminPanelStatusFromRuntime(runtimeStatus)}
      >
        {runtimeStatus === 'started' ? <PowerConfirmationBridge /> : null}
        <PrimitiveGrid testID="terminal.admin:workspace" style={workspaceStyle}>
          <PrimitiveContainer
            testID="terminal.admin:navigation-frame"
            layout="content"
            appearance="admin-nav"
            style={navigationFrameStyle}
          >
            <AdminSectionNavigationLaptop
              sections={selection.sections}
              selectedPartKey={selection.selectedPartKey}
              onSelect={selectSection}
            />
          </PrimitiveContainer>
          <PrimitiveContainer
            testID={adminTestIds.content}
            layout="content"
            appearance="admin-content"
            bounded
            style={detailFrameStyle}
          >
            {runtimeStatus !== 'started' ? (
              <AdminPanelStateCardLaptop
                state={runtimeStatus === 'failed' ? 'error' : 'loading'}
                onRetry={onRuntimeRetry}
              />
            ) : catalogContext === undefined ? (
              <AdminPanelStateCardLaptop state="error" onRetry={onRuntimeRetry} />
            ) : selection.sections.length === 0 ? (
              <AdminPanelStateCardLaptop state="empty" />
            ) : (
              <AdminSectionContentLaptop
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
        </PrimitiveGrid>
      </AdminShellFrameLaptop>
    </AdminFrameReporterContext.Provider>
  );
};
