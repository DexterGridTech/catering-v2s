import {Button, Space, Typography} from 'antd';
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
  return (
    <nav
      aria-label="商品配置分类"
      style={{
        width: 184,
        flex: '0 0 184px',
        alignSelf: 'flex-start',
        position: 'sticky',
        top: 0,
        borderRight: '1px solid var(--ant-color-border-secondary)',
        paddingRight: 12,
      }}
      {...testId(catalogTestIds.static.dictionaryTabs)}
    >
      <Typography.Text strong style={{display: 'block', margin: '4px 8px 12px'}}>
        商品配置
      </Typography.Text>
      <Space direction="vertical" size={4} style={{display: 'flex'}}>
        {libraries.map(library => (
          <Button
            key={library.key}
            type={currentLibrary === library.key ? 'primary' : 'text'}
            block
            style={{textAlign: 'left'}}
            {...testId(catalogTestIdControls.config.library(library.key))}
            aria-current={currentLibrary === library.key ? 'page' : undefined}
            aria-controls={contentId}
            onClick={() => onSelect(library.key)}
          >
            {library.label}
          </Button>
        ))}
      </Space>
    </nav>
  );
}
