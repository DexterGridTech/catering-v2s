import {Drawer, Flex, Typography} from 'antd';
import {adminWideDrawerSurfaceProps, testId, type DrawerFormLifecycleResult} from '@catering-v2s/admin-ui-foundation';
import type {ReactNode} from 'react';
import {catalogTestIds} from '../catalogTestIds';
import {
  CatalogConfigurationLibraryNavigation,
  type CatalogConfigurationLibrary,
} from './CatalogConfigurationLibraryNavigation';

/**
 * One configuration spatial shell with two approved placements: the workbench
 * owns the first-level task, while an editor may host exactly one second-level
 * configuration child task. Controller/query state and all library commands stay
 * outside so the surface never becomes a second state owner.
 */
export function CatalogConfigurationDrawerSurface({
  open,
  lifecycle,
  currentLibrary,
  onSelectLibrary,
  onRequestClose,
  onAfterClose,
  children,
  presentation = 'WORKBENCH',
}: {
  open: boolean;
  lifecycle: Pick<DrawerFormLifecycleResult, 'afterOpenChange' | 'submitting'>;
  currentLibrary: CatalogConfigurationLibrary;
  onSelectLibrary: (library: CatalogConfigurationLibrary) => void;
  onRequestClose: () => void;
  /** Runs only after the controlled Drawer has visually closed. */
  onAfterClose?: () => void;
  children: ReactNode;
  /** The editor-child surface overlays its still-open parent instead of creating a second workspace task. */
  presentation?: 'WORKBENCH' | 'EDITOR_CHILD';
}) {
  return (
    <Drawer
      title={presentation === 'EDITOR_CHILD' ? '维护商品元数据' : '商品配置'}
      open={open}
      onClose={onRequestClose}
      afterOpenChange={visible => {
        lifecycle.afterOpenChange(visible);
        // AntD can report an initial hidden state while this surface mounts.
        // Only the controlled close transition may return focus to its parent.
        if (!visible && !open) onAfterClose?.();
      }}
      destroyOnHidden={false}
      maskClosable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      footer={null}
      push={false}
      {...adminWideDrawerSurfaceProps}
      styles={{
        ...adminWideDrawerSurfaceProps.styles,
        body: {...adminWideDrawerSurfaceProps.styles.body, overflowY: 'hidden', padding: '0 24px'},
      }}
    >
      <div
        {...testId(catalogTestIds.static.dictionaryDrawer)}
        style={{height: '100%', minHeight: 0, overflow: 'hidden'}}
      >
        <Flex style={{height: '100%', minHeight: 0, padding: '24px 0'}}>
          <CatalogConfigurationLibraryNavigation
            currentLibrary={currentLibrary}
            onSelect={onSelectLibrary}
            contentId="catalog-configuration-content"
          />
          <div
            id="catalog-configuration-content"
            role="tabpanel"
            aria-label={presentation === 'EDITOR_CHILD' ? '商品元数据内容' : '商品配置内容'}
            aria-labelledby={`catalog-configuration-tab-${currentLibrary}`}
            style={{flex: '1 1 auto', minWidth: 0, minHeight: 0, overflowY: 'auto', paddingLeft: 24}}
          >
            <Typography.Paragraph type="secondary" style={{marginBottom: 16}}>
              {presentation === 'EDITOR_CHILD'
                ? '维护完成后关闭此面板，即可继续编辑当前商品。'
                : '维护商品共用的标签、单位、规格、生产标签、属性和点单选项。'}
            </Typography.Paragraph>
            {children}
          </div>
        </Flex>
      </div>
    </Drawer>
  );
}
