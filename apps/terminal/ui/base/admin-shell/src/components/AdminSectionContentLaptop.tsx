import {type RendererCatalog, type RenderRuntimeFacts, type SurfaceContextValue} from '@catering-v2s/ui-base-render';
import type {UiCatalogEntry} from '@catering-v2s/kernel-base-ui-state';
import {
  PrimitiveCard,
  PrimitiveEmptyState,
  PrimitiveFactGrid,
  PrimitiveHeading,
  PrimitiveScrollView,
  PrimitiveStatusLine,
  PrimitiveText,
  testIdProps,
} from '@catering-v2s/ui-base-primitives';
import type {TopologyAdminCapability} from '@catering-v2s/kernel-base-contracts';
import {adminTestIds} from '../foundations/adminTestIds';
import {
  createAdminSectionCommandBoundary,
  type AdminSectionCommandBoundary,
} from '../foundations/adminSectionSelection';
import {useAdminSectionBinding} from '../hooks/useAdminSectionBinding';

export type AdminSectionContentLaptopProps = Readonly<{
  readonly selectedSection: UiCatalogEntry | undefined;
  readonly rendererCatalog: RendererCatalog;
  readonly runtimeFacts: RenderRuntimeFacts;
  readonly surface: SurfaceContextValue;
  readonly commandBoundary?: AdminSectionCommandBoundary;
  readonly topologyCapability?: TopologyAdminCapability;
}>;

const AdminPanelNormalStateLaptop = () => (
  <PrimitiveScrollView testID={adminTestIds.node('terminal.admin:panel:normal:scroll')}>
    <PrimitiveHeading appearance="admin-page" testID={adminTestIds.node('terminal.admin:panel:normal:title')}>
      面板状态
    </PrimitiveHeading>
    <PrimitiveCard appearance="admin" testID={adminTestIds.node('terminal.admin:panel:normal:card')}>
      <PrimitiveStatusLine testID={adminTestIds.node('terminal.admin:panel:normal:status')} tone="ok">
        终端状态：可操作
      </PrimitiveStatusLine>
      <PrimitiveFactGrid
        testID={adminTestIds.node('terminal.admin:panel:normal:facts')}
        columns={2}
        items={[
          {key: 'current-tab', label: '当前页面', value: '未选择'},
          {key: 'content-area', label: '内容区', value: '可滚动'},
        ]}
      />
      <PrimitiveText appearance="admin-muted" testID={adminTestIds.node('terminal.admin:panel:normal:hint')}>
        选择左侧导航项后显示对应管理内容。
      </PrimitiveText>
    </PrimitiveCard>
  </PrimitiveScrollView>
);

export const AdminSectionContentLaptop = ({
  selectedSection,
  rendererCatalog,
  runtimeFacts,
  surface,
  commandBoundary = createAdminSectionCommandBoundary(),
  topologyCapability,
}: AdminSectionContentLaptopProps) => {
  const {activeSection, activeContext} = useAdminSectionBinding({
    selectedSection,
    rendererCatalog,
    runtimeFacts,
    surface,
    commandBoundary,
    topologyCapability,
    surfaceForm: 'laptop',
  });
  if (selectedSection === undefined || activeSection === undefined || activeContext === undefined) {
    if (selectedSection === undefined) return <AdminPanelNormalStateLaptop />;
    return (
      <PrimitiveEmptyState
        {...testIdProps(adminTestIds.child(adminTestIds.content, 'empty'))}
        accessibilityLabel="暂无可用诊断节"
      >
        暂无可用诊断节；请检查当前运行时配置后重试
      </PrimitiveEmptyState>
    );
  }

  const ActiveSection = activeSection;
  return <ActiveSection context={activeContext} />;
};
