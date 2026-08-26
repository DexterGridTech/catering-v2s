import {Descriptions, Space, Tag, Typography} from 'antd';
import {adminWideDetailDescriptionsProps} from '@catering-v2s/admin-ui-foundation';
import type {CatalogDetail} from '../model/catalogModel';
import {EmptySection} from './CatalogItemReadOnlyPresenters';
import {CatalogFactSectionView} from './CatalogFactSectionBoundary';

export function CatalogItemIdentifiersView({detail}: {detail: NonNullable<CatalogDetail>}) {
  return (
    <CatalogFactSectionView section="identifiers">
      {detail.item.identifiers.length ? (
        <Descriptions
          {...adminWideDetailDescriptionsProps}
          items={detail.item.identifiers.map((entry, index) => ({
            key: `${entry.identifierType}-${index}`,
            label:
              entry.identifierType === 'PLU' ? '称重键码' : entry.identifierType === 'MNEMONIC' ? '助记码' : '条码',
            children: (
              <Space>
                <Typography.Text>{entry.identifierValue}</Typography.Text>
                <Tag>商品</Tag>
              </Space>
            ),
          }))}
        />
      ) : (
        <EmptySection text="未维护条码与识别码" />
      )}
    </CatalogFactSectionView>
  );
}
