import {Button, theme} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';
import type {CatalogLibraryKind} from '../model/catalogWorkspaceTask';

export type CatalogConfigurationLibrary = Exclude<CatalogLibraryKind, 'SKU_ATTRIBUTE_VALUE'>;

const libraries: ReadonlyArray<{key: CatalogConfigurationLibrary; label: string}> = [
  {key: 'TAG', label: '商品标签'},
  {key: 'UNIT', label: '计量单位'},
  {key: 'SKU_ATTRIBUTE', label: '规格维度'},
  {key: 'PRODUCTION_TAG', label: '生产标签'},
  {key: 'ATTRIBUTES', label: '商品属性库'},
  {key: 'ORDER_OPTIONS', label: '点单选项库'},
];

/** The first-column navigation of the full-height catalog configuration drawer. */
export function CatalogConfigurationLibraryNavigation({
  currentLibrary,
  onSelect,
  contentId,
}: {
  currentLibrary: CatalogConfigurationLibrary;
  onSelect: (library: CatalogConfigurationLibrary) => void;
  contentId: string;
}) {
  const {token} = theme.useToken();

  return (
    <nav
      aria-label="商品配置分类"
      style={{
        width: 172,
        flex: '0 0 172px',
        alignSelf: 'stretch',
        position: 'sticky',
        top: 0,
        borderInlineEnd: `1px solid ${token.colorBorderSecondary}`,
      }}
      {...testId(catalogTestIds.static.dictionaryTabs)}
    >
      <div
        role="tablist"
        aria-orientation="vertical"
        style={{display: 'flex', flexDirection: 'column', gap: token.margin}}
      >
        {libraries.map(library => (
          <Button
            key={library.key}
            id={`catalog-configuration-tab-${library.key}`}
            type="text"
            block
            role="tab"
            aria-selected={currentLibrary === library.key}
            {...testId(catalogTestIdControls.config.library(library.key))}
            aria-current={currentLibrary === library.key ? 'page' : undefined}
            aria-controls={contentId}
            onClick={() => onSelect(library.key)}
            style={{
              appearance: 'none',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              minHeight: token.controlHeight,
              padding: `${token.paddingXS}px ${token.paddingLG}px`,
              border: 0,
              borderRadius: 0,
              borderInlineEnd: `${token.lineWidthBold}px solid ${
                currentLibrary === library.key ? token.colorPrimary : 'transparent'
              }`,
              background: 'transparent',
              color: currentLibrary === library.key ? token.colorPrimary : token.colorText,
              cursor: 'pointer',
              font: 'inherit',
              textAlign: 'left',
              transition: `color ${token.motionDurationSlow}`,
            }}
          >
            {library.label}
          </Button>
        ))}
      </div>
    </nav>
  );
}
