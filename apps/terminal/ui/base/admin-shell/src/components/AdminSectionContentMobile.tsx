import type {RendererCatalog, RenderRuntimeFacts, SurfaceContextValue} from '@catering-v2s/ui-base-render';
import type {UiCatalogEntry} from '@catering-v2s/kernel-base-ui-state';
import {
  PrimitiveCard,
  PrimitiveEmptyState,
  PrimitiveFactGrid,
  PrimitiveHeading,
  PrimitiveScrollView,
  PrimitiveStatusLine,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives';
import type {TopologyAdminCapability} from '@catering-v2s/kernel-base-contracts';
import {adminTestIds} from '../foundations/adminTestIds';
import {
  createAdminSectionCommandBoundary,
  type AdminSectionCommandBoundary,
} from '../foundations/adminSectionSelection';
import {useAdminSectionBinding} from '../hooks/useAdminSectionBinding';

export type AdminSectionContentMobileProps = Readonly<{
  readonly selectedSection: UiCatalogEntry | undefined;
  readonly rendererCatalog: RendererCatalog;
  readonly runtimeFacts: RenderRuntimeFacts;
  readonly surface: SurfaceContextValue;
  readonly commandBoundary?: AdminSectionCommandBoundary;
  readonly topologyCapability?: TopologyAdminCapability;
}>;

const AdminPanelNormalStateMobile = () => (
  <PrimitiveScrollView testID="terminal.admin:panel:normal:scroll">
    <PrimitiveHeading appearance="admin-page" testID="terminal.admin:panel:normal:title">
      面板状态
    </PrimitiveHeading>
    <PrimitiveCard appearance="admin" testID="terminal.admin:panel:normal:card">
      <PrimitiveStatusLine testID="terminal.admin:panel:normal:status" tone="ok">
        终端状态：可操作
      </PrimitiveStatusLine>
      <PrimitiveFactGrid
        testID="terminal.admin:panel:normal:facts"
        columns={1}
        items={[
          {key: 'current-tab', label: '当前页面', value: '未选择'},
          {key: 'content-area', label: '内容区', value: '可滚动'},
        ]}
      />
      <PrimitiveText appearance="admin-muted" testID="terminal.admin:panel:normal:hint">
        选择上方页面后显示对应管理内容。
      </PrimitiveText>
    </PrimitiveCard>
  </PrimitiveScrollView>
);

export const AdminSectionContentMobile = ({
  selectedSection,
  rendererCatalog,
  runtimeFacts,
  surface,
  commandBoundary = createAdminSectionCommandBoundary(),
  topologyCapability,
}: AdminSectionContentMobileProps) => {
  const {activeSection, activeContext} = useAdminSectionBinding({
    selectedSection,
    rendererCatalog,
    runtimeFacts,
    surface,
    commandBoundary,
    topologyCapability,
    surfaceForm: 'mobile',
  });

  if (selectedSection === undefined || activeSection === undefined || activeContext === undefined) {
    if (selectedSection === undefined) return <AdminPanelNormalStateMobile />;
    return (
      <PrimitiveEmptyState testID={`${adminTestIds.content}:empty`} accessibilityLabel="暂无可用诊断节">
        暂无可用诊断节；请检查当前运行时配置后重试
      </PrimitiveEmptyState>
    );
  }

  const ActiveSection = activeSection;
  return <ActiveSection context={activeContext} />;
};
